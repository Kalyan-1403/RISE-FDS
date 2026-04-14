import logging
from flask import Blueprint, request, jsonify, g
from ..extensions import db
from ..models.faculty import Faculty
from ..middleware.auth_middleware import require_role, require_auth
from ..utils.validators import sanitize_string, validate_name, validate_subject, validate_code

logger = logging.getLogger(__name__)

# CRITICAL FIX: Was previously 'feedback' which collided with feedback.py
faculty_bp = Blueprint('faculty', __name__)


@faculty_bp.route('', methods=['GET'])
@require_auth
def get_all_faculty():
    """Get all faculty — Admins see all, HoDs see their department only."""
    user = g.current_user

    if user.role == 'admin':
        faculty_list = Faculty.query.filter_by(is_active=True).all()
    else:
        faculty_list = Faculty.query.filter_by(
            college=user.college,
            department=user.department,
            is_active=True,
        ).all()

    return jsonify({"faculty": [f.to_dict() for f in faculty_list]}), 200


@faculty_bp.route('/<int:faculty_id>', methods=['GET'])
@require_auth
def get_faculty_by_id(faculty_id):
    """Get a single faculty member by ID."""
    user = g.current_user
    faculty = Faculty.query.get(faculty_id)

    if not faculty or not faculty.is_active:
        return jsonify({"error": "Faculty not found"}), 404

    # HoDs can only view their own department's faculty
    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Access denied"}), 403

    return jsonify({"faculty": faculty.to_dict()}), 200


@faculty_bp.route('', methods=['POST'])
@require_role(['hod', 'admin'])
def create_faculty():
    """Create a new faculty member."""
    user = g.current_user
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    name = sanitize_string(data.get('name', ''), 150)
    code = sanitize_string(data.get('code', ''), 20)
    subject = sanitize_string(data.get('subject', ''), 200)
    year = sanitize_string(data.get('year', ''), 10)
    sem = sanitize_string(data.get('sem', data.get('semester', '')), 10)
    sec = sanitize_string(data.get('sec', data.get('section', '')), 20)
    branch = sanitize_string(data.get('branch', ''), 50)

    # Validate inputs
    valid, msg = validate_name(name)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_code(code)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_subject(subject)
    if not valid:
        return jsonify({"error": msg}), 400

    # Determine college/dept
    if user.role == 'hod':
        college = user.college
        department = user.department
    else:
        college = sanitize_string(data.get('college', ''), 100)
        department = sanitize_string(data.get('dept', data.get('department', '')), 50)

    if not college or not department:
        return jsonify({"error": "College and department are required"}), 400

    faculty = Faculty(
        code=code.upper(),
        name=name,
        subject=subject,
        year=year,
        semester=sem,
        section=sec,
        branch=branch or department,
        college=college,
        department=department,
    )
    db.session.add(faculty)
    db.session.commit()

    logger.info(f"Faculty created: {faculty.code} by {user.user_id}")

    return jsonify({"success": True, "faculty": faculty.to_dict()}), 201


@faculty_bp.route('/<int:faculty_id>', methods=['PUT'])
@require_role(['hod', 'admin'])
def update_faculty(faculty_id):
    """Update an existing faculty member."""
    user = g.current_user
    faculty = Faculty.query.get(faculty_id)

    if not faculty or not faculty.is_active:
        return jsonify({"error": "Faculty not found"}), 404

    # HoDs can only edit their own department's faculty
    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    if 'name' in data:
        name = sanitize_string(data['name'], 150)
        valid, msg = validate_name(name)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.name = name

    if 'code' in data:
        code = sanitize_string(data['code'], 20)
        valid, msg = validate_code(code)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.code = code.upper()

    if 'subject' in data:
        subject = sanitize_string(data['subject'], 200)
        valid, msg = validate_subject(subject)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.subject = subject

    if 'year' in data:
        faculty.year = sanitize_string(data['year'], 10)
    if 'sem' in data or 'semester' in data:
        faculty.semester = sanitize_string(data.get('sem', data.get('semester', '')), 10)
    if 'sec' in data or 'section' in data:
        faculty.section = sanitize_string(data.get('sec', data.get('section', '')), 20)
    if 'branch' in data:
        faculty.branch = sanitize_string(data['branch'], 50)

    db.session.commit()

    logger.info(f"Faculty updated: {faculty.code} by {user.user_id}")

    return jsonify({"success": True, "faculty": faculty.to_dict()}), 200


@faculty_bp.route('/<int:faculty_id>', methods=['DELETE'])
@require_role(['hod', 'admin'])
def delete_faculty(faculty_id):
    """Soft-delete a faculty member."""
    user = g.current_user
    faculty = Faculty.query.get(faculty_id)

    if not faculty or not faculty.is_active:
        return jsonify({"error": "Faculty not found"}), 404

    # HoDs can only delete their own department's faculty
    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Access denied"}), 403

    faculty.is_active = False
    db.session.commit()

    logger.info(f"Faculty soft-deleted: {faculty.code} by {user.user_id}")

    return jsonify({"success": True, "message": f"Faculty {faculty.name} deleted successfully"}), 200