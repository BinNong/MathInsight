"""
数说热点 · 数值计算配方库。

内容生成流水线的"事实来源"：LLM 只负责选题与文字骨架（用 {{key}} 占位），
所有数值与图表数据一律由这里的 Python 函数用 numpy/scipy 实算生成后回填，
前端不现算。每个配方返回 facts（可直接嵌入中文句子的字符串）+ figure（Plotly）。

图表只用 scatter / bar / contour / heatmap 四种 trace，点数 <= 200，
配色沿用站点主色 #9c3b2e 与辅助色 #2c6e8f。
"""
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
from scipy import stats

MAIN = '#9c3b2e'
AUX = '#2c6e8f'


def _layout(title: str, xaxis: str, yaxis: str, height: int = 360) -> dict[str, Any]:
    return {
        'title': {'text': title, 'font': {'size': 15}},
        'xaxis': {'title': {'text': xaxis}},
        'yaxis': {'title': {'text': yaxis}},
        'height': height,
        'margin': {'l': 60, 'r': 20, 't': 45, 'b': 58},
        'hovermode': 'closest',
        'showlegend': True,
        'legend': {'orientation': 'h', 'y': -0.16, 'x': 0, 'font': {'size': 10}},
        'paper_bgcolor': 'rgba(0,0,0,0)',
        'plot_bgcolor': 'rgba(0,0,0,0)',
        'font': {'family': 'sans-serif', 'size': 12},
    }


def _pct(x: float, d: int = 1) -> str:
    return f'{x * 100:.{d}f}%'


def _num(x: float, d: int = 2) -> str:
    return f'{x:,.{d}f}'


@dataclass
class RecipeResult:
    facts: dict[str, str]
    figure: dict[str, Any]
    caption: str


# ---------------- 概率 ----------------

def _binomial(p: dict[str, Any]) -> RecipeResult:
    n, k = int(p['n']), int(p['k'])
    prob = float(p['p'])
    if not (1 <= n <= 200 and 0 <= k <= n and 0 < prob < 1):
        raise ValueError('binomial 参数超界: 需 1<=n<=200, 0<=k<=n, 0<p<1')
    ks = np.arange(n + 1)
    pmf = stats.binom.pmf(ks, n, prob)
    mean, sd = n * prob, np.sqrt(n * prob * (1 - prob))
    colors = [MAIN if i == k else '#b9c4cc' for i in ks]
    fig = {
        'data': [{'type': 'bar', 'x': ks.tolist(), 'y': [round(float(v), 5) for v in pmf],
                  'name': f'B({n}, {prob})', 'marker': {'color': colors},
                  'hovertemplate': '命中 %{x} 次：概率 %{y:.4f}<extra></extra>'}],
        'layout': _layout(f'二项分布 B({n}, {prob:.3f})：命中 {k} 次有多罕见？', '命中次数 k', '概率'),
    }
    return RecipeResult(
        facts={
            'n': str(n), 'k': str(k), 'p': _num(prob, 3), 'p_pct': _pct(prob),
            'p_exact': _pct(float(pmf[k])), 'p_at_least_k': _pct(float(stats.binom.sf(k - 1, n, prob))),
            'p_at_most_k': _pct(float(stats.binom.cdf(k, n, prob))),
            'mean': _num(float(mean), 2), 'sd': _num(float(sd), 2),
        },
        figure=fig,
        caption=f'教学示意：若单次成功率为 {prob:.3f}，{n} 次独立试验的命中数分布；红色为命中 {k} 次。',
    )


