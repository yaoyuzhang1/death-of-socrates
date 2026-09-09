import type { Paragraph, Question, Unit } from './model.ts';
import { VERSION4_LAYOUT, type FrozenV4Side } from './legacy-v4-pages.ts';

export type ReadingFragment = Paragraph & { sourceId: string; fragmentIndex: number; fragmentOffset: number };
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
    sourceId: paragraph.id, fragmentIndex, fragmentOffset: pieces.slice(0,fragmentIndex).reduce((sum,piece)=>sum+piece.length,0),
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

/** Old algorithm is retained only for unpublished/custom corpora absent from the frozen table. */
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

function version4Layout(unit: Unit) {
  return Object.hasOwn(VERSION4_LAYOUT, unit.id) ? VERSION4_LAYOUT[unit.id] : undefined;
}

export function makeVersion4ReadingPages(unit: Unit): ReadingPage[] {
  const frozen = version4Layout(unit);
  if (frozen) {
    // These are position descriptors for validation/migration, not a reconstruction of old text.
    // In particular, corrected text must never determine the number or location of old pages.
    const describe = (side: 'before' | 'after'): ReadingPage[] => {
      const paragraphs = sideParagraphs(unit, side);
      return frozen[side].pages.map(([sourceIndex, offset], index) => {
        const sourceId = frozen[side].sources[sourceIndex][0];
        const paragraph = paragraphs.find(part => part.id === sourceId) ?? { id: sourceId, text: '' };
        return {
          id: `${unit.id}-${side}-${index}`, kind: 'text', side,
          paragraphs: [{ ...paragraph, id: `${sourceId}--v4-anchor-${offset}`,
            text: paragraph.text.slice(offset), sourceId, fragmentIndex: index, fragmentOffset: offset }],
        };
      });
    };
    const pages = describe('before');
    if (frozen.questionId && unit.question) {
      pages.push({ id: `${unit.id}-question`, kind: 'question', question: unit.question });
    }
    return [...pages, ...describe('after')];
  }
  const pages = version4TextPages(unit.id, 'before', unit.paragraphs);
  if (unit.question) pages.push({ id: `${unit.id}-question`, kind: 'question', question: unit.question });
  pages.push(...version4TextPages(unit.id, 'after', [
    ...(unit.question ? [unit.question.original] : []), ...unit.response,
  ]));
  return pages;
}

function sideParagraphs(unit: Unit, side: 'before' | 'after'): readonly Paragraph[] {
  return side === 'before' ? unit.paragraphs : [...(unit.question ? [unit.question.original] : []), ...unit.response];
}

/** Content change detector, not a security hash. Offsets use JS's UTF-16 character indexing. */
function sourceFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return `${text.length}:${hash.toString(16).padStart(8, '0')}`;
}

function conservativeAnchor(paragraphs: readonly Paragraph[], frozen: FrozenV4Side, sourceId: string, offset: number) {
  const known = new Set(frozen.sources.map(([id]) => id));
  const sourceIndex = frozen.sources.findIndex(([id]) => id === sourceId);
  let index = paragraphs.findIndex(part => part.id === sourceId);
  if (index < 0) {
    // A removed anchor cannot justify jumping to a later paragraph. Resume from an earlier
    // surviving paragraph, or the beginning of this side; never cross a question gate.
    for (let previous = sourceIndex - 1; previous >= 0 && index < 0; previous--) {
      index = paragraphs.findIndex(part => part.id === frozen.sources[previous][0]);
    }
    index = Math.max(0, index);
    offset = 0;
  } else if (sourceFingerprint(paragraphs[index].text) !== frozen.sources[sourceIndex][1]) {
    // OCR repairs can insert, remove or replace characters before the old offset. Re-reading
    // the changed paragraph is safer than treating that offset as the same source character.
    offset = 0;
  }
  while (index > 0 && !known.has(paragraphs[index - 1].id)) {
    index--;
    offset = 0;
  }
  return { sourceId: paragraphs[index]?.id, offset };
}

/** Map a published first-visible character, conservatively re-reading text repaired since v4. */
export function migrateVersion4Page(unit: Unit, oldIndex: number): number {
  const oldPages = makeVersion4ReadingPages(unit);
  const currentPages = makeReadingPages(unit);
  const oldPage = oldPages[oldIndex];
  if (!oldPage) return 0;
  if (oldPage.kind === 'question') return currentPages.findIndex(page => page.kind === 'question');
  const oldAnchor = oldPage.paragraphs[0];
  const frozen = version4Layout(unit);
  const anchor = frozen
    ? conservativeAnchor(sideParagraphs(unit, oldPage.side), frozen[oldPage.side], oldAnchor.sourceId, oldAnchor.fragmentOffset)
    : { sourceId: oldAnchor.sourceId, offset: oldAnchor.fragmentOffset };
  let firstSourcePage = -1;
  for (const [index, page] of currentPages.entries()) {
    if (page.kind !== 'text' || page.side !== oldPage.side) continue;
    for (const fragment of page.paragraphs) {
      if (fragment.sourceId !== anchor.sourceId) continue;
      if (firstSourcePage < 0) firstSourcePage = index;
      if (anchor.offset >= fragment.fragmentOffset &&
        (anchor.offset < fragment.fragmentOffset + fragment.text.length ||
          (!fragment.text.length && anchor.offset === fragment.fragmentOffset))) return index;
    }
  }
  if (firstSourcePage >= 0) return firstSourcePage;
  const sameSide = currentPages.findIndex(page => page.kind === 'text' && page.side === oldPage.side);
  return sameSide >= 0 ? sameSide : Math.max(0, currentPages.findIndex(page => page.kind === 'question'));
}
