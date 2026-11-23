#!/usr/bin/env python3
"""视频质量 Evaluator —— 自动层（技术 + 静帧像素检查）。

输出结构化 JSON 报告，PASS/FAIL 由客观指标决定，不含主观审美判断。
AI 视觉评估（内容/构图/张力）见 EVALUATION.md，由自动化里的 Evaluator 角色执行。

用法:
  python3 video/scripts/evaluate_video.py <video.mp4> \
      [--script video/src/script.json] [--stills-dir video/out/check-<id>] \
      [--out video/out/eval-report.json]

检查项:
  技术: 时长对齐、音视频双流、编码、分辨率、帧率、音量、真峰值、黑帧
  静帧: 文件齐全、尺寸正确、非全黑、安全区无明显溢出、亮度对比合理
"""
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

# 安全区：文字/公式不应贴边。距边缘 36px 内出现大面积高亮块视为疑似溢出。
SAFE_MARGIN = 36
# 边缘高亮块的判定：像素亮度 > 阈值、且在边缘带占据一定比例
EDGE_BRIGHT_THRESHOLD = 190
EDGE_RATIO_WARN = 0.020
# 全黑帧判定：平均亮度 < 阈值
BLACK_MEAN_THRESHOLD = 12


def run(cmd: list[str]) -> str:
    # volumedetect/blackdetect 的诊断信息都走 stderr，必须合并
    r = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return r.stdout + '\n' + r.stderr


def probe_json(path: Path) -> dict:
    out = subprocess.run([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path),
    ], capture_output=True, text=True, check=False)
    if out.returncode != 0 or not out.stdout.strip():
        return {}
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        return {}


def check(label: str, ok: bool, detail: str, severity: str = 'error') -> dict:
    return {'label': label, 'pass': bool(ok), 'detail': detail, 'severity': severity}


def evaluate_technical(video: Path, script: dict | None) -> list[dict]:
    results: list[dict] = []
    info = probe_json(video)
    if not info:
        return [check('视频可解析', False, 'ffprobe 无法读取文件')]

    streams = info.get('streams', [])
    v = next((s for s in streams if s.get('codec_type') == 'video'), None)
    a = next((s for s in streams if s.get('codec_type') == 'audio'), None)
    results.append(check('视频流存在', v is not None,
                         f"codec={v.get('codec_name')}" if v else '无视频流'))
    results.append(check('音频流存在', a is not None,
                         f"codec={a.get('codec_name')}" if a else '无音频流'))

    if v:
        w, h = v.get('width', 0), v.get('height', 0)
        results.append(check('分辨率 1280x720', w == 1280 and h == 720, f'{w}x{h}'))
        rate = v.get('r_frame_rate', '0/1')
        try:
            num, den = rate.split('/')
            fps = float(num) / float(den) if float(den) else 0
        except (ValueError, ZeroDivisionError):
            fps = 0
        results.append(check('帧率 30fps', abs(fps - 30) < 0.5, f'{fps:.2f}'))

    dur = float(info.get('format', {}).get('duration', 0) or 0)
    if script:
        expect = float(script.get('duration', 0))
        delta = abs(dur - expect)
        results.append(check('时长与脚本对齐', delta <= 0.3,
                             f'视频 {dur:.2f}s / 脚本 {expect:.2f}s / 偏差 {delta:.2f}s'))
    else:
        results.append(check('时长有效', dur > 1, f'{dur:.2f}s'))

    # 响度：volumedetect（mean_volume 非 -inf，峰值不削波）
    vd = run(['ffmpeg', '-hide_banner', '-i', str(video), '-af', 'volumedetect', '-f', 'null', '-'])
    mean = re.search(r'mean_volume:\s*(-?[\d.]+|-\s*inf)', vd)
    peak = re.search(r'max_volume:\s*(-?[\d.]+|-\s*inf)', vd)
    mean_v = -99.0 if not mean or 'inf' in mean.group(1) else float(mean.group(1))
    peak_v = -99.0 if not peak or 'inf' in peak.group(1) else float(peak.group(1))
    results.append(check('音轨非静音', mean_v > -60, f'mean {mean_v:.1f} dB',
                         'error'))
    results.append(check('无削波', peak_v < 0, f'peak {peak_v:.1f} dB'))

    # 黑帧检测：ffmpeg blackdetect，容忍开头/结尾极短黑场
    bd = run([
        'ffmpeg', '-hide_banner', '-i', str(video), '-vf',
        'blackdetect=d=0.6:pix_th=0.10', '-an', '-f', 'null', '-',
    ])
    blacks = re.findall(r'black_start:([\d.]+).*?black_duration:([\d.]+)', bd)
    long_blacks = [(float(s), float(d)) for s, d in blacks if float(d) >= 1.0]
    results.append(check('无异常黑屏段', not long_blacks,
                         f'发现 {len(long_blacks)} 段 >=1s 黑屏' if long_blacks else '未发现长黑屏'))
    return results


