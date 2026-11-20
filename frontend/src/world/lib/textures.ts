import * as THREE from 'three'

const MAX_TEXTURE_SIZE = 2048

interface TextTextureOptions {
  fontSize?: number
  color?: string
  bg?: string
}

export interface TextTexture {
  texture: THREE.Texture
  aspect: number
}

function clampSize(value: number): number {
  return Math.max(1, Math.min(MAX_TEXTURE_SIZE, Math.round(value)))
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = clampSize(width)
  canvas.height = clampSize(height)
  return canvas
}

function fallbackTexture(color = '#ffffff', alpha = 255): THREE.DataTexture {
  const parsed = new THREE.Color(color)
  const data = new Uint8Array([
    Math.round(parsed.r * 255),
    Math.round(parsed.g * 255),
    Math.round(parsed.b * 255),
    alpha,
  ])
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function canvasTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = repeat
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  texture.needsUpdate = true
  return texture
}

function rgba(color: THREE.Color, alpha: number): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`
}

function seededRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

export function makeGroundTexture(baseColor: string): THREE.Texture {
  const size = 256
  const canvas = createCanvas(size, size)
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return fallbackTexture(baseColor)

  const base = new THREE.Color(baseColor)
  const light = base.clone().multiplyScalar(1.22)
  const dark = base.clone().multiplyScalar(0.72)
  const random = seededRandom(
    Array.from(baseColor).reduce(
      (seed, character) => (seed * 33 + character.charCodeAt(0)) % 2147483647,
      7
    )
  )

  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 2400; i++) {
    context.fillStyle = rgba(i % 3 === 0 ? light : dark, 0.12 + random() * 0.2)
    const dotSize = 0.5 + random() * 2.2
    context.fillRect(random() * size, random() * size, dotSize, dotSize)
  }

  const texture = canvasTexture(canvas, true)
  texture.repeat.set(3, 3)
  return texture
}

export function makePortalTexture(portalColor: string): THREE.Texture {
  const size = 256
  const canvas = createCanvas(size, size)
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return fallbackTexture(portalColor, 220)

  const color = new THREE.Color(portalColor)
  const center = size / 2
  const glow = context.createRadialGradient(center, center, 0, center, center, center)
  glow.addColorStop(0, rgba(color.clone().lerp(new THREE.Color('#ffffff'), 0.75), 0.95))
  glow.addColorStop(0.28, rgba(color, 0.62))
  glow.addColorStop(0.72, rgba(color, 0.2))
  glow.addColorStop(1, rgba(color, 0))
  context.fillStyle = glow
  context.fillRect(0, 0, size, size)

  context.translate(center, center)
  context.globalCompositeOperation = 'lighter'
  context.lineCap = 'round'
  for (let arm = 0; arm < 7; arm++) {
    context.beginPath()
    for (let step = 0; step <= 64; step++) {
      const progress = step / 64
      const radius = 8 + progress * 108
      const angle = (arm / 7) * Math.PI * 2 + progress * Math.PI * 2.4
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (step === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.strokeStyle = rgba(color, 0.3)
    context.lineWidth = 7
    context.stroke()
    context.strokeStyle = rgba(color.clone().lerp(new THREE.Color('#ffffff'), 0.55), 0.8)
    context.lineWidth = 1.8
    context.stroke()
  }

  return canvasTexture(canvas)
}

export function makeSymbolTexture(symbol: string, color: string): THREE.Texture {
  const size = 128
  const canvas = createCanvas(size, size)
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return fallbackTexture(color, 0)

  context.clearRect(0, 0, size, size)
  context.font = '96px Georgia, "Times New Roman", serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.shadowColor = color
  context.shadowBlur = 16
  context.fillText(symbol, size / 2, size / 2 + 3, size - 12)
  return canvasTexture(canvas)
}

function estimatedTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce(
    (width, character) => width + fontSize * (character.codePointAt(0)! > 255 ? 1 : 0.62),
    0
  )
}

export function makeTextTexture(text: string, options: TextTextureOptions = {}): TextTexture {
  const fontSize = Math.max(8, Math.min(160, options.fontSize ?? 44))
  const padding = Math.ceil(fontSize * 0.45)
  const font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
  const measuringCanvas = createCanvas(1, fontSize * 2)
  const measuringContext = measuringCanvas?.getContext('2d')
  if (measuringContext) measuringContext.font = font

  const logicalWidth = Math.max(
    1,
    (measuringContext?.measureText(text).width ?? estimatedTextWidth(text, fontSize)) + padding * 2
  )
  const logicalHeight = Math.ceil(fontSize * 1.65)
  const scale = Math.min(1, MAX_TEXTURE_SIZE / logicalWidth, MAX_TEXTURE_SIZE / logicalHeight)
  const width = clampSize(logicalWidth * scale)
  const height = clampSize(logicalHeight * scale)
  const aspect = width / height
  const canvas = createCanvas(width, height)
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return { texture: fallbackTexture('#ffffff', 0), aspect }

  context.scale(scale, scale)
  if (options.bg) {
    context.fillStyle = options.bg
    context.fillRect(0, 0, logicalWidth, logicalHeight)
  } else {
    context.clearRect(0, 0, logicalWidth, logicalHeight)
  }
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = options.color ?? '#f8fafc'
  context.shadowColor = 'rgba(0, 0, 0, 0.8)'
  context.shadowBlur = Math.max(2, fontSize * 0.1)
  context.fillText(text, logicalWidth / 2, logicalHeight / 2, logicalWidth - padding)

  return { texture: canvasTexture(canvas), aspect }
}
