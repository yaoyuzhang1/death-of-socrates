import { courtyardChapters } from "./courtyard.ts";
import { trialChapters } from "./trial.ts";
export const chapters = [...courtyardChapters, ...trialChapters];
export const scenes = chapters.flatMap((chapter) => chapter.scenes);
