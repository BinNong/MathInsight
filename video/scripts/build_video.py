#!/usr/bin/env python3
"""把一篇数说热点解读变成科普视频脚本 + 中文旁白。

输入：backend/app/resources/hotspots.json 里的某一条
输出：
  - video/public/audio/<id>.mp3        逐句合成拼接的中文旁白
  - video/public/audio/<id>/seg-NN.mp3 分段音频（缓存，便于局部重做）
  - video/public/audio/<id>.vtt        与真实音频对齐的字幕
  - video/src/script.json              Remotion 时间轴（场景/字幕/旁白共用一条时间线）

音画同步方法（借鉴 motion-showreel 的 voice-led timing）：
  逐句用 Edge TTS 合成 -> ffprobe 读每段**真实时长** -> 累加成时间轴
  -> 用同一时间轴驱动字幕、场景边界与逐句画面。绝不按字数猜时间。

用法：
  python3 video/scripts/build_video.py <hotspot_id> [--voice zh-CN-XiaoxiaoNeural]
  python3 video/scripts/build_video.py <hotspot_id> --skip-audio   # 沿用分段缓存，仅重建时间轴
"""
import argparse
import asyncio
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HOTSPOTS = ROOT / 'backend' / 'app' / 'resources' / 'hotspots.json'
AUDIO_DIR = ROOT / 'video' / 'public' / 'audio'
SCRIPT_OUT = ROOT / 'video' / 'src' / 'script.json'
FPS = 30
GAP = 0.28  # 句间静音间隔（秒），保证 TTS 断句自然、字幕可停稳

BRANCH_LABELS = {
    'calculus': '微积分',
    'linear-algebra': '线性代数',
    'probability': '概率统计',
    'statistics': '数据统计',
}


def clean_formula(latex: str) -> str:
    """保留原始 LaTeX，Remotion 端用 KaTeX 渲染。"""
    s = latex.strip()
    if s.startswith('$$') and s.endswith('$$'):
        s = s[2:-2]
    elif s.startswith('$') and s.endswith('$'):
        s = s[1:-1]
    return s.strip()


def split_sentences(text: str, max_len: int = 42) -> list[str]:
    """按中文标点切句，长句再按逗号切，控制字幕在 2 行内。"""
    parts = re.split(r'(?<=[。！？；])', text)
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(p) <= max_len:
            out.append(p)
        else:
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


def probe_duration(path: Path) -> float:
    """用 ffprobe 读音频真实时长（秒）。"""
    out = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', str(path),
    ], text=True).strip()
    return float(out)


def make_silence(path: Path, seconds: float) -> None:
    """生成一段 24kHz 单声道 PCM 静音，用于句间停顿。"""
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-f', 'lavfi',
        '-i', 'anullsrc=r=24000:cl=mono', '-t', str(seconds),
        '-c:a', 'pcm_s16le', str(path),
    ], check=True)


def concat_audio(parts: list[Path], out: Path) -> None:
    """拼接分段音频：先统一解码为 PCM wav，再编码 mp3。

    直接 concat mp3 流会因各段 metadata/DTS 不一致产生时长偏差（实测累积 0.5s），
    统一到 PCM 时间基后拼接可把误差压到逐帧级别，保证音画同步。
    """
    listing = out.parent / f'{out.stem}.concat.txt'
    wav_tmp = out.parent / f'{out.stem}.joined.wav'
    listing.write_text(''.join(f"file '{p.resolve()}'\n" for p in parts), encoding='utf-8')
    # 各段已是统一 PCM，直接 concat 到 wav
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
        '-i', str(listing), '-c', 'copy', str(wav_tmp),
    ], check=True)
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-i', str(wav_tmp),
        '-c:a', 'libmp3lame', '-b:a', '96k', str(out),
    ], check=True)
    listing.unlink(missing_ok=True)
    wav_tmp.unlink(missing_ok=True)


