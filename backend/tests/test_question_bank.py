"""题库内容与主题映射测试"""
import json
from pathlib import Path

from app.services.question_bank_service import SOLVER_TOPIC_TO_QUIZ, get_question_bank


def _load():
    p = Path(__file__).resolve().parent.parent / 'app' / 'resources' / 'question_bank.json'
    return json.loads(p.read_text(encoding='utf-8'))


class TestQuestionBank:
    def test_covers_all_subjects(self):
        qs = _load()
        topics = {q['topic'] for q in qs}
        assert 'limit-calc' in topics and 'series' in topics  # 微积分
        assert {'matrix-basics', 'linear-systems', 'eigenvalues'} <= topics  # 线代
        assert {'probability-basics', 'distributions', 'central-limit', 'hypothesis-testing'} <= topics  # 概率

    def test_all_questions_well_formed(self):
        qs = _load()
        assert len(qs) >= 100
        ids = [q['id'] for q in qs]
        assert len(ids) == len(set(ids)), '题目 id 必须唯一'
        for q in qs:
            assert 0 <= q['answer'] < len(q['options']), q['id']
            assert len(q['options']) >= 2, q['id']
            assert q['explain'].strip(), q['id']

    def test_solver_mapping_resolves(self):
        bank = get_question_bank()
        for solver_topic in ('matrix', 'eigenvalue', 'linear-system', 'probability', 'distribution', 'hypothesis-test'):
            assert solver_topic in SOLVER_TOPIC_TO_QUIZ
            assert len(bank.similar(solver_topic, count=2)) >= 1
