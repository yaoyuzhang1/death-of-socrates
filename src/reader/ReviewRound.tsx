import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { flattenCorpus, orderedOptions } from './engine.ts';
import type { Corpus, Paragraph, ReadingUnit, Save } from './model.ts';
import './review.css';

export type ReviewRoundProps = {
  corpus: Corpus;
  save: Save;
  questionIds: string[];
  onAnswer: (questionId: string, choiceId: string | null) => void;
  onClose: () => void;
};

type RoundAnswer = { questionId: string; choiceId: string | null; correct: boolean };
type Round = { units: ReadingUnit[]; index: number; answers: RoundAnswer[]; seed: string };

function newRound(units: ReadingUnit[]): Round {
  return { units, index: 0, answers: [], seed: crypto.randomUUID().slice(0, 16) };
}

function initialUnits(corpus: Corpus, save: Save, questionIds: string[]) {
  const known = new Map(flattenCorpus(corpus).flatMap(unit => unit.question ? [[unit.question.id, unit] as const] : []));
  return [...new Set(questionIds)]
    .filter(id => Object.prototype.hasOwnProperty.call(save.answers, id) && known.has(id))
    .slice(0, 5)
    .map(id => known.get(id)!);
}

function SourcePages({ paragraph }: { paragraph: Paragraph }) {
  const pages = paragraph.sourcePages ?? (paragraph.sourcePage ? [paragraph.sourcePage] : []);
  return <>{pages.map(page => <a key={page} className="source-page" href={`${import.meta.env.BASE_URL}text/parallel.html#p${page}`} target="_blank" rel="noreferrer" title="查看书页与译者注（含本页后文）">书页 {page} ↗</a>)}</>;
}

function Passage({ paragraph, showSource = false }: { paragraph: Paragraph; showSource?: boolean }) {
  return <div className="passage" data-paragraph-id={paragraph.id}>
    {(paragraph.speaker || paragraph.ref || (showSource && (paragraph.sourcePage || paragraph.sourcePages?.length))) && <div className="speaker">{paragraph.speaker}{paragraph.ref && <span>{paragraph.ref}</span>}{showSource && <SourcePages paragraph={paragraph} />}</div>}
    <p>{paragraph.text}</p>
  </div>;
}

