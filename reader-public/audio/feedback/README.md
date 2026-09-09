# 答题解释配音

141 条标准普通话录音：47 条正确解释、94 条错误选项反馈。

- 服务：Microsoft Edge 在线语音服务（edge-tts 7.2.8）。
- 声线：`zh-CN-XiaoxiaoNeural`；语速：`-3%`，其余参数默认。
- 正确选择逐字朗读 `question.explanation`；错误选择逐字朗读当前 `option.feedback`。
- 不加入额外提示，不朗读其他选项或未选中的正确解释。
- 命名：`<question.id>--<option.id>.mp3`。
- `manifest.json` 保存完整文本、文本与录音 SHA-256、声线、语速、格式、大小和时长。

重建工具位于 `scripts/generate-feedback-audio.py`，依赖 `edge-tts`。
`--limit 1` 先生成样音；`--concurrency 3` 生成其余录音。
已完成且文本、声线、文件校验一致的录音会直接复用。
`--verify` 在本地验证全部 141 条，不连接语音服务。

验证包括 MPEG 帧完整性、时长、SHA-256，以及浏览器逐条解码与非静音波形检查；
这些检查不代表已逐句人工听校。游戏运行时直接播放本目录的静态录音，不再发送题目到语音服务。
