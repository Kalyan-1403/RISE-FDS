"""
SMS service for RISE-FDS
Production-ready SMS sending
"""
import requests
import logging
from flask import current_app

logger = logging.getLogger(__name__)


def send_otp_sms(mobile, otp_code):
    """Send OTP via SMS"""
    try:
        api_key = current_app.config.get('SMS_API_KEY')
        api_url = current_app.config.get('SMS_API_URL')
        sender_id = current_app.config.get('SMS_SENDER_ID', 'RISEFDS')
        
        if not all([api_key, api_url]):
            logger.warning("SMS configuration incomplete. OTP SMS not sent.")
            return False
        
        message = f"Your RISE FDS password reset OTP is: {otp_code}. Valid for 10 minutes. Do not share."
        
        # Generic SMS API call - adjust based on your SMS provider
        payload = {
            'api_key': api_key,
            'sender': sender_id,
            'mobile': mobile,
            'message': message,
            'type': 'OTP'
        }
        
        response = requests.post(api_url, data=payload, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"OTP SMS sent to: {mobile[:2]}****{mobile[-2:]}")
            return True
        else:
            logger.error(f"SMS API error: {response.status_code}")
            return False
        
    except Exception as e:
        logger.error(f"Failed to send OTP SMS: {str(e)}")
        return False


def send_notification_sms(mobile, message):
    """Send general notification SMS"""
    try:
        api_key = current_app.config.get('SMS_API_KEY')
        api_url = current_app.config.get('SMS_API_URL')
        sender_id = current_app.config.get('SMS_SENDER_ID', 'RISEFDS')
        
        if not all([api_key, api_url]):
            return False
        
        payload = {
            'api_key': api_key,
            'sender': sender_id,
            'mobile': mobile,
            'message': message,
            'type': 'TRANS'
        }
        
        response = requests.post(api_url, data=payload, timeout=10)
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Failed to send SMS: {str(e)}")
        return False