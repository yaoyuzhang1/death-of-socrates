import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, MessageCircle, RotateCcw, Square, Volume2 } from 'lucide-react';
import content from '../../content/bonus/death.json';
import checks from '../../content/bonus/checks.json';
import artwork from '../../content/art/bonus-art.json';
import { SceneImage } from './ComicScene.tsx';
import { bonusFrontier, chooseBonus, finishBonus, navigateBonus } from './bonus-engine.ts';
import type { ReadingUnit, Save } from './model.ts';
import type { AudioPreferences } from './QuestionChallenge.tsx';
import type { StudyController } from './useStudy.ts';
import LearningCheck from './LearningCheck.tsx';
import ConversationContext, { getBonusContext } from './ConversationContext.tsx';
import { subscribeFeedback, type FeedbackAudioState } from './feedback-audio.ts';
import { bonusIntroKey, bonusResponseKey, playBonusIntro, playBonusResponse, stopBonusAudio } from './bonus-audio.ts';
import './bonus-feedback.css';

type Passage = { speaker: string; text: string };
function Passages({ passages }: { passages: Passage[] }) {
  return <div className="bonus-passages">{passages.map((passage, index) => <p className={passage.speaker === '旁白' ? 'bonus-narration' : passage.speaker === '苏格拉底' ? 'bonus-socrates' : 'bonus-dialogue'} key={index}>
    <span className="bonus-speaker">{passage.speaker}</span><span>{passage.text}</span>
  </p>)}</div>;
}

