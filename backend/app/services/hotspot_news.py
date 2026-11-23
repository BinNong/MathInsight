"""
数说热点 · 新闻抓取与合规预筛。

从若干公开 RSS 源抓取近期条目，做题材归类、合规过滤与去重，产出供
内容生成流水线挑选的候选列表。仅用 Python 标准库（urllib + ElementTree），
不引入新依赖；抓取失败逐源降级，绝不影响主服务。

合规边界见 scripts/HOTSPOT_GUIDE.md 第一节：只保留科技/天文/生活/经济
等可数学化的中性现象，命中政治、社会争议、宗教、色情暴力、医疗与投资
建议等关键词的条目直接丢弃。
"""
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from email.utils import parsedate_to_datetime
from typing import Any

# 实测在部署服务器上可达的公开 RSS 源
RSS_FEEDS: list[dict[str, str]] = [
    {'name': 'Solidot', 'url': 'https://www.solidot.org/index.rss', 'category': '科技'},
    {'name': 'IT之家', 'url': 'https://www.ithome.com/rss/', 'category': '科技'},
    {'name': '36氪', 'url': 'https://36kr.com/feed', 'category': '经济'},
    {'name': '少数派', 'url': 'https://sspai.com/feed', 'category': '生活'},
    {'name': 'NASA', 'url': 'https://www.nasa.gov/rss/dyn/breaking_news.rss', 'category': '天文'},
]

# 命中即丢弃：政治、社会争议、宗教、色情暴力、未成年人负面、医疗与投资建议
BLOCK_KEYWORDS = [
    # 政治与选举
    '总统', '首相', '选举', '大选', '议会', '国会', '政府', '内阁', '外交', '制裁',
    '战争', '军事', '导弹', '入侵', '政变', '抗议', '游行', '示威', '政党', '两会',
    'Trump', 'Biden', 'Putin', 'election', 'war', 'military', 'sanction', 'president',
    # 社会争议与群体对立
    '维权', '罢工', '歧视', '性别对立', '地域歧视', '群体事件', '命案', '凶杀', '枪击',
    '诈骗', '传销', '涉黄', '嫖娼', '性侵', '猥亵', '强奸', '暴力', '恐怖袭击',
    # 宗教
    '宗教', '教会', '神职', '教派', '清真', '佛祖', '上帝', 'religion', 'church',
    # 医疗与投资建议
    '股市', 'A股', '涨停', '跌停', '基金推荐', '买入', '卖出', '投资建议', '彩礼',
    '治病', '治愈', '疗效', '特效药', '确诊', '癌症', '肿瘤', '抑郁症', '死亡率',
    # 未成年人负面
    '-child', '儿童失踪', '校园霸凌', '未成年犯罪',
]

# 正向题材提示词（用于给 LLM 的候选打分参考，非硬过滤）
TOPIC_HINTS = [
    '数学', '算法', '模型', '数据', '卫星', '行星', '望远镜', '宇宙', '机器人',
    '芯片', '计算', '物理', '实验', '研究', '论文', '发现', '测量', '统计',
    '夺冠', '纪录', '成绩', '比赛', '销量', '价格', '增长', '比例', '概率',
    'science', 'NASA', 'planet', 'telescope', 'research', 'study', 'discovery',
]

MAX_AGE_DAYS = 10
MAX_ITEMS_PER_FEED = 15
FETCH_TIMEOUT = 12


@dataclass
class NewsItem:
    title: str
    link: str
    summary: str
    date: str
    source: str
    category: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _strip_html(text: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', text or '')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _parse_date(raw: str) -> str | None:
    """解析 RSS 日期为 YYYY-MM-DD；解析失败返回 None。"""
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        return dt.strftime('%Y-%m-%d')
    except (TypeError, ValueError, OverflowError):
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', raw)
        return m.group(0) if m else None


def is_compliant(title: str, summary: str) -> tuple[bool, str]:
    """合规预筛：命中禁区关键词返回 (False, 原因)，否则 (True, '')。"""
    text = (title + ' ' + summary).lower()
    for kw in BLOCK_KEYWORDS:
        if kw.lower() in text:
            return False, f'命中禁区关键词: {kw}'
    return True, ''


def topic_score(title: str, summary: str) -> int:
    """题材相关度打分，便于优先挑可数学化的现象。"""
    text = (title + ' ' + summary).lower()
    return sum(1 for h in TOPIC_HINTS if h.lower() in text)


def fetch_feed(feed: dict[str, str], now: float | None = None) -> list[NewsItem]:
    """抓取单个 RSS 源，失败返回空列表（逐源降级）。"""
    now = now if now is not None else time.time()
    req = urllib.request.Request(
        feed['url'],
        headers={'User-Agent': 'MathInsight-HotspotBot/1.0 (+educational)'},
    )
    try:
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
    except Exception:
        return []

    out: list[NewsItem] = []
    for node in root.findall('.//item')[:MAX_ITEMS_PER_FEED]:
        title = _strip_html(node.findtext('title') or '')
        link = (node.findtext('link') or '').strip()
        summary = _strip_html(node.findtext('description') or '')
        date = _parse_date(node.findtext('pubDate') or '')
        if not title or not link or not date:
            continue
        # 只保留近 MAX_AGE_DAYS 天内的条目
        try:
            from datetime import datetime, timezone
            parsed = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - parsed).total_seconds() / 86400
            if age < -1 or age > MAX_AGE_DAYS:
                continue
        except ValueError:
            continue
        ok, _ = is_compliant(title, summary)
        if not ok:
            continue
        out.append(NewsItem(
            title=title, link=link, summary=summary[:400],
            date=date, source=feed['name'], category=feed['category'],
        ))
    return out


def fetch_candidates(
    feeds: list[dict[str, str]] | None = None,
    seen_titles: set[str] | None = None,
    now: float | None = None,
) -> list[NewsItem]:
    """抓取全部源、去重、按题材相关度与日期排序后返回候选。"""
    feeds = feeds if feeds is not None else RSS_FEEDS
    seen = seen_titles or set()
    collected: list[NewsItem] = []
    for feed in feeds:
        collected.extend(fetch_feed(feed, now=now))

    unique: dict[str, NewsItem] = {}
    for item in collected:
        key = re.sub(r'\W+', '', item.title.lower())
        if not key or key in seen:
            continue
        if key not in unique:
            unique[key] = item

    ranked = sorted(
        unique.values(),
        key=lambda it: (it.date, topic_score(it.title, it.summary)),
        reverse=True,
    )
    return ranked
