# 数说热点 · 科普视频生产工作流（平台内化版）

> 这是平台生成视频的**唯一权威流程**。所有参数、踩坑、验收标准都在这里。
> 平台自动化与外部值守任务必须按此执行，不得凭记忆临时发挥。
> 最后更新：2026-11-23（v5 张扬视觉 + 公式防溢出）

---

## 0. 架构约束（为什么这样设计）

| 通道 | 运行环境 | 职责 |
|---|---|---|
| 容器内调度器 `hotspot_scheduler.py` | 线上 Docker（Python slim） | 每周一三五 09:00 抓新闻 → LLM 写骨架 → 配方实算 → 写文章到数据卷 |
| 外部视频通道（WorkBuddy automation + 本机） | 本机（有 Node/Chrome/ffmpeg） | 09:30 巡检文章 → 为缺视频的文章渲染 MP4 → 上传数据卷 → 回写 video 字段 |

**视频只能在本机渲染**：线上容器是 Python slim 镜像，没有 Node 与 Chrome，跑不了 Remotion。
不要尝试把渲染塞进容器（镜像会膨胀数百 MB 且吃内存）。

**生产原则**：宁缺毋滥。找不到合适题材不发文；静帧检查不通过不编码；校验不过不上线。

---

## 1. 技术栈与依赖

- **Remotion 4.0.290** — React 逐帧渲染，视频即代码
- **React 19 / TypeScript 5.x** — ⚠️ TS 必须锁 5.x，Remotion 4 的 esbuild loader 不兼容 TS 7（`typescript.sys` undefined）
- **KaTeX** — 公式渲染，与站点一致
- **edge-tts**（pip）— Edge TTS 中文旁白，默认 `zh-CN-XiaoxiaoNeural`
- **ffmpeg / ffprobe** — 音频探测、拼接、混音、编码
- **内置合成器** `video/audio-tools/`（改编自 motion-showreel）— 程序化 BGM，零外部素材
- **本机 Chrome** — 必须显式指定 `--browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`

---

## 2. 九步生产流程

```bash
# ① 生成旁白 + 实测时间轴（逐句 TTS + 词边界 + PCM 精确计时）
python3 video/scripts/build_video.py <hotspot_id>

# ② 生成 BGM + 混音（人声侧链 ducking）
bash video/scripts/build_audio.sh <hotspot_id>

# ③ 静帧检查（必做！见第 4 节检查点）
cd video && npx remotion still HotspotExplainer out/check-hook.png --frame=<hook帧> --concurrency=1 --browser-executable="...Chrome..."
# 至少检查：钩子、公式、题材专属场景、结论，四个关键帧

# ④ 全片渲染
npx remotion render HotspotExplainer out/<hotspot_id>.mp4 --concurrency=2 \
  --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --codec=h264

# ⑤ 产物校验 + Evaluator 自动层（见第 5、5.5 节）
python3 video/scripts/evaluate_video.py out/<hotspot_id>.mp4 \
  --script video/src/script.json --stills-dir video/out/check-<id> --out video/out/eval-<id>.json

# ⑤.5 【质量门禁】Evaluator AI 层看静帧按 EVALUATION.md 打分
#      FAIL → 出返修单回到 ① 重做（最多 3 轮）；PASS 才能继续

# ⑥ 上传视频 + 字幕到数据卷
SSHPASS='<密码>' sshpass -e scp video/out/<id>.mp4 ubuntu@nongbin.site:/tmp/<id>.mp4
SSHPASS='<密码>' sshpass -e scp video/public/audio/<id>.vtt ubuntu@nongbin.site:/tmp/<id>.vtt
# sudo install -o 10001 -g 10001 -m 644 到 /var/www/mathinsight/downloads/

# ⑦ 回写 video 字段到热点数据（基于服务器最新库，避免覆盖）
# {"video":{"url":"/mathinsight/downloads/<id>.mp4","duration":<秒>,"caption":"...vtt"}}

# ⑧ 部署数据（服务按 mtime 热加载，无需重启）
# sudo install -o 10001 -g 10001 -m 644 → /var/www/mathinsight/data/hotspots.json

# ⑨ 验证上线
# curl -I https://nongbin.site/mathinsight/downloads/<id>.mp4 （带登录态应 206）
```

