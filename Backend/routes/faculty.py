from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Faculty, User
from utils.decorators import role_required, get_current_user
from datetime import datetime

faculty_bp = Blueprint('faculty', __name__)

@faculty_bp.route('', methods=['POST'])
@jwt_required()
@role_required('hod', 'admin')
def add_faculty():
    """Add new faculty member"""
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # Validate required fields
        required = ['name', 'subject', 'code', 'year', 'branch', 'semester', 'section']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Use HoD's college and department
        college = current_user.college
        department = current_user.department
        
        # Check if faculty with same code already exists in same context
        existing = Faculty.query.filter_by(
            code=data['code'].upper().strip(),
            college=college,
            department=department,
            year=data['year'],
            semester=data['semester'],
            section=data['section']
        ).first()
        
        if existing:
            return jsonify({'error': 'Faculty with this code already exists for this class'}), 400
        
        # Create new faculty
        new_faculty = Faculty(
            name=data['name'].strip(),
            subject=data['subject'].strip(),
            code=data['code'].upper().strip(),
            year=data['year'],
            branch=data['branch'],
            semester=data['semester'],
            section=data['section'],
            college=college,
            department=department,
            added_by=current_user.user_id
        )
        
        db.session.add(new_faculty)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Faculty added successfully',
            'faculty': new_faculty.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('', methods=['GET'])
@jwt_required()
def get_faculty_list():
    """Get faculty list for current user"""
    try:
        current_user = get_current_user()
        
        if current_user.role == 'admin':
            # Admin sees all faculty
            faculty_list = Faculty.query.all()
        else:
            # HoD sees only their department's faculty
            faculty_list = Faculty.query.filter_by(
                college=current_user.college,
                department=current_user.department
            ).all()
        
        return jsonify({
            'success': True,
            'count': len(faculty_list),
            'faculty': [f.to_dict() for f in faculty_list]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('/<int:faculty_id>', methods=['GET'])
@jwt_required()
def get_faculty_by_id(faculty_id):
    """Get specific faculty details"""
    try:
        current_user = get_current_user()
        faculty = Faculty.query.get(faculty_id)
        
        if not faculty:
            return jsonify({'error': 'Faculty not found'}), 404
        
        # Check access permissions
        if current_user.role == 'hod':
            if faculty.college != current_user.college or faculty.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'success': True,
            'faculty': faculty.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('/<int:faculty_id>', methods=['PUT'])
@jwt_required()
@role_required('hod', 'admin')
def update_faculty(faculty_id):
    """Update faculty details"""
    try:
        current_user = get_current_user()
        faculty = Faculty.query.get(faculty_id)
        
        if not faculty:
            return jsonify({'error': 'Faculty not found'}), 404
        
        # Check permissions
        if current_user.role == 'hod':
            if faculty.college != current_user.college or faculty.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        if data.get('name'):
            faculty.name = data['name'].strip()
        if data.get('subject'):
            faculty.subject = data['subject'].strip()
        if data.get('code'):
            faculty.code = data['code'].upper().strip()
        if data.get('year'):
            faculty.year = data['year']
        if data.get('branch'):
            faculty.branch = data['branch']
        if data.get('semester'):
            faculty.semester = data['semester']
        if data.get('section'):
            faculty.section = data['section']
        
        faculty.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Faculty updated successfully',
            'faculty': faculty.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('/<int:faculty_id>', methods=['DELETE'])
@jwt_required()
@role_required('hod', 'admin')
def delete_faculty(faculty_id):
    """Delete faculty member"""
    try:
        current_user = get_current_user()
        faculty = Faculty.query.get(faculty_id)
        
        if not faculty:
            return jsonify({'error': 'Faculty not found'}), 404
        
        # Check permissions
        if current_user.role == 'hod':
            if faculty.college != current_user.college or faculty.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(faculty)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Faculty deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('/by-branch/<branch>', methods=['GET'])
@jwt_required()
def get_faculty_by_branch(branch):
    """Get faculty list filtered by branch (for S&H department)"""
    try:
        current_user = get_current_user()
        
        faculty_list = Faculty.query.filter_by(
            college=current_user.college,
            department=current_user.department,
            branch=branch
        ).all()
        
        return jsonify({
            'success': True,
            'count': len(faculty_list),
            'faculty': [f.to_dict() for f in faculty_list]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@faculty_bp.route('/by-year/<year>', methods=['GET'])
@jwt_required()
def get_faculty_by_year(year):
    """Get faculty list filtered by year"""
    try:
        current_user = get_current_user()
        
        faculty_list = Faculty.query.filter_by(
            college=current_user.college,
            department=current_user.department,
            year=year
        ).all()
        
        return jsonify({
            'success': True,
            'count': len(faculty_list),
            'faculty': [f.to_dict() for f in faculty_list]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
