# 来源与许可说明

《理想国 · 苏格拉底的下一问》的软件、阅读文本与第三方依赖适用不同许可。代码的 MIT 许可不替代本文列出的文本或依赖许可。

## 古代作品与英文底本

- 作品：柏拉图《理想国》（Republic），本项目覆盖第一至四卷。
- 英译：Paul Shorey。第一册 Books I–V 首版 1930 年；Perseus 数字版所列底本为 Harvard University Press / William Heinemann 的 1935–37 年重印。首版与后续重印的区别及书目证据见 [docs/sources.md](docs/sources.md)。
- 古代作品及已处于公有领域的底层内容，不因本项目使用或数字化版本的许可而新增版权限制。本项目不把现代中文出版译本作为复制来源。

## Perseus 数字化文本

- 来源：Perseus Digital Library / Perseus Project, Tufts University。
- 原文件：[tlg0059.tlg030.perseus-eng2.xml](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml)。
- 标识：`urn:cts:greekLit:tlg0059.tlg030.perseus-eng2`。
- XML 署名：Gregory Crane（项目负责人）；Lisa Cerrato、William Merrill、Elli Mylonas、David Smith（数字化整理监督）；资助方 The Annenberg CPB/Project。文本于 1992 年在 St. Olaf 扫描，数字版发布于 1996 年。
- 仓库许可：[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)，依据官方 [README](https://github.com/PerseusDL/canonical-greekLit/blob/master/README.md) 和 [license.md](https://github.com/PerseusDL/canonical-greekLit/blob/master/license.md)，核对日期 2026-09-08。

Perseus 对其数字图书馆的整体版权声明由来源保留。材料按许可原样提供，不附准确性、适用性或无错误保证；完整条款见上述许可。本项目的转译、题库与解释不代表 Perseus、Tufts University、译者或整理者认可。

本项目的修改包括：提取第一至四卷正文，按 Stephanus 页码组织，移除电子脚注和小节编号碎片，处理列明的录入错误，制作 AI 辅助中文转译，加入主题组织、追问练习及解释。修改说明见 [docs/sources.md](docs/sources.md)。其他镜像网站的网页许可不被当作这份仓库文本的许可。

中英对照的展示分段参考 [ToposText 阅读页](https://topostext.org/work/768)，只取与 Perseus 同源的正文，并据 Perseus XML 清理纠错；未使用其附加地名、地图或网站编辑资料。

## 本项目中文文本与题库

`content/source/bookN-zh.json`、`content/questions/`、`content/structure.json` 中的中文正文和教学编辑内容，以及生成的 `reader-public/text/` 中相应内容，按 **CC BY-SA 4.0** 分享。署名为“《理想国 · 苏格拉底的下一问》项目 / yaoyuzhang1”；正文另保留柏拉图、Paul Shorey 和 Perseus Digital Library / Tufts University 的来源署名。

在可适用版权的范围内，复制、改编和再分享时，请保留署名及来源链接、附上许可链接、说明修改，并将相应改编按同一许可分享。公有领域元素及法律允许的其他使用不受额外限制。该许可不声称 AI 辅助输出在所有司法管辖区均具有相同的版权状态。

中文转译和题库尚未经人工专家逐段校订，不是学术定本，也不是从现代出版中文译本转载。站点可独立访问的许可声明见 [reader-public/TEXT-LICENSE.txt](reader-public/TEXT-LICENSE.txt)。

## 原创软件与依赖

原创阅读引擎、界面及一般项目文档采用 [MIT License](LICENSE)。`reader-public/icon.svg` 为本项目的简明几何与问号图标，随代码采用 MIT。

运行时代码使用 React、React DOM 和 Lucide；构建工具与其依赖以 `pnpm-lock.yaml` 为版本依据，各自保留原有版权和许可：

- [React 与 React DOM](https://github.com/facebook/react)：MIT。
- [Lucide](https://github.com/lucide-icons/lucide)：ISC；承继 Feather 的图标同时保留原 MIT 声明。
- [Vite](https://github.com/vitejs/vite)：MIT。
- [TypeScript](https://github.com/microsoft/TypeScript)：Apache-2.0。

随运行时代码分发的 React、React DOM、Lucide 与 Feather 版权及许可全文见 [docs/dependency-licenses.md](docs/dependency-licenses.md)。工作流将依赖声明复制到站点的 `THIRD-PARTY-LICENSES.txt`。

当前纯文字站点不分发旧叙事版本的场景图、绘画或配音。Git 历史中的旧资源如被单独取用，仍应查阅它们所在提交的来源与条款，不能依据当前代码许可重新授权。
