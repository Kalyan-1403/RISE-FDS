"""
Email service for RISE-FDS
Production-ready email sending
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app

logger = logging.getLogger(__name__)


def send_otp_email(to_email, otp_code, user_name=None):
    """Send OTP via email"""
    try:
        smtp_server = current_app.config.get('SMTP_SERVER')
        smtp_port = current_app.config.get('SMTP_PORT')
        smtp_username = current_app.config.get('SMTP_USERNAME')
        smtp_password = current_app.config.get('SMTP_PASSWORD')
        
        if not all([smtp_server, smtp_username, smtp_password]):
            logger.warning("Email configuration incomplete. OTP email not sent.")
            return False
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'RISE FDS - Password Reset OTP'
        msg['From'] = smtp_username
        msg['To'] = to_email
        
        # Plain text version
        text_content = f"""
RISE Feedback Management System

Dear {user_name or 'User'},

Your OTP for password reset is: {otp_code}

This OTP is valid for 10 minutes. Do not share this code with anyone.

If you did not request this password reset, please ignore this email and ensure your account is secure.

Regards,
RISE FDS Team
        """
        
        # HTML version
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #0066CC; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 30px; background: #f9f9f9; }}
        .otp {{ font-size: 32px; font-weight: bold; color: #0066CC; text-align: center; 
                padding: 20px; background: white; border-radius: 8px; margin: 20px 0;
                letter-spacing: 8px; }}
        .warning {{ color: #dc3545; font-size: 14px; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RISE Feedback Management System</h1>
        </div>
        <div class="content">
            <p>Dear <strong>{user_name or 'User'}</strong>,</p>
            <p>You have requested to reset your password. Please use the following OTP:</p>
            <div class="otp">{otp_code}</div>
            <p>This OTP is valid for <strong>10 minutes</strong>.</p>
            <p class="warning">⚠️ Do not share this code with anyone. RISE staff will never ask for your OTP.</p>
        </div>
        <div class="footer">
            <p>If you did not request this password reset, please ignore this email.</p>
            <p>&copy; RISE Educational Institutions</p>
        </div>
    </div>
</body>
</html>
        """
        
        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_username, to_email, msg.as_string())
        
        logger.info(f"OTP email sent to: {to_email[:3]}***")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send OTP email: {str(e)}")
        return False


def send_welcome_email(to_email, user_name, user_id):
    """Send welcome email after account creation"""
    try:
        smtp_server = current_app.config.get('SMTP_SERVER')
        smtp_port = current_app.config.get('SMTP_PORT')
        smtp_username = current_app.config.get('SMTP_USERNAME')
        smtp_password = current_app.config.get('SMTP_PASSWORD')
        
        if not all([smtp_server, smtp_username, smtp_password]):
            return False
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Welcome to RISE FDS'
        msg['From'] = smtp_username
        msg['To'] = to_email
        
        text_content = f"""
Welcome to RISE Feedback Management System!

Dear {user_name},

Your account has been created successfully.
Your User ID: {user_id}

You can now log in to the system to manage faculty feedback.

Regards,
RISE FDS Team
        """
        
        msg.attach(MIMEText(text_content, 'plain'))
        
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_username, to_email, msg.as_string())
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to send welcome email: {str(e)}")
        return False