"""
数学工具函数
"""
import numpy as np
import sympy as sp
from typing import List, Dict, Tuple, Any


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
        func = sp.sympify(expr)
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
        func = sp.sympify(expr)
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
        func = sp.sympify(expr)
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
        func = sp.sympify(expr)
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
        func = sp.sympify(expr)

        # 在 x0 两侧搜索最近的不满足条件的点
        search_range = np.linspace(max(domain_range[0], x0 - 10),
                                   min(domain_range[1], x0 + 10), 20000)
        step = (search_range[-1] - search_range[0]) / 20000

        # 找到左边最近的不满足条件的点
        left_boundary = domain_range[0]
        for x_test in np.linspace(x0, max(domain_range[0], x0 - 10), 10000):
            f_val = float(func.subs(x, x_test))
            if abs(f_val - L) >= epsilon:
                left_boundary = x_test
                break

        # 找到右边最近的不满足条件的点
        right_boundary = domain_range[1]
        for x_test in np.linspace(x0, min(domain_range[1], x0 + 10), 10000):
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

        return min(delta_left, delta_right) if delta_left > 0 and delta_right > 0 else 0.1
    except Exception:
        return 0.1


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
        func = sp.sympify(expr)
        x_values = np.linspace(domain_range[0], domain_range[1], num_points)
        y_values = []

        for xv in x_values:
            try:
                yv = float(func.subs(x, xv))
                if np.isnan(yv) or np.isinf(yv):
                    y_values.append(None)
                else:
                    y_values.append(yv)
            except:
                y_values.append(None)

        return {'x': x_values.tolist(), 'y': y_values}
    except Exception as e:
        raise ValueError(f"无法生成函数曲线: {expr}, 错误: {str(e)}")
