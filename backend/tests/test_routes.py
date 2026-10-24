import os

import pytest


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get('/api/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'


class TestCalculusEndpoints:
    def test_derivative_tangent(self, client):
        response = client.post('/api/calculus/derivative/tangent', json={
            'function': 'x**2',
            'x0': 2,
            'domain_range': [0, 4]
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert abs(data['data']['derivative']['value'] - 4.0) < 1e-10

    def test_epsilon_delta(self, client):
        response = client.post('/api/calculus/limit/epsilon-delta', json={
            'function': 'x**2',
            'x0': 2,
            'L': 4,
            'epsilon': 0.5,
            'domain_range': [0, 4]
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['delta_values']['delta'] > 0

    def test_invalid_expression(self, client):
        response = client.post('/api/calculus/derivative/tangent', json={
            'function': '__import__("os")',
            'x0': 2,
            'domain_range': [0, 4]
        })
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False


class TestLinearAlgebraEndpoints:
    def test_matrix_transform(self, client):
        response = client.post('/api/linear-algebra/matrix-transform', json={
            'matrix': [2, 0, 0, 2]
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert abs(data['data']['determinant']['value'] - 4.0) < 1e-10

    def test_invalid_matrix(self, client):
        response = client.post('/api/linear-algebra/matrix-transform', json={
            'matrix': [1, 2, 3]
        })
        assert response.status_code == 400


class TestProbabilityEndpoints:
    def test_lln_simulate(self, client):
        response = client.post('/api/probability/lln/simulate', json={
            'experiment_type': 'coin',
            'p': 0.5,
            'sample_size': 1000
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert len(data['data']['cumulative_means']) == 1000

    def test_invalid_probability(self, client):
        response = client.post('/api/probability/lln/simulate', json={
            'experiment_type': 'coin',
            'p': 1.5,
            'sample_size': 100
        })
        assert response.status_code == 400

    def test_clt_simulate(self, client):
        response = client.post('/api/probability/clt/simulate', json={
            'distribution': 'bernoulli',
            'params': {'p': 0.5},
            'sample_size': 30,
            'num_samples': 500,
            'seed': 42
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert len(data['data']['sample_means']) == 500

    def test_distribution_simulate(self, client):
        response = client.post('/api/probability/distribution/simulate', json={
            'distribution': 'normal',
            'params': {'mu': 0, 'sigma': 1},
            'sample_size': 1000,
            'seed': 42
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert len(data['data']['samples']) == 1000

    def test_distribution_presets(self, client):
        response = client.get('/api/probability/distribution/presets')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'distributions' in data['data']

    def test_clt_rejects_invalid_probability(self, client):
        response = client.post('/api/probability/clt/simulate', json={
            'distribution': 'bernoulli',
            'params': {'p': 1.5},
            'sample_size': 30,
            'num_samples': 500
        })
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_distribution_rejects_invalid_normal_sigma(self, client):
        response = client.post('/api/probability/distribution/simulate', json={
            'distribution': 'normal',
            'params': {'mu': 0, 'sigma': -1},
            'sample_size': 1000
        })
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_distribution_rejects_invalid_binomial_params(self, client):
        response = client.post('/api/probability/distribution/simulate', json={
            'distribution': 'binomial',
            'params': {'n': 0, 'p': 0.5},
            'sample_size': 1000
        })
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False


class TestDownloadSecurity:
    def test_download_rejects_path_traversal(self, client):
        response = client.get('/downloads/../.env')
        assert response.status_code == 404

    def test_download_rejects_hidden_internal_dir(self, client):
        response = client.get('/downloads/.tasks/xxx.json')
        assert response.status_code == 404

    def test_download_existing_file_succeeds(self, client, tmp_path, monkeypatch):
        # 临时创建一个允许下载的测试文件
        from app import create_app
        # 使用 conftest 中的 client 时 downloads 目录已固定，这里直接写入真实目录
        downloads_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'downloads'
        )
        os.makedirs(downloads_dir, exist_ok=True)
        test_file = os.path.join(downloads_dir, 'test_safe.mp4')
        try:
            with open(test_file, 'wb') as f:
                f.write(b'fake video')
            response = client.get('/downloads/test_safe.mp4')
            assert response.status_code == 200
        finally:
            if os.path.exists(test_file):
                os.remove(test_file)


class TestCORSSecurity:
    def test_cors_allows_configured_origin(self, client):
        response = client.get(
            '/api/health',
            headers={'Origin': 'http://localhost:5173'}
        )
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'

    def test_cors_rejects_unknown_origin(self, client):
        response = client.get(
            '/api/health',
            headers={'Origin': 'https://evil.example.com'}
        )
        assert response.status_code == 200
        # 非允许来源不应返回 Access-Control-Allow-Origin
        assert 'Access-Control-Allow-Origin' not in response.headers
