import type { Paragraph, Question, Unit } from './model.ts';

export type ReadingFragment = Paragraph & { sourceId: string; fragmentIndex: number };
export type ReadingPage =
  | { id: string; kind: 'text'; side: 'before' | 'after'; paragraphs: ReadingFragment[] }
  | { id: string; kind: 'question'; question: Question };

const TARGET = 220;
const MAXIMUM = 260;

/** Split only at character boundaries; punctuation, spaces and quotation marks remain source text. */
function fragments(paragraph: Paragraph): ReadingFragment[] {
  const pieces: string[] = [];
  let remaining = paragraph.text;
  while (remaining.length > MAXIMUM) {
    const candidate = remaining.slice(0, MAXIMUM + 1);
    const breaks = [...candidate.matchAll(/[。！？；!?;](?:[”’」』】）)]*)|[，、：,:]/gu)]
      .map(match => match.index! + match[0].length)
      .filter(index => index >= 140 && index <= MAXIMUM);
    let end = breaks.filter(index => index <= TARGET).at(-1) ?? breaks[0] ?? TARGET;
    // Avoid splitting a UTF-16 surrogate pair in the unlikely case of a supplementary character.
    const preceding = remaining.charCodeAt(end - 1);
    if (preceding >= 0xd800 && preceding <= 0xdbff) end--;
    pieces.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  pieces.push(remaining);
  return pieces.map((text, fragmentIndex) => ({
    ...paragraph, id: `${paragraph.id}--fragment-${fragmentIndex}`, text,
    sourceId: paragraph.id, fragmentIndex,
  }));
}

function textPages(unitId: string, side: 'before' | 'after', paragraphs: readonly Paragraph[]): ReadingPage[] {
  const result: ReadingPage[] = [];
  let page: ReadingFragment[] = [];
  let count = 0;
  const flush = () => {
    if (!page.length) return;
    result.push({ id: `${unitId}-${side}-${result.length}`, kind: 'text', side, paragraphs: page });
    page = [];
    count = 0;
  };
  for (const paragraph of paragraphs) {
    for (const fragment of fragments(paragraph)) {
      if (page.length && (page.length >= 3 || count + fragment.text.length > MAXIMUM)) flush();
      page.push(fragment);
      count += fragment.text.length;
      if (count >= TARGET) flush();
    }
  }
  flush();
  return result;
}

/** Fixed page boundaries keep saves stable across screen sizes and reading font settings. */
export function makeReadingPages(unit: Unit): ReadingPage[] {
  const pages = textPages(unit.id, 'before', unit.paragraphs);
  if (unit.question) pages.push({ id: `${unit.id}-question`, kind: 'question', question: unit.question });
  pages.push(...textPages(unit.id, 'after', [
    ...(unit.question ? [unit.question.original] : []), ...unit.response,
  ]));
  return pages;
}
