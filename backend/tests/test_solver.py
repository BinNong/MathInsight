"""
数学解题助手路由测试
"""
import json
from unittest.mock import patch, MagicMock

import pytest

from app.services.solver_service import MathSolverService


class TestSolverAnalyzeEndpoint:
    """测试 /api/solver/analyze 端点"""

    def test_analyze_missing_problem(self, client):
        response = client.post('/api/solver/analyze', json={})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert '题目' in data['error']

    def test_analyze_empty_problem(self, client):
        response = client.post('/api/solver/analyze', json={'problem': '   '})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_analyze_problem_too_long(self, client):
        response = client.post('/api/solver/analyze', json={'problem': 'x' * 3000})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert '过长' in data['error']

    def test_analyze_success(self, client):
        mock_result = {
            'topic': 'derivative',
            'difficulty': 3,
            'restatement': '求函数 f(x)=x^2 在 x=2 处的导数',
            'prerequisites': ['导数定义'],
            'steps': [
                {
                    'index': 1,
                    'title': '写出导数定义',
                    'explanation': '根据导数定义...',
                    'formula': r'f\'(x_0)=\lim_{h\\to 0}\\frac{f(x_0+h)-f(x_0)}{h}',
                    'insight': '导数是切线斜率',
                    'common_pitfall': '注意 h 趋近于 0',
                }
            ],
            'final_answer': '4',
            'follow_up_questions': ['如何求高阶导数？'],
            'visualization_suggestions': [
                {'title': '切线动画', 'description': 'Show the tangent line of y=x^2 at x=2'}
            ],
        }

        with patch.object(MathSolverService, 'analyze_problem', return_value=mock_result):
            response = client.post('/api/solver/analyze', json={
                'problem': '求 f(x)=x^2 在 x=2 处的导数',
                'subject': 'calculus',
            })
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert data['data']['topic'] == 'derivative'
            assert len(data['data']['steps']) == 1


class TestSolverHintEndpoint:
    """测试 /api/solver/hint 端点"""

    def test_hint_missing_problem(self, client):
        response = client.post('/api/solver/hint', json={'current_step': 1, 'level': 1})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_hint_success(self, client):
        with patch.object(MathSolverService, 'get_hint', return_value='试着使用导数定义。'):
            response = client.post('/api/solver/hint', json={
                'problem': '求 f(x)=x^2 的导数',
                'current_step': 1,
                'level': 1,
            })
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert data['data']['hint'] == '试着使用导数定义。'


class TestSolverSimilarEndpoint:
    """测试 /api/solver/similar 端点"""

    def test_similar_missing_problem(self, client):
        response = client.post('/api/solver/similar', json={'topic': 'derivative'})
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False

    def test_similar_success(self, client):
        mock_problems = [
            {'problem': '求 f(x)=3x^2 的导数', 'topic': 'derivative', 'difficulty': 2, 'hint': None},
        ]
        with patch.object(MathSolverService, 'generate_similar', return_value=mock_problems):
            response = client.post('/api/solver/similar', json={
                'problem': '求 f(x)=x^2 的导数',
                'topic': 'derivative',
                'count': 1,
            })
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            assert len(data['data']['problems']) == 1


class TestSolverService:
    """测试 MathSolverService 核心逻辑"""

    def test_parse_json_with_code_block(self):
        service = MathSolverService(api_key='test')
        content = "```json\n{\"topic\": \"derivative\"}\n```"
        assert service._parse_json(content) == {'topic': 'derivative'}

    def test_parse_json_without_code_block(self):
        service = MathSolverService(api_key='test')
        content = '{"topic": "limit"}'
        assert service._parse_json(content) == {'topic': 'limit'}

    def test_parse_json_invalid_returns_none(self):
        service = MathSolverService(api_key='test')
        assert service._parse_json('not json') is None

    def test_fallback_result_structure(self):
        service = MathSolverService(api_key='test')
        result = service._fallback_analyze_result('test problem')
        assert result['topic'] == 'other'
        assert len(result['steps']) > 0
        assert 'follow_up_questions' in result

    def test_normalize_difficulty(self):
        service = MathSolverService(api_key='test')
        assert service._normalize_difficulty(0) == 1
        assert service._normalize_difficulty(6) == 5
        assert service._normalize_difficulty('abc') == 3
        assert service._normalize_difficulty(3) == 3
