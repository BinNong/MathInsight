#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f backend/.env ]; then
    echo "错误：backend/.env 不存在。请先复制 backend/.env.example 并配置后再部署。"
    exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "错误：Docker 未安装或守护进程不可用。"
    exit 1
fi

echo "=== 1. 编译前端 ==="
if command -v npm >/dev/null 2>&1; then
    if [ ! -f frontend/package-lock.json ]; then
        echo "错误：frontend/package-lock.json 不存在，无法执行可复现安装。"
        exit 1
    fi
    cd frontend
    npm ci
    npm run build
    cd "$ROOT_DIR"
elif [ ! -d frontend/dist ]; then
    echo "错误：服务器未安装 Node.js 且 frontend/dist 目录不存在。"
    echo "请在本地执行 npm run build，然后将 dist 目录上传到 frontend/dist。"
    exit 1
else
    echo "检测到已有 dist 目录，跳过编译"
fi

echo "=== 2. 部署前端静态文件 ==="
sudo mkdir -p /var/www/mathinsight /var/www/mathinsight/downloads
sudo cp -r frontend/dist/* /var/www/mathinsight/
sudo chown -R 10001:10001 /var/www/mathinsight/downloads

echo "=== 3. 配置 Nginx（需手动操作）==="
echo "请将 $ROOT_DIR/nginx-mathinsight.conf 中的四个 location 块复制到 HTTPS server 块。"
echo "粘贴后执行: sudo nginx -t && sudo nginx -s reload"

echo "=== 4. 启动后端容器 ==="
echo "提示：账号数据保存在 /var/www/mathinsight/data，请务必保留该目录（含 SQLite 数据库与密钥）。"
mkdir -p /var/www/mathinsight/data
# 容器内以 UID 10001 运行，需保证数据目录可写
sudo chown -R 10001:10001 /var/www/mathinsight/data 2>/dev/null || chown -R 10001:10001 /var/www/mathinsight/data 2>/dev/null || true
docker build -t mathinsight-backend .
docker stop mathinsight-backend 2>/dev/null || true
docker rm mathinsight-backend 2>/dev/null || true
docker run -d --name mathinsight-backend \
    --restart unless-stopped \
    --cpus 2 \
    --memory 4g \
    --pids-limit 256 \
    -p 127.0.0.1:5001:5001 \
    --env-file backend/.env \
    -v /var/www/mathinsight/downloads:/app/downloads \
    -v /var/www/mathinsight/data:/app/data \
    mathinsight-backend

echo "等待后端健康检查..."
healthy=false
for _ in {1..30}; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' mathinsight-backend)"
    if [ "$status" = "healthy" ]; then
        healthy=true
        break
    fi
    if [ "$status" = "unhealthy" ] || [ "$status" = "dead" ] || [ "$status" = "exited" ]; then
        break
    fi
    sleep 2
done
if [ "$healthy" != "true" ]; then
    echo "后端健康检查失败，最近日志如下："
    docker logs --tail 100 mathinsight-backend
    exit 1
fi

echo "=== 部署完成 ==="
echo "访问 https://nongbin.site/mathinsight"
echo "检查状态: docker ps | grep mathinsight"
