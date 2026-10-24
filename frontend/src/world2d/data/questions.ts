/**
 * 微积分题库：三大修炼馆 × 知识点 × 分层小题（含解析）。
 * 修炼答题（Training）与大招「Σ 级数风暴」共用本题库。
 */

export type HallId = 'limit' | 'derivative' | 'integral'

export interface HallDef {
  id: HallId
  name: string
  room: string // 房间素材 key
  mentor: string
  mentorName: string
  topics: string[]
}

export interface TopicDef {
  id: string
  hall: HallId
  name: string
  desc: string
}

export interface BankQuestion {
  id: string
  topic: string
  difficulty: 1 | 2 | 3
  q: string
  options: string[]
  answer: number
  explain: string
}

export const HALLS: Record<HallId, HallDef> = {
  limit: {
    id: 'limit',
    name: '极限酒馆',
    room: 'roomLimit',
    mentor: 'host',
    mentorName: '极限导师 · 洛必达',
    topics: ['limit-calc', 'limit-continuity'],
  },
  derivative: {
    id: 'derivative',
    name: '导数讲堂',
    room: 'roomDerivative',
    mentor: 'scholar',
    mentorName: '导数导师 · 牛顿',
    topics: ['deriv-calc', 'deriv-app'],
  },
  integral: {
    id: 'integral',
    name: '积分圣所',
    room: 'roomIntegral',
    mentor: 'sage',
    mentorName: '积分导师 · 莱布尼茨',
    topics: ['integral-indef', 'integral-def', 'series'],
  },
}

export const TOPICS: TopicDef[] = [
  { id: 'limit-calc', hall: 'limit', name: '极限计算', desc: '两个重要极限、等价无穷小、运算法则' },
  { id: 'limit-continuity', hall: 'limit', name: '连续与间断', desc: '连续性判断、间断点分类、闭区间性质' },
  { id: 'deriv-calc', hall: 'derivative', name: '求导法则', desc: '基本公式、四则运算、链式法则' },
  { id: 'deriv-app', hall: 'derivative', name: '导数应用', desc: '切线、单调性、极值、洛必达法则' },
  { id: 'integral-indef', hall: 'integral', name: '不定积分', desc: '基本积分表、凑微分' },
  { id: 'integral-def', hall: 'integral', name: '定积分', desc: '牛顿-莱布尼茨公式、对称性、几何意义' },
  { id: 'series', hall: 'integral', name: '级数初步', desc: '几何级数、p-级数、收敛必要条件' },
]

