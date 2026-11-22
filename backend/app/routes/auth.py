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
    confirm_password = data.get('confirm_password')

    # 前后端双保险：即使绕过页面直接调 API，两次密码不一致也不允许注册
    if confirm_password is not None and confirm_password != password:
        return error_response('两次输入的密码不一致', 400)

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


@auth_bp.route('/progress', methods=['GET'])
def get_progress():
    """获取当前用户的云端学习进度（掌握度 + 最近访问/收藏）"""
    user = getattr(request, 'current_user', None)
    if not user:
        return error_response('未登录或登录已过期', 401)
    record = auth.get_user_progress(user['id'])
    if record is None:
        return success_response(None)
    return success_response(record)


@auth_bp.route('/progress', methods=['PUT'])
def put_progress():
    """上报当前用户的学习进度。mastery/progress 为 JSON 字符串，限制大小防滥用。"""
    import json
    user = getattr(request, 'current_user', None)
    if not user:
        return error_response('未登录或登录已过期', 401)

    data = request.get_json(silent=True) or {}
    mastery = data.get('mastery')
    progress = data.get('progress')
    review = data.get('review', '{}')
    if not isinstance(mastery, str) or not isinstance(progress, str) or not isinstance(review, str):
        return error_response('mastery 与 progress 必须为 JSON 字符串')
    if (len(mastery) > auth.MAX_PROGRESS_JSON_LENGTH or
            len(progress) > auth.MAX_PROGRESS_JSON_LENGTH or
            len(review) > auth.MAX_PROGRESS_JSON_LENGTH):
        return error_response('进度数据过大')
    try:
        json.loads(mastery)
        json.loads(progress)
        json.loads(review)
    except (ValueError, TypeError):
        return error_response('进度数据不是合法 JSON')

    record = auth.save_user_progress(user['id'], mastery, progress, review)
    return success_response(record)


@auth_bp.route('/logout', methods=['POST'])
def logout():
    # 令牌为无状态签名，服务端无需额外操作；前端负责清除本地令牌。
    response, status = success_response({'ok': True})
    response.delete_cookie(TOKEN_COOKIE_NAME, path='/')
    return response, status


@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    """修改当前用户密码：需提供正确的当前密码与新密码"""
    user = getattr(request, 'current_user', None)
    if not user:
        return error_response('未登录或登录已过期', 401)

    data = request.get_json(silent=True) or {}
    ok, error = auth.change_password(
        int(user['id']),
        data.get('old_password', ''),
        data.get('new_password', ''),
    )
    if error:
        return error_response(error, 400)
    # 令牌仍然有效（签名只依赖 uid/u），前端无需重新登录
    return success_response({'ok': True})
