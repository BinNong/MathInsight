# 数说热点 · 科普视频渲染器

把一篇数说热点解读自动变成 **2–3 分钟带中文旁白 + 烧录字幕的科普视频**。
离线生产：每周内容更新时生成 MP4，作为静态资源上传，服务器只负责播放。

## 技术栈

- **Remotion 4**（React 组件逐帧渲染，视频即代码）
- **Edge TTS**（微软免费中文语音，zh-CN-XiaoxiaoNeural 等 8 个音色）
- **KaTeX**（公式渲染，与站点一致）
- **ffmpeg / ffprobe**（音频时长探测、视频编码）
- **动画效果**：`src/fx/` 下的活背景/镜头/转场工具改编自开源项目 fy-code-animation，见该目录 README

> 注意：TypeScript 必须锁在 5.x（Remotion 4 的 esbuild loader 不兼容 TS 7）。

## v2 动画增强（2026-11-23）

相比初版的"文字淡入 + 静态排版"，v2 加入了：

- **活背景**：推导/步骤场景用流场（FlowField）表现"变化流动"；其他场景用漂浮粒子（ParticleAtmosphere）；钩子/结论场景叠加从中心扩散的点阵波（DotGrid）；阅读区自动压低背景亮度
- **镜头运动**：钩子与结论场景缓慢推近（1.02→1.07），其余场景锁镜不干扰阅读
- **场景转场**：钩子用圆形 iris 入场，公式/步骤用对角线网格擦除（gridMask）
- **逐句推进**：画面正文不再一次性堆满，而是随旁白逐句浮现（最多同时显示 2 句），字幕与画面文字严格同步
- **高亮与光扫**：公式/结论场景有一次斜向光扫；文字里的【关键词】做下划线生长高亮
- **图表动效**：柱状图逐条错峰生长，峰值数字滚动计数

具体效果可从 `out/v2-*.png`、`out/anim-*.png` 静帧查看。

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

## 时间轴对齐原理（v3：逐句实测 + 词级同步）

借鉴 [motion-showreel](https://github.com/ConardLi/garden-skills/tree/main/skills/motion-showreel) 的 voice-led timing：
**画面与声音共用一条时间轴，禁止按字数猜时间。**

1. 从热点内容抽取旁白句（headline / summary / steps / insight / try_it），不新编事实。
2. **逐句**用 Edge TTS 合成（`boundary='WordBoundary'`），同时捕获**词级边界事件**（实测 offset/duration，单位 100ns）。
3. 每段转成 24kHz 单声道 PCM，按采样数精确计算时长（避免 mp3 编码延迟的累积误差）。
4. 拼接 PCM → mp3；时间轴按各段真实时长 + 句间静音（0.28s）**累加**，最后一句不加间隔——实测时间轴与最终音频零偏差。
5. 词边界换算成全片绝对时间写进 `script.json` 的 `captions[].words`。
6. Remotion 用同一 props 渲染：字幕逐词卡拉OK高亮、画面关键词在词被读到时高亮、场景边界对齐句段时间。三者严格同步。

`script.json` 里 `alignment: "tts-segments"` 标明时间轴来源；`words` 数组是 TTS 实测词边界，不是均摊估算。

### 为什么不用整段合成 + 字数估算

初版就是这么做的：整段 TTS → 按字数权重反推每句时间。实测会与真实语速偏差数秒，越到后面漂移越大——这正是"音画不同步"的根因。v3 改成逐句实测后消除。

### 公式排版防溢出（重要）

长公式（如三合星那条带 `\qquad` 的）用 displayMode 单行渲染会**溢出 1280px 画幅被截断**。现行方案：

- 按 `\qquad` 拆成多行，每行单独 KaTeX 渲染
- 字号按"可见字符数"逐行自适应（去掉 LaTeX 命令名/花括号后估算），范围 24–40px
- 卡片 `overflow: visible` + 行高 1.15，让内容自然撑开；不要在卡片上设固定高度或 `overflow: hidden`（会裁掉下半行）
- 公式场景**不显示正文 liveLines**——字幕条已承担讲解，重复会与卡片底部重叠
- 已知视觉现象：场景开头 0–0.18s 是 BeatFX 冲击波+粒子爆发的高潮，会短暂盖住公式，这是刻意的转场效果，取特效过后的帧检查排版

### 视觉张力原则（v5，重要）

用户反馈"太藏着掖着"后确立的方向：**画面要有存在感，不要怕占空间**。

- 主体物体要**大**：开场星球半径 178px（几乎占满右半画面），轨道场景星球 60px；不要缩在角落当配图
- 光效要**张扬**：日冕喷发、十字星芒、多层辉光、引力涟漪、运动拖尾、表面耀斑；辉光用 CSS 渐变铺满容器，**不要画超出 SVG viewBox 的大圆**（会被裁成矩形色块）
- 镜头要**运动**：开场缓慢推近（scale 1.0→1.16），星球自转纹理横移
- 卡点要**更狠**：闪光强度 0.38、冲击波半径 1100px、粒子 44 个（大转折）
- 文字要让位：物体是主角，文字是注解；物体镜头里文字压到底部，不盖住画面

### 题材专属视觉（v4.1）

不同题材用不同视觉基调与专属动画，不硬套一种风格：

- **天文题材**（`visualTheme: 'space'`）：深空配色 + 密集星场 + 星云流场；专属 `orbit` 场景画双星绕质心运动与径向速度正弦波实时描绘（红蓝移对应速度方向），`wavefit` 场景把观测噪声点逐帧拟合成正弦曲线——把"从摆动反推质量"直接变成画面
- **同步题材**：`sync` 场景让 16 个振子从混乱相位逐渐收敛成整齐同步波，带实时同步度
- 场景由 `build_video.py` 按题材关键词自动插入，其他文章不会被硬套

### 分段缓存

`public/audio/<id>/seg-NN-*.wav` 与 `.words.json` 是分段缓存，改一句话只重做该段；`--skip-audio` 可沿用缓存只重建时间轴。

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
