import multiprocessing
import os

# Server
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = 1
worker_class = "sync"
timeout = 120
graceful_timeout = 30
keepalive = 5

# Performance
preload_app = False

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# FIX (HIGH): Restrict X-Forwarded-For trust to Render's internal proxy only.
# Setting "*" previously allowed any client to spoof their IP and bypass
# the feedback duplicate-submission check.
# Set TRUSTED_PROXY_IPS in your Render environment variables.
# Render's internal network is typically 10.x.x.x — confirm in your dashboard.
_trusted_ips = os.environ.get("TRUSTED_PROXY_IPS", "127.0.0.1")
forwarded_allow_ips = _trusted_ips

secure_scheme_headers = {
    "X-Forwarded-Proto": "https",
}
