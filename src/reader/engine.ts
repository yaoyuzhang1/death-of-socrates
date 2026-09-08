import type {
  Answer,
  Chapter,
  Corpus,
  Option,
  Question,
  ReadingUnit,
  Save,
} from './model.ts';

const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keysAre = (value: Record<string, unknown>, keys: readonly string[]) =>
  Reflect.ownKeys(value).length === keys.length && keys.every(key => own(value, key));
const integerIn = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const validSeed = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && value.trim().length > 0;
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length !== 24) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

export function flattenCorpus(corpus: Corpus): ReadingUnit[] {
  const units: ReadingUnit[] = [];
  corpus.chapters.forEach((chapter, chapterIndex) => {
    chapter.sections.forEach((section, sectionIndex) => {
      section.units.forEach(unit => {
        units.push({ ...unit, chapter, section, chapterIndex, sectionIndex, index: units.length });
      });
    });
  });
  return units;
}

function indexCorpus(corpus: Corpus) {
  const units = flattenCorpus(corpus);
  const unitIds = new Map<string, number>();
  const questions = new Map<string, { question: Question; index: number }>();
  if (!units.length || typeof corpus.edition.id !== 'string' || !corpus.edition.id.trim()) {
    throw new Error('阅读文本必须包含版本标识和至少一个阅读单元。');
  }
  for (const unit of units) {
    if (!unit.id || unitIds.has(unit.id)) throw new Error('阅读单元标识必须唯一。');
    unitIds.set(unit.id, unit.index);
    const question = unit.question;
    if (!question) continue;
    if (!question.id || questions.has(question.id)) throw new Error('问题标识必须唯一。');
    const optionIds = question.options.map(option => option.id);
    if (optionIds.some(id => !id) || new Set(optionIds).size !== optionIds.length || !optionIds.includes(question.correctId)) {
      throw new Error('问题选项必须有唯一标识，且包含原问对应项。');
    }
    questions.set(question.id, { question, index: unit.index });
  }
  return { units, unitIds, questions };
}

export function createSave(corpus: Corpus, seed?: string): Save {
  indexCorpus(corpus);
  const selectedSeed = seed ?? crypto.randomUUID();
  if (!validSeed(selectedSeed)) throw new Error('选项顺序种子必须是1至128个字符的非空字符串。');
  return {
    version: 2,
    editionId: corpus.edition.id,
    seed: selectedSeed,
    started: false,
    cursor: 0,
    completed: 0,
    answers: {},
    hints: [],
    bookmarks: [],
    scroll: 0,
    settings: { fontSize: 18, theme: 'paper' },
    updatedAt: new Date().toISOString(),
  };
}

export function validateSave(input: unknown, corpus: Corpus): Save | null {
  try {
    const { units, unitIds, questions } = indexCorpus(corpus);
    if (!record(input) || !keysAre(input, [
      'version', 'editionId', 'seed', 'started', 'cursor', 'completed', 'answers',
      'hints', 'bookmarks', 'scroll', 'settings', 'updatedAt',
    ])) return null;
    if (input.version !== 2 || input.editionId !== corpus.edition.id || !validSeed(input.seed) ||
      typeof input.started !== 'boolean' || !integerIn(input.cursor, 0, units.length - 1) ||
      !integerIn(input.completed, 0, units.length) || input.cursor > input.completed ||
      !validDate(input.updatedAt)) return null;
    if (typeof input.scroll !== 'number' || !Number.isFinite(input.scroll) || input.scroll < 0 || input.scroll > 10_000_000) return null;
    if (!record(input.settings) || !keysAre(input.settings, ['fontSize', 'theme']) ||
      !integerIn(input.settings.fontSize, 14, 32) || !['paper', 'night'].includes(input.settings.theme as string)) return null;
    if (!Array.isArray(input.hints) || input.hints.length > questions.size ||
      !Array.isArray(input.bookmarks) || input.bookmarks.length > units.length ||
      !record(input.answers) || Reflect.ownKeys(input.answers).length > questions.size) return null;
    const hints = new Set<string>();
    for (const id of input.hints) {
      if (typeof id !== 'string' || hints.has(id)) return null;
      const question = questions.get(id);
      if (!question || question.index > input.completed) return null;
      hints.add(id);
    }
    const bookmarks = new Set<string>();
    for (const id of input.bookmarks) {
      if (typeof id !== 'string' || bookmarks.has(id)) return null;
      const index = unitIds.get(id);
      if (index === undefined || index > input.completed) return null;
      bookmarks.add(id);
    }
    const answers: Record<string, Answer> = {};
    for (const id of Reflect.ownKeys(input.answers)) {
      if (typeof id !== 'string') return null;
      const known = questions.get(id);
      const answer = input.answers[id];
      if (!known || known.index > input.completed || !record(answer) ||
        !keysAre(answer, ['choiceId', 'hinted', 'at']) || typeof answer.hinted !== 'boolean' ||
        answer.hinted !== hints.has(id) || !validDate(answer.at) || answer.at > input.updatedAt ||
        !(answer.choiceId === null || known.question.options.some(option => option.id === answer.choiceId))) return null;
      Object.defineProperty(answers, id, {
        value: { choiceId: answer.choiceId, hinted: answer.hinted, at: answer.at },
        enumerable: true, configurable: true, writable: true,
      });
    }
    for (const unit of units.slice(0, input.completed)) {
      if (unit.question && !own(answers, unit.question.id)) return null;
    }
    if (!input.started && (input.cursor !== 0 || input.completed !== 0 || Object.keys(answers).length ||
      hints.size || bookmarks.size || input.scroll !== 0)) return null;
    return {
      version: 2,
      editionId: corpus.edition.id,
      seed: input.seed,
      started: input.started,
      cursor: input.cursor,
      completed: input.completed,
      answers,
      hints: [...hints],
      bookmarks: [...bookmarks],
      scroll: input.scroll,
      settings: { fontSize: input.settings.fontSize, theme: input.settings.theme as 'paper' | 'night' },
      updatedAt: input.updatedAt,
    };
  } catch {
    return null;
  }
}

