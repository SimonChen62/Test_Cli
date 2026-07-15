# CalliLens + QiVerse Lite 实验分支任务书

## 1. 分支目标

当前分支 `codex/qiverse-lite-experiment` 用来验证老师 QiVerse / InkVerse 文档里的沉浸式书法体验要求。

本分支不替换 CalliLens 主系统。CalliLens 继续负责作品库、RAG、3D 浮雕、管理员上传和用户反思记录；QiVerse Lite 作为独立实验入口，验证 WebXR/Three.js 沉浸体验是否可行。

## 2. 为什么这样做

老师文档要求的完整 WebXR 项目很大，包括 TypeScript、Vite、Three.js、WebXR、状态机、笔画路径、气脉、留白、声音、行为日志和最终视频。

如果直接重构主项目，风险太高。当前更合理的路线是：

1. 先做桌面可运行的 QiVerse Lite。
2. 验证体验链是否成立。
3. 再决定是否独立升级为完整 Vite + TypeScript + WebXR 工程。

## 3. 当前实现

新增：

```text
qiverse/
  index.html
  styles.css
  qiverse.js
  calligraphy-work.json
knowledge/qiverse-inkverse.md
docs/QIVERSE_LITE_TASKBOOK.md
```

现有作品页新增入口：

```text
QiVerse 实验
```

## 4. MVP 体验链

当前已实现：

1. Original：显示赵孟頫《光福重建塔记》原作平面。
2. Enter the Ink：墨迹 ribbon 从纸面升起。
3. Ride the Stroke：相机沿人工标注笔画路径移动。
4. Follow the Qi：淡金线和粒子提示形断势连。
5. Walk into the Void：字内、字间、行间留白转成空间块。
6. Return：回到原作视角。

## 5. 数据边界

`qiverse/calligraphy-work.json` 中的 `strokes`、`qiLinks`、`voidRegions` 是人工解释性数据。

它们不是：

1. 真实笔顺识别结果。
2. 书法水平评分。
3. 真伪鉴定。
4. 自动气韵判断。

答辩时应表述为：

> 当前 QiVerse Lite 是基于人工标注和图像特征的解释性可视化，用来帮助普通观众理解动作痕迹、形断势连和留白参与结构。

## 6. 测试路线

启动：

```powershell
.\start-demo.ps1
```

打开：

```text
http://127.0.0.1:5190/qiverse/
```

测试：

1. 页面能加载原作图像。
2. 点击 Original、Enter Ink、Ride Stroke、Follow Qi、Walk Void、Return 都有明显变化。
3. 点击“播放体验链”能自动串联状态。
4. 鼠标拖动画布能旋转视角。
5. 无 WebXR 设备时按钮显示 Desktop Mode 或当前浏览器无 XR。

## 7. 下一步

如果老师认可这个方向，后续再做：

1. 独立 Vite + TypeScript 工程。
2. 更完整的 stroke / qi / void 数据编辑工具。
3. Meta Quest Browser 真机测试。
4. 声音和低频反馈。
5. 行为日志和 60-120 秒演示视频。
