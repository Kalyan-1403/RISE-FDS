from datetime import datetime, timezone

class Faculty:
    COLLECTION = 'faculty'

    @staticmethod
    def to_dict(doc_id, data):
        return {
            'id': doc_id,
            'name': data.get('name', ''),
            'subject': data.get('subject', ''),
            'year': data.get('year', ''),
            'sem': data.get('semester', ''),
            'sec': data.get('section', ''),
            'branch': data.get('branch', ''),
            'dept': data.get('department', ''),
            'college': data.get('college', ''),
            'addedDate': (
                data.get('created_at').strftime('%m/%d/%Y')
                if data.get('created_at') else None
            ),
            'isActive': data.get('is_active', True)
        }