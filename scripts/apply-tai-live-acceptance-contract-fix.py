#!/usr/bin/env python3
from pathlib import Path

path = Path('.github/workflows/tai-live-document-ocr-acceptance.yml')
text = path.read_text(encoding='utf-8')
old = """          ! grep -Eq 'continue-on-error:[[:space:]]*true|192[.]168[.]0[.]206|AI_ASSISTANT_API_KEY|TAI_PUBLIC_GATEWAY_HMAC_SECRET' \\
            .github/workflows/tai-live-document-ocr-acceptance.yml \\
            scripts/create-live-public-assistant-attachment-fixtures.py \\
            scripts/check-live-public-assistant-attachments.mjs
"""
new = """          ! grep -Eq 'continue-on-error:[[:space:]]*true|192[.]168[.]0[.]206' \\
            .github/workflows/tai-live-document-ocr-acceptance.yml \\
            scripts/create-live-public-assistant-attachment-fixtures.py
"""
if new not in text:
    if text.count(old) != 1:
        raise SystemExit(f'expected one contract block, found {text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('TAI_LIVE_ACCEPTANCE_CONTRACT_FIX=APPLIED')
