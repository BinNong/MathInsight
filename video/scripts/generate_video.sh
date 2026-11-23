#!/bin/bash
# 数说热点视频一键生成（对应 WORKFLOW.md 第 1-5 步）。
#
# 用法:
#   bash video/scripts/generate_video.sh <hotspot_id> [--stills-only] [--render-only] [--out <file>]
#
#   --stills-only  只生成旁白/BGM/混音 + 静帧检查图，不渲染全片（先检查用）
#   --render-only  跳过旁白/BGM，直接渲染全片（静帧已检查通过后用）
#   --out <file>   指定输出 MP4 路径
#
# 流程: 旁白+词级时间轴 → BGM+混音 → 静帧检查 → 全片渲染 → 产物校验
# 服务器上传与数据回写由平台自动化执行（见 WORKFLOW.md 第 7 节）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VIDEO="$ROOT/video"
AID="${1:?用法: generate_video.sh <hotspot_id> [--stills-only|--render-only]}"
shift

STILLS_ONLY=0
RENDER_ONLY=0
OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stills-only) STILLS_ONLY=1; shift ;;
    --render-only) RENDER_ONLY=1; shift ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

OUT="${OUT:-$VIDEO/out/${AID}.mp4}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHECK_DIR="$VIDEO/out/check-$AID"
mkdir -p "$CHECK_DIR"

cd "$ROOT"

if [[ $RENDER_ONLY -eq 0 ]]; then
  echo '════ 1/5 旁白 + 实测时间轴（逐句 TTS + 词边界）════'
  python3 video/scripts/build_video.py "$AID" 2>&1 | tail -4

  echo '════ 2/5 BGM + 混音（人声 ducking）════'
  bash video/scripts/build_audio.sh "$AID" 2>&1 | tail -7

  echo '════ 3/5 静帧检查图（渲染前必看 WORKFLOW.md 第 4 节）════'
  # 从脚本算出每类场景的帧位：场景起点 + 中点偏移，避开 BeatFX 开头高潮
  python3 - "$ROOT" "$CHECK_DIR" <<'PY'
import json, subprocess, sys
from pathlib import Path
root, outdir = Path(sys.argv[1]), Path(sys.argv[2])
s = json.loads((root/'video/src/script.json').read_text(encoding='utf-8'))
fps = s['fps']
# 每种场景取一个代表帧：中点；公式场景额外偏移 50 帧避开冲击波
seen = {}
for sc in s['scenes']:
    k = sc['kind']
    if k in seen: continue
    seen[k] = True
    off = 50 if k == 'formula' else max(20, int((sc['end']-sc['start'])*fps*0.5))
    fr = min(int(sc['end']*fps) - 6, int(sc['start']*fps) + off)
    subprocess.run([
        'npx', 'remotion', 'still', 'HotspotExplainer',
        str(outdir / f'{k}.png'), '--frame', str(fr), '--concurrency=1',
        '--browser-executable=' + '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ], cwd=str(root/'video'), check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f'  {k}: frame {fr}')
PY

  echo ''
  echo '  ⚠️  必须查看以上静帧，确认：文字/公式无溢出、物体具象、无重叠。'
  echo '  检查清单见 video/WORKFLOW.md 第 4 节。不通过则修组件后重跑 --stills-only。'
  echo '  静帧目录:' "$CHECK_DIR"
  echo ''

  if [[ $STILLS_ONLY -eq 1 ]]; then
    echo '✓ --stills-only：已生成静帧，停止。'
    exit 0
  fi

  # 自动化模式（非交互）下默认继续；人工使用时可在此处 Ctrl+C 停下检查
  echo '  继续渲染全片...'
fi

echo '════ 4/5 全片渲染 ════'
cd "$VIDEO"
npx remotion render HotspotExplainer "$OUT" --concurrency=2 \
  --browser-executable="$CHROME" --codec=h264 2>&1 | tail -3

echo '════ 5/5 产物校验 ════'
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
STREAMS=$(ffprobe -v error -show_entries stream=codec_type -of csv=p=0 "$OUT" | tr '\n' ',')
VOL=$(ffmpeg -hide_banner -i "$OUT" -af volumedetect -f null - 2>&1 | grep mean_volume | head -1 | sed 's/.*mean_volume: //')
SCRIPT_DUR=$(python3 -c "import json; print(json.load(open('$VIDEO/src/script.json'))['duration'])")
SIZE=$(du -h "$OUT" | cut -f1)

# 失败即退出，避免带病产物进入上传环节
python3 - "$DUR" "$SCRIPT_DUR" "$STREAMS" <<'PY'
import sys
dur, script_dur, streams = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
errs = []
if abs(dur - script_dur) > 0.2:
    errs.append(f'时长偏差过大: 视频 {dur}s vs 脚本 {script_dur}s')
if 'video' not in streams: errs.append('缺少视频流')
if 'audio' not in streams: errs.append('缺少音频流')
if errs:
    print('FAIL: ' + '; '.join(errs), file=sys.stderr)
    sys.exit(1)
print('  ✓ 时长/音视频流校验通过')
PY

echo "  时长: ${DUR}s (脚本 ${SCRIPT_DUR}s)"
echo "  流: ${STREAMS}"
echo "  音量: ${VOL}"
echo "  大小: ${SIZE}"
echo ''
echo "✓ 成片: $OUT"
echo "  下一步（平台自动化）: 上传数据卷 + 回写 video 字段，见 WORKFLOW.md 第 7 节"
