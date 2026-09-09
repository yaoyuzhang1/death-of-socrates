import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { BONUS_SCENE_IDS } from '../src/reader/model.ts';
import type { LearningCheckData } from '../src/reader/learning.ts';

type Passage = { speaker: string; text: string };
type Scene = { id: string; sourceRef: string; sourceUrl: string; passages: Passage[]; question: {
  options: { id: string; text: string; response: Passage[]; note: string }[];
} };
const read = (relative: string) => JSON.parse(readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));
const story: { scenes: Scene[] } = read('content/bonus/death.json');
const checks: LearningCheckData[] = read('content/bonus/checks.json');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

test('Every historical scene has one separate source-grounded judgment while all 36 exploratory dialogue angles remain ungraded', () => {
  assert.equal(checks.length, 12);
  assert.deepEqual(checks.map(check => check.sceneId), [...BONUS_SCENE_IDS]);
  assert.equal(new Set(checks.map(check => check.id)).size, 12);
  for (const [index, check] of checks.entries()) {
    const scene = story.scenes[index];
    assert.equal(check.id, `bonus-check-${scene.id}`);
    assert.equal(check.sourceUrl, scene.sourceUrl);
    assert.equal(check.sourceRef.split('》')[0], scene.sourceRef.split('》')[0]);
    assert.match(check.sourceRef, /《(?:申辩篇|克里同篇|斐多篇)》\d+[a-e]/);
    assert.equal(new URL(check.sourceUrl!).protocol, 'https:');
    assert.ok(check.prompt.length >= 10 && check.prompt.length <= 80);
    assert.deepEqual(check.options.map(option => option.id), ['a', 'b', 'c']);
    assert.equal(new Set(check.options.map(option => option.text)).size, 3);
    assert.ok(check.options.every(option => option.text.length >= 12 && option.feedback.length >= 25));
    const correct = check.options.find(option => option.id === check.correctId);
    assert.ok(correct);
    assert.equal(correct.feedback, check.explanation, 'the spoken correct feedback must match the visible reason');
    assert.ok(check.options.filter(option => option !== correct).every(option => option.feedback !== check.explanation));
    assert.deepEqual(scene.question.options.map(option => option.id), ['a', 'b', 'c']);
    assert.ok(!('correctId' in scene.question), 'the three exploratory angles remain distinct from the subsequent graded check');
    assert.ok(!scene.question.options.some(option => option.text === check.prompt));
  }
});

test('All Mandarin story recordings match their exact visible paragraph or note, voice direction and file hash', () => {
  const directory = new URL('../reader-public/audio/bonus/', import.meta.url);
  const manifest = read('reader-public/audio/bonus/manifest.json');
  assert.equal(manifest.complete, true);
  assert.equal(manifest.language, 'zh-CN');
  const catalog = new Map(manifest.verifiedVoiceCatalog.map((voice: any) => [voice.ShortName, voice]));
  const expected: { key: string; filename: string; kind: 'intro' | 'response' | 'note'; sceneId: string; speaker: string; text: string; passageIndex?: number; optionId?: string }[] = [];
  for (const scene of story.scenes) {
    scene.passages.forEach((passage, index) => expected.push({
      key: `${scene.id}--intro--p${index}`, filename: `intro/${scene.id}--intro--p${index}.mp3`,
      kind: 'intro', sceneId: scene.id, passageIndex: index, ...passage,
    }));
    for (const option of scene.question.options) {
      option.response.forEach((passage, index) => expected.push({
        key: `${scene.id}--${option.id}--p${index}`, filename: `responses/${scene.id}--${option.id}--p${index}.mp3`,
        kind: 'response', sceneId: scene.id, optionId: option.id, passageIndex: index, ...passage,
      }));
      expected.push({ key: `${scene.id}--${option.id}--note`, filename: `notes/${scene.id}--${option.id}--note.mp3`,
        kind: 'note', sceneId: scene.id, optionId: option.id, speaker: '旁白', text: option.note });
    }
  }
  assert.equal(manifest.expectedCount, expected.length);
  assert.equal(manifest.entries.length, expected.length);
  assert.equal(new Set(manifest.entries.map((entry: any) => entry.key)).size, expected.length);
  assert.equal(expected.filter(entry => entry.kind === 'note').length, 36);
  for (const source of expected) {
    const entry = manifest.entries.find((item: any) => item.key === source.key);
    assert.ok(entry, source.key);
    for (const key of ['filename', 'kind', 'sceneId', 'speaker', 'text', 'passageIndex', 'optionId'] as const) {
      assert.equal(entry[key], source[key], `${source.key} ${key}`);
    }
    const voice = source.speaker.startsWith('苏格拉底') ? 'zh-CN-YunxiNeural' : source.speaker === '旁白' ? 'zh-CN-XiaoxiaoNeural' : 'zh-CN-YunyangNeural';
    assert.equal(entry.voice, voice, `${source.key} character voice`);
    assert.equal((catalog.get(voice) as any)?.Locale, 'zh-CN');
    assert.equal(entry.rate, source.speaker.startsWith('苏格拉底') ? '-5%' : source.speaker === '克里同' ? '-7%' : '-3%');
    assert.equal(entry.textSha256, sha(source.text));
    assert.equal(entry.mimeType, 'audio/mpeg');
    assert.ok(entry.durationSeconds > 0 && entry.durationSeconds < 90 && entry.frames > 0);
    assert.deepEqual(entry.sampleRates, [24000]);
    const bytes = readFileSync(new URL(entry.filename, directory));
    assert.equal(bytes.length, entry.bytes);
    assert.ok(bytes.length > 1000);
    assert.equal(sha(bytes), entry.sha256, source.key);
  }
  const actual = readdirSync(directory, { recursive: true }).map(String).filter(name => name.endsWith('.mp3')).map(name => name.replaceAll('\\', '/')).sort();
  assert.deepEqual(actual, expected.map(entry => entry.filename).sort());
});
