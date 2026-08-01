#!/usr/bin/env python3
from pathlib import Path

path = Path('apps/web/app/api/public-platform-assistant/attachments/route.ts')
text = path.read_text(encoding='utf-8')
replacements = {
    "      env: {\n        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',\n        TESSDATA_PREFIX: process.env.TESSDATA_PREFIX || '/usr/share/tesseract-ocr/5/tessdata',\n        LANG: 'C.UTF-8',\n      },": "      env: {\n        ...process.env,\n        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',\n        TESSDATA_PREFIX: process.env.TESSDATA_PREFIX || '/usr/share/tesseract-ocr/5/tessdata',\n        LANG: 'C.UTF-8',\n      },",
    "  const bytes = Buffer.from(await file.arrayBuffer());\n  const checksumSha256": "  const bytes: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));\n  const checksumSha256",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one target, found {count}: {old[:80]}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('PUBLIC_ASSISTANT_OCR_TYPEFIX=APPLIED')
