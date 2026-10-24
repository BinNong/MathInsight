/**
 * 验证函数表达式是否基本有效
 *
 * 允许数字、运算符、括号、变量和常用数学函数 (sin, cos, tan, log, ln, exp, sqrt 等)。
 * 注意：这只是前端基础校验，后端会进行更严格的安全解析。
 *
 * @param expr 函数表达式字符串
 * @returns 是否有效
 */
export function isValidFunctionExpression(expr: string): boolean {
  if (!expr || expr.trim().length === 0) return false
  const cleaned = expr.trim().replace(/\s+/g, '')
  // 允许数字、运算符、括号、变量和常用数学函数
  const validPattern = /^[\d.+*/()[\]{}xyzXYZ\s,^aAbBcCdDeEgGiIlLnNoOpPrRsStTuU_-]+$/i
  if (!validPattern.test(cleaned)) return false
  // 必须包含变量
  return /[xXyYzZ]/.test(cleaned)
}
