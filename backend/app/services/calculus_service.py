"""
微积分服务模块
提供极限、导数、积分等可视化计算功能
"""
from typing import Dict, List, Any, Union
import sympy as sp
import numpy as np
from app.utils.math_utils import (
    safe_eval_single,
    get_tangent_line,
    compute_delta_for_epsilon,
    generate_function_points,
    get_derivative,
    _safe_parse
)


class CalculusService:
    """微积分服务类"""

    @staticmethod
    def epsilon_delta_visualization(func_str: str, x0: float, L: float,
                                     epsilon: float, domain_range: list) -> Dict[str, Any]:
        """
        生成 ε-δ 极限可视化数据

        Args:
            func_str: 函数表达式
            x0: 极限点
            L: 极限值
            epsilon: epsilon 值
            domain_range: 绘图域 [x_min, x_max]

        Returns:
            dict: 包含可视化所需的所有数据
        """
        # 计算 delta
        delta = compute_delta_for_epsilon(func_str, x0, L, epsilon, domain_range)

        # 生成主函数曲线
        function_curve = generate_function_points(func_str, domain_range)

        # ε 带（水平带）
        y_upper = L + epsilon
        y_lower = L - epsilon
        epsilon_band_x = [domain_range[0], domain_range[1]]
        epsilon_band_upper_y = [y_upper, y_upper]
        epsilon_band_lower_y = [y_lower, y_lower]
        epsilon_fill_y = [y_lower, y_upper, y_upper, y_lower, y_lower]

        # δ 带（垂直带）
        x_left = x0 - delta
        x_right = x0 + delta
        delta_band_y = [min(function_curve['y'] or [0]) - 1,
                        max(function_curve['y'] or [1]) + 1]
        delta_fill_x = [x_left, x_right, x_right, x_left, x_left]

        # 极限点和函数值
        f_x0 = safe_eval_single(func_str, x0)

        # δ 区间端点的函数值（用于显示）
        f_left = safe_eval_single(func_str, x_left) if x_left > domain_range[0] else None
        f_right = safe_eval_single(func_str, x_right) if x_right < domain_range[1] else None

        return {
            'function_curve': function_curve,
            'epsilon_band': {
                'x': epsilon_band_x,
                'upper_y': epsilon_band_upper_y,
                'lower_y': epsilon_band_lower_y,
                'fill_y': epsilon_fill_y,
                'y_upper': y_upper,
                'y_lower': y_lower
            },
            'delta_band': {
                'x_left': x_left,
                'x_right': x_right,
                'x_range': [x_left, x_right],
                'y_range': delta_band_y,
                'fill_x': delta_fill_x
            },
            'limit_point': {
                'x0': x0,
                'L': L,
                'f_x0': f_x0
            },
            'delta_values': {
                'delta': delta,
                'epsilon': epsilon,
                'f_left': f_left,
                'f_right': f_right
            },
            'domain_range': domain_range
        }

    @staticmethod
    def derivative_visualization(func_str: str, x0: float, domain_range: list) -> Dict[str, Any]:
        """
        生成导数切线可视化数据

        Args:
            func_str: 函数表达式
            x0: 求导点
            domain_range: 绘图域 [x_min, x_max]

        Returns:
            dict: 包含可视化所需的所有数据
        """
        # 主函数曲线
        function_curve = generate_function_points(func_str, domain_range)

        # 切线参数
        slope, intercept = get_tangent_line(func_str, x0)

        # 切线数据
        tangent_x = [domain_range[0], domain_range[1]]
        tangent_y = [slope * domain_range[0] + intercept,
                     slope * domain_range[1] + intercept]

        # 法线数据（斜率为负倒数）
        if abs(slope) > 1e-10:
            normal_slope = -1 / slope
        else:
            normal_slope = float('inf') if slope == 0 else float('-inf')

        f_x0 = safe_eval_single(func_str, x0)
        normal_intercept = 0  # 默认值，在非无穷斜率时会被正确计算

        if normal_slope != float('inf') and normal_slope != float('-inf'):
            normal_intercept = f_x0 - normal_slope * x0
            normal_x = [domain_range[0], domain_range[1]]
            normal_y = [normal_slope * domain_range[0] + normal_intercept,
                        normal_slope * domain_range[1] + normal_intercept]
        else:
            normal_x = [x0, x0]
            normal_y = [f_x0 - 5, f_x0 + 5]

        # 导数值
        derivative_expr = get_derivative(func_str)

        return {
            'function_curve': function_curve,
            'tangent_line': {
                'x': tangent_x,
                'y': tangent_y,
                'slope': slope,
                'intercept': intercept,
                'equation': f'y = {slope:.4f}x + {intercept:.4f}'
            },
            'normal_line': {
                'x': normal_x,
                'y': normal_y,
                'slope': normal_slope,
                'equation': f'y = {normal_slope:.4f}x + {normal_intercept:.4f}' if normal_slope != float('inf') else 'x = ' + str(x0)
            },
            'point': {
                'x': x0,
                'y': f_x0
            },
            'derivative': {
                'value': slope,
                'expression': derivative_expr
            },
            'domain_range': domain_range
        }

    @staticmethod
    def secant_approximation(func_str: str, x0: float, h_values: list,
                              domain_range: list) -> Dict[str, Any]:
        """
        生成割线逼近切线的动画数据

        Args:
            func_str: 函数表达式
            x0: 目标点
            h_values: 逼近的 h 值序列
            domain_range: 绘图域

        Returns:
            dict: 包含每一步的割线数据
        """
        function_curve = generate_function_points(func_str, domain_range)
        f_x0 = safe_eval_single(func_str, x0)

        secants = []
        for h in h_values:
            x1 = x0 + h
            f_x1 = safe_eval_single(func_str, x1)

            # 割线斜率
            slope = (f_x1 - f_x0) / h if h != 0 else 0
            intercept = f_x0 - slope * x0

            # 割线数据
            secant_x = [domain_range[0], domain_range[1]]
            secant_y = [slope * domain_range[0] + intercept,
                        slope * domain_range[1] + intercept]

            secants.append({
                'h': h,
                'x1': x1,
                'f_x1': f_x1,
                'slope': slope,
                'intercept': intercept,
                'x': secant_x,
                'y': secant_y
            })

        # 最终的切线
        slope, intercept = get_tangent_line(func_str, x0)
        tangent_x = [domain_range[0], domain_range[1]]
        tangent_y = [slope * domain_range[0] + intercept,
                     slope * domain_range[1] + intercept]

        return {
            'function_curve': function_curve,
            'point': {'x': x0, 'y': f_x0},
            'secants': secants,
            'tangent': {
                'x': tangent_x,
                'y': tangent_y,
                'slope': slope
            },
            'domain_range': domain_range
        }

    @staticmethod
    def evaluate_function(func_str: str, x_values: list) -> Dict[str, List[float]]:
        """
        计算函数在多个点的值

        Args:
            func_str: 函数表达式
            x_values: x 坐标列表

        Returns:
            dict: {'x': [...], 'y': [...]}
        """
        y_values = [safe_eval_single(func_str, xv) for xv in x_values]
        return {'x': x_values, 'y': y_values}

    @staticmethod
    def compute_limit(func_str: str, x0: float) -> float:
        """
        计算极限值 L = lim(x→x0) f(x)

        Args:
            func_str: 函数表达式
            x0: 极限点

        Returns:
            float: 极限值 L
        """
        x = sp.Symbol('x')
        func = sp.sympify(func_str)
        L = sp.limit(func, x, x0)
        return float(L)

    @staticmethod
    def get_higher_derivatives(func_str: str, x0: float, order: int = 3,
                               domain_range: list = None) -> Dict[str, Any]:
        """
        计算高阶导数

        Args:
            func_str: 函数表达式
            x0: 求导点
            order: 最高阶数（默认3阶）
            domain_range: 绘图域 [x_min, x_max]

        Returns:
            dict: 包含各阶导数的曲线数据
        """
        x = sp.Symbol('x')
        func = sp.sympify(func_str)
        domain = domain_range or [x0 - 2, x0 + 2]

        curves = []
        for i in range(order + 1):
            if i == 0:
                expr = func
                name = 'f(x)'
            else:
                expr = sp.diff(func, x, i)
                name = f"f{'′' * i}(x)"

            x_vals = np.linspace(domain[0], domain[1], 500)
            y_vals = []
            for xv in x_vals:
                try:
                    yv = float(expr.subs(x, xv))
                    if np.isnan(yv) or np.isinf(yv):
                        y_vals.append(None)
                    else:
                        y_vals.append(yv)
                except (TypeError, ValueError, sp.SympifyError):
                    y_vals.append(None)

            curves.append({
                'order': i,
                'name': name,
                'expression': str(expr),
                'value_at_x0': float(expr.subs(x, x0)),
                'x': x_vals.tolist(),
                'y': y_vals
            })

        return {
            'function': func_str,
            'x0': x0,
            'curves': curves,
            'domain_range': domain
        }

    @staticmethod
    def taylor_visualization(func_str: str, x0: float, max_order: int = 5,
                             domain_range: list = None) -> Dict[str, Any]:
        """
        生成泰勒公式可视化数据

        泰勒公式: Tₙ(x) = f(x₀) + f'(x₀)(x-x₀) + f''(x₀)/2!(x-x₀)² + ... + f⁽ⁿ⁾(x₀)/n!(x-x₀)ⁿ

        Args:
            func_str: 函数表达式
            x0: 展开点
            max_order: 最大阶数（默认5）
            domain_range: 绘图域 [x_min, x_max]

        Returns:
            dict: 包含可视化所需的所有数据
        """
        x = sp.Symbol('x')
        func = sp.sympify(func_str)
        domain = domain_range or [x0 - 2, x0 + 2]

        # 原函数曲线
        function_curve = generate_function_points(func_str, domain)

        # 计算各阶导数在 x0 处的值
        derivatives_at_x0 = []
        for i in range(max_order + 1):
            if i == 0:
                expr = func
                value = float(func.subs(x, x0))
            else:
                expr = sp.diff(func, x, i)
                value = float(expr.subs(x, x0))
            derivatives_at_x0.append({
                'order': i,
                'expr': expr,
                'value': value
            })

        # 生成各阶泰勒多项式
        taylor_polynomials = []
        colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6']

        for order in range(max_order + 1):
            # 构建泰勒多项式: Tₙ(x) = Σₖ=₀ⁿ [f⁽ᵏ⁾(x₀)/k!] × (x-x₀)ᵏ
            taylor_expr = 0
            taylor_str_terms = []
            for k in range(order + 1):
                deriv = derivatives_at_x0[k]
                coeff = deriv['value'] / sp.factorial(k)
                term = coeff * (x - x0) ** k
                taylor_expr += term

                # 构建字符串表示
                if k == 0:
                    term_str = f"{deriv['value']:.4f}"
                elif k == 1:
                    term_str = f"{deriv['value']:.4f}(x - {x0})"
                else:
                    term_str = f"{deriv['value']:.4f}(x - {x0})^{k}"

                # 简化项的显示
                if coeff == 0:
                    continue
                taylor_str_terms.append(term_str)

            taylor_expr_simplified = sp.simplify(taylor_expr)

            # 生成泰勒多项式曲线数据
            x_vals = np.linspace(domain[0], domain[1], 500)
            y_vals = []
            for xv in x_vals:
                try:
                    yv = float(taylor_expr_simplified.subs(x, xv))
                    if np.isnan(yv) or np.isinf(yv):
                        y_vals.append(None)
                    else:
                        y_vals.append(yv)
                except (TypeError, ValueError, sp.SympifyError):
                    y_vals.append(None)

            # 构建易读的泰勒公式字符串
            formula_parts = []
            for k in range(order + 1):
                deriv = derivatives_at_x0[k]
                coeff = deriv['value'] / sp.factorial(k)
                if abs(coeff) < 1e-10:
                    continue

                if k == 0:
                    formula_parts.append(f"{coeff:.4f}")
                elif k == 1:
                    if len(formula_parts) == 0:
                        formula_parts.append(f"{coeff:.4f}(x - {x0})")
                    else:
                        formula_parts.append(f"{coeff:+.4f}(x - {x0})")
                else:
                    if len(formula_parts) == 0:
                        formula_parts.append(f"{coeff:.4f}(x - {x0})^{k}")
                    else:
                        formula_parts.append(f"{coeff:+.4f}(x - {x0})^{k}")

            formula_str = " + ".join(formula_parts) if formula_parts else "0"

            taylor_polynomials.append({
                'order': order,
                'name': f"T{order}(x)",
                'expression': str(taylor_expr_simplified),
                'formula': formula_str,
                'x': x_vals.tolist(),
                'y': y_vals,
                'color': colors[order % len(colors)]
            })

        # 计算余项（拉格朗日余项的估计）
        # Rₙ(x) = f⁽ⁿ⁺¹⁾(ξ)/(n+1)! × (x-x₀)ⁿ⁺¹, ξ ∈ (x₀, x)
        # 我们使用区间内 n+1 阶导数的最大值作为估计上界
        remainder_curves = []
        for order in range(max_order):
            if order + 1 > max_order:
                continue

            # 获取 n+1 阶导数
            n_plus_1_deriv = derivatives_at_x0[order + 1]['expr']

            # 采样搜索最大值
            x_search = np.linspace(domain[0], domain[1], 100)
            max_abs_deriv = 0
            for xv in x_search:
                try:
                    val = abs(float(n_plus_1_deriv.subs(x, xv)))
                    if val > max_abs_deriv and not (np.isnan(val) or np.isinf(val)):
                        max_abs_deriv = val
                except:
                    pass

            # 计算余项估计
            remainder_y = []
            for xv in x_vals:
                try:
                    # |Rₙ(x)| ≤ max|f⁽ⁿ⁺¹⁾(ξ)| / (n+1)! × |x-x₀|ⁿ⁺¹
                    term = max_abs_deriv / sp.factorial(order + 1) * abs(xv - x0) ** (order + 1)
                    remainder_y.append(float(term))
                except:
                    remainder_y.append(None)

            remainder_curves.append({
                'order': order,
                'name': f'R{order}(x) 界',
                'x': x_vals.tolist(),
                'y': remainder_y
            })

        # 计算实际的余项（f(x) - Tₙ(x)）
        actual_remainder_curves = []
        for order in range(max_order + 1):
            taylor = taylor_polynomials[order]
            actual_y = []
            for i, xv in enumerate(x_vals):
                f_val = function_curve['y'][i]
                t_val = taylor['y'][i]
                if f_val is not None and t_val is not None:
                    actual_y.append(f_val - t_val)
                else:
                    actual_y.append(None)

            actual_remainder_curves.append({
                'order': order,
                'name': f'余项 R{order}(x)',
                'x': x_vals.tolist(),
                'y': actual_y
            })

        # 求导点处的函数值
        f_x0 = float(func.subs(x, x0))

        return {
            'function': func_str,
            'x0': x0,
            'f_x0': f_x0,
            'max_order': max_order,
            'original_curve': function_curve,
            'taylor_polynomials': taylor_polynomials,
            'remainder_bound': remainder_curves,
            'actual_remainder': actual_remainder_curves,
            'domain_range': domain
        }

    @staticmethod
    def riemann_sum(func_str: str, a: float, b: float, n: int,
                    method: str = 'left', domain_range: List[float] = None) -> Dict[str, Any]:
        """
        计算黎曼和并生成可视化数据

        Args:
            func_str: 函数表达式字符串
            a: 积分下限
            b: 积分上限
            n: 分割数量
            method: 分割方法 ('left', 'right', 'midpoint', 'random')
            domain_range: 绘图域范围 [x_min, x_max]

        Returns:
            dict: 包含可视化所需的所有数据
        """
        x = sp.Symbol('x')
        func = _safe_parse(func_str)

        # 计算步长
        dx = (b - a) / n

        # 根据不同方法选择采样点
        if method == 'left':
            sample_points = [a + i * dx for i in range(n)]
        elif method == 'right':
            sample_points = [a + (i + 1) * dx for i in range(n)]
        elif method == 'midpoint':
            sample_points = [a + (i + 0.5) * dx for i in range(n)]
        elif method == 'random':
            np.random.seed(42)  # 保证可复现性
            sample_points = [a + np.random.uniform(i * dx, (i + 1) * dx) for i in range(n)]
        else:
            sample_points = [a + (i + 0.5) * dx for i in range(n)]  # 默认中点法

        # 计算每个矩形的面积
        heights = []
        for xi in sample_points:
            try:
                h = float(func.subs(x, xi))
                if np.isnan(h) or np.isinf(h):
                    h = 0
                heights.append(h)
            except (TypeError, ValueError):
                heights.append(0)

        # 计算黎曼和
        approximation = sum(h * dx for h in heights)

        # 计算真实积分值（用于误差计算）
        try:
            integral = sp.integrate(func, (x, a, b))
            if integral.is_real:
                exact_value = float(integral)
            else:
                exact_value = None
        except (sp.TypeError, sp.UndefinedError):
            exact_value = None

        # 误差
        error = abs(approximation - exact_value) if exact_value is not None else None

        # 生成矩形数据（用于可视化）
        rect_x_left = []
        rect_x_right = []
        rect_x_mid = []
        rect_heights = []
        rect_areas = []

        for i in range(n):
            x_left = a + i * dx
            x_right = a + (i + 1) * dx
            x_mid = (x_left + x_right) / 2
            h = heights[i] if i < len(heights) else 0

            rect_x_left.append(x_left)
            rect_x_right.append(x_right)
            rect_x_mid.append(x_mid)
            rect_heights.append(h)
            rect_areas.append(h * dx)

        # 生成主函数曲线
        plot_domain = domain_range or [a - 0.1 * (b - a), b + 0.1 * (b - a)]
        function_curve = generate_function_points(func_str, plot_domain, 500)

        # 矩形边界线（用于可视化）
        rect_lines_x = []
        rect_lines_y = []
        for i in range(n):
            x_left = a + i * dx
            x_right = a + (i + 1) * dx
            h = heights[i] if i < len(heights) else 0
            # 每个矩形添加4个点和闭合线
            rect_lines_x.extend([x_left, x_left, x_right, x_right, None])
            rect_lines_y.extend([0, h, h, 0, None])

        return {
            'function': func_str,
            'interval': {'a': a, 'b': b},
            'n': n,
            'method': method,
            'rectangles': {
                'x_left': rect_x_left,
                'x_right': rect_x_right,
                'x_mid': rect_x_mid,
                'height': rect_heights,
                'area': sum(rect_areas)
            },
            'rect_lines': {
                'x': rect_lines_x,
                'y': rect_lines_y
            },
            'approximation': approximation,
            'exact_value': exact_value,
            'error': error,
            'function_curve': function_curve,
            'domain_range': plot_domain
        }

    @staticmethod
    def numerical_integration_convergence(func_str: str, a: float, b: float,
                                           n_values: List[int] = None,
                                           domain_range: List[float] = None) -> Dict[str, Any]:
        """
        对比不同数值积分方法的误差收敛速度

        Args:
            func_str: 函数表达式字符串
            a: 积分下限
            b: 积分上限
            n_values: 要测试的分割数列表
            domain_range: 绘图域范围

        Returns:
            dict: 包含各方法的误差收敛数据
        """
        if n_values is None:
            n_values = [4, 8, 16, 32, 64, 128, 256, 512]

        x = sp.Symbol('x')
        func = _safe_parse(func_str)

        # 计算真实积分值
        try:
            integral = sp.integrate(func, (x, a, b))
            if integral.is_real:
                exact_value = float(integral)
            else:
                exact_value = None
        except (sp.TypeError, sp.UndefinedError):
            exact_value = None

        if exact_value is None:
            # 如果无法计算精确值，使用高分辨率数值积分
            from scipy.integrate import quad
            f_numeric = sp.lambdify(x, func, 'numpy')
            try:
                exact_value, _ = quad(f_numeric, a, b)
            except:
                exact_value = None

        # 定义不同的数值积分方法
        methods = ['left', 'right', 'midpoint', 'trapezoid', 'simpson']

        results = {}

        for method in methods:
            errors = []
            for n in n_values:
                dx = (b - a) / n

                if method in ['left', 'right', 'midpoint']:
                    # 矩形法
                    if method == 'left':
                        sample_points = np.array([a + i * dx for i in range(n)])
                    elif method == 'right':
                        sample_points = np.array([a + (i + 1) * dx for i in range(n)])
                    else:  # midpoint
                        sample_points = np.array([a + (i + 0.5) * dx for i in range(n)])

                    # 计算函数值
                    f_values = []
                    for xi in sample_points:
                        try:
                            fv = float(func.subs(x, xi))
                            if np.isnan(fv) or np.isinf(fv):
                                fv = 0
                            f_values.append(fv)
                        except:
                            f_values.append(0)

                    approximation = sum(fv * dx for fv in f_values)

                elif method == 'trapezoid':
                    # 梯形法
                    x_points = np.linspace(a, b, n + 1)
                    y_values = []
                    for xi in x_points:
                        try:
                            yv = float(func.subs(x, xi))
                            if np.isnan(yv) or np.isinf(yv):
                                yv = 0
                            y_values.append(yv)
                        except:
                            y_values.append(0)
                    approximation = np.trapz(y_values, x_points)

                elif method == 'simpson':
                    # 辛普森法（需要偶数个区间）
                    n_even = n if n % 2 == 0 else n + 1
                    if n_even < 4:
                        n_even = 4
                    x_points = np.linspace(a, b, n_even + 1)
                    y_values = []
                    for xi in x_points:
                        try:
                            yv = float(func.subs(x, xi))
                            if np.isnan(yv) or np.isinf(yv):
                                yv = 0
                            y_values.append(yv)
                        except:
                            y_values.append(0)
                    # 手动实现 Simpson 法则
                    dx = x_points[1] - x_points[0]
                    approximation = (dx / 3) * (
                        y_values[0] +
                        y_values[-1] +
                        4 * sum(y_values[i] for i in range(1, n_even, 2)) +
                        2 * sum(y_values[i] for i in range(2, n_even - 1, 2))
                    )

                error = abs(approximation - exact_value) if exact_value is not None else 0
                errors.append({'n': n, 'error': error})

            results[method] = {
                'name': method,
                'errors': errors
            }

        # 生成函数曲线用于绘图
        plot_domain = domain_range or [a - 0.1 * (b - a), b + 0.1 * (b - a)]
        function_curve = generate_function_points(func_str, plot_domain, 500)

        return {
            'function': func_str,
            'interval': {'a': a, 'b': b},
            'exact_value': exact_value,
            'methods': results,
            'n_values': n_values,
            'function_curve': function_curve,
            'domain_range': plot_domain
        }
