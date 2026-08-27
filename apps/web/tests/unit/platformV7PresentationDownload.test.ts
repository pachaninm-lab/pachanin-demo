import { createHash } from "node:crypto";

import { GET } from "../../app/downloads/prozrachnaya-tsena-presentation.pdf/route";

describe("public presentation download", () => {
  it("serves the exact verified 14-page PDF payload", async () => {
    const response = GET();
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(Number(response.headers.get("content-length"))).toBe(686396);
    expect(bytes.byteLength).toBe(686396);
    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "00fdb290e041ce3df2c33b4b67821536fd0873cd8d11a0b9c2290eb9820c1bfe",
    );
  });
});
