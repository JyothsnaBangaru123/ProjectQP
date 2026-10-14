from flask import Blueprint, request, jsonify
from app.models.qlevel import QLevel
from app.extensions import db
from app.routes.auth import token_required

qlevel_bp = Blueprint('qlevel', __name__)

@qlevel_bp.route('', methods=['GET'])
@token_required
def get_qlevels():
    try:
        levels = QLevel.query.order_by(QLevel.id.asc()).all()
        return jsonify({'success': True, 'data': [lvl.to_dict() for lvl in levels]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@qlevel_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_qlevel(id):
    level = QLevel.query.get(id)
    if not level:
        return jsonify({'success': False, 'message': 'Question level not found'}), 404
    return jsonify({'success': True, 'data': level.to_dict()})

@qlevel_bp.route('', methods=['POST'])
@token_required
def create_qlevel():
    data = request.get_json() or {}
    if 'level' not in data or not data['level']:
        return jsonify({'success': False, 'message': 'Question level name is required'}), 400

    try:
        # Check duplicate
        existing = QLevel.query.filter_by(level=data['level']).first()
        if existing:
            return jsonify({'success': False, 'message': f"Question level '{data['level']}' already exists"}), 409

        qlevel = QLevel(
            level=data['level'],
            status=int(data.get('status', 1))
        )
        db.session.add(qlevel)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Question level created successfully', 'data': qlevel.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@qlevel_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_qlevel(id):
    qlevel = QLevel.query.get(id)
    if not qlevel:
        return jsonify({'success': False, 'message': 'Question level not found'}), 404

    data = request.get_json() or {}
    try:
        if 'level' in data:
            if not data['level']:
                return jsonify({'success': False, 'message': 'Question level name is required'}), 400
            
            existing = QLevel.query.filter_by(level=data['level']).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Question level '{data['level']}' already exists"}), 409
            qlevel.level = data['level']

        if 'status' in data:
            qlevel.status = int(data['status'])

        db.session.commit()
        return jsonify({'success': True, 'message': 'Question level updated successfully', 'data': qlevel.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@qlevel_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_qlevel(id):
    qlevel = QLevel.query.get(id)
    if not qlevel:
        return jsonify({'success': False, 'message': 'Question level not found'}), 404

    try:
        db.session.delete(qlevel)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Question level deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
