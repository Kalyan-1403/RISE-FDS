from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from ..extensions import db, limiter
from ..models.user import User
from ..utils.validators import sanitize_string, validate_name, validate_email, validate_mobile, validate_password

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
        User.is_active == True
    ).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.role != role:
        return jsonify({"error": f"This account is not registered as {role}"}), 401

    # For HoD, verify college and department match
    if role == 'hod':
        college = sanitize_string(data.get('college', ''), 100)
        department = sanitize_string(data.get('department', ''), 50)
        if user.college != college or user.department != department:
            return jsonify({"error": "College or department mismatch"}), 401

    access_token = create_access_token(identity=user.user_id)
    refresh_token = create_refresh_token(identity=user.user_id)

    return jsonify({
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    }), 200


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
    user_id = sanitize_string(data.get('user_id', ''), 50)

    # Validate all fields
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

    # Check duplicate: one HoD per college+department
    existing = User.query.filter_by(
        college=college,
        department=department,
        role='hod',
        is_active=True
    ).first()
    if existing:
        return jsonify({"error": f"An HoD for {college} - {department} already exists. Only one HoD per department is allowed."}), 409

    # Check duplicate user_id
    if User.query.filter(db.func.lower(User.user_id) == user_id.lower()).first():
        return jsonify({"error": "User ID already exists"}), 409

    user = User(
        user_id=user_id,
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

    return jsonify({
        "success": True,
        "message": "Account created successfully",
        "userId": user.user_id,
    }), 201


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
    new_token = create_access_token(identity=user_id)
    return jsonify({"access_token": new_token}), 200