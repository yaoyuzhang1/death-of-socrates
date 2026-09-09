import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, ChevronRight, List, RotateCcw, Settings2, X } from 'lucide-react';
import type { Corpus, Paragraph, Question, Save } from './model.ts';
import { advance, chapterStats, createSave, flattenCorpus, navigate, orderedOptions, submitAnswer, validateSave, readingBatches, readingPosition, setReadingPosition, setReadingMode, recordReview, reviewQueue, progressStats } from './engine.ts';
import ReviewRound from './ReviewRound.tsx';
import QuestionChoices from './QuestionChoices.tsx';
import { SourcePageLink } from './SourceViewer.tsx';
import './style.css';
import './play.css';

const STORAGE_KEY = 'republic-reading-v2';
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八'];
type Screen = 'home' | 'read' | 'chapter-end' | 'review';
type Panel = 'contents' | 'settings' | 'source' | null;
type Practice = { questionId: string; choiceId?: string | null; hinted: boolean };

function Text({ paragraph }: { paragraph: Paragraph }) {
  return <div className="passage" id={paragraph.id} data-paragraph-id={paragraph.id}>
    {(paragraph.speaker || paragraph.ref || paragraph.sourcePage) && <div className="speaker">{paragraph.speaker}{paragraph.ref && <span>{paragraph.ref}</span>}<SourcePages paragraph={paragraph} /></div>}
    <p>{paragraph.text}</p>
  </div>;
}

function SourcePage({ page }: { page: number }) {
  return <SourcePageLink page={page} />;
}

function SourcePages({ paragraph }: { paragraph: Paragraph }) {
  const pages = paragraph.sourcePages ?? (paragraph.sourcePage ? [paragraph.sourcePage] : []);
  return <>{pages.map(page => <SourcePage page={page} key={page} />)}</>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const cancel = (e: Event) => { e.preventDefault(); onCloseRef.current(); };
    dialog?.addEventListener('cancel', cancel);
    return () => { dialog?.removeEventListener('cancel', cancel); dialog?.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21} /></button></div>
    <div className="dialog-body">{children}</div>
  </dialog>;
}

