"""
数说热点 · 内容自动生成流水线。

流程：候选新闻 → LLM 产出「文字骨架（含 {{key}} 占位符）+ 计算配方参数」
      → Python 用配方实算数值与图表 → 回填占位符 → 校验 → 完整 JSON。

设计要点：
1. LLM 绝不写具体数值，也不写图表数据；数值一律来自 hotspot_recipes 的实算结果。
2. 合规边界、字段规范、概念/模块白名单来自 scripts/HOTSPOT_GUIDE.md。
3. 近 N 篇去重、数学分支轮换；宁缺毋滥，任一步失败即跳过本次。
"""
import json
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import anthropic
import openai

from app.config import Config
from app.services.hotspot_news import NewsItem
from app.services.hotspot_recipes import RECIPES, run_recipe

# 白名单（与 HOTSPOT_GUIDE.md 保持一致）
VALID_CONCEPTS = set('''functions trigonometry exponential-log sequences limit-sequence limit-function
epsilon-delta continuity derivative-definition derivative-rules higher-derivatives
differential mean-value-theorem lhopital taylor function-analysis indefinite-integral
definite-integral fundamental-theorem integration-techniques improper-integral
numerical-integration riemann-sum series power-series multivariate-function
partial-derivative total-differential multiple-integral line-integral surface-integral
green-theorem gauss-theorem stokes-theorem vectors matrices determinants linear-systems
vector-spaces eigenvalues quadratic-forms probability-basics random-variables
distributions expectation-variance law-of-large-numbers central-limit-theorem
parameter-estimation ode-basics direction-field eigenvectors hypothesis-testing'''.split())

VALID_MODULES = set('''/limit /derivative /taylor /matrix /probability /clt /distributions /integration
/multivariate /vector-field /vector-field-3d /surface-integral /gauss-theorem
/direction-field /eigenvalues /hypothesis-test'''.split())

VALID_BRANCHES = {'calculus', 'linear-algebra', 'probability', 'statistics'}
VALID_CATEGORIES = {'科技', '天文', '体育', '生活', '社会', '经济'}

BRANCH_CN = {
    'calculus': '微积分', 'linear-algebra': '线性代数',
    'probability': '概率', 'statistics': '统计',
}

DEFAULT_MODEL = 'deepseek-v4-pro'
# DeepSeek 等推理模型的 thinking 也计入 max_tokens，需留足余量避免 JSON 被截断
MAX_TOKENS = 12000


class GenerationError(Exception):
    """生成失败或校验不通过，调用方应跳过本次而不发布。"""


@dataclass
class GenerationResult:
    item: dict[str, Any]
    source_news: NewsItem
    recipe_id: str


def _build_recipe_catalog(allowed_branches: set[str]) -> str:
    lines = []
    for rid, r in RECIPES.items():
        if r['branch'] not in allowed_branches:
            continue
        lines.append(
            f"- 配方 id={rid}｜分支={r['branch']}｜适用:{r['label']}\n"
            f"    params 需要:{r['params']}\n"
            f"    可用占位符(只能用这些，数值由 Python 实算):{r['facts']}"
        )
    return '\n'.join(lines)


