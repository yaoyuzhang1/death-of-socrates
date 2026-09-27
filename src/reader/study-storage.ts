import { validateStudyRecords, type LearningCheckData, type StudyRecords } from './learning.ts';

export const FULL_REPUBLIC_EDITION = 'republic-guo-zhang-1986-full-2026-09-27';
export const PREVIOUS_REPUBLIC_EDITION = 'republic-guo-zhang-1986-2026-09-09';

export function isStudyEditionCompatible(stored: unknown, current: string): boolean {
  return stored === current || current === FULL_REPUBLIC_EDITION && stored === PREVIOUS_REPUBLIC_EDITION;
}

/** Only the known eight-chapter edition is allowed to migrate into the complete edition. */
export function readStoredStudy(input: unknown, editionId: string, checks: readonly LearningCheckData[]): StudyRecords | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const stored = input as { version?: unknown; editionId?: unknown; records?: unknown };
  if (stored.version !== 1 || !isStudyEditionCompatible(stored.editionId, editionId)) return null;
  return validateStudyRecords(stored.records, checks);
}
