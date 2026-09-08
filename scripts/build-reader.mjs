import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const output = new URL('../reader-public/text/', import.meta.url);
mkdirSync(output, {recursive: true});
const rows = [], questions = [];
const quote = (text, book) => [2, 4].includes(book) ? text.replace(/[‘’“”]/g, c => ({'‘':'“','’':'”','“':'‘','”':'’'}[c])) : text;
const clean = text => text.replace(/\s/g, '');
for (let book = 1; book <= 4; book++) {
  const en = read(`content/source/book${book}-en.json`), zh = read(`content/source/book${book}-zh.json`);
  assert.deepEqual(zh.map(r => r.ref), en.map(r => r.ref), `Book ${book} reference coverage`);
  assert.equal(zh.length, [136, 132, 156, 131][book - 1]);
  zh.forEach((r, i) => { assert.ok(r.text.trim(), r.ref); rows.push({...r, text: quote(r.text, book), book, english: en[i].english}); });
  questions.push(...read(`content/questions/book${book}.json`).map(q => ({...q, anchor: quote(q.anchor, book)})));
}
assert.equal(new Set(rows.map(r => r.ref)).size, 555);
let full = '';
const refs = new Map();
for (const row of rows) {
  if (row.ref === '357a' || row.ref === '386a' || row.ref === '419a') full += '\n\n';
  refs.set(row.ref, {start: full.length, end: full.length + row.text.length, book: row.book});
  full += row.text;
}
// A normalized index permits anchors to span Stephanus boundaries, which can fall mid-sentence.
let compact = ''; const offsets = [];
for (let i = 0; i < full.length; i++) if (!/\s/.test(full[i])) { compact += full[i]; offsets.push(i); }
for (const q of questions) {
  assert.equal(q.options.length, 3, q.id);
  assert.equal(new Set(q.options.map(o => o.id)).size, 3, q.id);
  assert.equal(q.options.filter(o => o.id === q.correctId).length, 1, q.id);
  assert.ok(q.explanation.length >= 80 && q.explanation.length <= 180, `${q.id} explanation`);
  assert.ok(q.options.every(o => o.feedback.length > 15), `${q.id} feedback`);
  const target = clean(q.anchor), index = compact.indexOf(target);
  assert.ok(index >= 0, `Missing anchor: ${q.id}`);
  assert.equal(compact.indexOf(target, index + 1), -1, `Ambiguous anchor: ${q.id}`);
  q.start = offsets[index]; q.end = offsets[index + target.length - 1] + 1;
  // Bring short speech introductions and closing quotation marks into the revealed original.
  const lineStart = full.lastIndexOf('\n', q.start - 1) + 1;
  const prefix = full.slice(lineStart, q.start);
  if (prefix.length < 45 && !/[。？！]/.test(prefix)) q.start = lineStart;
  if (/^[”’]/.test(full.slice(q.end))) q.end++;
}
questions.sort((a,b) => a.start - b.start);
questions.forEach((q,i) => { if(i) assert.ok(questions[i-1].end <= q.start, `Overlapping questions ${q.id}`); });

