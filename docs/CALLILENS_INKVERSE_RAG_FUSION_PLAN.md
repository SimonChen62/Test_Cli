# CalliLens + InkVerse + RAG 融合计划方案

## 1. 总体定位

当前项目不再只定位为“书法作品展示页”，而是拆成两层：

- CalliLens：作品资料、OpenCV 图像处理、本地 RAG 导览、管理员上传后台。
- InkVerse：基于 Three.js / WebXR 的沉浸式书法体验层，让用户进入墨迹、沿笔势穿行、追随气脉、进入留白，再回到原作。

一句话说明：

> CalliLens 提供可靠资料和导览解释，InkVerse 提供沉浸式空间体验，RAG 把作品背景、书法术语、老师任务要求和技术实现连接起来，保证用户看到的每个 3D / WebXR 效果都有解释和来源。

## 2. 为什么这样融合

老师新文档强调：不要做成“VR 看书法展”，而要让用户真正进入笔画、沿笔势穿行、理解气脉和留白。

这和当前 CalliLens 的优势互补：

- 当前项目已有赵孟頫《光福重建塔记》的作品入口、图像处理数据和 RAG 问答。
- 新方案要求的 WebXR、Ride the Stroke、Follow the Qi、Walk into the Void 可以作为下一阶段体验模块。
- RAG 不负责生成特效，而是负责解释体验节点：为什么这里能体现飞白、为什么墨迹断了势不一定断、为什么留白不是空无。

## 3. 推荐体验链

按老师文档的核心链设计：

```text
Original
→ Enter the Ink
→ Ride the Stroke
→ Follow the Qi
→ Walk into the Void
→ Return to the Original
```

对应到当前系统：

| 体验阶段 | 前端体验 | 数据来源 | RAG 解释内容 |
| --- | --- | --- | --- |
| Original | 展示赵孟頫《光福重建塔记》原图 | original.png、作品信息 | 作者、时代、馆藏、作品背景 |
| Enter the Ink | 墨迹从纸面沿 Z 轴轻微升起 | mask.png、height.png、stroke 数据 | OpenCV 如何提取墨迹，为什么重墨更高 |
| Ride the Stroke | 镜头沿选定笔画路径移动 | stroke path、width、inkDensity | 笔势、转折、顿挫、飞白 |
| Follow the Qi | 用细弱流动线连接断开的笔画 | qiLinks 人工数据 | “形断势连”的解释 |
| Walk into the Void | 进入字内、字间、行间留白空间 | voidRegion polygon | 留白如何组织呼吸和节奏 |
| Return to the Original | 所有效果消退，回到静态原作并反思 | LocalStorage/session JSON | 用户重新观看原作的关注点变化 |

## 4. 数据模型调整

当前项目已有：

```text
data/work_003/
  original.png
  mask.png
  height.png
  full_scroll_3d_data.json
  annotation.json
  knowledge.json
```

建议新增：

```text
data/work_003/inkverse-work.json
```

第一版结构：

```json
{
  "work_id": "work_003",
  "title": "赵孟頫《光福重建塔记》",
  "strokes": [
    {
      "id": "stroke_001",
      "label": "示例笔画 1",
      "path": [[0.12, 0.32], [0.15, 0.37], [0.18, 0.42]],
      "width": [0.08, 0.12, 0.06],
      "inkDensity": [0.7, 1.0, 0.45],
      "curvature": [0.2, 0.7, 0.4],
      "flyingWhite": [[0.55, 0.68]],
      "turningPoints": [0.42],
      "pausePoints": [0.76]
    }
  ],
  "qiLinks": [
    {
      "id": "qi_001",
      "from": "stroke_001",
      "to": "stroke_002",
      "path": [[0.18, 0.42], [0.2, 0.47], [0.22, 0.51]]
    }
  ],
  "voidRegions": [
    {
      "id": "void_001",
      "type": "interCharacter",
      "polygon": [[0.32, 0.2], [0.36, 0.2], [0.36, 0.5], [0.32, 0.5]],
      "depth": 0.35
    }
  ]
}
```

重要边界：

- 第一版允许人工制作 stroke、qiLink、voidRegion，不强求自动识别。
- OpenCV 只提供 mask、height 和候选区域，不声称自动判断气韵或书法水平。
- RAG 解释来自本地资料和老师任务书，不让 AI 自由编造。

## 5. 前端模块规划

