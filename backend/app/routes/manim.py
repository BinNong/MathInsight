"""
Manim 动画生成 API 路由
"""
import os

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from app.config import Config
from app.services.manim_service import ManimService
from app.services.manim_task_manager import TaskStatus, manim_executor, task_manager
from app.utils.response import error_response

manim_bp = Blueprint("manim", __name__)

# 默认配置
DEFAULT_MODEL = Config.ANTHROPIC_MODEL
DEFAULT_BASE_URL = Config.get_anthropic_base_url()


def _get_downloads_dir() -> str:
    """获取下载目录路径"""
    downloads_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "downloads",
    )
    os.makedirs(downloads_dir, exist_ok=True)
    return downloads_dir


def _get_tasks_persist_dir() -> str:
    """获取任务持久化目录路径"""
    persist_dir = os.path.join(_get_downloads_dir(), ".tasks")
    os.makedirs(persist_dir, exist_ok=True)
    return persist_dir


# 为全局任务管理器启用文件持久化（便于多 worker 查询）
task_manager.enable_persistence(_get_tasks_persist_dir())


@manim_bp.route("/generate", methods=["POST"])
def generate_animation():
    """
    创建 Manim 动画生成任务

    请求体:
    {
        "description": "动画描述",
        "resolution": "720p",  // 可选
        "fps": 30  // 可选
    }

    响应:
    {
        "success": true,
        "task_id": "manim_xxx",
        "status": "PENDING"
    }
    """
    data = request.get_json()

    if not data or "description" not in data:
        return error_response("请提供动画描述")

    description = data["description"]
    if not description or not description.strip():
        return error_response("动画描述不能为空")

    resolution = data.get("resolution", "720p")
    fps = data.get("fps", 30)

    # 检查 API 密钥
    api_key = Config.get_llm_api_key()
    if not api_key:
        return error_response(
            "未配置 LLM API 密钥，请在 .env 文件中设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY",
            500,
        )

    downloads_dir = _get_downloads_dir()
    task = task_manager.create_task(
        description=description.strip(),
        resolution=resolution,
        fps=fps,
    )

    service = ManimService(
        api_key=api_key,
        base_url=Config.ANTHROPIC_BASE_URL or DEFAULT_BASE_URL,
        model=Config.ANTHROPIC_MODEL or DEFAULT_MODEL,
    )

    # 提交到受控线程池执行，避免无限制创建后台线程
    future = manim_executor.submit(
        task.task_id,
        service.generate_animation,
        task,
        downloads_dir,
    )
    if future is None:
        task_manager.update_task(
            task.task_id,
            status=TaskStatus.FAILED,
            stage_message="当前渲染任务已满，请稍后重试",
            error="当前渲染任务已满，请稍后重试",
        )
        return error_response(
            f"当前已有 {manim_executor.max_workers} 个渲染任务在执行，请稍后重试",
            429,
        )

    return jsonify({
        "success": True,
        "task_id": task.task_id,
        "status": task.status.value,
        "message": "任务已创建",
    }), 202


@manim_bp.route("/tasks/<task_id>", methods=["GET"])
def get_task_status(task_id: str):
    """查询任务状态与结果"""
    task = task_manager.get_task(task_id)
    if not task:
        return error_response("任务不存在", 404)

    return jsonify({
        "success": True,
        "task": task.to_dict(),
    }), 200


@manim_bp.route("/tasks/<task_id>/cancel", methods=["POST"])
def cancel_task(task_id: str):
    """取消任务"""
    task = task_manager.cancel_task(task_id)
    if not task:
        return error_response("任务不存在", 404)

    return jsonify({
        "success": True,
        "task_id": task_id,
        "status": task.status.value,
        "message": "已请求取消任务",
    }), 200


@manim_bp.route("/tasks/<task_id>/code", methods=["GET"])
def get_task_code(task_id: str):
    """获取任务生成的 Manim 代码与渲染日志"""
    task = task_manager.get_task(task_id)
    if not task:
        return error_response("任务不存在", 404)

    return jsonify({
        "success": True,
        "task_id": task_id,
        "generated_code": task.generated_code,
        "render_log": task.render_log,
        "status": task.status.value,
    }), 200


@manim_bp.route("/download/<filename>", methods=["GET"])
def download_video(filename: str):
    """下载生成的视频"""
    safe_name = secure_filename(filename)
    # 防御路径遍历与内部文件访问
    if not safe_name or safe_name != filename or safe_name.startswith('.'):
        return error_response("文件不存在", 404)

    downloads_dir = _get_downloads_dir()
    filepath = os.path.join(downloads_dir, safe_name)

    if not os.path.exists(filepath):
        return error_response("文件不存在", 404)

    return send_file(filepath, as_attachment=True)
