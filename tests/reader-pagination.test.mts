import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeReadingPages, makeVersion4ReadingPages, migrateVersion4Page } from '../src/reader/pagination.ts';
import { VERSION4_LAYOUT, VERSION4_SOURCE_REVISION } from '../src/reader/legacy-v4-pages.ts';
import { createSave, flattenCorpus, pagePosition, validateSave } from '../src/reader/engine.ts';
import type { Corpus, Paragraph, Unit } from '../src/reader/model.ts';

const corpus = JSON.parse(readFileSync(new URL('../reader-public/text/republic.json', import.meta.url), 'utf8')) as Corpus;

test('coherent dialogue pages retain all source characters, order and metadata within bounded reading lengths', () => {
  const before = JSON.stringify(corpus);
  let textPageCount = 0;
  for (const unit of flattenCorpus(corpus)) {
    const pages = makeReadingPages(unit);
    const source = [...unit.paragraphs, ...(unit.question ? [unit.question.original] : []), ...unit.response];
    const fragments = pages.flatMap(page => page.kind === 'text' ? page.paragraphs : []);
    assert.equal(fragments.map(fragment => fragment.text).join(''), source.map(paragraph => paragraph.text).join(''), unit.id);
    assert.equal(new Set(pages.map(page => page.id)).size, pages.length, unit.id);
    assert.equal(new Set(fragments.map(fragment => fragment.id)).size, fragments.length, unit.id);
    for (const paragraph of source) {
      const pieces = fragments.filter(fragment => fragment.sourceId === paragraph.id);
      assert.ok(pieces.length, paragraph.id);
      assert.equal(pieces.map(piece => piece.text).join(''), paragraph.text, paragraph.id);
      assert.deepEqual(pieces.map(piece => piece.fragmentIndex), pieces.map((_, index) => index));
      let offset = 0;
      for (const piece of pieces) {
        const { id: _id, text: _text, sourceId: _sourceId, fragmentIndex: _fragmentIndex, fragmentOffset, ...metadata } = piece;
        const { id: _originalId, text: _originalText, ...originalMetadata } = paragraph;
        assert.deepEqual(metadata, originalMetadata, paragraph.id);
        assert.equal(fragmentOffset, offset, `${paragraph.id}: offset must be relative to the unsplit source paragraph`);
        assert.equal(paragraph.text.slice(fragmentOffset, fragmentOffset + piece.text.length), piece.text);
        offset += piece.text.length;
      }
    }
    for (const page of pages) {
      if (page.kind !== 'text') continue;
      textPageCount++;
      assert.ok(page.paragraphs.length >= 1 && page.paragraphs.length <= 12, page.id);
      assert.ok(page.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0) <= 760, page.id);
    }
    const questionIndex = pages.findIndex(page => page.kind === 'question');
    assert.equal(pages.filter(page => page.kind === 'question').length, Number(Boolean(unit.question)), unit.id);
    if (unit.question) {
      assert.ok(pages.slice(0, questionIndex).every(page => page.kind === 'text' && page.side === 'before'));
      assert.ok(pages.slice(questionIndex + 1).every(page => page.kind === 'text' && page.side === 'after'));
      const afterText = pages.slice(questionIndex + 1).flatMap(page => page.kind === 'text' ? page.paragraphs : []).map(paragraph => paragraph.text).join('');
      assert.equal(afterText, [unit.question.original, ...unit.response].map(paragraph => paragraph.text).join(''));
      const question = pages[questionIndex];
      assert.ok(question.kind === 'question' && question.question === unit.question);
      assert.equal('paragraphs' in question, false, 'the exercise page cannot leak the original reply');
    }
    assert.deepEqual(makeReadingPages(unit), pages, 'pagination is stable across calls');
  }
  assert.equal(textPageCount, 226);
  assert.equal(JSON.stringify(corpus), before);
});

