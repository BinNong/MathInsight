"""认证系统测试：邀请码注册、登录、令牌校验、全站守卫。"""
import pytest

from app import auth


@pytest.fixture(autouse=True)
def enable_auth_guard(app):
    """认证测试需要真实启用守卫"""
    app.config['TESTING_SKIP_AUTH'] = False


@pytest.fixture
def fresh_invite(app):
    """每个测试生成一个独立邀请码"""
    with app.app_context():
        codes = auth.create_invite_codes(1, note='pytest')
        return codes[0]


class TestAuth:

    def test_health_is_public(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200

    def test_business_api_requires_auth(self, client):
        """未登录访问业务接口应被守卫拦截"""
        resp = client.get('/api/knowledge-graph')
        assert resp.status_code == 401
        assert resp.get_json()['success'] is False

    def test_register_requires_invite(self, client):
        resp = client.post('/api/auth/register', json={
            'username': 'alice', 'password': 'password123', 'invite_code': 'MI-INVALID0',
        })
        assert resp.status_code == 400
        assert '邀请码' in resp.get_json()['error']

    def test_register_success_and_sets_cookie(self, client, fresh_invite):
        resp = client.post('/api/auth/register', json={
            'username': 'alice', 'password': 'password123', 'invite_code': fresh_invite,
        })
        assert resp.status_code == 201
        data = resp.get_json()['data']
        assert data['user']['username'] == 'alice'
        assert data['token']
        # httpOnly Cookie 应被设置，供媒体资源请求使用
        assert 'mi_token' in resp.headers.get('Set-Cookie', '')

    def test_invite_code_single_use(self, client, fresh_invite):
        payload = {'username': 'bob', 'password': 'password123', 'invite_code': fresh_invite}
        assert client.post('/api/auth/register', json=payload).status_code == 201
        payload['username'] = 'carol'
        resp = client.post('/api/auth/register', json=payload)
        assert resp.status_code == 400
        assert '已被使用' in resp.get_json()['error']

    def test_duplicate_username(self, client):
        codes = auth.create_invite_codes(2, note='dup')
        r1 = client.post('/api/auth/register', json={
            'username': 'dave', 'password': 'password123', 'invite_code': codes[0],
        })
        assert r1.status_code == 201
        r2 = client.post('/api/auth/register', json={
            'username': 'dave', 'password': 'password123', 'invite_code': codes[1],
        })
        assert r2.status_code == 400
        assert '用户名' in r2.get_json()['error']

    def test_short_password_rejected(self, client, fresh_invite):
        resp = client.post('/api/auth/register', json={
            'username': 'eve', 'password': '123', 'invite_code': fresh_invite,
        })
        assert resp.status_code == 400
        assert '8' in resp.get_json()['error']

    def test_login_wrong_password(self, client, fresh_invite):
        client.post('/api/auth/register', json={
            'username': 'frank', 'password': 'password123', 'invite_code': fresh_invite,
        })
        resp = client.post('/api/auth/login', json={
            'username': 'frank', 'password': 'wrongpassword',
        })
        assert resp.status_code == 401

    def test_full_flow_with_token(self, client, fresh_invite):
        """注册 -> 携带令牌访问受保护接口 -> me -> 退出"""
        reg = client.post('/api/auth/register', json={
            'username': 'grace', 'password': 'password123', 'invite_code': fresh_invite,
        })
        token = reg.get_json()['data']['token']
        headers = {'Authorization': f'Bearer {token}'}

        # 受保护接口放行
        assert client.get('/api/knowledge-graph', headers=headers).status_code == 200
        me = client.get('/api/auth/me', headers=headers)
        assert me.status_code == 200
        assert me.get_json()['data']['username'] == 'grace'

        # 伪造令牌被拒绝
        bad = client.get('/api/knowledge-graph', headers={'Authorization': 'Bearer fake.token.here'})
        assert bad.status_code == 401
