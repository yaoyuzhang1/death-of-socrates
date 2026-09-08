# 底本、转译与校订

## 阅读范围

本项目按原文顺序呈现《理想国》第一至四卷，另按讨论主题划分为八章。它既不是十卷全书，也不是把多个对话篇拼接起来的叙事游戏。

| 原典卷次 | Stephanus 范围 | 页码小节数 | 追问练习数 |
| --- | --- | ---: | ---: |
| 第一卷 | 327a–354c | 136 | 18 |
| 第二卷 | 357a–383c | 132 | 9 |
| 第三卷 | 386a–417b | 156 | 12 |
| 第四卷 | 419a–445e | 131 | 13 |
| 合计 | 第一至四卷 | 555 | 52 |

这些编号是通行的 Stephanus 页码及字母分段，不是本网站自行编造的章节编号。一句话可能跨越两个页码小节。构建时应保持前后连续，不因插入题目或主题分章而重复、删去相邻文字。

## 英文底本与数字化来源

作者为柏拉图，英文译者为 Paul Shorey。第一册收录 Books I–V，首版出版于 1930 年；当时的[1931 年书评](https://www.persee.fr/doc/bude_1162-5740_1931_num_3_1_6549_t1_0101_0000_1)直接著录了书名、译者、卷次和出版年。

本项目所核对的数字化文本来自 Perseus Digital Library / Tufts University 的 [canonical-greekLit 仓库](https://github.com/PerseusDL/canonical-greekLit)。具体文件为 [tlg0059.tlg030.perseus-eng2.xml](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml)，CTS 标识为 `urn:cts:greekLit:tlg0059.tlg030.perseus-eng2`。

中英对照的展示分段沿用 [ToposText 的 Shorey 阅读页](https://topostext.org/work/768)所显示的页码小节，只取与 Perseus 同源的正文，再依据 Perseus XML 清理和纠错；不复制 ToposText 的附加地名资料、地图、网站说明或其他编辑内容。这种展示分段不取代正文的 Perseus 来源，也不把 ToposText 的网站许可当作底本文本许可。

XML 头部注明：译者 Paul Shorey，Perseus Project 由 Tufts University 支持；文本于 1992 年在 St. Olaf 扫描，数字版于 1996 年发布；底本书目列 Harvard University Press / William Heinemann 的 1935–37 年重印。它链接的[第一册扫描本](https://archive.org/details/republicshorey01platuoft)也包含重印信息。因此，“1930 年首版”与“数字化所据后续重印”应分别说明，不能把扫描本冒称为首版。

数字化整理人员在 XML 中署名为 Lisa Cerrato、William Merrill、Elli Mylonas、David Smith，项目负责人为 Gregory Crane。项目保留来源与整理者署名，不声称得到 Perseus 或这些人员对中文转译及练习的审核、认可。

许可核对日期：2026-09-08。仓库 [README](https://github.com/PerseusDL/canonical-greekLit/blob/master/README.md)与 [license.md](https://github.com/PerseusDL/canonical-greekLit/blob/master/license.md)现行许可均为 **CC BY-SA 4.0**，不是 CC BY-SA 3.0。其他网页镜像的整站许可不被用来替代这份底本与数字化仓库的许可。

## 中文正文与教学编辑

中文正文由 AI 辅助，依据 Shorey 英译逐小节转译；没有从现代出版中文译本复制文字，也没有直接从希腊文独立校译。正文保留分句、短应答、诗歌引文、叙述、重复论证，以及古代关于性别、奴隶、教育审查、医疗和统治的争议段落，不以概述替代。

英文是中间语言，可能影响概念、语气与句法。中文转译及题库尚未经人工专家逐段校订，不能称为学术定本或经过学术审定的出版中文译本。正文中的主张属于对话作品；保留它们不是表示认同。柏拉图的文学对话也不是事件现场的逐字记录。

正文与三类编辑内容分开：主题章的导言和回顾、三个候选问法、作答后的解释与提示。题目以正文中实际出现的苏格拉底问句为锚点，但选项为教学比较而重新措辞。“更好”的理由应说明它在当前论证中完成的工作，不能只说它与原文相符。选对、选错或直接揭示后，都继续同一份正文。

术语力求保持一致，例如 justice 为“正义”、injustice 为“不正义”、virtue 为“德性”、art 为“技艺”、soul 为“灵魂”；教育语境中的 mousikē 使用“诗乐”，不把它缩成仅指器乐或旋律的现代“音乐”。具体乐器和曲调处仍按语境使用“音乐”。第三、四卷与 thumos 相关的 spirited principle 统一为“激情”，指可与愤怒、荣誉感和勇气相连的意气成分，不是现代汉语中一切强烈情绪的统称，也不等同于欲望。

## 已处理的电子文本问题

| 位置 | 问题 | 本项目处理 |
| --- | --- | --- |
| 334b | 电子英文出现将奥托吕科斯称为奥德修斯 `uncle` 的亲属错误。 | 中文改为“外祖父”；保留校订记录，不把错误亲属关系照译。可对照 [Jowett 第一卷](https://classics.mit.edu/Plato/republic.2.i.html)相应段落。 |
| 389a | 电子英文 `we must accept it, much less if gods` 漏否定词，导致句意与上下文冲突。 | 中文译为“我们不能接受；若这样描写诸神，就更不能接受”。交叉核对 [Jowett 第三卷](https://classics.mit.edu/Plato/republic.4.iii.html)的对应否定表达。 |
| 405b | 电子英文 `when a man only ... but ...` 在对应“不仅……而且……”的结构中缺 `not`。 | 中文恢复“不仅……而且……”的完整关系，不改变其后关于诉讼行为的论证。 |
| 多处诗引和分节处 | 网页抓取把注释序号接到诗句出处上，或混入罗马数字小节号。 | 删除电子脚注、引文行号碎片和非正文小节编号；保留诗句正文、对话的短应答与叙述。 |

这些校订说明有限的已知修正，不表示其余文本已经完成全面校勘。新的修正应记录位置、原状、依据和修改，并同步检查题目锚点是否仍与正文连续匹配。

## 可复核文件

`content/source/bookN-en.json` 与 `bookN-zh.json` 保存英文及中文，`N` 为 1 至 4；`content/questions/bookN.json` 保存题库，`content/structure.json` 保存主题组织。

`scripts/build-reader.mjs` 生成 `reader-public/text/republic.json`、`parallel.html` 和 `coverage.json`。对照页用于逐页码核查中英文；覆盖清单用于核查来源小节、题目和输出的对应关系。编号齐全、锚点匹配和字数相近，只能排除一部分结构错误，不能证明翻译忠实或解释充分。

## 分享许可

古代原典与已处于公有领域的底层内容不因数字化而新增限制；[CC BY-SA 4.0 说明](https://creativecommons.org/licenses/by-sa/4.0/)也明确，其条件不适用于材料中的公有领域元素。Perseus 数字化版本按仓库 CC BY-SA 4.0 许可处理；本项目中文转译、题库及其教学编辑内容同样按 CC BY-SA 4.0 分享，标明翻译、分段、清理与增编，并保留来源链接和署名。

转载或改编这些文本时，请保留柏拉图、Paul Shorey、Perseus Digital Library / Tufts University 及本项目的相应署名，链接许可，说明所作修改，并按同一许可分享相应改编。软件代码另采用 MIT，不能把文本的许可自动替换成代码许可。具体声明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) 与 [TEXT-LICENSE.txt](../reader-public/TEXT-LICENSE.txt)。
