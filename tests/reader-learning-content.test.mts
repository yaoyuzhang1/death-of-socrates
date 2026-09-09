import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { flattenCorpus } from '../src/reader/engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';
import type { Corpus } from '../src/reader/model.ts';
import type { LearningCheckData } from '../src/reader/learning.ts';

type AnchoredCheck = LearningCheckData & { chapterId: string; pageId: string; sourceIds: string[] };
const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const corpus: Corpus = read('reader-public/text/republic.json');
const checks: AnchoredCheck[] = read('content/learning/checks.json');
const units = flattenCorpus(corpus);
const pages = units.flatMap(unit => makeReadingPages(unit).map(page => ({ ...page, chapterId: unit.chapter.id })));
const core = units.flatMap(unit => unit.question ? [unit.question] : []);

// These source phrases are the editorial evidence for the questions. Checking only
// sourceId would miss a question that accidentally uses a later fragment of a long speech.
const visibleEvidence: Record<string, string[]> = {
  'reading-willing-listeners': ['不愿意领教'],
  'reading-return-conditions': ['尽管代管的东西的确是一种欠债', '当原主头脑不正常的时候'],
  'reading-stronger-definition': ['就是强者的利益'],
  'reading-craft-object': ['为了照顾到身体的利益', '只是为它的对象服务的'],
  'reading-shepherd-objection': ['不是为他们自己或者他们主人的利益'],
  'reading-claim-needs-proof': ['既没有充分证明，也未经充分反驳'],
  'reading-outdo-groups': ['正义者不要求胜过同类', '至于不正义则对同类异类都要求胜过'],
  'reading-knowledge-agreement': ['彼此相似', '不愿超过和自己同类的人'],
  'reading-glaucon-demand': ['它们在心灵里各产生什么样的力量', '这并不是我自己的想法'],
  'reading-unrestricted-power': ['随心所欲做事的权力', '冷眼旁观'],
  'reading-reputation-advantage': ['他由于有正义之名'],
  'reading-appearance-inference': ['我何不全力以赴追求假象'],
  'reading-inner-effect': ['当神所不知，人所不见的时候'],
  'reading-justice-still-open': ['我可说不清', '必须考虑这个问题'],
  'reading-war-craft': ['没有一种工具', '没有认真练习过'],
  'reading-stories-shape': ['用这些故事铸造他们的心灵'],
  'reading-hero-lament': ['而不去效法他们'],
  'reading-falsehood-medicine': ['留给医生', '为了国家的利益'],
  'reading-achilles-character': ['卑鄙贪婪与蔑视神、人'],
  'reading-content-and-form': ['在讨论完了讲什么的问题之后', '应该考虑怎么讲的问题'],
  'reading-know-not-imitate': ['应该懂得疯子', '决不要装疯作邪'],
  'reading-song-parts': ['词，和声，节奏', '调子和节奏也必须符合歌词'],
  'reading-music-selection': ['不需要能奏出一切音调的乐器'],
  'reading-letters-and-virtues': ['不论字大字小', '辨别出它们本身及其映象'],
  'reading-music-end': ['最后目的在于达到对美的爱'],
  'reading-flexible-training': ['简单而灵活的体育'],
  'reading-lawsuit-living': ['一天到晚要弄滑头，颠倒是非'],
  'reading-asclepius-story': ['如果他是神的儿子，肯定他是不贪心的'],
  'reading-guardians-constancy': ['必须选择那些不忘原则的'],
  'reading-guardian-happiness-objection': ['完全没有任何幸福的人', '我们的护卫者只能得到吃的'],
  'reading-whole-city-happiness': ['国家里作为一个整体来考虑'],
  'reading-one-city': ['一为穷人的，一为富人的'],
  'reading-education-foundation': ['教育和培养'],
  'reading-education-not-rules-alone': ['仅仅订成条款写在纸上', '从小所受的教育'],
  'reading-courage-preserving': ['保持住法律通过教育'],
  'reading-moderation-throughout': ['它贯穿全体公民'],
  'reading-correlative-qualification': ['仅本身的东西关系着仅本身的相关者'],
  'reading-person-city-functions': ['自身内的各种品质在自身内各起各的作用'],
};

