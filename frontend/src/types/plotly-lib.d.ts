/**
 * plotly.js 子模块的类型声明
 *
 * plotly.js 官方类型包只覆盖主入口，而按需构建需要直接
 * 引用 lib/* 下的子模块，这里补上声明。
 */
declare module 'plotly.js/lib/core' {
    const Plotly: typeof import('plotly.js')
    export default Plotly
}

declare module 'plotly.js/lib/*' {
    import type { PlotlyModule } from 'plotly.js'
    const traceModule: PlotlyModule
    export default traceModule
}
