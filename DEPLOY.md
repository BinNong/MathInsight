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
npm ci
npm run build
cd ..
```

> `npm run build` 会先执行 TypeScript 检查，再进行 Vite 生产构建，不应跳过检查。

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
SECRET_KEY=用 python3 -c "import secrets; print(secrets.token_urlsafe(48))" 生成的随机串
ANTHROPIC_API_KEY=你的密钥
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

> `SECRET_KEY` 用于签名登录令牌，生产环境务必设置为随机强密钥。若不设置，服务会自动生成并持久化到 `backend/data/secret_key`，但建议显式配置。

### 用户账号与邀请码

站点已启用登录鉴权：**未登录无法使用任何功能**，注册必须提供有效邀请码。

在服务器上生成邀请码（进入项目目录）：

```bash
cd /home/ubuntu/mathinsight
./backend/.venv/bin/python backend/manage_invites.py create 5 --note "第一批用户"
# 查看使用情况
./backend/.venv/bin/python backend/manage_invites.py list
```

容器内可执行：`docker exec mathinsight-backend python manage_invites.py create 5`

每个邀请码仅能注册一个账号。账号数据保存在 SQLite 数据库，位于持久化卷 `/var/www/mathinsight/data/mathinsight.db`（**请务必保留并备份此目录**，删除会导致全部账号失效）。

### 管理员账号与后台管理

注册接口永远无法提权，首个管理员由服务器运维指定。用户先正常注册一个账号（例如 `adminuser`），然后在服务器上执行：

```bash
./backend/.venv/bin/python backend/manage_users.py list
./backend/.venv/bin/python backend/manage_users.py promote adminuser
# 如果忘记该账号密码：
./backend/.venv/bin/python backend/manage_users.py reset-password adminuser
```

也可在 `backend/.env` 中配置 `ADMIN_USERNAMES=adminuser,anotheradmin`；服务启动时会将这些**已存在**的用户提升为管理员（只提升、不降级）。容器内对应命令为 `docker exec -w /app mathinsight-backend python manage_users.py promote <用户名>`。

管理员登录后，右上角会出现「管理」入口（路径 `/mathinsight/admin`），可以：

- 查看/搜索全部用户（含已停用账号），按角色与状态筛选展示
- 启用或停用账号、设置或取消管理员、删除用户
- 查看邀请码使用情况、生成新邀请码、作废未使用的邀请码

安全规则：不能停用、降级或删除自己的账号；系统会拒绝移除最后一名启用中的管理员。删除用户时，其使用过的邀请码会保留“已使用”痕迹，不会被重新利用。已有数据库在下次启动或执行管理脚本时会自动补齐新字段，无需手工改表。

## 第三步：执行部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本自动完成：
1. 预检 `backend/.env` 和 Docker，使用 `npm ci && npm run build` 编译前端；无 npm 时使用已上传的 dist 文件
2. 将静态文件复制到 `/var/www/mathinsight/`，并设置下载目录供 UID 10001 的非 root 容器用户写入
3. 以单 worker、2 CPU、4GB 内存和 256 PID 上限构建并启动 Flask Docker 容器（端口 5001）
4. 等待容器健康检查通过，失败时输出最近日志并以非零状态退出

单 worker 是有意的部署约束：当前 Manim 任务状态保存在单进程和本机文件中，多 worker 会把其他进程的执行中任务误判为失败。需要横向扩展时，应先迁移到共享任务队列与跨进程取消机制。

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

# 测试 API 与容器健康状态
curl --fail http://127.0.0.1:5001/api/health
docker inspect --format '{{.State.Health.Status}}' mathinsight-backend
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