def build_narration(item: dict) -> tuple[list[str], list[dict]]:
    """生成旁白句子序列 + 场景剧本（不含时间）。"""
    sentences: list[str] = []
    scenes: list[dict] = []

    def add_scene(kind: str, title: str, narration: list[str], **extra):
        scenes.append({'kind': kind, 'title': title, 'narration': narration, **extra})

    # 1. 钩子
    add_scene('hook', item['headline'],
              [item['headline'].replace('"', ''), item['question']],
              body=item.get('summary', ''))

    # 2. 现象叙事
    story_lines = split_sentences(item['summary'])
    add_scene('story', '这件事真的发生了', story_lines, body=item['summary'])

    # 3. 公式
    add_scene('formula', '数学从哪里进来',
              [f"这件事背后的数学，是{item['concept']}。", '先看这个式子。'],
              formula=clean_formula(item['formula']), body=item['formula_note'])

    # 4. 三步推导
    step_titles = [re.sub(r'^\s*\d+\s*[·.、]\s*', '', s['title']) for s in item['steps']]
    step_lines: list[str] = []
    for s in item['steps']:
        step_lines.extend(split_sentences(s['body'])[:2])
    add_scene('steps', '一步步看明白', step_lines[:6], items=step_titles)

    # 4.5 题材专属可视化：让核心数学本身成为画面，而不是靠通用特效堆砌
    topic_text = item['headline'] + item['summary'] + ' '.join(item.get('tags', []))
    if any(k in topic_text for k in ('同步', '耦合', '振子', '整齐', '一致')):
        add_scene('sync', '从混乱到整齐，只差一个「耦合」',
                  ['把每台机器人看成一个振子。', '一开始各走各的，加上耦合之后，慢慢就齐了。'])
    elif any(k in topic_text for k in ('举重', '幂律', '尺度律', '体重分级')):
        # 体育/幂律：不同体型的人举杠铃，让 2/3 次方看得见
        add_scene('lifting', '体型涨得比力量快',
                  ['肌肉力量随横截面积增长，体重却随体积增长。',
                   '一个按长度的平方，一个按长度的立方，所以指数是三分之二。'])
    elif any(k in topic_text for k in ('径向速度', '伴星', '三合星', '多普勒', '轨道')):
        # 开场镜头：一个占据画面的真实星球（纯视觉，让第一印象就是"物体"而非文字）
        add_scene('cosmic-intro', '28 光年外，有一个看不见的世界',
                  ['距地球二十八光年，有一对普通又不普通的恒星。'])
        # 天文：双星绕质心运动 + 径向速度波形实时描绘
        add_scene('orbit', '看不见的伴星，藏在一条正弦曲线里',
                  ['红矮星绕着共同质心，画出一条小小的圆。',
                   '我们从地球看出去，它的速度一会儿朝前、一会儿朝后，正好是一个正弦波。'])
        add_scene('wavefit', '从噪声里，把正弦波"称"出来',
                  ['把望远镜测到的速度点画出来。',
                   '拟合出振幅和周期，就能反推那颗看不见的伴星有多重。'])

    # 5. 结论
    add_scene('insight', item['insight'], split_sentences(item['insight'])[:2])

    # 6. 思考题 + 片尾
    add_scene('question', item['try_it']['text'], [item['try_it']['text']])
    add_scene('end', '数学，就在你身边', ['这一期就到这里。'])

    for sc in scenes:
        sentences.extend(sc['narration'])
    return sentences, scenes


def to_pcm(source: Path, wav_path: Path) -> None:
    """把任意音频统一转成 24kHz 单声道 PCM，便于按采样数精确计时。"""
    if wav_path.exists():
        return
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-i', str(source),
        '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', str(wav_path),
    ], check=True)


def wav_duration(path: Path) -> float:
    """按 PCM 数据大小精确计算时长（24000Hz, 16bit, mono）。"""
    # wav 头 44 字节（ffmpeg 标准输出），数据区字节数 / (24000*2)
    data_bytes = path.stat().st_size - 44
    return data_bytes / (24000 * 2)


