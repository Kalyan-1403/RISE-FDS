import logging
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from ..extensions import db
from ..models.faculty import Faculty
from ..middleware.auth_middleware import require_role, require_auth
from ..utils.validators import sanitize_string

logger = logging.getLogger(__name__)
faculty_bp = Blueprint('faculty', __name__)

@faculty_bp.route('', methods=['GET'])
@require_auth
def get_all_faculty():
    user = g.current_user
    query = db.collection(Faculty.COLLECTION).where('is_active', '==', True)
    
    if user.get('role') != 'admin':
        query = query.where('college', '==', user.get('college'))\
                     .where('department', '==', user.get('department'))

    faculty_list = [Faculty.to_dict(doc.id, doc.to_dict()) for doc in query.stream()]
    return jsonify({"faculty": faculty_list}), 200

@faculty_bp.route('', methods=['POST'])
@require_role(['hod', 'admin'])
def create_faculty():
    user = g.current_user
    data = request.get_json()

    college = user.get('college') if user.get('role') == 'hod' else sanitize_string(data.get('college', ''), 100)
    department = user.get('department') if user.get('role') == 'hod' else sanitize_string(data.get('dept', ''), 50)

    new_faculty = {
        'name': sanitize_string(data.get('name', ''), 150),
        'subject': sanitize_string(data.get('subject', ''), 200),
        'year': sanitize_string(data.get('year', ''), 10),
        'semester': sanitize_string(data.get('sem', ''), 10),
        'section': sanitize_string(data.get('sec', ''), 20),
        'branch': sanitize_string(data.get('branch', department), 50),
        'college': college,
        'department': department,
        'is_active': True,
        'created_at': datetime.now(timezone.utc)
    }

    doc_ref = db.collection(Faculty.COLLECTION).document()
    doc_ref.set(new_faculty)

    return jsonify({"success": True, "faculty": Faculty.to_dict(doc_ref.id, new_faculty)}), 201
@faculty_bp.route('/<faculty_id>', methods=['PUT'])
@require_role(['hod', 'admin'])
def update_faculty(faculty_id):
    user = g.current_user
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    doc_ref = db.collection(Faculty.COLLECTION).document(faculty_id)
    doc = doc_ref.get()
    if not doc.exists or not doc.to_dict().get('is_active'):
        return jsonify({"error": "Faculty not found"}), 404

    updates = {}
    for field in ['name', 'subject', 'year', 'branch']:
        if field in data:
            updates[field] = sanitize_string(str(data[field]), 200)
    if 'sem' in data:
        updates['semester'] = sanitize_string(str(data['sem']), 10)
    if 'sec' in data:
        updates['section'] = sanitize_string(str(data['sec']), 20)

    doc_ref.update(updates)
    updated = {**doc.to_dict(), **updates}
    return jsonify({"success": True, "faculty": Faculty.to_dict(faculty_id, updated)}), 200

@faculty_bp.route('/<faculty_id>', methods=['DELETE'])
@require_role(['hod', 'admin'])
def delete_faculty(faculty_id):
    db.collection(Faculty.COLLECTION).document(faculty_id).update({'is_active': False})
    return jsonify({"success": True, "message": "Faculty deleted successfully"}), 200