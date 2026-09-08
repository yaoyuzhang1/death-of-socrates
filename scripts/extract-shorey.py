"""Extract the public-domain Shorey text in original Stephanus order."""
import html
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
raw = (root / '.local/sources/shorey.html').read_text(encoding='utf-8')
rows = []
for ref, markup in re.findall(r'<p id=[\'"]urn:cts:greekLit:tlg0059.tlg030:(\d+[a-e])[\'"]>(.*?)</p>', raw, re.S):
    if not 327 <= int(ref[:-1]) <= 445:
        continue
    markup = re.sub(r'<b>.*?</b>', '', markup, flags=re.S)
    markup = re.sub(r'<br\s*/?>', '\n', markup)
    text = html.unescape(re.sub(r'<[^>]+>', '', markup))
    text = re.sub(r'BOOK [1-4]\s*', '', text)
    text = re.sub(r'[ \t\u00a0]+', ' ', text).strip()
    rows.append({'ref': ref, 'english': text})
assert rows[0]['ref'] == '327a' and rows[-1]['ref'] == '445e'
assert len({r['ref'] for r in rows}) == len(rows)
dest = root / '.local/sources'
(dest / 'shorey-books1-4.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
for name, start, end in [('book1',327,354),('book2',357,383),('book3',386,417),('book4',419,445)]:
    part=[r for r in rows if start <= int(r['ref'][:-1]) <= end]
    (dest / f'{name}-en.json').write_text(json.dumps(part, ensure_ascii=False, indent=2), encoding='utf-8')
    print(name, len(part), sum(len(r['english'].split()) for r in part), 'words', part[0]['ref'],part[-1]['ref'])
