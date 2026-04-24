import logging
import secrets
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    set_refresh_cookies,
    unset_refresh_cookies,
)
from datetime import datetime, timedelta, timezone

from ..extensions import db, limiter, add_to_blocklist
from ..models.user import User
from ..utils.validators import (
    sanitize_string, validate_name, validate_email, 
    validate_mobile, validate_password
)
from ..utils.email import send_otp_email

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)

def get_user_by_identifier(identifier):
    """Helper to find user by user_id, email, or mobile in Firestore."""
    users_ref = db.collection(User.COLLECTION)
    
    # Try user_id
    docs = users_ref.where('user_id', '==', identifier).where('is_active', '==', True).limit(1).stream()
    for doc in docs: return doc
    
    # Try email
    docs = users_ref.where('email', '==', identifier).where('is_active', '==', True).limit(1).stream()
    for doc in docs: return doc
    
    # Try mobile
    docs = users_ref.where('mobile', '==', identifier).where('is_active', '==', True).limit(1).stream()
    for doc in docs: return doc
    
    return None

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    if not data: return jsonify({"error": "Request body required"}), 400

    identifier = sanitize_string(data.get('user_id', '') or data.get('userid', ''), 150)
    password = data.get('password', '')
    role = sanitize_string(data.get('role', ''), 20)

    if not identifier or not password:
        return jsonify({"error": "Credentials required"}), 400

    user_doc = get_user_by_identifier(identifier)
    
    if not user_doc:
        return jsonify({"error": "Invalid credentials"}), 401

    user_data = user_doc.to_dict()
    
    if not User.check_password(password, user_data.get('password_hash')):
        return jsonify({"error": "Invalid credentials"}), 401

    if user_data.get('role') != role:
        return jsonify({"error": f"This account is not registered as {role}"}), 401

    if role == 'hod':
        college = sanitize_string(data.get('college', ''), 100)
        department = sanitize_string(data.get('department', ''), 50)
        if user_data.get('college') != college or user_data.get('department') != department:
            return jsonify({"error": "College or department mismatch"}), 401

    access_token = create_access_token(identity=user_data.get('user_id'))
    refresh_token = create_refresh_token(identity=user_data.get('user_id'))

    response = make_response(jsonify({
        "success": True,
        "access_token": access_token,
        "user": User.to_dict(user_doc.id, user_data),
    }))
    set_refresh_cookies(response, refresh_token)
    return response, 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    add_to_blocklist(jti)
    response = make_response(jsonify({"success": True, "message": "Logged out successfully"}))
    unset_refresh_cookies(response)
    return response, 200

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json()
    name = sanitize_string(data.get('name', ''), 150)
    college = sanitize_string(data.get('college', ''), 100)
    department = sanitize_string(data.get('department', ''), 50)
    mobile = sanitize_string(data.get('mobile', ''), 15)
    email = sanitize_string(data.get('email', ''), 150)
    password = data.get('password', '')

    if not college or not department:
        return jsonify({"error": "College and department are required"}), 400

    users_ref = db.collection(User.COLLECTION)
    existing = users_ref.where('college', '==', college)\
                        .where('department', '==', department)\
                        .where('role', '==', 'hod')\
                        .where('is_active', '==', True).limit(1).stream()
    
    if any(existing):
        return jsonify({"error": f"An HoD for {college} - {department} already exists."}), 409

    dept_code = department.upper()
    college_code = 'G' if college.lower() == 'gandhi' else 'P'

    while True:
        new_user_id = f"{dept_code}-{college_code}_{secrets.randbelow(1000) + 1}"
        check = users_ref.where('user_id', '==', new_user_id).limit(1).stream()
        if not any(check): break

    new_user = {
        'user_id': new_user_id,
        'name': name,
        'role': 'hod',
        'college': college,
        'department': department,
        'mobile': mobile,
        'email': email,
        'password_hash': User.set_password(password),
        'is_active': True,
        'created_at': datetime.now(timezone.utc)
    }
    
    users_ref.add(new_user)
    return jsonify({"success": True, "userId": new_user_id}), 201

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
    
    for doc in docs:
        return jsonify({"user": User.to_dict(doc.id, doc.to_dict())}), 200
        
    return jsonify({"error": "User not found"}), 404

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True, locations=['cookies'])
def refresh():
    user_id = get_jwt_identity()
    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
    
    if not any(docs):
        return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401
        
    return jsonify({"access_token": create_access_token(identity=user_id)}), 200
@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per minute")
def forgot_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    user_id = sanitize_string(data.get('user_id', ''), 50)
    email = sanitize_string(data.get('email', ''), 150)
    mobile = sanitize_string(data.get('mobile', ''), 15)

    safe_response = jsonify({"success": True, "message": "If the details match, an OTP has been sent."})

    docs = db.collection(User.COLLECTION)\
        .where('user_id', '==', user_id)\
        .where('email', '==', email)\
        .where('mobile', '==', mobile)\
        .where('is_active', '==', True).limit(1).stream()

    user_doc = next(docs, None)
    if not user_doc:
        return safe_response, 200

    otp = str(secrets.randbelow(900000) + 100000)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    user_doc.reference.update({'reset_otp': otp, 'reset_otp_expiry': expiry})

    user_data = user_doc.to_dict()
    if not send_otp_email(user_data.get('email'), user_data.get('user_id'), otp):
        user_doc.reference.update({'reset_otp': None, 'reset_otp_expiry': None})
        return jsonify({"error": "Could not send OTP. Contact administrator."}), 500

    return safe_response, 200


