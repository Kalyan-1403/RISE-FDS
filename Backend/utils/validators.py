import re
from email_validator import validate_email, EmailNotValidError
import phonenumbers

def validate_email_format(email):
    """Validate email format"""
    try:
        validate_email(email)
        return True, None
    except EmailNotValidError as e:
        return False, str(e)

def validate_mobile_format(mobile):
    """Validate Indian mobile number"""
    pattern = r'^[6-9]\d{9}$'
    if re.match(pattern, mobile):
        return True, None
    return False, "Invalid mobile number format. Must be 10 digits starting with 6-9."

def validate_password_strength(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    strength = 0
    if re.search(r'[a-z]', password):
        strength += 25
    if re.search(r'[A-Z]', password):
        strength += 25
    if re.search(r'\d', password):
        strength += 25
    if re.search(r'[$@#&!]', password):
        strength += 25
    
    if strength < 50:
        return False, "Password is too weak. Use uppercase, lowercase, numbers, and special characters."
    
    return True, None

def validate_rating(rating):
    """Validate rating is between 1 and 10"""
    try:
        rating_int = int(rating)
        if 1 <= rating_int <= 10:
            return True, None
        return False, "Rating must be between 1 and 10"
    except:
        return False, "Rating must be a number"
