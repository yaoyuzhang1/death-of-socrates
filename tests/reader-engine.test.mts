import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenCorpus, createSave, validateSave, orderedOptions, submitAnswer,
  useHint, advance, navigate, chapterStats,
} from '../src/reader/engine.ts';
import type { Corpus, Question, Save, Unit } from '../src/reader/model.ts';

function question(id: string): Question {
  return {
    id, sourceRef: '《理想国》I 328e', prompt: '接下来哪一问更能澄清对方的说法？',
    original: { id: `${id}-original`, speaker: '苏格拉底', text: '这段路究竟如何？' },
    options: [
      { id: `${id}-context`, text: '询问对方所说的具体经历。', feedback: '它把讨论带回经验。' },
      { id: `${id}-compare`, text: '要求比较所有人的处境。', feedback: '比较提出了另一项解释任务。' },
      { id: `${id}-rule`, text: '追问是否存在一条普遍规则。', feedback: '规则的范围仍须说明。' },
    ],
    correctId: `${id}-context`, explanation: '原问先了解老人的亲身经验。', hint: '先看对方正在说明什么。',
  };
}
function unit(id: string, q?: Question): Unit {
  return { id, paragraphs: [{ id: `${id}-p`, text: `正文 ${id}` }], question: q,
    response: [{ id: `${id}-response`, speaker: '克法洛斯', text: `连续正文 ${id}，不随选项改写。` }] };
}
const corpus: Corpus = {
  title: '阅读契约测试文本',
  edition: { id: 'reader-fixture-1', label: '测试文本', description: '只用于行为测试', translator: '测试',
    sourceUrl: 'https://example.org/source', license: 'test fixture', notes: [] },
  chapters: [
    { id: 'experience', title: '经验', subtitle: '', range: '327a–330a', introduction: '', conclusion: '', sections: [
      { id: 'arrival', title: '入席', range: '327a–328e', units: [unit('u1', question('q1')), unit('u2')] },
      { id: 'questioning', title: '追问', range: '329a–330a', units: [unit('u3', question('q2'))] },
    ] },
    { id: 'wealth', title: '财富', subtitle: '', range: '330a–331d', introduction: '', conclusion: '', sections: [
      { id: 'meaning', title: '益处', range: '330a–331d', units: [unit('u4', question('q3'))] },
    ] },
  ],
};
const units = flattenCorpus(corpus);
const fresh = () => createSave(corpus, 'repeatable-reader-seed');
const exported = (save: Save) => JSON.parse(JSON.stringify(save));
function complete(choices: (string | null)[] = ['q1-context', 'q2-compare', 'q3-rule']): Save {
  let save = fresh(); let answer = 0;
  for (const current of units) {
    if (current.question) save = submitAnswer(save, current, choices[answer++]);
    save = advance(save, units);
  }
  return save;
}

test('flattening keeps canonical reading order and chapter/section metadata without changing the corpus', () => {
  const before = JSON.stringify(corpus);
  assert.deepEqual(units.map(current => current.id), ['u1', 'u2', 'u3', 'u4']);
  assert.deepEqual(units.map(current => [current.index, current.chapterIndex, current.sectionIndex]), [
    [0, 0, 0], [1, 0, 0], [2, 0, 1], [3, 1, 0],
  ]);
  assert.equal(units[2].chapter.id, 'experience');
  assert.equal(units[2].section.id, 'questioning');
  assert.deepEqual(units[0].response, corpus.chapters[0].sections[0].units[0].response);
  assert.equal(JSON.stringify(corpus), before);
});

test('fresh saves have a fixed edition and deterministic option seed, and can be imported before starting', () => {
  const save = fresh();
  assert.equal(save.version, 2);
  assert.equal(save.editionId, 'reader-fixture-1');
  assert.equal(save.seed, 'repeatable-reader-seed');
  assert.equal(save.started, false);
  assert.equal(save.cursor, 0);
  assert.equal(save.completed, 0);
  assert.deepEqual(save.settings, { fontSize: 18, theme: 'paper' });
  assert.deepEqual(validateSave(exported(save), corpus), save);
  assert.throws(() => createSave(corpus, '   '));
  assert.throws(() => createSave(corpus, 'x'.repeat(129)));
  assert.throws(() => createSave({ ...corpus, chapters: [] }));
});

test('option permutations survive reload, preserve every option, and vary the original-question position across seeds', () => {
  const q = units[0].question!;
  const before = JSON.stringify(q.options);
  const save = fresh();
  const order = orderedOptions(q, save.seed).map(option => option.id);
  const restored = validateSave(exported(save), corpus)!;
  assert.deepEqual(orderedOptions(q, restored.seed).map(option => option.id), order);
  assert.deepEqual([...order].sort(), q.options.map(option => option.id).sort());
  assert.equal(JSON.stringify(q.options), before);
  const originalPositions = new Set(Array.from({ length: 50 }, (_, index) =>
    orderedOptions(q, `reader-${index}`).findIndex(option => option.id === q.correctId)));
  assert.deepEqual([...originalPositions].sort(), [0, 1, 2]);
});

