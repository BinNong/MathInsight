from flask import Flask
from flask_cors import CORS
from app.routes.calculus import calculus_bp
from app.routes.linear_algebra import linear_algebra_bp
from app.routes.probability import probability_bp
from app.routes.multivariate import multivariate_bp
from app.routes.vector_field import vector_field_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register blueprints
    app.register_blueprint(calculus_bp, url_prefix='/api/calculus')
    app.register_blueprint(linear_algebra_bp, url_prefix='/api/linear-algebra')
    app.register_blueprint(probability_bp, url_prefix='/api/probability')
    app.register_blueprint(multivariate_bp, url_prefix='/api/multivariate')
    app.register_blueprint(vector_field_bp, url_prefix='/api/vector-field')

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'MathInsight API is running'}

    return app
