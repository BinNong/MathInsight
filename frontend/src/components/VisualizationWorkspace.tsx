import { ReactNode, useState } from 'react'
import FloatingPanel from './FloatingPanel'

interface VisualizationWorkspaceProps {
  controls: ReactNode
  visualization: ReactNode
  infoPanels: ReactNode
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

  return (
    <div className={`visualization-workspace ${isFloating ? 'floating-active' : ''}`}>
      <div className="workspace-controls">{controls}</div>

      <div className="workspace-visualization">
        <div className="workspace-visualization-toolbar">
          <span className="workspace-visualization-title">{visualizationTitle}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsFloating((f) => !f)}
            title={isFloating ? '嵌入页面' : '弹出为浮动窗口'}
          >
            {isFloating ? '⛶ 嵌入' : '⛶ 弹出'}
          </button>
        </div>
        {!isFloating && <div className="workspace-visualization-body">{visualization}</div>}
      </div>

      <div className="workspace-info">{infoPanels}</div>

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
