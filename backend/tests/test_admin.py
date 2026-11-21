"""管理员接口测试：角色权限、用户管理、邀请码管理、旧库迁移。"""
import sqlite3
import tempfile
from pathlib import Path

import pytest

from app import auth


@pytest.fixture(autouse=True)
def enable_auth_guard(app):
    app.config['TESTING_SKIP_AUTH'] = False


def _register(client, username, invite_code):
    return client.post('/api/auth/register', json={
        'username': username,
        'password': 'password123',
        'invite_code': invite_code,
    })


def _token(client, username):
    resp = client.post('/api/auth/login', json={
        'username': username, 'password': 'password123',
    })
    return resp.get_json()['data']['token']


@pytest.fixture
def admin_and_user(app, client):
    """准备一名管理员、一名普通用户及各自的请求头"""
    with app.app_context():
        admin_code, user_code = auth.create_invite_codes(2, note='admin-test')
    assert _register(client, 'adminuser', admin_code).status_code == 201
    assert _register(client, 'alice', user_code).status_code == 201
    with app.app_context():
        auth.set_admin_by_username('adminuser', True)

    return {
        'admin': {'Authorization': f'Bearer {_token(client, "adminuser")}'},
        'user': {'Authorization': f'Bearer {_token(client, "alice")}'},
    }


