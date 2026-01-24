from flask import Blueprint, request, jsonify
from app.services.multivariate_service import MultivariateService
import sympy as sp

multivariate_bp = Blueprint('multivariate', __name__)


def validate_request_data(data: dict, required_fields: list = None) -> tuple:
    """
    验证请求数据

    Args:
        data: 请求数据字典
        required_fields: 必填字段列表

    Returns:
        (is_valid, error_message)
    """
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


@multivariate_bp.route('/surface', methods=['POST'])
def surface_visualization():
    """
    计算 3D 曲面可视化数据

    请求参数:
    {
        "function": "x**2 + y**2",  # 二元函数表达式
        "x_range": [-3, 3],         # x 范围
        "y_range": [-3, 3],         # y 范围
        "resolution": 50            # 网格分辨率（默认50）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    # 验证范围参数
    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    resolution = int(data.get('resolution', 50))
    resolution = min(max(resolution, 10), 100)  # 限制分辨率范围

    try:
        result = MultivariateService.surface_visualization(
            func_str, x_range, y_range, resolution
        )
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/contour', methods=['POST'])
def contour_visualization():
    """
    计算等高线可视化数据

    请求参数:
    {
        "function": "x**2 + y**2",  # 二元函数表达式
        "x_range": [-3, 3],         # x 范围
        "y_range": [-3, 3],         # y 范围
        "levels": 20,               # 等高线条数（默认20）
        "resolution": 100           # 网格分辨率（默认100）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    # 验证范围参数
    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    levels = int(data.get('levels', 20))
    levels = min(max(levels, 5), 50)  # 限制等高线范围
    resolution = int(data.get('resolution', 100))
    resolution = min(max(resolution, 20), 200)  # 限制分辨率范围

    try:
        result = MultivariateService.contour_data(
            func_str, x_range, y_range, levels, resolution
        )
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/gradient', methods=['POST'])
def gradient_visualization():
    """
    计算梯度场数据

    请求参数:
    {
        "function": "x**2 + y**2",  # 二元函数表达式
        "x_range": [-3, 3],         # x 范围
        "y_range": [-3, 3],         # y 范围
        "resolution": 15            # 网格分辨率（默认15）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    # 验证范围参数
    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    resolution = int(data.get('resolution', 15))
    resolution = min(max(resolution, 5), 30)  # 限制分辨率范围

    try:
        result = MultivariateService.gradient_field(
            func_str, x_range, y_range, resolution
        )
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/partial-derivatives', methods=['POST'])
def partial_derivatives():
    """
    计算偏导数和切平面

    请求参数:
    {
        "function": "x**2 + y**2",  # 二元函数表达式
        "x0": 1,                    # x 坐标
        "y0": 1                     # y 坐标
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    is_valid, x0 = safe_float(data.get('x0', 1), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    is_valid, y0 = safe_float(data.get('y0', 1), 'y0')
    if not is_valid:
        return jsonify({'success': False, 'error': y0}), 400

    try:
        result = MultivariateService.partial_derivatives(func_str, x0, y0)
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/gradient-descent', methods=['POST'])
def gradient_descent():
    """
    计算最速下降路径

    请求参数:
    {
        "function": "x**2 + y**2",    # 二元函数表达式
        "start_x": 2,                  # 起始点 x
        "start_y": 2,                  # 起始点 y
        "learning_rate": 0.1,          # 学习率（默认0.1）
        "steps": 50                    # 迭代步数（默认50）
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    is_valid, start_x = safe_float(data.get('start_x', 2), 'start_x')
    if not is_valid:
        return jsonify({'success': False, 'error': start_x}), 400

    is_valid, start_y = safe_float(data.get('start_y', 2), 'start_y')
    if not is_valid:
        return jsonify({'success': False, 'error': start_y}), 400

    learning_rate = float(data.get('learning_rate', 0.1))
    steps = int(data.get('steps', 50))
    steps = min(max(steps, 1), 200)  # 限制步数范围

    try:
        result = MultivariateService.gradient_descent(
            func_str, start_x, start_y, learning_rate, steps
        )
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/compute', methods=['POST'])
def compute_surface():
    """
    综合计算所有可视化数据

    请求参数:
    {
        "function": "x**2 + y**2",    # 二元函数表达式
        "x_range": [-3, 3],           # x 范围
        "y_range": [-3, 3],           # y 范围
        "point_x": 1,                 # 观察点 x
        "point_y": 1,                 # 观察点 y
        "resolution": 50,             # 3D 曲面分辨率
        "contour_levels": 20,         # 等高线层数
        "show_gradient": true,        # 是否显示梯度
        "show_tangent_plane": true    # 是否显示切平面
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data, ['function'])
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2 + y**2')

    # 验证范围参数
    is_valid, x_range = safe_float_list(data.get('x_range', [-3, 3]), 'x_range')
    if not is_valid:
        return jsonify({'success': False, 'error': x_range}), 400

    is_valid, y_range = safe_float_list(data.get('y_range', [-3, 3]), 'y_range')
    if not is_valid:
        return jsonify({'success': False, 'error': y_range}), 400

    is_valid, point_x = safe_float(data.get('point_x', 1), 'point_x')
    if not is_valid:
        return jsonify({'success': False, 'error': point_x}), 400

    is_valid, point_y = safe_float(data.get('point_y', 1), 'point_y')
    if not is_valid:
        return jsonify({'success': False, 'error': point_y}), 400

    resolution = int(data.get('resolution', 50))
    resolution = min(max(resolution, 10), 100)

    contour_levels = int(data.get('contour_levels', 20))
    contour_levels = min(max(contour_levels, 5), 50)

    show_gradient = data.get('show_gradient', True)
    show_tangent_plane = data.get('show_tangent_plane', True)

    try:
        result = MultivariateService.compute_surface_data(
            func_str, x_range, y_range, point_x, point_y,
            resolution, contour_levels, show_gradient, show_tangent_plane
        )
        return jsonify(result)
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@multivariate_bp.route('/presets', methods=['GET'])
def get_presets():
    """
    获取预设函数模板

    返回:
    {
        "success": true,
        "presets": [
            {"name": "椭圆抛物面", "function": "x**2 + y**2", "description": "在 (0,0) 处有极小值"},
            {"name": "双曲抛物面(马鞍面)", "function": "x**2 - y**2", "description": "鞍点 (0,0)"},
            {"name": "正弦曲面", "function": "sin(x) + cos(y)", "description": "周期性起伏"},
            {"name": "马鞍面变体", "function": "x*y", "description": "沿对角线的马鞍面"},
            {"name": "圆锥面", "function": "sqrt(x**2 + y**2)", "description": "顶点朝上的圆锥"},
            {"name": "高斯曲面", "function": "exp(-(x**2 + y**2))", "description": "钟形曲面"}
        ]
    }
    """
    presets = [
        {
            "name": "椭圆抛物面",
            "function": "x**2 + y**2",
            "description": "在 (0,0) 处有极小值"
        },
        {
            "name": "双曲抛物面(马鞍面)",
            "function": "x**2 - y**2",
            "description": "鞍点 (0,0)"
        },
        {
            "name": "正弦曲面",
            "function": "sin(x) + cos(y)",
            "description": "周期性起伏"
        },
        {
            "name": "马鞍面变体",
            "function": "x*y",
            "description": "沿对角线的马鞍面"
        },
        {
            "name": "圆锥面",
            "function": "sqrt(x**2 + y**2)",
            "description": "顶点朝上的圆锥"
        },
        {
            "name": "高斯曲面",
            "function": "exp(-(x**2 + y**2))",
            "description": "钟形曲面"
        }
    ]

    return jsonify({
        'success': True,
        'presets': presets
    })