export default function ReviewRound({ corpus, save, questionIds, onAnswer, onClose }: ReviewRoundProps) {
  // The queue stays fixed while a parent saves each review answer.
  const [round, setRound] = useState(() => newRound(initialUnits(corpus, save, questionIds)));
  const [selected, setSelected] = useState<string | null>(null);
  const answered = useRef(new Set<string>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const unit = round.units[round.index];
  const question = unit?.question;
  const answer = round.answers[round.index];
  const finished = round.index >= round.units.length;

  useEffect(() => {
    const target = answer ? resultRef.current : headingRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [round.seed, round.index, !!answer]);

  const choose = (choiceId: string | null) => {
    if (!question || answer || (choiceId !== null && !question.options.some(option => option.id === choiceId))) return;
    const key = `${round.seed}:${round.index}`;
    if (answered.current.has(key)) return;
    answered.current.add(key);
    const result = { questionId: question.id, choiceId, correct: choiceId === question.correctId };
    setRound(current => ({ ...current, answers: [...current.answers, result] }));
    setSelected(null);
    onAnswer(question.id, choiceId);
  };

  const next = () => {
    if (!answer) return;
    setRound(current => current.index === round.index ? { ...current, index: current.index + 1 } : current);
    setSelected(null);
  };

  const retry = () => {
    const missed = new Set(round.answers.filter(result => !result.correct).map(result => result.questionId));
    setRound(newRound(round.units.filter(item => item.question && missed.has(item.question.id))));
    setSelected(null);
  };

  if (!round.units.length) return <main id="main" className="review-round reading-shell" data-testid="review-empty">
    <h1 ref={headingRef} tabIndex={-1}>还没有可复习的提问</h1>
    <p>阅读并完成提问后，可以在这里再试一次。</p>
    <button className="primary" onClick={onClose}><ArrowLeft size={17} />返回阅读</button>
  </main>;

  if (finished) {
    const correct = round.answers.filter(result => result.correct).length;
    const missed = round.answers.length - correct;
    return <main id="main" className="review-round reading-shell" data-testid="review-complete">
      <p className="eyebrow">一轮复习</p>
      <h1 ref={headingRef} tabIndex={-1}>这一轮已完成</h1>
      <div className="review-round-score" role="status"><p>本轮答对</p><strong data-testid="review-score">{correct}<span> / {round.units.length}</span></strong></div>
      <p className="review-round-note">可以接着阅读；首次选择和阅读位置都已保留。</p>
      <div className="review-round-end-actions">
        {missed > 0 && <button className="primary" onClick={retry} data-testid="review-retry"><RotateCcw size={17} />再练未选中的 {missed} 问</button>}
        <button className={missed ? '' : 'primary'} onClick={onClose} data-testid="review-close"><ArrowLeft size={17} />返回阅读</button>
      </div>
    </main>;
  }

  if (!question) return null;
  // Leave room for the review seed even when an imported save uses a 128-character seed.
  const options = orderedOptions(question, `${save.seed.slice(0, 100)}review${round.seed}`);
  return <main id="main" className="review-round reading-shell" data-testid="review-round" data-review-round={round.seed}>
    <div className="review-round-top">
      <h1 className="eyebrow" ref={headingRef} tabIndex={-1}>一轮复习 <span data-testid="review-progress">{round.index + 1} / {round.units.length}</span></h1>
      <button className="text-button" onClick={onClose} data-testid="review-close"><ArrowLeft size={16} />返回阅读</button>
    </div>
    <progress className="review-round-progress" value={round.answers.length} max={round.units.length} aria-label={`本轮已完成 ${round.answers.length} 问，共 ${round.units.length} 问`} />
    <p className="review-round-location">{unit.chapter.title} · {unit.section.title}<span>{question.sourceRef}</span></p>
    <details className="review-round-context" key={`${round.seed}:${question.id}`} data-testid="review-context">
      <summary>回看这段原文</summary>
      <div className="reading-text">{unit.paragraphs.length ? unit.paragraphs.map(paragraph => <Passage key={paragraph.id} paragraph={paragraph} />) : <p className="review-round-note">这段从这一问开始。</p>}</div>
    </details>
    <section className={`question ${answer ? 'is-revealed' : ''}`} aria-label="复习提问" data-question-id={question.id}>
      <div className="question-kicker">第 {round.index + 1} 问<span>首次选择保留</span></div>
      <h2>{question.prompt}</h2>
      {!answer ? <>
        <fieldset><legend className="sr-only">选择一个追问</legend>{options.map((option, index) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}>
          <input type="radio" name={`review-${question.id}`} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} />
          <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option.text}</span>
        </label>)}</fieldset>
        <div className="question-actions">
          <button className="primary" disabled={!selected} onClick={() => selected && choose(selected)} data-testid="review-confirm">确认选择<ArrowRight size={17} /></button>
          <button className="text-button" onClick={() => choose(null)} data-testid="review-reveal">直接看原文</button>
        </div>
      </> : <>
        <p className="answer-result" role="status" ref={resultRef} tabIndex={-1} data-testid="review-result">{answer.choiceId === null ? '已揭示原问' : answer.correct ? '你的选择与原问对应。' : '你的选择与原问不同。'}</p>
        <div className="original-question"><div className="speaker">{question.original.speaker || '苏格拉底'}<span>{question.sourceRef}</span><SourcePages paragraph={question.original} /></div><p data-paragraph-id={question.original.id}>{question.original.text}</p></div>
        <div className="original-reply" data-testid="review-original-reply">{unit.response.slice(0, unit.replyCount ?? 0).map(paragraph => <Passage key={paragraph.id} paragraph={paragraph} showSource />)}</div>
        <div className="explanation" data-testid="review-explanation"><h3>为什么这一问更好</h3><p>{question.explanation}</p>
          <div className="comparisons">{options.filter(option => option.id !== question.correctId).map(option => <div key={option.id}><p className="comparison-question">{option.text}{answer.choiceId === option.id && <span className="chosen-tag">你的选择</span>}</p><p>{option.feedback}</p></div>)}</div>
        </div>
        <div className="question-actions review-round-next"><button className="primary" onClick={next} data-testid="review-next">{round.index + 1 === round.units.length ? '查看本轮结果' : '下一问'}<ArrowRight size={17} /></button></div>
      </>}
    </section>
  </main>;
}
