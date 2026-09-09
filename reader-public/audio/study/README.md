# 新增理解检查的解释配音

已准备正篇38道检查、隐藏章节12道检查，共50题、150段解释的配音文字，完整审阅稿见 `docs/new-feedback-script.md`。

目前这150段静态音频尚未生成。`manifest.json` 因此保持 `complete: false`、`entries: []`。游戏仍显示完整的文字解释；只有清单中存在的录音才会启用播放，不会请求尚不存在的MP3文件。

获得将这批文字发送给微软在线语音服务的明确授权后，可在已安装 `edge-tts` 的Python环境中，从项目根目录运行：

```text
python scripts/generate-study-audio.py --concurrency 3
python scripts/generate-study-audio.py --verify
```

生成器使用标准普通话声线 `zh-CN-XiaoxiaoNeural`，语速 `-3%`。选对时朗读该题的 `explanation`，选错时朗读所选选项的 `feedback`，不改写原有说明。文件名为 `<检查ID>--<选项ID>.mp3`。

缓存逐项检查准确文字、声线、音频SHA-256和MPEG完整性。空清单不代表已完成缓存：当前有150项待生成，`--verify` 会报告0/150，且不访问网络或改写清单。生成全部成功后，清单才会标为完整。

完成本地验证和浏览器解码检查后，执行项目测试并重新构建、发布。游戏会依据更新后的清单自动启用已生成的解释配音，无需逐题修改播放代码。
