from flask import Blueprint, request
from app.services.linear_algebra_service import LinearAlgebraService
from app.utils.validation import validate_request_data
from app.utils.response import success_response, error_response, server_error_response


linear_algebra_bp = Blueprint('linear_algebra', __name__)


def validate_matrix_request(data: dict) -> tuple:
    """验证矩阵请求数据"""
    if not data:
        return False, 'Request body is required'

    matrix = data.get('matrix')
    if not matrix or len(matrix) != 4:
        return False, 'Matrix must have 4 elements [a, b, c, d]'

    return True, None


@linear_algebra_bp.route('/matrix-transform', methods=['POST'])
def matrix_transform():
    """
    计算 2×2 矩阵变换可视化数据

    请求参数:
    {
        "matrix": [1, 0, 0, 1],              // 2×2 矩阵元素 [a, b, c, d]
        "show_eigenvectors": true,           // 是否显示特征向量
        "show_determinant": true             // 是否显示行列式信息
    }
    """
    data = request.json
    is_valid, error = validate_matrix_request(data)
    if not is_valid:
        return error_response(error)

    a, b, c, d = data['matrix']
    show_eigenvectors = data.get('show_eigenvectors', True)
    show_determinant = data.get('show_determinant', True)

    try:
        result = LinearAlgebraService.matrix_transform(
            a, b, c, d, show_eigenvectors
        )
        return success_response({
            'matrix': result.matrix,
            'unit_grid': result.unit_grid,
            'transformed_grid': result.transformed_grid,
            'unit_circle': result.unit_circle,
            'determinant': result.determinant if show_determinant else None,
            'eigenvalues': result.eigenvalues,
            'eigenvectors': result.eigenvectors if show_eigenvectors else None
        })
    except Exception as e:
        return server_error_response('矩阵变换计算失败，请检查输入参数', exc=e)


@linear_algebra_bp.route('/matrix-presets', methods=['GET'])
def matrix_presets():
    """
    获取预设矩阵列表

    返回:
    {
        "success": true,
        "data": {
            "presets": {
                "identity": {"a": 1, "b": 0, "c": 0, "d": 1},
                "scale_2": {"a": 2, "b": 0, "c": 0, "d": 2},
                ...
            }
        }
    }
    """
    presets = LinearAlgebraService.get_presets()
    return success_response({'presets': presets})
