import type { Corpus, Paragraph } from './model.ts';
import { SourcePageLink } from './SourceViewer.tsx';

export type PassageRole = { kind: 'socrates' | 'dialogue' | 'narration'; name: string };
const names: Record<string, string> = { 苏: '苏格拉底', 克: '克法洛斯', 玻: '玻勒马霍斯', 格: '格劳孔', 阿: '阿得曼托斯', 色: '色拉叙马霍斯', 克勒: '克勒托丰', 格劳孔: '格劳孔' };

export function passageRoles(corpus: Corpus): Map<string, PassageRole> {
  const roles = new Map<string, PassageRole>();
  let current: PassageRole = { kind: 'narration', name: '叙述' };
  let narration = false;
  for (const chapter of corpus.chapters) for (const section of chapter.sections) for (const unit of section.units) {
    for (const paragraph of [...unit.paragraphs, ...(unit.question ? [unit.question.original] : []), ...unit.response]) {
      if (paragraph.text.startsWith('〔')) narration = true;
      const prefix = paragraph.text.match(/^[·]?([^：]{1,6})：/)?.[1]?.replace(/（.*）/, '');
      if (narration) current = { kind: 'narration', name: '叙述' };
      else if (prefix && names[prefix]) current = { kind: prefix === '苏' ? 'socrates' : 'dialogue', name: names[prefix] };
      roles.set(paragraph.id, current);
      if (paragraph.text.includes('〕')) narration = false;
    }
  }
  return roles;
}

export default function ReadingPassage({ paragraph, role, continuation = false, sourceId, showSource = true }: {
  paragraph: Paragraph; role?: PassageRole; continuation?: boolean; sourceId?: string; showSource?: boolean;
}) {
  const pages = paragraph.sourcePages ?? (paragraph.sourcePage ? [paragraph.sourcePage] : []);
  return <div className={`passage dialogue-panel role-${role?.kind ?? 'dialogue'}`} data-paragraph-id={paragraph.id} data-source-id={sourceId ?? paragraph.id}>
    <div className="speaker"><span className="speaker-name">{role?.name ?? paragraph.speaker ?? '对话'}{continuation && <small> · 续</small>}</span>{paragraph.ref && <span>{paragraph.ref}</span>}{showSource && pages.map(page => <SourcePageLink key={page} page={page} />)}</div>
    <p>{paragraph.text}</p>
  </div>;
}