function locate(point) {
  if (point.question) { const q = questions.find(q => q.id === point.question); assert.ok(q); return q.start; }
  const ref = refs.get(point.ref); assert.ok(ref, point.ref);
  if (point.before) {
    const marker = quote(point.before, ref.book), index = full.indexOf(marker, ref.start);
    assert.ok(index >= ref.start && index < ref.end, `Missing boundary ${point.ref}: ${marker}`);
    return index;
  }
  if (point.paragraph) return full.lastIndexOf('\n', ref.start - 1) + 1;
  return ref.start;
}
function refAt(offset) {
  return rows.find(r => {const span = refs.get(r.ref); return offset >= span.start && offset < span.end;})?.ref
    ?? rows.filter(r => refs.get(r.ref).start <= offset).at(-1)?.ref ?? rows[0].ref;
}
const refRange = (start, end) => refAt(start) === refAt(Math.max(start, end - 1)) ? refAt(start) : `${refAt(start)}—${refAt(end - 1)}`;
let paragraphId = 0, unitId = 0;
function paragraphs(start, end) {
  const result = []; let at = start, previousRef = '';
  for (const piece of full.slice(start, end).split(/(\n+)/)) {
    if (piece.trim()) {
      const ref = refRange(at, at + piece.length);
      result.push({id: `p-${String(++paragraphId).padStart(4,'0')}`, text: piece, ...(previousRef !== ref ? {ref} : {})});
      previousRef = ref;
    }
    at += piece.length;
  }
  return result;
}
const structure = read('content/structure.json');
const chapters = structure.map((chapter, ci) => {
  const start = locate(chapter.start), end = ci + 1 < structure.length ? locate(structure[ci + 1].start) : full.length;
  const sections = chapter.sections.map((section, si) => {
    let a = si === 0 ? start : locate(section.start), b = si + 1 < chapter.sections.length ? locate(chapter.sections[si + 1].start) : end;
    // A subsection marker cannot split the actual question that is being withheld.
    const containingA = questions.find(q => a > q.start && a < q.end);
    const containingB = questions.find(q => b > q.start && b < q.end);
    if (containingA) a = containingA.start;
    if (containingB) b = containingB.start;
    assert.ok(a >= start && b <= end && b > a, `Section boundaries ${section.id}`);
    const within = questions.filter(q => q.start >= a && q.start < b);
    const units = []; let cursor = a;
    for (const [qi, q] of within.entries()) {
      assert.equal(q.chapterId, chapter.id, `Question in wrong chapter: ${q.id}`);
      assert.ok(q.end <= b, `Question split across sections: ${q.id}`);
      // Show the immediate reply after feedback. The rest follows in source order.
      const limit = within[qi + 1]?.start ?? b;
      let responseEnd = qi === within.length - 1 ? b : full.indexOf('\n', q.end + 2);
      if (responseEnd < q.end || responseEnd > limit) responseEnd = q.end;
      const original = {id: `p-${String(++paragraphId).padStart(4,'0')}`, speaker: '苏格拉底', ref: q.sourceRef, text: full.slice(q.start, q.end)};
      units.push({id:`u-${String(++unitId).padStart(3,'0')}`, paragraphs:paragraphs(cursor,q.start), question: {id:q.id,sourceRef:q.sourceRef,prompt:q.prompt,original,options:q.options,correctId:q.correctId,explanation:q.explanation,hint:q.hint}, response:paragraphs(q.end,responseEnd)});
      cursor = responseEnd;
    }
    if (!within.length || cursor < b) units.push({id:`u-${String(++unitId).padStart(3,'0')}`, paragraphs:paragraphs(cursor,b),response:[]});
    return {id:section.id,title:section.title,range:refRange(a,b),units};
  });
  return {id:chapter.id,title:chapter.title,subtitle:chapter.subtitle,range:chapter.range,introduction:chapter.introduction,conclusion:chapter.conclusion,sections};
});
const edition = {
  id:'republic-shorey-zh-2026-09-08',
  label:'据保罗·肖里英译的中文转译',
  description:'阅读范围为《理想国》第一至第四卷，327a—445e。依据 Paul Shorey 英译的 Perseus 数字化文本逐段转译为中文，保留这段范围内的全部正文；按讨论主题分为八章。',
  translator:'中文由 AI 辅助转译、交叉核对，非现成出版中文译本，尚未经古典学专家全面校订。',
  sourceUrl:'https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml',
  license:'原作：柏拉图。英译：Paul Shorey。数字化：Perseus Project / Tufts University。中文转译、题库和数字化底本依 CC BY-SA 4.0 共享；程序代码依 MIT 许可。',
  notes:[
    '327a 等编号是通行的斯特凡努斯页码，可能落在句子中间。卷际页码自然跳转；正文按原有顺序接续。',
    '诗乐教育包含故事、诗歌、音乐等养成内容；原文中的技艺、德性、灵魂等术语，也不能完全等同于今天的狭义用法。',
    '激情对应 thumos，亦常译意气：此处特别讨论愤怒、自尊和奋起抗争的力量，并不泛指所有强烈情绪。',
    '保留原文有关阶层、性别、奴隶、教育限制等有争议的论述，供理解和检验，不代表制作方赞同。',
    '章节导语、题目、提示、作答解释与章末回顾为教学编辑文字。正文包括叙事、诗引、长篇发言和简短应答，不以摘要替代。',
    '没有配音、支线、计时或自动翻页。答错也可继续；提示和直接揭示会保留记录，复习不会覆盖首次选择。',
    '对照文本提供全部 555 个页码片段，便于查阅底本和报告转译问题。文本完整性校验验证收录与顺序，不代表所有翻译或哲学解释已获学术定论。'
  ]
};
const corpus = {title:'理想国 · 苏格拉底的下一问',edition,chapters};
const units = chapters.flatMap(c => c.sections.flatMap(s => s.units));
const reconstructed = units.flatMap(u => [...u.paragraphs,...(u.question ? [u.question.original] : []),...u.response]).map(p => p.text).join('');
assert.equal(clean(reconstructed),clean(full),'Every source character must appear once and in order');
assert.equal(units.filter(u => u.question).length,questions.length);
const coverage = {editionId:edition.id,refs:rows.map(r => r.ref),referenceCount:rows.length,chapterCount:chapters.length,sectionCount:chapters.reduce((n,c)=>n+c.sections.length,0),unitCount:units.length,questionCount:questions.length,characterCount:clean(full).length,sha256:createHash('sha256').update(clean(full)).digest('hex'),chapters:chapters.map(c=>({id:c.id,title:c.title,range:c.range,questions:c.sections.flatMap(s=>s.units).filter(u=>u.question).length}))};
writeFileSync(new URL('republic.json',output),JSON.stringify(corpus,null,2)+'\n');
writeFileSync(new URL('coverage.json',output),JSON.stringify(coverage,null,2)+'\n');
writeFileSync(new URL('parallel.json',output),JSON.stringify(rows.map(({ref,book,text,english})=>({ref,book,chinese:text,english})),null,2)+'\n');
const escape = text => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>理想国 · 中英对照文本</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;background:#f7f5ee;color:#242d29;font-family:system-ui;line-height:1.8}a{color:#38644f}h1{font-size:28px}section{border-top:1px solid #d5d9ce;padding:20px 0;scroll-margin-top:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:32px}.pair p{white-space:pre-wrap;margin-top:0}.zh{font-family:"Noto Serif SC","Songti SC",SimSun,serif;font-size:19px}@media(max-width:700px){.pair{grid-template-columns:1fr;gap:12px}}</style><h1>《理想国》第一至四卷 · 对照文本</h1><p><a href="../index.html">返回互动阅读</a> · <a href="../TEXT-LICENSE.txt">署名与许可</a></p><p>${escape(edition.description)} ${escape(edition.translator)} 此页会显示后文，按页码连续列出全部内容。</p><p>英译：Paul Shorey；数字化：Perseus Project / Tufts University；中文：本项目转译。<a href="${edition.sourceUrl}">英文底本</a> · <a href="parallel.json" download>下载对照数据</a></p>${rows.map(r=>`<section id="${r.ref}"><h2>${r.ref} <small>第${r.book}卷</small></h2><div class="pair"><p class="zh">${escape(r.text)}</p><p lang="en">${escape(r.english)}</p></div></section>`).join('')}</html>`;
writeFileSync(new URL('parallel.html',output),page);
console.log(`正文：${coverage.referenceCount} 个片段 / ${coverage.chapterCount} 章 / ${coverage.sectionCount} 小节 / ${coverage.questionCount} 题 / ${coverage.characterCount} 字符；收录顺序与字符校验通过。`);
