import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

interface Subject {
  id: 'calculus' | 'linear-algebra' | 'probability'
  title: string
  subtitle: string
  formula: string
  description: string
  color: string
  bgGradient: string
  icon: string
  modules: { key: string; name: string }[]
}

const SUBJECTS: Subject[] = [
  {
    id: 'calculus',
    title: '微积分',
    subtitle: 'Calculus',
    formula: '∫₀^∞ e^{-x²} dx = √π/2',
    description: '探索极限、导数与积分的奥秘，直观理解变化与累积。',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    icon: '∫',
    modules: [
      { key: 'epsilon-delta', name: 'ε-δ 极限' },
      { key: 'derivative', name: '导数与切线' },
      { key: 'riemann', name: '黎曼积分' },
      { key: 'taylor', name: '泰勒公式' },
    ],
  },
  {
    id: 'linear-algebra',
    title: '线性代数',
    subtitle: 'Linear Algebra',
    formula: 'det(A) = ∏ λᵢ',
    description: '洞察向量空间与线性变换，理解矩阵背后的几何意义。',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    icon: 'λ',
    modules: [{ key: 'matrix', name: '矩阵变换' }],
  },
  {
    id: 'probability',
    title: '概率论与数理统计',
    subtitle: 'Probability & Statistics',
    formula: 'E[X] = ∫_{-∞}^{∞} x f(x) dx',
    description: '理解随机现象背后的规律，用数据推断总体特征。',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    icon: 'P',
    modules: [
      { key: 'lln', name: '大数定律' },
      { key: 'clt', name: '中心极限定理' },
      { key: 'distributions', name: '常见分布' },
    ],
  },
]

// Floating math symbols background (positions memoized)
const FloatingSymbols = () => {
  const symbols = ['∫', '∑', '∏', '∂', '∇', '√', '∞', 'π', 'λ', 'φ', 'e', 'θ']

  const items = useMemo(
    () =>
      symbols.map((symbol, i) => ({
        symbol,
        left: `${(i * 7.7 + Math.random() * 3) % 100}%`,
        delay: `${(i * 0.4 + Math.random() * 2).toFixed(2)}s`,
        duration: `${18 + Math.random() * 8}s`,
      })),
    []
  )

  return (
    <div className="floating-symbols">
      {items.map((item, i) => (
        <span
          key={i}
          className="floating-symbol"
          style={{
            left: item.left,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        >
          {item.symbol}
        </span>
      ))}
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [visibleCards, setVisibleCards] = useState<number[]>([])

  useEffect(() => {
    SUBJECTS.forEach((_, index) => {
      setTimeout(() => {
        setVisibleCards((prev) => [...prev, index])
      }, index * 200)
    })
  }, [])

  const handleSubjectClick = (subjectId: Subject['id']) => {
    navigate(`/subject/${subjectId}`)
  }

  return (
    <div className="home-container">
      <FloatingSymbols />

      <div className="home-content">
        <header className="home-header">
          <h1 className="home-title">MathInsight</h1>
          <p className="home-subtitle">高等数学智能教学助手</p>
          <p className="home-motto">让抽象数学变得可见、可感、可知</p>
        </header>

        <div className="subject-cards">
          {SUBJECTS.map((subject, index) => (
            <div
              key={subject.id}
              className={`subject-card ${visibleCards.includes(index) ? 'visible' : ''}`}
              onClick={() => handleSubjectClick(subject.id)}
              style={
                {
                  '--subject-color': subject.color,
                  '--bg-gradient': subject.bgGradient,
                } as React.CSSProperties
              }
            >
              <div className="card-icon" style={{ background: subject.bgGradient }}>
                <span>{subject.icon}</span>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <h2 className="card-title">{subject.title}</h2>
                  <span className="card-subtitle">{subject.subtitle}</span>
                </div>
                <div className="card-formula">
                  <code>{subject.formula}</code>
                </div>
                <p className="card-description">{subject.description}</p>
                <div className="card-modules">
                  {subject.modules.map((module) => (
                    <span key={module.key} className="module-tag">
                      {module.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card-arrow">→</div>
            </div>
          ))}
        </div>

        <div className="feature-cta-grid">
          <Link to="/world" className="feature-cta-card world-cta">
            <span>🌌</span>
            <div>
              <strong>3D 数学世界</strong>
              <p>第一人称漫游数学宇宙群岛，让数学成为可以行走的风景</p>
            </div>
          </Link>
          <Link to="/world-2d" className="feature-cta-card world2d-cta">
            <span>🗺️</span>
            <div>
              <strong>2D 数学小镇</strong>
              <p>像素风俯视角漫游，跟着石板路拜访四位数学导师</p>
            </div>
          </Link>
          <Link to="/solver" className="feature-cta-card solver-cta">
            <span>🧠</span>
            <div>
              <strong>数学解题助手</strong>
              <p>AI 引导分步解题与可视化理解</p>
            </div>
          </Link>
          <Link to="/knowledge-map" className="feature-cta-card knowledge-map-cta">
            <span>🗺️</span>
            <div>
              <strong>知识学习地图</strong>
              <p>探索概念前置关系与推荐学习路径</p>
            </div>
          </Link>
          <Link to="/manim" className="feature-cta-card manim-cta">
            <span>🎬</span>
            <div>
              <strong>Manim 动画生成器</strong>
              <p>使用 AI 生成数学教学动画</p>
            </div>
          </Link>
        </div>

        <footer className="home-footer">
          <p>选择上方学科板块开始探索 · MathInsight</p>
        </footer>
      </div>
    </div>
  )
}

export default Home
