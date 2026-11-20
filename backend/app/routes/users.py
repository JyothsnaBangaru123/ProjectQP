from flask import Blueprint, request, jsonify
from app.models.user import User
from app.models.role import Role
from app.models.branch import Branch
from app.extensions import db
from app.routes.auth import token_required
from app.services.email_service import send_credentials_email

users_bp = Blueprint('users', __name__)

def map_status_to_db(status_val):
    # Convert UI status (1/0) to DB boolean (True/False)
    if status_val is None:
        return None
    return True if int(status_val) == 1 else False

def map_status_from_db(status_bool):
    # Convert DB boolean (True/False) to UI status (1/0)
    if status_bool is None:
        return 0
    return 1 if status_bool else 0

def enrich_user_dict(u):
    d = u.to_dict()
    d['status'] = map_status_from_db(u.status)
    d['role_name'] = None
    if u.user_type:
        role = Role.query.get(u.user_type)
        if role:
            d['role_name'] = role.role_name
    return d

@users_bp.route('/available', methods=['GET'])
@users_bp.route('/faculty/available', methods=['GET'])
@token_required
def get_available_faculty():
    """
    Returns the list of registered Faculty members available for selection by an authorized HOD.
    Excludes Admin and HOD accounts.
    """
    try:
        faculty_role = Role.query.filter(Role.role_name.ilike('faculty')).first()
        faculty_role_id = faculty_role.id if faculty_role else 2

        faculty_users = User.query.filter(
            (User.user_type == faculty_role_id),
            (User.status == True)
        ).order_by(User.user_name.asc()).all()

        data = []
        for u in faculty_users:
            branch = Branch.query.get(u.branch_id) if u.branch_id else None
            data.append({
                'id': u.id,
                'user_name': u.user_name,
                'email': u.email,
                'per_no': u.per_no,
                'honorific': u.honorific,
                'branch_id': u.branch_id,
                'branch_name': branch.branch_name if branch else 'General'
            })

        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@users_bp.route('', methods=['GET'])
@token_required
def get_users():
    try:
        users = User.query.order_by(User.id.asc()).all()
        data = [enrich_user_dict(u) for u in users]
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@users_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_user(id):
    user = User.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    return jsonify({'success': True, 'data': enrich_user_dict(user)})

@users_bp.route('', methods=['POST'])
@token_required
def create_user():
    data = request.get_json() or {}
    
    # Validation
    if 'per_no' not in data or data['per_no'] is None or str(data['per_no']).strip() == '':
        return jsonify({'success': False, 'message': 'Personnel number (per_no) is required.'}), 400
    
    try:
        per_no_val = int(data['per_no'])
    except ValueError:
        return jsonify({'success': False, 'message': 'Personnel number must be a valid number.'}), 400

    if not data.get('user_name') or not str(data.get('user_name')).strip():
        return jsonify({'success': False, 'message': 'User Name is required.'}), 400

    if 'email' not in data or not data['email'] or not str(data['email']).strip():
        return jsonify({'success': False, 'message': 'Email address is required.'}), 400
    
    email_clean = str(data['email']).strip()
    if '@' not in email_clean or '.' not in email_clean:
        return jsonify({'success': False, 'message': f"'{email_clean}' is not a valid email address."}), 400

    # Check duplicate per_no
    existing_per_no = User.query.filter_by(per_no=per_no_val).first()
    if existing_per_no:
        return jsonify({'success': False, 'message': f"Personnel number {per_no_val} is already assigned to {existing_per_no.user_name}."}), 409

    # Check duplicate email
    existing_email = User.query.filter(User.email.ilike(email_clean)).first()
    if existing_email:
        return jsonify({'success': False, 'message': f"Email '{email_clean}' is already registered with another user ({existing_email.user_name})."}), 409

    raw_password = data.get('password')

    try:
        user = User(
            per_no=per_no_val,
            honorific=data.get('honorific'),
            user_name=data.get('user_name').strip(),
            branch_id=data.get('branch_id') if data.get('branch_id') is not None else None,
            contact=int(data['contact']) if data.get('contact') else None,
            user_type=int(data['user_type']) if data.get('user_type') is not None else None,
            status=map_status_to_db(data.get('status', 1)),
            password=raw_password,
            email=email_clean
        )
        db.session.add(user)
        db.session.commit()

        # Send credentials to user email
        role_record = Role.query.get(user.user_type) if user.user_type else None
        branch_record = Branch.query.get(user.branch_id) if user.branch_id else None
        role_name = role_record.role_name if role_record else None
        branch_name = branch_record.branch_name if branch_record else None

        email_result = send_credentials_email(
            user_data=enrich_user_dict(user),
            raw_password=raw_password,
            role_name=role_name,
            branch_name=branch_name,
            is_update=False,
            sync=True
        )
        
        email_sent = email_result.get('success', False)
        if email_sent:
            msg = f"User {user.user_name} created and login credentials emailed to {user.email}."
        else:
            msg = f"User {user.user_name} created, but email could not be delivered: {email_result.get('message', 'Check email configuration')}."

        return jsonify({
            'success': True,
            'message': msg,
            'data': enrich_user_dict(user),
            'email_sent': email_sent
        }), 201
    except Exception as e:
        db.session.rollback()
        err_str = str(e).lower()
        if 'duplicate' in err_str or 'unique' in err_str:
            return jsonify({'success': False, 'message': f"A user with personnel number {per_no_val} or email '{email_clean}' already exists."}), 409
        return jsonify({'success': False, 'message': f"Could not create user: {str(e)}"}), 400