class TestAdminAccess:

    def test_non_admin_forbidden(self, client, admin_and_user):
        resp = client.get('/api/admin/users', headers=admin_and_user['user'])
        assert resp.status_code == 403
        assert '管理员' in resp.get_json()['error']

    def test_admin_can_list_users_and_summary(self, client, admin_and_user):
        resp = client.get('/api/admin/users', headers=admin_and_user['admin'])
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['total'] >= 2
        names = {item['username'] for item in data['items']}
        assert {'adminuser', 'alice'}.issubset(names)
        admin = next(item for item in data['items'] if item['username'] == 'adminuser')
        assert admin['is_admin'] is True

        summary = client.get('/api/admin/summary', headers=admin_and_user['admin']).get_json()['data']
        assert summary['users'] >= 2
        assert summary['admins'] == 1

    def test_role_change_takes_effect_via_token(self, client, admin_and_user):
        with client.application.app_context():
            users = auth.list_all_users()
        alice_id = next(u['id'] for u in users if u['username'] == 'alice')

        resp = client.patch(
            f'/api/admin/users/{alice_id}',
            json={'is_admin': True},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 200
        assert resp.get_json()['data']['is_admin'] is True

        me = client.get('/api/auth/me', headers=admin_and_user['user'])
        assert me.get_json()['data']['is_admin'] is True
        assert client.get('/api/admin/users', headers=admin_and_user['user']).status_code == 200

        resp = client.patch(
            f'/api/admin/users/{alice_id}',
            json={'is_admin': False},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 200
        assert client.get('/api/admin/users', headers=admin_and_user['user']).status_code == 403


class TestUserManagement:

    def test_deactivate_and_reactivate(self, client, admin_and_user):
        with client.application.app_context():
            users = auth.list_all_users()
        alice_id = next(u['id'] for u in users if u['username'] == 'alice')

        resp = client.patch(
            f'/api/admin/users/{alice_id}',
            json={'is_active': False},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 200
        assert resp.get_json()['data']['is_active'] is False
        assert client.post('/api/auth/login', json={
            'username': 'alice', 'password': 'password123',
        }).status_code == 401
        assert client.get('/api/auth/me', headers=admin_and_user['user']).status_code == 401

        resp = client.patch(
            f'/api/admin/users/{alice_id}',
            json={'is_active': True},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 200
        assert client.post('/api/auth/login', json={
            'username': 'alice', 'password': 'password123',
        }).status_code == 200

    def test_self_protection(self, client, admin_and_user):
        with client.application.app_context():
            users = auth.list_all_users()
        admin_id = next(u['id'] for u in users if u['username'] == 'adminuser')

        for payload in ({'is_admin': False}, {'is_active': False}):
            resp = client.patch(
                f'/api/admin/users/{admin_id}',
                json=payload,
                headers=admin_and_user['admin'],
            )
            assert resp.status_code == 400
            assert '自己' in resp.get_json()['error']

        resp = client.delete(f'/api/admin/users/{admin_id}', headers=admin_and_user['admin'])
        assert resp.status_code == 400

    def test_cli_reset_password(self, client, admin_and_user):
        with client.application.app_context():
            user, error = auth.reset_password_by_username('alice', 'newpassword123')
        assert error is None
        assert user['username'] == 'alice'
        assert client.post('/api/auth/login', json={
            'username': 'alice', 'password': 'newpassword123',
        }).status_code == 200

    def test_admin_reset_password(self, client, admin_and_user):
        with client.application.app_context():
            users = auth.list_all_users()
        alice_id = next(u['id'] for u in users if u['username'] == 'alice')

        # 普通用户不能调用
        resp = client.post(
            f'/api/admin/users/{alice_id}/reset-password',
            json={'new_password': 'adminreset123'},
            headers=admin_and_user['user'],
        )
        assert resp.status_code == 403

        # 弱密码被拒绝
        resp = client.post(
            f'/api/admin/users/{alice_id}/reset-password',
            json={'new_password': '123'},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 400

        # 管理员重置成功，旧密码失效、新密码可登录
        resp = client.post(
            f'/api/admin/users/{alice_id}/reset-password',
            json={'new_password': 'adminreset123'},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 200
        assert client.post('/api/auth/login', json={
            'username': 'alice', 'password': 'password123',
        }).status_code == 401
        assert client.post('/api/auth/login', json={
            'username': 'alice', 'password': 'adminreset123',
        }).status_code == 200

    def test_delete_user_keeps_invite_used(self, client, admin_and_user):
        with client.application.app_context():
            code = auth.create_invite_codes(1, note='delete-test')[0]
        assert _register(client, 'bob', code).status_code == 201

        with client.application.app_context():
            users = auth.list_all_users()
        bob_id = next(u['id'] for u in users if u['username'] == 'bob')

        resp = client.delete(f'/api/admin/users/{bob_id}', headers=admin_and_user['admin'])
        assert resp.status_code == 200

        # 用户已删除，但邀请码仍视为已使用，不能被重新注册
        resp = _register(client, 'carol', code)
        assert resp.status_code == 400
        assert '已被使用' in resp.get_json()['error']

        with client.application.app_context():
            invites = auth.list_invites(query=code)
        invite = invites['items'][0]
        assert invite['is_used'] is True
        assert invite['used_by_username'] == 'bob'


class TestInviteManagement:

    def test_create_list_and_revoke(self, client, admin_and_user):
        resp = client.post(
            '/api/admin/invites',
            json={'count': 2, 'note': '后台生成'},
            headers=admin_and_user['admin'],
        )
        assert resp.status_code == 201
        codes = resp.get_json()['data']['codes']
        assert len(codes) == 2

        resp = client.get('/api/admin/invites', headers=admin_and_user['admin'])
        items = resp.get_json()['data']['items']
        assert all(item['is_used'] is False for item in items if item['code'] in codes)

        resp = client.delete(f'/api/admin/invites/{codes[0]}', headers=admin_and_user['admin'])
        assert resp.status_code == 200
        resp = client.get('/api/admin/invites', headers=admin_and_user['admin'])
        remaining = {item['code'] for item in resp.get_json()['data']['items']}
        assert codes[0] not in remaining
        assert codes[1] in remaining

    def test_used_invite_cannot_be_revoked(self, client, admin_and_user):
        with client.application.app_context():
            code = auth.create_invite_codes(1)[0]
        assert _register(client, 'dave', code).status_code == 201
        resp = client.delete(f'/api/admin/invites/{code}', headers=admin_and_user['admin'])
        assert resp.status_code == 400
        assert '已使用' in resp.get_json()['error']


class TestSchemaMigration:

    def test_old_database_is_migrated(self, monkeypatch):
        tmp_path = Path(tempfile.mkdtemp(prefix='mathinsight_migrate_'))
        db = tmp_path / 'old.db'
        conn = sqlite3.connect(db)
        conn.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE invite_codes (
                code TEXT PRIMARY KEY,
                note TEXT,
                created_at TEXT NOT NULL,
                used_by INTEGER,
                used_at TEXT,
                FOREIGN KEY (used_by) REFERENCES users(id)
            );
            """
        )
        conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES ('olduser', 'x', '2026-01-01')"
        )
        conn.execute(
            "INSERT INTO invite_codes (code, created_at, used_by, used_at) VALUES ('MI-OLDCODE1', '2026-01-01', 1, '2026-01-02')"
        )
        conn.commit()
        conn.close()

        monkeypatch.setattr(auth, 'DB_PATH', db)
        monkeypatch.setattr(auth, 'DATA_DIR', tmp_path)
        monkeypatch.delenv(auth.ADMIN_USERNAMES_ENV, raising=False)
        auth.init_db()

        conn = sqlite3.connect(db)
        user_cols = {row[1] for row in conn.execute('PRAGMA table_info(users)')}
        invite_cols = {row[1] for row in conn.execute('PRAGMA table_info(invite_codes)')}
        assert 'is_admin' in user_cols
        assert 'used_by_username' in invite_cols
        assert conn.execute('SELECT is_admin FROM users').fetchone()[0] == 0
        assert conn.execute('SELECT used_by_username FROM invite_codes').fetchone()[0] == 'olduser'
        conn.close()

    def test_admin_usernames_env_promotes(self, client, monkeypatch):
        with client.application.app_context():
            code = auth.create_invite_codes(1)[0]
        assert _register(client, 'envadmin', code).status_code == 201

        monkeypatch.setenv(auth.ADMIN_USERNAMES_ENV, 'envadmin')
        auth.init_db()
        with client.application.app_context():
            user = next(u for u in auth.list_all_users() if u['username'] == 'envadmin')
        assert user['is_admin'] is True
