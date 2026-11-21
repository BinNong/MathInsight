"""云端学习进度同步测试：存储层 + HTTP 路由层（含真实鉴权）"""
import pytest

from app import auth
from app.auth_guard import TOKEN_COOKIE_NAME


@pytest.fixture(autouse=True)
def enable_auth_guard(app):
    app.config['TESTING_SKIP_AUTH'] = False


@pytest.fixture
def fresh_invite(app):
    with app.app_context():
        return auth.create_invite_codes(1, note='progress-test')[0]


@pytest.fixture
def auth_headers(client, fresh_invite):
    reg = client.post('/api/auth/register', json={
        'username': 'syncuser', 'password': 'syncpass123', 'invite_code': fresh_invite,
    })
    assert reg.status_code in (200, 201)
    return {'Authorization': f"Bearer {reg.get_json()['data']['token']}"}


class TestProgressStorage:
    def test_upsert_and_isolation(self, app):
        with app.app_context():
            code = auth.create_invite_codes(1)[0]
            u1, _ = auth.create_user('store1', 'syncpass123', code)
            code2 = auth.create_invite_codes(1)[0]
            u2, _ = auth.create_user('store2', 'syncpass123', code2)

            assert auth.get_user_progress(u1['id']) is None
            auth.save_user_progress(u1['id'], '{"a":1}', '{}')
            auth.save_user_progress(u1['id'], '{"a":2}', '{}')
            assert auth.get_user_progress(u1['id'])['mastery'] == '{"a":2}'
            assert auth.get_user_progress(u2['id']) is None

    def test_oversize_constant(self):
        assert auth.MAX_PROGRESS_JSON_LENGTH > 0


class TestProgressRoutes:
    def test_get_empty_then_put(self, client, auth_headers):
        empty = client.get('/api/auth/progress', headers=auth_headers)
        assert empty.status_code == 200
        assert empty.get_json()['data'] is None

        put = client.put('/api/auth/progress', headers=auth_headers, json={
            'mastery': '{"state":{"limit-calc":{"answered":3}}}',
            'progress': '{"version":1,"favorites":["limit"]}',
        })
        assert put.status_code == 200
        assert put.get_json()['success'] is True

        got = client.get('/api/auth/progress', headers=auth_headers).get_json()['data']
        assert '"answered":3' in got['mastery']
        assert got['updated_at']

    def test_put_rejects_invalid(self, client, auth_headers):
        # 非字符串
        bad = client.put('/api/auth/progress', headers=auth_headers, json={'mastery': {}, 'progress': '{}'})
        assert bad.status_code == 400
        # 非法 JSON
        bad = client.put('/api/auth/progress', headers=auth_headers, json={'mastery': 'not json', 'progress': '{}'})
        assert bad.status_code == 400
        # 超大
        bad = client.put('/api/auth/progress', headers=auth_headers, json={
            'mastery': 'x' * (auth.MAX_PROGRESS_JSON_LENGTH + 1), 'progress': '{}',
        })
        assert bad.status_code == 400

    def test_requires_auth(self, client):
        assert client.get('/api/auth/progress').status_code == 401
