import logging
import os
from flask import Blueprint, request, jsonify, g
from ..extensions import db, limiter
from ..models.batch import Batch
from ..models.feedback import (
    FeedbackSubmission,
    FeedbackRating,
)
from ..models.faculty import Faculty
from ..middleware.auth_middleware import (
    require_role,
)
from ..utils.validators import (
    validate_rating,
    sanitize_string,
)

logger = logging.getLogger(__name__)

feedback_bp = Blueprint('feedback', __name__)

PARAMETERS = [
    'Knowledge of the subject',
    'Coming well prepared for the class',
    'Giving clear explanations',
    'Command of language',
    'Clear and audible voice',
    'Holding the attention of students through the class',
    'Providing more matter than in the textbooks',
    'Capability to clear the doubts of students',
    'Encouraging students to ask questions and participate',
    'Appreciating students as and when deserving',
    'Willingness to help students even out of the class',
    'Return of valued test papers/records in time',
    'Punctuality and following timetable schedule',
    'Coverage of syllabus',
    'Impartial (teaching all students alike)',
]


@feedback_bp.route(
    '/submit', methods=['POST']
)
@limiter.limit("30 per minute")
def submit_feedback():
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Request body required",
        }), 400

    batch_id_str = data.get('batchId', '')
    responses = data.get('responses', [])
    comments = sanitize_string(
        data.get('comments', ''), 2000
    )

    if not batch_id_str or not responses:
        return jsonify({
            "error":
                "Batch ID and responses "
                "are required",
        }), 400

    batch = Batch.query.filter_by(
        batch_id=batch_id_str,
        is_active=True,
    ).first()

    if not batch:
        inactive_batch = Batch.query.filter_by(
            batch_id=batch_id_str,
        ).first()
        if inactive_batch:
            return jsonify({
                "error":
                    "This feedback batch has "
                    "been closed.",
            }), 400
        else:
            return jsonify({
                "error":
                    "Feedback batch not found.",
            }), 404

    client_ip = request.headers.get(
        'X-Forwarded-For',
        request.remote_addr,
    )
    if client_ip:
        client_ip = (
            client_ip.split(',')[0].strip()
        )

    # Cap submissions to section strength — applies in all environments
    if batch.total_students and batch.total_students > 0:
        submission_count = FeedbackSubmission.query.filter_by(
            batch_db_id=batch.id,
        ).count()
        if submission_count >= batch.total_students:
            return jsonify({
                "error": f"This section has reached its maximum response limit ({batch.total_students}).",
            }), 409

    submission = FeedbackSubmission(
        batch_db_id=batch.id,
        slot=batch.slot,
        comments=comments,
        ip_address=client_ip,
    )
    db.session.add(submission)
    db.session.flush()

    ratings_count = 0
    for resp in responses:
        faculty_id = resp.get('facultyId')
        resp_ratings = resp.get('ratings', {})

        faculty = Faculty.query.get(faculty_id)
        if not faculty:
            continue

        for param, rating_value in (
            resp_ratings.items()
        ):
            if param not in PARAMETERS:
                continue
            valid, msg = validate_rating(
                rating_value
            )
            if not valid:
                continue
            fr = FeedbackRating(
                submission_id=submission.id,
                faculty_id=faculty.id,
                parameter=param,
                rating=int(rating_value),
            )
            db.session.add(fr)
            ratings_count += 1

    if ratings_count == 0:
        db.session.rollback()
        return jsonify({
            "error": "No valid ratings",
        }), 400

    db.session.commit()
    logger.info(
        f"Feedback submitted: {batch_id_str} "
        f"({ratings_count} ratings)"
    )

    return jsonify({
        "success": True,
        "message": "Feedback submitted",
    }), 201


