import logging
from flask import Blueprint, request, jsonify, g, current_app
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
    total_students = data.get('totalStudents', 0)
    try:
        total_students = int(total_students)
        if total_students < 0:
            total_students = 0
    except (ValueError, TypeError):
        total_students = 0

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

    # Slot locking: prevent duplicate batches for same section/slot/dates
    from sqlalchemy import and_, or_
    overlapping = Batch.query.filter(
        Batch.college == college,
        Batch.department == department,
        Batch.branch == branch,
        Batch.year == year,
        Batch.semester == semester,
        Batch.section == section,
        Batch.slot == slot,
        Batch.is_active == True,
    ).first()

    if overlapping:
        return jsonify({
            "error": (
                f"A Slot {slot} batch already exists for this section "
                f"({college} / {department} / {branch} / Year {year} / "
                f"Sem {semester} / Sec {section}). "
                f"Only the developer can override this."
            )
        }), 409

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
        total_students=total_students,
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

    frontend_url = current_app.config.get('FRONTEND_URL', '').rstrip('/')
    return jsonify({
        "success": True,
        "batch": batch.to_dict(),
        "feedbackLink": f"{frontend_url}/feedback/{batch.batch_id}",
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


@batch_bp.route('/<batch_id>/revoke', methods=['DELETE'])
@require_role(['hod', 'admin'])
def revoke_batch(batch_id):
    """Revoke a published batch: deactivates link and wipes all submitted responses."""
    user = g.current_user
    batch_id = sanitize_string(batch_id, 200)
    batch = Batch.query.filter_by(batch_id=batch_id).first()
    if not batch:
        return jsonify({"error": "Batch not found"}), 404
    if user.role == 'hod' and (batch.college != user.college or batch.department != user.department):
        return jsonify({"error": "Access denied"}), 403
    try:
        from ..models.feedback import FeedbackSubmission, FeedbackRating
        submission_ids = [s.id for s in FeedbackSubmission.query.filter_by(batch_db_id=batch.id).all()]
        if submission_ids:
            FeedbackRating.query.filter(FeedbackRating.submission_id.in_(submission_ids)).delete(synchronize_session='fetch')
            FeedbackSubmission.query.filter_by(batch_db_id=batch.id).delete()
        batch.is_active = False
        db.session.commit()
        logger.info(f"Batch revoked: {batch_id} by {user.user_id}")
        return jsonify({"success": True, "message": "Batch revoked and responses wiped"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Revoke failed: {e}")
        return jsonify({"error": "Failed to revoke batch"}), 500


# ─── Section Management Routes ───────────────────────────────────────────────

from ..models.section import DepartmentSection

@batch_bp.route('/sections', methods=['GET'])
@require_auth
def list_sections():
    """List all sections for the HoD's department."""
    user = g.current_user
    if user.role == 'admin':
        return jsonify({"error": "Admins do not have sections"}), 403

    sections = DepartmentSection.query.filter_by(
        college=user.college,
        department=user.department,
        is_active=True,
    ).order_by(DepartmentSection.year, DepartmentSection.section_name).all()

    return jsonify({"sections": [s.to_dict() for s in sections]}), 200


@batch_bp.route('/sections', methods=['POST'])
@require_role(['hod'])
def create_section():
    """Create a new section for the HoD's department."""
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    year = sanitize_string(data.get('year', ''), 10)
    section_name = sanitize_string(data.get('sectionName', ''), 50)
    branch = sanitize_string(data.get('branch', ''), 50)
    strength = data.get('strength', 0)

    if not year or not section_name:
        return jsonify({"error": "Year and section name are required"}), 400

    try:
        strength = int(strength)
        if strength < 0:
            strength = 0
    except (ValueError, TypeError):
        strength = 0

    existing = DepartmentSection.query.filter_by(
        college=user.college,
        department=user.department,
        year=year,
	branch=branch,
        section_name=section_name,
        is_active=True,
    ).first()

    if existing:
        return jsonify({"error": f"Section '{section_name}' already exists for Year {year}"}), 409

    section = DepartmentSection(
        college=user.college,
        department=user.department,
        year=year,
	branch=branch,
        section_name=section_name,
        strength=strength,
        created_by=user.id,
    )
    db.session.add(section)
    db.session.commit()

    logger.info(f"Section created: {user.department} Y{year}-{section_name} by {user.user_id}")
    return jsonify({"success": True, "section": section.to_dict()}), 201


@batch_bp.route('/sections/<int:section_id>', methods=['PUT'])
@require_role(['hod'])
def update_section(section_id):
    """Update section strength or name."""
    user = g.current_user
    section = DepartmentSection.query.get(section_id)

    if not section or not section.is_active:
        return jsonify({"error": "Section not found"}), 404
    if section.college != user.college or section.department != user.department:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    if 'strength' in data:
        try:
            section.strength = max(0, int(data['strength']))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid strength value"}), 400

    if 'sectionName' in data:
        section.section_name = sanitize_string(data['sectionName'], 50)

    db.session.commit()

    # Sync total_students on all active batches that match this section
    # Sync total_students on all active batches that match this section
    if 'strength' in data:
        matching_batches = Batch.query.filter(
            Batch.college == section.college,
            Batch.department == section.department,
            Batch.section == section.section_name,
            Batch.is_active == True,
        ).all()
        for b in matching_batches:
            b.total_students = section.strength
        if matching_batches:
            db.session.commit()
            logger.info(f"Synced total_students={section.strength} to {len(matching_batches)} batch(es) for section {section.section_name}")

    logger.info(f"Section updated: id={section_id} by {user.user_id}")
    return jsonify({"success": True, "section": section.to_dict()}), 200


@batch_bp.route('/sections/<int:section_id>', methods=['DELETE'])
@require_role(['hod'])
def delete_section(section_id):
    """Soft-delete a section."""
    user = g.current_user
    section = DepartmentSection.query.get(section_id)

    if not section or not section.is_active:
        return jsonify({"error": "Section not found"}), 404
    if section.college != user.college or section.department != user.department:
        return jsonify({"error": "Access denied"}), 403

    section.is_active = False
    db.session.commit()

    logger.info(f"Section deleted: id={section_id} by {user.user_id}")
    return jsonify({"success": True, "message": "Section deleted"}), 200
