from flask import Blueprint, request, jsonify, g
from ..extensions import db
from ..models.batch import Batch
from ..models.feedback import FeedbackSubmission, FeedbackRating
from ..models.faculty import Faculty
from ..middleware.auth_middleware import require_role
from ..utils.validators import validate_rating, sanitize_string

feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/submit', methods=['POST'])
def submit_feedback():
    # PUBLIC ROUTE: Students submit feedback here
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    batch_id_str = data.get('batchId', '')
    responses = data.get('responses', [])
    comments = sanitize_string(data.get('comments', ''), 2000)

    if not batch_id_str or not responses:
        return jsonify({"error": "Batch ID and responses are required"}), 400

    batch = Batch.query.filter_by(batch_id=batch_id_str).first()
    if not batch:
        return jsonify({"error": "Invalid Batch ID"}), 404
    
    # Create the submission record
    submission = FeedbackSubmission(
        batch_db_id=batch.id,
        slot=batch.slot,
        comments=comments,
        ip_address=request.remote_addr
    )
    db.session.add(submission)
    db.session.flush() # Flush to get submission.id for the ratings

    # Process ratings
    for resp in responses:
        faculty_id = resp.get('facultyId')
        ratings_dict = resp.get('ratings', {})

        if not faculty_id:
            continue

        for parameter, rating_val in ratings_dict.items():
            # Validate range 1-10
            if not validate_rating(rating_val):
                continue
            
            rating_entry = FeedbackRating(
                submission_id=submission.id,
                faculty_id=faculty_id,
                parameter=sanitize_string(parameter, 200),
                rating=int(rating_val)
            )
            db.session.add(rating_entry)

    db.session.commit()
    return jsonify({"success": True, "message": "Feedback submitted successfully"}), 201


@feedback_bp.route('/faculty/<int:faculty_id>/stats', methods=['GET'])
@require_role(['hod', 'admin'])
def get_faculty_stats(faculty_id):
    # SECURED: Only Admins/HoDs can see the aggregated stats
    ratings = FeedbackRating.query.filter_by(faculty_id=faculty_id).all()
    
    if not ratings:
        return jsonify({"stats": None}), 200

    # Aggregate data by slot
    slot_data = {}
    for r in ratings:
        slot = r.submission.slot if r.submission else 1
        if slot not in slot_data:
            slot_data[slot] = {}
        if r.parameter not in slot_data[slot]:
            slot_data[slot][r.parameter] = []
        slot_data[slot][r.parameter].append(r.rating)

    result = {}
    for slot, params in slot_data.items():
        param_stats = {}
        all_ratings = []
        for param, vals in params.items():
            avg = sum(vals) / len(vals)
            param_stats[param] = {
                'average': round(avg, 2),
                'percentage': round((avg / 10) * 100, 1),
                'totalRatings': len(vals),
            }
            all_ratings.extend(vals)

        overall = sum(all_ratings) / len(all_ratings) if all_ratings else 0
        dist = {}
        for i in range(1, 11):
            dist[str(i)] = 0
        for r in all_ratings:
            dist[str(r)] = dist.get(str(r), 0) + 1

        result[f'slot{slot}'] = {
            'parameterStats': param_stats,
            'overallAverage': round(overall, 2),
            'ratingDistribution': dist,
            'responseCount': len(set(r.submission_id for r in ratings if r.submission and r.submission.slot == slot))
        }

    return jsonify({"stats": result}), 200