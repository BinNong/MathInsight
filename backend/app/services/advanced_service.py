"""高阶数学实验服务：微分方程方向场/相图、特征值分解、假设检验。

全部使用已有安全解析器（math_utils._safe_parse）处理用户表达式，
数值计算走 numpy / scipy，符号计算走 sympy。
"""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import sympy as sp

from app.utils.math_utils import _safe_parse

logger = logging.getLogger(__name__)

X = sp.Symbol('x')

# 常见一阶 ODE 的右端函数 f(x, y)：只允许 x/y 变量
def _parse_ode(expr: str):
    """解析 f(x,y)，返回可对 (x,y) 向量化求值的函数"""
    parsed = _safe_parse(expr)  # AST 白名单校验
    return sp.lambdify((X, sp.Symbol('y')), parsed, 'numpy')


def direction_field(
    expr: str,
    x_range: List[float],
    y_range: List[float],
    density: int = 15,
) -> Dict[str, Any]:
    """生成一阶微分方程 dy/dx = f(x,y) 的方向场线段"""
    f = _parse_ode(expr)
    xs = np.linspace(x_range[0], x_range[1], density)
    ys = np.linspace(y_range[0], y_range[1], density)
    segments: List[Dict[str, float]] = []
    for xv in xs:
        for yv in ys:
            try:
                slope = float(f(xv, yv))
            except Exception:
                continue
            if not np.isfinite(slope):
                continue
            # 归一化方向向量，长度固定
            norm = np.sqrt(1 + slope * slope)
            dx = 0.28 / norm
            dy = slope * dx
            segments.append({
                'x': float(xv), 'y': float(yv),
                'dx': float(dx), 'dy': float(dy),
                'slope': slope,
            })
    return {
        'segments': segments,
        'x_range': x_range,
        'y_range': y_range,
        'density': density,
    }


def solution_curves(
    expr: str,
    initial_conditions: List[Dict[str, float]],
    x_range: List[float],
    steps: int = 400,
) -> Dict[str, Any]:
    """用四阶 Runge-Kutta 从各初值点积分出解曲线"""
    f = _parse_ode(expr)
    x0, x1 = x_range
    h = (x1 - x0) / steps
    curves = []
    for ic in initial_conditions:
        try:
            cx, cy = float(ic['x']), float(ic['y'])
        except (KeyError, TypeError, ValueError):
            continue
        xs, ys = [cx], [cy]
        for _ in range(steps):
            def slope(px, py):
                try:
                    v = float(f(px, py))
                    return v if np.isfinite(v) else 0.0
                except Exception:
                    return 0.0
            k1 = slope(cx, cy)
            k2 = slope(cx + h / 2, cy + h * k1 / 2)
            k3 = slope(cx + h / 2, cy + h * k2 / 2)
            k4 = slope(cx + h, cy + h * k3)
            cy = cy + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
            cx = cx + h
            if not np.isfinite(cy):
                break
            xs.append(cx)
            ys.append(cy)
        curves.append({
            'initial': {'x': float(ic['x']), 'y': float(ic['y'])},
            'x': xs,
            'y': ys,
        })
    return {'curves': curves, 'method': 'RK4', 'steps': steps}


