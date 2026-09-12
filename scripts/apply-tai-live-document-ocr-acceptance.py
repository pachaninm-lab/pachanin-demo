#!/usr/bin/env python3
from pathlib import Path

path = Path('.github/workflows/docker-publish.yml')
text = path.read_text(encoding='utf-8')
entry = '      - ".github/workflows/tai-live-document-ocr-acceptance.yml"\n'
if entry not in text:
    anchor = '      - ".github/workflows/tai-reg-ru-deploy.yml"\n'
    if text.count(anchor) != 1:
        raise SystemExit(f'expected one Docker workflow trigger anchor, found {text.count(anchor)}')
    text = text.replace(anchor, anchor + entry, 1)
    path.write_text(text, encoding='utf-8')
print('TAI_LIVE_DOCUMENT_OCR_ACCEPTANCE_PATCH=APPLIED')