test('punctuation, whitespace, paired quotes and supplementary characters are retained when a long paragraph is split', () => {
  const paragraphs: Paragraph[] = [
    { id: 'punctuation', text: `苏：“${'甲'.repeat(185)}。”  “${'乙'.repeat(185)}。”\n${'丙'.repeat(390)}！`, speaker: '苏格拉底', sourcePage: 12, sourcePages: [12, 13] },
    { id: 'unicode', text: `〔${'𠀀'.repeat(400)}〕` },
    { id: 'blank', text: '' },
    { id: 'spaces', text: '  \n  ' },
  ];
  const unit: Unit = { id: 'edge-pages', paragraphs, response: [] };
  const fragments = makeReadingPages(unit).flatMap(page => page.kind === 'text' ? page.paragraphs : []);
  assert.equal(fragments.map(fragment => fragment.text).join(''), paragraphs.map(paragraph => paragraph.text).join(''));
  assert.match(fragments[0].text, /。”$/);
  for (const fragment of fragments) {
    assert.equal(fragment.text.isWellFormed(), true);
    assert.ok(fragment.text.length <= 760);
  }
  assert.deepEqual(makeReadingPages({ id: 'empty', paragraphs: [], response: [] }), []);
});

test('multiple question-and-answer exchanges stay together, without stranding a final short answer', () => {
  const paragraphs = Array.from({ length: 10 }, (_, index) => ({
    id: `exchange-${index}`, text: index % 2 ? `格：是这样的。${'答'.repeat(20)}` : `苏：${'问'.repeat(60)}？`,
  }));
  const pages = makeReadingPages({ id: 'exchanges', paragraphs, response: [] });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].kind === 'text' && pages[0].paragraphs.length, 10);

  const longer = Array.from({ length: 14 }, (_, index) => ({
    id: `pair-${index}`, text: index % 2 ? `格：${'答'.repeat(22)}。` : `苏：${'问'.repeat(62)}？`,
  }));
  const pairPages = makeReadingPages({ id: 'pair-boundaries', paragraphs: longer, response: [] });
  assert.equal(pairPages.length, 2);
  assert.ok(pairPages.every(page => page.kind === 'text' && page.paragraphs.length % 2 === 0));
  assert.ok(pairPages.every(page => page.kind === 'text' && page.paragraphs.at(-1)!.text.startsWith('格：')));
});

test('the arrival at the house starts a new page after the complete port invitation', () => {
  const pages = makeReadingPages(flattenCorpus(corpus)[0]);
  const indoors = pages.findIndex(page => page.kind === 'text' && page.paragraphs.some(part => part.sourceId === 'p-0019'));
  assert.equal(indoors, 2);
  const page = pages[indoors];
  assert.ok(page.kind === 'text' && page.paragraphs[0].sourceId === 'p-0019');
  assert.ok(pages.slice(0, indoors).every(page => page.kind === 'text' && page.paragraphs.every(part => Number(part.sourceId.slice(2)) <= 18)));
});


function fingerprint(text: string) {
  let hash = 0x811c9dc5;
  for (const index of Array.from({ length: text.length }, (_, index) => index)) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  }
  return text.length + ':' + hash.toString(16).padStart(8, '0');
}

function paragraphsOn(unit: Unit, side: 'before' | 'after') {
  return side === 'before' ? unit.paragraphs : [...(unit.question ? [unit.question.original] : []), ...unit.response];
}

function pageContaining(unit: Unit, sourceId: string, offset = 0) {
  return makeReadingPages(unit).findIndex(page => page.kind === 'text' && page.paragraphs.some(fragment =>
    fragment.sourceId === sourceId && offset >= fragment.fragmentOffset &&
    offset < fragment.fragmentOffset + fragment.text.length));
}

test('published v4 metadata is an immutable 743-text-page snapshot, independent of current corpus pagination', () => {
  assert.equal(VERSION4_SOURCE_REVISION, 'ce1cb2e165e2e6c2536cc6f92ba2cf51be34d8ed');
  assert.equal(createHash('sha256').update(JSON.stringify(VERSION4_LAYOUT)).digest('hex'),
    '4092aedc8c5035b67fe757408d8c99ba0cc913a85aadfe248654f988739eedbc',
    'source edits must not regenerate the published page boundary table');
  let oldTextPages = 0;
  let oldQuestions = 0;
  for (const unit of flattenCorpus(corpus)) {
    const frozen = VERSION4_LAYOUT[unit.id];
    assert.ok(frozen, unit.id);
    const oldPages = makeVersion4ReadingPages(unit);
    assert.equal(oldPages.length, frozen.before.pages.length + frozen.after.pages.length + Number(Boolean(frozen.questionId)));
    assert.equal(oldPages.findIndex(page => page.kind === 'question'), frozen.questionId ? frozen.before.pages.length : -1);
    for (const side of ['before', 'after'] as const) {
      const pages = oldPages.filter(page => page.kind === 'text' && page.side === side);
      assert.equal(pages.length, frozen[side].pages.length);
      pages.forEach((page, index) => {
        assert.ok(page.kind === 'text');
        const [sourceIndex, offset] = frozen[side].pages[index];
        assert.equal(page.paragraphs[0].sourceId, frozen[side].sources[sourceIndex][0]);
        assert.equal(page.paragraphs[0].fragmentOffset, offset);
      });
      oldTextPages += pages.length;
    }
    oldQuestions += oldPages.filter(page => page.kind === 'question').length;
  }
  assert.equal(oldTextPages, 743);
  assert.equal(oldQuestions, 47);
});

