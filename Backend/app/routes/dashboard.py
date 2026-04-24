import logging
from flask import Blueprint, jsonify, request, g
from ..extensions import db
from ..models.faculty import Faculty
from ..models.batch import Batch
from ..middleware.auth_middleware import require_role

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/admin', methods=['GET'])
@require_role(['admin'])
def admin_dashboard():
    user = g.current_user
    scoped_college = user.get('college')

    faculty_ref = db.collection(Faculty.COLLECTION).where('is_active', '==', True)
    batch_ref = db.collection(Batch.COLLECTION).where('is_active', '==', True)
    
    if scoped_college:
        faculty_ref = faculty_ref.where('college', '==', scoped_college)
        batch_ref = batch_ref.where('college', '==', scoped_college)

    faculties = [Faculty.to_dict(d.id, d.to_dict()) for d in faculty_ref.stream()]
    batches = [Batch.to_dict(d.id, d.to_dict()) for d in batch_ref.stream()]
    
    # Submissions count aggregation
    sub_count = 0
    if scoped_college:
        for b in batches:
            count_query = db.collection('feedback_submissions').where('batch_id', '==', b['id']).count()
            sub_count += count_query.get()[0][0].value
    else:
        count_query = db.collection('feedback_submissions').count()
        sub_count = count_query.get()[0][0].value

    faculty_by_dept = {}
    for f in faculties:
        key = f"{f['college']}_{f['dept']}"
        if key not in faculty_by_dept: faculty_by_dept[key] = []
        faculty_by_dept[key].append(f)

    return jsonify({
        "totalFaculty": len(faculties),
        "totalBatches": len(batches),
        "totalSubmissions": sub_count,
        "masterFacultyList": faculty_by_dept,
    }), 200

@dashboard_bp.route('/hod', methods=['GET'])
@require_role(['hod'])
def hod_dashboard():
    user = g.current_user
    college, dept = user.get('college'), user.get('department')

    f_docs = db.collection(Faculty.COLLECTION).where('college','==',college).where('department','==',dept).where('is_active','==',True).stream()
    b_docs = db.collection(Batch.COLLECTION).where('college','==',college).where('department','==',dept).where('is_active','==',True).stream()

    return jsonify({
        "faculty": [Faculty.to_dict(d.id, d.to_dict()) for d in f_docs],
        "batches": [Batch.to_dict(d.id, d.to_dict()) for d in b_docs],
        "college": college,
        "department": dept,
    }), 200