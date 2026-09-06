#!/usr/bin/env python3
"""Create deterministic, synthetic attachment fixtures for live TAI acceptance.

The files contain no customer or production data.  The manifest is consumed by the
live acceptance checker and is intentionally limited to non-secret tokens.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


def write_zip(path: Path, members: dict[str, str]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in members.items():
            archive.writestr(name, value.encode("utf-8"))


def create_docx(path: Path, token: str) -> None:
    write_zip(
        path,
        {
            "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""",
            "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
            "word/document.xml": f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{escape(token)}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>""",
        },
    )


def create_xlsx(path: Path, token: str) -> None:
    write_zip(
        path,
        {
            "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>""",
            "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
            "xl/workbook.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Acceptance" sheetId="1" r:id="rId1"/></sheets></workbook>""",
            "xl/_rels/workbook.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>""",
            "xl/sharedStrings.xml": f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>{escape(token)}</t></si></sst>""",
            "xl/worksheets/sheet1.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>""",
        },
    )


def create_text_pdf(path: Path, token: str) -> None:
    escaped = token.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 24 Tf 72 720 Td ({escaped}) Tj ET\n".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream",
    ]
    payload = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(payload))
        payload.extend(f"{index} 0 obj\n".encode("ascii"))
        payload.extend(obj)
        payload.extend(b"\nendobj\n")
    xref = len(payload)
    payload.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    payload.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        payload.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    payload.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii")
    )
    path.write_bytes(payload)


def load_font(size: int):
    from PIL import ImageFont

    candidates = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    )
    for candidate in candidates:
        font_path = Path(candidate)
        if font_path.is_file():
            return ImageFont.truetype(str(font_path), size=size)
    raise RuntimeError("A deterministic TrueType font is required for OCR fixtures")


def image_with_token(token: str):
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (2200, 520), "white")
    draw = ImageDraw.Draw(image)
    font = load_font(92)
    draw.rectangle((20, 20, 2180, 500), outline="black", width=4)
    draw.text((80, 175), token, fill="black", font=font, stroke_width=1)
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = args.output.resolve()
    root.mkdir(parents=True, exist_ok=True)

    definitions = [
        ("acceptance.txt", "text/plain", "TAI TXT ACCEPT 13579", "native-text"),
        (
            "acceptance.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "TAI DOCX ACCEPT 24680",
            "docx",
        ),
        (
            "acceptance.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "TAI XLSX ACCEPT 11223",
            "xlsx",
        ),
        ("acceptance-text.pdf", "application/pdf", "TAI TEXT PDF ACCEPT 44556", "text-pdf"),
        ("acceptance.png", "image/png", "TAI PNG OCR 86420", "image-ocr"),
        ("acceptance.jpg", "image/jpeg", "TAI JPG OCR 75310", "image-ocr"),
        ("acceptance-scan.pdf", "application/pdf", "TAI SCAN PDF OCR 97531", "scan-pdf-ocr"),
    ]

    (root / "acceptance.txt").write_text(definitions[0][2] + "\n", encoding="utf-8")
    create_docx(root / "acceptance.docx", definitions[1][2])
    create_xlsx(root / "acceptance.xlsx", definitions[2][2])
    create_text_pdf(root / "acceptance-text.pdf", definitions[3][2])

    png_image = image_with_token(definitions[4][2])
    png_image.save(root / "acceptance.png", format="PNG", optimize=False)
    jpg_image = image_with_token(definitions[5][2])
    jpg_image.save(root / "acceptance.jpg", format="JPEG", quality=96, subsampling=0)
    scan_image = image_with_token(definitions[6][2])
    scan_image.save(root / "acceptance-scan.pdf", format="PDF", resolution=150.0)

    manifest = {
        "schemaVersion": "tai.live-attachment-fixtures.v1",
        "files": [
            {"name": name, "mimeType": mime, "token": token, "mode": mode}
            for name, mime, token, mode in definitions
        ],
    }
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"TAI_LIVE_ATTACHMENT_FIXTURES={len(definitions)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
