import logging
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from ..extensions import db, limiter
from ..models.batch import Batch
from ..models.feedback import FeedbackSubmission
from ..middleware.auth_middleware import require_role

logger = logging.getLogger(__name__)
feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/submit', methods=['POST'])
@limiter.limit("30 per minute")
def submit_feedback():
    data = request.get_json()
    batch_id_str = data.get('batchId', '')
    responses = data.get('responses', [])
    comments = data.get('comments', '')

    # 1. Verify Batch
    batch_ref = db.collection(Batch.COLLECTION).document(batch_id_str)
    batch_doc = batch_ref.get()
    
    if not batch_doc.exists or not batch_doc.to_dict().get('is_active'):
        return jsonify({"error": "Feedback batch not found or closed."}), 404

    batch_data = batch_doc.to_dict()
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()

    # 2. Check Submission Limits
    if batch_data.get('total_students', 0) > 0:
        count_query = db.collection(FeedbackSubmission.COLLECTION).where('batch_id', '==', batch_id_str).count()
        current_count = count_query.get()[0][0].value
        if current_count >= batch_data['total_students']:
            return jsonify({"error": "Maximum responses reached."}), 409

    # 3. Format the Embedded Ratings Map (The Cost Saver)
    ratings_map = {}
    for resp in responses:
        fac_id = resp.get('facultyId')
        fac_ratings = resp.get('ratings', {})
        if fac_id and fac_ratings:
            ratings_map[fac_id] = {k: int(v) for k, v in fac_ratings.items()}

    # 4. Save as ONE document
    submission_data = FeedbackSubmission.create_submission_data(
        batch_id=batch_id_str,
        slot=batch_data.get('slot', 1),
        comments=comments,
        ip_address=client_ip,
        ratings_map=ratings_map
    )

    db.collection(FeedbackSubmission.COLLECTION).add(submission_data)
    return jsonify({"success": True, "message": "Feedback submitted"}), 201


@feedback_bp.route('/faculty/<faculty_id>/stats', methods=['GET'])
@require_role(['hod', 'admin'])
def get_faculty_stats(faculty_id):
    """Calculates averages in-memory from embedded documents."""
    # Find all submissions that contain this faculty_id in their ratings map
    # Firestore syntax allows querying inside map keys
    query = db.collection(FeedbackSubmission.COLLECTION).where(f'ratings.{faculty_id}', '!=', None)
    submissions = query.stream()

    slot_data = {}
    total_submissions = 0

    for sub in submissions:
        data = sub.to_dict()
        slot = data.get('slot', 1)
        fac_ratings = data.get('ratings', {}).get(faculty_id, {})
        
        if not fac_ratings: continue
        total_submissions += 1

        if slot not in slot_data: slot_data[slot] = {}
        
        for param, rating in fac_ratings.items():
            if param not in slot_data[slot]: slot_data[slot][param] = []
            slot_data[slot][param].append(rating)

    if total_submissions == 0:
        return jsonify({"stats": None, "message": "No feedback data"}), 200

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
        
        result[f'slot{slot}'] = {
            'parameterStats': param_stats,
            'overallAverage': round(overall, 2),
            'responseCount': len(all_ratings) // len(params) if params else 0
        }

    stats_response = {
        "totalResponses": total_submissions,
        "hasSlot1": 1 in slot_data,
        "hasSlot2": 2 in slot_data,
    }
    if 1 in slot_data:
        stats_response["slot1"] = result.get("slot1", {})
    if 2 in slot_data:
        stats_response["slot2"] = result.get("slot2", {})

    return jsonify({"stats": stats_response}), 200
@feedback_bp.route('/faculty/stats/multi', methods=['POST'])
@require_role(['hod', 'admin'])
def get_multi_faculty_stats():
    data = request.get_json()
    faculty_ids = data.get('faculty_ids', [])
    results = {}
    for fid in faculty_ids:
        query = db.collection(FeedbackSubmission.COLLECTION).where(f'ratings.{fid}', '!=', None)
        slot_data = {}
        total = 0
        for sub in query.stream():
            s = sub.to_dict()
            slot = s.get('slot', 1)
            fac_ratings = s.get('ratings', {}).get(fid, {})
            if not fac_ratings:
                continue
            total += 1
            if slot not in slot_data:
                slot_data[slot] = {}
            for param, rating in fac_ratings.items():
                slot_data[slot].setdefault(param, []).append(rating)
        if total > 0:
            results[fid] = {"totalResponses": total, "hasSlot1": 1 in slot_data, "hasSlot2": 2 in slot_data}
    return jsonify({"stats": results}), 200


@feedback_bp.route('/faculty/<faculty_id>/responses', methods=['DELETE'])
@require_role(['hod', 'admin'])
def delete_faculty_responses(faculty_id):
    subs = db.collection(FeedbackSubmission.COLLECTION).where(f'ratings.{faculty_id}', '!=', None).stream()
    for sub in subs:
        sub.reference.delete()
    return jsonify({"success": True}), 200


@feedback_bp.route('/department/responses', methods=['DELETE'])
@require_role(['hod', 'admin'])
def delete_department_responses():
    data = request.get_json()
    college = data.get('college')
    dept = data.get('dept')
    batches = db.collection('batches').where('college', '==', college).where('department', '==', dept).stream()
    for batch in batches:
        subs = db.collection(FeedbackSubmission.COLLECTION).where('batch_id', '==', batch.id).stream()
        for sub in subs:
            sub.reference.delete()
    return jsonify({"success": True}), 200


@feedback_bp.route('/college/responses', methods=['DELETE'])
@require_role(['admin'])
def delete_college_responses():
    data = request.get_json()
    college = data.get('college')
    batches = db.collection('batches').where('college', '==', college).stream()
    for batch in batches:
        subs = db.collection(FeedbackSubmission.COLLECTION).where('batch_id', '==', batch.id).stream()
        for sub in subs:
            sub.reference.delete()
    return jsonify({"success": True}), 200