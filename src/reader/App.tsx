import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, ChevronRight, List, RotateCcw, Settings2, X } from 'lucide-react';
import type { Corpus, Save } from './model.ts';
import { advance, chapterStats, createSave, flattenCorpus, navigate, submitAnswer, validateSave, recordReview, reviewQueue, progressStats, pagePosition, setPagePosition, isQuestionResolved, enterChapter, getChapterProgress, latestUnitIndex, isUnitAccessible, allChaptersComplete, setScrollPosition } from './engine.ts';
import ReviewRound from './ReviewRound.tsx';
import QuestionChallenge, { type AudioPreferences } from './QuestionChallenge.tsx';
import ReadingPassage, { passageRoles } from './ReadingPassage.tsx';
import ComicScene from './ComicScene.tsx';
import ChapterCards from './ChapterCards.tsx';
import CompletionScreen from './CompletionScreen.tsx';
import BonusChapter from './BonusChapter.tsx';
import { playCelebration, stopCelebration } from './completion-audio.ts';
import { makeReadingPages } from './pagination.ts';
import { stopFeedback } from './feedback-audio.ts';
import './style.css';
import './play.css';
import './paged-reader.css';
import './parallel-chapters.css';

const STORAGE_KEY = 'republic-reading-v2';
const SCREEN_KEY = 'republic-screen-v6';
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八'];
type Screen = 'home' | 'read' | 'chapter-end' | 'review' | 'complete' | 'bonus';
type Panel = 'contents' | 'settings' | 'source' | null;
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
  const [audio, setAudio] = useState<AudioPreferences>(() => {
    try { const saved = JSON.parse(localStorage.getItem('republic-feedback-audio') || '{}'); return { sound: saved.sound !== false, voice: saved.voice !== false }; }
    catch { return { sound: true, voice: true }; }
  });
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [locationVersion, setLocationVersion] = useState(0);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [reviewSession, setReviewSession] = useState(0);
  const [reviewReturn, setReviewReturn] = useState<Exclude<Screen, 'review'>>('home');
  const saveRef = useRef(save);
  const corpusRef = useRef(corpus);
  const screenRef = useRef(screen);
  const restoringScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readerTop = useRef<HTMLDivElement>(null);

  saveRef.current = save;
  corpusRef.current = corpus;
  screenRef.current = screen;

  useEffect(() => {
    stopFeedback();
    try { localStorage.setItem('republic-feedback-audio', JSON.stringify(audio)); } catch { /* Reading still works without preference persistence. */ }
  }, [audio]);
  useEffect(() => { stopFeedback(); }, [screen, panel, save?.cursor]);
  useEffect(() => { if (screen !== 'complete' || panel || !audio.voice) stopCelebration(); }, [screen, panel, audio.voice]);
  useEffect(() => {
    if (!save || screen === 'review' || screen === 'chapter-end') return;
    try { localStorage.setItem(SCREEN_KEY, screen); } catch { /* Progress export remains available. */ }
  }, [screen, Boolean(save)]);
  useEffect(() => {
    const stopWhenHidden = () => { if (document.hidden) stopFeedback(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => { document.removeEventListener('visibilitychange', stopWhenHidden); stopFeedback(); };
  }, []);

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
        if (restored?.started) {
          let preferred = '';
          try { preferred = localStorage.getItem(SCREEN_KEY) ?? ''; } catch { /* Resume reading by default. */ }
          setScreen(preferred === 'home' ? 'home' : (preferred === 'complete' || preferred === 'bonus') && allChaptersComplete(restored, flattenCorpus(data)) ? preferred : 'read');
        }
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
        const prev = saveRef.current;
        if (!prev || prev.cursor !== cursor || !corpusRef.current) return;
        const updated = setScrollPosition(prev, flattenCorpus(corpusRef.current)[cursor], Math.max(0, Math.round(window.scrollY)));
        saveRef.current = updated;
        setSave(updated);
      }, 220);
    };
    const flush = () => {
      const current = saveRef.current;
      if (!current) return;
      const updated = screenRef.current === 'read' && !restoringScroll.current && corpusRef.current ? setScrollPosition(current, flattenCorpus(corpusRef.current)[current.cursor], Math.max(0, Math.round(window.scrollY))) : current;
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
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(releaseFrame); };
  }, [screen, save?.cursor, corpus, locationVersion]);

  if (error) return <main className="loading"><BookOpen size={28} /><h1>理想国</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>重新加载</button></main>;
  if (!corpus || !save) return <main className="loading" role="status"><BookOpen size={28} /><p>正在打开《理想国》……</p></main>;

  const units = flattenCorpus(corpus);
  const unit = units[save.cursor];
  const question = unit.question;
  const totalQuestions = units.filter(u => u.question).length;
  const characterCount = units.reduce((n, u) => n + [...u.paragraphs, ...(u.question ? [u.question.original] : []), ...u.response].reduce((a, p) => a + p.text.length, 0), 0);
  const firstOfChapter = units.findIndex(u => u.chapter.id === unit.chapter.id) === save.cursor;
  const lastOfChapter = save.cursor === units.length - 1 || units[save.cursor + 1].chapter.id !== unit.chapter.id;
  const chapterNumber = unit.chapterIndex + 1;
  const overall = progressStats(units, save);
  const pages = makeReadingPages(unit);
  const pageIndex = pagePosition(save, unit);
  const page = pages[pageIndex];
  const roles = passageRoles(corpus);
  const resolved = question ? isQuestionResolved(save, question) : true;
  const followingPage = pages[pageIndex + 1];
  const preloadPageId = page.kind === 'text' && followingPage?.kind === 'text' && page.side === followingPage.side ? followingPage.id : undefined;
  const latestIndex = latestUnitIndex(save, units);
  const revisiting = save.cursor < latestIndex;
  const complete = allChaptersComplete(save, units);
  const completedChapters = corpus.chapters.filter(chapter => getChapterProgress(save, chapter.id).completed === units.filter(u => u.chapter.id === chapter.id).length).length;
  const update = (fn: (s: Save) => Save) => {
    const current = saveRef.current;
    if (!current) return;
    const updated = { ...fn(current), updatedAt: new Date().toISOString() };
    saveRef.current = updated;
    setSave(updated);
    return updated;
  };
  const rememberScroll = (s: Save) => screenRef.current === 'read' && !restoringScroll.current && !panel ? setScrollPosition(s, units[s.cursor], Math.max(0, Math.round(window.scrollY))) : s;
  const openPanel = (nextPanel: Exclude<Panel, null>) => { update(rememberScroll); setPanel(nextPanel); };
  const chooseChapter = (chapterId: string) => {
    update(s => enterChapter(rememberScroll(s), units, chapterId));
    setLocationVersion(version => version + 1);
    setSummaryId(null); setPanel(null); setScreen('read');
  };
  const goTo = (index: number) => {
    update(s => { const moved = navigate(rememberScroll(s), units, index); return setPagePosition(moved, units[moved.cursor], pagePosition(moved, units[moved.cursor])); });
    setLocationVersion(version => version + 1);
    setSummaryId(null);
    setPanel(null);
    setScreen('read');
  };
  const start = () => chooseChapter(unit.chapter.id);
  const goHome = () => {
    update(rememberScroll);
    setPanel(null); setScreen('home');
  };
  const openCompletion = () => { if (!complete) return; update(rememberScroll); setPanel(null); setScreen('complete'); if (audio.voice) playCelebration(); };
  const openBonus = () => { if (!complete) return; update(rememberScroll); setPanel(null); setScreen('bonus'); };
  const startReview = (chapterId?: string) => {
    const ids = reviewQueue(units, save, 5, chapterId);
    if (!ids.length) { setNotice('读完并回答第一问后，就可以开始重练。'); return; }
    update(rememberScroll);
    setReviewReturn(screen === 'review' ? 'read' : screen);
    setReviewIds(ids);
    setReviewSession(n => n + 1);
    setPanel(null);
    setScreen('review');
  };
  const turnPage = (index: number) => {
    stopFeedback();
    update(s => s.cursor !== unit.index || pagePosition(s, unit) !== pageIndex ? s : setPagePosition(s, unit, index));
    setLocationVersion(value => value + 1);
    requestAnimationFrame(() => readerTop.current?.focus({ preventScroll: true }));
  };
  const next = () => {
    stopFeedback();
    if (screenRef.current !== 'read' || pageIndex < pages.length - 1 || !resolved) return;
    const current = saveRef.current;
    if (!current || current.cursor !== unit.index || pagePosition(current, unit) !== pageIndex) return;
    const previouslyComplete = allChaptersComplete(current, units);
    const advanced = update(s => advance(setPagePosition(s, unit, pageIndex), units));
    if (advanced && !previouslyComplete && allChaptersComplete(advanced, units)) {
      screenRef.current = 'complete';
      setScreen('complete');
      if (audio.voice) playCelebration();
    } else if (lastOfChapter) { screenRef.current = 'chapter-end'; setSummaryId(unit.chapter.id); setScreen('chapter-end'); }
  };
  const attemptQuestion = (choiceId: string) => {
    if (!question) return;
    update(s => s.cursor !== unit.index || pagePosition(s, unit) !== pageIndex ? s : isQuestionResolved(s, question) ? recordReview(s, units, question.id, choiceId) : submitAnswer(setPagePosition(s, unit, pageIndex), unit, choiceId));
  };
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
      saveRef.current = imported;
      setLocationVersion(version => version + 1);
      setSummaryId(null);
      setPanel(null);
      setScreen(allChaptersComplete(imported, units) ? Object.keys(imported.bonus.choices).length ? 'bonus' : 'complete' : imported.started ? 'read' : 'home');
      setNotice('已恢复导入的阅读进度。');
    } catch (e) { setNotice(e instanceof Error ? e.message : '无法读取进度文件。'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const summary = corpus.chapters.find(c => c.id === summaryId) ?? unit.chapter;
  const summaryStats = chapterStats(summary, save);
  return <div className="app" style={{ '--reading-font-size': `${save.settings.fontSize}px` } as CSSProperties}>
    <a className="skip-link" href="#main">跳到正文</a>
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={goHome} aria-label="返回首页"><BookOpen size={23} /><span>理想国<small>苏格拉底的下一问</small></span></button>
      <nav aria-label="阅读工具">{overall.answered > 0 && screen !== 'review' && screen !== 'bonus' && <button onClick={() => startReview()}><RotateCcw size={17} /><span>重练</span></button>}<button onClick={() => openPanel('contents')}><List size={18} /><span>目录</span></button><button onClick={() => openPanel('settings')}><Settings2 size={18} /><span>阅读设置</span></button></nav>
    </div>{screen === 'read' && <div className="progress-track" aria-label={`已读${Math.round(save.completed / units.length * 100)}%`}><span style={{ width: `${save.completed / units.length * 100}%` }} /></div>}</header>

    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><X size={16} /></button></div>}

    {screen === 'home' && <main id="main" className="home">
      <section className="hero"><p className="eyebrow">柏拉图 · 原典互动阅读</p><h1>苏格拉底的<span>下一问</span></h1>
        <p className="hero-description">沿着《理想国》逐页阅读，在关键处选择更好的追问。<br className="desktop-break" />八个主题，任选一章开始；每章都记得你读到了哪里。</p>
        <p className="play-rules">翻一页原文 · 选一个问题 · 听解释 · 再想一步</p>
        <div className="hero-actions"><button className="primary" onClick={start}>{save.started ? '继续阅读' : '开始阅读'}<ArrowRight size={19} /></button>{save.started && <span className="resume-note">第{numerals[unit.chapterIndex]}章 · {unit.section.title}</span>}</div>
        {revisiting && <button className="text-button latest-home" onClick={() => goTo(latestIndex)}>回到最新进度 <ArrowRight size={15} /></button>}
        <div className="book-facts"><span>第一至四卷</span><span>{corpus.chapters.length} 个主题章</span><span>{totalQuestions} 次追问</span><span>约 {(characterCount / 10000).toFixed(1)} 万字</span></div>
      </section>
      {save.started && <section className="journey-panel" aria-label="我的进度">
        <div className="journey-counts"><p><strong>{overall.answered}<small> / {overall.total}</small></strong><span>已遇到的追问</span></p><p><strong>{overall.correct}</strong><span>首次选中原问</span></p><p><strong>{overall.remainingReview}</strong><span>待重练</span></p></div>
        {overall.answered > 0 && <div className="round-invitation"><div><h2>{overall.remainingReview ? '再试试那些没选中的问题' : '换个顺序，再想一轮'}</h2><p>每轮最多五问，先练尚未选中的题。随时返回原来的阅读位置。</p></div><button onClick={() => startReview()}><RotateCcw size={16} /> 开始一轮重练</button></div>}
      </section>}
      <section className="home-contents" aria-labelledby="contents-title"><div className="section-heading"><h2 id="contents-title">从日常判断，读到城邦与灵魂</h2><p>八章并列开放 · 已完成 {completedChapters} / 8 章。切换章节时，页码、答题与书签都会保留。</p></div>
        <ChapterCards corpus={corpus} units={units} save={save} onEnter={chooseChapter} />
      </section>
      {complete ? <section className="home-unlock"><Check size={23} /><div><h2>八章已读完 · 新的对话已开启</h2><p>回看阅读足迹，或进入隐藏章节《苏格拉底之死》。</p></div><button className="primary" onClick={openCompletion}>查看八章总结 <ArrowRight size={17} /></button></section> : <p className="unlock-hint">完成全部八章后，一段隐藏的对话将为你开启。<span>{completedChapters} / 8</span></p>}
      <footer className="home-footer"><p>{corpus.edition.label}</p><button className="text-button" onClick={() => openPanel('source')}>底本与阅读说明 <ChevronRight size={15} /></button><p className="small">进度保存在当前浏览器中。无需登录。</p></footer>
    </main>}

    {screen === 'read' && <main id="main" className="reading-shell paged-reading" ref={readerTop} tabIndex={-1}>
      {revisiting && <div className="return-latest"><span>正在回看已读内容</span><button className="text-button" onClick={() => goTo(latestIndex)}>回到最新进度 <ArrowRight size={15} /></button></div>}
      <div className="reading-location"><button className="text-button" onClick={() => openPanel('contents')}>第{numerals[unit.chapterIndex]}章 · {unit.chapter.title}</button><button className={`icon-button bookmark-button ${save.bookmarks.includes(unit.id) ? 'bookmarked' : ''}`} aria-label={save.bookmarks.includes(unit.id) ? '移除书签' : '添加书签'} title="书签" onClick={() => update(s => ({ ...s, bookmarks: s.bookmarks.includes(unit.id) ? s.bookmarks.filter(id => id !== unit.id) : [...s.bookmarks, unit.id] }))}><Bookmark size={19} fill={save.bookmarks.includes(unit.id) ? 'currentColor' : 'none'} /></button></div>
      {firstOfChapter && pageIndex === 0 && <section className="chapter-intro"><p className="eyebrow">第{numerals[unit.chapterIndex]}章 / {corpus.chapters.length}章</p><h1>{unit.chapter.title}</h1><p>{unit.chapter.range}</p></section>}
      <div className="reading-section-heading"><h2>{unit.section.title}</h2><span>{unit.section.range}</span></div>
      <div className="page-position" aria-label="当前阅读页"><span>{page.kind === 'question' ? '追问时刻' : '原文阅读'}</span><span>本节 {pageIndex + 1} / {pages.length} 页</span><progress value={pageIndex + 1} max={pages.length} /></div>
      <ComicScene chapterId={unit.chapter.id} pageId={page.id} nextPageId={preloadPageId} compact={page.kind === 'question'} />
      <article className="reading-text page-content" aria-label="原典正文" key={unit.id + ':' + pageIndex} data-page-index={pageIndex} data-page-kind={page.kind}>
        {page.kind === 'text' ? <div className="text-page">{page.paragraphs.map(fragment => <ReadingPassage key={fragment.id} paragraph={fragment} sourceId={fragment.sourceId} role={roles.get(fragment.sourceId)} continuation={fragment.fragmentIndex > 0} />)}</div> : <QuestionChallenge question={page.question} seed={save.seed} resolved={resolved} onAttempt={attemptQuestion} onContinue={() => turnPage(pageIndex + 1)} audio={audio} />}
      </article>
      <footer className="reading-navigation page-navigation"><button className="text-button" disabled={pageIndex === 0 && firstOfChapter} onClick={() => pageIndex > 0 ? turnPage(pageIndex - 1) : goTo(save.cursor - 1)}><ArrowLeft size={17} />上一页</button>
        {page.kind === 'text' && (pageIndex < pages.length - 1 ? <button className="primary" onClick={() => turnPage(pageIndex + 1)} data-testid="next-page">{pages[pageIndex + 1].kind === 'question' ? '试着问一问' : '下一页'}<ArrowRight size={18} /></button> : <button className="primary" onClick={next} data-testid="next-unit">{lastOfChapter ? '完成本章' : '继续下一节'}<ArrowRight size={18} /></button>)}
        {page.kind === 'question' && !resolved && <span className="reading-pause">选对问题，再继续原文。</span>}
      </footer>
      <div className="reading-footnote"><span>第{chapterNumber}章 · 阅读位置 {units.filter(u => u.chapter.id === unit.chapter.id && u.index <= save.cursor).length} / {units.filter(u => u.chapter.id === unit.chapter.id).length}</span><button className="text-button" onClick={() => openPanel('source')}>底本说明</button></div>
    </main>}

    {screen === 'chapter-end' && <main id="main" className="chapter-end"><p className="eyebrow">本章已读完</p><h1>{summary.title}</h1><p className="chapter-conclusion">{summary.range}</p>
      <div className="chapter-score"><div><strong>{summaryStats.correct}<span> / {summaryStats.total}</span></strong><p>首次答对</p></div><p>直接揭示 {summaryStats.revealed} 题</p></div>
      <div className="chapter-round"><p>本章的讨论已读完。可以任选其他章节，也可以把这一章的追问再练一轮。</p><button onClick={() => startReview(summary.id)}><RotateCcw size={16} /> 重练本章</button></div>
      <h2>再看一眼这些追问</h2><div className="review-questions">{units.filter(u => u.chapter.id === summary.id && u.question).map(u => <button key={u.id} onClick={() => goTo(u.index)}><span>{u.question!.sourceRef}</span><strong>{u.question!.original.text}</strong><ArrowRight size={17} /></button>)}</div>
      <p className="end-note">八章已完成 {completedChapters} / 8。每一章的阅读与作答记录都会各自保留。</p>
      <div className="completion-actions"><button className="primary" onClick={goHome}>选择其他章节 <BookOpen size={18} /></button>{complete && <button onClick={openCompletion}>查看八章总结 <ArrowRight size={18} /></button>}</div>
    </main>}

    {screen === 'complete' && complete && <CompletionScreen corpus={corpus} units={units} save={save} onBonus={openBonus} onHome={goHome} onReview={() => startReview()} onChapter={chooseChapter} onEnableVoice={() => setAudio(value => ({ ...value, voice: true }))} />}
    {screen === 'bonus' && complete && <BonusChapter save={save} units={units} onUpdate={update} onExit={() => setScreen('complete')} />}

    {screen === 'review' && <ReviewRound key={reviewSession} corpus={corpus} save={save} questionIds={reviewIds} onAnswer={(id, choiceId) => update(s => recordReview(s, units, id, choiceId))} onClose={() => setScreen(reviewReturn)} audio={audio} returnLabel={reviewReturn === 'home' ? '返回首页' : reviewReturn === 'chapter-end' ? '返回本章小结' : reviewReturn === 'complete' ? '返回八章总结' : '返回阅读'} />}

    {panel && <Modal title={panel === 'contents' ? '阅读目录' : panel === 'settings' ? '阅读设置' : '底本与阅读说明'} onClose={() => setPanel(null)}>
      {panel === 'contents' && <><p className="panel-intro">八章可自由选择，每章内部沿原文顺序阅读。切换章节不会覆盖任何其他章节的记录。</p>
        {save.started && <div className="toc-current"><button onClick={() => goTo(latestIndex)}>回到本章最新进度<small>{units[latestIndex].chapter.title} · {units[latestIndex].section.title}</small></button></div>}
        {save.bookmarks.length > 0 && <section className="bookmark-list"><h3>我的书签</h3>{save.bookmarks.map(id => { const u = units.find(u => u.id === id)!; return <button key={id} onClick={() => goTo(u.index)}><Bookmark size={15} />{u.chapter.title} · {u.section.title}</button>; })}</section>}
        {complete && <div className="toc-current"><button onClick={openCompletion}>八章总结 · 已解锁隐藏章节<small>苏格拉底之死</small></button></div>}<ol className="toc">{corpus.chapters.map((chapter, ci) => <li key={chapter.id}><h3><button className="toc-chapter-entry" onClick={() => chooseChapter(chapter.id)} data-testid={`toc-chapter-${chapter.id}`}><span>{String(ci + 1).padStart(2, '0')}</span>{chapter.title}<small>{getChapterProgress(save, chapter.id).started ? '继续本章' : '开始本章'} <ArrowRight size={14} /></small></button></h3><p>{chapter.range}</p><ul>{chapter.sections.map(section => {
          const index = units.findIndex(u => u.chapter.id === chapter.id && u.section.id === section.id);
          const accessible = isUnitAccessible(save, units[index]);
          return <li key={section.id}><button disabled={!accessible} onClick={() => goTo(index)}>{section.title}{accessible ? <ChevronRight size={16} /> : <small>本章尚未读到</small>}</button></li>;
        })}</ul></li>)}</ol></>}
      {panel === 'settings' && <div className="settings-panel"><section><h3>正文字号</h3><div className="font-control"><button aria-label="减小字号" disabled={save.settings.fontSize <= 16} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.max(16, s.settings.fontSize - 2) } }))}>A−</button><output>{save.settings.fontSize}px</output><button aria-label="增大字号" disabled={save.settings.fontSize >= 32} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.min(32, s.settings.fontSize + 2) } }))}>A＋</button></div><p className="font-sample">从一个更好的问题，开始一段更清楚的思考。</p></section>
        <section><h3>声音反馈</h3><div className="audio-setting"><span>选项解释与通关祝贺 · 普通话</span><button aria-pressed={audio.voice} onClick={() => setAudio(value => ({ ...value, voice: !value.voice }))}>{audio.voice ? '已开启' : '已关闭'}</button></div><div className="audio-setting"><span>答对、答错提示音</span><button aria-pressed={audio.sound} onClick={() => setAudio(value => ({ ...value, sound: !value.sound }))}>{audio.sound ? '已开启' : '已关闭'}</button></div><p>确认选择后播放解释，完成八章时播放祝贺。离开对应页面时停止。</p></section>
        <section><h3>阅读背景</h3><div className="segmented">{(['paper', 'night'] as const).map(theme => <button key={theme} aria-pressed={save.settings.theme === theme} onClick={() => update(s => ({ ...s, settings: { ...s.settings, theme } }))}>{theme === 'paper' ? '纸色' : '夜间'}</button>)}</div></section>
        <section><h3>进度备份</h3><p>八章各自的阅读位置、首次作答、重练、书签及隐藏章节进度保存在本机。换浏览器前，可以导出一份备份。</p><div className="backup-actions"><button onClick={exportProgress}>导出进度</button><button onClick={() => fileRef.current?.click()}>导入进度</button><input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="选择进度文件" onChange={e => importProgress(e.target.files?.[0])} /></div></section>
        <section>{confirmReset ? <><p>重新开始会清除本浏览器中的阅读与答题记录。可以先导出备份。</p><div className="backup-actions"><button onClick={() => { saveRef.current = createSave(corpus); setSave(saveRef.current); setScreen('home'); setPanel(null); setConfirmReset(false); }}>确认重新开始</button><button onClick={() => setConfirmReset(false)}>保留进度</button></div></> : <button className="text-button" onClick={() => setConfirmReset(true)}>重新开始阅读</button>}</section>
      </div>}
      {panel === 'source' && <div className="source-panel"><p className="eyebrow">柏拉图 · 理想国</p><h3>{corpus.edition.label}</h3><p>{corpus.edition.description}</p><p>译文：{corpus.edition.translator}</p><ul>{corpus.edition.notes.map(note => <li key={note}>{note}</li>)}</ul><p>{corpus.edition.license}</p><a href={corpus.edition.sourceUrl} target="_blank" rel="noreferrer">出版社书目信息 ↗</a><p><a href={`${import.meta.env.BASE_URL}text/parallel.html`} target="_blank" rel="noreferrer">书页与连续全文（含后文） ↗</a> · <a href={`${import.meta.env.BASE_URL}TEXT-LICENSE.txt`} target="_blank" rel="noreferrer">署名与文本说明 ↗</a></p><hr /><h3>关于追问练习</h3><p>原问对应选项取自本译本；另两项是围绕同一对象、条件或关系作的小幅改写。作答后揭示原句，说明它怎样承接本段对话。选项比较与说明属于编辑文字。</p><p>所有选择都接回相同的原典。八个主题章可独立进入；每章内部的原文、对话次序及后续论证保持不变。隐藏章节另据《申辩篇》《克里同篇》《斐多篇》作场景化改写，逐场注明来源，不属于本译本正文。</p></div>}
    </Modal>}
  </div>;
}
