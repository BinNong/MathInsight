"""
Manim 动画生成 API 路由
"""
from flask import Blueprint, request, jsonify, send_file, current_app
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

manim_bp = Blueprint('manim', __name__)

# 默认配置（实际使用时从环境变量或配置读取）
DEFAULT_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')
DEFAULT_BASE_URL = os.environ.get('OPENAI_BASE_URL', None)


@manim_bp.route('/generate', methods=['POST'])
def generate_animation():
    """
    生成 Manim 动画

    请求体:
    {
        "description": "动画描述",
        "resolution": "720p",  // 可选
        "fps": 30  // 可选
    }
    """
    data = request.get_json()

    if not data or 'description' not in data:
        return jsonify({
            "success": False,
            "error": "请提供动画描述"
        }), 400

    description = data['description']
    resolution = data.get('resolution', '720p')
    fps = data.get('fps', 30)

    # 检查 API 密钥
    api_key = os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return jsonify({
            "success": False,
            "error": "未配置 LLM API 密钥，请在 .env 文件中设置 ANTHROPIC_API_KEY"
        }), 500

    # 导入服务（延迟导入避免循环依赖）
    from app.services.manim_service import ManimService

    # 创建服务实例
    service = ManimService(
        api_key=api_key,
        base_url=os.environ.get('ANTHROPIC_BASE_URL', DEFAULT_BASE_URL),
        model=os.environ.get('ANTHROPIC_MODEL', DEFAULT_MODEL)
    )

    # 生成动画
    try:
        result = service.generate_animation(
            description=description,
            resolution=resolution,
            fps=fps
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"生成失败: {str(e)}",
            "detail": traceback.format_exc()
        }), 500

    if result.get('success'):
        return jsonify(result), 200
    else:
        return jsonify(result), 500


@manim_bp.route('/download/<filename>', methods=['GET'])
def download_video(filename):
    """下载生成的视频"""
    downloads_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        'downloads'
    )
    filepath = os.path.join(downloads_dir, filename)

    if not os.path.exists(filepath):
        return jsonify({"error": "文件不存在"}), 404

    return send_file(filepath, as_attachment=True)
