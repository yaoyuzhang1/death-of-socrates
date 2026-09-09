import { useEffect, useState } from 'react';
import { ChevronDown, MapPin, Users } from 'lucide-react';
import type { ReadingUnit } from './model.ts';
import type { ReadingPage } from './pagination.ts';
import type { PassageRole } from './ReadingPassage.tsx';
import './conversation-context.css';

const people: Record<string, { role: string; description: string }> = {
  苏格拉底: { role: '谈话者', description: '对话围绕他的追问展开。《理想国》以他回述昨日聚谈的方式开场。' },
  克法洛斯: { role: '年长的主人', description: '玻勒马霍斯的父亲。苏格拉底来访时，他刚参加过祭祀，坐在带靠垫的椅子上。' },
  玻勒马霍斯: { role: '邀客者', description: '克法洛斯的儿子。在《理想国》开篇，他来到回城路上，挽留苏格拉底一行。' },
  格劳孔: { role: '同行的友人', description: '阿里斯同的儿子，与苏格拉底一同来到比雷埃夫斯港参加祭会。' },
  阿得曼托斯: { role: '同席的友人', description: '格劳孔的兄弟。他也参加这次聚谈，在对话中提出自己的疑问。' },
  色拉叙马霍斯: { role: '同席的客人', description: '来自卡克冬，在玻勒马霍斯家中作客。他与苏格拉底直接展开辩论。' },
  克勒托丰: { role: '同席的客人', description: '阿里斯托纽摩斯的儿子。他在讨论中插话，补充对一项说法的理解。' },
  克里同: { role: '朋友', description: '与苏格拉底多年相识的友人，在《申辩篇》《克里同篇》《斐多篇》的叙事中出现。' },
  美勒托: { role: '控告者', description: '正式起诉者之一。在《申辩篇》的叙事中，他接受苏格拉底的当庭盘问。' },
  西米亚斯: { role: '探望者', description: '《斐多篇》中到牢房探望苏格拉底的朋友，参与最后一天的论辩。' },
  克贝: { role: '探望者', description: '《斐多篇》中参与谈话的朋友，提出对论证的疑问与反驳。' },
  斐多: { role: '转述者', description: '《斐多篇》以他向厄刻克拉底转述那一天的见闻展开。' },
};
export type DialogueContext = { place: string; background: string; people: string[]; sourceRef?: string; mode?: 'bonus' };
const chapterPeople: Record<string, string[]> = {
  obligations: ['苏格拉底', '玻勒马霍斯'], rule: ['苏格拉底', '色拉叙马霍斯'], life: ['苏格拉底', '色拉叙马霍斯'],
  worth: ['苏格拉底', '格劳孔', '阿得曼托斯'], city: ['苏格拉底', '阿得曼托斯', '格劳孔'],
  education: ['苏格拉底', '阿得曼托斯', '格劳孔'], guardians: ['苏格拉底', '阿得曼托斯'], soul: ['苏格拉底', '格劳孔'],
};
const backgrounds: Record<string, string> = {
  obligations: '朋友们仍在玻勒马霍斯家聚谈。克法洛斯离席以后，玻勒马霍斯接着与苏格拉底问答。',
  rule: '谈话仍在同一处宅院中。色拉叙马霍斯加入争论，其他客人也有插话。',
  life: '围坐的众人继续听苏格拉底与色拉叙马霍斯的问答，没有更换地点。',
  worth: '众人仍在同一处家中。苏格拉底继续回应格劳孔与阿得曼托斯提出的疑问。',
  city: '众人仍在家中聚谈。文中构想的城邦是谈话的对象，并非人物已经到达的新地点。',
  education: '众人仍围坐在原处，谈话进入护卫者的培养问题。文中提到的故事、职业与活动不是新的现场。',
  guardians: '众人仍在玻勒马霍斯家中。关于卫士和城邦的讨论由在场的朋友继续接话。',
  soul: '仍是同一次聚谈。苏格拉底与格劳孔交替发问、应答，其他友人在旁。',
};

