import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Play, RotateCcw, Square } from 'lucide-react';
import type { Corpus, ReadingUnit, Save } from './model.ts';
import { chapterStats, progressStats } from './engine.ts';
import { playCelebration, stopCelebration, subscribeCelebration, type CelebrationState } from './completion-audio.ts';

export default function CompletionScreen({ corpus, units, save, onBonus, onHome, onReview, onChapter, onEnableVoice }: {
  corpus: Corpus; units: ReadingUnit[]; save: Save; onBonus: () => void; onHome: () => void;
  onReview: () => void; onChapter: (id: string) => void; onEnableVoice: () => void;
}) {
  const [speech, setSpeech] = useState<CelebrationState>({ status: 'idle' });
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.focus({ preventScroll: true }); return subscribeCelebration(setSpeech); }, []);
  useEffect(() => () => stopCelebration(), []);
  const stats = progressStats(units, save);
  return <main id="main" className="completion-screen" ref={mainRef} tabIndex={-1} data-testid="all-chapters-complete">
    <div className="completion-seal" aria-hidden="true"><Check size={34} /></div>
    <p className="eyebrow">第一至四卷 · 八章阅读完成</p>
    <h1>你走完了这段追问</h1>
    <p className="completion-lead">从日常的义务，读到城邦与灵魂。每一个停下来比较的问题，都是这段阅读的一部分。</p>
    <div className="completion-counts"><div><strong>8<small> / 8</small></strong><span>主题章已完成</span></div><div><strong>{stats.answered}<small> / {stats.total}</small></strong><span>追问已走过</span></div><div><strong>{stats.correct}</strong><span>首次选中原问</span></div></div>
    <div className="completion-voice"><button onClick={() => speech.status === 'playing' ? stopCelebration() : (onEnableVoice(), playCelebration())} data-testid="celebration-play">{speech.status === 'playing' ? <Square size={16} /> : <Play size={16} />}{speech.status === 'playing' ? '停止祝贺语音' : '播放祝贺'}</button><span role="status">{speech.status === 'playing' ? '普通话祝贺正在播放' : speech.message ?? '所有首答、重练与阅读记录均已保留'}</span></div>
    <section className="bonus-unlocked" aria-labelledby="bonus-title"><p className="eyebrow">隐藏章节 · 已解锁</p><h2 id="bonus-title">苏格拉底之死</h2><p>回到公元前399年的雅典。从法庭到牢房，在模拟对话中追问：他为何受审，为何拒绝出逃，又如何走向生命的终点？</p><button className="primary" onClick={onBonus} data-testid="enter-bonus">{save.bonus.completed ? '重访这段对话' : Object.keys(save.bonus.choices).length ? '继续隐藏章节' : '走进最后的对话'}<ArrowRight size={18} /></button></section>
    <section className="completion-chapters"><h2>八章的阅读足迹</h2>{corpus.chapters.map((chapter, index) => { const scores = chapterStats(chapter, save); return <button key={chapter.id} onClick={() => onChapter(chapter.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{chapter.title}</strong><small>首次 {scores.correct} / {scores.total}</small><ArrowRight size={16} /></button>; })}</section>
    <div className="completion-actions"><button onClick={onHome}><BookOpen size={17} />返回八章目录</button><button onClick={onReview}><RotateCcw size={17} />再练一轮追问</button></div>
  </main>;
}
