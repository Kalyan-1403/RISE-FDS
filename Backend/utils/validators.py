"""
Input validation utilities for RISE-FDS
Production-ready validation functions
"""
import re
from email_validator import validate_email, EmailNotValidError


def validate_email_format(email):
    """Validate email format"""
    if not email:
        return False, "Email is required"
    
    try:
        # Validate and normalize email
        valid = validate_email(email, check_deliverability=False)
        return True, None
    except EmailNotValidError as e:
        return False, str(e)


def validate_mobile_format(mobile):
    """Validate Indian mobile number"""
    if not mobile:
        return False, "Mobile number is required"
    
    # Remove any spaces or dashes
    mobile = re.sub(r'[\s\-]', '', mobile)
    
    # Indian mobile: 10 digits starting with 6-9
    pattern = r'^[6-9]\d{9}$'
    if re.match(pattern, mobile):
        return True, None
    
    return False, "Invalid mobile number format. Must be 10 digits starting with 6-9."


def validate_password_strength(password):
    """Validate password strength with detailed requirements"""
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password must be less than 128 characters"
    
    errors = []
    
    if not re.search(r'[a-z]', password):
        errors.append("lowercase letter")
    
    if not re.search(r'[A-Z]', password):
        errors.append("uppercase letter")
    
    if not re.search(r'\d', password):
        errors.append("number")
    
    if not re.search(r'[$@#&!%^*()_+=\-\[\]{};:\'",.<>?/\\|`~]', password):
        errors.append("special character")
    
    if errors:
        return False, f"Password must contain at least one: {', '.join(errors)}"
    
    # Check for common patterns
    common_patterns = ['password', '123456', 'qwerty', 'admin', 'user']
    if any(pattern in password.lower() for pattern in common_patterns):
        return False, "Password is too common. Please choose a stronger password."
    
    return True, None


def validate_rating(rating):
    """Validate rating is between 1 and 10"""
    try:
        rating_int = int(rating)
        if 1 <= rating_int <= 10:
            return True, None
        return False, "Rating must be between 1 and 10"
    except (ValueError, TypeError):
        return False, "Rating must be a number"


def validate_batch_id(batch_id):
    """Validate batch ID format"""
    if not batch_id:
        return False, "Batch ID is required"
    
    if len(batch_id) > 200:
        return False, "Batch ID is too long"
    
    # Only allow alphanumeric, hyphens, underscores
    if not re.match(r'^[\w\-]+$', batch_id):
        return False, "Batch ID contains invalid characters"
    
    return True, None


def sanitize_string(value, max_length=255):
    """Sanitize string input"""
    if not value:
        return ""
    
    # Convert to string and strip whitespace
    value = str(value).strip()
    
    # Remove null bytes and control characters
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    
    # Limit length
    if len(value) > max_length:
        value = value[:max_length]
    
    return value