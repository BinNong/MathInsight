# 数说热点 · 科普视频渲染器

把一篇数说热点解读自动变成 **2–3 分钟带中文旁白 + 烧录字幕的科普视频**。
离线生产：每周内容更新时生成 MP4，作为静态资源上传，服务器只负责播放。

## 技术栈

- **Remotion 4**（React 组件逐帧渲染，视频即代码）
- **Edge TTS**（微软免费中文语音，zh-CN-XiaoxiaoNeural 等 8 个音色）
- **KaTeX**（公式渲染，与站点一致）
- **ffmpeg / ffprobe**（音频时长探测、视频编码）

## 目录

```
video/
├── src/
│   ├── HotspotExplainer.tsx   # 主合成：场景序列 + 音轨 + 字幕 + 进度条
│   ├── Scene.tsx              # 7 种场景：hook/story/formula/steps/insight/question/end
│   ├── Caption.tsx            # 烧录字幕
│   ├── theme.ts               # 站点视觉体系（纸张/学术红）
│   ├── types.ts               # 脚本数据结构
│   ├── Root.tsx               # Remotion 合成注册
│   └── script.json            # 由 build_video.py 生成（当前视频的时间轴）
├── public/audio/<id>.mp3|.vtt # 旁白与外挂字幕
├── scripts/build_video.py     # 热点 JSON → 旁白 + 时间轴脚本
├── out/                       # 渲染产物（MP4 / 静帧）
└── package.json
```

## 用法

### 1. 生成某篇热点视频的脚本与旁白

```bash
python3 video/scripts/build_video.py hot-20261117-robot-sync
# 换音色：--voice zh-CN-YunxiNeural
# 沿用已有音频只重建时间轴：--skip-audio
```

产出：
- `video/public/audio/<id>.mp3` —— Edge TTS 合成的中文旁白
- `video/public/audio/<id>.vtt` —— 外挂字幕（复核用）
- `video/src/script.json` —— Remotion 时间轴（场景、字幕、音频时长）

### 2. 渲染前先出静帧检查（开源 skill 强调的闭环）

```bash
cd video
npx remotion still HotspotExplainer out/f-hook.png --frame=150 --concurrency=1 \
  --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

检查：文字无溢出、无字体方块、公式正确、字幕在安全区。**确认后再编码。**

### 3. 渲染完整视频

```bash
npx remotion render HotspotExplainer out/<name>.mp4 --concurrency=2 \
  --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --codec=h264
```

> 注：本机 Chrome 已安装，需指定 `--browser-executable`；内存受限时用 `--concurrency=1`。

## 时间轴对齐原理

1. 从热点内容抽取旁白句（headline / summary / steps / insight / try_it），不新编事实。
2. Edge TTS 合成整段旁白 → `ffprobe` 读**真实音频时长**。
3. 按每句字数加停顿作为权重，把真实时长分配到各句 → 字幕时间轴。
4. 场景按其旁白句所占时间确定起止 → 场景序列。
5. Remotion 用同一 props 渲染音轨、场景、烧录字幕，三者天然同步，不会漂移。

## 内容边界（与 HOTSPOT_GUIDE 一致）

- 旁白只复述热点内容里的既有事实与数学解释，不新增未经核实的断言。
- 数值沿用原文已实算的结果；示意数据照原样标注。
- 平台本身只播放成品视频，不提供用户在线生成入口（避免长任务与成本风险）。

## 双通道内容架构（重要）

平台的「数说热点」有两条生产通道，职责不同：

| 通道 | 跑在哪 | 负责 |
|---|---|---|
| **容器内调度器**（`backend/app/services/hotspot_scheduler.py`） | 线上 Docker（每周一三五 09:00） | 抓新闻 → LLM 写骨架 → 配方实算 → 写文章到数据卷 |
| **外部 automation**（WorkBuddy 定时任务，每周一三五 09:30） | 本机 | 巡检平台是否正常；异常时兜底发文；**为新文章生成视频并上传** |

**视频只能由外部 automation 生成**——线上容器是 Python slim 镜像，没有 Node 与 Chrome，无法跑 Remotion。

每周流程：容器内 09:00 出文章 → 外部 09:30 巡检发现新文章且无 `video` 字段 → 本机跑 `build_video.py` + Remotion 渲染 → 上传 MP4 到数据卷 → 给热点条目加 `video` 字段。

## 与平台集成

渲染好的 MP4 上传到服务器数据卷，热点内容加 `video` 字段后，详情页出现播放器：

```bash
# 上传视频（约 10-20MB）
SSHPASS='<密码>' sshpass -e scp out/<name>.mp4 ubuntu@nongbin.site:/tmp/<name>.mp4
ssh ubuntu@nongbin.site 'sudo install -o 10001 -g 10001 -m 644 /tmp/<name>.mp4 \
  /var/www/mathinsight/downloads/<name>.mp4'
```

前端 `<video controls>` 播放 `/mathinsight/downloads/<name>.mp4`，可配 `<track>` 外挂字幕。
