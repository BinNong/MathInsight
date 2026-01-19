from flask import Flask
from flask_cors import CORS
from app.routes.calculus import calculus_bp
from app.routes.linear_algebra import linear_algebra_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register blueprints
    app.register_blueprint(calculus_bp, url_prefix='/api/calculus')
    app.register_blueprint(linear_algebra_bp, url_prefix='/api/linear-algebra')

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'MathInsight API is running'}

    return app
