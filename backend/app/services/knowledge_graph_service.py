"""
高等数学知识图谱服务

将课程概念建模为节点，将前置知识关系建模为边，支持：
- 获取完整图谱
- 查询单个概念的详情、前置与后继
- 计算从基础到目标概念的学习路径
- 推荐关联可视化模块
"""
from collections import deque
from typing import Any


class KnowledgeGraphService:
    """知识图谱服务"""

    SUBJECTS = {
        "foundation": {"name": "预备知识", "color": "#6b7280"},
        "calculus": {"name": "微积分", "color": "#059669"},
        "linear-algebra": {"name": "线性代数", "color": "#7c3aed"},
        "probability": {"name": "概率统计", "color": "#d97706"},
    }

    CONCEPTS: list[dict[str, Any]] = [
        # 预备知识
        {
            "id": "functions",
            "name": "函数与初等函数",
            "subject": "foundation",
            "group": "基础",
            "description": "函数概念、定义域、值域、单调性、奇偶性，以及幂函数、指数函数、对数函数、三角函数等基本初等函数。",
            "difficulty": 1,
            "tags": ["函数", "初等函数"],
            "route": None,
            "formula": r"y = f(x)",
        },
        {
            "id": "trigonometry",
            "name": "三角函数",
            "subject": "foundation",
            "group": "基础",
            "description": "正弦、余弦、正切等三角函数的定义、图像、恒等式与反三角函数。",
            "difficulty": 1,
            "tags": ["三角函数", "反三角函数"],
            "route": None,
            "formula": r"\sin^2 x + \cos^2 x = 1",
        },
        {
            "id": "exponential-log",
            "name": "指数与对数",
            "subject": "foundation",
            "group": "基础",
            "description": "指数函数与对数函数的性质、运算法则及图像特征。",
            "difficulty": 1,
            "tags": ["指数", "对数"],
            "route": None,
            "formula": r"a^{\log_a x} = x",
        },
        {
            "id": "sequences",
            "name": "数列",
            "subject": "foundation",
            "group": "基础",
            "description": "数列的通项、前 n 项和、等差数列与等比数列。",
            "difficulty": 1,
            "tags": ["数列", "通项"],
            "route": None,
            "formula": r"a_n = a_1 + (n-1)d",
        },
        # 微积分 - 极限与连续
        {
            "id": "limit-sequence",
            "name": "数列极限",
            "subject": "calculus",
            "group": "极限与连续",
            "description": "数列极限的直观理解、定义与基本性质。",
            "difficulty": 2,
            "tags": ["极限", "数列"],
            "route": "/limit",
            "formula": r"\lim_{n\to\infty} a_n = A",
        },
        {
            "id": "limit-function",
            "name": "函数极限",
            "subject": "calculus",
            "group": "极限与连续",
            "description": "函数在一点或无穷远处的极限，左右极限与极限存在条件。",
            "difficulty": 2,
            "tags": ["极限", "函数"],
            "route": "/limit",
            "formula": r"\lim_{x\to x_0} f(x) = A",
        },
        {
            "id": "epsilon-delta",
            "name": "ε-δ 极限定义",
            "subject": "calculus",
            "group": "极限与连续",
            "description": "用 ε-δ 语言严格描述函数极限，是分析学的逻辑基础。",
            "difficulty": 3,
            "tags": ["极限", "严格定义"],
            "route": "/limit",
            "formula": r"\forall \varepsilon>0, \exists \delta>0, 0<|x-x_0|<\delta \Rightarrow |f(x)-A|<\varepsilon",
        },
        {
            "id": "continuity",
            "name": "连续性与间断点",
            "subject": "calculus",
            "group": "极限与连续",
            "description": "函数在一点连续的定义、闭区间连续函数性质、间断点分类。",
            "difficulty": 2,
            "tags": ["连续", "间断点"],
            "route": "/limit",
            "formula": r"\lim_{x\to x_0} f(x) = f(x_0)",
        },
        # 微积分 - 微分学
        {
            "id": "derivative-definition",
            "name": "导数定义",
            "subject": "calculus",
            "group": "微分学",
            "description": "导数作为函数变化率与切线斜率的几何意义，以及导数的极限定义。",
            "difficulty": 2,
            "tags": ["导数", "切线"],
            "route": "/derivative",
            "formula": r"f'(x_0)=\lim_{h\to 0}\frac{f(x_0+h)-f(x_0)}{h}",
        },
        {
            "id": "derivative-rules",
            "name": "求导法则",
            "subject": "calculus",
            "group": "微分学",
            "description": "和差积商法则、链式法则、反函数与隐函数求导、参数方程求导。",
            "difficulty": 2,
            "tags": ["导数", "链式法则"],
            "route": "/derivative",
            "formula": r"(uv)' = u'v + uv'",
        },
        {
            "id": "higher-derivatives",
            "name": "高阶导数",
            "subject": "calculus",
            "group": "微分学",
            "description": "二阶及以上导数，物理意义（加速度、曲率）与常用高阶导数公式。",
            "difficulty": 3,
            "tags": ["导数", "高阶导数"],
            "route": "/derivative",
            "formula": r"f^{(n)}(x) = \frac{d^n f}{dx^n}",
        },
        {
            "id": "differential",
            "name": "微分",
            "subject": "calculus",
            "group": "微分学",
            "description": "函数微分的概念，微分与增量的关系，一阶微分形式不变性。",
            "difficulty": 2,
            "tags": ["微分", "线性逼近"],
            "route": "/derivative",
            "formula": r"dy = f'(x)\,dx",
        },
        {
            "id": "mean-value-theorem",
            "name": "中值定理",
            "subject": "calculus",
            "group": "微分学",
            "description": "罗尔定理、拉格朗日中值定理、柯西中值定理及其应用。",
            "difficulty": 3,
            "tags": ["中值定理", "拉格朗日"],
            "route": "/derivative",
            "formula": r"\exists \xi\in(a,b), f'(\xi)=\frac{f(b)-f(a)}{b-a}",
        },
        {
            "id": "lhopital",
            "name": "洛必达法则",
            "subject": "calculus",
            "group": "微分学",
            "description": "利用导数求解 0/0 与 ∞/∞ 型未定式极限的方法与注意事项。",
            "difficulty": 3,
            "tags": ["极限", "洛必达"],
            "route": "/derivative",
            "formula": r"\lim_{x\to a}\frac{f(x)}{g(x)} = \lim_{x\to a}\frac{f'(x)}{g'(x)}",
        },
        {
            "id": "taylor",
            "name": "泰勒公式",
            "subject": "calculus",
            "group": "微分学",
            "description": "用多项式局部逼近光滑函数，余项分析与泰勒级数展开。",
            "difficulty": 3,
            "tags": ["泰勒", "逼近"],
            "route": "/taylor",
            "formula": r"f(x)=\sum_{n=0}^{N}\frac{f^{(n)}(x_0)}{n!}(x-x_0)^n + R_N(x)",
        },
        {
            "id": "function-analysis",
            "name": "函数性态",
            "subject": "calculus",
            "group": "微分学",
            "description": "利用导数研究单调性、极值、凹凸性与拐点、渐近线。",
            "difficulty": 3,
            "tags": ["函数图像", "极值"],
            "route": "/derivative",
            "formula": r"f''(x)>0 \Rightarrow \text{下凸}",
        },
        # 微积分 - 积分学
        {
            "id": "indefinite-integral",
            "name": "不定积分",
            "subject": "calculus",
            "group": "积分学",
            "description": "原函数与不定积分的概念、基本积分表、换元积分与分部积分。",
            "difficulty": 2,
            "tags": ["积分", "原函数"],
            "route": "/integration",
            "formula": r"\int f(x)\,dx = F(x) + C",
        },
        {
            "id": "definite-integral",
            "name": "定积分",
            "subject": "calculus",
            "group": "积分学",
            "description": "定积分的定义、几何意义与基本性质，变上限积分。",
            "difficulty": 2,
            "tags": ["积分", "面积"],
            "route": "/integration",
            "formula": r"\int_a^b f(x)\,dx = \lim_{\lambda\to 0}\sum f(\xi_i)\Delta x_i",
        },
        {
            "id": "fundamental-theorem",
            "name": "微积分基本定理",
            "subject": "calculus",
            "group": "积分学",
            "description": "连接微分与积分的核心定理，揭示原函数与定积分的关系。",
            "difficulty": 3,
            "tags": ["积分", "基本定理"],
            "route": "/integration",
            "formula": r"\frac{d}{dx}\int_a^x f(t)\,dt = f(x)",
        },
        {
            "id": "integration-techniques",
            "name": "积分技巧",
            "subject": "calculus",
            "group": "积分学",
            "description": "三角换元、根式换元、分部积分、有理函数积分等常用技巧。",
            "difficulty": 3,
            "tags": ["积分", "换元"],
            "route": "/integration",
            "formula": r"\int u\,dv = uv - \int v\,du",
        },
        {
            "id": "improper-integral",
            "name": "反常积分",
            "subject": "calculus",
            "group": "积分学",
            "description": "无穷区间积分与无界函数积分，收敛性判别。",
            "difficulty": 4,
            "tags": ["积分", "反常积分"],
            "route": "/integration",
            "formula": r"\int_a^{+\infty} f(x)\,dx = \lim_{b\to+\infty}\int_a^b f(x)\,dx",
        },
        {
            "id": "numerical-integration",
            "name": "数值积分",
            "subject": "calculus",
            "group": "积分学",
            "description": "矩形法、梯形法、辛普森法等数值求积方法及误差分析。",
            "difficulty": 3,
            "tags": ["积分", "数值方法"],
            "route": "/integration",
            "formula": r"\int_a^b f(x)\,dx \approx \frac{b-a}{2n}\left[f(a)+2\sum f(x_i)+f(b)\right]",
        },
        {
            "id": "riemann-sum",
            "name": "黎曼和",
            "subject": "calculus",
            "group": "积分学",
            "description": "用矩形面积和逼近曲边梯形面积，直观理解定积分定义。",
            "difficulty": 2,
            "tags": ["积分", "黎曼和"],
            "route": "/integration",
            "formula": r"S_n = \sum_{i=1}^n f(x_i^*)\Delta x",
        },
        # 微积分 - 级数
        {
            "id": "series",
            "name": "数项级数",
            "subject": "calculus",
            "group": "级数",
            "description": "无穷级数的收敛与发散，正项级数、交错级数与常见审敛法。",
            "difficulty": 3,
            "tags": ["级数", "收敛"],
            "route": "/taylor",
            "formula": r"\sum_{n=1}^{\infty} a_n = \lim_{N\to\infty} S_N",
        },
        {
            "id": "power-series",
            "name": "幂级数",
            "subject": "calculus",
            "group": "级数",
            "description": "幂级数的收敛半径、和函数与逐项运算，泰勒级数特例。",
            "difficulty": 4,
            "tags": ["级数", "幂级数"],
            "route": "/taylor",
            "formula": r"\sum_{n=0}^{\infty} a_n (x-x_0)^n",
        },
        # 微积分 - 多元函数
        {
            "id": "multivariate-function",
            "name": "多元函数",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "多元函数的概念、定义域、等高线、曲面与向量值函数。",
            "difficulty": 2,
            "tags": ["多元函数", "曲面"],
            "route": "/multivariate",
            "formula": r"z = f(x,y)",
        },
        {
            "id": "partial-derivative",
            "name": "偏导数",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "多元函数对某一自变量的变化率，几何意义与计算。",
            "difficulty": 2,
            "tags": ["偏导数", "多元函数"],
            "route": "/multivariate",
            "formula": r"\frac{\partial f}{\partial x} = \lim_{h\to 0}\frac{f(x+h,y)-f(x,y)}{h}",
        },
        {
            "id": "total-differential",
            "name": "全微分",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "多元函数增量的线性主部，可微、偏导与连续的关系。",
            "difficulty": 3,
            "tags": ["全微分", "可微"],
            "route": "/multivariate",
            "formula": r"dz = \frac{\partial z}{\partial x}dx + \frac{\partial z}{\partial y}dy",
        },
        {
            "id": "multiple-integral",
            "name": "重积分",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "二重积分与三重积分的定义、计算与坐标变换。",
            "difficulty": 3,
            "tags": ["重积分", "二重积分"],
            "route": "/multivariate",
            "formula": r"\iint_D f(x,y)\,dxdy",
        },
        {
            "id": "line-integral",
            "name": "曲线积分",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "第一类与第二类曲线积分，物理意义与计算方法。",
            "difficulty": 3,
            "tags": ["曲线积分", "向量场"],
            "route": "/vector-field",
            "formula": r"\int_C \mathbf{F}\cdot d\mathbf{r}",
        },
        {
            "id": "surface-integral",
            "name": "曲面积分",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "第一类与第二类曲面积分，通量与方向。",
            "difficulty": 4,
            "tags": ["曲面积分", "通量"],
            "route": "/surface-integral",
            "formula": r"\iint_S \mathbf{F}\cdot d\mathbf{S}",
        },
        {
            "id": "green-theorem",
            "name": "格林公式",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "平面区域二重积分与边界曲线积分之间的联系。",
            "difficulty": 4,
            "tags": ["格林公式", "曲线积分"],
            "route": "/vector-field",
            "formula": r"\oint_L P\,dx+Q\,dy = \iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dxdy",
        },
        {
            "id": "gauss-theorem",
            "name": "高斯散度定理",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "空间区域三重积分与边界曲面积分之间的联系（通量与散度）。",
            "difficulty": 4,
            "tags": ["高斯定理", "散度"],
            "route": "/gauss-theorem",
            "formula": r"\iiint_V (\nabla\cdot\mathbf{F})\,dV = \iint_S \mathbf{F}\cdot d\mathbf{S}",
        },
        {
            "id": "stokes-theorem",
            "name": "斯托克斯公式",
            "subject": "calculus",
            "group": "多元微积分",
            "description": "曲面积分与边界曲线积分之间的联系（环量与旋度）。",
            "difficulty": 4,
            "tags": ["斯托克斯", "旋度"],
            "route": "/vector-field-3d",
            "formula": r"\oint_L \mathbf{F}\cdot d\mathbf{r} = \iint_S (\nabla\times\mathbf{F})\cdot d\mathbf{S}",
        },
        # 线性代数
        {
            "id": "vectors",
            "name": "向量",
            "subject": "linear-algebra",
            "group": "基础",
            "description": "向量的线性运算、内积、外积、线性相关与线性无关。",
            "difficulty": 1,
            "tags": ["向量", "线性相关"],
            "route": "/matrix",
            "formula": r"\mathbf{a}\cdot\mathbf{b} = |\mathbf{a}||\mathbf{b}|\cos\theta",
        },
        {
            "id": "matrices",
            "name": "矩阵",
            "subject": "linear-algebra",
            "group": "基础",
            "description": "矩阵的运算、逆矩阵、秩与初等变换。",
            "difficulty": 2,
            "tags": ["矩阵", "逆矩阵"],
            "route": "/matrix",
            "formula": r"(AB)^{-1} = B^{-1}A^{-1}",
        },
        {
            "id": "determinants",
            "name": "行列式",
            "subject": "linear-algebra",
            "group": "基础",
            "description": "行列式的定义、性质、计算方法与几何意义。",
            "difficulty": 2,
            "tags": ["行列式", "几何意义"],
            "route": "/matrix",
            "formula": r"\det(A) = \prod_i \lambda_i",
        },
        {
            "id": "linear-systems",
            "name": "线性方程组",
            "subject": "linear-algebra",
            "group": "基础",
            "description": "高斯消元、解的结构、齐次与非齐次方程组。",
            "difficulty": 2,
            "tags": ["线性方程组", "高斯消元"],
            "route": "/matrix",
            "formula": r"A\mathbf{x} = \mathbf{b}",
        },
        {
            "id": "vector-spaces",
            "name": "向量空间",
            "subject": "linear-algebra",
            "group": "进阶",
            "description": "向量空间、子空间、基、维数与坐标变换。",
            "difficulty": 3,
            "tags": ["向量空间", "基"],
            "route": "/matrix",
            "formula": r"\dim(V) = \text{基中向量个数}",
        },
        {
            "id": "eigenvalues",
            "name": "特征值与特征向量",
            "subject": "linear-algebra",
            "group": "进阶",
            "description": "矩阵特征值、特征向量的定义、计算与对角化应用。",
            "difficulty": 3,
            "tags": ["特征值", "特征向量"],
            "route": "/matrix",
            "formula": r"A\mathbf{v} = \lambda\mathbf{v}",
        },
        {
            "id": "quadratic-forms",
            "name": "二次型",
            "subject": "linear-algebra",
            "group": "进阶",
            "description": "二次型的矩阵表示、标准形、正定性判别。",
            "difficulty": 4,
            "tags": ["二次型", "正定性"],
            "route": "/matrix",
            "formula": r"Q(\mathbf{x}) = \mathbf{x}^T A \mathbf{x}",
        },
        # 概率统计
        {
            "id": "probability-basics",
            "name": "概率基础",
            "subject": "probability",
            "group": "基础",
            "description": "随机事件、概率公理化定义、条件概率、独立性、贝叶斯公式。",
            "difficulty": 1,
            "tags": ["概率", "条件概率"],
            "route": "/probability",
            "formula": r"P(A|B) = \frac{P(AB)}{P(B)}",
        },
        {
            "id": "random-variables",
            "name": "随机变量",
            "subject": "probability",
            "group": "基础",
            "description": "离散型与连续型随机变量、分布律、分布函数与密度函数。",
            "difficulty": 2,
            "tags": ["随机变量", "分布函数"],
            "route": "/distributions",
            "formula": r"F(x) = P(X \le x)",
        },
        {
            "id": "distributions",
            "name": "常见概率分布",
            "subject": "probability",
            "group": "基础",
            "description": "二项、泊松、正态、指数、均匀等常见分布及其性质。",
            "difficulty": 2,
            "tags": ["分布", "正态分布"],
            "route": "/distributions",
            "formula": r"X \sim N(\mu, \sigma^2)",
        },
        {
            "id": "expectation-variance",
            "name": "期望与方差",
            "subject": "probability",
            "group": "数字特征",
            "description": "数学期望、方差、协方差、相关系数及其性质。",
            "difficulty": 2,
            "tags": ["期望", "方差"],
            "route": "/probability",
            "formula": r"E[X] = \int_{-\infty}^{+\infty} x f(x)\,dx",
        },
        {
            "id": "law-of-large-numbers",
            "name": "大数定律",
            "subject": "probability",
            "group": "极限定理",
            "description": "样本均值依概率收敛到期望值，蒙特卡洛模拟的理论基础。",
            "difficulty": 3,
            "tags": ["大数定律", "收敛"],
            "route": "/probability",
            "formula": r"\frac{1}{n}\sum_{i=1}^n X_i \xrightarrow{P} E[X]",
        },
        {
            "id": "central-limit-theorem",
            "name": "中心极限定理",
            "subject": "probability",
            "group": "极限定理",
            "description": "独立同分布随机变量和的标准化渐近服从正态分布。",
            "difficulty": 3,
            "tags": ["中心极限定理", "正态逼近"],
            "route": "/clt",
            "formula": r"\frac{\sum X_i - n\mu}{\sqrt{n}\sigma} \xrightarrow{d} N(0,1)",
        },
        {
            "id": "parameter-estimation",
            "name": "参数估计",
            "subject": "probability",
            "group": "统计推断",
            "description": "矩估计、最大似然估计、估计量的无偏性与有效性。",
            "difficulty": 3,
            "tags": ["参数估计", "最大似然"],
            "route": "/distributions",
            "formula": r"\hat{\theta} = \arg\max_\theta L(\theta; x_1,\dots,x_n)",
        },
    ]

    PREREQUISITES: list[dict[str, Any]] = [
        # 基础 -> 极限
        {"source": "functions", "target": "limit-function", "reason": "函数图像是理解极限的直观基础", "strength": 3},
        {"source": "sequences", "target": "limit-sequence", "reason": "数列极限是数列概念的延伸", "strength": 3},
        {"source": "limit-function", "target": "limit-sequence", "reason": "数列可看作定义域离散化的函数", "strength": 1},
        # 极限 -> 严格定义 / 连续
        {"source": "limit-function", "target": "epsilon-delta", "reason": "ε-δ 语言是函数极限的严格化表述", "strength": 3},
        {"source": "limit-function", "target": "continuity", "reason": "连续性由极限等于函数值定义", "strength": 3},
        # 极限 -> 导数
        {"source": "limit-function", "target": "derivative-definition", "reason": "导数本质是一种特殊极限", "strength": 3},
        {"source": "functions", "target": "derivative-definition", "reason": "需要熟悉函数值随自变量变化的关系", "strength": 2},
        # 导数 -> 微分学各主题
        {"source": "derivative-definition", "target": "derivative-rules", "reason": "求导法则是导数定义的实用化推广", "strength": 3},
        {"source": "derivative-rules", "target": "higher-derivatives", "reason": "高阶导数需要熟练掌握一阶求导", "strength": 3},
        {"source": "derivative-definition", "target": "differential", "reason": "微分是导数概念的线性化表述", "strength": 3},
        {"source": "derivative-rules", "target": "mean-value-theorem", "reason": "中值定理的证明依赖导数与连续性", "strength": 2},
        {"source": "derivative-rules", "target": "lhopital", "reason": "洛必达法则直接基于导数计算极限", "strength": 3},
        {"source": "derivative-rules", "target": "taylor", "reason": "泰勒公式需要多次求导构造多项式逼近", "strength": 3},
        {"source": "derivative-rules", "target": "function-analysis", "reason": "函数性态通过导数符号判断", "strength": 3},
        {"source": "continuity", "target": "function-analysis", "reason": "作图分析需要函数连续不间断", "strength": 1},
        # 导数 -> 积分
        {"source": "derivative-definition", "target": "indefinite-integral", "reason": "不定积分是求导的逆运算", "strength": 3},
        {"source": "limit-function", "target": "definite-integral", "reason": "定积分定义依赖求和极限", "strength": 3},
        {"source": "indefinite-integral", "target": "definite-integral", "reason": "定积分计算常借助原函数", "strength": 2},
        {"source": "definite-integral", "target": "fundamental-theorem", "reason": "微积分基本定理揭示变上限积分与原函数关系", "strength": 3},
        {"source": "indefinite-integral", "target": "integration-techniques", "reason": "积分技巧建立在原函数求法之上", "strength": 3},
        {"source": "definite-integral", "target": "integration-techniques", "reason": "定积分同样需要换元与分部技巧", "strength": 2},
        {"source": "definite-integral", "target": "improper-integral", "reason": "反常积分是定积分在无穷或无界情形的推广", "strength": 3},
        {"source": "definite-integral", "target": "numerical-integration", "reason": "数值积分用离散和逼近定积分", "strength": 3},
        {"source": "definite-integral", "target": "riemann-sum", "reason": "黎曼和是定积分定义的直观表达", "strength": 3},
        # 数列/极限 -> 级数
        {"source": "sequences", "target": "series", "reason": "级数是数列部分和的极限", "strength": 3},
        {"source": "limit-function", "target": "series", "reason": "级数收敛性判断需要极限工具", "strength": 2},
        {"source": "series", "target": "power-series", "reason": "幂级数是函数项级数的重要特例", "strength": 3},
        {"source": "taylor", "target": "power-series", "reason": "泰勒级数是幂级数在光滑函数上的应用", "strength": 2},
        # 函数/极限 -> 多元函数
        {"source": "functions", "target": "multivariate-function", "reason": "多元函数是一元函数的自然推广", "strength": 2},
        {"source": "limit-function", "target": "multivariate-function", "reason": "多元函数极限需要考虑多方向趋近", "strength": 2},
        {"source": "vectors", "target": "multivariate-function", "reason": "多元微积分中常用向量与梯度描述变化", "strength": 1},
        {"source": "multivariate-function", "target": "partial-derivative", "reason": "偏导数是固定其他变量后的一元导数", "strength": 3},
        {"source": "partial-derivative", "target": "total-differential", "reason": "全微分综合各偏导数信息", "strength": 3},
        {"source": "partial-derivative", "target": "multiple-integral", "reason": "重积分计算常化累次积分，需偏导与单变量积分", "strength": 2},
        {"source": "definite-integral", "target": "multiple-integral", "reason": "重积分通过累次定积分计算", "strength": 3},
        {"source": "partial-derivative", "target": "line-integral", "reason": "曲线积分常与向量场的偏导数相关", "strength": 2},
        {"source": "partial-derivative", "target": "surface-integral", "reason": "曲面积分计算涉及曲面参数求导", "strength": 2},
        {"source": "line-integral", "target": "green-theorem", "reason": "格林公式联系平面曲线积分与二重积分", "strength": 3},
        {"source": "surface-integral", "target": "gauss-theorem", "reason": "高斯公式联系曲面积分与三重积分", "strength": 3},
        {"source": "line-integral", "target": "stokes-theorem", "reason": "斯托克斯公式联系曲线积分与曲面积分", "strength": 3},
        {"source": "surface-integral", "target": "stokes-theorem", "reason": "斯托克斯公式需要曲面积分作为右侧", "strength": 3},
        # 线性代数内部
        {"source": "vectors", "target": "matrices", "reason": "矩阵可看作向量的排列，矩阵运算基于向量运算", "strength": 2},
        {"source": "matrices", "target": "determinants", "reason": "行列式是方阵的数值特征", "strength": 3},
        {"source": "matrices", "target": "linear-systems", "reason": "线性方程组可用矩阵紧凑表示", "strength": 3},
        {"source": "vectors", "target": "vector-spaces", "reason": "向量空间是向量的抽象化", "strength": 3},
        {"source": "linear-systems", "target": "vector-spaces", "reason": "解空间是向量空间的典型例子", "strength": 2},
        {"source": "vector-spaces", "target": "eigenvalues", "reason": "特征值理论在抽象向量空间中展开", "strength": 3},
        {"source": "eigenvalues", "target": "quadratic-forms", "reason": "二次型标准化依赖特征值与正交变换", "strength": 3},
        # 概率统计内部
        {"source": "probability-basics", "target": "random-variables", "reason": "随机变量将事件数量化", "strength": 3},
        {"source": "random-variables", "target": "distributions", "reason": "分布描述随机变量的概率规律", "strength": 3},
        {"source": "distributions", "target": "expectation-variance", "reason": "期望方差由分布计算得到", "strength": 3},
        {"source": "expectation-variance", "target": "law-of-large-numbers", "reason": "大数定律描述样本均值与期望的收敛", "strength": 3},
        {"source": "random-variables", "target": "central-limit-theorem", "reason": "中心极限定理研究随机变量和的分布", "strength": 2},
        {"source": "law-of-large-numbers", "target": "central-limit-theorem", "reason": "二者都是大量独立随机变量和的极限行为", "strength": 1},
        {"source": "distributions", "target": "parameter-estimation", "reason": "参数估计需要假设总体分布形式", "strength": 2},
    ]

    # 概念到已存在可视化页面的补充映射（route 已含主要链接，此处做扩展）
    VISUALIZATION_LINKS: dict[str, list[dict[str, str]]] = {
        "limit-function": [
            {"label": "ε-δ 极限可视化", "path": "/limit"},
        ],
        "epsilon-delta": [
            {"label": "ε-δ 极限可视化", "path": "/limit"},
        ],
        "derivative-definition": [
            {"label": "导数与切线", "path": "/derivative"},
        ],
        "derivative-rules": [
            {"label": "导数与切线", "path": "/derivative"},
        ],
        "taylor": [
            {"label": "泰勒级数可视化", "path": "/taylor"},
        ],
        "power-series": [
            {"label": "泰勒级数可视化", "path": "/taylor"},
        ],
        "definite-integral": [
            {"label": "黎曼积分", "path": "/integration"},
        ],
        "riemann-sum": [
            {"label": "黎曼积分", "path": "/integration"},
        ],
        "numerical-integration": [
            {"label": "黎曼积分", "path": "/integration"},
        ],
        "matrices": [
            {"label": "矩阵变换可视化", "path": "/matrix"},
        ],
        "determinants": [
            {"label": "矩阵变换可视化", "path": "/matrix"},
        ],
        "eigenvalues": [
            {"label": "矩阵变换可视化", "path": "/matrix"},
        ],
        "multivariate-function": [
            {"label": "多元函数可视化", "path": "/multivariate"},
        ],
        "partial-derivative": [
            {"label": "多元函数可视化", "path": "/multivariate"},
        ],
        "line-integral": [
            {"label": "向量场与线积分", "path": "/vector-field"},
        ],
        "green-theorem": [
            {"label": "向量场与线积分", "path": "/vector-field"},
        ],
        "surface-integral": [
            {"label": "曲面积分", "path": "/surface-integral"},
        ],
        "gauss-theorem": [
            {"label": "高斯定理", "path": "/gauss-theorem"},
        ],
        "stokes-theorem": [
            {"label": "3D 向量场", "path": "/vector-field-3d"},
        ],
        "law-of-large-numbers": [
            {"label": "大数定律模拟", "path": "/probability"},
        ],
        "distributions": [
            {"label": "常见概率分布", "path": "/distributions"},
        ],
        "central-limit-theorem": [
            {"label": "中心极限定理", "path": "/clt"},
        ],
    }

    def __init__(self):
        self._concept_index = {c["id"]: c for c in self.CONCEPTS}
        self._adjacency: dict[str, list[str]] = {c["id"]: [] for c in self.CONCEPTS}
        self._reverse_adjacency: dict[str, list[str]] = {c["id"]: [] for c in self.CONCEPTS}
        for edge in self.PREREQUISITES:
            src, tgt = edge["source"], edge["target"]
            if src in self._concept_index and tgt in self._concept_index:
                self._adjacency[src].append(tgt)
                self._reverse_adjacency[tgt].append(src)

    def get_graph(self) -> dict[str, Any]:
        """返回完整知识图谱"""
        return {
            "subjects": self.SUBJECTS,
            "nodes": self.CONCEPTS,
            "edges": self.PREREQUISITES,
            "meta": {
                "concept_count": len(self.CONCEPTS),
                "edge_count": len(self.PREREQUISITES),
            },
        }

    def get_concept(self, concept_id: str) -> dict[str, Any] | None:
        """获取单个概念详情，包括前置与后继概念"""
        concept = self._concept_index.get(concept_id)
        if not concept:
            return None

        prerequisites = [
            {
                "id": src,
                "name": self._concept_index[src]["name"],
                "subject": self._concept_index[src]["subject"],
                "reason": next(
                    (e["reason"] for e in self.PREREQUISITES if e["source"] == src and e["target"] == concept_id),
                    "",
                ),
            }
            for src in self._reverse_adjacency[concept_id]
        ]

        next_concepts = [
            {
                "id": tgt,
                "name": self._concept_index[tgt]["name"],
                "subject": self._concept_index[tgt]["subject"],
                "reason": next(
                    (e["reason"] for e in self.PREREQUISITES if e["source"] == concept_id and e["target"] == tgt),
                    "",
                ),
            }
            for tgt in self._adjacency[concept_id]
        ]

        return {
            **concept,
            "prerequisites": prerequisites,
            "next_concepts": next_concepts,
            "visualizations": self.VISUALIZATION_LINKS.get(concept_id, []),
        }

    def get_learning_path(self, goal_id: str) -> dict[str, Any] | None:
        """
        计算从基础到目标概念的最短前置路径（BFS）。
        返回从起点到目标的有序概念列表。
        """
        if goal_id not in self._concept_index:
            return None

        # BFS 从 goal 反向追溯到没有前置知识的概念
        queue = deque([(goal_id, [goal_id])])
        visited = {goal_id}

        while queue:
            current, path = queue.popleft()
            prereqs = self._reverse_adjacency[current]
            if not prereqs:
                # 找到一条从基础到 goal 的路径
                return {
                    "goal_id": goal_id,
                    "goal_name": self._concept_index[goal_id]["name"],
                    "path": [
                        {
                            "id": cid,
                            "name": self._concept_index[cid]["name"],
                            "subject": self._concept_index[cid]["subject"],
                        }
                        for cid in reversed(path)
                    ],
                }

            for prereq in prereqs:
                if prereq not in visited:
                    visited.add(prereq)
                    queue.append((prereq, path + [prereq]))

        # 未找到基础起点，返回仅含目标的路径
        return {
            "goal_id": goal_id,
            "goal_name": self._concept_index[goal_id]["name"],
            "path": [
                {
                    "id": goal_id,
                    "name": self._concept_index[goal_id]["name"],
                    "subject": self._concept_index[goal_id]["subject"],
                }
            ],
        }

    def get_related_visualizations(self, concept_id: str) -> list[dict[str, str]]:
        """获取与概念相关的可视化链接"""
        if concept_id not in self._concept_index:
            return []
        return self.VISUALIZATION_LINKS.get(concept_id, [])


# 全局单例，图谱数据为只读
_knowledge_graph_service: KnowledgeGraphService | None = None


def get_knowledge_graph_service() -> KnowledgeGraphService:
    """获取知识图谱服务单例"""
    global _knowledge_graph_service
    if _knowledge_graph_service is None:
        _knowledge_graph_service = KnowledgeGraphService()
    return _knowledge_graph_service
