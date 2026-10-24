import pytest
import numpy as np
from app.utils.math_utils import (
    _safe_parse,
    safe_eval,
    safe_eval_single,
    get_derivative,
    get_tangent_line,
    generate_function_points,
    compute_delta_for_epsilon
)


class TestSafeParse:
    def test_parse_simple_expression(self):
        expr = _safe_parse('x**2 + 2*x + 1')
        assert expr is not None

    def test_parse_invalid_expression(self):
        with pytest.raises(ValueError):
            _safe_parse('__import__("os")')

    def test_parse_empty_expression(self):
        with pytest.raises(ValueError):
            _safe_parse('')


class TestSafeEval:
    def test_eval_polynomial(self):
        y_values = safe_eval('x**2', [0, 1, 2, 3])
        assert y_values == [0.0, 1.0, 4.0, 9.0]

    def test_eval_trigonometric(self):
        y_values = safe_eval('sin(x)', [0, np.pi / 2, np.pi])
        assert abs(y_values[0]) < 1e-10
        assert abs(y_values[1] - 1.0) < 1e-10
        assert abs(y_values[2]) < 1e-10

    def test_eval_constant_function(self):
        y_values = safe_eval('5', [0, 1, 2])
        assert y_values == [5.0, 5.0, 5.0]


class TestSafeEvalSingle:
    def test_single_value(self):
        assert abs(safe_eval_single('x**2', 3) - 9.0) < 1e-10


class TestGetDerivative:
    def test_derivative_polynomial(self):
        assert get_derivative('x**3') == '3*x**2'

    def test_derivative_trigonometric(self):
        assert get_derivative('sin(x)') == 'cos(x)'


class TestGetTangentLine:
    def test_tangent_parabola(self):
        slope, intercept = get_tangent_line('x**2', 2)
        assert abs(slope - 4.0) < 1e-10
        assert abs(intercept - (-4.0)) < 1e-10


class TestGenerateFunctionPoints:
    def test_generates_points(self):
        result = generate_function_points('x**2', [0, 3], 4)
        assert len(result['x']) == 4
        assert len(result['y']) == 4
        assert result['y'][0] == 0.0
        assert result['y'][-1] == 9.0

    def test_handles_singularities(self):
        result = generate_function_points('1/x', [-1, 1], 5)
        # x=0 处应为 None
        assert any(y is None for y in result['y'])


class TestComputeDeltaForEpsilon:
    def test_linear_function(self):
        delta = compute_delta_for_epsilon('x', 2, 2, 0.5, [0, 4])
        assert abs(delta - 0.5) < 1e-3

    def test_quadratic_function(self):
        delta = compute_delta_for_epsilon('x**2', 2, 4, 1.0, [0, 4])
        assert delta > 0
