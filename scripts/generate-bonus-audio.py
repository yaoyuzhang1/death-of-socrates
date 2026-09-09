"""Generate exact, speaker-aware standard Mandarin recordings for the hidden chapter.

Use the existing edge-tts virtualenv. --verify checks local text, voice, hash and
MPEG integrity without network access. Re-running only generates missing or changed clips.
"""
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reader-public' / 'audio' / 'bonus'
MANIFEST = OUTPUT / 'manifest.json'
SCRIPT_RULE = 'Each intro/response paragraph and note uses exact source text without speaker labels or added words. Only confirmed options may play response/note recordings.'
_spec = importlib.util.spec_from_file_location('feedback_audio_helpers', ROOT / 'scripts' / 'generate-feedback-audio.py')
_helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_helpers)
digest = _helpers.digest
mp3_info = _helpers.mp3_info


def voice_for(speaker: str) -> tuple[str, str]:
    if speaker.startswith('苏格拉底'):
        return 'zh-CN-YunxiNeural', '-5%'
    if speaker == '旁白':
        return 'zh-CN-XiaoxiaoNeural', '-3%'
    if speaker == '克里同':
        return 'zh-CN-YunyangNeural', '-7%'
    return 'zh-CN-YunyangNeural', '-3%'


def scripts() -> list[dict]:
    chapter = json.loads((ROOT / 'content' / 'bonus' / 'death.json').read_text(encoding='utf-8'))
    entries = []

    def add(kind: str, key: str, scene_id: str, text: str, speaker: str, **extra) -> None:
        voice, rate = voice_for(speaker)
        directory = {'intro': 'intro', 'response': 'responses', 'note': 'notes'}[kind]
        entries.append({'key': key, 'kind': kind, 'sceneId': scene_id, 'speaker': speaker,
                        'text': text, 'textSha256': digest(text.encode('utf-8')),
                        'voice': voice, 'rate': rate, 'filename': f'{directory}/{key}.mp3', **extra})

    # Player-confirmed replies are produced first so missing response audio is fixed first.
    for scene in chapter['scenes']:
        for option in scene['question']['options']:
            for index, passage in enumerate(option['response']):
                key = f"{scene['id']}--{option['id']}--p{index}"
                add('response', key, scene['id'], passage['text'], passage['speaker'],
                    optionId=option['id'], passageIndex=index)
    for scene in chapter['scenes']:
        for index, passage in enumerate(scene['passages']):
            key = f"{scene['id']}--intro--p{index}"
            add('intro', key, scene['id'], passage['text'], passage['speaker'], passageIndex=index)
    for scene in chapter['scenes']:
        for option in scene['question']['options']:
            key = f"{scene['id']}--{option['id']}--note"
            add('note', key, scene['id'], option['note'], '旁白', optionId=option['id'])
    assert len({entry['key'] for entry in entries}) == len(entries)
    return entries


def verify_entry(spec: dict, previous: dict | None) -> dict | None:
    if not previous or any(previous.get(key) != value for key, value in spec.items()):
        return None
    path = OUTPUT / spec['filename']
    if not path.exists():
        return None
    data = path.read_bytes()
    if digest(data) != previous.get('sha256'):
        return None
    return {**previous, **mp3_info(data)}


def write_manifest(entries: dict, expected: list[dict], voice_catalog: list[dict] | None) -> None:
    payload = {'version': 1, 'provider': 'Microsoft Edge online TTS', 'language': 'zh-CN',
               'generatedAt': datetime.now(timezone.utc).isoformat(), 'expectedCount': len(expected),
               'complete': len(entries) == len(expected),
               'scriptRule': SCRIPT_RULE,
               'verifiedVoiceCatalog': voice_catalog,
               'entries': [entries[entry['key']] for entry in expected if entry['key'] in entries]}
    temporary = MANIFEST.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(MANIFEST)


async def generate(args) -> None:
    expected = scripts()
    previous_manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    previous = {entry['key']: entry for entry in previous_manifest.get('entries', [])}
    entries = {}
    for spec in expected:
        valid = verify_entry(spec, previous.get(spec['key']))
        if valid:
            entries[spec['key']] = valid
    if args.verify:
        assert len(entries) == len(expected), f'Validated {len(entries)}/{len(expected)} recordings'
        print(json.dumps({'verified': len(entries), 'bytes': sum(entry['bytes'] for entry in entries.values()),
                          'durationSeconds': round(sum(entry['durationSeconds'] for entry in entries.values()), 3)}))
        return
    import edge_tts
    OUTPUT.mkdir(parents=True, exist_ok=True)
    voices = await edge_tts.list_voices()
    names = {entry['voice'] for entry in expected}
    catalog = [{key: voice[key] for key in ('ShortName', 'Gender', 'Locale')}
               for voice in voices if voice['ShortName'] in names]
    assert {voice['ShortName'] for voice in catalog} == names, 'A required standard Mandarin voice is unavailable'
    assert all(voice['Locale'] == 'zh-CN' for voice in catalog)
    pending = [spec for spec in expected if spec['key'] not in entries and (args.kind == 'all' or spec['kind'] == args.kind)]
    if args.limit:
        pending = pending[:args.limit]
    semaphore = asyncio.Semaphore(args.concurrency)
    failures = []

    async def one(spec: dict) -> None:
        async with semaphore:
            path = OUTPUT / spec['filename']
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix('.mp3.part')
            for attempt in range(3):
                try:
                    communicate = edge_tts.Communicate(spec['text'], spec['voice'], rate=spec['rate'],
                                                      connect_timeout=15, receive_timeout=45)
                    await communicate.save(str(temporary))
                    data = temporary.read_bytes()
                    info = mp3_info(data)
                    temporary.replace(path)
                    entries[spec['key']] = {**spec, **info, 'sha256': digest(data)}
                    write_manifest(entries, expected, catalog)
                    print(json.dumps({'generated': spec['key'], 'available': len(entries), **info}), flush=True)
                    return
                except Exception as error:
                    temporary.unlink(missing_ok=True)
                    if attempt < 2:
                        await asyncio.sleep(1 + attempt)
                    else:
                        failures.append({'key': spec['key'], 'error': str(error)})
                        print(json.dumps(failures[-1]), flush=True)

    await asyncio.gather(*(one(spec) for spec in pending))
    write_manifest(entries, expected, catalog)
    print(json.dumps({'available': len(entries), 'expected': len(expected), 'failures': failures}), flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--kind', choices=['all', 'intro', 'response', 'note'], default='all')
    parser.add_argument('--concurrency', type=int, choices=range(1, 5), default=3)
    parser.add_argument('--verify', action='store_true')
    asyncio.run(generate(parser.parse_args()))
