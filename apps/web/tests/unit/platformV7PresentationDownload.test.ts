import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_BYTES = 686396;
const EXPECTED_SHA256 =
  "d12bb86daacfde3d6885c3a1d41c53a81c25c9ddaf190ca9773ee8ad8587e6a9";
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

    expect(heroActions.split("data-testid='platform-v7-presentation-download'"))
      .toHaveLength(2);
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
