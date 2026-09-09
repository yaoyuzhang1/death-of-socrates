import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {flattenCorpus, createSave, submitAnswer, advance, validateSave, setReadingMode, setPagePosition, pagePosition, enterChapter} from '../src/reader/engine.ts';
import {makeReadingPages} from '../src/reader/pagination.ts';
import type {Corpus} from '../src/reader/model.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const corpus:Corpus=read('reader-public/text/republic.json');
const coverage=read('reader-public/text/coverage.json');
const source=read('content/source/guo-1986-pages.json');
const drafts=[1,2,3,4].flatMap(b=>read(`content/questions/book${b}.json`));
const units=flattenCorpus(corpus);
const compact=(text:string)=>text.replace(/\s/g,'');
const textOf=(list:typeof units)=>list.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]).map(p=>p.text).join('');
test('All 176 source pages reach the reader once and in order, including uninterrupted cross-page speeches',()=>{
 const text=source.pages.flatMap((p:any)=>p.paragraphs.map((r:any)=>r.text)).join('');
 assert.equal(compact(textOf(units)),compact(text));
 assert.deepEqual(source.pages.map((p:any)=>p.printedPage),Array.from({length:176},(_,i)=>i+1));
 assert.deepEqual(coverage.printedPages,source.pages.map((p:any)=>p.printedPage));
 assert.equal(coverage.sha256,createHash('sha256').update(compact(text)).digest('hex'));
 assert.equal(coverage.pageCount,176);
 assert.match(textOf(units),/克法洛斯/);
 assert.match(textOf(units),/阿得曼托斯/);
 assert.match(textOf(units),/郭斌和|苏格拉底/);
 assert.match(corpus.edition.id,/guo-zhang-1986/);
 for(const p of source.pages) {
  assert.equal(p.pdfPage,p.printedPage+11);
  assert.ok(p.paragraphs.length>0);
  assert.ok(existsSync(new URL(`../reader-public/facsimile/page-${String(p.printedPage).padStart(3,'0')}.webp`,import.meta.url)));
 }
});
test('Every exercise quotes its verified source question and gives immediate, restrained comparisons',()=>{
 const paragraphs=units.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]);
 assert.equal(new Set(paragraphs.map(p=>p.id)).size,paragraphs.length);
 assert.equal(new Set(units.map(u=>u.id)).size,units.length);
 const questions=units.flatMap(u=>u.question?[u.question]:[]);
 assert.equal(questions.length,47);
 assert.equal(questions.length,drafts.length);
 assert.equal(coverage.questionCount,questions.length);
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 for(const q of questions) {
  const draft=drafts.find(d=>d.id===q.id);
  assert.equal(q.options.length,3,q.id);
  const assessedAnchor=draft.assessmentAnchor??draft.anchor;
  assert.equal(q.options.find(o=>o.id===q.correctId)?.text,assessedAnchor,q.id);
  assert.ok(q.original.text.replace(/[①-⑳\s]/g,'').includes(assessedAnchor.replace(/[①-⑳\s]/g,'')),q.id);
  assert.equal(q.original.sourcePage,draft.printedPage,q.id);
  assert.ok(q.explanation.length>=30&&q.explanation.length<=100,q.id);
  assert.ok(q.options.every(o=>o.feedback.length>=15&&o.feedback.length<=70),q.id);
  assert.equal(q.prompt,'下面哪句话更像一个好问题？',q.id);
  assert.equal(q.hint,'',q.id);
 }
 assert.deepEqual(corpus.chapters.map(c=>c.id),['obligations','rule','life','worth','city','education','guardians','soul']);
 assert.ok(corpus.chapters.every(c=>units.some(u=>u.chapter.id===c.id&&u.question)));
 assert.ok(corpus.chapters.every(c=>c.introduction===''&&c.conclusion===''));
 for(const id of ['book3-conceded-conclusion','book3-song-words-standard','book3-letters-and-images','book3-testing-convictions','book4-city-limit'])assert.ok(!questions.some(q=>q.id===id));
});
test('Theme boundaries use the source transitions and do not drop introductions or replies',()=>{
 const chapter=(id:string)=>compact(textOf(units.filter(u=>u.chapter.id===id)));
 assert.match(chapter('rule'),/^[〔［【\[]?当我们正谈话的时候/);
 assert.match(chapter('life'),/^不过他所说的，不正义的人生活/);
 assert.match(chapter('city'),/^苏：那么很好。在我看来/);
 assert.match(chapter('education'),/^苏：那么，护卫者的天性基础/);
 assert.match(chapter('guardians'),/^苏：那么好，下面我们要确定什么呢/);
 assert.match(chapter('soul'),/^苏：因此，阿里斯同之子/);
 const section=(id:string)=>compact(textOf(units.filter(u=>u.section.id===id)));
 assert.match(section('age-wealth'),/^苏：说真的，克法洛斯，我喜欢跟你们上了年纪的人谈话/);
 assert.match(section('large-small'),/^苏：[〔［【\[]我对于格劳孔/);
 assert.match(section('luxury'),/^[〔［【\[]这时候格劳孔/);
 for(const chapter of corpus.chapters) for(const section of chapter.sections) {
  const last=section.units.at(-1)!;
  const ending=(last.response.at(-1)??last.question?.original??last.paragraphs.at(-1))!.text;
  assert.doesNotMatch(ending,/(?:[〔［【\[]|苏：)$/u,section.id);
 }
});
test('Complete alternative questions and the interlocutor reply stay together before explanations',()=>{
 for(const unit of units.filter(u=>u.question)) {
  const reply=unit.response.slice(0,unit.replyCount);
  assert.ok(unit.replyCount&&unit.replyCount<=unit.response.length,unit.question!.id);
  assert.match(reply.map(p=>p.text).join('\n'),/(?:^|\n)[〔［【\[“]?[克玻色格阿]：/,unit.question!.id);
 }
 const find=(id:string)=>units.find(u=>u.question?.id===id)!;
 assert.match(find('book2-division-alternatives').question!.original.text,/还是不管别人[\s\S]+只顾自己的需要呢？$/);
 assert.match(find('book4-spirit-reason').question!.original.text,/或者还是说[\s\S]+如果不被坏教育所败坏的话）？$/);
 assert.equal(find('book1-what-harm-means').response[0].text,'玻：当然可以这么说。');
 assert.equal(find('book4-opposites').response[0].text,'格：是无论如何不可能的。');
});
test('Translator notes remain outside the dialogue and verified marginal artifacts are absent',()=>{
 const body=textOf(units);
 for(const [page,note] of [[15,'公元前6世纪中叶人'],[69,'对智慧的爱好'],[71,'当时托儿所里']] as const) {
  const sourceNote=source.pages[page-1].notes.find((n:string)=>n.includes(note));
  assert.ok(sourceNote,`p${page}`);
  assert.ok(!body.includes(sourceNote),`footnote in dialogue p${page}`);
 }
 assert.ok(!body.includes('里塑'));
 assert.ok(!body.includes('衣服.上'));
 assert.ok(!source.pages[6].paragraphs.some((p:any)=>p.text==='品'));
});
test('Cross-page passages expose each source page without duplicating the text',()=>{
 const passages=units.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]);
 assert.ok(passages.some(p=>(p.sourcePages?.length??0)>1));
 for(const p of passages.filter(p=>p.sourcePages)) {
  assert.equal(p.sourcePages![0],p.sourcePage);
  assert.equal(new Set(p.sourcePages).size,p.sourcePages!.length);
  for(const page of p.sourcePages!) assert.ok(page>=1&&page<=176);
 }
});
test('Every source question can be corrected after an initial mistake without changing the complete journey',()=>{
 let save={...setReadingMode(createSave(corpus,'complete-guo-content-test'),'continuous'),started:true};
 for(const [i,unit] of units.entries()) {
  if(units[save.cursor].chapter.id!==unit.chapter.id)save=enterChapter(save,units,unit.chapter.id);
  assert.equal(save.cursor,i);
  if(unit.question) {
   const wrong=unit.question.options.find(o=>o.id!==unit.question!.correctId)!.id;
   save=submitAnswer(save,unit,i%2?wrong:null);
   assert.equal(advance(save,units),save,unit.id);
   save=submitAnswer(save,unit,unit.question.correctId);
  }
  save=advance(save,units);
 }
 assert.equal(save.completed,units.length);
 assert.equal(Object.keys(save.answers).length,drafts.length);
 assert.ok(validateSave(save,corpus));
 assert.equal(validateSave({...save,editionId:'republic-shorey-zh-2026-09-08'},corpus),null);
});
test('The full short-page journey reaches every source page and question with correction and reload gates intact',()=>{
 let save=createSave(corpus,'complete-short-page-test');
 const body:string[]=[];
 for(const unit of units) {
  if(units[save.cursor].chapter.id!==unit.chapter.id)save=enterChapter(save,units,unit.chapter.id);
  assert.equal(save.cursor,unit.index);
  const pages=makeReadingPages(unit);
  for(const [index,page] of pages.entries()) {
   save=setPagePosition(save,unit,index);
   assert.equal(pagePosition(save,unit),index);
   if(page.kind==='question') {
    const wrong=page.question.options.find(option=>option.id!==page.question.correctId)!.id;
    save=submitAnswer(save,unit,wrong);
    assert.equal(advance(save,units),save);
    assert.throws(()=>setPagePosition(save,unit,index+1));
    save=validateSave(JSON.parse(JSON.stringify(save)),corpus)!;
    assert.ok(save,unit.id);
    assert.equal(advance(save,units),save);
    save=submitAnswer(save,unit,page.question.correctId);
   } else body.push(...page.paragraphs.map(paragraph=>paragraph.text));
   if(index<pages.length-1) assert.equal(advance(save,units),save);
  }
  save=advance(save,units);
  assert.ok(validateSave(save,corpus),unit.id);
 }
 assert.equal(save.completed,53);
 assert.equal(save.resolved.length,47);
 assert.equal(body.join(''),textOf(units));
});
test('Original book facsimiles remain complete and game illustrations and audio stay in separate asset directories',()=>{
 const names=readdirSync(new URL('../reader-public/',import.meta.url),{recursive:true}).map(String);
 const audio=names.filter(n=>/\.(mp3|wav|ogg|m4a|mp4)$/i.test(n));
 assert.ok(audio.every(n=>/^audio[\\/]/.test(n)));
 const images=names.filter(n=>/\.(png|jpg|jpeg|webp)$/i.test(n));
 const facsimiles=images.filter(n=>/^facsimile[\\/]/.test(n));
 assert.equal(facsimiles.length,176);
 assert.ok(facsimiles.every(n=>/^facsimile[\\/]page-\d{3}\.webp$/.test(n)));
 assert.ok(images.every(n=>/^facsimile[\\/]|^illustrations[\\/]/.test(n)));
 assert.ok(!JSON.stringify(corpus).includes('voice-manifest'));
 assert.ok(!JSON.stringify(corpus).includes('endingId'));
 const notice=readFileSync(new URL('../reader-public/TEXT-LICENSE.txt',import.meta.url),'utf8');
 assert.match(notice,/郭斌和、张竹明/);
 assert.ok(!notice.includes('未复制现代出版中文译本'));
});
