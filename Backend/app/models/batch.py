from datetime import datetime, timezone


class Batch:
    COLLECTION = 'batches'

    @staticmethod
    def _safe_isoformat(value):
        """
        Returns an ISO 8601 string regardless of whether `value` is a
        datetime/DatetimeWithNanoseconds (Firestore Timestamp) or a plain string.

        Root cause of the old crash: dates were stored as raw JSON strings in
        Firestore (not as Timestamps). On read they came back as str, and
        calling .isoformat() on a str raised AttributeError. The batch route
        now parses date strings into datetime objects before storing (fixing the
        root cause), but this guard keeps to_dict() safe for any legacy
        documents that still have string dates in the collection.
        """
        if value is None:
            return None
        if isinstance(value, str):
            return value  # already a valid ISO string — return as-is
        if hasattr(value, 'isoformat'):
            return value.isoformat()
        return str(value)

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
            'slotStartDate': Batch._safe_isoformat(data.get('slot_start_date')),
            'slotEndDate': Batch._safe_isoformat(data.get('slot_end_date')),
            'slotLabel': data.get('slot_label', ''),
            'totalStudents': data.get('total_students', 0),
            'created': (
                data.get('created_at').strftime('%m/%d/%Y')
                if data.get('created_at') and hasattr(data.get('created_at'), 'strftime')
                else str(data.get('created_at', ''))[:10]
            ),
            'createdTimestamp': (
                int(data.get('created_at').timestamp() * 1000)
                if data.get('created_at') and hasattr(data.get('created_at'), 'timestamp')
                else 0
            ),
            'faculty': faculty_list,
            'responseCount': submission_count,
            'isActive': data.get('is_active', True),
        }