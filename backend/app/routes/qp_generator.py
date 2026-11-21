import os
import json
import re
import random
from datetime import datetime
from flask import Blueprint, request, jsonify, g, send_file
from app.models.question_paper import QuestionPaper
from app.models.course_document import CourseDocument
from app.models.course import Course
from app.models.bloom import Bloom
from app.models.qlevel import QLevel
from app.models.branch import Branch
from app.models.user import User
from app.models.role import Role
from app.models.paper_shared_recipient import PaperSharedRecipient
from app.extensions import db
from app.routes.auth import token_required
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService
from app.services.optimization_module import OptimizationModule
from app.services.pdf_service import (
    ensure_original_question_paper_pdf,
    protect_question_paper,
    verify_pdf_password,
    get_vault_directory
)
from app.services.email_service import send_qp_password_email

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

def get_program_acronym(branch=None, course=None, requested_prog=None):
    """
    Returns the branch/program discipline acronym (e.g. 'CSE', 'ECE', 'EEE', 'IT', 'MECH', 'CIVIL')
    rather than a numeric branch_code or integer ID.
    """
    if requested_prog and isinstance(requested_prog, str) and not requested_prog.isdigit() and len(requested_prog.strip()) <= 10:
        return requested_prog.strip().upper()

    course_code = (course.course_code or '').upper() if course else ''
    course_name = (course.course_name or '').upper() if course else ''
    dept_name = (branch.branch_name or '').upper() if branch else ''

    # Check Course Code Prefix
    if 'CS' in course_code: return 'CSE'
    if 'IT' in course_code: return 'IT'
    if 'EC' in course_code: return 'ECE'
    if 'EE' in course_code: return 'EEE'
    if 'ME' in course_code: return 'MECH'
    if 'CE' in course_code: return 'CIVIL'
    if 'AI' in course_code or 'DS' in course_code: return 'AI&DS'
    if 'CH' in course_code: return 'CHEM'

    # Check Department Name
    if 'COMPUTER' in dept_name or 'CSE' in dept_name: return 'CSE'
    if 'INFORMATION' in dept_name or 'IT' in dept_name: return 'IT'
    if 'COMMUNICATION' in dept_name or 'ECE' in dept_name: return 'ECE'
    if 'ELECTRICAL' in dept_name or 'EEE' in dept_name: return 'EEE'
    if 'MECHANICAL' in dept_name or 'MECH' in dept_name: return 'MECH'
    if 'CIVIL' in dept_name: return 'CIVIL'
    if 'CHEMICAL' in dept_name: return 'CHEM'

    # Course Name inference
    if 'JAVA' in course_name or 'DATA STRUCTURE' in course_name or 'PYTHON' in course_name: return 'CSE'

    return 'CSE'

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
    Partitions extracted syllabus concepts into 6 Course Outcome buckets (CO1 to CO6).
    """
    co_buckets = {
        'CO1': [],
        'CO2': [],
        'CO3': [],
        'CO4': [],
        'CO5': [],
        'CO6': []
    }
    
    if not concepts:
        return co_buckets

    total_c = len(concepts)
    if total_c >= 6:
        chunk_size = max(1, total_c // 6)
        co_buckets['CO1'] = concepts[0 : chunk_size]
        co_buckets['CO2'] = concepts[chunk_size : 2 * chunk_size]
        co_buckets['CO3'] = concepts[2 * chunk_size : 3 * chunk_size]
        co_buckets['CO4'] = concepts[3 * chunk_size : 4 * chunk_size]
        co_buckets['CO5'] = concepts[4 * chunk_size : 5 * chunk_size]
        co_buckets['CO6'] = concepts[5 * chunk_size :]
    else:
        for i, c in enumerate(concepts):
            co_key = f"CO{(i % 6) + 1}"
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

    force_synthesize = bool(data.get('force_synthesize') or data.get('synthesize_from_syllabus'))
    course_name = ""
    if course_id:
        course = Course.query.get(int(course_id))
        if course:
            course_name = course.course_name

    if not course_name and document_ids:
        first_doc = CourseDocument.query.get(document_ids[0])
        if first_doc and first_doc.course:
            course_name = first_doc.course.course_name

    extracted, source_type = RAGService.extract_course_outcomes(corpus_text, course_name=course_name, force_synthesize=force_synthesize)
    extracted_units = RAGService.extract_units_and_topics(corpus_text, course_name=course_name)

    if extracted and len(extracted) > 0:
        if source_type == 'document':
            msg = f"✓ Accurately extracted {len(extracted)} Course Outcomes directly from uploaded document!"
        else:
            msg = f"🪄 Synthesized {len(extracted)} domain-specific Course Outcomes grounded in syllabus text for {course_name or 'the course'}!"

        return jsonify({
            'success': True,
            'found': True,
            'count': len(extracted),
            'source_type': source_type,
            'outcomes': extracted,
            'units': extracted_units,
            'message': msg
        })
    else:
        return jsonify({
            'success': True,
            'found': False,
            'count': 0,
            'outcomes': [],
            'units': extracted_units if extracted_units else [],
            'message': 'No Course Outcomes could be extracted or synthesized. Please check reference documents.'
        })

@qp_generator_bp.route('/extract-units', methods=['POST'])
@token_required
def extract_units_endpoint():
    """
    Scans reference documents or pasted material to dynamically extract Units, Unit titles,
    hours, and topics.
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

    course_name = ""
    if course_id:
        course = Course.query.get(int(course_id))
        if course:
            course_name = course.course_name
            if not corpus_text:
                docs = CourseDocument.query.filter_by(course_id=course.id, status=1).all()
                for d in docs:
                    if d.extracted_text:
                        corpus_text += "\n" + d.extracted_text
                if not corpus_text and course.course_desc:
                    corpus_text = course.course_desc

    units = RAGService.extract_units_and_topics(corpus_text, course_name=course_name)

    if units and len(units) > 0:
        total_topics = sum(len(u.get('topics', [])) for u in units)
        msg = f"✓ Dynamically extracted {len(units)} curriculum units and {total_topics} topics from document!"
        return jsonify({
            'success': True,
            'found': True,
            'count': len(units),
            'units': units,
            'message': msg
        })
    else:
        fallback_units = RAGService.get_fallback_units_structure(course_name)
        return jsonify({
            'success': True,
            'found': False,
            'count': len(fallback_units),
            'units': fallback_units,
            'message': f"Standard units populated for {course_name or 'the course'}"
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
    
    # Build unit_concepts from custom user topics if present and filled with topics
    custom_units_topics = {}
    if topics and isinstance(topics, list):
        for t in topics:
            u_key = t.get('unit_key') or f"Unit {t.get('id', 1)}"
            t_list = t.get('topics') or []
            if t_list:
                custom_units_topics[u_key] = t_list

    if custom_units_topics:
        unit_concepts = custom_units_topics
    else:
        unit_concepts = RAGService.extract_unit_concepts(extracted_text_corpus, course.course_name)

    total_concepts = sum(len(c_list) for c_list in unit_concepts.values())

    # 3. RAG Grounded Question Candidate Pool Generation Aligned with COs
    candidate_pools = RAGService.generate_rag_grounded_candidate_pool(
        course_name=course.course_name,
        document_text=extracted_text_corpus,
        blooms_list=selected_blooms,
        user_outcomes=outcomes,
        custom_units_topics=unit_concepts
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
            sub_div = q.get('sub_division')
            p1_m = int(q.get('p1_marks') or 0)
            p2_m = int(q.get('p2_marks') or 0)
            q_marks = int(q.get('marks') or 0)

            if sub_div == 'two_subquestions' and p1_m > 0 and p2_m > 0:
                # Sub-divided question (e.g. 11.a = 8M, 11.b = 6M)
                if q.get('has_internal_choice') and q.get('q1_no') and q.get('q2_no'):
                    q1_num = str(q.get('q1_no')).lstrip('Qq')
                    q2_num = str(q.get('q2_no')).lstrip('Qq')
                    q1_a_co = q.get('q1_co_a') or q.get('q1_co') or q.get('co')
                    q1_b_co = q.get('q1_co_b') or q.get('q1_co') or q.get('co')

                    if q1_a_co in co_matrix:
                        co_matrix[q1_a_co]['marks'] += p1_m
                        co_matrix[q1_a_co]['question_count'] += 1
                        lbl = f"Q{q1_num}a"
                        if lbl not in co_matrix[q1_a_co]['question_numbers']:
                            co_matrix[q1_a_co]['question_numbers'].append(lbl)

                    if q1_b_co in co_matrix:
                        co_matrix[q1_b_co]['marks'] += p2_m
                        co_matrix[q1_b_co]['question_count'] += 1
                        lbl = f"Q{q1_num}b"
                        if lbl not in co_matrix[q1_b_co]['question_numbers']:
                            co_matrix[q1_b_co]['question_numbers'].append(lbl)
                else:
                    q1_num = str(q.get('q1_no') or q.get('q_no')).lstrip('Qq')
                    q1_a_co = q.get('q1_co_a') or q.get('q1_co') or q.get('co')
                    q1_b_co = q.get('q1_co_b') or q.get('q1_co') or q.get('co')

                    if q1_a_co in co_matrix:
                        co_matrix[q1_a_co]['marks'] += p1_m
                        co_matrix[q1_a_co]['question_count'] += 1
                        lbl = f"Q{q1_num}a"
                        if lbl not in co_matrix[q1_a_co]['question_numbers']:
                            co_matrix[q1_a_co]['question_numbers'].append(lbl)

                    if q1_b_co in co_matrix:
                        co_matrix[q1_b_co]['marks'] += p2_m
                        co_matrix[q1_b_co]['question_count'] += 1
                        lbl = f"Q{q1_num}b"
                        if lbl not in co_matrix[q1_b_co]['question_numbers']:
                            co_matrix[q1_b_co]['question_numbers'].append(lbl)
            else:
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

                    if q2_co in co_matrix and q2_co != q1_co:
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

    # Department, Program & Regulation resolution
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

    prog_name = "B.Tech."
    reg_code = "AR23"
    try:
        if course and course.pb and course.pb.program:
            prog_name = course.pb.program.name or "B.Tech."
        if course and course.regulation:
            reg_code = course.regulation.reg or "AR23"
    except Exception:
        pass

    exam_title = title if title and not title.lower().startswith("end semester examination") else f"SEMESTER END REGULAR/SUPPLEMENTARY EXAMINATIONS ({reg_code}), NOV. – 2026"

    preview_data = {
        'title': exam_title,
        'exam_title': exam_title,
        'institution_name': institution_name or 'GMRIT DEEMED TO BE UNIVERSITY',
        'autonomous_batch': True,
        'degree': data.get('degree') or prog_name,
        'program': get_program_acronym(branch, course, data.get('program')),
        'department_name': branch.branch_name if branch else 'Department of Engineering',
        'branch_code': branch.branch_code if branch else 'ENG',
        'regulation': reg_code,
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
        user_id = g.current_user.id

        is_faculty = 'faculty' in user_role or 'teacher' in user_role or 'professor' in user_role
        is_hod = 'hod' in user_role or 'head' in user_role

        # HOD: view question papers generated in their branch
        if is_hod and user_branch:
            query = query.filter(QuestionPaper.branch_id == user_branch)

        papers = query.order_by(QuestionPaper.id.desc()).all()

        results = []
        for p in papers:
            d = p.to_dict(user_id=user_id)
            if not is_faculty:
                d['can_download'] = True
            else:
                if not p.is_password_protected:
                    d['can_download'] = True
                else:
                    d['can_download'] = d.get('is_shared_with_me', False)
            results.append(d)

        return jsonify({'success': True, 'data': results})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@qp_generator_bp.route('/available-faculty', methods=['GET'])
@token_required
def get_available_faculty():
    """
    Returns the list of active registered Faculty members available for selection by an authorized HOD.
    Excludes Admin and HOD accounts.
    """
    user_role = (g.current_user.role or g.current_user.type or '').lower()
    if not ('hod' in user_role or 'admin' in user_role or 'head' in user_role):
        return jsonify({'success': False, 'message': 'Access restricted to HOD or Administrator.'}), 403

    try:
        # Find Faculty role ID from roles table
        faculty_role = Role.query.filter(Role.role_name.ilike('faculty')).first()
        faculty_role_id = faculty_role.id if faculty_role else 2

        # Retrieve active users with Faculty role only
        faculty_users = User.query.filter(
            (User.user_type == faculty_role_id),
            (User.status == True)
        ).order_by(User.user_name.asc()).all()

        data = []
        for u in faculty_users:
            branch = Branch.query.get(u.branch_id) if u.branch_id else None
            data.append({
                'id': u.id,
                'user_name': u.user_name,
                'email': u.email,
                'per_no': u.per_no,
                'honorific': u.honorific,
                'branch_id': u.branch_id,
                'branch_name': branch.branch_name if branch else 'General'
            })

        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@qp_generator_bp.route('/<int:id>/protect-and-share', methods=['POST'])
@token_required
def protect_and_share_qp(id):
    """
    HOD-Controlled Question Paper Encryption & Selective Password Sharing.
    1. Validates HOD permission and paper finalization.
    2. Validates password and recipient IDs.
    3. Encrypts PDF using AES-256 via PyMuPDF.
    4. Dispatches password individually through email to selected faculty.
    5. Saves encryption and recipient metadata.
    """
    user_role = (g.current_user.role or g.current_user.type or '').lower()
    if not ('hod' in user_role or 'admin' in user_role or 'head' in user_role):
        return jsonify({'success': False, 'message': 'Only HOD or Admin can password-protect question papers.'}), 403

    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found.'}), 404

    if qp.status != 1:
        return jsonify({'success': False, 'message': 'Question paper is not finalized.'}), 400

    # Verify HOD branch permission if HOD
    if 'hod' in user_role and g.current_user.branch_id and qp.branch_id:
        if qp.branch_id != g.current_user.branch_id:
            return jsonify({'success': False, 'message': 'You can only manage question papers belonging to your department.'}), 403

    data = request.get_json() or {}
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    faculty_ids = data.get('faculty_ids', [])

    # Validations
    if not password or not confirm_password:
        return jsonify({'success': False, 'message': 'Password and confirmation password are required.'}), 400

    if password != confirm_password:
        return jsonify({'success': False, 'message': 'Password and confirmation password do not match.'}), 400

    if len(password) < 12:
        return jsonify({'success': False, 'message': 'Password must be at least 12 characters long.'}), 400

    if len(password) > 40:
        return jsonify({'success': False, 'message': 'Password cannot exceed 40 characters for standard PDF encryption.'}), 400

    if not faculty_ids or not isinstance(faculty_ids, list):
        return jsonify({'success': False, 'message': 'Please select at least one faculty recipient.'}), 400

    # Validate faculty IDs against database
    faculty_role = Role.query.filter(Role.role_name.ilike('faculty')).first()
    faculty_role_id = faculty_role.id if faculty_role else 2

    selected_faculty = User.query.filter(User.id.in_(faculty_ids)).all()
    if not selected_faculty:
        return jsonify({'success': False, 'message': 'No valid faculty members selected.'}), 400

    # Verify all recipients have Faculty role (not Admin, not HOD)
    for f in selected_faculty:
        if f.user_type != faculty_role_id:
            return jsonify({'success': False, 'message': f"User '{f.user_name}' does not have the Faculty role."}), 400
        if not f.email or '@' not in f.email:
            return jsonify({'success': False, 'message': f"Faculty member '{f.user_name}' does not have a valid registered email address."}), 400

    vault_dir = get_vault_directory()
    original_pdf = os.path.join(vault_dir, f"qp_{qp.id}_original.pdf")
    protected_pdf = os.path.join(vault_dir, f"qp_{qp.id}_protected.pdf")

    try:
        # 1. Ensure original unencrypted PDF exists (generated cleanly with full academic layout)
        ensure_original_question_paper_pdf(qp.id, qp, force_regenerate=True)

        # 2. Encrypt PDF using AES-256 via PyMuPDF
        protect_question_paper(original_pdf, protected_pdf, password)

        # 3. Update QuestionPaper metadata
        qp.is_password_protected = True
        qp.original_pdf_path = original_pdf
        qp.protected_pdf_path = protected_pdf
        qp.protected_at = datetime.utcnow()
        qp.protected_by_id = g.current_user.id
        qp.protected_by_name = g.current_user.user_name

        # Store encrypted PDF in database so ephemeral cloud container restarts never lose the file!
        import base64
        try:
            with open(protected_pdf, 'rb') as pf:
                qp.protected_pdf_base64 = base64.b64encode(pf.read()).decode('utf-8')
        except Exception as b64_err:
            print(f"Warning: could not store base64 PDF in database: {b64_err}")

        # 4. Save sharing records and dispatch emails asynchronously in background thread
        delivery_results = []
        successful_deliveries = 0
        failed_deliveries = 0

        for f in selected_faculty:
            ok, err = send_qp_password_email(
                to_email=f.email,
                recipient_name=f.user_name,
                paper_title=qp.title,
                course_name=qp.course_name or "Course",
                password=password
            )

            status = 'sent' if ok else 'failed'
            if ok:
                successful_deliveries += 1
            else:
                failed_deliveries += 1

            delivery_results.append({
                'faculty_id': f.id,
                'faculty_name': f.user_name,
                'email': f.email,
                'status': status,
                'error': err
            })

            rec = PaperSharedRecipient.query.filter_by(question_paper_id=qp.id, faculty_user_id=f.id).first()
            if not rec:
                rec = PaperSharedRecipient(
                    question_paper_id=qp.id,
                    faculty_user_id=f.id,
                    recipient_email=f.email,
                    recipient_name=f.user_name,
                    shared_by_hod_id=g.current_user.id,
                    shared_by_hod_name=g.current_user.user_name,
                    shared_at=datetime.utcnow(),
                    email_status=status,
                    email_sent_at=datetime.utcnow() if ok else None,
                    error_message=err if not ok else None
                )
                db.session.add(rec)
            else:
                rec.email_status = status
                rec.email_sent_at = datetime.utcnow() if ok else rec.email_sent_at
                rec.error_message = err if not ok else None

        db.session.commit()

        message = (
            f"Question paper protected with AES-256. Password dispatched to {successful_deliveries} faculty member(s)."
            if failed_deliveries == 0
            else f"Question paper protected with AES-256. Email dispatch failed for {failed_deliveries} recipient(s)."
        )

        return jsonify({
            'success': True,
            'message': message,
            'data': {
                'paper_id': qp.id,
                'is_password_protected': True,
                'protected_at': qp.protected_at.strftime('%Y-%m-%d %H:%M:%S'),
                'total_selected': len(selected_faculty),
                'successful_deliveries': successful_deliveries,
                'failed_deliveries': failed_deliveries,
                'recipients': delivery_results
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f"Encryption or distribution failed: {str(e)}"}), 500

@qp_generator_bp.route('/<int:id>/sharing-details', methods=['GET'])
@token_required
def get_sharing_details(id):
    """
    Returns authorized sharing information and recipient statuses for the HOD.
    """
    user_role = (g.current_user.role or g.current_user.type or '').lower()
    if not ('hod' in user_role or 'admin' in user_role or 'head' in user_role):
        return jsonify({'success': False, 'message': 'Access restricted to HOD or Administrator.'}), 403

    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found.'}), 404

    recipients = PaperSharedRecipient.query.filter_by(question_paper_id=qp.id).order_by(PaperSharedRecipient.shared_at.desc()).all()

    return jsonify({
        'success': True,
        'data': {
            'paper_id': qp.id,
            'paper_title': qp.title,
            'course_name': qp.course_name,
            'course_code': qp.course_code,
            'is_password_protected': bool(qp.is_password_protected),
            'protected_at': qp.protected_at.strftime('%Y-%m-%d %H:%M:%S') if qp.protected_at else None,
            'protected_by_name': qp.protected_by_name,
            'total_shared': len(recipients),
            'recipients': [r.to_dict() for r in recipients]
        }
    })

@qp_generator_bp.route('/<int:id>/share-with-additional-faculty', methods=['POST'])
@token_required
def share_with_additional_faculty(id):
    """
    Allows the HOD to select additional recipients and re-enter the existing PDF password to share it with them.
    Verifies the password against the encrypted PDF before distributing.
    Does NOT regenerate or re-encrypt the PDF.
    """
    user_role = (g.current_user.role or g.current_user.type or '').lower()
    if not ('hod' in user_role or 'admin' in user_role or 'head' in user_role):
        return jsonify({'success': False, 'message': 'Access restricted to HOD or Administrator.'}), 403

    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found.'}), 404

    if not qp.is_password_protected or not qp.protected_pdf_path or not os.path.exists(qp.protected_pdf_path):
        return jsonify({'success': False, 'message': 'Question paper is not currently password-protected.'}), 400

    data = request.get_json() or {}
    entered_password = data.get('password')
    faculty_ids = data.get('faculty_ids', [])

    if not entered_password:
        return jsonify({'success': False, 'message': 'Please enter the existing PDF password to authorize additional sharing.'}), 400

    # Verify the entered password against the actual encrypted PDF
    if not verify_pdf_password(qp.protected_pdf_path, entered_password):
        return jsonify({'success': False, 'message': 'The entered password does not match the protected question paper. Verification failed.'}), 400

    if not faculty_ids or not isinstance(faculty_ids, list):
        return jsonify({'success': False, 'message': 'Please select at least one additional faculty member.'}), 400

    faculty_role = Role.query.filter(Role.role_name.ilike('faculty')).first()
    faculty_role_id = faculty_role.id if faculty_role else 2

    selected_faculty = User.query.filter(User.id.in_(faculty_ids)).all()
    if not selected_faculty:
        return jsonify({'success': False, 'message': 'No valid faculty members selected.'}), 400

    for f in selected_faculty:
        if f.user_type != faculty_role_id:
            return jsonify({'success': False, 'message': f"User '{f.user_name}' does not have the Faculty role."}), 400
        if not f.email or '@' not in f.email:
            return jsonify({'success': False, 'message': f"Faculty member '{f.user_name}' does not have a valid registered email address."}), 400

    delivery_results = []
    successful_deliveries = 0
    failed_deliveries = 0

    for f in selected_faculty:
        email_sent, err_msg = send_qp_password_email(
            to_email=f.email,
            recipient_name=f.user_name,
            paper_title=qp.title,
            course_name=qp.course_name or "Course",
            password=entered_password
        )

        status = 'sent' if email_sent else 'failed'
        if email_sent:
            successful_deliveries += 1
        else:
            failed_deliveries += 1

        rec = PaperSharedRecipient.query.filter_by(question_paper_id=qp.id, faculty_user_id=f.id).first()
        if not rec:
            rec = PaperSharedRecipient(
                question_paper_id=qp.id,
                faculty_user_id=f.id,
                recipient_email=f.email,
                recipient_name=f.user_name,
                shared_by_hod_id=g.current_user.id,
                shared_by_hod_name=g.current_user.user_name,
                shared_at=datetime.utcnow(),
                email_status=status,
                email_sent_at=datetime.utcnow(),
                error_message=err_msg
            )
            db.session.add(rec)
        else:
            rec.email_status = status
            rec.email_sent_at = datetime.utcnow()
            rec.error_message = err_msg

        delivery_results.append({
            'faculty_id': f.id,
            'faculty_name': f.user_name,
            'email': f.email,
            'status': status,
            'error': err_msg if not email_sent else None
        })

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Password successfully shared with {successful_deliveries} additional faculty member(s).",
        'data': {
            'paper_id': qp.id,
            'successful_deliveries': successful_deliveries,
            'failed_deliveries': failed_deliveries,
            'recipients': delivery_results
        }
    })

@qp_generator_bp.route('/<int:id>/download-protected', methods=['GET'])
@token_required
def download_protected_qp(id):
    """
    Secure download of the AES-256 encrypted question paper PDF.
    Authorization:
    - Admin or HOD managing this paper: Authorized.
    - Faculty: Authorized ONLY if explicitly selected by HOD in paper_shared_recipients.
    """
    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found.'}), 404

    user_role = (g.current_user.role or g.current_user.type or '').lower()
    is_faculty = 'faculty' in user_role or 'teacher' in user_role or 'professor' in user_role
    is_hod = 'hod' in user_role or 'head' in user_role
    is_admin = 'admin' in user_role

    # Self-heal: If encrypted PDF was wiped during a cloud container restart, restore it from PostgreSQL!
    import base64
    if (not qp.protected_pdf_path or not os.path.exists(qp.protected_pdf_path)) and getattr(qp, 'protected_pdf_base64', None):
        try:
            vault_dir = get_vault_directory()
            restored_path = os.path.join(vault_dir, f"qp_{qp.id}_protected.pdf")
            with open(restored_path, 'wb') as rf:
                rf.write(base64.b64decode(qp.protected_pdf_base64))
            qp.protected_pdf_path = restored_path
            db.session.commit()
        except Exception as restore_err:
            print(f"Warning: could not restore PDF from database: {restore_err}")

    # Check if paper is password protected
    if not qp.is_password_protected:
        return jsonify({'success': False, 'message': 'This paper has not yet been password-protected.'}), 404

    if not qp.protected_pdf_path or not os.path.exists(qp.protected_pdf_path):
        return jsonify({
            'success': False,
            'message': 'The encrypted PDF for this paper was created before persistent database storage was activated. Please click "Re-protect" to regenerate the file permanently.'
        }), 404

    # Authorization verification
    if is_faculty:
        shared_rec = PaperSharedRecipient.query.filter_by(question_paper_id=qp.id, faculty_user_id=g.current_user.id).first()
        if not shared_rec:
            return jsonify({'success': False, 'message': 'You are not authorized to download this protected question paper.'}), 403
    elif is_hod and g.current_user.branch_id and qp.branch_id:
        if qp.branch_id != g.current_user.branch_id and not is_admin:
            return jsonify({'success': False, 'message': 'You are not authorized to download question papers outside your department.'}), 403

    clean_course = re.sub(r'[^a-zA-Z0-9_-]', '_', qp.course_code or 'QP')
    clean_title = re.sub(r'[^a-zA-Z0-9_-]', '_', qp.title or 'Paper')
    download_filename = f"{clean_course}_{clean_title}_Protected.pdf"

    return send_file(
        qp.protected_pdf_path,
        as_attachment=True,
        download_name=download_filename,
        mimetype='application/pdf'
    )

@qp_generator_bp.route('/<int:id>/verify-password', methods=['POST'])
@token_required
def verify_qp_password(id):
    """
    Verifies the password to unlock online viewing & printing for a protected question paper.
    Authorization:
    - If user is Faculty: verifies they are an authorized recipient AND provided the correct password.
    - If user is HOD/Admin: verifies the password against the encrypted PDF.
    - If paper is unencrypted: immediately returns success.
    """
    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found.'}), 404

    # If paper is unencrypted, no password is required
    if not qp.is_password_protected:
        return jsonify({
            'success': True,
            'message': 'Question paper is not password protected.',
            'data': qp.to_dict(user_id=g.current_user.id)
        }), 200

    user_role = (g.current_user.role or g.current_user.type or '').lower()
    is_faculty = 'faculty' in user_role or 'teacher' in user_role or 'professor' in user_role

    if is_faculty:
        shared_rec = PaperSharedRecipient.query.filter_by(question_paper_id=qp.id, faculty_user_id=g.current_user.id).first()
        if not shared_rec:
            return jsonify({'success': False, 'message': 'Access restricted: The HOD has not authorized your account for this question paper.'}), 403

    data = request.get_json() or {}
    entered_password = data.get('password', '').strip()

    if not entered_password:
        return jsonify({'success': False, 'message': 'Please enter the question paper password to unlock view and print.'}), 400

    if (not qp.protected_pdf_path or not os.path.exists(qp.protected_pdf_path)) and getattr(qp, 'protected_pdf_base64', None):
        try:
            vault_dir = get_vault_directory()
            restored_path = os.path.join(vault_dir, f"qp_{qp.id}_protected.pdf")
            with open(restored_path, 'wb') as rf:
                rf.write(base64.b64decode(qp.protected_pdf_base64))
            qp.protected_pdf_path = restored_path
            db.session.commit()
        except Exception:
            pass

    if not qp.protected_pdf_path or not os.path.exists(qp.protected_pdf_path):
        return jsonify({'success': False, 'message': 'The encrypted PDF for this paper was created before persistent database storage was activated. Please click "Re-protect" to regenerate the file permanently.'}), 404

    if not verify_pdf_password(qp.protected_pdf_path, entered_password):
        return jsonify({'success': False, 'message': 'Incorrect password. Please enter the password sent to your registered email.'}), 400

    return jsonify({
        'success': True,
        'message': 'Password verified successfully. Question paper unlocked.',
        'data': qp.to_dict(user_id=g.current_user.id)
    }), 200

@qp_generator_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_qp(id):
    qp = QuestionPaper.query.get(id)
    if not qp:
        return jsonify({'success': False, 'message': 'Question paper not found'}), 404
    return jsonify({'success': True, 'data': qp.to_dict(user_id=g.current_user.id)})

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
