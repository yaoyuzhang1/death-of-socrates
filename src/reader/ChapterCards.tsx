import { ArrowRight, Check } from 'lucide-react';
import type { Chapter, Corpus, ReadingUnit, Save } from './model.ts';
import { chapterStats, getChapterProgress } from './engine.ts';
import checks from '../../content/learning/checks.json';
import type { StudyRecords } from './learning.ts';
import { GUIDE_THEMES, guideForChapter, textLengthLabel } from './reading-guide.ts';

export default function ChapterCards({ corpus, chapters = corpus.chapters, units, save, study, onEnter }: { corpus: Corpus; chapters?: Chapter[]; units: ReadingUnit[]; save: Save; study: StudyRecords; onEnter: (chapterId: string) => void }) {
  return <div className="chapter-grid parallel-chapters">{chapters.map(chapter => {
    const index = corpus.chapters.findIndex(item => item.id === chapter.id);
    const guide = guideForChapter(chapter);
    const progress = getChapterProgress(save, chapter.id);
    const count = units.filter(unit => unit.chapter.id === chapter.id).length;
    const done = progress.completed === count;
    const stats = chapterStats(chapter, save);
    const pauses = checks.filter(check => check.chapterId === chapter.id);
    return <article className="guided-chapter" key={chapter.id}><button className={`chapter-row${done ? ' chapter-done' : ''}`} data-testid={`chapter-entry-${chapter.id}`} onClick={() => onEnter(chapter.id)}>
      <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
      <span className="chapter-label"><strong>{chapter.title}</strong><small>{chapter.range} · {textLengthLabel(chapter)}</small>
        <span className="chapter-progress-caption">{done ? '已完成' : progress.started ? `已读 ${progress.completed} / ${count} 节` : '随时可以开始'} · 追问 {stats.answered} / {stats.total}</span>
        {pauses.length > 0 && <span className="chapter-progress-caption">理解检查 {pauses.filter(check => study[check.id]?.correct).length} / {pauses.length}</span>}
        <progress value={progress.completed} max={count} aria-label={`${chapter.title}已读${progress.completed}节，共${count}节`} />
      </span>
      <span className="chapter-mark">{done ? <Check size={18} /> : <ArrowRight size={17} />}<small>{done ? '回看' : progress.started ? '继续' : '开始'}</small></span>
    </button><p className="chapter-focus">{guide.focus}</p><div className="chapter-topics" aria-label="本章主题">{guide.themes.map(id => <span key={id}>{GUIDE_THEMES.find(theme => theme.id === id)?.label ?? id}</span>)}</div></article>;
  })}</div>;
}
