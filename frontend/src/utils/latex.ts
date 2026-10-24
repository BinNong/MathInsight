import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface RenderLatexOptions {
  displayMode?: boolean
  throwOnError?: boolean
}

export function renderLatex(latex: string, options: RenderLatexOptions = {}): string {
  const clean = latex.trim()
  if (!clean) return ''

  try {
    return katex.renderToString(clean, {
      displayMode: options.displayMode ?? false,
      throwOnError: options.throwOnError ?? false,
      strict: false,
    })
  } catch {
    return `<span class="latex-error">${escapeHtml(clean)}</span>`
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function createMarkup(html: string) {
  return { __html: html }
}
