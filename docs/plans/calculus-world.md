# 微积分大陆 · 地图体系与室内修炼（计划）

## 背景与愿景

2D 数学小镇升级为「知识体系 → 地图系统」架构的第一张地图：**微积分大陆**。
后续线性代数、概率论各用一套独立美术资产 + 地图（等素材到位再建）。
本张地图复用 Anokolisa 像素包，在现有小镇基础上做三件事：

1. **房屋可进入** —— 三栋建筑对应三大修炼馆（室内场景）
2. **答题修炼深化** —— 覆盖微积分核心知识点的题库 + 连答修炼 + 解析
3. **成长可视化** —— 修炼手札：掌握度、错题本、战绩，localStorage 持久化

## 头脑风暴（已筛选）

- 酒馆 →「极限酒馆」：极限计算、连续与间断（老板 洛必达）
- 农舍 →「导数讲堂」：求导法则、导数应用（导师 牛顿）
- 法师小屋 →「积分圣所」：不定积分、定积分、级数初步（导师 莱布尼茨）
- 答题在馆内导师处进行：选知识点或综合试炼，5 题一组，每题 15s
- 每题答完即时显示对错 + 解析（教学闭环），连对有奖励加成
- 奖励：灵感（MP）、知识点；一组答对 ≥4 题获得「顿悟」buff（90s 伤害 ×1.25）
- 错题自动进错题本；每个知识点有掌握度等级（未修炼/初窥/熟练/精通）
- U 大招题库替换为微积分题库（与修炼同源）
- 室外导师、传送门、打怪玩法全部保留

## 详细设计

### 题库 `data/questions.ts`
- 7 个知识点（topic），每点 6-8 题，含难度 1-3、四选项、解析
- 知识点：limit-calc / limit-continuity / deriv-calc / deriv-app / integral-indef / integral-def / series
- 每题：id, topic, q, options[4], answer, explain, difficulty

### 室内场景（离线拼贴 PNG，工具 `tools/build_interiors.py`）
- 每馆一张 256×160（16×10 瓦片）整图：地板 + 后墙 + 家具 + 地毯 + 门垫，黑色虚空背景
- 素材：Interior_Walls_01（墙体/地板）、Interior_Props_01（家具）、Esoteric（书籍/沙漏/烧瓶）
- NPC 换色变体（PIL 按色相区间重映射）：洛必达(keeper→绯红)、牛顿(peasant→藏青)、莱布尼茨(wizard→金琥珀)
- 运行时室内只有导师 NPC + 玩家，无 y 排序问题；碰撞用 solid 网格

### 场景切换
- `WorldData` 加 `kind: 'outdoor' | 'interior'`、`bgImage?: AssetKey`、`doors: DoorDef[]`
- `data/interiors.ts`：buildInterior(hallId) → WorldData（solid 墙/家具、导师 NPC、出口门垫）
- `world.ts`：三栋建筑门口加 DoorDef（E 交互进入）
- `loop.ts`：scene 切换（重算 groundCanvas、重置玩家位置、combat.setWorld 保留 HP/MP/分数、清特效）
- `ground.ts`：interior 分支 = 黑底 + 房间 PNG

### 修炼答题 `ui/Training.tsx`
- 选知识点/综合 → 5 题连答（15s/题，1-4 快捷键）→ 每题解析 → 结算页
- 结算：答对 X/5、连对纪录、灵感/知识点奖励、顿悟 buff、掌握度变化
- 奖励经 store → loop 应用到 combat（与 quiz resolve 同模式的反向通道）

### 修炼手札 `ui/Codex.tsx`（Tab 键 / HUD 按钮）
- 7 知识点掌握度进度条与等级、总战绩、错题本（题干+正解+解析）
- `useMasteryStore`（zustand persist，localStorage）

### 联动
- combat：题库换成微积分 bank；加 dmgBuff（顿悟）字段；HudSnapshot 带 buff 状态
- Dialog：导师 NPC 增加「开始修炼」「修炼手札」按钮
- Intro/Hud/目标文案更新

## 实施顺序

1. 题库 questions.ts（内容正确性优先）
2. build_interiors.py → 3 张房间 PNG + 3 张 NPC 换色（视觉迭代）
3. assets.ts / ground.ts / world.ts / interiors.ts
4. loop.ts 场景切换 + combat.setWorld + 顿悟 buff
5. store（training/codex/mastery）+ Training/Codex UI + CSS
6. Dialog/Intro/Hud 接线
7. tsc + e2e + 截图验证