test('an unanswered question blocks forward progress, while a question-free passage opens sequentially', () => {
  const initial = fresh();
  assert.equal(advance(initial, units), initial);
  assert.equal(navigate(initial, units, 1), initial);
  assert.throws(() => submitAnswer(initial, units[2], 'q2-context'));
  assert.throws(() => useHint(initial, units[2]));
  let save = advance(submitAnswer(initial, units[0], 'q1-context'), units);
  assert.equal(save.cursor, 1);
  assert.equal(save.completed, 1);
  assert.equal(navigate(save, units, 2), save);
  assert.throws(() => submitAnswer(save, units[1], null));
  save = advance(save, units);
  assert.equal(save.cursor, 2);
  assert.equal(save.completed, 2);
  assert.equal(advance(save, units), save);
  assert.deepEqual(validateSave(exported(save), corpus), save);
});

test('correct, mistaken and directly revealed answers all continue into the same canonical text', () => {
  const originalBody = JSON.stringify(units.map(current => [current.paragraphs, current.response]));
  for (const choice of ['q1-context', 'q1-rule', null]) {
    const answered = submitAnswer(fresh(), units[0], choice);
    assert.equal(answered.answers.q1.choiceId, choice);
    const next = advance(answered, units);
    assert.equal(next.cursor, 1);
    assert.equal(next.completed, 1);
    assert.equal(units[next.cursor].id, 'u2');
    assert.deepEqual(validateSave(exported(next), corpus), next);
  }
  assert.equal(JSON.stringify(units.map(current => [current.paragraphs, current.response])), originalBody);
});

test('the first record is immutable even after revisiting, including a direct reveal', () => {
  for (const first of ['q1-compare', null]) {
    const answered = submitAnswer(fresh(), units[0], first);
    const firstRecord = structuredClone(answered.answers.q1);
    assert.equal(submitAnswer(answered, units[0], 'q1-context'), answered);
    assert.equal(submitAnswer(answered, units[0], null), answered);
    assert.equal(useHint(answered, units[0]), answered);
    const revisited = navigate(advance(answered, units), units, 0);
    assert.equal(submitAnswer(revisited, units[0], 'q1-rule'), revisited);
    assert.deepEqual(revisited.answers.q1, firstRecord);
  }
  assert.throws(() => submitAnswer(fresh(), units[0], 'q2-context'));
});

test('hints are recorded once before submission and never retroactively alter first-answer statistics', () => {
  const initial = fresh();
  const hinted = useHint(initial, units[0]);
  assert.deepEqual(initial.hints, []);
  assert.deepEqual(hinted.hints, ['q1']);
  assert.equal(hinted.completed, 0);
  assert.equal(useHint(hinted, units[0]), hinted);
  assert.equal(chapterStats(corpus.chapters[0], hinted).hinted, 1);
  assert.equal(chapterStats(corpus.chapters[0], hinted).answered, 0);
  const answered = submitAnswer(hinted, units[0], null);
  assert.equal(answered.answers.q1.hinted, true);
  assert.equal(useHint(answered, units[0]), answered);
  assert.deepEqual(validateSave(exported(answered), corpus), answered);
});

test('reaching the last passage requires its answer and completion never moves the cursor out of range', () => {
  let save = advance(submitAnswer(fresh(), units[0], null), units);
  save = advance(save, units);
  save = advance(submitAnswer(save, units[2], null), units);
  assert.equal(save.cursor, 3);
  assert.equal(save.completed, 3);
  assert.equal(advance(save, units), save);
  save = advance(submitAnswer(save, units[3], null), units);
  assert.equal(save.completed, 4);
  assert.equal(save.cursor, 3);
  assert.equal(advance(save, units), save);
  assert.deepEqual(validateSave(exported(save), corpus), save);
});

test('revisiting never truncates completion, hints or first records, and subsequent reading stays sequential', () => {
  const finished = complete();
  const previous = JSON.stringify(finished);
  let review = navigate({ ...finished, scroll: 742.5 }, units, 0);
  assert.equal(review.scroll, 0);
  assert.equal(review.completed, 4);
  assert.deepEqual(review.answers, finished.answers);
  review = advance(review, units);
  assert.equal(review.cursor, 1);
  assert.equal(review.completed, 4);
  assert.equal(Object.keys(review.answers).length, 3);
  assert.equal(JSON.stringify(finished), previous);
  for (const invalid of [-1, 1.5, 4, NaN]) assert.equal(navigate(review, units, invalid), review);
  assert.deepEqual(validateSave(exported(review), corpus), review);
});