> 步骤 ①–⑤ 已由 `generate_video.sh` 一键串联；⑥–⑨ 涉及服务器凭据，由自动化按第 7 节执行。

---

## 3. 音画同步：不可妥协的三条铁律

这套流程从 motion-showreel 借鉴的核心：**画面和声音共用一条时间轴，禁止按字数猜时间**。

1. **逐句合成**：每句单独过 Edge TTS（`boundary='WordBoundary'`），捕获词级边界事件
2. **PCM 精确计时**：每段转 24kHz 单声道 PCM，按采样数算时长（mp3 编码延迟会累积 0.5s 误差）
3. **真实时长累加**：时间轴 = 各段实测时长 + 句间静音 0.28s；**最后一句不加 GAP**（否则整体漂移 0.28s）

产出：`script.json` 带 `alignment: "tts-segments"` 和 `captions[].words`（实测词边界）。
字幕逐词卡拉OK高亮、画面关键词在词被读到时高亮，都靠这份数据。

⚠️ 不要用整段 TTS + 字数估算——初版就是这么做的，越到后面漂移越大。

---

## 4. 静帧检查点（渲染前必做）

| 检查帧 | 看什么 |
|---|---|
| hook 段中点 | 标题逐字入场是否完成、无缺字；卡片/文字无溢出 |
| **公式段**（scene.start*30+50） | 公式完整显示、无右侧溢出、无与字幕重叠；⚠️ 避开开头 0–0.18s 的 BeatFX 冲击波高潮（会短暂盖住公式，那是特效不是 bug） |
| 题材专属场景中点 | 物体是否具象、有体积感；同步度/波形/星球是否正确 |
| insight 段中点 | 结论卡片完整、光扫正常 |

常见问题与修法：
- **中文显示方块** → 检查字体；本机有 Songti SC / PingFang SC
- **公式溢出右侧** → 长公式按 `\qquad` 拆行 + 逐行自适应字号（见第 6 节）
- **卡片裁掉下半行** → 卡片不要设固定高度 / `overflow: hidden`
- **正文与字幕重叠** → 公式场景不放正文 liveLines，字幕条已承担讲解
- **渲染被杀（exit 137）** → `--concurrency=1~2`，指定本机 Chrome

---

## 5. 产物验收标准

- 时长与 `script.json` 一致（误差 < 0.1s）
- 有 video(h264) + audio(aac) 两条流
- 音轨非静音：`ffmpeg -i <mp4> -af volumedetect -f null -` 的 `mean_volume` 不是 `-inf`
- BGM 母带 -14 LUFS、峰值 -1.5 dBFS
- 公式/文字在安全区内，无裁切
- 90 秒视频约 20MB（张扬特效后）；1080p 不需要，1280×720 即可

---

## 5.5 Evaluator 质量门禁（上线前必过）

**未经 Evaluator PASS 的视频禁止上线。** 完整规范见 `video/EVALUATION.md`。

```
渲染完成
   ↓
自动层 evaluate_video.py ── FAIL ──→ 返修单 → 回①重做
   ↓ PASS
AI 层（Evaluator 角色看静帧打分，满分100）
   ↓ <80 或违反红线项
   返修单（具体到文件+改法）→ 回①重做（最多3轮）
   ↓ >=80 且无红线
   允许上传 + 登记 video 字段
```

- **自动层**：脚本客观判定，18 项（时长/流/编码/分辨率/帧率/音量/削波/黑帧/静帧像素安全区）。FAIL 直接拦截，AI 层都不用做。
- **AI 层**：Evaluator 按内容忠实度 25 + 排版可读性 25 + 视觉呈现 25 + 音画同步 25 打分。红线项一票否决：编造事实、公式溢出被裁、**画面没有具象物体**、正文与字幕重复同一句。
- **返修闭环**：FAIL 必须输出结构化返修单（`issues[].fix` 具体到文件和改法），生成模块据此精确修复后重渲染静帧复核，不推倒重来。
- **3 轮仍 FAIL**：停线，汇报管理员，绝不带病上线。

命令：`python3 video/scripts/evaluate_video.py <mp4> --script video/src/script.json --stills-dir video/out/check-<id> --out video/out/eval-<id>.json`

---

## 6. 视觉规范（v5 张扬原则）

**主体要大、光效要张扬、镜头要动、文字要让位**——用户明确反馈过"太藏着掖着"。

