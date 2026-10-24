"""
概率论 API 路由
"""
from flask import Blueprint, request
from app.services.probability_service import ProbabilityService
from app.utils.response import success_response, error_response, server_error_response
from app.utils.validation import validate_request_data, safe_int, safe_float

probability_bp = Blueprint('probability', __name__, url_prefix='/api/probability')


SUPPORTED_DISTRIBUTIONS = {'bernoulli', 'uniform_discrete', 'uniform_continuous',
                           'exponential', 'normal', 'poisson', 'binomial'}


def _validate_distribution_params(distribution: str, params: dict) -> tuple[bool, str | None]:
    """校验分布参数合法性"""
    if params is None:
        params = {}
    try:
        if distribution == 'bernoulli':
            p = float(params.get('p', 0.5))
            if not 0 <= p <= 1:
                return False, '伯努利分布参数 p 必须在 0 到 1 之间'

        elif distribution == 'binomial':
            n = float(params.get('n', 10))
            p = float(params.get('p', 0.5))
            if n < 1 or not n.is_integer():
                return False, '二项分布参数 n 必须是正整数'
            if not 0 <= p <= 1:
                return False, '二项分布参数 p 必须在 0 到 1 之间'

        elif distribution == 'poisson':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                return False, '泊松分布参数 λ 必须大于 0'

        elif distribution == 'uniform_discrete':
            min_val = float(params.get('min_val', 1))
            max_val = float(params.get('max_val', 6))
            if not min_val.is_integer() or not max_val.is_integer():
                return False, '离散均匀分布参数必须是整数'
            if min_val >= max_val:
                return False, '离散均匀分布最小值必须小于最大值'

        elif distribution == 'uniform_continuous':
            a = float(params.get('a', 0.0))
            b = float(params.get('b', 1.0))
            if a >= b:
                return False, '连续均匀分布下限必须小于上限'

        elif distribution == 'exponential':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                return False, '指数分布参数 λ 必须大于 0'

        elif distribution == 'normal':
            mu = float(params.get('mu', 0.0))
            sigma = float(params.get('sigma', 1.0))
            if sigma <= 0:
                return False, '正态分布标准差 σ 必须大于 0'

        else:
            return False, f'不支持的分布类型: {distribution}'

    except (TypeError, ValueError):
        return False, '分布参数类型错误，应为数字'

    return True, None


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
                return error_response('概率 p 必须在 0 到 1 之间')

            result = ProbabilityService.simulate_bernoulli(p, sample_size, seed)

        elif experiment_type == 'dice':
            min_val = int(data.get('min_val', 1))
            max_val = int(data.get('max_val', 6))
            if min_val >= max_val:
                return error_response('最小值必须小于最大值')

            result = ProbabilityService.simulate_discrete_uniform(
                min_val, max_val, sample_size, seed
            )

        else:
            return error_response(f'不支持的实验类型: {experiment_type}')

        return success_response({
            'experiment_type': result.experiment_type,
            'expected_value': result.expected_value,
            'total_samples': result.total_samples,
            'cumulative_means': result.cumulative_means,
            'samples': result.samples,
            'final_mean': result.final_mean
        })

    except Exception as e:
        return server_error_response('大数定律模拟失败，请检查输入参数', exc=e)


@probability_bp.route('/lln/presets', methods=['GET'])
def get_presets():
    """获取预设实验配置"""
    try:
        presets = ProbabilityService.get_presets()
        return success_response(presets)
    except Exception as e:
        return server_error_response('获取预设失败', exc=e)


@probability_bp.route('/clt/simulate', methods=['POST'])
def simulate_clt():
    """
    中心极限定理模拟

    请求体:
    {
        "distribution": "bernoulli",
        "params": {"p": 0.5},
        "sample_size": 30,
        "num_samples": 1000,
        "seed": 42
    }
    """
    data = request.get_json()
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    distribution = data.get('distribution', 'bernoulli')
    params = data.get('params', {}) or {}
    sample_size = int(data.get('sample_size', 30))
    num_samples = int(data.get('num_samples', 1000))
    seed = data.get('seed')

    if sample_size <= 0 or sample_size > 10000:
        return error_response('sample_size 必须在 1-10000 之间')
    if num_samples <= 0 or num_samples > 50000:
        return error_response('num_samples 必须在 1-50000 之间')

    if distribution not in SUPPORTED_DISTRIBUTIONS:
        return error_response(f'不支持的分布类型: {distribution}')

    params_valid, params_error = _validate_distribution_params(distribution, params)
    if not params_valid:
        return error_response(params_error)

    try:
        result = ProbabilityService.simulate_clt(
            distribution, params, sample_size, num_samples, seed
        )
        return success_response(result)
    except Exception as e:
        return server_error_response('中心极限定理模拟失败，请检查输入参数', exc=e)


@probability_bp.route('/distribution/simulate', methods=['POST'])
def simulate_distribution():
    """
    通用概率分布模拟

    请求体:
    {
        "distribution": "normal",
        "params": {"mu": 0, "sigma": 1},
        "sample_size": 1000,
        "seed": 42
    }
    """
    data = request.get_json()
    is_valid, error = validate_request_data(data)
    if not is_valid:
        return error_response(error)

    distribution = data.get('distribution', 'normal')
    params = data.get('params', {}) or {}
    sample_size = int(data.get('sample_size', 1000))
    seed = data.get('seed')

    if sample_size <= 0 or sample_size > 50000:
        return error_response('sample_size 必须在 1-50000 之间')

    if distribution not in SUPPORTED_DISTRIBUTIONS:
        return error_response(f'不支持的分布类型: {distribution}')

    params_valid, params_error = _validate_distribution_params(distribution, params)
    if not params_valid:
        return error_response(params_error)

    try:
        result = ProbabilityService.simulate_distribution(
            distribution, params, sample_size, seed
        )
        return success_response(result)
    except Exception as e:
        return server_error_response('概率分布模拟失败，请检查输入参数', exc=e)


@probability_bp.route('/distribution/presets', methods=['GET'])
def get_distribution_presets():
    """获取概率分布预设"""
    try:
        presets = ProbabilityService.get_distribution_presets()
        return success_response(presets)
    except Exception as e:
        return server_error_response('获取预设失败', exc=e)
