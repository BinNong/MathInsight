/**
 * 默认的绘图范围扩展比例
 *
 * 在请求数据时，将当前视野向外扩展一定比例，确保缩放/平移后有足够的
 * 数据绘制，避免边缘出现空白。
 */
export const DEFAULT_EXTEND_RATIO = 0.5

/**
 * 扩展绘图区间
 * @param range 原始区间 [min, max]
 * @param ratio 扩展比例
 * @param clamp 可选的边界限制
 * @returns 扩展后的区间
 */
export function extendDomain(
  range: [number, number],
  ratio: number = DEFAULT_EXTEND_RATIO,
  clamp?: [number, number]
): [number, number] {
  const width = range[1] - range[0]
  const extended: [number, number] = [range[0] - width * ratio, range[1] + width * ratio]
  if (clamp) {
    extended[0] = Math.max(extended[0], clamp[0])
    extended[1] = Math.min(extended[1], clamp[1])
  }
  return extended
}
