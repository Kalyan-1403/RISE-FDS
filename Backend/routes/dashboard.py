from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, Faculty, Batch, FeedbackResponse, User
from utils.decorators import get_current_user, role_required
from sqlalchemy import func, distinct

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/hod', methods=['GET'])
@jwt_required()
@role_required('hod')
def hod_dashboard():
    """Get HoD dashboard statistics"""
    try:
        current_user = get_current_user()
        
        # Total faculty count
        faculty_count = Faculty.query.filter_by(
            college=current_user.college,
            department=current_user.department
        ).count()
        
        # Total batches published
        batch_count = Batch.query.filter_by(
            college=current_user.college,
            department=current_user.department
        ).count()
        
        # Total feedback responses received
        # Get all batches for this HoD
        batches = Batch.query.filter_by(
            college=current_user.college,
            department=current_user.department
        ).all()
        
        batch_ids = [b.batch_id for b in batches]
        
        feedback_count = FeedbackResponse.query.filter(
            FeedbackResponse.batch_id.in_(batch_ids)
        ).count() if batch_ids else 0
        
        # Calculate average satisfaction
        if feedback_count > 0:
            feedbacks = FeedbackResponse.query.filter(
                FeedbackResponse.batch_id.in_(batch_ids)
            ).all()
            
            total_avg = sum(f.get_average_rating() for f in feedbacks) / len(feedbacks)
            satisfaction_percentage = round((total_avg / 10) * 100, 1)
        else:
            satisfaction_percentage = 0
        
        # Recent batches
        recent_batches = Batch.query.filter_by(
            college=current_user.college,
            department=current_user.department
        ).order_by(Batch.created_at.desc()).limit(5).all()
        
        # Top performing faculty (by average rating)
        top_faculty = []
        faculty_list = Faculty.query.filter_by(
            college=current_user.college,
            department=current_user.department
        ).all()
        
        for faculty in faculty_list:
            feedbacks = FeedbackResponse.query.filter_by(faculty_id=faculty.id).all()
            if feedbacks:
                avg_rating = sum(f.get_average_rating() for f in feedbacks) / len(feedbacks)
                top_faculty.append({
                    'faculty': faculty.to_dict(),
                    'average_rating': round(avg_rating, 2),
                    'response_count': len(feedbacks)
                })
        
        # Sort by rating and get top 5
        top_faculty.sort(key=lambda x: x['average_rating'], reverse=True)
        top_faculty = top_faculty[:5]
        
        return jsonify({
            'success': True,
            'stats': {
                'faculty_count': faculty_count,
                'batch_count': batch_count,
                'feedback_count': feedback_count,
                'satisfaction_percentage': satisfaction_percentage
            },
            'recent_batches': [b.to_dict(include_faculty=False) for b in recent_batches],
            'top_faculty': top_faculty
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/admin', methods=['GET'])
@jwt_required()
@role_required('admin')
def admin_dashboard():
    """Get Admin dashboard statistics with college-wise breakdown"""
    try:
        # Overall statistics
        total_faculty = Faculty.query.count()
        total_batches = Batch.query.count()
        total_feedback = FeedbackResponse.query.count()
        total_hods = User.query.filter_by(role='hod', is_active=True).count()
        
        # Calculate overall satisfaction
        if total_feedback > 0:
            all_feedbacks = FeedbackResponse.query.all()
            total_avg = sum(f.get_average_rating() for f in all_feedbacks) / len(all_feedbacks)
            overall_satisfaction = round((total_avg / 5) * 100, 1)
        else:
            overall_satisfaction = 0
        
        # College-wise breakdown
        colleges = ['Gandhi', 'Prakasam']
        college_stats = []
        
        for college in colleges:
            college_faculty = Faculty.query.filter_by(college=college).count()
            college_batches = Batch.query.filter_by(college=college).all()
            batch_ids = [b.batch_id for b in college_batches]
            
            college_feedback = FeedbackResponse.query.filter(
                FeedbackResponse.batch_id.in_(batch_ids)
            ).all() if batch_ids else []
            
            if college_feedback:
                avg = sum(f.get_average_rating() for f in college_feedback) / len(college_feedback)
                satisfaction = round((avg / 5) * 100, 1)
            else:
                satisfaction = 0
            
            college_stats.append({
                'college': college,
                'faculty_count': college_faculty,
                'batch_count': len(college_batches),
                'feedback_count': len(college_feedback),
                'satisfaction_percentage': satisfaction
            })
        
        # Department-wise breakdown
        departments = db.session.query(
            Faculty.college,
            Faculty.department,
            func.count(Faculty.id).label('count')
        ).group_by(Faculty.college, Faculty.department).all()
        
        dept_stats = []
        for dept in departments:
            dept_faculty = Faculty.query.filter_by(
                college=dept.college,
                department=dept.department
            ).all()
            
            faculty_ids = [f.id for f in dept_faculty]
            
            dept_feedback = FeedbackResponse.query.filter(
                FeedbackResponse.faculty_id.in_(faculty_ids)
            ).all() if faculty_ids else []
            
            if dept_feedback:
                avg = sum(f.get_average_rating() for f in dept_feedback) / len(dept_feedback)
                satisfaction = round((avg / 5) * 100, 1)
            else:
                satisfaction = 0
            
            dept_stats.append({
                'college': dept.college,
                'department': dept.department,
                'faculty_count': dept.count,
                'feedback_count': len(dept_feedback),
                'satisfaction_percentage': satisfaction
            })
        
        # Recent activity
        recent_batches = Batch.query.order_by(Batch.created_at.desc()).limit(10).all()
        
        return jsonify({
            'success': True,
            'overall_stats': {
                'total_faculty': total_faculty,
                'total_batches': total_batches,
                'total_feedback': total_feedback,
                'total_hods': total_hods,
                'overall_satisfaction': overall_satisfaction
            },
            'college_stats': college_stats,
            'department_stats': dept_stats,
            'recent_batches': [b.to_dict(include_faculty=False) for b in recent_batches]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/faculty-analytics', methods=['GET'])
@jwt_required()
@role_required('admin')
def faculty_analytics():
    """Get detailed faculty analytics for admin"""
    try:
        # Get all faculty with their feedback stats
        faculty_list = Faculty.query.all()
        
        analytics = []
        for faculty in faculty_list:
            feedbacks = FeedbackResponse.query.filter_by(faculty_id=faculty.id).all()
            
            if feedbacks:
                avg_rating = sum(f.get_average_rating() for f in feedbacks) / len(feedbacks)
                satisfaction = round((avg_rating / 5) * 100, 1)
                
                # Get slot-wise breakdown
                slot1 = [f for f in feedbacks if f.slot_number == 1]
                slot2 = [f for f in feedbacks if f.slot_number == 2]
                
                slot1_avg = sum(f.get_average_rating() for f in slot1) / len(slot1) if slot1 else 0
                slot2_avg = sum(f.get_average_rating() for f in slot2) / len(slot2) if slot2 else 0
                
                analytics.append({
                    'faculty': faculty.to_dict(),
                    'total_responses': len(feedbacks),
                    'average_rating': round(avg_rating, 2),
                    'satisfaction_percentage': satisfaction,
                    'slot1_avg': round(slot1_avg, 2),
                    'slot2_avg': round(slot2_avg, 2),
                    'improvement': round(slot2_avg - slot1_avg, 2) if slot1 and slot2 else 0
                })
        
        # Sort by satisfaction
        analytics.sort(key=lambda x: x['satisfaction_percentage'], reverse=True)
        
        return jsonify({
            'success': True,
            'count': len(analytics),
            'analytics': analytics
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
