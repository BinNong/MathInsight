"""
认证路由：注册（需邀请码）、登录、当前用户、登出。

统一响应结构由 app.utils.response 提供，与其他业务路由保持一致。
"""
from flask import Blueprint, request, current_app

from app import auth
from app.auth_guard import TOKEN_COOKIE_NAME
from app.config import Config
from app.utils.response import success_response, error_response

auth_bp = Blueprint('auth', __name__)


def _auth_payload(token: str, user: dict, status_code: int = 200):
    """构造登录成功响应，同时写入 httpOnly Cookie 供媒体资源请求使用。"""
    response, status = success_response({'token': token, 'user': user}, status_code)
    response.set_cookie(
        TOKEN_COOKIE_NAME,
        token,
        max_age=Config.TOKEN_MAX_AGE,
        httponly=True,
        samesite='Lax',
        secure=not Config.FLASK_DEBUG,  # 生产(HTTPS)开启 Secure；本地开发关闭
        path='/',
    )
    return response, status


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '')
    password = data.get('password', '')
    invite_code = data.get('invite_code', '')

    user, error = auth.create_user(username, password, invite_code)
    if error:
        return error_response(error, 400)

    token = auth.issue_token(user)
    return _auth_payload(token, user, 201)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username', '')
    password = data.get('password', '')

    user, error = auth.authenticate(username, password)
    if error:
        return error_response(error, 401)

    token = auth.issue_token(user)
    return _auth_payload(token, user)


@auth_bp.route('/me', methods=['GET'])
def me():
    user = getattr(request, 'current_user', None)
    if not user:
        return error_response('未登录或登录已过期', 401)
    return success_response(user)


@auth_bp.route('/logout', methods=['POST'])
def logout():
    # 令牌为无状态签名，服务端无需额外操作；前端负责清除本地令牌。
    response, status = success_response({'ok': True})
    response.delete_cookie(TOKEN_COOKIE_NAME, path='/')
    return response, status
