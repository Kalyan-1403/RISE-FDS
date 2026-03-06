from flask import Blueprint, jsonify, request, g
from ..models.faculty import Faculty
from ..models.feedback import FeedbackRating, FeedbackSubmission
from ..models.batch import Batch
from ..extensions import db

# Import our powerful new RBAC middleware!
from ..middleware.auth_middleware import require_role

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/admin', methods=['GET'])
@require_role(['admin'])
def admin_dashboard():
    # The middleware already verified this user is an admin!
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
@require_role(['hod'])
def hod_dashboard():
    # We easily grab the user from Flask's 'g' object provided by the middleware
    user = g.current_user

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


@dashboard_bp.route('/department', methods=['POST'])
@require_role(['admin'])
def add_department():
    # Since departments are dynamically tracked in your frontend's localStorage 
    # and derived from Faculty rows, we don't need to INSERT into a database table here.
    # This endpoint acts as a secure handshake confirming the backend is alive.
    return jsonify({"success": True, "message": "Department recognized by backend."}), 200


@dashboard_bp.route('/department', methods=['DELETE'])
@require_role(['admin'])
def delete_department():
    data = request.get_json()
    college = data.get('college')
    dept = data.get('dept')

    if not college or not dept:
        return jsonify({"error": "College and department are required"}), 400

    try:
        # 1. Delete associated Batches
        batches = Batch.query.filter_by(college=college, department=dept).all()
        for b in batches:
            db.session.delete(b)

        # 2. Delete associated Faculty (this will auto-cascade and delete FeedbackRatings!)
        faculties = Faculty.query.filter_by(college=college, department=dept).all()
        for f in faculties:
            db.session.delete(f)

        db.session.commit()
        return jsonify({"success": True, "message": f"{dept} department deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route('/college', methods=['DELETE'])
@require_role(['admin'])
def delete_college():
    data = request.get_json()
    college = data.get('college')

    if not college:
        return jsonify({"error": "College name is required"}), 400

    try:
        # 1. Wipes all batches in the entire college
        batches = Batch.query.filter_by(college=college).all()
        for b in batches:
            db.session.delete(b)

        # 2. Wipes all faculty in the entire college
        faculties = Faculty.query.filter_by(college=college).all()
        for f in faculties:
            db.session.delete(f)

        db.session.commit()
        return jsonify({"success": True, "message": f"{college} College and all data deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500