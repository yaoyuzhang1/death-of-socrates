import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { flattenCorpus } from '../src/reader/engine.ts';
import { passageRoles,passageRuns } from '../src/reader/passage-roles.ts';
const read=(file:string)=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');

test('The sameness challenge assesses the explicitly qualified original question, after the preliminary exchange is readable',()=>{
  const unit=flattenCorpus(read('reader-public/text/republic.json')).find(u=>u.question?.id==='book4-same-form')!;
  assert.ok(unit.paragraphs.some(p=>p.id==='p-1657'&&p.text.includes('虽有同一名称而不相同')));
  assert.equal(unit.paragraphs.at(-1)?.text,'格：相同。');
  assert.equal(unit.question!.original.id,'p-1661');
  assert.ok(unit.question!.original.text.includes('仅就正义的概念而论'));
  assert.equal(unit.response[0].id,'p-1662');
  assert.equal(unit.response[0].text,'格：是的。');
});

test('Printed narration, quoted replies, and dialogue after closing brackets retain the correct source speaker',()=>{
  const corpus=read('reader-public/text/republic.json'),roles=passageRoles(corpus);
  const find=(text:string)=>[...roles.values()].find(role=>role.text.includes(text))!;
  for(const phrase of ['难道不是谁强谁统治吗','苏格拉底，当然你不会认为这个问题已经说透彻了吧','假如有人反对你的主张'])assert.equal(find(phrase).kind,'dialogue',phrase);
  for(const phrase of ['我们现在进行的这个探讨非比寻常','既然得到报酬的这种利益','亲爱的克法洛斯，我想'])assert.equal(find(phrase).kind,'socrates',phrase);
  for(const phrase of ['色拉叙马霍斯表示同意，但是非常勉强','到此阿得曼托斯插进来'])assert.equal(find(phrase).kind,'narration',phrase);
  for(const [narration,speech] of [['我听了克法洛斯的话颇为佩服','亲爱的克法洛斯'],['听了他的这番发话','亲爱的色拉叙马霍斯啊']]){
    const role=find(narration),runs=passageRuns(role.text,role);
    assert.equal(runs.map(run=>run.text).join(''),role.text);
    assert.equal(runs.find(run=>run.text.includes(narration))?.narration,true);
    assert.equal(runs.find(run=>run.text.includes(speech))?.narration,false);
    const offset=role.text.indexOf(speech);
    assert.equal(passageRuns(role.text.slice(offset,offset+speech.length),role,offset)[0].narration,false);
  }
});

test('The restored page 19 argument belongs to Thrasymachus, with existing following paragraph anchors retained',()=>{
  const units=flattenCorpus(read('reader-public/text/republic.json'));
  const paragraphs=units.flatMap(u=>[...u.paragraphs,...(u.question?[u.question.original]:[]),...u.response]);
  assert.equal(new Set(paragraphs.map(p=>p.id)).size,paragraphs.length);
  const index=paragraphs.findIndex(p=>p.id==='p-0220');
  assert.equal(paragraphs[index-1].id,'p-0220-reply');
  assert.equal(paragraphs[index-1].text,'苏：是的。');
  assert.ok(paragraphs[index].text.startsWith('色：难道不是谁强谁统治吗？每一种统治者都制定对自己有利的法律'));
  assert.equal(paragraphs[index+1].id,'p-0221');
  assert.ok(paragraphs[index+1].text.startsWith('苏：现在我明白你的意思了。'));
});

test('Every hidden passage and response note has a verifiable original anchor and an explicit editorial or translation label',()=>{
  const story=read('content/bonus/death.json'), alignment=read('content/bonus/source-alignment.json');
  assert.deepEqual(alignment.anchorOffsetScheme,{
    origin:0,unit:'UTF-16 code units',textNormalization:"replace(/\\s+/g, ' '); no trim",
    comparison:'case-insensitive',sourceHashInput:'original UTF-8 decoded text before normalization',
  });
  const sourceFiles=new Map<string,string>();
  for(const source of alignment.sources){
    const text=readFileSync(new URL('../'+source.file,import.meta.url),'utf8');
    assert.equal(digest(text),source.sha256);
    // Hash the original file above; offsets refer to the whitespace-collapsed
    // string used by the source alignment, not to raw bytes or printed lines.
    sourceFiles.set(source.file,text.replace(/\s+/g,' '));
  }
  const expectedPaths:string[]=[];
  for(const [si,scene] of story.scenes.entries()){
    scene.passages.forEach((_:unknown,pi:number)=>expectedPaths.push(`scenes[${si}].passages[${pi}]`));
    scene.question.options.forEach((option:any,oi:number)=>{
      option.response.forEach((_:unknown,pi:number)=>expectedPaths.push(`scenes[${si}].question.options[${oi}].response[${pi}]`));
      expectedPaths.push(`scenes[${si}].question.options[${oi}].note`);
    });
  }
  story.ending.passages.forEach((_:unknown,pi:number)=>expectedPaths.push(`ending.passages[${pi}]`));
  assert.deepEqual(alignment.segments.map((entry:any)=>entry.path).sort(),expectedPaths.sort());
  for(const entry of alignment.segments){
    const value=entry.path.replace(/\[(\d+)\]/g,'.$1').split('.').reduce((obj:any,key:string)=>obj[key],story);
    const text=typeof value==='string'?value:value.text;
    assert.equal(digest(text),entry.textSha256,entry.path);
    const reference=sourceFiles.get(entry.referenceFile)!;
    assert.ok(entry.anchor.length>8,entry.path);
    assert.ok(Number.isInteger(entry.anchorOffset)&&entry.anchorOffset>=0,entry.path);
    assert.equal(reference.slice(entry.anchorOffset,entry.anchorOffset+entry.anchor.length).toLowerCase(),entry.anchor.toLowerCase(),entry.path);
    assert.ok(alignment.sourceKinds[entry.sourceKind],entry.path);
    if(typeof value!=='string'){
      for(const key of ['sourceRef','sourceKind','sourceUrl'])assert.equal(value[key],entry[key],entry.path);
      if(value.speaker!=='旁白')assert.equal(value.sourceKind,'原作节译',entry.path+' must not attribute editorial narration to a speaker');
    }
  }
});

test('Every hidden judgment cites fixed passages that are available regardless of the exploratory option chosen',()=>{
  const story=read('content/bonus/death.json');
  for(const check of read('content/bonus/checks.json')){
    const scene=story.scenes.find((s:any)=>s.id===check.sceneId);
    assert.ok(check.evidencePassages.length>0,check.id);
    for(const index of check.evidencePassages){
      assert.ok(Number.isInteger(index)&&index>=0&&index<scene.passages.length,check.id);
      assert.ok(check.sourceRef.includes(scene.passages[index].sourceRef),check.id);
    }
  }
});
