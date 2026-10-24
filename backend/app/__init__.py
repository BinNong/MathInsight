from flask import Flask, abort, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from app.config import Config
from app.routes.calculus import calculus_bp
from app.routes.linear_algebra import linear_algebra_bp
from app.routes.probability import probability_bp
from app.routes.multivariate import multivariate_bp
from app.routes.vector_field import vector_field_bp
from app.routes.manim import manim_bp
from app.routes.solver import solver_bp
from app.routes.knowledge_graph import knowledge_graph_bp
from app.utils.cleanup import cleanup_manim_temp_files, schedule_periodic_cleanup


def create_app():
    app = Flask(__name__)

    # 按环境配置 CORS 来源，生产环境默认只信任同源请求
    origins = [origin.strip() for origin in Config.ALLOWED_ORIGINS.split(',') if origin.strip()]
    if not origins:
        origins = ['*']
    CORS(app, resources={
        r"/api/*": {"origins": origins},
        r"/downloads/*": {"origins": origins},
    })

    # 获取downloads目录路径
    downloads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'downloads')
    os.makedirs(downloads_dir, exist_ok=True)

    # 启动时清理过期临时文件，并启动定时清理线程
    try:
        cleanup_manim_temp_files(downloads_dir)
        schedule_periodic_cleanup(downloads_dir)
    except Exception:
        pass

    # Register blueprints
    app.register_blueprint(calculus_bp, url_prefix='/api/calculus')
    app.register_blueprint(linear_algebra_bp, url_prefix='/api/linear-algebra')
    app.register_blueprint(probability_bp, url_prefix='/api/probability')
    app.register_blueprint(multivariate_bp, url_prefix='/api/multivariate')
    app.register_blueprint(vector_field_bp, url_prefix='/api/vector-field')
    app.register_blueprint(manim_bp, url_prefix='/api/manim')
    app.register_blueprint(solver_bp, url_prefix='/api/solver')
    app.register_blueprint(knowledge_graph_bp, url_prefix='/api/knowledge-graph')

    # 提供视频与字幕文件下载服务
    @app.route('/downloads/<path:filename>')
    def download_file(filename):
        safe_name = secure_filename(filename)
        # secure_filename 会移除路径分隔符，若结果为空或试图访问内部目录则拒绝
        if not safe_name or safe_name != filename or safe_name.startswith('.'):
            abort(404)
        mimetype = None
        if safe_name.lower().endswith('.vtt'):
            mimetype = 'text/vtt'
        return send_from_directory(downloads_dir, safe_name, mimetype=mimetype)

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'MathInsight API is running'}

    return app
