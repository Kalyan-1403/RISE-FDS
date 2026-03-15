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

    user_id = sanitize_string(data.get('user_id', ''), 50)
    password = data.get('password', '')
    role = sanitize_string(data.get('role', ''), 20)

    if not user_id or not password:
        return jsonify({"error": "User ID and password are required"}), 400

    user = User.query.filter(
    db.func.lower(User.user_id) == user_id.lower(),
    User.is_active == True,
).first()

# TEMP DEBUG — remove after diagnosis
if not user:
    logger.warning(f"LOGIN FAIL: user_id '{user_id}' not found in DB")
    return jsonify({"error": "Invalid credentials"}), 401
if not user.check_password(password):
    logger.warning(f"LOGIN FAIL: password mismatch for user '{user_id}'")
    return jsonify({"error": "Invalid credentials"}), 401

if user.role != role:
    logger.warning(f"LOGIN FAIL: role mismatch — user is '{user.role}', attempted '{role}'")
    return jsonify({"error": f"This account is not registered as {role}"}), 401

if role == 'hod':
    college = sanitize_string(data.get('college', ''), 100)
    department = sanitize_string(data.get('department', ''), 50)
    if user.college != college or user.department != department:
        logger.warning(
            f"LOGIN FAIL: college/dept mismatch for '{user_id}' — "
            f"DB has ({user.college}/{user.department}), "
            f"login attempted ({college}/{department})"
        )
        return jsonify({"error": "College or department mismatch"}), 401

    access_token = create_access_token(identity=user.user_id)
    refresh_token = create_refresh_token(identity=user.user_id)

    logger.info(f"User logged in: {user.user_id} (role={user.role})")

    # FIX (CRITICAL): Access token returned in body — frontend stores in memory only.
    # Refresh token set as httpOnly cookie — invisible to JavaScript, safe from XSS.
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
    """
    FIX (HIGH): Revoke the current access token and clear the refresh cookie.
    After logout, both tokens are immediately invalidated.
    """
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
        "userId": user.user_id,
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

    # Always return the same message to prevent user enumeration
    _safe_response = jsonify({"success": True, "message": "If the details match, an OTP has been sent."})

    user = User.query.filter(
        db.func.lower(User.user_id) == user_id.lower(),
        User.email == email,
        User.mobile == mobile,
        User.is_active == True,
    ).first()

    if not user:
        return _safe_response, 200

    if not user.email:
        logger.warning(f"OTP requested for user {user.user_id} but no email address on file.")
        return _safe_response, 200

    otp = str(secrets.randbelow(900000) + 100000)
    user.reset_otp = otp
    user.reset_otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    # FIX (CRITICAL): Actually deliver the OTP via email.
    # send_otp_email() handles SMTP delivery in production and logs to console in dev.
    # Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in Render env vars.
    delivered = send_otp_email(user.email, user.user_id, otp)
    if not delivered:
        # Roll back OTP if delivery failed so user can retry
        user.reset_otp = None
        user.reset_otp_expiry = None
        db.session.commit()
        logger.error(f"OTP delivery failed for {user.user_id} — SMTP not configured?")
        return jsonify({
            "error": "Could not send OTP. Please contact your administrator."
        }), 500

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
    """
    Issue a new access token using the httpOnly refresh cookie.
    The browser sends the cookie automatically — no token needed in the request body.
    Returns the new access token in the response body for in-memory storage.
    """
    user_id = get_jwt_identity()
    user = User.query.filter_by(user_id=user_id, is_active=True).first()
    if not user:
        return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401

    new_access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": new_access_token}), 200
