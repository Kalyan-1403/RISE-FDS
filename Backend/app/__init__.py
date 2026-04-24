import os
import logging
from flask import Flask, jsonify

from .config import config_map
from .extensions import db, jwt, cors, limiter, is_token_revoked

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config_map.get(config_name, config_map['development']))

    # --- Initialize Extensions ---
    jwt.init_app(app)
    limiter.init_app(app)

    # --- CORS ---
    # We add your Firebase URL directly to the list
    allowed_origins = app.config.get('CORS_ORIGINS', [
        'http://localhost:5173', 
        'https://rise-fds.web.app' # <--- Added your live site
    ])
    
    if isinstance(allowed_origins, str):
        allowed_origins = [o.strip() for o in allowed_origins.split(',')]

    cors.init_app(
        app,
        # Changed pattern to match all routes starting with /
        resources={r"/*": {
            "origins": allowed_origins,
            "supports_credentials": True,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }},
    )

    # --- Talisman: ONLY in production ---
    if not app.config.get('TESTING') and not app.config.get('DEBUG'):
        try:
            from flask_talisman import Talisman
            Talisman(
                app,
                force_https=True,
                strict_transport_security=True,
                strict_transport_security_max_age=31536000,
                content_security_policy={
                    'default-src': "'self'",
                    'script-src': "'self'",
                    'style-src': ["'self'", "'unsafe-inline'"],
                    'img-src': ["'self'", "data:"],
                    'font-src': "'self'",
                },
            )
            logger.info("🔒 Talisman enabled (production)")
        except ImportError:
            logger.warning("Flask-Talisman not installed")
    else:
        logger.info("🔓 Talisman disabled (development)")

    # --- JWT Blocks ---
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        return is_token_revoked(jwt_payload["jti"])

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token has expired", "code": "TOKEN_EXPIRED"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": "Invalid token", "code": "INVALID_TOKEN"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"error": "Authorization token required", "code": "MISSING_TOKEN"}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token has been revoked", "code": "REVOKED_TOKEN"}), 401

    # --- Register Blueprints ---
    from .routes.auth import auth_bp
    from .routes.faculty import faculty_bp
    from .routes.feedback import feedback_bp
    from .routes.batch import batch_bp
    from .routes.dashboard import dashboard_bp
    from .routes.reports import reports_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(faculty_bp, url_prefix='/api/faculty')
    app.register_blueprint(feedback_bp, url_prefix='/api/feedback')
    app.register_blueprint(batch_bp, url_prefix='/api/batch')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')

    # --- Health Check (Now checks Firestore) ---
    @app.route('/api/health', methods=['GET'])
    def health_check():
        try:
            # Ping Firestore to ensure connectivity
            list(db.collection('users').limit(1).stream())
            db_status = 'connected'
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            db_status = 'disconnected'

        return jsonify({
            "status": "healthy",
            "database": db_status,
        }), 200

    # --- Global Error Handlers ---
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(429)
    def rate_limit_error(error):
        return jsonify({"error": "Too many requests. Please slow down."}), 429

    logger.info(f"✅ App created with '{config_name}' configuration")
    return app