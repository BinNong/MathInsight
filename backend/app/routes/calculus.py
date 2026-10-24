import sympy as sp
from flask import Blueprint, request
from app.services.calculus_service import CalculusService
from app.utils.validation import validate_request_data, safe_float
from app.utils.response import success_response, error_response, math_error_response

calculus_bp = Blueprint('calculus', __name__)


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
        return error_response(error)

    # Validate numeric fields
    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)
    is_valid, L = safe_float(data.get('L', 4), 'L')
    if not is_valid:
        return error_response(L)
    is_valid, epsilon = safe_float(data.get('epsilon', 0.5), 'epsilon')
    if not is_valid:
        return error_response(epsilon)

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [-1, 5])

    try:
        result = CalculusService.epsilon_delta_visualization(
            func_str, x0, L, epsilon, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


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
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [0, 4])

    try:
        result = CalculusService.derivative_visualization(
            func_str, x0, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


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
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'x**2')
    h_values = data.get('h_values', [1, 0.5, 0.1, 0.01, 0.001])
    domain_range = data.get('domain_range', [0, 4])

    try:
        result = CalculusService.secant_approximation(
            func_str, x0, h_values, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


@calculus_bp.route('/evaluate', methods=['POST'])
def evaluate_function():
    """
    计算函数在给定点的值
    """
    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    func_str = data.get('function', 'x**2')
    x_values = data.get('x_values', [0, 1, 2, 3])

    try:
        result = CalculusService.evaluate_function(func_str, x_values)
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


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
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'x**2')

    try:
        L = CalculusService.compute_limit(func_str, x0)
        return success_response({'L': L})
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


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
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'x**3')
    order = int(data.get('order', 3))
    domain_range = data.get('domain_range', [x0 - 2, x0 + 2])

    try:
        result = CalculusService.get_higher_derivatives(
            func_str, x0, order, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


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
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 2), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'x**2')
    domain_range = data.get('domain_range', [x0 - 2, x0 + 2])

    try:
        result = CalculusService.linear_approximation(func_str, x0, domain_range)
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


@calculus_bp.route('/taylor', methods=['POST'])
def taylor_visualization():
    """
    泰勒公式可视化数据

    请求参数:
    {
        "function": "sin(x)",      # 函数表达式
        "x0": 0,                    # 展开点
        "max_order": 5,             # 最大阶数（默认5）
        "domain_range": [-3, 3]     # 绘图域范围
    }
    """
    import sympy as sp

    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 0), 'x0')
    if not is_valid:
        return error_response(x0)

    func_str = data.get('function', 'sin(x)')
    max_order = int(data.get('max_order', 5))
    domain_range = data.get('domain_range', [x0 - 2, x0 + 2])

    # 限制最大阶数，防止计算过慢
    max_order = min(max_order, 10)

    try:
        result = CalculusService.taylor_visualization(
            func_str, x0, max_order, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


@calculus_bp.route('/taylor/evaluate', methods=['POST'])
def evaluate_taylor_at_point():
    """
    在指定点评估泰勒多项式的逼近效果

    请求参数:
    {
        "function": "sin(x)",   # 函数表达式
        "x0": 0,                 # 展开点
        "x": 1.5,                # 评估点
        "max_order": 5           # 最大阶数（默认5）
    }
    """
    import sympy as sp

    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    is_valid, x0 = safe_float(data.get('x0', 0), 'x0')
    if not is_valid:
        return error_response(x0)
    is_valid, x_eval = safe_float(data.get('x', x0 + 1), 'x')
    if not is_valid:
        return error_response(x_eval)

    func_str = data.get('function', 'sin(x)')
    max_order = int(data.get('max_order', 5))
    max_order = min(max_order, 10)

    try:
        result = CalculusService.evaluate_taylor_at_point(
            func_str, x0, x_eval, max_order
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


@calculus_bp.route('/integration/riemann-sum', methods=['POST'])
def riemann_sum():
    """
    计算黎曼和可视化数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "a": 0,                   # 积分下限
        "b": 1,                   # 积分上限
        "n": 10,                  # 分割数量
        "method": "left",         # 分割方法: left, right, midpoint, random
        "domain_range": [-0.5, 1.5]  # 绘图域范围（可选）
    }
    """
    import sympy as sp

    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    # 验证数值参数
    is_valid, a = safe_float(data.get('a', 0), 'a')
    if not is_valid:
        return error_response(a)
    is_valid, b = safe_float(data.get('b', 1), 'b')
    if not is_valid:
        return error_response(b)

    if a >= b:
        return error_response('积分下限必须小于上限')

    n = int(data.get('n', 10))
    if n <= 0 or n > 1000:
        return error_response('分割数量必须在 1-1000 之间')

    func_str = data.get('function', 'x**2')
    method = data.get('method', 'left')
    domain_range = data.get('domain_range', None)

    if method not in ['left', 'right', 'midpoint', 'random']:
        return error_response('不支持的分割方法')

    try:
        result = CalculusService.riemann_sum(
            func_str, a, b, n, method, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')


@calculus_bp.route('/integration/convergence', methods=['POST'])
def integration_convergence():
    """
    计算数值积分方法的误差收敛数据

    请求参数:
    {
        "function": "x**2",      # 函数表达式
        "a": 0,                   # 积分下限
        "b": 1,                   # 积分上限
        "n_values": [4, 8, 16, 32, 64, 128],  # 要测试的分割数列表（可选）
        "domain_range": [-0.5, 1.5]  # 绘图域范围（可选）
    }
    """
    import sympy as sp

    data = request.json
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    # 验证数值参数
    is_valid, a = safe_float(data.get('a', 0), 'a')
    if not is_valid:
        return error_response(a)
    is_valid, b = safe_float(data.get('b', 1), 'b')
    if not is_valid:
        return error_response(b)

    if a >= b:
        return error_response('积分下限必须小于上限')

    func_str = data.get('function', 'x**2')
    n_values = data.get('n_values', [4, 8, 16, 32, 64, 128, 256, 512])
    domain_range = data.get('domain_range', None)

    # 限制最大分割数
    n_values = [min(n, 1000) for n in n_values]

    try:
        result = CalculusService.numerical_integration_convergence(
            func_str, a, b, n_values, domain_range
        )
        return success_response(result)
    except (ValueError, sp.SympifyError) as e:
        return math_error_response('parse')
    except Exception as e:
        return math_error_response('calculation')
