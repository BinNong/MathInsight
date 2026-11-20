"""
账号系统与邀请码：数据持久化、密码哈希、签名令牌。

设计要点：
- SQLite（Python 标准库），单文件数据库，便于在自己的服务器上持久化与备份
- 密码使用 werkzeug 的 scrypt/pbkdf2 哈希，绝不明文存储
- 令牌使用 itsdangerous 签名（两者均为 Flask 自带依赖），无状态、可过期、不可伪造
- 注册必须提供有效且未使用的邀请码
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
    """建表（幂等）"""
    ensure_data_dir()
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                is_active     INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                code       TEXT PRIMARY KEY,
                note       TEXT,
                created_at TEXT NOT NULL,
                used_by    INTEGER,
                used_at    TEXT,
                FOREIGN KEY (used_by) REFERENCES users(id)
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


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
            'SELECT code, used_by FROM invite_codes WHERE code = ?', (invite_code,)
        ).fetchone()
        if code_row is None:
            conn.rollback()
            return None, '邀请码无效'
        if code_row['used_by'] is not None:
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
            'UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?',
            (user_id, _now(), invite_code),
        )
        conn.commit()
        user = conn.execute(
            'SELECT id, username, created_at FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        return dict(user), None
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
        'SELECT id, username, password_hash, is_active FROM users WHERE username = ?',
        (username.strip(),),
    ).fetchone()
    if row is None or not row['is_active']:
        return None, '用户名或密码错误'
    if not check_password_hash(row['password_hash'], password):
        return None, '用户名或密码错误'
    return {'id': row['id'], 'username': row['username']}, None


def user_by_id(user_id: int) -> dict | None:
    conn = get_db()
    row = conn.execute(
        'SELECT id, username, created_at FROM users WHERE id = ? AND is_active = 1',
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


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
        used = conn.execute('SELECT COUNT(*) FROM invite_codes WHERE used_by IS NOT NULL').fetchone()[0]
        users = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    finally:
        conn.close()
    return {'total': total, 'used': used, 'unused': total - used, 'users': users}
