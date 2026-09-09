import { ArrowRight, Check } from 'lucide-react';
import type { Corpus, ReadingUnit, Save } from './model.ts';
import { chapterStats, getChapterProgress } from './engine.ts';

export default function ChapterCards({ corpus, units, save, onEnter }: { corpus: Corpus; units: ReadingUnit[]; save: Save; onEnter: (chapterId: string) => void }) {
  return <div className="chapter-grid parallel-chapters">{corpus.chapters.map((chapter, index) => {
    const progress = getChapterProgress(save, chapter.id);
    const count = units.filter(unit => unit.chapter.id === chapter.id).length;
    const done = progress.completed === count;
    const stats = chapterStats(chapter, save);
    return <button className={`chapter-row${done ? ' chapter-done' : ''}`} key={chapter.id} data-testid={`chapter-entry-${chapter.id}`} onClick={() => onEnter(chapter.id)}>
      <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
      <span className="chapter-label"><strong>{chapter.title}</strong><small>{chapter.range}</small>
        <span className="chapter-progress-caption">{done ? '已完成' : progress.started ? `已读 ${progress.completed} / ${count} 节` : '随时可以开始'} · 追问 {stats.answered} / {stats.total}</span>
        <progress value={progress.completed} max={count} aria-label={`${chapter.title}已读${progress.completed}节，共${count}节`} />
      </span>
      <span className="chapter-mark">{done ? <Check size={18} /> : <ArrowRight size={17} />}<small>{done ? '回看' : progress.started ? '继续' : '开始'}</small></span>
    </button>;
  })}</div>;
}
