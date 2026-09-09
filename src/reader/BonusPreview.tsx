import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BookOpen } from 'lucide-react';
import BonusChapter from './BonusChapter.tsx';
import { freshPreviewSave, validatePreviewProgress } from './bonus-preview.ts';
import { flattenCorpus } from './engine.ts';
import { BONUS_PREVIEW_STORAGE } from './preview-entry.ts';
import type { Corpus, Save, Settings } from './model.ts';
import useStudy from './useStudy.ts';
import { stopFeedback } from './feedback-audio.ts';
import type { AudioPreferences } from './QuestionChallenge.tsx';
import './bonus-preview.css';

const PREVIEW_AUDIO = 'republic-bonus-preview-audio';
function previewAudio(): AudioPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PREVIEW_AUDIO) ?? 'null');
    if (typeof value?.voice === 'boolean' && typeof value?.sound === 'boolean') return { voice: value.voice, sound: value.sound };
  } catch { /* Use audible defaults when storage is unavailable. */ }
  return { voice: true, sound: true };
}

export default function BonusPreview() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const study = useStudy(corpus?.edition.id, true);
  const [audio, setAudio] = useState<AudioPreferences>(previewAudio);
  const current = useRef(save);
  current.current = save;
  useEffect(() => {
    stopFeedback();
    try { localStorage.setItem(PREVIEW_AUDIO, JSON.stringify(audio)); } catch { /* Preferences remain available for this visit. */ }
    return () => stopFeedback();
  }, [audio]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}text/republic.json`, { signal: controller.signal, cache: 'no-cache' })
      .then(response => { if (!response.ok) throw new Error('隐藏章节暂时未能加载。'); return response.json(); })
      .then((data: Corpus) => {
        let next = freshPreviewSave(data);
        try {
          const raw = localStorage.getItem(BONUS_PREVIEW_STORAGE);
          if (raw) {
            const stored = JSON.parse(raw);
            const bonus = stored.version === 1 && stored.editionId === data.edition.id ? validatePreviewProgress(stored.bonus) : null;
            if (bonus) {
              next = freshPreviewSave(data, bonus);
              const settings = stored.settings as Settings | undefined;
              if (settings && Number.isInteger(settings.fontSize) && settings.fontSize >= 16 && settings.fontSize <= 32 && ['paper', 'night'].includes(settings.theme)) next.settings = { fontSize: settings.fontSize, theme: settings.theme };
            } else setNotice('这份直达体验记录无法恢复，已从第一幕开始。主篇进度保持原样。');
          }
        } catch { setNotice('暂时无法恢复直达体验的记录。主篇进度保持原样。'); }
        setCorpus(data); setSave(next);
      })
      .catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!save) return;
    document.documentElement.dataset.theme = save.settings.theme;
    try { localStorage.setItem(BONUS_PREVIEW_STORAGE, JSON.stringify({ version: 1, editionId: save.editionId, bonus: save.bonus, settings: save.settings })); }
    catch { setNotice('浏览器暂时无法保存本次体验，仍可继续阅读。'); }
  }, [save]);
  const update = (fn: (save: Save) => Save) => { if (!current.current) return; const next = fn(current.current); current.current = next; setSave(next); };
  if (error) return <main className="loading"><h1>苏格拉底之死</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>重新加载</button></main>;
  if (!corpus || !save) return <main className="loading" role="status"><BookOpen size={28} /><p>正在走进最后的对话……</p></main>;
  return <div className="app" data-testid="bonus-preview" style={{ '--reading-font-size': `${save.settings.fontSize}px` } as CSSProperties}>
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.querySelector<HTMLHeadingElement>('#main h1')?.focus(); }}>跳到正文</a>
    <header className="site-header"><div className="header-inner preview-header"><a className="brand" href={import.meta.env.BASE_URL}><BookOpen size={23} /><span>苏格拉底之死<small>隐藏章节 · 直达体验</small></span></a>
      <nav aria-label="体验阅读设置"><button aria-label="减小字号" disabled={save.settings.fontSize <= 16} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.max(16, s.settings.fontSize - 2) } }))}>A−</button><button aria-label="增大字号" disabled={save.settings.fontSize >= 32} onClick={() => update(s => ({ ...s, settings: { ...s.settings, fontSize: Math.min(32, s.settings.fontSize + 2) } }))}>A＋</button><button onClick={() => update(s => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === 'paper' ? 'night' : 'paper' } }))}>{save.settings.theme === 'paper' ? '夜间' : '纸色'}</button></nav>
    </div></header>
    <div className="preview-tools"><p>此处的体验进度单独保存，主篇记录保持原样。</p><div aria-label="声音设置"><button aria-pressed={audio.voice} onClick={() => setAudio(value => ({ ...value, voice: !value.voice }))}>配音{audio.voice ? '开' : '关'}</button><button aria-pressed={audio.sound} onClick={() => setAudio(value => ({ ...value, sound: !value.sound }))}>提示音{audio.sound ? '开' : '关'}</button></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {study.notice && <div className="notice" role="status">{study.notice}</div>}
    {study.ready && <BonusChapter save={save} units={flattenCorpus(corpus)} onUpdate={update} onExit={() => location.assign(import.meta.env.BASE_URL)} study={study} audio={audio} preview />}
  </div>;
}
