# CalliLens 后端功能一步一步测试手册

这份文件只解决一个问题：你打开项目以后，怎么一步一步确认后端、RAG、管理员上传到底有没有工作。

不要先看代码。先照这个文件操作。

## 0. 先记住一句话

当前项目没有 MySQL、SQLite、向量数据库。

现在的 RAG 库是本地文件：

```text
data/works.json
data/work_*/knowledge.json
knowledge/*.md
```

也就是说：

- 管理员上传作品后，会写入本地文件。
- RAG 问答时，后端会读取这些文件。
- 作品页里的“提交反思”不会写入 RAG，只保存在浏览器本地。

## 1. 启动前后端

打开 PowerShell，运行：

```powershell
cd D:\技术学习\CalliLens
.\start-demo.ps1
```

启动后不要关掉这个窗口。

然后打开两个页面：

```text
前端页面：http://127.0.0.1:5190/web/
后端接口：http://127.0.0.1:8000/docs
```

如果 `http://127.0.0.1:8000/docs` 打不开，说明后端没启动成功。

## 2. 最简单的后端存活测试

打开：

```text
http://127.0.0.1:8000/docs
```

找到：

```text
GET /api/health
```

操作：

1. 点开 `GET /api/health`
2. 点 `Try it out`
3. 点 `Execute`

成功结果：

```json
{
  "status": "ok"
}
```

看到这个，说明后端活着。

## 3. 测试作品列表

在 `/docs` 页面找到：

```text
GET /api/works
```

操作：

1. 点开 `GET /api/works`
2. 点 `Try it out`
3. 点 `Execute`

你应该能看到类似：

```json
{
  "defaultWorkId": "work_003",
  "works": [
    {
      "id": "work_003",
      "title": "赵孟頫《光福重建塔记》"
    }
  ]
}
```

如果你上传过新作品，还会看到：

```text
work_001
work_002
```

这说明作品已经写入：

```text
data/works.json
```

## 4. 测试单个作品详情

在 `/docs` 页面找到：

```text
GET /api/works/{work_id}
```

操作：

1. 点开接口
2. 点 `Try it out`
3. 在 `work_id` 填：

```text
work_003
```

4. 点 `Execute`

成功结果里应该有：

```text
赵孟頫《光福重建塔记》
上海博物馆
行书
```

如果这里失败，说明作品索引或作品文件有问题。

## 5. 测试 RAG 知识库有没有读到资料

在 `/docs` 页面找到：

```text
GET /api/knowledge
```

操作：

1. 点开接口
2. 点 `Try it out`
3. 点 `Execute`

重点看两个地方：

```json
{
  "count": 49,
  "chunks": []
}
```

判断标准：

- `count` 大于 0，说明 RAG 读到了资料。
- `chunks` 里面有 `work_003`，说明默认作品资料进入 RAG。
- 如果你上传过作品，里面有 `work_001` 或 `work_002`，说明上传作品也进入 RAG。

## 6. 测试 RAG 问答

在 `/docs` 页面找到：

```text
POST /api/ask
```

操作：

1. 点开接口
2. 点 `Try it out`
3. 把请求内容改成：

```json
{
  "work_id": "work_003",
  "question": "赵孟頫是谁？",
  "use_llm": false
}
```

4. 点 `Execute`

成功结果应该有：

```json
{
  "answer": "...",
  "sources": [
    {
      "title": "...",
      "source": "..."
    }
  ],
  "mode": "local_rag"
}
```

判断标准：

- `answer` 有中文回答。
- `sources` 不是空数组。
- `mode` 是 `local_rag`。

这说明不用 API key，本地 RAG 也能回答。

## 7. 测试“当前有没有数据库”

继续用：

```text
POST /api/ask
```

请求内容：

```json
{
  "work_id": "work_003",
  "question": "现在有数据库吗？",
  "use_llm": false
}
```

成功回答应该说明：

```text
当前没有 MySQL、SQLite、向量数据库。
当前使用本地文件型知识库。
```

这就是答辩时要说的版本。

## 8. 测试管理员登录

在 `/docs` 页面找到：

```text
POST /api/admin/login
```

操作：

1. 点开接口
2. 点 `Try it out`
3. password 填：

```text
callilens-admin
```

4. 点 `Execute`

成功结果：

```json
{
  "ok": true,
  "role": "admin"
}
```

## 9. 测试管理员上传作品

注意：这个测试会真的新增文件。

在前端页面测试更简单：

```text
http://127.0.0.1:5190/web/
```

操作：

1. 进入首页
2. 点管理员/上传入口
3. 输入口令：

```text
callilens-admin
```

4. 选择一张书法图片
5. 填作品名称、作者、简介、背景资料
6. 如果已经配置 AI，可以勾选 `上传后生成 AI 候选导览草稿`
7. 点 `上传并处理`

成功后页面应该显示：

```text
上传完成：work_xxx
生成文件：thumbnail.png、mask.png、height.png...
```

然后检查文件夹：

```text
data/work_xxx/
```

里面应该有：

```text
original.png
thumbnail.png
mask.png
height.png
floating_3d_data.json
work-info.json
knowledge.json
ai-guide-draft.json
```

其中：

```text
knowledge.json
```

就是这个新作品进入 RAG 的资料。

如果勾选了 AI 候选导览，还会生成：

```text
ai-guide-draft.json
```

这个文件会被保存下来，后续打开作品时直接读取，不会每次重复调用 API。

## 10. 上传后怎么确认 RAG 真的用了新作品

假设上传后生成的是：

```text
work_001
```

打开：

