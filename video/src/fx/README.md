# 动画效果模块来源

## 音画同步方法（v3）

字幕逐词高亮与"画面跟随语音"的方法论参考了：

- **项目**：[motion-showreel](https://github.com/ConardLi/garden-skills/tree/main/skills/motion-showreel)（ConardLi/garden-skills）
- **借鉴点**：picture and sound share one timeline；逐段合成音频后按真实时长累加时间轴；关键词事件只使用实测词边界，不按字数猜时间
- **本项目实现**：`scripts/build_video.py` 用 Edge TTS 的 `WordBoundary` 事件取词级时间戳；`Caption.tsx` 做逐词卡拉OK高亮；`HotspotExplainer.tsx` 按词边界驱动画面关键词高亮

## 动画工具来源

`video/src/fx/` 下的动画工具改编自开源项目：

- **项目**：[fy-code-animation](https://github.com/Akillll-DuoHe/fy-code-animation)（《俯仰观照》整理与分享）
- **许可**：作者声明可免费使用与分享，但不得包装成付费课程/付费 skills 出售。详见该项目 `LICENSE.md`。
- **移植时间**：2026-11-23
- **移植范围**：
  - `motion-core.mjs` / `motion-core.d.mts` —— 确定性数值工具（clamp/loopPhase/keyedRandom/camera2D 等）
  - `time.ts` —— 帧与时间区间工具（unit/clamp01/smooth）
  - `backgrounds.tsx` —— 活背景：FlowField 流场、ParticleAtmosphere 粒子、DotGrid 点阵波、LightSweep 光扫、Vignette 暗角
  - `camera.tsx` —— CameraRig / cameraPath 镜头路径（本项目只用了 cameraPath 做推近）
  - `transitions.tsx` —— 场景转场：iris / gridMask（本项目用于场景入场遮罩）
- **改动**：调整 import 路径以适配本项目目录结构；调色改为 MathInsight 站点配色（学术红 + 纸张色）；移除了未使用的组件。

第三方来源的原有许可继续有效。本项目为免费开源的教学平台，符合上述使用条件。

## 使用约定

这些工具都遵循 Remotion 的确定性原则：每帧从 `t` 与种子重建画面，不用 `Date.now()` / 无种子 `Math.random()` / 上一帧累加。因此任意帧都能单独渲染、可 seek、可复现——这是"先出静帧检查再编码"质量闭环的前提。
