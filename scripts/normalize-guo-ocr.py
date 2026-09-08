from pathlib import Path
from PIL import Image
import json,re,statistics,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
import argparse
cli=argparse.ArgumentParser(description='Normalize locally produced OCR for Republic I-IV (Guo/Zhang 1986).')
cli.add_argument('--pdf',type=Path,required=True)
cli.add_argument('--ocr-root',type=Path,default=ROOT/'.local/guo')
args=cli.parse_args()
LOCAL=args.ocr_root
PDF=args.pdf

def footnote_rule(n):
    im=Image.open(LOCAL/f'ocr/images/page-{n:03}.png').convert('L')
    w,h=im.size
    if n==94:return 1335 # Printed p83: faint footnote rule, visually verified.
    if n==100:return 1585 # Printed p89: broken footnote rule, visually verified.
    # Scan for the short rule separating translators' footnotes. The book header
    # is outside this region and a full-width scanner edge is not a footnote rule.
    pixels=np.asarray(im)
    mask=pixels[:,int(w*.10):int(w*.50)]<160
    dark=mask.sum(axis=1)
    found=[]
    for y in range(int(h*.50),int(h*.94)):
        if dark[y]<w*.17:continue
        xs=np.flatnonzero(mask[y]); start=prev=xs[0];count=1
        for x in np.r_[xs[1:], w*2]:
            if x-prev>15:
                span=prev-start+1
                if span>w*.18 and count/span>.86:found.append(y);break
                start=x;count=0
            count+=1;prev=x
    return min(found) if found else h*.94

def shape(s):
    return s.replace(' ', '').replace('\u3000','').replace('?', '？').replace('!', '！').replace(',', '，').replace(';','；')

corrections=json.loads((ROOT/'content/source/guo-1986-corrections.json').read_text(encoding='utf-8'))
correction_log=[]
pages=[];debug=[]
for n in range(12,188):
    win=json.loads((LOCAL/f'ocr/page-{n:03}.json').read_text(encoding='utf-8-sig'))
    w,h=win['width'],win['height']; rule=footnote_rule(n)
    candidates=[]
    for l in win['lines']:
        b=l['bbox']
        if b['y']<h*.135 or b['y']>rule or b['width']<w*.45:continue
        chinese=[word for word in l['words'] if re.search('[\u3400-\u9fff]',word['text'])]
        if chinese:candidates.append(min(word['x'] for word in chinese))
    base=statistics.median(sorted(candidates)[:max(1,len(candidates)//2)]) if candidates else w*.13
    rawpath=LOCAL/f'rapid/page-{n:03}.json'
    if rawpath.exists():
        raw=json.loads(rawpath.read_text(encoding='utf-8-sig'))
        lines=[]
        for v in raw['lines']:
            lines.append(v)
    else:
        lines=[{'text':l['cleaned'],'bbox':l['bbox'],'confidence':None} for l in win['lines']]
    for correction in [c for c in corrections if c['pdfPage']==n]:
        hits=0
        for line in lines:
            if correction['old'] in line['text']:
                hits+=line['text'].count(correction['old'])
                line['text']=line['text'].replace(correction['old'],correction['new'])
        correction_log.append({**correction,'appliedOccurrences':hits})
    lines.sort(key=lambda l:(round(l['bbox']['y']/15),l['bbox']['x']))
    paragraphs=[];notes=[];pending_ref='';last_ref='';ignored=[]
    for l in lines:
        s=shape(l['text']);b=l['bbox'];x,y=b['x'],b['y'];height=b['height']
        if not s:continue
        if y<h*.13 or y>h*.94 or re.fullmatch('[第理想国一二三四五六七八九十卷0-9]+',s) and y<h*.29:
            ignored.append(s);continue
        if y>rule:
            notes.append(s);continue
        # Stephanus numbers and A-E are printed in the outer margin.
        match=re.fullmatch('(3[2-9][0-9]|4[0-4][0-9]|[A-Ea-e])',s)
        if match:
            pending_ref=s.lower();continue
        s=re.sub(r'^(?:3[2-9][0-9]|4[0-4][0-9]|[A-Ea-e])(?=[\u3400-\u9fff〔“])','',s)
        s=re.sub(r'(?:3[2-9][0-9]|4[0-4][0-9]|[A-Ea-e])$','',s)
        if not re.search('[\u3400-\u9fff]',s) and len(s)<3:
            ignored.append(s);continue
        # A new indented source line is a new paragraph, including short replies
        # and poetry. Continuation lines are joined without invented punctuation.
        first_chinese=next((word for word in l.get('words',[]) if re.search('[\u3400-\u9fff]',word['text'])),None)
        if first_chinese: x=first_chinese['bbox']['x']
        indented=x>base+42
        if not paragraphs or indented:
            paragraphs.append({'text':s,'continuesPrevious':not indented if not paragraphs else False})
        else:
            paragraphs[-1]['text']+=s
    printed=n-11
    pages.append({'printedPage':printed,'pdfPage':n,'book':1 if printed<44 else 2 if printed<82 else 3 if printed<132 else 4,'paragraphs':paragraphs,'notes':notes})
    debug.append({'printedPage':printed,'bodyLeft':round(base),'footnoteY':round(rule),'paragraphCount':len(paragraphs),'characters':sum(len(p['text']) for p in paragraphs),'notes':len(notes),'ignored':ignored})
source={'edition':'郭斌和、张竹明译《理想国》，商务印书馆，1986年8月第一版','pdfSha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'scope':'第一至四卷，印刷页1—176，PDF第12—187页','pages':pages}
(ROOT/'content/source/guo-1986-pages.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(LOCAL/'parse-report.json').write_text(json.dumps(debug,ensure_ascii=False,indent=2),encoding='utf-8')
(LOCAL/'plain.txt').write_text('\n\n'.join(f"【书页{p['printedPage']}】\n"+'\n'.join(r['text'] for r in p['paragraphs']) for p in pages),encoding='utf-8')
(LOCAL/'correction-log.json').write_text(json.dumps(correction_log,ensure_ascii=False,indent=2),encoding='utf-8')
print(len(pages),sum(d['characters'] for d in debug),'chars;',sum(c['appliedOccurrences'] for c in correction_log),'corrections; missed',sum(c['appliedOccurrences']==0 for c in correction_log))
