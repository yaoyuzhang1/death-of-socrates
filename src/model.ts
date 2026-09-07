export type Line = { speaker: string; text: string };
export type Commitment = { topic: string; position: string; reason: string; limit: string };
export type Option = {
  id: string;
  text: string;
  reply: Line[];
  responsibility: string;
  commitment?: Commitment;
  flags?: Record<string, string>;
};
export type Echo = { key: string; value: string; speaker: string; text: string };
export type Scene = {
  id: string;
  title: string;
  location: string;
  time: string;
  source: string;
  frame: string;
  lines: Line[];
  kind: "choice" | "evidence" | "allocation" | "weapon" | "reflection";
  prompt: string;
  options: Option[];
  echoes?: Echo[];
  question: string;
};
export type Chapter = {
  id: string;
  numeral: string;
  title: string;
  subtitle: string;
  introduction: string;
  color: string;
  scenes: Scene[];
};
export type Answer = {
  sceneId: string;
  optionId: string;
  note: string;
  activity: Record<string, string>;
};
export type Save = { version: 1; index: number; answers: Answer[]; updatedAt: string };
