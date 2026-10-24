import pytest

from app.services.probability_service import ProbabilityService


class TestProbabilityServiceBernoulli:
    def test_bernoulli_reproducible_with_seed(self):
        result1 = ProbabilityService.simulate_bernoulli(p=0.5, n=100, seed=42)
        result2 = ProbabilityService.simulate_bernoulli(p=0.5, n=100, seed=42)
        assert result1.samples == result2.samples
        assert result1.cumulative_means == result2.cumulative_means

    def test_bernoulli_converges_to_expected_value(self):
        result = ProbabilityService.simulate_bernoulli(p=0.5, n=10000, seed=42)
        assert result.expected_value == 0.5
        assert abs(result.final_mean - 0.5) < 0.05
        assert result.total_samples == 10000
        assert result.experiment_type == 'coin'

    def test_bernoulli_samples_are_binary(self):
        result = ProbabilityService.simulate_bernoulli(p=0.3, n=1000, seed=42)
        assert all(s in (0, 1) for s in result.samples)

    def test_bernoulli_cumulative_means_length(self):
        result = ProbabilityService.simulate_bernoulli(p=0.5, n=100, seed=42)
        assert len(result.cumulative_means) == 100
        assert len(result.samples) == 100


class TestProbabilityServiceDiscreteUniform:
    def test_discrete_uniform_reproducible_with_seed(self):
        result1 = ProbabilityService.simulate_discrete_uniform(
            min_val=1, max_val=6, n=100, seed=42
        )
        result2 = ProbabilityService.simulate_discrete_uniform(
            min_val=1, max_val=6, n=100, seed=42
        )
        assert result1.samples == result2.samples

    def test_discrete_uniform_expected_value(self):
        result = ProbabilityService.simulate_discrete_uniform(
            min_val=1, max_val=6, n=10000, seed=42
        )
        assert result.expected_value == 3.5
        assert abs(result.final_mean - 3.5) < 0.1

    def test_discrete_uniform_samples_in_range(self):
        result = ProbabilityService.simulate_discrete_uniform(
            min_val=1, max_val=6, n=1000, seed=42
        )
        assert all(1 <= s <= 6 for s in result.samples)
        assert all(isinstance(s, int) for s in result.samples)


class TestProbabilityServicePresets:
    def test_presets_structure(self):
        presets = ProbabilityService.get_presets()
        assert 'coin_fair' in presets
        assert 'coin_biased' in presets
        assert 'dice_standard' in presets
        assert 'dice_custom' in presets

        coin_fair = presets['coin_fair']
        assert coin_fair['type'] == 'coin'
        assert coin_fair['params']['p'] == 0.5

        dice_standard = presets['dice_standard']
        assert dice_standard['type'] == 'dice'
        assert dice_standard['params']['min_val'] == 1
        assert dice_standard['params']['max_val'] == 6


class TestCentralLimitTheorem:
    def test_clt_reproducible_with_seed(self):
        result1 = ProbabilityService.simulate_clt(
            'bernoulli', {'p': 0.5}, sample_size=30, num_samples=1000, seed=42
        )
        result2 = ProbabilityService.simulate_clt(
            'bernoulli', {'p': 0.5}, sample_size=30, num_samples=1000, seed=42
        )
        assert result1['sample_means'] == result2['sample_means']

    def test_clt_sample_means_length(self):
        result = ProbabilityService.simulate_clt(
            'uniform_continuous', {'a': 0, 'b': 1},
            sample_size=50, num_samples=2000, seed=42
        )
        assert len(result['sample_means']) == 2000
        assert len(result['histogram']['x']) == len(result['histogram']['y'])
        assert len(result['normal_curve']['x']) == len(result['normal_curve']['y'])

    def test_clt_mean_converges_to_theoretical(self):
        result = ProbabilityService.simulate_clt(
            'normal', {'mu': 5, 'sigma': 2},
            sample_size=100, num_samples=5000, seed=42
        )
        sample_mean = result['sample_mean_of_means']
        assert abs(sample_mean - 5) < 0.1

    def test_clt_normal_approximation_quality(self):
        # 大样本下，样本均值分布应接近正态
        result = ProbabilityService.simulate_clt(
            'exponential', {'lam': 1.0},
            sample_size=50, num_samples=10000, seed=42
        )
        std_of_means = result['sample_std_of_means']
        expected_std = result['normal_curve']['std']
        assert abs(std_of_means - expected_std) / (expected_std + 1e-6) < 0.15


