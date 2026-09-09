import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { flattenCorpus } from './engine.ts';
import type { Corpus, ReadingUnit, Save } from './model.ts';
import QuestionChallenge, { type AudioPreferences } from './QuestionChallenge.tsx';
import ReadingPassage, { passageRoles } from './ReadingPassage.tsx';
import ComicScene from './ComicScene.tsx';
import { makeReadingPages } from './pagination.ts';
import { stopFeedback } from './feedback-audio.ts';
import './review.css';

export type ReviewRoundProps = {
  corpus: Corpus; save: Save; questionIds: string[];
  onAnswer: (questionId: string, choiceId: string | null) => void;
  onClose: () => void; returnLabel?: string; audio: AudioPreferences;
};
type RoundAnswer = { questionId: string; choiceId: string; correct: boolean };
type Round = { units: ReadingUnit[]; index: number; answers: RoundAnswer[]; seed: string };
const newRound = (units: ReadingUnit[]): Round => ({ units, index: 0, answers: [], seed: crypto.randomUUID().slice(0, 16) });

export default function ReviewRound({ corpus, save, questionIds, onAnswer, onClose, returnLabel = '返回阅读', audio }: ReviewRoundProps) {
  const [round, setRound] = useState(() => {
    const units = flattenCorpus(corpus);
    return newRound([...new Set(questionIds)].flatMap(id => {
      const unit = units.find(unit => unit.question?.id === id);
      return unit && Object.prototype.hasOwnProperty.call(save.answers, id) ? [unit] : [];
    }).slice(0, 5));
  });
  const [passed, setPassed] = useState(false);
  const [stage, setStage] = useState<'question' | 'original'>('question');
  const [originalIndex, setOriginalIndex] = useState(0);
  const [contextIndex, setContextIndex] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const unit = round.units[round.index];
  const question = unit?.question;
  const roles = passageRoles(corpus);
  const finished = round.index >= round.units.length;
  useEffect(() => {
    stopFeedback();
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [round.seed, round.index, stage, originalIndex]);
  useEffect(() => () => stopFeedback(), []);

  const choose = (choiceId: string) => {
    if (!question || passed) return;
    if (!round.answers[round.index]) setRound(current => ({ ...current, answers: [...current.answers, { questionId: question.id, choiceId, correct: choiceId === question.correctId }] }));
    setPassed(choiceId === question.correctId);
    onAnswer(question.id, choiceId);
  };
  const next = () => {
    if (!passed) return;
    setRound(current => ({ ...current, index: current.index + 1 }));
    setPassed(false); setStage('question'); setOriginalIndex(0); setContextIndex(0);
  };
  const retry = () => {
    const missed = new Set(round.answers.filter(answer => !answer.correct).map(answer => answer.questionId));
    setRound(newRound(round.units.filter(unit => unit.question && missed.has(unit.question.id))));
    setPassed(false); setStage('question'); setOriginalIndex(0); setContextIndex(0);
  };
  if (finished || !question) {
    const correct = round.answers.filter(answer => answer.correct).length;
    const missed = round.answers.length - correct;
    return <main id="main" className="review-round reading-shell" ref={mainRef} tabIndex={-1} data-testid="review-complete">
      <p className="eyebrow">一轮复习</p><h1>{round.units.length ? '这一轮已完成' : '还没有可复习的提问'}</h1>
      {round.units.length > 0 && <><div className="review-round-score"><p>本轮一次选对</p><strong data-testid="review-score">{correct}<span> / {round.units.length}</span></strong></div><p className="review-round-note">本轮每一问都已选对。首次选择与重答过程分别保留。</p></>}
      <div className="review-round-end-actions">{missed > 0 && <button className="primary" onClick={retry} data-testid="review-retry"><RotateCcw size={17} />再练需要重答的 {missed} 问</button>}<button onClick={onClose} data-testid="review-close"><ArrowLeft size={17} />{returnLabel}</button></div>
    </main>;
  }
  const contextPages = makeReadingPages({ id: unit.id + '-context', paragraphs: unit.paragraphs, response: [] }).filter(page => page.kind === 'text');
  const originalPages = makeReadingPages({ id: unit.id + '-original', paragraphs: [question.original, ...unit.response.slice(0, unit.replyCount ?? 0)], response: [] }).filter(page => page.kind === 'text');
  const currentOriginal = originalPages[originalIndex];
  const mainOriginalPage = currentOriginal ? makeReadingPages(unit).find(page => page.kind === 'text' && page.side === 'after' && page.paragraphs.some(fragment => fragment.sourceId === currentOriginal.paragraphs[0]?.sourceId && fragment.fragmentIndex === currentOriginal.paragraphs[0]?.fragmentIndex)) : undefined;
  const showOriginal = () => { setStage('original'); setOriginalIndex(0); };
  return <main id="main" className="review-round reading-shell paged-reading" ref={mainRef} tabIndex={-1} data-testid="review-round" data-review-round={round.seed}>
    <div className="review-round-top"><h1 className="eyebrow">一轮复习 <span data-testid="review-progress">{round.index + 1} / {round.units.length}</span></h1><button className="text-button" onClick={onClose} data-testid="review-close"><ArrowLeft size={16} />{returnLabel}</button></div>
    <progress className="review-round-progress" value={round.index} max={round.units.length} aria-label={`本轮已完成 ${round.index} 问，共 ${round.units.length} 问`} />
    <p className="review-round-location">{unit.chapter.title} · {unit.section.title}<span>{question.sourceRef}</span></p>
    <ComicScene chapterId={unit.chapter.id} pageId={stage === 'question' ? `${unit.id}-question` : mainOriginalPage?.id} compact conversationOnly />
    {stage === 'question' ? <>
      <details className="review-round-context" key={round.seed + question.id} data-testid="review-context"><summary>回看这段原文</summary><div className="reading-text">
        {contextPages[contextIndex]?.paragraphs.map(fragment => <ReadingPassage key={fragment.id} paragraph={fragment} role={roles.get(fragment.sourceId)} sourceId={fragment.sourceId} continuation={fragment.fragmentIndex > 0} showSource={false} />)}
        {!contextPages.length && <p className="review-round-note">这段从这一问开始。</p>}
        {contextPages.length > 1 && <div className="context-pagination"><button disabled={contextIndex === 0} onClick={() => setContextIndex(value => value - 1)}>上一页</button><span>{contextIndex + 1} / {contextPages.length}</span><button disabled={contextIndex === contextPages.length - 1} onClick={() => setContextIndex(value => value + 1)}>下一页</button></div>}
      </div></details>
      <QuestionChallenge key={round.seed + question.id} question={question} seed={`${save.seed.slice(0, 100)}review${round.seed}`} resolved={passed} onAttempt={choose} onContinue={showOriginal} audio={audio} onRetry={() => setPassed(false)} continueLabel="对照原问与回应" testIdPrefix="review" />
    </> : <><div className="page-position"><span>原问与回应</span><span>{originalIndex + 1} / {originalPages.length} 页</span></div><div className="reading-text" data-testid="review-original-reply">{currentOriginal.paragraphs.map(fragment => <ReadingPassage key={fragment.id} paragraph={fragment} sourceId={fragment.sourceId} continuation={fragment.fragmentIndex > 0} role={roles.get(fragment.sourceId)} />)}</div>
      <div className="reading-navigation page-navigation"><button className="text-button" onClick={() => originalIndex ? setOriginalIndex(value => value - 1) : setStage('question')}><ArrowLeft size={16} />{originalIndex ? '上一页' : '回看解释'}</button>{originalIndex < originalPages.length - 1 ? <button className="primary" onClick={() => setOriginalIndex(value => value + 1)}>下一页<ArrowRight size={17} /></button> : <button className="primary" onClick={next} data-testid="review-next">{round.index + 1 === round.units.length ? '查看本轮结果' : '下一问'}<ArrowRight size={17} /></button>}</div>
    </>}
  </main>;
}
