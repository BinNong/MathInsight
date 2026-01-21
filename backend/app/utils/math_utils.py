"""
数学工具函数
"""
import numpy as np
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations,
    implicit_multiplication_application, convert_xor
)
from typing import List, Dict, Tuple, Any
import logging
import os

logger = logging.getLogger(__name__)

# 常量定义
SEARCH_RESOLUTION = 20000
SEARCH_POINTS = 10000
MAX_SEARCH_RADIUS = 10
DEFAULT_DELTA = 0.1

# 安全的 transformations - 只允许基本数学运算，禁止代码注入
# convert_xor: 将 ^ 转换为幂运算
# implicit_multiplication_application: 允许 2x 表示 2*x
_SAFE_TRANSFORMATIONS = (
    standard_transformations +
    (convert_xor, implicit_multiplication_application)
)


def _safe_parse(expr: str) -> sp.Basic:
    """
    安全地解析数学表达式，防止代码注入攻击

    使用 parse_expr 代替 sympify，并限制可访问的符号。

    Args:
        expr: 数学表达式字符串

    Returns:
        SymPy 表达式对象

    Raises:
        ValueError: 表达式无法解析或包含非法内容
    """
    if not expr or not isinstance(expr, str):
        raise ValueError("表达式必须是非空字符串")

    expr = expr.strip()

    # 检查可疑模式
    suspicious_patterns = [
        '__',      # 双下划线（可能访问特殊属性）
        'eval(',   # eval 调用
        'exec(',   # exec 调用
        'open(',   # 文件操作
        'S.',      # 访问 SymPy 的 S 对象
        'lambda:', # 匿名函数
        ':',       # 字典/切片语法（可疑）
    ]

    for pattern in suspicious_patterns:
        if pattern.lower() in expr.lower():
            raise ValueError(f"表达式包含不允许的内容: {pattern}")

    try:
        # 使用 local_dict 阻止访问 S 对象和其他危险符号
        # 允许的变量：x, y, z, t 等常见数学变量
        local_dict = {
            'x': sp.Symbol('x'),
            'y': sp.Symbol('y'),
            'z': sp.Symbol('z'),
            't': sp.Symbol('t'),
        }

        return parse_expr(
            expr,
            transformations=_SAFE_TRANSFORMATIONS,
            local_dict=local_dict,
            evaluate=True
        )
    except Exception as e:
        raise ValueError(f"无法解析表达式 '{expr}': {str(e)}")


def safe_eval(expr: str, x_values: List[float]) -> List[float]:
    """
    安全地计算函数表达式在多个点的值

    Args:
        expr: 函数表达式字符串，如 "x**2"
        x_values: x 坐标列表

    Returns:
        对应的 y 值列表
    """
    x = sp.Symbol('x')
    try:
        # 解析表达式
        func = _safe_parse(expr)
        # 计算每个点的值
        y_values = [float(func.subs(x, xv)) for xv in x_values]
        return y_values
    except Exception as e:
        raise ValueError(f"无法解析函数表达式: {expr}, 错误: {str(e)}")


def safe_eval_single(expr: str, x_val: float) -> float:
    """
    安全地计算函数表达式在单个点的值
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        return float(func.subs(x, x_val))
    except Exception as e:
        raise ValueError(f"无法计算函数值: {expr} at x={x_val}, 错误: {str(e)}")


def get_derivative(expr: str) -> str:
    """
    计算函数的导数表达式

    Args:
        expr: 函数表达式字符串

    Returns:
        导数表达式字符串
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        derivative = sp.diff(func, x)
        return str(derivative)
    except Exception as e:
        raise ValueError(f"无法计算导数: {expr}, 错误: {str(e)}")


