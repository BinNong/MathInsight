import { useEffect, useRef, useState } from 'react'
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
  color: string
  bgGradient: string
  modules: Module[]
}

const SUBJECTS_DATA: Record<string, SubjectData> = {
  'calculus': {
    id: 'calculus',
    title: '微积分',
    subtitle: 'Calculus',
    formula: 'd/dx ∫ₐˣ f(t) dt = f(x)',
    description: '微积分是研究变化率与累积量的数学分支，核心概念包括极限、导数和积分。',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    modules: [
      {
        key: 'epsilon-delta',
        name: 'ε-δ 极限可视化',
        description: '动态展示函数在某点趋近过程，支持 ε-δ 定义可视化',
        icon: 'lim'
      },
      {
        key: 'derivative',
        name: '导数与切线',
        description: '实时绘制切线、法线，动态展示局部线性逼近',
        icon: 'd/dx'
      },
      {
        key: 'riemann',
        name: '黎曼积分',
        description: '黎曼和动态构建，可视化积分定义与数值方法误差收敛',
        icon: '∫'
      },
      {
        key: 'taylor',
        name: '泰勒公式',
        description: '泰勒多项式逼近原函数，可视化余项分析',
        icon: 'Σ'
      },
      {
        key: 'multivariate',
        name: '多元函数可视化',
        description: '3D 曲面图、等高线、偏导数与切平面、梯度场可视化',
        icon: '∇'
      }
    ]
  },
  'linear-algebra': {
    id: 'linear-algebra',
    title: '线性代数',
    subtitle: 'Linear Algebra',
    formula: 'Av = λv',
    description: '线性代数研究向量空间和线性变换，是现代数学和工程的基础。',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    modules: [
      {
        key: 'matrix',
        name: '矩阵变换可视化',
        description: '2×2 矩阵对单位圆/网格的实时变换，支持特征向量显示',
        icon: 'det'
      }
    ]
  },
  'probability': {
    id: 'probability',
    title: '概率论与数理统计',
    subtitle: 'Probability & Statistics',
    formula: 'P(A∪B) = P(A) + P(B) - P(A∩B)',
    description: '概率论研究随机现象的规律，数理统计通过数据推断总体特征。',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    modules: [
      {
        key: 'lln',
        name: '大数定律模拟',
        description: '蒙特卡洛模拟演示样本均值收敛到期望值',
        icon: 'E[X]'
      }
    ]
  }
}

function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [parallaxOffset, setParallaxOffset] = useState(0)
  const [modules, setModules] = useState<Module[]>([])
  const [subjectData, setSubjectData] = useState<SubjectData | null>(null)

  useEffect(() => {
    if (subjectId && SUBJECTS_DATA[subjectId]) {
      setSubjectData(SUBJECTS_DATA[subjectId])
      setModules(SUBJECTS_DATA[subjectId].modules)
    }
  }, [subjectId])

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrolled = window.scrollY
        setParallaxOffset(scrolled * 0.3)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleModuleClick = (moduleKey: string) => {
    const routeMap: Record<string, string> = {
      'epsilon-delta': '/limit',
      'derivative': '/derivative',
      'riemann': '/integration',
      'taylor': '/taylor',
      'multivariate': '/multivariate',
      'matrix': '/matrix',
      'lln': '/probability'
    }
    navigate(routeMap[moduleKey] || '/')
  }

  const handleBack = () => {
    navigate('/')
  }

  if (!subjectData) {
    return (
      <div className="subject-page">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="subject-page" ref={containerRef}>
      <div
        className="subject-hero"
        style={{
          background: subjectData.bgGradient,
          transform: `translateY(${parallaxOffset * 0.5}px)`
        }}
      >
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
      </div>

      <div className="modules-section">
        <h2 className="section-title">功能模块</h2>
        <div className="modules-grid">
          {modules.map((module, index) => (
            <div
              key={module.key}
              className="module-card"
              onClick={() => handleModuleClick(module.key)}
              style={{
                animationDelay: `${index * 150}ms`,
                '--card-color': subjectData.color
              } as React.CSSProperties}
            >
              <div className="module-icon">
                <span>{module.icon}</span>
              </div>
              <h3 className="module-name">{module.name}</h3>
              <p className="module-description">{module.description}</p>
              <div className="module-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SubjectPage
