import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {flattenCorpus, createSave, submitAnswer, advance, validateSave} from '../src/reader/engine.ts';
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
  assert.equal(q.options.find(o=>o.id===q.correctId)?.text,draft.anchor,q.id);
  assert.ok(q.original.text.replace(/[①-⑳\s]/g,'').includes(draft.anchor.replace(/[①-⑳\s]/g,'')),q.id);
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
 assert.match(chapter('rule'),/^[〔]?当我们正谈话的时候/);
 assert.match(chapter('life'),/^不过他所说的，不正义的人生活/);
 assert.match(chapter('city'),/^苏：那么很好。在我看来/);
 assert.match(chapter('education'),/^苏：那么，护卫者的天性基础/);
 assert.match(chapter('guardians'),/^苏：那么好，下面我们要确定什么呢/);
 assert.match(chapter('soul'),/^苏：因此，阿里斯同之子/);
});
test('Wrong answers, direct reveals and cross-page questions can finish the entire journey',()=>{
 let save={...createSave(corpus,'complete-guo-content-test'),started:true};
 for(const [i,unit] of units.entries()) {
  assert.equal(save.cursor,i);
  if(unit.question) {
   const wrong=unit.question.options.find(o=>o.id!==unit.question!.correctId)!.id;
   save=submitAnswer(save,unit,i%2?wrong:null);
  }
  save=advance(save,units);
 }
 assert.equal(save.completed,units.length);
 assert.equal(Object.keys(save.answers).length,drafts.length);
 assert.ok(validateSave(save,corpus));
 assert.equal(validateSave({...save,editionId:'republic-shorey-zh-2026-09-08'},corpus),null);
});
test('Public assets contain only original book facsimiles as raster images and never audio',()=>{
 const names=readdirSync(new URL('../reader-public/',import.meta.url),{recursive:true}).map(String);
 assert.ok(names.every(n=>!(/\.(mp3|wav|ogg|m4a|mp4)$/i.test(n))));
 const images=names.filter(n=>/\.(png|jpg|jpeg|webp)$/i.test(n));
 assert.equal(images.length,176);
 assert.ok(images.every(n=>/^facsimile[\\/]page-\d{3}\.webp$/.test(n)));
 assert.ok(!JSON.stringify(corpus).includes('voice-manifest'));
 assert.ok(!JSON.stringify(corpus).includes('endingId'));
 const notice=readFileSync(new URL('../reader-public/TEXT-LICENSE.txt',import.meta.url),'utf8');
 assert.match(notice,/郭斌和、张竹明/);
 assert.ok(!notice.includes('未复制现代出版中文译本'));
});