@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("3 per minute")
def reset_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    user_id = sanitize_string(data.get('user_id', ''), 50)
    otp = sanitize_string(data.get('otp', ''), 6)
    new_password = data.get('new_password', '')

    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).limit(1).stream()
    user_doc = next(docs, None)
    if not user_doc:
        return jsonify({"error": "Invalid User ID or OTP"}), 400

    user_data = user_doc.to_dict()
    if user_data.get('reset_otp') != otp:
        return jsonify({"error": "Invalid User ID or OTP"}), 400

    expiry = user_data.get('reset_otp_expiry')
    if expiry and datetime.now(timezone.utc) > expiry:
        user_doc.reference.update({'reset_otp': None, 'reset_otp_expiry': None})
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    valid, msg = validate_password(new_password)
    if not valid:
        return jsonify({"error": msg}), 400

    user_doc.reference.update({
        'password_hash': User.set_password(new_password),
        'reset_otp': None,
        'reset_otp_expiry': None,
    })
    return jsonify({"success": True, "message": "Password reset successfully"}), 200


@auth_bp.route('/account', methods=['DELETE'])
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
    user_doc = next(docs, None)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    password = data.get('password', '')
    user_data = user_doc.to_dict()
    if not User.check_password(password, user_data.get('password_hash')):
        return jsonify({"error": "Incorrect password"}), 401

    jti = get_jwt()["jti"]
    add_to_blocklist(jti)

    if user_data.get('role') == 'hod':
        college = user_data.get('college')
        department = user_data.get('department')
        # Soft-delete faculty and batches for this department
        for f_doc in db.collection('faculty').where('college', '==', college).where('department', '==', department).stream():
            f_doc.reference.update({'is_active': False})
        for b_doc in db.collection('batches').where('college', '==', college).where('department', '==', department).stream():
            b_doc.reference.update({'is_active': False})

    user_doc.reference.update({'is_active': False})

    response = make_response(jsonify({"success": True, "message": "Account deleted successfully"}))
    unset_refresh_cookies(response)
    return response, 200


@auth_bp.route('/register-admin', methods=['POST'])
@limiter.limit("3 per minute")
def register_admin():
    import os
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    provided_key = data.get('reg_key', '')
    expected_key = os.environ.get('ADMIN_REG_KEY', '')
    if not expected_key:
        return jsonify({"error": "Admin registration not configured"}), 503
    if provided_key != expected_key:
        return jsonify({"error": "Invalid registration key"}), 403

    admin_role = sanitize_string(data.get('admin_role', ''), 20).lower()
    if admin_role not in ['principal', 'director', 'chairman']:
        return jsonify({"error": "Invalid admin_role"}), 400

    name = sanitize_string(data.get('name', ''), 150)
    email = sanitize_string(data.get('email', ''), 150)
    mobile = sanitize_string(data.get('mobile', ''), 15)
    password = data.get('password', '')

    new_user_id = f"{admin_role.upper()}-001"
    existing = db.collection(User.COLLECTION).where('user_id', '==', new_user_id).where('is_active', '==', True).limit(1).stream()
    if any(existing):
        return jsonify({"error": f"A {admin_role.capitalize()} account already exists."}), 409

    user_college = 'Gandhi' if admin_role == 'principal' else None
    new_user = {
        'user_id': new_user_id,
        'name': name,
        'role': 'admin',
        'college': user_college,
        'department': None,
        'email': email,
        'mobile': mobile,
        'password_hash': User.set_password(password),
        'is_active': True,
        'created_at': datetime.now(timezone.utc),
    }
    db.collection(User.COLLECTION).add(new_user)
    return jsonify({"success": True, "userId": new_user_id}), 201


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
    user_doc = next(docs, None)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404

    updates = {}
    if 'name' in data:
        updates['name'] = sanitize_string(data['name'], 150)
    if 'email' in data:
        updates['email'] = sanitize_string(data['email'], 150)
    if 'mobile' in data:
        updates['mobile'] = sanitize_string(data['mobile'], 15)

    if updates:
        user_doc.reference.update(updates)

    updated_data = {**user_doc.to_dict(), **updates}
    return jsonify({"success": True, "user": User.to_dict(user_doc.id, updated_data)}), 200


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
    user_doc = next(docs, None)
    if not user_doc:
        return jsonify({"error": "User not found"}), 404

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    user_data = user_doc.to_dict()

    if not User.check_password(current_password, user_data.get('password_hash')):
        return jsonify({"error": "Current password is incorrect"}), 401

    valid, msg = validate_password(new_password)
    if not valid:
        return jsonify({"error": msg}), 400

    user_doc.reference.update({'password_hash': User.set_password(new_password)})
    return jsonify({"success": True, "message": "Password changed successfully"}), 200