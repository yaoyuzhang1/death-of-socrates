"""Render authored dialogue as Mandarin MP3s with resumable, verified records.

Requires edge-tts 7.2.8 and aiohttp in the synthesis environment, and PyAV or
SoundFile/NumPy in the interpreter selected with --decode-python.
Only the exported game script is submitted to the speech service.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
OUTPUT = ROOT / "public" / "voice"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def words_only(text):
    return "".join(char for char in unicodedata.normalize("NFKC", text) if unicodedata.category(char)[0] in "LN")


def decode_file(path):
    import numpy as np
    try:
        import av
    except ImportError:
        import soundfile as sf
        wave, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)
        if not len(wave) or sample_rate <= 0 or not np.isfinite(wave).all():
            raise ValueError("Invalid or empty decoded PCM")
        peak = float(np.max(np.abs(wave)))
        rms = float(np.sqrt(np.mean(wave.astype(np.float64) ** 2)))
        if peak < 0.0001 or rms < 0.00001:
            raise ValueError("Silent decoded audio")
        return {"duration": round(len(wave) / sample_rate, 6), "samples": len(wave),
                "sampleRate": sample_rate, "peak": round(peak, 7), "rms": round(rms, 7),
                "decoder": "libsndfile via SoundFile"}
    duration = 0.0
    frames = 0
    samples = 0
    peak = 0.0
    with av.open(str(path)) as container:
        if not container.streams.audio:
            raise ValueError("No audio stream")
        for frame in container.decode(audio=0):
            if frame.sample_rate <= 0:
                raise ValueError("Invalid audio sample rate")
            frames += 1
            samples += frame.samples
            duration += frame.samples / frame.sample_rate
            pcm = frame.to_ndarray()
            if not np.isfinite(pcm).all():
                raise ValueError("Nonfinite decoded PCM")
            peak = max(peak, float(np.max(np.abs(pcm.astype(np.float64)))))
    if frames == 0 or samples == 0 or duration <= 0 or peak <= 0:
        raise ValueError("Empty decoded audio")
    return {"duration": round(duration, 6), "frames": frames, "samples": samples, "decoder": "PyAV"}


async def run(args):
    import aiohttp
    import edge_tts
    cast = read(ROOT / "scripts" / "voice-cast.json")
    cues = read(LOCAL / "voice-cues.json")["clips"]
    if args.limit:
        cues = cues[:args.limit]
    if not cues:
        raise ValueError("No authored dialogue exported")
    LOCAL.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records_path = LOCAL / "voice-recordings.json"
    records = read(records_path) if records_path.exists() else {}
    decoder = args.decode_python or os.environ.get("VOICE_DECODE_PYTHON", sys.executable)
    for attempt in range(4):
        try:
            inventory = await asyncio.wait_for(edge_tts.list_voices(), timeout=45)
            break
        except (aiohttp.ClientError, TimeoutError):
            if attempt == 3:
                raise RuntimeError("Cannot retrieve live voice inventory after four attempts") from None
            await asyncio.sleep(2 ** attempt)
    names = {voice["ShortName"]: voice for voice in inventory}
    for speaker in {cue["speaker"] for cue in cues}:
        profile = cast["roles"].get(speaker)
        voice = names.get(profile["voiceId"]) if profile else None
        if not voice or voice.get("Locale") != "zh-CN":
            raise ValueError("Voice is not verified standard Mandarin: " + speaker)
    write(LOCAL / "voice-inventory.json", [voice for voice in inventory if voice["Locale"] == "zh-CN"])
    semaphore = asyncio.Semaphore(args.concurrency)
    completed = 0
    reused = 0

    async def decode(path):
        process = await asyncio.create_subprocess_exec(
            decoder, str(Path(__file__).resolve()), "--decode-file", str(path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60)
        if process.returncode:
            raise ValueError("Audio decode failed: " + stderr.decode("utf-8", errors="replace")[-500:])
        return json.loads(stdout)

    async def generate(cue):
        nonlocal completed, reused
        profile = cast["roles"][cue["speaker"]]
        settings = {key: profile[key] for key in ("voiceId", "rate", "pitch")}
        fingerprint = hashlib.sha256(json.dumps({"text": cue["text"], "speaker": cue["speaker"], **settings}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        target = OUTPUT / cue["file"]
        prior = records.get(cue["id"])
        async with semaphore:
            if prior and prior.get("requestFingerprint") == fingerprint and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == prior.get("sha256"):
                verified = await decode(target)
                prior.update(verified)
                prior["decoded"] = True
                completed += 1
                reused += 1
                if completed % 15 == 0:
                    print(f"PROGRESS {completed}/{len(cues)} reused={reused}", flush=True)
                return
            for attempt in range(5):
                temporary = LOCAL / (cue["file"] + ".part.mp3")
                try:
                    stream = edge_tts.Communicate(cue["text"], settings["voiceId"], rate=settings["rate"], pitch=settings["pitch"], boundary="WordBoundary", connect_timeout=30, receive_timeout=90)
                    audio = bytearray()
                    boundaries = []
                    async for chunk in stream.stream():
                        if chunk["type"] == "audio":
                            audio.extend(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            boundaries.append(chunk)
                    if not audio or not boundaries:
                        raise ValueError("Missing audio or word boundaries")
                    returned_text = "".join(boundary["text"] for boundary in boundaries)
                    if words_only(returned_text) != words_only(cue["text"]):
                        write(LOCAL / (cue["id"] + ".mismatch.json"), {"expected": cue["text"], "returned": returned_text})
                        raise ValueError("Word-boundary text mismatch")
                    temporary.write_bytes(audio)
                    verified = await decode(temporary)
                    last_word_end = (boundaries[-1]["offset"] + boundaries[-1]["duration"]) / 10_000_000
                    if verified["duration"] + 0.3 < last_word_end:
                        raise ValueError("Decoded audio ends before final word")
                    temporary.replace(target)
                    write(LOCAL / (cue["id"] + ".boundaries.json"), boundaries)
                    records[cue["id"]] = {
                        "speaker": cue["speaker"], "text": cue["text"], "file": cue["file"],
                        "language": "zh-CN", **settings, **verified,
                        "sha256": hashlib.sha256(audio).hexdigest(), "textHash": cue["hash"],
                        "requestFingerprint": fingerprint, "wordBoundaryTextMatches": True,
                        "decoded": True, "listeningReviewed": False,
                    }
                    write(records_path, records)
                    completed += 1
                    print(f"READY {completed}/{len(cues)} {cue['speaker']} {cue['id']} {verified['duration']:.2f}s", flush=True)
                    return
                except (aiohttp.ClientError, TimeoutError, ValueError, edge_tts.exceptions.EdgeTTSException) as error:
                    print(f"RETRY {cue['id']} attempt={attempt + 1} {type(error).__name__}: {str(error)[:150]}", flush=True)
                    if attempt == 4:
                        raise RuntimeError(f"{cue['id']}: {type(error).__name__}: {str(error)[:200]}") from None
                    await asyncio.sleep(min(2 ** attempt, 12))

    started = time.monotonic()
    outcomes = await asyncio.gather(*(generate(cue) for cue in cues), return_exceptions=True)
    write(records_path, records)
    failures = [{"id": cue["id"], "error": str(result)} for cue, result in zip(cues, outcomes) if isinstance(result, BaseException)]
    write(LOCAL / "voice-errors.json", failures)
    if failures:
        raise RuntimeError(f"{len(failures)} clips incomplete; verified clips retained for resume")
    public_keys = ("speaker", "text", "file", "voiceId", "duration", "sha256", "textHash", "language", "wordBoundaryTextMatches", "decoded", "listeningReviewed")
    manifest = [{key: records[cue["id"]][key] for key in public_keys} for cue in cues]
    manifest_path = LOCAL / "voice-sample-manifest.json" if args.limit else ROOT / "public" / "voice-manifest.json"
    write(manifest_path, manifest)
    total_duration = sum(record["duration"] for record in manifest)
    summary = {
        "clips": len(manifest), "reused": reused, "durationSeconds": round(total_duration, 3),
        "bytes": sum((OUTPUT / record["file"]).stat().st_size for record in manifest),
        "elapsedSeconds": round(time.monotonic() - started, 2), "failures": 0,
        "localeVerified": "zh-CN", "allWordBoundariesMatch": True, "allDecoded": True,
        "listeningReview": "not performed", "asrReview": "not performed for this game",
    }
    write(LOCAL / "voice-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--decode-python", help="Python with PyAV or SoundFile/NumPy; defaults to VOICE_DECODE_PYTHON or this interpreter")
    parser.add_argument("--decode-file", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--concurrency", type=int, choices=(2, 3), default=3)
    parser.add_argument("--limit", type=int, help="Render only the first N exported clips for a local production check")
    args = parser.parse_args()
    if args.decode_file:
        print(json.dumps(decode_file(args.decode_file)))
    else:
        asyncio.run(run(args))


if __name__ == "__main__":
    main()
