# CalliLens

CalliLens 是一个书法数字导览 Demo，默认作品为赵孟頫《光福重建塔记》。项目将 OpenCV 图像处理、Three.js 平滑浮雕 3D 展示、InkVerse Lite 入墨体验和本地 RAG 问答结合起来，帮助普通观众理解作品的视觉魅力与历史文化背景。

项目边界很明确：不自动评价书法水平，不判断真伪，不恢复真实笔顺，也不声称自动识别气韵。系统只把可见墨迹深浅转成平滑浮雕高度，并用有来源的本地资料回答问题。

## 功能

- 高清原图浏览
- 整卷平滑浮雕 3D 墨迹展示
- InkVerse Lite 入墨体验入口：Original、Enter the Ink、Follow the Qi、Return
- 放大、缩小、水平移动、拖拽旋转
- 本地 RAG 问答，无 API key 也能运行
- 可选 AI 润色，管理员在页面里配置 API key
- 管理员上传作品，自动生成图像处理结果和知识库片段
- 简单用户账号、作品进入记录、第一印象和反思文字入库

## 运行

先安装依赖：

```powershell
python -m pip install -r requirements.txt
```

一键启动前后端：

```powershell
.\start-demo.ps1
```

也可以手动启动：

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
python -m http.server 5190
```

打开：

```text
http://127.0.0.1:5190/web/
```

后端接口文档：

```text
http://localhost:8000/docs
```

## 文档

新手后端使用路线：

```text
docs/BACKEND_USAGE_GUIDE.md
docs/RAG_BACKEND_BEGINNER_GUIDE.md
docs/BACKEND_TESTING_STEP_BY_STEP.md
```

课堂演示和答辩材料：

```text
docs/DEMO_SCRIPT.md
docs/DEFENSE_QA.md
docs/CALLILENS_NEXT_STAGE_TASKBOOK.md
docs/CALLILENS_INKVERSE_RAG_FUSION_PLAN.md
```

管理员后台入口在首页“上传个性化书法作品”，演示口令：

```text
callilens-admin
```

## 用户数据库

用户账号和反思记录使用数据库保存：

```text
本地默认：backend/data/callilens.db
Render：配置 DATABASE_URL 后使用 PostgreSQL
说明：docs/USER_DATABASE_GUIDE.md
```

这个数据库保存运行时数据，不会提交到 GitHub。

## AI 配置

默认不需要付费 API。问答会使用本地 RAG 检索和模板回答。

RAG 仍使用本地文件型知识库，不依赖向量数据库：

```text
data/works.json
data/work_003/knowledge.json
knowledge/*.md
```

如果要接入 AI 润色，可以在网页“管理员上传”页保存配置。配置会写入本机 `.env.local`，不会提交到 Git。

推荐默认：

```text
provider: openrouter
model: openrouter/free
```

也可以复制 `.env.example` 手动创建 `.env.local`。

## 测试

```powershell
python -m unittest tests.test_extract_glyphs tests.test_rag_service
python -m unittest tests.test_user_service
python -m py_compile backend\app\main.py backend\app\services\rag_service.py backend\app\services\llm_service.py scripts\process_work.py
node --check web\app.js
```

## 答辩表述

可以这样介绍：

> 我们以赵孟頫《光福重建塔记》为例，搭建了一个书法数字导览系统。OpenCV 负责提取墨迹 mask 和高度图，Three.js 把墨迹深浅渲染成平滑浮雕 3D，InkVerse Lite 把原作、入墨、气脉和回看串成短体验链，RAG 问答则先检索本地作品资料、术语解释和技术说明，再生成有来源的导览回答。即使没有付费 API，系统也可以完整演示。
