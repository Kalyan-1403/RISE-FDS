from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..models.faculty import Faculty
from ..models.feedback import FeedbackRating, FeedbackSubmission
from ..models.batch import Batch
from ..utils.helpers import get_current_user
from ..extensions import db

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/admin', methods=['GET'])
@jwt_required()
def admin_dashboard():
    user = get_current_user()
    if not user or user.role != 'admin':
        return jsonify({"error": "Admin access required"}), 403

    total_faculty = Faculty.query.filter_by(is_active=True).count()
    total_batches = Batch.query.filter_by(is_active=True).count()
    total_submissions = FeedbackSubmission.query.count()

    # Faculty grouped by college_department
    faculty_by_dept = {}
    all_faculty = Faculty.query.filter_by(is_active=True).all()
    for f in all_faculty:
        key = f"{f.college}_{f.department}"
        if key not in faculty_by_dept:
            faculty_by_dept[key] = []
        faculty_by_dept[key].append(f.to_dict())

    return jsonify({
        "totalFaculty": total_faculty,
        "totalBatches": total_batches,
        "totalSubmissions": total_submissions,
        "masterFacultyList": faculty_by_dept,
    }), 200


@dashboard_bp.route('/hod', methods=['GET'])
@jwt_required()
def hod_dashboard():
    user = get_current_user()
    if not user or user.role != 'hod':
        return jsonify({"error": "HoD access required"}), 403

    faculty = Faculty.query.filter_by(
        college=user.college,
        department=user.department,
        is_active=True
    ).all()

    batches = Batch.query.filter_by(
        college=user.college,
        department=user.department,
        is_active=True
    ).order_by(Batch.created_at.desc()).all()

    return jsonify({
        "faculty": [f.to_dict() for f in faculty],
        "batches": [b.to_dict() for b in batches],
        "college": user.college,
        "department": user.department,
    }), 200