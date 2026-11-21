"""
账号系统：数据持久化、密码哈希、签名令牌、管理员权限。

设计要点：
- SQLite（Python 标准库），单文件数据库，便于在自己的服务器上持久化与备份
- 密码使用 werkzeug 的 scrypt/pbkdf2 哈希，绝不明文存储
- 令牌使用 itsdangerous 签名（两者均为 Flask 自带依赖），无状态、可过期、不可伪造
- 注册必须提供有效且未使用的邀请码
- 角色只有普通用户与管理员（users.is_admin），注册接口不接受任何角色参数
- 首个管理员由服务器运维通过 manage_users.py 或 ADMIN_USERNAMES 环境变量指定
"""
import os
import re
import sqlite3
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path

from flask import g, has_app_context
from itsdangerous import (
    BadSignature,
    SignatureExpired,
    URLSafeTimedSerializer,
)
from werkzeug.security import check_password_hash, generate_password_hash

# backend/ 目录（容器内对应 /app）
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / 'data'
DB_PATH = DATA_DIR / 'mathinsight.db'
SECRET_KEY_PATH = DATA_DIR / 'secret_key'

TOKEN_SALT = 'mathinsight-auth-v1'
USERNAME_RE = re.compile(r'^[\w\u4e00-\u9fa5]{3,32}$')
INVITE_RE = re.compile(r'^MI-[A-Z0-9]{6,32}$')
ADMIN_USERNAMES_ENV = 'ADMIN_USERNAMES'


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_or_create_secret_key() -> str:
    """
    获取签名密钥。

    优先使用环境变量 SECRET_KEY；未配置时在数据目录生成并持久化一个随机密钥，
    这样开发/部署不会因为忘记配置而崩溃，且重启后已签发的令牌仍然有效。
    """
    env_key = os.environ.get('SECRET_KEY')
    if env_key and env_key.strip():
        return env_key.strip()
    ensure_data_dir()
    if SECRET_KEY_PATH.exists():
        key = SECRET_KEY_PATH.read_text(encoding='utf-8').strip()
        if key:
            return key
    key = secrets.token_urlsafe(48)
    SECRET_KEY_PATH.write_text(key, encoding='utf-8')
    try:
        os.chmod(SECRET_KEY_PATH, 0o600)
    except OSError:
        pass
    return key