def _build_prompt(
    candidates: list[NewsItem],
    recent: list[dict[str, Any]],
    allowed_branches: set[str],
    extra_instructions: str = '',
) -> tuple[str, str]:
    news_lines = []
    for i, n in enumerate(candidates):
        news_lines.append(
            f"[{i}] {n.title}\n"
            f"    摘要: {n.summary}\n"
            f"    日期: {n.date}  来源: {n.source}  分类: {n.category}\n"
            f"    链接: {n.link}"
        )
    recent_lines = []
    for it in recent:
        recent_lines.append(f"- {it.get('id')} | {it.get('headline')} | 分支 {it.get('branch')}")

    system = f"""你是 MathInsight 数学教学平台的「数说热点」内容编辑。任务：用大学数学（微积分/线性代数/概率统计）解读一条真实、中性的新闻现象。

【硬性合规边界，违反即作废】
- 只选科技、天文、体育、生活消费、经济数据等可数学化的中性现象。
- 禁止：政治人物与事件、社会争议与群体对立、宗教、色情暴力、未成年人负面、医疗与投资建议、任何造谣或引战内容。
- 只做数学解释，不对事件本身做价值判断。不编造事实：summary 只能复述给定新闻的摘要。
- 宁缺毋滥：若候选里没有能用某一个核心数学概念讲清楚的现象，返回 {{"skip": true, "reason": "..."}}。

【最重要的规则：不许自己写数值】
- 你输出的文字里，凡是概率、百分比、拟合参数、倍数、期望、特征值等数值，一律用占位符 {{{{key}}}} 表示，例如「命中率约 {{{{p_at_least_k}}}}」。
- 占位符的 key 必须来自你所选配方列出的「可用占位符」，不得杜撰。
- 图表数据、公式里的具体数字之外的统计量，都不由你写。公式本身可以用通用数学符号。
- 教学示意数据要在正文与图注语境里体现「示意」二字（图注由系统生成，正文你需在合适处点明这是教学示意）。

【数学分支】本次只允许使用这些分支: {', '.join(sorted(allowed_branches))}。
【可用计算配方】
{_build_recipe_catalog(allowed_branches)}

【输出格式】只输出一个 JSON 对象，不要 markdown 代码块，不要多余文字。字段：
{{
  "skip": false,
  "news_index": 选中的候选编号(整数),
  "recipe_id": "选用的配方 id",
  "params": {{ 传给该配方的参数对象 }},
  "id": "hot-YYYYMMDD-英文短名",
  "date": "事件日期 YYYY-MM-DD",
  "category": "科技/天文/体育/生活/经济 之一",
  "branch": "所选配方的分支",
  "topic": "具体数学话题，如 二项分布与期望",
  "headline": "问句或反差句标题，有钩子",
  "summary": "2-4 句现象描述，只复述给定新闻摘要中的可核实事实，不含占位符",
  "question": "一句引导性问题",
  "concept": "核心数学概念名",
  "formula": "LaTeX 公式，用通用符号，不要塞具体数字",
  "formula_note": "逐个符号解释公式，可用占位符",
  "steps": [
    {{"title":"1 · 小标题","body":"2-4句，含占位符"}},
    {{"title":"2 · 小标题","body":"2-4句"}},
    {{"title":"3 · 小标题","body":"2-4句"}}
  ],
  "insight": "一句让人记住的结论",
  "figure_caption_extra": "可选，一句话点明图在讲什么（系统会补上示意说明）",
  "try_it": {{"text":"思考题，可用占位符","answer":"参考答案，含推理过程，可用占位符"}},
  "concepts": ["知识图谱概念 id 数组，只能来自白名单"],
  "modules": ["实验路由数组，只能来自白名单"],
  "source": "来源说明，如 科技新闻：媒体名（YYYY-MM）",
  "tags": ["3-5 个短标签"]
}}

【concepts 白名单】{', '.join(sorted(VALID_CONCEPTS))}
【modules 白名单】{', '.join(sorted(VALID_MODULES))}

【最近 3 篇（避免选题重复）】
{chr(10).join(recent_lines) if recent_lines else '（无）'}
{extra_instructions}
"""
    user = '候选新闻：\n' + '\n'.join(news_lines)
    return system, user


