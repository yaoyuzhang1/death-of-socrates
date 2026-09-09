export type CelebrationState = { status: 'idle' | 'playing' | 'error'; message?: string };
let current: HTMLAudioElement | null = null;
let generation = 0;
let state: CelebrationState = { status: 'idle' };
const listeners = new Set<(state: CelebrationState) => void>();
const publish = (next: CelebrationState) => { state = next; listeners.forEach(listener => listener(state)); };
export function subscribeCelebration(listener: (state: CelebrationState) => void) {
  listeners.add(listener); listener(state); return () => { listeners.delete(listener); };
}
export function stopCelebration() {
  generation++;
  if (current) { current.onended = null; current.onerror = null; current.pause(); current.removeAttribute('src'); current.load(); current = null; }
  publish({ status: 'idle' });
}
export function playCelebration() {
  stopCelebration();
  const token = generation;
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/completion/completion.mp3`);
  current = audio; audio.volume = .85;
  const failure = () => { if (generation === token) publish({ status: 'error', message: '点击“播放祝贺”可以重试。' }); };
  audio.onended = () => { if (generation === token) publish({ status: 'idle' }); };
  audio.onerror = failure;
  publish({ status: 'playing' });
  void audio.play().catch(failure);
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCelebration(); });
  window.addEventListener('pagehide', stopCelebration);
}