def synthesize_segment(sentence: str, voice: str, mp3_path: Path, words_path: Path) -> list[dict]:
    """合成单句并捕获词级边界（Edge TTS WordBoundary 事件）。"""
    import edge_tts

    words: list[dict] = []
    comm = edge_tts.Communicate(sentence, voice, boundary='WordBoundary')

    async def run():
        with open(mp3_path, 'wb') as f:
            async for chunk in comm.stream():
                if chunk['type'] == 'audio':
                    f.write(chunk['data'])
                elif chunk['type'] == 'WordBoundary':
                    words.append({
                        'text': chunk['text'],
                        'start': round(chunk['offset'] / 1e7, 3),
                        'end': round((chunk['offset'] + chunk['duration']) / 1e7, 3),
                    })

    asyncio.run(run())
    words_path.write_text(json.dumps(words, ensure_ascii=False), encoding='utf-8')
    return words


def synthesize_segments(sentences: list[str], voice: str, cache_dir: Path):
    """逐句合成 -> 词边界 + 统一 PCM -> 按采样数读取真实时长。

    返回 [(wav路径, 时长, 词边界列表)]。词边界来自 TTS 实测事件，
    不是按字数均摊；画面可据此把高亮/切换卡在词被读到的瞬间。
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for i, sentence in enumerate(sentences):
        key = hashlib.sha256(f'{sentence}|{voice}'.encode('utf-8')).hexdigest()[:16]
        mp3_path = cache_dir / f'seg-{i:02d}-{key}.mp3'
        wav_path = cache_dir / f'seg-{i:02d}-{key}.wav'
        words_path = cache_dir / f'seg-{i:02d}-{key}.words.json'
        if words_path.exists():
            words = json.loads(words_path.read_text(encoding='utf-8'))
        else:
            words = synthesize_segment(sentence, voice, mp3_path, words_path)
        to_pcm(mp3_path, wav_path)
        results.append((wav_path, wav_duration(wav_path), words))
    return results


def build_timeline(sentences: list[str], scenes: list[dict], segments):
    """用真实分段时长累加时间轴，字幕、场景、旁白三者严格对齐。"""
    captions = []
    clock = 0.0
    for i, (sentence, (_, dur, words)) in enumerate(zip(sentences, segments)):
        # 词边界从 TTS 实测事件换算到全片绝对时间
        abs_words = [
            {'text': w['text'], 'start': round(clock + w['start'], 3),
             'end': round(clock + w['end'], 3)}
            for w in words
        ]
        captions.append({
            'start': round(clock, 3),
            'end': round(clock + dur, 3),
            'text': sentence,
            'segment': i,
            'words': abs_words,  # 词级时间戳，供画面精确同步
        })
        # 只有非最后一句才跟一个 GAP，与拼接音频保持一致
        if i < len(segments) - 1:
            clock += dur + GAP
        else:
            clock += dur

    timed_scenes = []
    idx = 0
    for sc in scenes:
        n = len(sc['narration'])
        seg = captions[idx:idx + n]
        idx += n
        if not seg:
            continue
        timed = {k: v for k, v in sc.items() if k != 'narration'}
        timed['start'] = seg[0]['start']
        timed['end'] = seg[-1]['end']
        timed_scenes.append(timed)

    return timed_scenes, captions, clock


def seconds_to_vtt(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('hotspot_id', help='热点内容 id')
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural', help='Edge TTS 音色')
    ap.add_argument('--skip-audio', action='store_true', help='沿用分段缓存，仅重建时间轴')
    ap.add_argument('--mixed-audio', default='', help='混音后的音轨文件名（BGM+旁白），指定后写入 script')
    args = ap.parse_args()

    items = json.loads(HOTSPOTS.read_text(encoding='utf-8'))
    item = next((it for it in items if it['id'] == args.hotspot_id), None)
    if not item:
        print(f'FAIL: 未找到热点 {args.hotspot_id}')
        return 1

    sentences, scenes = build_narration(item)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    cache_dir = AUDIO_DIR / item['id']
    audio_path = AUDIO_DIR / f'{item["id"]}.mp3'

    if args.skip_audio:
        # 沿用缓存：按同样规则找已存在的分段文件
        import edge_tts  # noqa: F401  仅为确保依赖存在
        segments = []
        for i, sentence in enumerate(sentences):
            key = hashlib.sha256(f'{sentence}|{args.voice}'.encode('utf-8')).hexdigest()[:16]
            seg_path = cache_dir / f'seg-{i:02d}-{key}.wav'
            words_path = cache_dir / f'seg-{i:02d}-{key}.words.json'
            if not seg_path.exists() or not words_path.exists():
                print(f'FAIL: 缺少分段缓存，请去掉 --skip-audio 重新合成')
                return 1
            segments.append((seg_path, wav_duration(seg_path),
                             json.loads(words_path.read_text(encoding='utf-8'))))
        print(f'沿用 {len(segments)} 段已合成旁白')
    else:
        print(f'逐句合成旁白：{len(sentences)} 段 …')
        segments = synthesize_segments(sentences, args.voice, cache_dir)
        # 拼接：音频段 + 句间静音
        silence = cache_dir / 'gap.wav'
        make_silence(silence, GAP)
        parts: list[Path] = []
        for i, (seg_path, _, _) in enumerate(segments):
            parts.append(seg_path)
            if i < len(segments) - 1:
                parts.append(silence)
        concat_audio(parts, audio_path)
        print(f'拼接完成：{audio_path.name}')

    timed_scenes, captions, total = build_timeline(sentences, scenes, segments)
    audio_duration = probe_duration(audio_path) if audio_path.exists() else total

    # 一致性校验：拼接音频时长必须与时间轴累加一致（容差 0.15s）
    if abs(audio_duration - total) > 0.15:
        print(f'WARN: 音频时长 {audio_duration:.2f}s 与时间轴 {total:.2f}s 有偏差，以时间轴为准')

    script = {
        'id': item['id'],
        'headline': item['headline'],
        'branch': BRANCH_LABELS.get(item['branch'], item['branch']),
        'category': item['category'],
        'duration': round(total + 0.5, 3),
        'fps': FPS,
        # 混音音轨优先；否则用纯旁白（兼容旧流程）
        'audio': args.mixed_audio or audio_path.name,
        'narration': audio_path.name,
        # 音乐与画面共用卡点：场景边界即节拍落点
        'cues': [
            {'t': round(sc['start'], 3), 'kind': sc['kind']}
            for sc in timed_scenes
        ],
        'captions': captions,
        'scenes': timed_scenes,
        'accent': '#E0764A' if item.get('category') == '天文' else '#9C3B2E',
        'visualTheme': 'space' if item.get('category') == '天文' else 'paper',
        'alignment': 'tts-segments',
    }
    SCRIPT_OUT.write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding='utf-8')

    # VTT 用真实时间戳（最后一句的 end 用其分段时长，不含尾部 GAP）
    vtt_path = AUDIO_DIR / f'{item["id"]}.vtt'
    lines = ['WEBVTT', '']
    for i, c in enumerate(captions, 1):
        lines += [str(i), f'{seconds_to_vtt(c["start"])} --> {seconds_to_vtt(c["end"])}', c['text'], '']
    vtt_path.write_text('\n'.join(lines), encoding='utf-8')

    # 抽查前 3 段真实时长，便于确认时间轴来自实测
    preview = ' '.join(f'{d:.2f}s' for _, d, _ in segments[:3])
    word_total = sum(len(c.get('words', [])) for c in captions)
    print(f'OK: 时间轴 {total:.1f}s / 音频 {audio_duration:.1f}s / {len(captions)} 条字幕')
    print(f'    场景 {len(timed_scenes)} 个，词级时间戳 {word_total} 个，前3段真实时长: {preview}')
    print(f'    script -> {SCRIPT_OUT}')
    print(f'    audio  -> {audio_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