test('chapter statistics distinguish completion, matching the original, direct reveals and requested hints', () => {
  let save = submitAnswer(useHint(fresh(), units[0]), units[0], 'q1-context');
  save = advance(advance(save, units), units);
  save = advance(submitAnswer(save, units[2], null), units);
  save = advance(submitAnswer(save, units[3], 'q3-rule'), units);
  assert.deepEqual(chapterStats(corpus.chapters[0], save), { total: 2, answered: 2, correct: 1, revealed: 1, hinted: 1 });
  assert.deepEqual(chapterStats(corpus.chapters[1], save), { total: 1, answered: 1, correct: 0, revealed: 0, hinted: 0 });
  assert.deepEqual(chapterStats({ ...corpus.chapters[0], sections: [] }, save), { total: 0, answered: 0, correct: 0, revealed: 0, hinted: 0 });
});

test('import rejects false progress, answers for unopened units and missing questions inside the completed prefix', () => {
  const first = submitAnswer(fresh(), units[0], 'q1-context');
  const finished = complete();
  const invalid = [
    { ...fresh(), started: true, completed: 1, cursor: 1 },
    { ...fresh(), started: true, cursor: 1 },
    { ...fresh(), answers: { q3: finished.answers.q3 }, started: true },
    { ...finished, answers: { q1: finished.answers.q1, q3: finished.answers.q3 } },
    { ...first, completed: 2, cursor: 3 },
    { ...first, started: false },
    { ...finished, cursor: 4 },
    { ...finished, completed: 5 },
    { ...finished, completed: -1 },
    { ...first, cursor: .5 },
    { ...fresh(), hints: ['q2'], started: true },
    { ...fresh(), bookmarks: ['u2'], started: true },
  ];
  for (const input of invalid) assert.equal(validateSave(input, corpus), null);
});

test('import rejects old editions, forged answer IDs, inconsistent hints and unsupported fields', () => {
  const answered = submitAnswer(fresh(), units[0], 'q1-context');
  const answer = answered.answers.q1;
  const invalid: unknown[] = [null, false, [], 'save', {},
    { ...answered, version: 1 },
    { ...answered, editionId: 'another-text' },
    { ...answered, answers: { unknown: answer } },
    { ...answered, answers: { q1: { ...answer, choiceId: 'q2-context' } } },
    { ...answered, answers: { q1: { ...answer, choiceId: 0 } } },
    { ...answered, answers: { q1: { ...answer, hinted: true } } },
    { ...answered, hints: ['q1'] },
    { ...answered, answers: { q1: { ...answer, certainty: 'confirmed' } } },
    { ...answered, hints: ['q1', 'q1'] },
    { ...answered, bookmarks: ['missing'] },
    { ...answered, bookmarks: ['u1', 'u1'] },
    { ...answered, answers: [] },
    { ...answered, unlocked: 'all' },
  ];
  for (const input of invalid) assert.equal(validateSave(input, corpus), null);
});

test('import validates bounded settings, timestamps and reading position without retaining input object aliases', () => {
  const answered = submitAnswer(fresh(), units[0], 'q1-context');
  const input = { ...answered, bookmarks: ['u1'], scroll: 912.5, settings: { fontSize: 24, theme: 'night' as const } };
  const restored = validateSave(input, corpus)!;
  assert.deepEqual(restored, input);
  restored.answers.q1.choiceId = null;
  restored.bookmarks.push('u2');
  restored.settings.fontSize = 18;
  assert.equal(input.answers.q1.choiceId, 'q1-context');
  assert.deepEqual(input.bookmarks, ['u1']);
  assert.equal(input.settings.fontSize, 24);
  for (const invalid of [
    { ...input, seed: '' }, { ...input, seed: 'x'.repeat(129) },
    { ...input, scroll: -1 }, { ...input, scroll: Infinity }, { ...input, scroll: 10_000_001 },
    { ...input, settings: { fontSize: 13, theme: 'night' } },
    { ...input, settings: { fontSize: 33, theme: 'night' } },
    { ...input, settings: { fontSize: 18.5, theme: 'night' } },
    { ...input, settings: { fontSize: 18, theme: 'unknown' } },
    { ...input, updatedAt: 'yesterday' },
    { ...input, updatedAt: '2026-02-31T00:00:00.000Z' },
    { ...input, answers: { q1: { ...input.answers.q1, at: '9999-01-01T00:00:00.000Z' } } },
  ]) assert.equal(validateSave(invalid, corpus), null);
});

test('a corrupt corpus cannot silently validate saves against ambiguous question or option identities', () => {
  const duplicateUnits = structuredClone(corpus);
  duplicateUnits.chapters[0].sections[0].units[1].id = 'u1';
  const duplicateQuestion = structuredClone(corpus);
  duplicateQuestion.chapters[1].sections[0].units[0].question!.id = 'q1';
  const duplicateOption = structuredClone(corpus);
  const options = duplicateOption.chapters[0].sections[0].units[0].question!.options;
  options[1].id = options[0].id;
  const missingOriginal = structuredClone(corpus);
  missingOriginal.chapters[0].sections[0].units[0].question!.correctId = 'missing';
  for (const ambiguous of [duplicateUnits, duplicateQuestion, duplicateOption, missingOriginal]) {
    assert.equal(validateSave(fresh(), ambiguous), null);
    assert.throws(() => createSave(ambiguous));
  }
});
