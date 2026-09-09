import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Corpus } from '../src/reader/model.ts';
import { flattenCorpus } from '../src/reader/engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';

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

test('Every reading page has a verified source-mapped color illustration, and page turns change the image', () => {
  const directory = new URL('../reader-public/illustrations/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  const pages = flattenCorpus(corpus).flatMap(unit => makeReadingPages(unit));
  assert.equal(manifest.editionId, corpus.edition.id);
  assert.equal(manifest.paginationVersion, 5);
  assert.deepEqual(Object.keys(manifest.pages), pages.map(page => page.id));
  assert.ok(Object.keys(manifest.assets).length >= 50, 'new full illustrations, not nine chapter backgrounds');
  const hashes = new Set<string>();
  for (const asset of Object.values(manifest.assets) as any[]) {
    const bytes = readFileSync(new URL(asset.file, directory));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length > 10_000 && bytes.length < 1_000_000);
    assert.equal(sha(bytes), asset.sha256);
    assert.ok(!hashes.has(asset.sha256), 'each artwork is a different file, not a renamed duplicate');
    hashes.add(asset.sha256);
  }
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index], id = manifest.pages[page.id];
    assert.ok(manifest.assets[id], page.id);
    if (page.kind === 'question') assert.equal(manifest.assets[id].kind, 'conversation', 'no illustrated answer examples on question pages');
    if (index) assert.notEqual(id, manifest.pages[pages[index - 1].id], `fresh picture on page turn ${page.id}`);
  }
  const names = readdirSync(directory, { recursive: true }).map(String);
  assert.equal(names.filter(name => name.endsWith('.webp') && !/^bonus[\\/]/.test(name)).length, hashes.size);
  assert.ok(!names.some(name => /\.(png|jpe?g)$/i.test(name)), 'uncompressed originals stay outside the distributed game');
});

test('The unlocked epilogue has twelve distinct illustrated scenes and verified Mandarin congratulations', () => {
  const content = JSON.parse(readFileSync(new URL('../content/bonus/death.json', import.meta.url), 'utf8'));
  const art = JSON.parse(readFileSync(new URL('../content/art/bonus-art.json', import.meta.url), 'utf8'));
  assert.equal(content.scenes.length, 12);
  assert.equal(art.length, 12);
  assert.deepEqual(content.scenes.map((scene: any) => scene.id), art.map((asset: any) => asset.id));
  const hashes = new Set<string>();
  for (const scene of content.scenes) {
    assert.deepEqual(scene.question.options.map((option: any) => option.id), ['a', 'b', 'c']);
    assert.ok(scene.sourceRef.length > 5 && new URL(scene.sourceUrl).protocol === 'https:');
    assert.ok(scene.passages.length > 0 && !('correctId' in scene.question));
    for (const option of scene.question.options) assert.ok(option.text && option.note && option.response.length > 0);
    const asset = art.find((asset: any) => asset.id === scene.illustrationId);
    assert.ok(asset && asset.alt && asset.prompt);
    assert.equal(asset.file, `bonus/${scene.id}.webp`);
    const bytes = readFileSync(new URL(`../reader-public/illustrations/${asset.file}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length > 10_000 && bytes.length < 1_000_000);
    assert.ok(!hashes.has(sha(bytes)), scene.id);
    hashes.add(sha(bytes));
  }
  const audioDir = new URL('../reader-public/audio/completion/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', audioDir), 'utf8'));
  assert.equal(manifest.language, 'zh-CN');
  assert.equal(manifest.voice, 'zh-CN-XiaoxiaoNeural');
  assert.equal(manifest.textSha256, sha(manifest.text));
  assert.ok(manifest.text.includes('恭喜你') && manifest.text.includes('隐藏章节《苏格拉底之死》已经开启'));
  const bytes = readFileSync(new URL(manifest.filename, audioDir));
  assert.equal(bytes.length, manifest.bytes);
  assert.equal(sha(bytes), manifest.sha256);
  assert.ok(manifest.durationSeconds > 10 && manifest.durationSeconds < 60);
});

test('Illustrated examples are only assigned inside their source range and source section', () => {
  const artDirectory = new URL('../content/art/', import.meta.url);
  const scenes = readdirSync(artDirectory).filter(name => name.endsWith('-scenes.json')).flatMap(name => JSON.parse(readFileSync(new URL(name, artDirectory), 'utf8')));
  const manifest = JSON.parse(readFileSync(new URL('../reader-public/illustrations/manifest.json', import.meta.url), 'utf8'));
  const sourceOrder = new Map(flattenCorpus(corpus).flatMap(unit => [...unit.paragraphs, ...(unit.question ? [unit.question.original] : []), ...unit.response]).map((paragraph, index) => [paragraph.id, index]));
  const number = (id: string) => sourceOrder.get(id)!;
  for (const unit of flattenCorpus(corpus)) for (const page of makeReadingPages(unit)) {
    const scene = scenes.find(scene => scene.id === manifest.pages[page.id]);
    if (!scene || scene.kind !== 'example') continue;
    assert.equal(page.kind, 'text');
    if (page.kind !== 'text') continue;
    assert.ok(scene.chapterId === unit.chapter.id || scene.chapterIds?.includes(unit.chapter.id));
    assert.ok(!scene.sectionIds.length || scene.sectionIds.includes(unit.section.id));
    const first = number(page.paragraphs[0].sourceId), last = number(page.paragraphs.at(-1)!.sourceId);
    assert.ok(last >= number(scene.sourceStart) && first <= number(scene.sourceEnd), page.id);
  }
});
