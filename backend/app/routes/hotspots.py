"""数说热点 API：列表、详情、筛选项与内容校验。"""
from flask import Blueprint, request

from app.services.hotspot_service import get_hotspot_service
from app.routes.admin import admin_required
from app.utils.response import error_response, success_response

hotspots_bp = Blueprint('hotspots', __name__)


@hotspots_bp.route('', methods=['GET'])
def list_hotspots():
    """GET /api/hotspots?branch=&category=&search=&limit=

    返回解读卡片列表（不含图表数据），按日期倒序。
    """
    service = get_hotspot_service()
    branch = request.args.get('branch', 'all').strip()
    category = request.args.get('category', 'all').strip()
    search = request.args.get('search', '').strip() or None
    try:
        limit = int(request.args.get('limit', '0'))
    except ValueError:
        limit = 0
    items = service.list_items(
        branch=branch, category=category, search=search,
        limit=limit if limit > 0 else None,
    )
    return success_response({'items': items, 'total': len(items)})


@hotspots_bp.route('/meta', methods=['GET'])
def get_meta():
    """GET /api/hotspots/meta — 返回总数、可筛选分支/分类与最新日期。"""
    return success_response(get_hotspot_service().meta())


# -------- 自动生成管理接口（管理员） --------

@hotspots_bp.route('/admin/status', methods=['GET'])
@admin_required
def auto_status():
    """GET /api/hotspots/admin/status — 自动生成调度器运行状态。"""
    from app.services.hotspot_scheduler import get_hotspot_scheduler
    return success_response(get_hotspot_scheduler().status())


@hotspots_bp.route('/admin/log', methods=['GET'])
@admin_required
def auto_log():
    """GET /api/hotspots/admin/log?limit=80 — 查看生成日志。"""
    from app.services.hotspot_scheduler import get_hotspot_scheduler
    try:
        limit = min(max(int(request.args.get('limit', 80)), 1), 400)
    except ValueError:
        limit = 80
    return success_response({'lines': get_hotspot_scheduler().read_log(limit)})


@hotspots_bp.route('/admin/run', methods=['POST'])
@admin_required
def auto_run():
    """POST /api/hotspots/admin/run — 手动触发一次生成（用于验证/补更）。"""
    from app.services.hotspot_scheduler import get_hotspot_scheduler
    result = get_hotspot_scheduler().run_once()
    if not result.get('ok'):
        return error_response(result.get('reason', '生成失败'), 500)
    return success_response(result)


@hotspots_bp.route('/<item_id>', methods=['GET'])
def get_hotspot(item_id: str):
    """GET /api/hotspots/<id> — 返回单篇完整内容（含可视化配置）。"""
    item = get_hotspot_service().get_item(item_id)
    if not item:
        return error_response(f'未找到热点解读: {item_id}', 404)
    return success_response(item)
