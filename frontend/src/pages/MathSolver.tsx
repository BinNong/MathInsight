import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'
import { useManimTask } from '../hooks/useManimTask'
import { useSolverStore } from '../stores/solverStore'
import {
  solverApi,
  SolverStep,
  SimilarProblem,
  SolverSubject,
  StepVerification,
} from '../services/api/solver'
import { manimApi } from '../services/api/manim'
import { renderLatex, createMarkup } from '../utils/latex'
import { getTopicRoute } from '../utils/topicRoutes'

const SUBJECT_OPTIONS: { value: SolverSubject; label: string }[] = [
  { value: 'auto', label: '自动识别' },
  { value: 'calculus', label: '微积分' },
  { value: 'linear-algebra', label: '线性代数' },
  { value: 'probability', label: '概率统计' },
]

const EXAMPLE_PROBLEMS = [
  '求函数 f(x) = x^3 - 3x 的极值点，并判断是极大值还是极小值。',
  '计算矩阵 A = [[1, 2], [3, 4]] 的特征值与特征向量。',
  '设 X ~ N(0, 1)，求 P(X > 1.96)。',
  '求极限 lim_{x \\to 0} \\frac{\\sin x}{x}。',
]

const TOPIC_LABELS: Record<string, string> = {
  limit: '极限',
  derivative: '导数',
  integral: '积分',
  taylor: '泰勒级数',
  'differential-equation': '微分方程',
  multivariate: '多元函数',
  'vector-field': '向量场',
  'line-integral': '线积分',
  'surface-integral': '曲面积分',
  matrix: '矩阵',
  eigenvalue: '特征值',
  'linear-system': '线性方程组',
  probability: '概率',
  distribution: '概率分布',
  'hypothesis-test': '假设检验',
  optimization: '优化',
  series: '级数',
  other: '综合',
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return '操作失败，请稍后重试'
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="difficulty-stars" title={`难度: ${level}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < level ? 'star filled' : 'star'}>
          ★
        </span>
      ))}
    </span>
  )
}

const VERIFICATION_META: Record<StepVerification, { icon: string; label: string; title: string }> =
  {
    verified: { icon: '✓', label: '已验证', title: 'SymPy 符号验证通过：该步推导机器可证' },
    failed: { icon: '⚠', label: '存疑', title: '符号验证未通过：该步可能有误，请谨慎参考' },
    unchecked: { icon: '−', label: '未机检', title: '该步不适合机器符号验证' },
  }

function VerificationBadge({ verification }: { verification?: StepVerification }) {
  if (!verification) return null
  const meta = VERIFICATION_META[verification]
  return (
    <span className={`verification-badge ${verification}`} title={meta.title}>
      {meta.icon} {meta.label}
    </span>
  )
}

function LatexBlock({
  latex,
  displayMode = false,
}: {
  latex?: string | null
  displayMode?: boolean
}) {
  if (!latex) return null
  const html = renderLatex(latex, { displayMode })
  if (!html) return null
  return <span dangerouslySetInnerHTML={createMarkup(html)} />
}

interface StepCardProps {
  step: SolverStep
  isExpanded: boolean
  onToggle: () => void
  onHint: (level: 1 | 2 | 3) => void
  onVisualize: () => void
  hint?: string | null
  hintLoading: boolean
}

function StepCard({
  step,
  isExpanded,
  onToggle,
  onHint,
  onVisualize,
  hint,
  hintLoading,
}: StepCardProps) {
  return (
    <div className={`solver-step-card ${isExpanded ? 'expanded' : ''}`}>
      <button className="solver-step-header" onClick={onToggle}>
        <span className="solver-step-number">{step.index}</span>
        <span className="solver-step-title">{step.title}</span>
        <VerificationBadge verification={step.verification} />
        <span className="solver-step-toggle">{isExpanded ? '▲' : '▼'}</span>
      </button>
      {isExpanded && (
        <div className="solver-step-body">
          <div className="solver-step-section">
            <div className="solver-step-label">思路点拨</div>
            <p>{step.insight}</p>
          </div>
          {step.explanation && (
            <div className="solver-step-section">
              <div className="solver-step-label">详细推导</div>
              <p>{step.explanation}</p>
            </div>
          )}
          {step.formula && (
            <div className="solver-step-formula">
              <LatexBlock latex={step.formula} displayMode />
            </div>
          )}
          {step.common_pitfall && (
            <div className="solver-step-pitfall">
              <strong>⚠ 常见错误：</strong>
              {step.common_pitfall}
            </div>
          )}
          <div className="solver-step-actions">
            <button className="btn btn-secondary btn-sm" onClick={onVisualize}>
              🎬 可视化这一步
            </button>
          </div>
          <div className="solver-hint-section">
            <div className="solver-step-label">提示阶梯</div>
            <div className="hint-ladder">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onHint(1)}
                disabled={hintLoading}
              >
                💡 思路
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onHint(2)}
                disabled={hintLoading}
              >
                🔑 关键步骤
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onHint(3)}
                disabled={hintLoading}
              >
                📝 详细推导
              </button>
            </div>
            {hintLoading && <div className="hint-loading">AI 正在思考提示...</div>}
            {hint && <div className="hint-content">{hint}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MathSolver() {
  const navigate = useNavigate()
  // 会话状态持久化到全局 store（见 stores/solverStore），切换路由后不丢失
  const problem = useSolverStore((s) => s.problem)
  const subject = useSolverStore((s) => s.subject)
  const result = useSolverStore((s) => s.result)
  const expandedSteps = useSolverStore((s) => s.expandedSteps)
  const hints = useSolverStore((s) => s.hints)
  const hintLevels = useSolverStore((s) => s.hintLevels)
  const similarProblems = useSolverStore((s) => s.similarProblems)
  const followUpHistory = useSolverStore((s) => s.followUpHistory)
  const setProblem = useSolverStore((s) => s.setProblem)
  const setSubject = useSolverStore((s) => s.setSubject)
  const setResult = useSolverStore((s) => s.setResult)
  const toggleStep = useSolverStore((s) => s.toggleStep)
  const setHint = useSolverStore((s) => s.setHint)
  const setHintLevel = useSolverStore((s) => s.setHintLevel)
  const setSimilarProblems = useSolverStore((s) => s.setSimilarProblems)
  const addFollowUp = useSolverStore((s) => s.addFollowUp)
  const clearSession = useSolverStore((s) => s.clearSession)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hintLoading, setHintLoading] = useState<Record<number, boolean>>({})
  const [similarLoading, setSimilarLoading] = useState(false)
  const [followUp, setFollowUp] = useState('')
  const [activeVisualizationStep, setActiveVisualizationStep] = useState<number | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  // 从持久化 store 恢复会话时不触发自动滚动
  const restoredRef = useRef(useSolverStore.getState().result !== null)

  const {
    task,
    loading: vizLoading,
    error: vizError,
    videoUrl,
    subtitleUrl,
    generatedCode,
    renderLog,
    createTask,
    cancelTask,
    reset: resetVisualization,
  } = useManimTask()

  useEffect(() => {
    if (restoredRef.current) {
      restoredRef.current = false
      return
    }
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const topicRoute = useMemo(() => (result ? getTopicRoute(result.topic) : undefined), [result])

  const handleAnalyze = async () => {
    if (!problem.trim()) return
    setLoading(true)
    setError(null)
    clearSession(true)
    setActiveVisualizationStep(null)
    resetVisualization()

    try {
      const response = await solverApi.analyze({ problem: problem.trim(), subject })
      if (!response.success || !response.data) {
        setError(response.error || '题目分析失败')
        return
      }
      setResult(response.data)
      // 默认展开第一步
      if (response.data.steps.length > 0) {
        toggleStep(response.data.steps[0].index)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '题目分析失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setProblem(example)
  }

  const handleHint = async (stepIndex: number, level: 1 | 2 | 3) => {
    if (!result) return
    const key = `${stepIndex}_${level}`
    setHintLevel(stepIndex, level)
    // 该级别提示已缓存时直接切换展示，不重复请求
    if (hints[key]) return
    setHintLoading((prev) => ({ ...prev, [stepIndex]: true }))
    try {
      const response = await solverApi.hint({
        problem: problem.trim(),
        current_step: stepIndex,
        level,
      })
      if (response.success && response.data) {
        setHint(key, response.data.hint)
      } else {
        setHint(key, '暂时无法获取提示，请稍后重试。')
      }
    } catch (err: unknown) {
      setHint(key, getErrorMessage(err) || '获取提示失败')
    } finally {
      setHintLoading((prev) => ({ ...prev, [stepIndex]: false }))
    }
  }

  const handleLoadSimilar = async () => {
    if (!result) return
    setSimilarLoading(true)
    try {
      const response = await solverApi.similar({
        problem: problem.trim(),
        topic: result.topic,
        count: 3,
      })
      if (response.success && response.data) {
        setSimilarProblems(response.data.problems)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '生成相似题失败')
    } finally {
      setSimilarLoading(false)
    }
  }

  const handleVisualizeStep = async (step: SolverStep) => {
    if (!result) return
    setActiveVisualizationStep(step.index)
    const description =
      result.visualization_suggestions[step.index - 1]?.description ||
      `Create a Manim animation that visualizes the mathematical concept in this step: ${step.title}. ${step.explanation}`

    await createTask({
      description,
      resolution: '720p',
      fps: 30,
    })
  }

  const handleFollowUp = async () => {
    if (!followUp.trim() || !result) return
    const context = `原题：${problem}\n已获得的分析：${result.restatement}\n学生追问：${followUp.trim()}`
    addFollowUp({ role: 'user', text: followUp.trim() })
    setFollowUp('')
    setLoading(true)
    try {
      const response = await solverApi.analyze({ problem: context, subject })
      if (response.success && response.data) {
        const answer = response.data.steps.map((s) => `${s.title}: ${s.explanation}`).join('\n')
        addFollowUp({ role: 'assistant', text: answer || response.data.restatement })
      } else {
        addFollowUp({ role: 'assistant', text: '暂时无法回答，请换个方式提问。' })
      }
    } catch (err: unknown) {
      addFollowUp({ role: 'assistant', text: getErrorMessage(err) || '追问失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleSimilarClick = (p: SimilarProblem) => {
    setProblem(p.problem)
    setResult(null)
    setSimilarProblems([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const downloadUrl = videoUrl
    ? manimApi.getDownloadUrl(manimApi.getVideoFilenameFromUrl(videoUrl))
    : null
  const isVizRunning =
    vizLoading && task && !['SUCCESS', 'FAILED', 'CANCELLED'].includes(task.status)

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/"
        backLabel="返回首页"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '数学解题助手' }]}
        title="数学解题助手"
      />

      <VisualizationWorkspace
        visualizationTitle="解题分析"
        controls={
          <ControlPanel title="题目输入" subtitle="输入你想解答的高等数学题目">
            <div className="form-group">
              <label>题目描述（支持自然语言与 LaTeX）</label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="例如：求函数 f(x) = x^3 - 3x 的极值点"
                rows={6}
                disabled={loading}
              />
            </div>

            <div className="form-section">
              <div className="form-section-title">试试这些例子</div>
              <div className="preset-group">
                {EXAMPLE_PROBLEMS.map((example, index) => (
                  <button
                    key={index}
                    className="preset-chip"
                    onClick={() => handleExampleClick(example)}
                    disabled={loading}
                  >
                    {example.slice(0, 22)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>学科领域</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as SolverSubject)}
                disabled={loading}
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={loading || !problem.trim()}
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
            >
              {loading ? 'AI 正在分析...' : '开始分析'}
            </button>
          </ControlPanel>
        }
        visualization={
          <div ref={resultRef} className="solver-scroll-container">
            {error && (
              <>
                <ErrorState message={error} />
                <button
                  className="btn btn-secondary"
                  onClick={handleAnalyze}
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  重试
                </button>
              </>
            )}

            {loading && !result && <LoadingState text="AI 正在理解题目并拆解思路..." />}

            {!result && !loading && !error && (
              <VisualizationCard title="欢迎使用数学解题助手">
                <div className="solver-welcome">
                  <p>在左侧输入一道高等数学题目，AI 会帮你：</p>
                  <ul>
                    <li>识别知识点与难度</li>
                    <li>重述题意并列出前置知识</li>
                    <li>给出循序渐进的分步解答</li>
                    <li>提供思路提示、关键步骤与详细推导</li>
                    <li>一键生成对应知识点的 Manim 动画</li>
                    <li>推荐相似练习题巩固理解</li>
                  </ul>
                </div>
              </VisualizationCard>
            )}

            {result && (
              <div className="solver-result">
                <VisualizationCard title="题目分析">
                  <div className="solver-meta">
                    <span className="solver-topic-badge">
                      {TOPIC_LABELS[result.topic] || result.topic}
                    </span>
                    <DifficultyStars level={result.difficulty} />
                    {topicRoute && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(topicRoute.path)}
                      >
                        → {topicRoute.label}
                      </button>
                    )}
                  </div>

                  <div className="solver-section">
                    <div className="solver-section-label">题意重述</div>
                    <p>{result.restatement}</p>
                  </div>

                  {result.prerequisites.length > 0 && (
                    <div className="solver-section">
                      <div className="solver-section-label">前置知识</div>
                      <div className="prerequisite-list">
                        {result.prerequisites.map((pre, i) => (
                          <span key={i} className="prerequisite-tag">
                            {pre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </VisualizationCard>

                <VisualizationCard title="分步解答">
                  <div className="solver-steps">
                    {result.steps.map((step) => (
                      <StepCard
                        key={step.index}
                        step={step}
                        isExpanded={expandedSteps.includes(step.index)}
                        onToggle={() => toggleStep(step.index)}
                        onHint={(level) => handleHint(step.index, level)}
                        onVisualize={() => handleVisualizeStep(step)}
                        hint={hints[`${step.index}_${hintLevels[step.index] || 1}`]}
                        hintLoading={hintLoading[step.index] || false}
                      />
                    ))}
                  </div>

                  {result.final_answer && (
                    <div className="solver-final-answer">
                      <div className="solver-section-label">
                        最终答案 <VerificationBadge verification={result.answer_verification} />
                      </div>
                      <div className="final-answer-box">
                        <LatexBlock latex={result.final_answer} displayMode />
                      </div>
                    </div>
                  )}
                </VisualizationCard>

                {(isVizRunning || videoUrl || vizError) && (
                  <VisualizationCard title="步骤可视化">
                    {isVizRunning && (
                      <div className="solver-viz-status">
                        <LoadingState text={`正在为第 ${activeVisualizationStep} 步生成动画...`} />
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill animated"
                            style={{ width: `${task?.progress_percent || 30}%` }}
                          />
                        </div>
                        <button className="btn btn-secondary" onClick={cancelTask}>
                          取消生成
                        </button>
                      </div>
                    )}

                    {vizError && <ErrorState message={vizError} />}

                    {videoUrl && (
                      <div className="solver-video-result">
                        <video
                          src={videoUrl}
                          controls
                          crossOrigin="anonymous"
                          style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        >
                          {subtitleUrl && (
                            <track
                              kind="subtitles"
                              src={subtitleUrl}
                              srcLang="zh"
                              label="中文"
                              default
                            />
                          )}
                        </video>
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            download
                            className="btn btn-secondary"
                            style={{ marginTop: 'var(--space-3)' }}
                          >
                            下载视频
                          </a>
                        )}
                      </div>
                    )}

                    {generatedCode && (
                      <CollapsibleSection title="查看生成的 Manim 代码">
                        <pre className="code-block">{generatedCode}</pre>
                      </CollapsibleSection>
                    )}

                    {renderLog && (
                      <CollapsibleSection title="查看渲染日志">
                        <pre className="code-block">{renderLog}</pre>
                      </CollapsibleSection>
                    )}
                  </VisualizationCard>
                )}

                <VisualizationCard title="继续探索">
                  <div className="solver-followup">
                    <div className="form-group">
                      <label>还有疑问？继续追问</label>
                      <textarea
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        placeholder="例如：为什么这一步可以这样变形？"
                        rows={2}
                        disabled={loading}
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleFollowUp}
                      disabled={loading || !followUp.trim()}
                    >
                      {loading ? '思考中...' : '提交追问'}
                    </button>

                    {followUpHistory.length > 0 && (
                      <div className="followup-history">
                        {followUpHistory.map((item, index) => (
                          <div key={index} className={`followup-message ${item.role}`}>
                            <strong>{item.role === 'user' ? '你' : 'AI'}：</strong>
                            <p style={{ whiteSpace: 'pre-line' }}>{item.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="solver-similar" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="solver-section-label">相似练习题</div>
                    <button
                      className="btn btn-secondary"
                      onClick={handleLoadSimilar}
                      disabled={similarLoading}
                    >
                      {similarLoading ? '生成中...' : '生成相似题'}
                    </button>

                    {similarProblems.length > 0 && (
                      <div className="similar-problems-list">
                        {similarProblems.map((p, index) => (
                          <div key={index} className="similar-problem-card">
                            <div className="similar-problem-text">
                              <LatexBlock latex={p.problem} />
                            </div>
                            {p.hint && (
                              <div className="similar-problem-hint">
                                <strong>提示：</strong>
                                {p.hint}
                              </div>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleSimilarClick(p)}
                            >
                              做这道题
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </VisualizationCard>
              </div>
            )}
          </div>
        }
        infoPanels={<></>}
      />
    </div>
  )
}
