"""
向量场与线积分服务模块
提供向量场可视化、流线计算、线积分、格林公式验证等功能
"""
from typing import Dict, List, Any, Tuple, Optional
import sympy as sp
import numpy as np
from scipy.integrate import quad, solve_ivp, dblquad
from app.utils.math_utils import _safe_parse


class VectorFieldService:
    """向量场与线积分服务类"""

    # ============ 预设向量场配置 ============
    VECTOR_FIELD_PRESETS = [
        {
            "id": "rotational",
            "name": "旋转场",
            "description": "F = (-y, x)，旋度恒为2",
            "P": "-y",
            "Q": "x",
            "potential": None
        },
        {
            "id": "conservative",
            "name": "保守场（梯度场）",
            "description": "F = ∇f，沿闭合路径积分为零",
            "P": "2*x",
            "Q": "2*y",
            "potential": "x**2 + y**2"
        },
        {
            "id": "radial",
            "name": "辐射场",
            "description": "从原点向外辐射的向量场",
            "P": "x",
            "Q": "y",
            "potential": None
        },
        {
            "id": "shear",
            "name": "剪切场",
            "description": "水平剪切向量场",
            "P": "y",
            "Q": "0",
            "potential": None
        },
        {
            "id": "saddle",
            "name": "鞍点场",
            "description": "F = (x, -y)，鞍点动力学",
            "P": "x",
            "Q": "-y",
            "potential": None
        },
        {
            "id": "vortex",
            "name": "涡旋场",
            "description": "旋度集中在原点",
            "P": "-y/(x**2 + y**2 + 0.1)",
            "Q": "x/(x**2 + y**2 + 0.1)",
            "potential": None
        },
        {
            "id": "source_sink",
            "name": "源-汇场",
            "description": "带源和汇的向量场",
            "P": "2*x - 1",
            "Q": "2*y",
            "potential": None
        }
    ]

    # ============ 路径预设配置 ============
    PATH_PRESETS = [
        {
            "id": "circle",
            "name": "单位圆（逆时针）",
            "description": "x = cos(t), y = sin(t), t ∈ [0, 2π]",
            "parametric": {
                "x": "cos(t)",
                "y": "sin(t)",
                "t_range": [0, 2 * np.pi]
            },
            "is_closed": True
        },
        {
            "id": "ellipse",
            "name": "椭圆",
            "description": "x = 2cos(t), y = sin(t), t ∈ [0, 2π]",
            "parametric": {
                "x": "2*cos(t)",
                "y": "sin(t)",
                "t_range": [0, 2 * np.pi]
            },
            "is_closed": True
        },
        {
            "id": "line_segment",
            "name": "直线段",
            "description": "从 (0,0) 到 (1,1)",
            "parametric": {
                "x": "t",
                "y": "t",
                "t_range": [0, 1]
            },
            "is_closed": False
        },
        {
            "id": "parabola",
            "name": "抛物线段",
            "description": "y = x^2, x ∈ [-1, 1]",
            "parametric": {
                "x": "t",
                "y": "t**2",
                "t_range": [-1, 1]
            },
            "is_closed": False
        },
        {
            "id": "square",
            "name": "正方形",
            "description": "边长为2的正方形路径",
            "parametric": {
                "segments": [
                    {"x": "t", "y": "-1", "t_range": [-1, 1]},
                    {"x": "1", "y": "t", "t_range": [-1, 1]},
                    {"x": "t", "y": "1", "t_range": [1, -1]},
                    {"x": "-1", "y": "t", "t_range": [1, -1]}
                ]
            },
            "is_closed": True
        }
    ]

    @staticmethod
    def vector_field_visualization(
        p_str: str,
        q_str: str,
        x_range: List[float],
        y_range: List[float],
        resolution: int = 20
    ) -> Dict[str, Any]:
        """
        生成向量场可视化数据

        Args:
            p_str: 向量场 x 分量表达式 P(x, y)
            q_str: 向量场 y 分量表达式 Q(x, y)
            x_range: x 范围 [x_min, x_max]
            y_range: y 范围 [y_min, y_max]
            resolution: 网格分辨率

        Returns:
            dict: 包含向量场箭头数据、旋度、散度等
        """
        x, y = sp.symbols('x y')
        try:
            # 解析向量场表达式
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            # 生成网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            X, Y = np.meshgrid(x_vals, y_vals)

            # 计算向量场分量
            P_func = sp.lambdify((x, y), P, 'numpy')
            Q_func = sp.lambdify((x, y), Q, 'numpy')

            U = P_func(X, Y)
            V = Q_func(X, Y)

            # 确保 U 和 V 是 numpy 数组（lambdify 对常量函数可能返回标量）
            U = np.asarray(U)
            V = np.asarray(V)

            # 如果是标量，转换为与 X 形状相同的数组
            if U.ndim == 0:
                U = np.full_like(X, U.item())
            if V.ndim == 0:
                V = np.full_like(X, V.item())

            # 处理 NaN 和 Inf
            U = np.where(np.isnan(U) | np.isinf(U), 0, U)
            V = np.where(np.isnan(V) | np.isinf(V), 0, V)

            # 计算向量幅值（用于颜色映射）
            magnitude = np.sqrt(U**2 + V**2)

            # 计算旋度 curl(F) = ∂Q/∂x - ∂P/∂y
            curl_expr = sp.diff(Q, x) - sp.diff(P, y)
            curl_func = sp.lambdify((x, y), curl_expr, 'numpy')
            Curl = curl_func(X, Y)
            Curl = np.where(np.isnan(Curl) | np.isinf(Curl), 0, Curl)

            # 计算散度 div(F) = ∂P/∂x + ∂Q/∂y
            div_expr = sp.diff(P, x) + sp.diff(Q, y)
            div_func = sp.lambdify((x, y), div_expr, 'numpy')
            Div = div_func(X, Y)
            Div = np.where(np.isnan(Div) | np.isinf(Div), 0, Div)

            # 归一化箭头长度（用于更好的可视化）
            max_mag = np.nanmax(magnitude)
            if max_mag > 0:
                U_norm = U / max_mag * 0.8
                V_norm = V / max_mag * 0.8
            else:
                U_norm = U
                V_norm = V

            return {
                'success': True,
                'vector_field': {
                    'x': X.tolist(),
                    'y': Y.tolist(),
                    'u': U.tolist(),
                    'v': V.tolist(),
                    'u_norm': U_norm.tolist(),
                    'v_norm': V_norm.tolist(),
                    'magnitude': magnitude.tolist()
                },
                'curl': {
                    'values': Curl.tolist(),
                    'expression': str(curl_expr)
                },
                'divergence': {
                    'values': Div.tolist(),
                    'expression': str(div_expr)
                },
                'field_expressions': {
                    'P': p_str,
                    'Q': q_str
                },
                'x_range': x_range,
                'y_range': y_range
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def compute_streamline(
        p_str: str,
        q_str: str,
        start_points: List[Tuple[float, float]],
        t_span: Tuple[float, float],
        t_eval: np.ndarray = None,
        direction: str = 'both'
    ) -> Dict[str, Any]:
        """
        计算流线（积分曲线）

        流线是满足 dr/dt = F(r) 的曲线

        Args:
            p_str: 向量场 x 分量 P(x, y)
            q_str: 向量场 y 分量 Q(x, y)
            start_points: 起始点列表 [(x1, y1), (x2, y2), ...]
            t_span: 积分时间范围 (t_start, t_end)
            t_eval: 评估时间点数组
            direction: 积分方向 ('forward', 'backward', 'both')

        Returns:
            dict: 包含流线路径数据
        """
        x_sym, y_sym = sp.symbols('x y')
        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            # 定义向量场函数
            def vector_field(t, pos):
                xi, yi = pos
                try:
                    ui = float(P.subs({x_sym: xi, y_sym: yi}))
                    vi = float(Q.subs({x_sym: xi, y_sym: yi}))
                    # 处理数值问题
                    if np.isnan(ui) or np.isinf(ui):
                        ui = 0
                    if np.isnan(vi) or np.isinf(vi):
                        vi = 0
                    return [ui, vi]
                except:
                    return [0, 0]

            # 如果没有指定评估点，生成默认点
            if t_eval is None:
                t_eval = np.linspace(t_span[0], t_span[1], 100)

            streamlines = []

            for start_x, start_y in start_points:
                x_vals = []
                y_vals = []

                # 前向积分
                if direction in ['forward', 'both']:
                    try:
                        sol_forward = solve_ivp(
                            vector_field,
                            [0, abs(t_span[1])],
                            [start_x, start_y],
                            t_eval=np.linspace(0, abs(t_span[1]), 50),
                            method='RK45',
                            rtol=1e-6
                        )
                        if sol_forward.success:
                            x_vals.extend(sol_forward.y[0].tolist())
                            y_vals.extend(sol_forward.y[1].tolist())
                    except:
                        pass

                # 后向积分
                if direction in ['backward', 'both']:
                    try:
                        sol_backward = solve_ivp(
                            vector_field,
                            [0, abs(t_span[0])],
                            [start_x, start_y],
                            t_eval=np.linspace(0, abs(t_span[0]), 50),
                            method='RK45',
                            rtol=1e-6
                        )
                        if sol_backward.success:
                            # 反向时间
                            x_backward = sol_backward.y[0].tolist()
                            y_backward = sol_backward.y[1].tolist()
                            x_vals = list(reversed(x_backward)) + x_vals
                            y_vals = list(reversed(y_backward)) + y_vals
                    except:
                        pass

                streamlines.append({
                    'start_point': {'x': start_x, 'y': start_y},
                    'x': x_vals,
                    'y': y_vals
                })

            return {
                'success': True,
                'streamlines': streamlines,
                'field': {'P': p_str, 'Q': q_str}
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def compute_line_integral(
        p_str: str,
        q_str: str,
        path_config: Dict[str, Any],
        num_points: int = 200
    ) -> Dict[str, Any]:
        """
        计算沿路径的线积分 ∫_C P dx + Q dy

        Args:
            p_str: 向量场 x 分量 P(x, y)
            q_str: 向量场 y 分量 Q(x, y)
            path_config: 路径配置
            num_points: 采样点数

        Returns:
            dict: 包含积分值、路径数据、通量等
        """
        x_sym, y_sym, t = sp.symbols('x y t')

        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            path_x = []
            path_y = []

            def integrate_parametric(x_expr, y_expr, t_range, reverse=False):
                """计算参数化路径的线积分"""
                t0, t1 = t_range
                if reverse:
                    t0, t1 = t1, t0

                # 参数方程导数
                dx_dt = sp.diff(x_expr, t)
                dy_dt = sp.diff(y_expr, t)

                # 被积函数: P(x(t), y(t)) * x'(t) + Q(x(t), y(t)) * y'(t)
                integrand = P.subs({x_sym: x_expr, y_sym: y_expr}) * dx_dt + \
                           Q.subs({x_sym: x_expr, y_sym: y_expr}) * dy_dt

                # 数值积分
                integrand_func = sp.lambdify(t, integrand, 'numpy')
                integral_value, _ = quad(integrand_func, t0, t1)

                # 生成路径点用于可视化
                t_vals = np.linspace(t0, t1, num_points)
                x_func = sp.lambdify(t, x_expr, 'numpy')
                y_func = sp.lambdify(t, y_expr, 'numpy')

                x_vals = x_func(t_vals)
                y_vals = y_func(t_vals)

                # 计算沿路径的向量场分量
                P_func = sp.lambdify((x_sym, y_sym), P, 'numpy')
                Q_func = sp.lambdify((x_sym, y_sym), Q, 'numpy')

                u_vals = P_func(x_vals, y_vals)
                v_vals = Q_func(x_vals, y_vals)

                # 计算切向量和法向量
                dx_dt_vals = sp.lambdify(t, dx_dt, 'numpy')(t_vals)
                dy_dt_vals = sp.lambdify(t, dy_dt, 'numpy')(t_vals)

                # 归一化切向量
                tangent_mag = np.sqrt(dx_dt_vals**2 + dy_dt_vals**2) + 1e-10
                u_tangent = dx_dt_vals / tangent_mag
                v_tangent = dy_dt_vals / tangent_mag

                # 法向量（逆时针旋转90度）
                u_normal = -v_tangent
                v_normal = u_tangent

                # 向量场沿切向量的投影（点积）
                tangent_projection = u_vals * u_tangent + v_vals * v_tangent

                # 通量（向量场沿法向量的投影）
                normal_projection = u_vals * u_normal + v_vals * v_normal

                # 计算ds (弧长微元)
                ds = np.sqrt(dx_dt_vals**2 + dy_dt_vals**2)

                # 通量积分 ∫ F·n ds
                flux_value = np.trapz(normal_projection * ds, t_vals)

                return {
                    'integral': integral_value,
                    'x': x_vals.tolist(),
                    'y': y_vals.tolist(),
                    't': t_vals.tolist(),
                    'u_field': u_vals.tolist(),
                    'v_field': v_vals.tolist(),
                    'u_tangent': u_tangent.tolist(),
                    'v_tangent': v_tangent.tolist(),
                    'tangent_projection': tangent_projection.tolist(),
                    'u_normal': u_normal.tolist(),
                    'v_normal': v_normal.tolist(),
                    'normal_projection': normal_projection.tolist(),
                    'flux_value': flux_value
                }

            # 处理多段路径
            if path_config.get('type') == 'segments':
                segments = path_config.get('segments', [])
                total_integral = 0
                total_flux = 0
                all_segments = []

                for seg in segments:
                    x_expr = _safe_parse(seg['x'])
                    y_expr = _safe_parse(seg['y'])
                    t_range = seg['t_range']

                    result = integrate_parametric(x_expr, y_expr, t_range)
                    total_integral += result['integral']
                    total_flux += result.get('flux_value', 0)

                    all_segments.append(result)
                    path_x.extend(result['x'])
                    path_y.extend(result['y'])

                return {
                    'success': True,
                    'integral_value': total_integral,
                    'flux_value': total_flux,
                    'path': {
                        'x': path_x,
                        'y': path_y
                    },
                    'segments': all_segments,
                    'field': {'P': p_str, 'Q': q_str}
                }
            else:
                # 单一参数化路径
                x_expr = _safe_parse(path_config['x'])
                y_expr = _safe_parse(path_config['y'])
                t_range = path_config['t_range']

                result = integrate_parametric(x_expr, y_expr, t_range)

                return {
                    'success': True,
                    'integral_value': result['integral'],
                    'flux_value': result.get('flux_value', 0),
                    'path': {
                        'x': result['x'],
                        'y': result['y']
                    },
                    'field_data': {
                        'u_field': result['u_field'],
                        'v_field': result['v_field'],
                        'u_tangent': result['u_tangent'],
                        'v_tangent': result['v_tangent'],
                        'tangent_projection': result['tangent_projection'],
                        'u_normal': result['u_normal'],
                        'v_normal': result['v_normal'],
                        'normal_projection': result['normal_projection']
                    },
                    'field': {'P': p_str, 'Q': q_str}
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def verify_greens_theorem(
        p_str: str,
        q_str: str,
        region_type: str = 'circle',
        region_params: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """
        验证格林公式: ∮_C P dx + Q dy = ∬_D (∂Q/∂x - ∂P/∂y) dA

        Args:
            p_str: 向量场 x 分量 P(x, y)
            q_str: 向量场 y 分量 Q(x, y)
            region_type: 区域类型 ('circle', 'rectangle')
            region_params: 区域参数

        Returns:
            dict: 包含左右两边计算结果和验证信息
        """
        x, y, t = sp.symbols('x y t')

        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            # 计算旋度
            curl_expr = sp.diff(Q, x) - sp.diff(P, y)
            curl_func = sp.lambdify((x, y), curl_expr, 'numpy')

            region_params = region_params or {}
            boundary_data = {'x': [], 'y': []}
            line_integral = 0

            if region_type == 'circle':
                # 圆形区域
                r = region_params.get('radius', 1)
                x_expr = r * sp.cos(t)
                y_expr = r * sp.sin(t)

                dx_dt = sp.diff(x_expr, t)
                dy_dt = sp.diff(y_expr, t)

                integrand = P.subs({x: x_expr, y: y_expr}) * dx_dt + \
                           Q.subs({x: x_expr, y: y_expr}) * dy_dt

                integrand_func = sp.lambdify(t, integrand, 'numpy')
                line_integral, _ = quad(integrand_func, 0, 2 * np.pi)

                # 生成边界点
                t_vals = np.linspace(0, 2 * np.pi, 100)
                x_func = sp.lambdify(t, x_expr, 'numpy')
                y_func = sp.lambdify(t, y_expr, 'numpy')
                boundary_data['x'] = x_func(t_vals).tolist()
                boundary_data['y'] = y_func(t_vals).tolist()

                # 面积分
                area_integral, _ = dblquad(
                    lambda y_val, x_val: curl_func(x_val, y_val),
                    -r, r,
                    lambda x_val: -np.sqrt(max(0, r**2 - x_val**2)),
                    lambda x_val: np.sqrt(max(0, r**2 - x_val**2))
                )

            elif region_type == 'rectangle':
                # 矩形区域
                x_min = region_params.get('x_min', -1)
                x_max = region_params.get('x_max', 1)
                y_min = region_params.get('y_min', -1)
                y_max = region_params.get('y_max', 1)

                # 四条边的线积分
                segments = [
                    {'x': t, 'y': str(y_min), 't_range': [x_min, x_max]},
                    {'x': str(x_max), 'y': t, 't_range': [y_min, y_max]},
                    {'x': -t + x_max + x_min, 'y': str(y_max), 't_range': [0, x_max - x_min]},
                    {'x': str(x_min), 'y': -t + y_max + y_min, 't_range': [0, y_max - y_min]}
                ]

                for seg in segments:
                    x_expr = _safe_parse(seg['x']) if isinstance(seg['x'], str) else seg['x']
                    y_expr = _safe_parse(seg['y']) if isinstance(seg['y'], str) else seg['y']
                    t_range = seg['t_range']

                    dx_dt = sp.diff(x_expr, t)
                    dy_dt = sp.diff(y_expr, t)

                    integrand = P.subs({x: x_expr, y: y_expr}) * dx_dt + \
                               Q.subs({x: x_expr, y: y_expr}) * dy_dt

                    integrand_func = sp.lambdify(t, integrand, 'numpy')
                    seg_integral, _ = quad(integrand_func, t_range[0], t_range[1])
                    line_integral += seg_integral

                # 生成边界点
                boundary_data['x'] = [x_min, x_max, x_max, x_min, x_min]
                boundary_data['y'] = [y_min, y_min, y_max, y_max, y_min]

                # 面积分
                area_integral, _ = dblquad(
                    lambda y_val, x_val: curl_func(x_val, y_val),
                    x_min, x_max,
                    lambda x_val: y_min,
                    lambda x_val: y_max
                )
            else:
                return {
                    'success': False,
                    'error': f'Unsupported region type: {region_type}'
                }

            # 计算差异
            difference = abs(line_integral - area_integral)
            relative_error = difference / (abs(line_integral) + abs(area_integral) + 1e-10)

            return {
                'success': True,
                'greens_theorem': {
                    'left_side': {
                        'value': line_integral,
                        'expression': f'∮_C ({p_str}) dx + ({q_str}) dy'
                    },
                    'right_side': {
                        'value': area_integral,
                        'integrand': str(curl_expr),
                        'expression': f'∬_D ({curl_expr}) dA'
                    },
                    'difference': difference,
                    'relative_error': relative_error,
                    'is_verified': relative_error < 0.01
                },
                'boundary': boundary_data,
                'region': {
                    'type': region_type,
                    'params': region_params
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_presets() -> Dict[str, Any]:
        """获取所有预设向量场和路径"""
        return {
            'success': True,
            'vector_fields': VectorFieldService.VECTOR_FIELD_PRESETS,
            'paths': VectorFieldService.PATH_PRESETS
        }

    @staticmethod
    def is_conservative(p_str: str, q_str: str) -> Dict[str, Any]:
        """
        检查向量场是否保守

        向量场 F = (P, Q) 是保守场的条件：
        1. curl(F) = ∂Q/∂x - ∂P/∂y = 0（在单连通区域内）

        Args:
            p_str: 向量场 x 分量 P(x, y)
            q_str: 向量场 y 分量 Q(x, y)

        Returns:
            dict: 包含是否保守、旋度表达式等信息
        """
        x, y = sp.symbols('x y')
        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            # 计算旋度 curl(F) = ∂Q/∂x - ∂P/∂y
            curl_expr = sp.diff(Q, x) - sp.diff(P, y)
            curl_str = sp.simplify(curl_expr)

            # 判断旋度是否为零
            is_conservative = sp.simplify(curl_str) == 0

            # 计算典型点的旋度值
            curl_func = sp.lambdify((x, y), curl_str, 'numpy')
            test_points = [(0, 0), (1, 1), (-1, -1)]
            curl_values = []
            for px, py in test_points:
                try:
                    val = curl_func(px, py)
                    if np.isfinite(val):
                        curl_values.append(float(val))
                    else:
                        curl_values.append(0.0)
                except:
                    curl_values.append(0.0)

            return {
                'success': True,
                'is_conservative': is_conservative,
                'curl_expression': str(curl_str),
                'curl_value': curl_values[0] if curl_values else 0.0,
                'curl_at_points': curl_values,
                'message': '该向量场是保守场' if is_conservative else '该向量场不是保守场（旋度不为零）'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'is_conservative': False
            }

    @staticmethod
    def find_potential(p_str: str, q_str: str) -> Dict[str, Any]:
        """
        计算势函数 f，使得 F = grad(f) = (∂f/∂x, ∂f/∂y)

        保守场必然存在势函数，通过积分方法求解

        Args:
            p_str: 向量场 x 分量 P(x, y)
            q_str: 向量场 y 分量 Q(x, y)

        Returns:
            dict: 包含势函数表达式、验证结果等
        """
        x, y = sp.symbols('x y')
        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            # 首先检查旋度
            curl_expr = sp.diff(Q, x) - sp.diff(P, y)
            curl_str = sp.simplify(curl_expr)

            if sp.simplify(curl_str) != 0:
                return {
                    'success': True,
                    'is_conservative': False,
                    'potential_function': None,
                    'error': '向量场不是保守场，不存在势函数',
                    'curl_expression': str(curl_str)
                }

            # 通过积分求势函数
            # 步骤1：f(x,y) = ∫ P(x,y) dx + g(y)
            potential_x = sp.integrate(P, x)
            # 整合后的势函数关于x的积分
            # 需要确定一个只与y相关的函数g(y)

            # 步骤2：对y求偏导并与Q比较，确定g(y)
            # ∂f/∂y = ∂/∂y(∫ P dx) + g'(y) = Q
            # g'(y) = Q - ∂/∂y(∫ P dx)
            potential_y = sp.diff(potential_x, y)
            g_prime = sp.simplify(Q - potential_y)

            # 步骤3：积分求g(y)
            g_y = sp.integrate(g_prime, y)

            # 步骤4：组合势函数
            potential = sp.simplify(potential_x + g_y)

            # 尝试简化势函数
            potential_simplified = sp.simplify(potential)

            # 验证：计算梯度
            df_dx = sp.diff(potential_simplified, x)
            df_dy = sp.diff(potential_simplified, y)

            # 检查是否匹配原向量场
            matches_x = sp.simplify(df_dx - P) == 0
            matches_y = sp.simplify(df_dy - Q) == 0
            is_valid = matches_x and matches_y

            # 转换为字符串表示
            potential_str = str(potential_simplified)

            return {
                'success': True,
                'is_conservative': True,
                'potential_function': potential_str,
                'grad_x': str(df_dx),
                'grad_y': str(df_dy),
                'matches_field': is_valid,
                'message': f'势函数 f(x,y) = {potential_str}' if is_valid else '无法找到合适的势函数'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'is_conservative': False,
                'potential_function': None
            }

    @staticmethod
    def compute_potential_contour(
        p_str: str,
        q_str: str,
        x_range: List[float],
        y_range: List[float],
        resolution: int = 50
    ) -> Dict[str, Any]:
        """
        计算势函数的等值线数据

        Args:
            p_str: 向量场 x 分量
            q_str: 向量场 y 分量
            x_range: x 范围
            y_range: y 范围
            resolution: 网格分辨率

        Returns:
            dict: 包含等值线数据
        """
        try:
            # 首先计算势函数
            potential_result = VectorFieldService.find_potential(p_str, q_str)

            if not potential_result.get('success') or not potential_result.get('is_conservative'):
                return {
                    'success': False,
                    'error': '向量场不是保守场，无法计算势函数等值线'
                }

            potential_str = potential_result.get('potential_function')
            x, y = sp.symbols('x y')
            potential = _safe_parse(potential_str)

            # 生成网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            X, Y = np.meshgrid(x_vals, y_vals)

            # 计算势函数值
            potential_func = sp.lambdify((x, y), potential, 'numpy')
            Z = potential_func(X, Y)
            Z = np.asarray(Z)

            # 处理 NaN 和 Inf
            Z = np.where(np.isnan(Z) | np.isinf(Z), 0, Z)

            # 计算等值线（自动选择层级）
            z_min = np.nanmin(Z)
            z_max = np.nanmax(Z)
            levels = np.linspace(z_min, z_max, 15)

            return {
                'success': True,
                'potential_function': potential_str,
                'x': X.tolist(),
                'y': Y.tolist(),
                'z': Z.tolist(),
                'levels': levels.tolist(),
                'z_range': [float(z_min), float(z_max)]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def verify_path_independence(
        p_str: str,
        q_str: str,
        start_point: List[float],
        end_point: List[float],
        num_points: int = 200
    ) -> Dict[str, Any]:
        """
        验证保守场的路径无关性

        沿不同路径计算线积分，比较结果是否相等。

        Args:
            p_str: 向量场 x 分量
            q_str: 向量场 y 分量
            start_point: 起点 [x, y]
            end_point: 终点 [x, y]
            num_points: 采样点数

        Returns:
            dict: 包含各路径积分结果和比较
        """
        try:
            # 首先检查是否是保守场
            conservative_check = VectorFieldService.is_conservative(p_str, q_str)
            is_conservative = conservative_check.get('is_conservative', False)

            x_sym, y_sym, t = sp.symbols('x y t')
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)

            def generate_path(path_type: str, **kwargs):
                """生成参数化路径"""
                if path_type == 'straight':
                    x_t = start_point[0] + t * (end_point[0] - start_point[0])
                    y_t = start_point[1] + t * (end_point[1] - start_point[1])
                    return x_t, y_t, [0, 1], '直线路径'
                elif path_type == 'broken':
                    mid_x = end_point[0]
                    mid_y = start_point[1]
                    x_t1 = start_point[0] + t * (mid_x - start_point[0])
                    y_t1 = start_point[1] + t * (mid_y - start_point[1])
                    x_t2 = mid_x + t * (end_point[0] - mid_x)
                    y_t2 = mid_y + t * (end_point[1] - mid_y)
                    return [(x_t1, y_t1, [0, 1]), (x_t2, y_t2, [0, 1])], '折线路径'
                elif path_type == 'parabola':
                    mid_x = (start_point[0] + end_point[0]) / 2
                    mid_y = max(start_point[1], end_point[1]) + abs(end_point[0] - start_point[0]) / 2
                    x_t = start_point[0] + t * (end_point[0] - start_point[0])
                    y_t = start_point[1] + t * (end_point[1] - start_point[1]) + \
                          2 * t * (1 - t) * (mid_y - (start_point[1] + end_point[1]) / 2)
                    return x_t, y_t, [0, 1], '抛物线路径'
                else:
                    raise ValueError(f"Unknown path type: {path_type}")

            def compute_line_integral(x_t, y_t, t_range, segments=None):
                """计算路径积分"""
                if segments:
                    total = 0.0
                    for seg_x, seg_y, seg_range in segments:
                        dx_dt = sp.diff(seg_x, t)
                        dy_dt = sp.diff(seg_y, t)
                        integrand = P.subs({x_sym: seg_x, y_sym: seg_y}) * dx_dt + \
                                   Q.subs({x_sym: seg_x, y_sym: seg_y}) * dy_dt
                        integrand_func = sp.lambdify(t, integrand, 'numpy')
                        t_vals = np.linspace(seg_range[0], seg_range[1], num_points)
                        integral_vals = integrand_func(t_vals)
                        if not np.isfinite(integral_vals).all():
                            integral_vals = np.where(np.isfinite(integral_vals), integral_vals, 0)
                        total += np.trapz(integral_vals, t_vals)
                    return total
                else:
                    dx_dt = sp.diff(x_t, t)
                    dy_dt = sp.diff(y_t, t)
                    integrand = P.subs({x_sym: x_t, y_sym: y_t}) * dx_dt + \
                               Q.subs({x_sym: x_t, y_sym: y_t}) * dy_dt
                    integrand_func = sp.lambdify(t, integrand, 'numpy')
                    t_vals = np.linspace(t_range[0], t_range[1], num_points)
                    integral_vals = integrand_func(t_vals)
                    if not np.isfinite(integral_vals).all():
                        integral_vals = np.where(np.isfinite(integral_vals), integral_vals, 0)
                    return np.trapz(integral_vals, t_vals)

            def get_path_points(path_type: str):
                """生成路径坐标点"""
                if path_type == 'straight':
                    t_vals = np.linspace(0, 1, num_points)
                    x_pts = start_point[0] + t_vals * (end_point[0] - start_point[0])
                    y_pts = start_point[1] + t_vals * (end_point[1] - start_point[1])
                    return list(x_pts), list(y_pts)
                elif path_type == 'broken':
                    x1 = np.linspace(start_point[0], end_point[0], num_points // 2)
                    y1 = np.full_like(x1, start_point[1])
                    x2 = np.linspace(start_point[0], end_point[0], num_points // 2)
                    y2 = np.linspace(start_point[1], end_point[1], num_points // 2)
                    return list(x1) + list(x2[1:]), list(y1) + list(y2[1:])
                elif path_type == 'parabola':
                    t_vals = np.linspace(0, 1, num_points)
                    x_pts = start_point[0] + t_vals * (end_point[0] - start_point[0])
                    y_pts = start_point[1] + t_vals * (end_point[1] - start_point[1]) + \
                            2 * t_vals * (1 - t_vals) * (abs(end_point[0] - start_point[0]) / 2)
                    return list(x_pts), list(y_pts)
                return [], []

            # 计算各路径积分
            paths = ['straight', 'broken', 'parabola']
            integrals = []
            path_points = {}

            for path_type in paths:
                if path_type == 'broken':
                    path_data, name = generate_path(path_type)
                    segments = path_data
                    integral = compute_line_integral(None, None, None, segments)
                else:
                    x_t, y_t, t_range, name = generate_path(path_type)
                    integral = compute_line_integral(x_t, y_t, t_range)

                pts_x, pts_y = get_path_points(path_type)
                path_points[path_type] = {'x': pts_x, 'y': pts_y}
                integrals.append({
                    'path_name': name,
                    'path_type': path_type,
                    'value': integral
                })

            # 计算差异
            values = [abs(in_['value']) for in_ in integrals]
            max_val = max(values) if values else 1
            differences = []
            for i in range(len(integrals)):
                for j in range(i + 1, len(integrals)):
                    diff = abs(integrals[i]['value'] - integrals[j]['value'])
                    differences.append({
                        'pair': f"{integrals[i]['path_name']} vs {integrals[j]['path_name']}",
                        'difference': diff
                    })

            avg_value = sum(values) / len(values) if values else 0
            relative_errors = []
            for inte in integrals:
                if abs(inte['value']) > 1e-10:
                    rel_err = abs(inte['value'] - avg_value) / abs(avg_value) if avg_value != 0 else 0
                else:
                    rel_err = abs(inte['value'] - avg_value)
                relative_errors.append({
                    'path': inte['path_name'],
                    'error': rel_err
                })

            # 判断是否路径无关
            tolerance = 1e-6
            is_independent = is_conservative and all(
                abs(d['difference']) < tolerance * max(1, max_val) for d in differences
            )

            return {
                'success': True,
                'is_conservative': is_conservative,
                'start_point': {'x': start_point[0], 'y': start_point[1]},
                'end_point': {'x': end_point[0], 'y': end_point[1]},
                'integrals': integrals,
                'differences': differences,
                'relative_errors': relative_errors,
                'path_points': path_points,
                'is_independent': is_independent,
                'message': '路径无关性已验证：各路径积分值相等' if is_independent else
                         '保守场假设下各路径积分应相等' if is_conservative else
                         '该向量场不是保守场，路径无关性不成立',
                'curl_expression': conservative_check.get('curl_expression', ''),
                'curl_value': conservative_check.get('curl_value', None)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'is_conservative': False
            }

    # ============ 3D向量场相关方法 ============

    @staticmethod
    def vector_field_3d(
        p_str: str,
        q_str: str,
        r_str: str,
        x_range: List[float],
        y_range: List[float],
        z_range: List[float],
        resolution: int = 8
    ) -> Dict[str, Any]:
        """
        生成3D向量场可视化数据

        Args:
            p_str: 向量场 x 分量表达式 P(x, y, z)
            q_str: 向量场 y 分量表达式 Q(x, y, z)
            r_str: 向量场 z 分量表达式 R(x, y, z)
            x_range: x 范围 [x_min, x_max]
            y_range: y 范围 [y_min, y_max]
            z_range: z 范围 [z_min, z_max]
            resolution: 网格分辨率（每个方向的点数）

        Returns:
            dict: 包含3D向量场数据、旋度、散度等
        """
        x, y, z = sp.symbols('x y z')
        try:
            # 解析向量场表达式
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)
            R = _safe_parse(r_str)

            # 生成3D网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            z_vals = np.linspace(z_range[0], z_range[1], resolution)

            # 创建3D网格
            X, Y, Z = np.meshgrid(x_vals, y_vals, z_vals, indexing='ij')

            # 计算向量场分量
            P_func = sp.lambdify((x, y, z), P, 'numpy')
            Q_func = sp.lambdify((x, y, z), Q, 'numpy')
            R_func = sp.lambdify((x, y, z), R, 'numpy')

            U = P_func(X, Y, Z)
            V = Q_func(X, Y, Z)
            W = R_func(X, Y, Z)

            # 确保是numpy数组
            U = np.asarray(U)
            V = np.asarray(V)
            W = np.asarray(W)

            # 处理 NaN 和 Inf
            U = np.where(np.isnan(U) | np.isinf(U), 0, U)
            V = np.where(np.isnan(V) | np.isinf(V), 0, V)
            W = np.where(np.isnan(W) | np.isinf(W), 0, W)

            # 计算向量幅值
            magnitude = np.sqrt(U**2 + V**2 + W**2)

            # 计算旋度 curl(F) = (∂R/∂y - ∂Q/∂z, ∂P/∂z - ∂R/∂x, ∂Q/∂x - ∂P/∂y)
            curl_x_expr = sp.diff(R, y) - sp.diff(Q, z)
            curl_y_expr = sp.diff(P, z) - sp.diff(R, x)
            curl_z_expr = sp.diff(Q, x) - sp.diff(P, y)

            # 计算散度 div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
            div_expr = sp.diff(P, x) + sp.diff(Q, y) + sp.diff(R, z)

            # 计算旋度和散度的数值
            curl_x_func = sp.lambdify((x, y, z), curl_x_expr, 'numpy')
            curl_y_func = sp.lambdify((x, y, z), curl_y_expr, 'numpy')
            curl_z_func = sp.lambdify((x, y, z), curl_z_expr, 'numpy')
            div_func = sp.lambdify((x, y, z), div_expr, 'numpy')

            Curl_x = curl_x_func(X, Y, Z)
            Curl_y = curl_y_func(X, Y, Z)
            Curl_z = curl_z_func(X, Y, Z)
            Div = div_func(X, Y, Z)

            # 处理数值问题
            Curl_x = np.where(np.isnan(Curl_x) | np.isinf(Curl_x), 0, Curl_x)
            Curl_y = np.where(np.isnan(Curl_y) | np.isinf(Curl_y), 0, Curl_y)
            Curl_z = np.where(np.isnan(Curl_z) | np.isinf(Curl_z), 0, Curl_z)
            Div = np.where(np.isnan(Div) | np.isinf(Div), 0, Div)

            # 提取网格点用于Plotly cone图（需要扁平化）
            # Cone图需要 1D 数组
            x_flat = X.flatten()
            y_flat = Y.flatten()
            z_flat = Z.flatten()
            u_flat = U.flatten()
            v_flat = V.flatten()
            w_flat = W.flatten()
            mag_flat = magnitude.flatten()

            # 归一化用于可视化
            max_mag = np.nanmax(magnitude)
            if max_mag > 0:
                scale_factor = 0.8 / max_mag
                u_norm = u_flat * scale_factor
                v_norm = v_flat * scale_factor
                w_norm = w_flat * scale_factor
            else:
                u_norm = u_flat
                v_norm = v_flat
                w_norm = w_flat

            return {
                'success': True,
                'vector_field': {
                    # 扁平化数据用于cone图
                    'x': x_flat.tolist(),
                    'y': y_flat.tolist(),
                    'z': z_flat.tolist(),
                    'u': u_flat.tolist(),
                    'v': v_flat.tolist(),
                    'w': w_flat.tolist(),
                    'u_norm': u_norm.tolist(),
                    'v_norm': v_norm.tolist(),
                    'w_norm': w_norm.tolist(),
                    'magnitude': mag_flat.tolist(),
                    # 3D网格数据
                    'grid_x': X.tolist(),
                    'grid_y': Y.tolist(),
                    'grid_z': Z.tolist(),
                    'grid_u': U.tolist(),
                    'grid_v': V.tolist(),
                    'grid_w': W.tolist(),
                    'grid_magnitude': magnitude.tolist()
                },
                'curl': {
                    'expression': {
                        'x': str(curl_x_expr),
                        'y': str(curl_y_expr),
                        'z': str(curl_z_expr)
                    },
                    'value': {
                        'x': float(np.nanmean(Curl_x)),
                        'y': float(np.nanmean(Curl_y)),
                        'z': float(np.nanmean(Curl_z))
                    },
                    'values_x': Curl_x.tolist(),
                    'values_y': Curl_y.tolist(),
                    'values_z': Curl_z.tolist()
                },
                'divergence': {
                    'expression': str(div_expr),
                    'value': float(np.nanmean(Div)),
                    'values': Div.tolist()
                },
                'field_expressions': {
                    'P': p_str,
                    'Q': q_str,
                    'R': r_str
                },
                'x_range': x_range,
                'y_range': y_range,
                'z_range': z_range
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def compute_streamline_3d(
        p_str: str,
        q_str: str,
        r_str: str,
        start_points: List[List[float]],
        t_span: Tuple[float, float],
        t_eval: np.ndarray = None,
        direction: str = 'both'
    ) -> Dict[str, Any]:
        """
        计算3D流线（积分曲线）

        流线是满足 dr/dt = F(r) 的空间曲线

        Args:
            p_str: 向量场 x 分量 P(x, y, z)
            q_str: 向量场 y 分量 Q(x, y, z)
            r_str: 向量场 z 分量 R(x, y, z)
            start_points: 起始点列表 [[x1, y1, z1], [x2, y2, z2], ...]
            t_span: 积分时间范围 (t_start, t_end)
            t_eval: 评估时间点数组
            direction: 积分方向 ('forward', 'backward', 'both')

        Returns:
            dict: 包含3D流线路径数据
        """
        x, y, z = sp.symbols('x y z')
        try:
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)
            R = _safe_parse(r_str)

            # 定义3D向量场函数
            def vector_field_3d(t, pos):
                xi, yi, zi = pos
                try:
                    ui = float(P.subs({x: xi, y: yi, z: zi}))
                    vi = float(Q.subs({x: xi, y: yi, z: zi}))
                    wi = float(R.subs({x: xi, y: yi, z: zi}))
                    # 处理数值问题
                    if np.isnan(ui) or np.isinf(ui):
                        ui = 0
                    if np.isnan(vi) or np.isinf(vi):
                        vi = 0
                    if np.isnan(wi) or np.isinf(wi):
                        wi = 0
                    return [ui, vi, wi]
                except:
                    return [0, 0, 0]

            # 如果没有指定评估点，生成默认点
            if t_eval is None:
                t_eval = np.linspace(t_span[0], t_span[1], 100)

            streamlines = []

            for start in start_points:
                start_x, start_y, start_z = start

                # 前向积分
                if direction in ['forward', 'both']:
                    try:
                        sol_forward = solve_ivp(
                            vector_field_3d,
                            [0, abs(t_span[1])],
                            [start_x, start_y, start_z],
                            t_eval=np.linspace(0, abs(t_span[1]), 50),
                            method='RK45',
                            rtol=1e-6
                        )
                        if sol_forward.success:
                            streamlines.append({
                                'start_point': {'x': start_x, 'y': start_y, 'z': start_z},
                                'x': sol_forward.y[0].tolist(),
                                'y': sol_forward.y[1].tolist(),
                                'z': sol_forward.y[2].tolist(),
                                'direction': 'forward'
                            })
                    except Exception as e:
                        pass

                # 后向积分
                if direction in ['backward', 'both']:
                    try:
                        sol_backward = solve_ivp(
                            vector_field_3d,
                            [0, abs(t_span[0])],
                            [start_x, start_y, start_z],
                            t_eval=np.linspace(0, abs(t_span[0]), 50),
                            method='RK45',
                            rtol=1e-6
                        )
                        if sol_backward.success:
                            streamlines.append({
                                'start_point': {'x': start_x, 'y': start_y, 'z': start_z},
                                'x': sol_backward.y[0].tolist(),
                                'y': sol_backward.y[1].tolist(),
                                'z': sol_backward.y[2].tolist(),
                                'direction': 'backward'
                            })
                    except Exception as e:
                        pass

            return {
                'success': True,
                'streamlines': streamlines,
                'field': {'P': p_str, 'Q': q_str, 'R': r_str}
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def compute_curl_divergence_3d(
        p_str: str,
        q_str: str,
        r_str: str,
        x: float = 0,
        y: float = 0,
        z: float = 0
    ) -> Dict[str, Any]:
        """
        计算三维旋度和散度

        Args:
            p_str: 向量场 x 分量 P(x, y, z)
            q_str: 向量场 y 分量 Q(x, y, z)
            r_str: 向量场 z 分量 R(x, y, z)
            x, y, z: 计算点坐标

        Returns:
            dict: 包含旋度和散度的表达式和数值
        """
        try:
            x_sym, y_sym, z_sym = sp.symbols('x y z')
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)
            R = _safe_parse(r_str)

            # 计算旋度 curl(F) = (∂R/∂y - ∂Q/∂z, ∂P/∂z - ∂R/∂x, ∂Q/∂x - ∂P/∂y)
            curl_x_expr = sp.diff(R, y_sym) - sp.diff(Q, z_sym)
            curl_y_expr = sp.diff(P, z_sym) - sp.diff(R, x_sym)
            curl_z_expr = sp.diff(Q, x_sym) - sp.diff(P, y_sym)

            # 计算散度 div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
            div_expr = sp.diff(P, x_sym) + sp.diff(Q, y_sym) + sp.diff(R, z_sym)

            # 计算数值
            curl_x_val = float(curl_x_expr.subs({x_sym: x, y_sym: y, z_sym: z}))
            curl_y_val = float(curl_y_expr.subs({x_sym: x, y_sym: y, z_sym: z}))
            curl_z_val = float(curl_z_expr.subs({x_sym: x, y_sym: y, z_sym: z}))
            div_val = float(div_expr.subs({x_sym: x, y_sym: y, z_sym: z}))

            # 处理数值问题
            if np.isnan(curl_x_val) or np.isinf(curl_x_val):
                curl_x_val = 0
            if np.isnan(curl_y_val) or np.isinf(curl_y_val):
                curl_y_val = 0
            if np.isnan(curl_z_val) or np.isinf(curl_z_val):
                curl_z_val = 0
            if np.isnan(div_val) or np.isinf(div_val):
                div_val = 0

            return {
                'success': True,
                'curl': {
                    'expression': {
                        'x': str(sp.simplify(curl_x_expr)),
                        'y': str(sp.simplify(curl_y_expr)),
                        'z': str(sp.simplify(curl_z_expr))
                    },
                    'value': {
                        'x': curl_x_val,
                        'y': curl_y_val,
                        'z': curl_z_val
                    }
                },
                'divergence': {
                    'expression': str(sp.simplify(div_expr)),
                    'value': div_val
                },
                'point': {'x': x, 'y': y, 'z': z}
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    # ============ 3D预设向量场 ============
    VECTOR_FIELD_3D_PRESETS = [
        {
            "id": "zero_3d",
            "name": "零场",
            "description": "F = (0, 0, 0)，无向量",
            "P": "0",
            "Q": "0",
            "R": "0"
        },
        {
            "id": "rotation_z",
            "name": "绕z轴旋转",
            "description": "F = (-y, x, 0)，绕z轴旋转",
            "P": "-y",
            "Q": "x",
            "R": "0"
        },
        {
            "id": "radial",
            "name": "径向场",
            "description": "F = (x, y, z)，从原点向外辐射",
            "P": "x",
            "Q": "y",
            "R": "z"
        },
        {
            "id": "helix",
            "name": "螺旋场",
            "description": "F = (-y, x, 1)，螺旋上升",
            "P": "-y",
            "Q": "x",
            "R": "1"
        },
        {
            "id": "shear_3d",
            "name": "剪切流",
            "description": "F = (y, 0, 0)，简单剪切",
            "P": "y",
            "Q": "0",
            "R": "0"
        },
        {
            "id": "saddle_3d",
            "name": "3D鞍点",
            "description": "F = (x, -y, z)",
            "P": "x",
            "Q": "-y",
            "R": "z"
        },
        {
            "id": "vortex_3d",
            "name": "涡旋场",
            "description": "F = (-z, 0, x)",
            "P": "-z",
            "Q": "0",
            "R": "x"
        },
        {
            "id": "constant_3d",
            "name": "恒定场",
            "description": "F = (1, 1, 1)，恒定方向",
            "P": "1",
            "Q": "1",
            "R": "1"
        }
    ]

    # ============ 曲面积分预设曲面 ============
    SURFACE_PRESETS = [
        {
            "id": "sphere",
            "name": "球面",
            "description": "x² + y² + z² = r²",
            "parametric": {
                "x": "r*sin(u)*cos(v)",
                "y": "r*sin(u)*sin(v)",
                "z": "r*cos(u)",
                "u_range": [0, np.pi],
                "v_range": [0, 2*np.pi],
                "params": {"r": 1}
            }
        },
        {
            "id": "cylinder",
            "name": "圆柱面",
            "description": "x² + y² = r²",
            "parametric": {
                "x": "r*cos(u)",
                "y": "r*sin(u)",
                "z": "v",
                "u_range": [0, 2*np.pi],
                "v_range": [-1, 1],
                "params": {"r": 1}
            }
        },
        {
            "id": "paraboloid",
            "name": "抛物面",
            "description": "z = x² + y²",
            "parametric": {
                "x": "r*cos(u)",
                "y": "r*sin(u)",
                "z": "r**2",
                "u_range": [0, 2*np.pi],
                "v_range": [0, 1],
                "params": {"r": 1}
            }
        },
        {
            "id": "cone",
            "name": "圆锥面",
            "description": "z = sqrt(x² + y²)",
            "parametric": {
                "x": "r*cos(u)",
                "y": "r*sin(u)",
                "z": "r",
                "u_range": [0, 2*np.pi],
                "v_range": [0, 1],
                "params": {"r": 1}
            }
        },
        {
            "id": "plane",
            "name": "平面",
            "description": "z = ax + by + c",
            "parametric": {
                "x": "u",
                "y": "v",
                "z": "0.5*u + 0.5*v",
                "u_range": [-1, 1],
                "v_range": [-1, 1],
                "params": {"a": 0.5, "b": 0.5}
            }
        }
    ]

    # ============ 高斯定理预设 ============
    GAUSS_SOLID_PRESETS = [
        {
            "id": "unit_sphere",
            "name": "单位球体",
            "description": "x² + y² + z² ≤ 1",
            "type": "sphere",
            "params": {"r": 1}
        },
        {
            "id": "cube",
            "name": "立方体",
            "description": "|x| ≤ 1, |y| ≤ 1, |z| ≤ 1",
            "type": "cube",
            "params": {"half": 1}
        },
        {
            "id": "cylinder_solid",
            "name": "圆柱体",
            "description": "x² + y² ≤ 1, 0 ≤ z ≤ 2",
            "type": "cylinder",
            "params": {"r": 1, "h": 2}
        }
    ]

    # ============ 曲面积分方法 ============

    @staticmethod
    def compute_surface_integral(
        p_str: str,
        q_str: str,
        r_str: str,
        surface_type: str,
        surface_params: Dict[str, float] = None,
        orientation: str = 'outward',
        resolution: int = 50
    ) -> Dict[str, Any]:
        """
        计算曲面积分 ∬_S F·dS = ∬_S (P dydz + Q dzdx + R dxdy)

        对于参数化曲面 S: r(u,v) = (x(u,v), y(u,v), z(u,v))，
        dS = |r_u × r_v| du dv
        法向量 n = r_u × r_v / |r_u × r_v|

        Args:
            p_str: 向量场 x 分量 P(x, y, z)
            q_str: 向量场 y 分量 Q(x, y, z)
            r_str: 向量场 z 分量 R(x, y, z)
            surface_type: 曲面类型 ('sphere', 'cylinder', 'paraboloid', 'cone', 'plane')
            surface_params: 曲面参数 (如 r=1 表示半径)
            orientation: 法向量方向 ('outward' 或 'inward')
            resolution: 网格分辨率

        Returns:
            dict: 包含曲面积分结果、曲面数据、法向量等
        """
        x, y, z, u, v = sp.symbols('x y z u v')

        try:
            # 解析向量场
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)
            R = _safe_parse(r_str)

            surface_params = surface_params or {}

            # 根据曲面类型定义参数方程
            if surface_type == 'sphere':
                r = surface_params.get('r', 1)
                x_expr = r * sp.sin(u) * sp.cos(v)
                y_expr = r * sp.sin(u) * sp.sin(v)
                z_expr = r * sp.cos(u)
                u_range = [0, np.pi]
                v_range = [0, 2 * np.pi]
                surface_name = f"球面 (r={r})"

            elif surface_type == 'cylinder':
                r = surface_params.get('r', 1)
                x_expr = r * sp.cos(u)
                y_expr = r * sp.sin(u)
                z_expr = v
                u_range = [0, 2 * np.pi]
                v_range = [-1, 1]
                surface_name = f"圆柱面 (r={r})"

            elif surface_type == 'paraboloid':
                r = surface_params.get('r', 1)
                x_expr = r * v * sp.cos(u)
                y_expr = r * v * sp.sin(u)
                z_expr = v ** 2
                u_range = [0, 2 * np.pi]
                v_range = [0, 1]
                surface_name = "抛物面 z = x² + y²"

            elif surface_type == 'cone':
                r = surface_params.get('r', 1)
                x_expr = r * v * sp.cos(u)
                y_expr = r * v * sp.sin(u)
                z_expr = v
                u_range = [0, 2 * np.pi]
                v_range = [0, 1]
                surface_name = "圆锥面 z = √(x² + y²)"

            elif surface_type == 'plane':
                a = float(surface_params.get('a', 0.5))
                b = float(surface_params.get('b', 0.5))
                x_expr = u
                y_expr = v
                z_expr = a * u + b * v
                u_range = [-1, 1]
                v_range = [-1, 1]
                surface_name = f"平面 z = {a}x + {b}y"

            else:
                return {
                    'success': False,
                    'error': f'不支持的曲面类型: {surface_type}'
                }

            # 计算偏导数
            r_u = sp.Matrix([sp.diff(x_expr, u), sp.diff(y_expr, u), sp.diff(z_expr, u)])
            r_v = sp.Matrix([sp.diff(x_expr, v), sp.diff(y_expr, v), sp.diff(z_expr, v)])

            # 计算法向量 (r_u × r_v)
            cross_product = r_u.cross(r_v)

            # 分别对每个分量 lambdify，避免 Matrix 形状问题
            normal_x_func = sp.lambdify((u, v), cross_product[0], 'numpy')
            normal_y_func = sp.lambdify((u, v), cross_product[1], 'numpy')
            normal_z_func = sp.lambdify((u, v), cross_product[2], 'numpy')

            # 计算法向量模长 |r_u × r_v|
            norm_expr = sp.sqrt(cross_product[0]**2 + cross_product[1]**2 + cross_product[2]**2)
            norm_func = sp.lambdify((u, v), norm_expr, 'numpy')

            # 将向量场代入参数方程
            P_surf = P.subs({x: x_expr, y: y_expr, z: z_expr})
            Q_surf = Q.subs({x: x_expr, y: y_expr, z: z_expr})
            R_surf = R.subs({x: x_expr, y: y_expr, z: z_expr})

            # 计算 F·n dS = F·(r_u × r_v) du dv
            # 使用 sp.simplify 确保返回标量表达式，避免 Matrix 形状问题
            flux_integrand = sp.simplify(
                P_surf * cross_product[0] + Q_surf * cross_product[1] + R_surf * cross_product[2]
            )
            flux_integrand_func = sp.lambdify((u, v), flux_integrand, 'numpy')

            # 生成网格 (使用 indexing='ij' 以符合 Plotly surface 的预期格式)
            u_vals = np.linspace(u_range[0], u_range[1], resolution)
            v_vals = np.linspace(v_range[0], v_range[1], resolution)
            U, V = np.meshgrid(u_vals, v_vals, indexing='ij')

            # 计算数值
            try:
                # 使用分别 lambdify 后的函数
                normal_x = np.asarray(normal_x_func(U, V))
                normal_y = np.asarray(normal_y_func(U, V))
                normal_z = np.asarray(normal_z_func(U, V))
                # 确保形状一致（处理标量返回的情况）
                if normal_x.ndim == 0:
                    normal_x = np.full_like(U, float(normal_x))
                if normal_y.ndim == 0:
                    normal_y = np.full_like(U, float(normal_y))
                if normal_z.ndim == 0:
                    normal_z = np.full_like(U, float(normal_z))
                normal_mag = np.asarray(norm_func(U, V))
                flux_density = np.asarray(flux_integrand_func(U, V))

                # 确保形状一致（处理标量或3D数组返回的情况）
                if normal_mag.ndim == 0:
                    normal_mag = np.full_like(U, float(normal_mag))
                elif normal_mag.ndim == 3:
                    # 处理 (1, N, N) 的情况（可能是 Matrix 返回）
                    normal_mag = np.squeeze(normal_mag, axis=0)

                if flux_density.ndim == 0:
                    flux_density = np.full_like(U, float(flux_density))
                elif flux_density.ndim == 3:
                    # 处理 (1, N, N) 的情况（可能是 Matrix 返回）
                    flux_density = np.squeeze(flux_density, axis=0)

                # 处理数值问题
                normal_x = np.where(np.isnan(normal_x) | np.isinf(normal_x), 0, normal_x)
                normal_y = np.where(np.isnan(normal_y) | np.isinf(normal_y), 0, normal_y)
                normal_z = np.where(np.isnan(normal_z) | np.isinf(normal_z), 0, normal_z)
                normal_mag = np.where(np.isnan(normal_mag) | np.isinf(normal_mag) | (normal_mag < 1e-10), 1, normal_mag)
                flux_density = np.where(np.isnan(flux_density) | np.isinf(flux_density), 0, flux_density)

                # 计算积分
                du = (u_range[1] - u_range[0]) / (resolution - 1)
                dv = (v_range[1] - v_range[0]) / (resolution - 1)

                if orientation == 'inward':
                    flux_density = -flux_density
                    normal_x = -normal_x
                    normal_y = -normal_y
                    normal_z = -normal_z

                surface_integral = np.trapz(np.trapz(np.abs(flux_density) * normal_mag, v_vals, axis=0), u_vals)

                # 计算实际向量场在曲面上的值
                P_func = sp.lambdify((x, y, z), P, 'numpy')
                Q_func = sp.lambdify((x, y, z), Q, 'numpy')
                R_func = sp.lambdify((x, y, z), R, 'numpy')

                # 生成曲面点坐标
                x_func = sp.lambdify((u, v), x_expr, 'numpy')
                y_func = sp.lambdify((u, v), y_expr, 'numpy')
                z_func = sp.lambdify((u, v), z_expr, 'numpy')

                X_surf = x_func(U, V)
                Y_surf = y_func(U, V)
                Z_surf = z_func(U, V)

                # 计算曲面上的向量场
                P_vals = P_func(X_surf, Y_surf, Z_surf)
                Q_vals = Q_func(X_surf, Y_surf, Z_surf)
                R_vals = R_func(X_surf, Y_surf, Z_surf)

                # 处理标量返回值（当向量场分量为常量时，如 '0' 或 '1'）
                P_vals = np.asarray(P_vals)
                Q_vals = np.asarray(Q_vals)
                R_vals = np.asarray(R_vals)

                if P_vals.ndim == 0:
                    P_vals = np.full_like(X_surf, float(P_vals))
                if Q_vals.ndim == 0:
                    Q_vals = np.full_like(X_surf, float(Q_vals))
                if R_vals.ndim == 0:
                    R_vals = np.full_like(X_surf, float(R_vals))

                # 处理数值问题
                P_vals = np.where(np.isnan(P_vals) | np.isinf(P_vals), 0, P_vals)
                Q_vals = np.where(np.isnan(Q_vals) | np.isinf(Q_vals), 0, Q_vals)
                R_vals = np.where(np.isnan(R_vals) | np.isinf(R_vals), 0, R_vals)

                return {
                    'success': True,
                    'surface_integral': float(surface_integral),
                    'surface': {
                        'type': surface_type,
                        'name': surface_name,
                        'x': X_surf.tolist(),
                        'y': Y_surf.tolist(),
                        'z': Z_surf.tolist()
                    },
                    'normal': {
                        'x': normal_x.tolist(),
                        'y': normal_y.tolist(),
                        'z': normal_z.tolist(),
                        'magnitude': normal_mag.tolist()
                    },
                    'field_on_surface': {
                        'P': P_vals.tolist(),
                        'Q': Q_vals.tolist(),
                        'R': R_vals.tolist()
                    },
                    'flux_density': flux_density.tolist(),
                    'orientation': orientation,
                    'field': {'P': p_str, 'Q': q_str, 'R': r_str}
                }

            except Exception as e:
                return {
                    'success': False,
                    'error': f'数值计算错误: {str(e)}'
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def verify_gauss_theorem(
        p_str: str,
        q_str: str,
        r_str: str,
        solid_type: str,
        solid_params: Dict[str, float] = None,
        resolution: int = 30
    ) -> Dict[str, Any]:
        """
        验证高斯散度定理: ∬_S F·dS = ∭_V div(F) dV

        定理表述：向量场穿过闭合曲面的通量等于该向量场在曲面所围体积内的散度积分。

        Args:
            p_str: 向量场 x 分量 P(x, y, z)
            q_str: 向量场 y 分量 Q(x, y, z)
            r_str: 向量场 z 分量 R(x, y, z)
            solid_type: 立体类型 ('sphere', 'cube', 'cylinder')
            solid_params: 立体参数
            resolution: 网格分辨率

        Returns:
            dict: 包含高斯定理验证结果
        """
        x, y, z = sp.symbols('x y z')

        try:
            # 解析向量场
            P = _safe_parse(p_str)
            Q = _safe_parse(q_str)
            R = _safe_parse(r_str)

            solid_params = solid_params or {}

            # 计算散度 div(F) = ∂P/∂x + ∂Q/∂y + ∂R/∂z
            div_expr = sp.diff(P, x) + sp.diff(Q, y) + sp.diff(R, z)
            div_func = sp.lambdify((x, y, z), div_expr, 'numpy')

            # 计算向量场在曲面上的通量（使用参数化曲面）
            if solid_type == 'sphere':
                r = solid_params.get('r', 1)
                u, v = sp.symbols('u v')
                x_expr = r * sp.sin(u) * sp.cos(v)
                y_expr = r * sp.sin(u) * sp.sin(v)
                z_expr = r * sp.cos(u)
                u_range = [0, np.pi]
                v_range = [0, 2 * np.pi]

                # 对于球面，r_u × r_v = r² sin(u) (sin(u)cos(v), sin(u)sin(v), cos(u))
                # 方向向外
                cross_expr = sp.Matrix([
                    r**2 * sp.sin(u)**2 * sp.cos(v),
                    r**2 * sp.sin(u)**2 * sp.sin(v),
                    r**2 * sp.sin(u) * sp.cos(u)
                ])

                # 曲面积分：∬ F·(r_u × r_v) du dv
                P_surf = P.subs({x: x_expr, y: y_expr, z: z_expr})
                Q_surf = Q.subs({x: x_expr, y: y_expr, z: z_expr})
                R_surf = R.subs({x: x_expr, y: y_expr, z: z_expr})

                flux_integrand = P_surf * cross_expr[0] + Q_surf * cross_expr[1] + R_surf * cross_expr[2]
                flux_integrand_func = sp.lambdify((u, v), flux_integrand, 'numpy')

                # 生成网格
                u_vals = np.linspace(u_range[0], u_range[1], resolution)
                v_vals = np.linspace(v_range[0], v_range[1], resolution)
                U, V = np.meshgrid(u_vals, v_vals)

                flux_density = flux_integrand_func(U, V)
                flux_density = np.where(np.isnan(flux_density) | np.isinf(flux_density), 0, flux_density)

                # 计算面积分
                du = (u_range[1] - u_range[0]) / (resolution - 1)
                dv = (v_range[1] - v_range[0]) / (resolution - 1)
                surface_integral = np.trapz(np.trapz(flux_density, v_vals, axis=0), u_vals)

                # 体积积分 - 使用数值积分（避免 SymPy 解析积分过慢）
                rho_vals = np.linspace(0, r, resolution)
                phi_vals = np.linspace(0, np.pi, resolution)
                theta_vals = np.linspace(0, 2*np.pi, resolution)

                RHO, PHI, THETA = np.meshgrid(rho_vals, phi_vals, theta_vals, indexing='ij')

                div_vals = div_func(
                    RHO * np.sin(PHI) * np.cos(THETA),
                    RHO * np.sin(PHI) * np.sin(THETA),
                    RHO * np.cos(PHI)
                )
                div_vals = np.where(np.isnan(div_vals) | np.isinf(div_vals), 0, div_vals)

                volume_integral_val = np.trapz(
                    np.trapz(np.trapz(np.abs(div_vals) * RHO**2 * np.sin(PHI),
                        rho_vals, axis=0), phi_vals, axis=0), theta_vals
                )

                # 生成球面数据用于可视化
                u_viz = np.linspace(0, np.pi, resolution)
                v_viz = np.linspace(0, 2*np.pi, resolution)
                U_VIZ, V_VIZ = np.meshgrid(u_viz, v_viz, indexing='ij')

                x_func = sp.lambdify((u, v), x_expr, 'numpy')
                y_func = sp.lambdify((u, v), y_expr, 'numpy')
                z_func = sp.lambdify((u, v), z_expr, 'numpy')

                X = x_func(U_VIZ, V_VIZ)
                Y = y_func(U_VIZ, V_VIZ)
                Z = z_func(U_VIZ, V_VIZ)

                solid_name = f"单位球体 (r={r})"

            elif solid_type == 'cube':
                half = solid_params.get('half', 1)
                x_min, x_max = -half, half
                y_min, y_max = -half, half
                z_min, z_max = -half, half

                # 立方体的6个面的面积分
                surface_integral = 0

                # 定义各面的法向量和参数方程
                faces = [
                    {'name': 'x=max', 'x_expr': x_max, 'y': 'y', 'z': 'z', 'nx': 1, 'y_range': [y_min, y_max], 'z_range': [z_min, z_max]},
                    {'name': 'x=min', 'x_expr': x_min, 'y': 'y', 'z': 'z', 'nx': -1, 'y_range': [y_min, y_max], 'z_range': [z_min, z_max]},
                    {'name': 'y=max', 'x': 'x', 'y_expr': y_max, 'z': 'z', 'ny': 1, 'x_range': [x_min, x_max], 'z_range': [z_min, z_max]},
                    {'name': 'y=min', 'x': 'x', 'y_expr': y_min, 'z': 'z', 'ny': -1, 'x_range': [x_min, x_max], 'z_range': [z_min, z_max]},
                    {'name': 'z=max', 'x': 'x', 'y': 'y', 'z_expr': z_max, 'nz': 1, 'x_range': [x_min, x_max], 'y_range': [y_min, y_max]},
                    {'name': 'z=min', 'x': 'x', 'y': 'y', 'z_expr': z_min, 'nz': -1, 'x_range': [x_min, x_max], 'y_range': [y_min, y_max]}
                ]

                from scipy.integrate import tplquad

                def div_func_3d(x_val, y_val, z_val):
                    try:
                        return div_func(x_val, y_val, z_val)
                    except:
                        return 0

                # 体积积分
                volume_integral, _ = tplquad(
                    div_func_3d,
                    x_min, x_max,
                    lambda x: y_min, lambda x: y_max,
                    lambda x, y: z_min, lambda x, y: z_max
                )

                # 各面面积分
                face_surfaces = []
                for face in faces:
                    nx = face.get('nx', 0)
                    ny = face.get('ny', 0)
                    nz = face.get('nz', 0)

                    # 对于每个面，计算 ∬ F·n dS
                    # 使用参数化或直接计算
                    if 'x_range' in face:
                        x_pts = np.linspace(face['x_range'][0], face['x_range'][1], resolution)
                    else:
                        x_val = face.get('x_expr', 0)
                        x_pts = np.array([x_val]) if isinstance(x_val, (int, float)) else np.linspace(-1, 1, resolution)

                    if 'y_range' in face:
                        y_pts = np.linspace(face['y_range'][0], face['y_range'][1], resolution)
                    else:
                        y_val = face.get('y_expr', 0)
                        y_pts = np.array([y_val]) if isinstance(y_val, (int, float)) else np.linspace(-1, 1, resolution)

                    if 'z_range' in face:
                        z_pts = np.linspace(face['z_range'][0], face['z_range'][1], resolution)
                    else:
                        z_val = face.get('z_expr', 0)
                        z_pts = np.array([z_val]) if isinstance(z_val, (int, float)) else np.linspace(-1, 1, resolution)

                    if len(x_pts) == 1:
                        X_GRID, Z_GRID = np.meshgrid(y_pts, z_pts)
                        Y_GRID = np.full_like(X_GRID, face['y_expr'] if isinstance(face['y_expr'], (int, float)) else y_pts[0])
                        X_GRID = np.full_like(X_GRID, face['x_expr'] if isinstance(face['x_expr'], (int, float)) else x_pts[0])
                    else:
                        X_GRID, Y_GRID = np.meshgrid(x_pts, y_pts)
                        Z_GRID = np.full_like(X_GRID, face['z_expr'] if isinstance(face['z_expr'], (int, float)) else z_pts[0])

                    # 计算向量场
                    P_face = np.where(np.isnan(P_func(X_GRID, Y_GRID, Z_GRID)) | np.isinf(P_func(X_GRID, Y_GRID, Z_GRID)), 0, P_func(X_GRID, Y_GRID, Z_GRID))
                    Q_face = np.where(np.isnan(Q_func(X_GRID, Y_GRID, Z_GRID)) | np.isinf(Q_func(X_GRID, Y_GRID, Z_GRID)), 0, Q_func(X_GRID, Y_GRID, Z_GRID))
                    R_face = np.where(np.isnan(R_func(X_GRID, Y_GRID, Z_GRID)) | np.isinf(R_func(X_GRID, Y_GRID, Z_GRID)), 0, R_func(X_GRID, Y_GRID, Z_GRID))

                    # 通量密度 F·n
                    flux_density = P_face * nx + Q_face * ny + R_face * nz

                    # 面积分
                    da = (y_pts[-1] - y_pts[0]) / max(len(y_pts) - 1, 1) * (z_pts[-1] - z_pts[0]) / max(len(z_pts) - 1, 1) if 'y_range' in face else \
                         (x_pts[-1] - x_pts[0]) / max(len(x_pts) - 1, 1) * (z_pts[-1] - z_pts[0]) / max(len(z_pts) - 1, 1) if 'x_range' in face else \
                         (x_pts[-1] - x_pts[0]) / max(len(x_pts) - 1, 1) * (y_pts[-1] - y_pts[0]) / max(len(y_pts) - 1, 1)

                    face_flux = np.mean(flux_density) * da * len(flux_density.flatten()) if np.isfinite(np.mean(flux_density)) else 0
                    surface_integral += face_flux

                    face_surfaces.append({
                        'name': face['name'],
                        'x': X_GRID.tolist(),
                        'y': Y_GRID.tolist(),
                        'z': Z_GRID.tolist()
                    })

                X = [[x_min, x_max, x_max, x_min, x_min],
                     [x_min, x_max, x_max, x_min, x_min],
                     [x_min, x_min, x_max, x_max, x_min],
                     [x_min, x_max, x_max, x_min, x_min],
                     [x_min, x_max, x_max, x_min, x_min],
                     [x_min, x_max, x_max, x_min, x_min]]
                Y = [[y_min, y_min, y_max, y_max, y_min],
                     [y_min, y_min, y_max, y_max, y_min],
                     [y_min, y_min, y_min, y_max, y_max],
                     [y_min, y_max, y_max, y_min, y_min],
                     [y_max, y_max, y_max, y_max, y_max],
                     [y_min, y_min, y_min, y_min, y_min]]
                Z = [[z_min, z_min, z_min, z_min, z_min],
                     [z_max, z_max, z_max, z_max, z_max],
                     [z_min, z_max, z_max, z_min, z_min],
                     [z_max, z_max, z_min, z_min, z_max],
                     [z_min, z_max, z_max, z_min, z_max],
                     [z_min, z_max, z_max, z_min, z_min]]

                solid_name = f"立方体 (|x|,|y|,|z| ≤ {half})"

            elif solid_type == 'cylinder':
                r = solid_params.get('r', 1)
                h = solid_params.get('h', 2)
                z_min, z_max = -h/2, h/2

                u, v = sp.symbols('u v')

                # 圆柱面
                x_expr = r * sp.cos(u)
                y_expr = r * sp.sin(u)
                z_expr = v

                # 圆柱面法向量向外
                cross_expr = sp.Matrix([r*sp.cos(u), r*sp.sin(u), 0])

                P_surf = P.subs({x: x_expr, y: y_expr, z: z_expr})
                Q_surf = Q.subs({x: x_expr, y: y_expr, z: z_expr})
                R_surf = R.subs({x: x_expr, y: y_expr, z: z_expr})

                flux_integrand = P_surf * cross_expr[0] + Q_surf * cross_expr[1] + R_surf * cross_expr[2]
                flux_integrand_func = sp.lambdify((u, v), flux_integrand, 'numpy')

                u_vals = np.linspace(0, 2*np.pi, resolution)
                v_vals = np.linspace(z_min, z_max, resolution)
                U, V = np.meshgrid(u_vals, v_vals)

                flux_density = flux_integrand_func(U, V)
                flux_density = np.where(np.isnan(flux_density) | np.isinf(flux_density), 0, flux_density)

                du = 2*np.pi / (resolution - 1)
                dv = h / (resolution - 1)
                surface_integral_side = np.trapz(np.trapz(flux_density, v_vals, axis=0), u_vals)

                # 顶面 z = h/2, 法向量向上 (0, 0, 1)
                def flux_top_func(x_val, y_val):
                    try:
                        return float(R.subs({x: x_val, y: y_val, z: z_max}))
                    except:
                        return 0

                def flux_bottom_func(x_val, y_val):
                    try:
                        return float(-R.subs({x: x_val, y: y_val, z: z_min}))
                    except:
                        return 0

                # 数值积分顶面和底面
                theta_vals = np.linspace(0, 2*np.pi, resolution)
                r_vals = np.linspace(0, r, resolution)
                THETA, RHO = np.meshgrid(theta_vals, r_vals, indexing='ij')

                X_top = RHO * np.cos(THETA)
                Y_top = RHO * np.sin(THETA)
                Z_top = np.full_like(X_top, z_max)

                # 使用向量化操作代替嵌套列表推导式
                flux_top_vals = np.vectorize(flux_top_func)(X_top, Y_top)
                flux_top_vals = np.where(np.isnan(flux_top_vals) | np.isinf(flux_top_vals), 0, flux_top_vals)
                flux_top = np.trapz(np.trapz(flux_top_vals * RHO, r_vals, axis=0), theta_vals)

                X_bot = RHO * np.cos(THETA)
                Y_bot = RHO * np.sin(THETA)
                Z_bot = np.full_like(X_bot, z_min)

                # 使用向量化操作代替嵌套列表推导式
                flux_bottom_vals = np.vectorize(flux_bottom_func)(X_bot, Y_bot)
                flux_bottom_vals = np.where(np.isnan(flux_bottom_vals) | np.isinf(flux_bottom_vals), 0, flux_bottom_vals)
                flux_bottom = np.trapz(np.trapz(flux_bottom_vals * RHO, r_vals, axis=0), theta_vals)

                surface_integral = surface_integral_side + flux_top + flux_bottom

                # 体积积分
                from scipy.integrate import tplquad

                def div_func_3d(x_val, y_val, z_val):
                    try:
                        return div_func(x_val, y_val, z_val)
                    except:
                        return 0

                volume_integral, _ = tplquad(
                    div_func_3d,
                    z_min, z_max,
                    lambda z: -np.sqrt(max(0, r**2 - z**2)), lambda z: np.sqrt(max(0, r**2 - z**2)),
                    lambda z, y: -np.sqrt(max(0, r**2 - y**2)), lambda z, y: np.sqrt(max(0, r**2 - y**2))
                )

                # 生成圆柱面数据
                u_viz = np.linspace(0, 2*np.pi, resolution)
                z_viz = np.linspace(z_min, z_max, resolution)
                U_VIZ, Z_VIZ = np.meshgrid(u_viz, z_viz, indexing='ij')

                x_func = sp.lambdify((u, v), x_expr, 'numpy')
                y_func = sp.lambdify((u, v), y_expr, 'numpy')

                X = x_func(U_VIZ, Z_VIZ)
                Y = y_func(U_VIZ, Z_VIZ)
                Z = Z_VIZ

                solid_name = f"圆柱体 (r={r}, h={h})"

            else:
                return {
                    'success': False,
                    'error': f'不支持的立体类型: {solid_type}'
                }

            # 计算差异
            difference = float(abs(surface_integral - volume_integral_val))
            relative_error = float(difference / (abs(surface_integral) + abs(volume_integral_val) + 1e-10))
            is_verified = bool(relative_error < 0.1)

            return {
                'success': True,
                'gauss_theorem': {
                    'surface_integral': {
                        'value': float(surface_integral),
                        'expression': f'∬_S F·dS = ∬_S (P dydz + Q dzdx + R dxdy)'
                    },
                    'volume_integral': {
                        'value': float(volume_integral_val),
                        'expression': f'∭_V div(F) dV = ∭_V ({div_expr}) dV'
                    },
                    'divergence_expression': str(div_expr),
                    'difference': difference,
                    'relative_error': relative_error,
                    'is_verified': is_verified,
                    'formula': '∬_S F·dS = ∭_V div(F) dV'
                },
                'solid': {
                    'type': solid_type,
                    'name': solid_name,
                    'params': solid_params,
                    'x': X.tolist() if isinstance(X, np.ndarray) else X,
                    'y': Y.tolist() if isinstance(Y, np.ndarray) else Y,
                    'z': Z.tolist() if isinstance(Z, np.ndarray) else Z
                },
                'field': {'P': p_str, 'Q': q_str, 'R': r_str}
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_surface_presets() -> Dict[str, Any]:
        """获取所有预设曲面"""
        return {
            'success': True,
            'surfaces': VectorFieldService.SURFACE_PRESETS
        }

    @staticmethod
    def get_gauss_presets() -> Dict[str, Any]:
        """获取高斯定理预设立体"""
        return {
            'success': True,
            'solids': VectorFieldService.GAUSS_SOLID_PRESETS
        }
