# 理想国 · 苏格拉底的下一问

沿着柏拉图《理想国》第一至四卷阅读，在关键处停下来，比较哪一种追问更能帮助思考。每次选择后，都会揭示苏格拉底实际问句的中文转译，解释这一问在当前讨论中的价值，并说明另两种问法的局限。

**[在线阅读](https://yaoyuzhang1.github.io/death-of-socrates/)** · [玩法](docs/playing.md) · [底本与校订说明](docs/sources.md) · [验证方法与边界](docs/validation.md)

全篇按原文顺序组织为八个主题章，包含 555 个 Stephanus 页码小节和 52 道追问练习。正文覆盖第一至四卷，不是《理想国》十卷全书。界面采用纯文字阅读；所有选择都接回同一份正文，没有立场支线、改写结局或声音播放。

这里练习的是看清问题在论证中做了什么：分清概念、检查前提、寻找反例、比较类比、说明适用范围。选项是教学表述，答对并不意味着赞同对话里的全部观点，也不代表已经证明某个哲学结论。

## 怎样阅读

从“开始阅读”进入，读到追问处后选择一项并确认，也可以请求提示或直接揭示原文。每种作答方式都会显示解释，随后继续阅读。目录和书签可以带你回到已经开放的位置；复习不会改写首次作答，也不会删除后面的进度。

阅读设置提供字号、纸色与夜间背景，以及进度导入和导出。进度保存在当前浏览器，无需账号；更换浏览器或清理站点数据前，请导出备份。本项目没有收集作答的后端、广告追踪或应用分析代码。托管平台仍会处理正常的网页和资源访问。

## 文本与许可

中文正文由 AI 辅助，依 Paul Shorey 英译逐小节完整转译，并保留诗句、短应答和争议段落；没有复制现代出版中文译本。数字化底本来自 Perseus Digital Library。主题章导言、问题选项和讲解属于本项目的教学编辑内容，与正文分开。

这份转译和题库尚未经人工专家逐段校订，不能当作学术定本或出版译本。可通过底本页码及生成的中英对照页核查。来源、已处理的电子录入错误和进一步校订方向见[底本说明](docs/sources.md)。

原创软件代码采用 [MIT](LICENSE)。Perseus 数字化整理及本项目中文转译、题库采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)；公有领域的底层作品不因此新增版权限制。署名和具体范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [TEXT-LICENSE.txt](reader-public/TEXT-LICENSE.txt)。

## 本地运行

需要 Node.js 22.13 或更新的兼容版本及 pnpm 11.19.0。

```sh
pnpm install --frozen-lockfile
node scripts/build-reader.mjs
pnpm test
pnpm run dev
```

生产构建使用 `pnpm run build`，输出至 `dist/`；运行 `pnpm run preview` 检查生产结果。正文源文件、题库与主题结构位于 `content/`，构建脚本生成 `reader-public/text/` 下的正文、对照页与覆盖清单。发布沿用现有 GitHub Actions 工作流，详见[构建与发布](docs/publishing.md)。
