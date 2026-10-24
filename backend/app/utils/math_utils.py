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

# 允许在表达式中使用的全局函数与常量白名单
_SAFE_GLOBALS = {
    'sin': sp.sin,
    'cos': sp.cos,
    'tan': sp.tan,
    'asin': sp.asin,
    'acos': sp.acos,
    'atan': sp.atan,
    'sinh': sp.sinh,
    'cosh': sp.cosh,
    'tanh': sp.tanh,
    'exp': sp.exp,
    'log': sp.log,
    'ln': sp.log,
    'sqrt': sp.sqrt,
    'abs': sp.Abs,
    'pi': sp.pi,
    'E': sp.E,
}

# 表达式中禁止出现的危险模式（大小写不敏感）
_SUSPICIOUS_PATTERNS = (
    '__',      # 双下划线（可能访问特殊属性）
    'eval(',   # eval 调用
    'exec(',   # exec 调用
    'open(',   # 文件操作
    'S.',      # 访问 SymPy 的 S 对象
    'lambda:', # 匿名函数
)


def _safe_parse(expr: str) -> sp.Basic:
    """
    安全地解析数学表达式，防止代码注入攻击

    使用 parse_expr 代替 sympify，先通过 SymPy 默认全局字典完成解析，
    再对解析后的表达式树进行白名单检查，限制可使用的函数与常量。

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

    # 检查可疑模式（避免在错误信息中直接回显匹配规则）
    lowered = expr.lower()
    for pattern in _SUSPICIOUS_PATTERNS:
        if pattern.lower() in lowered:
            raise ValueError("表达式包含不允许的内容")

    try:
        local_dict = {
            'x': sp.Symbol('x'),
            'y': sp.Symbol('y'),
            'z': sp.Symbol('z'),
            't': sp.Symbol('t'),
        }

        parsed = parse_expr(
            expr,
            transformations=_SAFE_TRANSFORMATIONS,
            local_dict=local_dict,
            evaluate=True
        )
    except ValueError:
        raise
    except Exception as e:
        raise ValueError("无法解析表达式，请检查输入格式") from e

    # 解析后对表达式树做白名单检查
    _validate_expression_tree(parsed)
    return parsed


def _validate_expression_tree(expr: sp.Basic) -> None:
    """
    检查表达式树中使用的函数与常量是否在白名单内。

    Raises:
        ValueError: 包含不允许的函数或符号
    """
    # 允许的函数类（SymPy 内置初等函数）
    allowed_function_classes = {
        sp.sin, sp.cos, sp.tan,
        sp.asin, sp.acos, sp.atan,
        sp.sinh, sp.cosh, sp.tanh,
        sp.exp, sp.log, sp.sqrt, sp.Abs,
        sp.ceiling, sp.floor, sp.sign,
    }

    for func in expr.atoms(sp.Function):
        func_cls = type(func)
        if func_cls not in allowed_function_classes and func_cls not in _SAFE_GLOBALS.values():
            raise ValueError("表达式包含不允许的函数")

    # 检查符号是否仅包含允许的变量名
    allowed_symbols = {'x', 'y', 'z', 't', 'pi', 'E'}
    for sym in expr.free_symbols:
        if isinstance(sym, sp.Symbol) and sym.name not in allowed_symbols:
            raise ValueError("表达式包含不允许的变量")


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
        # 使用 lambdify 进行向量化求值，比逐点 subs 快得多
        f = sp.lambdify(x, func, 'numpy')
        x_arr = np.asarray(x_values, dtype=float)
        y_values = f(x_arr)
        # 处理标量输出（常量函数）
        if np.isscalar(y_values):
            y_values = np.full_like(x_arr, y_values, dtype=float)
        return [float(yv) for yv in y_values]
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

    使用二分搜索在 x0 邻域内寻找最大安全区间，使得区间内几乎所有点都满足
    |f(x) - L| < epsilon。相比逐点扫描，二分搜索对连续/单调函数更稳定，
    对含震荡的函数也能给出保守估计。

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

        # 确定最大搜索半径
        left_max = min(MAX_SEARCH_RADIUS, abs(x0 - domain_range[0]))
        right_max = min(MAX_SEARCH_RADIUS, abs(domain_range[1] - x0))
        max_radius = min(left_max, right_max)
        if max_radius <= 1e-12:
            return DEFAULT_DELTA

        f_numeric = sp.lambdify(x, func, 'numpy')

        def _is_safe(delta: float) -> bool:
            """检查 [x0-delta, x0+delta] 内是否几乎所有采样点满足 |f(x)-L|<epsilon"""
            if delta <= 1e-12:
                return True
            x_left = x0 - delta
            x_right = x0 + delta
            samples = np.linspace(x_left, x_right, 401)
            try:
                y_vals = f_numeric(samples)
                if np.isscalar(y_vals):
                    y_vals = np.full_like(samples, y_vals, dtype=float)
                diff = np.abs(y_vals - L)
                # 忽略 NaN/Inf 点（函数无定义点），只要求可计算点满足
                valid = ~(np.isnan(diff) | np.isinf(diff))
                if not np.any(valid):
                    return False
                return np.all(diff[valid] < epsilon)
            except (TypeError, ValueError, ZeroDivisionError):
                # 向量化失败时退化为逐点检查
                for xv in samples:
                    try:
                        yv = float(func.subs(x, xv))
                        if np.isnan(yv) or np.isinf(yv):
                            continue
                        if abs(yv - L) >= epsilon:
                            return False
                    except Exception:
                        continue
                return True

        # 二分搜索最大 delta
        lo, hi = 0.0, max_radius
        best_delta = 0.0
        for _ in range(50):
            mid = (lo + hi) / 2
            if _is_safe(mid):
                best_delta = mid
                lo = mid
            else:
                hi = mid
            if hi - lo < 1e-10:
                break

        # 对结果做小幅保守收缩，避免边界浮点误差
        safe_delta = max(0.0, best_delta * 0.999)
        return safe_delta if safe_delta > 1e-12 else DEFAULT_DELTA
    except Exception as e:
        logger.warning(f"compute_delta_for_epsilon failed for {expr}: {e}")
        return DEFAULT_DELTA


def verify_delta_for_epsilon(expr: str, x0: float, L: float, epsilon: float,
                              delta: float, num_samples: int = 401) -> Dict[str, Any]:
    """
    验证在区间 (x0-delta, x0+delta) 内是否满足 |f(x) - L| < epsilon

    Returns:
        {
            'valid': bool,
            'samples': int,
            'satisfied': int,
            'max_deviation': float,
            'violations': List[Dict[str, float]]  # 最多返回 5 个反例
        }
    """
    try:
        x = sp.Symbol('x')
        func = _safe_parse(expr)
        f_numeric = sp.lambdify(x, func, 'numpy')

        x_left = x0 - delta
        x_right = x0 + delta
        samples = np.linspace(x_left, x_right, num_samples)

        satisfied = 0
        max_deviation = 0.0
        violations = []
        total_valid = 0

        try:
            y_vals = f_numeric(samples)
            if np.isscalar(y_vals):
                y_vals = np.full_like(samples, y_vals, dtype=float)
            for xv, yv in zip(samples, y_vals):
                if np.isnan(yv) or np.isinf(yv):
                    continue
                total_valid += 1
                deviation = abs(float(yv) - L)
                max_deviation = max(max_deviation, deviation)
                if deviation < epsilon:
                    satisfied += 1
                elif len(violations) < 5:
                    violations.append({'x': float(xv), 'y': float(yv), 'deviation': deviation})
        except (TypeError, ValueError, ZeroDivisionError):
            for xv in samples:
                try:
                    yv = float(func.subs(x, xv))
                    if np.isnan(yv) or np.isinf(yv):
                        continue
                    total_valid += 1
                    deviation = abs(yv - L)
                    max_deviation = max(max_deviation, deviation)
                    if deviation < epsilon:
                        satisfied += 1
                    elif len(violations) < 5:
                        violations.append({'x': float(xv), 'y': yv, 'deviation': deviation})
                except Exception:
                    continue

        return {
            'valid': total_valid > 0 and satisfied == total_valid,
            'samples': total_valid,
            'satisfied': satisfied,
            'max_deviation': max_deviation,
            'violations': violations
        }
    except Exception as e:
        logger.warning(f"verify_delta_for_epsilon failed for {expr}: {e}")
        return {
            'valid': False,
            'samples': 0,
            'satisfied': 0,
            'max_deviation': float('inf'),
            'violations': []
        }


def is_function_defined_at(expr: str, x_val: float) -> bool:
    """判断函数表达式在 x_val 处是否有有限定义值"""
    try:
        x = sp.Symbol('x')
        func = _safe_parse(expr)
        y_val = float(func.subs(x, x_val))
        return not (np.isnan(y_val) or np.isinf(y_val))
    except Exception:
        return False


def estimate_side_limits(expr: str, x0: float) -> Dict[str, Any]:
    """
    估算函数在 x0 处的左极限、右极限和双侧极限

    Returns:
        {
            'left': float | None,
            'right': float | None,
            'two_sided': float | None,
            'exists': bool
        }
    """
    try:
        x = sp.Symbol('x')
        func = _safe_parse(expr)
        left = sp.limit(func, x, x0, dir='-')
        right = sp.limit(func, x, x0, dir='+')
        two_sided = sp.limit(func, x, x0)

        def _to_float(val):
            try:
                if val is None or val.is_infinite:
                    return None
                return float(val)
            except Exception:
                return None

        left_val = _to_float(left)
        right_val = _to_float(right)
        two_sided_val = _to_float(two_sided)

        exists = (
            left_val is not None and
            right_val is not None and
            abs(left_val - right_val) < 1e-6 and
            two_sided_val is not None and
            not np.isinf(two_sided_val)
        )

        return {
            'left': left_val,
            'right': right_val,
            'two_sided': two_sided_val,
            'exists': exists
        }
    except Exception as e:
        logger.warning(f"estimate_side_limits failed for {expr}: {e}")
        return {'left': None, 'right': None, 'two_sided': None, 'exists': False}


def generate_approach_points(expr: str, x0: float, L: float,
                              side: str = 'both', num_points: int = 40,
                              max_distance: float = 2.0) -> List[Dict[str, float]]:
    """
    生成 x 从一侧或两侧趋近 x0 时的动画点序列

    Args:
        expr: 函数表达式
        x0: 极限点
        L: 极限值（用于在无法计算函数值时fallback）
        side: 'left', 'right' 或 'both'
        num_points: 每侧生成的点数
        max_distance: 起始点与 x0 的最大距离

    Returns:
        点序列，每个点 {'x': float, 'y': float, 'side': str}
    """
    try:
        x = sp.Symbol('x')
        func = _safe_parse(expr)
        f_numeric = sp.lambdify(x, func, 'numpy')

        distances = np.linspace(max_distance, 1e-6, num_points)
        points = []

        def _eval_at(xv: float) -> float:
            try:
                yv = f_numeric(xv)
                if np.isscalar(yv):
                    yv = float(yv)
                yv = float(yv)
                if np.isnan(yv) or np.isinf(yv):
                    return L
                return yv
            except Exception:
                try:
                    return float(func.subs(x, xv))
                except Exception:
                    return L

        if side in ('left', 'both'):
            for d in distances:
                xv = x0 - d
                points.append({'x': xv, 'y': _eval_at(xv), 'side': 'left'})
        if side in ('right', 'both'):
            for d in distances:
                xv = x0 + d
                points.append({'x': xv, 'y': _eval_at(xv), 'side': 'right'})

        return points
    except Exception as e:
        logger.warning(f"generate_approach_points failed for {expr}: {e}")
        return []


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

        # 使用 lambdify 向量化计算，并保留对 NaN/Inf 的鲁棒处理
        f = sp.lambdify(x, func, 'numpy')
        try:
            y_arr = f(x_values)
            if np.isscalar(y_arr):
                y_arr = np.full_like(x_values, y_arr, dtype=float)
            y_values = [
                float(yv) if not (np.isnan(yv) or np.isinf(yv)) else None
                for yv in y_arr
            ]
        except (TypeError, ValueError, ZeroDivisionError):
            # 向量化失败时 fallback 到逐点计算
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


def analyze_derivative(expr: str, x0: float, domain_range: List[float] = None) -> Dict[str, Any]:
    """
    对函数在 x0 处进行导数综合分析

    Returns:
        {
            'differentiable': bool,        # 在 x0 处是否可导
            'first_derivative': {
                'expression': str,
                'value': float,
                'sign': 'positive' | 'negative' | 'zero'
            },
            'second_derivative': {
                'expression': str,
                'value': float,
                'concavity': 'concave_up' | 'concave_down' | 'linear'
            },
            'curvature': float,            # 曲率 κ
            'critical_point': bool,        # x0 是否为临界点
            'local_extrema': str | None,   # 'local_min' | 'local_max' | None
            'monotonicity': str,           # 单调性描述
            'slope_triangle': {            # 斜率三角形坐标
                'x0': float, 'y0': float,
                'x1': float, 'y1': float,
                'x2': float, 'y2': float
            }
        }
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        domain = domain_range or [x0 - 2, x0 + 2]

        # 计算函数值与导数
        f_x0 = float(func.subs(x, x0))
        first_deriv = sp.diff(func, x)
        second_deriv = sp.diff(func, x, 2)

        # 可导性检查：左导数与右导数是否存在且相等
        differentiable = True
        f_prime_x0 = None
        try:
            f_prime_x0 = float(first_deriv.subs(x, x0))
            if np.isnan(f_prime_x0) or np.isinf(f_prime_x0):
                differentiable = False
                f_prime_x0 = None
        except Exception:
            differentiable = False

        # 若 sympy 在 x0 处无法求值，尝试左右极限
        if f_prime_x0 is None:
            try:
                left = sp.limit(first_deriv, x, x0, dir='-')
                right = sp.limit(first_deriv, x, x0, dir='+')
                if left == right and not left.is_infinite:
                    f_prime_x0 = float(left)
                    differentiable = True
            except Exception:
                pass

        # 二阶导数值
        f_double_prime_x0 = None
        try:
            f_double_prime_x0 = float(second_deriv.subs(x, x0))
            if np.isnan(f_double_prime_x0) or np.isinf(f_double_prime_x0):
                f_double_prime_x0 = None
        except Exception:
            pass

        # 导数符号与单调性
        sign = 'zero'
        monotonicity = '水平'
        if f_prime_x0 is not None:
            if abs(f_prime_x0) < 1e-10:
                sign = 'zero'
                monotonicity = '水平（切线水平）'
            elif f_prime_x0 > 0:
                sign = 'positive'
                monotonicity = '单调递增'
            else:
                sign = 'negative'
                monotonicity = '单调递减'

        # 凹凸性
        concavity = 'linear'
        if f_double_prime_x0 is not None:
            if abs(f_double_prime_x0) < 1e-10:
                concavity = 'linear'
            elif f_double_prime_x0 > 0:
                concavity = 'concave_up'
            else:
                concavity = 'concave_down'

        # 临界点与极值
        critical_point = False
        local_extrema = None
        if f_prime_x0 is not None and abs(f_prime_x0) < 1e-6:
            critical_point = True
            if f_double_prime_x0 is not None:
                if f_double_prime_x0 > 1e-8:
                    local_extrema = 'local_min'
                elif f_double_prime_x0 < -1e-8:
                    local_extrema = 'local_max'

        # 曲率 κ = |f''(x0)| / (1 + f'(x0)^2)^(3/2)
        curvature = 0.0
        if f_prime_x0 is not None and f_double_prime_x0 is not None:
            curvature = abs(f_double_prime_x0) / (1 + f_prime_x0 ** 2) ** 1.5

        # 斜率三角形：以 (x0, y0) 为起点，沿切线走 Δx，构成直角三角形
        dx = (domain[1] - domain[0]) * 0.08
        if f_prime_x0 is None:
            slope_triangle = None
        else:
            x1 = x0 + dx
            y1 = f_x0 + f_prime_x0 * dx
            slope_triangle = {
                'x0': x0,
                'y0': f_x0,
                'x1': x1,
                'y1': y1,
                'x2': x1,
                'y2': f_x0
            }

        return {
            'differentiable': differentiable,
            'first_derivative': {
                'expression': str(first_deriv),
                'value': f_prime_x0,
                'sign': sign
            },
            'second_derivative': {
                'expression': str(second_deriv),
                'value': f_double_prime_x0,
                'concavity': concavity
            },
            'curvature': curvature,
            'critical_point': critical_point,
            'local_extrema': local_extrema,
            'monotonicity': monotonicity,
            'slope_triangle': slope_triangle
        }
    except Exception as e:
        logger.warning(f"analyze_derivative failed for {expr}: {e}")
        return {
            'differentiable': False,
            'first_derivative': {'expression': '', 'value': None, 'sign': 'zero'},
            'second_derivative': {'expression': '', 'value': None, 'concavity': 'linear'},
            'curvature': 0.0,
            'critical_point': False,
            'local_extrema': None,
            'monotonicity': '未知',
            'slope_triangle': None
        }


