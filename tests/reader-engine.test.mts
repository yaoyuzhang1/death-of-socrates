import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenCorpus, createSave, validateSave, orderedOptions, submitAnswer,
  useHint, advance, navigate, chapterStats,
  readingBatches, readingPosition, setReadingPosition, setReadingMode,
  recordReview, reviewQueue, progressStats,
  isQuestionResolved, pagePosition, setPagePosition,
} from '../src/reader/engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';
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
    if (current.question) {
      save = submitAnswer(save, current, choices[answer++]);
      save = submitAnswer(save, current, current.question.correctId);
    }
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
  assert.equal(save.version, 4);
  assert.equal(save.editionId, 'reader-fixture-1');
  assert.equal(save.seed, 'repeatable-reader-seed');
  assert.equal(save.started, false);
  assert.equal(save.cursor, 0);
  assert.equal(save.completed, 0);
  assert.deepEqual(save.settings, { fontSize: 18, theme: 'paper' });
  assert.deepEqual(save.reading, { mode: 'step', positions: {} });
  assert.deepEqual(save.reviews, {});
  assert.deepEqual(save.resolved, []);
  assert.deepEqual(save.pages, {});
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

test('wrong answers and legacy direct reveals must be corrected before the same canonical text opens', () => {
  const originalBody = JSON.stringify(units.map(current => [current.paragraphs, current.response]));
  for (const choice of ['q1-context', 'q1-rule', null]) {
    const answered = submitAnswer(fresh(), units[0], choice);
    assert.equal(answered.answers.q1.choiceId, choice);
    if (choice !== 'q1-context') {
      assert.equal(advance(answered, units), answered);
      assert.equal(isQuestionResolved(answered, 'q1'), false);
      assert.throws(() => setReadingPosition(answered, units[0], 'after', 1));
      const reloaded = validateSave(exported(answered), corpus)!;
      assert.ok(reloaded);
      assert.equal(advance(reloaded, units), reloaded);
    }
    const corrected = submitAnswer(answered, units[0], 'q1-context');
    assert.equal(isQuestionResolved(corrected, units[0].question!), true);
    assert.equal(corrected.answers.q1.choiceId, choice);
    const next = advance(corrected, units);
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
    const corrected = submitAnswer(answered, units[0], 'q1-context');
    assert.deepEqual(corrected.answers.q1, firstRecord);
    assert.equal(submitAnswer(corrected, units[0], null), corrected);
    assert.equal(useHint(answered, units[0]), answered);
    const revisited = navigate(advance(corrected, units), units, 0);
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
  let save = advance(submitAnswer(fresh(), units[0], 'q1-context'), units);
  save = advance(save, units);
  save = advance(submitAnswer(save, units[2], 'q2-context'), units);
  assert.equal(save.cursor, 3);
  assert.equal(save.completed, 3);
  assert.equal(advance(save, units), save);
  save = advance(submitAnswer(save, units[3], 'q3-context'), units);
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
  save = submitAnswer(save, units[2], null);
  save = advance(submitAnswer(save, units[2], 'q2-context'), units);
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

function longCorpus(): Corpus {
  const source = structuredClone(corpus);
  const first = source.chapters[0].sections[0].units[0];
  first.paragraphs = [1, 2, 3].map(index => ({ id: `before-${index}`, text: `${index}${'前文'.repeat(200)}` }));
  first.replyCount = 1;
  first.response = [
    { id: 'original-reply', text: '原文紧接的答话。' },
    ...[1, 2, 3].map(index => ({ id: `after-${index}`, text: `${index}${'后文'.repeat(200)}` })),
  ];
  return source;
}

test('reading batches retain complete source paragraphs and exact order, including a paragraph longer than the target', () => {
  const paragraphs = [
    { id: 'short-1', text: '甲'.repeat(300), sourcePage: 1 },
    { id: 'short-2', text: '乙'.repeat(300), sourcePages: [1, 2] },
    { id: 'long', text: '丙'.repeat(1600), sourcePage: 2 },
    { id: 'short-3', text: '丁'.repeat(200), speaker: '苏' },
  ];
  const batches = readingBatches(paragraphs);
  assert.deepEqual(batches.map(batch => batch.map(paragraph => paragraph.id)), [['short-1', 'short-2'], ['long'], ['short-3']]);
  assert.deepEqual(batches.flat(), paragraphs);
  assert.equal(batches.flat().map(paragraph => paragraph.text).join(''), paragraphs.map(paragraph => paragraph.text).join(''));
  assert.equal(batches[1][0], paragraphs[2]);
  assert.deepEqual(readingBatches([]), []);
  assert.throws(() => readingBatches(paragraphs, 0));
  assert.throws(() => readingBatches(paragraphs, Infinity));
  assert.throws(() => readingBatches(paragraphs, 1.5));
});

test('version 2 import migrates without changing the edition, cursor, first answers, seed or old settings', () => {
  const current = navigate(complete(), units, 1);
  const legacy = exported(current);
  legacy.version = 2;
  delete legacy.resolved;
  delete legacy.pages;
  delete legacy.reading;
  delete legacy.reviews;
  const restored = validateSave(legacy, corpus)!;
  assert.ok(restored);
  assert.equal(restored.version, 4);
  assert.deepEqual(restored.resolved, Object.keys(legacy.answers));
  for (const key of ['editionId', 'seed', 'started', 'cursor', 'completed', 'answers', 'hints', 'bookmarks', 'scroll', 'settings', 'updatedAt']) {
    assert.deepEqual(restored[key as keyof Save], legacy[key]);
  }
  assert.deepEqual(restored.reading, { mode: 'step', positions: { u2: { before: 1, after: 1 } } });
  assert.deepEqual(restored.reviews, {});
  assert.deepEqual(readingPosition(restored, units[1]), { before: 1, after: 1 });
  assert.deepEqual(validateSave(exported(restored), corpus), restored);
  assert.equal(validateSave({ ...legacy, reviews: {} }, corpus), null);
  assert.equal(validateSave({ ...legacy, completed: units.length + 1 }, corpus), null);

  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  let longSave = setReadingMode(createSave(source, 'legacy-seed'), 'continuous');
  longSave = submitAnswer(longSave, sourceUnits[0], 'q1-rule');
  const unfinished = exported(longSave);
  unfinished.version = 2;
  delete unfinished.resolved;
  delete unfinished.pages;
  delete unfinished.reading;
  delete unfinished.reviews;
  assert.deepEqual(readingPosition(validateSave(unfinished, source)!, sourceUnits[0]), { before: 3, after: 3 });
  longSave = advance(submitAnswer(longSave, sourceUnits[0], 'q1-context'), sourceUnits);
  const finished = exported(longSave);
  finished.version = 2;
  delete finished.resolved;
  delete finished.pages;
  delete finished.reading;
  delete finished.reviews;
  assert.deepEqual(readingPosition(validateSave(finished, source)!, sourceUnits[0]), { before: 3, after: 3 });

  const unanswered = exported(createSave(source, 'legacy-unanswered'));
  unanswered.version = 2;
  delete unanswered.resolved;
  delete unanswered.pages;
  unanswered.started = true;
  unanswered.scroll = 1942.5;
  delete unanswered.reading;
  delete unanswered.reviews;
  const restoredUnanswered = validateSave(unanswered, source)!;
  assert.equal(restoredUnanswered.scroll, 1942.5);
  assert.equal(restoredUnanswered.cursor, 0);
  assert.deepEqual(readingPosition(restoredUnanswered, sourceUnits[0]), { before: 3, after: 1 });
  assert.deepEqual(validateSave(exported(restoredUnanswered), source), restoredUnanswered);
  const unstarted = { ...unanswered, started: false, scroll: 0 };
  const restoredUnstarted = validateSave(unstarted, source)!;
  assert.deepEqual(restoredUnstarted.reading.positions, {});
  assert.deepEqual(readingPosition(restoredUnstarted, sourceUnits[0]), { before: 1, after: 1 });
});

test('step mode gates questions and advancement on source batches while immediate replies stay outside the after batches', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  const first = sourceUnits[0];
  let save = createSave(source, 'step-test');
  assert.deepEqual(readingPosition(save, first), { before: 1, after: 1 });
  assert.throws(() => submitAnswer(save, first, 'q1-context'));
  assert.throws(() => setReadingPosition(save, first, 'after', 2));
  save = setReadingPosition(save, first, 'before', 2);
  assert.equal(save.cursor, 0);
  assert.equal(save.completed, 0);
  assert.deepEqual(validateSave(exported(save), source), save);
  assert.equal(advance(save, sourceUnits), save);
  save = setReadingPosition(save, first, 'before', 3);
  save = submitAnswer(save, first, 'q1-rule');
  assert.equal(advance(save, sourceUnits), save);
  assert.deepEqual(readingPosition(save, first), { before: 3, after: 1 });
  assert.throws(() => setReadingPosition(save, first, 'after', 2));
  save = submitAnswer(save, first, 'q1-context');
  save = setReadingPosition(save, first, 'after', 2);
  assert.equal(advance(save, sourceUnits), save);
  save = setReadingPosition(save, first, 'after', 3);
  const next = advance(save, sourceUnits);
  assert.equal(next.cursor, 1);
  assert.equal(next.completed, 1);
  assert.deepEqual(readingPosition(next, first), { before: 3, after: 3 });
  assert.deepEqual(validateSave(exported(next), source), next);
});

test('continuous reading can finish a passage and switching back to steps preserves its completion', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  let save = setReadingMode(createSave(source, 'continuous-test'), 'continuous');
  assert.equal(save.started, false);
  assert.deepEqual(validateSave(exported(save), source), save);
  save = submitAnswer(save, sourceUnits[0], 'q1-context');
  save = advance(save, sourceUnits);
  save = setReadingMode(save, 'step');
  save = navigate(save, sourceUnits, 0);
  assert.deepEqual(readingPosition(save, sourceUnits[0]), { before: 3, after: 3 });
  assert.equal(advance(save, sourceUnits).cursor, 1);
  assert.deepEqual(validateSave(exported(save), source), save);
  assert.throws(() => setReadingMode(save, 'unknown' as never));
});

test('switching an unanswered current passage to steps retains its displayed text without opening the answer or following text', () => {
  const source = longCorpus();
  const first = flattenCorpus(source)[0];
  const continuous = { ...setReadingMode(createSave(source, 'visible-before'), 'continuous'), started: true, scroll: 1850 };
  const original = JSON.stringify(continuous);
  const stepped = setReadingMode(continuous, 'step', first);
  const position = readingPosition(stepped, first);
  assert.deepEqual(readingBatches(first.paragraphs).slice(0, position.before).flat(), first.paragraphs);
  assert.equal(position.after, 1);
  assert.deepEqual(stepped.answers, {});
  assert.equal(stepped.cursor, continuous.cursor);
  assert.equal(stepped.completed, continuous.completed);
  assert.equal(stepped.scroll, 1850);
  assert.equal(advance(stepped, flattenCorpus(source)), stepped);
  assert.throws(() => setReadingPosition(stepped, first, 'after', 2));
  assert.equal(JSON.stringify(continuous), original);
  assert.deepEqual(validateSave(exported(stepped), source), stepped);
});

test('switching to steps retains all displayed response batches and other reading positions without changing first answers', () => {
  const source = longCorpus();
  const questionFree = source.chapters[0].sections[0].units[1];
  questionFree.paragraphs = [1, 2, 3].map(index => ({ id: `free-before-${index}`, text: '未设提问的前文'.repeat(100) }));
  questionFree.response = [1, 2, 3].map(index => ({ id: `free-after-${index}`, text: '未设提问的后文'.repeat(100) }));
  const sourceUnits = flattenCorpus(source);
  for (const choice of ['q1-rule', null]) {
    let save = setReadingMode(createSave(source, 'visible-after'), 'continuous');
    save = submitAnswer(save, sourceUnits[0], choice);
    save = submitAnswer(save, sourceUnits[0], 'q1-context');
    const firstAnswer = structuredClone(save.answers);
    const stepped = setReadingMode(save, 'step', sourceUnits[0]);
    const position = readingPosition(stepped, sourceUnits[0]);
    assert.deepEqual(readingBatches(sourceUnits[0].response.slice(1)).slice(0, position.after).flat(), sourceUnits[0].response.slice(1));
    assert.deepEqual(position, { before: 3, after: 3 });
    assert.deepEqual(stepped.answers, firstAnswer);
    assert.equal(stepped.cursor, save.cursor);
    assert.deepEqual(validateSave(exported(stepped), source), stepped);

    const next = setReadingMode(advance(save, sourceUnits), 'step', sourceUnits[1]);
    assert.deepEqual(next.reading.positions.u1, { before: 3, after: 3 });
    assert.deepEqual(next.reading.positions.u2, { before: 3, after: 3 });
    assert.deepEqual(next.answers, firstAnswer);
    assert.deepEqual(validateSave(exported(next), source), next);
  }
});

test('reading-mode changes leave unstarted saves valid and reject attempts to preserve a different or unopened unit', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  const unstarted = setReadingMode(createSave(source, 'unstarted-mode'), 'continuous');
  const stepped = setReadingMode(unstarted, 'step', sourceUnits[0]);
  assert.equal(stepped.started, false);
  assert.deepEqual(stepped.reading.positions, {});
  assert.deepEqual(validateSave(exported(stepped), source), stepped);
  const started = { ...unstarted, started: true };
  assert.throws(() => setReadingMode(started, 'step', sourceUnits[1]));
  assert.throws(() => setReadingMode(started, 'step', { ...sourceUnits[0], index: -1 }));
  assert.throws(() => setReadingMode({ ...started, cursor: 1 }, 'step', sourceUnits[1]));
  assert.deepEqual(setReadingMode(started, 'step').reading.positions, {});
});

