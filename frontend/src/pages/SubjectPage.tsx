import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface Module {
  key: string
  name: string
  description: string
  icon: string
}

interface SubjectData {
  id: string
  title: string
  subtitle: string
  formula: string
  description: string
  concept: string
  color: string
  bgGradient: string
  modules: Module[]
}

const SUBJECTS_DATA: Record<string, SubjectData> = {
  calculus: {
    id: 'calculus',
    title: '微积分',
    subtitle: 'Calculus',
    formula: 'd/dx ∫ₐˣ f(t) dt = f(x)',
    description: '微积分是研究变化率与累积量的数学分支，核心概念包括极限、导数和积分。',
    concept:
      '通过可视化工具，你可以观察函数在某一点的局部行为、切线逼近、黎曼和收敛以及多元函数的曲面特征。',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    modules: [
      {
        key: 'epsilon-delta',
        name: 'ε-δ 极限可视化',
        description: '动态展示函数在某点趋近过程，支持 ε-δ 定义可视化',
        icon: 'lim',
      },
      {
        key: 'derivative',
        name: '导数与切线',
        description: '实时绘制切线、法线，动态展示局部线性逼近',
        icon: 'd/dx',
      },
      {
        key: 'riemann',
        name: '黎曼积分',
        description: '黎曼和动态构建，可视化积分定义与数值方法误差收敛',
        icon: '∫',
      },
      {
        key: 'taylor',
        name: '泰勒公式',
        description: '泰勒多项式逼近原函数，可视化余项分析',
        icon: 'Σ',
      },
      {
        key: 'multivariate',
        name: '多元函数可视化',
        description: '3D 曲面图、等高线、偏导数与切平面、梯度场可视化',
        icon: '∇',
      },
      {
        key: 'vector-field',
        name: '向量场与线积分',
        description: '向量场可视化、流线追踪、线积分计算、格林公式验证',
        icon: '∮',
      },
      {
        key: 'vector-field-3d',
        name: '3D 向量场',
        description: '三维向量场可视化、旋度与散度计算、流线追踪',
        icon: '×',
      },
      {
        key: 'surface-integral',
        name: '曲面积分',
        description: '曲面积分计算、通量可视化、法向量分析',
        icon: '∬',
      },
      {
        key: 'gauss-theorem',
        name: '高斯定理',
        description: '高斯散度定理验证、通量与散度的关系',
        icon: '∭',
      },
      {
        key: 'knowledge-map',
        name: '知识学习地图',
        description: '可视化概念前置关系与学习路径',
        icon: '🗺️',
      },
      {
        key: 'ai-tutor',
        name: '智能解题助手',
        description: 'AI 引导分步解题、提示阶梯与可视化理解',
        icon: '🧠',
      },
    ],
  },
  'linear-algebra': {
    id: 'linear-algebra',
    title: '线性代数',
    subtitle: 'Linear Algebra',
    formula: 'Av = λv',
    description: '线性代数研究向量空间和线性变换，是现代数学和工程的基础。',
    concept:
      '矩阵不仅是数字表格，更是空间变换。通过可视化，你可以直观看到缩放、旋转、剪切对平面图形的影响。',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    modules: [
      {
        key: 'matrix',
        name: '矩阵变换可视化',
        description: '2×2 矩阵对单位圆/网格的实时变换，支持特征向量显示',
        icon: 'det',
      },
      {
        key: 'knowledge-map',
        name: '知识学习地图',
        description: '可视化概念前置关系与学习路径',
        icon: '🗺️',
      },
      {
        key: 'ai-tutor',
        name: '智能解题助手',
        description: 'AI 引导分步解题、提示阶梯与可视化理解',
        icon: '🧠',
      },
    ],
  },
  probability: {
    id: 'probability',
    title: '概率论与数理统计',
    subtitle: 'Probability & Statistics',
    formula: 'P(A∪B) = P(A) + P(B) - P(A∩B)',
    description: '概率论研究随机现象的规律，数理统计通过数据推断总体特征。',
    concept: '通过蒙特卡洛模拟，观察样本均值如何收敛到期望值，直观理解大数定律的核心思想。',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    modules: [
      {
        key: 'lln',
        name: '大数定律模拟',
        description: '蒙特卡洛模拟演示样本均值收敛到期望值',
        icon: 'E[X]',
      },
      {
        key: 'clt',
        name: '中心极限定理',
        description: '观察任意分布样本均值的渐近正态性',
        icon: 'CLT',
      },
      {
        key: 'distributions',
        name: '常见概率分布',
        description: '二项、泊松、正态、指数等分布的可视化与采样',
        icon: 'PDF',
      },
      {
        key: 'knowledge-map',
        name: '知识学习地图',
        description: '可视化概念前置关系与学习路径',
        icon: '🗺️',
      },
      {
        key: 'ai-tutor',
        name: '智能解题助手',
        description: 'AI 引导分步解题、提示阶梯与可视化理解',
        icon: '🧠',
      },
    ],
  },
}

