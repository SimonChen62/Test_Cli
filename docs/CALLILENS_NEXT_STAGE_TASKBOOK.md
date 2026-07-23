# CalliLens 下一阶段任务书：InkVerse Lite + RAG 可演示优化

## 1. 项目定位

当前阶段不直接开发完整 WebXR 大工程，而是在现有 CalliLens 上做一个稳定可演示的轻量版本。

一句话介绍：

> CalliLens 以赵孟頫《光福重建塔记》为示例，用 OpenCV 提取墨迹数据，用 Three.js 做平滑浮雕 3D，用 InkVerse Lite 串联“看原作、进入墨迹、追随气脉、回到原作”的短体验，并用本地 RAG 提供有来源的导览问答。

项目边界：

- 不自动评价书法好坏。
- 不判断真伪。
- 不恢复真实笔顺。
- 不声称自动识别气韵。
- 不强制依赖付费 API。
- 第一分支不做完整 WebXR、VR 设备适配、声音系统和复杂毛笔物理。

## 2. 老师新文档拆解

老师文档《InkVerse · 入墨》的核心要求是：

```text
Original → Enter the Ink → Ride the Stroke → Follow the Qi → Walk into the Void → Return to the Original
```

也就是不能只做“VR 看书法展”，而要让用户进入笔画、沿笔势穿行、追随气脉、进入留白，最后回到原作。

但对当前项目来说，完整 WebXR 一次性做完风险过高。因此第一分支选择最好落地的四段：

```text
Original → Enter the Ink → Follow the Qi → Return
```

暂缓内容：

- `Ride the Stroke`：需要更完整 stroke path 和镜头路径控制，放第二阶段。
- `Walk into the Void`：需要 voidRegion 空间模型，放第三阶段。
- WebXR / VR：先做 Desktop 模式，后续单独建 Vite + TypeScript + WebXR 模块。

## 3. 第一分支功能

分支名：

```text
codex/inkverse-lite-rag
```

### 3.1 UI 入口

在作品页图层按钮栏新增：

```text
入墨体验
```

点击后打开 `InkVerse Lite` 面板，不替换原来的 `全文3D`。

### 3.2 InkVerse Lite 四段体验

1. `Original`
   - 回到原作图。
   - 提示用户先看整体。

2. `Enter the Ink`
   - 切换到现有 `全文3D`。
   - 使用当前平滑浮雕版本。
   - 说明墨迹深浅如何转为空间高度。

3. `Follow the Qi`
   - 切换到现有气脉模式。
   - 用人工标注和骨架线索解释“形断势连”。

4. `Return`
   - 回到原作。
   - 让用户选择反思标签：运动感、节奏、留白、墨色、其他。
   - 标签写入右侧“我的反思”。

验收标准：

- 不破坏现有首页、作品库、管理员后台。
- `全文3D` 仍是平滑浮雕，不是悬浮层。
- `入墨体验` 可以连续点击四个步骤。
- `Return` 标签能写入反思框。

## 4. RAG 与知识库优化

### 4.1 当前有没有数据库

当前没有真正数据库。

没有：

- MySQL
- SQLite
- 向量数据库
- 云端数据库

当前使用本地文件型知识库：

```text
data/works.json
data/work_003/knowledge.json
knowledge/*.md
```

后端每次回答问题时读取这些文件，做关键词和标签匹配，再返回答案和来源。

### 4.2 为什么这样做

当前资料量小，作品数少，本地文件最稳：

- 不需要安装数据库。
- 不需要账号和云服务。
- 新手容易启动。
- 课堂演示不容易因为数据库连接失败翻车。

后续如果作品数量变多，可以升级为：

```text
SQLite → 向量数据库 → 多作品管理后台
```

### 4.3 RAG 必须能回答的问题

```text
赵孟頫是谁？
《光福重建塔记》是什么？
老师新文档要求是什么？
InkVerse 和 RAG 怎么结合？
现在有数据库吗？
RAG 数据库在哪里？
没有 API key 能不能运行？
做完之后我怎么测试？
为什么要做平滑浮雕 3D？
```

## 5. 新手测试路线

### 5.1 安装依赖

```powershell
python -m pip install -r requirements.txt
```

### 5.2 一键启动

```powershell
.\start-demo.ps1
```

打开：

```text
http://127.0.0.1:5190/web/
```

后端接口文档：

```text
http://127.0.0.1:8000/docs
```

### 5.3 手动启动

第一个 PowerShell：

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

第二个 PowerShell：

```powershell
python -m http.server 5190 --bind 127.0.0.1
```

### 5.4 功能测试顺序

1. 首页点击“网页已存库”。
2. 打开赵孟頫《光福重建塔记》。
3. 填写第一印象并进入观察。
4. 点击 `全文3D`，检查平滑浮雕。
5. 点击 `入墨体验`，依次点四个步骤。
6. 在 RAG 中提问“现在有数据库吗？”。
7. 返回首页，进入管理员后台，口令 `callilens-admin`。

### 5.5 命令行检查

```powershell
node --check web\app.js
python -m py_compile backend\app\main.py backend\app\services\rag_service.py backend\app\services\llm_service.py
python -m unittest tests.test_extract_glyphs tests.test_rag_service
```

## 6. 后续阶段

### 第二阶段：Ride the Stroke

- 新增 `data/work_003/inkverse-work.json`。
- 人工标注 3 条 stroke path。
- 用 Three.js 曲线让镜头沿一条笔画移动。

### 第三阶段：Walk into the Void

- 人工标注字内、字间、行间留白区域。
- 做留白空间进入效果。
- RAG 解释“留白不是空无，而是组织呼吸和节奏”。

### 第四阶段：正式 WebXR

- 新建独立 Vite + TypeScript + Three.js + WebXR 项目。
- 支持 Desktop Chrome 和 WebXR 入口。
- 保持 CalliLens 主 Demo 稳定，不把 WebXR 复杂度塞进现有 `web/app.js`。

## 7. 答辩话术

可以这样讲：

> 老师的新文档要求很完整，但一次性做完整 WebXR 风险比较高。我们先把它拆成两层：CalliLens 负责作品资料、OpenCV、平滑浮雕 3D、本地 RAG 和管理员上传；InkVerse Lite 负责把“看原作、进入墨迹、追随气脉、回到原作”串成短体验。这样既回应了老师“不要只做展览页”的要求，也保证当前版本能稳定演示。RAG 不是付费 AI 的替代品，而是让回答先基于本地资料，减少胡编，并显示来源。
