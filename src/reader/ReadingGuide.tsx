import { useState } from 'react';
import { ArrowRight, BookOpen, Compass, Route } from 'lucide-react';
import type { Chapter, Corpus, ReadingUnit, Save } from './model.ts';
import type { StudyRecords } from './learning.ts';
import ChapterCards from './ChapterCards.tsx';
import { BOOK_GUIDES, GUIDE_THEMES, READING_GUIDE, chapterNumeral, guideForChapter } from './reading-guide.ts';
import './reading-guide.css';
import { CHAPTER_GROUPS, chapterCover, chapterGroup } from './chapter-visuals.ts';
import './chapter-identity.css';

export function ReaderIntroduction() {
  return <details className="reader-introduction compact-introduction"><summary><BookOpen size={16} />初次阅读？人物、术语与玩法</summary><div className="compact-introduction-body">
    <p className="editor-label">{READING_GUIDE.label}</p>
    <h2 id="reader-introduction-title">正义的生活，本身值得选择吗？</h2>
    <p>{READING_GUIDE.opening}</p>
    <details className="guide-details"><summary><BookOpen size={16} />第一次读？人物与玩法</summary><div className="guide-details-body">
      <h3>谁在说话</h3><dl className="guide-people">{READING_GUIDE.people.map(person => <div key={person.name}><dt>{person.name}</dt><dd>{person.description}</dd></div>)}</dl>
      <h3>怎样读、怎样选</h3><ol className="guide-howto">{READING_GUIDE.howToRead.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="guide-boundary">人物对白来自所标底本；导引、候选改写和作答说明为编辑内容。原典中的主张与课堂上对它的评价可以分开讨论。</p>
    </div></details>
    <details className="guide-details guide-terms"><summary>几个常见词，怎样先读懂</summary><div className="guide-details-body"><p className="editor-label">编辑释义 · 具体用法以当前原文为准</p><dl className="guide-people">{READING_GUIDE.terms.map(term => <div key={term.name}><dt>{term.name}</dt><dd>{term.description}</dd></div>)}</dl></div></details>
  </div></details>;
}

export function ChapterExplorer({ corpus, units, save, study, onEnter }: {
  corpus: Corpus; units: ReadingUnit[]; save: Save; study: StudyRecords; onEnter: (id: string) => void;
}) {
  const [mode, setMode] = useState<'group' | 'order' | 'theme'>('group');
  const [groupId, setGroupId] = useState(() => chapterGroup(units[save.cursor]?.chapter.id ?? corpus.chapters[0].id).id as string);
  const [theme, setTheme] = useState('all');
  const [book, setBook] = useState<number | null>(null);
  const availableBooks = BOOK_GUIDES.filter(guide => corpus.chapters.some(chapter => guideForChapter(chapter).books.includes(guide.number)));
  const group = CHAPTER_GROUPS.find(item => item.id === groupId) ?? CHAPTER_GROUPS[0];
  const visible = corpus.chapters.filter(chapter => mode === 'group' ? (group.chapters as readonly string[]).includes(chapter.id) : mode === 'theme' ? theme === 'all' || guideForChapter(chapter).themes.includes(theme) : book === null || guideForChapter(chapter).books.includes(book));
  const selectedBook = availableBooks.find(guide => guide.number === book);
  const routeIds = new Set(corpus.chapters.map(chapter => chapter.id));
  return <div className="chapter-explorer" data-testid="chapter-explorer">
    <div className="chapter-group-tabs" role="group" aria-label="分组浏览章节">{CHAPTER_GROUPS.map(item => <button key={item.id} aria-pressed={mode === 'group' && groupId === item.id} data-testid={`chapter-group-${item.id}`} onClick={() => { setMode('group'); setGroupId(item.id); }}><small>{item.range}</small>{item.label}</button>)}</div>
    {mode === 'group' && <div className="chapter-group-heading"><h3>{group.title}</h3><p>{group.description}</p></div>}
    <details className="chapter-find-more"><summary><Compass size={15} />按卷或主题查找</summary><div className="guide-controls"><div className="guide-mode" role="group" aria-label="章节选择方式"><button aria-pressed={mode === 'order'} onClick={() => setMode('order')}><BookOpen size={16} />按原典顺序</button><button aria-pressed={mode === 'theme'} onClick={() => setMode('theme')}><Compass size={16} />按兴趣主题</button></div>
      {mode === 'theme' ? <div className="guide-filters" role="group" aria-label="按主题选择"><button aria-pressed={theme === 'all'} onClick={() => setTheme('all')}>全部主题</button>{GUIDE_THEMES.map(item => <button key={item.id} aria-pressed={theme === item.id} onClick={() => { setMode('theme'); setTheme(item.id); }}>{item.label}</button>)}</div>
      : <div className="guide-filters" role="group" aria-label="按卷选择"><button aria-pressed={mode === 'order' && book === null} onClick={() => { setMode('order'); setBook(null); }}>全部章节</button>{availableBooks.map(item => <button key={item.number} aria-pressed={mode === 'order' && book === item.number} onClick={() => { setMode('order'); setBook(item.number); }}>第{chapterNumeral(item.number)}卷</button>)}</div>}
    </div></details>
    {mode === 'order' && selectedBook && <section className="book-guide" aria-label={`第${chapterNumeral(selectedBook.number)}卷导引`}><p className="editor-label">编辑导引 · 第{chapterNumeral(selectedBook.number)}卷 · {selectedBook.range}</p><h3>{selectedBook.title}</h3><p>{selectedBook.question}</p><details><summary>前文背景</summary><p className="guide-boundary">{selectedBook.before}</p></details></section>}
    <p className="guide-result-count" role="status">显示 {visible.length} / {corpus.chapters.length} 章 · 全部可自由进入</p>
    <ChapterCards corpus={corpus} chapters={visible} units={units} save={save} study={study} onEnter={onEnter} />
    <details className="guide-details recommended-routes"><summary><Route size={16} />选一条短阅读路线</summary><div className="guide-routes">
      {READING_GUIDE.routes.map(route => <article key={route.id}><h3>{route.title}</h3><p>{route.description}</p><ol>{route.chapters.filter(id => routeIds.has(id)).map(id => {
        const chapter = corpus.chapters.find(item => item.id === id)!;
        return <li key={id}><button onClick={() => onEnter(id)}>{chapter.title}<ArrowRight size={15} /></button></li>;
      })}</ol></article>)}
      <p className="guide-boundary">路线是阅读建议，不是必修关卡。每次可以只读一章，也可以直接选择感兴趣的主题。</p>
    </div></details>
  </div>;
}

export function ChapterOpening({ chapter, headingLevel = 2 }: { chapter: Chapter; headingLevel?: 1 | 2 }) {
  const guide = guideForChapter(chapter);
  const cover = chapterCover(chapter.id);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return <section className="chapter-guide chapter-identity chapter-identity-opening" aria-label="本章阅读导引" data-testid={`chapter-guide-${chapter.id}`}>
    <figure className="chapter-identity-art">
      <img src={`${import.meta.env.BASE_URL}illustrations/${cover.file}`} alt={cover.alt} width={1672} height={941} decoding="async" />
      <span className="chapter-identity-number" aria-hidden="true">{String(cover.number).padStart(2, '0')}</span>
      <figcaption>{cover.note ?? (cover.kind === 'example' ? '谈话中的图景' : '本章插画')}</figcaption>
    </figure>
    <div className="chapter-identity-body">
      <p className="chapter-identity-kicker">第{chapterNumeral(cover.number)}章 <span>{chapter.range}</span></p>
      <Heading className="chapter-identity-title">{chapter.title}</Heading>
      <p className="chapter-identity-focus"><small className="chapter-identity-editor">编辑导引</small>{guide.focus}</p>
      <details className="guide-details chapter-identity-details"><summary><BookOpen size={16} />展开阅读导引</summary><div className="chapter-identity-detail-body">
        <p className="editor-label">编辑导引 · 不属于原典对白</p><p>{guide.before}</p>
        <h3>阅读时可以留意什么</h3><p>{guide.watch}</p>
      </div></details>
    </div>
  </section>;
}

export function ChapterRecap({ chapter, chapters, onEnter }: { chapter: Chapter; chapters: Chapter[]; onEnter: (id: string) => void }) {
  const guide = guideForChapter(chapter);
  const cover = chapterCover(chapter.id);
  const next = chapters[chapters.findIndex(item => item.id === chapter.id) + 1];
  return <section className="chapter-recap chapter-identity chapter-identity-recap" aria-labelledby="chapter-recap-title" data-testid={`chapter-recap-${chapter.id}`}>
    <figure className="chapter-identity-art">
      <img src={`${import.meta.env.BASE_URL}illustrations/${cover.file}`} alt={cover.alt} width={1672} height={941} decoding="async" />
      <span className="chapter-identity-number" aria-hidden="true">{String(cover.number).padStart(2, '0')}</span>
      <figcaption>{cover.note ?? (cover.kind === 'example' ? '谈话中的图景' : '本章插画')}</figcaption>
    </figure>
    <div className="chapter-identity-body">
      <p className="chapter-identity-kicker">第{chapterNumeral(cover.number)}章已读完 <span>{chapter.range}</span></p>
      <h1 className="chapter-identity-title" id="chapter-recap-title">{chapter.title}</h1>
      <p className="chapter-identity-focus"><small className="chapter-identity-editor">编辑回顾</small>{guide.open}</p>
      <details className="guide-details chapter-identity-details"><summary>回看这段讨论</summary><div className="chapter-identity-detail-body">
        <p className="editor-label">编辑回顾 · 不属于原典对白</p><h2>这段讨论怎样推进</h2>
        <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </div></details>
      {next && <button className="chapter-identity-next text-button" onClick={() => onEnter(next.id)}><span><small>下一段讨论</small>{next.title}</span><ArrowRight size={18} /></button>}
    </div>
  </section>;
}
