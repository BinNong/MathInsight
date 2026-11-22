# 数说热点 · 内容生成指南

本文件是自动化内容生产任务的作业规范。每周生成 2–3 篇，把真实热点与大学数学连接起来。

## 一、合规边界（硬性要求，不可突破）

1. **题材限定**：只选科技、天文、体育、生活消费、经济数据等**可数学化的中性现象**。
2. **明确禁止**：政治人物与政治事件、社会争议与群体对立话题、宗教、色情暴力、涉及未成年人的负面事件、医疗与投资建议、任何可能构成造谣或引战的内容。
3. **事实来源**：事件描述必须来自公开报道，附来源说明。不编造数据；教学用的示意数据要在正文与图注里明确标注「示意」。
4. **概率/统计量必须实算**：文中任何具体数值（概率、百分比、拟合参数）必须用 Python 现算，不得凭感觉写。
5. **立场**：只做数学解释，不对事件本身做价值判断。

## 二、选题流程

1. 搜索近 7 天内的新闻热点，优先科技/天文/体育/生活。
2. 逐条筛：这个问题能用微积分、线性代数、概率统计中的**某一个核心概念**讲清楚吗？
   - 能 → 保留；需要硬凑 → 丢弃。宁缺毋滥。
3. 每周挑 2–3 篇，尽量覆盖不同数学分支，避免连续几篇都是概率。
4. 标题要有钩子（问句或反差句），正文要让没学过该概念的人也能读懂大意。

## 三、内容结构（字段说明）

每篇是一个 JSON 对象，追加到内容库数组。字段：

| 字段 | 要求 |
|---|---|
| `id` | `hot-YYYYMMDD-英文短名`，全局唯一 |
| `date` | 事件日期 `YYYY-MM-DD` |
| `category` | 科技/天文/体育/生活/社会/经济 |
| `branch` | `calculus` / `linear-algebra` / `probability` / `statistics` |
| `topic` | 具体数学话题，如「二项分布与期望」 |
| `headline` | 吸引人的标题（问句优先） |
| `summary` | 2–4 句现象描述，含可核实的事实 |
| `question` | 一句引导性问题 |
| `concept` | 核心数学概念名 |
| `formula` | LaTeX 公式（ `$...$` 或 `$$...$$` 均可） |
| `formula_note` | 逐个符号解释公式 |
| `steps` | 3 个 `{title, body}`，从现象到建模到结论，body 各 2–4 句 |
| `insight` | 一句让人记住的结论 |
| `figure` | Plotly 配置 `{data: [...], layout: {...}}`，见下 |
| `figure_caption` | 图注，示意数据要注明 |
| `try_it` | `{text: 思考题, answer: 参考答案}`，答案要有推理过程 |
| `concepts` | 关联知识图谱概念 id（见下方白名单） |
| `modules` | 关联实验路由（见下方白名单） |
| `source` | 来源说明，如「科技新闻：XXX（2026-11）」 |
| `source_url` | 可选，原文链接 |
| `tags` | 3–5 个短标签 |

## 四、可视化约束（重要）

前端按需加载 Plotly，**只注册了 `scatter`、`bar`、`contour`、`heatmap` 四种 trace**，用其他类型会白屏。

- 图表数据必须由脚本生成并写入 JSON，**不要在前端现算**。
- `layout` 中必须包含：`title`（对象形式 `{text: ...}`）、`xaxis.title`、`yaxis.title`（对象形式）、`height`。
- 图例用 `legend: {orientation: 'h', y: -0.16, x: 0, font: {size: 10}}`，底边距 `b: 58`，避免与右下角导出按钮重叠。
- 颜色沿用站点配色：主色 `#9c3b2e`，辅助色 `#2c6e8f`。
- 中文标签要能在图上正常显示。
- 数据点数量控制在每 trace 200 个以内。

## 五、关联白名单

`concepts` 只能用这些 id（知识图谱实际存在的）：

```
functions trigonometry exponential-log sequences limit-sequence limit-function
epsilon-delta continuity derivative-definition derivative-rules higher-derivatives
differential mean-value-theorem lhopital taylor function-analysis indefinite-integral
definite-integral fundamental-theorem integration-techniques improper-integral
numerical-integration riemann-sum series power-series multivariate-function
partial-derivative total-differential multiple-integral line-integral surface-integral
green-theorem gauss-theorem stokes-theorem vectors matrices determinants linear-systems
vector-spaces eigenvalues quadratic-forms probability-basics random-variables
distributions expectation-variance law-of-large-numbers central-limit-theorem
parameter-estimation ode-basics direction-field eigenvectors hypothesis-testing
```

`modules` 只能用这些路由：

```
/limit /derivative /taylor /matrix /probability /clt /distributions /integration
/multivariate /vector-field /vector-field-3d /surface-integral /gauss-theorem
/direction-field /eigenvalues /hypothesis-test
```

## 六、生产流程

1. 生成内容草稿，所有数值用 Python 实算，图表数据用脚本生成。
2. 追加到 `backend/app/resources/hotspots.json` 数组末尾。
3. 运行校验：`python3 scripts/validate_hotspots.py`，必须通过。
4. 运行后端测试：`cd backend && .venv/bin/python -m pytest -q tests/test_hotspots.py`。
5. 部署时把 `hotspots.json` 上传到服务器的数据卷（见下），**无需重启容器**：

   ```bash
   SSHPASS='<密码>' sshpass -e scp backend/app/resources/hotspots.json \
     ubuntu@nongbin.site:/tmp/hotspots-new.json
   # 在服务器上原子替换（服务按 mtime 自动热加载）
   sudo install -o 10001 -g 10001 -m 644 /tmp/hotspots-new.json \
     /var/www/mathinsight/data/hotspots.json
   ```

   验证：`curl https://nongbin.site/mathinsight/api/hotspots/meta` 的 `total` 增加。

6. 若同时改了前端或后端代码，走常规完整部署流程；只更新内容时跳过。

## 七、质量自查清单

- [ ] 题材在合规边界内
- [ ] 所有数值已用脚本实算，示意数据已标注
- [ ] 标题有钩子、正文通俗、公式正确
- [ ] 图表是四种允许的 trace 类型，数据由脚本生成
- [ ] `concepts` / `modules` 都在白名单内
- [ ] 校验脚本与后端测试通过
- [ ] 本周选题与上周不重复、数学分支有轮换
