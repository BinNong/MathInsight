"""
概率论 API 路由
"""
from flask import Blueprint, request, jsonify
from app.services.probability_service import ProbabilityService

probability_bp = Blueprint('probability', __name__, url_prefix='/api/probability')


@probability_bp.route('/lln/simulate', methods=['POST'])
def simulate_lln():
    """
    大数定律模拟

    请求体:
    {
        "experiment_type": "coin" | "dice",
        "p": 0.5,              # 硬币正面概率（仅 coin）
        "min_val": 1,          # 最小值（仅 dice）
        "max_val": 6,          # 最大值（仅 dice）
        "sample_size": 1000,   # 样本数量
        "seed": 42             # 可选随机种子
    }
    """
    try:
        data = request.get_json()

        experiment_type = data.get('experiment_type', 'coin')
        sample_size = int(data.get('sample_size', 1000))
        seed = data.get('seed')

        if experiment_type == 'coin':
            p = float(data.get('p', 0.5))
            if not 0 <= p <= 1:
                return jsonify({
                    'success': False,
                    'error': '概率 p 必须在 0 到 1 之间'
                }), 400

            result = ProbabilityService.simulate_bernoulli(p, sample_size, seed)

        elif experiment_type == 'dice':
            min_val = int(data.get('min_val', 1))
            max_val = int(data.get('max_val', 6))
            if min_val >= max_val:
                return jsonify({
                    'success': False,
                    'error': '最小值必须小于最大值'
                }), 400

            result = ProbabilityService.simulate_discrete_uniform(
                min_val, max_val, sample_size, seed
            )

        else:
            return jsonify({
                'success': False,
                'error': f'不支持的实验类型: {experiment_type}'
            }), 400

        return jsonify({
            'success': True,
            'data': {
                'experiment_type': result.experiment_type,
                'expected_value': result.expected_value,
                'total_samples': result.total_samples,
                'cumulative_means': result.cumulative_means,
                'samples': result.samples,
                'final_mean': result.final_mean
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'计算错误: {str(e)}'
        }), 500


@probability_bp.route('/lln/presets', methods=['GET'])
def get_presets():
    """获取预设实验配置"""
    try:
        presets = ProbabilityService.get_presets()
        return jsonify({
            'success': True,
            'data': presets
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取预设失败: {str(e)}'
        }), 500
