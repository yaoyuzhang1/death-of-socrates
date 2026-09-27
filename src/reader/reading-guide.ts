import data from '../../content/reading-guide.json' with { type: 'json' };
import type { Chapter } from './model.ts';

export type GuideTheme = { id: string; label: string };
export type BookGuide = { number: number; range: string; title: string; question: string; themes: string[]; before: string; review: string; caution: string };
export type ChapterGuide = { id: string; books: number[]; themes: string[]; focus: string; before: string; watch: string; steps: string[]; open: string };
export type GuideRoute = { id: string; title: string; description: string; chapters: string[] };
export const READING_GUIDE = data;
export const BOOK_GUIDES: BookGuide[] = data.books;
export const GUIDE_THEMES: GuideTheme[] = data.themes;
const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function chapterNumeral(number: number): string {
  if (!Number.isInteger(number) || number < 1) return String(number);
  if (number < 10) return chineseNumbers[number];
  if (number < 100) return `${number < 20 ? '' : chineseNumbers[Math.floor(number / 10)]}十${number % 10 ? chineseNumbers[number % 10] : ''}`;
  return String(number);
}

export function guideForChapter(chapter: Chapter): ChapterGuide {
  const exact = data.chapters.find(guide => guide.id === chapter.id);
  if (exact) return exact;
  const [volumes] = chapter.range.split('·');
  const mentioned = BOOK_GUIDES.filter(book => volumes.includes(chapterNumeral(book.number)));
  const books = mentioned.length ? mentioned : [BOOK_GUIDES[0]];
  return {
    id: chapter.id, books: books.map(book => book.number), themes: [...new Set(books.flatMap(book => book.themes))],
    focus: books.map(book => book.question).join(' '), before: books[0].before,
    watch: books.map(book => book.caution).join(' '), steps: books.map(book => book.review), open: books.at(-1)!.caution,
  };
}

export function bookCoverage(chapters: Chapter[]): string {
  const books = [...new Set(chapters.flatMap(chapter => guideForChapter(chapter).books))].sort((a, b) => a - b);
  return books.length === 10 ? '全十卷' : books.length > 1 ? `第${chapterNumeral(books[0])}至${chapterNumeral(books.at(-1)!)}卷` : `第${chapterNumeral(books[0] ?? 1)}卷`;
}

export function chapterTextLength(chapter: Chapter): number {
  return chapter.sections.reduce((total, section) => total + section.units.reduce((count, unit) => count + [...unit.paragraphs, ...(unit.question ? [unit.question.original] : []), ...unit.response].reduce((sum, paragraph) => sum + paragraph.text.replace(/\s/g, '').length, 0), 0), 0);
}

export function textLengthLabel(chapter: Chapter): string {
  const count = chapterTextLength(chapter);
  return count >= 10_000 ? `约 ${(count / 10_000).toFixed(1)} 万字` : `约 ${Math.max(1, Math.round(count / 1000))} 千字`;
}