test('all frozen v4 positions keep their question side and unchanged source anchors map exactly', () => {
  let exactAnchors = 0;
  let repairedAnchors = 0;
  for (const unit of flattenCorpus(corpus)) {
    const frozen = VERSION4_LAYOUT[unit.id];
    const oldPages = makeVersion4ReadingPages(unit);
    const pages = makeReadingPages(unit);
    for (const [oldIndex, oldPage] of oldPages.entries()) {
      const index = migrateVersion4Page(unit, oldIndex);
      const mapped = pages[index];
      assert.ok(mapped, unit.id + '/' + oldIndex);
      assert.equal(mapped.kind, oldPage.kind);
      if (oldPage.kind === 'question') {
        assert.ok(mapped.kind === 'question' && mapped.question.id === oldPage.question.id);
        continue;
      }
      assert.ok(mapped.kind === 'text');
      assert.equal(mapped.side, oldPage.side, 'no migration may cross the current question gate');
      const anchor = oldPage.paragraphs[0];
      const original = frozen[oldPage.side].sources.find(([id]) => id === anchor.sourceId)!;
      const current = paragraphsOn(unit, oldPage.side);
      const position = current.findIndex(part => part.id === anchor.sourceId);
      const previousIsNew = position > 0 && !frozen[oldPage.side].sources.some(([id]) => id === current[position - 1].id);
      if (position >= 0 && fingerprint(current[position].text) === original[1] && !previousIsNew) {
        assert.equal(index, pageContaining(unit, anchor.sourceId, anchor.fragmentOffset), unit.id + '/' + oldIndex);
        exactAnchors++;
      } else {
        repairedAnchors++;
        if (position >= 0) {
          assert.ok(index <= pageContaining(unit, anchor.sourceId), 'a repaired anchor must not skip the start of its paragraph');
        }
      }
    }
  }
  assert.ok(exactAnchors > 700);
  assert.ok(repairedAnchors > 0, 'the real corrected corpus must exercise conservative migration');
});

test('the restored reply and narration are not skipped when their old merged paragraphs were visible', () => {
  for (const [unitId, originalId, insertedId] of [
    ['u-010', 'p-0220', 'p-0220-reply'],
    ['u-022', 'p-0569', 'p-0569-narration'],
  ]) {
    const unit = flattenCorpus(corpus).find(unit => unit.id === unitId)!;
    const oldIndex = makeVersion4ReadingPages(unit).findIndex(page =>
      page.kind === 'text' && page.paragraphs[0].sourceId === originalId);
    assert.ok(oldIndex >= 0);
    const expected = pageContaining(unit, insertedId);
    assert.ok(expected >= 0, 'fixture requires the newly restored source paragraph');
    assert.equal(migrateVersion4Page(unit, oldIndex), expected);
  }
});

test('edits before a long-paragraph anchor rewind safely instead of reusing shifted character offsets', () => {
  const unit = structuredClone(flattenCorpus(corpus).find(unit => unit.id === 'u-020')!);
  const oldPages = makeVersion4ReadingPages(unit);
  const oldIndex = oldPages.findIndex(page => page.kind === 'text' && page.side === 'before' && page.paragraphs[0].fragmentOffset >= 500);
  const oldPage = oldPages[oldIndex];
  assert.ok(oldPage.kind === 'text');
  const sourceId = oldPage.paragraphs[0].sourceId;
  const paragraph = unit.paragraphs.find(part => part.id === sourceId)!;
  const original = paragraph.text;
  for (const replacement of ['补回的原文。'.repeat(180) + original, '改' + original.slice(1), original.slice(0, 40)]) {
    paragraph.text = replacement;
    assert.equal(makeVersion4ReadingPages(unit).length, oldPages.length, 'old page range cannot change after an insertion or deletion');
    assert.equal(migrateVersion4Page(unit, oldIndex), pageContaining(unit, sourceId), 'changed text resumes at its beginning');
  }
  paragraph.text = original;
  const sourceIndex = unit.paragraphs.indexOf(paragraph);
  unit.paragraphs.splice(sourceIndex, 0, { id: 'restored-before-long-speech', text: '补回的一整段话。'.repeat(90) });
  assert.equal(migrateVersion4Page(unit, oldIndex), pageContaining(unit, 'restored-before-long-speech'));
});

