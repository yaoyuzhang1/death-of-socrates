import type { Paragraph, Question, Unit } from './model.ts';

export type ReadingFragment = Paragraph & { sourceId: string; fragmentIndex: number };
export type ReadingPage =
  | { id: string; kind: 'text'; side: 'before' | 'after'; paragraphs: ReadingFragment[] }
  | { id: string; kind: 'question'; question: Question };

const TARGET = 550;
const MAXIMUM = 760;
const MAX_TURNS = 12;

/** Split only at character boundaries; punctuation, spaces and quotation marks remain source text. */
function fragments(paragraph: Paragraph, legacy = false): ReadingFragment[] {
  const maximum = legacy ? 260 : MAXIMUM;
  const pieces: string[] = [];
  let remaining = paragraph.text;
  while (remaining.length > maximum) {
    // Balance long speeches so their last page is not just a trailing sentence.
    const target = legacy ? 220 : Math.ceil(remaining.length / Math.ceil(remaining.length / maximum));
    const candidate = remaining.slice(0, maximum + 1);
    const breaks = [...candidate.matchAll(/[。！？；!?;](?:[”’」』】）)]*)|[，、：,:]/gu)]
      .map(match => match.index! + match[0].length)
      .filter(index => index >= (legacy ? 140 : Math.min(300, target)) && index <= maximum);
    let end = breaks.filter(index => index <= target).at(-1) ?? breaks[0] ?? target;
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
  const parts = paragraphs.flatMap(paragraph => fragments(paragraph));
  // This source transition physically moves the gathering from the port into the house.
  const arrival = unitId === 'u-001' && side === 'before'
    ? parts.findIndex(fragment => fragment.sourceId === 'p-0019') : -1;
  const costs = Array<number>(parts.length + 1).fill(Infinity);
  const next = Array<number>(parts.length);
  costs[parts.length] = 0;
  // Select boundaries for the whole passage, rather than leaving a tiny final page.
  for (let start = parts.length - 1; start >= 0; start--) {
    let count = 0;
    for (let end = start + 1; end <= Math.min(parts.length, start + MAX_TURNS); end++) {
      if (arrival > start && end > arrival) break;
      count += parts[end - 1].text.length;
      if (count > MAXIMUM) break;
      const last = parts[end - 1];
      const following = parts[end];
      let boundary = 0;
      if (following) {
        // Keep a question with its immediate short reply whenever the page bounds allow it.
        if (/[？?][”’」』】）)\s]*$/u.test(last.text) && following.text.length <= 100) boundary += 1.5;
        if (last.sourceId === following.sourceId) boundary += .3;
      }
      const score = 1 + 2 * ((count - TARGET) / TARGET) ** 2 + boundary + costs[end];
      if (score < costs[start]) {
        costs[start] = score;
        next[start] = end;
      }
    }
  }
  const result: ReadingPage[] = [];
  for (let start = 0; start < parts.length;) {
    const end = next[start];
    result.push({ id: `${unitId}-${side}-${result.length}`, kind: 'text', side, paragraphs: parts.slice(start, end) });
    start = end;
  }
  return result;
}

/** Frozen version-4 boundaries are used only to recover an existing reader's source position. */
function version4TextPages(unitId: string, side: 'before' | 'after', paragraphs: readonly Paragraph[]): ReadingPage[] {
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
    for (const fragment of fragments(paragraph, true)) {
      if (page.length && (page.length >= 3 || count + fragment.text.length > 260)) flush();
      page.push(fragment);
      count += fragment.text.length;
      if (count >= 220) flush();
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

export function makeVersion4ReadingPages(unit: Unit): ReadingPage[] {
  const pages = version4TextPages(unit.id, 'before', unit.paragraphs);
  if (unit.question) pages.push({ id: `${unit.id}-question`, kind: 'question', question: unit.question });
  pages.push(...version4TextPages(unit.id, 'after', [
    ...(unit.question ? [unit.question.original] : []), ...unit.response,
  ]));
  return pages;
}

/** Map the first visible character, so denser pages never skip the text an old save was reading. */
export function migrateVersion4Page(unit: Unit, oldIndex: number): number {
  const oldPages = makeVersion4ReadingPages(unit);
  const currentPages = makeReadingPages(unit);
  const oldPage = oldPages[oldIndex];
  if (!oldPage) return 0;
  if (oldPage.kind === 'question') return currentPages.findIndex(page => page.kind === 'question');
  const anchor = oldPage.paragraphs[0];
  const oldOffset = oldPages.slice(0, oldIndex)
    .flatMap(page => page.kind === 'text' ? page.paragraphs : [])
    .filter(fragment => fragment.sourceId === anchor.sourceId)
    .reduce((count, fragment) => count + fragment.text.length, 0);
  let offset = 0;
  for (const [index, page] of currentPages.entries()) {
    if (page.kind !== 'text' || page.side !== oldPage.side) continue;
    for (const fragment of page.paragraphs) {
      if (fragment.sourceId !== anchor.sourceId) continue;
      if (oldOffset < offset + fragment.text.length || (!fragment.text.length && oldOffset === offset)) return index;
      offset += fragment.text.length;
    }
  }
  return 0;
}
