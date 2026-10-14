from flask import Blueprint, request, jsonify
from app.models.role import Role
from app.extensions import db
from app.routes.auth import token_required

roles_bp = Blueprint('roles', __name__)

@roles_bp.route('', methods=['GET'])
@token_required
def get_roles():
    try:
        roles = Role.query.order_by(Role.id.asc()).all()
        return jsonify({'success': True, 'data': [r.to_dict() for r in roles]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@roles_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_role(id):
    role = Role.query.get(id)
    if not role:
        return jsonify({'success': False, 'message': 'Role not found'}), 404
    return jsonify({'success': True, 'data': role.to_dict()})

@roles_bp.route('', methods=['POST'])
@token_required
def create_role():
    data = request.get_json() or {}
    role_name = data.get('role_name') or data.get('role')
    if not role_name or not str(role_name).strip():
        return jsonify({'success': False, 'message': 'Role name is required'}), 400

    role_name = str(role_name).strip()
    try:
        # Check duplicate
        existing = Role.query.filter(db.func.lower(Role.role_name) == role_name.lower()).first()
        if existing:
            return jsonify({'success': False, 'message': f"Role '{role_name}' already exists"}), 409

        role = Role(
            role_name=role_name,
            status=int(data.get('status', 1))
        )
        db.session.add(role)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Role created successfully', 'data': role.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@roles_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_role(id):
    role = Role.query.get(id)
    if not role:
        return jsonify({'success': False, 'message': 'Role not found'}), 404

    data = request.get_json() or {}
    try:
        if 'role_name' in data or 'role' in data:
            role_name = data.get('role_name') or data.get('role')
            if not role_name or not str(role_name).strip():
                return jsonify({'success': False, 'message': 'Role name is required'}), 400
            
            role_name = str(role_name).strip()
            existing = Role.query.filter(db.func.lower(Role.role_name) == role_name.lower()).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Role '{role_name}' already exists"}), 409
            role.role_name = role_name

        if 'status' in data:
            role.status = int(data['status'])

        db.session.commit()
        return jsonify({'success': True, 'message': 'Role updated successfully', 'data': role.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@roles_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_role(id):
    role = Role.query.get(id)
    if not role:
        return jsonify({'success': False, 'message': 'Role not found'}), 404

    try:
        db.session.delete(role)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Role deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
