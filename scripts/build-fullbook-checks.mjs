import{readFileSync,writeFileSync}from'node:fs';
import assert from'node:assert/strict';
import{flattenCorpus}from'../src/reader/engine.ts';
import{makeReadingPages}from'../src/reader/pagination.ts';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const corpus=read('reader-public/text/republic.json');
const drafts=read('content/learning/fullbook-check-drafts.json');
const units=flattenCorpus(corpus);
// Source page markers are carried forward between original paragraphs. Visible
// fragments retain sourceId, but only paragraphs at a printed-page boundary
// contain sourcePage themselves.
const paragraphPages=new Map();let currentPrintedPage;
for(const unit of units)for(const paragraph of [...unit.paragraphs,...(unit.question?[unit.question.original]:[]),...unit.response]){
 if(paragraph.sourcePage!==undefined)currentPrintedPage=paragraph.sourcePage;
 const sourcePages=paragraph.sourcePages??[currentPrintedPage];
 paragraphPages.set(paragraph.id,sourcePages);
 if(paragraph.sourcePages?.length)currentPrintedPage=paragraph.sourcePages.at(-1);
}
const pages=units.flatMap(u=>makeReadingPages(u).map(p=>({...p,chapterId:u.chapter.id,sectionTitle:u.section.title})));
const old=read('content/learning/checks.json').filter(c=>!c.id.startsWith('learn-full-'));
const used=new Set(old.map(c=>c.pageId));
const errors=[],added=[];
for(const [i,d]of drafts.entries()){
 const[chapterId,slug,printedPage,needle,prompt,correct,wrong1,wrong2,explanation,wrong1Feedback,wrong2Feedback]=d;
 const id=`learn-full-${chapterId}-${slug}`;
 const matches=pages.filter((p,pi)=>p.chapterId===chapterId&&p.kind==='text'&&!used.has(p.id)&&pages[pi-1]?.kind!=='question'&&pages[pi+1]?.kind!=='question'&&p.paragraphs.some(r=>r.text.includes(needle)));
 const page=matches.find(p=>p.paragraphs.some(r=>paragraphPages.get(r.sourceId)?.includes(printedPage)&&r.text.includes(needle)));
 if(!page){errors.push({id,printedPage,needle,reason:'No eligible visible evidence page'});continue;}
 const evidence=page.paragraphs.filter(r=>r.text.includes(needle));
 const optionIds=['a','b','c'];const correctId=optionIds[i%3];
 const texts=[correct,wrong1,wrong2];
 const options=optionIds.map((optionId,oi)=>{const role=(oi-i%3+3)%3;return{id:optionId,text:texts[role],feedback:role===0?explanation:role===1?wrong1Feedback??`这项把本段的比较对象或条件换掉了。${explanation.slice(0,explanation.indexOf('。')+1)}`:wrong2Feedback??`这项把局部讨论扩大成了已经确定的结论。${explanation.slice(0,explanation.indexOf('。')+1)}`};});
 added.push({id,chapterId,pageId:page.id,sourceIds:[...new Set(evidence.map(r=>r.sourceId))],prompt,correctId,options,explanation,sourceRef:`书页${printedPage} · ${page.sectionTitle}`,evidenceAnchors:[needle]});
 used.add(page.id);
}
if(errors.length){console.error(JSON.stringify(errors,null,2));process.exitCode=1;}
else{assert.equal(added.length,drafts.length);writeFileSync('content/learning/checks.json',JSON.stringify([...old,...added],null,2)+'\n');console.log(`${old.length} legacy + ${added.length} complete-book understanding checks`);}