export default function App() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [locationVersion, setLocationVersion] = useState(0);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [reviewSession, setReviewSession] = useState(0);
  const [reviewReturn, setReviewReturn] = useState<Exclude<Screen, 'review'>>('home');
  const saveRef = useRef(save);
  const screenRef = useRef(screen);
  const restoringScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readerTop = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLElement>(null);
  saveRef.current = save;
  screenRef.current = screen;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}text/republic.json`, { signal: controller.signal, cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('正文暂时未能加载。'); return r.json(); })
      .then((data: Corpus) => {
        if (!data.edition || !data.chapters?.length || !flattenCorpus(data).length) throw new Error('正文数据不完整。');
        let restored: Save | null = null;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            restored = validateSave(JSON.parse(raw), data);
            if (!restored) setNotice('保存的进度与当前正文不匹配，已建立新的阅读进度。');
          }
        } catch { setNotice('暂时无法读取本机进度。你仍可以阅读，并在设置中导出进度。'); }
        setCorpus(data);
        setSave(restored ?? createSave(data));
        if (restored?.started) setScreen('read');
      })
      .catch(e => { if (e.name !== 'AbortError') setError(`${e.message} 请检查网络后重试。`); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!save) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); }
    catch { setNotice('浏览器未能保存进度。请在阅读设置中导出备份。'); }
    document.documentElement.dataset.theme = save.settings.theme;
  }, [save]);

  useEffect(() => {
    const record = () => {
      const current = saveRef.current;
      if (!current || screenRef.current !== 'read' || restoringScroll.current) return;
      if (scrollTimer.current !== null) clearTimeout(scrollTimer.current);
      const cursor = current.cursor;
      scrollTimer.current = setTimeout(() => {
        scrollTimer.current = null;
        if (screenRef.current !== 'read' || restoringScroll.current) return;
        setSave(prev => prev?.cursor === cursor ? { ...prev, scroll: Math.max(0, Math.round(window.scrollY)) } : prev);
      }, 220);
    };
    const flush = () => {
      const current = saveRef.current;
      if (!current) return;
      const updated = screenRef.current === 'read' && !restoringScroll.current ? { ...current, scroll: Math.max(0, Math.round(window.scrollY)) } : current;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* The visible backup notice covers storage failure. */ }
    };
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => { if (scrollTimer.current !== null) clearTimeout(scrollTimer.current); window.removeEventListener('scroll', record); window.removeEventListener('pagehide', flush); };
  }, []);

  useEffect(() => {
    if (!save) return;
    if (scrollTimer.current !== null) { clearTimeout(scrollTimer.current); scrollTimer.current = null; }
    restoringScroll.current = true;
    let releaseFrame = 0;
    const id = requestAnimationFrame(() => {
      window.scrollTo(0, screen === 'read' ? saveRef.current?.scroll ?? 0 : 0);
      releaseFrame = requestAnimationFrame(() => { restoringScroll.current = false; });
    });
    setSelected(null);
    setPractice(null);
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(releaseFrame); };
  }, [screen, save?.cursor, corpus, locationVersion]);

  if (error) return <main className="loading"><BookOpen size={28} /><h1>理想国</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>重新加载</button></main>;
  if (!corpus || !save) return <main className="loading" role="status"><BookOpen size={28} /><p>正在打开《理想国》……</p></main>;

  const units = flattenCorpus(corpus);
  const unit = units[save.cursor];
  const question = unit.question;
  const firstAnswer = question ? save.answers[question.id] : undefined;
  const practicing = !!question && practice?.questionId === question.id;
  const displayedAnswer = practicing
    ? practice.choiceId !== undefined ? { choiceId: practice.choiceId, hinted: practice.hinted } : undefined
    : firstAnswer;
  const revealed = !!displayedAnswer;
  const totalQuestions = units.filter(u => u.question).length;
  const characterCount = units.reduce((n, u) => n + [...u.paragraphs, ...(u.question ? [u.question.original] : []), ...u.response].reduce((a, p) => a + p.text.length, 0), 0);
  const firstOfChapter = units.findIndex(u => u.chapter.id === unit.chapter.id) === save.cursor;
  const lastOfChapter = save.cursor === units.length - 1 || units[save.cursor + 1].chapter.id !== unit.chapter.id;
  const chapterNumber = unit.chapterIndex + 1;
  const overall = progressStats(units, save);
  const beforeBatches = readingBatches(unit.paragraphs);
  const afterBatches = readingBatches(unit.response.slice(unit.replyCount ?? 0));
  const position = readingPosition(save, unit);
  const stepMode = save.reading.mode === 'step';
  const beforeComplete = !stepMode || position.before >= beforeBatches.length;
  const afterComplete = !stepMode || position.after >= afterBatches.length;
  const chapterQuestions = units.filter(u => u.chapter.id === unit.chapter.id && u.question);
  const currentQuestionNumber = chapterQuestions.findIndex(u => u.id === unit.id) + 1;
  const latestIndex = Math.min(save.completed, units.length - 1);
  const revisiting = save.cursor < latestIndex;
  const update = (fn: (s: Save) => Save) => setSave(s => s ? { ...fn(s), updatedAt: new Date().toISOString() } : s);
  const goTo = (index: number) => {
    update(s => ({ ...navigate(s, units, index), started: true }));
    setLocationVersion(version => version + 1);
    setSummaryId(null);
    setPanel(null);
    setScreen('read');
  };
  const start = () => { update(s => ({ ...s, started: true })); setScreen('read'); };
  const goHome = () => {
    if (screen === 'read') update(s => ({ ...s, scroll: Math.max(0, Math.round(window.scrollY)) }));
    setScreen('home');
  };
  const startReview = (chapterId?: string) => {
    const ids = reviewQueue(units, save, 5, chapterId);
    if (!ids.length) { setNotice('读完并回答第一问后，就可以开始重练。'); return; }
    if (screen === 'read') update(s => ({ ...s, scroll: Math.max(0, Math.round(window.scrollY)) }));
    setReviewReturn(screen === 'review' ? 'read' : screen);
    setReviewIds(ids);
    setReviewSession(n => n + 1);
    setPanel(null);
    setScreen('review');
  };
  const choose = (choiceId: string | null) => {
    if (!question) return;
    if (practicing) {
      setPractice({ questionId: question.id, choiceId, hinted: practice.hinted });
      update(s => recordReview(s, units, question.id, choiceId));
    }
    else update(s => submitAnswer(s, unit, choiceId));
    setSelected(null);
    requestAnimationFrame(() => {
      questionRef.current?.querySelector<HTMLElement>('.answer-result')?.focus({ preventScroll: true });
      questionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  const refocusQuestion = () => requestAnimationFrame(() => {
    questionRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    questionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  const next = () => {
    if ((question && !firstAnswer) || !beforeComplete || !afterComplete) return;
    update(s => advance(s, units));
    if (lastOfChapter) { setSummaryId(unit.chapter.id); setScreen('chapter-end'); }
  };

  function readingPart(side: 'before' | 'after') {
    const batches = side === 'before' ? beforeBatches : afterBatches;
    const shown = stepMode ? position[side] : batches.length;
    return <div className={`reading-part reading-part-${side}`}>
      {batches.slice(0, shown).map((batch, index) => <div className="reading-batch" key={batch[0].id} id={`batch-${unit.id}-${side}-${index}`} tabIndex={-1} role="group" aria-label={`原文第 ${index + 1} 段`}>{batch.map(p => <Text key={p.id} paragraph={p} />)}</div>)}
      {shown < batches.length && <div className="reading-step" data-reading-side={side}>
        <p>已展开 {shown} / {batches.length} 段{side === 'before' && question ? ' · 读完后进入这一问' : ''}</p>
        <button className="primary" onClick={() => {
          update(s => setReadingPosition(s, unit, side, shown + 1));
          requestAnimationFrame(() => {
            const batch = document.getElementById(`batch-${unit.id}-${side}-${shown}`);
            batch?.focus({ preventScroll: true });
            batch?.scrollIntoView({ block: 'start', behavior: 'instant' });
          });
        }}>{side === 'before' ? '读下一段' : '继续读原文'} <ArrowRight size={17} /></button>
      </div>}
    </div>;
  }
  const exportProgress = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = '理想国-阅读进度.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('阅读进度已导出。');
  };
  const importProgress = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('进度文件过大。');
      const imported = validateSave(JSON.parse(await file.text()), corpus);
      if (!imported) throw new Error('这不是与当前正文匹配的有效进度文件。');
      setSave(imported);
      setLocationVersion(version => version + 1);
      setSummaryId(null);
      setPanel(null);
      setScreen(imported.started ? 'read' : 'home');
      setNotice('已恢复导入的阅读进度。');
    } catch (e) { setNotice(e instanceof Error ? e.message : '无法读取进度文件。'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  function questionCard(q: Question) {
    const options = orderedOptions(q, save!.seed);
    return <section className={`question ${revealed ? 'is-revealed' : ''}`} aria-label="追问练习" ref={questionRef} data-question-id={q.id}>
      <div className="question-kicker">停一停，想一问 <span>本章第 {currentQuestionNumber} / {chapterQuestions.length} 问</span>{practicing && <span>复习练习 · 首次记录保留</span>}</div>
      {!revealed ? <>
        <h2>{q.prompt}</h2>
        <QuestionChoices questionId={q.id} options={options} selected={selected} onSelect={setSelected} onConfirm={choose} onReveal={() => choose(null)} />
      </> : <>
        <p className="answer-result" role="status" tabIndex={-1}>{displayedAnswer!.choiceId === null ? '已揭示原问' : displayedAnswer!.choiceId === q.correctId ? '你的选择与原问对应。' : '你的选择与原问不同。'}</p>
        <p className="answer-followup">{displayedAnswer!.choiceId === q.correctId ? '这一问已选中，可以继续读下去。' : '这一问可以稍后重练；先接着看原文。'}</p>
        <div className="original-question"><div className="speaker">{q.original.speaker || '苏格拉底'}<span>{q.sourceRef}</span><SourcePages paragraph={q.original} /></div><p data-paragraph-id={q.original.id}>{q.original.text}</p></div>
        <div className="original-reply">{unit.response.slice(0, unit.replyCount ?? 0).map(p => <Text key={p.id} paragraph={p} />)}</div>
        <aside className="explanation" aria-label="为什么这一问更好"><h3>为什么这一问更好</h3><p>{q.explanation}</p>
          <div className="comparisons">{options.filter(o => o.id !== q.correctId).map(o => <div key={o.id}><p className="comparison-question">{o.text}{displayedAnswer!.choiceId === o.id && <span className="chosen-tag">你的选择</span>}</p><p>{o.feedback}</p></div>)}</div>
        </aside>
        <button className="text-button practice-button" onClick={() => { setPractice({ questionId: q.id, hinted: false }); setSelected(null); refocusQuestion(); }}>重新练习这一问</button>
      </>}
      {practicing && <button className="text-button practice-button" onClick={() => { setPractice(null); setSelected(null); }}>退出复习，查看首次记录</button>}
    </section>;
  }

  const summary = corpus.chapters.find(c => c.id === summaryId) ?? unit.chapter;
  const summaryStats = chapterStats(summary, save);
  const summaryChapterIndex = corpus.chapters.findIndex(chapter => chapter.id === summary.id);
  const nextChapterUnit = units.find(nextUnit => nextUnit.chapterIndex > summaryChapterIndex);
  return <div className="app" style={{ '--reading-font-size': `${save.settings.fontSize}px` } as CSSProperties}>
    <a className="skip-link" href="#main">跳到正文</a>
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={goHome} aria-label="返回首页"><BookOpen size={23} /><span>理想国<small>苏格拉底的下一问</small></span></button>
      <nav aria-label="阅读工具">{overall.answered > 0 && screen !== 'review' && <button onClick={() => startReview()}><RotateCcw size={17} /><span>重练</span></button>}<button onClick={() => setPanel('contents')}><List size={18} /><span>目录</span></button><button onClick={() => setPanel('settings')}><Settings2 size={18} /><span>阅读设置</span></button></nav>
    </div>{screen === 'read' && <div className="progress-track" aria-label={`已读${Math.round(save.completed / units.length * 100)}%`}><span style={{ width: `${save.completed / units.length * 100}%` }} /></div>}</header>

    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><X size={16} /></button></div>}

    {screen === 'home' && <main id="main" className="home">
      <section className="hero"><p className="eyebrow">柏拉图 · 原典互动阅读</p><h1>苏格拉底的<span>下一问</span></h1>
        <p className="hero-description">沿着《理想国》阅读，在关键处选择更好的追问。<br className="desktop-break" />每次作答后，看看这一问为什么更好。</p>
        <p className="play-rules">读一段原文 · 选一个问题 · 对照原问 · 再练一轮</p>
        <div className="hero-actions"><button className="primary" onClick={start}>{save.started ? '继续阅读' : '开始阅读'}<ArrowRight size={19} /></button>{save.started && <span className="resume-note">第{numerals[unit.chapterIndex]}章 · {unit.section.title}</span>}</div>
        {revisiting && <button className="text-button latest-home" onClick={() => goTo(latestIndex)}>回到最新进度 <ArrowRight size={15} /></button>}
        <div className="book-facts"><span>第一至四卷</span><span>{corpus.chapters.length} 个主题章</span><span>{totalQuestions} 次追问</span><span>约 {(characterCount / 10000).toFixed(1)} 万字</span></div>
      </section>
      {save.started && <section className="journey-panel" aria-label="我的进度">
        <div className="journey-counts"><p><strong>{overall.answered}<small> / {overall.total}</small></strong><span>已遇到的追问</span></p><p><strong>{overall.correct}</strong><span>首次选中原问</span></p><p><strong>{overall.remainingReview}</strong><span>待重练</span></p></div>
        {overall.answered > 0 && <div className="round-invitation"><div><h2>{overall.remainingReview ? '再试试那些没选中的问题' : '换个顺序，再想一轮'}</h2><p>每轮最多五问，先练尚未选中的题。随时返回原来的阅读位置。</p></div><button onClick={() => startReview()}><RotateCcw size={16} /> 开始一轮重练</button></div>}
      </section>}
      <section className="home-contents" aria-labelledby="contents-title"><div className="section-heading"><h2 id="contents-title">从日常判断，读到城邦与灵魂</h2><p>按讨论的主题分章，可以随时暂停、接着读。</p></div>
        <div className="chapter-grid">{corpus.chapters.map((chapter, i) => {
          const index = units.findIndex(u => u.chapter.id === chapter.id);
          const accessible = index <= save.completed;
          const end = units.filter(u => u.chapter.id === chapter.id).at(-1)!.index;
          const done = save.completed > end;
          const stats = chapterStats(chapter, save);
          return <button className="chapter-row" key={chapter.id} onClick={() => accessible ? goTo(index) : setPanel('contents')}>
            <span className="chapter-number">{String(i + 1).padStart(2, '0')}</span><span className="chapter-label"><strong>{chapter.title}</strong><small>{chapter.range}</small><span className="chapter-progress-caption">{done ? '已读完' : accessible ? '可继续' : '待阅读'} · 追问 {stats.answered} / {stats.total}</span></span><span className="chapter-mark">{done ? <Check size={18} /> : accessible ? <ArrowRight size={17} /> : <span>待阅读</span>}</span>
          </button>;
        })}</div>
      </section>
      <footer className="home-footer"><p>{corpus.edition.label}</p><button className="text-button" onClick={() => setPanel('source')}>底本与阅读说明 <ChevronRight size={15} /></button><p className="small">进度保存在当前浏览器中。无需登录。</p></footer>
    </main>}

    {screen === 'read' && <main id="main" className="reading-shell" ref={readerTop}>
      {revisiting && <div className="return-latest"><span>正在回看已读内容</span><button className="text-button" onClick={() => goTo(latestIndex)}>回到最新进度 <ArrowRight size={15} /></button></div>}
      <div className="reading-location"><button className="text-button" onClick={() => setPanel('contents')}>第{numerals[unit.chapterIndex]}章 · {unit.chapter.title}</button><button className={`icon-button bookmark-button ${save.bookmarks.includes(unit.id) ? 'bookmarked' : ''}`} aria-label={save.bookmarks.includes(unit.id) ? '移除书签' : '添加书签'} title="书签" onClick={() => update(s => ({ ...s, bookmarks: s.bookmarks.includes(unit.id) ? s.bookmarks.filter(id => id !== unit.id) : [...s.bookmarks, unit.id] }))}><Bookmark size={19} fill={save.bookmarks.includes(unit.id) ? 'currentColor' : 'none'} /></button></div>
      {firstOfChapter && <section className="chapter-intro"><p className="eyebrow">第{numerals[unit.chapterIndex]}章 / {corpus.chapters.length}章</p><h1>{unit.chapter.title}</h1><p>{unit.chapter.range}</p></section>}
      <div className="reading-section-heading"><h2>{unit.section.title}</h2><span>{unit.section.range}</span></div>
      <div className="chapter-question-track" aria-label="本章追问进度">{chapterQuestions.map((u, i) => {
        const answer = save.answers[u.question!.id];
        const state = answer ? answer.choiceId === u.question!.correctId ? 'matched' : 'encountered' : 'upcoming';
        return <span key={u.id} className={state} title={`第${i + 1}问：${answer ? state === 'matched' ? '首次选中' : '已作答' : '尚未作答'}`} aria-label={`第${i + 1}问：${answer ? state === 'matched' ? '首次选中' : '已作答' : '尚未作答'}`}>{i + 1}</span>;
      })}<small>本章已答 {chapterQuestions.filter(u => save.answers[u.question!.id]).length} / {chapterQuestions.length}</small></div>
      <article className="reading-text" aria-label="原典正文">
        {readingPart('before')}
        {question && beforeComplete && questionCard(question)}
        {beforeComplete && (!question || revealed) && readingPart('after')}
      </article>
      <footer className="reading-navigation"><button className="text-button" disabled={save.cursor === 0} onClick={() => goTo(save.cursor - 1)}><ArrowLeft size={17} />上一节</button>
        {beforeComplete && afterComplete && (!question || revealed) ? <button className="primary" onClick={next}>{lastOfChapter ? '完成本章' : '继续阅读'}<ArrowRight size={18} /></button> : <span className="reading-pause">{!beforeComplete || (revealed && !afterComplete) ? '按自己的节奏，把这一段读完。' : '选一个问题，或直接揭示原文。'}</span>}
      </footer>
      <div className="reading-footnote"><span>第{chapterNumber}章 · 阅读位置 {units.filter(u => u.chapter.id === unit.chapter.id && u.index <= save.cursor).length} / {units.filter(u => u.chapter.id === unit.chapter.id).length}</span><button className="text-button" onClick={() => setPanel('source')}>底本说明</button></div>
    </main>}

    {screen === 'chapter-end' && <main id="main" className="chapter-end"><p className="eyebrow">本章已读完</p><h1>{summary.title}</h1><p className="chapter-conclusion">{summary.range}</p>
      <div className="chapter-score"><div><strong>{summaryStats.correct}<span> / {summaryStats.total}</span></strong><p>首次答对</p></div><p>直接揭示 {summaryStats.revealed} 题</p></div>
      <div className="chapter-round"><p>本章的讨论已读完。可以继续，也可以把这一章的追问再练一轮。</p><button onClick={() => startReview(summary.id)}><RotateCcw size={16} /> 重练本章</button></div>
      <h2>再看一眼这些追问</h2><div className="review-questions">{units.filter(u => u.chapter.id === summary.id && u.question).map(u => <button key={u.id} onClick={() => goTo(u.index)}><span>{u.question!.sourceRef}</span><strong>{u.question!.original.text}</strong><ArrowRight size={17} /></button>)}</div>
      {nextChapterUnit ? <button className="primary" onClick={() => goTo(nextChapterUnit.index)}>进入下一章 <ArrowRight size={18} /></button> : <><p className="end-note">你已读完本篇。讨论仍将继续；现在也可以回到任何已读章节，重新体会其中的追问。</p><button className="primary" onClick={() => setScreen('home')}>回到目录 <BookOpen size={18} /></button></>}
    </main>}

    {screen === 'review' && <ReviewRound key={reviewSession} corpus={corpus} save={save} questionIds={reviewIds} onAnswer={(id, choiceId) => update(s => recordReview(s, units, id, choiceId))} onClose={() => setScreen(reviewReturn)} returnLabel={reviewReturn === 'home' ? '返回首页' : reviewReturn === 'chapter-end' ? '返回本章小结' : '返回阅读'} />}

    {panel && <Modal title={panel === 'contents' ? '阅读目录' : panel === 'settings' ? '阅读设置' : '底本与阅读说明'} onClose={() => setPanel(null)}>
      {panel === 'contents' && <><p className="panel-intro">按原文顺序阅读。已读部分可以随时回看，首次作答记录会保留。</p>
        {save.started && <div className="toc-current"><button onClick={() => goTo(latestIndex)}>回到最新进度<small>{units[latestIndex].chapter.title} · {units[latestIndex].section.title}</small></button></div>}
        {save.bookmarks.length > 0 && <section className="bookmark-list"><h3>我的书签</h3>{save.bookmarks.map(id => { const u = units.find(u => u.id === id)!; return <button key={id} onClick={() => goTo(u.index)}><Bookmark size={15} />{u.chapter.title} · {u.section.title}</button>; })}</section>}
        <ol className="toc">{corpus.chapters.map((chapter, ci) => <li key={chapter.id}><h3><span>{String(ci + 1).padStart(2, '0')}</span>{chapter.title}</h3><p>{chapter.range}</p><ul>{chapter.sections.map(section => {
          const index = units.findIndex(u => u.section.id === section.id);
          const accessible = index <= save.completed;
          return <li key={section.id}><button disabled={!accessible} onClick={() => goTo(index)}>{section.title}{accessible ? <ChevronRight size={16} /> : <small>待阅读</small>}</button></li>;
        })}</ul></li>)}</ol></>}
      {panel === 'settings' && <div className="settings-panel"><section><h3>正文字号</h3><div className="font-control"><button aria-label="减小字号" disabled={save.settings.fontSize <= 16} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.max(16, s.settings.fontSize - 2) } }))}>A−</button><output>{save.settings.fontSize}px</output><button aria-label="增大字号" disabled={save.settings.fontSize >= 32} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.min(32, s.settings.fontSize + 2) } }))}>A＋</button></div><p className="font-sample">从一个更好的问题，开始一段更清楚的思考。</p></section>
        <section><h3>阅读节奏</h3><div className="segmented">{(['step', 'continuous'] as const).map(mode => <button key={mode} aria-pressed={save.reading.mode === mode} onClick={() => update(s => setReadingMode(s, mode, s.started ? unit : undefined))}>{mode === 'step' ? '分段阅读' : '连续全文'}</button>)}</div><p>分段阅读按原文段落逐步展开。切回分段时保留已显示的正文，从下一节采用新的节奏。</p></section>
        <section><h3>阅读背景</h3><div className="segmented">{(['paper', 'night'] as const).map(theme => <button key={theme} aria-pressed={save.settings.theme === theme} onClick={() => update(s => ({ ...s, settings: { ...s.settings, theme } }))}>{theme === 'paper' ? '纸色' : '夜间'}</button>)}</div></section>
        <section><h3>进度备份</h3><p>阅读位置、首次作答和重练记录保存在本机。换浏览器前，可以导出一份备份。</p><div className="backup-actions"><button onClick={exportProgress}>导出进度</button><button onClick={() => fileRef.current?.click()}>导入进度</button><input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="选择进度文件" onChange={e => importProgress(e.target.files?.[0])} /></div></section>
        <section>{confirmReset ? <><p>重新开始会清除本浏览器中的阅读与答题记录。可以先导出备份。</p><div className="backup-actions"><button onClick={() => { setSave(createSave(corpus)); setScreen('home'); setPanel(null); setConfirmReset(false); }}>确认重新开始</button><button onClick={() => setConfirmReset(false)}>保留进度</button></div></> : <button className="text-button" onClick={() => setConfirmReset(true)}>重新开始阅读</button>}</section>
      </div>}
      {panel === 'source' && <div className="source-panel"><p className="eyebrow">柏拉图 · 理想国</p><h3>{corpus.edition.label}</h3><p>{corpus.edition.description}</p><p>译文：{corpus.edition.translator}</p><ul>{corpus.edition.notes.map(note => <li key={note}>{note}</li>)}</ul><p>{corpus.edition.license}</p><a href={corpus.edition.sourceUrl} target="_blank" rel="noreferrer">出版社书目信息 ↗</a><p><a href={`${import.meta.env.BASE_URL}text/parallel.html`} target="_blank" rel="noreferrer">书页与连续全文（含后文） ↗</a> · <a href={`${import.meta.env.BASE_URL}TEXT-LICENSE.txt`} target="_blank" rel="noreferrer">署名与文本说明 ↗</a></p><hr /><h3>关于追问练习</h3><p>原问对应选项取自本译本；另两项是围绕同一对象、条件或关系作的小幅改写。作答后揭示原句，说明它怎样承接本段对话。选项比较与说明属于编辑文字。</p><p>所有选择都接回相同的原典。八个主题章为阅读分段，卷次、对话次序及其后续论证保持不变。</p></div>}
    </Modal>}
  </div>;
}
