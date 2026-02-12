from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Batch, Faculty, batch_faculty
from utils.decorators import role_required, get_current_user
from datetime import datetime

batch_bp = Blueprint('batch', __name__)

@batch_bp.route('/create', methods=['POST'])
@jwt_required()
@role_required('hod', 'admin')
def create_batch():
    """Create and publish a new batch"""
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # Validate required fields
        required = ['branch', 'year', 'semester', 'section', 'slot_number', 
                   'slot_start_date', 'slot_end_date', 'faculty_ids']
        for field in required:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        if not data['faculty_ids'] or len(data['faculty_ids']) == 0:
            return jsonify({'error': 'At least one faculty must be selected'}), 400
        
        # Validate dates
        try:
            start_date = datetime.strptime(data['slot_start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['slot_end_date'], '%Y-%m-%d').date()
            
            if end_date <= start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Generate batch ID
        college = current_user.college
        department = current_user.department
        branch = data['branch']
        year = data['year']
        semester = data['semester']
        section = data['section']
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        
        batch_id = f"{college}-{department}-{branch}-{year}-{semester}-{section}-{timestamp}"
        
        # Create slot label
        slot_label = 'Previous Feedback Cycle' if data['slot_number'] == 1 else 'Latest Feedback Cycle'
        
        # Create batch
        new_batch = Batch(
            batch_id=batch_id,
            college=college,
            department=department,
            branch=branch,
            year=year,
            semester=semester,
            section=section,
            slot_number=data['slot_number'],
            slot_start_date=start_date,
            slot_end_date=end_date,
            slot_label=slot_label,
            created_by=current_user.user_id
        )
        
        db.session.add(new_batch)
        db.session.flush()  # Get batch ID before committing
        
        # Add faculty to batch
        for faculty_id in data['faculty_ids']:
            faculty = Faculty.query.get(faculty_id)
            if faculty:
                new_batch.faculty.append(faculty)
        
        db.session.commit()
        
        # Generate feedback link
        feedback_link = f"/feedback/{batch_id}"
        
        return jsonify({
            'success': True,
            'message': 'Batch published successfully',
            'batch': new_batch.to_dict(include_faculty=True),
            'feedback_link': feedback_link
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@batch_bp.route('/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    """Get batch details (public endpoint for students)"""
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        
        if not batch:
            return jsonify({'error': 'Invalid feedback link'}), 404
        
        # Check if batch is still active
        today = datetime.utcnow().date()
        if today < batch.slot_start_date or today > batch.slot_end_date:
            return jsonify({
                'error': 'This feedback link is not active',
                'start_date': batch.slot_start_date.isoformat(),
                'end_date': batch.slot_end_date.isoformat()
            }), 400
        
        return jsonify({
            'success': True,
            'batch': batch.to_dict(include_faculty=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@batch_bp.route('/list', methods=['GET'])
@jwt_required()
def get_batches():
    """Get list of batches for current user"""
    try:
        current_user = get_current_user()
        
        if current_user.role == 'admin':
            # Admin sees all batches
            batches = Batch.query.order_by(Batch.created_at.desc()).all()
        else:
            # HoD sees only their batches
            batches = Batch.query.filter_by(
                college=current_user.college,
                department=current_user.department
            ).order_by(Batch.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'count': len(batches),
            'batches': [b.to_dict(include_faculty=False) for b in batches]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@batch_bp.route('/<batch_id>/details', methods=['GET'])
@jwt_required()
def get_batch_details(batch_id):
    """Get detailed batch information with faculty"""
    try:
        current_user = get_current_user()
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Check permissions
        if current_user.role == 'hod':
            if batch.college != current_user.college or batch.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'success': True,
            'batch': batch.to_dict(include_faculty=True)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@batch_bp.route('/<batch_id>/faculty', methods=['GET'])
def get_batch_faculty(batch_id):
    """Get faculty list for a batch (public)"""
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        faculty_list = [f.to_dict() for f in batch.faculty]
        
        return jsonify({
            'success': True,
            'count': len(faculty_list),
            'faculty': faculty_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
