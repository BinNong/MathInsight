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

编辑 `.env` 文件，填入你的 LLM API 密钥（Manim 动画生成功能需要）：

- **Anthropic**：配置 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_BASE_URL`
- **OpenAI**：配置 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL`

> ⚠️ **注意**：`.env` 文件已加入 `.gitignore`，请勿将其提交到版本控制，避免 API 密钥泄露。

### 2. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 启动后端服务

```bash
cd backend
python run.py
```

后端服务运行在 http://localhost:5000

### 4. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
```

前端服务运行在 http://localhost:5173

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

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Plotly.js + KaTeX + vis-network + react-router-dom
- **后端**：Flask + SymPy + NumPy + SciPy + Manim + Anthropic/OpenAI SDK
- **测试**：pytest（后端）+ Playwright（前端 e2e）
- **部署**：Docker + Nginx

## 开发与测试

```bash
# 后端测试
cd backend && python -m pytest -q

# 前端类型检查
cd frontend && npx tsc --noEmit

# 前端 lint
cd frontend && npm run lint

# 前端构建
cd frontend && npm run build

# 前端端到端测试
cd frontend && npm run e2e
```

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
- 部署脚本默认以非 root 用户运行后端服务
