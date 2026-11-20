import type { KeyboardEvent, PointerEvent } from 'react'
import { useWorld2DStore } from '../store'
import { SKILL_META, MAX_HP, MAX_MP, type SkillKey } from '../engine/combat'

function sendKey(code: string, pressed: boolean) {
  window.dispatchEvent(new KeyboardEvent(pressed ? 'keydown' : 'keyup', { code, bubbles: true }))
}

function tapKey(code: string) {
  sendKey(code, true)
  sendKey(code, false)
}

function holdHandlers(code: string) {
  const release = () => sendKey(code, false)
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      sendKey(code, true)
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      release()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    onPointerCancel: release,
    onLostPointerCapture: release,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault()
        sendKey(code, true)
      }
    },
    onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') release()
    },
    onBlur: release,
  }
}

const DIRECTIONS = [
  { code: 'KeyW', label: '向上移动', icon: '↑', className: 'up' },
  { code: 'KeyA', label: '向左移动', icon: '←', className: 'left' },
  { code: 'KeyS', label: '向下移动', icon: '↓', className: 'down' },
  { code: 'KeyD', label: '向右移动', icon: '→', className: 'right' },
] as const

export default function Hud() {
  const started = useWorld2DStore((s) => s.started)
  const overlay = useWorld2DStore((s) => s.overlay)
  const dialogNpc = useWorld2DStore((s) => s.dialogNpc)
  const quiz = useWorld2DStore((s) => s.quiz)
  const training = useWorld2DStore((s) => s.training)
  const codex = useWorld2DStore((s) => s.codex)
  const setCodex = useWorld2DStore((s) => s.setCodex)
  const prompt = useWorld2DStore((s) => s.prompt)
  const objective = useWorld2DStore((s) => s.objective)
  const hud = useWorld2DStore((s) => s.combatHud)
  const trialStatus = useWorld2DStore((s) => s.trialStatus)

  if (!started || overlay || dialogNpc || quiz || training || codex) return null

  const maxHp = hud?.maxHp ?? MAX_HP
  const hpPct = hud ? Math.max(0, (hud.hp / maxHp) * 100) : 100
  const maxMp = hud?.maxMp ?? MAX_MP
  const mpPct = hud ? Math.max(0, (hud.mp / maxMp) * 100) : 50
  const phaseLabel = trialStatus
    ? { countdown: '下一波准备', fighting: '清场战斗', cleared: '波间答题' }[trialStatus.phase]
    : ''

  return (
    <div className="world-hud">
      <div className="world-objective">{objective}</div>

      <div className="world2d-vitals">
        <div className="world2d-bar">
          <span className="world2d-bar-label">生命</span>
          <div className="world2d-bar-track">
            <div className="world2d-bar-fill hp" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="world2d-bar-num">
            {hud?.hp ?? MAX_HP}/{maxHp}
          </span>
        </div>
        <div className="world2d-bar">
          <span className="world2d-bar-label">灵感</span>
          <div className="world2d-bar-track">
            <div className="world2d-bar-fill mp" style={{ width: `${mpPct}%` }} />
          </div>
          <span className="world2d-bar-num">
            {hud?.mp ?? MAX_MP / 2}/{maxMp}
          </span>
        </div>
        <div className="world2d-score">
          知识点 <strong>{hud?.score ?? 0}</strong> · 击杀 <strong>{hud?.kills ?? 0}</strong>
        </div>
        {(hud?.buff ?? 0) > 0 && <div className="world2d-buff">顿悟 ×1.25 · {hud!.buff}s</div>}
      </div>

      {trialStatus && (
        <div className="world2d-trial-status" role="status">
          <strong>第 {trialStatus.wave} 波</strong>
          <span>{phaseLabel}</span>
          <small>最佳已肃清 {trialStatus.best} 波</small>
        </div>
      )}

      <div className="world2d-skills" aria-label="战斗技能">
        {(Object.keys(SKILL_META) as SkillKey[]).map((key) => {
          const meta = SKILL_META[key]
          const cooldown = hud?.cds[key] ?? 0
          const cooldownPct = meta.cd > 0 ? Math.min(100, (cooldown / meta.cd) * 100) : 0
          const noMp = hud ? hud.mp < meta.cost : false
          const ultReady = key === 'ult' && (hud?.mp ?? 0) >= meta.cost
          return (
            <button
              type="button"
              key={key}
              className={`world2d-skill${noMp ? ' dim' : ''}${ultReady ? ' ready' : ''}`}
              title={`${meta.name}${meta.cost > 0 ? ` · 灵感 ${meta.cost}` : ''}`}
              aria-label={`${meta.name}，快捷键 ${meta.key}`}
              disabled={cooldown > 0.05 || noMp}
              onClick={() =>
                tapKey(
                  meta.key === 'J'
                    ? 'KeyJ'
                    : meta.key === 'K'
                      ? 'KeyK'
                      : meta.key === 'L'
                        ? 'KeyL'
                        : 'KeyU'
                )
              }
            >
              <span className="world2d-skill-icon">{meta.icon}</span>
              <span className="world2d-skill-key">{meta.key}</span>
              {meta.cost > 0 && <span className="world2d-skill-cost">{meta.cost}</span>}
              {cooldown > 0.05 && (
                <span className="world2d-skill-cd" style={{ height: `${cooldownPct}%` }}>
                  <span>{cooldown.toFixed(cooldown >= 1 ? 0 : 1)}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="world2d-touch-controls" aria-label="触控游戏控制">
        <div className="world2d-touch-dpad">
          {DIRECTIONS.map((direction) => (
            <button
              type="button"
              key={direction.code}
              className={direction.className}
              aria-label={direction.label}
              {...holdHandlers(direction.code)}
            >
              {direction.icon}
            </button>
          ))}
        </div>
        <button type="button" className="world2d-touch-interact" onClick={() => tapKey('KeyE')}>
          E 交互
        </button>
      </div>

      {prompt && <div className="world-prompt">{prompt}</div>}
      <button type="button" className="world2d-codex-btn" onClick={() => setCodex(true)}>
        修炼手札 <kbd>Tab</kbd>
      </button>
      <div className="world-hint">
        WASD 移动 · Shift 奔跑 · E 交互 · J 攻击 · K/L 技能 · U 大招 · Tab 手札
      </div>
    </div>
  )
}