继续保留当前 UI，不推翻重做。新增模块应接在“全文 3D”或单独“入墨体验”入口后。

建议模块：

```text
web/
  app.js
  styles.css
  3d-static/
  inkverse/
    index.html
    main.js
    experience-controller.js
    stroke-system.js
    qi-system.js
    void-space-system.js
```

第一版可以先不迁移到 TypeScript/Vite，避免项目一下变复杂。等 Desktop 体验稳定后，再单独开 `inkverse-vite/` 做 WebXR 正式版本。

## 6. 后端与 RAG 规划

后端保留 FastAPI：

```text
GET  /api/works
GET  /api/works/{work_id}
POST /api/ask
POST /api/admin/upload-work
```

建议新增：

```text
GET  /api/works/{work_id}/inkverse
POST /api/admin/works/{work_id}/inkverse
```

用途：

- 前端读取 `inkverse-work.json`。
- 管理员后续可以上传或编辑人工 stroke、qiLink、voidRegion。
- RAG 把 `knowledge/inkverse-webxr.md`、作品知识库、书法术语和技术说明一起检索。

## 7. 阶段计划

### 第一阶段：修稳当前 Demo

目标：

- 保留现有 CalliLens UI。
- 修好全文 3D 的平滑过渡。
- 保证管理员登录、上传、本地 RAG 可运行。
- RAG 能回答 InkVerse 与老师任务要求。

验收：

- 页面中文正常。
- 3D 不尖锐、不压缩错位。
- 问“老师新文档怎么融合”能返回有来源回答。

### 第二阶段：Enter the Ink

目标：

- 做一个“进入墨迹”入口。
- 选取 1-3 条人工 stroke 数据。
- 让笔画从纸面沿 Z 轴升起，重墨更厚，飞白更薄。

验收：

- 至少 1 条笔画能自然升起。
- 侧面能看到厚度。
- 文案只做短提示，不长篇说明。

### 第三阶段：Ride the Stroke

目标：

- 镜头沿笔画路径移动。
- 在转折、顿挫、飞白处改变速度或提示。
- 体验控制在 60 秒以内。

验收：

- 用户能沿一条笔画从起点到终点。
- 镜头转向平滑，不跳变。
- RAG 可解释“为什么这里体现转折/飞白”。

### 第四阶段：Follow the Qi

目标：

- 用 qiLinks 表示笔画之间的势。
- 墨粒或细线沿气脉路径移动。
- 避免粗大箭头和随机特效。

验收：

- 至少 2 条 qiLink 正常显示。
- 可以解释“墨迹已断，势未必断”。

### 第五阶段：Walk into the Void

目标：

- 用 voidRegion 表示字内、字间、行间留白。
- 让用户进入留白空间，感受“窄 - 过渡 - 开放”。

验收：

- 至少 3 个留白区域可进入。
- RAG 可解释“留白不是空无，而是组织呼吸和节奏”。

### 第六阶段：Return 与答辩

目标：

- 所有特效消退，回到原作。
- 记录用户反思。
- 输出演示脚本、技术报告和答辩问答。

验收：

- 完整体验链可演示。
- 能回答 OpenCV、Three.js、WebXR、RAG 各自作用。
- 能明确说明“不自动评价书法水平、不恢复真实笔顺”。

## 8. 答辩话术

可以这样说：

> 我们把项目分成两层：CalliLens 是作品资料、图像处理和本地 RAG 导览底座；InkVerse 是沉浸式 WebXR 体验层。OpenCV 提取墨迹 mask 和 height map，Three.js 把墨迹深浅转成空间厚度，人工 stroke / qiLink / voidRegion 补充笔势、气脉和留白数据。RAG 的作用不是替代视觉体验，而是在用户提问时检索作品背景、书法术语、老师任务要求和技术说明，给出有来源的简短解释，减少 AI 胡编。

## 9. 当前最合理的取舍

近期不要立刻重构成大型 TypeScript/Vite/WebXR 项目。先在当前 CalliLens 里完成 Desktop 可演示的 “Enter the Ink + RAG 解释” 小闭环，再逐步扩展 WebXR。

推荐近期交付顺序：

```text
1. 修好当前 3D 平滑效果
2. 建 inkverse-work.json 示例数据
3. 做 Enter the Ink 单笔体验
4. 接入 RAG 节点解释
5. 再做 Ride / Qi / Void
```