export function orderedOptions(question: Question, seed: string): Option[] {
  if (!validSeed(seed)) throw new Error('无效的选项顺序种子。');
  let state = 2166136261;
  for (const character of `${seed}\u0000${question.id}`) {
    state ^= character.codePointAt(0)!;
    state = Math.imul(state, 16777619);
  }
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const options = [...question.options];
  for (let index = options.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [options[index], options[other]] = [options[other], options[index]];
  }
  return options;
}

function assertCurrentUnit(save: Save, unit: ReadingUnit) {
  if (!Number.isInteger(unit.index) || unit.index < 0 || unit.index !== save.cursor || unit.index > save.completed) {
    throw new Error('只能回答当前已经开放的阅读单元。');
  }
}

export function submitAnswer(save: Save, unit: ReadingUnit, choiceId: string | null): Save {
  assertCurrentUnit(save, unit);
  const question = unit.question;
  if (!question) throw new Error('这一段没有需要提交的问题。');
  if (choiceId !== null && !question.options.some(option => option.id === choiceId)) throw new Error('这个选项不属于当前问题。');
  if (own(save.answers, question.id)) return save;
  const now = new Date().toISOString();
  return {
    ...save,
    started: true,
    answers: { ...save.answers, [question.id]: { choiceId, hinted: save.hints.includes(question.id), at: now } },
    updatedAt: now,
  };
}

export function useHint(save: Save, unit: ReadingUnit): Save {
  assertCurrentUnit(save, unit);
  const question = unit.question;
  if (!question || own(save.answers, question.id) || save.hints.includes(question.id)) return save;
  return { ...save, started: true, hints: [...save.hints, question.id], updatedAt: new Date().toISOString() };
}

export function advance(save: Save, units: readonly ReadingUnit[]): Save {
  if (!integerIn(save.cursor, 0, units.length - 1) || !integerIn(save.completed, 0, units.length) || save.cursor > save.completed) return save;
  const unit = units[save.cursor];
  if (unit.question && !own(save.answers, unit.question.id)) return save;
  if (save.completed === units.length && save.cursor === units.length - 1) return save;
  return {
    ...save,
    started: true,
    cursor: Math.min(save.cursor + 1, units.length - 1),
    completed: Math.max(save.completed, save.cursor + 1),
    scroll: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function navigate(save: Save, units: readonly ReadingUnit[], index: number): Save {
  if (!integerIn(index, 0, units.length - 1) || index > save.completed) return save;
  return { ...save, cursor: index, scroll: 0, updatedAt: new Date().toISOString() };
}

export function chapterStats(chapter: Chapter, save: Save) {
  const questions = chapter.sections.flatMap(section => section.units.flatMap(unit => unit.question ? [unit.question] : []));
  const stats = { total: questions.length, answered: 0, correct: 0, revealed: 0, hinted: 0 };
  for (const question of questions) {
    if (save.hints.includes(question.id)) stats.hinted++;
    if (!own(save.answers, question.id)) continue;
    const answer = save.answers[question.id];
    stats.answered++;
    if (answer.choiceId === null) stats.revealed++;
    else if (answer.choiceId === question.correctId) stats.correct++;
  }
  return stats;
}
