# MathInsight - 高等数学智能教学助手

MathInsight 是一款面向高校师生的高等数学可视化教学平台，通过动态交互式图形与 AI 生成动画，将抽象的数学概念（极限、导数、积分、级数、矩阵、向量场、概率等）直观呈现。

## 项目结构

```
MathInsight/
├── backend/                 # Flask 后端
│   ├── app/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑服务
│   │   └── utils/          # 工具函数（响应封装、校验、清理）
│   ├── tests/              # 单元测试与路由测试
│   ├── requirements.txt    # Python 依赖
│   └── run.py             # 启动脚本
├── frontend/               # React 前端 (Vite)
│   ├── src/
│   │   ├── components/    # 可复用 UI 组件
│   │   ├── hooks/         # 自定义 React Hooks
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 调用
│   │   └── utils/         # 工具函数
│   ├── e2e/               # Playwright 端到端测试
│   └── package.json
├── docs/                   # 文档与图片资源
├── deploy.sh               # 部署脚本
├── Dockerfile              # 容器构建
├── nginx-mathinsight.conf  # Nginx 配置示例
└── README.md
```

## 快速开始

### 1. 配置环境变量

项目使用 `.env` 文件管理环境变量，**该文件不包含在版本控制中**。

进入 `backend` 目录，复制示例文件并填入实际密钥：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，填入你的 LLM API 密钥（AI 解题与 Manim 动画生成功能需要）。当前服务使用 Anthropic Messages API，请配置 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL` 和 `ANTHROPIC_MODEL`，可使用官方或兼容端点。`OPENAI_*` 仅保留旧配置回退，不代表支持 OpenAI 官方 SDK 调用。

> ⚠️ **注意**：`.env` 文件已加入 `.gitignore`，请勿将其提交到版本控制，避免 API 密钥泄露。

### 2. 安装后端依赖

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Manim 需要 Cairo/Pango 等系统库；macOS 本地如缺少编译环境，可直接使用项目 Dockerfile 构建完整运行环境。

### 3. 启动后端服务

```bash
cd backend
python run.py
```

后端服务运行在 http://localhost:5000

### 4. 安装前端依赖并启动

```bash
cd frontend
npm ci
npm run dev
```

前端服务运行在 http://localhost:5173

### 5. 账号与首个管理员

站点启用全站鉴权：**未登录无法使用任何功能**，注册必须提供有效邀请码。

```bash
# 生成邀请码（本地或服务器，进入项目根目录）
cd backend
.venv/bin/python manage_invites.py create 5 --note "第一批用户"
.venv/bin/python manage_invites.py list

