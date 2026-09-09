import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const hash = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
test('all 150 study explanations have exact text, Mandarin voice and verified playable files', () => {
  const manifest = JSON.parse(readFileSync('reader-public/audio/study/manifest.json', 'utf8'));
  const checks = ['content/learning/checks.json', 'content/bonus/checks.json'].flatMap(path => JSON.parse(readFileSync(path, 'utf8')));
  assert.equal(manifest.expectedCount, checks.length * 3);
  assert.equal(manifest.expectedCount, 150);
  assert.equal(manifest.language, 'zh-CN');
  assert.equal(manifest.complete, true);
  assert.equal(manifest.entries.length, manifest.expectedCount);
  assert.equal(new Set(manifest.entries.map((entry: { key: string }) => entry.key)).size, manifest.entries.length);
  for (const entry of manifest.entries) {
    const check = checks.find(item => item.id === entry.checkId);
    assert.ok(check);
    const option = check.options.find((item: { id: string }) => item.id === entry.optionId);
    assert.ok(option);
    const expected = option.id === check.correctId ? check.explanation : option.feedback;
    assert.equal(entry.key, `${check.id}--${option.id}`);
    assert.equal(entry.filename, `${entry.key}.mp3`);
    assert.equal(entry.text, expected);
    assert.equal(entry.textSha256, hash(expected));
    assert.equal(entry.voice, 'zh-CN-XiaoxiaoNeural');
    assert.equal(entry.correct, option.id === check.correctId);
    assert.equal(entry.rate, '-3%');
    assert.deepEqual(entry.sampleRates, [24000]);
    const file = readFileSync('reader-public/audio/study/' + entry.filename);
    assert.equal(file.length, entry.bytes);
    assert.equal(hash(file), entry.sha256);
    assert.ok(entry.durationSeconds > 0);
  }
});
