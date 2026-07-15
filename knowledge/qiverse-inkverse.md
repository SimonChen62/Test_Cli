# QiVerse / InkVerse 体验说明

## 核心定位

QiVerse 不是把书法作品挂进虚拟展厅，而是把书法中的“动作、势、留白”做成可进入的空间体验。CalliLens 负责作品资料、OpenCV 图像处理、平滑浮雕 3D、本地 RAG 和管理员上传；QiVerse 负责沉浸式视觉体验。

当前版本是桌面优先、WebXR 可增强的 Three.js 原型。它读取作品的 OpenCV 高度图生成整幅星点长卷，并在默认作品赵孟頫《光福重建塔记》上叠加人工制作的 stroke、qiLink 和 voidRegion 数据。

## 老师文档对应关系

老师文档要求用户经历：

Original → Enter the Ink → Ride the Stroke → Follow the Qi → Walk into the Void → Return to the Original

当前 QiVerse P0 补缺版对应为：

- Stardust / 星尘：作品墨迹被拆成星点。
- Character Constellation / 成字：星点归位，组成整幅长卷。
- Enter the Ink / 入墨：镜头靠近墨迹，重墨区域在 Z 轴上更突出。
- Ride the Stroke / 御笔而行：人工 stroke 数据生成 3D Ribbon / Ink Wall，镜头沿笔势穿行。
- Follow the Qi / 追势：人工 qiLink 生成淡金粒子流，提示“墨断，势未必断”。
- Walk into the Void / 入白：人工 voidRegion 将字内、字间、行间留白可视化。
- Return / 回看：回到原作并选择反思标签。

## 数据边界

QiVerse 使用两类数据：

1. 图像生成数据：来自 `data/{work_id}/height.png`，由 OpenCV 从墨迹图像生成。上传作品即使没有人工标注，也可以生成不同的星点长卷。
2. 人工解释数据：来自默认 `qiverse/calligraphy-work.json`，或由作品元数据声明的 `data/{work_id}/qiverse-work.json`，包含 `strokes`、`qiLinks`、`voidRegions` 和 `reflectionPrompts`。

如果上传作品没有声明人工解释数据，QiVerse 只展示星点长卷，不显示假的笔画、气脉或留白标注。

## 为什么允许人工数据

老师文档明确允许 MVP 第一版使用人工制作的笔画、气脉和留白数据，不要求全自动图像分析。因为真实笔顺、气脉和留白解释都具有审美和专家判断成分，不能简单说成算法自动识别。当前项目将它们标注为“解释性可视化”，避免夸大 AI 或 OpenCV 的能力。

## RAG 应如何回答

如果用户问“Follow the Qi 是不是算法识别气韵？”，系统应回答：不是。当前版本是基于人工解释性标注和图像特征的展示，不自动判断气韵、书法水平、真伪或真实笔顺。

如果用户问“上传新作品后 QiVerse 会变吗？”，系统应回答：会。星点长卷会根据该作品的 height.png 改变；但如果管理员没有声明并补充 qiverse-work.json，系统不会显示假的 Ribbon、QiLink 或 Void 标注。

如果用户问“为什么要做 QiVerse？”，系统应回答：QiVerse 用空间化的方式帮助普通观众理解书法不是静止线条，而是动作痕迹、断续关系和留白共同组织的视觉体验。
