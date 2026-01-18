from flask import Blueprint, request, jsonify
from app.services.calculus_service import CalculusService
from app.utils.math_utils import generate_function_points, get_tangent_line

calculus_bp = Blueprint('calculus', __name__)


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


@calculus_bp.route('/limit/epsilon-delta', methods=['POST'])
def epsilon_delta_limit():
    """
    计算 ε-δ 极限可视化数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "x0": 2,                 # 极限点
        "L": 4,                  # 极限值
        "epsilon": 0.5,          # epsilon 值
        "domain_range": [-1, 5]  # 绘图域范围
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    # Validate numeric fields
    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400
    is_valid, L = safe_float(data.get('L', 4), 'L')
    if not is_valid:
        return jsonify({'success': False, 'error': L}), 400
    is_valid, epsilon = safe_float(data.get('epsilon', 0.5), 'epsilon')
    if not is_valid:
        return jsonify({'success': False, 'error': epsilon}), 400

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [-1, 5])

    try:
        result = CalculusService.epsilon_delta_visualization(
            func_str, x0, L, epsilon, domain_range
        )
        return jsonify({'success': True, 'data': result})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/derivative/tangent', methods=['POST'])
def derivative_tangent():
    """
    计算导数切线可视化数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "x0": 2,                 # 求导点
        "domain_range": [0, 4]   # 绘图域范围
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [0, 4])

    try:
        result = CalculusService.derivative_visualization(
            func_str, x0, domain_range
        )
        return jsonify({'success': True, 'data': result})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/derivative/secant-approximation', methods=['POST'])
def secant_approximation():
    """
    计算割线逼近切线的动画数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "x0": 2,                 # 目标点
        "h_values": [1, 0.5, 0.1, 0.01, 0.001],  # 逼近的 h 值序列
        "domain_range": [0, 4]   # 绘图域范围
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    func_str = data.get('function', 'x**2')
    h_values = data.get('h_values', [1, 0.5, 0.1, 0.01, 0.001])
    domain_range = data.get('domain_range', [0, 4])

    try:
        result = CalculusService.secant_approximation(
            func_str, x0, h_values, domain_range
        )
        return jsonify({'success': True, 'data': result})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/evaluate', methods=['POST'])
def evaluate_function():
    """
    计算函数在给定点的值
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    func_str = data.get('function', 'x**2')
    x_values = data.get('x_values', [0, 1, 2, 3])

    try:
        result = CalculusService.evaluate_function(func_str, x_values)
        return jsonify({'success': True, 'data': result})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/limit/compute', methods=['POST'])
def compute_limit():
    """
    计算极限值 L = lim(x→x0) f(x)

    请求参数:
    {
        "function": "x**2",  # 函数表达式
        "x0": 2              # 极限点
    }

    返回:
    {
        "success": True,
        "data": {"L": 4}
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    func_str = data.get('function', 'x**2')

    try:
        L = CalculusService.compute_limit(func_str, x0)
        return jsonify({'success': True, 'data': {'L': L}})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/derivative/higher', methods=['POST'])
def higher_derivatives():
    """
    计算高阶导数

    请求参数:
    {
        "function": "x**3",      # 函数表达式
        "x0": 2,                 # 求导点
        "order": 3,              # 最高阶数（默认3）
        "domain_range": [0, 4]   # 绘图域范围
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    func_str = data.get('function', 'x**3')
    order = int(data.get('order', 3))
    domain_range = data.get('domain_range', [x0 - 2, x0 + 2])

    try:
        result = CalculusService.get_higher_derivatives(
            func_str, x0, order, domain_range
        )
        return jsonify({'success': True, 'data': result})
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400


@calculus_bp.route('/derivative/linear-approximation', methods=['POST'])
def linear_approximation():
    """
    计算局部线性近似数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "x0": 2,                 # 求导点
        "domain_range": [0, 4]   # 绘图域范围
    }
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return jsonify({'success': False, 'error': error}), 400

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return jsonify({'success': False, 'error': x0}), 400

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [x0 - 2, x0 + 2])

    try:
        # 主函数曲线
        function_curve = generate_function_points(func_str, domain_range)

        # 切线数据
        slope, intercept = get_tangent_line(func_str, x0)

        # 线性近似曲线
        x_vals = function_curve['x']
        linear_y = [slope * xv + intercept for xv in x_vals]

        # 误差曲线
        error_y = []
        for i, xv in enumerate(x_vals):
            f_y = function_curve['y'][i]
            if f_y is None:
                error_y.append(None)
            else:
                error_y.append(f_y - linear_y[i])

        # 误差区域数据
        error_area_x = []
        error_area_y = []
        for i, (xv, ey) in enumerate(zip(x_vals, error_y)):
            if ey is not None:
                error_area_x.extend([xv, xv])
                error_area_y.extend([0, ey])

        from sympy import Symbol
        f_x0 = float(generate_function_points(func_str, [x0 - 0.001, x0 + 0.001])['y'][1])
        equation = f'y = {slope:.4f}(x - {x0}) + {f_x0:.4f}'

        return jsonify({
            'success': True,
            'data': {
                'function_curve': function_curve,
                'linear_approximation': {
                    'x': x_vals,
                    'y': linear_y,
                    'slope': slope,
                    'intercept': intercept,
                    'equation': equation
                },
                'error_curve': {
                    'x': x_vals,
                    'y': error_y
                },
                'point': {
                    'x': x0,
                    'y': f_x0
                },
                'domain_range': domain_range
            }
        })
    except (ValueError, sp.SympifyError) as e:
        return jsonify({'success': False, 'error': '函数表达式解析失败，请检查输入格式'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': '计算过程中发生错误，请稍后重试'}), 400
