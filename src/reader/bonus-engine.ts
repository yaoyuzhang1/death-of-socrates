import { allChaptersComplete } from './engine.ts';
import { BONUS_SCENE_IDS, type ReadingUnit, type Save } from './model.ts';

const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

/** The first unanswered scene is available; later scenes remain closed. */
export function bonusFrontier(save: Save): number {
  const firstUnanswered = BONUS_SCENE_IDS.findIndex(id => !own(save.bonus.choices, id));
  return firstUnanswered < 0 ? BONUS_SCENE_IDS.length - 1 : firstUnanswered;
}

export function chooseBonus(save: Save, units: readonly ReadingUnit[], sceneId: string, optionId: string): Save {
  if (!allChaptersComplete(save, units)) throw new Error('完成全部八章后，才能进入隐藏章节。');
  const index = BONUS_SCENE_IDS.findIndex(id => id === sceneId);
  if (index < 0 || index !== save.bonus.cursor || index > bonusFrontier(save)) {
    throw new Error('只能选择当前已经开放的对话。');
  }
  if (!['a', 'b', 'c'].includes(optionId)) throw new Error('这个选项不属于当前对话。');
  const previous = own(save.bonus.visited, sceneId) ? save.bonus.visited[sceneId] : [];
  if (previous.includes(optionId)) return save;
  return {
    ...save,
    bonus: {
      ...save.bonus,
      choices: own(save.bonus.choices, sceneId) ? save.bonus.choices : { ...save.bonus.choices, [sceneId]: optionId },
      visited: { ...save.bonus.visited, [sceneId]: [...previous, optionId] },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function navigateBonus(save: Save, units: readonly ReadingUnit[], index: number): Save {
  if (!allChaptersComplete(save, units) || !Number.isInteger(index) || index < 0 || index > bonusFrontier(save)) return save;
  if (index === save.bonus.cursor) return save;
  return { ...save, bonus: { ...save.bonus, cursor: index }, updatedAt: new Date().toISOString() };
}

export function finishBonus(save: Save, units: readonly ReadingUnit[]): Save {
  if (save.bonus.completed || !allChaptersComplete(save, units) ||
    BONUS_SCENE_IDS.some(id => !own(save.bonus.choices, id))) return save;
  return { ...save, bonus: { ...save.bonus, completed: true }, updatedAt: new Date().toISOString() };
}
