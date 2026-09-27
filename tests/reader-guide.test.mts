import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chapterNumeral, guideForChapter, bookCoverage, chapterTextLength, GUIDE_THEMES, BOOK_GUIDES } from '../src/reader/reading-guide.ts';
import { readStoredStudy, FULL_REPUBLIC_EDITION, PREVIOUS_REPUBLIC_EDITION } from '../src/reader/study-storage.ts';
import type { Chapter } from '../src/reader/model.ts';
import { createSave, flattenCorpus, enterChapter, advance } from '../src/reader/engine.ts';
import { createReadingBackup, readReadingBackup } from '../src/reader/reading-backup.ts';

const structure = JSON.parse(readFileSync(new URL('../content/structure.json', import.meta.url), 'utf8'));

test('all twenty chapter guides cover the exact structure and ten original books', () => {
  assert.equal(structure.length, 20);
  assert.equal(bookCoverage(structure), '全十卷');
  const themes = new Set(GUIDE_THEMES.map(item => item.id));
  for (const chapter of structure) {
    const guide = guideForChapter(chapter);
    assert.equal(guide.id, chapter.id);
    assert.ok(guide.books.length && guide.books.every(number => number >= 1 && number <= 10));
    assert.ok(guide.themes.length && guide.themes.every(theme => themes.has(theme)));
    assert.ok(guide.focus && guide.before && guide.watch && guide.open);
    assert.equal(guide.steps.length, 3);
  }
  assert.deepEqual(BOOK_GUIDES.map(book => book.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('chapter numbering continues through twenty and future chapter guides use book ranges', () => {
  assert.deepEqual([1, 8, 9, 10, 11, 19, 20, 21].map(chapterNumeral), ['一', '八', '九', '十', '十一', '十九', '二十', '二十一']);
  assert.deepEqual(guideForChapter({ id: 'future', range: '第九卷 · 571a—580c' } as Chapter).books, [9]);
  assert.deepEqual(guideForChapter({ id: 'future-cross', range: '第六、七卷 · 511e—521c' } as Chapter).books, [6, 7]);
});

test('chapter length counts original paragraphs, withheld question and replies once', () => {
  const chapter = { sections: [{ units: [{ paragraphs: [{ text: '甲 乙' }], question: { original: { text: '丙？' } }, response: [{ text: '丁。' }] }] }] } as Chapter;
  assert.equal(chapterTextLength(chapter), 6);
});

test('known previous study records migrate without changing first answer, retries or bonus records', () => {
  const checks = [{ id: 'study-old', options: [{ id: 'a' }, { id: 'b' }], correctId: 'b' }, { id: 'bonus-old', options: [{ id: 'a' }, { id: 'b' }], correctId: 'a' }, { id: 'study-new', options: [{ id: 'a' }], correctId: 'a' }] as any;
  const records = { 'study-old': { firstChoiceId: 'a', lastChoiceId: 'b', attempts: 2, correct: true }, 'bonus-old': { firstChoiceId: 'a', lastChoiceId: 'a', attempts: 1, correct: true } };
  assert.deepEqual(readStoredStudy({ version: 1, editionId: PREVIOUS_REPUBLIC_EDITION, records }, FULL_REPUBLIC_EDITION, checks), records);
  assert.equal(readStoredStudy({ version: 1, editionId: 'unknown-edition', records }, FULL_REPUBLIC_EDITION, checks), null);
  assert.equal(readStoredStudy({ version: 1, editionId: FULL_REPUBLIC_EDITION, records }, PREVIOUS_REPUBLIC_EDITION, checks), null);
  assert.equal(readStoredStudy({ version: 1, editionId: PREVIOUS_REPUBLIC_EDITION, records: { 'study-new': { firstChoiceId: 'b', lastChoiceId: 'b', attempts: 1, correct: false } } }, FULL_REPUBLIC_EDITION, checks), null);
});

test('a previous-edition backup keeps study records and unlocked bonus while appending unread chapters', () => {
  const chapters = structure.map((chapter: any, index: number) => ({ ...chapter, sections: [{ id: `section-${index}`, title: '测试段落', range: chapter.range, units: [{ id: `unit-${index}`, paragraphs: [{ id: `paragraph-${index}`, text: '原文' }], response: [] }] }] }));
  const edition = { id: PREVIOUS_REPUBLIC_EDITION, label: '旧版', description: '', translator: '', sourceUrl: '', license: '', notes: [] };
  const oldCorpus = { title: '测试旧版', edition, chapters: chapters.slice(0, 8) };
  let old = createSave(oldCorpus, 'legacy-study-backup');
  const units = flattenCorpus(oldCorpus);
  for (const unit of units) { old = enterChapter(old, units, unit.chapter.id); old = advance(old, units); }
  old.bonus.choices['trial-gate'] = 'a'; old.bonus.visited['trial-gate'] = ['a'];
  const fullCorpus = { ...oldCorpus, edition: { ...edition, id: FULL_REPUBLIC_EDITION }, chapters };
  const checks = [{ id: 'study-old', options: [{ id: 'a' }, { id: 'b' }], correctId: 'b' }] as any;
  const study = { 'study-old': { firstChoiceId: 'a', lastChoiceId: 'b', attempts: 2, correct: true } };
  const recovered = readReadingBackup(createReadingBackup(old, study), fullCorpus, checks);
  assert.deepEqual(recovered.study, study);
  assert.deepEqual(recovered.reading.bonus, old.bonus);
  assert.equal(Object.keys(recovered.reading.chapterProgress).length, 20);
  assert.equal(recovered.reading.chapterProgress.destiny.completed, 0);
  assert.throws(() => readReadingBackup(createReadingBackup({ ...old, editionId: 'unrecognized-edition' }, study), fullCorpus, checks));
});
