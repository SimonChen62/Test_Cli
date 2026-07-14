# CalliLens 用户数据库使用说明

当前分支新增的是轻量用户记录系统，不是复杂账号平台。

## 存什么

- 用户账号：用户名、密码哈希、角色。
- 进入作品记录：用户、作品、进入时间。
- 第一印象：整体感觉、运动感、疏密判断。
- 反思文字：用户、作品、观察点、反思内容。

密码不会明文保存，后端只保存 `password_hash`。

## 本地怎么用

本地不需要安装 MySQL，也不用单独启动数据库。

```powershell
.\start-demo.ps1
```

打开：

```text
http://127.0.0.1:5190/web/
```

操作路线：

1. 首页左侧“用户记录”区域输入用户名和密码。
2. 第一次使用点“注册”。
3. 之后使用同一账号点“登录”。
4. 进入作品并填写“第一印象”。
5. 提交反思。
6. 进入管理员后台，口令 `callilens-admin`。
7. 点击“用户记录”，查看账号、进入作品、第一印象和反思。

本地数据库文件会自动创建在：

```text
backend/data/callilens.db
```

这个目录已加入 `.gitignore`，不会把真实账号和反思推到 GitHub。

## Render 怎么用

代码优先读取环境变量：

```text
DATABASE_URL
```

如果 Render 配了 PostgreSQL 的 `DATABASE_URL`，后端会自动使用 PostgreSQL。

如果没有 `DATABASE_URL`，后端会退回 SQLite。Render 免费 Web Service 的运行时文件不适合长期保存，所以线上长期使用建议配置 PostgreSQL。

## API

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/sessions/start
POST /api/first-look
POST /api/reflections
GET  /api/admin/user-records
```

前端会自动调用这些接口；新手测试不需要手写请求。

## 项目边界

这一版不做邮箱、验证码、找回密码、头像和复杂权限。目标只是让课程展示能说明：

> 用户账号和反思记录属于运行时数据，保存在数据库中；代码和默认演示作品由 GitHub 管理。