test('reading positions reject unopened units and out-of-range values without modifying source or earlier counts', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  let save = createSave(source, 'position-test');
  assert.throws(() => setReadingPosition(save, sourceUnits[1], 'before', 1));
  for (const count of [0, -1, 4, 1.5, NaN]) assert.throws(() => setReadingPosition(save, sourceUnits[0], 'before', count));
  save = setReadingPosition(save, sourceUnits[0], 'before', 2);
  assert.equal(setReadingPosition(save, sourceUnits[0], 'before', 1), save);
  const position = readingPosition(save, sourceUnits[0]);
  position.before = 99;
  assert.equal(readingPosition(save, sourceUnits[0]).before, 2);
  const empty = { ...sourceUnits[0], paragraphs: [], response: [] };
  assert.deepEqual(readingPosition(createSave(source, 'empty-position'), empty), { before: 0, after: 0 });
});

test('reviews leave first answers, reading cursor, progress and source unchanged, including direct reveals', () => {
  const initial = navigate(complete(['q1-rule', null, 'q3-context']), units, 1);
  const before = JSON.stringify(initial);
  const body = JSON.stringify(units);
  let save = recordReview(initial, units, 'q1', 'q1-context');
  save = recordReview(save, units, 'q1', 'q1-rule');
  save = recordReview(save, units, 'q2', null);
  assert.deepEqual(save.answers, initial.answers);
  assert.deepEqual(save.reading, initial.reading);
  assert.equal(save.cursor, initial.cursor);
  assert.equal(save.completed, initial.completed);
  assert.equal(save.reviews.q1.attempts, 2);
  assert.equal(save.reviews.q1.correct, 1);
  assert.equal(save.reviews.q1.lastChoiceId, 'q1-rule');
  assert.equal(save.reviews.q2.correct, 0);
  assert.equal(save.reviews.q2.lastChoiceId, null);
  assert.equal(JSON.stringify(initial), before);
  assert.equal(JSON.stringify(units), body);
  assert.deepEqual(validateSave(exported(save), corpus), save);
  assert.throws(() => recordReview(fresh(), units, 'q1', 'q1-context'));
  assert.throws(() => recordReview(save, units, 'missing', null));
  assert.throws(() => recordReview(save, units, 'q1', 'q2-context'));
  assert.deepEqual(progressStats(units, save), { answered: 3, correct: 1, reviewed: 2, remainingReview: 1, total: 3 });
  assert.deepEqual(chapterStats(corpus.chapters[0], save), chapterStats(corpus.chapters[0], initial));
});

