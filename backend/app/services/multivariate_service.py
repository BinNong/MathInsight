"""
多元函数服务模块
提供 3D 曲面图、等高线、偏导数、梯度场等可视化计算功能
"""
from typing import Dict, List, Any, Tuple, Optional
import sympy as sp
import numpy as np
from app.utils.math_utils import _safe_parse


class MultivariateService:
    """多元函数服务类"""

    @staticmethod
    def surface_visualization(func_str: str, x_range: List[float], y_range: List[float],
                              resolution: int = 50) -> Dict[str, Any]:
        """
        生成 3D 曲面可视化数据

        Args:
            func_str: 二元函数表达式，如 "x**2 + y**2"
            x_range: x 范围 [x_min, x_max]
            y_range: y 范围 [y_min, y_max]
            resolution: 网格分辨率

        Returns:
            dict: 包含 3D 曲面数据
        """
        x, y = sp.symbols('x y')
        try:
            func = _safe_parse(func_str)

            # 生成网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            X, Y = np.meshgrid(x_vals, y_vals)

            # 计算 Z 值
            f_lambdified = sp.lambdify((x, y), func, 'numpy')
            Z = f_lambdified(X, Y)

            # 处理 NaN 和 Inf
            Z = np.where(np.isnan(Z) | np.isinf(Z), None, Z)

            return {
                'success': True,
                'surface': {
                    'x': X.tolist(),
                    'y': Y.tolist(),
                    'z': Z.tolist() if not isinstance(Z, list) else Z
                },
                'function': func_str,
                'x_range': x_range,
                'y_range': y_range,
                'resolution': resolution
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def contour_data(func_str: str, x_range: List[float], y_range: List[float],
                     levels: int = 20, resolution: int = 100) -> Dict[str, Any]:
        """
        生成等高线数据

        Args:
            func_str: 二元函数表达式
            x_range: x 范围
            y_range: y 范围
            levels: 等高线条数
            resolution: 网格分辨率

        Returns:
            dict: 包含等高线数据
        """
        x, y = sp.symbols('x y')
        try:
            func = _safe_parse(func_str)

            # 生成网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            X, Y = np.meshgrid(x_vals, y_vals)

            # 计算 Z 值
            f_lambdified = sp.lambdify((x, y), func, 'numpy')
            Z = f_lambdified(X, Y)

            # 计算等高线值
            z_min, z_max = np.nanmin(Z), np.nanmax(Z)
            contour_levels = np.linspace(z_min, z_max, levels)

            return {
                'success': True,
                'contour': {
                    'x': X.tolist(),
                    'y': Y.tolist(),
                    'z': Z.tolist() if not isinstance(Z, list) else Z,
                    'levels': contour_levels.tolist()
                },
                'function': func_str,
                'x_range': x_range,
                'y_range': y_range
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def gradient_field(func_str: str, x_range: List[float], y_range: List[float],
                       resolution: int = 15) -> Dict[str, Any]:
        """
        生成梯度场数据

        Args:
            func_str: 二元函数表达式
            x_range: x 范围
            y_range: y 范围
            resolution: 网格分辨率

        Returns:
            dict: 包含梯度场箭头数据
        """
        x, y = sp.symbols('x y')
        try:
            func = _safe_parse(func_str)

            # 计算偏导数
            partial_x = sp.diff(func, x)
            partial_y = sp.diff(func, y)

            # 生成网格
            x_vals = np.linspace(x_range[0], x_range[1], resolution)
            y_vals = np.linspace(y_range[0], y_range[1], resolution)
            X, Y = np.meshgrid(x_vals, y_vals)

            # 计算梯度
            f_grad_x = sp.lambdify((x, y), partial_x, 'numpy')
            f_grad_y = sp.lambdify((x, y), partial_y, 'numpy')
            GradX = f_grad_x(X, Y)
            GradY = f_grad_y(X, Y)

            # 计算梯度幅值用于归一化
            magnitude = np.sqrt(GradX**2 + GradY**2)
            max_mag = np.nanmax(magnitude)
            if max_mag > 0:
                GradX = GradX / max_mag * 0.5  # 归一化箭头长度
                GradY = GradY / max_mag * 0.5

            return {
                'success': True,
                'gradient': {
                    'x': X.tolist(),
                    'y': Y.tolist(),
                    'u': GradX.tolist() if not isinstance(GradX, list) else GradX,
                    'v': GradY.tolist() if not isinstance(GradY, list) else GradY,
                    'magnitude': magnitude.tolist() if not isinstance(magnitude, list) else magnitude
                },
                'partial_derivatives': {
                    'df_dx': str(partial_x),
                    'df_dy': str(partial_y)
                },
                'function': func_str,
                'x_range': x_range,
                'y_range': y_range
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def partial_derivatives(func_str: str, x0: float, y0: float) -> Dict[str, Any]:
        """
        计算指定点的偏导数值和切平面方程

        Args:
            func_str: 二元函数表达式
            x0: x 坐标
            y0: y 坐标

        Returns:
            dict: 包含偏导数值和切平面数据
        """
        x, y = sp.symbols('x y')
        try:
            func = _safe_parse(func_str)

            # 计算偏导数表达式
            partial_x = sp.diff(func, x)
            partial_y = sp.diff(func, y)

            # 计算偏导数值
            df_dx_val = float(partial_x.subs({x: x0, y: y0}))
            df_dy_val = float(partial_y.subs({x: x0, y: y0}))

            # 计算函数值
            f_val = float(func.subs({x: x0, y: y0}))

            # 切平面方程: z = f(x0,y0) + fx(x0,y0)(x-x0) + fy(x0,y0)(y-y0)
            # 即: fx*x + fy*y - z = fx*x0 + fy*y0 - f(x0,y0)

            # 生成切平面网格数据
            plane_size = 1.0  # 切平面大小
            x_plane = np.linspace(x0 - plane_size, x0 + plane_size, 20)
            y_plane = np.linspace(y0 - plane_size, y0 + plane_size, 20)
            X_plane, Y_plane = np.meshgrid(x_plane, y_plane)
            Z_plane = f_val + df_dx_val * (X_plane - x0) + df_dy_val * (Y_plane - y0)

            # 偏导数方向向量
            direction_x = [x0, x0 + df_dx_val * 0.5]
            direction_y = [y0, y0]
            direction_z = [f_val, f_val + 0.5]  # x 方向偏导

            direction_x2 = [x0, x0]
            direction_y2 = [y0, y0 + df_dy_val * 0.5]
            direction_z2 = [f_val, f_val + 0.5]  # y 方向偏导

            # 梯度向量（归一化）
            grad_mag = np.sqrt(df_dx_val**2 + df_dy_val**2)
            if grad_mag > 0:
                grad_x = [x0, x0 + df_dx_val / grad_mag * 0.5]
                grad_y = [y0, y0 + df_dy_val / grad_mag * 0.5]
            else:
                grad_x = [x0, x0]
                grad_y = [y0, y0]

            # 梯度在 xy 平面上的投影
            grad_2d_x = [x0, x0 + df_dx_val * 0.3]
            grad_2d_y = [y0, y0 + df_dy_val * 0.3]

            return {
                'success': True,
                'point': {
                    'x': x0,
                    'y': y0,
                    'z': f_val
                },
                'partial_derivatives': {
                    'df_dx': df_dx_val,
                    'df_dy': df_dy_val,
                    'df_dx_expr': str(partial_x),
                    'df_dy_expr': str(partial_y)
                },
                'tangent_plane': {
                    'x': X_plane.tolist(),
                    'y': Y_plane.tolist(),
                    'z': Z_plane.tolist() if not isinstance(Z_plane, list) else Z_plane,
                    'equation': f"z = {f_val:.4f} + {df_dx_val:.4f}(x - {x0}) + {df_dy_val:.4f}(y - {y0})"
                },
                'gradient': {
                    'x': grad_x,
                    'y': grad_y,
                    'z': [f_val, f_val + 0.5],
                    'magnitude': grad_mag
                },
                'gradient_2d': {
                    'x': grad_2d_x,
                    'y': grad_2d_y
                },
                'partial_directions': {
                    'x': {
                        'x': direction_x,
                        'y': direction_y,
                        'z': direction_z
                    },
                    'y': {
                        'x': direction_x2,
                        'y': direction_y2,
                        'z': direction_z2
                    }
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def gradient_descent(func_str: str, start_x: float, start_y: float,
                         learning_rate: float = 0.1, steps: int = 50) -> Dict[str, Any]:
        """
        计算最速下降路径

        Args:
            func_str: 二元函数表达式
            start_x: 起始点 x
            start_y: 起始点 y
            learning_rate: 学习率
            steps: 迭代步数

        Returns:
            dict: 包含下降路径数据
        """
        x, y = sp.symbols('x y')
        try:
            func = _safe_parse(func_str)

            # 计算偏导数
            partial_x = sp.diff(func, x)
            partial_y = sp.diff(func, y)

            # 转换为数值函数
            f_x = sp.lambdify((x, y), func, 'numpy')
            grad_x_fn = sp.lambdify((x, y), partial_x, 'numpy')
            grad_y_fn = sp.lambdify((x, y), partial_y, 'numpy')

            # 梯度下降
            path_x = [start_x]
            path_y = [start_y]
            path_z = [f_x(start_x, start_y)]
            values = [f_x(start_x, start_y)]

            current_x, current_y = start_x, start_y

            for _ in range(steps):
                grad_x = grad_x_fn(current_x, current_y)
                grad_y = grad_y_fn(current_x, current_y)

                # 更新
                current_x = current_x - learning_rate * grad_x
                current_y = current_y - learning_rate * grad_y

                path_x.append(current_x)
                path_y.append(current_y)
                path_z.append(f_x(current_x, current_y))
                values.append(f_x(current_x, current_y))

            return {
                'success': True,
                'path': {
                    'x': path_x,
                    'y': path_y,
                    'z': path_z
                },
                'values': values,
                'start_point': {'x': start_x, 'y': start_y, 'z': path_z[0]},
                'end_point': {'x': path_x[-1], 'y': path_y[-1], 'z': path_z[-1]},
                'converged': abs(values[-1] - values[-2]) < 1e-6 if len(values) > 1 else False
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def compute_surface_data(func_str: str, x_range: List[float], y_range: List[float],
                             point_x: float = 0, point_y: float = 0,
                             resolution: int = 50, contour_levels: int = 20,
                             show_gradient: bool = True,
                             show_tangent_plane: bool = True) -> Dict[str, Any]:
        """
        综合计算所有可视化数据

        Args:
            func_str: 二元函数表达式
            x_range: x 范围
            y_range: y 范围
            point_x: 观察点 x
            point_y: 观察点 y
            resolution: 3D 曲面分辨率
            contour_levels: 等高线层数
            show_gradient: 是否显示梯度
            show_tangent_plane: 是否显示切平面

        Returns:
            dict: 包含所有可视化数据
        """
        # 计算曲面数据
        surface_result = MultivariateService.surface_visualization(
            func_str, x_range, y_range, resolution
        )

        # 计算等高线数据
        contour_result = MultivariateService.contour_data(
            func_str, x_range, y_range, contour_levels, resolution
        )

        # 计算梯度场数据
        gradient_result = MultivariateService.gradient_field(
            func_str, x_range, y_range, min(15, resolution // 3)
        )

        # 计算偏导数和切平面
        partial_result = MultivariateService.partial_derivatives(
            func_str, point_x, point_y
        )

        return {
            'success': all([surface_result.get('success'), contour_result.get('success')]),
            'surface': surface_result.get('surface'),
            'contour': contour_result.get('contour'),
            'gradient': gradient_result.get('gradient') if show_gradient else None,
            'partial_derivatives': partial_result.get('partial_derivatives') if partial_result.get('success') else None,
            'tangent_plane': partial_result.get('tangent_plane') if show_tangent_plane and partial_result.get('success') else None,
            'point': partial_result.get('point') if partial_result.get('success') else {'x': point_x, 'y': point_y, 'z': 0},
            'gradient_2d': partial_result.get('gradient_2d') if partial_result.get('success') else None,
            'function': func_str,
            'x_range': x_range,
            'y_range': y_range
        }
