import type {
  Answer,
  Chapter,
  ChapterProgress,
  Corpus,
  Option,
  Paragraph,
  Question,
  ReadingMode,
  ReadingPosition,
  ReadingUnit,
  Review,
  Save,
} from './model.ts';
import { BONUS_SCENE_IDS } from './model.ts';
import { makeReadingPages, makeVersion4ReadingPages, migrateVersion4Page } from './pagination.ts';

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
  const chapterIds = corpus.chapters.map(chapter => chapter.id);
  if (chapterIds.some(id => !id) || new Set(chapterIds).size !== chapterIds.length ||
    corpus.chapters.some(chapter => !chapter.sections.flatMap(section => section.units).length)) {
    throw new Error('章节必须有唯一标识，并至少包含一个阅读单元。');
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
  const { units } = indexCorpus(corpus);
  const selectedSeed = seed ?? crypto.randomUUID();
  if (!validSeed(selectedSeed)) throw new Error('选项顺序种子必须是1至128个字符的非空字符串。');
  return {
    version: 6,
    editionId: corpus.edition.id,
    seed: selectedSeed,
    started: false,
    cursor: 0,
    completed: 0,
    chapterProgress: Object.fromEntries(corpus.chapters.map(chapter => [chapter.id, {
      completed: 0, cursor: units.find(unit => unit.chapter.id === chapter.id)!.index, started: false, scroll: 0,
    }])),
    bonus: { cursor: 0, completed: false, choices: {}, visited: {} },
    answers: {},
    resolved: [],
    pages: {},
    reading: { mode: 'step', positions: {} },
    reviews: {},
    hints: [],
    bookmarks: [],
    scroll: 0,
    settings: { fontSize: 18, theme: 'paper' },
    updatedAt: new Date().toISOString(),
  };
}

function chapterUnits(unit: ReadingUnit) {
  return unit.chapter.sections.flatMap(section => section.units);
}

function localUnitIndex(unit: ReadingUnit): number {
  return chapterUnits(unit).findIndex(current => current.id === unit.id);
}

export function getChapterProgress(save: Save, chapterId: string): ChapterProgress {
  if (!own(save.chapterProgress, chapterId)) throw new Error('没有找到这一章的阅读进度。');
  return { ...save.chapterProgress[chapterId] };
}

export function isUnitAccessible(save: Save, unit: ReadingUnit): boolean {
  const local = localUnitIndex(unit);
  const progress = own(save.chapterProgress, unit.chapter.id) ? save.chapterProgress[unit.chapter.id] : undefined;
  return Boolean(progress && local >= 0 && local <= progress.completed);
}

function isUnitComplete(save: Save, unit: ReadingUnit): boolean {
  return localUnitIndex(unit) < getChapterProgress(save, unit.chapter.id).completed;
}

export function latestUnitIndex(save: Save, units: readonly ReadingUnit[], chapterId = units[save.cursor]?.chapter.id): number {
  const selected = units.filter(unit => unit.chapter.id === chapterId);
  if (!selected.length) return save.cursor;
  return selected[Math.min(getChapterProgress(save, chapterId).completed, selected.length - 1)].index;
}

export function allChaptersComplete(save: Save, units: readonly ReadingUnit[]): boolean {
  return units.length > 0 && units.every(unit => isUnitComplete(save, unit));
}

function activeProgress(save: Save, unit: ReadingUnit, scroll = save.scroll): Record<string, ChapterProgress> {
  return { ...save.chapterProgress, [unit.chapter.id]: {
    ...getChapterProgress(save, unit.chapter.id), started: true, cursor: unit.index, scroll,
  } };
}

export function setScrollPosition(save: Save, unit: ReadingUnit, scroll: number): Save {
  assertCurrentUnit(save, unit);
  if (!Number.isFinite(scroll) || scroll < 0 || scroll > 10_000_000) throw new Error('阅读位置超出有效范围。');
  return { ...save, started: true, scroll, chapterProgress: activeProgress(save, unit, scroll), updatedAt: new Date().toISOString() };
}