test('Thirty-eight comprehension checks have distinct text pages and complete source-bound options', () => {
  assert.equal(checks.length, 38);
  assert.equal(new Set(checks.map(check => check.id)).size, 38);
  assert.equal(new Set(checks.map(check => check.pageId)).size, 38);
  assert.deepEqual(Object.keys(visibleEvidence), checks.map(check => check.id));
  for (const check of checks) {
    const page = pages.find(page => page.id === check.pageId);
    assert.ok(page && page.kind === 'text', check.id);
    assert.equal(page.chapterId, check.chapterId, check.id);
    assert.ok(check.sourceIds.length > 0, check.id);
    assert.equal(new Set(check.sourceIds).size, check.sourceIds.length, check.id);
    assert.ok(check.sourceIds.every(id => page.paragraphs.some(paragraph => paragraph.sourceId === id)), check.id);
    assert.deepEqual(check.options.map(option => option.id), ['a', 'b', 'c'], check.id);
    assert.equal(new Set(check.options.map(option => option.text)).size, 3, check.id);
    assert.ok(check.options.some(option => option.id === check.correctId), check.id);
    assert.ok(check.prompt.length >= 12 && check.explanation.length >= 20, check.id);
    assert.ok(check.options.every(option => option.text.length >= 8 && option.feedback.length >= 15), check.id);
    assert.equal(new Set(check.options.map(option => option.feedback)).size, 3, check.id);
    assert.match(check.sourceRef, /^书页\d+(?:—\d+)? · /, check.id);
  }
});

test('Every cited idea is visible on that exact page, including split speeches with future fragments', () => {
  for (const check of checks) {
    const page = pages.find(page => page.id === check.pageId);
    assert.ok(page?.kind === 'text');
    const citedVisibleText = page.paragraphs.filter(paragraph => check.sourceIds.includes(paragraph.sourceId)).map(paragraph => paragraph.text).join('');
    for (const phrase of visibleEvidence[check.id]) assert.ok(citedVisibleText.includes(phrase), `${check.id}: missing visible evidence ${phrase}`);
  }
  const ring = pages.find(page => page.id === 'u-020-before-3');
  assert.ok(ring?.kind === 'text');
  const visible = ring.paragraphs.map(paragraph => paragraph.text).join('');
  assert.ok(visible.includes('随心所欲做事的权力'));
  assert.ok(!visible.includes('杀了国王'), 'this check must not rely on the later outcome of the ring story');
});

test('Comprehension pauses do not immediately flank a core Socratic question', () => {
  for (const check of checks) {
    const index = pages.findIndex(page => page.id === check.pageId);
    assert.notEqual(pages[index - 1]?.kind, 'question', check.id);
    assert.notEqual(pages[index + 1]?.kind, 'question', check.id);
  }
});

function longestGap(chapterId: string, includeChecks: boolean) {
  const added = new Set(includeChecks ? checks.filter(check => check.chapterId === chapterId).map(check => check.pageId) : []);
  let chars = 0, count = 0, maxChars = 0, maxPages = 0;
  const close = () => { maxChars = Math.max(maxChars, chars); maxPages = Math.max(maxPages, count); chars = 0; count = 0; };
  for (const page of pages.filter(page => page.chapterId === chapterId)) {
    if (page.kind === 'question') { close(); continue; }
    count++;
    chars += page.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
    if (added.has(page.id)) close();
  }
  close();
  return { maxChars, maxPages };
}

test('All chapters get contextual pauses while long fourth and sixth chapter gaps are filled proportionally', () => {
  const counts = corpus.chapters.map(chapter => checks.filter(check => check.chapterId === chapter.id).length);
  assert.deepEqual(counts, [2, 4, 2, 5, 2, 13, 6, 4]);
  assert.ok(new Set(counts).size > 3, 'allocation must reflect reading load rather than eight equal quotas');
  for (const chapter of corpus.chapters) {
    const before = longestGap(chapter.id, false), after = longestGap(chapter.id, true);
    assert.ok(after.maxChars <= 1900, `${chapter.id}: ${after.maxChars} unbroken characters`);
    assert.ok(after.maxPages <= 5, `${chapter.id}: ${after.maxPages} unbroken text pages`);
    assert.ok(after.maxChars <= before.maxChars && after.maxPages <= before.maxPages, chapter.id);
  }
  assert.ok(longestGap('worth', true).maxChars < longestGap('worth', false).maxChars / 3);
  assert.ok(longestGap('education', true).maxChars < longestGap('education', false).maxChars / 3);
});

test('The revised corpus retains 47 source questions and 273 pages while comprehension checks stay separate', () => {
  assert.equal(core.length, 47);
  assert.equal(pages.length, 273);
  const text = pages.flatMap(page => page.kind === 'text' ? page.paragraphs.map(paragraph => paragraph.text) : []).join('');
  assert.equal(text.length, 83876);
  const identities=core.map(question=>({id:question.id,correctId:question.correctId,original:question.original.text,correctText:question.options.find(option=>option.id===question.correctId)!.text}));
  assert.equal(createHash('sha256').update(JSON.stringify(identities)).digest('hex'), '6f1db64ed06506e142878e85302d94031bff6fe1b482001114dc891d9393a5b1', 'verified source questions and stable answer identities include the explicitly qualified sameness question');
  const coreIds = new Set(core.map(question => question.id));
  assert.ok(checks.every(check => !coreIds.has(check.id)));
  assert.ok(checks.every(check => !('original' in check) && !('hint' in check) && !('sceneId' in check)));
  assert.ok(!JSON.stringify(corpus).includes('reading-willing-listeners'));
});
