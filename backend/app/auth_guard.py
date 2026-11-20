"""
全站鉴权守卫：除公开接口外，所有 API 与下载接口都要求有效登录令牌。

令牌来源（按优先级）：
1. Authorization: Bearer <token>   —— 前端 axios 请求
2. httpOnly Cookie                  —— <video>/<track> 等浏览器直接发起的资源请求
3. ?token=<token> 查询参数          —— 需要显式传令牌的下载链接

公开接口：/api/health 与 /api/auth/*（注册/登录本身）。
"""
from flask import request

from app import auth
from app.config import Config

TOKEN_COOKIE_NAME = 'mi_token'


def _is_public(path: str) -> bool:
    if path == '/api/health':
        return True
    # 仅注册与登录公开；/me、/logout 仍需登录态
    if path in ('/api/auth/register', '/api/auth/login'):
        return True
    return False


def _protected(path: str) -> bool:
    """判断请求路径是否需要鉴权"""
    if path.startswith('/api/') or path.startswith('/downloads/'):
        return not _is_public(path)
    return False


def _extract_token() -> str | None:
    header = request.headers.get('Authorization', '')
    if header.lower().startswith('bearer '):
        return header[7:].strip()
    cookie_token = request.cookies.get(TOKEN_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    query_token = request.args.get('token')
    if query_token:
        return query_token
    return None


def register_auth_guard(app) -> None:
    @app.before_request
    def _auth_guard():
        path = request.path
        if not _protected(path):
            return None

        # 测试专用：允许既有业务测试在不带令牌的情况下访问接口
        if app.config.get('TESTING_SKIP_AUTH', False):
            return None

        user = auth.verify_token(_extract_token() or '', Config.TOKEN_MAX_AGE)
        if user is None:
            from app.utils.response import error_response
            return error_response('未登录或登录已过期，请重新登录', 401)

        request.current_user = user
        return None

    # 每个请求结束后关闭该请求的数据库连接
    app.teardown_appcontext(auth.close_db)
