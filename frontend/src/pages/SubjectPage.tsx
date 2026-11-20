import { Link, useParams } from 'react-router-dom'
import RouteState from '../components/RouteState'
import { getModulesForSubject, getSubjectById, LEARNING_MODULES } from '../data/subjects'
import './Home.css'

const SYMBOLS = ['∫', '∑', 'λ', '∂']

export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const subject = getSubjectById(subjectId)

  if (!subject) {
    return (
      <RouteState
        code="404"
        title="没有找到这个学科"
        description={`学科“${subjectId ?? '未知'}”不存在或已调整。返回学习工作台，可以从完整模块列表继续探索。`}
      />
    )
  }

  const modules = getModulesForSubject(subject.id)
  const tools = LEARNING_MODULES.filter((module) => module.category === 'tool')

  return (
    <div className="subject-page">
      <header className="subject-hero" style={{ background: subject.gradient }}>
        <div className="subject-hero-inner">
          <Link to="/" className="back-button">
            ← 返回学习工作台
          </Link>
          <div className="hero-content">
            <p className="subject-kicker">SUBJECT EXPLORER · 学科探索</p>
            <span className="subject-emblem" aria-hidden="true">
              {subject.icon}
            </span>
            <h1 className="hero-title">{subject.name}</h1>
            <p className="hero-subtitle">{subject.englishName}</p>
            <div className="hero-formula">
              <code>{subject.formula}</code>
            </div>
            <p className="hero-description">{subject.concept}</p>
          </div>
        </div>
        <div className="subject-hero-symbols" aria-hidden="true">
          {SYMBOLS.map((symbol) => (
            <span key={symbol}>{symbol}</span>
          ))}
        </div>
      </header>

      <main className="modules-section">
        <div className="subject-section-heading">
          <div>
            <p className="subject-section-eyebrow">LEARNING MODULES</p>
            <h2 className="section-title">沿着学科路径，逐层建立直觉</h2>
          </div>
          <span className="subject-module-count">{modules.length} 个交互实验</span>
        </div>
        <p className="subject-concept">
          每个模块都可以独立探索，也可以按页面中的学习说明逐步深入。
        </p>

        <div className="modules-grid">
          {modules.map((module, index) => (
            <Link
              key={module.id}
              to={module.path}
              className="module-card"
              style={
                {
                  animationDelay: `${index * 70}ms`,
                  '--card-color': subject.color,
                } as React.CSSProperties
              }
            >
              <div className="module-icon" aria-hidden="true">
                <span>{module.icon}</span>
              </div>
              <div className="module-content">
                <span className="module-card-meta">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="module-name">{module.name}</h3>
                <p className="module-description">{module.description}</p>
              </div>
              <span className="module-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>

        <section className="subject-tools" aria-labelledby="subject-tools-title">
          <div>
            <h2 id="subject-tools-title">需要换个角度？</h2>
            <p>在知识地图中查看概念关系，或让解题助手陪你拆解一道题。</p>
          </div>
          <div className="subject-tool-links">
            {tools.map((tool) => (
              <Link key={tool.id} to={tool.path}>
                <span aria-hidden="true">{tool.icon}</span>
                {tool.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
