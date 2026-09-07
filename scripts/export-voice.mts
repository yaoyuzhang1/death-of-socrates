import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chapters } from '../src/content/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const cast = JSON.parse(await readFile(new URL('./voice-cast.json', import.meta.url), 'utf8'));
const cues = new Map<string, { id: string; hash: string; speaker: string; text: string; file: string; scenes: string[] }>();
for (const chapter of chapters) {
  for (const scene of chapter.scenes) {
    for (const line of [...scene.lines, ...scene.options.flatMap(option => option.reply), ...(scene.echoes ?? [])]) {
      if (!cast.roles[line.speaker]) throw new Error(`Missing Mandarin cast profile: ${line.speaker}`);
      const key = `${line.speaker}\n${line.text}`;
      const prior = cues.get(key);
      if (prior) {
        if (!prior.scenes.includes(scene.id)) prior.scenes.push(scene.id);
        continue;
      }
      const hash = createHash('sha256').update(key).digest('hex');
      cues.set(key, { id: hash.slice(0, 20), hash, speaker: line.speaker, text: line.text, file: `line-${hash.slice(0, 20)}.mp3`, scenes: [scene.id] });
    }
  }
}
const clips = [...cues.values()];
if (new Set(clips.map(clip => clip.id)).size !== clips.length) throw new Error('Voice identifier collision');
await mkdir(`${root}.local`, { recursive: true });
await writeFile(`${root}.local/voice-cues.json`, `${JSON.stringify({ schema: 1, language: 'zh-CN', clips }, null, 2)}\n`);
console.log(JSON.stringify({ clips: clips.length, characters: clips.reduce((n, clip) => n + [...clip.text].length, 0), speakers: Object.keys(cast.roles).length }, null, 2));
