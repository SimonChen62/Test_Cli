# CalliLens + QiVerse P0 补缺任务书

## 1. 目标

本版目标是把 QiVerse 从“星点点云动画”升级为能回应老师 P0 验收点的可演示版本。它不重做完整 WebXR 工程，而是在现有 `qiverse/` 静态 Three.js 页面上补齐：

- T03：`calligraphy-work.json` 数据模型。
- T05 替代方案：整卷阅读波，替代无法可靠实现的真实笔画 Ribbon。
- T09：QiLink 动态气脉粒子。
- T12/T13：留白区域可视化。
- T18：Return + Reflection UI。

## 2. 当前实现

QiVerse 页面入口：

```text
http://127.0.0.1:5190/qiverse/?work=work_003
```

默认作品：

```text
赵孟頫《光福重建塔记》
```

数据来源：

- `data/work_003/height.png`：OpenCV 高度图，用于生成整幅星点长卷。
- `qiverse/calligraphy-work.json`：人工解释性示例数据，包含 5 条 stroke、3 条 qiLink、3 个 voidRegion。
- 可选 `data/{work_id}/qiverse-work.json`：后续管理员或组员可为新作品补充专属 QiVerse 数据；作品元数据需声明 `qiverse_work: true` 或 `qiverse_data_path` 后前端才会加载，避免没有文件时控制台 404。

## 3. 功能说明

### 3.1 星点长卷

系统读取当前作品的 `height.png`，在浏览器 Canvas 中采样亮度，再生成 Three.js Points。墨迹越重，星点越密、越亮、Z 轴越突出。

上传作品只要后端图像处理生成了 `height.png`，QiVerse 星点长卷就会随作品变化。

### 3.2 整卷阅读波

当前版本不再伪造单笔笔画。系统直接使用整幅 `height.png` 生成的星点墨迹，在“游卷”阶段加入从右上到左下的动态阅读波。波经过的位置会发亮、抬高、拖出轻微流动感，用来表现长卷观看方向和整体气势。

这不是恢复真实笔顺，也不是识别每一笔，而是基于整幅墨迹图像的全卷动态导览。

### 3.3 QiLink

`qiLinks[]` 生成淡金色动态粒子路径，用来表现“墨断，势未必断”。它不是算法自动判断气韵，不显示置信度数字，也不作为书法评分。

### 3.4 Void Region

`voidRegions[]` 将字内、字间、行间留白做成半透明空间体。入白阶段墨迹淡出，留白区域显现，帮助观众理解“空白也参与结构”。

### 3.5 Return Reflection

Return 阶段出现反思标签：运动感、节奏、留白、墨色、气脉、其他。选择后写入浏览器 localStorage，用户可带着关键词回到 CalliLens 原作页继续观看。

## 4. 边界

当前版本不做：

- 不恢复真实笔顺。
- 不自动判断气韵。
- 不评价书法水平。
- 不判断真伪。
- 不把随机粒子当成学术分析。
- 不要求 VR 设备才能演示。

如果上传作品没有声明 `qiverse_work` 或 `qiverse_data_path`，系统只展示基于高度图的星点长卷，不显示假的 stroke、QiLink 或 Void 标注。

## 5. 测试路线

启动：

```powershell
.\start-demo.ps1
```

打开：

```text
http://127.0.0.1:5190/qiverse/?work=work_003
```

检查：

1. 页面中文正常。
2. 点击“开始入墨”后，星点从星尘聚成整幅长卷。
3. 点击“游卷”，能看到整幅墨迹上出现从右到左、从上到下的动态发光阅读波。
4. 点击“追势”，能看到淡金粒子沿 QiLink 动态流动。
5. 点击“入白”，能看到留白区域可视化。
6. 点击“回看”，能选择反思标签。
7. 打开上传作品的 QiVerse，如果没有人工数据，只显示星点长卷和边界提示。

命令行检查：

```powershell
node --check qiverse\qiverse.js
node --check web\app.js
python -m unittest
```

## 6. 答辩表述

可以这样介绍：

> QiVerse 是 CalliLens 的沉浸式体验层。它先用 OpenCV 高度图把整幅书法转换成星点长卷，再用从右上到左下的动态阅读波表现长卷观看方向和整体气势，并用 QiLink 与 Void Region 辅助说明“形断势连”和“留白参与结构”。我们不声称自动识别真实笔顺或气韵，而是把图像特征和人工标注转化为可感知的空间体验。
