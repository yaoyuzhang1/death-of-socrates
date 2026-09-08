import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {flattenCorpus, createSave, submitAnswer, advance, validateSave} from '../src/reader/engine.ts';
import type {Corpus} from '../src/reader/model.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const corpus: Corpus = read('reader-public/text/republic.json');
const coverage = read('reader-public/text/coverage.json');
const units = flattenCorpus(corpus);
const compact = (text: string) => text.replace(/\s/g,'');
const textOf = (list: typeof units) => list.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]).map(p=>p.text).join('');

test('Books I–IV contain every source character in order, including long speeches and replies',()=>{
  const source: string[]=[]; const refs: string[]=[];
  for(let book=1;book<=4;book++) {
    const zh=read(`content/source/book${book}-zh.json`), en=read(`content/source/book${book}-en.json`);
    assert.deepEqual(zh.map((r:{ref:string})=>r.ref),en.map((r:{ref:string})=>r.ref));
    assert.equal(zh.length,[136,132,156,131][book-1]);
    for(const r of zh) {
      let text: string=r.text;
      if(book===2||book===4) text=text.replace(/[‘’“”]/g,c=>({'‘':'“','’':'”','“':'‘','”':'’'}[c]!));
      source.push(text); refs.push(r.ref);
    }
  }
  assert.equal(compact(textOf(units)),compact(source.join('')));
  assert.deepEqual(coverage.refs,refs);
  assert.equal(new Set(refs).size,555);
  assert.equal(coverage.sha256,createHash('sha256').update(compact(source.join(''))).digest('hex'));
  assert.match(textOf(units),/外祖父/);
  assert.match(textOf(units.filter(u=>u.chapter.id==='life')),/正义是什么/);
});

test('All questions reveal a real source passage and give immediate substantive comparisons',()=>{
  const paragraphs=units.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]);
  assert.equal(new Set(paragraphs.map(p=>p.id)).size,paragraphs.length);
  assert.equal(new Set(units.map(u=>u.id)).size,units.length);
  const questions=units.flatMap(u=>u.question?[u.question]:[]);
  assert.equal(questions.length,52);
  assert.equal(new Set(questions.map(q=>q.id)).size,52);
  for(const q of questions) {
    assert.equal(q.options.length,3,q.id);
    assert.ok(q.options.some(o=>o.id===q.correctId),q.id);
    assert.ok(q.original.text.length>5,q.id);
    assert.ok(q.explanation.length>=80&&q.explanation.length<=180,q.id);
    assert.ok(q.hint.length>10,q.id);
    assert.ok(q.options.every(o=>o.feedback.length>15),q.id);
  }
  assert.deepEqual(corpus.chapters.map(c=>c.id),['obligations','rule','life','worth','city','education','guardians','soul']);
  assert.ok(corpus.chapters.every(c=>units.some(u=>u.chapter.id===c.id&&u.question)));
});

test('Shared-reference chapter transitions preserve the complete theme before moving on',()=>{
  const chapter=(id:string)=>compact(textOf(units.filter(u=>u.chapter.id===id)));
  assert.match(chapter('rule'),/这留待另一个时候再说。$/);
  assert.match(chapter('life'),/^眼下色拉叙马霍斯的另一项主张/);
  assert.match(chapter('worth'),/请继续，不要推辞。”$/);
  assert.match(chapter('city'),/^“那么，依我看，”我说，“城邦之所以产生/);
  assert.match(chapter('education'),/^“那么，”我说，“这就是他的性格基础/);
  assert.match(chapter('guardians'),/^“很好，”我说，“那么，接下来我们要决定什么/);
  assert.match(chapter('soul'),/^我说：“那么，阿里斯顿之子/);
});

test('A full journey with alternating wrong answers and direct reveals reaches all eight chapters',()=>{
  let save=createSave(corpus,'complete-content-test'); save={...save,started:true};
  for(const [i,unit] of units.entries()) {
    assert.equal(save.cursor,i);
    if(unit.question) {
      const wrong=unit.question.options.find(o=>o.id!==unit.question!.correctId)!.id;
      save=submitAnswer(save,unit,i%2?wrong:null);
    }
    save=advance(save,units);
  }
  assert.equal(save.completed,units.length);
  assert.equal(Object.keys(save.answers).length,52);
  assert.ok(validateSave(save,corpus));
});

test('The shipped public assets contain no voice, audio, or old narrative imagery',()=>{
  const names=readdirSync(new URL('../reader-public/',import.meta.url),{recursive:true}).map(String);
  assert.ok(names.every(name=>!(/\.(mp3|wav|ogg|m4a|mp4|png|jpg|webp)$/i.test(name))),names.join(','));
  assert.ok(!JSON.stringify(corpus).includes('voice-manifest'));
  assert.ok(!JSON.stringify(corpus).includes('endingId'));
});
