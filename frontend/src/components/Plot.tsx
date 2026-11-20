import { forwardRef, useCallback, useEffect, useState } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { Figure, PlotParams } from 'react-plotly.js'
import Plotly from '../lib/plotly'
import { downloadPlotImage, type PlotImageFormat } from '../utils/exportPlot'

/**
 * 统一入口的 Plot 组件
 *
 * 在 react-plotly.js 的基础上补三件事：
 * 1. 使用按需构建的 plotly（见 src/lib/plotly.ts），而不是全量包
 * 2. 出现三维 trace 时才动态加载三维渲染器，二维页面不背这份体积
 * 3. 图表右下角提供 PNG / SVG 导出，方便贴进课件与讲义
 *
 * 用法与原 react-plotly.js 完全一致，可直接替换 import。
 */
const BasePlot = createPlotlyComponent(Plotly)

/** 需要三维渲染器的 trace 类型 */
const THREE_D_TRACE_TYPES = new Set(['surface', 'scatter3d', 'mesh3d', 'cone', 'isosurface', 'volume', 'streamtube'])

export type PlotProps = PlotParams & {
    /** 导出文件名前缀，默认取 document.title */
    exportName?: string
    /** 关闭导出按钮（缩略图、装饰性图表等场景） */
    hideExport?: boolean
}

type ExportState = 'idle' | PlotImageFormat | 'error'

const ERROR_RESET_DELAY = 2600

function requiresThreeD(data: PlotParams['data'] | undefined): boolean {
    if (!Array.isArray(data)) return false
    return data.some((trace) =>
        THREE_D_TRACE_TYPES.has(String((trace as { type?: string } | undefined)?.type ?? ''))
    )
}

const PlotComponent = forwardRef<unknown, PlotProps>(function PlotComponent(
    { exportName, hideExport = false, data, onInitialized, ...rest },
    _ref
) {
    const needs3D = requiresThreeD(data)
    const [threeDReady, setThreeDReady] = useState(!needs3D)
    const [graphDiv, setGraphDiv] = useState<HTMLElement | null>(null)
    const [exportState, setExportState] = useState<ExportState>('idle')

    useEffect(() => {
        if (threeDReady || !needs3D) return undefined
        let cancelled = false
        import('../lib/plotly3d')
            .then(() => {
                if (!cancelled) setThreeDReady(true)
            })
            .catch((error) => {
                // 加载失败也让图表继续渲染，让 plotly 给出具体的 trace 报错
                console.error('[Plot] 三维渲染模块加载失败', error)
                if (!cancelled) setThreeDReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [needs3D, threeDReady])

    const handleInitialized = useCallback(
        (figure: Readonly<Figure>, div: Readonly<HTMLElement>) => {
            setGraphDiv(div as HTMLElement)
            onInitialized?.(figure, div)
        },
        [onInitialized]
    )

    useEffect(() => {
        if (exportState !== 'error') return undefined
        const timer = window.setTimeout(() => setExportState('idle'), ERROR_RESET_DELAY)
        return () => window.clearTimeout(timer)
    }, [exportState])

    const handleExport = useCallback(
        async (format: PlotImageFormat) => {
            if (!graphDiv || exportState === 'png' || exportState === 'svg') return
            setExportState(format)
            try {
                await downloadPlotImage(graphDiv, format, exportName ?? document.title)
                setExportState('idle')
            } catch (error) {
                console.error('[Plot] 图表导出失败', error)
                setExportState('error')
            }
        },
        [graphDiv, exportState, exportName]
    )

    if (!threeDReady) {
        return <div className="plot-figure" aria-hidden="true" />
    }

    const busy = exportState === 'png' || exportState === 'svg'

    return (
        <div className="plot-figure">
            <BasePlot {...rest} data={data} onInitialized={handleInitialized} />
            {!hideExport && graphDiv && (
                <div className="plot-export" role="group" aria-label="导出当前图表">
                    <button
                        type="button"
                        onClick={() => handleExport('png')}
                        disabled={busy}
                        aria-label="导出为 PNG 图片"
                        title="导出 PNG（2 倍像素，适合放进课件）"
                    >
                        {exportState === 'png' ? '导出中' : 'PNG'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('svg')}
                        disabled={busy}
                        aria-label="导出为 SVG 矢量图"
                        title="导出 SVG（矢量图，放大不失真）"
                    >
                        {exportState === 'svg' ? '导出中' : 'SVG'}
                    </button>
                    {exportState === 'error' && (
                        <span className="plot-export-error" role="status">
                            导出失败
                        </span>
                    )}
                </div>
            )}
        </div>
    )
})

export default PlotComponent