# 用户拿邀请码访问 /register 自助填写用户名、密码、确认密码完成注册
# 将某个已注册用户设为管理员（首个管理员只能由运维指定，注册接口无法提权）
.venv/bin/python manage_users.py promote <用户名>
.venv/bin/python manage_users.py list
.venv/bin/python manage_users.py reset-password <用户名>   # 交互式输入新密码
```

也可在 `.env` 中配置 `ADMIN_USERNAMES=用户名1,用户名2`，服务启动时将这些**已存在**的用户提升为管理员（只提升、不降级）。

账号数据保存在 SQLite 单文件 `backend/data/mathinsight.db`，密钥在 `backend/data/secret_key`（或由 `SECRET_KEY` 环境变量覆盖）。生产环境部署时这两个文件位于持久化卷中，**务必备份，删除会导致全部账号失效**。

## 账号体系与后台管理

| 能力 | 说明 |
|------|------|
| 邀请码注册 | 用户自助设置用户名/密码，需一次性有效邀请码；确认密码两次一致才允许注册 |
| 登录鉴权 | 签名令牌（httpOnly Cookie + Bearer），默认有效期 30 天；除健康检查和登录/注册外所有 API 均需登录 |
| 自助改密码 | 右上角「改密」，需验证当前密码，新密码两次一致 |
| 管理员后台 | 右上角「管理」→ `/admin`：查看/搜索用户、启停账号、升降角色、重置密码、删除用户、生成/作废邀请码 |
| 忘记密码 | 用户找管理员在后台「重置密码」，或运维用 `manage_users.py reset-password` |

安全约束：不能停用/降级/删除自己的账号；系统拒绝移除最后一名启用中的管理员；删除用户时其邀请码保留「已使用」痕迹、不会被重新利用；所有管理接口均在服务端二次校验管理员权限，隐藏前端入口不等于放弃鉴权。

已有数据库在启动时自动补齐新增字段（`is_admin`、`used_by_username`），无需手工改表。

### 题库练习与学生模型（L5 接线）

2D 数学小镇里积累的 57 道结构化题目和掌握度数据，现已接入主站：

- `/practice` 题库练习页：按 7 个知识点练习，答题即时判分并显示解析，结果写入共享掌握度
- 知识图谱可切换「按掌握度着色」，概念详情显示该概念的掌握度与正确率，并提供「题库练习」直达入口
- 首页「学习诊断」自动识别正确率低于 70% 的薄弱知识点，一键进入练习或对应可视化实验
- 掌握度数据以 `mathinsight-calc-mastery` 存于浏览器 localStorage，主站与 2D 小镇共享同一份（跨设备同步尚未实现）

映射关系定义在 `frontend/src/services/learning.ts`（7 个题库主题 ↔ 48 个图谱概念）。

### 教学逻辑引导（L4 接线）

- **猜想-验证步骤条**：ε-δ 极限与导数页面，每步先让学生写下自己的猜想，提交后才揭示该步讲解；揭示状态保存在浏览器
- **符号推导机检**：解题助手对形如 `lhs = rhs` 的步骤公式与最终答案调用 SymPy 等价性检验，界面显示「已验证 / 存疑 / 未机检」徽章；函数记号（如 `f'(x)`）等无法安全解析的公式标记为「未机检」
- **AI 追问建议**：解题结果末尾展示后端生成的 `follow_up_questions`，点击即填入追问框
- **题库相似题**：相似题优先从 57 题结构化题库按主题检索（带标准答案与解析，卡片内可直接作答判分），题库未覆盖的主题才回退到 LLM 现编；题库与 solver 主题映射在 `backend/app/services/question_bank_service.py`

### ε-δ 图元直接操作（L3）

ε-δ 极限页的误差带和 δ 带是**可直接拖动的数学对象**，不再是只读的示意图：

- 拖动**黄色 ε 带**的上下边界，误差范围实时改变，后端自动重算对应的 δ——直接看到"ε 变小，δ 被迫变小"的联动关系
- 拖动**绿色 δ 带**的左右边界，由学生自己选一个 δ，后端 `POST /api/calculus/limit/verify-delta` 立即判定它是否满足 ε 条件：通过则色带转绿，否则转红并在图上标出反例点（超出 ε 带的 x）
- 「用系统 δ」按钮可随时回到系统计算的安全值

### 内容纵深（L2）

补齐三条此前缺失的数学主线，模块数从 18 增至 21：

- **微分方程方向场**（`/direction-field`）：输入一阶 ODE `y′ = f(x, y)`，绘制方向场；从多个初值点用四阶 Runge-Kutta 积分出解曲线。内置衰减/增长/抛物线等预设
- **特征值与特征向量**（`/eigenvalues`）：2×2 矩阵的特征值、特征向量、特征多项式、行列式与迹；输入任意向量，实时显示变换结果并判定它是否为特征向量
- **假设检验**（`/hypothesis-test`）：单样本 z / t 检验，可切换双侧/单侧，在抽样分布上显示样本均值、p 值与拒绝域，给出置信区间与结论

三者均已接入知识图谱（新增 4 个概念节点、7 条前置关系）。后端实现在 `backend/app/services/advanced_service.py`，API 前缀 `/api/advanced`。

## 功能模块

