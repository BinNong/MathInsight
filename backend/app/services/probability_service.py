"""
概率论服务模块
提供大数定律、中心极限定理等可视化功能
"""
import numpy as np
from scipy import stats
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class LLNResult:
    """大数定律模拟结果"""
    experiment_type: str
    expected_value: float
    total_samples: int
    cumulative_means: List[float]
    samples: List[int]
    final_mean: float


class ProbabilityService:
    """概率论服务类"""

    @staticmethod
    def simulate_bernoulli(
        p: float,
        n: int,
        seed: Optional[int] = None
    ) -> LLNResult:
        """
        伯努利试验模拟（大数定律）

        Args:
            p: 成功概率
            n: 样本数量
            seed: 随机种子（用于可重复性）

        Returns:
            LLNResult: 模拟结果
        """
        rng = np.random.default_rng(seed)

        # 生成伯努利试验结果 (0 或 1)
        samples = rng.random(n) < p
        samples = samples.astype(int).tolist()

        # 计算累积均值
        cumulative_means = []
        total = 0
        for i, s in enumerate(samples, 1):
            total += s
            cumulative_means.append(total / i)

        return LLNResult(
            experiment_type='coin',
            expected_value=p,
            total_samples=n,
            cumulative_means=cumulative_means,
            samples=samples,
            final_mean=cumulative_means[-1]
        )

    @staticmethod
    def simulate_discrete_uniform(
        min_val: int,
        max_val: int,
        n: int,
        seed: Optional[int] = None
    ) -> LLNResult:
        """
        离散均匀分布模拟（如掷骰子）

        Args:
            min_val: 最小值（如 1）
            max_val: 最大值（如 6）
            n: 样本数量
            seed: 随机种子

        Returns:
            LLNResult: 模拟结果
        """
        rng = np.random.default_rng(seed)

        # 生成离散均匀分布样本
        samples = rng.integers(min_val, max_val + 1, size=n).tolist()

        # 计算累积均值
        cumulative_means = []
        total = 0
        for i, s in enumerate(samples, 1):
            total += s
            cumulative_means.append(total / i)

        # 计算理论期望值
        expected_value = (min_val + max_val) / 2

        return LLNResult(
            experiment_type='dice',
            expected_value=expected_value,
            total_samples=n,
            cumulative_means=cumulative_means,
            samples=samples,
            final_mean=cumulative_means[-1]
        )

    @staticmethod
    def get_presets() -> Dict[str, Dict[str, Any]]:
        """获取预设实验配置"""
        return {
            'coin_fair': {
                'type': 'coin',
                'name': '公平硬币',
                'params': {'p': 0.5}
            },
            'coin_biased': {
                'type': 'coin',
                'name': '偏心硬币',
                'params': {'p': 0.7}
            },
            'dice_standard': {
                'type': 'dice',
                'name': '标准骰子',
                'params': {'min_val': 1, 'max_val': 6}
            },
            'dice_custom': {
                'type': 'dice',
                'name': '自定义骰子',
                'params': {'min_val': 1, 'max_val': 4}
            }
        }

    @staticmethod
    def simulate_clt(
        distribution: str,
        params: Dict[str, Any],
        sample_size: int,
        num_samples: int,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        中心极限定理模拟

        从指定分布中重复抽取容量为 sample_size 的样本，计算每个样本的均值，
        观察样本均值的分布如何随 sample_size 增大而趋近正态分布。

        Args:
            distribution: 基础分布类型 ('bernoulli', 'uniform_discrete',
                          'uniform_continuous', 'exponential', 'normal',
                          'poisson', 'binomial')
            params: 分布参数字典
            sample_size: 每个样本的容量
            num_samples: 重复抽样次数
            seed: 随机种子

        Returns:
            dict: 包含样本均值序列、直方图、理论正态拟合等数据
        """
        rng = np.random.default_rng(seed)

        sample_size = max(1, int(sample_size))
        num_samples = max(1, int(num_samples))

        # 限制规模，防止前端传输数据过大
        num_samples = min(num_samples, 50000)
        sample_size = min(sample_size, 10000)

        # 生成原始样本矩阵 (num_samples, sample_size)
        samples = ProbabilityService._generate_samples(distribution, params, num_samples, sample_size, rng)

        # 计算每个样本的均值
        sample_means = np.mean(samples, axis=1)

        # 计算基础分布的理论期望与方差
        theoretical = ProbabilityService._theoretical_mean_variance(distribution, params)
        mu = theoretical['mean']
        sigma2 = theoretical['variance']

        # 样本均值分布的理论参数（CLT）
        clt_mean = mu
        clt_std = np.sqrt(sigma2 / sample_size) if sample_size > 0 and sigma2 >= 0 else 0.0

        # 直方图数据
        hist_counts, bin_edges = np.histogram(sample_means, bins=30, density=True)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

        # 正态拟合曲线
        if clt_std > 0:
            x_min, x_max = float(np.min(sample_means)), float(np.max(sample_means))
            x_range = np.linspace(x_min - 3 * clt_std, x_max + 3 * clt_std, 200)
            normal_curve = (1 / (clt_std * np.sqrt(2 * np.pi))) * \
                           np.exp(-0.5 * ((x_range - clt_mean) / clt_std) ** 2)
        else:
            x_range = np.array([clt_mean])
            normal_curve = np.array([1.0])

        # 单个典型样本的分布（用于展示原始分布）
        single_sample = samples[0] if num_samples > 0 else np.array([])
        single_hist_counts, single_bin_edges = np.histogram(
            single_sample, bins=30, density=True
        )
        single_bin_centers = (single_bin_edges[:-1] + single_bin_edges[1:]) / 2

        return {
            'distribution': distribution,
            'params': params,
            'sample_size': sample_size,
            'num_samples': num_samples,
            'sample_means': sample_means.tolist(),
            'histogram': {
                'x': bin_centers.tolist(),
                'y': hist_counts.tolist()
            },
            'normal_curve': {
                'x': x_range.tolist(),
                'y': normal_curve.tolist(),
                'mean': clt_mean,
                'std': clt_std
            },
            'single_sample': {
                'x': single_bin_centers.tolist(),
                'y': single_hist_counts.tolist()
            },
            'theoretical': theoretical,
            'sample_mean_of_means': float(np.mean(sample_means)),
            'sample_std_of_means': float(np.std(sample_means, ddof=1))
        }

    @staticmethod
    def _generate_samples(distribution: str, params: Dict[str, Any],
                          num_samples: int, sample_size: int,
                          rng: np.random.Generator) -> np.ndarray:
        """根据分布类型生成样本矩阵"""
        if distribution == 'bernoulli':
            p = float(params.get('p', 0.5))
            return rng.binomial(1, p, size=(num_samples, sample_size)).astype(float)

        elif distribution == 'uniform_discrete':
            min_val = int(params.get('min_val', 1))
            max_val = int(params.get('max_val', 6))
            return rng.integers(min_val, max_val + 1, size=(num_samples, sample_size)).astype(float)

        elif distribution == 'uniform_continuous':
            a = float(params.get('a', 0.0))
            b = float(params.get('b', 1.0))
            return rng.uniform(a, b, size=(num_samples, sample_size))

        elif distribution == 'exponential':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return rng.exponential(1.0 / lam, size=(num_samples, sample_size))

        elif distribution == 'normal':
            mu = float(params.get('mu', 0.0))
            sigma = float(params.get('sigma', 1.0))
            if sigma <= 0:
                sigma = 1.0
            return rng.normal(mu, sigma, size=(num_samples, sample_size))

        elif distribution == 'poisson':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return rng.poisson(lam, size=(num_samples, sample_size)).astype(float)

        elif distribution == 'binomial':
            n = int(params.get('n', 10))
            p = float(params.get('p', 0.5))
            return rng.binomial(n, p, size=(num_samples, sample_size)).astype(float)

        else:
            raise ValueError(f'不支持的分布类型: {distribution}')

    @staticmethod
    def _theoretical_mean_variance(distribution: str, params: Dict[str, Any]) -> Dict[str, float]:
        """计算指定分布的理论期望与方差"""
        if distribution == 'bernoulli':
            p = float(params.get('p', 0.5))
            return {'mean': p, 'variance': p * (1 - p)}

        elif distribution == 'uniform_discrete':
            min_val = int(params.get('min_val', 1))
            max_val = int(params.get('max_val', 6))
            mean = (min_val + max_val) / 2.0
            variance = ((max_val - min_val + 1) ** 2 - 1) / 12.0
            return {'mean': mean, 'variance': variance}

        elif distribution == 'uniform_continuous':
            a = float(params.get('a', 0.0))
            b = float(params.get('b', 1.0))
            mean = (a + b) / 2.0
            variance = (b - a) ** 2 / 12.0
            return {'mean': mean, 'variance': variance}

        elif distribution == 'exponential':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return {'mean': 1.0 / lam, 'variance': 1.0 / (lam ** 2)}

        elif distribution == 'normal':
            mu = float(params.get('mu', 0.0))
            sigma = float(params.get('sigma', 1.0))
            return {'mean': mu, 'variance': sigma ** 2}

        elif distribution == 'poisson':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return {'mean': lam, 'variance': lam}

        elif distribution == 'binomial':
            n = int(params.get('n', 10))
            p = float(params.get('p', 0.5))
            return {'mean': n * p, 'variance': n * p * (1 - p)}

        else:
            raise ValueError(f'不支持的分布类型: {distribution}')

    @staticmethod
    def simulate_distribution(
        distribution: str,
        params: Dict[str, Any],
        sample_size: int,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        通用概率分布模拟

        Args:
            distribution: 分布类型
            params: 分布参数
            sample_size: 样本容量
            seed: 随机种子

        Returns:
            dict: 样本数据、直方图、理论概率密度/质量、统计量
        """
        rng = np.random.default_rng(seed)

        sample_size = max(1, min(int(sample_size), 50000))

        samples = ProbabilityService._generate_samples(
            distribution, params, 1, sample_size, rng
        ).flatten()

        theoretical = ProbabilityService._theoretical_mean_variance(distribution, params)

        # 直方图
        if distribution in ('bernoulli', 'uniform_discrete', 'poisson', 'binomial'):
            # 离散分布：按整数 bin 统计
            min_val = int(np.min(samples))
            max_val = int(np.max(samples))
            bins = max(1, max_val - min_val + 1)
            if distribution == 'bernoulli':
                bins = 2
            hist_counts, bin_edges = np.histogram(
                samples, bins=bins, range=(min_val - 0.5, max_val + 0.5), density=True
            )
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        else:
            hist_counts, bin_edges = np.histogram(samples, bins=40, density=True)
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

        # 理论曲线
        theoretical_curve = ProbabilityService._theoretical_pmf_pdf(
            distribution, params, bin_centers
        )

        return {
            'distribution': distribution,
            'params': params,
            'sample_size': sample_size,
            'samples': samples.tolist(),
            'histogram': {
                'x': bin_centers.tolist(),
                'y': hist_counts.tolist()
            },
            'theoretical_curve': {
                'x': bin_centers.tolist(),
                'y': theoretical_curve
            },
            'theoretical': theoretical,
            'statistics': {
                'mean': float(np.mean(samples)),
                'variance': float(np.var(samples, ddof=1)),
                'median': float(np.median(samples)),
                'min': float(np.min(samples)),
                'max': float(np.max(samples))
            }
        }

    @staticmethod
    def _theoretical_pmf_pdf(distribution: str, params: Dict[str, Any],
                             points: np.ndarray) -> List[float]:
        """计算理论 PMF/PDF 在指定点的值"""
        x = np.asarray(points)

        if distribution == 'bernoulli':
            p = float(params.get('p', 0.5))
            return stats.bernoulli.pmf(np.round(x).astype(int), p).tolist()

        elif distribution == 'uniform_discrete':
            min_val = int(params.get('min_val', 1))
            max_val = int(params.get('max_val', 6))
            return stats.randint.pmf(np.round(x).astype(int), min_val, max_val + 1).tolist()

        elif distribution == 'uniform_continuous':
            a = float(params.get('a', 0.0))
            b = float(params.get('b', 1.0))
            return stats.uniform.pdf(x, loc=a, scale=b - a).tolist()

        elif distribution == 'exponential':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return stats.expon.pdf(x, scale=1.0 / lam).tolist()

        elif distribution == 'normal':
            mu = float(params.get('mu', 0.0))
            sigma = float(params.get('sigma', 1.0))
            if sigma <= 0:
                sigma = 1.0
            return stats.norm.pdf(x, loc=mu, scale=sigma).tolist()

        elif distribution == 'poisson':
            lam = float(params.get('lam', 1.0))
            if lam <= 0:
                lam = 1.0
            return stats.poisson.pmf(np.round(x).astype(int), lam).tolist()

        elif distribution == 'binomial':
            n = int(params.get('n', 10))
            p = float(params.get('p', 0.5))
            return stats.binom.pmf(np.round(x).astype(int), n, p).tolist()

        return [0.0] * len(x)

    @staticmethod
    def get_distribution_presets() -> Dict[str, Any]:
        """获取分布预设配置"""
        return {
            'distributions': [
                {
                    'id': 'bernoulli',
                    'name': '伯努利分布',
                    'type': 'discrete',
                    'params': {
                        'p': {'label': '成功概率 p', 'default': 0.5, 'min': 0, 'max': 1, 'step': 0.05}
                    },
                    'description': '只有两种结果的离散分布，如抛硬币。'
                },
                {
                    'id': 'binomial',
                    'name': '二项分布',
                    'type': 'discrete',
                    'params': {
                        'n': {'label': '试验次数 n', 'default': 20, 'min': 1, 'max': 100, 'step': 1},
                        'p': {'label': '成功概率 p', 'default': 0.5, 'min': 0, 'max': 1, 'step': 0.05}
                    },
                    'description': 'n 次独立伯努利试验中成功次数的分布。'
                },
                {
                    'id': 'poisson',
                    'name': '泊松分布',
                    'type': 'discrete',
                    'params': {
                        'lam': {'label': '平均发生率 λ', 'default': 3.0, 'min': 0.1, 'max': 20, 'step': 0.1}
                    },
                    'description': '单位时间或空间内随机事件发生次数的分布。'
                },
                {
                    'id': 'uniform_discrete',
                    'name': '离散均匀分布',
                    'type': 'discrete',
                    'params': {
                        'min_val': {'label': '最小值', 'default': 1, 'min': -50, 'max': 50, 'step': 1},
                        'max_val': {'label': '最大值', 'default': 6, 'min': -50, 'max': 50, 'step': 1}
                    },
                    'description': '每个整数结果出现概率相等的离散分布，如掷骰子。'
                },
                {
                    'id': 'uniform_continuous',
                    'name': '连续均匀分布',
                    'type': 'continuous',
                    'params': {
                        'a': {'label': '下限 a', 'default': 0.0, 'min': -50, 'max': 50, 'step': 0.1},
                        'b': {'label': '上限 b', 'default': 1.0, 'min': -50, 'max': 50, 'step': 0.1}
                    },
                    'description': '区间内每个点概率密度相等的连续分布。'
                },
                {
                    'id': 'exponential',
                    'name': '指数分布',
                    'type': 'continuous',
                    'params': {
                        'lam': {'label': '发生率 λ', 'default': 1.0, 'min': 0.1, 'max': 10, 'step': 0.1}
                    },
                    'description': '描述独立随机事件发生的时间间隔。'
                },
                {
                    'id': 'normal',
                    'name': '正态分布',
                    'type': 'continuous',
                    'params': {
                        'mu': {'label': '均值 μ', 'default': 0.0, 'min': -10, 'max': 10, 'step': 0.1},
                        'sigma': {'label': '标准差 σ', 'default': 1.0, 'min': 0.1, 'max': 10, 'step': 0.1}
                    },
                    'description': '自然界最常见的连续分布，钟形曲线。'
                }
            ]
        }
