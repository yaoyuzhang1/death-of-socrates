import { createSave } from './engine.ts';
import { BONUS_SCENE_IDS, type BonusProgress, type Corpus, type Save } from './model.ts';

const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keysAre = (value: Record<string, unknown>, keys: readonly string[]) =>
  Reflect.ownKeys(value).length === keys.length && keys.every(key => own(value, key));

/** Standalone preview storage contains only the twelve-scene bonus progress. */
export function validatePreviewProgress(input: unknown): BonusProgress | null {
  if (!record(input) || !keysAre(input, ['cursor', 'completed', 'choices', 'visited']) ||
    typeof input.cursor !== 'number' || !Number.isInteger(input.cursor) || input.cursor < 0 ||
    input.cursor >= BONUS_SCENE_IDS.length || typeof input.completed !== 'boolean' ||
    !record(input.choices) || !record(input.visited)) return null;
  const count = Reflect.ownKeys(input.choices).length;
  if (count > BONUS_SCENE_IDS.length || !keysAre(input.choices, BONUS_SCENE_IDS.slice(0, count)) ||
    !keysAre(input.visited, BONUS_SCENE_IDS.slice(0, count)) ||
    input.cursor > Math.min(count, BONUS_SCENE_IDS.length - 1) ||
    (input.completed && count !== BONUS_SCENE_IDS.length)) return null;
  const choices: Record<string, string> = {};
  const visited: Record<string, string[]> = {};
  for (const id of BONUS_SCENE_IDS.slice(0, count)) {
    const choice = input.choices[id];
    const seen = input.visited[id];
    if (typeof choice !== 'string' || !['a', 'b', 'c'].includes(choice) || !Array.isArray(seen) ||
      seen.length < 1 || seen.length > 3 || new Set(seen).size !== seen.length || seen[0] !== choice ||
      seen.some(value => typeof value !== 'string' || !['a', 'b', 'c'].includes(value))) return null;
    choices[id] = choice;
    visited[id] = [...seen];
  }
  return { cursor: input.cursor, completed: input.completed, choices, visited };
}

/** Preview starts independently and never marks main-game chapters completed. */
export function freshPreviewSave(corpus: Corpus, bonus?: BonusProgress): Save {
  const save = createSave(corpus);
  if (bonus === undefined) return save;
  const restored = validatePreviewProgress(bonus);
  if (!restored) throw new Error('隐藏章节试玩进度无效。');
  return { ...save, bonus: restored };
}
