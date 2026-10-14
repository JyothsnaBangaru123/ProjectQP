from flask import Blueprint, request, jsonify
from app.models.course import Course
from app.models.regulation import Regulation
from app.models.pbmapping import PBMapping
from app.extensions import db
from app.routes.auth import token_required

courses_bp = Blueprint('courses', __name__)

def enrich_course_data(course):
    d = course.to_dict()
    
    # Resolve regulation name
    if course.reg_id:
        reg = Regulation.query.get(course.reg_id)
        d['reg_name'] = reg.reg if reg else None
    else:
        d['reg_name'] = None

    # Resolve program and branch names via pb_id
    d['program_name'] = None
    d['branch_name'] = None
    d['branch_code'] = None
    if course.pb_id:
        pb = PBMapping.query.get(course.pb_id)
        if pb:
            if pb.program:
                d['program_name'] = pb.program.name
            if pb.branch:
                d['branch_name'] = pb.branch.branch_name
                d['branch_code'] = pb.branch.branch_code

    return d

@courses_bp.route('', methods=['GET'])
@token_required
def get_courses():
    try:
        courses = Course.query.order_by(Course.id.asc()).all()
        data = [enrich_course_data(c) for c in courses]
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@courses_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_course(id):
    course = Course.query.get(id)
    if not course:
        return jsonify({'success': False, 'message': 'Course not found'}), 404
    return jsonify({'success': True, 'data': enrich_course_data(course)})

@courses_bp.route('', methods=['POST'])
@token_required
def create_course():
    data = request.get_json() or {}
    
    if 'course_code' not in data or not data['course_code']:
        return jsonify({'success': False, 'message': 'Course code is required'}), 400
    if 'course_name' not in data or not data['course_name']:
        return jsonify({'success': False, 'message': 'Course name is required'}), 400

    try:
        # Check duplicate course code
        existing = Course.query.filter_by(course_code=data['course_code']).first()
        if existing:
            return jsonify({'success': False, 'message': f"Course with code '{data['course_code']}' already exists"}), 409

        course = Course(
            course_code=data['course_code'],
            course_name=data['course_name'],
            course_desc=data.get('course_desc'),
            year=int(data['year']) if data.get('year') is not None else None,
            sem=int(data['sem']) if data.get('sem') is not None else None,
            course_type=data.get('course_type'),
            elective_type=data.get('elective_type'),
            credits=int(data['credits']) if data.get('credits') is not None else None,
            pb_id=int(data['pb_id']) if data.get('pb_id') is not None else None,
            reg_id=int(data['reg_id']) if data.get('reg_id') is not None else None,
            status=int(data.get('status', 1))
        )
        db.session.add(course)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Course created successfully', 'data': enrich_course_data(course)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@courses_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_course(id):
    course = Course.query.get(id)
    if not course:
        return jsonify({'success': False, 'message': 'Course not found'}), 404

    data = request.get_json() or {}
    try:
        if 'course_code' in data:
            if not data['course_code']:
                return jsonify({'success': False, 'message': 'Course code is required'}), 400
            existing = Course.query.filter_by(course_code=data['course_code']).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Course with code '{data['course_code']}' already exists"}), 409
            course.course_code = data['course_code']

        if 'course_name' in data:
            if not data['course_name']:
                return jsonify({'success': False, 'message': 'Course name is required'}), 400
            course.course_name = data['course_name']

        if 'course_desc' in data:
            course.course_desc = data['course_desc']
        if 'year' in data:
            course.year = int(data['year']) if data['year'] is not None else None
        if 'sem' in data:
            course.sem = int(data['sem']) if data['sem'] is not None else None
        if 'course_type' in data:
            course.course_type = data['course_type']
        if 'elective_type' in data:
            course.elective_type = data['elective_type']
        if 'credits' in data:
            course.credits = int(data['credits']) if data['credits'] is not None else None
        if 'pb_id' in data:
            course.pb_id = int(data['pb_id']) if data['pb_id'] is not None else None
        if 'reg_id' in data:
            course.reg_id = int(data['reg_id']) if data['reg_id'] is not None else None
        if 'status' in data:
            course.status = int(data['status'])
            if course.status == 0:
                from app.models.bcmapping import BCMapping
                from app.models.mapping import Mapping
                db.session.query(BCMapping).filter(BCMapping.course_id == id).update({BCMapping.status: 0})
                db.session.query(Mapping).filter(Mapping.course_id == id).update({Mapping.status: 0})

        db.session.commit()
        return jsonify({'success': True, 'message': 'Course updated successfully', 'data': enrich_course_data(course)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@courses_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_course(id):
    course = Course.query.get(id)
    if not course:
        return jsonify({'success': False, 'message': 'Course not found'}), 404

    try:
        db.session.delete(course)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Course deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
