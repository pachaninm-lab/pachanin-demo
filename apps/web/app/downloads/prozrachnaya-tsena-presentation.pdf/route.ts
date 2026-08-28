import { brotliDecompressSync } from "node:zlib";

import { PRESENTATION_PDF_BROTLI_BASE64_PART_00 } from "@/lib/presentation-pdf/part-00";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_01 } from "@/lib/presentation-pdf/part-01";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_02 } from "@/lib/presentation-pdf/part-02";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_03 } from "@/lib/presentation-pdf/part-03";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_04 } from "@/lib/presentation-pdf/part-04";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_05 } from "@/lib/presentation-pdf/part-05";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_06 } from "@/lib/presentation-pdf/part-06";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_07 } from "@/lib/presentation-pdf/part-07";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_08 } from "@/lib/presentation-pdf/part-08";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_09 } from "@/lib/presentation-pdf/part-09";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_10 } from "@/lib/presentation-pdf/part-10";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_11 } from "@/lib/presentation-pdf/part-11";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_12 } from "@/lib/presentation-pdf/part-12";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_13 } from "@/lib/presentation-pdf/part-13";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESENTATION_PDF_BROTLI_BASE64 = [
  PRESENTATION_PDF_BROTLI_BASE64_PART_00,
  PRESENTATION_PDF_BROTLI_BASE64_PART_01,
  PRESENTATION_PDF_BROTLI_BASE64_PART_02,
  PRESENTATION_PDF_BROTLI_BASE64_PART_03,
  PRESENTATION_PDF_BROTLI_BASE64_PART_04,
  PRESENTATION_PDF_BROTLI_BASE64_PART_05,
  PRESENTATION_PDF_BROTLI_BASE64_PART_06,
  PRESENTATION_PDF_BROTLI_BASE64_PART_07,
  PRESENTATION_PDF_BROTLI_BASE64_PART_08,
  PRESENTATION_PDF_BROTLI_BASE64_PART_09,
  PRESENTATION_PDF_BROTLI_BASE64_PART_10,
  PRESENTATION_PDF_BROTLI_BASE64_PART_11,
  PRESENTATION_PDF_BROTLI_BASE64_PART_12,
  PRESENTATION_PDF_BROTLI_BASE64_PART_13,
].join("");

function presentationPdfBytes(): Uint8Array {
  const compressed = Buffer.from(PRESENTATION_PDF_BROTLI_BASE64, "base64");
  return new Uint8Array(brotliDecompressSync(compressed));
}

export async function GET(): Promise<Response> {
  const pdf = presentationPdfBytes();
  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition":
        'attachment; filename="prozrachnaya-tsena-presentation.pdf"',
      "content-length": String(pdf.byteLength),
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "x-content-type-options": "nosniff",
    },
  });
}
