import type { Paragraph } from './model.ts';
import { SourcePageLink } from './SourceViewer.tsx';

import { passageRuns, type PassageRole } from './passage-roles.ts';
export { passageRoles } from './passage-roles.ts';
export type { PassageRole } from './passage-roles.ts';

export default function ReadingPassage({ paragraph, role, continuation = false, sourceId, showSource = true }: {
  paragraph: Paragraph & { fragmentOffset?: number }; role?: PassageRole; continuation?: boolean; sourceId?: string; showSource?: boolean;
}) {
  const pages = paragraph.sourcePages ?? (paragraph.sourcePage ? [paragraph.sourcePage] : []);
  return <div className={`passage dialogue-panel role-${role?.kind ?? 'dialogue'}${paragraph.text.length <= 90 ? ' passage-brief' : ''}`} data-paragraph-id={paragraph.id} data-source-id={sourceId ?? paragraph.id}>
    <div className="speaker"><span className="speaker-name">{role?.name ?? paragraph.speaker ?? '对话'}{continuation && <small> · 续</small>}</span>{paragraph.ref && <span>{paragraph.ref}</span>}{showSource && pages.map(page => <SourcePageLink key={page} page={page} />)}</div>
    <p>{passageRuns(paragraph.text, role, paragraph.fragmentOffset ?? 0).map((run,index)=><span key={index} className={run.narration ? 'inline-narration' : undefined}>{run.text}</span>)}</p>
  </div>;
}
