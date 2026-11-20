/**
 * 图表导出工具
 *
 * 教学场景中经常需要把图贴进课件、讲义或作业答案里，
 * 这里统一封装 Plotly 的位图 / 矢量图导出。
 */
import Plotly from '../lib/plotly'

export type PlotImageFormat = 'png' | 'svg'

/** 导出图片的最小尺寸，避免图表尚未布局完成时导出空白图 */
const MIN_EXPORT_WIDTH = 480
const MIN_EXPORT_HEIGHT = 320

/** PNG 采用 2 倍像素，投影与打印时不至于发虚 */
const PNG_SCALE = 2

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\n\r\t]/g

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 生成导出文件名：<图表标题>-<年月日-时分>.<扩展名>
 *
 * 标题取自页面标题（去掉站点后缀），便于一眼看出这份图片讲的是什么。
 */
export function buildExportFileName(
  pageTitle: string,
  format: PlotImageFormat,
  now: Date = new Date()
): string {
  const cleaned = pageTitle.replace(/\s*[|｜]\s*MathInsight\s*$/i, '').trim()
  const base = (cleaned || 'mathinsight-chart')
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}`
  return `${base}-${stamp}.${format}`
}

/**
 * 把指定图表导出为图片并触发下载
 *
 * @param graphDiv Plotly 渲染所在的 DOM 节点
 * @param format   png（位图，2 倍像素）或 svg（矢量，可无损缩放）
 * @param pageTitle 页面标题，用于生成文件名
 */
export async function downloadPlotImage(
  graphDiv: HTMLElement,
  format: PlotImageFormat,
  pageTitle: string
): Promise<void> {
  const rect = graphDiv.getBoundingClientRect()
  const width = Math.max(MIN_EXPORT_WIDTH, Math.round(rect.width))
  const height = Math.max(MIN_EXPORT_HEIGHT, Math.round(rect.height))

  const dataUrl = await Plotly.toImage(graphDiv, {
    format,
    width,
    height,
    scale: format === 'png' ? PNG_SCALE : 1,
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = buildExportFileName(pageTitle, format)
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
