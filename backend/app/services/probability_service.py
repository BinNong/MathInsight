"""
概率论服务模块
提供大数定律、中心极限定理等可视化功能
"""
import numpy as np
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
        if seed is not None:
            np.random.seed(seed)

        # 生成伯努利试验结果 (0 或 1)
        samples = np.random.rand(n) < p
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
        if seed is not None:
            np.random.seed(seed)

        # 生成离散均匀分布样本
        samples = np.random.randint(min_val, max_val + 1, size=n).tolist()

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
