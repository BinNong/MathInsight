# MathInsight - 高等数学智能教学助手

## 项目结构

```
MathInsight/
├── backend/                 # Flask 后端
│   ├── app/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑服务
│   │   └── utils/          # 工具函数
│   ├── requirements.txt    # Python 依赖
│   └── run.py             # 启动脚本
├── frontend/               # React 前端 (Vite)
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   └── services/      # API 调用
│   └── package.json
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
cd backend
python run.py
```

后端服务运行在 http://localhost:5000

### 3. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
```

前端服务运行在 http://localhost:5173

## 功能模块

### MVP 功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **ε-δ 极限可视化** | 动态展示函数在某点趋近过程，支持 ε-δ 定义可视化 | ✅ 已完成 (M1) |
| **导数切线可视化** | 实时绘制切线、法线，动态展示局部线性逼近，支持高阶导数与放大镜功能 | ✅ 已完成 (M2) |

### 已实现功能详情

#### M1: ε-δ 极限可视化
- 用户设定目标极限值 L 和 ε 范围
- 系统自动计算满足条件的 δ 区间
- 双色带高亮 |x−x₀|<δ 与 |f(x)−L|<ε 区域
- 支持自定义函数表达式（如 `x**2`, `sin(x)` 等）
- 可调节 x₀ 位置观察逼近过程

#### M2: 导数增强功能
- **切线/法线可视化**：实时绘制切线和法线
- **局部线性近似**：展示 f(x) 与 L(x) = f(x₀) + f'(x₀)(x−x₀) 的对比曲线
- **误差区域着色**：直观显示函数与切线的误差
- **高阶导数显示**：可切换 f, f', f'', f''' 曲线
- **放大镜功能**：局部无限放大后观察曲线趋近直线
- 支持三角函数（sin, cos, tan）、指数（exp）、对数（log, ln）等表达式

## 技术栈

- **前端**：React + TypeScript + Plotly.js
- **后端**：Flask + SymPy + NumPy
