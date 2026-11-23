#!/bin/bash
# 为热点视频生成配乐并混入旁白。
# 用法: bash video/scripts/build_audio.sh <hotspot_id>
# 依赖: node (合成器)、ffmpeg、ffprobe；需先 pip install edge-tts
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VIDEO="$ROOT/video"
AID="${1:?用法: build_audio.sh <hotspot_id>}"
AUDIO="$VIDEO/public/audio"

echo '=== 1. 从脚本生成音乐时间轴（画面与音乐共用卡点）==='
python3 - "$ROOT" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
script = root / 'video/src/script.json'
s = json.loads(script.read_text(encoding='utf-8'))
timeline = {
    'DUR': s['duration'] + 0.5,
    'BPM': 92,
    'cues': [{'t': round(sc['start'], 3), 'kind': sc['kind']} for sc in s['scenes']],
}
(root / 'video/timeline.json').write_text(json.dumps(timeline, indent=2), encoding='utf-8')
print(f"  {timeline['DUR']:.1f}s, {len(timeline['cues'])} 个卡点")
PY

echo '=== 2. 程序化生成 BGM（D大调/92BPM，人声侧链让位）==='
cd "$VIDEO/audio-tools"
node audio.mjs build "$VIDEO/score.mjs" --out "$AUDIO/$AID.bgm.wav" 2>&1 | tail -2
cd "$ROOT"

echo '=== 3. 混音：BGM 在人声出现时自动压低 ==='
VOICE="$AUDIO/$AID.mp3"
BGM="$AUDIO/$AID.bgm.wav"
FINAL="$AUDIO/$AID.final.m4a"
ffmpeg -y -v error -i "$VOICE" -i "$BGM" \
  -filter_complex "[1:a]volume=0.38[bgm];[0:a]asplit=2[voice][key];[bgm][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[ducked];[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[out]" \
  -map "[out]" -ar 48000 -ac 2 -c:a aac -b:a 192k "$FINAL"

echo '=== 4. 把混音音轨写回脚本 ==='
python3 video/scripts/build_video.py "$AID" --skip-audio --mixed-audio "$AID.final.m4a" 2>&1 | tail -3
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$FINAL")
echo "完成: $FINAL (${DUR}s)"
