# CalliLens

CalliLens 是一个面向普通观众的中国书法鉴赏交互式导览 Demo。当前主线是 `work_003` 单作品局部：通过 OpenCV 辅助图层、人工确认的代表性观察点、局部证据探针和用户反思输入，帮助新手理解“气脉”“虚实”“笔墨节奏”。

核心边界：

- OpenCV 只提供可见证据，不判断美学。
- 人工标注负责确认气脉、虚实、笔墨解释。
- 前端负责分层观看、局部高亮、证据提示和反思表达。
- 系统不做自动书法评分，不训练气韵模型，不还原真实笔顺，不检测真实力道。

## 当前 Demo

主样例：

```text
data/work_003/
```

主要文件：

```text
data/work_003/original.png
data/work_003/binary.png
data/work_003/skeleton.png
data/work_003/stroke_width.png
data/work_003/ink_density.png
data/work_003/void_candidates.png
data/work_003/annotation.json
data/work_003/annotation-draft.md
data/work_003/work-info.md
```

前端入口：

```text
web/index.html
web/app.js
web/styles.css
```

## 运行方式

在项目根目录运行：

```powershell
.\start-demo.ps1
```

如果脚本不可用，也可以运行：

```powershell
python -m http.server 5173
```

然后打开：

```text
http://localhost:5173/web/
```

不要直接双击打开 `web/index.html`。浏览器安全限制可能导致 JSON 和图像分析读取失败。

## V1 功能

- 默认展示干净原作。
- 支持切换观看模式：原作、气脉、实：墨迹、虚：留白、虚实关系、笔墨。
- 右侧展示人工导览观察卡。
- 点击观察卡后，左侧只高亮一个对应位置。
- 每个观察点都有三段解释：
  - 形式描述：画面上客观能看到什么。
  - 感知经验：普通观众可能产生什么观看感受。
  - 美学解释：它如何帮助理解气脉、虚实或笔墨节奏。
- 支持浏览器语音导览。
- 支持反思任务：指出运动感、解释留白、用证据组织审美解释。

## V1.5 局部证据探针

用户可以点击图像任意位置，系统会分析附近局部窗口并输出候选提示。

探针会尝试计算：

- 墨迹比例
- 留白比例
- 留白候选强度
- 粗细变化
- 墨色变化

探针输出的是“可能的观察候选”，不是审美结论。推荐答辩表述：

```text
算法辅助观察，人工确认解释，保留审美开放性。
```

## Future Work

老师 PDF 中提到的 3D Brushwork Path 和 AR Overlay 暂不作为当前 V1 实现内容。答辩时建议把它们放在后续版本：

- V2：增加 2-3 个作品局部，完善专家标注和用户任务。
- V3：用 Three.js 做解释性的 3D 笔势路径，强调不是复原真实书写过程。
- V4：探索 AR Overlay，让解释直接贴合作品展示场景。

## OpenCV 图层生成

安装依赖：

```powershell
python -m pip install -r requirements.txt
```

重新生成 `work_003` 图层：

```powershell
python scripts/process_work.py --work data/work_003
```

## 文档

- V1 任务书：`docs/CALLILENS_V1_TASKBOOK.md`
- 标注指南：`docs/ANNOTATION_GUIDE.md`
- 接口契约：`docs/INTERFACE_CONTRACT.md`
- Git 协作流程：`docs/GIT_SYNC_WORKFLOW.md`
- 老师要求整理：`docs/reference/project-brief-source.txt`
- 论文摘要整理：`docs/reference/paper-summary.md`

## 小组协作

每次开始前先拉取最新代码：

```powershell
git pull --rebase origin main
```

每次改完后运行：

```powershell
.\sync-git.ps1 -Message "说明你改了什么"
```

不要多人同时修改同一个 JSON 文件。建议流程是：标注先写在 `annotation-draft.md`，再由一个人统一同步到 `annotation.json`。

当前远端仓库：

```text
https://github.com/SimonChen62/Test_Cli.git
```
