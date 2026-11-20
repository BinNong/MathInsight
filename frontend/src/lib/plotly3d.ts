/**
 * plotly.js 三维模块（按需加载）
 *
 * 三维渲染器体积较大，只在页面真的出现 3D trace 时才由
 * components/Plot.tsx 动态引入，二维页面不会加载这个 chunk。
 *
 * 注册发生在同一个 Plotly 单例上，因此加载后对全局生效。
 */
import Plotly from './plotly'
import surface from 'plotly.js/lib/surface'
import scatter3d from 'plotly.js/lib/scatter3d'
import mesh3d from 'plotly.js/lib/mesh3d'
import cone from 'plotly.js/lib/cone'

Plotly.register([
  surface, // 三维曲面
  scatter3d, // 三维散点与流线
  mesh3d, // 闭合曲面（高斯定理）
  cone, // 三维向量箭头
])

export default Plotly
