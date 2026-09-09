import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Expand, X } from 'lucide-react';
import manifest from '../../reader-public/illustrations/manifest.json';
import { stopFeedback } from './feedback-audio.ts';
import './comic-scene.css';

type Scene = { alt: string; file: string; focalY: number; kind: string };
const scenes: Record<string, Scene> = manifest.assets;
const pageScenes: Record<string, string> = manifest.pages;

export default function ComicScene({ chapterId, pageId, nextPageId, compact = false, conversationOnly = false }: { chapterId: string; pageId?: string; nextPageId?: string; compact?: boolean; conversationOnly?: boolean }) {
  const requestedId = pageId && pageScenes[pageId] ? pageScenes[pageId] : chapterId;
  const assetId = conversationOnly && scenes[requestedId]?.kind === 'example' ? chapterId : requestedId;
  const scene = scenes[assetId];
  const followingScene = nextPageId ? scenes[pageScenes[nextPageId]] : undefined;
  const nextFile = conversationOnly && followingScene?.kind === 'example' ? undefined : followingScene?.file;
  useEffect(() => {
    if (!nextFile || nextFile === scene?.file) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = `${import.meta.env.BASE_URL}illustrations/${nextFile}`;
  }, [nextFile, scene?.file]);
  if (!scene) return null;
  return <SceneImage key={assetId} assetId={assetId} scene={scene} compact={compact} />;
}

export function SceneImage({ assetId, scene, compact }: { assetId: string; scene: Scene; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const imageUrl = `${import.meta.env.BASE_URL}illustrations/${scene.file}`;
  return <figure className={`comic-scene${compact ? ' comic-scene-compact' : ''}`} data-scene-id={assetId} data-scene-kind={scene.kind} style={{ '--comic-focal-y': `${scene.focalY}%` } as CSSProperties}>
    {failed ? <div className="comic-scene-fallback"><span>{scene.alt}</span></div> : <button ref={trigger} type="button" className="comic-scene-open" aria-label="放大场景插图" onClick={() => setExpanded(true)}>
      <img src={imageUrl} alt={scene.alt} width={1672} height={941} decoding="async" onError={() => setFailed(true)} />
      <span className="comic-scene-expand" aria-hidden="true"><Expand size={15} /></span>
    </button>}
    {scene.kind === 'example' && <figcaption className="comic-scene-caption">谈话中的图景</figcaption>}
    {expanded && <SceneDialog imageUrl={imageUrl} alt={scene.alt} onClose={() => setExpanded(false)} trigger={trigger.current} />}
  </figure>;
}

function SceneDialog({ imageUrl, alt, onClose, trigger }: { imageUrl: string; alt: string; onClose: () => void; trigger: HTMLButtonElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    stopFeedback();
    const dialog = dialogRef.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = oldOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);
  return <dialog ref={dialogRef} className="comic-scene-dialog" aria-label="场景插图" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="comic-scene-dialog-top"><span>场景插图</span><button type="button" className="icon-button" autoFocus aria-label="关闭插图，继续阅读" onClick={onClose}><X size={21} /></button></div>
    <img src={imageUrl} alt={alt} width={1672} height={941} />
  </dialog>;
}
