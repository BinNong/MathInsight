"""
数说热点：实时热点 × 数学解读内容服务。

内容存放在 backend/app/resources/hotspots.json，每周由 AI 生成流程追加。
本服务只做读取、筛选与校验，不修改内容文件（内容生产走独立流程，避免
运行期写文件带来的并发与权限问题）。
"""
import json
import os
from pathlib import Path
from threading import Lock
from typing import Any

# 种子内容（随代码打包，首次部署用）
SEED_PATH = Path(__file__).resolve().parent.parent / 'resources' / 'hotspots.json'
# 运行时内容库：挂载在 /app/data，可由内容更新流程热替换而不必重启容器
DATA_PATH = Path(os.environ.get('HOTSPOTS_DATA_DIR', '/app/data')) / 'hotspots.json'
if not os.environ.get('HOTSPOTS_DATA_DIR') and not Path('/app/data').exists():
    # 本地开发（无挂载卷）直接读种子文件
    DATA_PATH = SEED_PATH

VALID_BRANCHES = {'calculus', 'linear-algebra', 'probability', 'statistics'}
VALID_CATEGORIES = {'科技', '天文', '体育', '生活', '社会', '经济'}


class HotspotService:
    """热点内容库：加载后缓存，文件更新时按 mtime 自动重载。"""

    def __init__(self, path: Path | None = None):
        self._path = path or DATA_PATH
        self._items: list[dict[str, Any]] = []
        self._mtime: float = 0.0
        self._lock = Lock()
        self._load(force=True)

    def _load(self, force: bool = False) -> None:
        if not self._path.exists():
            # 首次运行：把种子内容复制到可写数据目录，之后自动化流程可热更新该文件
            if self._path.parent.exists() and SEED_PATH.exists() and self._path != SEED_PATH:
                try:
                    self._path.write_bytes(SEED_PATH.read_bytes())
                except OSError:
                    pass
            if not self._path.exists():
                with self._lock:
                    self._items = []
                return
        mtime = self._path.stat().st_mtime
        if not force and mtime == self._mtime:
            return
        with self._lock:
            with open(self._path, encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, list):
                raise ValueError('hotspots.json 顶层必须是数组')
            self._items = data
            self._mtime = mtime

    def list_items(
        self,
        branch: str | None = None,
        category: str | None = None,
        search: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """返回摘要列表（不含 figure 大对象），按日期倒序。"""
        self._load()
        items = self._items
        if branch and branch != 'all':
            items = [it for it in items if it.get('branch') == branch]
        if category and category != 'all':
            items = [it for it in items if it.get('category') == category]
        if search:
            q = search.lower()
            items = [it for it in items
                     if q in (it.get('headline', '') + it.get('summary', '')
                              + ' '.join(it.get('tags', []))).lower()]
        items = sorted(items, key=lambda it: it.get('date', ''), reverse=True)
        result = [self.to_summary(it) for it in items]
        return result[:limit] if limit else result

    @staticmethod
    def to_summary(item: dict[str, Any]) -> dict[str, Any]:
        """列表卡片用的精简视图，避免把图表数据传到列表页。"""
        return {
            'id': item.get('id'),
            'date': item.get('date'),
            'category': item.get('category'),
            'branch': item.get('branch'),
            'topic': item.get('topic'),
            'headline': item.get('headline'),
            'summary': item.get('summary'),
            'concepts': item.get('concepts', []),
            'modules': item.get('modules', []),
            'tags': item.get('tags', []),
        }

    def get_item(self, item_id: str) -> dict[str, Any] | None:
        """返回完整内容（含可视化配置与思考题）。"""
        self._load()
        return next((it for it in self._items if it.get('id') == item_id), None)

    def meta(self) -> dict[str, Any]:
        """返回筛选选项与统计，供首页/列表页展示。"""
        self._load()
        branches = sorted({it.get('branch') for it in self._items if it.get('branch')})
        categories = sorted({it.get('category') for it in self._items if it.get('category')})
        return {
            'total': len(self._items),
            'branches': branches,
            'categories': categories,
            'latest_date': max((it.get('date', '') for it in self._items), default=''),
        }

    @staticmethod
    def validate_item(item: dict[str, Any]) -> list[str]:
        """校验单条内容的必填字段与取值（供内容生成流程与测试使用）。"""
        errors: list[str] = []
        required = [
            'id', 'date', 'category', 'branch', 'topic', 'headline',
            'summary', 'question', 'concept', 'formula', 'formula_note',
            'steps', 'insight', 'figure', 'figure_caption', 'try_it',
            'concepts', 'modules', 'source', 'tags',
        ]
        for key in required:
            if key not in item or item[key] in (None, '', []):
                errors.append(f'缺少字段: {key}')
        if item.get('branch') and item['branch'] not in VALID_BRANCHES:
            errors.append(f'未知数学分支: {item["branch"]}')
        if item.get('category') and item['category'] not in VALID_CATEGORIES:
            errors.append(f'未知分类: {item["category"]}')
        figure = item.get('figure')
        if isinstance(figure, dict):
            allowed = {'scatter', 'bar', 'contour', 'heatmap'}
            for trace in figure.get('data', []):
                if trace.get('type') not in allowed:
                    errors.append(f'不支持的图表类型: {trace.get("type")}')
        try_it = item.get('try_it')
        if isinstance(try_it, dict):
            for key in ('text', 'answer'):
                if not try_it.get(key):
                    errors.append(f'try_it 缺少: {key}')
        return errors


_service: HotspotService | None = None
_service_lock = Lock()


def get_hotspot_service() -> HotspotService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = HotspotService()
    return _service
