/**
 * plotly.js 按需构建（2D 基础包）
 *
 * 完整版 plotly.js 打包后约 4.5MB，而本项目只用到少量 trace 类型。
 * 这里改用 core + 显式注册，并且把三维模块拆到 lib/plotly3d.ts，
 * 让纯二维页面不必为 3D 渲染器付出体积代价。
 *
 * ⚠️ 新增二维图表类型时必须在此补充注册，否则运行时会报
 *    "Invalid trace type" 或图表空白。
 */
import PlotlyCore from 'plotly.js/lib/core'
import scatter from 'plotly.js/lib/scatter'
import bar from 'plotly.js/lib/bar'
import contour from 'plotly.js/lib/contour'
import heatmap from 'plotly.js/lib/heatmap'

PlotlyCore.register([
  scatter, // 折线 / 散点，绝大多数页面
  bar, // 直方图、分布对比
  contour, // 等高线（多元函数）
  heatmap, // contour 的底层依赖
])

export default PlotlyCore
