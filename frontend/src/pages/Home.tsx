import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { Link } from 'react-router-dom'
import {
  getModulesForSubject,
  getModuleById,
  getSubjectById,
  LEARNING_MODULES,
  MODULE_CATEGORY_LABELS,
  SUBJECTS,
  type LearningModule,
  type ModuleCategory,
  type SubjectId,
} from '../data/subjects'
import { useLearningProgress } from '../hooks/useLearningProgress'
import { weakTopics, useMasteryTopics } from '../services/learning'
import { MASTERY_LABEL } from '../world2d/store'
import './Home.css'

type ModuleFilter = 'all' | ModuleCategory | SubjectId

const MODULE_FILTERS: readonly { id: ModuleFilter; label: string }[] = [
  { id: 'all', label: '全部模块' },
  { id: 'experiment', label: '交互实验' },
  { id: 'calculus', label: '微积分' },
  { id: 'linear-algebra', label: '线性代数' },
  { id: 'probability', label: '概率统计' },
  { id: 'tool', label: '学习工具' },
  { id: 'world', label: '数学世界' },
]

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 星盘：观测与发现的古典仪器，作为首屏的低调水印 */
function CelestialChart() {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * Math.PI) / 12
    const inner = i % 6 === 0 ? 138 : 150
    return {
      x1: 200 + Math.cos(angle) * inner,
      y1: 200 + Math.sin(angle) * inner,
      x2: 200 + Math.cos(angle) * 164,
      y2: 200 + Math.sin(angle) * 164,
      major: i % 6 === 0,
    }
  })
  const fineTicks = Array.from({ length: 72 }, (_, i) => {
    const angle = (i * Math.PI) / 36
    return {
      x1: 200 + Math.cos(angle) * 160,
      y1: 200 + Math.sin(angle) * 160,
      x2: 200 + Math.cos(angle) * 168,
      y2: 200 + Math.sin(angle) * 168,
    }
  })
  return (
    <svg className="celestial-chart" viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <circle cx="200" cy="200" r="168" />
      <circle cx="200" cy="200" r="108" />
      <circle cx="200" cy="200" r="58" />
      <circle cx="200" cy="200" r="9" />
      <path d="M200 32V368M32 200H368" strokeDasharray="1 7" />
      <path d="M81 81 319 319M319 81 81 319" strokeDasharray="1 9" />
      {/* 缓慢旋转的刻度环 —— 天体运行 */}
      <g className="chart-rotor">
        <circle cx="200" cy="200" r="140" strokeDasharray="2 6" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={t.major ? 1.4 : 0.7} />
        ))}
        {fineTicks.map((t, i) => (
          <line key={`f${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth="0.5" opacity="0.6" />
        ))}
      </g>
      <text x="200" y="20" textAnchor="middle">0</text>
      <text x="381" y="204" textAnchor="middle">π/2</text>
      <text x="200" y="391" textAnchor="middle">π</text>
      <text x="19" y="204" textAnchor="middle">3π/2</text>
    </svg>
  )
}

type BezierSeg = { p0: [number, number]; p1: [number, number]; p2: [number, number]; p3: [number, number] }

/** 与函数曲线路径一致的贝塞尔分段，供求点与切线使用 */
const CURVE_SEGMENTS: BezierSeg[] = [
  { p0: [30, 172], p1: [82, 170], p2: [105, 155], p3: [138, 128] },
  { p0: [138, 128], p1: [175, 98], p2: [187, 49], p3: [232, 53] },
  { p0: [232, 53], p1: [278, 57], p2: [277, 143], p3: [326, 132] },
  { p0: [326, 132], p1: [360, 125], p2: [380, 83], p3: [410, 43] },
]

function bezierAt(seg: BezierSeg, t: number): { x: number; y: number; dx: number; dy: number } {
  const mt = 1 - t
  const [x0, y0] = seg.p0
  const [x1, y1] = seg.p1
  const [x2, y2] = seg.p2
  const [x3, y3] = seg.p3
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * x0 + b * x1 + c * x2 + d * x3,
    y: a * y0 + b * y1 + c * y2 + d * y3,
    dx: 3 * mt * mt * (x1 - x0) + 6 * mt * t * (x2 - x1) + 3 * t * t * (x3 - x2),
    dy: 3 * mt * mt * (y1 - y0) + 6 * mt * t * (y2 - y1) + 3 * t * t * (y3 - y2),
  }
}

/** 滚动进入视口时从 0 计数到目标值，像数据被"测"出来 */
function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pad = (n: number) => String(n).padStart(2, '0')
    if (reduce) {
      el.textContent = pad(value)
      return
    }

    let raf = 0
    let started = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started) return
        started = true
        observer.disconnect()
        const duration = 1200
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - p, 3)
          el.textContent = pad(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value])

  return (
    <dd ref={ref as Ref<HTMLElement>} className={className}>
      00
    </dd>
  )
}

/** 首屏函数演示：动点沿曲线滑行，切线随之旋转，并实时读出斜率 */
function AnimatedFunctionChart() {
  const pointRef = useRef<SVGCircleElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const tangentRef = useRef<SVGLineElement>(null)
  const projRef = useRef<SVGLineElement>(null)
  const xTickRef = useRef<SVGLineElement>(null)
  const xLabelRef = useRef<SVGTextElement>(null)
  const slopeLabelRef = useRef<SVGTextElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const start = performance.now()
    const CYCLE = 9000 // 一个来回的周期（毫秒）

    const draw = (now: number) => {
      const elapsed = now - start
      // 0 -> 1 -> 0 的平滑往复
      const phase = (elapsed % CYCLE) / CYCLE
      const u = phase < 0.5 ? phase * 2 : (1 - phase) * 2
      // 缓动，让两端稍作停留
      const eased = u * u * (3 - 2 * u)

      const segIndex = Math.min(3, Math.floor(eased * 4))
      const localT = Math.min(1, eased * 4 - segIndex)
      const { x, y, dx, dy } = bezierAt(CURVE_SEGMENTS[segIndex], localT)
      const len = Math.hypot(dx, dy) || 1
      const half = 58
      const tx1 = x - (dx / len) * half
      const ty1 = y - (dy / len) * half
      const tx2 = x + (dx / len) * half
      const ty2 = y + (dy / len) * half

      pointRef.current?.setAttribute('cx', String(x))
      pointRef.current?.setAttribute('cy', String(y))
      ringRef.current?.setAttribute('cx', String(x))
      ringRef.current?.setAttribute('cy', String(y))
      tangentRef.current?.setAttribute('x1', String(tx1))
      tangentRef.current?.setAttribute('y1', String(ty1))
      tangentRef.current?.setAttribute('x2', String(tx2))
      tangentRef.current?.setAttribute('y2', String(ty2))
      projRef.current?.setAttribute('x1', String(x))
      projRef.current?.setAttribute('x2', String(x))
      projRef.current?.setAttribute('y1', String(y))
      xTickRef.current?.setAttribute('x1', String(x))
      xTickRef.current?.setAttribute('x2', String(x))

      const xVal = ((x - 30) / 380) * 4 - 2
      const slope = (-dy / dx) * 0.42
      if (xLabelRef.current) xLabelRef.current.textContent = `x₀ = ${xVal.toFixed(2)}`
      if (slopeLabelRef.current)
        slopeLabelRef.current.textContent = `f′(x₀) = ${slope >= 0 ? '+' : ''}${slope.toFixed(2)}`

      raf = requestAnimationFrame(draw)
    }

    // 初始静态位置
    const init = bezierAt(CURVE_SEGMENTS[1], 0.5)
    const l = Math.hypot(init.dx, init.dy) || 1
    pointRef.current?.setAttribute('cx', String(init.x))
    pointRef.current?.setAttribute('cy', String(init.y))
    ringRef.current?.setAttribute('cx', String(init.x))
    ringRef.current?.setAttribute('cy', String(init.y))
    tangentRef.current?.setAttribute('x1', String(init.x - (init.dx / l) * 58))
    tangentRef.current?.setAttribute('y1', String(init.y - (init.dy / l) * 58))
    tangentRef.current?.setAttribute('x2', String(init.x + (init.dx / l) * 58))
    tangentRef.current?.setAttribute('y2', String(init.y + (init.dy / l) * 58))

    if (!reduce) raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hero-board-chart">
      <svg viewBox="0 0 440 220" fill="none">
        <defs>
          <linearGradient id="home-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9c3b2e" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#9c3b2e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          <path d="M30 35H410M30 80H410M30 125H410M30 170H410" />
          <path d="M65 20V190M140 20V190M215 20V190M290 20V190M365 20V190" />
        </g>
        <path
          className="chart-area"
          d="M30 172C82 170 105 155 138 128C175 98 187 49 232 53C278 57 277 143 326 132C360 125 380 83 410 43V190H30V172Z"
        />
        <path
          className="chart-curve"
          d="M30 172C82 170 105 155 138 128C175 98 187 49 232 53C278 57 277 143 326 132C360 125 380 83 410 43"
        />
        <line className="chart-proj" ref={projRef} x1="215" y1="53" x2="215" y2="190" />
        <line className="chart-x-tick" ref={xTickRef} x1="215" y1="190" x2="215" y2="194" />
        <line className="chart-tangent" ref={tangentRef} x1="185" y1="80" x2="285" y2="26" />
        <circle className="chart-point-ring" ref={ringRef} cx="215" cy="53" r="10" />
        <circle className="chart-point" ref={pointRef} cx="215" cy="53" r="4.5" />
        <text className="chart-readout" ref={xLabelRef} x="34" y="206">
          x₀ = 0.00
        </text>
        <text className="chart-readout chart-slope" ref={slopeLabelRef} x="406" y="206" textAnchor="end">
          f′(x₀) = +0.00
        </text>
      </svg>
      <span className="chart-label chart-label-a">f(x)</span>
      <span className="chart-label chart-label-b">f′(x)</span>
    </div>
  )
}

/** 2D 数学小镇的像素场景：小人巡游、答题气泡、飘云 —— 全部内联自包含 */
function World2DScene() {
  const base = import.meta.env.BASE_URL
  return (
    <span className="w2d-scene" aria-hidden="true">
      <span className="w2d-clouds" style={{ backgroundImage: `url(${base}textures/cloud.png)` }} />
      <span className="w2d-ground" />
      <span className="w2d-bubble">?</span>
      <span className="w2d-spark w2d-spark-a">✦</span>
      <span className="w2d-spark w2d-spark-b">+</span>
      <span
        className="w2d-hero"
        style={{ backgroundImage: `url(${base}assets/world2d/pixel/hero/walk-side.png)` }}
      />
    </span>
  )
}

function FavoriteIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path
        d="m12 3.7 2.5 5.1 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.7Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FavoriteButton({
  module,
  favorite,
  onToggle,
}: {
  module: LearningModule
  favorite: boolean
  onToggle: (moduleId: string) => void
}) {
  return (
    <button
      type="button"
      className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
      aria-label={`${favorite ? '取消收藏' : '收藏'}：${module.name}`}
      aria-pressed={favorite}
      title={favorite ? '取消收藏' : '收藏模块'}
      onClick={() => onToggle(module.id)}
    >
      <FavoriteIcon filled={favorite} />
    </button>
  )
}

function ModuleCard({
  module,
  favorite,
  onToggleFavorite,
}: {
  module: LearningModule
  favorite: boolean
  onToggleFavorite: (moduleId: string) => void
}) {
  return (
    <article className="learning-module-card module-result" data-module-id={module.id}>
      <Link to={module.path} className="learning-module-link">
        <div className="learning-module-head">
          <span className="learning-module-icon" aria-hidden="true">
            {module.icon}
          </span>
          <span className="learning-module-category">{getModuleSubjectLabel(module)}</span>
        </div>
        <h3>{module.name}</h3>
        <p>{module.description}</p>
        <span className="learning-module-action">
          打开模块 <span aria-hidden="true">↗</span>
        </span>
      </Link>
      <FavoriteButton module={module} favorite={favorite} onToggle={onToggleFavorite} />
    </article>
  )
}

function FeatureCard({
  module,
  favorite,
  onToggleFavorite,
}: {
  module: LearningModule
  favorite: boolean
  onToggleFavorite: (moduleId: string) => void
}) {
  return (
    <article
      className="feature-cta-item module-result"
      data-module-id={module.id}
      data-category={module.category}
    >
      <Link to={module.path} className={`feature-cta-card ${module.id}-cta`}>
        {module.id === 'world-2d' && <World2DScene />}
        <span className="feature-cta-icon" aria-hidden="true">
          {module.icon}
        </span>
        <div className="feature-cta-content">
          <div className="feature-cta-kicker">{MODULE_CATEGORY_LABELS[module.category]}</div>
          <strong>{module.name}</strong>
          <p>{module.description}</p>
        </div>
        <span className="feature-cta-arrow" aria-hidden="true">
          ↗
        </span>
      </Link>
      <FavoriteButton module={module} favorite={favorite} onToggle={onToggleFavorite} />
    </article>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string
  title: string
  description: string
  id: string
}) {
  return (
    <div className="section-heading">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="section-description">{description}</p>
    </div>
  )
}

function getModuleSubjectLabel(module: LearningModule): string {
  if (module.subject === 'general') return MODULE_CATEGORY_LABELS[module.category]
  return getSubjectById(module.subject)?.name ?? MODULE_CATEGORY_LABELS[module.category]
}

/** 滚动进入视口时给元素加 is-visible，做客观的依次显影 */
function useScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (reduce || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    )
    targets.forEach((el) => observer.observe(el))
    // 标记后才启用隐藏态，避免无 JS / 首屏闪烁
    root.classList.add('reveal-ready')
    return () => {
      observer.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])
  return rootRef
}

function Home() {
  const rootRef = useScrollReveal()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ModuleFilter>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const { recent, favorites, toggleFavorite, clearProgress } = useLearningProgress()
  const masteryTopics = useMasteryTopics()
  const weak = useMemo(() => weakTopics(masteryTopics, 3), [masteryTopics])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const recentModules = useMemo(
    () =>
      recent
        .map((entry) => getModuleById(entry.id))
        .filter((module): module is LearningModule => module !== undefined),
    [recent]
  )
  const latestModule = recentModules[0]

  const filteredModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return LEARNING_MODULES.filter((module) => {
      const matchesFilter =
        filter === 'all' || module.category === filter || module.subject === filter
      if (!matchesFilter || (favoritesOnly && !favoriteSet.has(module.id))) return false
      if (!normalizedQuery) return true

      const searchText = [
        module.name,
        module.description,
        module.icon,
        getModuleSubjectLabel(module),
        MODULE_CATEGORY_LABELS[module.category],
        ...module.keywords,
      ]
        .join(' ')
        .toLocaleLowerCase()
      return searchText.includes(normalizedQuery)
    })
  }, [favoriteSet, favoritesOnly, filter, query])

  const experimentResults = filteredModules.filter((module) => module.category === 'experiment')
  const featureResults = filteredModules.filter((module) => module.category !== 'experiment')
  const hasProgress = recent.length > 0 || favorites.length > 0

  const resetFilters = () => {
    setQuery('')
    setFilter('all')
    setFavoritesOnly(false)
  }

  const handleClearProgress = () => {
    clearProgress()
    setFavoritesOnly(false)
  }

  return (
    <div className="home-container" id="home-top" ref={rootRef}>
      <div className="home-ambient" aria-hidden="true">
        <CelestialChart />
        <span className="ambient-symbol ambient-integral">∫</span>
        <span className="ambient-symbol ambient-sigma">Σ</span>
        <span className="ambient-symbol ambient-pi">π</span>
        <span className="ambient-symbol ambient-nabla">∇</span>
        <span className="ambient-symbol ambient-phi">φ</span>
        <span className="ambient-symbol ambient-euler">eⁱπ + 1 = 0</span>
      </div>

      <div className="home-content">
        <nav className="home-topbar" aria-label="首页导航">
          <Link to="/" className="home-brand" aria-label="MathInsight 首页">
            <span className="home-brand-mark" aria-hidden="true">
              ƒ
            </span>
            <span>MathInsight</span>
          </Link>
          <div className="home-nav-links">
            <a href="#subjects">学科路径</a>
            <a href="#learning-modules">全部模块</a>
          </div>
          <span className="home-local-label">
            <span aria-hidden="true" /> 学习记录保存在本机
          </span>
        </nav>

        <header className="home-header">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <span aria-hidden="true" /> INTERACTIVE MATHEMATICS
            </p>
            <h1 className="home-title">MathInsight</h1>
            <p className="home-subtitle">高等数学智能教学助手</p>
            <p className="home-motto">
              从一次拖动、一个参数开始，让抽象的公式成为眼前可探索的数学世界。
            </p>
            <div className="home-hero-actions">
              <a href="#learning-modules" className="home-primary-action">
                开始探索 <span aria-hidden="true">→</span>
              </a>
              {latestModule ? (
                <a href="#continue-learning" className="home-secondary-action">
                  继续最近学习
                </a>
              ) : (
                <Link to="/subject/calculus" className="home-secondary-action">
                  从微积分开始
                </Link>
              )}
            </div>
            <div className="home-hero-note">
              <span>13 个交互实验</span>
              <span aria-hidden="true">·</span>
              <span>学习进度本机留存，随时继续</span>
            </div>
          </div>

          <figure className="home-hero-figure" aria-hidden="true">
            <div className="home-hero-board">
              <div className="hero-board-topline">
                <span>FIG. 01 — FUNCTION EXPLORER</span>
                <span className="hero-board-live">
                  <i /> LIVE
                </span>
              </div>
              <AnimatedFunctionChart />
              <div className="hero-board-bottom">
                <div>
                  <span>当前观察</span>
                  <code>f′(x) = lim ₕ→₀ [f(x+h)−f(x)]/h</code>
                </div>
                <span className="hero-board-badge">可视化直觉</span>
              </div>
            </div>
            <figcaption className="hero-figure-caption">
              <span>图 01</span> 一条曲线在一点附近的局部行为 · 切线即其最佳线性逼近
            </figcaption>
          </figure>
        </header>

        <dl className="home-stats reveal" aria-label="学习内容概览">
          <div>
            <dt>学科方向</dt>
            <CountUp value={3} />
          </div>
          <div>
            <dt>交互实验</dt>
            <CountUp value={LEARNING_MODULES.filter((m) => m.category === 'experiment').length} />
          </div>
          <div>
            <dt>学习模块</dt>
            <CountUp value={LEARNING_MODULES.length} />
          </div>
          <div className="home-stats-note">
            <dt>学习方式</dt>
            <dd>探索 · 观察 · 理解</dd>
          </div>
        </dl>

        <section className="subjects-section reveal" id="subjects" aria-labelledby="subjects-title">
          <SectionHeading
            eyebrow="§ 01 — 学科路径"
            title="选择一个方向，开始建立直觉"
            description="沿着学科组织实验，也可以直接进入下方任意模块。每一步都由你掌控。"
            id="subjects-title"
          />
          <div className="subject-cards">
            {SUBJECTS.map((subject) => {
              const modules = getModulesForSubject(subject.id)
              return (
                <Link
                  key={subject.id}
                  to={`/subject/${subject.id}`}
                  className="subject-card visible"
                  style={
                    {
                      '--subject-color': subject.color,
                      '--bg-gradient': subject.gradient,
                    } as CSSProperties
                  }
                >
                  <div className="subject-card-top">
                    <div className="card-icon" style={{ background: subject.gradient }}>
                      <span>{subject.icon}</span>
                    </div>
                    <span className="subject-count">
                      {String(modules.length).padStart(2, '0')} 个实验
                    </span>
                  </div>
                  <div className="card-content">
                    <div className="card-header">
                      <h2 className="card-title">{subject.name}</h2>
                      <span className="card-subtitle">{subject.englishName}</span>
                    </div>
                    <div className="card-formula">
                      <code>{subject.formula}</code>
                    </div>
                    <p className="card-description">{subject.description}</p>
                    <div className="card-modules">
                      {modules.slice(0, 4).map((module) => (
                        <span key={module.id} className="module-tag">
                          {module.name}
                        </span>
                      ))}
                      {modules.length > 4 && (
                        <span className="module-tag module-tag-more">
                          +{modules.length - 4} 更多
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="subject-card-footer">
                    <span>进入学科</span>
                    <span className="card-arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section
          className="continue-section reveal"
          id="continue-learning"
          aria-labelledby="continue-title"
        >
          <div className="section-heading-row">
            <SectionHeading
              eyebrow="§ 02 — 学习连续性"
              title="继续学习"
              description="最近打开与收藏的模块会保存在当前浏览器，下次可以接着探索。"
              id="continue-title"
            />
            {hasProgress && (
              <button type="button" className="clear-progress-button" onClick={handleClearProgress}>
                清除学习记录
              </button>
            )}
          </div>

          {latestModule ? (
            <div className="continue-layout">
              <Link to={latestModule.path} className="continue-primary">
                <span className="continue-label">
                  <ClockIcon /> 上次学习
                </span>
                <span className="continue-primary-icon" aria-hidden="true">
                  {latestModule.icon}
                </span>
                <strong>{latestModule.name}</strong>
                <p>{latestModule.description}</p>
                <span className="continue-action">
                  继续这个模块 <span aria-hidden="true">→</span>
                </span>
              </Link>
              <div className="recent-panel">
                <div className="recent-panel-header">
                  <h3>最近学习</h3>
                  <span>{recentModules.length} 个模块</span>
                </div>
                <div className="recent-list">
                  {recentModules.slice(0, 4).map((module, index) => (
                    <Link to={module.path} className="recent-item" key={module.id}>
                      <span className="recent-item-icon" aria-hidden="true">
                        {module.icon}
                      </span>
                      <span className="recent-item-copy">
                        <strong>{module.name}</strong>
                        <span>{index === 0 ? '最近打开' : getModuleSubjectLabel(module)}</span>
                      </span>
                      <span className="recent-item-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="continue-empty">
              <span className="continue-empty-icon">
                <ClockIcon />
              </span>
              <div>
                <h3>你的学习足迹会在这里汇聚</h3>
                <p>打开任意模块后，就能从这里快速返回，不必重新寻找。</p>
              </div>
              <a href="#learning-modules">
                挑选第一个模块 <span aria-hidden="true">↓</span>
              </a>
            </div>
          )}
        </section>

        <section className="diagnostic-section reveal" aria-labelledby="diagnostic-title">
          <div className="section-heading-row">
            <SectionHeading
              eyebrow="§ 03 — 学习诊断"
              title="薄弱知识点"
              description="根据 2D 数学小镇的答题记录自动识别，点击即可回到对应实验或进入题库练习。"
              id="diagnostic-title"
            />
            <Link to="/world-2d" className="diagnostic-link">去小镇修炼 →</Link>
          </div>
          {weak.length > 0 ? (
            <div className="diagnostic-grid">
              {weak.map((item) => (
                <div key={item.topic.id} className="diagnostic-card">
                  <div className="diagnostic-card-head">
                    <strong>{item.topic.name}</strong>
                    <span className="diagnostic-level">{MASTERY_LABEL[item.mastery.level]}</span>
                  </div>
                  <div className="diagnostic-rate">
                    <span>正确率</span>
                    <div className="diagnostic-bar">
                      <span style={{ width: `${Math.round(item.mastery.accuracy * 100)}%` }} />
                    </div>
                    <strong>{Math.round(item.mastery.accuracy * 100)}%</strong>
                  </div>
                  <p>
                    已答 {item.mastery.answered} 题 · 错题 {item.mastery.wrong} 道
                  </p>
                  <div className="diagnostic-actions">
                    <Link to={`/practice?topic=${item.topic.id}`}>题库练习</Link>
                    <Link to={item.route}>看可视化</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="diagnostic-empty">
              <p>还没有足够的答题数据来判断薄弱点。</p>
              <p>去 2D 数学小镇修炼几组题，或在题库练习里答几道，诊断会自动出现在这里。</p>
              <Link to="/practice">去题库练习 →</Link>
            </div>
          )}
        </section>

        <section className="modules-explorer reveal" id="learning-modules" aria-labelledby="modules-title">
          <SectionHeading
            eyebrow="§ 04 — 模块探索"
            title="找到此刻想弄懂的问题"
            description="按名称、概念或关键词搜索全部实验与工具，用收藏搭建自己的学习清单。"
            id="modules-title"
          />

          <div className="module-toolbar">
            <div className="module-search">
              <SearchIcon />
              <label className="sr-only" htmlFor="learning-module-search">
                搜索学习模块
              </label>
              <input
                id="learning-module-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索极限、矩阵、概率或学习工具…"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              className={`favorite-filter ${favoritesOnly ? 'active' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((current) => !current)}
            >
              <FavoriteIcon filled={favoritesOnly} />
              只看收藏
              <span className="favorite-filter-count">{favorites.length}</span>
            </button>
          </div>

          <div className="module-filter-row" role="group" aria-label="模块分类筛选">
            {MODULE_FILTERS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={filter === item.id ? 'active' : ''}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="module-results-summary" role="status">
            找到 <strong>{filteredModules.length}</strong> 个模块
            {query && <span>，关键词“{query.trim()}”</span>}
          </p>

          {filteredModules.length === 0 ? (
            <div className="module-empty-state">
              <span className="module-empty-icon">
                <SearchIcon />
              </span>
              <h3>没有找到匹配的模块</h3>
              <p>
                {favoritesOnly
                  ? '收藏清单中暂时没有符合当前条件的内容，可以重置筛选后再看看。'
                  : '试试更短的关键词，或切换学科与模块分类。'}
              </p>
              <button type="button" onClick={resetFilters}>
                重置筛选
              </button>
            </div>
          ) : (
            <>
              {experimentResults.length > 0 && (
                <div className="module-result-group">
                  <div className="module-group-heading">
                    <h3>交互实验</h3>
                    <span>{experimentResults.length} 个模块</span>
                  </div>
                  <div className="learning-modules-grid">
                    {experimentResults.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        favorite={favoriteSet.has(module.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              )}

              {featureResults.length > 0 && (
                <div className="module-result-group home-feature-section">
                  <div className="module-group-heading">
                    <h3>学习工具与数学世界</h3>
                    <span>{featureResults.length} 个入口</span>
                  </div>
                  <div className="feature-cta-grid">
                    {featureResults.map((module) => (
                      <FeatureCard
                        key={module.id}
                        module={module}
                        favorite={favoriteSet.has(module.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="home-footer">
          <Link to="/">MathInsight</Link>
          <p>
            <em>Mathematics, the queen of the sciences.</em> — 让抽象数学变得可见、可感、可知
          </p>
          <a href="#home-top">回到顶部 ↑</a>
        </footer>
      </div>
    </div>
  )
}

export default Home
