interface LoadingStateProps {
  text?: string
}

export default function LoadingState({ text = '加载中...' }: LoadingStateProps) {
  return (
    <div className="loading">
      <div className="loading-spinner" />
      <span>{text}</span>
    </div>
  )
}
