"""
数学解题助手服务

基于 LLM 为学生提供结构化解题分析、渐进式提示与相似题推荐。
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

import anthropic

from app.config import Config

logger = logging.getLogger(__name__)

# 默认配置
DEFAULT_MODEL = Config.SOLVER_MODEL
DEFAULT_MAX_TOKENS = Config.SOLVER_MAX_TOKENS
DEFAULT_TEMPERATURE = Config.SOLVER_TEMPERATURE
DEFAULT_MAX_PROBLEM_LENGTH = Config.SOLVER_MAX_PROBLEM_LENGTH

# 支持的知识点标签
VALID_TOPICS = {
    "limit",
    "derivative",
    "integral",
    "taylor",
    "differential-equation",
    "multivariate",
    "vector-field",
    "line-integral",
    "surface-integral",
    "matrix",
    "eigenvalue",
    "linear-system",
    "probability",
    "distribution",
    "hypothesis-test",
    "optimization",
    "series",
    "other",
}


class MathSolverService:
    """数学解题助手服务类"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
    ):
        if not api_key:
            api_key = Config.get_llm_api_key()
        if not base_url:
            base_url = Config.get_anthropic_base_url()
        if not model:
            model = Config.SOLVER_MODEL or DEFAULT_MODEL

        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature

        default_headers = {"X-Api-Key": api_key} if api_key else None
        if base_url:
            self.client = anthropic.Anthropic(
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers,
            )
        else:
            self.client = anthropic.Anthropic(api_key=api_key)

    def analyze_problem(
        self,
        problem: str,
        subject_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        分析数学题目，返回结构化解题信息。

        Args:
            problem: 题目文本，支持自然语言与 LaTeX
            subject_hint: 学科提示（calculus / linear-algebra / probability / auto）

        Returns:
            包含 topic、difficulty、restatement、steps 等字段的字典
        """
        if not self.api_key:
            raise SolverConfigurationError("未配置 LLM API 密钥")

        prompt = self._build_analyze_prompt(problem, subject_hint)
        content = self._call_llm(
            system=(
                "你是一位耐心的高等数学教师，擅长把复杂题目拆解成清晰、可理解的步骤。"
                "你必须用中文回答，并严格按要求的 JSON 格式输出。"
            ),
            prompt=prompt,
        )
        result = self._parse_json(content)
        if result is None:
            result = self._fallback_analyze_result(problem)

        # 校验并规范 topic
        topic = result.get("topic", "other")
        if topic not in VALID_TOPICS:
            topic = "other"
            result["topic"] = topic

        # 保证 difficulty 为 1-5 的整数
        difficulty = result.get("difficulty")
        try:
            difficulty = max(1, min(5, int(difficulty)))
        except (TypeError, ValueError):
            difficulty = 3
        result["difficulty"] = difficulty

        # 规范 steps 字段
        steps = result.get("steps") or []
        if not isinstance(steps, list):
            steps = []
        normalized_steps = []
        for idx, step in enumerate(steps):
            if not isinstance(step, dict):
                continue
            normalized_steps.append({
                "index": idx + 1,
                "title": str(step.get("title", f"步骤 {idx + 1}")).strip() or f"步骤 {idx + 1}",
                "explanation": str(step.get("explanation", "")).strip(),
                "formula": str(step.get("formula", "")).strip() or None,
                "insight": str(step.get("insight", "")).strip(),
                "common_pitfall": str(step.get("common_pitfall", "")).strip() or None,
            })
        result["steps"] = normalized_steps

        # 规范其他字段
        result.setdefault("restatement", problem.strip())
        result.setdefault("prerequisites", [])
        result.setdefault("final_answer", "")
        result.setdefault("follow_up_questions", [])
        result.setdefault("visualization_suggestions", [])

        if not isinstance(result["prerequisites"], list):
            result["prerequisites"] = []
        if not isinstance(result["follow_up_questions"], list):
            result["follow_up_questions"] = []
        if not isinstance(result["visualization_suggestions"], list):
            result["visualization_suggestions"] = []

        # 清理可视化建议字段
        clean_suggestions = []
        for item in result["visualization_suggestions"]:
            if isinstance(item, dict) and item.get("description"):
                clean_suggestions.append({
                    "title": str(item.get("title", "可视化建议")).strip(),
                    "description": str(item["description"]).strip(),
                })
        result["visualization_suggestions"] = clean_suggestions

        return result

    def get_hint(self, problem: str, current_step: int, level: int) -> str:
        """
        根据当前解题进度返回渐进式提示。

        Args:
            problem: 原始题目
            current_step: 当前进行到的步骤索引（从 1 开始）
            level: 提示深度，1=思路提示，2=关键步骤，3=详细推导

        Returns:
            提示文本
        """
        if not self.api_key:
            raise SolverConfigurationError("未配置 LLM API 密钥")

        prompt = self._build_hint_prompt(problem, current_step, level)
        content = self._call_llm(
            system="你是一位耐心的数学教师。根据题目和当前进度，给出一句简短、精准的提示，帮助学生自己继续思考。",
            prompt=prompt,
        )
        if not content:
            return "请再仔细阅读题目，尝试从已知条件出发，写出你能想到的第一个等式或性质。"
        return content.strip()

    def generate_similar(
        self,
        problem: str,
        topic: str,
        count: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        基于原题生成相似练习题。

        Args:
            problem: 原始题目
            topic: 知识点标签
            count: 生成数量

        Returns:
            练习题列表，每项包含 problem、topic、difficulty
        """
        if not self.api_key:
            raise SolverConfigurationError("未配置 LLM API 密钥")

        count = max(1, min(5, int(count)))
        prompt = self._build_similar_prompt(problem, topic, count)
        content = self._call_llm(
            system=(
                "你是一位高等数学出题教师。请根据给定题目生成难度相近、知识点相同的练习题。"
                "必须严格按要求的 JSON 格式输出。"
            ),
            prompt=prompt,
        )
        result = self._parse_json(content)
        if result is None:
            return []

        problems = result.get("problems") or result.get("similar_problems") or []
        if not isinstance(problems, list):
            return []

        normalized = []
        for item in problems:
            if not isinstance(item, dict):
                continue
            normalized.append({
                "problem": str(item.get("problem", "")).strip(),
                "topic": topic,
                "difficulty": self._normalize_difficulty(item.get("difficulty")),
                "hint": str(item.get("hint", "")).strip() or None,
            })
        return normalized

    def _call_llm(self, system: str, prompt: str) -> Optional[str]:
        """调用 LLM 并返回文本内容"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
            )
            return self._extract_text_content(response)
        except Exception as e:
            logger.exception("LLM 调用失败")
            raise SolverLLMError(f"AI 服务调用失败: {type(e).__name__}") from e

    def _extract_text_content(self, response) -> Optional[str]:
        """从 Anthropic 响应中提取文本内容"""
        content = ""
        for block in response.content:
            if getattr(block, "type", None) == "text":
                content += block.text
        return content or None

    def _parse_json(self, content: Optional[str]) -> Optional[Dict[str, Any]]:
        """从 LLM 输出中解析 JSON"""
        if not content:
            return None

        # 优先匹配 ```json ... ``` 代码块
        match = re.search(r"```json\s*(.*?)\s*```", content, re.DOTALL)
        if match:
            json_str = match.group(1)
        else:
            # 尝试从整个内容中提取第一个 JSON 对象
            json_str = content

        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # 尝试用更宽松的方式提取 { ... } 或 [ ... ]
        for pattern in (r"\{.*\}", r"\[.*\]"):
            match = re.search(pattern, json_str, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    continue
        return None

    def _build_analyze_prompt(
        self,
        problem: str,
        subject_hint: Optional[str],
    ) -> str:
        subject_line = ""
        if subject_hint and subject_hint != "auto":
            subject_line = f"学科领域：{subject_hint}\n"

        return f"""请分析下面的高等数学题目，并给出结构化的解题引导。

{subject_line}题目：
{problem}

请严格按照以下 JSON 格式输出（不要输出任何其他内容）：
{{
  "topic": "知识点标签，可选值：limit/derivative/integral/taylor/differential-equation/multivariate/vector-field/line-integral/surface-integral/matrix/eigenvalue/linear-system/probability/distribution/hypothesis-test/optimization/series/other",
  "difficulty": 1-5 之间的整数,
  "restatement": "用更清晰的数学语言重述题目",
  "prerequisites": ["前置知识点1", "前置知识点2"],
  "steps": [
    {{
      "title": "步骤标题",
      "explanation": "该步骤的自然语言解释",
      "formula": "对应的 LaTeX 公式（可选）",
      "insight": "这一步的思路点拨",
      "common_pitfall": "常见错误提示（可选）"
    }}
  ],
  "final_answer": "最终答案的 LaTeX 形式",
  "follow_up_questions": ["追问1", "追问2"],
  "visualization_suggestions": [
    {{
      "title": "可视化标题",
      "description": "用于生成 Manim 动画的详细英文描述"
    }}
  ]
}}

要求：
1. 步骤要清晰、循序渐进，适合学生自学。
2. 每个步骤的 explanation 用中文，formula 用 LaTeX。
3. visualization_suggestions 的描述要用英文，便于直接交给 Manim 生成动画。
4. 只输出 JSON，不要输出 Markdown 表格、解释性文字或代码块标记之外的符号。"""

    def _build_hint_prompt(self, problem: str, current_step: int, level: int) -> str:
        level_desc = {
            1: "只给思路提示，不暴露具体公式或答案",
            2: "指出关键步骤或公式，但不展开完整计算",
            3: "给出较详细的推导提示",
        }.get(level, "给出思路提示")

        return f"""题目：
{problem}

学生目前进行到第 {current_step} 步，请给出一句 {level_desc}。

要求：
1. 用中文回答，语言亲切、鼓励思考。
2. 只输出提示文本，不要输出 JSON、Markdown 或其他格式。
3. 提示长度控制在 100 字以内。"""

    def _build_similar_prompt(
        self,
        problem: str,
        topic: str,
        count: int,
    ) -> str:
        return f"""请根据下面的高等数学题目，生成 {count} 道难度相近、知识点相同的练习题。

原题：
{problem}

知识点：{topic}

请严格按照以下 JSON 格式输出：
{{
  "problems": [
    {{
      "problem": "题目描述，支持 LaTeX",
      "difficulty": 1-5 整数,
      "hint": "解题提示（可选）"
    }}
  ]
}}

要求：
1. 新题目要在数字、函数或场景上有所变化，避免完全重复。
2. 只输出 JSON，不要输出其他内容。"""

    def _fallback_analyze_result(self, problem: str) -> Dict[str, Any]:
        """LLM 输出无法解析时的 fallback"""
        return {
            "topic": "other",
            "difficulty": 3,
            "restatement": problem.strip() or "未能识别题目",
            "prerequisites": [],
            "steps": [
                {
                    "index": 1,
                    "title": "重新描述题目",
                    "explanation": "请确认输入的题目是否完整、格式是否正确。",
                    "formula": None,
                    "insight": "清晰的问题描述是解题的第一步。",
                    "common_pitfall": "避免遗漏定义域、约束条件或特殊符号。",
                },
                {
                    "index": 2,
                    "title": "尝试手动分析",
                    "explanation": "AI 暂时无法给出结构化分析，建议先尝试列出已知条件和待求量。",
                    "formula": None,
                    "insight": "从结论倒推，寻找可用定理或公式。",
                    "common_pitfall": "不要过早代入数值，先明确变量关系。",
                },
            ],
            "final_answer": "",
            "follow_up_questions": ["能否重新输入题目？", "这道题的学科领域是什么？"],
            "visualization_suggestions": [],
        }

    @staticmethod
    def _normalize_difficulty(value: Any) -> int:
        try:
            return max(1, min(5, int(value)))
        except (TypeError, ValueError):
            return 3


class SolverConfigurationError(Exception):
    """解题助手配置错误"""


class SolverLLMError(Exception):
    """解题助手 LLM 调用错误"""
