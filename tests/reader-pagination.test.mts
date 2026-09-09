import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeReadingPages, makeVersion4ReadingPages, migrateVersion4Page } from '../src/reader/pagination.ts';
import { flattenCorpus } from '../src/reader/engine.ts';
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
      for (const piece of pieces) {
        const { id: _id, text: _text, sourceId: _sourceId, fragmentIndex: _fragmentIndex, ...metadata } = piece;
        const { id: _originalId, text: _originalText, ...originalMetadata } = paragraph;
        assert.deepEqual(metadata, originalMetadata, paragraph.id);
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

test('every old v4 page maps to the first visible source character on the same side of its question gate', () => {
  let oldTextPages = 0;
  for (const unit of flattenCorpus(corpus)) {
    const oldPages = makeVersion4ReadingPages(unit);
    const newPages = makeReadingPages(unit);
    const sourceOffsets = new Map<string, number>();
    for (const [oldIndex, oldPage] of oldPages.entries()) {
      const mappedIndex = migrateVersion4Page(unit, oldIndex);
      const mapped = newPages[mappedIndex];
      assert.ok(mapped, `${unit.id}/${oldIndex}`);
      assert.equal(mapped.kind, oldPage.kind);
      if (oldPage.kind === 'question') {
        assert.ok(mapped.kind === 'question' && mapped.question.id === oldPage.question.id);
        continue;
      }
      oldTextPages++;
      assert.ok(mapped.kind === 'text');
      assert.equal(mapped.side, oldPage.side);
      const anchor = oldPage.paragraphs[0];
      const offset = sourceOffsets.get(anchor.sourceId) ?? 0;
      let currentOffset = 0;
      let located = false;
      for (const [index, page] of newPages.entries()) {
        if (page.kind !== 'text') continue;
        for (const fragment of page.paragraphs) {
          if (fragment.sourceId !== anchor.sourceId) continue;
          if (offset >= currentOffset && offset < currentOffset + fragment.text.length) {
            assert.equal(index, mappedIndex, `${unit.id}/${oldIndex}/${anchor.sourceId}/${offset}`);
            located = true;
          }
          currentOffset += fragment.text.length;
        }
      }
      assert.ok(located, `${unit.id}/${oldIndex}`);
      for (const fragment of oldPage.paragraphs) {
        sourceOffsets.set(fragment.sourceId, (sourceOffsets.get(fragment.sourceId) ?? 0) + fragment.text.length);
      }
    }
  }
  assert.equal(oldTextPages, 743, 'published v4 page boundaries must remain frozen for migration');
});
