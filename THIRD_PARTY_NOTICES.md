# 来源与许可说明

不同材料适用各自的来源和权利范围。程序的 MIT 许可不替代出版译文、扫描书页或第三方依赖的声明。

## 当前中文底本

柏拉图《理想国》，郭斌和、张竹明译，商务印书馆，1986年8月第一版、北京第一次印刷，统一书号2017·366。本游戏采用第一至四卷，印刷页1—176。

`content/source/guo-1986-pages.json`、生成的当前正文/书页对照数据、`reader-public/facsimile/` 以及题目中的直接原文引句，均来源于这一中文出版译本。译文及书页权利归相应权利人。项目不以 MIT 或 CC BY-SA 重新授权它们，也不声称出版社或译者认可本游戏。编辑加工包括 OCR 整理、录入校正、版面分段、主题组织、追问练习和题后解释；整理记录见 [docs/sources.md](docs/sources.md)。

## 旧版数据

保留的 `content/source/bookN-en.json` 和 `bookN-zh.json` 是此前 Paul Shorey / Perseus 数字底本及 AI 辅助中文转译，不再作为当前游戏正文。它们仍按原 CC BY-SA 4.0 许可分享，不属于郭斌和、张竹明译文。

英文来源为 [Perseus Digital Library / Tufts University](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml)，Paul Shorey 英译。数字整理署名为 Gregory Crane、Lisa Cerrato、William Merrill、Elli Mylonas、David Smith；资助方 The Annenberg CPB/Project。仓库许可为 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。旧转译的项目署名为《理想国 · 苏格拉底的下一问》项目 / yaoyuzhang1。相应旧提交中的来源与修改记录仍适用于这些历史材料。

## 程序与依赖

`reader-public/illustrations/` 中的60幅主篇漫画及 `reader-public/illustrations/bonus/` 中的12幅隐藏章节漫画，均由本项目通过内置图像生成工具制作，并非原书插图；创作约束、提示词与文件清单见 [docs/art-direction.md](docs/art-direction.md)。

`reader-public/audio/feedback/` 为微软在线语音服务 `zh-CN-XiaoxiaoNeural` 生成的141条编辑解释录音；`reader-public/audio/completion/` 另含1条八章完成祝贺。精确文本、声线与文件校验分别见两目录的 `manifest.json`。声音材料不包含旧剧情角色配音，亦不表示原译者或出版方参与制作。

`content/bonus/death.json` 是本项目依据柏拉图《申辩篇》《克里同篇》《斐多篇》另作的中文戏剧化改编，包含场景对白、探索选项、回应及札记。它不属于郭斌和、张竹明《理想国》译文。参考底本主要是 Benjamin Jowett 历史英译，并辅助核对 Perseus 和 Harvard Center for Hellenic Studies 的原作段落；逐幕出处和材料使用方式见 [docs/death-sources.md](docs/death-sources.md)。网站链接用于追溯来源，不表示相关机构为本游戏背书。

原创阅读引擎、界面代码和几何图标采用 [MIT](LICENSE)。依赖按 `pnpm-lock.yaml` 的锁定版本保留原许可：React / React DOM 为 MIT；Lucide 为 ISC，承继的 Feather 图标保留 MIT；Vite 为 MIT；TypeScript 为 Apache-2.0。

运行时依赖的完整版权及许可文本见 [docs/dependency-licenses.md](docs/dependency-licenses.md)。工作流将其随站点分发为 `THIRD-PARTY-LICENSES.txt`。

当前站点不分发旧剧情版本的配音和场景图。Git 历史中的旧资源仍按相应提交的来源与条款处理。
