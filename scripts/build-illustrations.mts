import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { flattenCorpus } from '../src/reader/engine.ts';
import { makeReadingPages } from '../src/reader/pagination.ts';
import type { Corpus } from '../src/reader/model.ts';

type Art = {
  id: string; file: string; chapterId?: string; chapterIds?: string[];
  sectionIds: string[]; sourceStart: string; sourceEnd: string;
  kind: 'conversation' | 'example'; alt: string; focalY?: number;
};
const corpus: Corpus = JSON.parse(readFileSync(new URL('../reader-public/text/republic.json', import.meta.url), 'utf8'));
const units = flattenCorpus(corpus);
const directory = new URL('../reader-public/illustrations/', import.meta.url);
const planningOnly = process.argv.includes('--plan');
// Original-question IDs were allocated before their neighbouring paragraphs; IDs are not reading order.
const sourceOrder = new Map(units.flatMap(unit => [...unit.paragraphs, ...(unit.question ? [unit.question.original] : []), ...unit.response]).map((paragraph, index) => [paragraph.id, index]));
const sourceNumber = (id: string) => {
  const index = sourceOrder.get(id);
  if (index === undefined) throw new Error(`Unknown source anchor: ${id}`);
  return index;
};
const legacy: Art[] = [
  { id: 'arrival', chapterId: 'obligations', sourceStart: 'p-0001', sourceEnd: 'p-0018', alt: '比雷埃夫斯港旁，苏格拉底和格劳孔与前来挽留的友人交谈' },
  { id: 'obligations', chapterId: 'obligations', sourceStart: 'p-0019', sourceEnd: 'p-0042', alt: '克法洛斯坐在椅上，苏格拉底和年轻人围坐交谈' },
  { id: 'rule', chapterId: 'rule', sourceStart: 'p-0192', sourceEnd: 'p-0331', alt: '色拉叙马霍斯向苏格拉底陈述自己的看法' },
  { id: 'life', chapterId: 'life', sourceStart: 'p-0333', sourceEnd: 'p-0517', alt: '苏格拉底继续与色拉叙马霍斯交谈，众人在旁倾听' },
  { id: 'worth', chapterId: 'worth', sourceStart: 'p-0518', sourceEnd: 'p-0582', alt: '格劳孔发言，苏格拉底和阿得曼托斯倾听' },
  { id: 'city', chapterId: 'city', sourceStart: 'p-0584', sourceEnd: 'p-0734', alt: '三人在庭院边讨论共同生活的起点' },
  { id: 'education', chapterId: 'education', sourceStart: 'p-0736', sourceEnd: 'p-1322', alt: '从听者肩后望向苏格拉底和阿得曼托斯的交谈' },
  { id: 'guardians', chapterId: 'guardians', sourceStart: 'p-1324', sourceEnd: 'p-1506', alt: '阿得曼托斯与苏格拉底相对而坐，讨论仍在继续' },
  { id: 'soul', chapterId: 'soul', sourceStart: 'p-1508', sourceEnd: 'p-1862', alt: '苏格拉底与格劳孔相对交谈，阿得曼托斯在旁倾听' },
].map(scene => ({ ...scene, file: `${scene.id}.webp`, kind: 'conversation', sectionIds: [], focalY: 38 })) as Art[];
const artDirectory = new URL('../content/art/', import.meta.url);
const supplied = readdirSync(artDirectory).filter(name => name.endsWith('-scenes.json')).sort()
  .flatMap(name => JSON.parse(readFileSync(new URL(name, artDirectory), 'utf8')) as Art[]);
const artworks = [...legacy, ...supplied].map(art => ({ ...art, file: art.file.replace(/^illustrations\//, '') }));
if (new Set(artworks.map(art => art.id)).size !== artworks.length) throw new Error('Duplicate artwork ID');
const assets = Object.fromEntries(artworks.map(art => {
  if (!/^[a-z0-9/-]+\.webp$/.test(art.file) || art.file.includes('..')) throw new Error(`Invalid artwork path: ${art.file}`);
  if (!art.alt || !/^p-\d{4}$/.test(art.sourceStart) || !/^p-\d{4}$/.test(art.sourceEnd)) throw new Error(`Incomplete source range: ${art.id}`);
  const bytes = planningOnly ? Buffer.from('') : readFileSync(new URL(art.file, directory));
  if (!planningOnly && (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP')) throw new Error(`Invalid WebP: ${art.id}`);
  return [art.id, { file: art.file, alt: art.alt, kind: art.kind, focalY: art.focalY ?? 45, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
}));
const pageMap: Record<string, string> = {};
const pageSources: Record<string, { chapterId: string; sectionId: string; first: string; last: string; kind: string }> = {};
const lastUsed = new Map<string, number>();
let previousId = '', sequence = 0, transitions = 0;
const missing: string[] = [];
for (const unit of units) for (const page of makeReadingPages(unit)) {
  const first = page.kind === 'text' ? page.paragraphs[0].sourceId : page.question.original.id;
  const last = page.kind === 'text' ? page.paragraphs.at(-1)!.sourceId : page.question.original.id;
  const start = sourceNumber(first), end = sourceNumber(last);
  // A question can only use the gathering itself. Example scenes never reveal its answer.
  let candidates = artworks.filter(art =>
    (art.chapterId === unit.chapter.id || art.chapterIds?.includes(unit.chapter.id)) &&
    (!art.sectionIds.length || art.sectionIds.includes(unit.section.id)) &&
    (page.kind !== 'question' || art.kind === 'conversation') &&
    sourceNumber(art.sourceStart) <= end && sourceNumber(art.sourceEnd) >= start);
  if (!candidates.length) { missing.push(page.id); continue; }
  const withoutPrevious = candidates.filter(art => art.id !== previousId);
  if (withoutPrevious.length) candidates = withoutPrevious;
  const score = (art: Art) => {
    const age = sequence - (lastUsed.get(art.id) ?? -1000);
    const newExample = art.kind === 'example' && !lastUsed.has(art.id);
    const span = sourceNumber(art.sourceEnd) - sourceNumber(art.sourceStart);
    const specific = art.sectionIds.length > 0 || span < 30;
    return (newExample ? 10000 : 0) + (span <= 6 ? 260 : specific ? 70 : 0) + (art.file.startsWith('progression/') ? 20 : 0)
      + (!lastUsed.has(art.id) ? 1000 : Math.min(age, 20) * 25);
  };
  candidates.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const chosen = candidates[0];
  pageMap[page.id] = chosen.id;
  pageSources[page.id] = { chapterId: unit.chapter.id, sectionId: unit.section.id, first, last, kind: page.kind };
  if (sequence && chosen.id !== previousId) transitions++;
  lastUsed.set(chosen.id, sequence++); previousId = chosen.id;
}
if (missing.length) throw new Error(`No source-appropriate illustration for ${missing.join(', ')}`);
const manifest = {
  version: 1, editionId: corpus.edition.id, paginationVersion: 5,
  assets, pages: pageMap, pageSources,
  coverage: { pages: sequence, artworks: artworks.length, usedArtworks: lastUsed.size, changedTransitions: transitions, totalTransitions: Math.max(0, sequence - 1) },
};
writeFileSync(planningOnly ? new URL('../.local/qa/artwork-plan.json', import.meta.url) : new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Illustrations: ${lastUsed.size}/${artworks.length} artworks, ${sequence} pages, ${transitions}/${sequence - 1} page turns change image`);
if (planningOnly) console.log('Unused:', artworks.filter(art => !lastUsed.has(art.id)).map(art => art.id).join(', '));