@users_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_user(id):
    user = User.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': f"User with ID {id} not found."}), 404
    
    data = request.get_json() or {}
    
    # Check duplicate per_no
    if 'per_no' in data and data['per_no'] is not None:
        try:
            per_no_val = int(data['per_no'])
            if per_no_val != user.per_no:
                existing = User.query.filter_by(per_no=per_no_val).first()
                if existing:
                    return jsonify({'success': False, 'message': f"Personnel number {per_no_val} is already assigned to {existing.user_name}."}), 409
        except ValueError:
            return jsonify({'success': False, 'message': 'Personnel number must be a valid number.'}), 400

    # Check duplicate email
    if 'email' in data and data['email']:
        email_clean = str(data['email']).strip()
        if email_clean.lower() != (user.email or '').lower():
            existing_email = User.query.filter(User.email.ilike(email_clean)).first()
            if existing_email:
                return jsonify({'success': False, 'message': f"Email '{email_clean}' is already registered with another user ({existing_email.user_name})."}), 409

    password_changed = False
    new_password = None

    try:
        if 'per_no' in data and data['per_no'] is not None:
            user.per_no = int(data['per_no'])
        if 'honorific' in data:
            user.honorific = data['honorific']
        if 'user_name' in data and data['user_name']:
            user.user_name = data['user_name'].strip()
        if 'branch_id' in data:
            user.branch_id = data['branch_id'] if data['branch_id'] is not None else None
        if 'contact' in data:
            user.contact = int(data['contact']) if data['contact'] else None
        if 'user_type' in data:
            user.user_type = int(data['user_type']) if data['user_type'] is not None else None
        if 'status' in data:
            user.status = map_status_to_db(data['status'])
            if user.status is False:
                from app.models.mapping import Mapping
                db.session.query(Mapping).filter(Mapping.faculty_id == id).update({Mapping.status: 0})
        if 'password' in data and data['password']:
            user.password = data['password']
            password_changed = True
            new_password = data['password']
        if 'email' in data and data['email']:
            user.email = str(data['email']).strip()
            
        db.session.commit()

        # If password was updated, notify the user with updated credentials
        if password_changed and new_password:
            role_record = Role.query.get(user.user_type) if user.user_type else None
            branch_record = Branch.query.get(user.branch_id) if user.branch_id else None
            email_result = send_credentials_email(
                user_data=enrich_user_dict(user),
                raw_password=new_password,
                role_name=role_record.role_name if role_record else None,
                branch_name=branch_record.branch_name if branch_record else None,
                is_update=True,
                sync=True
            )
            if email_result.get('success'):
                msg = f"User updated and new credentials sent to {user.user_name} ({user.email})"
            else:
                msg = f"User updated, but email could not be delivered: {email_result.get('message', 'Delivery failed')}"
        else:
            msg = f"User {user.user_name} updated successfully"

        return jsonify({
            'success': True,
            'message': msg,
            'data': enrich_user_dict(user),
            'password_updated': password_changed
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f"Failed to update user: {str(e)}"}), 400

@users_bp.route('/<int:id>/send-credentials', methods=['POST'])
@token_required
def send_user_credentials(id):
    user = User.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': f"User with ID {id} not found."}), 404
    
    if not user.email:
        return jsonify({'success': False, 'message': f"User {user.user_name} does not have a registered email address."}), 400

    try:
        role_record = Role.query.get(user.user_type) if user.user_type else None
        branch_record = Branch.query.get(user.branch_id) if user.branch_id else None
        role_name = role_record.role_name if role_record else None
        branch_name = branch_record.branch_name if branch_record else None

        result = send_credentials_email(
            user_data=enrich_user_dict(user),
            raw_password=user.password or '********',
            role_name=role_name,
            branch_name=branch_name,
            is_update=False,
            sync=True
        )

        if not result.get('success'):
            return jsonify({
                'success': False,
                'message': result.get('message', 'Failed to deliver credentials email.')
            }), 400

        return jsonify({
            'success': True,
            'message': f"Email sent successfully to {user.user_name} ({user.email})"
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f"Could not send email: {str(e)}"}), 500

@users_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_user(id):
    user = User.query.get(id)
    if not user:
        return jsonify({'success': False, 'message': f"User with ID {id} not found."}), 404
    
    try:
        from app.models.mapping import Mapping
        mapping_count = Mapping.query.filter_by(faculty_id=id).count()
        if mapping_count > 0:
            return jsonify({
                'success': False,
                'message': f"Cannot delete {user.user_name}: Assigned to {mapping_count} course mapping(s). Remove mappings first."
            }), 400

        user_name = user.user_name
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': f"User {user_name} deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f"Could not delete user: {str(e)}"}), 400

