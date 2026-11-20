export type SubjectId = 'calculus' | 'linear-algebra' | 'probability'
export type ModuleSubject = SubjectId | 'general'
export type ModuleCategory = 'experiment' | 'tool' | 'world'

export interface Subject {
  id: SubjectId
  name: string
  englishName: string
  formula: string
  description: string
  concept: string
  color: string
  gradient: string
  icon: string
}

export interface LearningModule {
  id: string
  path: string
  name: string
  topicName?: string
  subject: ModuleSubject
  category: ModuleCategory
  description: string
  keywords: readonly string[]
  icon: string
}

export const SUBJECTS: readonly Subject[] = [
  {
    id: 'calculus',
    name: '微积分',
    englishName: 'Calculus',
    formula: 'd/dx ∫ₐˣ f(t) dt = f(x)',
    description: '探索极限、导数与积分，在动态图像中理解变化与累积。',
    concept:
      '从一点附近的局部行为出发，逐步走向切线逼近、黎曼和、多元曲面与向量场。每个实验都可以直接调整参数，让公式背后的几何意义变得可见。',
    color: '#9c3b2e',
    gradient: 'linear-gradient(135deg, #9c3b2e 0%, #8a3325 100%)',
    icon: '∫',
  },
  {
    id: 'linear-algebra',
    name: '线性代数',
    englishName: 'Linear Algebra',
    formula: 'Av = λv',
    description: '把矩阵看作空间变换，直观理解特征向量与几何结构。',
    concept:
      '矩阵不只是数字表格，更是对空间的重新组织。观察网格、单位圆与向量在变换中的变化，建立计算与几何直觉之间的联系。',
    color: '#2f5d62',
    gradient: 'linear-gradient(135deg, #2f5d62 0%, #24494d 100%)',
    icon: 'λ',
  },
  {
    id: 'probability',
    name: '概率论与数理统计',
    englishName: 'Probability & Statistics',
    formula: 'E[X] = ∫₋∞⁺∞ x f(x) dx',
    description: '用随机试验观察规律，从样本数据走向分布与统计推断。',
    concept:
      '通过可重复的蒙特卡洛模拟，观察样本均值如何收敛、样本均值分布如何趋近正态，并比较常见概率分布的形状与参数。',
    color: '#8a6d3b',
    gradient: 'linear-gradient(135deg, #8a6d3b 0%, #70572e 100%)',
    icon: 'P',
  },
]

