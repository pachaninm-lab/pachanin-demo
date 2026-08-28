import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

import { GET, presentationPdfBytes } from "../../app/downloads/prozrachnaya-tsena-presentation.pdf/route";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_00 } from "../../lib/presentation-pdf/part-00";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_01 } from "../../lib/presentation-pdf/part-01";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_02 } from "../../lib/presentation-pdf/part-02";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_03 } from "../../lib/presentation-pdf/part-03";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_04 } from "../../lib/presentation-pdf/part-04";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_05 } from "../../lib/presentation-pdf/part-05";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_06 } from "../../lib/presentation-pdf/part-06";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_07 } from "../../lib/presentation-pdf/part-07";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_08 } from "../../lib/presentation-pdf/part-08";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_09 } from "../../lib/presentation-pdf/part-09";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_10 } from "../../lib/presentation-pdf/part-10";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_11 } from "../../lib/presentation-pdf/part-11";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_12 } from "../../lib/presentation-pdf/part-12";
import { PRESENTATION_PDF_BROTLI_BASE64_PART_13 } from "../../lib/presentation-pdf/part-13";

const EXPECTED_BYTES = 312533;
const EXPECTED_SHA256 =
  "1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5";
const EXPECTED_COMPRESSED_BYTES = 198423;
const EXPECTED_COMPRESSED_SHA256 =
  "e99c503bb653bfc1f4c2fd800a5bc230404a6d22d02f3d1362cb66e1172b0612";
const EXPECTED_BASE64_LENGTH = 264564;
const DOWNLOAD_PATH = "/downloads/prozrachnaya-tsena-presentation.pdf";
const PUBLIC_FILE = resolve(process.cwd(), `public${DOWNLOAD_PATH}`);
const middlewareSource = readFileSync(resolve(process.cwd(), "middleware.ts"), "utf8");
const landingSource = readFileSync(resolve(process.cwd(), "app/platform-v7/page.tsx"), "utf8");
const landingLayoutSource = readFileSync(resolve(process.cwd(), "app/platform-v7/layout.tsx"), "utf8");
const strategicHomeSource = readFileSync(
  resolve(process.cwd(), "components/platform-v7/PlatformV7StrategicHome.tsx"),
  "utf8",
);
const publicEntrySource = readFileSync(
  resolve(process.cwd(), "app/pc-public-entry/platform-v7/page.tsx"),
  "utf8",
);
const nextConfigSource = readFileSync(resolve(process.cwd(), "next.config.js"), "utf8");

const parts = [
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
];

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sourceBlock(declaration: string, terminator: string): string {
  const start = middlewareSource.indexOf(declaration);
  const end = middlewareSource.indexOf(terminator, start);
  if (start < 0 || end < 0) throw new Error(`${declaration} block not found`);
  return middlewareSource.slice(start, end + terminator.length);
}

