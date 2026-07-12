# CalliLens V1 数据接口契约

本文档是前端、后端、OpenCV 脚本和人工标注之间的统一约定。V1 阶段先不做复杂后端接口，统一以静态 JSON 文件作为数据接口。

## 核心原则

- 前端只读取 `data/work_001/annotation.json`
- 图片路径由 `annotation.json.images` 指定
- OpenCV 只生成辅助图，不写审美解释
- 人工标注负责 `annotations` 内的气脉、虚实、笔墨解释
- 后端如果存在，V1 只需要能返回同结构 JSON

## 静态文件接口

前端请求：

```text
GET /data/work_001/annotation.json
```

前端根据 JSON 里的图片字段加载：

```text
/data/work_001/original.png
/data/work_001/binary.png
/data/work_001/skeleton.png
/data/work_001/stroke_width.png
/data/work_001/ink_density.png
/data/work_001/void_candidates.png
```

## JSON 顶层结构

```json
{
  "workId": "work_001",
  "title": "行书局部示例",
  "style": "行书",
  "source": "作品来源说明",
  "images": {},
  "guideText": "语音导览文案",
  "annotations": []
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `workId` | string | 是 | 作品 ID，V1 固定为 `work_001` |
| `title` | string | 是 | 前端展示标题 |
| `style` | string | 是 | 书体或风格说明 |
| `source` | string | 是 | 图片来源或授权说明 |
| `images` | object | 是 | 作品图和 OpenCV 辅助图路径 |
| `guideText` | string | 是 | 浏览器语音导览文本 |
| `annotations` | array | 是 | 人工标注列表 |

## images 结构

```json
{
  "original": "original.png",
  "binary": "binary.png",
  "skeleton": "skeleton.png",
  "strokeWidth": "stroke_width.png",
  "inkDensity": "ink_density.png",
  "voidCandidates": "void_candidates.png"
}
```

前端以 `data/work_001/` 作为相对根目录拼接这些文件名。

## annotation 结构

所有标注共享字段：

```json
{
  "id": "qi_1",
  "type": "qi_flow",
  "label": "形断势连",
  "evidenceLayers": ["original", "skeleton"],
  "formal": "形式描述",
  "perception": "感知经验",
  "aesthetic": "美学解释"
}
```

### 共同字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 标注 ID，建议使用 `qi_1`、`void_1`、`ink_1` |
| `type` | string | 是 | 标注类型 |
| `label` | string | 是 | 短标签，显示在图上或解释面板 |
| `evidenceLayers` | string[] | 是 | 该标注依赖的证据图层 |
| `formal` | string | 是 | 形式描述 |
| `perception` | string | 是 | 感知经验 |
| `aesthetic` | string | 是 | 美学解释 |

`type` 只允许：

```text
qi_flow
void_solid
brush_ink
```

`evidenceLayers` 只允许：

```text
original
binary
skeleton
strokeWidth
inkDensity
voidCandidates
```

## 气脉标注：qi_flow

气脉使用 SVG path，坐标采用百分比坐标，范围为 `0-100`。

```json
{
  "id": "qi_1",
  "type": "qi_flow",
  "label": "形断势连",
  "evidenceLayers": ["original", "skeleton", "binary"],
  "path": "M 18 24 C 30 32, 39 42, 48 56",
  "formal": "两笔之间没有实际墨迹连接，但方向承接明显。",
  "perception": "观看时会感觉运动没有完全中断。",
  "aesthetic": "这帮助理解气脉中的形断势连。"
}
```

前端要求：

- 用 SVG `<path>` 绘制
- 支持点击
- 支持路径动画

## 虚实标注：void_solid

虚实使用矩形区域，坐标采用百分比坐标，范围为 `0-100`。

```json
{
  "id": "void_1",
  "type": "void_solid",
  "label": "字间呼吸",
  "evidenceLayers": ["original", "binary", "voidCandidates"],
  "box": { "x": 38, "y": 18, "width": 16, "height": 26 },
  "formal": "两列字之间留出连续空白。",
  "perception": "密集文字之间出现呼吸感。",
  "aesthetic": "空白参与了行列节奏。"
}
```

前端要求：

- 用 SVG `<rect>` 绘制
- 支持点击
- 高亮区域不要完全遮住原作

## 笔墨标注：brush_ink

笔墨轻重线索也使用矩形区域，坐标采用百分比坐标。

```json
{
  "id": "ink_1",
  "type": "brush_ink",
  "label": "由按转提",
  "evidenceLayers": ["original", "strokeWidth", "inkDensity"],
  "box": { "x": 22, "y": 62, "width": 20, "height": 12 },
  "formal": "这一段笔画由粗逐渐变细。",
  "perception": "观看时会感到笔势变轻。",
  "aesthetic": "这提示笔墨轻重线索，但不是检测真实力道。"
}
```

前端和文案都不要写“真实力道检测”。

## 后端可选接口

如果组员写后端，V1 只需要提供同结构响应：

```text
GET /api/works/work_001
```

响应体必须与 `data/work_001/annotation.json` 完全同构。

不建议 V1 做：

- 登录
- 数据库
- 图片上传
- 自动审美判断
- 自动标注气脉

## 交接检查

前端同学只需要确认：

- 能 fetch 到 JSON
- 能根据 `images` 加载图
- 能根据 `type` 区分显示方式
- 点击标注能显示 `formal/perception/aesthetic`
- 能播放 `guideText`

标注同学只需要确认：

- 每个标注都有三段解释
- 坐标使用 `0-100` 百分比
- 气脉用 `path`
- 虚实和笔墨用 `box`

