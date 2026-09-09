import type { Question } from './model';

export type FeedbackAudioState = {
  status: 'idle' | 'playing' | 'blocked' | 'error';
  key: string | null;
  message?: string;
};
export type FeedbackAudioOptions = { sound?: boolean; voice?: boolean; volume?: number };

let state: FeedbackAudioState = { status: 'idle', key: null };
const listeners = new Set<(next: FeedbackAudioState) => void>();
let activeAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let cueNodes: OscillatorNode[] = [];
let cueTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

function publish(next: FeedbackAudioState) {
  state = next;
  listeners.forEach(listener => listener(state));
}

export function getFeedbackState(): FeedbackAudioState { return state; }

export function subscribeFeedback(listener: (next: FeedbackAudioState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

/** Stop voice and result tones together, including work still waiting to start. */
export function stopFeedback(): void {
  generation += 1;
  if (cueTimer !== undefined) clearTimeout(cueTimer);
  cueTimer = undefined;
  for (const node of cueNodes) {
    try { node.stop(); } catch { /* An already-ended tone has nothing to stop. */ }
    node.disconnect();
  }
  cueNodes = [];
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
    activeAudio = null;
  }
  publish({ status: 'idle', key: null });
}

async function playCue(correct: boolean, volume: number, token: number): Promise<void> {
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
  if (token !== generation) return;
  if (audioContext.state !== 'running') throw new DOMException('Audio is suspended', 'NotAllowedError');
  // A brief rising pair for acceptance; a softer descending pair for retry.
  // Low level and short duration keep the first spoken sentence understandable.
  const frequencies = correct ? [660, 880] : [330, 247];
  const start = audioContext.currentTime;
  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    const at = start + index * 0.085;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume * 0.12, at + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.13);
    oscillator.connect(gain);
    gain.connect(audioContext!.destination);
    cueNodes.push(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      cueNodes = cueNodes.filter(node => node !== oscillator);
    };
    oscillator.start(at);
    oscillator.stop(at + 0.14);
  });
}

function failure(error: unknown, key: string, token: number) {
  if (token !== generation) return;
  const blocked = error instanceof DOMException && error.name === 'NotAllowedError';
  publish({ status: blocked ? 'blocked' : 'error', key,
    message: blocked ? '浏览器暂未允许声音，请点击“重播解释”。' : '解释录音暂时无法播放，请点击“重播解释”重试。' });
}

/** Call only after the player confirms a choice, or explicitly asks to replay it.
 * Files contain exactly the selected feedback: correct -> question.explanation,
 * incorrect -> option.feedback. No unselected answer is requested or spoken.
 */
export function playFeedback(question: Question, choiceId: string, options: FeedbackAudioOptions = {}): void {
  stopFeedback();
  const option = question.options.find(item => item.id === choiceId);
  const key = `${question.id}--${choiceId}`;
  if (!option) {
    publish({ status: 'error', key, message: '未找到这项解释。' });
    return;
  }
  const { sound = true, voice = true } = options;
  const volume = Number.isFinite(options.volume) ? Math.min(1, Math.max(0, options.volume!)) : 0.8;
  if ((!sound && !voice) || volume === 0) return;
  const token = generation;
  publish({ status: 'playing', key });
  if (sound) {
    void playCue(choiceId === question.correctId, volume, token).catch(error => {
      // If recorded speech plays successfully, its result controls the shared state.
      if (!voice) failure(error, key, token);
    });
  }
  if (!voice) {
    cueTimer = setTimeout(() => {
      if (token === generation && state.status === 'playing') publish({ status: 'idle', key });
    }, 300);
    return;
  }
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/feedback/${encodeURIComponent(key)}.mp3`);
  audio.preload = 'auto';
  audio.volume = volume;
  activeAudio = audio;
  audio.onended = () => {
    if (token === generation) publish({ status: 'idle', key });
  };
  audio.onerror = () => failure(new Error('Recorded feedback failed to load'), key, token);
  // Start in the submit/replay event, retaining the browser's user activation.
  void audio.play().catch(error => failure(error, key, token));
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopFeedback();
  });
  window.addEventListener('pagehide', stopFeedback);
}
