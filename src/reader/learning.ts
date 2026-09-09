export type LearningCheckData = {
  id: string; chapterId?: string; sceneId?: string; pageId?: string; sourceIds?: string[];
  prompt: string; options: { id: string; text: string; feedback: string }[];
  correctId: string; explanation: string; sourceRef: string; sourceUrl?: string;
};
export type StudyRecord = { firstChoiceId: string; lastChoiceId: string; attempts: number; correct: boolean };
export type StudyRecords = Record<string, StudyRecord>;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export function validateStudyRecords(input: unknown, checks: readonly LearningCheckData[]): StudyRecords | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const result: StudyRecords = {};
  if (Reflect.ownKeys(data).length > checks.length) return null;
  for (const id of Reflect.ownKeys(data)) {
    if (typeof id !== 'string') return null;
    const check = checks.find(item => item.id === id), raw = data[id];
    if (!check || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as StudyRecord;
    if (Reflect.ownKeys(record).length !== 4 || !['firstChoiceId', 'lastChoiceId', 'attempts', 'correct'].every(key => own(record, key)) ||
      !check.options.some(option => option.id === record.firstChoiceId) || !check.options.some(option => option.id === record.lastChoiceId) ||
      !Number.isInteger(record.attempts) || record.attempts < 1 || record.attempts > 100_000 || typeof record.correct !== 'boolean' ||
      (record.attempts === 1 && record.firstChoiceId !== record.lastChoiceId) ||
      (record.attempts < 3 && record.correct && record.firstChoiceId !== check.correctId && record.lastChoiceId !== check.correctId) ||
      (!record.correct && (record.lastChoiceId === check.correctId || record.firstChoiceId === check.correctId))) return null;
    result[id] = { firstChoiceId: record.firstChoiceId, lastChoiceId: record.lastChoiceId, attempts: record.attempts, correct: record.correct };
  }
  return result;
}

export function answerStudy(records: StudyRecords, check: LearningCheckData, choiceId: string): StudyRecords {
  if (!check.options.some(option => option.id === choiceId)) throw new Error('这项选择不属于当前理解检查。');
  const old = own(records, check.id) ? records[check.id] : undefined;
  return { ...records, [check.id]: {
    firstChoiceId: old?.firstChoiceId ?? choiceId, lastChoiceId: choiceId,
    attempts: Math.min(100_000, (old?.attempts ?? 0) + 1), correct: Boolean(old?.correct || choiceId === check.correctId),
  } };
}

export function studyOrder(check: LearningCheckData): LearningCheckData['options'] {
  let hash = 2166136261;
  for (const character of check.id) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  const result = [...check.options];
  for (let index = result.length - 1; index > 0; index--) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const swap = hash % (index + 1); [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
