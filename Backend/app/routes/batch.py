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

@batch_bp.route('/create', methods=['POST'])
@require_role(['hod', 'admin'])
def create_batch():
    user = g.current_user
    data = request.get_json()

    faculty_ids = data.get('faculty_ids', [])
    if not faculty_ids: return jsonify({"error": "Faculty required"}), 400

    college = user.get('college') if user.get('role') == 'hod' else sanitize_string(data.get('college', ''), 100)
    department = user.get('department') if user.get('role') == 'hod' else sanitize_string(data.get('dept', ''), 50)
    
    branch = sanitize_string(data.get('branch', department), 50)
    year = sanitize_string(data.get('year', ''), 10)
    semester = sanitize_string(data.get('sem', ''), 10)
    section = sanitize_string(data.get('sec', ''), 20)
    slot = int(data.get('slot', 1))

    # Overlap Check
    batches_ref = db.collection(Batch.COLLECTION)
    overlapping = batches_ref.where('college', '==', college)\
        .where('department', '==', department)\
        .where('section', '==', section)\
        .where('slot', '==', slot)\
        .where('is_active', '==', True).limit(1).stream()
        
    if any(overlapping):
        return jsonify({"error": f"A Slot {slot} batch already exists for this section."}), 409

    # Fetch and embed faculty data directly to avoid joins later
    faculty_data = []
    for fid in faculty_ids:
        f_doc = db.collection(Faculty.COLLECTION).document(fid).get()
        if f_doc.exists and f_doc.to_dict().get('is_active'):
            f_dict = f_doc.to_dict()
            f_dict['id'] = f_doc.id
            faculty_data.append(f_dict)

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
        'total_students': int(data.get('totalStudents', 0)),
        'faculty': faculty_data, # Embedded Array
        'created_by': user.get('id'),
        'is_active': True,
        'created_at': datetime.now(timezone.utc)
    }

    doc_ref = batches_ref.document(batch_id)
    doc_ref.set(new_batch)

    frontend_url = current_app.config.get('FRONTEND_URL', '').rstrip('/')
    return jsonify({
        "success": True, 
        "batch": Batch.to_dict(batch_id, new_batch),
        "feedbackLink": f"{frontend_url}/feedback/{batch_id}"
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
    doc_ref = db.collection(Batch.COLLECTION).document(batch_id)
    doc_ref.update({'is_active': False})
    
    # Wipe Submissions
    subs = db.collection('feedback_submissions').where('batch_id', '==', batch_id).stream()
    for sub in subs:
        sub.reference.delete()
        
    return jsonify({"success": True, "message": "Batch revoked"}), 200