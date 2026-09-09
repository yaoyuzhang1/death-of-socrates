"""Generate standard Mandarin feedback for main-reading and hidden-chapter checks.

Correct clips read check.explanation; incorrect clips read the chosen option.feedback.
The shared generator preserves exact text/voice/hash matching and MPEG validation.
"""
from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('bonus_audio_generation', ROOT / 'scripts' / 'generate-bonus-audio.py')
generation = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(generation)


def scripts() -> list[dict]:
    entries = []
    for group, source in [('main', 'content/learning/checks.json'), ('bonus', 'content/bonus/checks.json')]:
        checks = json.loads((ROOT / source).read_text(encoding='utf-8'))
        for check in checks:
            for option in sorted(check['options'], key=lambda item: item['id'] != check['correctId']):
                correct = option['id'] == check['correctId']
                text = check['explanation'] if correct else option['feedback']
                key = f"{check['id']}--{option['id']}"
                entries.append({'key': key, 'kind': 'check', 'group': group, 'checkId': check['id'],
                                'questionId': check['id'], 'optionId': option['id'], 'correct': correct,
                                'text': text, 'textSha256': generation.digest(text.encode('utf-8')),
                                'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-3%', 'filename': f'{key}.mp3'})
    assert entries and len({entry['key'] for entry in entries}) == len(entries)
    return entries


generation.OUTPUT = ROOT / 'reader-public' / 'audio' / 'study'
generation.MANIFEST = generation.OUTPUT / 'manifest.json'
generation.SCRIPT_RULE = 'Correct: exact check.explanation. Incorrect: exact selected option.feedback. Source arrays: content/learning/checks.json and content/bonus/checks.json. Play only after answer confirmation.'
generation.scripts = scripts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--concurrency', type=int, choices=range(1, 5), default=3)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    args.kind = 'all'
    asyncio.run(generation.generate(args))