| 模块 | 功能 | 状态 |
|------|------|------|
| **ε-δ 极限可视化** | 动态展示函数在某点趋近过程，支持 ε-δ 定义可视化 | ✅ 已完成 |
| **导数切线可视化** | 实时绘制切线、法线，展示局部线性逼近与高阶导数 | ✅ 已完成 |
| **矩阵变换可视化** | 2×2 矩阵对单位圆/网格的实时变换，支持特征向量与行列式 | ✅ 已完成 |
| **大数定律模拟** | 蒙特卡洛模拟演示样本均值收敛到期望值 | ✅ 已完成 |
| **泰勒级数可视化** | 展示泰勒多项式逼近、收敛半径与奇点分析 | ✅ 已完成 |
| **黎曼和与数值积分** | 可视化黎曼和、梯形法、辛普森法及误差收敛 | ✅ 已完成 |
| **多元函数可视化** | 偏导数、梯度、等高线、梯度下降、曲面分析 | ✅ 已完成 |
| **向量场与线积分** | 2D/3D 向量场、流线、环量、格林定理、高斯定理 | ✅ 已完成 |
| **概率分布与中心极限定理** | 多种分布模拟、样本均值分布、CLT 演示 | ✅ 已完成 |
| **AI 数学动画生成** | 基于 LLM 自动生成 Manim 动画与同步讲解字幕 | ✅ 已完成 |
| **数学解题助手** | AI 引导分步解题、提示阶梯、相似题推荐与可视化联动 | ✅ 已完成 |
| **知识学习地图** | 高等数学概念知识图谱，前置关系可视化与推荐学习路径 | ✅ 已完成 |
| **学习工作台** | 全模块搜索、分类筛选、收藏、最近学习与继续学习，本机保存记录 | ✅ 已完成 |
| **3D 数学世界** | 第一人称探索数学群岛、梯度地形与矩阵装置，联通交互实验 | ✅ 已完成 |
| **2D 数学小镇** | 导师修炼、战斗答题、掌握度手札、秘境波次试炼与触控操作 | ✅ 已完成 |
| **账号与邀请码注册** | 全站登录鉴权、一次性邀请码、自助改密、用户名/密码校验 | ✅ 已完成 |
| **管理员后台** | 用户搜索/启停/升降角色/重置密码/删除、邀请码生成与作废、概览统计 | ✅ 已完成 |
| **题库练习与学生模型** | 57 题结构化题库、主题练习、掌握度追踪、知识图谱着色、首页薄弱点诊断 | ✅ 已完成 |
| **教学逻辑引导** | 猜想-验证步骤条、SymPy 推导机检徽章、AI 追问建议、题库相似题即时判分 | ✅ 已完成 |
| **ε-δ 图元直接操作** | 拖动 ε 带实时重算 δ、拖动 δ 带亲手试探并即时判定、反例点标注 | ✅ 已完成 |
| **微分方程方向场** | 一阶 ODE 方向场、RK4 解曲线、多初值条件、预设方程 | ✅ 已完成 |
| **特征值与特征向量** | 2×2 矩阵特征值/向量、变换几何、行列式与迹、向量判定 | ✅ 已完成 |
| **假设检验** | 单样本 z/t 检验、p 值、拒绝域、置信区间可视化 | ✅ 已完成 |

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Plotly.js + KaTeX + vis-network + react-router-dom
- **后端**：Flask + SymPy + NumPy + SciPy + Manim + Anthropic SDK（兼容端点）
- **测试**：pytest（后端）+ Playwright（前端 e2e）
- **部署**：Docker + Nginx

## 开发与测试

```bash
# 后端测试
cd backend && .venv/bin/python -m pytest -q

# 前端类型检查、lint 与格式检查
cd frontend && npx tsc --noEmit
npm run lint
npm run format:check

# 前端构建
npm run build

# 桌面端与移动端端到端测试（首次需安装 Chromium）
npx playwright install chromium
npm run e2e

# E2E 全局登录态使用 demo_user / Testpass123（本地开发库）
# 若你的环境账号不同，可用环境变量覆盖：
E2E_USERNAME=myuser E2E_PASSWORD=mypass npm run e2e
# 注意：e2e 依赖本地后端已启动且该账号已注册（见「账号与首个管理员」）

# 仅运行移动端
npx playwright test --project=chromium-mobile
```

Vite 默认代理 `http://localhost:5000`；端口被占用时，可在其他端口启动 Flask，并通过 `VITE_API_TARGET=http://127.0.0.1:5001 npm run dev` 指定后端。

## 部署

参考 `DEPLOY.md` 与 `deploy.sh` 进行生产环境部署。部署前请确保：

1. 已配置生产环境 `.env`
2. 前端已通过 `npm run build` 构建
3. Nginx 配置已按 `nginx-mathinsight.conf` 示例调整
4. 已设置合理的容器资源限制（CPU、内存、PID 上限）

## 安全提示

- 生产环境请设置强密钥并定期轮换
- 使用 `ALLOWED_ORIGINS` 限制 CORS 来源
- 对 `/api/manim/generate` 等资源密集型接口设置限流
- 后端容器以 UID 10001 非 root 用户、单 worker 运行，并配置健康检查及 CPU/内存/PID 限制
- Manim 渲染子进程仅继承白名单环境变量；AST 检查不是完整安全沙箱，公网开放前仍需独立隔离执行环境
