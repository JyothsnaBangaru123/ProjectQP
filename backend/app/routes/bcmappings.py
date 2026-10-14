from flask import Blueprint, request, jsonify
from app.models.bcmapping import BCMapping
from app.extensions import db
from app.routes.auth import token_required

bcmappings_bp = Blueprint('bcmappings', __name__)

@bcmappings_bp.route('', methods=['GET'])
@token_required
def get_bcmappings():
    try:
        mappings = BCMapping.query.order_by(BCMapping.id.asc()).all()
        return jsonify({'success': True, 'data': [m.to_dict() for m in mappings]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@bcmappings_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_bcmapping(id):
    mapping = BCMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Course-Regulation-PB mapping not found'}), 404
    return jsonify({'success': True, 'data': mapping.to_dict()})

@bcmappings_bp.route('', methods=['POST'])
@token_required
def create_bcmapping():
    data = request.get_json() or {}
    if 'course_id' not in data or data['course_id'] is None:
        return jsonify({'success': False, 'message': 'Course is required'}), 400
    if 'reg_id' not in data or data['reg_id'] is None:
        return jsonify({'success': False, 'message': 'Regulation is required'}), 400
    if 'pb_id' not in data or data['pb_id'] is None:
        return jsonify({'success': False, 'message': 'Program-Branch mapping is required'}), 400

    course_id = int(data['course_id'])
    reg_id = int(data['reg_id'])
    pb_id = int(data['pb_id'])

    try:
        # Check duplicate combination
        existing = BCMapping.query.filter_by(course_id=course_id, reg_id=reg_id, pb_id=pb_id).first()
        if existing:
            return jsonify({'success': False, 'message': 'This Course, Regulation, and PB Mapping combination already exists'}), 409

        mapping = BCMapping(
            course_id=course_id,
            reg_id=reg_id,
            pb_id=pb_id,
            status=int(data.get('status', 1))
        )
        db.session.add(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch-Course mapping created successfully', 'data': mapping.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@bcmappings_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_bcmapping(id):
    mapping = BCMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Branch-Course mapping not found'}), 404

    data = request.get_json() or {}
    try:
        course_id = int(data['course_id']) if 'course_id' in data else mapping.course_id
        reg_id = int(data['reg_id']) if 'reg_id' in data else mapping.reg_id
        pb_id = int(data['pb_id']) if 'pb_id' in data else mapping.pb_id

        if 'course_id' in data or 'reg_id' in data or 'pb_id' in data:
            # Check duplicate combination
            existing = BCMapping.query.filter_by(course_id=course_id, reg_id=reg_id, pb_id=pb_id).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': 'This Course, Regulation, and PB Mapping combination already exists'}), 409
            
            mapping.course_id = course_id
            mapping.reg_id = reg_id
            mapping.pb_id = pb_id

        if 'status' in data:
            mapping.status = int(data['status'])

        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch-Course mapping updated successfully', 'data': mapping.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@bcmappings_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_bcmapping(id):
    mapping = BCMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Branch-Course mapping not found'}), 404

    try:
        db.session.delete(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch-Course mapping deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
