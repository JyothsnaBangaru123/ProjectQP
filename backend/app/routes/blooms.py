from flask import Blueprint, request, jsonify
from app.models.bloom import Bloom
from app.extensions import db
from app.routes.auth import token_required

blooms_bp = Blueprint('blooms', __name__)

@blooms_bp.route('', methods=['GET'])
@token_required
def get_blooms():
    try:
        blooms = Bloom.query.order_by(Bloom.id.asc()).all()
        return jsonify({'success': True, 'data': [b.to_dict() for b in blooms]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@blooms_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_bloom(id):
    bloom = Bloom.query.get(id)
    if not bloom:
        return jsonify({'success': False, 'message': 'Bloom taxonomy not found'}), 404
    return jsonify({'success': True, 'data': bloom.to_dict()})

@blooms_bp.route('', methods=['POST'])
@token_required
def create_bloom():
    data = request.get_json() or {}
    if 'taxonomy' not in data or not data['taxonomy']:
        return jsonify({'success': False, 'message': 'Taxonomy description is required'}), 400

    try:
        # Check duplicate
        existing = Bloom.query.filter_by(taxonomy=data['taxonomy']).first()
        if existing:
            return jsonify({'success': False, 'message': f"Taxonomy '{data['taxonomy']}' already exists"}), 409

        bloom = Bloom(
            taxonomy=data['taxonomy'],
            status=int(data.get('status', 1))
        )
        db.session.add(bloom)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Bloom taxonomy created successfully', 'data': bloom.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@blooms_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_bloom(id):
    bloom = Bloom.query.get(id)
    if not bloom:
        return jsonify({'success': False, 'message': 'Bloom taxonomy not found'}), 404

    data = request.get_json() or {}
    try:
        if 'taxonomy' in data:
            if not data['taxonomy']:
                return jsonify({'success': False, 'message': 'Taxonomy description is required'}), 400
            
            existing = Bloom.query.filter_by(taxonomy=data['taxonomy']).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Taxonomy '{data['taxonomy']}' already exists"}), 409
            bloom.taxonomy = data['taxonomy']

        if 'status' in data:
            bloom.status = int(data['status'])

        db.session.commit()
        return jsonify({'success': True, 'message': 'Bloom taxonomy updated successfully', 'data': bloom.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@blooms_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_bloom(id):
    bloom = Bloom.query.get(id)
    if not bloom:
        return jsonify({'success': False, 'message': 'Bloom taxonomy not found'}), 404

    try:
        db.session.delete(bloom)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Bloom taxonomy deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
