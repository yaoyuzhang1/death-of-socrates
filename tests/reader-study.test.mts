import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerStudy, studyOrder, validateStudyRecords, type LearningCheckData } from '../src/reader/learning.ts';
import { createReadingBackup, readReadingBackup } from '../src/reader/reading-backup.ts';
import { createSave, enterChapter, flattenCorpus, setPagePosition } from '../src/reader/engine.ts';
import type { Corpus } from '../src/reader/model.ts';
const corpus: Corpus = JSON.parse(readFileSync('reader-public/text/republic.json', 'utf8'));
const checks: LearningCheckData[] = ['content/learning/checks.json', 'content/bonus/checks.json'].flatMap(path => JSON.parse(readFileSync(path, 'utf8')));
const check = checks[0], wrong = check.options.find(option => option.id !== check.correctId)!.id;

test('wrong attempts survive reload; correcting and practising preserve the first choice', () => {
  const first = answerStudy({}, check, wrong);
  assert.equal(first[check.id].correct, false);
  const second = answerStudy(validateStudyRecords(JSON.parse(JSON.stringify(first)), checks)!, check, check.correctId);
  const third = answerStudy(second, check, wrong);
  assert.deepEqual(third[check.id], { firstChoiceId: wrong, lastChoiceId: wrong, attempts: 3, correct: true });
  assert.ok(validateStudyRecords(third, checks));
  assert.equal(first[check.id].attempts, 1);
  assert.throws(() => answerStudy(first, check, 'unavailable'));
});
test('study imports reject unknown questions, invalid options and impossible histories', () => {
  const good = answerStudy({}, check, wrong);
  for (const field of [{ attempts: 0 }, { attempts: 1.5 }, { attempts: 100001 }, { correct: 'true' }, { correct: true }, { attempts: 2, correct: true }, { firstChoiceId: 'invalid' }, { lastChoiceId: check.correctId }, { extra: true }]) {
    assert.equal(validateStudyRecords({ [check.id]: { ...good[check.id], ...field } }, checks), null, JSON.stringify(field));
  }
  assert.equal(validateStudyRecords({ unknown: good[check.id] }, checks), null);
  assert.equal(validateStudyRecords([], checks), null);
  assert.deepEqual(validateStudyRecords({}, checks), {});
});
test('question order remains stable after reload, without placing every answer in the same slot', () => {
  const positions = new Set<number>();
  for (const item of checks) {
    assert.deepEqual(studyOrder(item), studyOrder(structuredClone(item)));
    assert.deepEqual(studyOrder(item).map(o => o.id).sort(), item.options.map(o => o.id).sort());
    positions.add(studyOrder(item).findIndex(o => o.id === item.correctId));
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2]);
});
test('new backups restore reading and study together; malformed companion cannot partially restore', () => {
  let reading = enterChapter(createSave(corpus, 'study-backup-test'), flattenCorpus(corpus), 'soul');
  reading = setPagePosition(reading, flattenCorpus(corpus)[reading.cursor], 1);
  const study = answerStudy({}, check, wrong);
  const backup = createReadingBackup(reading, study);
  assert.deepEqual(readReadingBackup(JSON.parse(JSON.stringify(backup)), corpus, checks), { reading, study });
  const before = JSON.stringify(backup);
  assert.throws(() => readReadingBackup({ ...backup, study: { unknown: study[check.id] } }, corpus, checks));
  assert.throws(() => readReadingBackup({ ...backup, reading: { ...reading, editionId: 'another-book' } }, corpus, checks));
  assert.equal(JSON.stringify(backup), before);
  assert.equal(readReadingBackup(reading, corpus, checks).study, null);
  assert.throws(() => readReadingBackup({ ...backup, version: 2 }, corpus, checks));
});
