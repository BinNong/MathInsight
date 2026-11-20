#!/bin/bash
set -euo pipefail

OUTPUT=${1:-MathInsight-package}
if [[ ! "$OUTPUT" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || [[ "$OUTPUT" == *..* ]]; then
    echo "错误：输出名称只能包含字母、数字、点、下划线和连字符，且不能包含路径。"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d /tmp/mathinsight-package.XXXXXX)"
PACKAGE_DIR="$TEMP_DIR/$OUTPUT"
trap 'rm -rf "$TEMP_DIR"' EXIT
mkdir -p "$PACKAGE_DIR"

if ! command -v rsync >/dev/null 2>&1; then
    echo "错误：需要 rsync 才能打包。"
    exit 1
fi

echo "正在复制项目..."
rsync -a \
    --exclude=".git" \
    --exclude=".claude" \
    --exclude="node_modules" \
    --exclude="__pycache__" \
    --exclude="*.pyc" \
    --exclude="backend/.venv" \
    --exclude="venv" \
    --exclude=".venv" \
    --exclude="backend/media" \
    --exclude="backend/downloads" \
    --exclude="frontend/dist" \
    --exclude="frontend/test-results" \
    --exclude="frontend/playwright-report" \
    --exclude="参赛资料" \
    --exclude="*.log" \
    --exclude="*.tar.gz" \
    --exclude=".DS_Store" \
    --exclude=".env" \
    "$ROOT_DIR/" \
    "$PACKAGE_DIR/"

if [ ! -f "$PACKAGE_DIR/backend/.env.example" ]; then
    echo "错误：backend/.env.example 缺失，已停止打包。"
    exit 1
fi

echo "正在打包..."
tar -czf "$ROOT_DIR/$OUTPUT.tar.gz" -C "$TEMP_DIR" "$OUTPUT"

echo "打包完成: $ROOT_DIR/$OUTPUT.tar.gz"
echo "部署说明:"
echo "1. 解压: tar -xzf $OUTPUT.tar.gz"
echo "2. 进入 backend 目录: cp .env.example .env，然后编辑 .env"
echo "3. 安装后端依赖: cd backend && pip install -r requirements.txt"
echo "4. 安装前端依赖: cd ../frontend && npm ci"
echo "5. 启动后端: python run.py"
echo "6. 启动前端: npm run dev"
