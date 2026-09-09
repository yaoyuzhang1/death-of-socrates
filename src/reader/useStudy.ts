import { useEffect, useRef, useState } from 'react';
import checks from '../../content/learning/checks.json';
import bonusChecks from '../../content/bonus/checks.json';
import { answerStudy, validateStudyRecords, type LearningCheckData, type StudyRecords } from './learning.ts';
export const ALL_STUDY_CHECKS: LearningCheckData[] = [...checks, ...bonusChecks];
export const STUDY_STORAGE = 'republic-study-v1';
export const PREVIEW_STUDY_STORAGE = 'republic-bonus-preview-study-v1';
export type StudyController = { records: StudyRecords; ready: boolean; notice: string; answer: (check: LearningCheckData, choiceId: string) => void; replace: (records: StudyRecords) => void; reset: () => void };

export default function useStudy(editionId: string | undefined, preview = false): StudyController {
  const key = preview ? PREVIEW_STUDY_STORAGE : STUDY_STORAGE;
  const [value, setValue] = useState<{ editionId?: string; records: StudyRecords }>({ records: {} });
  const [notice, setNotice] = useState('');
  const current = useRef(value); current.current = value;
  useEffect(() => {
    if (!editionId) return;
    let records: StudyRecords = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        const valid = stored.version === 1 && stored.editionId === editionId ? validateStudyRecords(stored.records, ALL_STUDY_CHECKS) : null;
        if (valid) records = valid; else setNotice('理解检查的记录暂时无法恢复，原有阅读与首次作答不受影响。');
      }
    } catch { setNotice('浏览器暂时无法读取理解检查记录。'); }
    const loaded = { editionId, records }; current.current = loaded; setValue(loaded);
  }, [editionId, key]);
  const replace = (records: StudyRecords) => {
    if (!editionId || current.current.editionId !== editionId) return;
    const next = { editionId, records }; current.current = next; setValue(next);
    try { localStorage.setItem(key, JSON.stringify({ version: 1, ...next })); }
    catch { setNotice('理解检查记录暂存于本次页面，请在关闭前导出进度。'); }
  };
  return { records: value.editionId === editionId ? value.records : {}, ready: Boolean(editionId && value.editionId === editionId), notice,
    answer: (check, choiceId) => replace(answerStudy(current.current.records, check, choiceId)), replace, reset: () => replace({}) };
}