test('a removed old paragraph falls back to earlier surviving text on the same side', () => {
  const unit = structuredClone(flattenCorpus(corpus).find(unit => unit.id === 'u-020')!);
  const oldPages = makeVersion4ReadingPages(unit);
  const oldIndex = oldPages.findIndex(page => page.kind === 'text' && page.side === 'before' &&
    unit.paragraphs.findIndex(part => part.id === page.paragraphs[0].sourceId) > 1);
  const oldPage = oldPages[oldIndex];
  assert.ok(oldPage.kind === 'text');
  const index = unit.paragraphs.findIndex(part => part.id === oldPage.paragraphs[0].sourceId);
  const previousId = unit.paragraphs[index - 1].id;
  unit.paragraphs.splice(index, 1);
  assert.equal(migrateVersion4Page(unit, oldIndex), pageContaining(unit, previousId));
});

test('moving a question anchor later preserves the frozen gate and the unresolved-save restriction', () => {
  const units = flattenCorpus(corpus);
  const unit = units.find(unit => unit.question?.id === 'book4-same-form')!;
  assert.equal(unit.question!.original.id, 'p-1661');
  assert.ok(unit.paragraphs.some(part => part.id === 'p-1657'));
  const oldPages = makeVersion4ReadingPages(unit);
  const oldQuestion = oldPages.findIndex(page => page.kind === 'question');
  const currentPages = makeReadingPages(unit);
  const currentQuestion = currentPages.findIndex(page => page.kind === 'question');
  assert.equal(migrateVersion4Page(unit, oldQuestion), currentQuestion);
  assert.ok(oldPages[oldQuestion + 1].kind === 'text');
  assert.equal(migrateVersion4Page(unit, oldQuestion + 1), currentQuestion + 1,
    'the old original question moved before the gate; a completed old answer resumes at the new response beginning');
  for (let index = 0; index < oldQuestion; index++) assert.ok(migrateVersion4Page(unit, index) < currentQuestion);

  // A real v4 sequential-prefix save at this chapter, with all earlier gates resolved.
  const base = createSave(corpus, 'frozen-v4-gate');
  const answers = Object.fromEntries(units.slice(0, unit.index).filter(item => item.question).map(item =>
    [item.question!.id, { choiceId: item.question!.correctId, hinted: false, at: base.updatedAt }]));
  const { chapterProgress: _chapterProgress, bonus: _bonus, ...oldBase } = base;
  const snapshot = { ...oldBase, version: 4, started: true, cursor: unit.index, completed: unit.index,
    answers, resolved: Object.keys(answers), pages: { [unit.id]: oldQuestion }, scroll: 600 };
  const restored = validateSave(snapshot, corpus);
  assert.ok(restored, 'an unanswered old question page remains importable');
  assert.equal(pagePosition(restored, unit), currentQuestion);
  assert.equal(restored.scroll, 0);
  assert.deepEqual(restored.answers, answers);
  assert.equal(validateSave({ ...snapshot, pages: { [unit.id]: oldQuestion + 1 } }, corpus), null,
    'an old unresolved save cannot forge access past its original question gate');
  const answered = { ...snapshot, answers: { ...answers,
    [unit.question!.id]: { choiceId: unit.question!.correctId, hinted: false, at: base.updatedAt } },
    resolved: [...Object.keys(answers), unit.question!.id], pages: { [unit.id]: oldQuestion + 1 } };
  const restoredAnswer = validateSave(answered, corpus);
  assert.ok(restoredAnswer);
  assert.equal(pagePosition(restoredAnswer, unit), currentQuestion + 1);
  assert.deepEqual(restoredAnswer.answers, answered.answers);
});
