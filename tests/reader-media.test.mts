import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Corpus } from '../src/reader/model.ts';
import { flattenCorpus } from '../src/reader/engine.ts';

const corpus: Corpus = JSON.parse(readFileSync(new URL('../reader-public/text/republic.json', import.meta.url), 'utf8'));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

test('All 141 Mandarin recordings match the exact explanation for their selected option', () => {
  const directory = new URL('../reader-public/audio/feedback/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  assert.equal(manifest.complete, true);
  assert.equal(manifest.language, 'zh-CN');
  assert.equal(manifest.voice, 'zh-CN-XiaoxiaoNeural');
  assert.equal(manifest.entries.length, 141);
  assert.equal(new Set(manifest.entries.map((entry: any) => entry.key)).size, 141);
  const expected = flattenCorpus(corpus).flatMap(unit => unit.question ? unit.question.options.map(option => ({ question: unit.question!, option })) : []);
  for (const { question, option } of expected) {
    const key = `${question.id}--${option.id}`;
    const entry = manifest.entries.find((entry: any) => entry.key === key);
    assert.ok(entry, key);
    assert.equal(entry.correct, option.id === question.correctId);
    assert.equal(entry.text, entry.correct ? question.explanation : option.feedback);
    assert.equal(entry.textSha256, sha(entry.text));
    assert.equal(entry.filename, `${key}.mp3`);
    const bytes = readFileSync(new URL(entry.filename, directory));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(sha(bytes), entry.sha256);
    assert.ok(entry.durationSeconds > 0 && entry.frames > 0);
  }
  assert.equal(readdirSync(directory).filter(name => name.endsWith('.mp3')).length, expected.length);
});

test('Every chapter and the opening harbor scene have a compressed color illustration', () => {
  const directory = new URL('../reader-public/illustrations/', import.meta.url);
  const names = readdirSync(directory);
  for (const id of [...corpus.chapters.map(chapter => chapter.id), 'arrival']) {
    const bytes = readFileSync(new URL(`${id}.webp`, directory));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length > 10_000 && bytes.length < 1_000_000);
  }
  assert.equal(names.filter(name => name.endsWith('.webp')).length, 9);
  assert.ok(!names.some(name => /\.(png|jpe?g)$/i.test(name)), 'uncompressed originals stay outside the distributed game');
});
