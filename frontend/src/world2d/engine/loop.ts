/**
 * 2D 世界主循环：输入、移动碰撞、相机、y 排序渲染、交互检测、战斗集成、室内外场景切换。
 * 世界空间 = 源像素（1 瓦片 = 16 世界像素），屏幕按 SCALE 放大。
 */
import { getWorld, type DoorDef, type WorldData, type WorldObject } from '../data/world'
import { getInterior } from '../data/interiors'
import { getDungeon } from '../data/dungeon'
import { HALLS, type HallId } from '../data/questions'
import { useWorld2DStore, useMasteryStore } from '../store'
import { TILE_SRC, SCALE, prerenderGround, drawWaterRipples } from './ground'
import { loadAssets } from './assets'
import { heroFrame, heroActionFrame, actionDuration, npcFrame, type Dir, type MoveState, type HeroAction } from './sprites'
import { Particles } from './particles'
import { Combat } from './combat'

const WALK_SPEED = 5.2 // 瓦片/秒
const RUN_SPEED = 8.4
const INTERACT_PORTAL = 1.5 // 瓦片
const INTERACT_DOOR = 1.7

/** 场景：小镇 outdoor、某个修炼馆、或微积分秘境 */
type SceneId = 'outdoor' | HallId | 'dungeon'

export interface GameHandle {
  stop: () => void
  /** 调试/测试用传送（瓦片坐标） */
  teleport: (x: number, y: number) => void
  /** 调试/测试：存活怪物位置 */
  mobPositions: () => { x: number; y: number; kind: string; hp: number }[]
  /** 调试/测试：灵感拉满 */
  fillMp: () => void
  /** 调试/测试：当前场景 */
  scene: () => string
}

interface Interactable {
  kind: 'npc' | 'portal' | 'door'
  index: number
  dist: number
  prompt: string
}

/** 玩家动作状态：移动三态 + 战斗动作 */
type PlayerState = MoveState | HeroAction

