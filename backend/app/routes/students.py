import json
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.models.student import Student
from app.models.question_paper import QuestionPaper
from app.models.course import Course
from app.models.regulation import Regulation
from app.extensions import db
from app.routes.auth import token_required

students_bp = Blueprint('students', __name__)

def parse_qp_pattern(qp):
    """
    Parses a QuestionPaper's generated_content or paper_schema into normalized
    question items containing question numbers, sub-questions (a & b), marks, and COs.
    """
    sections_result = []
    content = {}
    if qp.generated_content:
        try:
            content = json.loads(qp.generated_content) if isinstance(qp.generated_content, str) else qp.generated_content
        except Exception:
            content = {}

    sections = content.get('sections', [])
    if not sections and qp.paper_schema:
        try:
            schema_obj = json.loads(qp.paper_schema) if isinstance(qp.paper_schema, str) else qp.paper_schema
            sections = schema_obj.get('sections', [])
        except Exception:
            sections = []

    for s_idx, sec in enumerate(sections):
        sec_name = sec.get('section_name') or sec.get('name') or f"Section {chr(65 + s_idx)}"
        sec_marks = sec.get('section_marks') or (sec.get('questions', 1) * sec.get('marks_per_q', 1))
        
        raw_questions = sec.get('questions', [])
        parsed_questions = []

        if isinstance(raw_questions, list):
            for q_idx, q in enumerate(raw_questions):
                if isinstance(q, dict):
                    q_no_raw = str(q.get('q_no', f"{q_idx + 1}"))
                    marks = float(q.get('marks', sec.get('marks_per_q', 2)))
                    q_text = str(q.get('question', ''))

                    # Detect internal choice (e.g. "2 or 3", "4/5", "[OR]")
                    is_choice = (
                        bool(q.get('has_internal_choice')) or 
                        (' or ' in q_no_raw.lower()) or 
                        ('/' in q_no_raw) or 
                        ('[or]' in q_text.lower())
                    )

                    q1_no = q.get('q1_no')
                    q2_no = q.get('q2_no')

                    if is_choice and (not q1_no or not q2_no):
                        parts = re.split(r'\s*(?:or|\/)\s*', q_no_raw, flags=re.IGNORECASE)
                        if len(parts) >= 2:
                            q1_no = parts[0].strip()
                            q2_no = parts[1].strip()
                        else:
                            q1_no = f"{q_idx + 1}A"
                            q2_no = f"{q_idx + 1}B"

                    clean_q1 = str(q1_no or f"{q_idx + 1}").replace('Q', '').replace('q', '').strip()
                    clean_q2 = str(q2_no or f"{q_idx + 2}").replace('Q', '').replace('q', '').strip()
                    clean_no = q_no_raw.replace('Q', '').replace('q', '').strip()

                    # Detect sub-division (a & b)
                    sub_div = q.get('sub_division') or sec.get('sub_division')
                    p1 = int(q.get('p1_marks') or 0)
                    p2 = int(q.get('p2_marks') or 0)
                    has_sub = (sub_div == 'two_subquestions') or (p1 > 0 and p2 > 0)

                    # Regex inspection for sub-questions if flag not set
                    if not has_sub and re.search(r'\b(?:a\)|[1-9]\.a)\b', q_text, re.IGNORECASE) and re.search(r'\b(?:b\)|[1-9]\.b)\b', q_text, re.IGNORECASE):
                        has_sub = True

                    if has_sub and (p1 <= 0 or p2 <= 0):
                        matches = re.findall(r'\[(\d+)\s*M\]', q_text)
                        if len(matches) >= 2:
                            p1 = int(matches[0])
                            p2 = int(matches[1])
                        else:
                            half = int(marks) // 2
                            p1 = half
                            p2 = int(marks) - half

                    co_q1 = q.get('q1_co') or q.get('co') or 'CO1'
                    co_q2 = q.get('q2_co') or q.get('co') or 'CO2'
                    co_q1_a = q.get('q1_co_a') or co_q1
                    co_q1_b = q.get('q1_co_b') or co_q1
                    co_q2_a = q.get('q2_co_a') or co_q2
                    co_q2_b = q.get('q2_co_b') or co_q2

                    if is_choice:
                        # Build Option 1 sub-questions
                        opt1_subs = []
                        if has_sub:
                            opt1_subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt1_a",
                                    'sub_label': f"{clean_q1}.a",
                                    'max_marks': p1,
                                    'co': co_q1_a
                                },
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt1_b",
                                    'sub_label': f"{clean_q1}.b",
                                    'max_marks': p2,
                                    'co': co_q1_b
                                }
                            ]
                        else:
                            opt1_subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt1",
                                    'sub_label': f"Q{clean_q1}",
                                    'max_marks': marks,
                                    'co': co_q1
                                }
                            ]

                        # Build Option 2 sub-questions
                        opt2_subs = []
                        if has_sub:
                            opt2_subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt2_a",
                                    'sub_label': f"{clean_q2}.a",
                                    'max_marks': p1,
                                    'co': co_q2_a
                                },
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt2_b",
                                    'sub_label': f"{clean_q2}.b",
                                    'max_marks': p2,
                                    'co': co_q2_b
                                }
                            ]
                        else:
                            opt2_subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_opt2",
                                    'sub_label': f"Q{clean_q2}",
                                    'max_marks': marks,
                                    'co': co_q2
                                }
                            ]

                        item = {
                            'id': f"sec{s_idx}_q{q_idx}",
                            'is_choice': True,
                            'section_name': sec_name,
                            'max_marks': marks,
                            'has_subquestions': has_sub,
                            'options': [
                                {
                                    'option_key': f"sec{s_idx}_q{q_idx}_opt1",
                                    'q_label': f"Q{clean_q1}",
                                    'q_number': clean_q1,
                                    'marks': marks,
                                    'has_subquestions': has_sub,
                                    'subquestions': opt1_subs
                                },
                                {
                                    'option_key': f"sec{s_idx}_q{q_idx}_opt2",
                                    'q_label': f"Q{clean_q2}",
                                    'q_number': clean_q2,
                                    'marks': marks,
                                    'has_subquestions': has_sub,
                                    'subquestions': opt2_subs
                                }
                            ]
                        }
                        parsed_questions.append(item)
                    else:
                        # Non-choice Question
                        subs = []
                        if has_sub:
                            subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_a",
                                    'sub_label': f"{clean_no}.a",
                                    'max_marks': p1,
                                    'co': co_q1_a
                                },
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}_b",
                                    'sub_label': f"{clean_no}.b",
                                    'max_marks': p2,
                                    'co': co_q1_b
                                }
                            ]
                        else:
                            subs = [
                                {
                                    'sub_key': f"sec{s_idx}_q{q_idx}",
                                    'sub_label': f"Q{clean_no}",
                                    'max_marks': marks,
                                    'co': co_q1
                                }
                            ]

                        item = {
                            'id': f"sec{s_idx}_q{q_idx}",
                            'is_choice': False,
                            'section_name': sec_name,
                            'q_label': f"Q{clean_no}",
                            'q_number': clean_no,
                            'max_marks': marks,
                            'has_subquestions': has_sub,
                            'subquestions': subs
                        }
                        parsed_questions.append(item)

        sections_result.append({
            'section_id': s_idx + 1,
            'section_name': sec_name,
            'section_marks': sec_marks,
            'questions': parsed_questions
        })

    return sections_result


