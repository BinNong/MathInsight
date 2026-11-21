"""高阶数学实验路由：微分方程、特征值、假设检验。"""
from flask import Blueprint, request

from app.services.advanced_service import (
    direction_field,
    eigenvalue_analysis,
    hypothesis_test,
    solution_curves,
)
from app.utils.response import error_response, success_response, server_error_response
from app.utils.validation import safe_float, safe_int, validate_request_data

advanced_bp = Blueprint('advanced', __name__)


@advanced_bp.route('/ode/direction-field', methods=['POST'])
def ode_direction_field():
    """一阶微分方程 dy/dx = f(x,y) 的方向场与解曲线"""
    data = request.json
    ok, err = validate_request_data(data)
    if not ok:
        return error_response(err)

    expr = data.get('function', 'x - y')
    x_range = data.get('x_range', [-3, 3])
    y_range = data.get('y_range', [-3, 3])
    density = data.get('density', 15)
    try:
        density = int(density)
    except (TypeError, ValueError):
        return error_response('density 必须是整数')
    density = max(5, min(30, density))

    try:
        field = direction_field(expr, x_range, y_range, density)
        ics = data.get('initial_conditions', [])
        curves = solution_curves(expr, ics, x_range) if ics else {'curves': []}
        return success_response({**field, **curves, 'function': expr})
    except (ValueError, Exception) as exc:
        return server_error_response('方向场计算失败，请检查函数表达式', exc=exc)


@advanced_bp.route('/eigenvalues/analyze', methods=['POST'])
def eigenvalues_analyze():
    """2×2 矩阵特征值/特征向量分析"""
    data = request.json
    ok, err = validate_request_data(data)
    if not ok:
        return error_response(err)

    matrix = data.get('matrix')
    if not isinstance(matrix, list) or len(matrix) != 2 or \
            any(not isinstance(row, list) or len(row) != 2 for row in matrix):
        return error_response('matrix 必须是 2×2 数组')

    vector = data.get('vector')
    try:
        result = eigenvalue_analysis(matrix, vector)
        return success_response(result)
    except (ValueError, Exception) as exc:
        return server_error_response('特征值计算失败，请检查输入', exc=exc)


@advanced_bp.route('/hypothesis-test', methods=['POST'])
def hypothesis():
    """单样本 z / t 假设检验"""
    data = request.json
    ok, err = validate_request_data(data)
    if not ok:
        return error_response(err)

    fields = {}
    for key, default in [
        ('sample_mean', 0.0), ('hypothesized_mean', 0.0),
        ('std', 1.0), ('alpha', 0.05),
    ]:
        valid, value = safe_float(data.get(key, default), key)
        if not valid:
            return error_response(value)
        fields[key] = value
    valid, n = safe_int(data.get('n', 30), 'n')
    if not valid:
        return error_response(n)

    try:
        result = hypothesis_test(
            test_type=data.get('test_type', 'z'),
            tail=data.get('tail', 'two'),
            n=n,
            **fields,
        )
        return success_response(result)
    except (ValueError, Exception) as exc:
        return server_error_response('假设检验计算失败，请检查参数', exc=exc)
