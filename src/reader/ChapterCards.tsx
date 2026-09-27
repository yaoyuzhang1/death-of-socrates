import { ArrowRight, Check } from 'lucide-react';
import type { Chapter, Corpus, ReadingUnit, Save } from './model.ts';
import { chapterStats, getChapterProgress } from './engine.ts';
import checks from '../../content/learning/checks.json';
import type { StudyRecords } from './learning.ts';
import { chapterNumeral, guideForChapter, textLengthLabel } from './reading-guide.ts';
import { chapterCover } from './chapter-visuals.ts';

export default function ChapterCards({ corpus, chapters = corpus.chapters, units, save, study, onEnter }: { corpus: Corpus; chapters?: Chapter[]; units: ReadingUnit[]; save: Save; study: StudyRecords; onEnter: (chapterId: string) => void }) {
  return <div className="chapter-grid parallel-chapters">{chapters.map(chapter => {
    const guide = guideForChapter(chapter);
    const cover = chapterCover(chapter.id);
    const progress = getChapterProgress(save, chapter.id);
    const count = units.filter(unit => unit.chapter.id === chapter.id).length;
    const done = progress.completed === count;
    const stats = chapterStats(chapter, save);
    const pauses = checks.filter(check => check.chapterId === chapter.id);
    return <article className="guided-chapter illustrated-chapter" key={chapter.id}>
      <button className={`chapter-card-entry${done ? ' chapter-done' : ''}`} data-testid={`chapter-entry-${chapter.id}`} onClick={() => onEnter(chapter.id)} aria-label={`第${chapterNumeral(cover.number)}章 · ${chapter.title} · ${done ? '回看' : progress.started ? '继续阅读' : '开始阅读'}`}>
        <span className="chapter-card-art"><img src={`${import.meta.env.BASE_URL}illustrations/${cover.file}`} alt={cover.alt} width={1672} height={941} loading="lazy" decoding="async" />
          <span className="chapter-card-number">{String(cover.number).padStart(2, '0')}</span>{cover.kind === 'example' && <span className="chapter-card-image-note">{cover.note ?? '谈话中的图景'}</span>}
        </span>
        <span className="chapter-card-body"><span className="chapter-card-volume">第{guide.books.map(chapterNumeral).join('、')}卷</span><strong>{chapter.title}</strong><span className="chapter-card-focus">{guide.focus}</span>
          <span className="chapter-card-bottom"><span>{done ? '已读完' : progress.started ? `已读 ${Math.round(progress.completed / count * 100)}%` : '尚未开始'}</span><span>{done ? <Check size={16} /> : <ArrowRight size={16} />}{done ? '重访本章' : progress.started ? '继续阅读' : '翻开本章'}</span></span>
          {progress.started && <progress value={progress.completed} max={count} aria-label={`${chapter.title}已读${progress.completed}节，共${count}节`} />}
        </span>
      </button>
      <details className="chapter-card-record"><summary>阅读记录与篇幅</summary><p>{chapter.range} · {textLengthLabel(chapter)}</p><p>已读 {progress.completed} / {count} 节 · 追问 {stats.answered} / {stats.total} · 理解 {pauses.filter(check => study[check.id]?.correct).length} / {pauses.length}</p></details>
    </article>;
  })}</div>;
}
