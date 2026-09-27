# 理解检查解释配音

主篇89题、隐藏12题，共303段标准普通话解释。每条精确文字、声线和SHA-256见manifest.json；主篇编辑题位于content/learning/checks.json。

完整录音总时长2674.512秒，总大小16047072字节。

Microsoft zh-CN-XiaoxiaoNeural，语速-3%。答对逐字朗读explanation，答错逐字朗读所选feedback；未经确认不播放。文件名为检查ID--选项ID.mp3。

生成：python scripts/generate-study-audio.py --concurrency 3；添加--verify仅核验本地文件。准确文字、声线和文件散列一致时复用录音。

303段均通过MPEG完整性、Chrome解码及非静音检查，见decode-qa.json。这些检查不等于逐句人工听校。
