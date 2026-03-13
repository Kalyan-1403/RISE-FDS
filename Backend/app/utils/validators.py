import re
import bleach


def sanitize_string(value, max_length=500):
    """Strip all HTML tags and truncate to max_length."""
    if not isinstance(value, str):
        return ''
    cleaned = bleach.clean(value, tags=[], strip=True)
    return cleaned.strip()[:max_length]


def validate_name(name):
    if not name or len(name.strip()) < 2:
        return False, 'Name must be at least 2 characters'
    if len(name.strip()) > 150:
        return False, 'Name must be 150 characters or fewer'
    if not re.match(r'^[A-Za-z\s.]+$', name.strip()):
        return False, 'Name must contain only letters, spaces, and dots'
    return True, ''


def validate_subject(subject):
    if not subject or len(subject.strip()) < 2:
        return False, 'Subject must be at least 2 characters'
    if len(subject.strip()) > 200:
        return False, 'Subject must be 200 characters or fewer'
    if not re.match(r'^[A-Za-z\s&\-()\.,]+$', subject.strip()):
        return False, 'Subject contains invalid characters'
    return True, ''


def validate_code(code):
    if not code or len(code.strip()) < 2:
        return False, 'Code must be at least 2 characters'
    if len(code.strip()) > 20:
        return False, 'Code must be 20 characters or fewer'
    if not re.match(r'^[A-Za-z0-9]+$', code.strip()):
        return False, 'Code must be alphanumeric only'
    return True, ''


def validate_email(email):
    if not email:
        return False, 'Email is required'
    if len(email) > 150:
        return False, 'Email must be 150 characters or fewer'
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(pattern, email):
        return False, 'Invalid email format'
    return True, ''


def validate_mobile(mobile):
    if not mobile:
        return False, 'Mobile number is required'
    if not re.match(r'^[6-9]\d{9}$', mobile):
        return False, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'
    return True, ''


def validate_password(password):
    if not password or len(password) < 8:
        return False, 'Password must be at least 8 characters'
    if len(password) > 128:
        return False, 'Password must be 128 characters or fewer'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain at least one uppercase letter'
    if not re.search(r'[a-z]', password):
        return False, 'Password must contain at least one lowercase letter'
    if not re.search(r'[0-9]', password):
        return False, 'Password must contain at least one number'
    if not re.search(r'[$@#&!]', password):
        return False, 'Password must contain a special character ($, @, #, &, or !)'
    return True, ''


def validate_rating(rating):
    """Validate that a rating is an integer between 1 and 10."""
    try:
        r = int(rating)
        if 1 <= r <= 10:
            return True, ''
        return False, 'Rating must be between 1 and 10'
    except (ValueError, TypeError):
        return False, 'Rating must be a number'


def validate_batch_id(batch_id):
    """Validate batch ID format — alphanumeric with dashes."""
    if not batch_id or len(batch_id) < 5:
        return False, 'Invalid batch ID'
    if len(batch_id) > 200:
        return False, 'Batch ID too long'
    if not re.match(r'^[A-Za-z0-9\-_]+$', batch_id):
        return False, 'Batch ID contains invalid characters'
    return True, ''