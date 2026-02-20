from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models.batch import Batch
from ..models.feedback import FeedbackSubmission, FeedbackRating
from ..models.faculty import Faculty
from ..utils.validators import validate_rating, sanitize_string

feedback_bp = Blueprint('feedback', __name__)

PARAMETERS = [
    'Knowledge of the subject', 'Coming well prepared for the class',
    'Giving clear explanations', 'Command of language', 'Clear and audible voice',
    'Holding the attention of students through the class',
    'Providing more matter than in the textbooks',
    'Capability to clear the doubts of students',
    'Encouraging students to ask questions and participate',
    'Appreciating students as and when deserving',
    'Willingness to help students even out of the class',
    'Return of valued test papers/records in time',
    'Punctuality and following timetable schedule',
    'Coverage of syllabus', 'Impartial (teaching all students alike)',
]


@feedback_bp.route('/submit', methods=['POST'])
def submit_feedback():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    batch_id_str = data.get('batchId', '')
    responses = data.get('responses', [])
    comments = sanitize_string(data.get('comments', ''), 2000)

    if not batch_id_str or not responses:
        return jsonify({"error": "Batch ID and responses are required"}), 400

    batch = Batch.query.filter_by(batch_id=batch_id_str, is_active=True).first()
    if not batch:
        return jsonify({"error": "Invalid batch"}), 404

    # Create submission
    submission = FeedbackSubmission(
        batch_db_id=batch.id,
        slot=batch.slot,
        comments=comments,
        ip_address=request.remote_addr,
    )
    db.session.add(submission)
    db.session.flush()

    # Process each faculty's ratings
    for resp in responses:
        faculty_id = resp.get('facultyId')
        ratings = resp.get('ratings', {})

        faculty = Faculty.query.get(faculty_id)
        if not faculty:
            continue

        for param, rating_value in ratings.items():
            if param not in PARAMETERS:
                continue
            valid, msg = validate_rating(rating_value)
            if not valid:
                continue

            fr = FeedbackRating(
                submission_id=submission.id,
                faculty_id=faculty.id,
                parameter=param,
                rating=int(rating_value),
            )
            db.session.add(fr)

    db.session.commit()

    return jsonify({"success": True, "message": "Feedback submitted successfully"}), 201


@feedback_bp.route('/faculty/<int:faculty_id>/stats', methods=['GET'])
def get_faculty_stats(faculty_id):
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({"error": "Faculty not found"}), 404

    ratings = FeedbackRating.query.filter_by(faculty_id=faculty_id).all()
    if not ratings:
        return jsonify({"stats": None, "message": "No feedback data"}), 200

    # Group by slot via submission
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
            'responseCount': len(set(r.submission_id for r in ratings if r.submission and r.submission.slot == slot)),
        }

    total_submissions = len(set(r.submission_id for r in ratings))

    return jsonify({
        "stats": {
            "totalResponses": total_submissions,
            "hasSlot1": 'slot1' in result,
            "hasSlot2": 'slot2' in result,
            **result,
        }
    }), 200