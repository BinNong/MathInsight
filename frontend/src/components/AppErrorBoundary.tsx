import { Component, type ErrorInfo, type ReactNode } from 'react'
import RouteState from './RouteState'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MathInsight page render failed', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <RouteState
          code="ERROR"
          title="页面暂时无法显示"
          description="模块加载或渲染时发生错误。你可以重新加载，或返回学习工作台继续其他内容。"
          actionLabel="重新加载"
          onAction={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
