from flask import Blueprint, request, jsonify
from app.models.regulation import Regulation
from app.extensions import db
from app.routes.auth import token_required

regulations_bp = Blueprint('regulations', __name__)

@regulations_bp.route('', methods=['GET'])
@token_required
def get_regulations():
    try:
        regulations = Regulation.query.order_by(Regulation.id.asc()).all()
        return jsonify({'success': True, 'data': [r.to_dict() for r in regulations]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@regulations_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_regulation(id):
    regulation = Regulation.query.get(id)
    if not regulation:
        return jsonify({'success': False, 'message': 'Regulation not found'}), 404
    return jsonify({'success': True, 'data': regulation.to_dict()})

@regulations_bp.route('', methods=['POST'])
@token_required
def create_regulation():
    data = request.get_json() or {}
    if 'reg' not in data or not data['reg']:
        return jsonify({'success': False, 'message': 'Regulation name (reg) is required'}), 400

    try:
        # Check duplicate
        existing = Regulation.query.filter_by(reg=data['reg']).first()
        if existing:
            return jsonify({'success': False, 'message': f"Regulation '{data['reg']}' already exists"}), 409

        regulation = Regulation(
            reg=data['reg'],
            status=int(data.get('status', 1))
        )
        db.session.add(regulation)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Regulation created successfully', 'data': regulation.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@regulations_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_regulation(id):
    regulation = Regulation.query.get(id)
    if not regulation:
        return jsonify({'success': False, 'message': 'Regulation not found'}), 404

    data = request.get_json() or {}
    try:
        if 'reg' in data:
            if not data['reg']:
                return jsonify({'success': False, 'message': 'Regulation name (reg) is required'}), 400
            
            existing = Regulation.query.filter_by(reg=data['reg']).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Regulation '{data['reg']}' already exists"}), 409
            regulation.reg = data['reg']
            
        if 'status' in data:
            regulation.status = int(data['status'])
            if regulation.status == 0:
                from app.models.bcmapping import BCMapping
                db.session.query(BCMapping).filter(BCMapping.reg_id == id).update({BCMapping.status: 0})

        db.session.commit()
        return jsonify({'success': True, 'message': 'Regulation updated successfully', 'data': regulation.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@regulations_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_regulation(id):
    regulation = Regulation.query.get(id)
    if not regulation:
        return jsonify({'success': False, 'message': 'Regulation not found'}), 404

    try:
        db.session.delete(regulation)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Regulation deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
