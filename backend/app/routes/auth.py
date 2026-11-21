import jwt
import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.security import check_password_hash
from app.models.user import User
from app.models.login_user import LoginUser
from app.models.role import Role
from app.models.branch import Branch
from app.extensions import db

auth_bp = Blueprint('auth', __name__)

class AuthUserContext:
    def __init__(self, user_dict):
        self.id = user_dict.get('id')
        self.user_name = user_dict.get('user_name')
        self.email = user_dict.get('email')
        self.type = user_dict.get('type')
        self.role = user_dict.get('role') or user_dict.get('type')
        self.branch_id = user_dict.get('branch_id')
        self.branch_name = user_dict.get('branch_name')
        self.branch_code = user_dict.get('branch_code')
        self.per_no = user_dict.get('per_no')
        self._raw_dict = user_dict

    def to_dict(self):
        return self._raw_dict

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
            elif auth_header:
                token = auth_header
        elif 'token' in request.args:
            token = request.args.get('token')
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            user_id = data.get('user_id')
            user_source = data.get('source', 'user') # 'user' or 'login_user'
            
            user_info = None
            if user_source == 'user' and user_id:
                u = User.query.get(user_id)
                if u:
                    role_name = 'User'
                    if u.user_type:
                        r = Role.query.get(u.user_type)
                        if r:
                            role_name = r.role_name
                    elif u.user_type == 1:
                        role_name = 'Admin'
                    elif u.user_type == 2:
                        role_name = 'Faculty'
                    
                    b = Branch.query.get(u.branch_id) if u.branch_id else None
                    user_info = {
                        'id': u.id,
                        'user_name': u.user_name,
                        'email': u.email,
                        'per_no': u.per_no,
                        'honorific': u.honorific,
                        'type': role_name,
                        'role': role_name,
                        'branch_id': u.branch_id,
                        'branch_name': b.branch_name if b else None,
                        'branch_code': b.branch_code if b else None
                    }

            if not user_info:
                # Fallback to LoginUser
                lu = LoginUser.query.filter_by(user_name=data.get('user_name')).first()
                if lu:
                    user_info = {
                        'id': lu.id,
                        'user_name': lu.user_name,
                        'type': lu.type or 'Admin',
                        'role': lu.type or 'Admin',
                        'branch_id': None,
                        'branch_name': None
                    }

            if not user_info:
                # Use decoded data directly if active session
                user_info = {
                    'id': data.get('user_id'),
                    'user_name': data.get('user_name'),
                    'type': data.get('type', 'Admin'),
                    'role': data.get('role', data.get('type', 'Admin')),
                    'branch_id': data.get('branch_id'),
                    'branch_name': data.get('branch_name')
                }

            g.current_user = AuthUserContext(user_info)
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token'}), 401
            
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    if not data or not data.get('user_name') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Username and password are required'}), 400

    raw_username = str(data.get('user_name')).strip()
    raw_password = str(data.get('password')).strip()

    # 1. Search in User table (by user_name, email, or personnel number per_no)
    user_record = None
    if raw_username.isdigit():
        user_record = User.query.filter((User.per_no == int(raw_username)) | (User.user_name.ilike(raw_username))).first()
    else:
        user_record = User.query.filter((User.user_name.ilike(raw_username)) | (User.email.ilike(raw_username))).first()

    authenticated_user = None
    user_source = 'user'

    if user_record:
        # Check password (plain text or hash)
        password_valid = False
        if user_record.password == raw_password:
            password_valid = True
        elif user_record.password:
            try:
                if check_password_hash(user_record.password, raw_password):
                    password_valid = True
            except Exception:
                pass

        if password_valid:
            # Check user status
            if user_record.status is False:
                return jsonify({'success': False, 'message': 'User account is inactive. Please contact administrator.'}), 403

            # Determine Role
            role_name = 'User'
            if user_record.user_type:
                r = Role.query.get(user_record.user_type)
                if r:
                    role_name = r.role_name
            elif user_record.user_type == 1:
                role_name = 'Admin'
            elif user_record.user_type == 2:
                role_name = 'Faculty'

            # Determine Branch / Department
            branch = Branch.query.get(user_record.branch_id) if user_record.branch_id else None

            authenticated_user = {
                'id': user_record.id,
                'user_name': user_record.user_name,
                'email': user_record.email,
                'per_no': user_record.per_no,
                'honorific': user_record.honorific,
                'type': role_name,
                'role': role_name,
                'user_type': user_record.user_type,
                'branch_id': user_record.branch_id,
                'branch_name': branch.branch_name if branch else None,
                'branch_code': branch.branch_code if branch else None
            }

    # 2. Fallback to LoginUser table if not authenticated via User table
    if not authenticated_user:
        login_user = LoginUser.query.filter_by(user_name=raw_username).first()
        
        # Seed default admin if DB has no LoginUser
        if not login_user and LoginUser.query.count() == 0:
            if raw_username == 'admin' and raw_password == 'admin':
                default_admin = LoginUser(user_name='admin', type='Admin')
                default_admin.set_password('admin')
                db.session.add(default_admin)
                db.session.commit()
                login_user = default_admin

        if login_user and login_user.check_password(raw_password):
            user_source = 'login_user'
            authenticated_user = {
                'id': login_user.id,
                'user_name': login_user.user_name,
                'type': login_user.type or 'Admin',
                'role': login_user.type or 'Admin',
                'branch_id': None,
                'branch_name': None
            }

    if not authenticated_user:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

    # Generate JWT token
    token = jwt.encode({
        'user_id': authenticated_user['id'],
        'user_name': authenticated_user['user_name'],
        'type': authenticated_user['type'],
        'role': authenticated_user['role'],
        'branch_id': authenticated_user.get('branch_id'),
        'branch_name': authenticated_user.get('branch_name'),
        'source': user_source,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, current_app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({
        'success': True,
        'message': f"Welcome {authenticated_user['user_name']} ({authenticated_user['role']})",
        'token': token,
        'data': authenticated_user
    })

@auth_bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_me():
    return jsonify({
        'success': True,
        'data': g.current_user.to_dict()
    })

@auth_bp.route('/test-email', methods=['POST'])
def test_email():
    data = request.get_json() or {}
    target_email = data.get('email', 'jyothsnabangaru4@gmail.com').strip()
    from app.services.email_service import execute_smtp_send, get_email_config
    cfg = get_email_config()
    ok, err = execute_smtp_send(
        to_email=target_email,
        subject="ProjectQP Test Email Verification",
        html_body="<h3>ProjectQP System Test</h3><p>Your ProjectQP email delivery configuration is working successfully!</p>",
        plain_body="ProjectQP System Test: Your email delivery configuration is working successfully!",
        sender_name=cfg.get('sender_name', 'GMRIT QP System'),
        default_sender=cfg.get('default_sender', 'noreply@gmrit.edu.in'),
        config=cfg
    )
    return jsonify({
        'success': ok,
        'error': err,
        'target_email': target_email,
        'has_smtp_user': bool(cfg.get('smtp_username')),
        'has_webhook': bool(cfg.get('gmail_webhook_url')),
        'has_brevo': bool(cfg.get('brevo_api_key')),
        'has_resend': bool(cfg.get('resend_api_key'))
    }), 200 if ok else 400
