import { useWorld2DStore } from '../store'

/** 开场标题屏 */
export default function Intro() {
  const started = useWorld2DStore((s) => s.started)
  const setStarted = useWorld2DStore((s) => s.setStarted)

  if (started) return null

  return (
    <div className="world-intro">
      <div className="world-intro-card">
        <div className="world-intro-badge">MathInsight</div>
        <h1 className="world-intro-title">微积分大陆</h1>
        <p className="world-intro-sub">俯视角像素漫游 · 走进三间修炼馆答题精进微积分，用数学咒术击退混沌兽</p>
        <div className="world-intro-controls">
          <span>WASD / 方向键 移动</span>
          <span>Shift 奔跑</span>
          <span>E 对话 / 进屋 / 传送门</span>
          <span>J 剑斩</span>
          <span>K ∫ 冲击波</span>
          <span>L ⟦M⟧ 牢笼</span>
          <span>U Σ 大招（答题蓄力）</span>
          <span>Tab 修炼手札</span>
        </div>
        <button className="world-intro-btn" onClick={() => setStarted(true)}>
          进入大陆 →
        </button>
        <p className="world-intro-tip">酒馆/农舍/法师小屋是三大修炼馆：进屋找导师答题赢灵感 · 森林里击败混沌兽收集知识点</p>
      </div>
    </div>
  )
}