export async function startGame(canvas: HTMLCanvasElement): Promise<GameHandle> {
  const ctx = canvas.getContext('2d')!
  const assets = await loadAssets()

  // ---- 场景状态（world 随场景切换） ----
  let scene: SceneId = 'outdoor'
  let world: WorldData = getWorld()
  let groundCanvas = prerenderGround(assets, world)
  let particles = new Particles(world)

  const isSolid = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return true
    return world.solid[ty * world.width + tx] === 1
  }

  // ---- 玩家状态（瓦片单位，pos 为脚底中心）----
  const player = {
    x: world.spawn.x,
    y: world.spawn.y,
    dir: 'down' as Dir,
    state: 'idle' as PlayerState,
    animT: 0,
  }
  let playerFlash = 0 // 受击红闪

  // ---- 战斗系统 ----
  const combat = new Combat(assets, world, {
    isSolid,
    damagePlayer: () => {
      if (player.state === 'death') return
      playerFlash = 0.4
      if (combat.hp <= 0) {
        player.state = 'death'
      } else {
        player.state = 'hit'
      }
      player.animT = 0
    },
    onQuiz: (q, resolve) => {
      useWorld2DStore.getState().setQuiz({ ...q, resolve })
    },
    syncHud: (snap) => {
      useWorld2DStore.getState().setCombatHud(snap)
    },
  })

  /** 当前是否可移动 */
  const canMove = () => {
    const s = useWorld2DStore.getState()
    return (
      s.started &&
      !s.overlay &&
      !s.dialogNpc &&
      !s.quiz &&
      !s.training &&
      !s.codex &&
      player.state !== 'slice' &&
      player.state !== 'hit' &&
      player.state !== 'death'
    )
  }

  /** 当前是否可施放技能（受击/挥剑不打断施法） */
  const canCast = () => {
    const s = useWorld2DStore.getState()
    return s.started && !s.overlay && !s.dialogNpc && !s.quiz && !s.training && !s.codex && player.state !== 'death'
  }

  /** 场景切换：重算地面/粒子/怪物，玩家落到新场景出生点 */
  let snapCam = false
  const switchScene = (target: SceneId) => {
    scene = target
    world = target === 'outdoor' ? getWorld() : target === 'dungeon' ? getDungeon() : getInterior(target)
    groundCanvas = prerenderGround(assets, world)
    particles = new Particles(world)
    combat.setWorld(world)
    player.x = world.spawn.x
    player.y = world.spawn.y
    player.state = 'idle'
    player.animT = 0
    player.dir = 'down'
    snapCam = true
    const s = useWorld2DStore.getState()
    s.setObjective(
      target === 'outdoor'
        ? '探索微积分大陆：拜访导师、进屋答题修炼，当心森林里的混沌兽'
        : target === 'dungeon'
          ? '微积分秘境：肃清一波波混沌兽，答对守关人的题目即可回血；到门口按 E 返回小镇'
          : `在「${HALLS[target].name}」与${HALLS[target].mentorName}对话开始修炼；到门口按 E 返回小镇`
    )
    s.setPrompt(null)
  }

  const trySlash = () => {
    if (!canCast()) return
    if (!combat.trySlash(player)) return
    player.state = 'slice'
    player.animT = 0
  }

  // ---- 输入 ----
  const keys = new Set<string>()
  const onKeyDown = (e: KeyboardEvent) => {
    const s = useWorld2DStore.getState()
    if (e.code === 'Tab') {
      e.preventDefault()
      if (s.started && !s.overlay && !s.dialogNpc && !s.quiz && !s.training) s.setCodex(!s.codex)
      return
    }
    if (e.code === 'KeyE' && s.started && !s.overlay && !s.dialogNpc && !s.quiz && !s.training && !s.codex) {
      tryInteract()
    }
    if (canCast()) {
      if (e.code === 'KeyJ') trySlash()
      if (e.code === 'KeyK') combat.castIntegral(player)
      if (e.code === 'KeyL') combat.castMatrix(player)
      if (e.code === 'KeyU') combat.castUlt(player)
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
    keys.add(e.code)
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
  const onBlur = () => keys.clear()
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && e.target === canvas) trySlash()
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('mousedown', onMouseDown)

  // ---- 画布尺寸 ----
  const resize = () => {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    ctx.imageSmoothingEnabled = false
  }
  resize()
  window.addEventListener('resize', resize)

  const cam = { x: 0, y: 0 } // 源像素

  /** AABB（以脚底为中心）与固体瓦片碰撞 */
  const collides = (x: number, y: number) => {
    const hw = 0.24
    const hh = 0.16
    const x0 = Math.floor(x - hw)
    const x1 = Math.floor(x + hw)
    const y0 = Math.floor(y - hh)
    const y1 = Math.floor(y + hh)
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tx, ty)) return true
    return false
  }

  const nearestInteractable = (): Interactable | null => {
    let best: Interactable | null = null
    world.npcs.forEach((n, i) => {
      const d = Math.hypot(player.x - (n.tx + 0.5), player.y - (n.ty + 0.7))
      const range = n.interactDist ?? 1.6
      if (d < range && (!best || d < best.dist)) {
        best = { kind: 'npc', index: i, dist: d, prompt: `按 E 与「${n.name}」对话` }
      }
    })
    world.portals.forEach((p, i) => {
      const d = Math.hypot(player.x - (p.tx + 0.5), player.y - (p.ty + 0.5))
      if (d < INTERACT_PORTAL && (!best || d < best.dist)) {
        best = { kind: 'portal', index: i, dist: d, prompt: `按 E 进入「${p.title}」` }
      }
    })
    world.doors.forEach((d2, i) => {
      const d = Math.hypot(player.x - (d2.tx + 0.5), player.y - (d2.ty + 0.5))
      if (d < INTERACT_DOOR && (!best || d < best.dist)) {
        const prompt = d2.target === 'outdoor' ? `按 E ${d2.title}` : `按 E 进入「${d2.title}」修炼`
        best = { kind: 'door', index: i, dist: d, prompt }
      }
    })
    return best
  }

  const tryInteract = () => {
    const it = nearestInteractable()
    if (!it) return
    const s = useWorld2DStore.getState()
    if (it.kind === 'npc') s.setDialogNpc(world.npcs[it.index].id)
    else if (it.kind === 'portal') s.openOverlay({ route: world.portals[it.index].route, title: world.portals[it.index].title })
    else {
      const door: DoorDef = world.doors[it.index]
      switchScene(door.target === 'outdoor' ? 'outdoor' : door.target)
    }
  }

  // ---- 更新 ----
  const update = (dt: number) => {
    const s = useWorld2DStore.getState()
    const active = s.started && !s.overlay && !s.dialogNpc && !s.quiz && !s.training && !s.codex
    playerFlash = Math.max(0, playerFlash - dt)

    // 修炼结算奖励（Training UI 提交，这里应用到战斗状态）
    if (s.trainingReward) {
      combat.grantReward(s.trainingReward)
      s.setTrainingReward(null)
    }
    // 熟练/精通奖励的生命与灵感上限（持久化 → 战斗，幂等同步）
    combat.setMaxMpBonus(useMasteryStore.getState().maxMpBonus)
    combat.setMaxHpBonus(useMasteryStore.getState().maxHpBonus)

    // 战斗动作状态机（动作期间锁定移动）
    if (player.state === 'slice' || player.state === 'hit' || player.state === 'death') {
      player.animT += dt
      const dur = actionDuration(player.state)
      if (player.state === 'death') {
        if (player.animT >= dur + 0.9) {
          // 复活回出生点（当前场景）
          player.x = world.spawn.x
          player.y = world.spawn.y
          player.state = 'idle'
          player.animT = 0
          player.dir = 'down'
          combat.respawn()
          s.setObjective(
            scene === 'outdoor'
              ? '探索微积分大陆：拜访导师、进屋答题修炼，当心森林里的混沌兽'
              : `在「${HALLS[scene as HallId].name}」与${HALLS[scene as HallId].mentorName}对话开始修炼；到门口按 E 返回小镇`
          )
        }
      } else if (player.animT >= dur) {
        player.state = 'idle'
        player.animT = 0
      }
    }

    let dx = 0
    let dy = 0
    if (canMove()) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
    }
    const moving = dx !== 0 || dy !== 0
    if (moving) {
      const len = Math.hypot(dx, dy)
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const speed = running ? RUN_SPEED : WALK_SPEED
      const vx = (dx / len) * speed * dt
      const vy = (dy / len) * speed * dt
      if (!collides(player.x + vx, player.y)) player.x += vx
      if (!collides(player.x, player.y + vy)) player.y += vy
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left'
      else player.dir = dy > 0 ? 'down' : 'up'
      const ns: MoveState = running ? 'run' : 'walk'
      if (player.state !== ns) {
        player.state = ns
        player.animT = 0
      }
      player.animT += dt
    } else if (player.state !== 'idle' && player.state !== 'slice' && player.state !== 'hit' && player.state !== 'death') {
      player.state = 'idle'
      player.animT = 0
    } else if (player.state === 'idle') {
      player.animT += dt
    }
    player.x = Math.min(Math.max(player.x, 1.5), world.width - 1.5)
    player.y = Math.min(Math.max(player.y, 1.8), world.height - 1.5)

    // 战斗更新（答题/浮层打开时全场冻结）
    combat.update(dt, player, !active)

    // 相机平滑跟随 + 边界钳制（源像素）；切场景时立即到位
    const vw = canvas.width / SCALE
    const vh = canvas.height / SCALE
    const mapPxW = world.width * TILE_SRC
    const mapPxH = world.height * TILE_SRC
    const targetX = mapPxW <= vw ? (mapPxW - vw) / 2 : Math.min(Math.max(player.x * TILE_SRC - vw / 2, 0), mapPxW - vw)
    const targetY = mapPxH <= vh ? (mapPxH - vh) / 2 : Math.min(Math.max(player.y * TILE_SRC - vh * 0.55, 0), mapPxH - vh)
    if (snapCam) {
      cam.x = targetX
      cam.y = targetY
      snapCam = false
    } else {
      const k = 1 - Math.pow(0.001, dt)
      cam.x += (targetX - cam.x) * k
      cam.y += (targetY - cam.y) * k
    }

    if (active && player.state !== 'death') {
      const it = nearestInteractable()
      const prompt = it ? (it as Interactable).prompt : null
      if (s.prompt !== prompt) s.setPrompt(prompt)
    } else if (s.prompt) {
      s.setPrompt(null)
    }
  }

  // ---- 对象绘制 ----
  const objectFrame = (o: WorldObject, t: number): { img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number } => {
    const img = assets[o.img]
    if (o.frames) {
      const f = o.frames
      const idxF = Math.floor(t * f.fps) % f.count
      return { img, sx: f.axis === 'x' ? idxF * f.w : 0, sy: f.axis === 'y' ? idxF * f.h : 0, sw: f.w, sh: f.h }
    }
    if (o.rect) return { img, sx: o.rect.x, sy: o.rect.y, sw: o.rect.w, sh: o.rect.h }
    return { img, sx: 0, sy: 0, sw: img.width, sh: img.height }
  }

  const drawShadow = (wx: number, wy: number, rw: number, alpha = 0.18) => {
    ctx.fillStyle = `rgba(8,10,20,${alpha})`
    ctx.beginPath()
    ctx.ellipse(wx - cam.x, wy - cam.y, rw, rw * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawObject = (o: WorldObject, t: number) => {
    const f = objectFrame(o, t)
    const wx = o.bx * TILE_SRC
    const wy = o.by * TILE_SRC
    // 阴影：大树与建筑更宽
    const rw = Math.min(f.sw * 0.32, 40)
    if (f.sw >= 24) drawShadow(wx, wy - 1, rw, f.sw > 90 ? 0.22 : 0.16)
    const dx = wx - f.sw / 2 - cam.x
    const dy = wy - f.sh - cam.y
    if (o.flip) {
      ctx.save()
      ctx.translate(Math.round(wx - cam.x), 0)
      ctx.scale(-1, 1)
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.sw / 2, wy - f.sh - cam.y, f.sw, f.sh)
      ctx.restore()
    } else {
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), f.sw, f.sh)
    }
  }

  const drawPortalRing = (p: WorldData['portals'][number], t: number) => {
    const cx = (p.tx + 0.5) * TILE_SRC - cam.x
    const cy = (p.ty + 0.55) * TILE_SRC - cam.y
    const rx = TILE_SRC * 0.62
    const ry = TILE_SRC * 0.3
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, TILE_SRC * 1.2)
    glow.addColorStop(0, p.color + '55')
    glow.addColorStop(1, p.color + '00')
    ctx.fillStyle = glow
    ctx.fillRect(cx - TILE_SRC * 1.2, cy - TILE_SRC * 1.2, TILE_SRC * 2.4, TILE_SRC * 2.4)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.strokeStyle = p.color
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.9
    for (let ring = 0; ring < 2; ring++) {
      const rScale = ring === 0 ? 1 : 0.62
      const rot = t * (ring === 0 ? 1 : -1.4)
      ctx.beginPath()
      for (let a = 0; a < 6; a++) {
        const a0 = rot + (a * Math.PI) / 3
        ctx.ellipse(0, 0, rx * rScale, ry * rScale, 0, a0, a0 + Math.PI / 4.2)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  const drawNameLabel = (text: string, sx: number, sy: number, color: string) => {
    ctx.font = `600 12px "PingFang SC", "Hiragino Sans GB", sans-serif`
    const w = ctx.measureText(text).width + 12
    ctx.fillStyle = 'rgba(12, 7, 28, 0.66)'
    ctx.beginPath()
    ctx.roundRect(sx - w / 2, sy - 10, w, 18, 9)
    ctx.fill()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, sx, sy)
  }

  const NPC_COLORS: Record<string, string> = {
    shuling: '#c4b5fd',
    jifen: '#93c5fd',
    juzhen: '#fdba74',
    gailv: '#6ee7b7',
    luobida: '#fda4af',
    newton: '#93c5fd',
    laibunizi: '#fcd34d',
  }

  // ---- 渲染 ----
  const render = (t: number) => {
    const vw = canvas.width
    const vh = canvas.height
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, vw, vh)
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    ctx.imageSmoothingEnabled = false

    // 震屏
    const shX = combat.shakeT > 0 ? (Math.random() - 0.5) * combat.shakeT * 10 : 0
    const shY = combat.shakeT > 0 ? (Math.random() - 0.5) * combat.shakeT * 10 : 0
    const camX = cam.x + shX
    const camY = cam.y + shY

    // 地面 + 水面涟漪
    ctx.drawImage(groundCanvas, -Math.round(camX), -Math.round(camY))
    drawWaterRipples(ctx, world, camX, camY, vw / SCALE, vh / SCALE, t)

    // 传送门符文环（贴地）
    for (const p of world.portals) drawPortalRing(p, t)

    // 室内出口门垫：琥珀色脉动光环
    if (scene !== 'outdoor' && world.doors.length > 0) {
      const d = world.doors[0]
      const cx = (d.tx + 0.5) * TILE_SRC - camX
      const cy = (d.ty + 0.62) * TILE_SRC - camY
      const pulse = 0.55 + Math.sin(t * 3.2) * 0.25
      ctx.save()
      ctx.globalAlpha = pulse * 0.35
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, TILE_SRC * 1.1)
      glow.addColorStop(0, '#fcd34d66')
      glow.addColorStop(1, '#fcd34d00')
      ctx.fillStyle = glow
      ctx.fillRect(cx - TILE_SRC * 1.1, cy - TILE_SRC * 1.1, TILE_SRC * 2.2, TILE_SRC * 2.2)
      ctx.globalAlpha = pulse
      ctx.strokeStyle = '#fcd34d'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(cx, cy, TILE_SRC * 0.72, TILE_SRC * 0.34, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 战斗地面特效（冲击波环 / 矩阵牢笼）
    combat.drawGroundFx(ctx, camX, camY)

    // y 排序对象层
    type DrawItem = { sortY: number; draw: () => void }
    const items: DrawItem[] = []
    for (const o of world.objects) {
      // 视锥裁剪
      const f = objectFrame(o, t)
      const ox = o.bx * TILE_SRC - f.sw / 2
      const oy = o.by * TILE_SRC - f.sh
      if (ox + f.sw < camX - 32 || ox > camX + vw / SCALE + 32) continue
      if (oy + f.sh < camY - 32 || oy > camY + vh / SCALE + 32) continue
      items.push({ sortY: (o.by + (o.sortBias ?? 0)) * TILE_SRC, draw: () => drawObject(o, t) })
    }
    world.npcs.forEach((n, i) => {
      const f = npcFrame(assets, n.sprite, t + i * 0.7)
      if (!f) return
      const wx = (n.tx + 0.5) * TILE_SRC
      const wy = (n.ty + 0.95) * TILE_SRC
      items.push({
        sortY: wy,
        draw: () => {
          drawShadow(wx, wy - 1, f.sw * 0.26, 0.2)
          const dx = wx - f.sw / 2 - cam.x
          const dy = wy - f.sh - cam.y
          if (f.flip) {
            ctx.save()
            ctx.translate(Math.round(wx - cam.x), 0)
            ctx.scale(-1, 1)
            ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.sw / 2, wy - f.sh - cam.y, f.sw, f.sh)
            ctx.restore()
          } else {
            ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), f.sw, f.sh)
          }
        },
      })
    })
    // 怪物（混沌兽）
    for (const it of combat.mobDrawItems(ctx, camX, camY)) items.push(it)
    // 玩家
    {
      const isAction = player.state === 'slice' || player.state === 'hit' || player.state === 'death'
      const f = isAction
        ? heroActionFrame(assets, player.state as HeroAction, player.dir, player.animT)
        : heroFrame(assets, player.dir, player.state as MoveState, player.animT)
      const wx = player.x * TILE_SRC
      const wy = player.y * TILE_SRC
      items.push({
        sortY: wy,
        draw: () => {
          drawShadow(wx, wy - 1, 7, 0.22)
          if (f.flip) {
            ctx.save()
            ctx.translate(Math.round(wx - camX), 0)
            ctx.scale(-1, 1)
            ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.sw / 2, wy - f.sh - cam.y, f.sw, f.sh)
            ctx.restore()
          } else {
            ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(wx - f.sw / 2 - camX), Math.round(wy - f.sh - cam.y), f.sw, f.sh)
          }
        },
      })
    }
    items.sort((a, b) => a.sortY - b.sortY)
    for (const it of items) it.draw()

    // 粒子（世界空间）
    particles.draw(ctx, camX, camY, t)

    // ---- 屏幕空间 ----
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // NPC 名牌
    world.npcs.forEach((n) => {
      const sx = ((n.tx + 0.5) * TILE_SRC - camX) * SCALE
      const sy = ((n.ty + 0.95) * TILE_SRC - camY) * SCALE - 66
      if (sx < -60 || sx > vw + 60 || sy < -30 || sy > vh + 30) return
      drawNameLabel(n.name, sx, sy, NPC_COLORS[n.id] ?? '#e0e7ff')
    })
    // 室外：修炼馆门牌名（远处可见，方便发现入口）
    if (scene === 'outdoor') {
      world.doors.forEach((d) => {
        const sx = ((d.tx + 0.5) * TILE_SRC - camX) * SCALE
        const sy = ((d.ty + 0.3) * TILE_SRC - camY) * SCALE - 26
        if (sx < -80 || sx > vw + 80 || sy < -30 || sy > vh + 30) return
        drawNameLabel(`⚔ ${d.title}`, sx, sy, '#fcd34d')
      })
    }
    // 漂浮数学符号
    particles.drawSymbolsScreen(ctx, camX, camY, t)
    // 战斗屏幕特效（符号风暴 / 飘字）
    combat.drawScreenFx(ctx, camX, camY, SCALE, vw, vh)
    // 受击红闪
    if (playerFlash > 0) {
      ctx.fillStyle = `rgba(190, 30, 40, ${Math.min(playerFlash, 0.35) * 0.55})`
      ctx.fillRect(0, 0, vw, vh)
    }
    // 暗角
    const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.78)
    vg.addColorStop(0, 'rgba(20, 10, 40, 0)')
    vg.addColorStop(1, 'rgba(20, 10, 40, 0.28)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, vw, vh)
  }

  // ---- 主循环 ----
  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    update(dt)
    render(now / 1000)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stop: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('resize', resize)
    },
    teleport: (x: number, y: number) => {
      player.x = x
      player.y = y
    },
    mobPositions: () => combat.mobPositions(),
    fillMp: () => combat.fillMp(),
    scene: () => scene,
  }
}
