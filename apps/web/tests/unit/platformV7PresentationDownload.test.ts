import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_BYTES = 686396;
const EXPECTED_SHA256 =
  "d12bb86daacfde3d6885c3a1d41c53a81c25c9ddaf190ca9773ee8ad8587e6a9";
const DOWNLOAD_PATH = "/downloads/prozrachnaya-tsena-presentation.pdf";
const PUBLIC_FILE = resolve(process.cwd(), `public${DOWNLOAD_PATH}`);
const middlewareSource = readFileSync(resolve(process.cwd(), "middleware.ts"), "utf8");

function sourceBlock(declaration: string, terminator: string): string {
  const start = middlewareSource.indexOf(declaration);
  const end = middlewareSource.indexOf(terminator, start);
  if (start < 0 || end < 0) throw new Error(`${declaration} block not found`);
  return middlewareSource.slice(start, end + terminator.length);
}

describe("public presentation download", () => {
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

  it("repeatedly reads the exact verified 14-page PDF payload", () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bytes = readFileSync(PUBLIC_FILE);

      expect(bytes.byteLength).toBe(EXPECTED_BYTES);
      expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(bytes.subarray(-32).includes("%%EOF")).toBe(true);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        EXPECTED_SHA256,
      );
    }
  });
});