def get_db() -> sqlite3.Connection:
    """获取当前请求的连接（每个请求一个，结束时关闭）"""
    if 'auth_db' not in g:
        ensure_data_dir()
        conn = sqlite3.connect(str(DB_PATH), timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA foreign_keys=ON')
        g.auth_db = conn
    return g.auth_db


def close_db(_exc=None) -> None:
    conn = g.pop('auth_db', None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    """建表、迁移旧库，并应用环境变量中的管理员名单（幂等）"""
    ensure_data_dir()
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                is_active     INTEGER NOT NULL DEFAULT 1,
                is_admin      INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                code             TEXT PRIMARY KEY,
                note             TEXT,
                created_at       TEXT NOT NULL,
                used_by          INTEGER,
                used_at          TEXT,
                used_by_username TEXT,
                FOREIGN KEY (used_by) REFERENCES users(id)
            );
            """
        )
        _migrate_schema(conn)
        _bootstrap_admins(conn)
        conn.commit()
    finally:
        conn.close()


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    return any(row[1] == column for row in conn.execute(f'PRAGMA table_info({table})'))


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """为旧版本数据库补齐新增字段，不破坏既有账号与邀请码"""
    if not _column_exists(conn, 'users', 'is_admin'):
        conn.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')

    if not _column_exists(conn, 'invite_codes', 'used_by_username'):
        conn.execute('ALTER TABLE invite_codes ADD COLUMN used_by_username TEXT')
        conn.execute(
            """
            UPDATE invite_codes
               SET used_by_username = (
                   SELECT username FROM users WHERE users.id = invite_codes.used_by
               )
             WHERE used_by IS NOT NULL
            """
        )


def _bootstrap_admins(conn: sqlite3.Connection) -> None:
    """
    将 ADMIN_USERNAMES（逗号分隔）中已存在的用户提升为管理员。
    只提升、不降级，避免误配环境变量导致所有管理员被清空。
    """
    names = [name.strip() for name in os.environ.get(ADMIN_USERNAMES_ENV, '').split(',') if name.strip()]
    for name in names:
        conn.execute('UPDATE users SET is_admin = 1 WHERE username = ?', (name,))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def validate_username(username: str) -> str | None:
    if not isinstance(username, str) or not USERNAME_RE.match(username.strip()):
        return '用户名需为 3-32 位字母、数字、下划线或中文'
    return None


def validate_password(password: str) -> str | None:
    if not isinstance(password, str) or len(password) < 8:
        return '密码至少需要 8 位'
    if len(password) > 128:
        return '密码不能超过 128 位'
    return None


# ------------------------------ 用户 ------------------------------

def _user_dict(row: sqlite3.Row | None) -> dict | None:
    """将用户行转为 JSON 友好的字典，布尔字段统一为 true/false"""
    if row is None:
        return None
    data = dict(row)
    for key in ('is_active', 'is_admin'):
        if key in data:
            data[key] = bool(data[key])
    return data


def create_user(username: str, password: str, invite_code: str) -> tuple[dict | None, str | None]:
    """
    创建用户并核销邀请码。

    返回 (user_dict, None) 表示成功；返回 (None, error_message) 表示失败。
    """
    username = username.strip()
    invite_code = invite_code.strip().upper()

    for validate in (validate_username(username), validate_password(password)):
        if validate:
            return None, validate
    if not INVITE_RE.match(invite_code):
        return None, '邀请码格式不正确'

    conn = get_db()
    try:
        conn.execute('BEGIN IMMEDIATE')
        code_row = conn.execute(
            'SELECT code, used_by, used_at FROM invite_codes WHERE code = ?', (invite_code,)
        ).fetchone()
        if code_row is None:
            conn.rollback()
            return None, '邀请码无效'
        if code_row['used_by'] is not None or code_row['used_at'] is not None:
            conn.rollback()
            return None, '邀请码已被使用'

        if conn.execute('SELECT 1 FROM users WHERE username = ?', (username,)).fetchone():
            conn.rollback()
            return None, '用户名已被注册'

        cursor = conn.execute(
            'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
            (username, generate_password_hash(password), _now()),
        )
        user_id = cursor.lastrowid
        conn.execute(
            'UPDATE invite_codes SET used_by = ?, used_at = ?, used_by_username = ? WHERE code = ?',
            (user_id, _now(), username, invite_code),
        )
        conn.commit()
        user = conn.execute(
            'SELECT id, username, created_at, is_admin FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        return _user_dict(user), None
    except sqlite3.IntegrityError:
        conn.rollback()
        return None, '用户名已被注册或邀请码无效'
    except Exception:
        conn.rollback()
        raise


def authenticate(username: str, password: str) -> tuple[dict | None, str | None]:
    """校验用户名密码，成功返回用户字典"""
    if not isinstance(username, str) or not isinstance(password, str):
        return None, '用户名或密码错误'
    conn = get_db()
    row = conn.execute(
        'SELECT id, username, password_hash, is_active, is_admin FROM users WHERE username = ?',
        (username.strip(),),
    ).fetchone()
    if row is None or not row['is_active']:
        return None, '用户名或密码错误'
    if not check_password_hash(row['password_hash'], password):
        return None, '用户名或密码错误'
    return _user_dict({
        'id': row['id'],
        'username': row['username'],
        'is_active': row['is_active'],
        'is_admin': row['is_admin'],
    }), None


def change_password(user_id: int, old_password: str, new_password: str) -> tuple[bool, str | None]:
    """用户自助修改密码：必须提供正确的当前密码，新密码需满足强度要求"""
    error = validate_password(new_password)
    if error:
        return False, error
    if not isinstance(old_password, str) or not old_password:
        return False, '当前密码不能为空'
    if old_password == new_password:
        return False, '新密码不能与当前密码相同'

    conn = get_db()
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute(
            'SELECT password_hash FROM users WHERE id = ? AND is_active = 1', (user_id,)
        ).fetchone()
        if row is None:
            conn.rollback()
            return False, '用户不存在或已停用'
        if not check_password_hash(row['password_hash'], old_password):
            conn.rollback()
            return False, '当前密码错误'
        conn.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            (generate_password_hash(new_password), user_id),
        )
        conn.commit()
        return True, None
    except Exception:
        conn.rollback()
        raise


def user_by_id(user_id: int) -> dict | None:
    conn = get_db()
    row = conn.execute(
        '''
        SELECT id, username, created_at, is_active, is_admin
          FROM users
         WHERE id = ? AND is_active = 1
        ''',
        (user_id,),
    ).fetchone()
    return _user_dict(row)


# ---------------------------- 令牌 ----------------------------

def _serializer() -> URLSafeTimedSerializer:
    key = get_or_create_secret_key()
    return URLSafeTimedSerializer(key, salt=TOKEN_SALT)


def issue_token(user: dict) -> str:
    return _serializer().dumps({'uid': user['id'], 'u': user['username']})


def verify_token(token: str, max_age: int) -> dict | None:
    """校验签名令牌，返回用户字典；无效或过期返回 None"""
    if not token or not isinstance(token, str):
        return None
    try:
        data = _serializer().loads(token.strip(), max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get('uid') if isinstance(data, dict) else None
    if not isinstance(uid, int):
        return None
    return user_by_id(uid)


# -------------------------- 邀请码 --------------------------

def create_invite_codes(count: int = 1, note: str | None = None) -> list[str]:
    """批量生成未使用的邀请码，返回明文列表"""
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    codes: list[str] = []
    alphabet = string.ascii_uppercase + string.digits
    try:
        conn.execute('BEGIN IMMEDIATE')
        for _ in range(count):
            while True:
                code = 'MI-' + ''.join(secrets.choice(alphabet) for _ in range(10))
                if not conn.execute('SELECT 1 FROM invite_codes WHERE code = ?', (code,)).fetchone():
                    break
            conn.execute(
                'INSERT INTO invite_codes (code, note, created_at) VALUES (?, ?, ?)',
                (code, note, _now()),
            )
            codes.append(code)
        conn.commit()
    finally:
        conn.close()
    return codes


def invite_stats() -> dict:
    """邀请码使用统计（供运维查看）"""
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    try:
        total = conn.execute('SELECT COUNT(*) FROM invite_codes').fetchone()[0]
        used = conn.execute(
            'SELECT COUNT(*) FROM invite_codes WHERE used_by IS NOT NULL OR used_at IS NOT NULL'
        ).fetchone()[0]
        users = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    finally:
        conn.close()
    return {'total': total, 'used': used, 'unused': total - used, 'users': users}


# ---------------------------- 管理员 ----------------------------

def _connect_direct() -> sqlite3.Connection:
    """命令行脚本使用的直连（不依赖 Flask g）"""
    ensure_data_dir()
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def _active_admin_count(conn: sqlite3.Connection) -> int:
    return conn.execute(
        'SELECT COUNT(*) FROM users WHERE is_admin = 1 AND is_active = 1'
    ).fetchone()[0]


def admin_summary() -> dict:
    """管理后台概览数字"""
    conn = get_db()
    row = conn.execute(
        """
        SELECT COUNT(*) AS users,
               COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_users,
               COALESCE(SUM(CASE WHEN is_admin = 1 AND is_active = 1 THEN 1 ELSE 0 END), 0) AS admins,
               (SELECT COUNT(*) FROM invite_codes) AS invites,
               (SELECT COUNT(*) FROM invite_codes
                 WHERE used_by IS NOT NULL OR used_at IS NOT NULL) AS used_invites
          FROM users
        """
    ).fetchone()
    return {key: int(row[key]) for key in row.keys()}


def list_users(query: str = '', page: int = 1, page_size: int = 20,
               include_inactive: bool = True) -> dict:
    conn = get_db()
    where: list[str] = []
    params: list[object] = []
    if query:
        like = f'%{query.strip()}%'
        where.append('(username LIKE ? OR CAST(id AS TEXT) LIKE ?)')
        params.extend([like, like])
    if not include_inactive:
        where.append('is_active = 1')
    clause = ' WHERE ' + ' AND '.join(where) if where else ''

    total = conn.execute(f'SELECT COUNT(*) FROM users{clause}', params).fetchone()[0]
    rows = conn.execute(
        f'''
        SELECT id, username, created_at, is_active, is_admin
          FROM users{clause}
         ORDER BY id DESC
         LIMIT ? OFFSET ?
        ''',
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()
    return {
        'items': [_user_dict(row) for row in rows],
        'total': total,
        'page': page,
        'page_size': page_size,
    }


def get_user_detail(user_id: int) -> dict | None:
    conn = get_db()
    row = conn.execute(
        '''
        SELECT id, username, created_at, is_active, is_admin
          FROM users WHERE id = ?
        ''',
        (user_id,),
    ).fetchone()
    if row is None:
        return None
    data = _user_dict(row)
    invite = conn.execute(
        '''
        SELECT code, note, created_at, used_at
          FROM invite_codes
         WHERE used_by = ? OR used_by_username = ?
         ORDER BY used_at DESC
         LIMIT 1
        ''',
        (user_id, row['username']),
    ).fetchone()
    data['invite'] = dict(invite) if invite else None
    return data


def set_user_flags(actor_id: int, user_id: int, *,
                   is_active: bool | None = None,
                   is_admin: bool | None = None) -> tuple[dict | None, str | None]:
    """管理员修改用户状态/角色；返回 (更新后的用户, 错误信息)"""
    conn = get_db()
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute(
            'SELECT id, username, is_active, is_admin FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        if row is None:
            conn.rollback()
            return None, '用户不存在'

        if actor_id == user_id and ((is_active is False) or (is_admin is False)):
            conn.rollback()
            return None, '不能停用或降级自己的管理员账号'

        removing_admin = (
            (is_admin is False and row['is_admin'])
            or (is_active is False and row['is_active'] and row['is_admin'])
        )
        if removing_admin and _active_admin_count(conn) <= 1:
            conn.rollback()
            return None, '至少需要保留一名启用中的管理员'

        updates: list[str] = []
        values: list[object] = []
        if is_active is not None:
            updates.append('is_active = ?')
            values.append(1 if is_active else 0)
        if is_admin is not None:
            updates.append('is_admin = ?')
            values.append(1 if is_admin else 0)
        if updates:
            conn.execute(
                f'UPDATE users SET {", ".join(updates)} WHERE id = ?',
                [*values, user_id],
            )
        conn.commit()
        updated = conn.execute(
            '''
            SELECT id, username, created_at, is_active, is_admin
              FROM users WHERE id = ?
            ''',
            (user_id,),
        ).fetchone()
        return _user_dict(updated), None
    except Exception:
        conn.rollback()
        raise


def delete_user(actor_id: int, user_id: int) -> tuple[bool, str | None]:
    """删除用户；邀请码保留使用痕迹但解除外键关联，避免被重新使用"""
    conn = get_db()
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute(
            'SELECT id, is_active, is_admin FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        if row is None:
            conn.rollback()
            return False, '用户不存在'
        if actor_id == user_id:
            conn.rollback()
            return False, '不能删除自己的账号'
        if row['is_admin'] and row['is_active'] and _active_admin_count(conn) <= 1:
            conn.rollback()
            return False, '至少需要保留一名启用中的管理员'

        conn.execute('UPDATE invite_codes SET used_by = NULL WHERE used_by = ?', (user_id,))
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        return True, None
    except Exception:
        conn.rollback()
        raise


def list_invites(query: str = '', page: int = 1, page_size: int = 20) -> dict:
    conn = get_db()
    where: list[str] = []
    params: list[object] = []
    if query:
        like = f'%{query.strip()}%'
        where.append('(code LIKE ? OR COALESCE(note, \'\') LIKE ? OR COALESCE(used_by_username, \'\') LIKE ?)')
        params.extend([like, like, like])
    clause = ' WHERE ' + ' AND '.join(where) if where else ''

    total = conn.execute(f'SELECT COUNT(*) FROM invite_codes{clause}', params).fetchone()[0]
    rows = conn.execute(
        f'''
        SELECT code, note, created_at, used_at, used_by_username,
               CASE WHEN used_by IS NOT NULL OR used_at IS NOT NULL THEN 1 ELSE 0 END AS is_used
          FROM invite_codes{clause}
         ORDER BY created_at DESC, code DESC
         LIMIT ? OFFSET ?
        ''',
        [*params, page_size, (page - 1) * page_size],
    ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        item['is_used'] = bool(item['is_used'])
        items.append(item)
    return {'items': items, 'total': total, 'page': page, 'page_size': page_size}


def revoke_invite(code: str) -> tuple[bool, str | None]:
    """作废未使用的邀请码"""
    conn = _connect_direct()
    try:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute(
            'SELECT code, used_by, used_at FROM invite_codes WHERE code = ?', (code.strip().upper(),)
        ).fetchone()
        if row is None:
            conn.rollback()
            return False, '邀请码不存在'
        if row['used_by'] is not None or row['used_at'] is not None:
            conn.rollback()
            return False, '已使用的邀请码不能作废'
        conn.execute('DELETE FROM invite_codes WHERE code = ?', (row['code'],))
        conn.commit()
        return True, None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# -------------------------- 命令行管理员维护 --------------------------

def list_all_users() -> list[dict]:
    conn = _connect_direct()
    try:
        rows = conn.execute(
            '''
            SELECT id, username, created_at, is_active, is_admin
              FROM users ORDER BY id
            '''
        ).fetchall()
        return [_user_dict(row) for row in rows]
    finally:
        conn.close()


def set_admin_by_username(username: str, is_admin: bool) -> tuple[dict | None, str | None]:
    """命令行提权/降权，不影响网页端的自我保护规则"""
    conn = _connect_direct()
    try:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute(
            'SELECT id, username, is_admin FROM users WHERE username = ?', (username.strip(),)
        ).fetchone()
        if row is None:
            conn.rollback()
            return None, '用户不存在'
        if not is_admin and row['is_admin'] and _active_admin_count(conn) <= 1:
            conn.rollback()
            return None, '至少需要保留一名启用中的管理员'
        conn.execute('UPDATE users SET is_admin = ? WHERE id = ?', (1 if is_admin else 0, row['id']))
        conn.commit()
        updated = conn.execute(
            '''
            SELECT id, username, created_at, is_active, is_admin
              FROM users WHERE id = ?
            ''',
            (row['id'],),
        ).fetchone()
        return _user_dict(updated), None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_active_by_username(username: str, is_active: bool) -> tuple[dict | None, str | None]:
    conn = _connect_direct()
    try:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute(
            'SELECT id, username, is_active, is_admin FROM users WHERE username = ?',
            (username.strip(),),
        ).fetchone()
        if row is None:
            conn.rollback()
            return None, '用户不存在'
        if not is_active and row['is_active'] and row['is_admin'] and _active_admin_count(conn) <= 1:
            conn.rollback()
            return None, '至少需要保留一名启用中的管理员'
        conn.execute('UPDATE users SET is_active = ? WHERE id = ?', (1 if is_active else 0, row['id']))
        conn.commit()
        updated = conn.execute(
            '''
            SELECT id, username, created_at, is_active, is_admin
              FROM users WHERE id = ?
            ''',
            (row['id'],),
        ).fetchone()
        return _user_dict(updated), None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def reset_password_by_username(username: str, password: str) -> tuple[dict | None, str | None]:
    """命令行重置密码（仅运维使用，网页端不接受密码重置参数）"""
    error = validate_password(password)
    if error:
        return None, error
    conn = _connect_direct()
    try:
        row = conn.execute(
            'SELECT id FROM users WHERE username = ?', (username.strip(),)
        ).fetchone()
        if row is None:
            return None, '用户不存在'
        conn.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            (generate_password_hash(password), row['id']),
        )
        conn.commit()
        updated = conn.execute(
            '''
            SELECT id, username, created_at, is_active, is_admin
              FROM users WHERE id = ?
            ''',
            (row['id'],),
        ).fetchone()
        return _user_dict(updated), None
    finally:
        conn.close()


def reset_password_by_user_id(user_id: int, password: str) -> tuple[bool, str | None]:
    """管理员在网页端重置指定用户密码（无需知道原密码）"""
    error = validate_password(password)
    if error:
        return False, error
    conn = get_db()
    conn.execute('BEGIN IMMEDIATE')
    try:
        row = conn.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
        if row is None:
            conn.rollback()
            return False, '用户不存在'
        conn.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            (generate_password_hash(password), user_id),
        )
        conn.commit()
        return True, None
    except Exception:
        conn.rollback()
        raise


def delete_user_by_username(username: str) -> tuple[bool, str | None]:
    """命令行删除用户（邀请码保留使用痕迹）"""
    conn = _connect_direct()
    try:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute(
            'SELECT id, is_active, is_admin FROM users WHERE username = ?', (username.strip(),)
        ).fetchone()
        if row is None:
            conn.rollback()
            return False, '用户不存在'
        if row['is_admin'] and row['is_active'] and _active_admin_count(conn) <= 1:
            conn.rollback()
            return False, '至少需要保留一名启用中的管理员'
        conn.execute('UPDATE invite_codes SET used_by = NULL WHERE used_by = ?', (row['id'],))
        conn.execute('DELETE FROM users WHERE id = ?', (row['id'],))
        conn.commit()
        return True, None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