def estimate_linear_approximation_error(expr: str, x0: float,
                                        domain_range: List[float]) -> Dict[str, Any]:
    """
    估计局部线性近似的误差上界（拉格朗日余项）

    Returns:
        {
            'max_second_derivative': float,
            'error_bound_formula': str,
            'error_bound_values': List[float],  # 与 x 坐标对应的误差上界
            'x_values': List[float]
        }
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        second_deriv = sp.diff(func, x, 2)
        f_second = sp.lambdify(x, second_deriv, 'numpy')

        x_vals = np.linspace(domain_range[0], domain_range[1], 200)
        try:
            y_arr = f_second(x_vals)
            if np.isscalar(y_arr):
                y_arr = np.full_like(x_vals, y_arr, dtype=float)
            second_deriv_vals = np.abs(y_arr)
            second_deriv_vals = np.where(np.isnan(second_deriv_vals) | np.isinf(second_deriv_vals), 0, second_deriv_vals)
            max_abs = float(np.max(second_deriv_vals))
        except (TypeError, ValueError, ZeroDivisionError):
            max_abs = 0.0
            for xv in x_vals:
                try:
                    val = abs(float(second_deriv.subs(x, xv)))
                    if not (np.isnan(val) or np.isinf(val)) and val > max_abs:
                        max_abs = val
                except Exception:
                    pass

        # 拉格朗日余项上界: |R(x)| <= M/2 * |x - x0|^2
        error_bounds = [max_abs / 2.0 * abs(xv - x0) ** 2 for xv in x_vals]

        return {
            'max_second_derivative': max_abs,
            'error_bound_formula': f'|R(x)| ≤ {max_abs:.4f}/2 · |x - x₀|²',
            'error_bound_values': error_bounds,
            'x_values': x_vals.tolist()
        }
    except Exception as e:
        logger.warning(f"estimate_linear_approximation_error failed for {expr}: {e}")
        return {
            'max_second_derivative': 0.0,
            'error_bound_formula': '',
            'error_bound_values': [],
            'x_values': []
        }


def find_critical_points(expr: str, domain_range: List[float], num_samples: int = 200) -> List[Dict[str, Any]]:
    """
    在定义域内寻找函数的临界点（f'(x) = 0 或不存在）

    Returns:
        List[{'x': float, 'y': float, 'type': str}]
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        first_deriv = sp.diff(func, x)
        second_deriv = sp.diff(func, x, 2)

        # 解析求解临界点
        critical_xs = set()
        try:
            solutions = sp.solveset(first_deriv, x, domain=sp.Interval(domain_range[0], domain_range[1]))
            for sol in solutions:
                try:
                    critical_xs.add(float(sol))
                except (TypeError, ValueError):
                    continue
        except Exception:
            pass

        # 数值补充：采样导数符号变化处
        x_vals = np.linspace(domain_range[0], domain_range[1], num_samples)
        f_prime = sp.lambdify(x, first_deriv, 'numpy')
        try:
            y_arr = f_prime(x_vals)
            if np.isscalar(y_arr):
                y_arr = np.full_like(x_vals, y_arr, dtype=float)
            prime_vals = y_arr
        except Exception:
            prime_vals = np.array([float(first_deriv.subs(x, xv)) for xv in x_vals])

        for i in range(len(x_vals) - 1):
            if np.isnan(prime_vals[i]) or np.isnan(prime_vals[i + 1]):
                continue
            if prime_vals[i] == 0:
                critical_xs.add(round(float(x_vals[i]), 6))
            elif prime_vals[i] * prime_vals[i + 1] < 0:
                # 符号变化，二分法求精
                a, b = x_vals[i], x_vals[i + 1]
                for _ in range(20):
                    mid = (a + b) / 2
                    try:
                        vm = float(first_deriv.subs(x, mid))
                    except Exception:
                        break
                    if vm == 0 or abs(vm) < 1e-12:
                        a = b = mid
                        break
                    if prime_vals[i] * vm < 0:
                        b = mid
                    else:
                        a = mid
                critical_xs.add(round(float((a + b) / 2), 6))

        points = []
        for cx in sorted(critical_xs):
            if domain_range[0] - 1e-6 <= cx <= domain_range[1] + 1e-6:
                try:
                    cy = float(func.subs(x, cx))
                    if np.isnan(cy) or np.isinf(cy):
                        continue
                    second_val = float(second_deriv.subs(x, cx))
                    if abs(second_val) < 1e-8:
                        ctype = 'stationary'
                    elif second_val > 0:
                        ctype = 'local_min'
                    elif second_val < 0:
                        ctype = 'local_max'
                    else:
                        ctype = 'stationary'
                    points.append({'x': cx, 'y': cy, 'type': ctype})
                except Exception:
                    continue
        return points
    except Exception as e:
        logger.warning(f"find_critical_points failed for {expr}: {e}")
        return []


