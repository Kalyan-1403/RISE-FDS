from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, OTP
from utils.validators import validate_email_format, validate_mobile_format, validate_password_strength
from datetime import datetime, timedelta
import random
import string

auth_bp = Blueprint('auth', __name__)

def generate_otp():
    """Generate 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

def send_otp_email(email, otp):
    """Send OTP via email - TODO: Implement actual email service"""
    print(f"📧 Sending OTP {otp} to email {email}")
    return True

def send_otp_sms(mobile, otp):
    """Send OTP via SMS - TODO: Implement actual SMS service"""
    print(f"📱 Sending OTP {otp} to mobile {mobile}")
    return True

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
        
        # Generate User ID
        dept_code = data['department']
        college_code = 'G' if data['college'] == 'Gandhi' else 'P'
        random_num = random.randint(1, 999)
        user_id = f"{dept_code}-{college_code}_{random_num}"
        
        # Ensure uniqueness
        while User.query.filter_by(user_id=user_id).first():
            random_num = random.randint(1, 999)
            user_id = f"{dept_code}-{college_code}_{random_num}"
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'message': 'User ID generated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
        
        # Create new user
        new_user = User(
            user_id=data['user_id'],
            name=data['name'],
            email=data['email'],
            mobile=data['mobile'],
            college=data['college'],
            department=data['department'],
            role=data.get('role', 'hod')
        )
        new_user.set_password(data['password'])
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'user_id': data['user_id']
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = request.get_json()
        
        if not data.get('user_id') or not data.get('password'):
            return jsonify({'error': 'User ID and password are required'}), 400
        
        # For HoD login, validate college and department
        if data.get('role') == 'hod':
            if not data.get('college') or not data.get('department'):
                return jsonify({'error': 'College and department are required for HoD login'}), 400
        
        # Find user
        user = User.query.filter_by(user_id=data['user_id']).first()
        
        if not user or not user.is_active:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not user.check_password(data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # For HoD, verify college and department
        if user.role == 'hod':
            if user.college != data.get('college') or user.department != data.get('department'):
                return jsonify({'error': 'Invalid credentials for selected college/department'}), 401
        
        # Generate JWT token
        access_token = create_access_token(identity=user.user_id)
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify-user', methods=['POST'])
def verify_user():
    """Verify if user exists for password reset"""
    try:
        data = request.get_json()
        
        if not data.get('user_id'):
            return jsonify({'error': 'User ID is required'}), 400
        
        user = User.query.filter_by(user_id=data['user_id']).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'User verified',
            'user': {
                'user_id': user.user_id,
                'name': user.name,
                'email': user.email[:3] + '***' + user.email[-10:],  # Partially hide
                'mobile': user.mobile[:2] + '******' + user.mobile[-2:]  # Partially hide
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
            return jsonify({'error': 'Invalid user details'}), 404
        
        # Generate OTP
        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        # Save OTP
        new_otp = OTP(
            user_id=user.user_id,
            email=user.email,
            mobile=user.mobile,
            otp_code=otp_code,
            expires_at=expires_at
        )
        
        db.session.add(new_otp)
        db.session.commit()
        
        # Send OTP
        send_otp_email(user.email, otp_code)
        send_otp_sms(user.mobile, otp_code)
        
        return jsonify({
            'success': True,
            'message': 'OTP sent successfully',
            'otp': otp_code  # REMOVE THIS IN PRODUCTION
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/forgot-password/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP"""
    try:
        data = request.get_json()
        
        if not all([data.get('user_id'), data.get('otp')]):
            return jsonify({'error': 'User ID and OTP are required'}), 400
        
        otp_record = OTP.query.filter_by(
            user_id=data['user_id'],
            otp_code=data['otp'],
            is_used=False
        ).first()
        
        if not otp_record:
            return jsonify({'error': 'Invalid OTP'}), 400
        
        if datetime.utcnow() > otp_record.expires_at:
            return jsonify({'error': 'OTP has expired'}), 400
        
        # Mark as used
        otp_record.is_used = True
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'OTP verified successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/forgot-password/reset', methods=['POST'])
def reset_password():
    """Reset password"""
    try:
        data = request.get_json()
        
        if not all([data.get('user_id'), data.get('new_password')]):
            return jsonify({'error': 'User ID and new password are required'}), 400
        
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
        
        return jsonify({
            'success': True,
            'message': 'Password reset successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
        return jsonify({'error': str(e)}), 500
