import logging
from flask import Blueprint, request, jsonify, g, current_app
from datetime import datetime, timezone
from ..extensions import db
from ..models.batch import Batch
from ..models.faculty import Faculty
from ..models.section import DepartmentSection
from ..middleware.auth_middleware import require_role, require_auth
from ..utils.validators import sanitize_string

logger = logging.getLogger(__name__)
batch_bp = Blueprint('batch', __name__)


def _parse_date(date_str):
    """
    Safely parses an ISO date string from the frontend (e.g. '2024-01-15')
    into a timezone-aware datetime object for Firestore.
    Firestore stores Python datetime as a Timestamp, which is returned back
    as a DatetimeWithNanoseconds object that has .isoformat() — fixing the
    AttributeError crash that occurred when raw strings were stored instead.
    Returns None if the input is falsy or unparseable.
    """
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


# ── Batch Management ─────────────────────────────────────────────────────────

@batch_bp.route('/create', methods=['POST'])
@require_role(['hod', 'admin'])
def create_batch():
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    faculty_ids = data.get('faculty_ids', [])
    if not faculty_ids:
        return jsonify({"error": "Faculty required"}), 400

    college = user.get('college') if user.get('role') == 'hod' else sanitize_string(data.get('college', ''), 100)
    department = user.get('department') if user.get('role') == 'hod' else sanitize_string(data.get('dept', ''), 50)
    branch = sanitize_string(data.get('branch', department), 50)
    year = sanitize_string(data.get('year', ''), 10)
    semester = sanitize_string(data.get('sem', ''), 10)
    section = sanitize_string(data.get('sec', ''), 20)
    slot = int(data.get('slot', 1))
    slot_label = sanitize_string(data.get('slotLabel', f'Slot {slot}'), 100)
    total_students = int(data.get('totalStudents', 0))

    # FIX: Parse date strings into datetime objects so Firestore stores them
    # as Timestamps. On read, Firestore returns DatetimeWithNanoseconds which
    # has .isoformat() — preventing the AttributeError crash in Batch.to_dict().
    slot_start = _parse_date(data.get('slotStartDate'))
    slot_end = _parse_date(data.get('slotEndDate'))

    # Overlap check
    overlapping = db.collection(Batch.COLLECTION)\
        .where('college', '==', college)\
        .where('department', '==', department)\
        .where('section', '==', section)\
        .where('slot', '==', slot)\
        .where('is_active', '==', True).limit(1).stream()
    if any(overlapping):
        return jsonify({"error": f"A Slot {slot} batch already exists for this section."}), 409

    # Fetch and embed faculty
    faculty_data = []
    for fid in faculty_ids:
        f_doc = db.collection(Faculty.COLLECTION).document(fid).get()
        if f_doc.exists and f_doc.to_dict().get('is_active'):
            f_dict = f_doc.to_dict()
            f_dict['id'] = f_doc.id
            faculty_data.append(f_dict)

    if not faculty_data:
        return jsonify({"error": "None of the provided faculty IDs are valid"}), 400

    batch_id = f"{college}-{department}-{branch}-{year}-{semester}-{section}-{int(datetime.now(timezone.utc).timestamp())}"

    new_batch = {
        'batch_id': batch_id,
        'college': college,
        'department': department,
        'branch': branch,
        'year': year,
        'semester': semester,
        'section': section,
        'slot': slot,
        'slot_label': slot_label,
        'slot_start_date': slot_start,   # datetime object → Firestore Timestamp
        'slot_end_date': slot_end,       # datetime object → Firestore Timestamp
        'total_students': total_students,
        'faculty': faculty_data,
        'created_by': user.get('id'),
        'is_active': True,
        'created_at': datetime.now(timezone.utc),
    }

    db.collection(Batch.COLLECTION).document(batch_id).set(new_batch)

    frontend_url = current_app.config.get('FRONTEND_URL', '').rstrip('/')
    return jsonify({
        "success": True,
        "batch": Batch.to_dict(batch_id, new_batch),
        "feedbackLink": f"{frontend_url}/feedback/{batch_id}",
    }), 201


