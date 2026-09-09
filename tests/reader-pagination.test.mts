import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeReadingPages } from '../src/reader/pagination.ts';
import { flattenCorpus } from '../src/reader/engine.ts';
import type { Corpus, Paragraph, Unit } from '../src/reader/model.ts';

const corpus = JSON.parse(readFileSync(new URL('../reader-public/text/republic.json', import.meta.url), 'utf8')) as Corpus;

test('all source paragraphs survive fixed short pages character-for-character, in order and with their source metadata', () => {
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
      assert.ok(page.paragraphs.length >= 1 && page.paragraphs.length <= 3, page.id);
      assert.ok(page.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0) <= 260, page.id);
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
  assert.ok(textPageCount > 350, `expected short reading pages, got ${textPageCount}`);
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
    assert.ok(fragment.text.length <= 260);
  }
  assert.deepEqual(makeReadingPages({ id: 'empty', paragraphs: [], response: [] }), []);
});
