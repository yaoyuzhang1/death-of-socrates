import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown } from 'lucide-react';
import content from '../../content/bonus/death.json';
import artwork from '../../content/art/bonus-art.json';
import { SceneImage } from './ComicScene.tsx';
import { bonusFrontier, chooseBonus, finishBonus, navigateBonus } from './bonus-engine.ts';
import type { ReadingUnit, Save } from './model.ts';

type Passage = { speaker: string; text: string };
function Passages({ passages }: { passages: Passage[] }) {
  return <div className="bonus-passages">{passages.map((passage, index) => <p className={passage.speaker === '旁白' ? 'bonus-narration' : passage.speaker === '苏格拉底' ? 'bonus-socrates' : 'bonus-dialogue'} key={index}>
    <span className="bonus-speaker">{passage.speaker}</span><span>{passage.text}</span>
  </p>)}</div>;
}

export default function BonusChapter({ save, units, onUpdate, onExit, preview = false }: {
  save: Save; units: ReadingUnit[]; onUpdate: (fn: (save: Save) => Save) => void; onExit: () => void; preview?: boolean;
}) {
  const [ending, setEnding] = useState(save.bonus.completed && save.bonus.cursor === content.scenes.length - 1);
  const [selected, setSelected] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const scene = content.scenes[save.bonus.cursor];
  const art = artwork.find(item => item.id === scene.illustrationId);
  const visited = save.bonus.visited[scene.id] ?? [];
  const firstChoice = save.bonus.choices[scene.id];
  const response = scene.question.options.find(option => option.id === responseId);
  const frontier = bonusFrontier(save);

  useEffect(() => {
    setSelected(null);
    setResponseId(save.bonus.visited[scene.id]?.at(-1) ?? null);
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [scene.id, ending]);

  const access = preview ? 'preview' : 'earned';
  const navigate = (index: number) => { onUpdate(current => navigateBonus(current, units, index, access)); setEnding(false); };
  const confirm = () => {
    if (!selected) return;
    onUpdate(current => chooseBonus(current, units, scene.id, selected, access));
    setResponseId(selected);
    setSelected(null);
    requestAnimationFrame(() => feedback.current?.focus({ preventScroll: false }));
  };
  const finish = () => {
    onUpdate(current => finishBonus(current, units, access));
    setEnding(true);
  };

  return <main id="main" className="bonus-shell" data-testid="bonus-chapter">
    <div className="bonus-location"><button className="text-button" onClick={onExit}><ArrowLeft size={16} />{preview ? '返回主篇' : '八章总结'}</button><span>隐藏章节 · {Object.keys(save.bonus.choices).length} / {content.scenes.length} 场已探索</span></div>
    {ending ? <section className="bonus-ending" data-testid="bonus-ending">
      <p className="eyebrow">苏格拉底之死 · 对话结束</p><h1 ref={heading} tabIndex={-1}>{content.ending.title}</h1>
      <Passages passages={content.ending.passages} />
      <div className="bonus-journal">{content.ending.journal.map(entry => <section key={entry.title}><h2>{entry.title}</h2><p>{entry.text}</p></section>)}</div>
      <h2>你曾从这些问题走近他</h2>
      <div className="bonus-recollection">{content.scenes.map((item, index) => <button onClick={() => navigate(index)} key={item.id}><span>{String(index + 1).padStart(2, '0')} · {item.title}</span><strong>{item.question.options.find(option => option.id === save.bonus.choices[item.id])?.text}</strong><small>已探索 {save.bonus.visited[item.id]?.length ?? 0} / 3 个角度 <ArrowRight size={15} /></small></button>)}</div>
      <button className="primary" onClick={onExit}>带着问题，回到《理想国》 <BookOpen size={18} /></button>
    </section> : <>
      <header className="bonus-scene-heading"><p className="eyebrow">苏格拉底之死 · 第 {save.bonus.cursor + 1} 幕 / {content.scenes.length}</p><h1 ref={heading} tabIndex={-1}>{scene.title}</h1><p>{scene.place}</p></header>
      <progress className="bonus-progress" value={Object.keys(save.bonus.choices).length} max={content.scenes.length} aria-label="隐藏章节进度" />
      {art && <SceneImage key={art.id} assetId={art.id} scene={{ file: art.file, alt: art.alt, focalY: 50, kind: 'bonus' }} compact={false} />}
      {save.bonus.cursor === 0 && <p className="bonus-intro">这是一次场景化改写。选择你想继续听的角度，再听他的回应；不计对错，也不改变历史结局。首次选择和探索记录都会保留。</p>}
      <article aria-label="隐藏章节对话"><Passages passages={scene.passages} /></article>
      <section className="bonus-question" aria-labelledby="bonus-prompt">
        <p className="eyebrow">把谈话接下去</p><h2 id="bonus-prompt">{scene.question.prompt}</h2>
        <fieldset><legend className="sr-only">选择一个谈话角度</legend>{scene.question.options.map(option => <label className={`bonus-option${selected === option.id ? ' selected' : ''}`} key={option.id}>
          <input type="radio" name={`bonus-${scene.id}`} checked={selected === option.id} onChange={() => setSelected(option.id)} value={option.id} />
          <span className="bonus-option-letter">{option.id.toUpperCase()}</span><span>{option.text}{visited.includes(option.id) && <small><Check size={12} />{firstChoice === option.id ? '首次选择' : '已探索'}</small>}</span>
        </label>)}</fieldset>
        <div className="bonus-choice-actions"><button className="primary" disabled={!selected} onClick={confirm} data-testid="bonus-confirm">{selected && visited.includes(selected) ? '再听这一段' : '听听回应'}<ArrowRight size={17} /></button>{firstChoice && <span>还可以选择其他角度，首次记录不变。</span>}</div>
      </section>
      {response && <div className="bonus-response" ref={feedback} tabIndex={-1} key={`${scene.id}:${response.id}`} data-testid="bonus-response">
        <p className="eyebrow">关于：{response.text}</p><Passages passages={response.response} /><p className="bonus-source-note">{response.note}</p>
      </div>}
      <footer className="bonus-navigation"><button className="text-button" disabled={save.bonus.cursor === 0} onClick={() => navigate(save.bonus.cursor - 1)}><ArrowLeft size={16} />上一幕</button><button className="primary" disabled={!firstChoice} onClick={() => save.bonus.cursor === content.scenes.length - 1 ? finish() : navigate(save.bonus.cursor + 1)} data-testid="bonus-next">{save.bonus.cursor === content.scenes.length - 1 ? '合上这段对话' : '走进下一幕'}<ArrowRight size={17} /></button></footer>
      <p className="bonus-scene-source">本幕参考：<a href={scene.sourceUrl} target="_blank" rel="noreferrer">{scene.sourceRef} ↗</a></p>
    </>}
    <details className="bonus-scene-list"><summary>回看已走过的场景 <ChevronDown size={15} /></summary><ol>{content.scenes.map((item, index) => <li key={item.id}><button disabled={index > frontier} aria-current={!ending && save.bonus.cursor === index ? 'step' : undefined} onClick={() => navigate(index)}><span>{String(index + 1).padStart(2, '0')} · {item.title}</span>{save.bonus.choices[item.id] ? <Check size={15} /> : <small>{index <= frontier ? '可继续' : '尚未走到'}</small>}</button></li>)}</ol></details>
    <details className="bonus-sources"><summary>关于这次改编与原作来源 <ChevronDown size={15} /></summary><p>{content.notice}</p><ul>{content.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><span>{source.reference}</span></li>)}</ul></details>
  </main>;
}
