import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react';
import { stopFeedback } from './feedback-audio.ts';
import './source-viewer.css';

const LAST_PAGE = 176;
type SourceTarget = { page: number; trigger: HTMLAnchorElement; scrollX: number; scrollY: number; fontSize: string };
type NotesByPage = Map<number, string[]>;
type NotesState = { status: 'loading' | 'error' } | { status: 'ready'; pages: NotesByPage };
let cachedNotes: NotesByPage | null = null;

const SourceViewerContext = createContext<((target: SourceTarget) => void) | null>(null);

function notesFromSource(data: unknown): NotesByPage {
  if (!data || typeof data !== 'object' || !('pages' in data) || !Array.isArray(data.pages)) throw new Error('书页数据不完整。');
  const pages = new Map<number, string[]>();
  for (const value of data.pages) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.printedPage) || !Array.isArray(value.notes) || !value.notes.every((note: unknown) => typeof note === 'string')) throw new Error('书页数据不完整。');
    pages.set(value.printedPage, value.notes);
  }
  if (Array.from({ length: LAST_PAGE }, (_, i) => i + 1).some(page => !pages.has(page))) throw new Error('书页数据不完整。');
  return pages;
}

export function SourcePageLink({ page }: { page: number }) {
  const open = useContext(SourceViewerContext);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!open || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !Number.isInteger(page) || page < 1 || page > LAST_PAGE) return;
    event.preventDefault();
    const fontSize = getComputedStyle(event.currentTarget).getPropertyValue('--reading-font-size').trim() || '20px';
    open({ page, trigger: event.currentTarget, scrollX: window.scrollX, scrollY: window.scrollY, fontSize });
  };
  return <a className="source-page" href={`${import.meta.env.BASE_URL}text/parallel.html#p${page}`} target="_blank" rel="noreferrer" title="查看书页与译者注（含本页后文）" onClick={onClick}>书页 {page} ↗</a>;
}

export function SourceViewerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<SourceTarget | null>(null);
  return <SourceViewerContext.Provider value={setTarget}>
    {children}
    {target && <SourceViewer target={target} onClose={() => setTarget(null)} />}
  </SourceViewerContext.Provider>;
}

