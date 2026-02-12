from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import db, User, OTP
from utils.validators import validate_email_format, validate_mobile_format, validate_password_strength
from utils.security import generate_secure_otp, generate_reset_token, verify_reset_token
from utils.email_service import send_otp_email
from utils.sms_service import send_otp_sms
from datetime import datetime, timedelta
import secrets
import string
import hashlib
import logging

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# Rate limit storage for login attempts (should use Redis in production)
login_attempts = {}

def check_login_attempts(user_id):
    """Check if user has exceeded login attempts"""
    max_attempts = current_app.config.get('MAX_LOGIN_ATTEMPTS', 5)
    lockout_duration = current_app.config.get('LOGIN_LOCKOUT_DURATION', timedelta(minutes=15))
    
    if user_id in login_attempts:
        attempts, lockout_time = login_attempts[user_id]
        
        if lockout_time and datetime.utcnow() < lockout_time:
            remaining = (lockout_time - datetime.utcnow()).seconds // 60
            return False, f"Account locked. Try again in {remaining} minutes."
        
        if lockout_time and datetime.utcnow() >= lockout_time:
            # Reset after lockout period
            login_attempts[user_id] = (0, None)
    
    return True, None

def record_failed_login(user_id):
    """Record a failed login attempt"""
    max_attempts = current_app.config.get('MAX_LOGIN_ATTEMPTS', 5)
    lockout_duration = current_app.config.get('LOGIN_LOCKOUT_DURATION', timedelta(minutes=15))
    
    if user_id not in login_attempts:
        login_attempts[user_id] = (1, None)
    else:
        attempts, _ = login_attempts[user_id]
        attempts += 1
        
        if attempts >= max_attempts:
            lockout_time = datetime.utcnow() + lockout_duration
            login_attempts[user_id] = (attempts, lockout_time)
            logger.warning(f"Account locked due to failed login attempts: {user_id}")
        else:
            login_attempts[user_id] = (attempts, None)

def clear_login_attempts(user_id):
    """Clear login attempts after successful login"""
    if user_id in login_attempts:
        del login_attempts[user_id]


@auth_bp.route('/register', methods=['POST'])
def register():
    """Generate User ID for new registration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required = ['name', 'email', 'mobile', 'college', 'department']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate email
        valid, msg = validate_email_format(data['email'])
        if not valid:
            return jsonify({'error': msg}), 400
        
        # Validate mobile
        valid, msg = validate_mobile_format(data['mobile'])
        if not valid:
            return jsonify({'error': msg}), 400
        
        # Check if email exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Check if mobile exists
        if User.query.filter_by(mobile=data['mobile']).first():
            return jsonify({'error': 'Mobile number already registered'}), 400
        
        # Generate secure User ID using secrets module
        dept_code = data['department'][:4].upper()
        college_code = 'G' if data['college'] == 'Gandhi' else 'P'
        random_part = secrets.token_hex(4).upper()
        user_id = f"{dept_code}-{college_code}_{random_part}"
        
        # Ensure uniqueness
        while User.query.filter_by(user_id=user_id).first():
            random_part = secrets.token_hex(4).upper()
            user_id = f"{dept_code}-{college_code}_{random_part}"
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'message': 'User ID generated successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500


@auth_bp.route('/create-account', methods=['POST'])
def create_account():
    """Create user account with password"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required = ['user_id', 'name', 'email', 'mobile', 'college', 'department', 'password']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate password strength
        valid, msg = validate_password_strength(data['password'])
        if not valid:
            return jsonify({'error': msg}), 400
        
        # Check if user_id exists
        if User.query.filter_by(user_id=data['user_id']).first():
            return jsonify({'error': 'User ID already exists'}), 400
        
        # Check email and mobile uniqueness again
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        if User.query.filter_by(mobile=data['mobile']).first():
            return jsonify({'error': 'Mobile number already registered'}), 400
        
        # Create new user - NEVER allow role from user input
        new_user = User(
            user_id=data['user_id'],
            name=data['name'],
            email=data['email'],
            mobile=data['mobile'],
            college=data['college'],
            department=data['department'],
            role='hod'  # Always default to 'hod', admin created separately
        )
        new_user.set_password(data['password'])
        
        db.session.add(new_user)
        db.session.commit()
        
        logger.info(f"New account created: {data['user_id']}")
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'user_id': data['user_id']
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Account creation error: {str(e)}")
        return jsonify({'error': 'Account creation failed. Please try again.'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login with brute force protection"""
    try:
        data = request.get_json()
        
        if not data.get('user_id') or not data.get('password'):
            return jsonify({'error': 'User ID and password are required'}), 400
        
        user_id = data['user_id']
        
        # Check login attempts
        allowed, message = check_login_attempts(user_id)
        if not allowed:
            return jsonify({'error': message}), 429
        
        # For HoD login, validate college and department
        if data.get('role') == 'hod':
            if not data.get('college') or not data.get('department'):
                return jsonify({'error': 'College and department are required for HoD login'}), 400
        
        # Find user
        user = User.query.filter_by(user_id=user_id).first()
        
        if not user or not user.is_active:
            record_failed_login(user_id)
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not user.check_password(data['password']):
            record_failed_login(user_id)
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # For HoD, verify college and department
        if user.role == 'hod':
            if user.college != data.get('college') or user.department != data.get('department'):
                record_failed_login(user_id)
                return jsonify({'error': 'Invalid credentials for selected college/department'}), 401
        
        # Successful login - clear attempts
        clear_login_attempts(user_id)
        
        # Generate JWT tokens
        access_token = create_access_token(identity=user.user_id)
        refresh_token = create_refresh_token(identity=user.user_id)
        
        logger.info(f"Successful login: {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Refresh access token"""
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            'success': True,
            'access_token': access_token
        }), 200
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({'error': 'Token refresh failed'}), 500


