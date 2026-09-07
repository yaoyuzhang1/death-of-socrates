import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { scenes } from "../src/content/index.ts";

const manifest = JSON.parse(
  readFileSync(new URL("../public/voice-manifest.json", import.meta.url), "utf8"),
) as {
  speaker: string;
  text: string;
  file: string;
  voiceId: string;
  duration: number;
  sha256: string;
  textHash: string;
  language: string;
  wordBoundaryTextMatches: boolean;
  decoded: boolean;
  listeningReviewed: boolean;
}[];
const cast = JSON.parse(
  readFileSync(new URL("../scripts/voice-cast.json", import.meta.url), "utf8"),
);
const expected = new Set(
  scenes
    .flatMap((s) => [...s.lines, ...s.options.flatMap((o) => o.reply), ...(s.echoes ?? [])])
    .map((line) => line.speaker + "\n" + line.text),
);

test("every visible authored dialogue and conditional echo has exactly one matching recording", () => {
  const recorded = manifest.map((clip) => clip.speaker + "\n" + clip.text);
  assert.equal(recorded.length, new Set(recorded).size);
  assert.deepEqual([...new Set(recorded)].sort(), [...expected].sort());
});

test("recordings match their text, cast, verified Mandarin configuration and audio hashes", () => {
  for (const clip of manifest) {
    assert.match(clip.file, /^line-[a-f0-9]{20}\.mp3$/);
    assert.equal(clip.language, "zh-CN");
    assert.equal(clip.voiceId, cast.roles[clip.speaker].voiceId);
    assert.equal(
      clip.textHash,
      createHash("sha256")
        .update(clip.speaker + "\n" + clip.text)
        .digest("hex"),
    );
    const bytes = readFileSync(new URL("../public/voice/" + clip.file, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), clip.sha256);
    assert.ok(bytes.length > 1024 && clip.duration > 0);
    assert.equal(clip.wordBoundaryTextMatches, true);
    assert.equal(clip.decoded, true);
  }
});

test("the public audio directory contains only current referenced recordings", () => {
  const files = readdirSync(new URL("../public/voice/", import.meta.url));
  assert.deepEqual(files.sort(), manifest.map((clip) => clip.file).sort());
});
