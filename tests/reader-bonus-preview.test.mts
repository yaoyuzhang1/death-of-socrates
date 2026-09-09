import test from 'node:test';
import assert from 'node:assert/strict';
import { freshPreviewSave, validatePreviewProgress } from '../src/reader/bonus-preview.ts';
import { bonusFrontier, chooseBonus, navigateBonus, finishBonus } from '../src/reader/bonus-engine.ts';
import { flattenCorpus, validateSave, allChaptersComplete } from '../src/reader/engine.ts';
import { BONUS_SCENE_IDS, type Corpus, type Save } from '../src/reader/model.ts';

const corpus: Corpus = {
  title: '独立试玩行为测试',
  edition: { id: 'bonus-preview-fixture', label: '测试', description: '行为测试', translator: '测试', sourceUrl: 'https://example.org', license: 'fixture', notes: [] },
  chapters: Array.from({ length: 8 }, (_, index) => ({
    id: `chapter-${index + 1}`, title: `第${index + 1}章`, subtitle: '', range: '', introduction: '', conclusion: '',
    sections: [{ id: `section-${index + 1}`, title: '讨论', range: '', units: [{
      id: `unit-${index + 1}`, paragraphs: [{ id: `paragraph-${index + 1}`, text: '一段原文。' }], response: [],
    }] }],
  })),
};
const units = flattenCorpus(corpus);
const firstId = BONUS_SCENE_IDS[0];
const mainState = (save: Save) => { const { bonus, updatedAt, ...main } = save; return main; };

test('the standalone preview starts without awarding chapter completion, and ordinary earned guards remain closed', () => {
  const preview = freshPreviewSave(corpus);
  assert.equal(preview.started, false);
  assert.equal(preview.completed, 0);
  assert.equal(preview.cursor, 0);
  assert.ok(Object.values(preview.chapterProgress).every(chapter => !chapter.started && chapter.completed === 0));
  assert.equal(allChaptersComplete(preview, units), false);
  assert.deepEqual(validateSave(preview, corpus), preview);
  assert.throws(() => chooseBonus(preview, units, firstId, 'a'));
  assert.throws(() => chooseBonus(preview, units, firstId, 'a', 'earned'));
  assert.equal(navigateBonus(preview, units, 1), preview);
  assert.equal(finishBonus(preview, units), preview);
  const started = chooseBonus(preview, units, firstId, 'b', 'preview');
  assert.equal(started.bonus.choices[firstId], 'b');
  assert.deepEqual(mainState(started), mainState(preview));
  assert.equal(validateSave(started, corpus), null, 'standalone progress cannot import into the earned game to bypass its lock');
});

test('preview mode retains sequential scene gates, immutable first choices and unique alternate exploration', () => {
  let preview = freshPreviewSave(corpus);
  assert.equal(navigateBonus(preview, units, 1, 'preview'), preview);
  assert.throws(() => chooseBonus(preview, units, BONUS_SCENE_IDS[1], 'a', 'preview'));
  assert.throws(() => chooseBonus(preview, units, firstId, 'invalid', 'preview'));
  preview = chooseBonus(preview, units, firstId, 'c', 'preview');
  preview = chooseBonus(preview, units, firstId, 'a', 'preview');
  assert.equal(chooseBonus(preview, units, firstId, 'a', 'preview'), preview);
  assert.deepEqual(preview.bonus.visited[firstId], ['c', 'a']);
  assert.equal(preview.bonus.choices[firstId], 'c');
  assert.equal(bonusFrontier(preview), 1);
  const next = navigateBonus(preview, units, 1, 'preview');
  assert.equal(next.bonus.cursor, 1);
  assert.throws(() => chooseBonus(next, units, firstId, 'b', 'preview'));
  assert.equal(finishBonus(next, units, 'preview'), next);
  assert.deepEqual(validatePreviewProgress(next.bonus), next.bonus);
});

test('the standalone validator rejects malformed or forged progress and copies restored choices without aliases', () => {
  const valid = { cursor: 1, completed: false, choices: { [firstId]: 'b' }, visited: { [firstId]: ['b', 'c'] } };
  for (const input of [null, [], {}, false, 'progress',
    { ...valid, cursor: -1 }, { ...valid, cursor: .5 }, { ...valid, cursor: 2 }, { ...valid, cursor: Infinity },
    { ...valid, cursor: 12 }, { ...valid, completed: true }, { ...valid, completed: 'false' },
    { ...valid, choices: [] }, { ...valid, visited: {} }, { ...valid, extra: true },
    { ...valid, choices: { [firstId]: 'd' } },
    { ...valid, choices: { [BONUS_SCENE_IDS[1]]: 'b' }, visited: { [BONUS_SCENE_IDS[1]]: ['b'] } },
    { ...valid, visited: { [firstId]: ['c', 'b'] } }, { ...valid, visited: { [firstId]: ['b', 'b'] } },
    { ...valid, visited: { [firstId]: ['b', 'd'] } }, { ...valid, visited: { [firstId]: [] } },
    { ...valid, choices: { [firstId]: 'b', unknown: 'a' }, visited: { [firstId]: ['b'], unknown: ['a'] } },
  ]) assert.equal(validatePreviewProgress(input), null);
  assert.throws(() => freshPreviewSave(corpus, { ...valid, completed: true }));
  const restored = validatePreviewProgress(valid)!;
  assert.ok(restored);
  restored.choices[firstId] = 'a';
  restored.visited[firstId].push('a');
  assert.equal(valid.choices[firstId], 'b');
  assert.deepEqual(valid.visited[firstId], ['b', 'c']);
  const loaded = freshPreviewSave(corpus, valid);
  loaded.bonus.visited[firstId].pop();
  assert.deepEqual(valid.visited[firstId], ['b', 'c']);
});

test('all twelve preview scenes can finish and resume independently while all main records remain empty', () => {
  let preview = freshPreviewSave(corpus);
  const originalMain = mainState(preview);
  for (const [index, id] of BONUS_SCENE_IDS.entries()) {
    preview = navigateBonus(preview, units, index, 'preview');
    preview = chooseBonus(preview, units, id, index % 2 ? 'a' : 'c', 'preview');
    assert.deepEqual(mainState(preview), originalMain);
    assert.deepEqual(validatePreviewProgress(JSON.parse(JSON.stringify(preview.bonus))), preview.bonus);
  }
  assert.equal(finishBonus(preview, units), preview, 'ordinary finish stays locked even with twelve preview choices');
  preview = finishBonus(preview, units, 'preview');
  assert.equal(preview.bonus.completed, true);
  assert.equal(preview.completed, 0);
  assert.equal(allChaptersComplete(preview, units), false);
  const restored = freshPreviewSave(corpus, validatePreviewProgress(JSON.parse(JSON.stringify(preview.bonus)))!);
  assert.equal(restored.started, false);
  assert.deepEqual(restored.answers, {});
  assert.deepEqual(restored.pages, {});
  assert.deepEqual(restored.bonus, preview.bonus);
  const earlier = navigateBonus(restored, units, 0, 'preview');
  const explored = chooseBonus(earlier, units, firstId, 'b', 'preview');
  assert.equal(explored.bonus.completed, true);
  assert.equal(explored.bonus.choices[firstId], 'c');
  assert.deepEqual(explored.bonus.visited[firstId], ['c', 'b']);
  assert.deepEqual(mainState(explored), mainState(restored));
});