def get_tangent_line(expr: str, x0: float) -> Tuple[float, float]:
    """
    获取切线方程的参数

    Args:
        expr: 函数表达式字符串
        x0: 切点横坐标

    Returns:
        (斜率, 截距) 或 (f(x0), f'(x0)*x0 - f'(x0)*x0) 用于计算 y = mx + b 形式
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        f_x0 = float(func.subs(x, x0))
        derivative = sp.diff(func, x)
        f_prime_x0 = float(derivative.subs(x, x0))
        # 切线方程: y = f'(x0) * (x - x0) + f(x0)
        # 化为 y = mx + b 形式: m = f'(x0), b = f(x0) - f'(x0)*x0
        slope = f_prime_x0
        intercept = f_x0 - slope * x0
        return (slope, intercept)
    except Exception as e:
        raise ValueError(f"无法计算切线: {expr} at x={x0}, 错误: {str(e)}")


def compute_delta_for_epsilon(expr: str, x0: float, L: float, epsilon: float,
                               domain_range: List[float] = [-10, 10]) -> float:
    """
    计算满足 |f(x) - L| < epsilon 的最大 delta

    使用数值方法：在 x0 附近搜索满足条件的边界点

    Args:
        expr: 函数表达式
        x0: 极限点
        L: 极限值
        epsilon: epsilon 值
        domain_range: 搜索域范围

    Returns:
        最大的 delta 值
    """
    try:
        x = sp.Symbol('x')
        func = _safe_parse(expr)

        # 在 x0 两侧搜索最近的不满足条件的点
        search_range = np.linspace(max(domain_range[0], x0 - MAX_SEARCH_RADIUS),
                                   min(domain_range[1], x0 + MAX_SEARCH_RADIUS),
                                   SEARCH_RESOLUTION)

        # 找到左边最近的不满足条件的点
        left_boundary = domain_range[0]
        for x_test in np.linspace(x0, max(domain_range[0], x0 - MAX_SEARCH_RADIUS), SEARCH_POINTS):
            f_val = float(func.subs(x, x_test))
            if abs(f_val - L) >= epsilon:
                left_boundary = x_test
                break

        # 找到右边最近的不满足条件的点
        right_boundary = domain_range[1]
        for x_test in np.linspace(x0, min(domain_range[1], x0 + MAX_SEARCH_RADIUS), SEARCH_POINTS):
            f_val = float(func.subs(x, x_test))
            if abs(f_val - L) >= epsilon:
                right_boundary = x_test
                break

        # delta 是到最近边界的距离
        delta_left = abs(x0 - left_boundary)
        delta_right = abs(right_boundary - x0)

        # 对于连续函数，delta 是到不满足条件区域的距离
        # 如果所有点都满足条件，返回一个较大的默认值
        if delta_left == 0 and delta_right == domain_range[1] - domain_range[0]:
            return min(1.0, (domain_range[1] - domain_range[0]) / 2)

        return min(delta_left, delta_right) if delta_left > 0 and delta_right > 0 else DEFAULT_DELTA
    except Exception as e:
        logger.warning(f"compute_delta_for_epsilon failed for {expr}: {e}")
        return DEFAULT_DELTA


def generate_function_points(expr: str, domain_range: List[float],
                             num_points: int = 500) -> Dict[str, List[float]]:
    """
    生成函数曲线数据点

    Args:
        expr: 函数表达式
        domain_range: [x_min, x_max]
        num_points: 采样点数量

    Returns:
        {'x': [...], 'y': [...]}
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        x_values = np.linspace(domain_range[0], domain_range[1], num_points)
        y_values = []

        for xv in x_values:
            try:
                yv = float(func.subs(x, xv))
                if np.isnan(yv) or np.isinf(yv):
                    y_values.append(None)
                else:
                    y_values.append(yv)
            except (TypeError, ValueError, sp.SympifyError):
                y_values.append(None)

        return {'x': x_values.tolist(), 'y': y_values}
    except Exception as e:
        raise ValueError(f"无法生成函数曲线: {expr}, 错误: {str(e)}")
