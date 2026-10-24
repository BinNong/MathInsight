"""
统一 API 响应格式

所有路由统一返回以下结构：
    {
        "success": bool,
        "data": any,      # success 为 True 时存在
        "error": str      # success 为 False 时存在
    }
"""
import logging

from flask import jsonify, Response
from typing import Any

logger = logging.getLogger(__name__)


def success_response(data: Any, status_code: int = 200) -> Response:
    """返回成功响应"""
    return jsonify({
        'success': True,
        'data': data
    }), status_code


def error_response(message: str, status_code: int = 400) -> Response:
    """返回错误响应"""
    return jsonify({
        'success': False,
        'error': message
    }), status_code


def math_error_response(error_type: str = 'calculation', status_code: int = 400) -> Response:
    """
    返回数学计算类错误响应

    Args:
        error_type: 错误类型，可选 'parse' 或 'calculation'
        status_code: HTTP 状态码
    """
    messages = {
        'parse': '函数表达式解析失败，请检查输入格式',
        'calculation': '计算过程中发生错误，请稍后重试'
    }
    return error_response(messages.get(error_type, messages['calculation']), status_code)


def server_error_response(message: str = '服务器内部错误，请稍后重试',
                          status_code: int = 500,
                          exc: Exception = None) -> Response:
    """
    返回服务器内部错误响应，并在服务端记录异常堆栈。

    该函数不会将异常详情返回给客户端，避免泄露内部实现信息。
    """
    if exc is not None:
        logger.exception(message)
    else:
        logger.error(message)
    return error_response(message, status_code)