test('review queues prioritize unresolved first answers and rotate through answered questions without opening new questions', () => {
  let save = complete(['q1-context', 'q2-rule', null]);
  assert.deepEqual(reviewQueue(units, fresh()), []);
  assert.deepEqual(reviewQueue(units, save), ['q2', 'q3', 'q1']);
  assert.deepEqual(reviewQueue(units, save, 5, 'wealth'), ['q3']);
  assert.deepEqual(reviewQueue(units, save, 5, 'missing'), []);
  assert.deepEqual(reviewQueue(units, save, 0), []);
  save = recordReview(save, units, 'q2', 'q2-context');
  assert.deepEqual(reviewQueue(units, save), ['q3', 'q1', 'q2']);
  assert.equal(progressStats(units, save).remainingReview, 1);
  save = recordReview(save, units, 'q3', null);
  assert.deepEqual(reviewQueue(units, save, 1), ['q3']);

  const source = structuredClone(corpus);
  source.chapters = [{ ...source.chapters[0], sections: [{
    id: 'rounds', title: '轮次', range: '', units: Array.from({ length: 9 }, (_, index) => unit(`round-${index}`, question(`round-q${index}`))),
  }] }];
  const roundUnits = flattenCorpus(source);
  let roundSave = createSave(source, 'queue-test');
  for (const current of roundUnits) {
    roundSave = submitAnswer(roundSave, current, null);
    roundSave = submitAnswer(roundSave, current, current.question!.correctId);
    roundSave = advance(roundSave, roundUnits);
  }
  const firstRound = reviewQueue(roundUnits, roundSave, 99);
  assert.equal(firstRound.length, 5);
  assert.equal(new Set(firstRound).size, 5);
  for (const id of firstRound) roundSave = recordReview(roundSave, roundUnits, id, null);
  assert.deepEqual(reviewQueue(roundUnits, roundSave).slice(0, 4), ['round-q5', 'round-q6', 'round-q7', 'round-q8']);
});