export function getReadingContext(unit: ReadingUnit, page: ReadingPage, roles: Map<string, PassageRole>): DialogueContext {
  const passages = page.kind === 'text' ? page.paragraphs : unit.paragraphs;
  const harbor = unit.id === 'u-001' && page.kind === 'text' && page.paragraphs.every(paragraph => Number(paragraph.sourceId.slice(2)) < 19);
  const current = passages.flatMap(paragraph => {
    const id = 'sourceId' in paragraph ? String(paragraph.sourceId) : paragraph.id;
    const role = roles.get(id);
    // A person mentioned in someone's speech need not be present (e.g. Cephalus on the road).
    return role && role.kind !== 'narration' ? [role.name] : [];
  });
  const chapterPassages = unit.chapter.sections.flatMap(section => section.units.flatMap(item => [...item.paragraphs, ...(item.question ? [item.question.original] : []), ...item.response]));
  const lastVisible = passages.at(-1);
  const lastId = lastVisible && ('sourceId' in lastVisible ? String(lastVisible.sourceId) : lastVisible.id);
  const currentPosition = chapterPassages.findIndex(paragraph => paragraph.id === (lastId ?? unit.question?.original.id));
  const departurePosition = chapterPassages.findIndex(paragraph => paragraph.id === 'p-0045');
  const cephalusPresent = unit.chapter.id === 'obligations' && !harbor && departurePosition >= 0 && currentPosition >= 0 && currentPosition < departurePosition;
  let defaults = chapterPeople[unit.chapter.id] ?? ['苏格拉底'];
  let background = backgrounds[unit.chapter.id];
  if (harbor) {
    defaults = ['苏格拉底', '格劳孔', '玻勒马霍斯', '阿得曼托斯'];
    background = '苏格拉底与格劳孔参加祭会后准备回城，途中遇见了前来挽留他们的朋友。';
  } else if (cephalusPresent) {
    defaults = ['苏格拉底', '克法洛斯'];
    background = '朋友们来到玻勒马霍斯家，在克法洛斯身旁围坐交谈。';
  } else if (unit.chapter.id === 'worth' && unit.section.id === 'glaucon') {
    defaults = ['苏格拉底', '格劳孔'];
    background = '格劳孔接着向苏格拉底发问，其他朋友仍在旁听。';
  } else if (unit.chapter.id === 'worth' && unit.section.id === 'adeimantus') {
    defaults = ['苏格拉底', '阿得曼托斯', '格劳孔'];
    background = '格劳孔一段发言结束后，阿得曼托斯接过话来。众人仍在原处。';
  } else if (unit.chapter.id === 'city') {
    defaults = ['苏格拉底', unit.section.id === 'needs' ? '阿得曼托斯' : '格劳孔'];
  } else if (unit.chapter.id === 'education') {
    defaults = ['苏格拉底', ['stories', 'narration'].includes(unit.section.id) ? '阿得曼托斯' : '格劳孔'];
  } else if (unit.chapter.id === 'guardians') {
    const glaucon = ['selection', 'shared-life'].includes(unit.section.id);
    defaults = ['苏格拉底', glaucon ? '格劳孔' : '阿得曼托斯'];
    background = glaucon ? '苏格拉底与格劳孔继续问答，众人仍在玻勒马霍斯家。' : '阿得曼托斯接过问答。聚谈仍在原处继续，并未移往文中构想的城邦。';
  }
  return {
    place: harbor ? '比雷埃夫斯港 · 归途' : '比雷埃夫斯港 · 玻勒马霍斯家',
    background,
    people: [...new Set([...defaults, ...current])].filter(name => people[name] && (name !== '克法洛斯' || cephalusPresent || page.kind === 'text' && current.includes(name))).slice(0, 5),
    sourceRef: unit.section.range,
  };
}

export function getBonusContext(scene: { id: string; place: string; sourceRef: string; passages: { speaker: string; text: string }[] }): DialogueContext {
  const court = ['trial-gate', 'old-accusations', 'charges', 'examination', 'commitment', 'verdict', 'sentence'].includes(scene.id);
  const cast = scene.passages.flatMap(passage => [passage.speaker, ...Object.keys(people).filter(name => passage.text.includes(name))]);
  return { place: scene.place, sourceRef: scene.sourceRef, mode: 'bonus',
    background: court ? '雅典公民组成法庭。此处依据《申辩篇》的叙述改写，作品并非逐字庭审记录。' : scene.id === 'laws' ? '牢房里的对话。“法律”是苏格拉底设想并代为说出的声音，不是另一位到场人物。' : scene.id === 'escape' ? '行刑之前，克里同私下到牢房探望；苏格拉底与他讨论眼下的选择。' : '朋友们来到牢房。《斐多篇》通过斐多的转述记下最后一天的谈话；柏拉图未被写成在场者。',
    people: [...new Set(['苏格拉底', ...cast, ...(!court ? ['克里同'] : [])])].filter(name => people[name]).slice(0, 5),
  };
}

export default function ConversationContext({ place, background, people: cast, sourceRef, mode }: DialogueContext) {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 1100px)').matches);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { const media = matchMedia('(min-width: 1100px)'); const change = () => setWide(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return <aside className="conversation-context" aria-label="人物与对话背景" data-testid="conversation-context"><details open={wide || expanded} onToggle={event => { if (!wide) setExpanded(event.currentTarget.open); }}>
    <summary><Users size={16} /><span>人物与场景</span><ChevronDown size={14} /></summary>
    <div className="context-content"><section className="context-place"><p className="eyebrow">此刻的谈话</p><h2><MapPin size={15} />{place}</h2><p>{background}</p></section>
    <section className="context-people"><h2>参与对话的人</h2>{cast.map(name => <article key={name}><div><span className="context-initial" aria-hidden="true">{name.slice(0, 1)}</span><h3>{name}<small>{people[name]?.role ?? '谈话者'}</small></h3></div><p>{mode === 'bonus' && name === '苏格拉底' ? '公元前399年在雅典受审的人。本章依据柏拉图的作品改写他的申辩与最后的谈话。' : people[name]?.description ?? '本段对话的参与者。'}</p></article>)}</section>
    {sourceRef && <p className="context-source">本段原作位置<br />{sourceRef}</p>}<p className="context-caption">人物与背景为阅读辅助，不替代原文。</p></div>
  </details></aside>;
}
