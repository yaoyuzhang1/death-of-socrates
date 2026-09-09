import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Expand, X } from 'lucide-react';
import './comic-scene.css';

type Scene = { alt: string; focalY: number };
const scenes: Record<string, Scene> = {
  arrival: { alt: '苏格拉底与格劳孔在比雷埃夫斯港旁遇见前来挽留的友人', focalY: 27 },
  obligations: { alt: '苏格拉底与克法洛斯在家中聚谈，年轻人在旁倾听', focalY: 32 },
  rule: { alt: '苏格拉底与色拉叙马霍斯相对而坐，继续交谈', focalY: 30 },
  life: { alt: '苏格拉底与色拉叙马霍斯的交谈近景', focalY: 25 },
  worth: { alt: '苏格拉底倾听格劳孔与阿得曼托斯说话', focalY: 31 },
  city: { alt: '苏格拉底与两位年轻人在庭院边围坐交谈', focalY: 38 },
  education: { alt: '从听者肩后望向正在交谈的苏格拉底与阿得曼托斯', focalY: 33 },
  guardians: { alt: '阿得曼托斯与苏格拉底在庭院中交谈', focalY: 34 },
  soul: { alt: '苏格拉底与格劳孔相对交谈，阿得曼托斯在旁倾听', focalY: 31 },
};

export default function ComicScene({ chapterId, sceneId, speaker, compact = false }: { chapterId: string; sceneId?: string; speaker?: string; compact?: boolean }) {
  const assetId = sceneId && scenes[sceneId] ? sceneId : chapterId;
  const scene = scenes[assetId];
  if (!scene) return null;
  return <SceneImage key={assetId} chapterId={assetId} scene={scene} speaker={speaker} compact={compact} />;
}

function SceneImage({ chapterId, scene, speaker, compact }: { chapterId: string; scene: Scene; speaker?: string; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const imageUrl = `${import.meta.env.BASE_URL}illustrations/${chapterId}.webp`;
  const socratesX = chapterId === 'guardians' ? 57 : 43;
  const focalX = speaker === '苏' || speaker === '苏格拉底' ? socratesX : speaker && speaker !== '旁白' ? 100 - socratesX : 50;
  return <figure className={`comic-scene${compact ? ' comic-scene-compact' : ''}`} style={{ '--comic-focal-x': `${focalX}%`, '--comic-focal-y': `${scene.focalY}%` } as CSSProperties}>
    {failed ? <div className="comic-scene-fallback"><span>{scene.alt}</span></div> : <button ref={trigger} type="button" className="comic-scene-open" aria-label="放大场景插图" onClick={() => setExpanded(true)}>
      <img src={imageUrl} alt={scene.alt} width={1672} height={941} decoding="async" onError={() => setFailed(true)} />
      <span className="comic-scene-expand" aria-hidden="true"><Expand size={15} /></span>
    </button>}
    {expanded && <SceneDialog imageUrl={imageUrl} alt={scene.alt} onClose={() => setExpanded(false)} trigger={trigger.current} />}
  </figure>;
}

function SceneDialog({ imageUrl, alt, onClose, trigger }: { imageUrl: string; alt: string; onClose: () => void; trigger: HTMLButtonElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
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