def _poisson(p: dict[str, Any]) -> RecipeResult:
    lam, k = float(p['lam']), int(p['k'])
    if not (0 < lam <= 100 and 0 <= k <= 200):
        raise ValueError('poisson 参数超界: 需 0<lam<=100, 0<=k<=200')
    ks = np.arange(0, min(int(lam * 3) + 10, 200))
    pmf = stats.poisson.pmf(ks, lam)
    colors = [MAIN if i == k else '#b9c4cc' for i in ks]
    fig = {
        'data': [{'type': 'bar', 'x': ks.tolist(), 'y': [round(float(v), 5) for v in pmf],
                  'name': f'Poisson({lam})', 'marker': {'color': colors}}],
        'layout': _layout(f'泊松分布 P({lam})：单位时间发生 {k} 次的概率', '发生次数 k', '概率'),
    }
    return RecipeResult(
        facts={
            'lam': _num(lam, 2), 'k': str(k),
            'p_exact': _pct(float(stats.poisson.pmf(k, lam))),
            'p_at_least_k': _pct(float(stats.poisson.sf(k - 1, lam))),
            'p_zero': _pct(float(stats.poisson.pmf(0, lam))),
        },
        figure=fig,
        caption=f'教学示意：平均发生率 λ={lam:.2f} 时，单位时间内事件发生次数的泊松分布；红色为 {k} 次。',
    )


# ---------------- 统计 ----------------

def _normal_tail(p: dict[str, Any]) -> RecipeResult:
    mu, sigma, thr = float(p['mu']), float(p['sigma']), float(p['threshold'])
    if not (sigma > 0 and -1e6 < mu < 1e6):
        raise ValueError('normal_tail 参数超界: 需 sigma>0')
    xs = np.linspace(mu - 4 * sigma, mu + 4 * sigma, 200)
    ys = stats.norm.pdf(xs, mu, sigma)
    z = (thr - mu) / sigma
    fig = {
        'data': [{'type': 'scatter', 'mode': 'lines',
                  'x': [round(float(v), 3) for v in xs], 'y': [round(float(v), 5) for v in ys],
                  'name': '正态分布密度', 'line': {'color': MAIN, 'width': 2.5}}],
        'layout': _layout(f'正态分布 N({mu:g}, {sigma:g}²)：超过 {thr:g} 有多罕见？', '取值 x', '概率密度'),
    }
    return RecipeResult(
        facts={
            'mu': _num(mu, 2), 'sigma': _num(sigma, 2), 'threshold': _num(thr, 2),
            'z': _num(float(z), 2),
            'p_above': _pct(float(stats.norm.sf(z))),
            'p_below': _pct(float(stats.norm.cdf(z))),
            'p_within_1sd': _pct(float(stats.norm.cdf(1) - stats.norm.cdf(-1))),
            'p_within_2sd': _pct(float(stats.norm.cdf(2) - stats.norm.cdf(-2))),
        },
        figure=fig,
        caption=f'教学示意：均值 {mu:g}、标准差 {sigma:g} 的正态分布密度曲线；阈值 {thr:g} 对应 z≈{z:.2f}。',
    )