export const QUESTION_BANK: BankQuestion[] = [
  // ================================================================ 极限计算
  {
    id: 'lc-1', topic: 'limit-calc', difficulty: 1,
    q: 'lim(x→0) sin x / x = ?',
    options: ['0', '1', '∞', '不存在'],
    answer: 1,
    explain: '第一个重要极限：x→0 时 sin x 与 x 是等价无穷小，比值为 1。',
  },
  {
    id: 'lc-2', topic: 'limit-calc', difficulty: 1,
    q: 'lim(x→0) tan x / x = ?',
    options: ['0', '∞', '1', 'π'],
    answer: 2,
    explain: 'tan x = sin x / cos x，极限 = lim sinx/x · lim 1/cosx = 1 × 1 = 1。',
  },
  {
    id: 'lc-3', topic: 'limit-calc', difficulty: 1,
    q: 'lim(x→3) (x² − 9) / (x − 3) = ?',
    options: ['0', '3', '6', '不存在'],
    answer: 2,
    explain: '因式分解：(x²−9)/(x−3) = x + 3（x≠3），代入 x→3 得 6。',
  },
  {
    id: 'lc-4', topic: 'limit-calc', difficulty: 2,
    q: 'lim(x→0) (1 − cos x) / x² = ?',
    options: ['0', '1', '1/2', '2'],
    answer: 2,
    explain: '1 − cos x = 2sin²(x/2) ~ x²/2，故极限为 1/2。',
  },
  {
    id: 'lc-5', topic: 'limit-calc', difficulty: 2,
    q: 'lim(x→0) (eˣ − 1) / x = ?',
    options: ['0', '1', 'e', '∞'],
    answer: 1,
    explain: 'eˣ − 1 与 x 是等价无穷小；这也是 eˣ 在 x = 0 处的导数定义。',
  },
  {
    id: 'lc-6', topic: 'limit-calc', difficulty: 2,
    q: 'lim(x→∞) (3x² + 1) / (x² + 5x) = ?',
    options: ['0', '1', '3', '∞'],
    answer: 2,
    explain: '同除以 x²：分子→3，分母→1，极限 = 3/1 = 3（最高次项系数之比）。',
  },
  {
    id: 'lc-7', topic: 'limit-calc', difficulty: 2,
    q: 'lim(x→∞) (1 + 2/x)ˣ = ?',
    options: ['e', 'e²', '1', '∞'],
    answer: 1,
    explain: '第二个重要极限的推广：(1 + a/x)ˣ → eᵃ，这里 a = 2。',
  },
  {
    id: 'lc-8', topic: 'limit-calc', difficulty: 3,
    q: 'lim(n→∞) (1 + 1/n)ⁿ = ?',
    options: ['1', '∞', 'e', 'π'],
    answer: 2,
    explain: '第二个重要极限，自然常数 e ≈ 2.71828 的定义式之一。',
  },

  // ================================================================ 连续与间断
  {
    id: 'ln-1', topic: 'limit-continuity', difficulty: 1,
    q: 'f(x) = sin x / x 在 x = 0 处（f(0) 未定义）是？',
    options: ['连续点', '可去间断点', '跳跃间断点', '无穷间断点'],
    answer: 1,
    explain: '极限 lim sinx/x = 1 存在，但 f(0) 无定义；补上 f(0)=1 即连续，属可去间断点。',
  },
  {
    id: 'ln-2', topic: 'limit-continuity', difficulty: 1,
    q: 'f(x) = |x| 在 x = 0 处？',
    options: ['可导', '连续但不可导', '不连续', '是跳跃间断点'],
    answer: 1,
    explain: '左右极限都是 0 = f(0)，连续；但左导数 −1 ≠ 右导数 1，不可导（尖点）。',
  },
  {
    id: 'ln-3', topic: 'limit-continuity', difficulty: 1,
    q: '「f 在 a 点连续」的严格定义是？',
    options: ['f(a) 有定义', 'lim(x→a) f(x) 存在', 'lim(x→a) f(x) = f(a)', 'f′(a) 存在'],
    answer: 2,
    explain: '连续三要素：f(a) 有定义、极限存在、二者相等。可导是比连续更强的条件。',
  },
  {
    id: 'ln-4', topic: 'limit-continuity', difficulty: 2,
    q: 'f(x) = 1/x 在 x = 0 处是？',
    options: ['可去间断点', '跳跃间断点', '无穷间断点', '连续点'],
    answer: 2,
    explain: 'x→0 时 |f(x)|→∞，极限不存在且为无穷大，属第二类（无穷）间断点。',
  },
  {
    id: 'ln-5', topic: 'limit-continuity', difficulty: 2,
    q: 'f(x) = { x (x<1)；x+1 (x≥1) } 在 x = 1 处是？',
    options: ['连续点', '可去间断点', '跳跃间断点', '无穷间断点'],
    answer: 2,
    explain: '左极限 = 1，右极限 = f(1) = 2，左右极限都存在但不相等 → 跳跃间断点。',
  },
  {
    id: 'ln-6', topic: 'limit-continuity', difficulty: 2,
    q: 'f(x) = (x² − 1)/(x − 1) 在 x = 1 处是？',
    options: ['连续点', '可去间断点', '跳跃间断点', '无穷间断点'],
    answer: 1,
    explain: '化简得 x + 1（x≠1），极限 = 2 存在但 f(1) 无定义，补上 f(1)=2 即连续。',
  },
  {
    id: 'ln-7', topic: 'limit-continuity', difficulty: 3,
    q: '闭区间 [a, b] 上的连续函数一定？',
    options: ['有最大值和最小值', '有零点', '处处可导', '单调'],
    answer: 0,
    explain: '最值定理：闭区间上的连续函数必有界，且能取到最大值与最小值。',
  },
  {
    id: 'ln-8', topic: 'limit-continuity', difficulty: 3,
    q: 'f 在 [a, b] 连续且 f(a)·f(b) < 0，则区间内至少有一点 c 使？',
    options: ['f(c) = 0', 'f′(c) = 0', 'f(c) 最大', 'f(c) 不存在'],
    answer: 0,
    explain: '零点存在定理：连续函数在异号两端之间必然穿过 x 轴至少一次。',
  },

  // ================================================================ 求导法则
  {
    id: 'dc-1', topic: 'deriv-calc', difficulty: 1,
    q: '(x⁵)′ = ?',
    options: ['5x⁴', 'x⁴', '4x⁵', '5x⁵'],
    answer: 0,
    explain: '幂函数求导：(xⁿ)′ = n·xⁿ⁻¹，n = 5 时得 5x⁴。',
  },
  {
    id: 'dc-2', topic: 'deriv-calc', difficulty: 1,
    q: '(sin x)′ = ?',
    options: ['−cos x', 'cos x', '−sin x', 'tan x'],
    answer: 1,
    explain: '基本公式：(sin x)′ = cos x；注意 (cos x)′ = −sin x 带负号。',
  },
  {
    id: 'dc-3', topic: 'deriv-calc', difficulty: 1,
    q: '(eˣ)′ = ?',
    options: ['xeˣ', 'eˣ', 'eˣ⁻¹', 'ln x'],
    answer: 1,
    explain: 'eˣ 是唯一「求导不变」的函数，这正是 e 的特殊之处。',
  },
  {
    id: 'dc-4', topic: 'deriv-calc', difficulty: 1,
    q: '(ln x)′ = ?',
    options: ['1/x', 'ln x', 'x', 'eˣ'],
    answer: 0,
    explain: '基本公式：(ln x)′ = 1/x（x > 0）；与 ∫1/x dx = ln|x| 互为逆运算。',
  },
  {
    id: 'dc-5', topic: 'deriv-calc', difficulty: 2,
    q: '(sin 2x)′ = ?',
    options: ['cos 2x', '2cos 2x', '2sin 2x', '−2cos 2x'],
    answer: 1,
    explain: '链式法则：外层 sin 求导得 cos 2x，内层 2x 求导得 2，相乘 = 2cos 2x。',
  },
  {
    id: 'dc-6', topic: 'deriv-calc', difficulty: 2,
    q: '(x·eˣ)′ = ?',
    options: ['eˣ', '(x + 1)eˣ', 'xeˣ', 'eˣ + x'],
    answer: 1,
    explain: '乘积法则 (uv)′ = u′v + uv′：1·eˣ + x·eˣ = (x + 1)eˣ。',
  },
  {
    id: 'dc-7', topic: 'deriv-calc', difficulty: 2,
    q: '(ln 2x)′ = ?',
    options: ['1/x', '2/x', '1/(2x)', 'ln 2'],
    answer: 0,
    explain: '链式法则：1/(2x) · 2 = 1/x。也可由 ln 2x = ln 2 + ln x 直接看出。',
  },
  {
    id: 'dc-8', topic: 'deriv-calc', difficulty: 3,
    q: '(2ˣ)′ = ?',
    options: ['x·2ˣ⁻¹', '2ˣ', '2ˣ·ln 2', '2ˣ⁻¹'],
    answer: 2,
    explain: '指数函数求导：(aˣ)′ = aˣ·ln a。别与幂函数 (xⁿ)′ = nxⁿ⁻¹ 混淆。',
  },
  {
    id: 'dc-9', topic: 'deriv-calc', difficulty: 3,
    q: '(tan x)′ = ?',
    options: ['sec²x', 'cot x', '−csc²x', 'cos²x'],
    answer: 0,
    explain: '由 sin x / cos x 用商法则可得 (tan x)′ = 1/cos²x = sec²x。',
  },

  // ================================================================ 导数应用
  {
    id: 'da-1', topic: 'deriv-app', difficulty: 1,
    q: 'f(x) = x² 在 x = 3 处的切线斜率是？',
    options: ['3', '6', '9', '2'],
    answer: 1,
    explain: 'f′(x) = 2x，x = 3 时斜率 = 6。导数的几何意义即切线斜率。',
  },
  {
    id: 'da-2', topic: 'deriv-app', difficulty: 1,
    q: '函数在某极值点 x₀ 处可导，则必有？',
    options: ['f′(x₀) = 0', 'f′(x₀) > 0', 'f′(x₀) < 0', 'f″(x₀) = 0'],
    answer: 0,
    explain: '费马定理：可导函数在极值点处导数必为 0（驻点）；反之不一定成立。',
  },
  {
    id: 'da-3', topic: 'deriv-app', difficulty: 1,
    q: '在区间内 f′(x) > 0，则 f 在该区间？',
    options: ['单调递减', '单调递增', '取极大值', '恒为常数'],
    answer: 1,
    explain: '导数的符号决定单调性：f′ > 0 递增，f′ < 0 递减。',
  },
  {
    id: 'da-4', topic: 'deriv-app', difficulty: 2,
    q: '曲线 y = x² 在点 (1, 1) 处的切线方程是？',
    options: ['y = 2x − 1', 'y = x', 'y = 2x + 1', 'y = x − 1'],
    answer: 0,
    explain: '斜率 f′(1) = 2，点斜式 y − 1 = 2(x − 1)，即 y = 2x − 1。',
  },
  {
    id: 'da-5', topic: 'deriv-app', difficulty: 2,
    q: 'f(x) = x³ − 3x 的驻点是？',
    options: ['x = 0', 'x = ±1', 'x = ±3', 'x = 3'],
    answer: 1,
    explain: 'f′(x) = 3x² − 3 = 3(x² − 1) = 0，解得 x = ±1。',
  },
  {
    id: 'da-6', topic: 'deriv-app', difficulty: 2,
    q: 'f′(a) = 0 且 f″(a) > 0，则 a 点是？',
    options: ['极大值点', '极小值点', '拐点', '间断点'],
    answer: 1,
    explain: '第二充分条件：驻点处二阶导数为正 → 函数局部下凹，取极小值。',
  },
  {
    id: 'da-7', topic: 'deriv-app', difficulty: 3,
    q: '洛必达法则适用于哪种极限？',
    options: ['任何极限', '0/0 或 ∞/∞ 型未定式', '仅多项式', '仅三角函数'],
    answer: 1,
    explain: '只有 0/0、∞/∞ 型才能直接洛必达；其他型（0·∞、1^∞ 等）需先变形。',
  },
  {
    id: 'da-8', topic: 'deriv-app', difficulty: 3,
    q: 'lim(x→0) x / sin x 用洛必达法则得？',
    options: ['0', '1', '∞', '不存在'],
    answer: 1,
    explain: '0/0 型，分子分母分别求导：lim 1/cos x = 1。与重要极限互为倒数。',
  },

  // ================================================================ 不定积分
  {
    id: 'ii-1', topic: 'integral-indef', difficulty: 1,
    q: '∫ x² dx = ?',
    options: ['x³/3 + C', '2x + C', 'x³ + C', '3x² + C'],
    answer: 0,
    explain: '幂函数积分：∫xⁿdx = xⁿ⁺¹/(n+1) + C（n ≠ −1）。别忘任意常数 C。',
  },
  {
    id: 'ii-2', topic: 'integral-indef', difficulty: 1,
    q: '∫ (1/x) dx = ?',
    options: ['ln|x| + C', '1/x² + C', 'x⁰ + C', 'eˣ + C'],
    answer: 0,
    explain: 'n = −1 的特例：∫1/x dx = ln|x| + C（绝对值保证负数也有定义）。',
  },
  {
    id: 'ii-3', topic: 'integral-indef', difficulty: 1,
    q: '∫ cos x dx = ?',
    options: ['−sin x + C', 'sin x + C', 'cos x + C', '−cos x + C'],
    answer: 1,
    explain: '因为 (sin x)′ = cos x，所以 ∫cos x dx = sin x + C。',
  },
  {
    id: 'ii-4', topic: 'integral-indef', difficulty: 1,
    q: '∫ eˣ dx = ?',
    options: ['eˣ + C', 'xeˣ + C', 'eˣ⁺¹ + C', 'ln x + C'],
    answer: 0,
    explain: 'eˣ 求导不变，积分也不变：∫eˣ dx = eˣ + C。',
  },
  {
    id: 'ii-5', topic: 'integral-indef', difficulty: 2,
    q: '∫ 1/(1 + x²) dx = ?',
    options: ['arcsin x + C', 'arctan x + C', 'ln(1 + x²) + C', '1/x + C'],
    answer: 1,
    explain: '基本积分表：因为 (arctan x)′ = 1/(1 + x²)，故积分为 arctan x + C。',
  },
  {
    id: 'ii-6', topic: 'integral-indef', difficulty: 2,
    q: '∫ (2x + 1) dx = ?',
    options: ['x² + x + C', '2 + C', 'x² + C', '2x² + x + C'],
    answer: 0,
    explain: '逐项积分：∫2x dx = x²，∫1 dx = x，合并得 x² + x + C。',
  },
  {
    id: 'ii-7', topic: 'integral-indef', difficulty: 3,
    q: '∫ 2x·cos(x²) dx = ?（凑微分）',
    options: ['cos(x²) + C', 'sin(x²) + C', '2sin(x²) + C', '−sin(x²) + C'],
    answer: 1,
    explain: '注意到 2x 正是 x² 的导数：令 u = x²，原式 = ∫cos u du = sin(x²) + C。',
  },
  {
    id: 'ii-8', topic: 'integral-indef', difficulty: 3,
    q: '∫ 1/√(1 − x²) dx = ?',
    options: ['arccos x + C', 'arctan x + C', 'arcsin x + C', '√(1 − x²) + C'],
    answer: 2,
    explain: '因为 (arcsin x)′ = 1/√(1 − x²)，故积分为 arcsin x + C。',
  },

  // ================================================================ 定积分
  {
    id: 'id-1', topic: 'integral-def', difficulty: 1,
    q: '∫₀¹ x dx = ?',
    options: ['1', '1/2', '2', '1/3'],
    answer: 1,
    explain: '原函数 x²/2，代入得 1/2 − 0 = 1/2（也是三角形的面积）。',
  },
  {
    id: 'id-2', topic: 'integral-def', difficulty: 1,
    q: '∫₀¹ x² dx = ?',
    options: ['1/2', '1/3', '1', '2/3'],
    answer: 1,
    explain: '原函数 x³/3，代入得 1/3 − 0 = 1/3。',
  },
  {
    id: 'id-3', topic: 'integral-def', difficulty: 1,
    q: '牛顿-莱布尼茨公式：∫ₐᵇ f(x)dx = ?',
    options: ['F(b) − F(a)', 'f(b) − f(a)', 'F(a) − F(b)', 'f′(b) − f′(a)'],
    answer: 0,
    explain: 'F 是 f 的任一原函数，定积分 = 原函数在上下限处的差 F(b) − F(a)。',
  },
  {
    id: 'id-4', topic: 'integral-def', difficulty: 2,
    q: '∫₀^π sin x dx = ?',
    options: ['0', '1', '2', 'π'],
    answer: 2,
    explain: '原函数 −cos x：−cos π − (−cos 0) = 1 + 1 = 2（半拱正弦的面积）。',
  },
  {
    id: 'id-5', topic: 'integral-def', difficulty: 2,
    q: '∫₋₁¹ x³ dx = ?',
    options: ['2', '1', '0', '1/4'],
    answer: 2,
    explain: 'x³ 是奇函数，在对称区间 [−1, 1] 上正负面积相消，积分为 0。',
  },
  {
    id: 'id-6', topic: 'integral-def', difficulty: 2,
    q: '∫₀¹ eˣ dx = ?',
    options: ['e', 'e − 1', '1', 'e + 1'],
    answer: 1,
    explain: '原函数 eˣ：e¹ − e⁰ = e − 1。',
  },
  {
    id: 'id-7', topic: 'integral-def', difficulty: 3,
    q: '∫₁^e (1/x) dx = ?',
    options: ['e', '1', 'e − 1', '1/e'],
    answer: 1,
    explain: '原函数 ln x：ln e − ln 1 = 1 − 0 = 1。',
  },
  {
    id: 'id-8', topic: 'integral-def', difficulty: 3,
    q: '当 f(x) ≥ 0 时，∫ₐᵇ f(x)dx 的几何意义是？',
    options: ['曲线的弧长', '曲边梯形的面积', '旋转体体积', '切线斜率'],
    answer: 1,
    explain: '定积分是「无穷小矩形面积之和」的极限，即曲线下的曲边梯形面积。',
  },

  // ================================================================ 级数初步
  {
    id: 'se-1', topic: 'series', difficulty: 1,
    q: '几何级数 Σ (1/2)ⁿ（n 从 0 到 ∞）= ?',
    options: ['1', '3/2', '2', '发散'],
    answer: 2,
    explain: '首项 a = 1，公比 r = 1/2，和 = a/(1 − r) = 1/(1/2) = 2。',
  },
  {
    id: 'se-2', topic: 'series', difficulty: 1,
    q: '几何级数 Σ rⁿ 收敛的条件是？',
    options: ['r < 1', '|r| < 1', 'r > 0', '|r| ≤ 1'],
    answer: 1,
    explain: '|r| < 1 时收敛于 1/(1 − r)；|r| ≥ 1 时通项不趋于 0，必发散。',
  },
  {
    id: 'se-3', topic: 'series', difficulty: 1,
    q: '调和级数 Σ 1/n（n=1..∞）？',
    options: ['收敛于 1', '收敛于 e', '发散', '收敛于 0'],
    answer: 2,
    explain: '虽然 1/n → 0，但部分和增长如 ln n，缓慢地趋向无穷 —— 发散。',
  },
  {
    id: 'se-4', topic: 'series', difficulty: 2,
    q: 'p-级数 Σ 1/nᵖ 收敛当且仅当？',
    options: ['p > 0', 'p ≥ 1', 'p > 1', 'p < 1'],
    answer: 2,
    explain: '与积分 ∫1/xᵖ 比较：p > 1 收敛（如 1/n²），p ≤ 1 发散（如调和级数）。',
  },
  {
    id: 'se-5', topic: 'series', difficulty: 2,
    q: '级数 Σ aₙ 收敛的必要条件是？',
    options: ['aₙ → 0', '部分和有界', 'aₙ > 0', 'aₙ 单调递减'],
    answer: 0,
    explain: '收敛 ⟹ 通项趋于 0；但通项趋于 0 不保证收敛（调和级数就是反例）。',
  },
  {
    id: 'se-6', topic: 'series', difficulty: 2,
    q: '「aₙ → 0」是级数 Σ aₙ 收敛的？',
    options: ['充要条件', '充分非必要条件', '必要非充分条件', '无关条件'],
    answer: 2,
    explain: '收敛必须有 aₙ → 0（必要），但 aₙ → 0 不足以推出收敛（不充分）。',
  },
  {
    id: 'se-7', topic: 'series', difficulty: 3,
    q: 'Σ 1/n² = ?（巴塞尔问题）',
    options: ['π/2', 'π²/6', 'e', '2'],
    answer: 1,
    explain: '欧拉证明的著名结果：1 + 1/4 + 1/9 + … = π²/6 ≈ 1.6449。',
  },
  {
    id: 'se-8', topic: 'series', difficulty: 3,
    q: 'eˣ 的泰勒级数（麦克劳林展开）是？',
    options: ['Σ xⁿ/n!', 'Σ xⁿ', 'Σ (−1)ⁿxⁿ', 'Σ n·xⁿ'],
    answer: 0,
    explain: 'eˣ = 1 + x + x²/2! + x³/3! + …，代入 x = 1 可得 e 的级数定义。',
  },
]

