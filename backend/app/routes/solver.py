"""
数学解题助手 API 路由
"""
from flask import Blueprint, request, jsonify

from app.config import Config
from app.services.solver_service import (
    MathSolverService,
    SolverConfigurationError,
    SolverLLMError,
)
from app.utils.response import error_response, server_error_response

solver_bp = Blueprint("solver", __name__)

DEFAULT_MODEL = Config.SOLVER_MODEL
DEFAULT_BASE_URL = Config.get_anthropic_base_url()


def _get_service() -> MathSolverService:
    """获取解题助手服务实例"""
    return MathSolverService(
        api_key=Config.get_llm_api_key(),
        base_url=Config.ANTHROPIC_BASE_URL or DEFAULT_BASE_URL,
        model=Config.SOLVER_MODEL or DEFAULT_MODEL,
    )


def _validate_problem(data: dict) -> tuple:
    """校验题目输入，返回 (problem, subject_hint, error_response)"""
    if not data or "problem" not in data:
        return None, None, error_response("请提供题目内容")

    problem = data["problem"]
    if not problem or not problem.strip():
        return None, None, error_response("题目内容不能为空")

    problem = problem.strip()
    if len(problem) > Config.SOLVER_MAX_PROBLEM_LENGTH:
        return None, None, error_response(
            f"题目内容过长，请控制在 {Config.SOLVER_MAX_PROBLEM_LENGTH} 字符以内"
        )

    subject_hint = data.get("subject", "auto")
    if subject_hint not in {"auto", "calculus", "linear-algebra", "probability"}:
        subject_hint = "auto"

    return problem, subject_hint, None


@solver_bp.route("/analyze", methods=["POST"])
def analyze_problem():
    """
    分析数学题目

    请求体:
    {
        "problem": "题目文本",
        "subject": "auto"  // 可选：calculus / linear-algebra / probability
    }
    """
    data = request.get_json()
    problem, subject_hint, validation_error = _validate_problem(data)
    if validation_error:
        return validation_error

    api_key = Config.get_llm_api_key()
    if not api_key:
        return error_response(
            "未配置 LLM API 密钥，请在 .env 文件中设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY",
            500,
        )

    try:
        service = _get_service()
        result = service.analyze_problem(problem, subject_hint)
        return jsonify({
            "success": True,
            "data": result,
        }), 200
    except SolverConfigurationError as e:
        return error_response(str(e), 500)
    except SolverLLMError:
        return server_error_response("AI 分析服务暂时不可用，请稍后重试", exc=True)
    except Exception:
        return server_error_response("题目分析失败，请稍后重试", exc=True)


@solver_bp.route("/hint", methods=["POST"])
def get_hint():
    """
    获取渐进式提示

    请求体:
    {
        "problem": "题目文本",
        "current_step": 1,
        "level": 1  // 1=思路提示, 2=关键步骤, 3=详细推导
    }
    """
    data = request.get_json()
    problem, _, validation_error = _validate_problem(data)
    if validation_error:
        return validation_error

    try:
        current_step = int(data.get("current_step", 1))
        if current_step < 1:
            current_step = 1
    except (TypeError, ValueError):
        current_step = 1

    try:
        level = int(data.get("level", 1))
        if level not in {1, 2, 3}:
            level = 1
    except (TypeError, ValueError):
        level = 1

    api_key = Config.get_llm_api_key()
    if not api_key:
        return error_response(
            "未配置 LLM API 密钥，请在 .env 文件中设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY",
            500,
        )

    try:
        service = _get_service()
        hint = service.get_hint(problem, current_step, level)
        return jsonify({
            "success": True,
            "data": {
                "hint": hint,
                "current_step": current_step,
                "level": level,
            },
        }), 200
    except SolverConfigurationError as e:
        return error_response(str(e), 500)
    except SolverLLMError:
        return server_error_response("AI 提示服务暂时不可用，请稍后重试", exc=True)
    except Exception:
        return server_error_response("获取提示失败，请稍后重试", exc=True)


@solver_bp.route("/similar", methods=["POST"])
def generate_similar():
    """
    生成相似练习题

    请求体:
    {
        "problem": "题目文本",
        "topic": "derivative",
        "count": 3
    }
    """
    data = request.get_json()
    problem, _, validation_error = _validate_problem(data)
    if validation_error:
        return validation_error

    topic = data.get("topic", "other")
    if not topic or not isinstance(topic, str):
        topic = "other"

    try:
        count = int(data.get("count", 3))
        count = max(1, min(5, count))
    except (TypeError, ValueError):
        count = 3

    api_key = Config.get_llm_api_key()
    if not api_key:
        return error_response(
            "未配置 LLM API 密钥，请在 .env 文件中设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY",
            500,
        )

    try:
        service = _get_service()
        problems = service.generate_similar(problem, topic, count)
        return jsonify({
            "success": True,
            "data": {
                "problems": problems,
                "count": len(problems),
            },
        }), 200
    except SolverConfigurationError as e:
        return error_response(str(e), 500)
    except SolverLLMError:
        return server_error_response("AI 出题服务暂时不可用，请稍后重试", exc=True)
    except Exception:
        return server_error_response("生成相似题失败，请稍后重试", exc=True)
