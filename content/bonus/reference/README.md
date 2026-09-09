# 隐藏章节核对文本

这些文件供逐段核对，不导入游戏正文，也不作为新的剧情内容。中文对白由项目从历史英译独立节译；它们不是郭斌和、张竹明译《理想国》的文字。

| 文件 | 公开来源 | 用途 |
| --- | --- | --- |
| `jowett-apology.txt` | [MIT Internet Classics Archive](https://classics.mit.edu/Plato/apology.html) | 《申辩篇》Benjamin Jowett历史译文 |
| `jowett-crito.txt` | [MIT Internet Classics Archive](https://classics.mit.edu/Plato/crito.html) | 《克里同篇》Benjamin Jowett历史译文 |
| `jowett-phaedo.txt` | [Fordham Ancient History Sourcebook](https://sourcebooks.web.fordham.edu/ancient/plato-phaedo.asp) | 《斐多篇》Benjamin Jowett历史译文 |
| `cary-phaedo-118a.txt` | [Project Gutenberg所收Henry Cary译文](https://www.gutenberg.org/files/13726/13726-h/13726-h.htm) | 仅保存末语短句，交叉核对“我们” |

保留的是公版历史译文文本，移除了来源网站的导航、缓存横幅、HTML和网页排版。来源页面的设计与电子呈现并未作为项目素材复制。MIT《斐多篇》的文本下载实际止于后文的一句中间，不能用作完整底本，因此本地核对使用Fordham的完整历史译文。

Jowett在118a译作“I owe”；本项目该句采用Cary明确的复数“we owe”，在对应段与映射里单独标明，没有静默修改Jowett核对文件。没有复制现代中文译文或现代英译的长段文字。

文件SHA-256、逐段英文锚点、中文段落SHA-256及斯特凡努斯页码保存在 [source-alignment.json](../source-alignment.json)。英文文本本身没有齐全的斯特凡努斯标号；本项目映射的页码结合带号原文位置核对，锚点用于精确找回本地英文语句，不是把该文件行号当作原典页码。

偏移契约：`anchorOffset`是从0开始的UTF-16代码单元位置，作用于`text.replace(/\s+/g, ' ')`所得的全文，不去除首尾空格，比较时忽略大小写。原始文件的SHA-256在归一化之前计算；偏移不是UTF-8字节位置。`source-alignment.json`中的`anchorOffsetScheme`及对应测试共同限定此规则。
