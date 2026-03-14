"""
Email utility for OTP delivery.

Configure the following environment variables in Render:
  SMTP_HOST       — e.g. smtp.sendgrid.net  |  smtp.gmail.com
  SMTP_PORT       — 587 (STARTTLS) or 465 (SSL)
  SMTP_USER       — your SMTP username / SendGrid API key string "apikey"
  SMTP_PASSWORD   — your SMTP password / SendGrid API key
  SMTP_FROM_EMAIL — the verified sender address, e.g. noreply@rise.edu

For Gmail:  SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=you@gmail.com
For SendGrid: SMTP_HOST=smtp.sendgrid.net  SMTP_PORT=587  SMTP_USER=apikey
              SMTP_PASSWORD=<your_sendgrid_api_key>
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

_SMTP_HOST = os.environ.get('SMTP_HOST')
_SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
_SMTP_USER = os.environ.get('SMTP_USER')
_SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
_SMTP_FROM = os.environ.get('SMTP_FROM_EMAIL', 'noreply@rise.edu')
_IS_PROD = os.environ.get('FLASK_ENV', 'development') == 'production'


def _build_otp_email(to_email: str, user_id: str, otp: str) -> MIMEMultipart:
    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'RISE FDS — Password Reset OTP'
    msg['From'] = _SMTP_FROM
    msg['To'] = to_email

    plain = (
        f"Hello,\n\n"
        f"You requested a password reset for your RISE FDS account ({user_id}).\n\n"
        f"Your One-Time Password (OTP) is:  {otp}\n\n"
        f"This OTP expires in 10 minutes. Do not share it with anyone.\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"— RISE Krishna Sai Prakasam Group of Institutions"
    )

    html = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
      <div style="background:#1E3A5F;padding:20px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;">RISE FDS — Password Reset</h2>
      </div>
      <div style="border:1px solid #ddd;padding:24px;border-radius:0 0 8px 8px;">
        <p>Hello,</p>
        <p>You requested a password reset for account <strong>{user_id}</strong>.</p>
        <p>Your One-Time Password is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;
                    background:#f4f4f4;padding:16px;text-align:center;
                    border-radius:4px;margin:16px 0;">{otp}</div>
        <p style="color:#888;font-size:13px;">
          This OTP expires in <strong>10 minutes</strong>.
          Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #eee;">
        <p style="color:#aaa;font-size:12px;">
          RISE Krishna Sai Prakasam Group of Institutions
        </p>
      </div>
    </body></html>
    """

    msg.attach(MIMEText(plain, 'plain'))
    msg.attach(MIMEText(html, 'html'))
    return msg


def send_otp_email(to_email: str, user_id: str, otp: str) -> bool:
    """
    Send OTP to the user's email address.

    Returns True on success, False on failure.
    In development (no SMTP configured), logs the OTP to console only.
    """
    if not _IS_PROD:
        # Development only — print OTP to console so you can test locally
        logger.info(
            f"[DEV MODE] OTP for {user_id} → {otp}  "
            f"(configure SMTP_* env vars to enable real email delivery)"
        )
        return True

    # Production: require SMTP configuration
    if not all([_SMTP_HOST, _SMTP_USER, _SMTP_PASSWORD]):
        logger.error(
            "Email delivery failed: SMTP_HOST, SMTP_USER, and SMTP_PASSWORD "
            "must be set in Render environment variables."
        )
        return False

    try:
        msg = _build_otp_email(to_email, user_id, otp)

        if _SMTP_PORT == 465:
            # SSL
            with smtplib.SMTP_SSL(_SMTP_HOST, _SMTP_PORT, timeout=10) as server:
                server.login(_SMTP_USER, _SMTP_PASSWORD)
                server.sendmail(_SMTP_FROM, to_email, msg.as_string())
        else:
            # STARTTLS (port 587)
            with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(_SMTP_USER, _SMTP_PASSWORD)
                server.sendmail(_SMTP_FROM, to_email, msg.as_string())

        logger.info(f"OTP email sent successfully to {to_email} for user {user_id}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("OTP email failed: SMTP authentication error — check SMTP_USER / SMTP_PASSWORD")
        return False
    except smtplib.SMTPRecipientsRefused:
        logger.error(f"OTP email failed: recipient refused — {to_email}")
        return False
    except Exception as exc:
        logger.error(f"OTP email failed unexpectedly for {user_id}: {exc}")
        return False
