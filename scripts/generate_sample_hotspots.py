#!/usr/bin/env python3
"""生成首批「数说热点」样例内容。

这些样例展示内容 schema 的标准形态；后续每期由 AI 按同样结构追加到
backend/app/resources/hotspots.json（可用 scripts/validate_hotspots.py 校验）。
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / 'backend' / 'app' / 'resources' / 'hotspots.json'


def layout(title, xaxis, yaxis, height=380):
    return {
        'title': {'text': title, 'font': {'size': 15}},
        'xaxis': {'title': {'text': xaxis}},
        'yaxis': {'title': {'text': yaxis}},
        'height': height,
        'margin': {'l': 55, 'r': 20, 't': 45, 'b': 58},
        'hovermode': 'closest',
        'showlegend': True,
        'legend': {'orientation': 'h', 'y': -0.16, 'x': 0, 'font': {'size': 10}},
        'paper_bgcolor': 'rgba(0,0,0,0)',
        'plot_bgcolor': 'rgba(0,0,0,0)',
        'font': {'family': 'sans-serif', 'size': 12},
    }


def kuramoto_figure():
    """Kuramoto 模型：弱耦合 vs 强耦合的序参量 R(t)"""
    rng = np.random.default_rng(42)
    n, t = 8, np.linspace(0, 25, 160)
    omega = np.linspace(-1.2, 1.2, n)
    traces = []
    for label, K, color in [('弱耦合 K=0.3（各走各的）', 0.3, '#888'),
                            ('强耦合 K=2.5（趋于同步）', 2.5, '#9c3b2e')]:
        theta = rng.uniform(0, 2 * np.pi, n)
        R = []
        for _ in t:
            R.append(abs(np.exp(1j * theta).mean()))
            d = omega + K * np.sin(theta[None, :] - theta[:, None]).mean(axis=1)
            theta = theta + 0.05 * d
        traces.append({'type': 'scatter', 'mode': 'lines', 'name': label,
                       'x': t.tolist(), 'y': [round(v, 4) for v in R],
                       'line': {'color': color, 'width': 2.5}})
    return {'data': traces,
            'layout': layout('序参量 R(t)：越接近 1 越整齐', '时间 t', '同步程度 R', 360)}


def triple_star_figure():
    """径向速度法：观测散点 + 正弦拟合曲线"""
    rng = np.random.default_rng(7)
    T, K, v0 = 1.8, 16.0, 4.0
    t_obs = np.linspace(0, 3.6, 26)
    v_obs = v0 + K * np.sin(2 * np.pi * t_obs / T) + rng.normal(0, 1.1, len(t_obs))
    t_fit = np.linspace(0, 3.6, 200)
    v_fit = v0 + K * np.sin(2 * np.pi * t_fit / T)
    return {
        'data': [
            {'type': 'scatter', 'mode': 'markers', 'name': '望远镜观测',
             'x': [round(v, 3) for v in t_obs], 'y': [round(v, 2) for v in v_obs],
             'marker': {'color': '#9c3b2e', 'size': 8, 'opacity': 0.85}},
            {'type': 'scatter', 'mode': 'lines', 'name': '拟合的正弦曲线',
             'x': [round(v, 3) for v in t_fit], 'y': [round(v, 2) for v in v_fit],
             'line': {'color': '#2c6e8f', 'width': 2.5}},
        ],
        'layout': layout('径向速度 v(t)：看不见的伴星拉出的正弦摆动',
                         '时间（任意单位）', '径向速度 (km/s)', 360),
    }


def weightlifting_figure():
    """举重级别与总成绩：幂律拟合（示意数据）"""
    mass = np.array([55, 61, 67, 73, 81, 89, 96, 102, 109, 131], dtype=float)
    # 教学示意：按 W = 20.2 * M^(2/3) 生成，量级贴近各级别世界纪录
    record = np.round(20.2 * mass ** (2 / 3)).astype(int)
    m_line = np.linspace(50, 135, 160)
    w_line = 20.2 * m_line ** (2 / 3)
    return {
        'data': [
            {'type': 'scatter', 'mode': 'markers+text', 'name': '各级别纪录（示意量级）',
             'x': mass.tolist(), 'y': record.tolist(),
             'text': [str(int(m)) + 'kg' for m in mass],
             'textposition': 'top center', 'textfont': {'size': 9},
             'marker': {'color': '#9c3b2e', 'size': 10}},
            {'type': 'scatter', 'mode': 'lines', 'name': '幂律 W ∝ M^(2/3)',
             'x': [round(v, 1) for v in m_line], 'y': [round(v, 1) for v in w_line],
             'line': {'color': '#2c6e8f', 'width': 2.5, 'dash': 'dash'}},
        ],
        'layout': layout('总成绩随体重增长，但增长越来越慢（示意曲线）',
                         '体重级别 (kg)', '总成绩 (kg，示意)', 360),
    }


def binomial_figure():
    """二项分布：23 投 15 中的命中数分布"""
    from math import comb
    n, p = 23, 0.652
    ks = list(range(n + 1))
    probs = [comb(n, k) * p ** k * (1 - p) ** (n - k) for k in ks]
    colors = ['#9c3b2e' if k == 15 else '#b9c4cc' for k in ks]
    return {
        'data': [{'type': 'bar', 'x': ks, 'y': [round(v, 4) for v in probs],
                  'name': 'P(命中 k 球)',
                  'marker': {'color': colors},
                  'hovertemplate': '命中 %{x} 球：概率 %{y:.3f}<extra></extra>'}],
        'layout': layout('若真实命中率是 65.2%，23 投 15 中有多罕见？',
                         '命中数 k', '概率', 360),
    }


hotspots = [
    {
        'id': 'hot-20261117-robot-sync',
        'date': '2026-11-17',
        'category': '科技',
        'branch': 'linear-algebra',
        'topic': '相位同步',
        'headline': '151 台机器人同时起舞：它们怎么做到"心有灵犀"？',
        'summary': '深圳一场表演中，151 台人形机器人整齐列队、同步变换舞姿，创下吉尼斯世界纪录。每台机器人的电机都有微小误差，为什么它们没有越跳越乱？',
        'question': '一群各自为政的"振子"，要靠多少"默契"才能自发走向一致？',
        'concept': '耦合振子与拉普拉斯谱',
        'formula': r'\dot\theta_i=\omega_i+\frac{K}{N}\sum_{j=1}^{N}\sin(\theta_j-\theta_i),\qquad \delta(t)\sim e^{-K\lambda_2 t}',
        'formula_note': 'θᵢ 是第 i 台的节拍相位，ωᵢ 是它自己的节奏偏差；K 是"互相看齐"的强度。λ₂ 是耦合网络拉普拉斯矩阵的第二小特征值（代数连通度），它决定整体趋于同步的快慢。',
        'steps': [
            {'title': '1 · 把每台机器人看成一个振子',
             'body': '如果各跳各的，相位 θᵢ 会以不同速度 ωᵢ 漂移，很快乱成一团。机器人之间需要"互相参考"——这就是耦合。'},
            {'title': '2 · 加一点点耦合就够了',
             'body': 'Kuramoto 模型说：每台机器人只需要感知别人相位的平均趋势，不必知道全局。当 K 超过某个临界值，原本分散的相位会自发收敛。'},
            {'title': '3 · 同步快慢由特征值决定',
             'body': '把"谁参考谁"写成拉普拉斯矩阵 L，线性化后误差按 e^(−Kλ₂t) 衰减。λ₂ 越大（网络连接越好），同步越快——这是线性代数里特征值最直观的工程含义之一。'},
        ],
        'insight': '所以整齐不是"每台都精准"，而是"彼此看得见"。提高网络的代数连通度 λ₂，比一味提高单机精度更有效。',
        'figure': kuramoto_figure(),
        'figure_caption': '同样的 8 个振子：弱耦合时同步程度 R 在低处徘徊，强耦合时 R 快速趋近 1。',
        'try_it': {
            'text': '如果把机器人排成一条线（每台只看相邻两台），和"人人互联"相比，λ₂ 会变大还是变小？哪种队形同步更快？',
            'answer': '会变小。人人互联的全连接图 λ₂ = N，而链式结构的 λ₂ ≈ O(1/N²)，随规模急剧缩小——所以长队形同步慢得多。这正是"全连接"比"手拉手"整齐得快的数学原因。',
        },
        'concepts': ['eigenvalues', 'matrices', 'vectors'],
        'modules': ['/eigenvalues', '/matrix'],
        'source': '科技新闻：深圳人形机器人集体舞蹈（2026-11）',
        'source_url': '',
        'tags': ['同步', 'Kuramoto', '拉普拉斯矩阵', '特征值'],
    },
    {
        'id': 'hot-20261120-triple-star',
        'date': '2026-11-20',
        'category': '天文',
        'branch': 'calculus',
        'topic': '径向速度法',
        'headline': '看不见的伴星，天文学家是怎么"称"出它的质量的？',
        'summary': '距地球 28 光年的 Welopōʻai 系统被发现由两颗白矮星和一颗红矮星组成。其中一颗伴星几乎不发光，研究团队却测出红矮星的径向速度摆动接近 16 km/s——比预期大了上千倍。',
        'question': '看不到一颗星，怎么知道那里"有东西"、而且质量超过太阳一半？',
        'concept': '周期信号拟合与导数',
        'formula': r'v_r(t)=v_0+K\sin\!\left(\frac{2\pi t}{T}\right),\qquad K\approx\left(\frac{2\pi G}{T}\right)^{1/3}\frac{m_2\sin i}{(m_1+m_2)^{2/3}}',
        'formula_note': '恒星绕共同质心运动时，速度沿视线方向的分量 vᵣ 呈正弦变化。测出振幅 K 和周期 T，就能反推伴星质量 m₂（换个角度理解：光谱的多普勒频移就是 vᵣ 的导数信号）。',
        'steps': [
            {'title': '1 · 看不见，但听得见"摆动"',
             'body': '行星或伴星引力拖拽恒星，使它绕质心做小幅圆周运动。恒星光谱周期性红移、蓝移，测出这个速度摆动的周期 T 和幅度 K。'},
            {'title': '2 · 从摆动幅度反推质量',
             'body': '开普勒第三定律把周期 T 和轨道半径联系起来；质心关系把半径和两星质量比联系起来。两者结合，就得到上式——这正是"用微积分和力学做反问题"的典范。'},
            {'title': '3 · 为什么"比预期大 1000 倍"很关键',
             'body': '速度摆幅越大，说明拖拽者质量越大。16 km/s 的摆动暗示那颗看不见的伴星超过半个太阳质量——普通行星绝无可能，因此只能是白矮星这类致密天体。'},
        ],
        'insight': '天文学里大量发现不是"看见"的，而是从可测量的周期信号里"算出来"的。你在课上学正弦函数和导数，天文学家拿它找星星。',
        'figure': triple_star_figure(),
        'figure_caption': '观测点（红）呈现周期性摆动，拟合出的正弦曲线（蓝）给出振幅 K≈16 km/s、周期 T≈1.8（示意单位）。',
        'try_it': {
            'text': '如果伴星轨道平面几乎正对望远镜（倾角 i≈90°），sin i≈1；如果几乎侧对（i≈0），测到的 K 会怎样？这对质量估计有什么影响？',
            'answer': 'K 正比于 sin i，i≈0 时 K≈0，几乎测不到摆动。因此径向速度法给出的其实是 m₂·sin i，是真实质量的下限；要得到真实质量需结合其他观测（如凌星）确定倾角。',
        },
        'concepts': ['trigonometry', 'derivative-rules', 'functions'],
        'modules': ['/derivative', '/taylor'],
        'source': '科技新闻：Welopōʻai 三合星系统发现（2026-11）',
        'source_url': '',
        'tags': ['径向速度', '正弦拟合', '开普勒定律', '多普勒'],
    },
    {
        'id': 'hot-20261102-weightlifting',
        'date': '2026-11-02',
        'category': '体育',
        'branch': 'statistics',
        'topic': '幂律与尺度',
        'headline': '举重为什么要按体重分级？一道 2/3 次方的数学题',
        'summary': '2026 年举重世锦赛上，17 人 42 次改写世界纪录。比赛从 55kg 到 109kg 以上分成十几个级别——如果不分级，体重更大的选手是否天然占优？优势又有多大？',
        'question': '体重增加一倍，能举起的重量也会翻倍吗？',
        'concept': '异速生长幂律',
        'formula': r'W \propto M^{2/3}\quad\Longrightarrow\quad \frac{W_1}{W_2}=\left(\frac{M_1}{M_2}\right)^{2/3}',
        'formula_note': '肌肉能产生的力量大致正比于肌纤维的横截面积（~长度²），而体重正比于体积（~长度³）。所以力量 W 随体重 M 增长，但指数是 2/3 而不是 1。',
        'steps': [
            {'title': '1 · 平方与立方的博弈',
             'body': '把身体等比放大 2 倍：体积（体重）变成 8 倍，但肌肉横截面积只变成 4 倍。于是"每公斤体重能举起多少"反而下降。'},
            {'title': '2 · 数据确实这么走',
             'body': '把各级别世界纪录画在图上，总成绩随体重上升但增速渐缓，幂律曲线 W ∝ M^(2/3) 能很好地描述这条上凸的轨迹（图中为教学示意数据，量级贴近真实纪录）。'},
            {'title': '3 · 分级的公平性',
             'body': '正因为体重带来系统性优势，举重、拳击、柔道才按体重分级——这不只是"公平感"，而是有明确数学依据的尺度律在起作用。'},
        ],
        'insight': '幂律 W ∝ M^(2/3) 也解释了为什么蚂蚁能举起自身几十倍重量、大象却连自己都难驮动——尺度一变，规律就变。',
        'figure': weightlifting_figure(),
        'figure_caption': '各级别纪录（红点）随体重上升但趋缓，虚线是幂律 W ∝ M^(2/3) 的拟合曲线。',
        'try_it': {
            'text': '若甲选手体重是乙的 2 倍，按 2/3 次幂律，甲的总成绩大约是乙的多少倍？如果按线性关系估计会高估多少？',
            'answer': '2^(2/3) ≈ 1.59 倍。线性关系会预测 2 倍，高估约 (2−1.59)/1.59 ≈ 26%。这就是"大体重优势没想象的那么大"的定量答案。',
        },
        'concepts': ['exponential-log', 'functions', 'parameter-estimation'],
        'modules': ['/integration', '/distributions'],
        'source': '体育新闻：2026 世界举重锦标赛（宁波）',
        'source_url': '',
        'tags': ['幂律', '尺度律', '数据拟合', '体育'],
    },
    {
        'id': 'hot-20261122-nba-empty-carriage',
        'date': '2026-11-22',
        'category': '体育',
        'branch': 'probability',
        'topic': '二项分布与期望',
        'headline': '砍下 50 分还是输球：为什么"空砍"在数学上很合理？',
        'summary': '一场 NBA 比赛，某球员 23 投 15 中、三分 12 中 7、罚球 13 罚全中，独得 50 分，球队却以 3 分之差落败。个人表现如此高光，为什么赢不了？',
        'question': '一个球员"超常发挥"，对球队获胜的把握有多大提升？',
        'concept': '二项分布、期望与方差',
        'formula': r'X\sim B(n,p),\qquad E[X]=np,\qquad \mathrm{Var}(X)=np(1-p)',
        'formula_note': '把每次出手看作一次伯努利试验：命中数 X 服从二项分布 B(n,p)。个人得分是随机变量的样本，而球队胜负取决于全队多次得分的叠加。',
        'steps': [
            {'title': '1 · 50 分有多罕见？',
             'body': '假设该球员赛季真实命中率 65.2%，那么 23 投命中 ≥15 次的概率其实高达约 59%——对高命中率射手来说，15 中并不罕见。反倒是罚球 13 罚全中（若罚球率 90%，概率约 25%）更难。"超常"往往是相对均值，不是奇迹。'},
            {'title': '2 · 一场比赛是很多随机数的和',
             'body': '全队十几个人、上百次出手，每一次都是带波动的伯努利试验。个人那 50 分的"正波动"，很容易被队友的低迷或其他人的爆发抵消。'},
            {'title': '3 · 样本越多，越接近期望',
             'body': '由大数定律，出手次数越多，实际命中率越接近真实水平。单场的高光会在赛季尺度被"平均"掉——这就是"空砍"在概率上完全合理的原因。'},
        ],
        'insight': '别用单场数据判断一个球员"实力"。想看清真实水平，要看足够多场次——方差会随样本量增大而相对变小。这正是概率论教给球迷的理性。',
        'figure': binomial_figure(),
        'figure_caption': '命中率的二项分布：15 中（红柱）位于右侧尾部，罕见但不离谱。',
        'try_it': {
            'text': '若命中率从 65.2% 降到 50%，23 投 15 中的概率会变大还是变小？直观上"手感"的变化对极端表现的敏感度高吗？',
            'answer': '会显著变小：p 从 0.652 降到 0.5，P(X≥15) 从约 59% 掉到约 10.5%。尾部概率对 p 很敏感，但 59% 也提醒我们——对高命中率球员来说，15 中这种"高光"其实相当常见，单场爆发不能稳健地证明实力提升。',
        },
        'concepts': ['probability-basics', 'random-variables', 'distributions', 'law-of-large-numbers'],
        'modules': ['/probability', '/distributions', '/clt'],
        'source': '体育新闻：NBA 常规赛个人 50 分表现（2026-11-22）',
        'source_url': '',
        'tags': ['二项分布', '大数定律', '期望', '体育'],
    },
]

DST.parent.mkdir(parents=True, exist_ok=True)
DST.write_text(json.dumps(hotspots, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Wrote {len(hotspots)} hotspots to {DST}')
