"""Generate exact option explanations with Microsoft Edge's standard Mandarin voice.

Run with the existing voice virtualenv (edge-tts); --limit 1 creates a first
sample, --verify checks all 141 assets without using the network. Generated
recordings are reused only when their exact text, voice and SHA-256 match.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reader-public" / "audio" / "feedback"
MANIFEST = OUTPUT / "manifest.json"
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-3%"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def mp3_info(data: bytes) -> dict:
    """Validate MPEG audio frames and derive duration without external programs."""
    offset = 0
    if data[:3] == b"ID3":
        offset = 10 + sum((data[6 + i] & 0x7F) << (21 - i * 7) for i in range(4))
    frames = 0
    duration = 0.0
    audio_bytes = 0
    sample_rates = set()
    start = offset
    while offset + 4 <= len(data):
        h = int.from_bytes(data[offset:offset + 4], "big")
        if h >> 21 != 0x7FF:
            break
        version = (h >> 19) & 3
        layer = (h >> 17) & 3
        bitrate_index = (h >> 12) & 15
        sample_index = (h >> 10) & 3
        if version == 1 or layer != 1 or bitrate_index in (0, 15) or sample_index == 3:
            break
        rates = [44100, 48000, 32000]
        sample_rate = rates[sample_index] // (1 if version == 3 else 2 if version == 2 else 4)
        bitrates = ([0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
                    if version == 3 else [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])
        bitrate = bitrates[bitrate_index] * 1000
        frame_size = (144 if version == 3 else 72) * bitrate // sample_rate + ((h >> 9) & 1)
        if offset + frame_size > len(data):
            break
        frames += 1
        duration += (1152 if version == 3 else 576) / sample_rate
        sample_rates.add(sample_rate)
        audio_bytes += frame_size
        offset += frame_size
    if frames < 20 or duration < 0.5 or audio_bytes < (len(data) - start) * 0.95:
        raise ValueError(f"Invalid or incomplete MP3: {frames} frames, {duration:.3f}s, {len(data)} bytes")
    return {"mimeType": "audio/mpeg", "durationSeconds": round(duration, 3),
            "frames": frames, "sampleRates": sorted(sample_rates), "bytes": len(data)}


def scripts() -> list[dict]:
    result = []
    for book in range(1, 5):
        questions = json.loads((ROOT / "content" / "questions" / f"book{book}.json").read_text(encoding="utf-8"))
        for question in questions:
            options = sorted(question["options"], key=lambda option: option["id"] != question["correctId"])
            for option in options:
                correct = option["id"] == question["correctId"]
                text = question["explanation"] if correct else option["feedback"]
                key = f'{question["id"]}--{option["id"]}'
                result.append({"key": key, "questionId": question["id"], "optionId": option["id"],
                               "correct": correct, "text": text, "textSha256": digest(text.encode("utf-8")),
                               "voice": VOICE, "rate": RATE, "filename": f"{key}.mp3"})
    assert len(result) == 141 and len({entry["key"] for entry in result}) == 141
    return result


def existing_entries() -> dict:
    if not MANIFEST.exists():
        return {}
    return {entry["key"]: entry for entry in json.loads(MANIFEST.read_text(encoding="utf-8"))["entries"]}


def verify_entry(spec: dict, previous: dict | None) -> dict | None:
    if not previous or any(previous.get(key) != value for key, value in spec.items()):
        return None
    path = OUTPUT / spec["filename"]
    if not path.exists():
        return None
    data = path.read_bytes()
    if digest(data) != previous.get("sha256"):
        return None
    return {**previous, **mp3_info(data)}


def write_manifest(entries: dict, expected: list[dict]) -> None:
    payload = {"version": 1, "provider": "Microsoft Edge online TTS", "language": "zh-CN",
               "voice": VOICE, "rate": RATE, "generatedAt": datetime.now(timezone.utc).isoformat(),
               "expectedCount": len(expected), "complete": len(entries) == len(expected),
               "scriptRule": "correct: question.explanation; incorrect: selected option.feedback; exact text, no additions",
               "entries": [entries[spec["key"]] for spec in expected if spec["key"] in entries]}
    temporary = MANIFEST.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST)


async def generate(args) -> None:
    expected = scripts()
    previous = existing_entries()
    entries = {}
    for spec in expected:
        valid = verify_entry(spec, previous.get(spec["key"]))
        if valid:
            entries[spec["key"]] = valid
    if args.verify:
        assert len(entries) == len(expected), f"Validated {len(entries)}/{len(expected)} recordings"
        print(json.dumps({"verified": len(entries), "bytes": sum(x["bytes"] for x in entries.values()),
                          "durationSeconds": round(sum(x["durationSeconds"] for x in entries.values()), 3)}, ensure_ascii=False))
        return
    import edge_tts
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pending = [spec for spec in expected if spec["key"] not in entries]
    if args.limit:
        pending = pending[:args.limit]
    semaphore = asyncio.Semaphore(args.concurrency)
    failures = []

    async def one(spec: dict) -> None:
        async with semaphore:
            path = OUTPUT / spec["filename"]
            temporary = path.with_suffix(".mp3.part")
            for attempt in range(2):
                try:
                    communicate = edge_tts.Communicate(spec["text"], VOICE, rate=RATE,
                                                      connect_timeout=15, receive_timeout=45)
                    await asyncio.wait_for(communicate.save(str(temporary)), timeout=60)
                    data = temporary.read_bytes()
                    info = mp3_info(data)
                    temporary.replace(path)
                    entries[spec["key"]] = {**spec, **info, "sha256": digest(data)}
                    write_manifest(entries, expected)
                    print(json.dumps({"generated": spec["key"], **info}, ensure_ascii=False), flush=True)
                    return
                except Exception as error:
                    temporary.unlink(missing_ok=True)
                    if attempt == 0:
                        await asyncio.sleep(1)
                    else:
                        failures.append({"key": spec["key"], "error": str(error)})
                        print(json.dumps(failures[-1], ensure_ascii=False), flush=True)

    await asyncio.gather(*(one(spec) for spec in pending))
    write_manifest(entries, expected)
    print(json.dumps({"available": len(entries), "expected": len(expected), "failures": failures}, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--concurrency", type=int, choices=range(1, 5), default=3)
    parser.add_argument("--verify", action="store_true")
    asyncio.run(generate(parser.parse_args()))
