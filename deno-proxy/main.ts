export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/diag") {
      const r: string[] = [];
      r.push("connect_type=" + typeof (Deno as unknown as Record<string,unknown>)?.connect);
      try {
        const c = await Deno.connect({ hostname: "1.1.1.1", port: 80 });
        c.close();
        r.push("tcp=ok");
      } catch (e) {
        r.push("tcp=fail:" + (e as Error).message);
      }
      return new Response(r.join("\n"), { status: 200 });
    }

    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("ok", { status: 200 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    handleVless(socket).catch(() => { try { socket.close(); } catch { /**/ } });
    return response;
  },
};

const UUID = "9f3cbdb8-4a9d-5811-1d8e-58603f42cfd6";

async function handleVless(ws: WebSocket): Promise<void> {
  const buf = await new Promise<ArrayBuffer>((ok, no) => {
    ws.addEventListener("message", (e: MessageEvent) => {
      const d = e.data;
      if (d instanceof ArrayBuffer) ok(d);
      else if (d instanceof Blob) d.arrayBuffer().then(ok, no);
      else no(new Error("bad type"));
    }, { once: true });
    ws.addEventListener("close", () => no(new Error("closed")), { once: true });
    ws.addEventListener("error", () => no(new Error("error")), { once: true });
  });

  const v = parse(new Uint8Array(buf));
  if (!v || v.cmd !== 1) { try { ws.close(); } catch { /**/ } return; }

  let conn: Deno.TcpConn;
  try {
    conn = await Deno.connect({ hostname: v.host, port: v.port });
  } catch {
    try { ws.close(); } catch { /**/ }
    return;
  }

  let done = false;
  const shut = () => {
    if (done) return; done = true;
    try { ws.close(); } catch { /**/ }
    try { conn.close(); } catch { /**/ }
  };

  ws.send(new Uint8Array([v.ver, 0]));

  const writer = conn.writable.getWriter();
  if (v.p.byteLength > 0) {
    try { await writer.write(v.p); } catch { shut(); return; }
  }

  let q = Promise.resolve();
  ws.addEventListener("message", (e: MessageEvent) => {
    q = q.then(async () => {
      if (done) return;
      try {
        const bytes = e.data instanceof ArrayBuffer
          ? new Uint8Array(e.data)
          : e.data instanceof Blob
            ? new Uint8Array(await e.data.arrayBuffer())
            : null;
        if (bytes) await writer.write(bytes);
      } catch { shut(); }
    });
  });
  ws.addEventListener("close", shut);
  ws.addEventListener("error", shut);

  (async () => {
    try {
      for await (const chunk of conn.readable) {
        if (done) break;
        ws.send(chunk);
      }
    } catch { /**/ } finally { shut(); }
  })();
}

function parse(a: Uint8Array) {
  if (a.length < 24) return null;
  const uid = Array.from(a.slice(1, 17), (b: number) => b.toString(16).padStart(2, "0"))
    .join("").replace(/(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
  if (uid !== UUID) return null;
  const al = a[17], o = 18 + al, cmd = a[o];
  if (cmd !== 1 && cmd !== 2) return null;
  const port = (a[o+1] << 8) | a[o+2], at = a[o+3];
  let host: string, end: number;
  if (at === 1) { host = `${a[o+4]}.${a[o+5]}.${a[o+6]}.${a[o+7]}`; end = o+8; }
  else if (at === 2) { const l = a[o+4]; host = new TextDecoder().decode(a.slice(o+5, o+5+l)); end = o+5+l; }
  else if (at === 3) { const dv = new DataView(a.buffer, a.byteOffset+o+4, 16); host = Array.from({length:8},(_,i)=>dv.getUint16(i*2).toString(16)).join(":"); end = o+20; }
  else return null;
  return { ver: a[0], cmd, host, port, p: new Uint8Array(a.buffer.slice(a.byteOffset+end)) };
}
