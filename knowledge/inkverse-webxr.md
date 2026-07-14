# InkVerse WebXR 任务说明
source: 老师任务书《InkVerse · 入墨：沉浸式中国书法 WebXR 体验》

## InkVerse 的核心定位
InkVerse 不是“VR 看书法展”，而是让用户进入笔画、沿笔势穿行、追随气脉、进入留白，并最终回到原作。项目面向普通公众，目标是在 5-10 分钟内通过空间、运动和身体参与，理解笔势、气脉、飞白、节奏与留白。

## 与 CalliLens 的关系
当前 CalliLens 已经有作品展示、OpenCV 墨迹提取、Three.js 3D 展示和本地 RAG。InkVerse 可以作为下一阶段沉浸式体验层：CalliLens 负责资料、作品、图像处理和问答解释，InkVerse 负责“进入墨迹”的 WebXR/3D 体验。两者不冲突，RAG 可以为每个体验节点解释“为什么这样设计”。

## 最终体验链
老师任务书要求的体验链是 Original → Enter the Ink → Ride the Stroke → Follow the Qi → Walk into the Void → Return to the Original。对应中文理解是：先看原作，再进入墨迹，沿笔画穿行，追随气脉，进入留白空间，最后回到原作并反思。

## MVP 范围
MVP 必须同时支持 Desktop Mode 与 WebXR / VR Mode。第一版允许使用人工制作的笔画、气脉和留白数据，不要求全自动图像分析。所有特效必须服务于书法特征解释，禁止无数据来源的随机视觉特效。科普文本应短，优先“体验 - 发现 - 反思”，而不是长篇阅读。

## P0 核心任务
P0 核心链包括 T01 基础 WebXR 场景、T02 作品展示与“墨醒”场景、T03 书法笔画数据模型、T04 二维笔画到三维墨迹空间化、T05 沿笔画沉浸式穿行、T07 气脉流动、T09 留白数据模型、T10 进入留白空间、T12 完整体验状态机、T13 回到原作与反思交互。

## 老师新文档要求是什么
老师新文档的核心要求是：项目不能只是“VR 看书法展”，必须让用户进入笔画、沿笔势穿行、追随气脉、进入留白，并最终回到原作。MVP 要同时考虑 Desktop Mode 和 WebXR / VR Mode，但第一版允许人工制作 stroke、qiLink 和 voidRegion 数据，不要求全自动图像分析。

## P1 与 P2 怎么理解
P1 是重要增强，包括飞白与墨粒粒子、多尺度气脉转换、空间音效、用户行为日志和性能优化。P2 是未来扩展，例如 AI 自动识别、多人 VR、AR、完整毛笔物理。当前课程演示不应一开始就做 P2，否则风险过高。

## 为什么先做 InkVerse Lite
当前 CalliLens 已经有稳定作品页、平滑浮雕 3D、本地 RAG 和管理员后台。为了避免项目过度抽象，下一分支先做 Desktop 轻量版 InkVerse：复用原作、全文 3D 浮雕、气脉观察和反思模块，串成 Original → Enter the Ink → Follow the Qi → Return 的短体验链。完整 Ride the Stroke、Walk into the Void 和 WebXR 放到后续阶段。

## 3D 墨迹空间化
T04 要求把静态笔画转换为可进入的三维墨迹结构。实现上可以根据 stroke path 构建 CatmullRomCurve3，使用可变宽 RibbonGeometry 或 BufferGeometry 生成笔画。width 驱动笔画宽度，inkDensity 驱动透明度、粗糙度或 shader 参数。进入墨迹时，笔画从纸面逐渐沿 Z 轴升起，形成空间深度。

## 飞白与墨粒
T06 把飞白、墨迹破碎和墨粒悬浮做成数据驱动效果。flyingWhite 区域应减少连续 Ribbon 的可见度并增加墨粒，但视觉效果应像墨迹破碎，不能变成彩色烟花式特效。飞白效果应由数据字段触发，而不是随机出现。

## 气脉与形断势连
T07 要求根据 qiLinks 数据生成两笔之间的气脉路径。笔画 A 结束后，墨粒继续沿气脉路径流动并连接笔画 B。系统可以显示“墨迹已断，势未必断”或“形断，势连”。气脉视觉应轻、细、若隐若现，不能用粗大彩色箭头。

## 留白空间
T09 和 T10 要求把留白做成可进入空间。voidRegion 至少支持 id、type、polygon、depth，类型可包括字内留白、字间留白、行间留白和飞白。进入留白时，墨迹逐渐消失，空间转为白色或浅灰，让用户感受“窄 - 过渡 - 开放”的空间呼吸。

## RAG 如何结合 InkVerse
RAG 不负责生成随机特效，也不负责自动评价书法水平。RAG 的作用是给体验节点提供有来源的解释：用户在 Enter the Ink、Ride the Stroke、Follow the Qi、Walk into the Void 或 Return to the Original 阶段提问时，系统先检索作品背景、书法术语、老师任务要求和技术说明，再生成简短回答，并显示来源。

## 答辩表述
可以这样介绍融合方案：CalliLens 作为作品资料与本地 RAG 导览底座，InkVerse 作为 WebXR 沉浸式体验层。OpenCV 提供墨迹、厚度和候选区域，人工数据补充 stroke、qiLink 与 voidRegion，Three.js/WebXR 负责把这些数据转成可进入的空间体验，RAG 负责解释每个体验节点的书法含义和技术来源。
