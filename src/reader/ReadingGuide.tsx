import { useState } from 'react';
import { ArrowRight, BookOpen, Compass, Route } from 'lucide-react';
import type { Chapter, Corpus, ReadingUnit, Save } from './model.ts';
import type { StudyRecords } from './learning.ts';
import ChapterCards from './ChapterCards.tsx';
import { BOOK_GUIDES, GUIDE_THEMES, READING_GUIDE, chapterNumeral, guideForChapter } from './reading-guide.ts';
import './reading-guide.css';

export function ReaderIntroduction() {
  return <section className="reader-introduction" aria-labelledby="reader-introduction-title">
    <p className="editor-label">{READING_GUIDE.label}</p>
    <h2 id="reader-introduction-title">正义的生活，本身值得选择吗？</h2>
    <p>{READING_GUIDE.opening}</p>
    <details className="guide-details"><summary><BookOpen size={16} />第一次读？人物与玩法</summary><div className="guide-details-body">
      <h3>谁在说话</h3><dl className="guide-people">{READING_GUIDE.people.map(person => <div key={person.name}><dt>{person.name}</dt><dd>{person.description}</dd></div>)}</dl>
      <h3>怎样读、怎样选</h3><ol className="guide-howto">{READING_GUIDE.howToRead.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="guide-boundary">人物对白来自所标底本；导引、候选改写和作答说明为编辑内容。原典中的主张与课堂上对它的评价可以分开讨论。</p>
    </div></details>
    <details className="guide-details guide-terms"><summary>几个常见词，怎样先读懂</summary><div className="guide-details-body"><p className="editor-label">编辑释义 · 具体用法以当前原文为准</p><dl className="guide-people">{READING_GUIDE.terms.map(term => <div key={term.name}><dt>{term.name}</dt><dd>{term.description}</dd></div>)}</dl></div></details>
  </section>;
}

export function ChapterExplorer({ corpus, units, save, study, onEnter }: {
  corpus: Corpus; units: ReadingUnit[]; save: Save; study: StudyRecords; onEnter: (id: string) => void;
}) {
  const [mode, setMode] = useState<'order' | 'theme'>('order');
  const [theme, setTheme] = useState('all');
  const [book, setBook] = useState<number | null>(null);
  const availableBooks = BOOK_GUIDES.filter(guide => corpus.chapters.some(chapter => guideForChapter(chapter).books.includes(guide.number)));
  const visible = corpus.chapters.filter(chapter => mode === 'theme' ? theme === 'all' || guideForChapter(chapter).themes.includes(theme) : book === null || guideForChapter(chapter).books.includes(book));
  const selectedBook = availableBooks.find(guide => guide.number === book);
  const routeIds = new Set(corpus.chapters.map(chapter => chapter.id));
  return <div className="chapter-explorer" data-testid="chapter-explorer">
    <p className="editor-label">主题分章、导引与路线均为编辑内容；各章正文遵循原典顺序。</p>
    <details className="guide-details recommended-routes"><summary><Route size={16} />不知道从哪里开始？选一条短路线</summary><div className="guide-routes">
      {READING_GUIDE.routes.map(route => <article key={route.id}><h3>{route.title}</h3><p>{route.description}</p><ol>{route.chapters.filter(id => routeIds.has(id)).map(id => {
        const chapter = corpus.chapters.find(item => item.id === id)!;
        return <li key={id}><button onClick={() => onEnter(id)}>{chapter.title}<ArrowRight size={15} /></button></li>;
      })}</ol></article>)}
      <p className="guide-boundary">路线是阅读建议，不是必修关卡。每次可以只读一章，也可以直接选择感兴趣的主题。</p>
    </div></details>
    <div className="guide-controls"><div className="guide-mode" role="group" aria-label="章节选择方式"><button aria-pressed={mode === 'order'} onClick={() => setMode('order')}><BookOpen size={16} />按原典顺序</button><button aria-pressed={mode === 'theme'} onClick={() => setMode('theme')}><Compass size={16} />按兴趣主题</button></div>
      {mode === 'order' ? <div className="guide-filters" role="group" aria-label="按卷选择"><button aria-pressed={book === null} onClick={() => setBook(null)}>全部章节</button>{availableBooks.map(item => <button key={item.number} aria-pressed={book === item.number} onClick={() => setBook(item.number)}>第{chapterNumeral(item.number)}卷</button>)}</div>
      : <div className="guide-filters" role="group" aria-label="按主题选择"><button aria-pressed={theme === 'all'} onClick={() => setTheme('all')}>全部主题</button>{GUIDE_THEMES.map(item => <button key={item.id} aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}>{item.label}</button>)}</div>}
    </div>
    {selectedBook && <section className="book-guide" aria-label={`第${chapterNumeral(selectedBook.number)}卷导引`}><p className="editor-label">编辑导引 · 第{chapterNumeral(selectedBook.number)}卷 · {selectedBook.range}</p><h3>{selectedBook.title}</h3><p>{selectedBook.question}</p><p className="guide-boundary">{selectedBook.before}</p></section>}
    <p className="guide-result-count" role="status">显示 {visible.length} / {corpus.chapters.length} 个主题章 · 章节编号保持原典次序</p>
    <ChapterCards corpus={corpus} chapters={visible} units={units} save={save} study={study} onEnter={onEnter} />
  </div>;
}

export function ChapterOpening({ chapter }: { chapter: Chapter }) {
  const guide = guideForChapter(chapter);
  return <section className="chapter-guide" aria-label="本章阅读导引" data-testid={`chapter-guide-${chapter.id}`}>
    <p className="editor-label">编辑导引 · 不属于原典对白</p><h2>{guide.focus}</h2>
    <p>{guide.before}</p><details className="guide-details"><summary>阅读时可以留意什么</summary><p>{guide.watch}</p></details>
  </section>;
}

export function ChapterRecap({ chapter, chapters, onEnter }: { chapter: Chapter; chapters: Chapter[]; onEnter: (id: string) => void }) {
  const guide = guideForChapter(chapter);
  const next = chapters[chapters.findIndex(item => item.id === chapter.id) + 1];
  return <section className="chapter-recap" aria-labelledby="chapter-recap-title" data-testid={`chapter-recap-${chapter.id}`}>
    <p className="editor-label">编辑回顾 · 不属于原典对白</p><h2 id="chapter-recap-title">这段讨论怎样推进</h2>
    <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="guide-open-question">{guide.open}</p>
    {next && <button className="text-button" onClick={() => onEnter(next.id)}>接着读：{next.title}<ArrowRight size={16} /></button>}
  </section>;
}