function SourceViewer({ target, onClose }: { target: SourceTarget; onClose: () => void }) {
  const [page, setPage] = useState(target.page);
  const [zoomed, setZoomed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<{ key: string; status: 'ready' | 'error' } | null>(null);
  const [notes, setNotes] = useState<NotesState>(() => cachedNotes ? { status: 'ready', pages: cachedNotes } : { status: 'loading' });
  const [notesAttempt, setNotesAttempt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const imageKey = `${page}-${imageAttempt}`;
  const imageStatus = imageState?.key === imageKey ? imageState.status : 'loading';
  const pageNotes = notes.status === 'ready' ? notes.pages.get(page) ?? [] : [];
  const imageUrl = `${import.meta.env.BASE_URL}facsimile/page-${String(page).padStart(3, '0')}.webp${imageAttempt ? `?retry=${imageAttempt}` : ''}`;

  useEffect(() => {
    stopFeedback();
    const dialog = dialogRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = originalOverflow;
      if (target.trigger.isConnected) target.trigger.focus({ preventScroll: true });
      window.scrollTo({ left: target.scrollX, top: target.scrollY, behavior: 'instant' });
    };
  }, [target]);

  useEffect(() => {
    if (cachedNotes) return;
    const controller = new AbortController();
    setNotes({ status: 'loading' });
    fetch(`${import.meta.env.BASE_URL}text/parallel.json`, { signal: controller.signal, cache: 'no-cache' })
      .then(response => { if (!response.ok) throw new Error('译者注暂时未能加载。'); return response.json(); })
      .then(data => {
        const pages = notesFromSource(data);
        if (controller.signal.aborted) return;
        cachedNotes = pages;
        setNotes({ status: 'ready', pages });
      })
      .catch(() => { if (!controller.signal.aborted) setNotes({ status: 'error' }); });
    return () => controller.abort();
  }, [notesAttempt]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
  }, [page, imageStatus]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.scrollTo({ left: zoomed ? (stage.scrollWidth - stage.clientWidth) / 2 : 0, top: zoomed ? (stage.scrollHeight - stage.clientHeight) / 2 : 0 });
  }, [zoomed]);

  const turnPage = (next: number) => {
    if (next < 1 || next > LAST_PAGE || next === page) return;
    setPage(next);
    setZoomed(false);
    setImageAttempt(0);
    stageRef.current?.scrollTo({ top: 0, left: 0 });
    bodyRef.current?.scrollTo({ top: 0, left: 0 });
  };

  return <dialog className="source-viewer" ref={dialogRef} tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId} style={{ '--source-reading-font-size': target.fontSize } as CSSProperties}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}
    onKeyDown={event => {
      const element = event.target as HTMLElement;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || element.isContentEditable || element.closest('input, textarea, select')) return;
      if (zoomed && element.closest('.source-viewer-stage')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        turnPage(page + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    }}>
    <header className="source-viewer-heading">
      <div><h2 id={titleId} aria-live="polite">原书第 {page} 页</h2><p id={descriptionId}>本页包含后文</p></div>
      <button type="button" className="icon-button" autoFocus aria-label="关闭原书核对，返回阅读" onClick={onClose}><X size={21} /></button>
    </header>
    <nav className="source-viewer-toolbar" aria-label="原书翻页">
      <div className="source-viewer-pagination">
        <button type="button" onClick={() => turnPage(page - 1)} disabled={page === 1} aria-label="上一书页"><ArrowLeft size={16} /><span>上一页</span></button>
        <span className="source-viewer-counter">{page} / {LAST_PAGE}</span>
        <button type="button" onClick={() => turnPage(page + 1)} disabled={page === LAST_PAGE} aria-label="下一书页"><span>下一页</span><ArrowRight size={16} /></button>
      </div>
      <button type="button" className="source-viewer-zoom" aria-pressed={zoomed} disabled={imageStatus !== 'ready'} onClick={() => setZoomed(!zoomed)}>{zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}{zoomed ? '适配书页' : '放大书页'}</button>
    </nav>
    <div className="source-viewer-body" ref={bodyRef}>
      <div className={`source-viewer-stage${zoomed ? ' source-viewer-stage-zoomed' : ''}`} ref={stageRef} tabIndex={0} aria-label={`原书第 ${page} 页扫描图${zoomed ? '，已放大，可滚动查看' : ''}`}>
        {imageStatus === 'loading' && <p className="source-viewer-status" role="status">正在加载第 {page} 页…</p>}
        {imageStatus === 'error' && <div className="source-viewer-status" role="alert"><p>第 {page} 页扫描图暂时未能加载。</p><button type="button" onClick={() => setImageAttempt(value => value + 1)}>重新加载书页</button></div>}
        <img key={imageKey} src={imageUrl} alt={`郭斌和、张竹明译《理想国》，商务印书馆1986年版，第 ${page} 页扫描图`} width={1428} height={2020} hidden={imageStatus !== 'ready'} draggable={false}
          onLoad={() => setImageState({ key: imageKey, status: 'ready' })} onError={() => setImageState({ key: imageKey, status: 'error' })} />
      </div>
      <section className="source-viewer-notes" aria-labelledby={`${titleId}-notes`}>
        <h3 id={`${titleId}-notes`}>第 {page} 页 · 译者注</h3>
        {notes.status === 'loading' && <p role="status">正在加载译者注…</p>}
        {notes.status === 'error' && <div role="alert"><p>译者注暂时未能加载，可先查看上方扫描图。</p><button type="button" onClick={() => setNotesAttempt(value => value + 1)}>重新加载译者注</button></div>}
        {notes.status === 'ready' && (pageNotes.length ? pageNotes.map((note, index) => <p key={`${page}-${index}`}>{note}</p>) : <p className="source-viewer-empty">本页没有译者注。</p>)}
      </section>
    </div>
    <footer className="source-viewer-footer"><span>左右键翻页 · Esc 返回阅读</span><a href={`${import.meta.env.BASE_URL}text/parallel.html#p${page}`} target="_blank" rel="noreferrer">打开连续全文 <ExternalLink size={13} /></a></footer>
  </dialog>;
}
