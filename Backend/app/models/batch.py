from datetime import datetime, timezone

class Batch:
    COLLECTION = 'batches'

    @staticmethod
    def to_dict(doc_id, data, submission_count=0):
        # In Firestore, faculty data is embedded directly in the batch document
        faculty_list = data.get('faculty', [])
        
        return {
            'id': data.get('batch_id', doc_id),
            'college': data.get('college', ''),
            'dept': data.get('department', ''),
            'branch': data.get('branch', ''),
            'year': data.get('year', ''),
            'sem': data.get('semester', ''),
            'sec': data.get('section', ''),
            'slot': data.get('slot', 1),
            'slotStartDate': data.get('slot_start_date').isoformat() if data.get('slot_start_date') else None,
            'slotEndDate': data.get('slot_end_date').isoformat() if data.get('slot_end_date') else None,
            'slotLabel': data.get('slot_label', ''),
            'totalStudents': data.get('total_students', 0),
            'created': data.get('created_at').strftime('%m/%d/%Y') if data.get('created_at') else None,
            'createdTimestamp': int(data.get('created_at').timestamp() * 1000) if data.get('created_at') else 0,
            'faculty': faculty_list,
            'responseCount': submission_count,
            'isActive': data.get('is_active', True)
        }