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
