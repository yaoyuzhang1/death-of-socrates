# 理解检查解释配音

主篇38题、隐藏章节12题，共150段标准普通话解释。文字已按2026-09-09来源审查修订；完整文稿见 [解释文稿](../../../docs/new-feedback-script.md)。

清单 complete 为 true，总时长 1314.024 秒，总大小 7,884,144 字节。

使用 Microsoft zh-CN-XiaoxiaoNeural，语速 -3%。正确时逐字朗读 explanation，错误时逐字朗读所选 feedback；未经确认不播放。文件名为检查ID--选项ID.mp3。

生成：python scripts/generate-study-audio.py --concurrency 3；仅本地核验：添加 --verify。缓存按准确文字、声线和文件散列验证，只重录发生变化的文字。

150段均通过MPEG完整性、Chrome解码及非静音波形检查，逐段数据见 decode-qa.json。这些自动检查不等于人工逐字听校。