class HotspotGenerator:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        llm_client: Any | None = None,
        protocol: str | None = None,
    ):
        self.protocol = (protocol or Config.HOTSPOT_LLM_PROTOCOL or 'anthropic').lower()
        self.api_key = api_key or (
            Config.HOTSPOT_LLM_API_KEY or Config.get_llm_api_key()
        )
        self.model = model or Config.HOTSPOT_MODEL or Config.ANTHROPIC_MODEL or DEFAULT_MODEL
        if self.protocol == 'openai':
            self.base_url = base_url or Config.HOTSPOT_LLM_BASE_URL or Config.OPENAI_BASE_URL
        else:
            self.base_url = base_url or Config.get_anthropic_base_url()

        if llm_client is not None:
            self.client = llm_client
        else:
            if not self.api_key:
                raise GenerationError('未配置 LLM API 密钥，无法自动生成内容')
            if self.protocol == 'openai':
                # OpenAI 兼容端点（含高校/第三方网关），走 chat/completions
                if self.base_url:
                    self.client = openai.OpenAI(api_key=self.api_key, base_url=self.base_url)
                else:
                    self.client = openai.OpenAI(api_key=self.api_key)
            else:
                headers = {'X-Api-Key': self.api_key} if self.api_key else None
                if self.base_url:
                    self.client = anthropic.Anthropic(
                        api_key=self.api_key, base_url=self.base_url, default_headers=headers)
                else:
                    self.client = anthropic.Anthropic(api_key=self.api_key)

    def _call_anthropic(self, system: str, user: str, max_tokens: int) -> tuple[str, str | None]:
        kwargs = dict(
            model=self.model, max_tokens=max_tokens,
            system=system, messages=[{'role': 'user', 'content': user}],
        )
        try:
            # 部分兼容端点/旧版 SDK 不接受 temperature，失败时自动回退
            resp = self.client.messages.create(temperature=0.4, **kwargs)
        except TypeError as e:
            if 'temperature' not in str(e):
                raise
            resp = self.client.messages.create(**kwargs)
        text = ''.join(
            block.text for block in resp.content if getattr(block, 'type', '') == 'text'
        )
        return text.strip(), getattr(resp, 'stop_reason', None)

    def _call_openai(self, system: str, user: str, max_tokens: int) -> tuple[str, str | None]:
        """OpenAI 兼容端点。推理模型常把思考放在 reasoning_content 里，只取正式 content。"""
        kwargs: dict[str, Any] = dict(
            model=self.model, max_tokens=max_tokens,
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
        )
        try:
            resp = self.client.chat.completions.create(temperature=0.4, **kwargs)
        except TypeError as e:
            if 'temperature' not in str(e):
                raise
            resp = self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        finish = getattr(choice, 'finish_reason', None)
        content = choice.message.content or ''
        # 部分推理模型 content 为空、答案在 reasoning_content，兜底取之
        if not content:
            content = getattr(choice.message, 'reasoning_content', '') or ''
        return (content or '').strip(), finish

    def _call_llm(self, system: str, user: str) -> str:
        call = self._call_openai if self.protocol == 'openai' else self._call_anthropic
        text, stop = call(system, user, MAX_TOKENS)
        if stop in ('length', 'max_tokens'):
            # 推理模型的 thinking 可能吃掉额度，翻倍重试一次
            text, stop = call(system, user, MAX_TOKENS * 2)
        return text

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        text = text.strip()
        if text.startswith('```'):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
        start, end = text.find('{'), text.rfind('}')
        if start < 0 or end <= start:
            raise GenerationError('LLM 未返回 JSON 对象')
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError as e:
            raise GenerationError(f'LLM 返回 JSON 解析失败: {e}')

    @staticmethod
    def _fill_placeholders(obj: Any, facts: dict[str, str], unknown: set[str] | None = None) -> Any:
        if isinstance(obj, str):
            def repl(m: re.Match) -> str:
                key = m.group(1).strip()
                if key not in facts:
                    if unknown is not None:
                        unknown.add(key)
                        return m.group(0)
                    raise GenerationError(f'未知占位符: {{{{{key}}}}}')
                return facts[key]
            return re.sub(r'\{\{([^{}]+)\}\}', repl, obj)
        if isinstance(obj, list):
            return [HotspotGenerator._fill_placeholders(v, facts) for v in obj]
        if isinstance(obj, dict):
            return {k: HotspotGenerator._fill_placeholders(v, facts) for k, v in obj.items()}
        return obj

    @staticmethod
    def _validate_draft(draft: dict[str, Any], allowed_branches: set[str]) -> list[str]:
        errors: list[str] = []
        if draft.get('concepts') and not set(draft['concepts']) <= VALID_CONCEPTS:
            bad = set(draft['concepts']) - VALID_CONCEPTS
            errors.append(f'concepts 越界: {sorted(bad)}')
        if draft.get('modules') and not set(draft['modules']) <= VALID_MODULES:
            bad = set(draft['modules']) - VALID_MODULES
            errors.append(f'modules 越界: {sorted(bad)}')
        if draft.get('category') not in VALID_CATEGORIES:
            errors.append(f'分类非法: {draft.get("category")}')
        steps = draft.get('steps')
        if not isinstance(steps, list) or len(steps) != 3:
            errors.append('steps 必须恰好 3 项')
        else:
            for s in steps:
                if not s.get('title') or not s.get('body'):
                    errors.append('steps 存在空项')
        if not re.match(r'^hot-\d{8}-[a-z0-9-]+$', str(draft.get('id', ''))):
            errors.append(f'id 格式非法: {draft.get("id")}')
        return errors

    def generate(
        self,
        candidates: list[NewsItem],
        recent: list[dict[str, Any]],
        allowed_branches: set[str] | None = None,
        source_override: str | None = None,
    ) -> GenerationResult:
        allowed_branches = allowed_branches or VALID_BRANCHES
        if not candidates:
            raise GenerationError('没有可用候选新闻')

        system, user = _build_prompt(candidates, recent, allowed_branches)
        raw = self._call_llm(system, user)
        draft = self._extract_json(raw)

        if draft.get('skip'):
            raise GenerationError(f'LLM 主动跳过: {draft.get("reason", "无合适选题")}')

        # 选中新闻
        try:
            idx = int(draft['news_index'])
            news = candidates[idx]
        except (KeyError, ValueError, IndexError, TypeError):
            raise GenerationError('news_index 非法')

        recipe_id = str(draft.get('recipe_id', ''))
        if recipe_id not in RECIPES:
            raise GenerationError(f'未知配方: {recipe_id}')
        if RECIPES[recipe_id]['branch'] not in allowed_branches:
            raise GenerationError('所选配方分支不在允许范围')

        # 草稿校验（白名单等）
        errs = self._validate_draft(draft, allowed_branches)
        if errs:
            raise GenerationError('草稿校验失败: ' + '; '.join(errs))

        # Python 实算：数值 + 图表
        try:
            result = run_recipe(recipe_id, draft.get('params') or {})
        except Exception as e:
            raise GenerationError(f'计算配方执行失败: {e}')

        # 回填占位符
        text_fields = ['summary', 'question', 'concept', 'formula_note', 'steps',
                       'insight', 'try_it', 'headline', 'topic']
        filled = dict(draft)
        unknown: set[str] = set()
        for key in text_fields:
            if key in filled:
                filled[key] = self._fill_placeholders(filled[key], result.facts, unknown)

        # 残留占位符检查
        blob = json.dumps(filled, ensure_ascii=False)
        if '{{' in blob:
            raise GenerationError(
                f'回填后仍有未解析的占位符: {sorted(unknown)}；'
                f'本配方可用 key: {sorted(result.facts)}'
            )

        # 组装完整条目
        caption = result.caption
        extra = filled.get('figure_caption_extra', '')
        if extra:
            caption = f'{extra}（{caption}）'
        item = {
            'id': filled['id'],
            'date': filled.get('date') or news.date,
            'category': filled['category'],
            'branch': RECIPES[recipe_id]['branch'],
            'topic': filled['topic'],
            'headline': filled['headline'],
            'summary': filled['summary'],
            'question': filled['question'],
            'concept': filled['concept'],
            'formula': filled['formula'],
            'formula_note': filled['formula_note'],
            'steps': filled['steps'],
            'insight': filled['insight'],
            'figure': result.figure,
            'figure_caption': caption,
            'try_it': filled['try_it'],
            'concepts': filled['concepts'],
            'modules': filled['modules'],
            'source': source_override or filled.get('source') or f'{news.source}（{news.date[:7]}）',
            'source_url': news.link,
            'tags': filled['tags'],
        }
        # figure_caption_extra 不属于内容 schema，剔除
        return GenerationResult(item=item, source_news=news, recipe_id=recipe_id)