def _power_law(p: dict[str, Any]) -> RecipeResult:
    x = np.asarray(p['x'], dtype=float)
    y = np.asarray(p['y'], dtype=float)
    if x.size < 4 or x.size != y.size or np.any(x <= 0) or np.any(y <= 0):
        raise ValueError('power_law 需等长且均为正的 x/y 数组，长度>=4')
    logx, logy = np.log(x), np.log(y)
    b, log_a = np.polyfit(logx, logy, 1)
    a = float(np.exp(log_a))
    yhat = np.exp(log_a + b * logx)
    ss_res = float(np.sum((logy - (log_a + b * logx)) ** 2))
    ss_tot = float(np.sum((logy - logy.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    xs = np.linspace(x.min(), x.max(), 100)
    fig = {
        'data': [
            {'type': 'scatter', 'mode': 'markers', 'x': x.tolist(), 'y': y.tolist(),
             'name': '观测点（示意）', 'marker': {'color': MAIN, 'size': 9}},
            {'type': 'scatter', 'mode': 'lines', 'x': [round(float(v), 3) for v in xs],
             'y': [round(float(a * v ** b), 3) for v in xs],
             'name': f'幂律拟合 y={a:.3g}·x^{b:.3f}', 'line': {'color': AUX, 'width': 2.5, 'dash': 'dash'}},
        ],
        'layout': _layout(f'双对数下的线性拟合：指数 b≈{b:.3f}', '自变量 x', '因变量 y'),
    }
    return RecipeResult(
        facts={
            'a': _num(a, 3), 'b': _num(float(b), 3), 'r2': _num(float(r2), 3),
            'double_ratio': _num(2 ** float(b), 2),
            'ten_ratio': _num(10 ** float(b), 2),
        },
        figure=fig,
        caption=f'教学示意数据：双对数回归得幂律 y≈{a:.3g}·x^{b:.3f}，R²≈{r2:.3f}。',
    )


def _correlation(p: dict[str, Any]) -> RecipeResult:
    x = np.asarray(p['x'], dtype=float)
    y = np.asarray(p['y'], dtype=float)
    if x.size < 4 or x.size != y.size:
        raise ValueError('correlation 需等长数组，长度>=4')
    r = float(np.corrcoef(x, y)[0, 1])
    slope, intercept = np.polyfit(x, y, 1)
    xs = np.linspace(x.min(), x.max(), 100)
    fig = {
        'data': [
            {'type': 'scatter', 'mode': 'markers', 'x': x.tolist(), 'y': y.tolist(),
             'name': '样本点（示意）', 'marker': {'color': MAIN, 'size': 9}},
            {'type': 'scatter', 'mode': 'lines',
             'x': [round(float(v), 3) for v in xs],
             'y': [round(float(slope * v + intercept), 3) for v in xs],
             'name': f'最小二乘拟合', 'line': {'color': AUX, 'width': 2.5, 'dash': 'dash'}},
        ],
        'layout': _layout(f'散点与最小二乘直线：相关系数 r≈{r:.3f}', '自变量 x', '因变量 y'),
    }
    return RecipeResult(
        facts={
            'r': _num(r, 3), 'r_pct': _pct(abs(r)),
            'slope': _num(float(slope), 3), 'intercept': _num(float(intercept), 3),
            'r2': _num(r * r, 3), 'n': str(x.size),
        },
        figure=fig,
        caption=f'教学示意数据：{x.size} 个样本点的相关系数 r≈{r:.3f}，虚线为最小二乘拟合。',
    )


# ---------------- 微积分 ----------------

def _exponential_growth(p: dict[str, Any]) -> RecipeResult:
    rate = float(p['rate'])
    t_end = float(p.get('t_end', 10))
    if not (rate > 0 and 0 < t_end <= 1000):
        raise ValueError('exponential_growth 需 rate>0 且 0<t_end<=1000')
    ts = np.linspace(0, t_end, 120)
    ys = np.exp(rate * ts)
    doubling = float(np.log(2) / rate)
    multiple = float(np.exp(rate * t_end))
    fig = {
        'data': [{'type': 'scatter', 'mode': 'lines',
                  'x': [round(float(v), 3) for v in ts], 'y': [round(float(v), 3) for v in ys],
                  'name': f'指数增长 e^({rate}·t)', 'line': {'color': MAIN, 'width': 2.5}}],
        'layout': _layout(f'指数增长：翻倍时间≈{doubling:.2f}', '时间 t', '相对规模'),
    }
    return RecipeResult(
        facts={
            'rate': _num(rate, 4), 'rate_pct': _pct(rate),
            'doubling': _num(doubling, 2), 't_end': _num(t_end, 1),
            'multiple': _num(multiple, 1), 'ln2': '0.693',
        },
        figure=fig,
        caption=f'教学示意：按指数 e^({rate}·t) 增长，每 {doubling:.2f} 个单位时间翻一倍。',
    )


def _half_life(p: dict[str, Any]) -> RecipeResult:
    half = float(p['half_life'])
    t_end = float(p.get('t_end', 5))
    if not (half > 0 and 0 < t_end <= 1e6):
        raise ValueError('half_life 需 half_life>0 且 0<t_end<=1000000')
    ts = np.linspace(0, t_end, 120)
    remain = 0.5 ** (ts / half)
    t_1pct = half * float(np.log2(100))
    fig = {
        'data': [{'type': 'scatter', 'mode': 'lines',
                  'x': [round(float(v), 3) for v in ts], 'y': [round(float(v), 5) for v in remain],
                  'name': f'半衰期 {half:g}', 'line': {'color': MAIN, 'width': 2.5}}],
        'layout': _layout(f'指数衰减：半衰期={half:g}', '时间 t', '剩余比例'),
    }
    return RecipeResult(
        facts={
            'half_life': _num(half, 2), 't_end': _num(t_end, 1),
            'remain_end': _pct(float(0.5 ** (t_end / half))),
            'remain_2half': '25.0%', 't_1pct': _num(t_1pct, 2),
            'decay_constant': _num(float(np.log(2) / half), 4),
        },
        figure=fig,
        caption=f'教学示意：半衰期 {half:g} 的指数衰减曲线，每过 {half:g} 个时间单位剩余量减半。',
    )


# ---------------- 线性代数 ----------------

def _laplacian(p: dict[str, Any]) -> RecipeResult:
    n = int(p['n'])
    edges = p.get('edges', [])
    if not (3 <= n <= 30):
        raise ValueError('laplacian 需 3<=n<=30')
    L = np.zeros((n, n))
    for pair in edges:
        i, j = int(pair[0]), int(pair[1])
        if not (0 <= i < n and 0 <= j < n and i != j):
            raise ValueError('laplacian 边端点超界')
        L[i, i] += 1
        L[j, j] += 1
        L[i, j] -= 1
        L[j, i] -= 1
    eig = np.sort(np.linalg.eigvalsh(L))
    lam2 = float(eig[1])
    tau = 1 / lam2 if lam2 > 1e-9 else float('inf')
    fig = {
        'data': [{'type': 'bar', 'x': list(range(1, n + 1)),
                  'y': [round(float(v), 4) for v in eig],
                  'name': '拉普拉斯特征值',
                  'marker': {'color': [MAIN if i == 1 else '#b9c4cc' for i in range(n)]}}],
        'layout': _layout(f'网络拉普拉斯谱：代数连通度 λ₂≈{lam2:.3f}', '序号（从小到大）', '特征值'),
    }
    return RecipeResult(
        facts={
            'n': str(n), 'edges': str(len(edges)),
            'lambda2': _num(lam2, 3), 'tau': _num(tau, 2),
            'lambda_max': _num(float(eig[-1]), 3),
        },
        figure=fig,
        caption=f'教学示意：{n} 节点网络的拉普拉斯特征值，红色为第二小特征值 λ₂（代数连通度）。',
    )


def _markov(p: dict[str, Any]) -> RecipeResult:
    mat = np.asarray(p['matrix'], dtype=float)
    if mat.ndim != 2 or mat.shape[0] != mat.shape[1] or mat.shape[0] < 2 or mat.shape[0] > 12:
        raise ValueError('markov 需 2~12 阶方阵')
    if np.any(mat < 0) or not np.allclose(mat.sum(axis=1), 1.0, atol=1e-6):
        raise ValueError('markov 矩阵每行须非负且和为 1')
    vals, vecs = np.linalg.eig(mat.T)
    idx = int(np.argmin(np.abs(vals - 1.0)))
    steady = np.real(vecs[:, idx])
    steady = np.abs(steady) / np.abs(steady).sum()
    v = np.asarray(p.get('initial', np.ones(mat.shape[0]) / mat.shape[0]), dtype=float)
    v = v / v.sum()
    traj = [v.copy()]
    for _ in range(30):
        v = v @ mat
        traj.append(v.copy())
    steps = list(range(len(traj)))
    fig = {
        'data': [{'type': 'scatter', 'mode': 'lines+markers',
                  'x': steps, 'y': [round(float(t[0]), 4) for t in traj],
                  'name': '状态1占比', 'line': {'color': MAIN, 'width': 2.5}, 'marker': {'size': 4}}],
        'layout': _layout('马尔可夫链：状态占比收敛到稳态分布', '迭代步数', '状态 1 的概率'),
    }
    return RecipeResult(
        facts={
            'steady_1': _pct(float(steady[0])),
            'steady_top': _pct(float(steady.max())),
            'steady_min': _pct(float(steady.min())),
            'n_states': str(mat.shape[0]),
        },
        figure=fig,
        caption='教学示意：马尔可夫链反复迭代后，状态占比收敛到转移矩阵特征值 1 对应的稳态分布。',
    )


RECIPES: dict[str, dict[str, Any]] = {
    'binomial': {
        'branch': 'probability', 'label': '二项分布与期望（ n 次独立试验命中 k 次）',
        'params': 'n(整数1~200), p(0~1 的成功率), k(0~n 的命中数)',
        'facts': 'n, k, p, p_pct, p_exact(恰好k次), p_at_least_k(至少k次), p_at_most_k, mean(期望), sd(标准差)',
        'fn': _binomial,
    },
    'poisson': {
        'branch': 'probability', 'label': '泊松分布（单位时间稀有事件发生次数）',
        'params': 'lam(平均发生率>0), k(事件发生次数)',
        'facts': 'lam, k, p_exact(恰好k次), p_at_least_k(至少k次), p_zero(零次)',
        'fn': _poisson,
    },
    'normal_tail': {
        'branch': 'statistics', 'label': '正态分布与尾部概率（均值/标准差/阈值）',
        'params': 'mu(均值), sigma(标准差>0), threshold(阈值)',
        'facts': 'mu, sigma, threshold, z(z分数), p_above(超过阈值), p_below, p_within_1sd, p_within_2sd',
        'fn': _normal_tail,
    },
    'power_law': {
        'branch': 'statistics', 'label': '幂律拟合（双对数回归 y=a·x^b）',
        'params': 'x(等长的正数数组,>=4个), y(对应的正数数组)',
        'facts': 'a(系数), b(指数), r2(拟合优度), double_ratio(x翻倍时y倍数), ten_ratio',
        'fn': _power_law,
    },
    'correlation': {
        'branch': 'statistics', 'label': '相关系数与最小二乘拟合',
        'params': 'x(数组,>=4个), y(等长数组)',
        'facts': 'r(相关系数), r_pct, slope(斜率), intercept(截距), r2, n(样本数)',
        'fn': _correlation,
    },
    'exponential_growth': {
        'branch': 'calculus', 'label': '指数增长与倍增时间（e^(r·t)）',
        'params': 'rate(增长率>0), t_end(可选,终点时间)',
        'facts': 'rate, rate_pct, doubling(翻倍时间=ln2/rate), t_end, multiple(期末倍数), ln2',
        'fn': _exponential_growth,
    },
    'half_life': {
        'branch': 'calculus', 'label': '指数衰减与半衰期',
        'params': 'half_life(半衰期>0), t_end(可选,终点时间)',
        'facts': 'half_life, t_end, remain_end(期末剩余), remain_2half, t_1pct, decay_constant',
        'fn': _half_life,
    },
    'laplacian': {
        'branch': 'linear-algebra', 'label': '图拉普拉斯与代数连通度 λ₂（同步速度）',
        'params': 'n(节点数3~30), edges(边列表 [[i,j],...], 下标0起)',
        'facts': 'n, edges(边数), lambda2(代数连通度), tau(同步时间常数1/λ₂), lambda_max',
        'fn': _laplacian,
    },
    'markov': {
        'branch': 'linear-algebra', 'label': '马尔可夫链与稳态分布（矩阵特征值1）',
        'params': 'matrix(行随机方阵,每行和为1), initial(可选,初始分布)',
        'facts': 'steady_1(状态1稳态占比), steady_top, steady_min, n_states',
        'fn': _markov,
    },
}


def run_recipe(recipe_id: str, params: dict[str, Any]) -> RecipeResult:
    recipe = RECIPES.get(recipe_id)
    if not recipe:
        raise ValueError(f'未知配方: {recipe_id}')
    result: RecipeResult = recipe['fn'](params)
    # 安全网：图表点数与 trace 类型
    for trace in result.figure.get('data', []):
        if trace.get('type') not in ('scatter', 'bar', 'contour', 'heatmap'):
            raise ValueError(f'非法 trace 类型: {trace.get("type")}')
        if len(trace.get('x', [])) > 200 or len(trace.get('y', [])) > 200:
            raise ValueError('图表数据点超过 200')
    return result
