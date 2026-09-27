"""Produce the ten-book congratulations without replacing the earned eight-chapter recording."""
from pathlib import Path
from datetime import datetime, timezone
import asyncio, hashlib, importlib.util, json

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reader-public/audio/completion'
TEXT = '恭喜你，完成了《理想国》十卷、二十个主题章节的阅读。从日常义务到城邦与灵魂，从洞穴与学习到政制、快乐和生活的选择，你一次次停下来辨析问题、检验理由。完成阅读并不意味着所有争论都已结束。你可以沿着自己的阅读足迹回看原文，再练曾经犹豫的追问，继续思考怎样过一种正义而有智慧的生活。'
VOICE, RATE = 'zh-CN-XiaoxiaoNeural', '-3%'
spec = importlib.util.spec_from_file_location('audio_generation', ROOT / 'scripts/generate-feedback-audio.py')
generation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generation)

async def main():
    import edge_tts
    OUTPUT.mkdir(parents=True, exist_ok=True)
    old = OUTPUT / 'manifest.json'
    milestone = OUTPUT / 'milestone-manifest.json'
    if not milestone.exists():
        previous = json.loads(old.read_text(encoding='utf-8'))
        assert '八章' in previous['text'], 'The milestone must preserve the published eight-chapter recording.'
        data = (OUTPUT / previous['filename']).read_bytes()
        assert generation.digest(data) == previous['sha256']
        (OUTPUT / 'milestone.mp3').write_bytes(data)
        previous['filename'] = 'milestone.mp3'
        milestone.write_text(json.dumps(previous, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if old.exists():
        previous = json.loads(old.read_text(encoding='utf-8'))
        data = (OUTPUT / previous['filename']).read_bytes()
        if previous['text'] == TEXT and generation.digest(data) == previous['sha256']:
            print('Full-book congratulations already matches the exact script.')
            return
    for attempt in range(3):
        temporary = OUTPUT / 'completion.mp3.part'
        try:
            communicate = edge_tts.Communicate(TEXT, VOICE, rate=RATE, connect_timeout=15, receive_timeout=45)
            await asyncio.wait_for(communicate.save(str(temporary)), timeout=65)
            data = temporary.read_bytes()
            info = generation.mp3_info(data)
            temporary.replace(OUTPUT / 'completion.mp3')
            manifest = {'version': 1, 'provider': 'Microsoft Edge online TTS', 'language': 'zh-CN',
                        'voice': VOICE, 'rate': RATE, 'text': TEXT, 'textSha256': generation.digest(TEXT.encode('utf-8')),
                        'filename': 'completion.mp3', 'sha256': generation.digest(data),
                        'generatedAt': datetime.now(timezone.utc).isoformat(), **info}
            old.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(json.dumps({'filename': manifest['filename'], 'duration': manifest['durationSeconds']}, ensure_ascii=False))
            return
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(1 + attempt)

asyncio.run(main())
