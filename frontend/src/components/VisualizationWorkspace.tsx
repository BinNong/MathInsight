import { ReactNode, useState } from 'react'
import FloatingPanel from './FloatingPanel'

interface VisualizationWorkspaceProps {
  controls: ReactNode
  visualization: ReactNode
  infoPanels?: ReactNode
  visualizationTitle?: string
  defaultFloating?: boolean
}

export default function VisualizationWorkspace({
  controls,
  visualization,
  infoPanels,
  visualizationTitle = '可视化',
  defaultFloating = false,
}: VisualizationWorkspaceProps) {
  const [isFloating, setIsFloating] = useState(defaultFloating)
  const hasInfoPanels = infoPanels !== undefined && infoPanels !== null

  return (
    <div
      className={`visualization-workspace ${isFloating ? 'floating-active' : ''} ${
        hasInfoPanels ? '' : 'no-info'
      }`}
    >
      <aside className="workspace-controls" aria-label="实验控制">
        {controls}
      </aside>

      <section className="workspace-visualization" aria-label={visualizationTitle}>
        <div className="workspace-visualization-toolbar">
          <span className="workspace-visualization-title">{visualizationTitle}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={isFloating}
            onClick={() => setIsFloating((current) => !current)}
            title={isFloating ? '嵌入页面' : '弹出为浮动窗口'}
          >
            {isFloating ? '⛶ 嵌入' : '⛶ 弹出'}
          </button>
        </div>
        {!isFloating && <div className="workspace-visualization-body">{visualization}</div>}
      </section>

      {hasInfoPanels && (
        <aside className="workspace-info" aria-label="学习说明">
          {infoPanels}
        </aside>
      )}

      {isFloating && (
        <FloatingPanel
          title={visualizationTitle}
          onClose={() => setIsFloating(false)}
          defaultWidth={760}
          defaultHeight={560}
        >
          <div className="workspace-floating-body">{visualization}</div>
        </FloatingPanel>
      )}
    </div>
  )
}