/** 按知识点取题；count 道，按难度混排（简单在前，难题压轴） */
export function pickQuestions(topicId: string, count = 5): BankQuestion[] {
  const pool = QUESTION_BANK.filter((q) => q.topic === topicId)
  return pickFrom(pool, count)
}

/** 综合试炼：整馆知识点混合抽题 */
export function pickHallQuestions(hallId: HallId, count = 5): BankQuestion[] {
  const pool = QUESTION_BANK.filter((q) => HALLS[hallId].topics.includes(q.topic))
  return pickFrom(pool, count)
}

function pickFrom(pool: BankQuestion[], count: number): BankQuestion[] {
  const byDiff = (d: number) => pool.filter((q) => q.difficulty === d).sort(() => Math.random() - 0.5)
  const sorted = [...byDiff(1), ...byDiff(2), ...byDiff(3)]
  // 打乱同难度内部顺序，保留由易到难的节奏
  const picked = sorted.slice(0, Math.min(count, sorted.length))
  return picked
}

/** 大招题库接口（与旧 QUIZ_BANK 同构） */
export function randomCalculusQuestion(): { q: string; options: string[]; answer: number } {
  const q = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)]
  return { q: q.q, options: q.options, answer: q.answer }
}

export function topicName(id: string): string {
  return TOPICS.find((t) => t.id === id)?.name ?? id
}