@feedback_bp.route(
    '/faculty/<int:faculty_id>/stats',
    methods=['GET'],
)
@require_role(['hod', 'admin'])
def get_faculty_stats(faculty_id):
    user = g.current_user

    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({
            "error": "Faculty not found",
        }), 404

    if user.role == 'hod' and (
        faculty.college != user.college
        or faculty.department != user.department
    ):
        return jsonify({
            "error": "Access denied",
        }), 403

    ratings = FeedbackRating.query.filter_by(
        faculty_id=faculty_id,
    ).all()

    if not ratings:
        return jsonify({
            "stats": None,
            "message": "No feedback data",
        }), 200

    slot_data = {}
    for r in ratings:
        slot = (
            r.submission.slot
            if r.submission
            else 1
        )
        if slot not in slot_data:
            slot_data[slot] = {}
        if r.parameter not in slot_data[slot]:
            slot_data[slot][r.parameter] = []
        slot_data[slot][r.parameter].append(
            r.rating
        )

    result = {}
    for slot, params in slot_data.items():
        param_stats = {}
        all_ratings = []
        for param, vals in params.items():
            avg = sum(vals) / len(vals)
            param_stats[param] = {
                'average': round(avg, 2),
                'percentage': round(
                    (avg / 10) * 100, 1
                ),
                'totalRatings': len(vals),
            }
            all_ratings.extend(vals)

        overall = (
            sum(all_ratings) /
            len(all_ratings)
            if all_ratings else 0
        )
        dist = {}
        for i in range(1, 11):
            dist[str(i)] = 0
        for r_val in all_ratings:
            dist[str(r_val)] = (
                dist.get(str(r_val), 0) + 1
            )

        result[f'slot{slot}'] = {
            'parameterStats': param_stats,
            'overallAverage': round(overall, 2),
            'ratingDistribution': dist,
            'responseCount': len(set(
                r.submission_id for r in ratings
                if r.submission
                and r.submission.slot == slot
            )),
        }

    total_submissions = len(
        set(r.submission_id for r in ratings)
    )

    return jsonify({
        "stats": {
            "totalResponses": total_submissions,
            "hasSlot1": 'slot1' in result,
            "hasSlot2": 'slot2' in result,
            **result,
        }
    }), 200

