from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime
from ..extensions import db
from ..models.batch import Batch, BatchFaculty
from ..models.faculty import Faculty
from ..utils.helpers import get_current_user
from ..utils.validators import sanitize_string

batch_bp = Blueprint('batch', __name__)


@batch_bp.route('/create', methods=['POST'])
@jwt_required()
def create_batch():
    user = get_current_user()
    if not user or user.role not in ('hod', 'admin'):
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    faculty_ids = data.get('faculty_ids', [])
    if not faculty_ids:
        return jsonify({"error": "At least one faculty member is required"}), 400

    college = sanitize_string(data.get('college', user.college), 100)
    department = sanitize_string(data.get('dept', user.department), 50)
    branch = sanitize_string(data.get('branch', department), 50)
    year = sanitize_string(data.get('year', ''), 10)
    semester = sanitize_string(data.get('sem', ''), 10)
    section = sanitize_string(data.get('sec', ''), 20)
    slot = int(data.get('slot', 1))
    slot_start = data.get('slotStartDate')
    slot_end = data.get('slotEndDate')
    slot_label = data.get('slotLabel', f'Slot {slot}')

    if not year or not semester or not section:
        return jsonify({"error": "Year, semester, and section are required"}), 400

    batch_id = f"{college}-{department}-{branch}-{year}-{semester}-{section}-{int(datetime.utcnow().timestamp() * 1000)}"

    batch = Batch(
        batch_id=batch_id,
        college=college,
        department=department,
        branch=branch,
        year=year,
        semester=semester,
        section=section,
        slot=slot,
        slot_start_date=datetime.strptime(slot_start, '%Y-%m-%d').date() if slot_start else None,
        slot_end_date=datetime.strptime(slot_end, '%Y-%m-%d').date() if slot_end else None,
        slot_label=slot_label,
        created_by=user.id,
    )
    db.session.add(batch)
    db.session.flush()

    for fid in faculty_ids:
        faculty = Faculty.query.get(fid)
        if faculty:
            bf = BatchFaculty(batch_id=batch.id, faculty_id=faculty.id)
            db.session.add(bf)

    db.session.commit()

    return jsonify({
        "success": True,
        "batch": batch.to_dict(),
        "feedbackLink": f"/feedback/{batch.batch_id}",
    }), 201


@batch_bp.route('/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = Batch.query.filter_by(batch_id=batch_id, is_active=True).first()
    if not batch:
        return jsonify({"error": "Batch not found"}), 404
    return jsonify({"batch": batch.to_dict()}), 200


@batch_bp.route('/list', methods=['GET'])
@jwt_required()
def list_batches():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if user.role == 'admin':
        batches = Batch.query.filter_by(is_active=True).order_by(Batch.created_at.desc()).all()
    else:
        batches = Batch.query.filter_by(
            college=user.college,
            department=user.department,
            is_active=True
        ).order_by(Batch.created_at.desc()).all()

    return jsonify({"batches": [b.to_dict() for b in batches]}), 200