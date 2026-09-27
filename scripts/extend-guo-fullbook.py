"""Append locally OCR'd books V-X while retaining existing I-IV page objects."""
from pathlib import Path
import argparse,json,re,statistics,hashlib
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1];LOCAL=ROOT/'.local/guo';OUT=LOCAL/'fullbook'
p=argparse.ArgumentParser();p.add_argument('--publish-source',action='store_true');a=p.parse_args()
existing=json.loads((ROOT/'content/source/guo-1986-pages.json').read_text(encoding='utf-8'))
old=existing['pages'][:176]
assert [x['printedPage'] for x in old]==list(range(1,177))
old_digest=hashlib.sha256(json.dumps(old,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def rule(n):
    im=Image.open(LOCAL/f'ocr/images/page-{n:03}.png').convert('L');w,h=im.size
    pixels=np.asarray(im);mask=pixels[:,int(w*.10):int(w*.50)]<160;dark=mask.sum(axis=1);found=[]
    # p421 has a substantial translator's diagram: its note rule is above mid-page.
    overrides={192:1722,236:1720,305:1798,338:1780,348:1711,417:1781,427:1749}
    if n in overrides:return overrides[n]
    for y in range(int(h*.33),int(h*.94)):
        if dark[y]<w*.17:continue
        xs=np.flatnonzero(mask[y]);start=prev=xs[0];count=1
        for x in np.r_[xs[1:],w*2]:
            if x-prev>15:
                span=prev-start+1
                if span>w*.18 and count/span>.86:found.append(y);break
                start=x;count=0
            count+=1;prev=x
    return min(found) if found else h*.94
def shape(s):return s.replace(' ','').replace('\u3000','').replace('?','？').replace('!','！').replace(',','，').replace(';','；')
speaker=re.compile(r'^[〔【［\[]?(?:苏格拉底|苏|格|阿|玻|色|克)(?:[（(][^（）()]{1,20}[）)])?[：:]')
numeric=r'(?:4[4-9][0-9]|5[0-9][0-9]|6[01][0-9]|62[01])'
starts={5:177,6:228,7:272,8:312,9:352,10:387}
pages=[];report=[];fixes=[];confidence=[]
review=json.loads((ROOT/'content/source/guo-1986-fullbook-corrections.json').read_text(encoding='utf-8')) if (ROOT/'content/source/guo-1986-fullbook-corrections.json').exists() else []
for n in range(188,438):
    raw=json.loads((LOCAL/f'rapid/page-{n:03}.json').read_text(encoding='utf-8-sig'))
    win=json.loads((OUT/f'windows/page-{n:03}.json').read_text(encoding='utf-8-sig'))
    w,h=raw['width'],raw['height'];r=rule(n);candidates=[]
    for l in win['lines']:
        b=l['bbox']
        if b['y']<h*.135 or b['y']>r or b['width']<w*.45:continue
        chinese=[x for x in l['words'] if re.search('[\u3400-\u9fff]',x['text'])]
        if chinese:candidates.append(min(x['x'] for x in chinese))
    base=statistics.median(sorted(candidates)[:max(1,len(candidates)//2)]) if candidates else w*.13
    right_candidates=[max(x['x']+x['width'] for x in l['words'] if re.search('[\u3400-\u9fff]',x['text'])) for l in win['lines'] if h*.135<l['bbox']['y']<r and l['bbox']['width']>w*.45 and any(re.search('[\u3400-\u9fff]',x['text']) for x in l['words'])]
    right=statistics.median(sorted(right_candidates)[len(right_candidates)//2:]) if right_candidates else w*.85
    lines=list(raw['lines'])
    for c in review:
        if c['printedPage']==n-11 and c['action']=='insert-line':
            lines.append({'text':c['new'],'bbox':c['bbox'],'words':[],'confidence':None})
            fixes.append(c)
    lines=sorted(lines,key=lambda l:(round(l['bbox']['y']/15),l['bbox']['x']))
    paragraphs=[];notes=[];ignored=[];line_map=[]
    for l in lines:
        b=l['bbox'];x,y=b['x'],b['y'];s=shape(l['text'])
        if not s:continue
        if y<h*.13 or y>h*.94 or (re.fullmatch('[第理想国一二三四五六七八九十卷0-9]+',s) and y<h*.29):ignored.append(s);continue
        if y>r:notes.append(s);continue
        # OCR sometimes joins a marginal letter/section numeral to a body line.
        # The character boxes identify those marks before lines are concatenated.
        if l.get('words'):
            kept=[z for z in l['words'] if not (not re.search('[\u3400-\u9fff]',z['text']) and (z['bbox']['x']<base-12 or z['bbox']['x']>right+28))]
            cleaned=shape(''.join(z['text'] for z in kept))
            if cleaned!=s:fixes.append({'printedPage':n-11,'old':s,'new':cleaned,'reason':'remove marginal mark by character box'})
            s=cleaned
        if re.fullmatch(numeric+r'|[A-Ea-e]|[IVX]+',s):ignored.append(s);continue
        s=re.sub(r'^(?:'+numeric+r'|[A-Za-z○]+)(?=[\u3400-\u9fff〔“])','',s)
        # Arabic numerals also occur in body arguments (e.g. 729 on p379).
        # Remove marginal digits geometrically; do not discard a body number
        # merely because it occurs at the start or end of an OCR line.
        s=re.sub(r'[A-Za-z○]+$','',s)
        # The detector sometimes retains only the first digit of a right
        # marginal section number (e.g. 488 -> 4). The only body paragraphs
        # in these new books using Arabic numerals are the geometrical-number
        # passage on p316 and the 729 comparison on p379, checked in the scan.
        s=re.sub(r'[0-9]+$',lambda m:m.group() if n-11 in {316,379} and m.group() in {'1','2','3','5','100','729'} else '',s)
        s=re.sub(r'^[，。、·．‘：]+(?=(?:苏|格|阿)[：:])','',s)
        for c in review:
            if c['printedPage']==n-11 and c['action']=='replace-line' and c['old'] in s and (c['old'] not in c['new'] or c['new'] not in s):
                s=s.replace(c['old'],c['new']);fixes.append(c)
        if re.match(r'^啊[：:]',s):
            fixes.append({'printedPage':n-11,'old':s,'new':'阿'+s[1:],'reason':'dialogue role label 阿 OCR variant'});s='阿'+s[1:]
        if n==188:
            for before,after in [('苏：【当我','苏：〔当我'),('问他们：口你们','问他们：〕你们')]:
                if before in s:fixes.append({'printedPage':177,'old':before,'new':after,'reason':'verified narration bracket'});s=s.replace(before,after)
        if not re.search('[\u3400-\u9fff]',s):ignored.append(s);continue
        first=next((word for word in l.get('words',[]) if re.search('[\u3400-\u9fff]',word['text'])),None)
        if first:x=first['bbox']['x']
        indented=x>base+42
        if speaker.match(s):indented=True
        if any(c['printedPage']==n-11 and c.get('forceContinuation') and c['new']==s for c in review):indented=False
        if not paragraphs or indented:paragraphs.append({'text':s,'continuesPrevious':not indented if not paragraphs else False})
        else:paragraphs[-1]['text']+=s
        line_map.append({'text':s,'y':round(y),'paragraphIndex':len(paragraphs)-1})
        for word in l.get('words',[]):
            if word.get('confidence',1)<.8:confidence.append({'printedPage':n-11,'text':word['text'],'confidence':word['confidence'],'bbox':word['bbox']})
    # Some reviewed strings cross OCR line breaks; apply the same scoped
    # correction to the assembled paragraph as well, without changing I-IV.
    for paragraph in paragraphs:
        for c in review:
            if c['printedPage']==n-11 and c['action']=='replace-line' and c['old'] in paragraph['text'] and (c['old'] not in c['new'] or c['new'] not in paragraph['text']):
                paragraph['text']=paragraph['text'].replace(c['old'],c['new']);fixes.append(c)
    book=max(book for book,start in starts.items() if n-11>=start)
    pages.append({'printedPage':n-11,'pdfPage':n,'book':book,'paragraphs':paragraphs,'notes':notes})
    report.append({'printedPage':n-11,'book':book,'bodyLeft':round(base),'footnoteY':round(r),'paragraphCount':len(paragraphs),'characters':sum(len(p['text']) for p in paragraphs),'notes':len(notes),'ignored':ignored,'lineMap':line_map})
from apply_scan_review import apply_scan_reviews
scan_review_log=apply_scan_reviews(pages, allow_applied=True)
(OUT/'scan-review-regeneration-log.json').write_text(json.dumps(scan_review_log,ensure_ascii=False,indent=2),encoding='utf-8')
result={**existing,'scope':'第一至十卷，完整对话正文印刷页1—426，PDF第12—437页（不含译者引言、附录索引及版本简目）','pages':old+pages}
assert hashlib.sha256(json.dumps(result['pages'][:176],ensure_ascii=False,sort_keys=True).encode()).hexdigest()==old_digest
(OUT/'draft-pages.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'parse-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'role-fixes.json').write_text(json.dumps(fixes,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'low-confidence.json').write_text(json.dumps(confidence,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'plain.txt').write_text('\n\n'.join(f"【卷{p['book']} 书页{p['printedPage']}】\n"+'\n'.join(r['text'] for r in p['paragraphs']) for p in pages),encoding='utf-8')
if a.publish_source:(ROOT/'content/source/guo-1986-pages.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pages':len(result['pages']),'oldPageObjectSha256':old_digest,'newCharacters':sum(r['characters'] for r in report),'books':starts,'lowConfidenceUnits':len(confidence),'roleFixes':len(fixes)},ensure_ascii=False))
