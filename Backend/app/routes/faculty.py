from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.faculty import Faculty
from ..utils.helpers import role_required, get_current_user
from ..utils.validators import sanitize_string, validate_name, validate_subject, validate_code

faculty_bp = Blueprint('faculty', __name__)


@faculty_bp.route('', methods=['GET'])
@jwt_required()
def get_faculty():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.role == 'admin':
        faculty = Faculty.query.filter_by(is_active=True).all()
    else:
        faculty = Faculty.query.filter_by(
            college=user.college,
            department=user.department,
            is_active=True
        ).all()

    return jsonify({"faculty": [f.to_dict() for f in faculty]}), 200


@faculty_bp.route('', methods=['POST'])
@jwt_required()
def create_faculty():
    user = get_current_user()
    if not user or user.role not in ('hod', 'admin'):
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    code = sanitize_string(data.get('code', ''), 30).upper()
    name = sanitize_string(data.get('name', ''), 150)
    subject = sanitize_string(data.get('subject', ''), 200)
    year = sanitize_string(data.get('year', ''), 10)
    semester = sanitize_string(data.get('sem', data.get('semester', '')), 10)
    section = sanitize_string(data.get('sec', data.get('section', '')), 20)
    branch = sanitize_string(data.get('branch', user.department), 50)
    college = data.get('college', user.college)
    department = data.get('dept', data.get('department', user.department))

    valid, msg = validate_code(code)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_name(name)
    if not valid:
        return jsonify({"error": msg}), 400

    valid, msg = validate_subject(subject)
    if not valid:
        return jsonify({"error": msg}), 400

    if not year or not semester or not section:
        return jsonify({"error": "Year, semester, and section are required"}), 400

    faculty = Faculty(
        code=code, name=name, subject=subject,
        year=year, semester=semester, section=section,
        branch=branch, department=department, college=college,
        added_by=user.id,
    )

    db.session.add(faculty)
    db.session.commit()

    return jsonify({"success": True, "faculty": faculty.to_dict()}), 201


@faculty_bp.route('/<int:faculty_id>', methods=['PUT'])
@jwt_required()
def update_faculty(faculty_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Cannot edit faculty from another department"}), 403

    data = request.get_json()

    if 'name' in data:
        name = sanitize_string(data['name'], 150)
        valid, msg = validate_name(name)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.name = name

    if 'subject' in data:
        subject = sanitize_string(data['subject'], 200)
        valid, msg = validate_subject(subject)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.subject = subject

    if 'code' in data:
        code = sanitize_string(data['code'], 30).upper()
        valid, msg = validate_code(code)
        if not valid:
            return jsonify({"error": msg}), 400
        faculty.code = code

    db.session.commit()
    return jsonify({"success": True, "faculty": faculty.to_dict()}), 200


@faculty_bp.route('/<int:faculty_id>', methods=['DELETE'])
@jwt_required()
def delete_faculty(faculty_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Cannot delete faculty from another department"}), 403

    faculty.is_active = False
    db.session.commit()
    return jsonify({"success": True, "message": "Faculty deactivated"}), 200