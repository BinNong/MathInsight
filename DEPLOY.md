# MathInsight 部署文档

## 前提条件

- Ubuntu 服务器，已安装 Docker 和 Nginx
- 域名 `nongbin.site` 已配置 HTTPS
- 服务器已安装 Node.js（用于前端编译）或本地编译后上传

## 部署架构

```
https://nongbin.site/mathinsight
        │
        ├─ /mathinsight             → /var/www/mathinsight (React 静态文件)
        ├─ /mathinsight/api/*       → Docker Flask :5001
        └─ /mathinsight/downloads/* → Docker Flask :5001
```

## 第零步：本地编译前端（只需执行一次，或代码更新时）

在本地开发机器上编译前端，生成静态文件：

```bash
cd frontend
npm install
npx vite build    # 用 vite build 跳过 tsc 类型检查
cd ..
```

> 注意：项目已修复 TypeScript 类型错误，直接使用 `npm run build` 即可。

## 第一步：上传项目到服务器

```bash
# 在本地打包（frontend/dist 是编译产物，必须包含）
tar -czf mathinsight-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='backend/media' \
    --exclude='backend/downloads' \
    backend/ frontend/dist/ Dockerfile nginx-mathinsight.conf deploy.sh

# 上传到服务器
scp mathinsight-deploy.tar.gz ubuntu@nongbin.site:~/

# SSH 到服务器，解压
ssh ubuntu@nongbin.site
mkdir -p /home/ubuntu/mathinsight
tar -xzf mathinsight-deploy.tar.gz -C /home/ubuntu/mathinsight
```

## 第二步：配置环境变量

```bash
cd /home/ubuntu/mathinsight
cp backend/.env.example backend/.env
vim backend/.env
```

编辑 `.env` 填入 API 密钥（Manim 动画生成功能需要）：

```env
FLASK_DEBUG=false
ANTHROPIC_API_KEY=你的密钥
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## 第三步：执行部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本自动完成：
1. 检查是否有 npm，有则编译前端；无则使用已上传的 dist 文件
2. 将静态文件复制到 `/var/www/mathinsight/`
3. 构建并启动 Flask Docker 容器（端口 5001）

## 第四步：配置 Nginx（手动）

`location` 指令只能放在 server 块内部，不能放在 http 层。请打开 `nginx-mathinsight.conf`，将四个 location 块复制到你的 HTTPS server 块中。

```bash
# 查看你的 nginx 配置位置
sudo nginx -T | grep server_name

# 编辑对应配置文件，将 nginx-mathinsight.conf 的内容粘贴到 server 块内
sudo vim /etc/nginx/nginx.conf
```

粘贴位置参考（你的已有配置保持不变）：

```nginx
server {
    listen 443 ssl http2;
    server_name nongbin.site www.nongbin.site;

    # ... 证书、安全配置等保持不变 ...

    # === 以下粘贴 nginx-mathinsight.conf 的内容 ===
    location = /mathinsight { return 301 /mathinsight/; }
    location /mathinsight/ { ... }
    location /mathinsight/api/ { ... }
    location /mathinsight/downloads/ { ... }

    # ... 你已有的其他 location 规则保持不变 ...
}
```

然后重载 Nginx：

```bash
sudo nginx -t && sudo nginx -s reload
```

## 第五步：验证部署

```bash
# 检查容器状态
docker ps | grep mathinsight

# 查看容器日志
docker logs mathinsight-backend

# 测试 API
curl http://127.0.0.1:5001/api/health
```

浏览器访问 `https://nongbin.site/mathinsight` 确认页面正常。

## 后续更新

```bash
# 1. 本地重新编译前端
cd frontend && npm run build && cd ..

# 2. 上传前端静态文件
scp -r frontend/dist/* ubuntu@nongbin.site:~/mathinsight-dist/
ssh ubuntu@nongbin.site "sudo cp -r ~/mathinsight-dist/* /var/www/mathinsight/"

# 3. 上传后端变更并重建 Docker
scp Dockerfile ubuntu@nongbin.site:~/mathinsight/
scp backend/requirements.txt ubuntu@nongbin.site:~/mathinsight/backend/
ssh ubuntu@nongbin.site "cd ~/mathinsight && ./deploy.sh"
```

## 排查问题

**Docker 构建时 apt 下载失败**
- Dockerfile 已配置阿里云镜像，如果仍失败，检查服务器网络

**Docker 构建时 pip 编译失败（pycairo 等）**
- 确认 Dockerfile 中已安装 `build-essential`

**容器启动失败**
```bash
docker logs mathinsight-backend
```

**502 Bad Gateway**
- 确认容器在运行：`docker ps | grep mathinsight`
- 确认端口绑定：`curl http://127.0.0.1:5001/api/health`

**页面 404**
- 确认 Nginx 配置包含 mathinsight 的 location 块：`sudo nginx -T | grep mathinsight`
- 确认静态文件存在：`ls /var/www/mathinsight/index.html`

**前端资源 JS/CSS 404**
- 确认已用 `npx vite build` 重新编译（确保 `base: /mathinsight/` 生效）
- 上传 dist 到服务器时遇到权限问题，先传到 `~/mathinsight-dist/` 再 `sudo cp`

**`/mathinsight` 无斜杠返回 404**
- 确认 nginx 配置中有 `location = /mathinsight { return 301 /mathinsight/; }`

**API 请求返回 404**
- 确认前端编译时 `base: '/mathinsight/'` 已设置（vite.config.ts）
- 确认 `BrowserRouter basename="/mathinsight"` 已设置（App.tsx）
- 确认 nginx 有 `/mathinsight/api/` 的 proxy_pass
