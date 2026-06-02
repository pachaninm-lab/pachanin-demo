const UUID = '9f3cbdb8-4a9d-5811-1d8e-58603f42cfd6';

function parse(a: Uint8Array, uid: string) {
  if (a.length < 24) return null;
  const u = Array.from(a.slice(1, 17), (b: number) => b.toString(16).padStart(2, '0'))
    .join('').replace(/(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
  if (u !== uid) return null;
  const al = a[17], o = 18 + al, cmd = a[o];
  if (cmd !== 1 && cmd !== 2) return null;
  const port = (a[o + 1] << 8) | a[o + 2], at = a[o + 3];
  let host: string, end: number;
  if (at === 1) { host = `${a[o+4]}.${a[o+5]}.${a[o+6]}.${a[o+7]}`; end = o + 8; }
  else if (at === 2) { const l = a[o+4]; host = new TextDecoder().decode(a.slice(o+5, o+5+l)); end = o+5+l; }
  else if (at === 3) { const dv = new DataView(a.buffer, a.byteOffset+o+4, 16); host = Array.from({length:8},(_,i)=>dv.getUint16(i*2).toString(16)).join(':'); end = o+20; }
  else return null;
  return { ver: a[0], host, port, cmd, p: new Uint8Array(a.buffer.slice(a.byteOffset + end)) };
}

async function forwardDns(data: Uint8Array, ws: WebSocket): Promise<void> {
  let off = 0;
  while (off + 2 <= data.length) {
    const len = (data[off] << 8) | data[off + 1];
    off += 2;
    if (len === 0 || off + len > data.length) break;
    const query = data.slice(off, off + len);
    off += len;
    try {
      const r = await fetch('https://1.1.1.1/dns-query', {
        method: 'POST',
        headers: { 'content-type': 'application/dns-message' },
        body: query,
      });
      if (!r.ok) continue;
      const ans = new Uint8Array(await r.arrayBuffer());
      const frame = new Uint8Array(2 + ans.byteLength);
      frame[0] = ans.byteLength >> 8;
      frame[1] = ans.byteLength & 0xff;
      frame.set(ans, 2);
      try { ws.send(frame); } catch { /**/ }
    } catch { /**/ }
  }
}

async function handleVless(ws: WebSocket): Promise<void> {
  const buf = await new Promise<ArrayBuffer>((ok, no) => {
    ws.addEventListener('message', (e: MessageEvent) => {
      const d = e.data;
      if (d instanceof ArrayBuffer) ok(d);
      else if (d instanceof Blob) d.arrayBuffer().then(ok, no);
      else no(new Error('unexpected data type'));
    }, { once: true });
    ws.addEventListener('close', () => no(new Error('closed')), { once: true });
    ws.addEventListener('error', () => no(new Error('error')), { once: true });
  });

  const v = parse(new Uint8Array(buf), UUID);
  if (!v) { try { ws.close(); } catch { /**/ } return; }

  // UDP — handle only DNS (port 53) via DoH
  if (v.cmd === 2) {
    if (v.port !== 53) { try { ws.close(); } catch { /**/ } return; }
    ws.send(new Uint8Array([v.ver, 0]));
    if (v.p.byteLength > 0) await forwardDns(v.p, ws);
    ws.addEventListener('message', async (e: MessageEvent) => {
      try {
        const bytes = e.data instanceof ArrayBuffer ? new Uint8Array(e.data)
          : e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : null;
        if (bytes) await forwardDns(bytes, ws);
      } catch { /**/ }
    });
    return;
  }

  // TCP (cmd === 1)
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
  ws.addEventListener('message', (e: MessageEvent) => {
    q = q.then(async () => {
      if (done) return;
      try {
        const bytes = e.data instanceof ArrayBuffer ? new Uint8Array(e.data)
          : e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : null;
        if (bytes) await writer.write(bytes);
      } catch { shut(); }
    });
  });
  ws.addEventListener('close', shut);
  ws.addEventListener('error', shut);

  (async () => {
    try {
      for await (const chunk of conn.readable) {
        if (done) break;
        try { ws.send(chunk); } catch { break; }
      }
    } catch { /**/ } finally { shut(); }
  })();
}

export default {
  fetch(req: Request): Response {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('ok', { status: 200 });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleVless(socket).catch(() => { try { socket.close(); } catch { /**/ } });
    return response;
  },
};