export const LEARNING_MODULES: readonly LearningModule[] = [
  {
    id: 'limit',
    path: '/limit',
    name: 'ε-δ 极限',
    topicName: 'ε-δ 极限可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '动态观察函数趋近过程，用 ε-δ 窗口理解极限的严格定义。',
    keywords: ['极限', 'epsilon', 'delta', 'limit', '函数趋近', '连续'],
    icon: 'lim',
  },
  {
    id: 'derivative',
    path: '/derivative',
    name: '导数与切线',
    topicName: '导数与切线可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '实时绘制切线与法线，观察局部线性逼近和变化率。',
    keywords: ['导数', '微分', '切线', '法线', 'derivative', '变化率'],
    icon: 'd/dx',
  },
  {
    id: 'integration',
    path: '/integration',
    name: '黎曼积分',
    topicName: '黎曼积分可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '动态构建黎曼和，比较数值积分方法与误差收敛过程。',
    keywords: ['积分', '黎曼和', '面积', 'integral', 'riemann', '数值积分'],
    icon: '∫',
  },
  {
    id: 'taylor',
    path: '/taylor',
    name: '泰勒级数',
    topicName: '泰勒级数可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '逐阶增加泰勒多项式，直观比较函数逼近与余项变化。',
    keywords: ['泰勒', '泰勒公式', '级数', 'taylor', 'series', '多项式逼近'],
    icon: 'Σ',
  },
  {
    id: 'multivariate',
    path: '/multivariate',
    name: '多元函数可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '在三维曲面与等高线中探索偏导数、切平面和梯度。',
    keywords: ['多元函数', '偏导数', '梯度', '曲面', '等高线', 'multivariate'],
    icon: '∇',
  },
  {
    id: 'vector-field',
    path: '/vector-field',
    name: '向量场与线积分',
    subject: 'calculus',
    category: 'experiment',
    description: '追踪向量场流线，计算线积分并验证格林公式。',
    keywords: ['向量场', '线积分', '格林公式', '流线', 'vector field', 'line integral'],
    icon: '∮',
  },
  {
    id: 'vector-field-3d',
    path: '/vector-field-3d',
    name: '3D 向量场',
    subject: 'calculus',
    category: 'experiment',
    description: '探索三维向量场、散度与旋度，观察空间中的流线。',
    keywords: ['三维向量场', '散度', '旋度', '流线', '3d vector', '向量微积分'],
    icon: 'F⃗',
  },
  {
    id: 'surface-integral',
    path: '/surface-integral',
    name: '曲面积分',
    topicName: '曲面积分可视化',
    subject: 'calculus',
    category: 'experiment',
    description: '可视化曲面通量与法向量，理解曲面积分的计算。',
    keywords: ['曲面积分', '通量', '法向量', 'surface integral', 'flux'],
    icon: '∬',
  },
  {
    id: 'gauss-theorem',
    path: '/gauss-theorem',
    name: '高斯散度定理',
    subject: 'calculus',
    category: 'experiment',
    description: '对照闭合曲面通量与体积分，验证高斯散度定理。',
    keywords: ['高斯定理', '散度定理', '通量', 'gauss', 'divergence', '体积分'],
    icon: '∭',
  },
  {
    id: 'matrix',
    path: '/matrix',
    name: '矩阵变换',
    topicName: '矩阵变换可视化',
    subject: 'linear-algebra',
    category: 'experiment',
    description: '实时变换网格与单位圆，观察矩阵、特征值和特征向量。',
    keywords: ['矩阵', '线性变换', '特征值', '特征向量', 'matrix', 'eigenvalue', '线性方程组'],
    icon: 'det',
  },
  {
    id: 'probability',
    path: '/probability',
    name: '大数定律模拟',
    subject: 'probability',
    category: 'experiment',
    description: '重复随机试验，观察样本均值如何逐步收敛到期望值。',
    keywords: ['大数定律', '蒙特卡洛', '随机试验', '样本均值', 'probability', 'lln'],
    icon: 'E[X]',
  },
  {
    id: 'clt',
    path: '/clt',
    name: '中心极限定理',
    subject: 'probability',
    category: 'experiment',
    description: '改变总体分布与样本量，观察样本均值的渐近正态性。',
    keywords: ['中心极限定理', '正态分布', '样本均值', 'clt', 'central limit'],
    icon: 'CLT',
  },
  {
    id: 'distributions',
    path: '/distributions',
    name: '常见概率分布',
    subject: 'probability',
    category: 'experiment',
    description: '探索二项、泊松、正态与指数分布的形状、参数和采样。',
    keywords: ['概率分布', '二项分布', '泊松', '正态', '指数分布', 'distribution', 'PDF'],
    icon: 'ƒ(x)',
  },
  {
    id: 'solver',
    path: '/solver',
    name: '数学解题助手',
    subject: 'general',
    category: 'tool',
    description: 'AI 引导分步解题，用提示阶梯与可视化梳理解题思路。',
    keywords: ['解题', '智能辅导', 'AI', 'solver', '提示', '分步解答', 'ai-tutor'],
    icon: 'AI',
  },
  {
    id: 'knowledge-map',
    path: '/knowledge-map',
    name: '知识学习地图',
    subject: 'general',
    category: 'tool',
    description: '探索概念之间的前置关系，找到适合自己的学习路径。',
    keywords: ['知识地图', '知识图谱', '学习路径', '概念', 'knowledge map', '前置关系'],
    icon: '⌘',
  },
  {
    id: 'manim',
    path: '/manim',
    name: 'Manim 动画生成器',
    subject: 'general',
    category: 'tool',
    description: '把数学讲解转化为教学动画，用动态演示表达抽象概念。',
    keywords: ['Manim', '动画', '视频', '教学动画', 'animation', 'AI 生成'],
    icon: '▶',
  },
  {
    id: 'world',
    path: '/world',
    name: '3D 数学世界',
    subject: 'general',
    category: 'world',
    description: '第一人称漫游数学宇宙群岛，让数学成为可以行走的风景。',
    keywords: ['数学世界', '3D', '三维', '漫游', '数学宇宙', 'world'],
    icon: '3D',
  },
  {
    id: 'world-2d',
    path: '/world-2d',
    name: '2D 数学小镇',
    subject: 'general',
    category: 'world',
    description: '在像素风数学小镇中拜访导师，通过探索与试炼巩固知识。',
    keywords: ['数学小镇', '2D', '像素', '游戏', '导师', 'world 2d'],
    icon: '2D',
  },
]

export const MODULE_ALIASES: Readonly<Record<string, string>> = {
  'epsilon-delta': 'limit',
  riemann: 'integration',
  integral: 'integration',
  lln: 'probability',
  'ai-tutor': 'solver',
  'line-integral': 'vector-field',
  eigenvalue: 'matrix',
  'linear-system': 'matrix',
  distribution: 'distributions',
  series: 'taylor',
}

export const MODULE_CATEGORY_LABELS: Readonly<Record<ModuleCategory, string>> = {
  experiment: '交互实验',
  tool: '学习工具',
  world: '数学世界',
}

export function getSubjectById(subjectId: string | undefined): Subject | undefined {
  return SUBJECTS.find((subject) => subject.id === subjectId)
}

export function getModuleById(moduleId: string): LearningModule | undefined {
  return LEARNING_MODULES.find((module) => module.id === moduleId)
}

export function resolveLearningModule(moduleId: string): LearningModule | undefined {
  return getModuleById(MODULE_ALIASES[moduleId] ?? moduleId)
}

export function getModuleByPath(pathname: string): LearningModule | undefined {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return LEARNING_MODULES.find((module) => module.path === normalizedPath)
}

export function getModulesForSubject(subjectId: SubjectId): LearningModule[] {
  return LEARNING_MODULES.filter(
    (module) => module.subject === subjectId && module.category === 'experiment'
  )
}
