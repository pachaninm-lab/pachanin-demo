import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

import payload from "./chunks/chunk-01";

const EXPECTED_BYTES = 686396;
const EXPECTED_SHA256 = "00fdb290e041ce3df2c33b4b67821536fd0873cd8d11a0b9c2290eb9820c1bfe";

const PDF = brotliDecompressSync(Buffer.from(payload, "base64"));
const digest = createHash("sha256").update(PDF).digest("hex");

if (
  PDF.byteLength !== EXPECTED_BYTES ||
  PDF.subarray(0, 5).toString("ascii") !== "%PDF-" ||
  digest !== EXPECTED_SHA256
) {
  throw new Error("Public presentation PDF payload failed integrity validation");
}

export const dynamic = "force-static";

export function GET() {
  return new Response(PDF, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="prozrachnaya-tsena-presentation.pdf"',
      "Content-Length": String(PDF.byteLength),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
