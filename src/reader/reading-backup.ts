import type { Corpus, Save } from './model.ts';
import { validateSave } from './engine.ts';
import { validateStudyRecords, type LearningCheckData, type StudyRecords } from './learning.ts';

export function createReadingBackup(reading: Save, study: StudyRecords) {
  return { format: 'republic-reading-backup', version: 1, reading, study };
}

export function readReadingBackup(input: unknown, corpus: Corpus, checks: readonly LearningCheckData[]) {
  const value = input as ReturnType<typeof createReadingBackup> | null;
  const bundled = value?.format === 'republic-reading-backup';
  const study = bundled && value.version === 1 ? validateStudyRecords(value.study, checks) : null;
  if (bundled && !study) throw new Error('理解检查的备份记录无效。');
  const reading = validateSave(bundled ? value.reading : input, corpus);
  if (!reading) throw new Error('这不是与当前正文匹配的有效进度文件。');
  return { reading, study };
}