@batch_bp.route('/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    doc = db.collection(Batch.COLLECTION).document(batch_id).get()
    if not doc.exists or not doc.to_dict().get('is_active'):
        return jsonify({"error": "Batch not found"}), 404
    return jsonify({"batch": Batch.to_dict(doc.id, doc.to_dict())}), 200


@batch_bp.route('/list', methods=['GET'])
@require_auth
def list_batches():
    user = g.current_user
    query = db.collection(Batch.COLLECTION).where('is_active', '==', True)
    if user.get('role') != 'admin':
        query = query.where('college', '==', user.get('college'))\
                     .where('department', '==', user.get('department'))
    batches = [Batch.to_dict(doc.id, doc.to_dict()) for doc in query.stream()]
    return jsonify({"batches": batches}), 200


@batch_bp.route('/<batch_id>/revoke', methods=['DELETE'])
@require_role(['hod', 'admin'])
def revoke_batch(batch_id):
    db.collection(Batch.COLLECTION).document(batch_id).update({'is_active': False})
    subs = db.collection('feedback_submissions').where('batch_id', '==', batch_id).stream()
    for sub in subs:
        sub.reference.delete()
    return jsonify({"success": True, "message": "Batch revoked and responses deleted"}), 200


# ── Section Management ──────────────────────────────────────────────────────

@batch_bp.route('/sections', methods=['GET'])
@require_auth
def list_sections():
    user = g.current_user
    if user.get('role') == 'admin':
        return jsonify({"error": "Admins do not have sections"}), 403
    docs = db.collection(DepartmentSection.COLLECTION)\
        .where('college', '==', user.get('college'))\
        .where('department', '==', user.get('department'))\
        .where('is_active', '==', True).stream()
    sections = [DepartmentSection.to_dict(d.id, d.to_dict()) for d in docs]
    return jsonify({"sections": sections}), 200


@batch_bp.route('/sections', methods=['POST'])
@require_role(['hod'])
def create_section():
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    year = sanitize_string(data.get('year', ''), 10)
    section_name = sanitize_string(data.get('sectionName', ''), 50)
    branch = sanitize_string(data.get('branch', ''), 50)
    strength = int(data.get('strength', 0) or 0)

    if not year or not section_name:
        return jsonify({"error": "Year and section name are required"}), 400

    # Duplicate check
    existing = db.collection(DepartmentSection.COLLECTION)\
        .where('college', '==', user.get('college'))\
        .where('department', '==', user.get('department'))\
        .where('year', '==', year)\
        .where('branch', '==', branch)\
        .where('section_name', '==', section_name)\
        .where('is_active', '==', True).limit(1).stream()
    if any(existing):
        return jsonify({"error": f"Section '{section_name}' already exists for Year {year}"}), 409

    new_section = {
        'college': user.get('college'),
        'department': user.get('department'),
        'year': year,
        'branch': branch,
        'section_name': section_name,
        'strength': strength,
        'created_by': user.get('id'),
        'is_active': True,
        'created_at': datetime.now(timezone.utc),
    }
    doc_ref = db.collection(DepartmentSection.COLLECTION).document()
    doc_ref.set(new_section)
    return jsonify({"success": True, "section": DepartmentSection.to_dict(doc_ref.id, new_section)}), 201


@batch_bp.route('/sections/<section_id>', methods=['PUT'])
@require_role(['hod'])
def update_section(section_id):
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    doc_ref = db.collection(DepartmentSection.COLLECTION).document(section_id)
    doc = doc_ref.get()
    if not doc.exists or not doc.to_dict().get('is_active'):
        return jsonify({"error": "Section not found"}), 404

    s = doc.to_dict()
    if s.get('college') != user.get('college') or s.get('department') != user.get('department'):
        return jsonify({"error": "Access denied"}), 403

    updates = {}
    if 'strength' in data:
        updates['strength'] = max(0, int(data['strength'] or 0))
    if 'sectionName' in data:
        updates['section_name'] = sanitize_string(data['sectionName'], 50)

    doc_ref.update(updates)
    updated = {**s, **updates}
    return jsonify({"success": True, "section": DepartmentSection.to_dict(section_id, updated)}), 200


@batch_bp.route('/sections/<section_id>', methods=['DELETE'])
@require_role(['hod'])
def delete_section(section_id):
    user = g.current_user
    doc_ref = db.collection(DepartmentSection.COLLECTION).document(section_id)
    doc = doc_ref.get()
    if not doc.exists or not doc.to_dict().get('is_active'):
        return jsonify({"error": "Section not found"}), 404

    s = doc.to_dict()
    if s.get('college') != user.get('college') or s.get('department') != user.get('department'):
        return jsonify({"error": "Access denied"}), 403

    doc_ref.update({'is_active': False})
    return jsonify({"success": True, "message": "Section deleted"}), 200