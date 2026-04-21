import multiprocessing
import os

# Server
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = 1
threads = 2
worker_class = "gthread"
timeout = 60
graceful_timeout = 20
keepalive = 2

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

_trusted_ips = os.environ.get("TRUSTED_PROXY_IPS", "127.0.0.1")
forwarded_allow_ips = _trusted_ips

secure_scheme_headers = {
    "X-Forwarded-Proto": "https",
}