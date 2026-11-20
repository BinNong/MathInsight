#!/usr/bin/env python3
"""
邀请码管理工具。

用法（在 backend 目录下）：
    python manage_invites.py create [数量] [--note 备注]
    python manage_invites.py list

示例：
    python manage_invites.py create 5 --note "给张三的同学"
    python manage_invites.py list
"""
import argparse
import sys

from app import auth


def main() -> int:
    parser = argparse.ArgumentParser(description='MathInsight 邀请码管理工具')
    sub = parser.add_subparsers(dest='command', required=True)

    create_p = sub.add_parser('create', help='生成新的邀请码')
    create_p.add_argument('count', nargs='?', type=int, default=1, help='生成数量（默认 1）')
    create_p.add_argument('--note', default=None, help='备注，便于追踪用途')

    sub.add_parser('list', help='查看邀请码使用统计')

    args = parser.parse_args()

    auth.init_db()

    if args.command == 'create':
        if args.count < 1 or args.count > 100:
            print('错误：数量需在 1 到 100 之间', file=sys.stderr)
            return 1
        codes = auth.create_invite_codes(args.count, args.note)
        print('已生成邀请码：')
        for code in codes:
            print('  ' + code)
        if args.note:
            print(f'备注：{args.note}')
        print('提示：每个邀请码仅可用于注册一个账号。')
        return 0

    if args.command == 'list':
        stats = auth.invite_stats()
        print(f"邀请码总数：{stats['total']}")
        print(f"已使用：{stats['used']}")
        print(f"未使用：{stats['unused']}")
        print(f"已注册用户：{stats['users']}")
        return 0

    return 1


if __name__ == '__main__':
    raise SystemExit(main())
