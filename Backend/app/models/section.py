from datetime import datetime, timezone

class DepartmentSection:
    COLLECTION = 'department_sections'

    @staticmethod
    def to_dict(doc_id, data):
        return {
            'id': doc_id,
            'college': data.get('college', ''),
            'department': data.get('department', ''),
            'year': data.get('year', ''),
            'sectionName': data.get('section_name', ''),
            'branch': data.get('branch', ''),
            'strength': data.get('strength', 0),
            'isActive': data.get('is_active', True),
            'createdAt': data.get('created_at').isoformat() if data.get('created_at') else None
        }