```text
POST /api/ask
```

请求：

```json
{
  "work_id": "work_001",
  "question": "这件作品是什么？",
  "use_llm": false
}
```

成功标准：

- `answer` 里出现你上传时填写的作品简介。
- `sources` 里出现 `work_001` 的来源。

如果 answer 没有用到你上传的简介，说明 `knowledge.json` 没有写好，或者问题没有命中关键词。

## 11. 怎么删除指定作品

推荐从前端删：

```text
http://127.0.0.1:5190/web/
```

操作：

1. 进入管理员后台。
2. 如果看不到口令框，说明浏览器已经记住登录状态，直接在后台点 `退出后台 / 重新登录`。
3. 重新输入口令：

```text
callilens-admin
```

4. 在 `作品管理` 区域找到要删除的作品。
5. 点 `删除`。

注意：

- `work_003` 是默认演示作品，不能删。
- 删除上传作品时，会删除 `data/work_xxx/` 目录。
- 删除后，这个作品的 `knowledge.json` 也会消失，所以 RAG 不会再检索到它。

也可以在后端 `/docs` 里测：

```text
DELETE /api/admin/works/{work_id}
```

例如：

```text
work_002
```

## 12. AI 怎么接入使用

默认不用 AI key，RAG 也能运行。

如果你要接 AI，它只是“润色回答”，不是让 AI 自由编造。

API 只能由管理员后台配置，普通用户前端不显示 API key、模型、接口地址。

前端操作：

1. 进入管理员后台。
2. 找到 `AI 配置（可选）`。
3. 选择提供商。
4. 填 API key。
5. 如果要让普通问答自动使用 AI，勾选 `启用 AI 润色`。
6. 点 `保存 AI 配置`。
7. 回到作品页 RAG 问答区直接提问。

如果你用火山方舟豆包的 OpenAI 兼容格式，可以填：

```text
提供商：火山方舟 / 豆包（OpenAI 兼容）
模型：doubao-seed-2-0-lite-260428
接口地址：https://ark.cn-beijing.volces.com/api/v3/chat/completions
API key：你的 ark-xxxx
```

如果控制台给你的模型 ID 不同，以火山方舟控制台为准。

配置会保存到：

```text
.env.local
```

不会提交到 Git。

建议答辩时这样说：

```text
没有 API key 时，系统使用本地 RAG 模板回答。
有 API key 时，系统先检索本地资料，再让大模型基于资料润色表达。
AI 不负责凭空补充事实。
```

## 13. 为什么上传作品没有默认人工导览

这是当前项目必须讲清楚的边界。

默认作品 `work_003` 的导览点是人工整理过的，所以有意义。

管理员上传的新作品，系统可以自动生成：

```text
原图
缩略图
mask
height map
平滑浮雕 3D
work-info.json
knowledge.json
```

如果管理员勾选 AI 候选导览，系统还会生成：

```text
ai-guide-draft.json
```

但它只能叫：

```text
AI 候选导览草稿
```

不能叫：

```text
专家导览
```

但是系统不能可靠自动生成：

```text
每个字是什么字
哪里一定是气脉
哪里一定是审美重点
专家级人工导览点
真实笔顺
书法水平评价
```

所以第一版策略是：

```text
默认作品：完整人工导览 + 3D + RAG
上传作品：基础图像处理 + 3D + RAG 资料
可选增强：AI 候选导览草稿，保存后展示，但必须标注为需人工确认
```

这样更诚实，也更容易答辩。

如果后续要扩展，可以做“管理员半自动标注”：

1. 系统自动给出候选区域，例如重墨、飞白、留白。
2. 管理员只负责选择和改文字。
3. 不要求管理员精准圈每一个字。
4. 不说系统自动识别气韵，只说系统提供候选观察点。

## 14. 一键脚本测试

我还提供了一个只读测试脚本：

```powershell
.\scripts\test_backend_readonly.ps1
```

它会自动测试：

```text
/api/health
/api/works
/api/knowledge
/api/ask
/api/admin/login
```

它默认不会上传作品，不会修改数据。

如果全部显示 `OK`，说明后端基础功能可用。

## 15. 常见问题

### 15.1 我点了“提交反思”，为什么数据库没变化？

因为“提交反思”不写 RAG。

它只是保存到浏览器 localStorage，用来演示用户观察记录。

真正写 RAG 的是：

```text
管理员后台 -> 上传书法作品
```

### 15.2 我上传了，为什么前端没看到？

先检查：

```text
GET /api/works
```

如果这里有新作品，说明后端已经写入了。

然后刷新前端作品库：

```text
http://127.0.0.1:5190/web/
```

### 15.3 我看到 PowerShell 中文乱码怎么办？

优先看浏览器页面和 `/docs` 的返回。

PowerShell 有时会把 UTF-8 中文显示成乱码，但文件和接口本身可能是正常的。

### 15.4 我没有 API key，RAG 能用吗？

能。

测试时保持：

```json
"use_llm": false
```

这就是本地 RAG 模式，不需要付费 API。

## 16. 最短测试路线

如果你只想快速确认能不能演示，按这个顺序：

```text
1. 运行 .\start-demo.ps1
2. 打开 http://127.0.0.1:8000/docs
3. 测 GET /api/health
4. 测 GET /api/works
5. 测 GET /api/knowledge
6. 测 POST /api/ask，问题填“赵孟頫是谁？”
7. 打开 http://127.0.0.1:5190/web/
8. 前端问 RAG：“现在有数据库吗？”
```

这 8 步都通过，就说明后端和 RAG 可以演示。
