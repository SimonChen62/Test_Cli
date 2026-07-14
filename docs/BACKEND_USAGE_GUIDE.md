# CalliLens 后端使用路线

这份文档只讲怎么跑起来、怎么测试、怎么用后台，不讲复杂原理。

## 1. 先安装依赖

在项目根目录打开 PowerShell：

```powershell
cd D:\技术学习\CalliLens
python -m pip install -r requirements.txt
```

只需要第一次安装，之后不用每次都装。

## 2. 一键启动

推荐直接运行：

```powershell
.\start-demo.ps1
```

它会启动两个东西：

- 后端 API：http://localhost:8000
- 前端网页：http://127.0.0.1:5190/web/

浏览器会自动打开前端。

## 3. 如果一键启动不成功

手动开两个 PowerShell 窗口。

第一个窗口启动后端：

```powershell
cd D:\技术学习\CalliLens
python -m uvicorn backend.app.main:app --reload --port 8000
```

第二个窗口启动前端：

```powershell
cd D:\技术学习\CalliLens
python -m http.server 5190 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:5190/web/
```

## 4. 怎么确认后端是好的

打开：

```text
http://localhost:8000/docs
```

这是 FastAPI 自动生成的接口测试页面。

最简单先点：

```text
GET /api/health
```

如果返回：

```json
{"status": "ok"}
```

说明后端已经启动。

## 5. 管理员后台怎么进

打开前端：

```text
http://127.0.0.1:5190/web/
```

点击首页的：

```text
上传个性化书法作品
```

输入演示口令：

```text
callilens-admin
```

进入后台后可以做两件事：

1. 配置 AI API key。
2. 上传新书法作品。

## 6. AI API 可以不填

不填 API key 也能运行。

默认模式是：

```text
本地 RAG 检索 + 模板回答
```

如果填了 API key，问答卡片里勾选“使用管理员配置的 AI 润色”，系统才会调用 AI。

推荐配置：

```text
提供商：OpenRouter 免费路由
模型：openrouter/free
```

API key 会写到本机：

```text
.env.local
```

这个文件不会提交到 Git。

## 7. 上传作品会发生什么

管理员上传图片并填写作品资料后，后端会自动：

1. 保存原图到 `data/work_xxx/original.png`
2. 用 OpenCV 生成 `mask.png`
3. 生成 `height.png`
4. 生成 `floating_3d_data.json`
5. 生成 `knowledge.json`
6. 更新 `data/works.json`

之后回到作品库，新作品就会出现。

## 8. RAG 问答怎么测

进入默认作品后，右侧有“本地 RAG 导览”卡片。

可以问：

```text
赵孟頫是谁？
《光福重建塔记》是什么？
什么是飞白？
为什么需要 RAG？
OpenCV 做了什么？
Three.js 做了什么？
```

如果后端没启动，页面会提示你启动：

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

## 9. 常见问题

如果网页能打开但问答失败：

- 检查 `http://localhost:8000/docs` 是否能打开。
- 如果打不开，说明后端没启动。

如果上传失败：

- 检查图片是不是常见格式，例如 JPG 或 PNG。
- 检查后端窗口有没有报错。

如果 AI 不能用：

- 不影响本地 RAG。
- 先不要管 AI，答辩时可以说 API 是可选增强。
