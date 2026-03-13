import logging
from flask import Blueprint, request, jsonify, g
from datetime import datetime
from ..extensions import db
from ..models.batch import Batch, BatchFaculty
from ..models.faculty import Faculty
from ..middleware.auth_middleware import require_role, require_auth
from ..utils.validators import sanitize_string

logger = logging.getLogger(__name__)

batch_bp = Blueprint('batch', __name__)


@batch_bp.route('/create', methods=['POST'])
@require_role(['hod', 'admin'])
def create_batch():
    """Create a feedback batch with associated faculty."""
    user = g.current_user

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    faculty_ids = data.get('faculty_ids', [])
    if not faculty_ids:
        return jsonify({"error": "At least one faculty member is required"}), 400

    # Validate faculty_ids are integers
    if not all(isinstance(fid, int) for fid in faculty_ids):
        return jsonify({"error": "Invalid faculty ID format"}), 400

    # Auto-fill college/dept for HoD, allow override for Admin
    if user.role == 'hod':
        college = user.college
        department = user.department
    else:
        college = sanitize_string(data.get('college', ''), 100)
        department = sanitize_string(data.get('dept', ''), 50)

    if not college or not department:
        return jsonify({"error": "College and department are required"}), 400

    branch = sanitize_string(data.get('branch', department), 50)
    year = sanitize_string(data.get('year', ''), 10)
    semester = sanitize_string(data.get('sem', ''), 10)
    section = sanitize_string(data.get('sec', ''), 20)
    slot = data.get('slot', 1)
    slot_start = data.get('slotStartDate')
    slot_end = data.get('slotEndDate')
    slot_label = sanitize_string(data.get('slotLabel', f'Slot {slot}'), 100)

    # Validate slot is an integer
    try:
        slot = int(slot)
    except (ValueError, TypeError):
        return jsonify({"error": "Slot must be a number"}), 400

    # Generate a unique Batch ID
    batch_id = f"{college}-{department}-{branch}-{year}-{semester}-{section}-{int(datetime.utcnow().timestamp())}"

    # Parse dates safely
    start_date = None
    end_date = None
    try:
        if slot_start:
            start_date = datetime.strptime(slot_start, '%Y-%m-%d').date()
        if slot_end:
            end_date = datetime.strptime(slot_end, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    batch = Batch(
        batch_id=batch_id,
        college=college,
        department=department,
        branch=branch,
        year=year,
        semester=semester,
        section=section,
        slot=slot,
        slot_start_date=start_date,
        slot_end_date=end_date,
        slot_label=slot_label,
        created_by=user.id,
    )
    db.session.add(batch)
    db.session.flush()

    # Associate faculty with batch
    added_faculty = 0
    for fid in faculty_ids:
        faculty = Faculty.query.get(fid)
        if faculty and faculty.is_active:
            bf = BatchFaculty(batch_id=batch.id, faculty_id=faculty.id)
            db.session.add(bf)
            added_faculty += 1

    if added_faculty == 0:
        db.session.rollback()
        return jsonify({"error": "None of the provided faculty IDs are valid"}), 400

    db.session.commit()

    logger.info(f"Batch created: {batch_id} by {user.user_id} with {added_faculty} faculty")

    return jsonify({
        "success": True,
        "batch": batch.to_dict(),
        "feedbackLink": f"/feedback/{batch.batch_id}",
    }), 201


@batch_bp.route('/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    """PUBLIC ROUTE: Students use this to load the feedback form."""
    batch_id = sanitize_string(batch_id, 200)

    batch = Batch.query.filter_by(batch_id=batch_id, is_active=True).first()
    if not batch:
        return jsonify({"error": "Batch not found"}), 404

    return jsonify({"batch": batch.to_dict()}), 200


@batch_bp.route('/list', methods=['GET'])
@require_auth
def list_batches():
    """List batches — Admins see all, HoDs see their own department."""
    user = g.current_user

    if user.role == 'admin':
        batches = Batch.query.filter_by(is_active=True).order_by(Batch.created_at.desc()).all()
    else:
        batches = Batch.query.filter_by(
            college=user.college,
            department=user.department,
            is_active=True,
        ).order_by(Batch.created_at.desc()).all()

    return jsonify({"batches": [b.to_dict() for b in batches]}), 200