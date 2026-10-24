/**
 * 角色精灵：主角（Body_A 64×64 帧）与 NPC（闲置动画）的帧选取与头像。
 */
import type { Assets } from './assets'

export type Dir = 'down' | 'up' | 'left' | 'right'
export type MoveState = 'idle' | 'walk' | 'run'

export interface FramePick {
  img: HTMLImageElement
  sx: number
  sy: number
  sw: number
  sh: number
  flip: boolean
}

const HERO_FPS: Record<MoveState, number> = { idle: 4, walk: 8, run: 11 }

/** 主角当前帧（t 为该状态累计时间） */
export function heroFrame(assets: Assets, dir: Dir, state: MoveState, t: number): FramePick {
  const side = dir === 'left' || dir === 'right'
  const flip = dir === 'left'
  const key = (`hero${state[0].toUpperCase()}${state.slice(1)}${side ? 'Side' : dir === 'down' ? 'Down' : 'Up'}`) as
    | 'heroIdleDown' | 'heroIdleSide' | 'heroIdleUp'
    | 'heroWalkDown' | 'heroWalkSide' | 'heroWalkUp'
    | 'heroRunDown' | 'heroRunSide' | 'heroRunUp'
  const img = assets[key]
  const frames = state === 'idle' ? 4 : 6
  const idx = Math.floor(t * HERO_FPS[state]) % frames
  return { img, sx: idx * 64, sy: 0, sw: 64, sh: 64, flip }
}

// ------------------------------------------------------------------
// 主角战斗动作（slice / hit / death，播放一次并停在末帧）
// ------------------------------------------------------------------

export type HeroAction = 'slice' | 'hit' | 'death'

const ACTION_META: Record<HeroAction, { frames: number; fps: number }> = {
  slice: { frames: 8, fps: 15 },
  hit: { frames: 4, fps: 9 },
  death: { frames: 8, fps: 8 },
}

/** 动作总时长（秒），用于 loop 的状态回切 */
export function actionDuration(action: HeroAction): number {
  const m = ACTION_META[action]
  return m.frames / m.fps
}

export function heroActionFrame(assets: Assets, action: HeroAction, dir: Dir, t: number): FramePick {
  const side = dir === 'left' || dir === 'right'
  const flip = dir === 'left'
  const cap = action[0].toUpperCase() + action.slice(1)
  const key = (`hero${cap}${side ? 'Side' : dir === 'down' ? 'Down' : 'Up'}`) as
    | 'heroSliceDown' | 'heroSliceSide' | 'heroSliceUp'
    | 'heroHitDown' | 'heroHitSide' | 'heroHitUp'
    | 'heroDeathDown' | 'heroDeathSide' | 'heroDeathUp'
  const m = ACTION_META[action]
  const idx = Math.min(Math.floor(t * m.fps), m.frames - 1)
  return { img: assets[key], sx: idx * 64, sy: 0, sw: 64, sh: 64, flip }
}

// ------------------------------------------------------------------
// NPC
// ------------------------------------------------------------------

export interface NpcSpriteDef {
  img: 'npcWizard' | 'npcKnight' | 'npcPeasant' | 'npcKeeper' | 'npcHost' | 'npcScholar' | 'npcSage'
  fw: number
  fh: number
  count: number
  fps: number
  flip?: boolean
}

export const NPC_SPRITES: Record<string, NpcSpriteDef> = {
  wizard: { img: 'npcWizard', fw: 32, fh: 32, count: 4, fps: 4 },
  knight: { img: 'npcKnight', fw: 32, fh: 32, count: 4, fps: 4 },
  peasant: { img: 'npcPeasant', fw: 64, fh: 64, count: 4, fps: 4 },
  keeper: { img: 'npcKeeper', fw: 64, fh: 64, count: 4, fps: 4, flip: true },
  host: { img: 'npcHost', fw: 64, fh: 64, count: 4, fps: 4 },
  scholar: { img: 'npcScholar', fw: 64, fh: 64, count: 4, fps: 4 },
  sage: { img: 'npcSage', fw: 32, fh: 32, count: 4, fps: 4 },
}

export function npcFrame(assets: Assets, sprite: string, t: number): FramePick | null {
  const def = NPC_SPRITES[sprite]
  if (!def) return null
  const img = assets[def.img]
  const idx = Math.floor(t * def.fps) % def.count
  return { img, sx: idx * def.fw, sy: 0, sw: def.fw, sh: def.fh, flip: def.flip ?? false }
}

const portraitCache = new Map<string, string>()

/** NPC 头像（取第一帧的非透明包围盒，放大裁切，dataURL） */
export function npcPortrait(assets: Assets, sprite: string): string {
  const hit = portraitCache.get(sprite)
  if (hit) return hit
  const def = NPC_SPRITES[sprite]
  if (!def) return ''
  const img = assets[def.img]
  // 帧 0 画到临时 canvas，求 alpha 包围盒
  const tmp = document.createElement('canvas')
  tmp.width = def.fw
  tmp.height = def.fh
  const tctx = tmp.getContext('2d')!
  tctx.drawImage(img, 0, 0, def.fw, def.fh, 0, 0, def.fw, def.fh)
  const data = tctx.getImageData(0, 0, def.fw, def.fh).data
  let minX = def.fw, minY = def.fh, maxX = 0, maxY = 0
  for (let y = 0; y < def.fh; y++) {
    for (let x = 0; x < def.fw; x++) {
      if (data[(y * def.fw + x) * 4 + 3] >= 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX) return ''
  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(def.fw - 1, maxX + pad)
  maxY = Math.min(def.fh - 1, maxY + pad)
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const scale = Math.max(2, Math.floor(96 / Math.max(bw, bh)))
  const c = document.createElement('canvas')
  c.width = bw * scale
  c.height = bh * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, minX, minY, bw, bh, 0, 0, c.width, c.height)
  const url = c.toDataURL()
  portraitCache.set(sprite, url)
  return url
}
