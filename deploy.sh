#!/bin/bash
set -e

# MathInsight 部署脚本
# 在项目根目录执行: ./deploy.sh
# 前端需先在本地编译并上传 dist 目录，或服务器已安装 Node.js

echo "=== 1. 编译前端 ==="
if command -v npm &> /dev/null; then
    cd frontend
    npm install
    npm run build
    cd ..
else
    if [ ! -d "frontend/dist" ]; then
        echo "错误：服务器未安装 Node.js 且 frontend/dist 目录不存在"
        echo "请在本地执行 npm run build，然后将 dist 目录上传到服务器的 frontend/dist"
        exit 1
    fi
    echo "检测到已有 dist 目录，跳过编译"
fi

echo "=== 2. 部署前端静态文件 ==="
sudo mkdir -p /var/www/mathinsight
sudo cp -r frontend/dist/* /var/www/mathinsight/

echo "=== 3. 配置 Nginx（需手动操作）==="
echo ""
echo "请将 nginx-mathinsight.conf 中的四个 location 块复制到 nginx HTTPS server 块中"
echo "配置文件路径: $(pwd)/nginx-mathinsight.conf"
echo ""
echo "你的 nginx 站点配置一般在:"
echo "  /etc/nginx/nginx.conf  或  /etc/nginx/sites-available/default"
echo ""
echo "粘贴后执行: sudo nginx -t && sudo nginx -s reload"
echo ""

echo "=== 4. 启动后端容器 ==="
docker build -t mathinsight-backend .
docker stop mathinsight-backend 2>/dev/null || true
docker rm mathinsight-backend 2>/dev/null || true
docker run -d --name mathinsight-backend \
    --restart unless-stopped \
    -p 127.0.0.1:5001:5001 \
    --env-file backend/.env \
    -v /var/www/mathinsight/downloads:/app/downloads \
    mathinsight-backend

echo ""
echo "=== 部署完成 ==="
echo "访问 https://nongbin.site/mathinsight 即可使用"
echo ""
echo "检查状态:"
echo "  docker ps | grep mathinsight"
echo "  docker logs mathinsight-backend"
