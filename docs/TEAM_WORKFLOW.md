# 小组协作流程

## A：作品与资料

产出：

- `data/work_001/original.png`
- `data/work_001/work-info.md`

步骤：

1. 选择第一幅行书作品或局部。
2. 裁剪成适合网页展示的单图。
3. 记录作者、作品、来源、授权或公开来源说明。
4. 保存为 `data/work_001/original.png`。

## B：OpenCV 处理

产出：

- `data/work_001/binary.png`
- `data/work_001/skeleton.png`
- `data/work_001/stroke_width.png`
- `data/work_001/ink_density.png`
- `data/work_001/void_candidates.png`

步骤：

1. 确认 `original.png` 已存在。
2. 运行：

```powershell
python scripts/process_work.py --work data/work_001
```

3. 检查五张图是否可读、是否能辅助判断。
4. 如果二值化效果不好，记录问题，再调整脚本参数。

## C：人工解释与导览

产出：

- `data/work_001/annotation.json`
- `data/work_001/annotation-draft.md`
- `data/work_001/guide-text.md`

步骤：

1. 根据 `docs/ANNOTATION_GUIDE.md` 选择标注点。
2. 至少写 2 条气脉路径、2 个虚实留白区域、1 个笔墨轻重区域。
3. 每个标注都填写 `formal`、`perception`、`aesthetic`。
4. 把最终内容同步到 `annotation.json`。

## D：前端展示

产出：

- `web/index.html`
- `web/styles.css`
- `web/app.js`

步骤：

1. 启动本地服务器：

```powershell
python -m http.server 5173
```

2. 打开 `http://localhost:5173/web/`。
3. 检查图层切换、模式切换、标注点击和语音导览。

## 合并前检查

- 不要把“OpenCV 生成图层”写成“自动审美判断”
- 不要把“笔墨轻重线索”写成“真实力道检测”
- `annotation.json` 必须是合法 JSON
- 所有标注解释必须能对应到图上可见证据

