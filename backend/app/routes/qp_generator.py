import json
import re
import random
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.models.question_paper import QuestionPaper
from app.models.course_document import CourseDocument
from app.models.course import Course
from app.models.bloom import Bloom
from app.models.qlevel import QLevel
from app.models.branch import Branch
from app.extensions import db
from app.routes.auth import token_required
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService
from app.services.optimization_module import OptimizationModule

qp_generator_bp = Blueprint('qp_generator', __name__)

BLOOM_ACTION_VERBS = {
    'Remember': ['Define', 'State', 'List', 'Name', 'Recall', 'Identify', 'Outline'],
    'Understand': ['Explain', 'Describe', 'Discuss', 'Distinguish between', 'Summarize', 'Illustrate', 'Interpret'],
    'Apply': ['Apply', 'Demonstrate', 'Solve', 'Calculate', 'Implement', 'Execute', 'Determine'],
    'Analyze': ['Analyze', 'Compare and contrast', 'Categorize', 'Differentiate', 'Examine', 'Investigate'],
    'Evaluate': ['Evaluate', 'Assess', 'Justify', 'Critique', 'Verify', 'Recommend', 'Defend'],
    'Create': ['Design', 'Construct', 'Formulate', 'Develop', 'Propose', 'Synthesize', 'Compose']
}

def get_bloom_verbs(bloom_name):
    if not bloom_name:
        return ['Explain', 'Analyze', 'Describe', 'Formulate']
    b_str = str(bloom_name).strip()
    if b_str in BLOOM_ACTION_VERBS:
        return BLOOM_ACTION_VERBS[b_str]
    b_lower = b_str.lower()
    if 'rememb' in b_lower or 'know' in b_lower or 'recall' in b_lower:
        return ['Define', 'State', 'List', 'Name', 'Recall', 'Identify', 'Outline']
    elif 'underst' in b_lower or 'comprehen' in b_lower:
        return ['Explain', 'Describe', 'Discuss', 'Distinguish between', 'Summarize', 'Illustrate', 'Interpret']
    elif 'appl' in b_lower or 'comput' in b_lower:
        return ['Apply', 'Demonstrate', 'Solve', 'Calculate', 'Implement', 'Execute', 'Determine']
    elif 'analy' in b_lower or 'examin' in b_lower or 'investigat' in b_lower:
        return ['Analyze', 'Compare and contrast', 'Categorize', 'Differentiate', 'Examine', 'Investigate']
    elif 'evaluat' in b_lower or 'assess' in b_lower or 'critiq' in b_lower or 'judg' in b_lower:
        return ['Evaluate', 'Assess', 'Justify', 'Critique', 'Verify', 'Recommend', 'Defend']
    elif 'creat' in b_lower or 'synth' in b_lower or 'design' in b_lower or 'formulat' in b_lower:
        return ['Design', 'Construct', 'Formulate', 'Develop', 'Propose', 'Synthesize', 'Compose']
    return ['Demonstrate understanding of', 'Analyze and evaluate', 'Formulate solutions for', 'Examine the principles of']

def clean_concept(text, course_name=""):
    if not text:
        return ""
    return RAGService.clean_concept_name(text, course_name)

def extract_key_concepts_from_text(text, course_name=""):
    if not text:
        return []

    raw_lines = text.split('\n')
    concepts = []

    for line in raw_lines:
        line_s = line.strip()
        if not line_s or len(line_s) < 3:
            continue
        
        # Split on commas, semicolons, and bullets where multiple syllabus items are listed
        if ',' in line_s or ';' in line_s or '•' in line_s:
            parts = re.split(r'[,;•\t]\s*', line_s)
            for p in parts:
                p_clean = clean_concept(p, course_name)
                if p_clean and 3 <= len(p_clean) <= 90:
                    concepts.append(p_clean)
        else:
            cleaned = clean_concept(line_s, course_name)
            if cleaned and 3 <= len(cleaned) <= 90:
                concepts.append(cleaned)

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for c in concepts:
        c_low = c.lower()
        if c_low not in seen and len(c) > 2:
            seen.add(c_low)
            deduped.append(c)

    return deduped

