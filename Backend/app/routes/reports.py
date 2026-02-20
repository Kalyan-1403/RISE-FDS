from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..models.faculty import Faculty
from ..models.feedback import FeedbackRating
from ..utils.helpers import get_current_user

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/faculty/<int:faculty_id>/data', methods=['GET'])
@jwt_required()
def get_faculty_report_data(faculty_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

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

    return jsonify({
        "faculty": faculty.to_dict(),
        "ratings": raw_data,
        "totalRatings": len(ratings),
    }), 200