test('version 4 imports strictly validate reading and review data, including unopened content and impossible totals', () => {
  let save = complete(['q1-rule', null, 'q3-context']);
  save = recordReview(save, units, 'q1', 'q1-context');
  const review = save.reviews.q1;
  const first = submitAnswer(fresh(), units[0], 'q1-context');
  const invalid = [
    { ...save, reading: { mode: 'unknown', positions: {} } },
    { ...save, reading: { mode: 'step', positions: [], extra: true } },
    { ...save, reading: { mode: 'step', positions: { missing: { before: 1, after: 1 } } } },
    { ...first, reading: { mode: 'step', positions: { u2: { before: 1, after: 1 } } } },
    { ...save, reading: { mode: 'step', positions: { u1: { before: 2, after: 1 } } } },
    { ...save, reading: { mode: 'step', positions: { u1: { before: 0, after: 1 } } } },
    { ...save, reading: { mode: 'step', positions: { u1: { before: 1, after: 1, extra: 0 } } } },
    { ...save, reviews: [] },
    { ...fresh(), reviews: { q1: review } },
    { ...first, reviews: { q2: review } },
    ...[
      { ...review, attempts: 0 }, { ...review, attempts: 1.5 }, { ...review, attempts: 1_000_001 },
      { ...review, correct: -1 }, { ...review, correct: 2 }, { ...review, correct: 0 },
      { ...review, lastChoiceId: null }, { ...review, lastChoiceId: 'q1-rule' },
      { ...review, lastChoiceId: 'q2-context' }, { ...review, at: 'invalid' },
      { ...review, at: '2000-01-01T00:00:00.000Z' }, { ...review, at: '9999-01-01T00:00:00.000Z' },
      { ...review, bonus: true },
    ].map(value => ({ ...save, reviews: { q1: value } })),
  ];
  for (const value of invalid) assert.equal(validateSave(value, corpus), null, JSON.stringify(value));
  const restored = validateSave(exported(save), corpus)!;
  restored.reading.positions.u1.before = 0;
  restored.reviews.q1.correct = 0;
  assert.equal(save.reading.positions.u1.before, 1);
  assert.equal(save.reviews.q1.correct, 1);
});

