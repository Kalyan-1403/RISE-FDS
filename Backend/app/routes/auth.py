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
from datetime import datetime, timedelta

from ..extensions import db, limiter, add_to_blocklist
from ..models.user import User
from ..models.faculty import Faculty
from ..models.batch import Batch
from ..utils.validators import (
    sanitize_string,
    validate_name,
    validate_email,
    validate_mobile,
    validate_password,
)
from ..utils.email import send_otp_email

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    identifier = sanitize_string(data.get('userid', ''), 150)
    password = data.get('password', '')
    role = sanitize_string(data.get('role', ''), 20)

    if not identifier or not password:
        return jsonify({"error": "User ID, Email or Mobile and password are required"}), 400

    # Try User ID → Email → Mobile in order
    user = (
        User.query.filter(
            db.func.lower(User.user_id) == identifier.lower(),
            User.is_active == True
        ).first()
        or User.query.filter(
            db.func.lower(User.email) == identifier.lower(),
            User.is_active == True
        ).first()
        or User.query.filter(
            User.mobile == identifier.strip(),
            User.is_active == True
        ).first()
    )

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.role != role:
        return jsonify({"error": f"This account is not registered as {role}"}), 401

    if role == 'hod':
        college = sanitize_string(data.get('college', ''), 100)
        department = sanitize_string(data.get('department', ''), 50)
        if user.college != college or user.department != department:
            return jsonify({"error": "College or department mismatch"}), 401

    access_token = create_access_token(identity=user.user_id)
    refresh_token = create_refresh_token(identity=user.user_id)

    logger.info(f"User logged in: {user.user_id} (role={user.role})")

    response = make_response(jsonify({
        "success": True,
        "access_token": access_token,
        "user": user.to_dict(),
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
    logger.info(f"User logged out: {get_jwt_identity()}")
    return response, 200


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    name = sanitize_string(data.get('name', ''), 150)
    college = sanitize_string(data.get('college', ''), 100)
    department = sanitize_string(data.get('department', ''), 50)
    mobile = sanitize_string(data.get('mobile', ''), 15)
    email = sanitize_string(data.get('email', ''), 150)
    password = data.get('password', '')

    valid, msg = validate_name(name)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_email(email)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_mobile(mobile)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_password(password)
    if not valid:
        return jsonify({"error": msg}), 400

    if not college or not department:
        return jsonify({"error": "College and department are required"}), 400

    existing = User.query.filter_by(
        college=college, department=department, role='hod', is_active=True
    ).first()

    if existing:
        return jsonify({"error": f"An HoD for {college} - {department} already exists."}), 409

    dept_code = department.upper()
    college_code = 'G' if college.lower() == 'gandhi' else 'P'

    while True:
        random_num = secrets.randbelow(1000) + 1
        new_user_id = f"{dept_code}-{college_code}_{random_num}"
        if not User.query.filter(db.func.lower(User.user_id) == new_user_id.lower()).first():
            break

    user = User(
        user_id=new_user_id,
        name=name,
        role='hod',
        college=college,
        department=department,
        mobile=mobile,
        email=email,
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    logger.info(f"New HoD registered: {new_user_id} ({college}/{department})")

    return jsonify({
        "success": True,
        "message": "Account created successfully",
        "userId": new_user_id,
    }), 201


@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per minute")
def forgot_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    user_id = sanitize_string(data.get('user_id', ''), 50)
    email = sanitize_string(data.get('email', ''), 150)
    mobile = sanitize_string(data.get('mobile', ''), 15)

    _safe_response = jsonify({"success": True, "message": "If the details match, an OTP has been sent."})

    user = User.query.filter(
        db.func.lower(User.user_id) == user_id.lower(),
        User.email == email,
        User.mobile == mobile,
        User.is_active == True,
    ).first()

    if not user or not user.email:
        return _safe_response, 200

    otp = str(secrets.randbelow(900000) + 100000)
    user.reset_otp = otp
    user.reset_otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    delivered = send_otp_email(user.email, user.user_id, otp)
    if not delivered:
        user.reset_otp = None
        user.reset_otp_expiry = None
        db.session.commit()
        return jsonify({"error": "Could not send OTP. Please contact your administrator."}), 500

    return _safe_response, 200


@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("3 per minute")
def reset_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    user_id = sanitize_string(data.get('user_id', ''), 50)
    otp = sanitize_string(data.get('otp', ''), 6)
    new_password = data.get('new_password', '')

    user = User.query.filter(db.func.lower(User.user_id) == user_id.lower()).first()

    if not user or not user.reset_otp or user.reset_otp != otp:
        return jsonify({"error": "Invalid User ID or OTP"}), 400

    if user.reset_otp_expiry and datetime.utcnow() > user.reset_otp_expiry:
        user.reset_otp = None
        user.reset_otp_expiry = None
        db.session.commit()
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    valid, msg = validate_password(new_password)
    if not valid:
        return jsonify({"error": msg}), 400

    user.set_password(new_password)
    user.reset_otp = None
    user.reset_otp_expiry = None
    db.session.commit()

    logger.info(f"Password reset successful for user {user.user_id}")
    return jsonify({"success": True, "message": "Password reset successfully"}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.filter_by(user_id=user_id, is_active=True).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.filter_by(user_id=user_id, is_active=True).first()
    if not user:
        return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401
    new_access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": new_access_token}), 200

@auth_bp.route('/account', methods=['DELETE'])
@jwt_required()
def delete_account():
    """HoD deletes their own account. Requires password confirmation."""
    user_id = get_jwt_identity()
    user = User.query.filter_by(user_id=user_id, is_active=True).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.role == 'admin':
        return jsonify({"error": "Admin accounts cannot be self-deleted"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    password = data.get('password', '')
    if not password or not user.check_password(password):
        return jsonify({"error": "Incorrect password. Please confirm your current password."}), 401

    # Revoke current token
    jti = get_jwt()["jti"]
    add_to_blocklist(jti)

    # Delete all department data before removing the user
    college = user.college
    department = user.department

    batches = Batch.query.filter_by(college=college, department=department).all()
    for batch in batches:
        db.session.delete(batch)  # cascades → BatchFaculty, FeedbackSubmission, FeedbackRating

    faculty = Faculty.query.filter_by(college=college, department=department).all()
    for f in faculty:
        db.session.delete(f)  # cascades → FeedbackRating

        db.session.delete(user)
    db.session.commit()

    response = make_response(jsonify({
        "success": True,
        "message": "Account deleted successfully"
    }))
    unset_refresh_cookies(response)
    logger.info(f"Account self-deleted: {user_id} ({college}/{department})")
    return response, 200

@auth_bp.route('/register-admin', methods=['POST'])
@limiter.limit("3 per minute")
def register_admin():
    """
    Register a management admin account (Principal, Director, or Chairman).
    Requires a secret registration key set via ADMIN_REG_KEY environment variable.
    Only one account per role is allowed. Only the developer can register these.
    """
    import os
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    # Verify secret registration key
    provided_key = data.get('reg_key', '')
    expected_key = os.environ.get('ADMIN_REG_KEY', '')
    if not expected_key:
        return jsonify({"error": "Admin registration is not configured. Set ADMIN_REG_KEY in environment."}), 503
    if provided_key != expected_key:
        return jsonify({"error": "Invalid registration key"}), 403

    admin_role = sanitize_string(data.get('admin_role', ''), 20).lower()
    VALID_ROLES = ['principal', 'director', 'chairman']
    if admin_role not in VALID_ROLES:
        return jsonify({"error": f"admin_role must be one of: {', '.join(VALID_ROLES)}"}), 400

    name = sanitize_string(data.get('name', ''), 150)
    email = sanitize_string(data.get('email', ''), 150)
    mobile = sanitize_string(data.get('mobile', ''), 15)
    password = data.get('password', '')

    valid, msg = validate_name(name)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_email(email)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_mobile(mobile)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_password(password)
    if not valid:
        return jsonify({"error": msg}), 400

    # One-per-role enforcement: check by user_id prefix
    prefix = admin_role.upper() + '-'
    existing = User.query.filter(
        User.user_id.like(f'{prefix}%'),
        User.is_active == True,
    ).first()
    if existing:
        return jsonify({"error": f"A {admin_role.capitalize()} account already exists. Only one is allowed."}), 409

    new_user_id = f"{admin_role.upper()}-001"
    user_college = 'Gandhi' if admin_role == 'principal' else None

    user = User(
        user_id=new_user_id,
        name=name,
        role='admin',
	    college=user_college,
        email=email,
        mobile=mobile,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    logger.info(f"Management admin registered: {new_user_id} ({name})")

    return jsonify({
        "success": True,
        "message": f"{admin_role.capitalize()} account created successfully.",
        "userId": new_user_id,
    }), 201
@auth_bp.route('/dev-login', methods=['POST'])
@limiter.limit("5 per minute")
def dev_login():
    """
    Developer dual-role login.
    Credentials stored in DEV_USER_ID and DEV_PASSWORD env vars.
    Can log in as 'admin' or 'hod' role.
    """
    import os
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    user_id = data.get('user_id', '')
    password = data.get('password', '')
    role = sanitize_string(data.get('role', 'admin'), 20)

    expected_id = os.environ.get('DEV_USER_ID', '')
    expected_pw = os.environ.get('DEV_PASSWORD', '')

    if not expected_id or not expected_pw:
        return jsonify({"error": "Developer account not configured"}), 503

    if user_id != expected_id or password != expected_pw:
        return jsonify({"error": "Invalid credentials"}), 401

    if role not in ('admin', 'hod'):
        return jsonify({"error": "Role must be admin or hod"}), 400

    # Build a synthetic user object — not stored in DB
    dev_user = {
        'id': 0,
        'userId': expected_id,
        'name': 'Developer',
        'role': role,
        'adminTitle': 'Developer',
        'college': '',
        'department': '',
        'username': 'Developer',
        'email': '',
        'isActive': True,
        'createdAt': None,
    }

    access_token = create_access_token(identity=f'__DEV__:{role}')
    refresh_token = create_refresh_token(identity=f'__DEV__:{role}')

    logger.info(f"Developer logged in as {role}")

    response = make_response(jsonify({
        "success": True,
        "access_token": access_token,
        "user": dev_user,
    }))
    set_refresh_cookies(response, refresh_token)
    return response, 200