export function enterChapter(save: Save, units: readonly ReadingUnit[], chapterId: string): Save {
  const destination = units.find(unit => unit.chapter.id === chapterId);
  const current = units[save.cursor];
  if (!destination || !current) return save;
  const remembered = getChapterProgress(save, chapterId);
  if (current.chapter.id === chapterId) {
    return { ...save, started: true, chapterProgress: activeProgress(save, current), updatedAt: new Date().toISOString() };
  }
  return {
    ...save, started: true, cursor: remembered.cursor, scroll: remembered.scroll,
    chapterProgress: { ...(save.started ? activeProgress(save, current) : save.chapterProgress), [chapterId]: { ...remembered, started: true } },
    updatedAt: new Date().toISOString(),
  };
}

export function validateSave(input: unknown, corpus: Corpus): Save | null {
  try {
    const { units, unitIds, questions } = indexCorpus(corpus);
    if (!record(input)) return null;
    const oldVersion = input.version === 2;
    const legacy = oldVersion || input.version === 3;
    const previousPages = input.version === 4;
    const parallel = input.version === 6;
    const commonKeys = [
      'version', 'editionId', 'seed', 'started', 'cursor', 'completed', 'answers',
      'hints', 'bookmarks', 'scroll', 'settings', 'updatedAt',
    ];
    if (!keysAre(input, oldVersion ? commonKeys : [...commonKeys, 'reading', 'reviews', ...(legacy ? [] : ['resolved', 'pages']), ...(parallel ? ['chapterProgress', 'bonus'] : [])])) return null;
    if ((!legacy && !previousPages && !parallel && input.version !== 5) || input.editionId !== corpus.edition.id || !validSeed(input.seed) ||
      typeof input.started !== 'boolean' || !integerIn(input.cursor, 0, units.length - 1) ||
      !integerIn(input.completed, 0, units.length) || (!parallel && input.cursor > input.completed) ||
      !validDate(input.updatedAt)) return null;
    if (typeof input.scroll !== 'number' || !Number.isFinite(input.scroll) || input.scroll < 0 || input.scroll > 10_000_000) return null;
    const savedCursor = input.cursor;
    const savedCompleted = input.completed;
    const chapterProgress: Record<string, ChapterProgress> = {};
    if (parallel && (!record(input.chapterProgress) || !keysAre(input.chapterProgress, corpus.chapters.map(chapter => chapter.id)))) return null;
    for (const chapter of corpus.chapters) {
      const selected = units.filter(unit => unit.chapter.id === chapter.id);
      const first = selected[0].index;
      const active: boolean = units[savedCursor].chapter.id === chapter.id;
      const completed = Math.max(0, Math.min(selected.length, savedCompleted - first));
      const progress: unknown = parallel ? (input.chapterProgress as Record<string, unknown>)[chapter.id] : {
        completed, cursor: active ? input.cursor : selected[Math.min(completed, selected.length - 1)].index,
        started: completed > 0 || (active && input.started), scroll: active && !previousPages ? input.scroll : 0,
      };
      if (!record(progress) || !keysAre(progress, ['completed', 'cursor', 'started', 'scroll']) ||
        !integerIn(progress.completed, 0, selected.length) ||
        !integerIn(progress.cursor, first, first + Math.min(progress.completed, selected.length - 1)) ||
        typeof progress.started !== 'boolean' || typeof progress.scroll !== 'number' ||
        !Number.isFinite(progress.scroll) || progress.scroll < 0 || progress.scroll > 10_000_000 ||
        (!progress.started && (progress.completed !== 0 || progress.cursor !== first || progress.scroll !== 0)) ||
        (active && progress.cursor !== input.cursor)) return null;
      chapterProgress[chapter.id] = { completed: progress.completed, cursor: progress.cursor, started: progress.started, scroll: progress.scroll };
    }
    if (Object.values(chapterProgress).reduce((sum, progress) => sum + progress.completed, 0) !== input.completed) return null;
    const accessible = (index: number) => {
      if (!parallel) return index <= savedCompleted;
      const unit = units[index];
      return chapterProgress[unit.chapter.id].started && localUnitIndex(unit) <= chapterProgress[unit.chapter.id].completed;
    };
    const complete = (index: number) => localUnitIndex(units[index]) < chapterProgress[units[index].chapter.id].completed;
    if (parallel && input.started && !accessible(input.cursor)) return null;
    if (!record(input.settings) || !keysAre(input.settings, ['fontSize', 'theme']) ||
      !integerIn(input.settings.fontSize, 14, 32) || !['paper', 'night'].includes(input.settings.theme as string)) return null;
    if (!Array.isArray(input.hints) || input.hints.length > questions.size ||
      !Array.isArray(input.bookmarks) || input.bookmarks.length > units.length ||
      !record(input.answers) || Reflect.ownKeys(input.answers).length > questions.size) return null;
    const hints = new Set<string>();
    for (const id of input.hints) {
      if (typeof id !== 'string' || hints.has(id)) return null;
      const question = questions.get(id);
      if (!question || !accessible(question.index)) return null;
      hints.add(id);
    }
    const bookmarks = new Set<string>();
    for (const id of input.bookmarks) {
      if (typeof id !== 'string' || bookmarks.has(id)) return null;
      const index = unitIds.get(id);
      if (index === undefined || !accessible(index)) return null;
      bookmarks.add(id);
    }
    const answers: Record<string, Answer> = {};
    for (const id of Reflect.ownKeys(input.answers)) {
      if (typeof id !== 'string') return null;
      const known = questions.get(id);
      const answer = input.answers[id];
      if (!known || !accessible(known.index) || !record(answer) ||
        !keysAre(answer, ['choiceId', 'hinted', 'at']) || typeof answer.hinted !== 'boolean' ||
        answer.hinted !== hints.has(id) || !validDate(answer.at) || answer.at > input.updatedAt ||
        !(answer.choiceId === null || known.question.options.some(option => option.id === answer.choiceId))) return null;
      Object.defineProperty(answers, id, {
        value: { choiceId: answer.choiceId, hinted: answer.hinted, at: answer.at },
        enumerable: true, configurable: true, writable: true,
      });
    }
    const resolvedInput = legacy ? Object.keys(answers) : input.resolved;
    if (!Array.isArray(resolvedInput) || resolvedInput.length > questions.size) return null;
    const resolved = new Set<string>();
    for (const id of resolvedInput) {
      if (typeof id !== 'string' || resolved.has(id) || !questions.has(id) || !own(answers, id)) return null;
      resolved.add(id);
    }
    for (const [id, answer] of Object.entries(answers)) {
      if (answer.choiceId === questions.get(id)!.question.correctId && !resolved.has(id)) return null;
    }
    for (const unit of units.filter(unit => complete(unit.index))) {
      if (unit.question && !resolved.has(unit.question.id)) return null;
    }
    const migratedPositions: Record<string, ReadingPosition> = {};
    if (oldVersion && input.started) {
      const current = units[input.cursor];
      const limits = readingLimits(current);
      // Version 2 already displayed the entire current passage; retain that view and its scroll offset.
      Object.defineProperty(migratedPositions, current.id, {
        value: {
          before: limits.before,
          after: !current.question || own(answers, current.question.id) ? limits.after : Math.min(1, limits.after),
        },
        enumerable: true, configurable: true, writable: true,
      });
    }
    const reading = oldVersion ? { mode: 'step', positions: migratedPositions } : input.reading;
    const reviewInput = oldVersion ? {} : input.reviews;
    if (!record(reading) || !keysAre(reading, ['mode', 'positions']) ||
      !['step', 'continuous'].includes(reading.mode as string) || !record(reading.positions) ||
      Reflect.ownKeys(reading.positions).length > units.length ||
      !record(reviewInput) || Reflect.ownKeys(reviewInput).length > questions.size) return null;
    const positions: Record<string, ReadingPosition> = {};
    for (const id of Reflect.ownKeys(reading.positions)) {
      if (typeof id !== 'string') return null;
      const index = unitIds.get(id);
      const position = reading.positions[id];
      if (index === undefined || !accessible(index) || !record(position) ||
        !keysAre(position, ['before', 'after'])) return null;
      const unit = units[index];
      const limits = readingLimits(unit);
      if (!integerIn(position.before, Math.min(1, limits.before), limits.before) ||
        !integerIn(position.after, Math.min(1, limits.after), limits.after)) return null;
      if (complete(index) && (position.before !== limits.before || position.after !== limits.after)) return null;
      if (unit.question && !resolved.has(unit.question.id) && position.after > Math.min(1, limits.after)) return null;
      if (unit.question && own(answers, unit.question.id) && position.before !== limits.before) return null;
      Object.defineProperty(positions, id, {
        value: { before: position.before, after: position.after },
        enumerable: true, configurable: true, writable: true,
      });
    }
    const reviews: Record<string, Review> = {};
    for (const id of Reflect.ownKeys(reviewInput)) {
      if (typeof id !== 'string') return null;
      const known = questions.get(id);
      const review = reviewInput[id];
      if (!known || !own(answers, id) || !accessible(known.index) || !record(review) ||
        !keysAre(review, ['attempts', 'correct', 'lastChoiceId', 'at']) ||
        !integerIn(review.attempts, 1, 1_000_000) || !integerIn(review.correct, 0, review.attempts) ||
        !validDate(review.at) || review.at < answers[id].at || review.at > input.updatedAt ||
        !(review.lastChoiceId === null || known.question.options.some(option => option.id === review.lastChoiceId))) return null;
      const lastCorrect = review.lastChoiceId === known.question.correctId;
      if ((lastCorrect && review.correct === 0) || (!lastCorrect && review.correct === review.attempts)) return null;
      Object.defineProperty(reviews, id, {
        value: { attempts: review.attempts, correct: review.correct, lastChoiceId: review.lastChoiceId, at: review.at },
        enumerable: true, configurable: true, writable: true,
      });
    }
    const pageInput = legacy ? {} : input.pages;
    if (!record(pageInput) || Reflect.ownKeys(pageInput).length > units.length) return null;
    const pages: Record<string, number> = {};
    for (const id of Reflect.ownKeys(pageInput)) {
      if (typeof id !== 'string') return null;
      const index = unitIds.get(id);
      if (index === undefined || !accessible(index)) return null;
      const unit = units[index];
      const unitPages = previousPages ? makeVersion4ReadingPages(unit) : makeReadingPages(unit);
      const position = pageInput[id];
      if (!integerIn(position, 0, Math.max(0, unitPages.length - 1))) return null;
      const questionIndex = unitPages.findIndex(page => page.kind === 'question');
      if (questionIndex >= 0 && !resolved.has(unit.question!.id) && position > questionIndex) return null;
      Object.defineProperty(pages, id, {
        value: previousPages ? migrateVersion4Page(unit, position) : position,
        enumerable: true, configurable: true, writable: true,
      });
    }
    if (!input.started && (Object.values(chapterProgress).some(progress => progress.started) || input.cursor !== 0 || input.completed !== 0 || Object.keys(answers).length ||
      hints.size || bookmarks.size || Object.keys(positions).length || Object.keys(reviews).length ||
      resolved.size || Object.keys(pages).length || input.scroll !== 0)) return null;
    const result: Save = {
      version: 6,
      editionId: corpus.edition.id,
      seed: input.seed,
      started: input.started,
      cursor: input.cursor,
      completed: input.completed,
      chapterProgress,
      bonus: { cursor: 0, completed: false, choices: {}, visited: {} },
      answers,
      resolved: [...resolved],
      pages,
      reading: { mode: reading.mode as ReadingMode, positions },
      reviews,
      hints: [...hints],
      bookmarks: [...bookmarks],
      // The old pixel offset belongs to a different page layout; the source anchor above is retained.
      scroll: previousPages ? 0 : input.scroll,
      settings: { fontSize: input.settings.fontSize, theme: input.settings.theme as 'paper' | 'night' },
      updatedAt: input.updatedAt,
    };
    if (legacy && result.started) {
      const current = units[result.cursor];
      result.pages[current.id] = migratedPagePosition(result, current);
    }
    if (parallel) {
      const bonus = input.bonus;
      if (!record(bonus) || !keysAre(bonus, ['cursor', 'completed', 'choices', 'visited']) ||
        !integerIn(bonus.cursor, 0, BONUS_SCENE_IDS.length - 1) || typeof bonus.completed !== 'boolean' ||
        !record(bonus.choices) || !record(bonus.visited) ||
        Reflect.ownKeys(bonus.choices).length > BONUS_SCENE_IDS.length ||
        Reflect.ownKeys(bonus.visited).length !== Reflect.ownKeys(bonus.choices).length) return null;
      const choiceIds = Reflect.ownKeys(bonus.choices);
      const choiceCount = choiceIds.length;
      if (!keysAre(bonus.choices, BONUS_SCENE_IDS.slice(0, choiceCount)) ||
        !keysAre(bonus.visited, BONUS_SCENE_IDS.slice(0, choiceCount)) ||
        bonus.cursor > Math.min(choiceCount, BONUS_SCENE_IDS.length - 1) ||
        (bonus.completed && choiceCount !== BONUS_SCENE_IDS.length) ||
        (!allChaptersComplete(result, units) && (choiceCount || bonus.cursor !== 0 || bonus.completed))) return null;
      const choices: Record<string, string> = {};
      const visited: Record<string, string[]> = {};
      for (const id of BONUS_SCENE_IDS.slice(0, choiceCount)) {
        const choice = bonus.choices[id];
        const seen = bonus.visited[id];
        if (typeof choice !== 'string' || !['a', 'b', 'c'].includes(choice) || !Array.isArray(seen) ||
          seen.length < 1 || seen.length > 3 || new Set(seen).size !== seen.length || seen[0] !== choice ||
          seen.some(item => typeof item !== 'string' || !['a', 'b', 'c'].includes(item))) return null;
        choices[id] = choice;
        visited[id] = [...seen];
      }
      result.bonus = { cursor: bonus.cursor, completed: bonus.completed, choices, visited };
    }
    return result;
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
  if (!Number.isInteger(unit.index) || unit.index < 0 || unit.index !== save.cursor || !isUnitAccessible(save, unit)) {
    throw new Error('只能回答当前已经开放的阅读单元。');
  }
}

export function readingBatches(paragraphs: readonly Paragraph[], targetChars = 650): Paragraph[][] {
  if (!Number.isSafeInteger(targetChars) || targetChars < 1) throw new Error('阅读批次字数必须是正整数。');
  const batches: Paragraph[][] = [];
  let batch: Paragraph[] = [];
  let count = 0;
  for (const paragraph of paragraphs) {
    if (batch.length && count + paragraph.text.length > targetChars) {
      batches.push(batch);
      batch = [];
      count = 0;
    }
    batch.push(paragraph);
    count += paragraph.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function readingLimits(unit: ReadingUnit): ReadingPosition {
  return {
    before: readingBatches(unit.paragraphs).length,
    after: readingBatches(unit.response.slice(unit.replyCount ?? 0)).length,
  };
}

export function isQuestionResolved(save: Save, question: Question | string): boolean {
  return save.resolved.includes(typeof question === 'string' ? question : question.id);
}

function migratedPagePosition(save: Save, unit: ReadingUnit): number {
  const pages = makeReadingPages(unit);
  const position = readingPosition(save, unit);
  const resolved = !unit.question || isQuestionResolved(save, unit.question);
  const side = resolved ? 'after' : 'before';
  const paragraphs = side === 'after' ? unit.response.slice(unit.replyCount ?? 0) : unit.paragraphs;
  const lastVisible = readingBatches(paragraphs).slice(0, position[side]).flat().at(-1);
  if (lastVisible) {
    for (let index = pages.length - 1; index >= 0; index--) {
      const page = pages[index];
      if (page.kind === 'text' && page.side === side &&
        page.paragraphs.some(paragraph => paragraph.sourceId === lastVisible.id)) return index;
    }
  }
  const questionIndex = pages.findIndex(page => page.kind === 'question');
  return unit.question && own(save.answers, unit.question.id) && questionIndex >= 0 ? questionIndex : 0;
}

export function pagePosition(save: Save, unit: ReadingUnit): number {
  return own(save.pages, unit.id) ? save.pages[unit.id] : 0;
}

export function setPagePosition(save: Save, unit: ReadingUnit, page: number): Save {
  assertCurrentUnit(save, unit);
  const pages = makeReadingPages(unit);
  if (!integerIn(page, 0, Math.max(0, pages.length - 1))) throw new Error('页码超出当前阅读单元。');
  const questionIndex = pages.findIndex(current => current.kind === 'question');
  if (questionIndex >= 0 && !isQuestionResolved(save, unit.question!) && page > questionIndex) {
    throw new Error('答对当前问题后才能继续阅读。');
  }
  const previous = readingPosition(save, unit);
  const limits = readingLimits(unit);
  const seenPages = pages.slice(0, page + 1);
  const completedParagraphs = new Set<string>();
  const allFragments = pages.flatMap(current => current.kind === 'text' ? current.paragraphs : []);
  for (const shown of seenPages.flatMap(current => current.kind === 'text' ? current.paragraphs : [])) {
    if (!allFragments.some(fragment => fragment.sourceId === shown.sourceId && fragment.fragmentIndex > shown.fragmentIndex)) {
      completedParagraphs.add(shown.sourceId);
    }
  }
  const fullyReadBatches = (paragraphs: readonly Paragraph[]) => {
    const batches = readingBatches(paragraphs);
    const unfinished = batches.findIndex(batch => !batch.every(paragraph => completedParagraphs.has(paragraph.id)));
    return unfinished < 0 ? batches.length : unfinished;
  };
  const before = Math.max(previous.before, fullyReadBatches(unit.paragraphs),
    questionIndex >= 0 && page >= questionIndex ? limits.before : 0);
  const after = Math.max(previous.after, fullyReadBatches(unit.response.slice(unit.replyCount ?? 0)));
  if (save.started && own(save.pages, unit.id) && save.pages[unit.id] === page &&
    previous.before === before && previous.after === after && save.scroll === 0) return save;
  return {
    ...save, started: true,
    chapterProgress: activeProgress(save, unit, 0),
    pages: { ...save.pages, [unit.id]: page },
    reading: { ...save.reading, positions: { ...save.reading.positions, [unit.id]: { before, after } } },
    scroll: 0, updatedAt: new Date().toISOString(),
  };
}

export function readingPosition(save: Save, unit: ReadingUnit): ReadingPosition {
  const limits = readingLimits(unit);
  if (own(save.reading.positions, unit.id)) return { ...save.reading.positions[unit.id] };
  if (isUnitComplete(save, unit)) return limits;
  return {
    before: unit.question && own(save.answers, unit.question.id) ? limits.before : Math.min(1, limits.before),
    after: Math.min(1, limits.after),
  };
}

export function setReadingPosition(save: Save, unit: ReadingUnit, side: 'before' | 'after', count: number): Save {
  assertCurrentUnit(save, unit);
  if (side !== 'before' && side !== 'after') throw new Error('无效的阅读位置。');
  const maximum = readingLimits(unit)[side];
  if (!integerIn(count, Math.min(1, maximum), maximum)) throw new Error('阅读位置超出本段正文。');
  if (side === 'after' && unit.question && !isQuestionResolved(save, unit.question)) {
    throw new Error('答对当前问题后才能继续阅读。');
  }
  const previous = readingPosition(save, unit);
  if (count <= previous[side]) return save;
  return {
    ...save,
    started: true,
    chapterProgress: activeProgress(save, unit),
    reading: { ...save.reading, positions: { ...save.reading.positions, [unit.id]: { ...previous, [side]: count } } },
    updatedAt: new Date().toISOString(),
  };
}

export function setReadingMode(save: Save, mode: ReadingMode, unit?: ReadingUnit): Save {
  if (mode !== 'step' && mode !== 'continuous') throw new Error('无效的阅读方式。');
  if (save.reading.mode === mode) return save;
  let positions = save.reading.positions;
  if (mode === 'step' && save.started && unit) {
    assertCurrentUnit(save, unit);
    const limits = readingLimits(unit);
    // Continuous mode has already shown these batches; changing pace must not hide them.
    const after = !unit.question || isQuestionResolved(save, unit.question)
      ? limits.after
      : readingPosition(save, unit).after;
    positions = { ...positions, [unit.id]: { before: limits.before, after } };
  }
  return { ...save, ...(save.started && unit ? { chapterProgress: activeProgress(save, unit) } : {}), reading: { ...save.reading, mode, positions }, updatedAt: new Date().toISOString() };
}

export function submitAnswer(save: Save, unit: ReadingUnit, choiceId: string | null): Save {
  assertCurrentUnit(save, unit);
  const question = unit.question;
  if (!question) throw new Error('这一段没有需要提交的问题。');
  if (choiceId !== null && !question.options.some(option => option.id === choiceId)) throw new Error('这个选项不属于当前问题。');
  if (isQuestionResolved(save, question)) return save;
  const questionPage = makeReadingPages(unit).findIndex(page => page.kind === 'question');
  if (own(save.pages, unit.id) && save.pages[unit.id] < questionPage) {
    throw new Error('读到当前问题所在页后再选择。');
  }
  const limits = readingLimits(unit);
  if (save.reading.mode === 'step' && readingPosition(save, unit).before < limits.before) {
    throw new Error('读完当前问题之前的正文后再选择。');
  }
  const now = new Date().toISOString();
  return {
    ...save,
    started: true,
    chapterProgress: activeProgress(save, unit),
    answers: own(save.answers, question.id) ? save.answers :
      { ...save.answers, [question.id]: { choiceId, hinted: save.hints.includes(question.id), at: now } },
    resolved: choiceId === question.correctId ? [...save.resolved, question.id] : save.resolved,
    reading: { ...save.reading, positions: {
      ...save.reading.positions, [unit.id]: { ...readingPosition(save, unit), before: limits.before },
    } },
    updatedAt: now,
  };
}

export function useHint(save: Save, unit: ReadingUnit): Save {
  assertCurrentUnit(save, unit);
  const question = unit.question;
  if (!question || own(save.answers, question.id) || save.hints.includes(question.id)) return save;
  return { ...save, started: true, chapterProgress: activeProgress(save, unit), hints: [...save.hints, question.id], updatedAt: new Date().toISOString() };
}

export function advance(save: Save, units: readonly ReadingUnit[]): Save {
  if (!integerIn(save.cursor, 0, units.length - 1) || !integerIn(save.completed, 0, units.length)) return save;
  const unit = units[save.cursor];
  if (!isUnitAccessible(save, unit)) return save;
  if (unit.question && !isQuestionResolved(save, unit.question)) return save;
  if (own(save.pages, unit.id) && save.pages[unit.id] < makeReadingPages(unit).length - 1) return save;
  const position = readingPosition(save, unit);
  const limits = readingLimits(unit);
  if (save.reading.mode === 'step' && (position.before < limits.before || position.after < limits.after)) return save;
  const progress = getChapterProgress(save, unit.chapter.id);
  const local = localUnitIndex(unit);
  const count = chapterUnits(unit).length;
  if (progress.completed === count && local === count - 1) return save;
  const completed = Math.max(progress.completed, local + 1);
  const cursor = local === count - 1 ? unit.index : unit.index + 1;
  return {
    ...save,
    started: true,
    cursor,
    completed: save.completed + completed - progress.completed,
    chapterProgress: { ...save.chapterProgress, [unit.chapter.id]: { completed, cursor, started: true, scroll: 0 } },
    reading: { ...save.reading, positions: { ...save.reading.positions, [unit.id]: limits } },
    scroll: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function navigate(save: Save, units: readonly ReadingUnit[], index: number): Save {
  if (!integerIn(index, 0, units.length - 1) || !isUnitAccessible(save, units[index])) return save;
  const unit = units[index];
  const current = units[save.cursor];
  const outgoing = current && save.started ? activeProgress(save, current) : save.chapterProgress;
  return { ...save, started: true, cursor: index, scroll: 0,
    chapterProgress: { ...outgoing, [unit.chapter.id]: { ...getChapterProgress(save, unit.chapter.id), cursor: index, started: true, scroll: 0 } },
    updatedAt: new Date().toISOString() };
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

export function recordReview(save: Save, units: readonly ReadingUnit[], questionId: string, choiceId: string | null): Save {
  const unit = units.find(current => current.question?.id === questionId);
  const question = unit?.question;
  if (!unit || !question || !isUnitAccessible(save, unit) || !own(save.answers, questionId)) {
    throw new Error('只能重温已经作答的问题。');
  }
  if (choiceId !== null && !question.options.some(option => option.id === choiceId)) {
    throw new Error('这个选项不属于当前问题。');
  }
  const previous = own(save.reviews, questionId) ? save.reviews[questionId] : undefined;
  if (previous && previous.attempts >= 1_000_000) throw new Error('本题复习记录已达到上限。');
  const now = new Date().toISOString();
  return {
    ...save,
    reviews: { ...save.reviews, [questionId]: {
      attempts: (previous?.attempts ?? 0) + 1,
      correct: (previous?.correct ?? 0) + Number(choiceId === question.correctId),
      lastChoiceId: choiceId,
      at: now,
    } },
    updatedAt: now,
  };
}

function needsReview(save: Save, question: Question): boolean {
  return own(save.answers, question.id) && save.answers[question.id].choiceId !== question.correctId &&
    (!own(save.reviews, question.id) || save.reviews[question.id].correct === 0);
}

export function reviewQueue(units: readonly ReadingUnit[], save: Save, limit = 5, chapterId?: string): string[] {
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const candidates = units.filter(unit => isUnitAccessible(save, unit) && unit.question &&
    own(save.answers, unit.question.id) && (chapterId === undefined || unit.chapter.id === chapterId));
  candidates.sort((left, right) => {
    const first = left.question!;
    const second = right.question!;
    const firstReview = own(save.reviews, first.id) ? save.reviews[first.id] : undefined;
    const secondReview = own(save.reviews, second.id) ? save.reviews[second.id] : undefined;
    return Number(needsReview(save, second)) - Number(needsReview(save, first)) ||
      (firstReview?.attempts ?? 0) - (secondReview?.attempts ?? 0) ||
      (firstReview?.at ?? '').localeCompare(secondReview?.at ?? '') || left.index - right.index;
  });
  return [...new Set(candidates.map(unit => unit.question!.id))].slice(0, Math.min(limit, 5));
}

export function progressStats(units: readonly ReadingUnit[], save: Save) {
  const stats = { answered: 0, correct: 0, reviewed: 0, remainingReview: 0, total: 0 };
  for (const unit of units) {
    const question = unit.question;
    if (!question) continue;
    stats.total++;
    if (!own(save.answers, question.id)) continue;
    stats.answered++;
    if (save.answers[question.id].choiceId === question.correctId) stats.correct++;
    if (own(save.reviews, question.id)) stats.reviewed++;
    if (needsReview(save, question)) stats.remainingReview++;
  }
  return stats;
}
