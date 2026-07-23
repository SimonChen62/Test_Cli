# CalliLens RAG 后端新手使用说明

## 1. 先搞清楚：现在没有传统数据库

当前版本没有 MySQL、SQLite、MongoDB 或向量数据库。

CalliLens 现在使用的是“本地文件型知识库”：

```text
data/works.json                 作品列表
data/work_003/knowledge.json    默认作品知识片段
data/work_001/knowledge.json    管理员上传作品后生成的知识片段
knowledge/*.md                  通用知识库，例如 RAG、OpenCV、Three.js、书法术语
```

后端每次回答问题时，会读取这些文件，做关键词匹配，然后返回答案和来源。

## 2. 哪些前端操作会写入 RAG 知识库

会写入：

```text
管理员后台 -> 上传书法作品 -> 上传并处理
```

上传成功后，后端会生成：

```text
data/work_xxx/original.png
data/work_xxx/thumbnail.png
data/work_xxx/mask.png
data/work_xxx/height.png
data/work_xxx/floating_3d_data.json
data/work_xxx/work-info.json
data/work_xxx/knowledge.json
```

其中 `knowledge.json` 就是这个新作品加入 RAG 的资料。

不会写入：

```text
作品页里的“提交反思”
```

反思目前只保存在浏览器 localStorage，目的是演示用户观察记录，不是加入 RAG 数据库。

## 3. 怎么启动

在项目目录运行：

```powershell
cd D:\技术学习\CalliLens
.\start-demo.ps1
```

打开：

```text
前端：http://127.0.0.1:5190/web/
后端：http://127.0.0.1:8000/docs
```

## 4. 怎么确认后端活着

打开：

```text
http://127.0.0.1:8000/docs
```

点：

```text
GET /api/health
```

返回：

```json
{
  "status": "ok"
}
```

说明后端启动成功。

## 5. 怎么确认作品上传成功

上传后打开：

```text
GET /api/works
```

如果返回里出现：

```json
{
  "id": "work_001",
  "title": "你的作品名称"
}
```

说明作品已经写入 `data/works.json`。

也可以直接看文件：

```text
data/work_001/work-info.json
data/work_001/knowledge.json
```

## 6. 怎么确认 RAG 已经读到新作品

打开：

```text
GET /api/knowledge
```

看返回的 `chunks` 里有没有：

```text
work_id: work_001
```

如果有，说明这个作品的资料已经进入 RAG 检索范围。

## 7. 怎么问 RAG

打开：

```text
POST /api/ask
```

请求示例：

```json
{
  "work_id": "work_001",
  "question": "这件作品是什么？",
  "use_llm": false
}
```

返回里重点看两个字段：

```text
answer   回答内容
sources 资料来源
```

如果 `sources` 里出现新作品的 `knowledge.json` 片段，说明 RAG 确实用了你上传的资料。

## 8. 为什么前端刚上传后可能看不到变化

常见原因：

- 你点的是“提交反思”，这个不会入库。
- 后端没启动，上传接口没有真的执行。
- 页面还在用旧缓存，需要刷新作品库。
- 上传成功了，但你还停留在当前作品页面，没有返回作品库。

当前前端已经改成优先读取：

```text
http://localhost:8000/api/works
```

后端不可用时才退回静态：

```text
data/works.json
```

## 9. 给老师的解释

可以这样说：

> 当前版本没有使用传统数据库，而是使用本地文件型 RAG 知识库。管理员上传作品后，系统会把作品信息写入 `data/works.json`，把作品说明和背景资料写入对应作品目录下的 `knowledge.json`。RAG 问答时，后端读取 `knowledge/*.md` 和 `data/work_*/knowledge.json`，检索相关片段后生成带来源的回答。这样第一版不需要安装数据库，也不依赖付费 API，适合课堂演示。
