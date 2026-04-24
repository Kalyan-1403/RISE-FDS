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