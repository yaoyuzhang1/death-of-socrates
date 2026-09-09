import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Square, Volume2, X } from 'lucide-react';
import { studyOrder, type LearningCheckData, type StudyRecord } from './learning.ts';
import { playRecordedFeedback, stopFeedback, subscribeFeedback, type FeedbackAudioState } from './feedback-audio.ts';
import type { AudioPreferences } from './QuestionChallenge.tsx';
import recordingManifest from '../../reader-public/audio/study/manifest.json';
import './learning.css';

const recordedKeys = new Set((recordingManifest.entries as { key: string }[]).map(entry => entry.key));

export default function LearningCheck({ check, record, onAnswer, audio }: {
  check: LearningCheckData; record?: StudyRecord; onAnswer: (choiceId: string) => void; audio: AudioPreferences;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [voice, setVoice] = useState<FeedbackAudioState>({ status: 'idle', key: null });
  const [run, setRun] = useState(0);
  const locked = useRef(false), result = useRef<HTMLDivElement>(null), choices = useRef<HTMLFieldSetElement>(null);
  const options = studyOrder(check);
  const showing = attempt !== null || (Boolean(record?.correct) && !retrying);
  const correct = attempt ? attempt === check.correctId : Boolean(record?.correct);
  const choiceId = attempt ?? check.correctId;
  const explanation = correct ? check.explanation : check.options.find(option => option.id === choiceId)!.feedback;
  const audioKey = `study:${check.id}--${choiceId}`;
  const recorded = recordedKeys.has(`${check.id}--${choiceId}`);
  const isPlaying = voice.key === audioKey && voice.status === 'playing';
  useEffect(() => subscribeFeedback(setVoice), []);
  useEffect(() => () => stopFeedback(), []);
  useEffect(() => { if (!audio.voice && !audio.sound) stopFeedback(); }, [audio.voice, audio.sound]);
  const play = (id: string, cue: boolean) => playRecordedFeedback(`study:${check.id}--${id}`, `${import.meta.env.BASE_URL}audio/study/${encodeURIComponent(check.id)}--${encodeURIComponent(id)}.mp3`, id === check.correctId, { ...audio, voice: audio.voice && recordedKeys.has(`${check.id}--${id}`), sound: cue && audio.sound });
  const confirm = () => {
    if (!selected || locked.current || showing) return;
    locked.current = true; onAnswer(selected); setAttempt(selected); setSelected(null); setRun(n => n + 1); play(selected, true);
    requestAnimationFrame(() => { result.current?.focus({ preventScroll: true }); result.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); });
  };
  const retry = () => { stopFeedback(); locked.current = false; setAttempt(null); setRetrying(true); setSelected(null); requestAnimationFrame(() => choices.current?.querySelector<HTMLInputElement>('input')?.focus()); };
  return <section className="learning-check" data-testid="learning-check" data-check-id={check.id} aria-labelledby={`prompt-${check.id}`}>
    <p className="eyebrow">{check.sceneId ? '你的判断' : '读到这里 · 理解检查'}<span>依据刚才的文本作答</span></p><h2 id={`prompt-${check.id}`}>{check.prompt}</h2>
    {!showing ? <><fieldset ref={choices} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) { event.preventDefault(); setSelected(options[index].id); choices.current?.querySelectorAll<HTMLInputElement>('input')[index]?.focus({ preventScroll: true }); }
      else if (event.key === 'Enter') { event.preventDefault(); confirm(); }
    }}><legend className="sr-only">选择符合已读文本的理解</legend>{options.map((option, index) => <label className={`study-option${selected === option.id ? ' selected' : ''}`} key={option.id}><input type="radio" name={check.id} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} /><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option.text}</span></label>)}</fieldset>
    <div className="study-confirm"><span>{selected ? '确认前还可以修改' : '选一个理解，再确认'}</span><button className="primary" disabled={!selected} onClick={confirm} data-testid="study-confirm">确认判断</button></div></> : <div className={`study-result ${correct ? 'study-correct' : 'study-wrong'}${attempt ? ' study-animate' : ''}`} key={run} ref={result} tabIndex={-1} role="status" data-testid="study-result">
      <div className="study-result-heading"><span aria-hidden="true">{correct ? <Check size={25} /> : <X size={25} />}</span><h3>{correct ? attempt ? '理解正确' : '这处已读懂' : '再对照一下文本'}</h3></div>
      <p>{explanation}</p><div className="study-feedback-tools">{recorded && <button className="text-button" disabled={!audio.voice} onClick={() => isPlaying ? stopFeedback() : play(choiceId, false)}>{isPlaying ? <Square size={15} /> : <Volume2 size={16} />}{isPlaying ? '停止朗读' : '重听解释'}</button>}<span>{!recorded ? '文字解释 · 配有答题提示音' : !audio.voice ? '配音已关闭' : voice.key === audioKey && (voice.status === 'error' || voice.status === 'blocked') ? '录音暂时无法播放，可重试。' : '标准普通话'}</span></div>
      {!correct ? <button className="primary" onClick={retry} data-testid="study-retry"><RotateCcw size={16} />再想一次</button> : <button className="text-button" onClick={retry}>再练一次</button>}
    </div>}
    <p className="study-source">{check.sourceUrl ? <a href={check.sourceUrl} target="_blank" rel="noreferrer">原作位置：{check.sourceRef} ↗</a> : `原文位置：${check.sourceRef}`}{record && <span>首次选择已保留 · 已尝试 {record.attempts} 次</span>}</p>
  </section>;
}