def compute_evaluation_score(evaluation_data):
    """
    Computes total obtained marks from evaluation items, correctly supporting
    sub-questions (a & b) and mutual internal choices with Best-of-Choice (max(opt1, opt2)).
    """
    if not isinstance(evaluation_data, list):
        return 0, 0.0

    attempted_count = 0
    choice_groups = {} # parent_id -> { option_key -> sum(marks) }
    direct_marks = 0.0

    for item in evaluation_data:
        if item.get('attempted'):
            attempted_count += 1
            try:
                m = float(item.get('marks_awarded', 0) or 0)
            except (ValueError, TypeError):
                m = 0.0

            parent = item.get('choice_parent') or item.get('choiceParent')
            opt = item.get('option_key') or item.get('optionKey')

            if parent and opt:
                if parent not in choice_groups:
                    choice_groups[parent] = {}
                choice_groups[parent][opt] = choice_groups[parent].get(opt, 0.0) + m
            else:
                direct_marks += m

    choice_marks = 0.0
    for parent, opts in choice_groups.items():
        if opts:
            choice_marks += max(opts.values())

    return attempted_count, round(direct_marks + choice_marks, 2)



@students_bp.route('/courses-with-papers', methods=['GET'])
@token_required
def get_courses_with_papers():
    """
    Returns the distinct list of courses for which question papers have been generated.
    Optionally filters by regulation_id.
    """
    try:
        reg_id = request.args.get('regulation_id')
        
        # Subquery or join to find courses with generated question papers
        query = db.session.query(
            Course.id,
            Course.course_code,
            Course.course_name,
            Course.reg_id,
            Regulation.reg.label('regulation_name'),
            db.func.count(QuestionPaper.id).label('papers_count')
        ).join(
            QuestionPaper, QuestionPaper.course_id == Course.id
        ).outerjoin(
            Regulation, Regulation.id == Course.reg_id
        ).filter(
            QuestionPaper.status == 1
        )

        if reg_id:
            try:
                query = query.filter(Course.reg_id == int(reg_id))
            except ValueError:
                pass

        results = query.group_by(
            Course.id,
            Course.course_code,
            Course.course_name,
            Course.reg_id,
            Regulation.reg
        ).order_by(Course.course_code).all()

        courses_data = []
        for r in results:
            courses_data.append({
                'id': r.id,
                'course_code': r.course_code,
                'course_name': r.course_name,
                'reg_id': r.reg_id,
                'regulation_name': r.regulation_name,
                'papers_count': r.papers_count
            })

        return jsonify({'success': True, 'data': courses_data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('/papers-by-course/<int:course_id>', methods=['GET'])
@token_required
def get_papers_by_course(course_id):
    """
    Fetches generated question papers for a course, along with the extracted pattern
    showing question numbers and respective max marks.
    """
    try:
        papers = QuestionPaper.query.filter_by(
            course_id=course_id,
            status=1
        ).order_by(QuestionPaper.id.desc()).all()

        results = []
        for p in papers:
            pattern = parse_qp_pattern(p)
            p_dict = p.to_dict()
            p_dict['pattern_sections'] = pattern
            results.append(p_dict)

        return jsonify({'success': True, 'data': results})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('', methods=['GET'])
@token_required
def get_students():
    """
    Fetches evaluated students, with optional filters for course, qp, regulation, or jntu_no.
    """
    try:
        query = Student.query.filter_by(status=1)
        
        course_id = request.args.get('course_id')
        qp_id = request.args.get('qp_id')
        regulation_id = request.args.get('regulation_id')
        jntu_no = request.args.get('jntu_no')

        if course_id:
            query = query.filter(Student.course_id == int(course_id))
        if qp_id:
            query = query.filter(Student.question_paper_id == int(qp_id))
        if regulation_id:
            query = query.filter(Student.regulation_id == int(regulation_id))
        if jntu_no:
            query = query.filter(Student.jntu_no.ilike(f"%{jntu_no.strip()}%"))

        # First-In, First-Out (FIFO): earliest records first, latest entered records at the last row
        students = query.order_by(Student.id.asc()).all()
        return jsonify({'success': True, 'data': [s.to_dict() for s in students]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_student(id):
    """
    Fetches a single student evaluation record by ID.
    """
    student = Student.query.get(id)
    if not student:
        return jsonify({'success': False, 'message': 'Student record not found'}), 404
    return jsonify({'success': True, 'data': student.to_dict()})


@students_bp.route('', methods=['POST'])
@token_required
def save_student():
    """
    Creates or updates a student evaluation entry in the database.
    """
    data = request.get_json() or {}

    jntu_no = (data.get('jntu_no') or '').strip().upper()
    if not jntu_no:
        return jsonify({'success': False, 'message': 'JNTU.No / Roll Number is required'}), 400

    course_id = data.get('course_id')
    qp_id = data.get('question_paper_id')
    if not course_id:
        return jsonify({'success': False, 'message': 'Course is required'}), 400

    course = Course.query.get(int(course_id)) if course_id else None
    qp = QuestionPaper.query.get(int(qp_id)) if qp_id else None

    reg_id = data.get('regulation_id') or (course.reg_id if course else None)
    regulation_obj = Regulation.query.get(int(reg_id)) if reg_id else None
    regulation_name = data.get('regulation') or (regulation_obj.reg if regulation_obj else None)

    evaluation_data = data.get('evaluation_data', [])
    attempted_count, total_obtained = compute_evaluation_score(evaluation_data)
    total_questions = len(evaluation_data)

    max_marks = float(data.get('max_total_marks') or (qp.total_marks if qp else 50.0))
    percentage = round((total_obtained / max_marks * 100.0), 2) if max_marks > 0 else 0.0

    # Upsert: check if record already exists for this JNTU.No and question paper
    existing = None
    if qp_id:
        existing = Student.query.filter_by(jntu_no=jntu_no, question_paper_id=qp_id).first()
    if not existing:
        existing = Student.query.filter_by(jntu_no=jntu_no, course_id=course_id).first()

    student = existing if existing else Student()

    student.jntu_no = jntu_no
    student.student_name = data.get('student_name') or student.student_name
    student.regulation_id = reg_id
    student.regulation = regulation_name
    student.course_id = course.id if course else course_id
    student.course_code = course.course_code if course else data.get('course_code')
    student.course_name = course.course_name if course else data.get('course_name')
    student.question_paper_id = qp.id if qp else qp_id
    student.paper_title = qp.title if qp else data.get('paper_title')
    student.academic_year = qp.academic_year if qp else data.get('academic_year', '2024-25')
    student.sem = qp.sem if qp else data.get('sem', 1)
    student.faculty_id = g.current_user.id
    student.faculty_name = g.current_user.user_name
    student.attempted_count = attempted_count
    student.total_questions = total_questions
    student.total_marks_obtained = total_obtained
    student.max_total_marks = max_marks
    student.percentage = percentage
    student.evaluation_data = json.dumps(evaluation_data) if isinstance(evaluation_data, (list, dict)) else str(evaluation_data)
    student.remarks = data.get('remarks')
    student.status = 1
    student.updated_at = datetime.utcnow()

    try:
        if not existing:
            db.session.add(student)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f"Student evaluation for {jntu_no} saved successfully",
            'data': student.to_dict()
        }), 201 if not existing else 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_student(id):
    """
    Updates an existing student evaluation record.
    """
    student = Student.query.get(id)
    if not student:
        return jsonify({'success': False, 'message': 'Student record not found'}), 404

    data = request.get_json() or {}

    if 'jntu_no' in data:
        student.jntu_no = str(data['jntu_no']).strip().upper()
    if 'student_name' in data:
        student.student_name = data['student_name']
    if 'remarks' in data:
        student.remarks = data['remarks']

    if 'evaluation_data' in data:
        eval_data = data['evaluation_data']
        student.evaluation_data = json.dumps(eval_data) if isinstance(eval_data, (list, dict)) else str(eval_data)
        attempted, total_obtained = compute_evaluation_score(eval_data if isinstance(eval_data, list) else [])
        student.attempted_count = attempted
        student.total_marks_obtained = total_obtained
        if student.max_total_marks and student.max_total_marks > 0:
            student.percentage = round((total_obtained / student.max_total_marks) * 100.0, 2)

    student.faculty_id = g.current_user.id
    student.faculty_name = g.current_user.user_name
    student.updated_at = datetime.utcnow()

    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Student evaluation updated successfully',
            'data': student.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_student(id):
    """
    Deletes a student evaluation record.
    """
    student = Student.query.get(id)
    if not student:
        return jsonify({'success': False, 'message': 'Student record not found'}), 404

    try:
        db.session.delete(student)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Student record deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@students_bp.route('/co-evaluation', methods=['GET'])
@token_required
def get_co_evaluation():
    """
    Returns Course Outcome (CO1 to CO6) evaluation metrics for a Question Paper:
    - Attempt percentage for each CO
    - Question count & mapped questions
    - Class average marks & percentage scored per CO
    - Attainment level (1, 2, 3) and direct attainment score (out of 3.0)
    - Student-by-student CO performance matrix
    """
    try:
        qp_id = request.args.get('question_paper_id') or request.args.get('qp_id')
        course_id = request.args.get('course_id')
        regulation_id = request.args.get('regulation_id')

        qp = None
        if qp_id:
            qp = QuestionPaper.query.get(int(qp_id))
        elif course_id:
            qp = QuestionPaper.query.filter_by(course_id=int(course_id), status=1).order_by(QuestionPaper.id.desc()).first()

        if not qp:
            return jsonify({'success': False, 'message': 'No question paper found for evaluation'}), 404

        pattern = parse_qp_pattern(qp)

        # Fetch evaluated students for this question paper
        students_query = Student.query.filter_by(question_paper_id=qp.id, status=1)
        if course_id:
            students_query = students_query.filter(Student.course_id == int(course_id))
        if regulation_id:
            students_query = students_query.filter(Student.regulation_id == int(regulation_id))

        students = students_query.order_by(Student.id.asc()).all()
        total_students = len(students)

        # Build map of all subquestion items and which CO they belong to
        sub_items = {}
        co_map = {f"CO{i}": {"mapped_questions": [], "max_marks": 0.0} for i in range(1, 7)}
        pattern_questions = []

        for sec in pattern:
            sec_name = sec.get('section_name') or 'Section'
            for q in sec.get('questions', []):
                if q.get('is_choice'):
                    parent_id = q.get('id')
                    for opt_idx, opt in enumerate(q.get('options', [])):
                        opt_key = opt.get('option_key')
                        for sub in opt.get('subquestions', []):
                            s_key = sub.get('sub_key')
                            raw_co = sub.get('co') or 'CO1'
                            co_match = re.search(r'CO([1-6])', str(raw_co).upper())
                            co_key = f"CO{co_match.group(1)}" if co_match else 'CO1'
                            max_m = float(sub.get('max_marks', 0))

                            item_info = {
                                's_key': s_key,
                                'label': sub.get('sub_label'),
                                'max_marks': max_m,
                                'co': co_key,
                                'section_name': sec_name,
                                'choice_parent': parent_id,
                                'option_key': opt_key,
                                'is_choice': True,
                                'is_or_choice': (opt_idx > 0)
                            }
                            sub_items[s_key] = item_info
                            pattern_questions.append(item_info)
                            if sub.get('sub_label') not in co_map[co_key]['mapped_questions']:
                                co_map[co_key]['mapped_questions'].append(sub.get('sub_label'))
                else:
                    for sub in q.get('subquestions', []):
                        s_key = sub.get('sub_key')
                        raw_co = sub.get('co') or 'CO1'
                        co_match = re.search(r'CO([1-6])', str(raw_co).upper())
                        co_key = f"CO{co_match.group(1)}" if co_match else 'CO1'
                        max_m = float(sub.get('max_marks', 0))

                        item_info = {
                            's_key': s_key,
                            'label': sub.get('sub_label'),
                            'max_marks': max_m,
                            'co': co_key,
                            'section_name': sec_name,
                            'choice_parent': None,
                            'option_key': None,
                            'is_choice': False,
                            'is_or_choice': False
                        }
                        sub_items[s_key] = item_info
                        pattern_questions.append(item_info)
                        if sub.get('sub_label') not in co_map[co_key]['mapped_questions']:
                            co_map[co_key]['mapped_questions'].append(sub.get('sub_label'))

        # Track per-question attempt counts and marks scored
        q_stats = {
            q_info['s_key']: {
                'students_attempted': 0,
                'total_marks_scored': 0.0
            }
            for q_info in pattern_questions
        }

        # Track per-CO metrics across all students
        co_stats = {
            f"CO{i}": {
                'students_attempted': 0,
                'students_attained': 0,
                'total_marks_scored': 0.0,
                'total_max_marks': 0.0
            }
            for i in range(1, 7)
        }

        student_matrix = []

        for st in students:
            eval_list = []
            try:
                eval_list = json.loads(st.evaluation_data) if isinstance(st.evaluation_data, str) else (st.evaluation_data or [])
            except Exception:
                eval_list = []

            # Determine winning option for choice parents for this student
            choice_totals = {}
            for it in eval_list:
                parent = it.get('choice_parent') or it.get('choiceParent')
                opt = it.get('option_key') or it.get('optionKey')
                if parent and opt:
                    if parent not in choice_totals:
                        choice_totals[parent] = {}
                    m = float(it.get('marks_awarded', 0) or 0)
                    choice_totals[parent][opt] = choice_totals[parent].get(opt, 0.0) + m

            winning_opts = {}
            for parent, opts in choice_totals.items():
                if opts:
                    best_opt = max(opts.items(), key=lambda x: x[1])[0]
                    winning_opts[parent] = best_opt

            # Calculate student scores per CO & track individual question attempt and score
            st_co_data = {
                f"CO{i}": {'scored': 0.0, 'max': 0.0, 'attempted': False, 'percentage': 0.0}
                for i in range(1, 7)
            }

            for it in eval_list:
                q_id = it.get('q_id')
                # Track question-level attempt and score stats
                if q_id in q_stats and it.get('attempted'):
                    q_stats[q_id]['students_attempted'] += 1
                    try:
                        m_val = float(it.get('marks_awarded', 0) or 0)
                    except (ValueError, TypeError):
                        m_val = 0.0
                    q_stats[q_id]['total_marks_scored'] += m_val

                meta = sub_items.get(q_id, {})
                co_key = meta.get('co')
                if not co_key:
                    raw_co = it.get('co')
                    co_match = re.search(r'CO([1-6])', str(raw_co).upper())
                    co_key = f"CO{co_match.group(1)}" if co_match else None

                if not co_key or co_key not in st_co_data:
                    continue

                parent = it.get('choice_parent') or it.get('choiceParent') or meta.get('choice_parent')
                opt = it.get('option_key') or it.get('optionKey') or meta.get('option_key')

                # Count questions from the winning option or non-choice
                if parent and opt and winning_opts.get(parent) and opt != winning_opts.get(parent):
                    continue

                if it.get('attempted'):
                    st_co_data[co_key]['attempted'] = True
                    marks_val = float(it.get('marks_awarded', 0) or 0)
                    st_co_data[co_key]['scored'] += marks_val

                max_m = float(it.get('max_marks') or meta.get('max_marks', 0))
                st_co_data[co_key]['max'] += max_m

            # Calculate percentages for each CO for this student
            attained_co_count = 0
            for c_id, c_val in st_co_data.items():
                if c_val['max'] > 0:
                    pct = round((c_val['scored'] / c_val['max']) * 100.0, 1)
                    c_val['percentage'] = pct
                else:
                    c_val['percentage'] = 0.0

                if c_val['attempted']:
                    co_stats[c_id]['students_attempted'] += 1
                    co_stats[c_id]['total_marks_scored'] += c_val['scored']
                    co_stats[c_id]['total_max_marks'] += c_val['max']
                    if c_val['percentage'] >= 50.0:
                        co_stats[c_id]['students_attained'] += 1
                        attained_co_count += 1

            student_matrix.append({
                'id': st.id,
                'jntu_no': st.jntu_no,
                'student_name': st.student_name or '—',
                'total_marks_obtained': st.total_marks_obtained,
                'max_total_marks': st.max_total_marks,
                'percentage': st.percentage,
                'co_scores': st_co_data,
                'attained_co_count': attained_co_count
            })

        # Calculate final attainment levels & direct attainment scores for CO1-CO6
        co_results = []
        for i in range(1, 7):
            co_id = f"CO{i}"
            c_stat = co_stats[co_id]
            c_meta = co_map[co_id]

            att_cnt = c_stat['students_attempted']
            att_pct = round((att_cnt / total_students * 100.0), 1) if total_students > 0 else 0.0

            met_target_cnt = c_stat['students_attained']
            attainment_pct = round((met_target_cnt / att_cnt * 100.0), 1) if att_cnt > 0 else 0.0

            if attainment_pct >= 70.0:
                level = 3
                level_label = 'Level 3 (High)'
            elif attainment_pct >= 60.0:
                level = 2
                level_label = 'Level 2 (Moderate)'
            elif attainment_pct >= 50.0:
                level = 1
                level_label = 'Level 1 (Low)'
            else:
                level = 0
                level_label = 'Not Attained'

            direct_score = round((attainment_pct / 100.0) * 3.0, 2)
            avg_score_pct = round((c_stat['total_marks_scored'] / c_stat['total_max_marks'] * 100.0), 1) if c_stat['total_max_marks'] > 0 else 0.0

            co_results.append({
                'co_id': co_id,
                'mapped_questions': c_meta['mapped_questions'],
                'question_count': len(c_meta['mapped_questions']),
                'total_students': total_students,
                'students_attempted': att_cnt,
                'attempt_percentage': att_pct,
                'avg_score_percentage': avg_score_pct,
                'target_threshold': 50,
                'students_attained': met_target_cnt,
                'attainment_percentage': attainment_pct,
                'attainment_level': level,
                'attainment_level_label': level_label,
                'attainment_score': direct_score,
                'status': 'Attained' if level >= 1 else 'Needs Attention'
            })

        # Build Question-Wise Attempt Rate and Average Score Analytics for every question in pattern
        question_analytics = []
        for q_info in pattern_questions:
            k = q_info['s_key']
            stat = q_stats.get(k, {'students_attempted': 0, 'total_marks_scored': 0.0})
            att_cnt = stat['students_attempted']
            att_pct = round((att_cnt / total_students * 100.0), 1) if total_students > 0 else 0.0
            scored = stat['total_marks_scored']
            avg_marks = round((scored / att_cnt), 2) if att_cnt > 0 else 0.0
            max_m = q_info['max_marks']
            avg_score_pct = round((avg_marks / max_m * 100.0), 1) if (max_m > 0 and att_cnt > 0) else 0.0

            if att_cnt == 0:
                perf_status = 'Unattempted'
                perf_badge = 'gray'
            elif avg_score_pct >= 70.0:
                perf_status = 'High Mastery'
                perf_badge = 'green'
            elif avg_score_pct >= 50.0:
                perf_status = 'Moderate'
                perf_badge = 'blue'
            else:
                perf_status = 'Challenging'
                perf_badge = 'amber'

            question_analytics.append({
                'q_id': k,
                'q_label': q_info['label'],
                'section_name': q_info['section_name'],
                'co': q_info['co'],
                'max_marks': max_m,
                'is_choice': q_info['is_choice'],
                'is_or_choice': q_info['is_or_choice'],
                'students_attempted': att_cnt,
                'total_students': total_students,
                'attempt_percentage': att_pct,
                'total_marks_scored': round(scored, 2),
                'avg_marks': avg_marks,
                'avg_score_percentage': avg_score_pct,
                'performance_status': perf_status,
                'performance_badge': perf_badge
            })

        valid_scores = [c['attainment_score'] for c in co_results if c['question_count'] > 0 or c['students_attempted'] > 0]
        overall_avg_score = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else 0.0

        return jsonify({
            'success': True,
            'data': {
                'question_paper': {
                    'id': qp.id,
                    'title': qp.title,
                    'course_id': qp.course_id,
                    'course_code': qp.course.course_code if qp.course else '',
                    'course_name': qp.course.course_name if qp.course else '',
                    'regulation': (qp.course.regulation.reg if (qp.course and qp.course.regulation) else 'R23') if qp.course else 'R23',
                    'total_marks': qp.total_marks
                },
                'total_students_evaluated': total_students,
                'overall_attainment_score': overall_avg_score,
                'cos': co_results,
                'question_analytics': question_analytics,
                'student_matrix': student_matrix
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
