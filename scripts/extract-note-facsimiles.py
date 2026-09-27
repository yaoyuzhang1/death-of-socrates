"""Preserve ambiguous Greek type and diagrams as exact source-note images."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local/guo'
MANIFEST = ROOT / 'content/source/note-facsimiles.json'
SELECTED = [67,91,105,108,125,139,157,158,165,181,203,222,233,242,243,263,344,380,395,418,421,424,425,426]
source = json.loads((ROOT / 'content/source/guo-1986-pages.json').read_text(encoding='utf-8'))
prior = {entry['printedPage']: entry for entry in json.loads(MANIFEST.read_text(encoding='utf-8'))['pages']} if MANIFEST.exists() else {}
reports = {page['printedPage']: page for file in [LOCAL / 'parse-report.json', LOCAL / 'fullbook/parse-report.json'] for page in json.loads(file.read_text(encoding='utf-8'))}
entries = []
for printed in SELECTED:
    image = Image.open(LOCAL / f'ocr/images/page-{printed+11:03d}.png')
    # Include the rule and every note line, preserving their spatial arrangement.
    bounds = prior[printed]['crop'] if printed in prior else [140, int(reports[printed]['footnoteY']), 1360, 1979]
    cropped = image.crop(bounds)
    relative = f'facsimile/notes/page-{printed:03d}.webp'
    output = ROOT / 'reader-public' / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output, format='WEBP', lossless=True)
    entries.append({'printedPage': printed, 'pdfPage': printed+11, 'file': relative, 'crop': bounds,
                    'width': cropped.width, 'height': cropped.height,
                    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                    'reason': '按原版影像呈现希腊文、重音字形和复杂图注，不把未可靠校对的识别字符当作译者原文。'})
MANIFEST.write_text(json.dumps({'sourcePdfSha256': source['pdfSha256'], 'pages': entries}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'noteImages': len(entries), 'bytes': sum((ROOT/'reader-public'/entry['file']).stat().st_size for entry in entries)}))
