#!/usr/bin/env python3
"""校验数说热点内容文件。

用法：
    python3 scripts/validate_hotspots.py [path]

未指定路径时校验 backend/app/resources/hotspots.json。
内容生成流程在写入前应调用本脚本，校验失败则不发布。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = ROOT / 'backend' / 'app' / 'resources' / 'hotspots.json'

VALID_BRANCHES = {'calculus', 'linear-algebra', 'probability', 'statistics'}
VALID_CATEGORIES = {'科技', '天文', '体育', '生活', '社会', '经济'}
VALID_TRACES = {'scatter', 'bar', 'contour', 'heatmap'}
REQUIRED = [
    'id', 'date', 'category', 'branch', 'topic', 'headline', 'summary',
    'question', 'concept', 'formula', 'formula_note', 'steps', 'insight',
    'figure', 'figure_caption', 'try_it', 'concepts', 'modules', 'source', 'tags',
]


def validate_item(item: dict) -> list[str]:
    errors = []
    for key in REQUIRED:
        if key not in item or item[key] in (None, '', []):
            errors.append(f'缺少字段: {key}')
    if item.get('branch') and item['branch'] not in VALID_BRANCHES:
        errors.append(f'未知数学分支: {item["branch"]}')
    if item.get('category') and item['category'] not in VALID_CATEGORIES:
        errors.append(f'未知分类: {item["category"]}')
    figure = item.get('figure')
    if isinstance(figure, dict):
        for trace in figure.get('data', []):
            if trace.get('type') not in VALID_TRACES:
                errors.append(f'不支持的图表类型: {trace.get("type")}')
    try_it = item.get('try_it')
    if isinstance(try_it, dict):
        for key in ('text', 'answer'):
            if not try_it.get(key):
                errors.append(f'try_it 缺少: {key}')
    return errors


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    try:
        items = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        print(f'FAIL: 无法读取内容文件 {path}: {exc}')
        return 1

    if not isinstance(items, list) or not items:
        print('FAIL: 内容文件必须是非空数组')
        return 1

    errors: list[str] = []
    ids: set[str] = set()
    for item in items:
        iid = item.get('id', '<无 id>')
        if iid in ids:
            errors.append(f'{iid}: id 重复')
        ids.add(iid)
        for err in validate_item(item):
            errors.append(f'{iid}: {err}')

    if errors:
        print(f'FAIL: {len(errors)} 个问题')
        for err in errors[:30]:
            print('  -', err)
        return 1

    branches = sorted({it['branch'] for it in items})
    print(f'OK: {len(items)} 篇内容，分支：{", ".join(branches)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
