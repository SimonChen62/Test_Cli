# CalliLens

CalliLens 是一个面向普通人的中国书法鉴赏交互式导览 Demo。当前 V1 只做单作品展示：OpenCV 生成视觉证据图，人工确认气脉、虚实留白和笔墨轻重标注，前端负责交互展示和语音导览。

## 项目边界

- 不训练模型
- 不自动判断气韵或审美价值
- 不还原真实笔顺
- 不检测真实力道
- OpenCV 只生成辅助图层
- 气脉、虚实、笔墨解释必须来自人工标注

## 目录结构

```text
CalliLens/
  data/work_001/
    original.png              # 组员 A 放入作品原图
    binary.png                # 脚本生成：黑白墨迹图
    skeleton.png              # 脚本生成：骨架图
    stroke_width.png          # 脚本生成：粗细热力图
    ink_density.png           # 脚本生成：墨色浓淡图
    void_candidates.png       # 脚本生成：留白候选图
    annotation.json           # 人工标注结果
    annotation-draft.md       # 人工标注草稿
    guide-text.md             # 语音导览文案
    work-info.md              # 作品信息和来源
  scripts/process_work.py     # OpenCV 辅助图生成脚本
  web/                        # 静态交互 Demo
  docs/                       # 标注指南、协作流程、参考资料
```

## 快速开始

1. 将第一幅书法作品裁剪图放到 `data/work_001/original.png`。
2. 安装依赖：

```powershell
python -m pip install -r requirements.txt
```

3. 生成 OpenCV 辅助图：

```powershell
python scripts/process_work.py --work data/work_001
```

4. 根据辅助图填写 `data/work_001/annotation.json`。
5. 启动本地网页：

```powershell
python -m http.server 5173
```

6. 浏览器打开 `http://localhost:5173/web/`。

## 前后端接口

V1 先使用静态 JSON 作为接口：

- 数据文件：[data/work_001/annotation.json](data/work_001/annotation.json)
- 接口契约：[docs/INTERFACE_CONTRACT.md](docs/INTERFACE_CONTRACT.md)
- JSON Schema：[data/annotation.schema.json](data/annotation.schema.json)

如果后端同学要写接口，先实现：

```text
GET /api/works/work_001
```

响应结构必须和 `data/work_001/annotation.json` 保持一致。

## 第一周验收

- `original.png` 已放入
- 5 张 OpenCV 辅助图已生成
- 至少 2 条气脉路径
- 至少 2 个虚实/留白区域
- 至少 1 个笔墨轻重区域
- 每个标注都有 `formal`、`perception`、`aesthetic`
- 网页可切换图层和模式
- 可点击标注查看解释
- 可播放浏览器语音导览
