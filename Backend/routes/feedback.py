from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, FeedbackResponse, Batch, Faculty
from utils.validators import validate_rating
from utils.decorators import get_current_user, role_required
from sqlalchemy import func
from datetime import datetime

feedback_bp = Blueprint('feedback', __name__)

# 15 parameter names for reference
PARAMETERS = [
    'Knowledge of the subject',
    'Coming well prepared for the class',
    'Giving clear explanations',
    'Command of language',
    'Clear and audible voice',
    'Holding the attention of students through the class',
    'Providing more matter than in the textbooks',
    'Capability to clear the doubts of students',
    'Encouraging students to ask questions and participate',
    'Appreciating students as and when deserving',
    'Willingness to help students even out of the class',
    'Return of valued test papers/records in time',
    'Punctuality and following timetable schedule',
    'Coverage of syllabus',
    'Impartial (teaching all students alike)'
]

@feedback_bp.route('/submit', methods=['POST'])
def submit_feedback():
    """Submit student feedback (public endpoint)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('batch_id'):
            return jsonify({'error': 'Batch ID is required'}), 400
        
        if not data.get('responses') or len(data['responses']) == 0:
            return jsonify({'error': 'Feedback responses are required'}), 400
        
        # Verify batch exists
        batch = Batch.query.filter_by(batch_id=data['batch_id']).first()
        if not batch:
            return jsonify({'error': 'Invalid batch ID'}), 404
        
        # Check if batch is active
        today = datetime.utcnow().date()
        if today < batch.slot_start_date or today > batch.slot_end_date:
            return jsonify({'error': 'This feedback period is not active'}), 400
        
        # Get client IP
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        # Process each faculty feedback
        saved_count = 0
        for response in data['responses']:
            faculty_id = response.get('faculty_id')
            ratings = response.get('ratings', {})
            
            if not faculty_id:
                continue
            
            # Validate all 15 ratings
            rating_values = []
            for i in range(1, 16):
                param_key = f'param{i}'
                rating = ratings.get(param_key)
                
                if not rating:
                    return jsonify({'error': f'Missing rating for parameter {i}'}), 400
                
                valid, msg = validate_rating(rating)
                if not valid:
                    return jsonify({'error': f'Invalid rating for parameter {i}: {msg}'}), 400
                
                rating_values.append(int(rating))
            
            # Create feedback response
            feedback = FeedbackResponse(
                batch_id=data['batch_id'],
                faculty_id=faculty_id,
                slot_number=batch.slot_number,
                param1_rating=rating_values[0],
                param2_rating=rating_values[1],
                param3_rating=rating_values[2],
                param4_rating=rating_values[3],
                param5_rating=rating_values[4],
                param6_rating=rating_values[5],
                param7_rating=rating_values[6],
                param8_rating=rating_values[7],
                param9_rating=rating_values[8],
                param10_rating=rating_values[9],
                param11_rating=rating_values[10],
                param12_rating=rating_values[11],
                param13_rating=rating_values[12],
                param14_rating=rating_values[13],
                param15_rating=rating_values[14],
                comments=response.get('comments', ''),
                student_ip=client_ip
            )
            
            db.session.add(feedback)
            saved_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully',
            'responses_saved': saved_count
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@feedback_bp.route('/batch/<batch_id>/count', methods=['GET'])
def get_batch_feedback_count(batch_id):
    """Get feedback response count for a batch"""
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Count unique submissions (group by student_ip or submitted_at)
        count = db.session.query(
            func.count(func.distinct(FeedbackResponse.submitted_at))
        ).filter(
            FeedbackResponse.batch_id == batch_id
        ).scalar()
        
        return jsonify({
            'success': True,
            'batch_id': batch_id,
            'response_count': count
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@feedback_bp.route('/faculty/<int:faculty_id>/stats', methods=['GET'])
@jwt_required()
def get_faculty_stats(faculty_id):
    """Get statistical analysis for a faculty member"""
    try:
        current_user = get_current_user()
        faculty = Faculty.query.get(faculty_id)
        
        if not faculty:
            return jsonify({'error': 'Faculty not found'}), 404
        
        # Check permissions
        if current_user.role == 'hod':
            if faculty.college != current_user.college or faculty.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        # Get all feedback for this faculty
        feedbacks = FeedbackResponse.query.filter_by(faculty_id=faculty_id).all()
        
        if not feedbacks:
            return jsonify({
                'success': True,
                'faculty': faculty.to_dict(),
                'stats': {
                    'total_responses': 0,
                    'average_overall': 0,
                    'parameter_averages': {}
                }
            }), 200
        
        # Calculate statistics
        total_responses = len(feedbacks)
        
        # Calculate average for each parameter
        param_averages = {}
        for i in range(1, 16):
            param_name = f'param{i}_rating'
            param_sum = sum(getattr(f, param_name) for f in feedbacks)
            param_averages[PARAMETERS[i-1]] = round(param_sum / total_responses, 2)
        
        # Calculate overall average
        overall_avg = sum(param_averages.values()) / len(param_averages)
        
        # Get slot-wise breakdown
        slot1_count = len([f for f in feedbacks if f.slot_number == 1])
        slot2_count = len([f for f in feedbacks if f.slot_number == 2])
        
        return jsonify({
            'success': True,
            'faculty': faculty.to_dict(),
            'stats': {
                'total_responses': total_responses,
                'slot1_responses': slot1_count,
                'slot2_responses': slot2_count,
                'average_overall': round(overall_avg, 2),
                'satisfaction_percentage': round((overall_avg / 10) * 100, 1),
                'parameter_averages': param_averages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@feedback_bp.route('/batch/<batch_id>/stats', methods=['GET'])
@jwt_required()
def get_batch_stats(batch_id):
    """Get statistics for all faculty in a batch"""
    try:
        current_user = get_current_user()
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Check permissions
        if current_user.role == 'hod':
            if batch.college != current_user.college or batch.department != current_user.department:
                return jsonify({'error': 'Access denied'}), 403
        
        faculty_stats = []
        
        for faculty in batch.faculty:
            feedbacks = FeedbackResponse.query.filter_by(
                batch_id=batch_id,
                faculty_id=faculty.id
            ).all()
            
            if feedbacks:
                avg = sum(f.get_average_rating() for f in feedbacks) / len(feedbacks)
                faculty_stats.append({
                    'faculty': faculty.to_dict(),
                    'response_count': len(feedbacks),
                    'average_rating': round(avg, 2),
                    'satisfaction_percentage': round((avg / 10) * 100, 1)
                })
        
        return jsonify({
            'success': True,
            'batch': batch.to_dict(include_faculty=False),
            'faculty_stats': faculty_stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
