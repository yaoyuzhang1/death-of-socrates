"""Render the remaining local scan pages; never sends the PDF to a service."""
from pathlib import Path
import argparse,json,time
import pypdfium2 as pdfium
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('--pdf',type=Path,required=True)
p.add_argument('--start',type=int,default=188)
p.add_argument('--end',type=int,default=437)
a=p.parse_args()
local=ROOT/'.local/guo/fullbook';local.mkdir(parents=True,exist_ok=True)
imgs=ROOT/'.local/guo/ocr/images';imgs.mkdir(parents=True,exist_ok=True)
fac=ROOT/'reader-public/facsimile';fac.mkdir(parents=True,exist_ok=True)
doc=pdfium.PdfDocument(a.pdf);records=[];started=time.perf_counter()
for n in range(a.start,a.end+1):
    page=doc[n-1];bm=page.render(scale=2.5);im=bm.to_pil().convert('RGB')
    if max(im.size)>2500:im.thumbnail((2500,2500),Image.Resampling.LANCZOS)
    im.save(imgs/f'page-{n:03}.png')
    target=fac/f'page-{n-11:03}.webp'
    im.resize((1428,round(im.height*1428/im.width)),Image.Resampling.LANCZOS).save(target,format='WEBP',quality=82,method=4)
    records.append({'pdfPage':n,'printedPage':n-11,'width':im.width,'height':im.height,'facsimileBytes':target.stat().st_size})
    bm.close();page.close()
    if len(records)%20==0:print(f'Rendered {len(records)} pages; PDF {n}',flush=True)
doc.close()
result={'pdf':str(a.pdf),'range':[a.start,a.end],'seconds':round(time.perf_counter()-started,3),'pages':records}
(local/'render-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('Rendered',len(records),'pages in',result['seconds'],'seconds',flush=True)