def analyze_taylor_series(expr: str, x0: float, max_order: int = 5,
                          domain_range: List[float] = None) -> Dict[str, Any]:
    """
    分析泰勒级数的系数、收敛半径与奇点信息

    Returns:
        {
            'coefficients': [
                {
                    'order': int,
                    'derivative_value': float,   # f^(n)(x0)
                    'factorial': int,
                    'coefficient': float,        # f^(n)(x0) / n!
                    'term_str': str              # 如 "f'(0)/1! · x"
                }, ...
            ],
            'radius_of_convergence': float | None,
            'nearest_singularity': dict | None,
            'singularities': List[dict],
            'series_summary': str
        }
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)
        domain = domain_range or [x0 - 3, x0 + 3]

        # 计算各阶导数在 x0 处的值
        coefficients = []
        for i in range(max_order + 1):
            if i == 0:
                deriv_expr = func
                deriv_name = 'f'
            else:
                deriv_expr = sp.diff(func, x, i)
                deriv_name = f"f^{{({i})}}"

            try:
                deriv_value = float(deriv_expr.subs(x, x0))
                if np.isnan(deriv_value) or np.isinf(deriv_value):
                    deriv_value = None
            except Exception:
                deriv_value = None

            factorial = int(sp.factorial(i))
            coeff = deriv_value / factorial if deriv_value is not None else None

            if i == 0:
                term_str = f"{deriv_name}({x0})"
            elif i == 1:
                term_str = f"{deriv_name}({x0})/1! · (x - {x0})"
            else:
                term_str = f"{deriv_name}({x0})/{i}! · (x - {x0})^{i}"

            coefficients.append({
                'order': i,
                'derivative_value': deriv_value,
                'factorial': factorial,
                'coefficient': coeff,
                'term_str': term_str
            })

        # 寻找奇点以估计收敛半径
        singularity_list = []
        nearest = None
        try:
            # 使用 sympy 的 singularities 寻找实奇点
            from sympy.calculus.singularities import singularities as sp_singularities
            sing_set = sp_singularities(func, x)
            for s in sing_set:
                try:
                    s_val = float(s)
                    if np.isnan(s_val) or np.isinf(s_val):
                        continue
                    distance = abs(s_val - x0)
                    singularity_list.append({
                        'x': s_val,
                        'distance': distance,
                        'type': 'singularity'
                    })
                except (TypeError, ValueError):
                    continue
        except Exception:
            pass

        # 数值补充：在扩展域内寻找函数值或导数趋于无穷的点
        search_left = min(domain[0], x0) - 3
        search_right = max(domain[1], x0) + 3
        search_points = np.linspace(search_left, search_right, 2000)
        f_numeric = sp.lambdify(x, func, 'numpy')
        try:
            y_arr = f_numeric(search_points)
            if np.isscalar(y_arr):
                y_arr = np.full_like(search_points, y_arr, dtype=float)
            for i, (xv, yv) in enumerate(zip(search_points, y_arr)):
                if np.isinf(yv) or np.isnan(yv):
                    # 找到突变点，细化定位
                    if i > 0 and not (np.isinf(y_arr[i - 1]) or np.isnan(y_arr[i - 1])):
                        distance = abs(xv - x0)
                        singularity_list.append({
                            'x': float(xv),
                            'distance': distance,
                            'type': 'numerical_pole'
                        })
        except Exception:
            pass

        # 对数函数在分支点处的处理
        try:
            if func.has(sp.log):
                # 尝试寻找使 log 参数为 0 的点
                log_args = [arg for arg in func.atoms(sp.log)]
                for log_expr in log_args:
                    arg = log_expr.args[0]
                    sols = sp.solve(arg, x)
                    for sol in sols:
                        try:
                            s_val = float(sol)
                            singularity_list.append({
                                'x': s_val,
                                'distance': abs(s_val - x0),
                                'type': 'branch_point'
                            })
                        except Exception:
                            continue
        except Exception:
            pass

        # 去重并选择最近的奇点
        seen = set()
        unique_singularities = []
        for s in singularity_list:
            key = round(s['x'], 6)
            if key not in seen:
                seen.add(key)
                unique_singularities.append(s)

        unique_singularities.sort(key=lambda s: s['distance'])
        if unique_singularities:
            nearest = unique_singularities[0]
            radius = nearest['distance']
        else:
            radius = None

        # 生成级数摘要
        non_zero_terms = [c for c in coefficients if c['coefficient'] is not None and abs(c['coefficient']) > 1e-12]
        if radius is None:
            series_summary = f"{expr} 在 x₀ = {x0} 处的泰勒级数在实数域内无明显奇点，可能在整个实数轴收敛。"
        else:
            series_summary = (
                f"{expr} 在 x₀ = {x0} 处的泰勒级数收敛半径约为 {radius:.4f}，"
                f"最近的奇点位于 x = {nearest['x']:.4f}（{nearest['type']}）。"
            )

        return {
            'coefficients': coefficients,
            'radius_of_convergence': radius,
            'nearest_singularity': nearest,
            'singularities': unique_singularities,
            'series_summary': series_summary
        }
    except Exception as e:
        logger.warning(f"analyze_taylor_series failed for {expr}: {e}")
        return {
            'coefficients': [],
            'radius_of_convergence': None,
            'nearest_singularity': None,
            'singularities': [],
            'series_summary': '无法分析泰勒级数收敛性'
        }


def evaluate_taylor_at_point(expr: str, x0: float, evaluate_at: float,
                              max_order: int = 5) -> Dict[str, Any]:
    """
    在指定点评估泰勒多项式的逼近效果

    Returns:
        {
            'x': float,              # 评估点
            'f_x': float,            # 真实函数值
            'approximations': [      # 各阶泰勒多项式在 x 处的值
                {'order': int, 'value': float, 'error': float, 'remainder_bound': float}, ...
            ],
            'best_order': int        # 实际误差最小的阶数
        }
    """
    x = sp.Symbol('x')
    try:
        func = _safe_parse(expr)

        # 真实函数值
        try:
            f_x = float(func.subs(x, evaluate_at))
            if np.isnan(f_x) or np.isinf(f_x):
                f_x = None
        except Exception:
            f_x = None

        # 计算各阶导数在 x0 处的值
        derivatives = []
        for i in range(max_order + 1):
            if i == 0:
                deriv_expr = func
            else:
                deriv_expr = sp.diff(func, x, i)
            try:
                deriv_value = float(deriv_expr.subs(x, x0))
                if np.isnan(deriv_value) or np.isinf(deriv_value):
                    deriv_value = 0.0
            except Exception:
                deriv_value = 0.0
            derivatives.append(deriv_value)

        # 逐项计算泰勒多项式在评估点的值
        approximations = []
        taylor_value = 0.0
        min_error = float('inf')
        best_order = 0

        for n in range(max_order + 1):
            term = derivatives[n] / float(sp.factorial(n)) * (evaluate_at - x0) ** n
            taylor_value += term

            actual_error = abs(f_x - taylor_value) if f_x is not None else None

            # 拉格朗日余项上界：|R_n| ≤ M/(n+1)! * |x - x0|^(n+1)
            if n < max_order:
                next_deriv_expr = sp.diff(func, x, n + 1)
                try:
                    # 在 [x0, x] 区间内搜索 n+1 阶导数最大值
                    interval = sorted([x0, evaluate_at])
                    search_points = np.linspace(interval[0], interval[1], 50)
                    f_next = sp.lambdify(x, next_deriv_expr, 'numpy')
                    y_arr = f_next(search_points)
                    if np.isscalar(y_arr):
                        y_arr = np.full_like(search_points, y_arr, dtype=float)
                    max_abs_deriv = float(np.max(np.abs(y_arr)))
                except Exception:
                    max_abs_deriv = 0.0
                    for xv in np.linspace(min(x0, evaluate_at), max(x0, evaluate_at), 50):
                        try:
                            val = abs(float(next_deriv_expr.subs(x, xv)))
                            if val > max_abs_deriv:
                                max_abs_deriv = val
                        except Exception:
                            continue
                remainder_bound = max_abs_deriv / float(sp.factorial(n + 1)) * abs(evaluate_at - x0) ** (n + 1)
            else:
                remainder_bound = None

            if actual_error is not None and actual_error < min_error:
                min_error = actual_error
                best_order = n

            approximations.append({
                'order': n,
                'value': taylor_value,
                'error': actual_error,
                'remainder_bound': remainder_bound
            })

        return {
            'x': evaluate_at,
            'f_x': f_x,
            'approximations': approximations,
            'best_order': best_order
        }
    except Exception as e:
        logger.warning(f"evaluate_taylor_at_point failed for {expr}: {e}")
        return {
            'x': evaluate_at,
            'f_x': None,
            'approximations': [],
            'best_order': 0
        }
