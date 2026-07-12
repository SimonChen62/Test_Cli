# CalliLens 新手协作说明

这版协作不要追求复杂流程。先用“一个人负责一类文件”的方式，把第一版 Demo 跑通。

## 推荐分工

### 组员 A：图片与来源

只管：

- 作品图片
- 裁切
- 来源说明

当前已经完成：

- 原图已归档在本地 `data/source/Zmf_full.jpg`
- 当前局部图已保存为 `data/work_001/original.png`
- 需要补充作品来源或授权说明

### 组员 B：OpenCV 辅助图

只管运行脚本：

```powershell
python -m pip install -r requirements.txt
python scripts/process_work.py --work data/work_001
```

生成结果：

- `binary.png`
- `skeleton.png`
- `stroke_width.png`
- `ink_density.png`
- `void_candidates.png`

注意：这些图只是“证据图”，不能写成自动审美判断。

### 组员 C：人工标注

只管填写：

- `data/work_001/annotation-draft.md`
- `data/work_001/annotation.json`
- `data/work_001/guide-text.md`

最低数量：

- 2 条气脉路径
- 2 个虚实/留白区域
- 1 个笔墨轻重区域

每个标注必须有：

- 形式描述
- 感知经验
- 美学解释

### 组员 D：网页展示

只管检查：

- 页面能打开
- 图层能切换
- 气脉路径有动画
- 虚实区域能高亮
- 点击标注后右侧解释能显示
- 语音导览能播放

启动方式：

```powershell
python -m http.server 5173
```

打开：

```text
http://localhost:5173/web/
```

## Git 怎么办

如果你们都没经验，建议分两步：

### 第一步：先本地跑通

现在先不要急着 Git。先把 Demo 跑通，避免大家在 Git 上互相覆盖文件。

### 第二步：再建 Git 仓库

等 Demo 能展示后，再由一个人统一执行：

```powershell
git init
git add README.md requirements.txt scripts web docs data/work_001
git status
git commit -m "Initialize CalliLens demo"
```

不要上传：

- `data/source/`
- `data/work_001/candidates/`
- `data/work_001/*_full.png`
- `data/work_001/preview_layers.png`

这些已经写进 `.gitignore`。

## 群里可以这样发任务

A：请确认这张作品来源，补 `work-info.md` 的作者、年代、来源。

B：请运行 OpenCV 脚本，确认 5 张辅助图是否生成。

C：请根据 `docs/ANNOTATION_GUIDE.md`，先在 `annotation-draft.md` 写 5 个标注点。

D：请打开网页，检查图层、标注点击和语音导览。