def eigenvalue_analysis(
    matrix: List[List[float]],
    vector: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """2×2 矩阵的特征值、特征向量、行列式、迹，以及向量的变换结果"""
    arr = np.array(matrix, dtype=float)
    if arr.shape != (2, 2):
        raise ValueError('矩阵必须为 2×2')

    det = float(np.linalg.det(arr))
    trace = float(np.trace(arr))

    eigenpairs = []
    # 用 sympy 求精确特征值/向量
    sym = sp.Matrix(matrix)
    try:
        for ev, mult, vecs in sym.eigenvects():
            eigenvalue = complex(sp.N(ev))
            for vec in vecs:
                v = np.array([complex(sp.N(c)) for c in vec])
                norm = np.sqrt(np.sum(np.abs(v) ** 2))
                if norm > 0:
                    v = v / norm
                eigenpairs.append({
                    'eigenvalue_real': float(eigenvalue.real),
                    'eigenvalue_imag': float(eigenvalue.imag),
                    'vector': [float(abs(c)) for c in v],
                })
    except Exception:
        # 数值兜底
        vals, vecs = np.linalg.eig(arr)
        for i in range(len(vals)):
            v = vecs[:, i]
            eigenpairs.append({
                'eigenvalue_real': float(vals[i].real),
                'eigenvalue_imag': float(vals[i].imag),
                'vector': [float(v[0]), float(v[1])],
            })

    result: Dict[str, Any] = {
        'matrix': matrix,
        'determinant': det,
        'trace': trace,
        'eigenpairs': eigenpairs,
        'characteristic': f'λ² - ({trace:.4g})λ + ({det:.4g}) = 0',
    }

    if vector is not None:
        v = np.array(vector, dtype=float)
        transformed = arr @ v
        result['vector'] = [float(x) for x in v]
        result['transformed'] = [float(x) for x in transformed]
        ratio = None
        for i in range(2):
            if abs(v[i]) > 1e-9:
                ratio = float(transformed[i] / v[i])
                break
        result['scaling'] = ratio
        result['is_eigenvector'] = (
            ratio is not None
            and all(abs(transformed[i] - ratio * v[i]) < 1e-6 for i in range(2))
        )
    return result


def hypothesis_test(
    test_type: str,
    sample_mean: float,
    hypothesized_mean: float,
    std: float,
    n: int,
    alpha: float = 0.05,
    tail: str = 'two',
) -> Dict[str, Any]:
    """单样本 z 检验或 t 检验，返回检验统计量、p 值、置信区间与抽样分布"""
    from scipy import stats

    if n < 2 or std <= 0 or not (0 < alpha < 1):
        raise ValueError('参数不合法：n≥2, std>0, 0<alpha<1')
    if tail not in ('two', 'left', 'right'):
        raise ValueError('tail 必须为 two/left/right')

    se = std / np.sqrt(n)
    if test_type == 'z':
        statistic = (sample_mean - hypothesized_mean) / se
        dist = stats.norm
        crit = dist.ppf(1 - alpha / 2) if tail == 'two' else dist.ppf(1 - alpha)
        critical_value = hypothesized_mean + crit * se
    elif test_type == 't':
        df = n - 1
        statistic = (sample_mean - hypothesized_mean) / se
        dist = stats.t(df)
        crit = dist.ppf(1 - alpha / 2) if tail == 'two' else dist.ppf(1 - alpha)
        critical_value = hypothesized_mean + crit * se
    else:
        raise ValueError('test_type 必须为 z 或 t')

    if tail == 'two':
        p_value = 2 * (1 - dist.cdf(abs(statistic)))
        ci_lo = sample_mean - crit * se
        ci_hi = sample_mean + crit * se
        reject = abs(statistic) > dist.ppf(1 - alpha / 2)
    elif tail == 'left':
        p_value = dist.cdf(statistic)
        ci_lo = float('-inf')
        ci_hi = sample_mean + crit * se
        reject = statistic < -crit
    else:
        p_value = 1 - dist.cdf(statistic)
        ci_lo = sample_mean - crit * se
        ci_hi = float('inf')
        reject = statistic > crit

    # 抽样分布曲线用于绘图
    xs = np.linspace(
        hypothesized_mean - 4 * se, hypothesized_mean + 4 * se, 300
    )
    pdf = dist.pdf((xs - hypothesized_mean) / se) / se

    return {
        'test_type': test_type,
        'statistic': float(statistic),
        'p_value': float(p_value),
        'alpha': alpha,
        'tail': tail,
        'reject_null': bool(reject),
        'standard_error': float(se),
        'confidence_interval': [float(ci_lo), float(ci_hi)],
        'critical_value': float(critical_value),
        'distribution': {'x': [float(v) for v in xs], 'y': [float(v) for v in pdf]},
        'sample_mean': sample_mean,
        'hypothesized_mean': hypothesized_mean,
        'conclusion': (
            f'p = {p_value:.4f} {"<" if reject else "≥"} α = {alpha}，'
            + ('拒绝原假设' if reject else '不能拒绝原假设')
        ),
    }
