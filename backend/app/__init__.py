from flask import Flask, send_from_directory
from flask_cors import CORS
import os
from app.routes.calculus import calculus_bp
from app.routes.linear_algebra import linear_algebra_bp
from app.routes.probability import probability_bp
from app.routes.multivariate import multivariate_bp
from app.routes.vector_field import vector_field_bp
from app.routes.manim import manim_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # 获取downloads目录路径
    downloads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'downloads')
    os.makedirs(downloads_dir, exist_ok=True)

    # Register blueprints
    app.register_blueprint(calculus_bp, url_prefix='/api/calculus')
    app.register_blueprint(linear_algebra_bp, url_prefix='/api/linear-algebra')
    app.register_blueprint(probability_bp, url_prefix='/api/probability')
    app.register_blueprint(multivariate_bp, url_prefix='/api/multivariate')
    app.register_blueprint(vector_field_bp, url_prefix='/api/vector-field')
    app.register_blueprint(manim_bp, url_prefix='/api/manim')

    # 提供视频文件下载服务
    @app.route('/downloads/<path:filename>')
    def download_file(filename):
        return send_from_directory(downloads_dir, filename)

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'MathInsight API is running'}

    return app
