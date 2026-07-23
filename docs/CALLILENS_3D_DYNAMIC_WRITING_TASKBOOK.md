# CalliLens 3D 动态书法字形任务书

## 目标

本阶段实现“单字书法墨迹的三维动态运笔示范”。系统从人工确认的单字 ROI 中提取墨迹 mask、骨架线、局部笔画粗细，再导出 `character_3d_data.json`，由 Three.js 在网页端重建动态书写轨迹。

## 技术路线

- 单字切分：V1 使用人工确认的 `glyph-boxes.json`，PP-OCR 仅作为后续候选检测方案，不承诺行草书全自动精准切字。
- 骨架提取：优先使用 `cv2.ximgproc.thinning`，环境没有 `opencv-contrib-python` 时使用内置 Zhang-Suen thinning。
- 粗细计算：使用 `cv2.distanceTransform`，骨架点所在位置的距离值映射为 `thickness`。
- Z 轴映射：笔画越粗，`z` 越低，即 `z = -thickness * depthScale`，用于表达压笔下沉。
- 时间轴：按骨架路径估计顺序生成 `t: 0.0 -> 1.0`，这是几何估计，不是真实笔顺复原。

## 交付文件

- `scripts/preprocess_character_3d.py`
- `data/work_003/character_3d/character_3d_data.json`
- `data/work_003/character_3d/character_3d_meta.json`
- `data/work_003/character_3d/character_rois/`
- `data/work_003/character_3d/character_masks/`
- `web/3d-glyph/index.html`
- `web/3d-glyph/main.js`

## 运行方式

生成轨迹数据：

```powershell
python scripts/preprocess_character_3d.py --work data/work_003 --glyph-id fu --output data/work_003/character_3d
```

访问网页：

```text
http://127.0.0.1:5173/web/3d-glyph/
```

## 答辩口径

可以说：

> 系统从书法图像中提取单字墨迹结构，使用骨架和距离变换估计笔画轨迹、粗细和压笔深度，再用 Three.js 生成三维动态书写示范。

不要说：

> 系统自动恢复了书法家的真实笔顺。

> 系统可以自动精准切完整幅行草长卷中的所有字。

> 系统能评价书法水平。
