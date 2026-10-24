import math

import pytest

from app.services.calculus_service import CalculusService


class TestCalculusServiceEpsilonDelta:
    def test_epsilon_delta_normal_case(self):
        result = CalculusService.epsilon_delta_visualization(
            func_str='x**2',
            x0=2,
            L=4,
            epsilon=0.5,
            domain_range=[0, 4]
        )
        assert 'function_curve' in result
        assert 'epsilon_band' in result
        assert 'delta_band' in result
        assert result['delta_values']['delta'] > 0
        assert result['verification']['valid'] is True
        assert result['verification']['satisfied'] > 0

    def test_epsilon_delta_discontinuous_function(self):
        # 1/x 在 x=0 处无定义，应能安全处理
        result = CalculusService.epsilon_delta_visualization(
            func_str='1/x',
            x0=0,
            L=0,
            epsilon=0.5,
            domain_range=[-2, 2]
        )
        assert 'function_curve' in result
        assert result['limit_point']['defined'] is False
        assert result['definition_state']['x0_defined'] is False


class TestCalculusServiceDerivative:
    def test_derivative_visualization_x_squared(self):
        result = CalculusService.derivative_visualization(
            func_str='x**2',
            x0=2,
            domain_range=[0, 4]
        )
        assert abs(result['derivative']['value'] - 4.0) < 1e-10
        assert abs(result['point']['y'] - 4.0) < 1e-10
        assert result['tangent_line']['slope'] == result['derivative']['value']

    def test_derivative_visualization_sin(self):
        result = CalculusService.derivative_visualization(
            func_str='sin(x)',
            x0=0,
            domain_range=[-math.pi, math.pi]
        )
        assert abs(result['derivative']['value'] - 1.0) < 1e-10
        assert abs(result['point']['y']) < 1e-10

    def test_compute_limit(self):
        assert abs(CalculusService.compute_limit('x**2', 2) - 4.0) < 1e-10
        assert abs(CalculusService.compute_limit('sin(x)/x', 0) - 1.0) < 1e-10

    def test_evaluate_function(self):
        result = CalculusService.evaluate_function('x**2', [0, 1, 2, 3])
        assert result['x'] == [0, 1, 2, 3]
        assert result['y'] == [0, 1, 4, 9]


class TestCalculusServiceHigherDerivatives:
    def test_higher_derivatives_x_cubed(self):
        result = CalculusService.get_higher_derivatives(
            func_str='x**3',
            x0=1,
            order=3,
            domain_range=[0, 2]
        )
        assert 'curves' in result
        curves = result['curves']
        assert len(curves) == 4  # f, f', f'', f'''
        assert abs(curves[0]['value_at_x0'] - 1.0) < 1e-10   # f(1) = 1
        assert abs(curves[1]['value_at_x0'] - 3.0) < 1e-10   # f'(1) = 3
        assert abs(curves[2]['value_at_x0'] - 6.0) < 1e-10   # f''(1) = 6
        assert abs(curves[3]['value_at_x0'] - 6.0) < 1e-10   # f'''(1) = 6


class TestCalculusServiceLinearApproximation:
    def test_linear_approximation(self):
        result = CalculusService.linear_approximation(
            func_str='x**2',
            x0=1,
            domain_range=[0, 2]
        )
        assert 'function_curve' in result
        assert 'linear_approximation' in result
        assert 'error_estimate' in result
        # 在 x0=1 附近，线性近似值应接近函数值
        approx_at_x0 = min(
            ((x, y) for x, y in zip(result['linear_approximation']['x'],
                                    result['linear_approximation']['y'])),
            key=lambda xy: abs(xy[0] - 1.0)
        )
        assert abs(approx_at_x0[0] - 1.0) < 0.05
        assert abs(approx_at_x0[1] - 1.0) < 0.05


class TestCalculusServiceTaylor:
    def test_taylor_visualization(self):
        result = CalculusService.taylor_visualization(
            func_str='exp(x)',
            x0=0,
            max_order=3,
            domain_range=[-1, 1]
        )
        assert 'original_curve' in result
        assert 'taylor_polynomials' in result
        assert len(result['taylor_polynomials']) == 4

    def test_evaluate_taylor_at_point(self):
        result = CalculusService.evaluate_taylor_at_point(
            func_str='exp(x)',
            x0=0,
            evaluate_at=1,
            max_order=10
        )
        best_approx = result['approximations'][result['best_order']]['value']
        assert abs(best_approx - math.e) < 0.01


class TestCalculusServiceRiemann:
    def test_riemann_sum(self):
        result = CalculusService.riemann_sum(
            func_str='x**2',
            a=0,
            b=1,
            n=100,
            method='midpoint'
        )
        assert abs(result['approximation'] - 1/3) < 0.01
        assert result['method'] == 'midpoint'

    def test_numerical_integration_convergence(self):
        result = CalculusService.numerical_integration_convergence(
            func_str='x**3',
            a=0,
            b=1,
            n_values=[4, 8, 16, 32, 64],
            domain_range=[0, 1]
        )
        assert 'methods' in result
        assert 'exact_value' in result
        simpson_errors = result['methods']['simpson']['errors']
        # 随着 n 增大，误差应减小或保持极小
        assert simpson_errors[-1]['error'] <= simpson_errors[0]['error']
        assert simpson_errors[-1]['error'] < 1e-10


class TestCalculusServiceErrors:
    def test_invalid_expression_raises(self):
        with pytest.raises((ValueError, SyntaxError, TypeError)):
            CalculusService.derivative_visualization(
                func_str='__import__("os")',
                x0=1,
                domain_range=[0, 2]
            )

    def test_empty_expression_raises(self):
        with pytest.raises((ValueError, TypeError)):
            CalculusService.derivative_visualization(
                func_str='',
                x0=1,
                domain_range=[0, 2]
            )
