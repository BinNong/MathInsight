"""
知识图谱路由与服务测试
"""
import pytest

from app.services.knowledge_graph_service import (
    KnowledgeGraphService,
    get_knowledge_graph_service,
)


class TestKnowledgeGraphEndpoints:
    """测试 /api/knowledge-graph 端点"""

    def test_get_graph(self, client):
        response = client.get('/api/knowledge-graph')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'nodes' in data['data']
        assert 'edges' in data['data']
        assert 'subjects' in data['data']
        assert data['data']['meta']['concept_count'] > 0
        assert data['data']['meta']['edge_count'] > 0

    def test_get_concept_success(self, client):
        response = client.get('/api/knowledge-graph/concepts/derivative-definition')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['id'] == 'derivative-definition'
        assert 'prerequisites' in data['data']
        assert 'next_concepts' in data['data']
        assert 'visualizations' in data['data']

    def test_get_concept_not_found(self, client):
        response = client.get('/api/knowledge-graph/concepts/not-exist')
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False

    def test_get_learning_path_success(self, client):
        response = client.get('/api/knowledge-graph/path?goal=derivative-definition')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['goal_id'] == 'derivative-definition'
        path = data['data']['path']
        assert len(path) > 0
        assert path[-1]['id'] == 'derivative-definition'
        # 路径起点应为基础概念
        assert path[0]['id'] in {'functions', 'limit-function'}

    def test_get_learning_path_missing_goal(self, client):
        response = client.get('/api/knowledge-graph/path')
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_get_learning_path_not_found(self, client):
        response = client.get('/api/knowledge-graph/path?goal=not-exist')
        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False

    def test_get_related_visualizations(self, client):
        response = client.get('/api/knowledge-graph/related/derivative-definition')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['concept_id'] == 'derivative-definition'
        assert len(data['data']['links']) > 0


class TestKnowledgeGraphService:
    """测试 KnowledgeGraphService 核心逻辑"""

    def test_singleton(self):
        s1 = get_knowledge_graph_service()
        s2 = get_knowledge_graph_service()
        assert s1 is s2

    def test_graph_structure(self):
        service = KnowledgeGraphService()
        graph = service.get_graph()
        assert len(graph['nodes']) > 30
        assert len(graph['edges']) > 0
        node_ids = {n['id'] for n in graph['nodes']}
        for edge in graph['edges']:
            assert edge['source'] in node_ids
            assert edge['target'] in node_ids

    def test_concept_prerequisites_and_next(self):
        service = KnowledgeGraphService()
        concept = service.get_concept('derivative-definition')
        assert concept is not None
        prereq_ids = {p['id'] for p in concept['prerequisites']}
        assert 'limit-function' in prereq_ids
        next_ids = {n['id'] for n in concept['next_concepts']}
        assert 'derivative-rules' in next_ids

    def test_learning_path(self):
        service = KnowledgeGraphService()
        result = service.get_learning_path('taylor')
        assert result is not None
        path_ids = [c['id'] for c in result['path']]
        assert path_ids[-1] == 'taylor'
        assert 'derivative-rules' in path_ids

    def test_learning_path_not_found(self):
        service = KnowledgeGraphService()
        assert service.get_learning_path('not-exist') is None

    def test_related_visualizations(self):
        service = KnowledgeGraphService()
        links = service.get_related_visualizations('limit-function')
        assert any(link['path'] == '/limit' for link in links)
