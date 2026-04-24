from datetime import datetime, timezone

class FeedbackSubmission:
    COLLECTION = 'feedback_submissions'

    @staticmethod
    def create_submission_data(batch_id, slot, comments, ip_address, ratings_map):
        """
        Formats the submission to be inserted as a single Firestore document.
        ratings_map MUST be structured as a nested dictionary:
        {
            "faculty_id_1": { "parameter1": 10, "parameter2": 8 },
            "faculty_id_2": { "parameter1": 9, "parameter2": 9 }
        }
        """
        return {
            'batch_id': batch_id,
            'slot': slot,
            'comments': comments,
            'ip_address': ip_address,
            'ratings': ratings_map,
            'submitted_at': datetime.now(timezone.utc)
        }