# 构建与发布

项目生成静态 HTML、JavaScript、CSS 和文本数据，不需要应用服务器或玩家账号。公开仓库为 [yaoyuzhang1/death-of-socrates](https://github.com/yaoyuzhang1/death-of-socrates)，GitHub Pages 地址沿用：

[https://yaoyuzhang1.github.io/death-of-socrates/](https://yaoyuzhang1.github.io/death-of-socrates/)

仓库路径保留历史名称，页面名称为《理想国 · 苏格拉底的下一问》。发布结果应以该次 Actions 的提交号、运行结果与公开页面实测为准，不能用此前叙事游戏的部署证明当前正文已发布。

## 本地复现

使用 Node.js 22.13 或更新的兼容版本和 pnpm 11.19.0；持续集成使用 Node.js 22。以 `package.json` 和 `pnpm-lock.yaml` 为依赖版本依据。

```sh
pnpm install --frozen-lockfile
node scripts/build-reader.mjs
pnpm test
pnpm run build
pnpm run preview
```

日常开发可使用 `pnpm run dev`。通过命令输出的本地 HTTP 地址访问；不要直接双击 `dist/index.html`，因为浏览器模块与正文加载需要正常的网页来源。

修改正文时，编辑 `content/source/`；修改题目时，编辑 `content/questions/`；调整主题章与分节时，编辑 `content/structure.json`。运行 `pnpm run text:build` 或 `node scripts/build-reader.mjs` 后检查生成的正文、对照页和覆盖清单，再运行测试与构建。`pnpm run build` 也会重新生成阅读数据。不要只改生成文件而遗漏它的源文件。

Vite 配置使用相对基路径 `./`，公共资源目录为 `reader-public/`，构建输出为 `dist/`。正文从 `text/republic.json` 加载，资源必须在 GitHub Pages 项目子目录下正确解析。`reader-public/TEXT-LICENSE.txt` 随构建复制到站点根目录；发布工作流还复制代码 MIT 许可和依赖许可。

## GitHub Actions

保留现有 [pages.yml](../.github/workflows/pages.yml)。仓库的 **Settings → Pages → Build and deployment → Source** 应选择 **GitHub Actions**。不需要自定义域名或 `CNAME`。

工作流在 `main` 推送、拉取请求和手动触发时进行检查，依次安装锁定依赖、运行测试、完成类型检查及静态构建。拉取请求不部署；`main` 的非拉取请求运行在构建成功后上传 `dist/` 并部署到 `github-pages` 环境。

默认权限为 `contents: read`；构建任务另有 `pages: read`，部署任务使用 `contents: read`、`pages: write` 和 `id-token: write`。仓库不需要保存个人访问令牌。源码检出关闭凭据持久化。

当前工作流固定官方 action 主版本：`actions/checkout@v6`、`actions/setup-node@v7`、`pnpm/action-setup@v4`、`actions/configure-pages@v5`、`actions/upload-pages-artifact@v4`、`actions/deploy-pages@v4`。实际定义以工作流文件为准。部署要求参见 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 发布前后检查

发布前应从源数据重新生成正文，核对第一至四卷 176 个书页与 47 道题，并按[验证说明](validation.md)检查引擎、正文连续性和真实浏览器流程。将正文、题库、结构、构建脚本及对应生成文件一并纳入提交，避免界面与存档的正文版本不一致。

发布后，查看该次 Actions 成功运行所对应的提交，并访问实际 Pages 地址。用新的浏览器上下文检查入口、第一道题、答案解释、后续正文和本地恢复；确认 `text/republic.json`、`text/parallel.html`、`text/coverage.json`、`TEXT-LICENSE.txt` 及脚本样式请求均来自项目目录，没有 404。更新后也应确认旧的声音、图片或叙事界面没有意外进入新构建。

成功构建只证明生成与打包环节完成。译文准确性、题目质量、阅读体验与发布后的资源可达性，应分别核验。
