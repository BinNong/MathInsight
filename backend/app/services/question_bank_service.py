"""结构化题库服务：让解题助手的相似题从真实题库检索，而非 LLM 现编。"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_BANK_PATH = Path(__file__).resolve().parent.parent / 'resources' / 'question_bank.json'

# 解题助手主题 → 题库知识点
SOLVER_TOPIC_TO_QUIZ = {
    'limit': ['limit-calc', 'limit-continuity'],
    'derivative': ['deriv-calc', 'deriv-app'],
    'integral': ['integral-indef', 'integral-def'],
    'taylor': ['series'],
    'series': ['series'],
}


class QuestionBank:
    def __init__(self) -> None:
        self._questions: List[Dict[str, Any]] = []
        try:
            with _BANK_PATH.open(encoding='utf-8') as fh:
                self._questions = json.load(fh)
        except (OSError, ValueError):
            logger.exception('加载题库失败：%s', _BANK_PATH)
            self._questions = []

    @property
    def size(self) -> int:
        return len(self._questions)

    def by_topics(self, topics: List[str]) -> List[Dict[str, Any]]:
        wanted = set(topics)
        return [q for q in self._questions if q.get('topic') in wanted]

    def similar(
        self,
        topic: str,
        count: int = 3,
        exclude: str | None = None,
    ) -> List[Dict[str, Any]]:
        """按主题检索相似题，返回带答案与解析的规范结构"""
        quiz_topics = SOLVER_TOPIC_TO_QUIZ.get(topic, [])
        pool = self.by_topics(quiz_topics)
        if exclude:
            pool = [q for q in pool if q.get('id') != exclude]
        if not pool:
            return []
        # 优先基础/进阶混合，保证题目质量梯度；简单轮转避免总出同一批
        pool = sorted(pool, key=lambda q: (q.get('difficulty', 2), q.get('id', '')))
        selected = pool[: max(1, min(count, len(pool)))]
        return [
            {
                'id': q['id'],
                'problem': q['q'],
                'topic': q['topic'],
                'difficulty': q.get('difficulty', 2),
                'options': q.get('options', []),
                'answer': q.get('answer'),
                'explanation': q.get('explain', ''),
                'source': 'bank',
            }
            for q in selected
        ]


_bank: QuestionBank | None = None


def get_question_bank() -> QuestionBank:
    global _bank
    if _bank is None:
        _bank = QuestionBank()
    return _bank
