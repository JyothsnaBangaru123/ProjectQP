from flask import Blueprint, request, jsonify
from app.models.pbmapping import PBMapping
from app.extensions import db
from app.routes.auth import token_required

pbmappings_bp = Blueprint('pbmappings', __name__)

@pbmappings_bp.route('', methods=['GET'])
@token_required
def get_pbmappings():
    try:
        mappings = PBMapping.query.order_by(PBMapping.id.asc()).all()
        return jsonify({'success': True, 'data': [m.to_dict() for m in mappings]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@pbmappings_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_pbmapping(id):
    mapping = PBMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Program-Branch mapping not found'}), 404
    return jsonify({'success': True, 'data': mapping.to_dict()})

@pbmappings_bp.route('', methods=['POST'])
@token_required
def create_pbmapping():
    data = request.get_json() or {}
    if 'prog_id' not in data or data['prog_id'] is None:
        return jsonify({'success': False, 'message': 'Program is required'}), 400
    if 'branch_id' not in data or data['branch_id'] is None:
        return jsonify({'success': False, 'message': 'Branch is required'}), 400

    prog_id = int(data['prog_id'])
    branch_id = int(data['branch_id'])

    try:
        # Check duplicate combination
        existing = PBMapping.query.filter_by(prog_id=prog_id, branch_id=branch_id).first()
        if existing:
            return jsonify({'success': False, 'message': 'This Program and Branch combination already exists'}), 409

        mapping = PBMapping(
            prog_id=prog_id,
            branch_id=branch_id,
            status=int(data.get('status', 1))
        )
        db.session.add(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Program-Branch mapping created successfully', 'data': mapping.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@pbmappings_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_pbmapping(id):
    mapping = PBMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Program-Branch mapping not found'}), 404

    data = request.get_json() or {}
    try:
        prog_id = int(data['prog_id']) if 'prog_id' in data else mapping.prog_id
        branch_id = int(data['branch_id']) if 'branch_id' in data else mapping.branch_id

        if 'prog_id' in data or 'branch_id' in data:
            # Check duplicate combination
            existing = PBMapping.query.filter_by(prog_id=prog_id, branch_id=branch_id).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': 'This Program and Branch combination already exists'}), 409
            
            mapping.prog_id = prog_id
            mapping.branch_id = branch_id

        if 'status' in data:
            mapping.status = int(data['status'])
            if mapping.status == 0:
                from app.models.bcmapping import BCMapping
                db.session.query(BCMapping).filter(BCMapping.pb_id == id).update({BCMapping.status: 0})

        db.session.commit()
        return jsonify({'success': True, 'message': 'Program-Branch mapping updated successfully', 'data': mapping.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@pbmappings_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_pbmapping(id):
    mapping = PBMapping.query.get(id)
    if not mapping:
        return jsonify({'success': False, 'message': 'Program-Branch mapping not found'}), 404

    try:
        db.session.delete(mapping)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Program-Branch mapping deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
