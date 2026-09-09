import test from 'node:test';
import assert from 'node:assert/strict';
import { createSave, flattenCorpus, enterChapter, setPagePosition, advance, validateSave, setScrollPosition } from '../src/reader/engine.ts';
import { bonusFrontier, chooseBonus, navigateBonus, finishBonus } from '../src/reader/bonus-engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';
import { BONUS_SCENE_IDS, type Corpus, type Save } from '../src/reader/model.ts';

const corpus: Corpus = {
  title: '隐藏章节行为测试',
  edition: { id: 'bonus-engine-fixture', label: '测试文本', description: '行为测试', translator: '测试', sourceUrl: 'https://example.org', license: 'fixture', notes: [] },
  chapters: Array.from({ length: 8 }, (_, index) => ({
    id: `chapter-${index + 1}`, title: `第${index + 1}章`, subtitle: '', range: '', introduction: '', conclusion: '',
    sections: [{ id: `section-${index + 1}`, title: '测试单元', range: '', units: [{
      id: `unit-${index + 1}`, paragraphs: [{ id: `paragraph-${index + 1}`, text: '一段测试阅读。' }], response: [],
    }] }],
  })),
};
const units = flattenCorpus(corpus);
const fresh = () => createSave(corpus, 'bonus-repeatable-seed');
function mainFinished(): Save {
  let save = fresh();
  for (const unit of units) {
    save = enterChapter(save, units, unit.chapter.id);
    save = setPagePosition(save, unit, makeReadingPages(unit).length - 1);
    save = advance(save, units);
  }
  return setScrollPosition({ ...save, bookmarks: [units[0].id] }, units[save.cursor], 357);
}
const exported = (save: Save) => JSON.parse(JSON.stringify(save));
function mainState(save: Save) {
  const { bonus, updatedAt, ...main } = save;
  return main;
}

test('the hidden chapter is unavailable until all eight main chapters are finished', () => {
  const initial = fresh();
  assert.equal(bonusFrontier(initial), 0);
  assert.throws(() => chooseBonus(initial, units, BONUS_SCENE_IDS[0], 'a'));
  assert.equal(navigateBonus(initial, units, 0), initial);
  assert.equal(navigateBonus(initial, units, 1), initial);
  assert.equal(finishBonus(initial, units), initial);
  let eighthOnly = enterChapter(initial, units, 'chapter-8');
  eighthOnly = advance(setPagePosition(eighthOnly, units[7], 0), units);
  assert.throws(() => chooseBonus(eighthOnly, units, BONUS_SCENE_IDS[0], 'a'));
  assert.equal(finishBonus(eighthOnly, units), eighthOnly);
});

test('only the current scene accepts choices and neither navigation nor a first choice skips the sequential frontier', () => {
  let save = mainFinished();
  assert.throws(() => chooseBonus(save, units, 'missing', 'a'));
  assert.throws(() => chooseBonus(save, units, BONUS_SCENE_IDS[0], 'd'));
  assert.throws(() => chooseBonus(save, units, BONUS_SCENE_IDS[1], 'a'));
  for (const invalid of [-1, 0.5, 1, 12, Infinity, NaN]) assert.equal(navigateBonus(save, units, invalid), save);
  save = chooseBonus(save, units, BONUS_SCENE_IDS[0], 'b');
  assert.equal(bonusFrontier(save), 1);
  assert.equal(save.bonus.cursor, 0, 'choosing keeps the response scene visible');
  assert.equal(save.bonus.completed, false);
  assert.equal(navigateBonus(save, units, 2), save);
  save = navigateBonus(save, units, 1);
  assert.equal(save.bonus.cursor, 1);
  assert.throws(() => chooseBonus(save, units, BONUS_SCENE_IDS[0], 'c'));
  assert.equal(finishBonus(save, units), save);
  assert.deepEqual(validateSave(exported(save), corpus), save);
});

test('alternate choices retain the original answer, keep exploration unique and do not alter main reading state', () => {
  const initial = mainFinished();
  const snapshot = structuredClone(initial);
  let save = chooseBonus(initial, units, BONUS_SCENE_IDS[0], 'b');
  const firstChoices = save.bonus.choices;
  save = chooseBonus(save, units, BONUS_SCENE_IDS[0], 'a');
  save = chooseBonus(save, units, BONUS_SCENE_IDS[0], 'c');
  assert.equal(save.bonus.choices, firstChoices);
  assert.equal(save.bonus.choices[BONUS_SCENE_IDS[0]], 'b');
  assert.deepEqual(save.bonus.visited[BONUS_SCENE_IDS[0]], ['b', 'a', 'c']);
  assert.equal(chooseBonus(save, units, BONUS_SCENE_IDS[0], 'b'), save);
  assert.deepEqual(mainState(save), mainState(initial));
  assert.deepEqual(initial, snapshot);
  const restored = validateSave(exported(save), corpus)!;
  assert.ok(restored);
  assert.deepEqual(restored, save);
  restored.bonus.visited[BONUS_SCENE_IDS[0]].pop();
  assert.equal(save.bonus.visited[BONUS_SCENE_IDS[0]].length, 3);
});

test('all twelve scenes can be completed, backed up, revisited and explored again without losing completion or main records', () => {
  let save = mainFinished();
  const main = mainState(save);
  for (const [index, id] of BONUS_SCENE_IDS.entries()) {
    save = navigateBonus(save, units, index);
    save = chooseBonus(save, units, id, index % 2 ? 'c' : 'a');
    assert.deepEqual(mainState(save), main);
    assert.deepEqual(validateSave(exported(save), corpus), save);
    assert.equal(save.bonus.completed, false);
    if (index < 11) assert.equal(finishBonus(save, units), save);
  }
  assert.equal(bonusFrontier(save), 11);
  assert.equal(navigateBonus(save, units, 12), save);
  save = finishBonus(save, units);
  assert.equal(save.bonus.completed, true);
  assert.equal(finishBonus(save, units), save);
  const firstChoices = structuredClone(save.bonus.choices);
  save = validateSave(exported(save), corpus)!;
  assert.ok(save);
  save = navigateBonus(save, units, 2);
  save = chooseBonus(save, units, BONUS_SCENE_IDS[2], 'b');
  assert.equal(save.bonus.completed, true);
  assert.deepEqual(save.bonus.choices, firstChoices);
  assert.deepEqual(save.bonus.visited[BONUS_SCENE_IDS[2]], ['a', 'b']);
  assert.equal(bonusFrontier(save), 11);
  save = enterChapter(save, units, 'chapter-3');
  const restored = validateSave(exported(save), corpus)!;
  assert.ok(restored);
  assert.equal(restored.bonus.cursor, 2);
  assert.equal(restored.bonus.completed, true);
  assert.deepEqual(restored.bonus.choices, firstChoices);
  assert.deepEqual(restored.answers, main.answers);
  assert.deepEqual(restored.pages, main.pages);
  assert.deepEqual(restored.reviews, main.reviews);
  assert.deepEqual(restored.bookmarks, main.bookmarks);
});
