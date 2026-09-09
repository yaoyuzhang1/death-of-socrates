"""Apply scan-verified paragraph corrections after OCR line normalization."""
def apply_review(pages, corrections):
    log = []
    for correction in corrections:
        page = next(p for p in pages if p['printedPage'] == correction['printedPage'])
        matches = [(i, p) for i, p in enumerate(page['paragraphs']) if correction['old'] in p['text']]
        assert len(matches) == 1, f"Review correction must match one paragraph: {correction}"
        index, paragraph = matches[0]
        assert paragraph['text'].count(correction['old']) == 1
        text = paragraph['text'].replace(correction['old'], correction['new'])
        if correction.get('prefixStableId'):
            prefix, remaining = text.split('\n', 1)
            page['paragraphs'][index:index + 1] = [
                {**paragraph, 'text': prefix, 'stableId': correction['prefixStableId']},
                {'text': remaining, 'continuesPrevious': False},
            ]
        else:
            paragraph['text'] = text
        log.append({**correction, 'pdfPage': page['pdfPage'], 'appliedOccurrences': 1})
    return log
