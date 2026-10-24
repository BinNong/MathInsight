"""
请求数据校验工具函数

集中处理 API 路由中常见的请求体验证逻辑，避免在每个路由模块中重复定义。
"""
from typing import Any, Tuple, List


def validate_request_data(data: dict, required_fields: list = None) -> Tuple[bool, str | None]:
    """
    验证请求数据

    Args:
        data: 请求数据字典
        required_fields: 必填字段列表

    Returns:
        (is_valid, error_message)
    """
    if not data:
        return False, 'Request body is required'
    if required_fields:
        for field in required_fields:
            if field not in data:
                return False, f'Missing required field: {field}'
    return True, None


def safe_float(value: Any, field_name: str) -> Tuple[bool, float | str]:
    """安全地将值转换为 float"""
    try:
        return True, float(value)
    except (TypeError, ValueError):
        return False, f'{field_name} must be a number'


def safe_int(value: Any, field_name: str, min_value: int = None, max_value: int = None) -> Tuple[bool, int | str]:
    """
    安全地将值转换为 int，并可指定取值范围

    Args:
        value: 要转换的值
        field_name: 字段名（用于错误信息）
        min_value: 最小值（可选）
        max_value: 最大值（可选）

    Returns:
        (is_valid, int_value_or_error_message)
    """
    try:
        result = int(value)
    except (TypeError, ValueError):
        return False, f'{field_name} must be an integer'

    if min_value is not None and result < min_value:
        return False, f'{field_name} must be at least {min_value}'
    if max_value is not None and result > max_value:
        return False, f'{field_name} must be at most {max_value}'

    return True, result


def safe_float_list(value: Any, field_name: str, expected_length: int = None) -> Tuple[bool, List[float] | str]:
    """
    安全地将值转换为 float 列表

    Args:
        value: 要转换的值
        field_name: 字段名（用于错误信息）
        expected_length: 期望的列表长度（可选）

    Returns:
        (is_valid, float_list_or_error_message)
    """
    if not isinstance(value, list):
        return False, f'{field_name} must be a list'
    try:
        result = [float(v) for v in value]
    except (TypeError, ValueError):
        return False, f'{field_name} must be a list of numbers'

    if expected_length is not None and len(result) != expected_length:
        return False, f'{field_name} must have exactly {expected_length} elements'

    return True, result


def safe_bounded_float(value: Any, field_name: str, min_value: float = None, max_value: float = None) -> Tuple[bool, float | str]:
    """
    安全地转换 float 并校验范围

    Args:
        value: 要转换的值
        field_name: 字段名
        min_value: 最小值（可选）
        max_value: 最大值（可选）

    Returns:
        (is_valid, float_value_or_error_message)
    """
    is_valid, result = safe_float(value, field_name)
    if not is_valid:
        return False, result

    if min_value is not None and result < min_value:
        return False, f'{field_name} must be at least {min_value}'
    if max_value is not None and result > max_value:
        return False, f'{field_name} must be at most {max_value}'

    return True, result
