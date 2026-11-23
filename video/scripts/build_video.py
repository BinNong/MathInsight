#!/usr/bin/env python3
"""把一篇数说热点解读变成科普视频脚本 + 中文旁白。

输入：backend/app/resources/hotspots.json 里的某一条
输出：
  - video/public/audio/<id>.mp3   Edge TTS 中文旁白
  - video/src/script.json          Remotion 渲染用的时间轴脚本

用法：
  python3 video/scripts/build_video.py <hotspot_id> [--voice zh-CN-XiaoxiaoNeural]

注意：旁白文案来自热点内容本身（summary/steps/insight），不新编事实。
所有时间与字幕由实际 TTS 音频时长反推，保证音画字幕三者对齐。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HOTSPOTS = ROOT / 'backend' / 'app' / 'resources' / 'hotspots.json'
AUDIO_DIR = ROOT / 'video' / 'public' / 'audio'
SCRIPT_OUT = ROOT / 'video' / 'src' / 'script.json'
FPS = 30

BRANCH_LABELS = {
    'calculus': '微积分',
    'linear-algebra': '线性代数',
    'probability': '概率统计',
    'statistics': '数据统计',
}

# 每条字幕的语速约 4.2 字/秒（中文 TTS），用于估算分句时长
CHARS_PER_SEC = 4.2
GAP = 0.35  # 句间停顿


def clean_formula(latex: str) -> str:
    """保留原始 LaTeX，Remotion 端用 KaTeX 渲染（与站点一致）。"""
    s = latex.strip()
    # 去掉包裹的 $...$ / $$...$$，KaTeX 用 displayMode 控制
    if s.startswith('$$') and s.endswith('$$'):
        s = s[2:-2]
    elif s.startswith('$') and s.endswith('$'):
        s = s[1:-1]
    return s.strip()


def split_sentences(text: str, max_len: int = 42) -> list[str]:
    """按中文标点切句，长句再按长度切，控制字幕在 2 行内。"""
    parts = re.split(r'(?<=[。！？；])', text)
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) <= max_len:
            out.append(p)
        else:
            # 长句按逗号再切
            subs = re.split(r'(?<=[，,])', p)
            buf = ''
            for sub in subs:
                if len(buf) + len(sub) > max_len and buf:
                    out.append(buf.strip())
                    buf = ''
                buf += sub
            if buf.strip():
                out.append(buf.strip())
    return out


def seconds_to_vtt(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'


def build_narration(item: dict) -> tuple[list[str], list[dict]]:
    """生成旁白句子序列 + 场景剧本（不含时间）。"""
    sentences: list[str] = []
    scenes: list[dict] = []

    def add_scene(kind: str, title: str, narration: list[str], **extra):
        scenes.append({'kind': kind, 'title': title, 'narration': narration, **extra})

    # 1. 钩子
    hook_lines = [item['headline'].replace('"', ''), item['question']]
    add_scene('hook', item['headline'], hook_lines, body=item.get('summary', '')[:60])

    # 2. 现象叙事（讲清事件本身）
    story_lines = split_sentences(item['summary'])
    add_scene('story', '这件事真的发生了', story_lines[:3], body=item['summary'])

    # 3. 公式
    formula_lines = [
        f"这件事背后的数学，是{item['concept']}。",
        '先看这个式子。',
    ]
    add_scene(
        'formula',
        '数学从哪里进来',
        formula_lines,
        formula=clean_formula(item['formula']),
        body=item['formula_note'][:80],
    )

    # 4. 三步推导
    # 去掉原始标题里的"1 · "前缀，因为视频画面用圆圈序号
    step_titles = [re.sub(r'^\s*\d+\s*[·.、]\s*', '', s['title']) for s in item['steps']]
    step_lines = []
    for s in item['steps']:
        step_lines.extend(split_sentences(s['body'])[:2])
    add_scene('steps', '一步步看明白', step_lines[:6], items=step_titles)

    # 5. 结论
    insight_lines = split_sentences(item['insight'])
    add_scene('insight', item['insight'], insight_lines[:2])

    # 6. 思考题 + 片尾
    q_lines = [item['try_it']['text']]
    add_scene('question', item['try_it']['text'], q_lines)
    add_scene('end', '数学，就在你身边', ['这一期就到这里。'])

    # 汇总所有句子
    for sc in scenes:
        sentences.extend(sc['narration'])
    return sentences, scenes


def assign_timing(sentences: list[str], scenes: list[dict], audio_duration: float) -> tuple[list[dict], list[dict]]:
    """按音频真实时长，把句子均匀分配到时间轴。"""
    weights = [max(1.0, len(s) / CHARS_PER_SEC) + GAP for s in sentences]
    total_w = sum(weights)
    scale = audio_duration / total_w

    captions = []
    t = 0.0
    for s, w in zip(sentences, weights):
        dur = w * scale
        captions.append({'start': round(t, 3), 'end': round(t + dur, 3), 'text': s})
        t += dur

    # 场景时间：按各自旁白句数占比分配
    scene_captions = []
    idx = 0
    timed_scenes = []
    for sc in scenes:
        n = len(sc['narration'])
        seg = captions[idx:idx + n]
        idx += n
        if not seg:
            continue
        start = seg[0]['start']
        end = seg[-1]['end']
        timed = {k: v for k, v in sc.items() if k != 'narration'}
        timed['start'] = start
        timed['end'] = end
        # 图表：从步骤或标题里抽取数字做示意（若内容本身有 figure 数据）
        timed_scenes.append(timed)
        scene_captions.extend(seg)

    return timed_scenes, captions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('hotspot_id', help='热点内容 id')
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural', help='Edge TTS 音色')
    ap.add_argument('--skip-audio', action='store_true', help='沿用已有音频，仅重建脚本时间轴')
    args = ap.parse_args()

    import edge_tts

    items = json.loads(HOTSPOTS.read_text(encoding='utf-8'))
    item = next((it for it in items if it['id'] == args.hotspot_id), None)
    if not item:
        print(f'FAIL: 未找到热点 {args.hotspot_id}')
        return 1

    sentences, scenes = build_narration(item)
    narration_text = '\n'.join(sentences)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    audio_path = AUDIO_DIR / f'{item["id"]}.mp3'
    if args.skip_audio and audio_path.exists():
        print(f'沿用已有旁白：{audio_path.name}')
    else:
        print(f'合成旁白：{len(sentences)} 句，{len(narration_text)} 字 …')
        import asyncio

        asyncio.run(edge_tts.Communicate(narration_text, args.voice).save(str(audio_path)))

    # 用 ffprobe 取真实音频时长（不猜）
    probe = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', str(audio_path),
    ], text=True).strip()
    audio_duration = float(probe)

    timed_scenes, captions = assign_timing(sentences, scenes, audio_duration)

    script = {
        'id': item['id'],
        'headline': item['headline'],
        'branch': BRANCH_LABELS.get(item['branch'], item['branch']),
        'category': item['category'],
        'duration': round(audio_duration + 0.6, 3),
        'fps': FPS,
        'audio': audio_path.name,
        'captions': captions,
        'scenes': timed_scenes,
        'accent': '#9C3B2E',
    }
    SCRIPT_OUT.write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding='utf-8')

    # 同时产出 VTT，便于外挂字幕或复核
    vtt_path = AUDIO_DIR / f'{item["id"]}.vtt'
    lines = ['WEBVTT', '']
    for i, c in enumerate(captions, 1):
        lines += [str(i), f'{seconds_to_vtt(c["start"])} --> {seconds_to_vtt(c["end"])}', c['text'], '']
    vtt_path.write_text('\n'.join(lines), encoding='utf-8')

    print(f'OK: 音频 {audio_duration:.1f}s / {script["duration"]:.1f}s')
    print(f'    场景 {len(timed_scenes)} 个，字幕 {len(captions)} 条')
    print(f'    script -> {SCRIPT_OUT}')
    print(f'    audio  -> {audio_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
