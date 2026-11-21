"""高阶数学实验服务测试：方向场、特征值、假设检验"""
import pytest

from app.services.advanced_service import (
    direction_field,
    eigenvalue_analysis,
    hypothesis_test,
    solution_curves,
)


class TestDirectionField:
    def test_field_segments(self):
        result = direction_field('x - y', [-3, 3], [-3, 3], 10)
        assert len(result['segments']) == 100
        seg = result['segments'][0]
        assert all(k in seg for k in ('x', 'y', 'dx', 'dy', 'slope'))

    def test_solution_curves_rk4(self):
        result = solution_curves('-y', [{'x': 0, 'y': 1}], [0, 2], 100)
        curve = result['curves'][0]
        assert result['method'] == 'RK4'
        assert len(curve['x']) == 101
        # y' = -y, y(0)=1 → y(2) ≈ e^-2
        assert abs(curve['y'][-1] - 0.1353) < 0.01

    def test_invalid_expression_rejected(self):
        with pytest.raises(Exception):
            direction_field('__import__("os")', [-1, 1], [-1, 1], 5)


class TestEigenvalues:
    def test_symmetric_matrix(self):
        result = eigenvalue_analysis([[2, 1], [1, 2]], [1, 1])
        assert result['determinant'] == pytest.approx(3.0)
        assert result['trace'] == pytest.approx(4.0)
        vals = sorted(p['eigenvalue_real'] for p in result['eigenpairs'])
        assert vals == pytest.approx([1.0, 3.0])
        assert result['is_eigenvector'] is True

    def test_non_eigenvector(self):
        result = eigenvalue_analysis([[2, 0], [0, 1]], [1, 1])
        assert result['is_eigenvector'] is False

    def test_rotation_has_complex_eigenvalues(self):
        result = eigenvalue_analysis([[0, -1], [1, 0]])
        assert any(abs(p['eigenvalue_imag']) > 0.9 for p in result['eigenpairs'])

    def test_bad_shape_rejected(self):
        with pytest.raises(ValueError):
            eigenvalue_analysis([[1, 2, 3]])


class TestHypothesisTest:
    def test_z_test_significant(self):
        result = hypothesis_test('z', 103, 100, 15, 100, 0.05, 'two')
        assert result['statistic'] == pytest.approx(2.0)
        assert result['p_value'] == pytest.approx(0.0455, abs=1e-3)
        assert result['reject_null'] is True

    def test_z_test_not_significant(self):
        result = hypothesis_test('z', 101, 100, 15, 100, 0.05, 'two')
        assert result['reject_null'] is False

    def test_t_test(self):
        result = hypothesis_test('t', 105, 100, 10, 25, 0.05, 'right')
        assert result['test_type'] == 't'
        assert result['statistic'] == pytest.approx(2.5)
        assert 0 < result['p_value'] < 1

    def test_distribution_curve(self):
        result = hypothesis_test('z', 103, 100, 15, 100)
        assert len(result['distribution']['x']) == 300
        assert len(result['distribution']['y']) == 300

    def test_invalid_params(self):
        with pytest.raises(ValueError):
            hypothesis_test('z', 103, 100, 0, 100)
        with pytest.raises(ValueError):
            hypothesis_test('z', 103, 100, 15, 1)


class TestAdvancedRoutes:
    def test_direction_field_route(self, client):
        resp = client.post('/api/advanced/ode/direction-field', json={
            'function': 'x - y', 'x_range': [-3, 3], 'y_range': [-3, 3],
            'density': 15,
            'initial_conditions': [{'x': 0, 'y': 1}],
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert len(data['data']['segments']) > 0
        assert len(data['data']['curves']) == 1

    def test_eigenvalues_route(self, client):
        resp = client.post('/api/advanced/eigenvalues/analyze', json={
            'matrix': [[2, 1], [1, 2]], 'vector': [1, 1],
        })
        assert resp.status_code == 200
        assert resp.get_json()['data']['is_eigenvector'] is True

    def test_hypothesis_route(self, client):
        resp = client.post('/api/advanced/hypothesis-test', json={
            'test_type': 'z', 'tail': 'two', 'sample_mean': 103,
            'hypothesized_mean': 100, 'std': 15, 'n': 100, 'alpha': 0.05,
        })
        assert resp.status_code == 200
        assert resp.get_json()['data']['reject_null'] is True
