from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config, get_config
from models import db
import os
import logging
from logging.handlers import RotatingFileHandler

def create_app(config_name=None):
    """Application factory pattern"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Configure logging for production
    if config_name == 'production':
        configure_logging(app)
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    jwt = JWTManager(app)
    
    # Initialize CORS with strict settings
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "supports_credentials": True,
            "max_age": 3600
        }
    })
    
    # Initialize Rate Limiter
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        storage_uri=app.config['RATELIMIT_STORAGE_URL'],
        default_limits=["200 per day", "50 per hour"]
    )
    
    # Store limiter on app for use in routes
    app.limiter = limiter
    
    # Create upload folder if not exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Security headers middleware
    @app.after_request
    def add_security_headers(response):
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # XSS protection
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Referrer policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Content Security Policy for production
        if config_name == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        
        return response
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.faculty import faculty_bp
    from routes.batch import batch_bp
    from routes.feedback import feedback_bp
    from routes.dashboard import dashboard_bp
    from routes.reports import reports_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(faculty_bp, url_prefix='/api/faculty')
    app.register_blueprint(batch_bp, url_prefix='/api/batch')
    app.register_blueprint(feedback_bp, url_prefix='/api/feedback')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    
    # Root route
    @app.route('/')
    def index():
        return jsonify({
            'message': 'RISE Feedback Management System API',
            'version': '2.0.0',
            'status': 'running',
            'environment': config_name,
            'endpoints': {
                'auth': '/api/auth',
                'faculty': '/api/faculty',
                'batch': '/api/batch',
                'feedback': '/api/feedback',
                'dashboard': '/api/dashboard',
                'reports': '/api/reports'
            }
        })
    
    # Health check
    @app.route('/health')
    def health():
        try:
            # Check database connection
            db.session.execute(db.text('SELECT 1'))
            return jsonify({'status': 'healthy', 'database': 'connected'}), 200
        except Exception as e:
            app.logger.error(f"Health check failed: {str(e)}")
            return jsonify({'status': 'unhealthy', 'database': 'disconnected'}), 503
    
    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request'}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden'}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        app.logger.error(f"Internal server error: {str(error)}")
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(429)
    def ratelimit_handler(e):
        app.logger.warning(f"Rate limit exceeded: {request.remote_addr}")
        return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization token is missing'}), 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has been revoked'}), 401
    
    return app


def configure_logging(app):
    """Configure logging for production"""
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    file_handler = RotatingFileHandler(
        'logs/rise_fds.log',
        maxBytes=10240000,  # 10MB
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('RISE-FDS startup')


# WSGI entry point for production (Gunicorn)
application = create_app(os.environ.get('FLASK_ENV', 'production'))

if __name__ == '__main__':
    # Development server only - NEVER use in production
    import sys
    env = os.environ.get('FLASK_ENV', 'development')
    
    if env == 'production':
        print("ERROR: Do not run this directly in production!")
        print("Use: gunicorn -w 4 -b 0.0.0.0:5000 app:application")
        sys.exit(1)
    
    app = create_app('development')
    app.run(debug=True, host='127.0.0.1', port=5000)