import { playRecordedFeedback, stopFeedback, subscribeFeedback } from './feedback-audio.ts';
import type { AudioPreferences } from './QuestionChallenge.tsx';

type Clip = { key: string; filename: string };
let queue: { clips: Clip[]; index: number } | null = null;
let dispatching = false;

function playCurrent() {
  const clip = queue?.clips[queue.index];
  if (!clip) { queue = null; return; }
  dispatching = true;
  try {
    // A conversation angle is not a correct/wrong answer; judgment cues belong to the subsequent check.
    playRecordedFeedback(clip.key, `${import.meta.env.BASE_URL}audio/bonus/${clip.filename}`, true, { sound: false, voice: true });
  } finally { dispatching = false; }
}

subscribeFeedback(state => {
  if (!queue || dispatching) return;
  const expected = queue.clips[queue.index]?.key;
  if (state.status === 'idle' && state.key === expected) {
    queue.index++;
    playCurrent();
  } else if (state.key !== expected || state.status === 'error' || state.status === 'blocked') {
    // Explicit stops publish idle/null; another question publishes a different key. Neither may advance this queue.
    queue = null;
  }
});

export function stopBonusAudio() { queue = null; stopFeedback(); }

function start(clips: Clip[], audio: AudioPreferences) {
  stopBonusAudio();
  if (!audio.voice || !clips.length) return;
  queue = { clips, index: 0 };
  playCurrent();
}

export function bonusResponseKey(sceneId: string, optionId: string) { return `bonus:${sceneId}:${optionId}:`; }
export function bonusIntroKey(sceneId: string) { return `bonus:${sceneId}:intro:`; }

export function playBonusResponse(sceneId: string, optionId: string, paragraphCount: number, hasNote: boolean, audio: AudioPreferences) {
  const key = bonusResponseKey(sceneId, optionId);
  const clips = Array.from({ length: paragraphCount }, (_, index) => ({ key: `${key}p${index}`, filename: `responses/${sceneId}--${optionId}--p${index}.mp3` }));
  if (hasNote) clips.push({ key: `${key}note`, filename: `notes/${sceneId}--${optionId}--note.mp3` });
  start(clips, audio);
}

export function playBonusIntro(sceneId: string, paragraphCount: number, audio: AudioPreferences) {
  start(Array.from({ length: paragraphCount }, (_, index) => ({ key: `${bonusIntroKey(sceneId)}p${index}`, filename: `intro/${sceneId}--intro--p${index}.mp3` })), audio);
}
