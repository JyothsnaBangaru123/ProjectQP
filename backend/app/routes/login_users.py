from flask import Blueprint, request, jsonify, g
from app.models.login_user import LoginUser
from app.extensions import db
from app.routes.auth import token_required

login_users_bp = Blueprint('login_users', __name__)

@login_users_bp.route('', methods=['GET'])
@token_required
def get_login_users():
    try:
        users = LoginUser.query.order_by(LoginUser.id.asc()).all()
        return jsonify({'success': True, 'data': [u.to_dict() for u in users]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@login_users_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_login_user(id):
    user = LoginUser.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': 'Login user not found'}), 404
    return jsonify({'success': True, 'data': user.to_dict()})

@login_users_bp.route('', methods=['POST'])
@token_required
def create_login_user():
    data = request.get_json() or {}
    
    if 'user_name' not in data or not data['user_name']:
        return jsonify({'success': False, 'message': 'Username is required'}), 400
    if 'password' not in data or not data['password']:
        return jsonify({'success': False, 'message': 'Password is required'}), 400

    existing = LoginUser.query.filter_by(user_name=data['user_name']).first()
    if existing:
        return jsonify({'success': False, 'message': 'Username already exists'}), 409

    try:
        user = LoginUser(
            user_name=data['user_name'],
            type=data.get('type')
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Login user created successfully', 'data': user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@login_users_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_login_user(id):
    user = LoginUser.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': 'Login user not found'}), 404
    
    data = request.get_json() or {}
    
    if 'user_name' in data and data['user_name'] != user.user_name:
        existing = LoginUser.query.filter_by(user_name=data['user_name']).first()
        if existing:
            return jsonify({'success': False, 'message': 'Username already exists'}), 409

    try:
        if 'user_name' in data:
            user.user_name = data['user_name']
        if 'type' in data:
            user.type = data['type']
        if 'password' in data and data['password']:
            user.set_password(data['password'])
            
        db.session.commit()
        return jsonify({'success': True, 'message': 'Login user updated successfully', 'data': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@login_users_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_login_user(id):
    user = LoginUser.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': 'Login user not found'}), 404
    
    if g.current_user.id == user.id:
        return jsonify({'success': False, 'message': 'Cannot delete your own logged-in account'}), 400

    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Login user deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
