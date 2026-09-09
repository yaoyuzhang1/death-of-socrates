import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw, Volume2, Square, X } from 'lucide-react';
import type { Question } from './model.ts';
import { orderedOptions } from './engine.ts';
import QuestionChoices from './QuestionChoices.tsx';
import { playFeedback, stopFeedback, subscribeFeedback } from './feedback-audio.ts';
import './challenge.css';

export type AudioPreferences = { sound: boolean; voice: boolean };
export default function QuestionChallenge({ question, seed, resolved = false, onAttempt, onContinue, continueLabel = '继续读原文', audio, testIdPrefix, onRetry }: {
  question: Question; seed: string; resolved?: boolean; onAttempt: (choiceId: string) => void;
  onContinue: () => void; continueLabel?: string; audio: AudioPreferences; testIdPrefix?: string; onRetry?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [audioState, setAudioState] = useState<{ status: string; key: string | null; message?: string }>({ status: 'idle', key: null });
  const resultRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const locked = useRef(false);
  const options = orderedOptions(question, seed);
  const showingResult = attempt !== null || (resolved && !retrying);
  const correct = attempt !== null ? attempt === question.correctId : resolved;
  const choiceId = attempt ?? question.correctId;
  const chosen = question.options.find(option => option.id === choiceId)!;
  const explanation = correct ? question.explanation : chosen.feedback;
  const activeAudio = audioState.key === `${question.id}--${choiceId}` && audioState.status === 'playing';

  useEffect(() => subscribeFeedback(setAudioState), []);
  useEffect(() => () => stopFeedback(), []);
  useEffect(() => { if (attempt !== null) { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); } }, [attempt]);

  const choose = (id: string) => {
    if (locked.current || showingResult) return;
    locked.current = true;
    onAttempt(id);
    setAttempt(id);
    setSelected(null);
    playFeedback(question, id, audio);
  };
  const retry = () => {
    stopFeedback();
    locked.current = false;
    setAttempt(null);
    setRetrying(true);
    setSelected(null);
    onRetry?.();
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      sectionRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
  };
  return <section className={`question challenge ${showingResult ? 'is-revealed' : ''}`} ref={sectionRef} data-question-id={question.id} aria-label="选择苏格拉底的追问">
    <div className="question-kicker">停一停，想一问 <span>{question.sourceRef}</span></div>
    {!showingResult ? <><h2>{question.prompt}</h2><p className="choice-caption">选中后确认。答错可以重新想一想。</p>
      <QuestionChoices questionId={question.id} options={options} selected={selected} onSelect={setSelected} onConfirm={choose} testIdPrefix={testIdPrefix} />
    </> : <div className={`answer-feedback ${correct ? 'feedback-correct' : 'feedback-wrong'} ${attempt ? 'feedback-animate' : ''}`} ref={resultRef} tabIndex={-1} role="status" data-testid={testIdPrefix ? `${testIdPrefix}-result` : 'answer-result'}>
      <div className="feedback-heading"><span className="feedback-symbol" aria-hidden="true">{correct ? <Check size={27} /> : <X size={27} />}</span><div><h2>{attempt ? correct ? '答对了' : '这次没有选对' : '这一问已完成'}</h2><p>{correct ? '这一问检验了本段讨论中的关键一步。' : '比较这个问法能澄清什么，再试一次。'}</p></div></div>
      <details className="submitted-choice"><summary>查看{attempt ? '刚才的选择' : '原问'}</summary><p>{chosen.text}</p></details>
      <div className="feedback-explanation" data-testid={testIdPrefix ? `${testIdPrefix}-explanation` : 'feedback-explanation'}><h3>{correct ? '在本段中，为什么这一问更好' : '这个选项的解释'}</h3><p>{explanation}</p></div>
      <div className="feedback-audio"><button className="text-button" disabled={!audio.voice} onClick={() => activeAudio ? stopFeedback() : playFeedback(question, choiceId, { sound: false, voice: true })}>{activeAudio ? <Square size={15} /> : <Volume2 size={17} />}{activeAudio ? '停止朗读' : '重听解释'}</button><span>{!audio.voice ? '解释配音已关闭' : audioState.key === `${question.id}--${choiceId}` && (audioState.status === 'blocked' || audioState.status === 'error') ? audioState.message || '点击重听解释，再试一次' : '标准普通话'}</span></div>
      {correct && <details className="other-comparisons"><summary>对照另外两个问法</summary>{options.filter(option => option.id !== question.correctId).map(option => <div key={option.id}><p>{option.text}</p><p>{option.feedback}</p></div>)}</details>}
      <div className="feedback-actions">{correct ? <><button className="text-button" onClick={retry}><RotateCcw size={15} />再练一次</button><button className="primary" onClick={() => { stopFeedback(); onContinue(); }} data-testid={testIdPrefix ? `${testIdPrefix}-next` : 'question-continue'}>{continueLabel}<ArrowRight size={18} /></button></> : <button className="primary retry-answer" onClick={retry} data-testid="retry-answer"><RotateCcw size={18} />再试一次</button>}</div>
    </div>}
  </section>;
}