test('version 3 migration preserves all historical answers as resolved and maps the current source boundary to a short page', () => {
  const source = longCorpus();
  const current = flattenCorpus(source)[0];
  let save = setReadingMode(createSave(source, 'old-v3-boundary'), 'continuous');
  save = submitAnswer(save, current, 'q1-rule');
  const legacy = exported(save);
  legacy.version = 3;
  delete legacy.resolved;
  delete legacy.pages;
  legacy.reading.positions.u1 = { before: 3, after: 2 };
  legacy.scroll = 924;
  const restored = validateSave(legacy, source)!;
  assert.ok(restored);
  assert.equal(restored.version, 4);
  assert.deepEqual(restored.answers, legacy.answers);
  assert.deepEqual(restored.resolved, ['q1']);
  assert.equal(restored.cursor, legacy.cursor);
  assert.equal(restored.completed, legacy.completed);
  assert.equal(restored.scroll, legacy.scroll);
  const page = makeReadingPages(current)[pagePosition(restored, current)];
  assert.equal(page.kind, 'text');
  assert.ok(page.kind === 'text' && page.paragraphs.some(paragraph => paragraph.sourceId === 'after-2'));
  assert.deepEqual(validateSave(exported(restored), source), restored);
  assert.equal(validateSave({ ...legacy, resolved: [] }, source), null);

  const historical = exported(complete(['q1-rule', null, 'q3-context']));
  historical.version = 3;
  delete historical.resolved;
  delete historical.pages;
  assert.deepEqual(validateSave(historical, corpus)!.resolved, ['q1', 'q2', 'q3']);
});

