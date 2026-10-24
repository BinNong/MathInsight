"""
知识图谱 API 路由

提供高等数学知识图谱的查询接口：
- 获取完整图谱
- 查询单个概念详情
- 计算到目标概念的学习路径
- 获取相关可视化模块
"""
from flask import Blueprint, request

from app.services.knowledge_graph_service import get_knowledge_graph_service
from app.utils.response import success_response, error_response

knowledge_graph_bp = Blueprint("knowledge_graph", __name__)


@knowledge_graph_bp.route("", methods=["GET"])
def get_graph():
    """GET /api/knowledge-graph

    返回完整知识图谱，包含学科、概念节点与前置知识边。
    """
    service = get_knowledge_graph_service()
    return success_response(service.get_graph())


@knowledge_graph_bp.route("/concepts/<concept_id>", methods=["GET"])
def get_concept(concept_id: str):
    """GET /api/knowledge-graph/concepts/<concept_id>

    返回单个概念的详情，包括前置概念、后继概念和相关可视化。
    """
    service = get_knowledge_graph_service()
    concept = service.get_concept(concept_id)
    if not concept:
        return error_response(f"未找到概念: {concept_id}", 404)
    return success_response(concept)


@knowledge_graph_bp.route("/path", methods=["GET"])
def get_learning_path():
    """GET /api/knowledge-graph/path?goal=<concept_id>

    计算从基础概念到目标概念的学习路径。
    """
    goal_id = request.args.get("goal", "").strip()
    if not goal_id:
        return error_response("请提供目标概念 ID（goal 参数）")

    service = get_knowledge_graph_service()
    path = service.get_learning_path(goal_id)
    if not path:
        return error_response(f"未找到目标概念: {goal_id}", 404)
    return success_response(path)


@knowledge_graph_bp.route("/related/<concept_id>", methods=["GET"])
def get_related(concept_id: str):
    """GET /api/knowledge-graph/related/<concept_id>

    返回与概念相关的可视化模块链接。
    """
    service = get_knowledge_graph_service()
    links = service.get_related_visualizations(concept_id)
    return success_response({"concept_id": concept_id, "links": links})
