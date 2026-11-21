"""
管理员路由：用户管理、邀请码管理与后台概览。

所有接口都要求登录且 is_admin=true；权限校验在路由层再次执行，
不依赖前端隐藏入口，避免直接调用 API 提权。
"""
from functools import wraps

from flask import Blueprint, request

from app import auth
from app.utils.response import success_response, error_response

admin_bp = Blueprint('admin', __name__)


def admin_required(view_func):
    """要求当前登录用户为管理员"""

    @wraps(view_func)
    def wrapped(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user:
            return error_response('未登录或登录已过期', 401)
        if not user.get('is_admin'):
            return error_response('需要管理员权限', 403)
        return view_func(*args, **kwargs)

    return wrapped


def _pagination():
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))
    except (TypeError, ValueError):
        return None, None, '分页参数必须是整数'
    return max(page, 1), min(max(page_size, 1), 100), None


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    return None


@admin_bp.route('/summary', methods=['GET'])
@admin_required
def summary():
    return success_response(auth.admin_summary())


@admin_bp.route('/users', methods=['GET'])
@admin_required
def users():
    page, page_size, error = _pagination()
    if error:
        return error_response(error, 400)
    include_inactive = request.args.get('include_inactive', 'true').lower() not in ('0', 'false', 'no')
    data = auth.list_users(
        query=request.args.get('q', ''),
        page=page,
        page_size=page_size,
        include_inactive=include_inactive,
    )
    return success_response(data)


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required
def user_detail(user_id):
    user = auth.get_user_detail(user_id)
    if user is None:
        return error_response('用户不存在', 404)
    return success_response(user)


@admin_bp.route('/users/<int:user_id>', methods=['PATCH'])
@admin_required
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    allowed = {'is_active', 'is_admin'}
    if not allowed.intersection(data):
        return error_response('没有可修改的字段', 400)

    fields = {}
    for key in allowed.intersection(data):
        value = _parse_bool(data[key])
        if value is None:
            return error_response(f'{key} 必须是布尔值', 400)
        fields[key] = value

    user, error = auth.set_user_flags(
        int(request.current_user['id']),
        user_id,
        **fields,
    )
    if error:
        return error_response(error, 400)
    return success_response(user)


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(user_id):
    """管理员重置指定用户密码，用于用户忘记密码的场景"""
    data = request.get_json(silent=True) or {}
    ok, error = auth.reset_password_by_user_id(user_id, data.get('new_password', ''))
    if error:
        return error_response(error, 400)
    return success_response({'ok': True})


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def remove_user(user_id):
    ok, error = auth.delete_user(int(request.current_user['id']), user_id)
    if error:
        return error_response(error, 400)
    return success_response({'id': user_id, 'deleted': True})


@admin_bp.route('/invites', methods=['GET'])
@admin_required
def invites():
    page, page_size, error = _pagination()
    if error:
        return error_response(error, 400)
    data = auth.list_invites(query=request.args.get('q', ''), page=page, page_size=page_size)
    return success_response(data)


@admin_bp.route('/invites', methods=['POST'])
@admin_required
def create_invites():
    data = request.get_json(silent=True) or {}
    try:
        count = int(data.get('count', 1))
    except (TypeError, ValueError):
        return error_response('生成数量必须是整数', 400)
    if count < 1 or count > 100:
        return error_response('生成数量需在 1 到 100 之间', 400)

    note = data.get('note')
    if note is not None:
        if not isinstance(note, str):
            return error_response('备注必须是字符串', 400)
        note = note.strip()[:200] or None

    codes = auth.create_invite_codes(count, note)
    return success_response({'codes': codes, 'count': len(codes)}, 201)


@admin_bp.route('/invites/<code>', methods=['DELETE'])
@admin_required
def revoke_invite(code):
    ok, error = auth.revoke_invite(code)
    if error:
        return error_response(error, 400)
    return success_response({'code': code.upper(), 'revoked': True})
