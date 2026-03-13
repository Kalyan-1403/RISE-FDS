import logging
from flask import Blueprint, jsonify, g
from ..models.faculty import Faculty
from ..models.feedback import FeedbackRating
from ..middleware.auth_middleware import require_auth

logger = logging.getLogger(__name__)

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/faculty/<int:faculty_id>/data', methods=['GET'])
@require_auth
def get_faculty_report_data(faculty_id):
    """Get raw feedback data for a faculty member. HoDs scoped to their department."""
    user = g.current_user

    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    if not faculty.is_active:
        return jsonify({"error": "Faculty is no longer active"}), 404

    # Security: HoDs can only view reports for their own department
    if user.role == 'hod' and (faculty.college != user.college or faculty.department != user.department):
        return jsonify({"error": "Access denied"}), 403

    ratings = FeedbackRating.query.filter_by(faculty_id=faculty_id).all()

    raw_data = []
    for r in ratings:
        raw_data.append({
            'parameter': r.parameter,
            'rating': r.rating,
            'slot': r.submission.slot if r.submission else 1,
            'submittedAt': r.submission.submitted_at.isoformat() if r.submission else None,
            'comments': r.submission.comments if r.submission else None,
        })

    logger.info(f"Report generated for faculty {faculty_id} by {user.user_id}")

    return jsonify({"data": raw_data}), 200