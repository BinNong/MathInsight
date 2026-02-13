from flask import Blueprint, request, jsonify
from app.services.vector_field_service import VectorFieldService

vector_field_bp = Blueprint('vector_field', __name__)


def validate_request_data(data: dict, required_fields: list = None) -> tuple:
    """验证请求数据"""
    if not data:
        return False, 'Request body is required'
    if required_fields:
        for field in required_fields:
            if field not in data:
                return False, f'Missing required field: {field}'
    return True, None


def safe_float(value, field_name: str) -> tuple:
    """安全地将值转换为 float"""
    try:
        return True, float(value)
    except (TypeError, ValueError):
        return False, f'{field_name} must be a number'


def safe_float_list(value, field_name: str) -> tuple:
    """安全地将值转换为 float 列表"""
    try:
        if isinstance(value, list):
            return True, [float(v) for v in value]
        return False, f'{field_name} must be a list'
    except (TypeError, ValueError):
        return False, f'{field_name} must be a list of numbers'


@vector_field_bp.route('/field', methods=['POST'])
def vector_field():
    """
    计算向量场可视化数据

    请求参数:
    {
        "P": "-y",              # 向量场 x 分量表达式
        "Q": "x",               # 向量场 y 分量表达式
        "x_range": [-3, 3],     # x 范围
        "y_range": [-3, 3],     # y 范围
        "resolution": 20        # 网格分辨率（默认20）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')

    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    resolution = int(data.get('resolution', 20))
    resolution = min(max(resolution, 5), 50)

    try:
        result = VectorFieldService.vector_field_visualization(
            p_str, q_str, x_range, y_range, resolution
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/streamline', methods=['POST'])
def streamline():
    """
    计算流线数据

    请求参数:
    {
        "P": "-y",                           # 向量场 x 分量
        "Q": "x",                            # 向量场 y 分量
        "start_points": [[1, 0], [0, 1]],    # 起始点列表
        "t_span": [0, 5],                    # 积分时间范围
        "direction": "both"                  # 积分方向: forward, backward, both
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'start_points'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    start_points = data.get('start_points', [[1, 0], [0, 1]])
    t_span = data.get('t_span', [0, 5])
    direction = data.get('direction', 'both')

    try:
        import numpy as np
        t_eval = np.linspace(t_span[0], t_span[1], 100)

        result = VectorFieldService.compute_streamline(
            p_str, q_str, start_points, tuple(t_span), t_eval, direction
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/line-integral', methods=['POST'])
def line_integral():
    """
    计算沿路径的线积分

    请求参数:
    {
        "P": "-y",                           # 向量场 x 分量
        "Q": "x",                            # 向量场 y 分量
        "path": {
            "type": "parametric",
            "x": "cos(t)",
            "y": "sin(t)",
            "t_range": [0, 6.28318]
        },
        "num_points": 200                    # 采样点数
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'path'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    path_config = data.get('path')
    num_points = int(data.get('num_points', 200))

    try:
        result = VectorFieldService.compute_line_integral(
            p_str, q_str, path_config, num_points
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/greens-theorem', methods=['POST'])
def greens_theorem():
    """
    验证格林公式

    请求参数:
    {
        "P": "-y",                    # 向量场 x 分量
        "Q": "x",                     # 向量场 y 分量
        "region_type": "circle",      # 区域类型: circle, rectangle
        "region_params": {
            "radius": 1               # 区域参数
        }
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    region_type = data.get('region_type', 'circle')
    region_params = data.get('region_params', {})

    try:
        result = VectorFieldService.verify_greens_theorem(
            p_str, q_str, region_type, region_params
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/flux', methods=['POST'])
def flux_integral():
    """
    计算穿过曲线的通量

    请求参数:
    {
        "P": "x",
        "Q": "y",
        "path": {
            "type": "parametric",
            "x": "cos(t)",
            "y": "sin(t)",
            "t_range": [0, 6.28318]
        }
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'path'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', 'x')
    q_str = data.get('Q', 'y')
    path_config = data.get('path')
    num_points = int(data.get('num_points', 200))

    try:
        result = VectorFieldService.compute_line_integral(
            p_str, q_str, path_config, num_points
        )
        # 提取通量相关数据
        if result.get('success'):
            return jsonify({
                'success': True,
                'flux_value': result.get('flux_value', 0),
                'path': result.get('path'),
                'field': result.get('field')
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/curl-divergence', methods=['POST'])
def curl_divergence():
    """
    计算旋度和散度

    请求参数:
    {
        "P": "-y",
        "Q": "x",
        "x": 1,
        "y": 1
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    x_val = data.get('x', 0)
    y_val = data.get('y', 0)

    try:
        import sympy as sp
        from app.utils.math_utils import _safe_parse
        x, y = sp.symbols('x y')

        P = _safe_parse(p_str)
        Q = _safe_parse(q_str)

        # 计算旋度
        curl_expr = sp.diff(Q, x) - sp.diff(P, y)
        curl_val = float(curl_expr.subs({x: x_val, y: y_val}))

        # 计算散度
        div_expr = sp.diff(P, x) + sp.diff(Q, y)
        div_val = float(div_expr.subs({x: x_val, y: y_val}))

        return jsonify({
            'success': True,
            'curl': {
                'expression': str(curl_expr),
                'value': curl_val
            },
            'divergence': {
                'expression': str(div_expr),
                'value': div_val
            },
            'point': {'x': x_val, 'y': y_val}
        })
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/presets', methods=['GET'])
def get_presets():
    """
    获取预设向量场和路径

    返回:
    {
        "success": true,
        "vector_fields": [...],
        "paths": [...]
    }
    """
    result = VectorFieldService.get_presets()
    return jsonify(result)


@vector_field_bp.route('/conservative', methods=['POST'])
def check_conservative():
    """
    检查向量场是否保守

    请求参数:
    {
        "P": "2*x",
        "Q": "2*y"
    }

    返回:
    {
        "success": true,
        "is_conservative": true,
        "curl_expression": "0",
        "curl_value": 0,
        "message": "该向量场是保守场"
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P')
    q_str = data.get('Q')

    try:
        result = VectorFieldService.is_conservative(p_str, q_str)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/potential', methods=['POST'])
def find_potential():
    """
    计算势函数

    请求参数:
    {
        "P": "2*x",
        "Q": "2*y"
    }

    返回:
    {
        "success": true,
        "is_conservative": true,
        "potential_function": "x**2 + y**2",
        "grad_x": "2*x",
        "grad_y": "2*y",
        "matches_field": true
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P')
    q_str = data.get('Q')

    try:
        result = VectorFieldService.find_potential(p_str, q_str)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/potential-contour', methods=['POST'])
def potential_contour():
    """
    计算势函数等值线数据

    请求参数:
    {
        "P": "2*x",
        "Q": "2*y",
        "x_range": [-3, 3],
        "y_range": [-3, 3],
        "resolution": 50
    }

    返回:
    {
        "success": true,
        "potential_function": "x**2 + y**2",
        "x": [...],
        "y": [...],
        "z": [...],
        "levels": [...]
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P')
    q_str = data.get('Q')

    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    resolution = int(data.get('resolution', 50))
    resolution = min(max(resolution, 10), 100)

    try:
        result = VectorFieldService.compute_potential_contour(
            p_str, q_str, x_range, y_range, resolution
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/path-independence', methods=['POST'])
def path_independence():
    """
    验证保守场的路径无关性

    请求参数:
    {
        "P": "2*x",
        "Q": "2*y",
        "start_point": [0, 0],
        "end_point": [1, 1],
        "num_points": 200
    }

    返回:
    {
        "success": true,
        "is_conservative": true,
        "integrals": [...],
        "path_points": {...},
        "is_independent": true,
        "message": "路径无关性已验证"
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'start_point', 'end_point'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P')
    q_str = data.get('Q')

    is_valid, start_point = safe_float_list(data.get('start_point', [0, 0]), 'start_point')
    if not is_valid:
        return jsonify({'success': False, 'error': start_point}), 400

    is_valid, end_point = safe_float_list(data.get('end_point', [1, 1]), 'end_point')
    if not is_valid:
        return jsonify({'success': False, 'error': end_point}), 400

    num_points = int(data.get('num_points', 200))

    try:
        result = VectorFieldService.verify_path_independence(
            p_str, q_str, start_point, end_point, num_points
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


# ============ 3D向量场 API ============

@vector_field_bp.route('/field-3d', methods=['POST'])
def vector_field_3d():
    """
    计算3D向量场可视化数据

    请求参数:
    {
        "P": "-y",                  # 向量场 x 分量表达式
        "Q": "x",                   # 向量场 y 分量表达式
        "R": "1",                   # 向量场 z 分量表达式
        "x_range": [-3, 3],         # x 范围
        "y_range": [-3, 3],         # y 范围
        "z_range": [-3, 3],         # z 范围
        "resolution": 8              # 网格分辨率（默认8）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'R'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    r_str = data.get('R', '0')

    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    is_valid, z_range = safe_float_list(data.get('z_range', [-3, 3]), 'z_range')
    if not is_valid:
        return jsonify({'success': False, 'error': z_range}), 400

    resolution = int(data.get('resolution', 8))
    resolution = min(max(resolution, 3), 15)

    try:
        result = VectorFieldService.vector_field_3d(
            p_str, q_str, r_str, x_range, y_range, z_range, resolution
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/streamline-3d', methods=['POST'])
def streamline_3d():
    """
    计算3D流线（积分曲线）

    请求参数:
    {
        "P": "-y",                           # 向量场 x 分量
        "Q": "x",                            # 向量场 y 分量
        "R": "1",                            # 向量场 z 分量
        "start_points": [[1, 0, 0]],         # 起始点列表 [x, y, z]
        "t_span": [0, 5],                   # 积分时间范围
        "direction": "both"                  # 积分方向: forward, backward, both
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'R', 'start_points'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    r_str = data.get('R', '0')
    start_points = data.get('start_points', [[1, 0, 0]])
    t_span = data.get('t_span', [0, 5])
    direction = data.get('direction', 'both')

    try:
        import numpy as np
        t_eval = np.linspace(t_span[0], t_span[1], 100)

        result = VectorFieldService.compute_streamline_3d(
            p_str, q_str, r_str, start_points, tuple(t_span), t_eval, direction
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/curl-divergence-3d', methods=['POST'])
def curl_divergence_3d():
    """
    计算3D旋度和散度

    请求参数:
    {
        "P": "-y",
        "Q": "x",
        "R": "0",
        "x": 1,
        "y": 1,
        "z": 1
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'R'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '-y')
    q_str = data.get('Q', 'x')
    r_str = data.get('R', '0')
    x_val = data.get('x', 0)
    y_val = data.get('y', 0)
    z_val = data.get('z', 0)

    try:
        result = VectorFieldService.compute_curl_divergence_3d(
            p_str, q_str, r_str, x_val, y_val, z_val
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/presets-3d', methods=['GET'])
def get_presets_3d():
    """
    获取3D预设向量场
    """
    return jsonify({
        'success': True,
        'vector_fields': VectorFieldService.VECTOR_FIELD_3D_PRESETS
    })


# ============ 曲面积分 API ============

@vector_field_bp.route('/surface-integral', methods=['POST'])
def surface_integral():
    """
    计算曲面积分

    请求参数:
    {
        "P": "-y",                  # 向量场 x 分量
        "Q": "x",                   # 向量场 y 分量
        "R": "0",                   # 向量场 z 分量
        "surface_type": "sphere",    # 曲面类型: sphere, cylinder, paraboloid, cone, plane
        "surface_params": {"r": 1}, # 曲面参数
        "orientation": "outward",    # 法向量方向: outward, inward
        "resolution": 50             # 网格分辨率
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'R'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '0')
    q_str = data.get('Q', '0')
    r_str = data.get('R', '0')
    surface_type = data.get('surface_type', 'sphere')
    surface_params = data.get('surface_params', {})
    orientation = data.get('orientation', 'outward')
    resolution = int(data.get('resolution', 50))
    resolution = min(max(resolution, 10), 100)

    try:
        result = VectorFieldService.compute_surface_integral(
            p_str, q_str, r_str, surface_type, surface_params, orientation, resolution
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/surface-presets', methods=['GET'])
def get_surface_presets():
    """
    获取预设曲面
    """
    result = VectorFieldService.get_surface_presets()
    return jsonify(result)


# ============ 高斯散度定理 API ============

@vector_field_bp.route('/gauss-theorem', methods=['POST'])
def gauss_theorem():
    """
    验证高斯散度定理

    请求参数:
    {
        "P": "-y",                    # 向量场 x 分量
        "Q": "x",                     # 向量场 y 分量
        "R": "0",                     # 向量场 z 分量
        "solid_type": "sphere",       # 立体类型: sphere, cube, cylinder
        "solid_params": {"r": 1},     # 立体参数
        "resolution": 30               # 网格分辨率
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['P', 'Q', 'R'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    p_str = data.get('P', '0')
    q_str = data.get('Q', '0')
    r_str = data.get('R', '0')
    solid_type = data.get('solid_type', 'sphere')
    solid_params = data.get('solid_params', {})
    resolution = int(data.get('resolution', 30))
    resolution = min(max(resolution, 10), 50)

    try:
        result = VectorFieldService.verify_gauss_theorem(
            p_str, q_str, r_str, solid_type, solid_params, resolution
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@vector_field_bp.route('/gauss-presets', methods=['GET'])
def get_gauss_presets():
    """
    获取高斯定理预设立体
    """
    result = VectorFieldService.get_gauss_presets()
    return jsonify(result)