export default function BonusChapter({ save, units, onUpdate, onExit, study, audio, preview = false }: {
  save: Save; units: ReadingUnit[]; onUpdate: (fn: (save: Save) => Save) => void; onExit: () => void; preview?: boolean;
  study: StudyController; audio: AudioPreferences;
}) {
  const pendingStudyChallenge = save.bonus.completed && checks.some(item => study.records[item.id]) && checks.some(item => !study.records[item.id]?.correct);
  const [ending, setEnding] = useState(save.bonus.completed && save.bonus.cursor === content.scenes.length - 1 && !pendingStudyChallenge);
  const [selected, setSelected] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [feedbackRun, setFeedbackRun] = useState(0);
  const [challengeMode, setChallengeMode] = useState(pendingStudyChallenge);
  const studyRestored = useRef(study.ready);
  const [voice, setVoice] = useState<FeedbackAudioState>({ status: 'idle', key: null });
  const confirmLock = useRef(false);
  const angleChoices = useRef<HTMLFieldSetElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const scene = content.scenes[save.bonus.cursor];
  const art = artwork.find(item => item.id === scene.illustrationId);
  const visited = save.bonus.visited[scene.id] ?? [];
  const firstChoice = save.bonus.choices[scene.id];
  const response = scene.question.options.find(option => option.id === responseId);
  const frontier = bonusFrontier(save);
  const check = checks.find(item => item.sceneId === scene.id)!;
  const understood = Boolean(study.records[check.id]?.correct);
  const checkedCount = checks.filter(item => study.records[item.id]?.correct).length;
  const selectedIndex = scene.question.options.findIndex(option => option.id === selected);
  const responsePlaying = Boolean(response && voice.status === 'playing' && voice.key?.startsWith(bonusResponseKey(scene.id, response.id)));
  const introPlaying = voice.status === 'playing' && voice.key?.startsWith(bonusIntroKey(scene.id));
  const currentIndex = save.bonus.cursor;
  const assessmentRequired = !save.bonus.completed || challengeMode;
  const canVisit = (index: number) => study.ready && index >= 0 && index <= frontier && (index <= currentIndex ||
    !assessmentRequired || (!challengeMode && index < Object.keys(save.bonus.choices).length) ||
    (index === currentIndex + 1 && understood));
  const canContinue = study.ready && Boolean(firstChoice) && (currentIndex === content.scenes.length - 1
    ? !assessmentRequired || understood : canVisit(currentIndex + 1));

  useEffect(() => subscribeFeedback(setVoice), []);
  useEffect(() => {
    if (!study.ready || studyRestored.current) return;
    studyRestored.current = true;
    if (pendingStudyChallenge) { setChallengeMode(true); setEnding(false); }
  }, [study.ready, pendingStudyChallenge]);
  useEffect(() => () => stopBonusAudio(), []);
  useEffect(() => { if (!audio.voice) stopBonusAudio(); }, [audio.voice]);

  useEffect(() => {
    setSelected(null);
    confirmLock.current = false;
    setFeedbackRun(0);
    stopBonusAudio();
    setResponseId(save.bonus.visited[scene.id]?.at(-1) ?? null);
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [scene.id, ending]);

  const access = preview ? 'preview' : 'earned';
  const navigate = (index: number) => {
    if (!canVisit(index)) return;
    stopBonusAudio();
    onUpdate(current => current.bonus.cursor === currentIndex ? navigateBonus(current, units, index, access) : current);
    setEnding(false);
  };
  const confirm = () => {
    if (!selected || confirmLock.current) return;
    confirmLock.current = true;
    const chosen = scene.question.options.find(option => option.id === selected)!;
    onUpdate(current => current.bonus.cursor === currentIndex ? chooseBonus(current, units, scene.id, selected, access) : current);
    setResponseId(selected);
    setFeedbackRun(run => run + 1);
    setSelected(null);
    playBonusResponse(scene.id, chosen.id, chosen.response.length, Boolean(chosen.note), audio);
    requestAnimationFrame(() => { feedback.current?.focus({ preventScroll: true }); feedback.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  };
  const selectAngle = (id: string) => { confirmLock.current = false; setSelected(id); };
  const finish = () => {
    if (!canContinue) return;
    stopBonusAudio();
    if (challengeMode && checkedCount < checks.length) {
      const nextUnchecked = content.scenes.findIndex(item => !study.records[checks.find(candidate => candidate.sceneId === item.id)!.id]?.correct);
      onUpdate(current => navigateBonus(current, units, nextUnchecked, access));
      return;
    }
    onUpdate(current => finishBonus(current, units, access));
    setEnding(true);
  };
  const beginChallenge = () => {
    stopBonusAudio(); setChallengeMode(true);
    onUpdate(current => navigateBonus(current, units, 0, access)); setEnding(false);
  };

  return <div className="context-layout bonus-context-layout"><ConversationContext {...getBonusContext(scene)} /><main id="main" className="bonus-shell" data-testid="bonus-chapter">
    <div className="bonus-location"><button className="text-button" onClick={onExit}><ArrowLeft size={16} />{preview ? '返回主篇' : '八章总结'}</button><span>隐藏章节 · {Object.keys(save.bonus.choices).length} / {content.scenes.length} 场已探索</span></div>
    {ending ? <section className="bonus-ending" data-testid="bonus-ending">
      <p className="eyebrow">苏格拉底之死 · 对话结束</p><h1 ref={heading} tabIndex={-1}>{content.ending.title}</h1>
      <Passages passages={content.ending.passages} />
      <div className="bonus-journal">{content.ending.journal.map(entry => <section key={entry.title}><h2>{entry.title}</h2><p>{entry.text}</p></section>)}</div>
      <section className="bonus-challenge-summary"><div><h2>把十二幕中的判断接起来</h2><p>已读懂 {checkedCount} / 12 处。先前的对话选择与通关记录都保留；还可以对照原作，再完成一轮判断。</p></div><button onClick={beginChallenge} data-testid="bonus-start-challenge"><RotateCcw size={17} />{checkedCount < 12 ? '挑战十二幕' : '回看十二幕的判断'}</button></section>
      <h2>你曾从这些问题走近他</h2>
      <div className="bonus-recollection">{content.scenes.map((item, index) => <button onClick={() => navigate(index)} key={item.id}><span>{String(index + 1).padStart(2, '0')} · {item.title}</span><strong>{item.question.options.find(option => option.id === save.bonus.choices[item.id])?.text}</strong><small>已探索 {save.bonus.visited[item.id]?.length ?? 0} / 3 个角度 <ArrowRight size={15} /></small></button>)}</div>
      <button className="primary" onClick={onExit}>带着问题，回到《理想国》 <BookOpen size={18} /></button>
    </section> : <>
      <header className="bonus-scene-heading"><p className="eyebrow">苏格拉底之死 · 第 {save.bonus.cursor + 1} 幕 / {content.scenes.length}</p><h1 ref={heading} tabIndex={-1}>{scene.title}</h1><p>{scene.place}</p></header>
      <progress className="bonus-progress" value={Object.keys(save.bonus.choices).length} max={content.scenes.length} aria-label="隐藏章节进度" />
      {art && <SceneImage key={art.id} assetId={art.id} scene={{ file: art.file, alt: art.alt, focalY: 50, kind: 'bonus' }} compact={false} />}
      {save.bonus.cursor === 0 && <p className="bonus-intro">这是一次场景化改写。先选一个谈话角度，听完回应，再判断自己是否理解了本幕。谈话角度不计对错；理解检查答对后继续，所有首次记录都会保留。</p>}
      <div className="bonus-reading-tools"><span>{challengeMode ? '十二幕判断挑战' : '对话与判断'} · 已读懂 {checkedCount} / 12 处</span>{save.bonus.completed && !challengeMode && <button className="text-button" onClick={() => { stopBonusAudio(); setEnding(true); }} data-testid="bonus-return-ending">回到故事结尾</button>}<button className="text-button" disabled={!audio.voice} onClick={() => introPlaying ? stopBonusAudio() : playBonusIntro(scene.id, scene.passages.length, audio)}>{introPlaying ? <Square size={15} /> : <Volume2 size={17} />}{introPlaying ? '停止本幕朗读' : '朗读本幕'}</button></div>
      <article aria-label="隐藏章节对话"><Passages passages={scene.passages} /></article>
      <section className="bonus-question" aria-labelledby="bonus-prompt">
        <p className="eyebrow">把谈话接下去</p><h2 id="bonus-prompt">{scene.question.prompt}</h2>
        <fieldset ref={angleChoices} onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
          const index = ['1', '2', '3'].indexOf(event.key);
          if (index >= 0) { event.preventDefault(); selectAngle(scene.question.options[index].id); const input = angleChoices.current?.querySelectorAll<HTMLInputElement>('input')[index]; input?.focus({ preventScroll: true }); input?.closest('label')?.scrollIntoView({ block: 'center', behavior: 'instant' }); }
          else if (event.key === 'Enter') { event.preventDefault(); confirm(); }
        }}><legend className="sr-only">选择一个谈话角度</legend>{scene.question.options.map(option => <label className={`bonus-option${selected === option.id ? ' selected' : ''}`} key={option.id}>
          <input type="radio" name={`bonus-${scene.id}`} checked={selected === option.id} onChange={() => selectAngle(option.id)} value={option.id} />
          <span className="bonus-option-letter">{option.id.toUpperCase()}</span><span>{option.text}{visited.includes(option.id) && <small><Check size={12} />{firstChoice === option.id ? '首次选择' : '已探索'}</small>}</span>
        </label>)}</fieldset>
        <div className="bonus-choice-actions"><span>{selectedIndex >= 0 ? `已选 ${String.fromCharCode(65 + selectedIndex)}，确认前可以修改` : '选一个角度，再确认'}<small>选项内：1–3 选择，Enter 确认</small></span><button className="primary" disabled={!selected} onClick={confirm} data-testid="bonus-confirm">{selected && visited.includes(selected) ? '再听这一段' : '确认 · 听听回应'}<ArrowRight size={17} /></button></div>
      </section>
      {response && <div className={`bonus-response${feedbackRun ? ' bonus-response-animate' : ''}`} ref={feedback} tabIndex={-1} key={`${scene.id}:${response.id}:${feedbackRun}`} data-testid="bonus-response" aria-live={audio.voice ? 'off' : 'polite'}>
        <div className="bonus-response-heading"><span className="bonus-response-symbol" aria-hidden="true"><MessageCircle size={24} /></span><div><h3>{feedbackRun ? '谈话继续了' : '回看这段回应'}</h3><p>这一角度已经留下，接着看看你怎样理解。</p></div></div>
        <p className="eyebrow">关于：{response.text}</p><Passages passages={response.response} /><p className="bonus-source-note">{response.note}</p>
        <div className="bonus-response-audio"><button className="text-button" disabled={!audio.voice} onClick={() => responsePlaying ? stopBonusAudio() : playBonusResponse(scene.id, response.id, response.response.length, Boolean(response.note), audio)}>{responsePlaying ? <Square size={15} /> : <Volume2 size={17} />}{responsePlaying ? '停止回应配音' : '重听这段回应'}</button><span role="status">{!audio.voice ? '配音已关闭' : responsePlaying ? '普通话回应正在播放' : voice.key?.startsWith(bonusResponseKey(scene.id, response.id)) && (voice.status === 'error' || voice.status === 'blocked') ? '配音暂时无法播放，点击重听可重试。' : '按人物声线朗读 · 可随时重听'}</span></div>
      </div>}
      {response && study.ready && <LearningCheck key={check.id} check={check} record={study.records[check.id]} onAnswer={id => study.answer(check, id)} audio={audio} />}
      <footer className="bonus-navigation"><button className="text-button" disabled={save.bonus.cursor === 0} onClick={() => navigate(save.bonus.cursor - 1)}><ArrowLeft size={16} />上一幕</button><button className="primary" disabled={!canContinue} onClick={() => save.bonus.cursor === content.scenes.length - 1 ? finish() : navigate(save.bonus.cursor + 1)} data-testid="bonus-next">{!firstChoice ? '先选一段回应' : !canContinue ? '先完成本幕判断' : save.bonus.cursor === content.scenes.length - 1 ? challengeMode && checkedCount < checks.length ? '继续其余判断' : '合上这段对话' : '走进下一幕'}<ArrowRight size={17} /></button></footer>
      <p className="bonus-scene-source">本幕参考：<a href={scene.sourceUrl} target="_blank" rel="noreferrer">{scene.sourceRef} ↗</a></p>
    </>}
    <details className="bonus-scene-list"><summary>回看已走过的场景 <ChevronDown size={15} /></summary><ol>{content.scenes.map((item, index) => <li key={item.id}><button disabled={!canVisit(index)} aria-current={!ending && save.bonus.cursor === index ? 'step' : undefined} onClick={() => navigate(index)}><span>{String(index + 1).padStart(2, '0')} · {item.title}</span>{save.bonus.choices[item.id] ? <Check size={15} /> : <small>{canVisit(index) ? '可继续' : index <= frontier ? '先完成当前判断' : '尚未走到'}</small>}</button></li>)}</ol></details>
    <details className="bonus-sources"><summary>关于这次改编与原作来源 <ChevronDown size={15} /></summary><p>{content.notice}</p><ul>{content.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><span>{source.reference}</span></li>)}</ul></details>
  </main></div>;
}