const ROUTE_MAP: Record<string, string> = {
  'epsilon-delta': '/limit',
  derivative: '/derivative',
  riemann: '/integration',
  taylor: '/taylor',
  multivariate: '/multivariate',
  'vector-field': '/vector-field',
  'vector-field-3d': '/vector-field-3d',
  'surface-integral': '/surface-integral',
  'gauss-theorem': '/gauss-theorem',
  matrix: '/matrix',
  lln: '/probability',
  clt: '/clt',
  distributions: '/distributions',
  'ai-tutor': '/solver',
  'knowledge-map': '/knowledge-map',
}

function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const [subjectData, setSubjectData] = useState<SubjectData | null>(null)

  useEffect(() => {
    if (subjectId && SUBJECTS_DATA[subjectId]) {
      setSubjectData(SUBJECTS_DATA[subjectId])
    }
  }, [subjectId])

  const handleModuleClick = (moduleKey: string) => {
    navigate(ROUTE_MAP[moduleKey] || '/')
  }

  const handleBack = () => {
    navigate('/')
  }

  const symbolPositions = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        left: `${10 + i * 11}%`,
        top: `${20 + (i % 3) * 25}%`,
        delay: `${i * 0.3}s`,
      })),
    []
  )

  if (!subjectData) {
    return (
      <div className="subject-page">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="subject-page">
      <div className="subject-hero" style={{ background: subjectData.bgGradient }}>
        <button className="back-button" onClick={handleBack}>
          ← 返回首页
        </button>
        <div className="hero-content">
          <h1 className="hero-title">{subjectData.title}</h1>
          <span className="hero-subtitle">{subjectData.subtitle}</span>
          <div className="hero-formula">
            <code>{subjectData.formula}</code>
          </div>
          <p className="hero-description">{subjectData.description}</p>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {symbolPositions.map((pos, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                fontSize: '2rem',
                color: 'rgba(255,255,255,0.12)',
                animation: `float ${18 + i * 2}s infinite ease-in-out`,
                animationDelay: pos.delay,
                fontFamily: "'Times New Roman', serif",
              }}
            >
              {['∫', '∑', 'λ', '∂', '∇', 'π', 'θ', 'σ'][i]}
            </span>
          ))}
        </div>
      </div>

      <div className="modules-section">
        <h2 className="section-title">功能模块</h2>

        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto var(--space-8)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
            lineHeight: 1.7,
          }}
        >
          {subjectData.concept}
        </div>

        <div className="modules-grid">
          {subjectData.modules.map((module, index) => (
            <div
              key={module.key}
              className="module-card"
              onClick={() => handleModuleClick(module.key)}
              style={
                {
                  animationDelay: `${index * 100}ms`,
                  '--card-color': subjectData.color,
                } as React.CSSProperties
              }
            >
              <div className="module-icon">
                <span>{module.icon}</span>
              </div>
              <div className="module-content">
                <h3 className="module-name">{module.name}</h3>
                <p className="module-description">{module.description}</p>
              </div>
              <div className="module-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SubjectPage