def analyze_still(path: Path) -> tuple[bool, str, dict]:
    """像素级静帧检查。返回 (pass, detail, metrics)。"""
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return True, 'PIL/numpy 不可用，跳过像素检查', {'skipped': True}

    with Image.open(path) as im:
        im = im.convert('RGB')
        w, h = im.size
        arr = np.asarray(im).astype(np.float32)

    luminance = arr @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mean_l = float(luminance.mean())
    if mean_l < BLACK_MEAN_THRESHOLD:
        return False, f'画面几乎全黑（平均亮度 {mean_l:.1f}）', {'mean_luminance': mean_l}

    # 安全区：四个边缘带内"接近白/高饱和亮"像素占比
    m = SAFE_MARGIN
    bands = np.concatenate([
        luminance[:m, :].ravel(),
        luminance[-m:, :].ravel(),
        luminance[:, :m].ravel(),
        luminance[:, -m:].ravel(),
    ])
    bright_ratio = float((bands > EDGE_BRIGHT_THRESHOLD).mean())
    # 注：深空主题边缘有星点，但星点小且暗，不会拉高 >190 的占比
    metrics = {
        'mean_luminance': round(mean_l, 1),
        'edge_bright_ratio': round(bright_ratio, 4),
        'size': f'{w}x{h}',
    }
    if bright_ratio > EDGE_RATIO_WARN:
        return False, (f'边缘高亮像素占比 {bright_ratio:.3%} 超过阈值 '
                       f'{EDGE_RATIO_WARN:.1%}，疑似文字/公式溢出安全区'), metrics
    return True, f'亮度 {mean_l:.1f}、边缘高亮 {bright_ratio:.2%}', metrics


def evaluate_stills(stills_dir: Path, expected_kinds: list[str]) -> list[dict]:
    results: list[dict] = []
    if not stills_dir.exists():
        return [check('静帧目录存在', False, f'不存在: {stills_dir}')]
    for kind in expected_kinds:
        path = stills_dir / f'{kind}.png'
        if not path.exists():
            results.append(check(f'静帧 {kind}', False, '文件缺失'))
            continue
        ok, detail, _ = analyze_still(path)
        results.append(check(f'静帧 {kind}', ok, detail, 'warning' if not ok and '边缘' in detail else 'error'))
    return results


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('video', help='待评估 MP4')
    ap.add_argument('--script', default='', help='script.json（校验时长对齐）')
    ap.add_argument('--stills-dir', default='', help='静帧目录')
    ap.add_argument('--out', default='', help='报告输出 JSON 路径')
    args = ap.parse_args()

    video = Path(args.video)
    if not video.exists():
        print(f'FAIL: 视频不存在 {video}', file=sys.stderr)
        return 2

    script = None
    if args.script and Path(args.script).exists():
        script = json.loads(Path(args.script).read_text(encoding='utf-8'))

    expected = [k for k in (['hook', 'formula', 'insight', 'end'] if script else [])]
    if script:
        for sc in script.get('scenes', []):
            k = sc.get('kind')
            if k and k not in expected:
                expected.append(k)

    checks = evaluate_technical(video, script)
    if args.stills_dir:
        checks += evaluate_stills(Path(args.stills_dir), expected)

    errors = [c for c in checks if not c['pass'] and c['severity'] == 'error']
    warnings = [c for c in checks if not c['pass'] and c['severity'] == 'warning']
    passed = not errors

    report = {
        'video': str(video),
        'decision': 'PASS' if passed else 'FAIL',
        'layer': 'automated',
        'summary': {
            'total': len(checks),
            'passed': sum(1 for c in checks if c['pass']),
            'failed': len(errors),
            'warnings': len(warnings),
        },
        'checks': checks,
        'note': '本层只判定客观指标；内容/构图/视觉张力由 AI 层评估（见 EVALUATION.md）',
    }

    out_path = Path(args.out) if args.out else video.parent / f'{video.stem}.eval.json'
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f"{'PASS' if passed else 'FAIL'} 自动评估: "
          f"{report['summary']['passed']}/{report['summary']['total']} 通过，"
          f"{len(warnings)} 警告 → {out_path}")
    for c in errors:
        print(f'  FAIL {c["label"]}: {c["detail"]}')
    for c in warnings:
        print(f'  WARN {c["label"]}: {c["detail"]}')
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
