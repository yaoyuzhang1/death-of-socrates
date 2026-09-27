import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { flattenCorpus } from '../src/reader/engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';
import type { Corpus } from '../src/reader/model.ts';
const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const corpus: Corpus = read('reader-public/text/republic.json');
const units = flattenCorpus(corpus);
const pages = units.flatMap(unit => makeReadingPages(unit).map(page => ({ ...page, chapterId: unit.chapter.id })));
const checks = read('content/learning/checks.json').filter((check: any) => check.id.startsWith('learn-full-'));

test('the complete ten books have consecutive scan pages and exact volume boundaries', () => {
  const source = read('content/source/guo-1986-pages.json');
  const bounds = [[1,43],[44,81],[82,131],[132,176],[177,227],[228,271],[272,311],[312,351],[352,386],[387,426]];
  assert.equal(source.pages.length, 426);
  bounds.forEach(([first,last], index) => {
    const volume = source.pages.filter((page: any) => page.book === index + 1);
    assert.deepEqual(volume.map((page: any) => page.printedPage), Array.from({ length: last-first+1 }, (_, n) => first+n));
    assert.ok(volume.every((page: any) => page.pdfPage === page.printedPage+11));
  });
  const scans = readdirSync(new URL('../reader-public/facsimile/', import.meta.url)).filter(name => name.endsWith('.webp'));
  assert.equal(scans.length,426,'the book index is not mislabelled as narrative scan pages');
});

test('each appended thematic chapter has four actual source questions, not editorial Socrates dialogue', () => {
  assert.equal(corpus.chapters.length,20);
  for (const chapter of corpus.chapters.slice(8)) {
    const questions = units.filter(unit => unit.chapter.id === chapter.id && unit.question).map(unit => unit.question!);
    assert.equal(questions.length,4,chapter.id);
    for (const question of questions) {
      assert.equal(question.prompt,'下面哪句话更像一个好问题？');
      const correct = question.options.find(option => option.id === question.correctId)!;
      assert.ok(question.original.text.replace(/\s/g,'').includes(correct.text.replace(/\s/g,'')),question.id);
      assert.equal(question.original.speaker,'苏格拉底',question.id);
      assert.ok(question.original.sourcePage! >=177 && question.original.sourcePage! <=426);
    }
  }
});

test('fifty-one appended checks cite evidence on the exact visible page and retain individual feedback', () => {
  assert.equal(checks.length,51);
  assert.equal(new Set(checks.map((check: any) => check.id)).size,51);
  assert.equal(new Set(checks.map((check: any) => check.pageId)).size,51);
  assert.deepEqual(corpus.chapters.slice(8).map(chapter => checks.filter((check: any) => check.chapterId === chapter.id).length),[5,4,4,4,4,5,4,4,4,4,4,5]);
  for (const check of checks) {
    const index = pages.findIndex(page => page.id === check.pageId);
    const page = pages[index];
    assert.ok(page && page.kind === 'text',check.id);
    if (page.kind !== 'text') continue;
    assert.equal(page.chapterId,check.chapterId);
    assert.ok(pages[index-1]?.kind !== 'question' && pages[index+1]?.kind !== 'question',check.id+' must not immediately interrupt a core question');
    assert.ok(check.sourceIds.length >0);
    assert.ok(check.sourceIds.every((id: string) => page.paragraphs.some(part => part.sourceId===id)));
    const visible = page.paragraphs.map(part=>part.text).join('');
    assert.ok(check.evidenceAnchors.length >0);
    for (const phrase of check.evidenceAnchors) assert.ok(visible.includes(phrase),`${check.id}: ${phrase}`);
    assert.equal(new Set(check.options.map((option: any)=>option.text)).size,3);
    assert.equal(new Set(check.options.map((option: any)=>option.feedback)).size,3,'feedback must address the chosen interpretation');
    const correct = check.options.find((option: any)=>option.id===check.correctId);
    assert.equal(correct.feedback,check.explanation);
    assert.ok(check.options.every((option: any)=>option.feedback.length>=15));
  }
});

test('the final myth remains continuous original narrative instead of fabricated next-question gates', () => {
  const final = units.filter(unit => unit.chapter.id==='destiny');
  assert.ok(final.some(unit=>[...unit.paragraphs,...unit.response].some(part=>part.sourcePage!>=417)));
  assert.ok(final.filter(unit=>unit.question).every(unit=>unit.question!.original.sourcePage!<417));
  const storyChecks = checks.filter((check: any)=>check.chapterId==='destiny' && /书页(?:41[7-9]|42\d)/.test(check.sourceRef));
  assert.ok(storyChecks.length>=3,'understanding questions support the narrative without inventing speakers');
});
