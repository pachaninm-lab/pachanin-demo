import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const EXPECTED_PDF_BYTES = 312533;
const EXPECTED_PDF_SHA256 =
  "1f99bd881404624ef8fe8bec9a10caf10a021f8cacff3ed5a6633101255178a5";
const EXPECTED_BROTLI_BYTES = 198423;
const EXPECTED_BROTLI_SHA256 =
  "e99c503bb653bfc1f4c2fd800a5bc230404a6d22d02f3d1362cb66e1172b0612";
const EXPECTED_BASE64_LENGTH = 264564;
const DOWNLOAD_PATH = "/downloads/prozrachnaya-tsena-presentation.pdf";
const ROUTE_FILE = resolve(
  process.cwd(),
  "app/downloads/prozrachnaya-tsena-presentation.pdf/route.ts",
);
const MATERIALIZER_FILE = resolve(
  process.cwd(),
  "scripts/materialize-presentation-pdf.mjs",
);
const PACKAGE_FILE = resolve(process.cwd(), "package.json");

function readPart(index: number): string {
  const suffix = String(index).padStart(2, "0");
  const source = readFileSync(
    resolve(process.cwd(), `lib/presentation-pdf/part-${suffix}.ts`),
    "utf8",
  );
  const literals = [...source.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map(
    (match) => match[1],
  );
  expect(literals.length).toBeGreaterThan(0);
  return literals.join("");
}

function reconstruct(): Buffer {
  const base64 = Array.from({ length: 14 }, (_, index) => readPart(index)).join("");
  expect(base64).toHaveLength(EXPECTED_BASE64_LENGTH);

  const compressed = Buffer.from(base64, "base64");
  expect(compressed.byteLength).toBe(EXPECTED_BROTLI_BYTES);

  return brotliDecompressSync(compressed);
}

describe("public presentation download", () => {
  it("reconstructs the exact canonical 14-page PDF twice", () => {
    const first = reconstruct();
    const second = reconstruct();

    for (const pdf of [first, second]) {
      expect(pdf.byteLength).toBe(EXPECTED_PDF_BYTES);
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdf.subarray(-64).includes("%%EOF")).toBe(true);
      expect(createHash("sha256").update(pdf).digest("hex")).toBe(
        EXPECTED_PDF_SHA256,
      );
      expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(14);
    }

    expect(first.equals(second)).toBe(true);
  });

  it("materializes the exact PDF before dev/build and keeps the live URL static", () => {
    const materializer = readFileSync(MATERIALIZER_FILE, "utf8");
    const pkg = JSON.parse(readFileSync(PACKAGE_FILE, "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(existsSync(ROUTE_FILE)).toBe(false);
    expect(materializer).toContain("public/downloads/prozrachnaya-tsena-presentation.pdf");
    expect(materializer).toContain(String(EXPECTED_PDF_BYTES));
    expect(materializer).toContain(EXPECTED_PDF_SHA256);
    expect(materializer).toContain(String(EXPECTED_BROTLI_BYTES));
    expect(materializer).toContain(EXPECTED_BROTLI_SHA256);
    expect(materializer).toContain("EXPECTED_PDF_PAGES = 14");
    expect(materializer).toContain("brotliDecompressSync(compressed)");
    expect(materializer).toContain("PRESENTATION_BROTLI_SHA256_NONCANONICAL");
    expect(materializer).toContain("writeFileSync(OUTPUT, pdf");
    expect(materializer).not.toContain("fetch(");

    expect(pkg.scripts.dev).toContain("node scripts/materialize-presentation-pdf.mjs");
    expect(pkg.scripts.build).toContain("node scripts/materialize-presentation-pdf.mjs");
    expect(DOWNLOAD_PATH).toBe("/downloads/prozrachnaya-tsena-presentation.pdf");
  });
});