import type { Corpus } from './model.ts';
type Kind = 'socrates' | 'dialogue' | 'narration';
export type PassageRole = { kind: Kind; name: string; text: string; narrationRanges: [number, number][] };
const names: Record<string, string> = { 苏: '苏格拉底', 苏格拉底: '苏格拉底', 克: '克法洛斯', 玻: '玻勒马霍斯', 格: '格劳孔', 阿: '阿得曼托斯', 色: '色拉叙马霍斯', 克勒: '克勒托丰', 格劳孔: '格劳孔' };
const opens=/[〔［【\[]/u, closes=/[〕］】\]]/u;

export function passageRoles(corpus: Corpus): Map<string, PassageRole> {
  const roles = new Map<string, PassageRole>();
  let speaker='苏格拉底', narration=false;
  for(const chapter of corpus.chapters)for(const section of chapter.sections)for(const unit of section.units){
    for(const paragraph of [...unit.paragraphs,...(unit.question?[unit.question.original]:[]),...unit.response]){
      const text=paragraph.text;
      const prefix=text.match(/^[·]?([^：]{1,10})：/)?.[1]?.replace(/（.*）/u,'');
      if(prefix&&names[prefix])speaker=names[prefix];
      let start=narration?0:-1;
      let ranges:[number,number][]=[];
      for(let index=0;index<text.length;index++){
        if(opens.test(text[index])){if(!narration)start=index;narration=true;speaker='苏格拉底';}
        else if(closes.test(text[index])&&narration){ranges.push([start,index+1]);narration=false;start=-1;}
      }
      if(narration)ranges.push([start,text.length]);
      // Printed p16 embeds Socrates' directly quoted reply inside his narration.
      // Keep that verified reply distinct without adding words or changing the source.
      if(text.startsWith('〔听了他的这番发话')){
        const quoteStart=text.indexOf('“亲爱的色拉叙马霍斯啊');
        const quoteEnd=text.lastIndexOf('”')+1;
        if(quoteStart>=0&&quoteEnd>quoteStart)ranges=ranges.flatMap(([a,b])=>{
          if(b<=quoteStart||a>=quoteEnd)return [[a,b] as [number,number]];
          return [...(a<quoteStart?[[a,quoteStart] as [number,number]]:[]),...(b>quoteEnd?[[quoteEnd,b] as [number,number]]:[])];
        });
      }
      const spokenText=text.split('').filter((_,i)=>!ranges.some(([a,b])=>i>=a&&i<b)).join('').replace(/^[·]?[^：]{1,10}：/u,'').trim();
      const kind:Kind=spokenText?(speaker==='苏格拉底'?'socrates':'dialogue'):'narration';
      roles.set(paragraph.id,{kind,name:kind==='narration'?'叙述':speaker,text,narrationRanges:ranges});
    }
  }
  return roles;
}

export function passageRuns(text:string,role?:PassageRole,offset=0):{text:string;narration:boolean}[]{
  if(!role)return [{text,narration:false}];
  const runs:{text:string;narration:boolean}[]=[];
  for(let i=0;i<text.length;i++){
    const narration=role.narrationRanges.some(([a,b])=>i+offset>=a&&i+offset<b);
    if(runs.at(-1)?.narration===narration)runs.at(-1)!.text+=text[i];
    else runs.push({text:text[i],narration});
  }
  return runs;
}