describe("public presentation download", () => {
  it("renders exactly one localized CTA through the physical public-entry route", () => {
    expect(nextConfigSource).toContain(
      "{ source: '/platform-v7', destination: '/pc-public-entry/platform-v7' }",
    );
    expect(publicEntrySource).toContain(
      "import PlatformV7RootPage from '@/app/platform-v7/page'",
    );
    expect(landingSource).toContain(
      "import { PlatformV7StrategicHome } from '@/components/platform-v7/PlatformV7StrategicHome'",
    );

    const heroStart = strategicHomeSource.indexOf("<div className='pc-v6-actions'>");
    const heroEnd = strategicHomeSource.indexOf("</div>", heroStart);
    expect(heroStart).toBeGreaterThan(-1);
    expect(heroEnd).toBeGreaterThan(heroStart);
    const heroActions = strategicHomeSource.slice(heroStart, heroEnd);

    expect(heroActions.split("data-testid='platform-v7-presentation-download'")).toHaveLength(2);
    expect(heroActions.split(`href='${DOWNLOAD_PATH}'`)).toHaveLength(2);
    expect(heroActions).toContain("download='Прозрачная_Цена_и_ГЕКТА.pdf'");
    expect(heroActions).toContain("type='application/pdf'");
    expect(heroActions.split("className='pc-v6-primary'")).toHaveLength(2);
    expect(heroActions).toContain("href='#live'");
    expect(heroActions).toContain("className='pc-v6-secondary'");
    expect(heroActions).toContain("eventName='deal_demo_open'");
    expect(heroActions).not.toContain("href='#connect-organization'");
    expect(strategicHomeSource).toContain("'Скачать презентацию (PDF)'");
    expect(strategicHomeSource).toContain("'Download presentation (PDF)'");
    expect(strategicHomeSource).toContain("'下载演示文稿（PDF）'");
    expect(landingLayoutSource).not.toContain("platform-v7-presentation-download");
    expect(landingLayoutSource).not.toContain("PresentationDownload.module.css");
  });

  it("keeps only the exact presentation URL public before the session gate", () => {
    const publicExact = sourceBlock("const PUBLIC_EXACT = new Set([", "]);");
    const publicPrefix = sourceBlock("const PUBLIC_PREFIX = [", "];");
    const staticFile = middlewareSource.match(/^const STATIC_FILE = .+$/mu)?.[0];
    const publicBranch = middlewareSource.lastIndexOf("isPublic(p)");
    const downloadHeaderBranch = middlewareSource.indexOf(
      "if (p === PRESENTATION_DOWNLOAD_PATH)",
    );
    const sessionGate = middlewareSource.indexOf("if (!session)");

    expect(middlewareSource).toContain(
      `const PRESENTATION_DOWNLOAD_PATH = '${DOWNLOAD_PATH}';`,
    );
    expect(middlewareSource.split(`'${DOWNLOAD_PATH}'`)).toHaveLength(2);
    expect(publicExact).toContain("PRESENTATION_DOWNLOAD_PATH");
    expect(publicExact.split("PRESENTATION_DOWNLOAD_PATH")).toHaveLength(2);
    expect(publicPrefix).not.toContain("PRESENTATION_DOWNLOAD_PATH");
    expect(publicPrefix).not.toContain("'/downloads/'");
    expect(staticFile).toBeDefined();
    expect(staticFile).not.toContain("pdf");
    expect(middlewareSource).not.toContain("p.startsWith('/downloads/')");
    expect(middlewareSource).toContain("'content-disposition'");
    expect(middlewareSource).toContain(
      `'attachment; filename="prozrachnaya-tsena-presentation.pdf"'`,
    );
    expect(publicBranch).toBeGreaterThan(-1);
    expect(downloadHeaderBranch).toBeGreaterThan(publicBranch);
    expect(sessionGate).toBeGreaterThan(downloadHeaderBranch);
  });

  it("pins and repeatedly decodes the exact 14-page presentation payload", () => {
    expect(existsSync(PUBLIC_FILE)).toBe(false);
    expect(parts).toHaveLength(14);
    expect(parts.slice(0, 13).every((part) => part.length === 18900)).toBe(true);
    expect(parts[13]).toHaveLength(18864);

    const base64 = parts.join("");
    expect(base64).toHaveLength(EXPECTED_BASE64_LENGTH);
    const compressed = Buffer.from(base64, "base64");
    expect(compressed).toHaveLength(EXPECTED_COMPRESSED_BYTES);
    expect(sha256(compressed)).toBe(EXPECTED_COMPRESSED_SHA256);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bytes = new Uint8Array(brotliDecompressSync(compressed));
      expect(bytes).toEqual(presentationPdfBytes());
      expect(bytes.byteLength).toBe(EXPECTED_BYTES);
      expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
      expect(Buffer.from(bytes.subarray(-32)).includes(Buffer.from("%%EOF"))).toBe(true);
      expect(Buffer.from(bytes).toString("latin1").match(/\/Type\/Page\b/g)).toHaveLength(14);
      expect(sha256(bytes)).toBe(EXPECTED_SHA256);
    }
  });

  it("serves the exact PDF with download-safe headers on repeated requests", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await GET();
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="prozrachnaya-tsena-presentation.pdf"',
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-length")).toBe(String(EXPECTED_BYTES));
      expect(sha256(bytes)).toBe(EXPECTED_SHA256);
    }
  });
});