def extract_co_buckets(concepts):
    """
    Partitions extracted syllabus concepts into 5 Course Outcome buckets (CO1 to CO5).
    """
    co_buckets = {
        'CO1': [],
        'CO2': [],
        'CO3': [],
        'CO4': [],
        'CO5': []
    }
    
    if not concepts:
        return co_buckets

    total_c = len(concepts)
    if total_c >= 5:
        chunk_size = max(1, total_c // 5)
        co_buckets['CO1'] = concepts[0 : chunk_size]
        co_buckets['CO2'] = concepts[chunk_size : 2 * chunk_size]
        co_buckets['CO3'] = concepts[2 * chunk_size : 3 * chunk_size]
        co_buckets['CO4'] = concepts[3 * chunk_size : 4 * chunk_size]
        co_buckets['CO5'] = concepts[4 * chunk_size :]
    else:
        for i, c in enumerate(concepts):
            co_key = f"CO{(i % 5) + 1}"
            co_buckets[co_key].append(c)

    return co_buckets

CO_BLOOM_MAP = {
    'CO1': ['Remember', 'Understand'],
    'CO2': ['Understand', 'Apply'],
    'CO3': ['Apply', 'Analyze'],
    'CO4': ['Analyze', 'Evaluate'],
    'CO5': ['Evaluate', 'Create'],
    'CO6': ['Evaluate', 'Create']
}

@qp_generator_bp.route('/extract-cos', methods=['POST'])
@token_required
def extract_cos_endpoint():
    """
    Automatically scans reference documents or pasted material for Course Outcomes (COs).
    If found, returns the extracted list of COs.
    If not found, returns found=False with a message prompting manual entry.
    """
    data = request.get_json() or {}
    course_id = data.get('course_id')
    document_ids = data.get('document_ids', [])
    pasted_text = (data.get('pasted_text') or data.get('material_text') or '').strip()

    corpus_text = ""
    if document_ids:
        docs = CourseDocument.query.filter(CourseDocument.id.in_(document_ids), CourseDocument.status == 1).all()
        for d in docs:
            if d.extracted_text:
                corpus_text += "\n" + d.extracted_text

    if pasted_text:
        corpus_text += "\n" + pasted_text

    if not corpus_text and course_id:
        course = Course.query.get(int(course_id))
        if course:
            docs = CourseDocument.query.filter_by(course_id=course.id, status=1).all()
            for d in docs:
                if d.extracted_text:
                    corpus_text += "\n" + d.extracted_text
            if not corpus_text and course.course_desc:
                corpus_text = course.course_desc

    extracted = RAGService.extract_course_outcomes(corpus_text)

    if extracted and len(extracted) > 0:
        return jsonify({
            'success': True,
            'found': True,
            'count': len(extracted),
            'outcomes': extracted,
            'message': f"Successfully extracted {len(extracted)} Course Outcomes (COs) from document materials!"
        })
    else:
        return jsonify({
            'success': True,
            'found': False,
            'count': 0,
            'outcomes': [],
            'message': 'No Course Outcomes (COs) detected in the uploaded documents. You can add them manually or click Auto-Generate.'
        })

@qp_generator_bp.route('/llm-status', methods=['GET'])
@token_required
def check_llm_status():
    available = LLMService.is_available()
    return jsonify({
        'success': True,
        'has_api_key': available,
        'provider': 'Google Gemini (RAG Mode)' if available else 'Optimization & RAG Engine',
        'rag_ready': True
    })

@qp_generator_bp.route('/generate', methods=['POST'])
@token_required
def generate_qp():
    data = request.get_json() or {}
    
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({'success': False, 'message': 'Course selection is required'}), 400

    course = Course.query.get(int(course_id))
    if not course:
        return jsonify({'success': False, 'message': 'Course not found'}), 404

    document_ids = data.get('document_ids', [])
    pasted_text = (data.get('pasted_text') or data.get('material_text') or '').strip()
    total_marks = int(data.get('total_marks', 50))
    title = data.get('title') or f"End Semester Examination - {course.course_code}"
    academic_year = data.get('academic_year') or "2024-25"
    sem = int(data.get('sem', course.sem or 1))
    duration = data.get('duration') or "3 Hours"
    exam_date = data.get('exam_date') or datetime.now().strftime('%b %d, %Y')
    institution_name = data.get('institution_name') or 'Grand National Tech University'
    special_instructions = data.get('special_instructions') or "1. All questions are compulsory.\n2. Simple scientific calculators are permitted."
    api_key = data.get('api_key') or LLMService.get_api_key()

    sections_config = data.get('sections', [])
    topics = data.get('topics', [])
    outcomes = data.get('outcomes', [])
    difficulty_config = data.get('difficulty', {'easy': 40, 'medium': 40, 'hard': 20})
    selected_blooms = data.get('blooms', ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'])

    # 1. RAG Document Ingestion & Corpus Aggregation
    extracted_text_corpus = ""
    docs_referenced_count = 0
    if document_ids and len(document_ids) > 0:
        docs = CourseDocument.query.filter(CourseDocument.id.in_(document_ids), CourseDocument.status == 1).all()
        docs_referenced_count = len(docs)
        for d in docs:
            if d.extracted_text:
                extracted_text_corpus += "\n" + d.extracted_text
    elif not pasted_text:
        docs = CourseDocument.query.filter_by(course_id=course.id, status=1).all()
        docs_referenced_count = len(docs)
        for d in docs:
            if d.extracted_text:
                extracted_text_corpus += "\n" + d.extracted_text

    # Integrate directly pasted / edited material text
    if pasted_text:
        extracted_text_corpus = (extracted_text_corpus + "\n" + pasted_text).strip()
        docs_referenced_count += 1

    if not extracted_text_corpus and course.course_desc:
        extracted_text_corpus = course.course_desc

    # 2. RAG Document Processing: Semantic Chunking & Unit-Wise Concept Extraction
    rag_chunks = RAGService.chunk_document(extracted_text_corpus)
    unit_concepts = RAGService.extract_unit_concepts(extracted_text_corpus, course.course_name)
    total_concepts = sum(len(c_list) for c_list in unit_concepts.values())

    # 3. RAG Grounded Question Candidate Pool Generation Aligned with COs
    candidate_pools = RAGService.generate_rag_grounded_candidate_pool(
        course_name=course.course_name,
        document_text=extracted_text_corpus,
        blooms_list=selected_blooms,
        user_outcomes=outcomes
    )

    # 4. Optimization Module: Multi-Objective Blueprint Optimization & CO Allocation
    optimized_result = OptimizationModule.optimize_examination_blueprint(
        pools_by_type=candidate_pools,
        sections_config=sections_config,
        difficulty_config=difficulty_config,
        blooms_list=selected_blooms,
        user_outcomes=outcomes
    )

    # Calculate Course Outcome coverage matrix
    co_matrix = {}
    if outcomes:
        for oc in outcomes:
            co_id = oc.get('id')
            co_matrix[co_id] = {
                'id': co_id,
                'description': oc.get('description', ''),
                'bloom_level': oc.get('bloom_level', 'Understand'),
                'unit': oc.get('unit', 'Unit 1'),
                'marks': 0,
                'question_count': 0,
                'question_numbers': []
            }

    for sec in optimized_result.get('sections', []):
        for q in sec.get('questions', []):
            q_marks = q.get('marks', 0)
            if q.get('has_internal_choice') and q.get('q1_no') and q.get('q2_no'):
                q1_co = q.get('q1_co') or q.get('co')
                q2_co = q.get('q2_co') or q.get('co')
                q1_label = f"Q{str(q.get('q1_no')).lstrip('Qq')}"
                q2_label = f"Q{str(q.get('q2_no')).lstrip('Qq')}"

                if q1_co in co_matrix:
                    co_matrix[q1_co]['marks'] += q_marks
                    co_matrix[q1_co]['question_count'] += 1
                    if q1_label not in co_matrix[q1_co]['question_numbers']:
                        co_matrix[q1_co]['question_numbers'].append(q1_label)

                if q2_co in co_matrix:
                    if q2_co != q1_co:
                        co_matrix[q2_co]['marks'] += q_marks
                        co_matrix[q2_co]['question_count'] += 1
                    if q2_label not in co_matrix[q2_co]['question_numbers']:
                        co_matrix[q2_co]['question_numbers'].append(q2_label)
            else:
                q_co = q.get('co')
                q_num = q.get('q_no')
                q_label = f"Q{str(q_num).lstrip('Qq')}" if q_num else ''
                if q_co in co_matrix:
                    co_matrix[q_co]['marks'] += q_marks
                    co_matrix[q_co]['question_count'] += 1
                    if q_label and q_label not in co_matrix[q_co]['question_numbers']:
                        co_matrix[q_co]['question_numbers'].append(q_label)

    # Department & Program resolution
    branch = None
    if g.current_user.branch_id:
        branch = Branch.query.get(g.current_user.branch_id)
    if not branch and course:
        try:
            if course.pb and course.pb.branch:
                branch = course.pb.branch
        except Exception:
            pass
    if not branch:
        branch = Branch.query.first()

    preview_data = {
        'title': title,
        'institution_name': institution_name,
        'department_name': branch.branch_name if branch else 'Department of Engineering',
        'branch_code': branch.branch_code if branch else 'ENG',
        'course_code': course.course_code,
        'course_name': course.course_name,
        'academic_year': academic_year,
        'semester': sem,
        'duration': duration,
        'exam_date': exam_date,
        'special_instructions': special_instructions,
        'total_marks': optimized_result['total_calculated_marks'],
        'documents_referenced_count': docs_referenced_count,
        'concepts_extracted_count': total_concepts,
        'rag_chunks_count': len(rag_chunks),
        'engine_used': 'Gemini LLM (RAG Grounded)' if LLMService.is_available(api_key) else 'Automated RAG & Optimization Module',
        'sections': optimized_result['sections'],
        'topics_covered': topics,
        'outcomes_covered': outcomes,
        'co_matrix': list(co_matrix.values()),
        'blooms_distribution': selected_blooms,
        'difficulty_distribution': difficulty_config
    }

    return jsonify({
        'success': True,
        'message': 'Question paper synthesized with RAG engine and Optimization Module successfully',
        'data': preview_data
    })

@qp_generator_bp.route('/save', methods=['POST'])
@token_required
def save_qp():
    data = request.get_json() or {}
    
    course_id = data.get('course_id')
    title = data.get('title')
    generated_content = data.get('generated_content')

    if not title or not generated_content:
        return jsonify({'success': False, 'message': 'Title and question paper content are required'}), 400

    course = Course.query.get(int(course_id)) if course_id else None
    branch_id = g.current_user.branch_id
    if not branch_id and course:
        try:
            if course.pb and course.pb.branch_id:
                branch_id = course.pb.branch_id
        except Exception:
            pass
    if not branch_id:
        first_b = Branch.query.first()
        branch_id = first_b.id if first_b else None

    qp = QuestionPaper(
        hod_id=g.current_user.id,
        hod_name=g.current_user.user_name,
        branch_id=branch_id,
        course_id=course.id if course else None,
        course_name=course.course_name if course else data.get('course_name'),
        course_code=course.course_code if course else data.get('course_code'),
        title=title,
        academic_year=data.get('academic_year', '2024-25'),
        sem=int(data.get('semester', 1)),
        total_marks=int(data.get('total_marks', 50)),
        duration=data.get('duration', '2 Hours'),
        paper_schema=json.dumps(data.get('paper_schema', {})),
        generated_content=json.dumps(generated_content) if isinstance(generated_content, (dict, list)) else str(generated_content),
        status=1
    )

    try:
        db.session.add(qp)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Question paper saved to department archives successfully',
            'data': qp.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@qp_generator_bp.route('', methods=['GET'])
@token_required
def get_qps():
    try:
        query = QuestionPaper.query.filter_by(status=1)
        user_role = (g.current_user.role or g.current_user.type or '').lower()
        user_branch = g.current_user.branch_id

        # HOD: view question papers generated in their branch
        if 'hod' in user_role and user_branch:
            query = query.filter(QuestionPaper.branch_id == user_branch)

        papers = query.order_by(QuestionPaper.id.desc()).all()
        return jsonify({'success': True, 'data': [p.to_dict() for p in papers]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@qp_generator_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_qp(id):
    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found'}), 404
    return jsonify({'success': True, 'data': qp.to_dict()})

@qp_generator_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_qp(id):
    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found'}), 404

    try:
        db.session.delete(qp)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Question paper deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
