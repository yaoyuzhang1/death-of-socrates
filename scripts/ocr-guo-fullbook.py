"""Run the already installed local DirectML OCR on remaining Guo/Zhang pages."""
from pathlib import Path
import argparse,json,sys,time,re
ROOT=Path(__file__).resolve().parents[1];HERE=ROOT/'.local/guo'
sys.path.insert(0,str(HERE/'ocr-python'));sys.path.insert(0,str(HERE/'ocr-dml'))
from PIL import Image
from rapidocr_onnxruntime import RapidOCR
from rapidocr_onnxruntime.utils.infer_engine import OrtInferSession
import onnxruntime
p=argparse.ArgumentParser();p.add_argument('--start',type=int,default=188);p.add_argument('--end',type=int,default=437)
a=p.parse_args();out=HERE/'rapid';out.mkdir(exist_ok=True);local=HERE/'fullbook';local.mkdir(exist_ok=True)
original=OrtInferSession._init_sess_opts
def opts(config):
    o=original(config);o.enable_mem_pattern=False;o.execution_mode=onnxruntime.ExecutionMode.ORT_SEQUENTIAL;return o
OrtInferSession._init_sess_opts=staticmethod(opts)
def rect(poly):
    xs=[float(x[0]) for x in poly];ys=[float(x[1]) for x in poly]
    return {'x':min(xs),'y':min(ys),'width':max(xs)-min(xs),'height':max(ys)-min(ys)}
started=time.perf_counter();records=[];failures=[]
engine=RapidOCR(intra_op_num_threads=4,inter_op_num_threads=1,det_limit_side_len=1488,max_side_len=2500,rec_batch_num=6,det_use_dml=True,rec_use_dml=True,cls_use_dml=True)
providers=engine.text_rec.session.session.get_providers()
if 'DmlExecutionProvider' not in providers:raise RuntimeError(providers)
for n in range(a.start,a.end+1):
    target=out/f'page-{n:03}.json'
    if target.exists():
        previous=json.loads(target.read_text(encoding='utf-8'));records.append({'pdfPage':n,'cached':True,'lines':len(previous['lines'])});continue
    try:
        path=HERE/f'ocr/images/page-{n:03}.png';waited=time.perf_counter()
        while not path.exists():
            if time.perf_counter()-waited>180:raise RuntimeError('Render unavailable')
            time.sleep(.2)
        w,h=Image.open(path).size;t=time.perf_counter()
        raw,timings=engine(str(path),use_cls=False,return_word_box=True,text_score=.35)
        lines=[]
        for row in raw or []:
            words=[]
            if len(row)>=6:
                words=[{'text':text,'bbox':rect(poly),'confidence':float(conf)} for poly,text,conf in zip(row[3],row[4],row[5])]
            lines.append({'text':row[1],'bbox':rect(row[0]),'confidence':float(row[2]),'words':words})
        data={'engine':'rapidocr_onnxruntime 1.4.4','models':'PP-OCRv4','runtime':onnxruntime.__version__,'providers':providers,'pdfPage':n,'printedPage':n-11,'image':str(path),'facsimile':f'facsimile/page-{n-11:03}.webp','width':w,'height':h,'seconds':round(time.perf_counter()-t,3),'text':'\n'.join(v['text'] for v in lines),'lines':lines}
        target.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        (out/f'page-{n:03}.txt').write_text(data['text'],encoding='utf-8')
        records.append({'pdfPage':n,'lines':len(lines),'seconds':data['seconds'],'characters':len(data['text'])})
        if len(records)%20==0:print(f'OCR {len(records)} pages; PDF {n}; {time.perf_counter()-started:.1f}s',flush=True)
    except Exception as ex:failures.append({'pdfPage':n,'error':repr(ex)});print('FAILED',n,repr(ex),flush=True)
report={'range':[a.start,a.end],'networkDuringOCR':'none','seconds':round(time.perf_counter()-started,3),'pages':records,'failures':failures}
(local/'ocr-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Complete',len(records),'pages;',len(failures),'failures;',report['seconds'],'seconds',flush=True)
if failures:raise SystemExit(1)
