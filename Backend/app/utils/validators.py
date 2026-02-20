import re
import bleach


def sanitize_string(value, max_length=500):
    """Sanitize input string: strip HTML, trim whitespace, enforce length."""
    if not isinstance(value, str):
        return ''
    cleaned = bleach.clean(value, tags=[], strip=True)
    return cleaned.strip()[:max_length]


def validate_name(name):
    """Only letters, spaces, dots allowed."""
    if not name or len(name.strip()) < 2:
        return False, 'Name must be at least 2 characters'
    if not re.match(r'^[A-Za-z\s.]+$', name.strip()):
        return False, 'Name must contain only letters, spaces, and dots'
    return True, ''


def validate_subject(subject):
    """Letters, spaces, common punctuation."""
    if not subject or len(subject.strip()) < 2:
        return False, 'Subject must be at least 2 characters'
    if not re.match(r'^[A-Za-z\s&\-()\.,]+$', subject.strip()):
        return False, 'Subject contains invalid characters'
    return True, ''


def validate_code(code):
    """Alphanumeric only."""
    if not code or len(code.strip()) < 2:
        return False, 'Code must be at least 2 characters'
    if not re.match(r'^[A-Za-z0-9]+$', code.strip()):
        return False, 'Code must be alphanumeric only'
    return True, ''


def validate_email(email):
    if not email:
        return False, 'Email is required'
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(pattern, email):
        return False, 'Invalid email format'
    return True, ''


def validate_mobile(mobile):
    if not mobile:
        return False, 'Mobile is required'
    if not re.match(r'^[6-9]\d{9}$', mobile):
        return False, 'Invalid Indian mobile number'
    return True, ''


def validate_password(password):
    if not password or len(password) < 8:
        return False, 'Password must be at least 8 characters'
    return True, ''


def validate_rating(rating):
    try:
        r = int(rating)
        if 1 <= r <= 10:
            return True, ''
        return False, 'Rating must be between 1 and 10'
    except (ValueError, TypeError):
        return False, 'Rating must be a number'