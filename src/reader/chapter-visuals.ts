import covers from '../../content/art/chapter-covers-v2.json';

export type ChapterCover = { number: number; file: string; alt: string; kind: 'conversation' | 'example'; note?: string };
export function chapterCover(chapterId: string): ChapterCover {
  const cover = covers.find(item => item.chapterId === chapterId);
  if (!cover) throw new Error(`Missing chapter cover: ${chapterId}`);
  return cover as ChapterCover;
}

export const CHAPTER_GROUPS = [
  { id: 'justice', title: '正义的追问', label: '正义', range: '01—04', description: '从日常义务，读到正义本身的价值。', chapters: ['obligations', 'rule', 'life', 'worth'] },
  { id: 'city', title: '城邦与心灵', label: '城邦', range: '05—09', description: '共同生活、教育与心灵秩序。', chapters: ['city', 'education', 'guardians', 'soul', 'community'] },
  { id: 'knowledge', title: '认识与教育', label: '认识', range: '10—14', description: '哲学家、善的理念与洞穴之外。', chapters: ['philosophers', 'philosopher-city', 'good', 'cave', 'dialectic'] },
  { id: 'lives', title: '政制与人生', label: '政制', range: '15—18', description: '不同政制与不同生活，怎样比较？', chapters: ['regimes', 'democracy', 'tyrant', 'pleasure'] },
  { id: 'poetry', title: '诗与命运', label: '命运', range: '19—20', description: '从摹仿的追问，读到最后的选择。', chapters: ['imitation', 'destiny'] },
] as const;

export function chapterGroup(chapterId: string) {
  return CHAPTER_GROUPS.find(group => (group.chapters as readonly string[]).includes(chapterId)) ?? CHAPTER_GROUPS[0];
}
