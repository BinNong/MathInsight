#!/usr/bin/env python3
"""从后端题库 JSON 生成前端 TS 数据文件，保证前后端题目单一数据源。

用法：python3 scripts/sync_question_bank.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'backend' / 'app' / 'resources' / 'question_bank.json'
DST = ROOT / 'frontend' / 'src' / 'world2d' / 'data' / 'questionBank.generated.ts'


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    questions = json.loads(SRC.read_text(encoding='utf-8'))
    lines = [
        '/**',
        ' * 题库数据（自动生成，请勿手写）。',
        ' * 来源：backend/app/resources/question_bank.json',
        ' * 同步命令：python3 scripts/sync_question_bank.py',
        ' */',
        "import type { BankQuestion } from './questions'",
        '',
        'export const GENERATED_QUESTION_BANK: BankQuestion[] = [',
    ]
    for q in questions:
        opts = ', '.join(ts_string(o) for o in q['options'])
        lines.append(
            f"  {{ id: {ts_string(q['id'])}, topic: {ts_string(q['topic'])}, "
            f"difficulty: {int(q['difficulty'])} as 1 | 2 | 3, "
            f"q: {ts_string(q['q'])}, options: [{opts}], "
            f"answer: {int(q['answer'])}, explain: {ts_string(q['explain'])} }},"
        )
    lines.append(']')
    lines.append('')
    DST.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Generated {DST} with {len(questions)} questions')


if __name__ == '__main__':
    main()
