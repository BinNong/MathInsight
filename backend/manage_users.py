#!/usr/bin/env python3
"""
用户与管理员命令行工具。

用法（在 backend 目录下）：
    python manage_users.py list
    python manage_users.py promote <用户名>     # 设为管理员
    python manage_users.py demote <用户名>      # 取消管理员
    python manage_users.py deactivate <用户名>  # 停用账号
    python manage_users.py activate <用户名>    # 启用账号
    python manage_users.py reset-password <用户名>  # 重置密码（交互式输入）
    python manage_users.py delete <用户名>      # 删除账号

说明：
- 首个管理员必须由此工具（或 ADMIN_USERNAMES 环境变量）指定，注册接口无法提权。
- 工具会拒绝停用/降级/删除最后一名启用中的管理员，避免把自己锁在门外。
"""
import argparse
import getpass
import sys

from app import auth


def _print_users(users: list[dict]) -> None:
    print(f"{'ID':>4}  {'用户名':<20}  {'角色':<8}  {'状态':<6}  创建时间")
    for user in users:
        role = '管理员' if user['is_admin'] else '普通用户'
        status = '启用' if user['is_active'] else '停用'
        print(f"{user['id']:>4}  {user['username']:<20}  {role:<8}  {status:<6}  {user['created_at']}")


def main() -> int:
    parser = argparse.ArgumentParser(description='MathInsight 用户管理工具')
    sub = parser.add_subparsers(dest='command', required=True)

    sub.add_parser('list', help='列出所有用户及角色')

    for command, help_text in (
        ('promote', '设为管理员'),
        ('demote', '取消管理员'),
        ('deactivate', '停用账号'),
        ('activate', '启用账号'),
        ('delete', '删除账号'),
    ):
        p = sub.add_parser(command, help=help_text)
        p.add_argument('username', help='目标用户名')

    reset_p = sub.add_parser('reset-password', help='重置用户密码')
    reset_p.add_argument('username', help='目标用户名')

    args = parser.parse_args()
    auth.init_db()

    if args.command == 'list':
        users = auth.list_all_users()
        if not users:
            print('当前还没有用户。')
        else:
            _print_users(users)
        return 0

    if args.command == 'promote':
        user, error = auth.set_admin_by_username(args.username, True)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f"已将 {user['username']} 设为管理员。")
        return 0

    if args.command == 'demote':
        user, error = auth.set_admin_by_username(args.username, False)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f"已取消 {user['username']} 的管理员权限。")
        return 0

    if args.command == 'deactivate':
        user, error = auth.set_active_by_username(args.username, False)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f"已停用账号 {user['username']}。")
        return 0

    if args.command == 'activate':
        user, error = auth.set_active_by_username(args.username, True)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f"已启用账号 {user['username']}。")
        return 0

    if args.command == 'delete':
        ok, error = auth.delete_user_by_username(args.username)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f'已删除账号 {args.username}。')
        return 0

    if args.command == 'reset-password':
        password = getpass.getpass('新密码（至少 8 位）: ')
        confirm = getpass.getpass('再输入一次: ')
        if password != confirm:
            print('错误：两次输入的密码不一致', file=sys.stderr)
            return 1
        user, error = auth.reset_password_by_username(args.username, password)
        if error:
            print(f'错误：{error}', file=sys.stderr)
            return 1
        print(f"已重置 {user['username']} 的密码。")
        return 0

    return 1


if __name__ == '__main__':
    raise SystemExit(main())
