import logging
from flask import Blueprint, jsonify, request, g
from ..models.faculty import Faculty
from ..models.feedback import FeedbackRating, FeedbackSubmission
from ..models.batch import Batch
from ..extensions import db
from ..middleware.auth_middleware import require_role
from ..utils.validators import sanitize_string

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/admin', methods=['GET'])
@require_role(['admin'])
def admin_dashboard():
    """Admin dashboard — scoped to college if user is Principal, else global."""
    user = g.current_user

    # Principal (college='Gandhi') sees only Gandhi data.
    # Director / Chairman (college=None) see everything.
    scoped_college = user.college if user.college else None

    if scoped_college:
        faculty_query = Faculty.query.filter_by(is_active=True, college=scoped_college)
        batch_query = Batch.query.filter_by(is_active=True, college=scoped_college)
        submission_count = db.session.query(FeedbackSubmission).join(
            Batch, FeedbackSubmission.batch_db_id == Batch.id
        ).filter(Batch.college == scoped_college).count()
    else:
        faculty_query = Faculty.query.filter_by(is_active=True)
        batch_query = Batch.query.filter_by(is_active=True)
        submission_count = FeedbackSubmission.query.count()

    total_faculty = faculty_query.count()
    total_batches = batch_query.count()

    faculty_by_dept = {}
    for f in faculty_query.all():
        key = f"{f.college}_{f.department}"
        if key not in faculty_by_dept:
            faculty_by_dept[key] = []
        faculty_by_dept[key].append(f.to_dict())

    return jsonify({
        "totalFaculty": total_faculty,
        "totalBatches": total_batches,
        "totalSubmissions": submission_count,
        "masterFacultyList": faculty_by_dept,
        "scopedCollege": scoped_college,
    }), 200

@dashboard_bp.route('/hod', methods=['GET'])
@require_role(['hod'])
def hod_dashboard():
    """HoD dashboard — department-scoped data."""
    user = g.current_user

    faculty = Faculty.query.filter_by(
        college=user.college,
        department=user.department,
        is_active=True,
    ).all()

    batches = Batch.query.filter_by(
        college=user.college,
        department=user.department,
        is_active=True,
    ).order_by(Batch.created_at.desc()).all()

    return jsonify({
        "faculty": [f.to_dict() for f in faculty],
        "batches": [b.to_dict() for b in batches],
        "college": user.college,
        "department": user.department,
    }), 200


@dashboard_bp.route('/department', methods=['POST'])
@require_role(['admin'])
def add_department():
    """Acknowledge department addition from frontend."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    college = sanitize_string(data.get('college', ''), 100)
    dept_name = sanitize_string(data.get('deptName', ''), 50)

    if not college or not dept_name:
        return jsonify({"error": "College and department name are required"}), 400

    logger.info(f"Department added: {dept_name} in {college}")

    return jsonify({"success": True, "message": "Department recognized by backend."}), 200


@dashboard_bp.route('/department', methods=['DELETE'])
@require_role(['admin'])
def delete_department():
    """Cascade-delete all data for a department."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    college = sanitize_string(data.get('college', ''), 100)
    dept = sanitize_string(data.get('dept', ''), 50)

    if not college or not dept:
        return jsonify({"error": "College and department are required"}), 400

    try:
        # Delete associated feedback submissions via batches
        batches = Batch.query.filter_by(college=college, department=dept).all()
        for b in batches:
            # Delete submissions and their ratings for this batch
            submissions = FeedbackSubmission.query.filter_by(batch_db_id=b.id).all()
            for s in submissions:
                FeedbackRating.query.filter_by(submission_id=s.id).delete()
                db.session.delete(s)
            db.session.delete(b)

        # Delete associated faculty
        faculties = Faculty.query.filter_by(college=college, department=dept).all()
        for f in faculties:
            # Delete any remaining ratings for this faculty
            FeedbackRating.query.filter_by(faculty_id=f.id).delete()
            db.session.delete(f)

        db.session.commit()

        logger.info(f"Department deleted: {dept} in {college}")

        return jsonify({"success": True, "message": f"{dept} department deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete department {dept} in {college}: {e}")
        return jsonify({"error": "Failed to delete department. Please try again."}), 500


@dashboard_bp.route('/college', methods=['DELETE'])
@require_role(['admin'])
def delete_college():
    """Cascade-delete all data for an entire college."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    college = sanitize_string(data.get('college', ''), 100)

    if not college:
        return jsonify({"error": "College name is required"}), 400

    try:
        # Delete all batches and their submissions/ratings
        batches = Batch.query.filter_by(college=college).all()
        for b in batches:
            submissions = FeedbackSubmission.query.filter_by(batch_db_id=b.id).all()
            for s in submissions:
                FeedbackRating.query.filter_by(submission_id=s.id).delete()
                db.session.delete(s)
            db.session.delete(b)

        # Delete all faculty and their remaining ratings
        faculties = Faculty.query.filter_by(college=college).all()
        for f in faculties:
            FeedbackRating.query.filter_by(faculty_id=f.id).delete()
            db.session.delete(f)

        db.session.commit()

        logger.info(f"College deleted: {college}")

        return jsonify({"success": True, "message": f"{college} and all associated data deleted"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete college {college}: {e}")
        return jsonify({"error": "Failed to delete college. Please try again."}), 500