import { Component, type ReactNode } from 'react'

interface WorldErrorFallbackProps {
  message?: string
  detail?: string
}

export function WorldErrorFallback({ message, detail }: WorldErrorFallbackProps) {
  return (
    <section className="world-error" role="alert" aria-live="assertive">
      <div className="world-error-card">
        <div className="world-intro-badge">MathInsight · 3D World</div>
        <h1>数学宇宙暂时无法显示</h1>
        <p>{message ?? '3D 场景或素材加载失败。请检查网络与浏览器硬件加速设置后重试。'}</p>
        {detail && <p className="world-error-detail">{detail}</p>}
        <button
          className="world-btn primary world-error-retry"
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
        <p className="world-error-help">也可以点击左上角“返回首页”，继续使用其他数学实验室。</p>
      </div>
    </section>
  )
}

interface WorldErrorBoundaryProps {
  children: ReactNode
}

interface WorldErrorBoundaryState {
  error: Error | null
}

export class WorldErrorBoundary extends Component<
  WorldErrorBoundaryProps,
  WorldErrorBoundaryState
> {
  state: WorldErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): WorldErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return <WorldErrorFallback detail={this.state.error.message} />
    }
    return this.props.children
  }
}
