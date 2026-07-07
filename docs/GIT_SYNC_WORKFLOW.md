# 小组 Git 同步流程

本项目默认远端仓库是：

```text
https://github.com/SimonChen62/Test_Cli.git
```

不要把 CalliLens 强推到其他仓库，尤其不要覆盖 `maoyouaa/DisabledAssistAppre` 的原内容。

## 每次开始写之前

先拉最新代码：

```powershell
git pull --rebase origin main
```

如果不会处理 Git，直接运行：

```powershell
.\sync-git.ps1 -Message "Update before work"
```

它会先拉远端，再处理本地改动。

## 每次改完之后

运行：

```powershell
.\sync-git.ps1 -Message "说明你改了什么"
```

例子：

```powershell
.\sync-git.ps1 -Message "Refine work 003 annotations"
```

脚本会做：

1. 暂存你本地未提交改动
2. 拉取远端最新内容
3. 恢复你的本地改动
4. 自动提交
5. 推送到远端

## 如果脚本提示冲突

不要继续 push。

把冲突文件发到组群里，说明谁改了哪里。解决冲突后再运行：

```powershell
.\sync-git.ps1 -Message "Resolve sync conflict"
```

## 组员分工建议

- 作品和图片：只改 `data/work_003/original.png`、`work-info.md`
- OpenCV 图层：只运行 `scripts/process_work.py`
- 标注文案：优先改 `data/work_003/annotation-draft.md`
- 正式数据：由一个人统一同步到 `data/work_003/annotation.json`
- 前端展示：只改 `web/`

不要多人同时改同一个 JSON 文件。最容易冲突的是：

```text
data/work_003/annotation.json
web/app.js
web/styles.css
```

## 推荐群公告

每个人开始前先拉，结束后运行：

```powershell
.\sync-git.ps1 -Message "你的修改说明"
```

如果冲突，不要强推，先在群里说。