@feedback_bp.route(
    '/faculty/stats/multi', methods=['POST']
)
@require_role(['hod', 'admin'])
def get_multi_faculty_stats():
    """
    Aggregate stats across multiple faculty IDs — same person, same subject,
    multiple sections. Pools all individual ratings for correct averages.
    """
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    faculty_ids = data.get('faculty_ids', [])
    if not faculty_ids:
        return jsonify({"error": "faculty_ids list is required"}), 400

    # HoD access check — must own all faculty records
    if user.role == 'hod':
        for fid in faculty_ids:
            f = Faculty.query.get(fid)
            if f and (f.college != user.college or f.department != user.department):
                return jsonify({"error": "Access denied"}), 403

    ratings = FeedbackRating.query.filter(
        FeedbackRating.faculty_id.in_(faculty_ids)
    ).all()

    if not ratings:
        return jsonify({"stats": None, "message": "No feedback data"}), 200

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
        dist = {str(i): 0 for i in range(1, 11)}
        for r_val in all_ratings:
            dist[str(r_val)] = dist.get(str(r_val), 0) + 1

        result[f'slot{slot}'] = {
            'parameterStats': param_stats,
            'overallAverage': round(overall, 2),
            'ratingDistribution': dist,
            'responseCount': len(set(
                r.submission_id for r in ratings
                if r.submission and r.submission.slot == slot
            )),
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


# ========================
# DELETE ENDPOINTS
# ========================
@feedback_bp.route(
    '/faculty/<int:faculty_id>/responses',
    methods=['DELETE'],
)
@require_role(['hod', 'admin'])
def delete_faculty_responses(faculty_id):
    """Delete all feedback for a specific faculty."""
    user = g.current_user
    faculty = Faculty.query.get(faculty_id)
    if not faculty:
        return jsonify({
            "error": "Faculty not found",
        }), 404

    if user.role == 'hod' and (
        faculty.college != user.college
        or faculty.department != user.department
    ):
        return jsonify({
            "error": "Access denied",
        }), 403

    try:
        ratings = FeedbackRating.query.filter_by(
            faculty_id=faculty_id
        ).all()
        submission_ids = set(
            r.submission_id for r in ratings
        )
        FeedbackRating.query.filter_by(
            faculty_id=faculty_id
        ).delete()

        # Delete submissions that have no
        # remaining ratings
        for sid in submission_ids:
            remaining = (
                FeedbackRating.query.filter_by(
                    submission_id=sid
                ).count()
            )
            if remaining == 0:
                FeedbackSubmission.query.filter_by(
                    id=sid
                ).delete()

        db.session.commit()
        logger.info(
            f"Deleted responses for faculty "
            f"{faculty_id} by {user.user_id}"
        )
        return jsonify({
            "success": True,
            "message": "Responses deleted",
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(
            f"Delete failed: {e}"
        )
        return jsonify({
            "error": "Failed to delete",
        }), 500


@feedback_bp.route(
    '/department/responses',
    methods=['DELETE'],
)
@require_role(['hod', 'admin'])
def delete_department_responses():
    """Delete all feedback for a department."""
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Request body required",
        }), 400

    college = data.get('college', '')
    dept = data.get('dept', '')
    if not college or not dept:
        return jsonify({
            "error":
                "College and dept required",
        }), 400

    if user.role == 'hod' and (
        user.college != college
        or user.department != dept
    ):
        return jsonify({
            "error": "Access denied",
        }), 403

    try:
        faculty_ids = [
            f.id for f in
            Faculty.query.filter_by(
                college=college,
                department=dept,
            ).all()
        ]

        if faculty_ids:
            ratings = (
                FeedbackRating.query.filter(
                    FeedbackRating.faculty_id.in_(
                        faculty_ids
                    )
                ).all()
            )
            submission_ids = set(
                r.submission_id
                for r in ratings
            )
            FeedbackRating.query.filter(
                FeedbackRating.faculty_id.in_(
                    faculty_ids
                )
            ).delete(
                synchronize_session='fetch'
            )

            for sid in submission_ids:
                remaining = (
                    FeedbackRating.query
                    .filter_by(
                        submission_id=sid
                    ).count()
                )
                if remaining == 0:
                    FeedbackSubmission.query\
                        .filter_by(
                            id=sid
                        ).delete()

        db.session.commit()
        logger.info(
            f"Deleted dept responses: "
            f"{college}/{dept}"
        )
        return jsonify({
            "success": True,
            "message": "Department responses deleted",
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete failed: {e}")
        return jsonify({
            "error": "Failed to delete",
        }), 500


@feedback_bp.route(
    '/college/responses',
    methods=['DELETE'],
)
@require_role(['admin'])
def delete_college_responses():
    """Delete all feedback for a college."""
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Request body required",
        }), 400

    college = data.get('college', '')
    if not college:
        return jsonify({
            "error": "College required",
        }), 400

    try:
        faculty_ids = [
            f.id for f in
            Faculty.query.filter_by(
                college=college,
            ).all()
        ]

        if faculty_ids:
            ratings = (
                FeedbackRating.query.filter(
                    FeedbackRating.faculty_id.in_(
                        faculty_ids
                    )
                ).all()
            )
            submission_ids = set(
                r.submission_id
                for r in ratings
            )
            FeedbackRating.query.filter(
                FeedbackRating.faculty_id.in_(
                    faculty_ids
                )
            ).delete(
                synchronize_session='fetch'
            )

            for sid in submission_ids:
                remaining = (
                    FeedbackRating.query
                    .filter_by(
                        submission_id=sid
                    ).count()
                )
                if remaining == 0:
                    FeedbackSubmission.query\
                        .filter_by(
                            id=sid
                        ).delete()

        db.session.commit()
        logger.info(
            f"Deleted college responses: "
            f"{college}"
        )
        return jsonify({
            "success": True,
            "message": "College responses deleted",
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete failed: {e}")
        return jsonify({
            "error": "Failed to delete",
        }), 500