- 开场物体半径 178px（几乎占满右半画面），日冕喷发、十字星芒、多层辉光
- 大范围辉光用 **CSS radial-gradient 铺满容器**，不要画超出 SVG viewBox 的大圆（会被裁成矩形色块）
- 镜头缓慢推近 scale 1.0→1.16；运动物体加确定性拖尾
- 卡点：闪光 0.38、冲击波 1100px、粒子 44 个
- 公式排版：`\qquad` 拆行 + 逐行按可见字符数自适应 24–40px + overflow visible + 行高 1.15

### 题材 → 视觉主题 / 专属场景

`build_video.py` 按关键词自动选择，其他文章不硬套：

| 题材关键词 | 视觉主题 | 专属场景 |
|---|---|---|
| 天文/径向速度/伴星/轨道 | 深空（深蓝黑底+星场+星云，accent #E0764A） | `cosmic-intro`（巨大星球+镜头推近）、`orbit`（双星绕质心+多普勒红蓝移+波形）、`wavefit`（噪声数据拟合正弦） |
| 同步/耦合/振子 | 纸张（学术红 #9C3B2E） | `sync`（16 振子从混乱收敛成整齐波+同步度） |
| 举重/幂律/尺度律 | 纸张 | `lifting`（不同体型的人举杠铃，体型涨得快于力量） |
| 其他 | 纸张 | 通用 7 场景：hook/story/formula/steps/insight/question/end |

通用动效：活背景（流场/粒子/点阵波，阅读区压低亮度）、镜头推近、iris/gridMask 转场、逐词高亮、光扫、图表逐条生长、BeatFX 卡点爆发。

来源与许可：`src/fx/` 改编自 [fy-code-animation](https://github.com/Akillll-DuoHe/fy-code-animation)（免费使用，不得包装收费）；音画同步与 BGM 方法论参考 [motion-showreel](https://github.com/ConardLi/garden-skills/tree/main/skills/motion-showreel)。详见 `src/fx/README.md`。

---

## 7. 平台集成（自动化调用契约）

平台的外部值守任务（每周一三五 09:30）按此执行，包含两个角色：

**Producer（生产）**：
1. 巡检容器内调度器日志，判断文章自动化是否正常
2. 异常则先兜底发文（遵守 `scripts/HOTSPOT_GUIDE.md` 合规边界）
3. 调 `GET /api/hotspots/admin/pending-video` 拿待生产列表（最多 3 条，最新优先）
4. 对每条执行本工作流第 1–5 步，产出成片 + 全场景静帧

**Evaluator（质检，独立于 Producer）**：
5. 跑自动层 `evaluate_video.py`；FAIL 直接出返修单给 Producer
6. 按 `EVALUATION.md` 逐张看静帧打分；总分 <80、任项 <15 或违反红线 → 出返修单
7. 返修单必须含 `issues[].fix`（具体文件+改法）；Producer 据此重做，最多 3 轮
8. 两层都 PASS 才允许上传与登记

**上线（仅 Evaluator PASS 后）**：
9. 上传视频+VTT 到数据卷；调 `POST /api/hotspots/admin/video` 登记（原子写入）
10. 汇报：巡检结论、Evaluator 评分与验收结果、返修轮次、告警

**绝不在平台正常时重复发文**；**绝不让未经 Evaluator PASS 的视频上线**。

---

## 8. 快速排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `TypeError: Cannot read properties of undefined (reading 'sys')` | TS 7 与 Remotion 不兼容 | `npm install typescript@5.7.3` |
| `npm install` 后渲染报 esbuild 错 | 同上 | 锁定 TS 5.x |
| ffmpeg concat mp3 报 non monotonic DTS | mp3 段落 metadata 不一致 | 先统一转 PCM(wav) 再 concat（脚本已实现） |
| 时间轴与音频差 0.28s | 最后一句多算了 GAP | `build_timeline` 里最后一段不加 GAP（已修） |
| 词边界 chunk 报 KeyError 'data' | Edge TTS stream 结构不同 | 边界字段直接在 chunk 顶层：`chunk['offset']/1e7` |
| 视频 401 | 下载走全站鉴权 | 前端 `<video>` 带 httpOnly Cookie 自动鉴权；curl 需带登录态 |
| 辉光出现矩形边界 | SVG 大圆超出 viewBox 被裁 | 改用 CSS radial-gradient 铺容器 |
