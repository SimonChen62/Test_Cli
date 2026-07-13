# CalliLens

CalliLens 是一个书法数字导览 Demo，默认作品为赵孟頫《光福重建塔记》。项目将 OpenCV 图像处理、Three.js 悬浮 3D 墨迹展示和本地 RAG 问答结合起来，帮助普通观众理解作品的视觉魅力与历史文化背景。

项目边界很明确：不自动评价书法水平，不判断真伪，不恢复真实笔顺，也不声称自动识别气韵。系统只把可见墨迹深浅转成 3D 空间效果，并用有来源的本地资料回答问题。

## 功能

- 高清原图浏览
- 悬浮 3D 墨迹展示
- 放大、缩小、水平移动、拖拽旋转
- 本地 RAG 问答，无 API key 也能运行
- 可选 AI 润色，管理员在页面里配置 API key
- 管理员上传作品，自动生成图像处理结果和知识库片段

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
python -m http.server 5173
```

打开：

```text
http://localhost:5173/web/
```

后端接口文档：

```text
http://localhost:8000/docs
```

新手后端使用路线见：

```text
docs/BACKEND_USAGE_GUIDE.md
```

管理员后台入口在首页“上传个性化书法作品”，演示口令：

```text
callilens-admin
```

## AI 配置

默认不需要付费 API。问答会使用本地 RAG 检索和模板回答。

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
python -m py_compile backend\app\main.py backend\app\services\rag_service.py backend\app\services\llm_service.py scripts\process_work.py
node --check web\app.js
```

## 答辩表述

可以这样介绍：

> 我们以赵孟頫《光福重建塔记》为例，搭建了一个书法数字导览系统。OpenCV 负责提取墨迹 mask 和高度图，Three.js 把墨迹深浅渲染成悬浮 3D 效果；RAG 问答则先检索本地作品资料、术语解释和技术说明，再生成有来源的导览回答。即使没有付费 API，系统也可以完整演示。
