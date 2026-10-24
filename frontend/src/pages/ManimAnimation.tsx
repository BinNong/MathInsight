import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import ControlPanel from '../components/ControlPanel'
import VisualizationCard from '../components/VisualizationCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import VisualizationWorkspace from '../components/VisualizationWorkspace'
import CollapsibleSection from '../components/CollapsibleSection'
import { useManimTask } from '../hooks/useManimTask'
import { manimApi } from '../services/api/manim'

const EXAMPLE_DESCRIPTIONS = [
  '制作一个动画，展示 sin 函数图像从 0 到 2π 的生长过程',
  '展示单位圆被矩阵 [[1, 1], [0, 1]] 变换成椭圆的过程',
  '演示 y = x^2 函数图像及其切线的动态绘制',
  '展示一个向量从原点出发，逐渐延长指向 (3, 4) 的动画',
  '制作一个动画，展示圆形逐渐变成正方形的变换过程',
]

export default function ManimAnimation() {
  const [description, setDescription] = useState('')
  const [resolution, setResolution] = useState('720p')
  const [fps, setFps] = useState(30)
  const [subtitleContent, setSubtitleContent] = useState<string | null>(null)

  const {
    task,
    loading,
    error,
    videoUrl,
    subtitleUrl,
    generatedCode,
    renderLog,
    createTask,
    cancelTask,
    reset,
    fetchCodeLog,
  } = useManimTask()

  useEffect(() => {
    if (!subtitleUrl) {
      setSubtitleContent(null)
      return
    }
    fetch(subtitleUrl)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => setSubtitleContent(text))
      .catch(() => setSubtitleContent(null))
  }, [subtitleUrl])

  const handleGenerate = async () => {
    if (!description.trim()) {
      return
    }

    await createTask({
      description: description.trim(),
      resolution,
      fps,
    })
  }

  const handleExampleClick = (example: string) => {
    setDescription(example)
  }

  const getProgressLabel = () => {
    if (!task) return '准备中...'
    switch (task.status) {
      case 'PENDING':
        return '任务已创建，等待开始'
      case 'GENERATING':
        return task.iterations > 0
          ? `AI 正在修复代码（第 ${task.iterations} 次尝试）`
          : 'AI 正在生成 Manim 代码'
      case 'RENDERING':
        return task.stage_message || 'Manim 正在渲染视频'
      case 'SUCCESS':
        return task.cache_hit ? '命中缓存，生成成功' : '生成成功'
      case 'FAILED':
        return '生成失败'
      case 'CANCELLED':
        return '已取消'
      default:
        return task.stage_message
    }
  }

  const getProgressPercent = () => {
    if (!task) return 0
    if (task.status === 'SUCCESS') return 100
    // 优先使用后端上报的进度
    if (task.progress_percent > 0) return task.progress_percent
    switch (task.status) {
      case 'PENDING':
        return 5
      case 'GENERATING':
        return 30
      case 'RENDERING':
        return 70
      default:
        return 0
    }
  }

  const isRunning: boolean = Boolean(
    loading && task && !['SUCCESS', 'FAILED', 'CANCELLED'].includes(task.status)
  )
  const isTerminal = Boolean(task && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(task.status))
  const downloadUrl = videoUrl
    ? manimApi.getDownloadUrl(manimApi.getVideoFilenameFromUrl(videoUrl))
    : null

  return (
    <div className="detail-page">
      <PageHeader
        backTo="/"
        backLabel="返回首页"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: 'Manim 动画生成器' }]}
        title="Manim 动画生成器"
      />

      <VisualizationWorkspace
        visualizationTitle="生成结果"
        controls={
          <ControlPanel title="动画配置" subtitle="输入描述并选择渲染参数">
            <div className="form-group">
              <label>描述你想生成的动画</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：制作一个动画，展示 sin 函数图像从 0 到 2π 的生长过程"
                rows={5}
                disabled={isRunning}
              />
            </div>

            <div className="form-section">
              <div className="form-section-title">试试这些例子</div>
              <div className="preset-group">
                {EXAMPLE_DESCRIPTIONS.map((example, index) => (
                  <button
                    key={index}
                    className="preset-chip"
                    onClick={() => handleExampleClick(example)}
                    disabled={isRunning}
                  >
                    {example.slice(0, 24)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>分辨率</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="720p">720p (1280×720)</option>
                  <option value="1080p">1080p (1920×1080)</option>
                  <option value="4k">4K (3840×2160)</option>
                </select>
              </div>

              <div className="form-group">
                <label>帧率</label>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  disabled={isRunning}
                >
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleGenerate}
              disabled={isRunning || !description.trim()}
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
            >
              {isRunning ? '生成中...' : '生成动画'}
            </button>

            {isRunning && (
              <button
                className="btn btn-secondary btn-lg"
                onClick={cancelTask}
                style={{ width: '100%', marginTop: 'var(--space-3)' }}
              >
                取消生成
              </button>
            )}

            {isTerminal && (
              <button
                className="btn btn-secondary btn-lg"
                onClick={reset}
                style={{ width: '100%', marginTop: 'var(--space-3)' }}
              >
                重置
              </button>
            )}

            {error && !isRunning && <ErrorState message={error} />}
          </ControlPanel>
        }
        visualization={
          <>
            {isRunning && (
              <VisualizationCard title="正在生成动画">
                <div style={{ padding: 'var(--space-6)' }}>
                  <LoadingState text={getProgressLabel()} />
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: 'var(--color-border)',
                      borderRadius: 'var(--radius-full)',
                      marginTop: 'var(--space-4)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${getProgressPercent()}%`,
                        height: '100%',
                        background: 'var(--color-primary)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <p
                    className="form-helper"
                    style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}
                  >
                    首次生成可能需要较长时间（AI 生成代码 + 渲染视频）
                  </p>
                </div>
              </VisualizationCard>
            )}

            {videoUrl && task?.status === 'SUCCESS' && !isRunning && (
              <VisualizationCard title="生成结果">
                <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  <video
                    controls
                    src={videoUrl}
                    style={{
                      width: '100%',
                      maxWidth: '720px',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    {subtitleUrl && (
                      <track kind="subtitles" src={subtitleUrl} srcLang="zh" label="中文" default />
                    )}
                    您的浏览器不支持 video 标签
                  </video>

                  <div style={{ marginTop: 'var(--space-6)' }}>
                    {downloadUrl && (
                      <a href={downloadUrl} download className="btn btn-primary btn-lg">
                        下载视频
                      </a>
                    )}
                  </div>
                  {task.result?.subtitle_adjusted && (
                    <p
                      className="form-helper"
                      style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}
                    >
                      字幕由 AI 自动生成，时间轴已按动画时长校准
                    </p>
                  )}
                </div>
              </VisualizationCard>
            )}

            {!task && !isRunning && (
              <div className="empty-state">
                <div className="empty-state-icon">🎬</div>
                <h3>开始创建你的数学动画</h3>
                <p>在左侧输入动画描述，AI 将自动创建并渲染视频。</p>
              </div>
            )}
          </>
        }
        infoPanels={
          <>
            {task && !isRunning && (
              <CollapsibleSection
                title={task.status === 'SUCCESS' ? '生成成功' : '任务信息'}
                defaultExpanded={true}
                variant={task.status === 'SUCCESS' ? 'success' : 'default'}
              >
                <div className="info-grid">
                  <div className="info-item">
                    <span>任务 ID</span>
                    <span>{task.task_id}</span>
                  </div>
                  <div className="info-item">
                    <span>状态</span>
                    <span>{task.status}</span>
                  </div>
                  <div className="info-item">
                    <span>迭代次数</span>
                    <span>{task.iterations}</span>
                  </div>
                  <div className="info-item">
                    <span>分辨率</span>
                    <span>{task.resolution}</span>
                  </div>
                  <div className="info-item">
                    <span>帧率</span>
                    <span>{task.fps} fps</span>
                  </div>
                  {task.cache_hit && (
                    <div className="info-item">
                      <span>缓存</span>
                      <span>命中</span>
                    </div>
                  )}
                  {task.result?.video_url && (
                    <div className="info-item">
                      <span>视频路径</span>
                      <span>{task.result.video_url}</span>
                    </div>
                  )}
                  {task.result?.subtitle_url && (
                    <div className="info-item">
                      <span>字幕路径</span>
                      <span>{task.result.subtitle_url}</span>
                    </div>
                  )}
                  {typeof task.result?.estimated_duration === 'number' && (
                    <div className="info-item">
                      <span>预估时长</span>
                      <span>{task.result.estimated_duration.toFixed(1)} 秒</span>
                    </div>
                  )}
                  {typeof task.result?.actual_duration === 'number' && (
                    <div className="info-item">
                      <span>实际时长</span>
                      <span>{task.result.actual_duration.toFixed(1)} 秒</span>
                    </div>
                  )}
                  {typeof task.result?.subtitle_count === 'number' && (
                    <div className="info-item">
                      <span>字幕条数</span>
                      <span>{task.result.subtitle_count}</span>
                    </div>
                  )}
                  {task.result?.subtitle_adjusted && (
                    <div className="info-item">
                      <span>字幕修正</span>
                      <span>已按动画时长校准</span>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {isTerminal && generatedCode && (
              <CollapsibleSection
                title="生成的 Manim 代码"
                defaultExpanded={false}
                variant="default"
              >
                <div style={{ position: 'relative' }}>
                  <pre
                    style={{
                      background: 'var(--color-surface)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'auto',
                      maxHeight: '400px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <code>{generatedCode}</code>
                  </pre>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}
                  >
                    复制
                  </button>
                </div>
              </CollapsibleSection>
            )}

            {isTerminal && subtitleContent && (
              <CollapsibleSection
                title="字幕内容（WebVTT）"
                defaultExpanded={false}
                variant="default"
              >
                <div style={{ position: 'relative' }}>
                  <pre
                    style={{
                      background: 'var(--color-surface)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'auto',
                      maxHeight: '400px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <code>{subtitleContent}</code>
                  </pre>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => navigator.clipboard.writeText(subtitleContent)}
                    style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}
                  >
                    复制
                  </button>
                </div>
              </CollapsibleSection>
            )}

            {isTerminal && renderLog && (
              <CollapsibleSection title="渲染日志" defaultExpanded={true} variant="warning">
                <pre
                  style={{
                    background: 'var(--color-surface)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'auto',
                    maxHeight: '400px',
                    fontSize: '0.85rem',
                    color: 'var(--color-error)',
                  }}
                >
                  <code>{renderLog}</code>
                </pre>
              </CollapsibleSection>
            )}

            {isTerminal && !generatedCode && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn btn-secondary btn-sm" onClick={fetchCodeLog}>
                  加载代码与日志
                </button>
              </div>
            )}
          </>
        }
      />
    </div>
  )
}
