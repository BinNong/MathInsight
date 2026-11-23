// 数说热点科普视频配乐 —— D 大调 · 92 BPM · "好奇的推导"
// 声音方向：marimba 拨弦 = 灵光一现；pad = 思考空间；sub bass = 推进；
//           轻 kick/hat = 心跳；场景转折处 riser→impact + shimmer。
// 所有卡点来自 timeline.json（与画面、旁白同一时间轴），不是手写秒数。
import fs from 'node:fs'
const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf-8'))
export const DUR = T.DUR

const BPM = T.BPM
const CUES = T.cues

export default function score(S) {
  S.tempo(BPM)
  S.space({ room: 0.72, damp: 0.34, width: 0.9 })

  // 人声优先：音乐总线做侧链，鼓点触发时自动让位
  const padBus = S.bus('pad', { gain: 0.30, reverb: 0.32, duck: 0.55, highpass: 220 })
  const pluckBus = S.bus('pluck', { gain: 0.42, reverb: 0.26, duck: 0.45, delay: 0.16 })
  const bassBus = S.bus('bass', { gain: 0.52, lowpass: 420, duck: 0.35 })
  const drumBus = S.bus('drums', { gain: 0.55 })
  const sfxBus = S.bus('sfx', { gain: 0.62, reverb: 0.3 })

  const beat = S.beat(1)
  const bar = S.bar(1)
  const bars = Math.ceil(DUR / bar)

  // D 大调四和弦循环：D - Bm - G - A（明亮但带一点思索）
  const prog = [
    ['D3', 'maj'], ['B2', 'min'], ['G2', 'maj'], ['A2', 'maj'],
  ]

  for (let b = 0; b < bars; b++) {
    const t = S.bar(b)
    const [root, quality] = prog[b % prog.length]
    const intro = b < 1
    const outro = t > DUR - bar * 1.2

    // 铺底和弦：每两小节换一次，长音缓慢呼吸
    if (b % 2 === 0) {
      const notes = S.chord(S.midi(root) + 12, quality)
      padBus.add(S.pad(notes, bar * 2 * 0.96, {
        cutoff: intro ? 850 : 1900, attack: 0.65, release: 1.6, voices: 5,
      }), t, { gain: outro ? 0.7 : 1 })
    }

    // 拨弦动机：每小节 2-3 个音，像"想到一步"
    if (!intro && !outro) {
      const scale = S.scale('D4', 'major')
      const motif = [scale(0), scale(2), scale(4), scale(2)]
      const step = motif[b % motif.length]
      pluckBus.add(S.mallet(step, 0.9, { material: 'marimba', bright: 0.62 }), t + beat * 0.5, { gain: 0.7 })
      if (b % 2 === 1) {
        pluckBus.add(S.mallet(scale(6), 0.8, { material: 'marimba', bright: 0.5 }),
          t + beat * 2.5, { gain: 0.5, pan: 0.3 })
      }
    }

    // 低音推进 + 轻鼓：四拍心跳，避免抢人声
    if (!intro && !outro) {
      for (let k = 0; k < 4; k++) {
        const bt = t + S.beat(k)
        drumBus.add(S.kick({ decay: 0.28, tone: 46 }), bt, { gain: 0.42 })
        S.duck(bt, 0.4) // 音乐在鼓点微微让位，营造呼吸
        drumBus.add(S.hat({ decay: 0.032 }), bt + S.beat(0.5), { gain: 0.22, pan: k % 2 ? 0.25 : -0.25 })
      }
      bassBus.add(S.bass(root, beat * 0.8, { cutoff: 380, sub: 0.45 }), t, { gain: 0.6 })
      bassBus.add(S.bass(root, beat * 0.6, { cutoff: 340, sub: 0.4 }), t + beat * 2, { gain: 0.42 })
    }
  }

  // 场景转折：riser 蓄势 → impact 落点 → shimmer 余韵（与画面切换同帧）
  for (const c of CUES) {
    const t = c.t
    if (t <= 0 || t > DUR - 1) continue
    const isBig = c.kind === 'formula' || c.kind === 'insight' || c.kind === 'end'
    sfxBus.add(S.riser(isBig ? 1.6 : 1.0, { from: 200, to: 2600 }), t - (isBig ? 1.6 : 1.0),
      { gain: isBig ? 0.42 : 0.24 })
    sfxBus.add(S.impact({ size: isBig ? 1.0 : 0.55 }), t, { gain: isBig ? 0.7 : 0.4 })
    drumBus.add(S.crash({ dur: isBig ? 1.8 : 1.0 }), t, { gain: isBig ? 0.3 : 0.16 })
    if (isBig) {
      sfxBus.add(S.shimmer(1.4, { root: 'D5' }), t + 0.1, { gain: 0.3 })
      S.duck(t, 1)
    }
  }

  // 片尾：一个通透的钟，收住
  const last = CUES.find((c) => c.kind === 'end')
  if (last) sfxBus.add(S.bell('D5', 2.2, { ratio: 3.5, index: 3 }), last.t + 0.15, { gain: 0.5 })
}
