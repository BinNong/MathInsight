#!/bin/bash

# MathInsight 打包脚本
# 用法: ./package.sh [输出文件名]

OUTPUT=${1:-MathInsight-package}

# 需要排除的文件和目录
EXCLUDES=(
    ".git"
    ".claude"
    "node_modules"
    "backend/__pycache__"
    "backend/.venv"
    "venv"
    ".venv"
    "backend/media"
    "参赛资料"
    "*.log"
    ".DS_Store"
    "__pycache__"
    "*.pyc"
    ".env"
)

# 创建临时目录
TEMP_DIR="/tmp/$OUTPUT"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 复制项目（排除敏感文件）
echo "正在复制项目..."
rsync -av \
    --exclude=".git" \
    --exclude=".claude" \
    --exclude="node_modules" \
    --exclude="__pycache__" \
    --exclude="*.pyc" \
    --exclude="backend/__pycache__" \
    --exclude="backend/.venv" \
    --exclude="venv" \
    --exclude=".venv" \
    --exclude="backend/media" \
    --exclude="backend/downloads" \
    --exclude="参赛资料" \
    --exclude="*.log" \
    --exclude=".DS_Store" \
    --exclude=".env" \
    /Users/nongbin/claudeCodeProjects/MathInsight/ \
    "$TEMP_DIR/"

# 生成 .env.example
echo "正在生成配置模板..."
cat > "$TEMP_DIR/backend/.env.example" << 'EOF'
# Flask 配置
FLASK_DEBUG=false

# LLM API 配置（Manim 动画生成功能需要）
# 请填入你的 API 密钥

# Anthropic 配置
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# 或 OpenAI 配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
EOF

# 打包
echo "正在打包..."
cd /tmp
tar -czf "$OUTPUT.tar.gz" "$OUTPUT"

# 移到当前目录
mv "$OUTPUT.tar.gz" /Users/nongbin/claudeCodeProjects/MathInsight/

echo ""
echo "打包完成: MathInsight-package.tar.gz"
echo ""
echo "部署说明:"
echo "1. 解压: tar -xzf MathInsight-package.tar.gz"
echo "2. 进入 backend 目录: cp .env.example .env，然后编辑 .env 填入 API 密钥"
echo "3. 安装后端依赖: cd backend && pip install -r requirements.txt"
echo "4. 安装前端依赖: cd ../frontend && npm install"
echo "5. 启动后端: python run.py"
echo "6. 启动前端: npm run dev"
