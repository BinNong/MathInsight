interface LoadingStateProps {
  text?: string
}

export default function LoadingState({ text = '加载中...' }: LoadingStateProps) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
