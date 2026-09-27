"""Apply page-scoped, visually verified corrections without changing paragraph IDs."""
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]


def apply_scan_reviews(pages, correction_directory=ROOT / 'content/source', allow_applied=False):
    by_page = {page['printedPage']: page for page in pages}
    log = []
    layouts = [(file, correction)
               for file in sorted(correction_directory.glob('scan-review-20260927-note-layout*.json'))
               for correction in json.loads(file.read_text(encoding='utf-8'))]
    already_formatted = {correction['printedPage'] for _, correction in layouts
                         if allow_applied and correction['printedPage'] in by_page
                         and by_page[correction['printedPage']]['notes'] == correction['newNotes']}
    correction_files = sorted(set(correction_directory.glob('scan-review-20260927-books*.json'))
                              | set(correction_directory.glob('extra*-scan-review-20260927.json')))
    for file in correction_files:
        corrections = json.loads(file.read_text(encoding='utf-8'))
        for correction in corrections:
            page = by_page.get(correction['printedPage'])
            if page is None:
                continue
            field = correction.get('field', 'paragraphs')
            assert field in ('paragraphs', 'notes'), correction
            if field == 'notes' and page['printedPage'] in already_formatted:
                log.append({**correction, 'file': file.name, 'status': 'already-applied'})
                continue
            old, new = correction['old'], correction['new']
            assert old and isinstance(new, str) and old != new and '\n' not in old + new, correction
            items = page[field]
            texts = [item['text'] if field == 'paragraphs' else item for item in items]
            # A repaired omission may leave the old phrase inside its replacement.
            # Ignore occurrences already contained in the complete corrected phrase.
            if new and old in new and allow_applied and any(new in text for text in texts) and not any(old in text.replace(new, '') for text in texts):
                log.append({**correction, 'file': file.name, 'status': 'already-applied'})
                continue
            matches = [(index, text) for index, text in enumerate(texts) if old in text]
            if not matches and allow_applied:
                if new == '' and correction.get('reservedParagraphId'):
                    log.append({**correction, 'file': file.name, 'status': 'already-applied'})
                    continue
                assert sum(new in text for text in texts) >= 1, f'Neither old nor corrected text: {correction}'
                log.append({**correction, 'file': file.name, 'status': 'already-applied'})
                continue
            assert len(matches) == 1, f'Correction must match one source item: {correction}'
            index, text = matches[0]
            assert text.count(old) == 1, f'Correction must match once: {correction}'
            updated = text.replace(old, new)
            if not updated and field == 'paragraphs':
                assert correction.get('reservedParagraphId'), 'Discarded OCR paragraphs must reserve their published ID'
                del items[index]
            elif field == 'paragraphs':
                items[index]['text'] = updated
            else:
                items[index] = updated
            log.append({**correction, 'file': file.name, 'sourceIndex': index, 'status': 'applied'})
    # Layout arrays are prepared after the text corrections above. This preserves
    # corrected words when separate OCR lines are joined into a printed note.
    for file, correction in layouts:
        page = by_page.get(correction['printedPage'])
        if page is None:
            continue
        before, after = correction['oldNotes'], correction['newNotes']
        assert isinstance(before, list) and isinstance(after, list), correction
        assert all(isinstance(note, str) and note for note in after), correction
        if page['notes'] == after and allow_applied:
            status = 'already-applied'
        else:
            assert page['notes'] == before, f'Note layout must match the complete corrected array: {correction}'
            page['notes'] = list(after)
            status = 'applied'
        log.append({**correction, 'file': file.name, 'field': 'note-layout', 'status': status})
    return log


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--write', action='store_true')
    cli.add_argument('--allow-applied', action='store_true', help='Keep already applied, verified patches during an incremental review')
    args = cli.parse_args()
    source_file = ROOT / 'content/source/guo-1986-pages.json'
    source = json.loads(source_file.read_text(encoding='utf-8'))
    log = apply_scan_reviews(source['pages'], allow_applied=args.allow_applied)
    target = ROOT / '.local/guo/scan-review-20260927-log.json'
    target.write_text(json.dumps(log, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.write:
        source_file.write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'corrections': len(log), 'pages': len({item['printedPage'] for item in log}), 'written': args.write}, ensure_ascii=False))
