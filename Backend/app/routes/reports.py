import logging
from flask import Blueprint, jsonify, g
from ..extensions import db
from ..models.feedback import FeedbackSubmission
from ..middleware.auth_middleware import require_auth

logger = logging.getLogger(__name__)
reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/faculty/<faculty_id>/data', methods=['GET'])
@require_auth
def get_faculty_report_data(faculty_id):
    """Extract raw data from the embedded NoSQL arrays for CSV export."""
    query = db.collection(FeedbackSubmission.COLLECTION).where(f'ratings.{faculty_id}', '!=', None)
    submissions = query.stream()

    raw_data = []
    for sub in submissions:
        data = sub.to_dict()
        fac_ratings = data.get('ratings', {}).get(faculty_id, {})
        
        for param, rating in fac_ratings.items():
            raw_data.append({
                'parameter': param,
                'rating': rating,
                'slot': data.get('slot', 1),
                'submittedAt': data.get('submitted_at').isoformat() if data.get('submitted_at') else None,
                'comments': data.get('comments', '')
            })

    return jsonify({"data": raw_data}), 200