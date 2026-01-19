"""
线性代数服务模块
提供矩阵变换、特征值计算等可视化功能
"""
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass


@dataclass
class MatrixTransformResult:
    """矩阵变换结果"""
    matrix: Dict[str, float]  # {'a': a, 'b': b, 'c': c, 'd': d}
    unit_grid: Dict[str, List[List[float]]]
    transformed_grid: Dict[str, List[List[float]]]
    unit_circle: Dict[str, List[float]]
    determinant: Dict[str, Any]
    eigenvalues: List[complex]
    eigenvectors: Optional[List[Dict[str, Any]]] = None


class LinearAlgebraService:
    """线性代数服务类"""

    # 网格配置常量
    GRID_LINES = 11  # 从 -5 到 5，共 11 条线
    GRID_RANGE = 5
    CIRCLE_POINTS = 100

    @staticmethod
    def matrix_transform(a: float, b: float, c: float, d: float,
                         show_eigenvectors: bool = True) -> MatrixTransformResult:
        """
        计算 2×2 矩阵变换的可视化数据

        Args:
            a, b, c, d: 矩阵 [[a, b], [c, d]] 的元素
            show_eigenvectors: 是否计算特征向量

        Returns:
            MatrixTransformResult: 包含所有可视化数据
        """
        # 构建矩阵
        matrix = np.array([[a, b], [c, d]], dtype=float)

        # 计算行列式
        det = float(np.linalg.det(matrix))

        # 计算特征值和特征向量
        eigenvalues, eigenvectors = np.linalg.eig(matrix)

        # 生成网格数据
        unit_grid = LinearAlgebraService._generate_unit_grid()
        transformed_grid = LinearAlgebraService._apply_transform_grid(unit_grid, matrix)

        # 生成单位圆数据
        unit_circle = LinearAlgebraService._generate_unit_circle()
        transformed_circle = LinearAlgebraService._transform_circle(unit_circle, matrix)

        # 处理特征向量
        eigen_result = None
        if show_eigenvectors:
            eigen_list = []
            for i, ev in enumerate(eigenvalues):
                if np.isreal(ev):
                    lambda_real = float(np.real(ev))
                    v = eigenvectors[:, i].real
                    # 归一化并确保第一分量非负
                    v_norm = np.linalg.norm(v)
                    if v_norm > 1e-10:
                        v = v / v_norm
                    if np.abs(v[0]) < 1e-10 and np.abs(v[1]) > 1e-10:
                        v = -v
                    eigen_list.append({
                        'lambda': lambda_real,
                        'v': [float(v[0]), float(v[1])]
                    })
            eigen_result = eigen_list if eigen_list else None

        # 将特征值转换为可 JSON 序列化的格式
        serializable_eigenvalues = []
        for ev in eigenvalues:
            if np.iscomplexobj(ev):
                # 复数: 转为 {re, im} 格式
                serializable_eigenvalues.append({
                    're': float(np.real(ev)),
                    'im': float(np.imag(ev))
                })
            else:
                # 实数
                serializable_eigenvalues.append(float(ev))

        # 行列式解释
        if abs(det) < 1e-10:
            interpretation = "降维：退化为直线或点"
        else:
            direction = "逆时针" if det > 0 else "顺时针"
            interpretation = f"面积缩放 {abs(det):.2f} 倍，{direction}方向"

        return MatrixTransformResult(
            matrix={'a': a, 'b': b, 'c': c, 'd': d},
            unit_grid=unit_grid,
            transformed_grid=transformed_grid,
            unit_circle=transformed_circle,
            determinant={
                'value': det,
                'interpretation': interpretation
            },
            eigenvalues=serializable_eigenvalues,
            eigenvectors=eigen_result
        )

    @staticmethod
    def _generate_unit_grid() -> Dict[str, List[List[float]]]:
        """生成单位网格数据"""
        r = LinearAlgebraService.GRID_RANGE
        n = LinearAlgebraService.GRID_LINES
        values = np.linspace(-r, r, n)

        x_horizontal = []
        y_horizontal = []
        x_vertical = []
        y_vertical = []

        for val in values:
            # 水平线: y = val, x 从 -r 到 r
            x_horizontal.append([-r, r])
            y_horizontal.append([val, val])

            # 垂直线: x = val, y 从 -r 到 r
            x_vertical.append([val, val])
            y_vertical.append([-r, r])

        return {
            'x_horizontal': x_horizontal,
            'y_horizontal': y_horizontal,
            'x_vertical': x_vertical,
            'y_vertical': y_vertical
        }

    @staticmethod
    def _apply_transform_grid(grid: Dict[str, List[List[float]]],
                               matrix: np.ndarray) -> Dict[str, List[List[float]]]:
        """应用矩阵变换到网格"""
        def transform_line(x_vals: List[float], y_vals: List[float]) -> Tuple[List[float], List[float]]:
            tx, ty = [], []
            for x, y in zip(x_vals, y_vals):
                point = matrix @ np.array([x, y])
                tx.append(float(point[0]))
                ty.append(float(point[1]))
            return tx, ty

        result = {
            'x_horizontal': [],
            'y_horizontal': [],
            'x_vertical': [],
            'y_vertical': []
        }

        # 变换所有水平线
        for x_line, y_line in zip(grid['x_horizontal'], grid['y_horizontal']):
            tx, ty = transform_line(x_line, y_line)
            result['x_horizontal'].append(tx)
            result['y_horizontal'].append(ty)

        # 变换所有垂直线
        for x_line, y_line in zip(grid['x_vertical'], grid['y_vertical']):
            tx, ty = transform_line(x_line, y_line)
            result['x_vertical'].append(tx)
            result['y_vertical'].append(ty)

        return result

    @staticmethod
    def _generate_unit_circle(num_points: int = None) -> Dict[str, List[float]]:
        """生成单位圆数据"""
        n = num_points or LinearAlgebraService.CIRCLE_POINTS
        theta = np.linspace(0, 2 * np.pi, n)
        return {
            'x': np.cos(theta).tolist(),
            'y': np.sin(theta).tolist()
        }

    @staticmethod
    def _transform_circle(circle: Dict[str, List[float]],
                          matrix: np.ndarray) -> Dict[str, List[float]]:
        """应用矩阵变换到圆"""
        tx, ty = [], []
        for x, y in zip(circle['x'], circle['y']):
            point = matrix @ np.array([x, y])
            tx.append(float(point[0]))
            ty.append(float(point[1]))
        return {'x': tx, 'y': ty}

    @staticmethod
    def get_presets() -> Dict[str, Dict[str, float]]:
        """获取预设矩阵"""
        # 预先计算三角函数值并转换为 Python float
        cos30 = float(np.cos(np.pi/6))
        sin30 = float(np.sin(np.pi/6))
        cos45 = float(np.cos(np.pi/4))
        sin45 = float(np.sin(np.pi/4))
        return {
            'identity': {'a': 1, 'b': 0, 'c': 0, 'd': 1},
            'scale_2': {'a': 2, 'b': 0, 'c': 0, 'd': 2},
            'stretch_x': {'a': 2, 'b': 0, 'c': 0, 'd': 1},
            'stretch_y': {'a': 1, 'b': 0, 'c': 0, 'd': 2},
            'shear_x': {'a': 1, 'b': 1, 'c': 0, 'd': 1},
            'shear_y': {'a': 1, 'b': 0, 'c': 1, 'd': 1},
            'reflect_x': {'a': 1, 'b': 0, 'c': 0, 'd': -1},
            'reflect_y': {'a': -1, 'b': 0, 'c': 0, 'd': 1},
            'rotate_30': {
                'a': cos30, 'b': -sin30,
                'c': sin30, 'd': cos30
            },
            'rotate_45': {
                'a': cos45, 'b': -sin45,
                'c': sin45, 'd': cos45
            },
            'scale_nonuniform': {'a': 2, 'b': 0, 'c': 0, 'd': 0.5},
            'squeeze': {'a': 2, 'b': 0, 'c': 0, 'd': 0.5}
        }
