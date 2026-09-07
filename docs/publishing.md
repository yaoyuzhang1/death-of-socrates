# 构建与发布

本项目输出静态 HTML、JavaScript、CSS 和资源文件，不需要应用服务器、数据库或玩家账号。GitHub Pages 项目地址为：

[https://yaoyuzhang1.github.io/death-of-socrates/](https://yaoyuzhang1.github.io/death-of-socrates/)

## 本地运行

使用 Node.js 22.13 或更新的兼容版本及 pnpm 11.19.0。持续集成使用 Node.js 22，pnpm 版本与 `package.json` 的 `packageManager` 字段保持一致。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run dev
```

`pnpm run dev` 会在终端显示本地地址。检查生产产物时运行 `pnpm run preview`。请通过 HTTP 服务打开游戏；不要直接双击 `dist/index.html`。浏览器对模块、存储和语音的限制可能使 `file://` 打开方式失效。

Vite 使用相对资源基路径 `./`，让图片、声音与脚本随项目目录加载。所有新资源也应使用相对或统一解析后的 URL，避免将 `/voice/...` 等站点根路径写死。发布目录仅为 `dist/`，不上传开发依赖或本地配置。

## GitHub Pages

仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。不需要自定义域名，也不要增加指向其他站点的 `CNAME`。

[发布工作流](../.github/workflows/pages.yml) 在 `main` 分支推送或手动运行时执行：

1. `pnpm install --frozen-lockfile` 按锁文件安装依赖。
2. `pnpm test` 检查引擎和剧情约束。
3. `pnpm run build` 完成类型检查和静态构建。
4. 上传 `dist/`，再部署到 `github-pages` 环境。

拉取请求只执行测试和构建，不部署。部署任务等待构建成功，并只在 `main` 上发布。默认令牌仅有 `contents: read`；部署任务另外获得 `pages: write` 和 `id-token: write`。工作流不需要个人访问令牌，不应在仓库中保存凭据。

Actions 使用 GitHub 官方主版本：`checkout@v6`、`setup-node@v7`、`configure-pages@v5`、`upload-pages-artifact@v4`、`deploy-pages@v4`，以及 pnpm 官方的 `pnpm/action-setup@v4`。主版本固定仍会接收该版本内的更新；如果维护者需要不可变依赖，可审查后改为完整提交 SHA。

权限与流程依据：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[setup-node 官方用法](https://github.com/actions/setup-node)、[pnpm 官方 action](https://github.com/pnpm/action-setup)。文档核对日期：2026-09-07。

## 发布后的检查

访问工作流实际返回的 Pages 地址，确认游戏入口、图片与声音从该项目目录正常加载。至少走完一种立场路线，检查导入导出与回溯；另外验证无可用普通话声线时仍能完整阅读和游玩。构建成功不能代替剧情、资源和浏览器播放检查。
