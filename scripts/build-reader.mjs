import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const output = new URL('../reader-public/text/', import.meta.url);
mkdirSync(output, {recursive:true});
const source = read('content/source/guo-1986-pages.json');
const pages = source.pages;
assert.deepEqual(pages.map(p=>p.printedPage), Array.from({length:176},(_,i)=>i+1));
assert.deepEqual(pages.filter(p=>[1,44,82,132].includes(p.printedPage)).map(p=>p.book),[1,2,3,4]);
const clean = text => text.replace(/\s/g,'');
let full=''; const spans=[], pageSpans=new Map();
for(const page of pages) {
  assert.equal(page.pdfPage,page.printedPage+11);
  assert.ok(existsSync(new URL(`../reader-public/facsimile/page-${String(page.printedPage).padStart(3,'0')}.webp`,import.meta.url)));
  const firstSpan=spans.length;
  for(const p of page.paragraphs) {
    assert.ok(p.text.trim(),`Empty paragraph on page ${page.printedPage}`);
    if(full && !p.continuesPrevious)full+='\n';
    const start=full.length;
    full+=p.text;
    spans.push({start,end:full.length,page:page.printedPage,ref:p.ref,book:page.book});
  }
  pageSpans.set(page.printedPage,{start:spans[firstSpan].start,end:full.length});
}
const anchorClean=text=>text.replace(/[\s①-⑳]/g,'');
let compact=''; const offsets=[];
for(let i=0;i<full.length;i++) if(!/[\s①-⑳]/.test(full[i])) {compact+=full[i];offsets.push(i);}
const questions=[1,2,3,4].flatMap(book=>read(`content/questions/book${book}.json`));
const speakerPrefix=/^(?:[〔\[［【“]|苏(?:格拉底)?[：:])*\s*$/;
function withSpeakerPrefix(at) {
  const lineStart=full.lastIndexOf('\n',at-1)+1;
  return speakerPrefix.test(full.slice(lineStart,at))?lineStart:at;
}
for(const q of questions) {
  assert.equal(q.prompt,'下面哪句话更像一个好问题？',q.id);
  assert.equal(q.hint,'',q.id);
  assert.equal(q.options.length,3,q.id);
  assert.equal(new Set(q.options.map(o=>o.id)).size,3,q.id);
  const correct=q.options.find(o=>o.id===q.correctId);
  assert.ok(correct, q.id);
  assert.ok(clean(q.anchor).includes(clean(correct.text)),`${q.id}: correct choice must quote the actual question`);
  assert.ok(q.explanation.length>=30&&q.explanation.length<=100,`${q.id}: explanation`);
  assert.ok(q.options.every(o=>o.feedback.length>=15&&o.feedback.length<=70),`${q.id}: feedback`);
  assert.equal(q.pdfPage,q.printedPage+11,`${q.id}: source page`);
  const target=anchorClean(q.anchor),at=compact.indexOf(target);
  assert.ok(at>=0,`Missing anchor: ${q.id}: ${q.anchor}`);
  assert.equal(compact.indexOf(target,at+1),-1,`Ambiguous anchor: ${q.id}`);
  q.start=offsets[at];q.end=offsets[at+target.length-1]+1;
  assert.ok(q.start>=pageSpans.get(q.printedPage).start&&q.start<pageSpans.get(q.printedPage).end,`${q.id}: page mismatch`);
  // Include only a speaker label, never editorially hide extra preceding claims.
  q.start=withSpeakerPrefix(q.start);
}
questions.sort((a,b)=>a.start-b.start);
questions.forEach((q,i)=>{if(i)assert.ok(questions[i-1].end<=q.start,`Overlapping question: ${q.id}`);});
function locate(point) {
  if(point.question) {const q=questions.find(q=>q.id===point.question);assert.ok(q,point.question);return q.start;}
  const page=pageSpans.get(point.page);assert.ok(page,`Missing page ${point.page}`);
  if(point.before) {
    const at=full.indexOf(point.before,page.start);
    assert.ok(at>=page.start&&at<page.end,`Missing boundary p${point.page}: ${point.before}`);
    return withSpeakerPrefix(at);
  }
  return page.start;
}
function spanAt(offset) {return spans.find(s=>offset>=s.start&&offset<s.end)??spans.filter(s=>s.start<=offset).at(-1)??spans[0];}
function printedRange(a,b) {const first=spanAt(a).page,last=spanAt(b-1).page;return first===last?`第 ${first} 页`:`第 ${first}—${last} 页`;}
function sourcePages(a,b) {return [...new Set(spans.filter(s=>s.end>a&&s.start<b).map(s=>s.page))];}
// Keep the speaker's remaining words and the first interlocutor's full reply
// beside the revealed question, before the editorial explanation.
function replyEnd(start,limit,id) {
  const turns=[...full.slice(start,limit).matchAll(/(?:^|\n)[〔\[［【“]?([苏克玻色格阿])[：:]/g)];
  const reply=turns.findIndex(turn=>turn[1]!=='苏');
  assert.ok(reply>=0,`Missing interlocutor reply: ${id}`);
  const next=turns[reply+1];
  return next?start+next.index:limit;
}
let paragraphId=0,unitId=0;
function paragraphs(start,end) {
  const result=[];let at=start,previousPage=null,previousRef=null;
  for(const piece of full.slice(start,end).split(/(\n+)/)) {
    if(piece.trim()) {
      const span=spanAt(at);
      const coveredPages=sourcePages(at,at+piece.length);
      result.push({id:`p-${String(++paragraphId).padStart(4,'0')}`,text:piece,...(span.ref&&span.ref!==previousRef?{ref:span.ref}:{}),...(span.page!==previousPage||coveredPages.length>1?{sourcePage:span.page}:{}),...(coveredPages.length>1?{sourcePages:coveredPages}:{})});
      previousPage=span.page;previousRef=span.ref;
    }
    at+=piece.length;
  }
  return result;
}
const structure=read('content/structure.json');
const chapters=structure.map((chapter,ci)=>{
  const start=locate(chapter.start),end=ci+1<structure.length?locate(structure[ci+1].start):full.length;
  const sections=chapter.sections.map((section,si)=>{
    let a=si===0?start:locate(section.start),b=si+1<chapter.sections.length?locate(chapter.sections[si+1].start):end;
    for(const q of questions){if(a>q.start&&a<q.end)a=q.start;if(b>q.start&&b<q.end)b=q.start;}
    assert.ok(a>=start&&b<=end&&b>a,`Section boundary ${section.id}`);
    const within=questions.filter(q=>q.start>=a&&q.start<b),units=[];let cursor=a;
    for(const [qi,q] of within.entries()) {
      assert.equal(q.chapterId,chapter.id,`Question chapter ${q.id}`);
      assert.ok(q.end<=b,`Split question ${q.id}`);
      const limit=within[qi+1]?.start??b;
      const immediateEnd=replyEnd(q.end,limit,q.id);
      const responseEnd=qi===within.length-1?b:immediateEnd;
      const coveredPages=sourcePages(q.start,q.end);
      const original={id:`p-${String(++paragraphId).padStart(4,'0')}`,speaker:'苏格拉底',ref:q.sourceRef,sourcePage:q.printedPage,...(coveredPages.length>1?{sourcePages:coveredPages}:{}),text:full.slice(q.start,q.end)};
      const before=paragraphs(cursor,q.start),reply=paragraphs(q.end,immediateEnd);
      units.push({id:`u-${String(++unitId).padStart(3,'0')}`,paragraphs:before,question:{id:q.id,sourceRef:q.sourceRef,prompt:q.prompt,original,options:q.options,correctId:q.correctId,explanation:q.explanation,hint:q.hint},replyCount:reply.length,response:[...reply,...paragraphs(immediateEnd,responseEnd)]});
      cursor=responseEnd;
    }
    if(!within.length||cursor<b)units.push({id:`u-${String(++unitId).padStart(3,'0')}`,paragraphs:paragraphs(cursor,b),response:[]});
    return {id:section.id,title:section.title,range:printedRange(a,b),units};
  });
  return {id:chapter.id,title:chapter.title,subtitle:chapter.subtitle,range:chapter.range,introduction:'',conclusion:'',sections};
});
const edition={
  id:'republic-guo-zhang-1986-2026-09-09',
  label:'郭斌和、张竹明译 · 商务印书馆 1986 年版',
  description:'收录《理想国》第一至四卷（书页1—176），按讨论主题分为八章。正文依照本译本扫描整理，保留原有对话次序、人物发言及短应答。',
  translator:'郭斌和、张竹明。商务印书馆，1986年8月第一版、北京第一次印刷。',
  sourceUrl:'https://www.cp.com.cn/book/db77c5fe-b.html',
  license:'译文与原版书页的权利归相应权利人，不适用本项目程序代码的MIT许可或旧版转译稿的CC BY-SA声明。',
  notes:[
    '正文保留本译本的人物称谓、发言简称和术语。八个主题章为阅读分段，不改动原书卷次与论证顺序。',
    '题前不附思路提示。原问选项取自译本；另两项及题后说明为编辑文字，仅围绕当前问答的对象、条件和推论。',
    '“书页”对应1986年版印刷页码。打开后可核对原版扫描及译者注，会看到该页后文。',
    '电子正文经本地文字识别与校正，仍可能残留录入误差。书页扫描为核查依据；字符覆盖检查不等于逐字学术校勘。',
    '每页容纳几轮相邻对话，漫画随阅读进展更换。确认选择后播放普通话解释，答错须重新作答；复习保留首次记录。声音可在阅读设置关闭。'
  ]
};
const corpus={title:'理想国 · 苏格拉底的下一问',edition,chapters};
const units=chapters.flatMap(c=>c.sections.flatMap(s=>s.units));
const reconstructed=units.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]).map(p=>p.text).join('');
assert.equal(clean(reconstructed),clean(full),'Every transcribed source character must occur once, in order');
assert.equal(units.filter(u=>u.question).length,questions.length);
const coverage={editionId:edition.id,sourcePdfSha256:source.pdfSha256,printedPages:pages.map(p=>p.printedPage),pageCount:pages.length,chapterCount:chapters.length,sectionCount:chapters.reduce((n,c)=>n+c.sections.length,0),unitCount:units.length,questionCount:questions.length,characterCount:clean(full).length,sha256:createHash('sha256').update(clean(full)).digest('hex'),chapters:chapters.map(c=>({id:c.id,title:c.title,range:c.range,questions:c.sections.flatMap(s=>s.units).filter(u=>u.question).length}))};
for(const [name,value] of [['republic',corpus],['coverage',coverage],['parallel',source]])writeFileSync(new URL(`${name}.json`,output),JSON.stringify(value,null,2)+'\n');
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pageHtml=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>理想国 · 1986年版书页对照</title><link rel="icon" type="image/svg+xml" href="../icon.svg"><style>body{max-width:1280px;margin:32px auto;padding:0 22px;background:#f7f5ee;color:#242d29;font-family:system-ui;line-height:1.85}a{color:#38644f}h1{font-size:26px}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}.scan{width:100%;height:auto}.text{font-family:SimSun,"Songti SC",serif;font-size:20px}.text p{white-space:pre-wrap;margin:0 0 1em}.notes{font-size:15px;border-top:1px solid #d5d9ce;padding-top:12px}section{border-top:1px solid #ccc;padding:20px 0;scroll-margin-top:12px}.pager{display:flex;justify-content:space-between}small{font:12px system-ui;color:#6d756c}nav{display:flex;gap:12px;flex-wrap:wrap}summary{cursor:pointer}@media(max-width:750px){.pair{grid-template-columns:1fr}.text{font-size:19px}.scan{max-width:650px}}</style><h1>《理想国》第一至四卷 · 书页对照</h1><p>郭斌和、张竹明译 · 商务印书馆1986年8月第一版。书页1—176；含尚未读到的后文。</p><p><a href="../index.html">返回互动阅读</a> · <a href="../TEXT-LICENSE.txt">署名与文本说明</a></p><p>扫描图为本次整理的校核依据。正文经本地文字识别与校正，尚可能有录入误差；脚注保留在原版页图中。以下按书页连续展示，不加入题目与解释。</p><details><summary>跳到书页</summary><nav>${pages.map(p=>`<a href="#p${p.printedPage}">${p.printedPage}</a>`).join(' ')}</nav></details>${pages.map(p=>`<section id="p${p.printedPage}"><h2>第 ${p.printedPage} 页 <small>第${p.book}卷</small></h2><div class="pair"><a href="../facsimile/page-${String(p.printedPage).padStart(3,'0')}.webp" target="_blank"><img class="scan" loading="lazy" width="1428" height="2020" src="../facsimile/page-${String(p.printedPage).padStart(3,'0')}.webp" alt="1986年版第${p.printedPage}页扫描，含本页原文与译者注"></a><div class="text">${p.paragraphs.map(r=>`<p>${escape(r.text)}</p>`).join('')}${p.notes?.length?`<div class="notes"><p>本页译者注（扫描可核对）</p>${p.notes.map(n=>`<p>${escape(n)}</p>`).join('')}</div>`:''}</div></div><div class="pager">${p.printedPage>1?`<a href="#p${p.printedPage-1}">上一页</a>`:'<span></span>'}${p.printedPage<176?`<a href="#p${p.printedPage+1}">下一页</a>`:''}</div></section>`).join('')}</html>`;
writeFileSync(new URL('parallel.html',output),pageHtml);
console.log(`${coverage.pageCount}书页 / ${coverage.chapterCount}章 / ${coverage.sectionCount}小节 / ${coverage.questionCount}题 / ${coverage.characterCount}正文字符；收录次序与字符校验通过。`);
