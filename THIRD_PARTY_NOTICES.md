# 来源与许可说明

本项目的 MIT 许可适用于原创软件与项目文档，不替第三方作品、图片、声库或服务重新授权。

## 雅克-路易·大卫：《苏格拉底之死》

- 文件：`public/death-of-socrates.jpg`。
- 作者：Jacques Louis David，1787 年。
- 馆藏：The Metropolitan Museum of Art，藏品编号 31.45。
- 来源：[官方作品页](https://www.metmuseum.org/art/collection/search/436105)。该页明确标记 **Public Domain**。
- 开放获取依据：[The Met Open Access](https://www.metmuseum.org/hubs/open-access)，公有领域作品图像按 CC0 提供。
- 本仓库不对该图像新增版权限制，也不将其标为本项目创作。画作用作后世回望苏格拉底之死的视觉表达，不是事件现场记录。
- SHA-256：`eaff5a04103361fed9fba6f10ea7bed80ccdc595d664b6997c6bd32f0eee06a6`。

来源与开放获取标记核对日期：2026-09-07。上述许可仅指作品图像；不打包博物馆网页文字、讲解音频或网站界面。

## 庭院场景图

- 文件：`public/courtyard.png`。
- 为本项目制作的 AI 生成场景图，制作记录标明使用 OpenAI 图像生成工具。
- 内容：比雷埃夫斯一处庭院的艺术想象，苏格拉底与克法洛斯交谈。它不是考古复原或历史照片。
- SHA-256：`55bf8fa774321f415375e1779614aba4c0c6bc44872ebeadcff2bc8863050d57`。
- 本图随游戏用于展示。项目代码的 MIT 许可不包含对 AI 输出在所有司法管辖区的版权状态或独立转授权作出保证；提取图像单独使用时，应保留其 AI 创作属性，并核对适用的生成服务条款。

## 文本、图标与声音

柏拉图古代原典与本游戏的中文重述、玩家分支属于不同层次。文本出处和解释边界见 [docs/sources.md](docs/sources.md)。本仓库不转载现代中文译本，也不打包参考网站的编者文字。

`public/icon.svg` 为本项目的简单几何与问号图标，随原创代码采用 MIT 许可。

本版本提供 291 段预录普通话，是根据本项目中文剧本生成的现代合成表演，供游戏播放；不是历史录音，也不是声库。录音、语音服务与声音模型不因本项目代码采用 MIT 就自动获得相同许可。制作资料不应包含服务凭据。玩家运行游戏时仅请求已生成的静态音轨，不向语音生成服务提交文本。

## 软件依赖

运行时代码使用 React、React DOM 和 Lucide 图标，构建工具及其依赖由 `pnpm-lock.yaml` 记录。各包保留自身的许可证和版权声明；具体版本以锁文件为准。项目的 MIT 许可不替换这些依赖的许可。

- [React 与 React DOM](https://github.com/facebook/react)：MIT。
- [Lucide](https://github.com/lucide-icons/lucide)：ISC；其中承继 Feather 的图标需同时保留原 MIT 声明。
- [Vite](https://github.com/vitejs/vite) 与 [TypeScript](https://github.com/microsoft/TypeScript)：分别依其 MIT、Apache-2.0 许可。

随运行时代码分发的 React、React DOM、Lucide 与 Feather 版权及许可全文见 [docs/dependency-licenses.md](docs/dependency-licenses.md)。

随分发的依赖仍须保留其原有版权与许可声明。新增外部图像、字体、音乐或录音时，应先补充本文件中的来源与适用条款，再纳入公开发布。
