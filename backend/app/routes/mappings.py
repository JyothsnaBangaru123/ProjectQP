from flask import Blueprint, request, jsonify
from app.models.mapping import Mapping
from app.extensions import db
from app.routes.auth import token_required

mappings_bp = Blueprint('mappings', __name__)

@mappings_bp.route('', methods=['GET'])
@token_required
def get_mappings():
    try:
        mappings = Mapping.query.order_by(Mapping.id.asc()).all()
        return jsonify({'success': True, 'data': [m.to_dict() for m in mappings]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@mappings_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_mapping(id):
    mapping = Mapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Mapping not found'}), 404
    return jsonify({'success': True, 'data': mapping.to_dict()})

@mappings_bp.route('', methods=['POST'])
@token_required
def create_mapping():
    data = request.get_json() or {}
    if 'faculty_id' not in data or data['faculty_id'] is None:
        return jsonify({'success': False, 'message': 'Faculty is required'}), 400
    if 'course_id' not in data or data['course_id'] is None:
        return jsonify({'success': False, 'message': 'Course is required'}), 400

    faculty_id = int(data['faculty_id'])
    course_id = int(data['course_id'])

    try:
        # Check duplicate combination
        existing = Mapping.query.filter_by(faculty_id=faculty_id, course_id=course_id).first()
        if existing:
            return jsonify({'success': False, 'message': 'This Faculty and Course mapping already exists'}), 409

        mapping = Mapping(
            faculty_id=faculty_id,
            course_id=course_id,
            status=int(data.get('status', 1)),
            year=int(data['year']) if data.get('year') is not None else None,
            sem=int(data['sem']) if data.get('sem') is not None else None,
            accyear=data.get('accyear'),
            course_type=data.get('course_type'),
            elective_type=data.get('elective_type')
        )
        db.session.add(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Faculty-Course mapping created successfully', 'data': mapping.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@mappings_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_mapping(id):
    mapping = Mapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Mapping not found'}), 404

    data = request.get_json() or {}
    try:
        faculty_id = int(data['faculty_id']) if 'faculty_id' in data else mapping.faculty_id
        course_id = int(data['course_id']) if 'course_id' in data else mapping.course_id

        if 'faculty_id' in data or 'course_id' in data:
            # Check duplicate combination
            existing = Mapping.query.filter_by(faculty_id=faculty_id, course_id=course_id).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': 'This Faculty and Course mapping already exists'}), 409
            
            mapping.faculty_id = faculty_id
            mapping.course_id = course_id

        if 'status' in data:
            mapping.status = int(data['status'])
        if 'year' in data:
            mapping.year = int(data['year']) if data['year'] is not None else None
        if 'sem' in data:
            mapping.sem = int(data['sem']) if data['sem'] is not None else None
        if 'accyear' in data:
            mapping.accyear = data['accyear']
        if 'course_type' in data:
            mapping.course_type = data['course_type']
        if 'elective_type' in data:
            mapping.elective_type = data['elective_type']

        db.session.commit()
        return jsonify({'success': True, 'message': 'Faculty-Course mapping updated successfully', 'data': mapping.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@mappings_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_mapping(id):
    mapping = Mapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Mapping not found'}), 404

    try:
        db.session.delete(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Mapping deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