@auth_bp.route('/verify-user', methods=['POST'])
def verify_user():
    """Verify if user exists for password reset"""
    try:
        data = request.get_json()
        
        if not data.get('user_id'):
            return jsonify({'error': 'User ID is required'}), 400
        
        user = User.query.filter_by(user_id=data['user_id']).first()
        
        if not user:
            # Don't reveal if user exists or not for security
            return jsonify({'error': 'If this user exists, verification details will be sent.'}), 200
        
        return jsonify({
            'success': True,
            'message': 'User verified',
            'user': {
                'user_id': user.user_id,
                'name': user.name,
                'email': user.email[:3] + '***' + user.email.split('@')[0][-1] + '@' + user.email.split('@')[1][:2] + '***',
                'mobile': user.mobile[:2] + '******' + user.mobile[-2:]
            }
        }), 200
        
    except Exception as e:
        logger.error(f"User verification error: {str(e)}")
        return jsonify({'error': 'Verification failed'}), 500


# OTP attempt tracking
otp_attempts = {}

@auth_bp.route('/forgot-password/send-otp', methods=['POST'])
def send_forgot_password_otp():
    """Send OTP for password reset"""
    try:
        data = request.get_json()
        
        if not all([data.get('user_id'), data.get('email'), data.get('mobile')]):
            return jsonify({'error': 'User ID, email, and mobile are required'}), 400
        
        # Find and verify user
        user = User.query.filter_by(
            user_id=data['user_id'],
            email=data['email'],
            mobile=data['mobile']
        ).first()
        
        if not user:
            # Don't reveal if user exists for security
            return jsonify({
                'success': True,
                'message': 'If the details are correct, OTP will be sent.'
            }), 200
        
        # Invalidate any existing unused OTPs
        OTP.query.filter_by(user_id=user.user_id, is_used=False).update({'is_used': True})
        
        # Generate secure OTP
        otp_code = generate_secure_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=current_app.config.get('OTP_EXPIRY_MINUTES', 10))
        
        # Hash OTP before storing
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        
        # Save OTP
        new_otp = OTP(
            user_id=user.user_id,
            email=user.email,
            mobile=user.mobile,
            otp_code=otp_hash,  # Store hashed OTP
            expires_at=expires_at
        )
        
        db.session.add(new_otp)
        db.session.commit()
        
        # Reset OTP attempts for this user
        otp_attempts[user.user_id] = 0
        
        # Send OTP via email and SMS
        email_sent = send_otp_email(user.email, otp_code, user.name)
        sms_sent = send_otp_sms(user.mobile, otp_code)
        
        logger.info(f"OTP sent for password reset: {user.user_id}")
        
        return jsonify({
            'success': True,
            'message': 'OTP sent successfully to registered email and mobile.',
            'email_sent': email_sent,
            'sms_sent': sms_sent
            # REMOVED: 'otp': otp_code - NEVER return OTP in response
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"OTP send error: {str(e)}")
        return jsonify({'error': 'Failed to send OTP. Please try again.'}), 500


@auth_bp.route('/forgot-password/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP with attempt limiting"""
    try:
        data = request.get_json()
        
        if not all([data.get('user_id'), data.get('otp')]):
            return jsonify({'error': 'User ID and OTP are required'}), 400
        
        user_id = data['user_id']
        max_attempts = current_app.config.get('OTP_MAX_ATTEMPTS', 3)
        
        # Check OTP attempts
        if user_id in otp_attempts and otp_attempts[user_id] >= max_attempts:
            # Invalidate all OTPs for this user
            OTP.query.filter_by(user_id=user_id, is_used=False).update({'is_used': True})
            db.session.commit()
            return jsonify({'error': 'Maximum OTP attempts exceeded. Please request a new OTP.'}), 429
        
        # Hash the provided OTP for comparison
        otp_hash = hashlib.sha256(data['otp'].encode()).hexdigest()
        
        otp_record = OTP.query.filter_by(
            user_id=user_id,
            otp_code=otp_hash,
            is_used=False
        ).first()
        
        if not otp_record:
            # Increment attempt counter
            otp_attempts[user_id] = otp_attempts.get(user_id, 0) + 1
            remaining = max_attempts - otp_attempts[user_id]
            return jsonify({
                'error': f'Invalid OTP. {remaining} attempts remaining.'
            }), 400
        
        if datetime.utcnow() > otp_record.expires_at:
            return jsonify({'error': 'OTP has expired. Please request a new one.'}), 400
        
        # Mark as used
        otp_record.is_used = True
        db.session.commit()
        
        # Generate password reset token
        reset_token = generate_reset_token(user_id)
        
        # Clear OTP attempts
        if user_id in otp_attempts:
            del otp_attempts[user_id]
        
        logger.info(f"OTP verified successfully: {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'OTP verified successfully',
            'reset_token': reset_token
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"OTP verification error: {str(e)}")
        return jsonify({'error': 'Verification failed'}), 500


@auth_bp.route('/forgot-password/reset', methods=['POST'])
def reset_password():
    """Reset password with token verification"""
    try:
        data = request.get_json()
        
        if not all([data.get('user_id'), data.get('new_password'), data.get('reset_token')]):
            return jsonify({'error': 'User ID, new password, and reset token are required'}), 400
        
        # Verify reset token
        if not verify_reset_token(data['user_id'], data['reset_token']):
            return jsonify({'error': 'Invalid or expired reset token'}), 400
        
        # Validate password
        valid, msg = validate_password_strength(data['new_password'])
        if not valid:
            return jsonify({'error': msg}), 400
        
        user = User.query.filter_by(user_id=data['user_id']).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update password
        user.set_password(data['new_password'])
        user.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Password reset successfully: {data['user_id']}")
        
        return jsonify({
            'success': True,
            'message': 'Password reset successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Password reset error: {str(e)}")
        return jsonify({'error': 'Password reset failed'}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    """Get current user information"""
    try:
        user_id = get_jwt_identity()
        user = User.query.filter_by(user_id=user_id).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Get user info error: {str(e)}")
        return jsonify({'error': 'Failed to get user info'}), 500