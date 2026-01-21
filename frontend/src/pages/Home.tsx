import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
    description: '探索极限、导数与积分的奥秘',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    icon: '∫',
    modules: [
      { key: 'epsilon-delta', name: 'ε-δ 极限可视化' },
      { key: 'derivative', name: '导数与切线' }
    ]
  },
  {
    id: 'linear-algebra',
    title: '线性代数',
    subtitle: 'Linear Algebra',
    formula: 'det(A) = ∏ λᵢ',
    description: '洞察向量空间与线性变换',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    icon: 'λ',
    modules: [
      { key: 'matrix', name: '矩阵变换可视化' }
    ]
  },
  {
    id: 'probability',
    title: '概率论与数理统计',
    subtitle: 'Probability & Statistics',
    formula: 'E[X] = ∫_{-∞}^{∞} x f(x) dx',
    description: '理解随机现象背后的规律',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    icon: 'P',
    modules: [
      { key: 'lln', name: '大数定律模拟' }
    ]
  }
]

// Floating math symbols background
const FloatingSymbols = () => {
  const symbols = ['∫', '∑', '∏', '∂', '∇', '√', '∞', 'π', 'λ', 'φ', 'e', 'θ']

  return (
    <div className="floating-symbols">
      {symbols.map((symbol, i) => (
        <span
          key={i}
          className="floating-symbol"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${15 + Math.random() * 10}s`
          }}
        >
          {symbol}
        </span>
      ))}
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [visibleCards, setVisibleCards] = useState<number[]>([])

  useEffect(() => {
    // Staggered animation for cards
    SUBJECTS.forEach((_, index) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, index])
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
              style={{
                '--subject-color': subject.color,
                '--bg-gradient': subject.bgGradient
              } as React.CSSProperties}
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
                  {subject.modules.map(module => (
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

        <footer className="home-footer">
          <p>选择上方学科板块开始探索</p>
        </footer>
      </div>
    </div>
  )
}

export default Home
