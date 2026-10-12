# 归结演绎推理课堂投票

题目：**若一次归结没有推出矛盾，能否说明原推理不成立？**

- A：能
- B：不能

手机页 `index.html` 采用浅蓝背景、白色圆角卡片和大按钮；`results.html` 用于教师投屏，包含题目、自动生成的二维码、人数和比例。二维码使用投屏页所在站点的实际地址生成，无需外部二维码服务。

## 首次部署

1. 在你的 Supabase **Supabase-Vote** 项目中运行 `supabase-setup.sql`。脚本只创建本题专用的 `resolution_rounds` 和 `resolution_votes`，不修改旧欧拉图投票项目或其数据。
2. `config.js` 已连接到 Supabase-Vote 项目，并使用 publishable key。不要填 secret 或 service_role 密钥。
3. 在 GitHub 账号 **1nkmark** 下创建公开仓库 `Supabase-Vote`，上传本目录文件（排除 `node_modules`、`artifacts`）。
4. 仓库 Settings → Pages → Deploy from a branch → `main` / `(root)` → Save。
5. GitHub Pages 已发布成功，学生页和投屏页地址如下：
   - 学生：`https://1nkmark.github.io/Supabase-Vote/`
   - 投屏：`https://1nkmark.github.io/Supabase-Vote/results.html`
6. 数据库已建好第 1 轮，当前开放且 0 票。正式上课前可打开学生页与投屏页检查连接，并按需执行 `teacher-controls.sql` 的“开始新一轮”代码块。
7. 在投屏页点击“下载二维码”，可得到带留白边的 PNG，用于 PPT。

## 课堂操作

- 教师打开 `results.html`，点击全屏，学生扫码后点击 A 或 B 即提交。
- 学生提交成功后看到已选答案和共享统计；提交前不展示全班分布。
- 投屏每 2 秒、学生页每 4 秒刷新；连接失败会明确提示，保留上次统计并禁用提交。首次连接失败不会伪造 0 票或切到演示模式。
- `teacher-controls.sql` 包含结束当前轮次、开始新轮次两段操作。请选中所需代码块执行；新轮次保留历史票数，新一轮从 0 开始。
- 默认不预置票数，也不在学生作答前显示正确答案。

## 防重复的实际边界

每个浏览器保存随机 UUID；数据库用 `(round_id, device_id)` 唯一键防止重复请求重复计票。同一浏览器每轮只能提交一次，刷新和重试不会改票。清理存储、换浏览器或伪造新的 UUID 可以再次提交，因此不能把它宣传为严格的一人一票或防恶意刷票系统。匿名课堂使用无需学生注册。

前端仅可调用查询汇总和提交答案的 RPC；不能直接读投票明细、改票、删票或创建轮次。该题统计不混入原欧拉图题的数据。

## 教学说明

按“一次归结尝试未得到矛盾”的通常含义，答案是 **B：不能**。未找到空子句不等于已证明可满足；命题归结若对有限子句集进行完备、穷尽的饱和过程，结论条件不同。授课时需区分一次尝试与完整判定过程。

## 本地验证

```sh
npm ci
npm test
python -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/`。本地地址生成的二维码只用于本机预览，不能作为手机课堂入口。数据库测试使用 PGlite 执行真实 PostgreSQL SQL，验证隔离权限、重复投票、结束、新轮次和超过 1000 票的统计。Supabase 中的匿名状态函数也已通过 anon 角色权限验证；当前运行环境无法完成外网 HTTPS 请求，因此实际手机投票仍需在课堂网络中确认。

二维码库：qrcode-generator 2.0.4，MIT，版权信息保留在 `vendor/qrcode.js`。

