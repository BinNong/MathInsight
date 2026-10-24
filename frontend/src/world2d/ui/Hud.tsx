import { useWorld2DStore } from '../store'
import { SKILL_META, MAX_HP, MAX_MP, type SkillKey } from '../engine/combat'

/** HUD：目标、交互提示、生命/灵感条、技能栏、顿悟 buff、手札入口、操作说明 */
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

  if (!started || overlay || dialogNpc || quiz || training || codex) return null

  const maxHp = hud?.maxHp ?? MAX_HP
  const hpPct = hud ? Math.max(0, (hud.hp / maxHp) * 100) : 100
  const maxMp = hud?.maxMp ?? MAX_MP
  const mpPct = hud ? Math.max(0, (hud.mp / maxMp) * 100) : 50

  return (
    <div className="world-hud">
      <div className="world-objective">{objective}</div>

      {/* 生命 / 灵感 / 战绩 */}
      <div className="world2d-vitals">
        <div className="world2d-bar">
          <span className="world2d-bar-label">生命</span>
          <div className="world2d-bar-track">
            <div className="world2d-bar-fill hp" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="world2d-bar-num">
            {hud?.hp ?? MAX_HP}
            {maxHp > MAX_HP ? `/${maxHp}` : ''}
          </span>
        </div>
        <div className="world2d-bar">
          <span className="world2d-bar-label">灵感</span>
          <div className="world2d-bar-track">
            <div className="world2d-bar-fill mp" style={{ width: `${mpPct}%` }} />
          </div>
          <span className="world2d-bar-num">
            {hud?.mp ?? MAX_MP / 2}
            {maxMp > MAX_MP ? `/${maxMp}` : ''}
          </span>
        </div>
        <div className="world2d-score">
          知识点 <strong>{hud?.score ?? 0}</strong> · 击杀 <strong>{hud?.kills ?? 0}</strong>
        </div>
        {(hud?.buff ?? 0) > 0 && <div className="world2d-buff">✨ 顿悟 ×1.25 · {hud!.buff}s</div>}
      </div>

      {/* 技能栏 */}
      <div className="world2d-skills">
        {(Object.keys(SKILL_META) as SkillKey[]).map((k) => {
          const meta = SKILL_META[k]
          const cd = hud?.cds[k] ?? 0
          const cdPct = meta.cd > 0 ? Math.min(100, (cd / meta.cd) * 100) : 0
          const noMp = hud ? hud.mp < meta.cost : false
          const ultReady = k === 'ult' && (hud?.mp ?? 0) >= meta.cost
          return (
            <div
              key={k}
              className={`world2d-skill${noMp ? ' dim' : ''}${ultReady ? ' ready' : ''}`}
              title={`${meta.name}${meta.cost > 0 ? ` · 灵感 ${meta.cost}` : ''}`}
            >
              <span className="world2d-skill-icon">{meta.icon}</span>
              <span className="world2d-skill-key">{meta.key}</span>
              {meta.cost > 0 && <span className="world2d-skill-cost">{meta.cost}</span>}
              {cd > 0.05 && (
                <div className="world2d-skill-cd" style={{ height: `${cdPct}%` }}>
                  <span>{cd.toFixed(cd >= 1 ? 0 : 1)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {prompt && <div className="world-prompt">{prompt}</div>}
      <button className="world2d-codex-btn" onClick={() => setCodex(true)}>
        📖 修炼手札 <kbd>Tab</kbd>
      </button>
      <div className="world-hint">WASD 移动 · Shift 奔跑 · E 交互 · J 攻击 · K/L 技能 · U 大招 · Tab 手札</div>
    </div>
  )
}
