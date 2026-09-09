export type Paragraph = { id: string; text: string; speaker?: string; ref?: string; sourcePage?: number; sourcePages?: number[] };
export type Option = { id: string; text: string; feedback: string };
export type Question = {
  id: string;
  sourceRef: string;
  prompt: string;
  original: Paragraph;
  options: Option[];
  correctId: string;
  explanation: string;
  hint: string;
};
export type Unit = {
  id: string;
  paragraphs: Paragraph[];
  question?: Question;
  replyCount?: number;
  response: Paragraph[];
};
export type Section = { id: string; title: string; range: string; units: Unit[] };
export type Chapter = {
  id: string;
  title: string;
  subtitle: string;
  range: string;
  introduction: string;
  conclusion: string;
  sections: Section[];
};
export type Corpus = {
  title: string;
  edition: {
    id: string;
    label: string;
    description: string;
    translator: string;
    sourceUrl: string;
    license: string;
    notes: string[];
  };
  chapters: Chapter[];
};
export type ReadingUnit = Unit & {
  chapter: Chapter;
  section: Section;
  chapterIndex: number;
  sectionIndex: number;
  index: number;
};
export type Answer = { choiceId: string | null; hinted: boolean; at: string };
export type ReadingMode = 'step' | 'continuous';
export type ReadingPosition = { before: number; after: number };
export type Review = { attempts: number; correct: number; lastChoiceId: string | null; at: string };
export type Settings = { fontSize: number; theme: 'paper' | 'night' };
export type Save = {
  version: 4;
  editionId: string;
  seed: string;
  started: boolean;
  cursor: number;
  completed: number;
  answers: Record<string, Answer>;
  resolved: string[];
  pages: Record<string, number>;
  reading: { mode: ReadingMode; positions: Record<string, ReadingPosition> };
  reviews: Record<string, Review>;
  hints: string[];
  bookmarks: string[];
  scroll: number;
  settings: Settings;
  updatedAt: string;
};