test('short pages persist the current page and keep wrong-answer gates closed across refresh and revisiting the context', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  const current = sourceUnits[0];
  const pages = makeReadingPages(current);
  const questionPage = pages.findIndex(page => page.kind === 'question');
  let save = setPagePosition(createSave(source, 'page-gate'), current, 0);
  assert.throws(() => submitAnswer(save, current, 'q1-context'));
  assert.throws(() => setPagePosition(save, current, questionPage + 1));
  save = setPagePosition(save, current, questionPage);
  assert.equal(readingPosition(save, current).before, 3);
  save = submitAnswer(save, current, 'q1-rule');
  const first = structuredClone(save.answers.q1);
  save = validateSave(exported(save), source)!;
  assert.equal(pagePosition(save, current), questionPage);
  assert.equal(isQuestionResolved(save, current.question!), false);
  assert.equal(advance(save, sourceUnits), save);
  assert.throws(() => setPagePosition(save, current, questionPage + 1));
  save = setPagePosition(save, current, 0);
  assert.equal(pagePosition(save, current), 0);
  assert.throws(() => submitAnswer(save, current, 'q1-context'));
  save = setPagePosition(save, current, questionPage);
  save = submitAnswer(save, current, 'q1-context');
  assert.deepEqual(save.answers.q1, first);
  assert.deepEqual(save.resolved, ['q1']);
  assert.equal(advance(save, sourceUnits), save, 'a correct answer does not skip the following source pages');
  save = setPagePosition(save, current, pages.length - 1);
  assert.deepEqual(readingPosition(save, current), { before: 3, after: 3 });
  assert.deepEqual(validateSave(exported(save), source), save);
  const next = advance(save, sourceUnits);
  assert.equal(next.cursor, 1);
  assert.equal(next.completed, 1);
  const revisited = navigate(next, sourceUnits, 0);
  assert.equal(pagePosition(revisited, current), pages.length - 1);
  assert.equal(isQuestionResolved(revisited, 'q1'), true);
});

test('short-page validation rejects unopened pages, invalid resolutions, future units and aliased imported state', () => {
  const source = longCorpus();
  const sourceUnits = flattenCorpus(source);
  const current = sourceUnits[0];
  const questionPage = makeReadingPages(current).findIndex(page => page.kind === 'question');
  const atQuestion = setPagePosition(createSave(source, 'validate-pages'), current, questionPage);
  const wrong = submitAnswer(atQuestion, current, 'q1-rule');
  const correct = submitAnswer(wrong, current, 'q1-context');
  for (const invalid of [
    { ...wrong, pages: { u1: questionPage + 1 } },
    { ...wrong, pages: { u1: -1 } },
    { ...wrong, pages: { u1: 0.5 } },
    { ...wrong, pages: { u1: 99_999 } },
    { ...wrong, pages: { u2: 0 } },
    { ...wrong, pages: { missing: 0 } },
    { ...wrong, pages: [] },
    { ...wrong, resolved: ['q2'] },
    { ...wrong, resolved: ['q1', 'q1'] },
    { ...wrong, completed: 1, cursor: 1 },
    { ...submitAnswer(atQuestion, current, 'q1-context'), resolved: [] },
    { ...createSave(source, 'unstarted-pages'), pages: { u1: 0 } },
  ]) assert.equal(validateSave(invalid, source), null, JSON.stringify(invalid));
  const restored = validateSave(exported(correct), source)!;
  restored.pages.u1 = 0;
  restored.resolved.length = 0;
  assert.equal(correct.pages.u1, questionPage);
  assert.deepEqual(correct.resolved, ['q1']);
  for (const invalid of [-1, .5, Infinity, NaN, 99_999]) assert.throws(() => setPagePosition(correct, current, invalid));
  assert.throws(() => setPagePosition(correct, sourceUnits[1], 0));
});
