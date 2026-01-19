from flask import Blueprint, request, jsonify
from app.services.linear_algebra_service import LinearAlgebraService


linear_algebra_bp = Blueprint('linear_algebra', __name__)


def validate_matrix_request(data: dict) -> tuple:
    """验证矩阵请求数据"""
    if not data:
        return False, 'Request body is required'

    matrix = data.get('matrix')
    if not matrix or len(matrix) != 4:
        return False, 'Matrix must have 4 elements [a, b, c, d]'

    return True, None


def safe_float(value, field_name: str) -> tuple:
    """安全地将值转换为 float"""
    try:
        return True, float(value)
    except (TypeError, ValueError):
        return False, f'{field_name} must be a number'


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
        return jsonify({'success': False, 'error': error}), 400

    a, b, c, d = data['matrix']
    show_eigenvectors = data.get('show_eigenvectors', True)
    show_determinant = data.get('show_determinant', True)

    try:
        result = LinearAlgebraService.matrix_transform(
            a, b, c, d, show_eigenvectors
        )
        return jsonify({
            'success': True,
            'data': {
                'matrix': result.matrix,
                'unit_grid': result.unit_grid,
                'transformed_grid': result.transformed_grid,
                'unit_circle': result.unit_circle,
                'determinant': result.determinant if show_determinant else None,
                'eigenvalues': result.eigenvalues,
                'eigenvectors': result.eigenvectors if show_eigenvectors else None
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f'计算错误: {str(e)}'}), 400


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
    return jsonify({
        'success': True,
        'data': {'presets': presets}
    })