class TestBinomialDistribution:
    def test_binomial_samples_in_range(self):
        result = ProbabilityService.simulate_distribution(
            'binomial', {'n': 20, 'p': 0.5}, sample_size=1000, seed=42
        )
        samples = result['samples']
        assert all(0 <= s <= 20 for s in samples)
        assert all(isinstance(s, (int, float)) for s in samples)

    def test_binomial_statistics(self):
        result = ProbabilityService.simulate_distribution(
            'binomial', {'n': 30, 'p': 0.4}, sample_size=20000, seed=42
        )
        stats = result['statistics']
        assert abs(stats['mean'] - 12) < 0.2
        assert abs(stats['variance'] - 7.2) < 0.5


class TestPoissonDistribution:
    def test_poisson_samples_nonnegative_integers(self):
        result = ProbabilityService.simulate_distribution(
            'poisson', {'lam': 3.0}, sample_size=1000, seed=42
        )
        samples = result['samples']
        assert all(s >= 0 for s in samples)
        assert all(abs(s - round(s)) < 1e-9 for s in samples)

    def test_poisson_statistics(self):
        result = ProbabilityService.simulate_distribution(
            'poisson', {'lam': 4.0}, sample_size=20000, seed=42
        )
        assert abs(result['statistics']['mean'] - 4.0) < 0.1
        assert abs(result['statistics']['variance'] - 4.0) < 0.3


class TestNormalDistribution:
    def test_normal_statistics(self):
        result = ProbabilityService.simulate_distribution(
            'normal', {'mu': 2.0, 'sigma': 3.0}, sample_size=20000, seed=42
        )
        stats = result['statistics']
        assert abs(stats['mean'] - 2.0) < 0.1
        assert abs(stats['variance'] - 9.0) < 0.3

    def test_normal_histogram_matches_pdf(self):
        result = ProbabilityService.simulate_distribution(
            'normal', {'mu': 0.0, 'sigma': 1.0}, sample_size=50000, seed=42
        )
        hist = result['histogram']
        pdf = result['theoretical_curve']
        # 峰值应接近 x=0
        max_idx = hist['y'].index(max(hist['y']))
        assert abs(hist['x'][max_idx]) < 0.3
        assert len(pdf['y']) == len(hist['x'])


class TestExponentialDistribution:
    def test_exponential_samples_nonnegative(self):
        result = ProbabilityService.simulate_distribution(
            'exponential', {'lam': 1.0}, sample_size=1000, seed=42
        )
        assert all(s >= 0 for s in result['samples'])

    def test_exponential_statistics(self):
        result = ProbabilityService.simulate_distribution(
            'exponential', {'lam': 2.0}, sample_size=20000, seed=42
        )
        assert abs(result['statistics']['mean'] - 0.5) < 0.02


class TestUniformContinuousDistribution:
    def test_uniform_samples_in_range(self):
        result = ProbabilityService.simulate_distribution(
            'uniform_continuous', {'a': -2.0, 'b': 3.0}, sample_size=1000, seed=42
        )
        samples = result['samples']
        assert all(-2.0 <= s <= 3.0 for s in samples)

    def test_uniform_statistics(self):
        result = ProbabilityService.simulate_distribution(
            'uniform_continuous', {'a': 1.0, 'b': 5.0}, sample_size=20000, seed=42
        )
        assert abs(result['statistics']['mean'] - 3.0) < 0.05


class TestDistributionPresets:
    def test_distribution_presets_structure(self):
        presets = ProbabilityService.get_distribution_presets()
        assert 'distributions' in presets
        ids = [d['id'] for d in presets['distributions']]
        assert 'normal' in ids
        assert 'binomial' in ids
        assert 'poisson' in ids

    def test_distribution_presets_have_params(self):
        presets = ProbabilityService.get_distribution_presets()
        for dist in presets['distributions']:
            assert 'id' in dist
            assert 'name' in dist
            assert 'type' in dist
            assert 'params' in dist
            assert 'description' in dist
            for key, param in dist['params'].items():
                assert 'label' in param
                assert 'default' in param
