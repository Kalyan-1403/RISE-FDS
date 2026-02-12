# ===========================================
# RISE-FDS Backend Production Dockerfile
# ===========================================
# Multi-stage build for smaller, secure image

# Stage 1: Builder
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt


# Stage 2: Production
FROM python:3.11-slim as production

# Labels
LABEL maintainer="Kalyan-1403"
LABEL description="RISE Feedback Data System Backend"
LABEL version="2.0.0"

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Set work directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY --chown=appuser:appgroup . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/logs /app/instance && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:5000/health || exit 1

# Default command - Run with Gunicorn
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--threads", "2", \
     "--worker-class", "gthread", \
     "--worker-tmp-dir", "/dev/shm", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--capture-output", \
     "--enable-stdio-inheritance", \
     "app:application"]