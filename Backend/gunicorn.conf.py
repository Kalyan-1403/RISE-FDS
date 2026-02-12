"""
Gunicorn configuration for production deployment
"""
import multiprocessing
import os

# Server Socket
bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:5000')
backlog = 2048

# Worker Processes
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2

# Server Mechanics
daemon = False
pidfile = '/tmp/gunicorn.pid'
umask = 0
user = None
group = None
tmp_upload_dir = None

# Logging
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info')
accesslog = '-'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process Naming
proc_name = 'rise-fds'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190