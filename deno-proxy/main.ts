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

// Deno Deploy resolves IPv6 first and hangs on timeout (denoland/deno#23580).
// Fix: pre-resolve every domain to an A record via DoH before Deno.connect().
async function toIPv4(hostname: string): Promise<string> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) return hostname;
  try {
    const r = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) }
    );
    if (r.ok) {
      const j = await r.json() as { Answer?: { type: number; data: string }[] };
      const ip = j.Answer?.find(a => a.type === 1)?.data;
      if (ip) return ip;
    }
  } catch { /**/ }
  return hostname;
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
      else no(new Error('type'));
    }, { once: true });
    ws.addEventListener('close', () => no(new Error('closed')), { once: true });
    ws.addEventListener('error', () => no(new Error('error')), { once: true });
  });

  const v = parse(new Uint8Array(buf), UUID);
  if (!v) { try { ws.close(); } catch { /**/ } return; }

  // UDP: only DNS (port 53) via DoH
  if (v.cmd === 2) {
    if (v.port !== 53) { try { ws.close(); } catch { /**/ } return; }
    ws.send(new Uint8Array([v.ver, 0]));
    if (v.p.byteLength > 0) await forwardDns(v.p, ws);
    ws.addEventListener('message', async (e: MessageEvent) => {
      try {
        const b = e.data instanceof ArrayBuffer ? new Uint8Array(e.data)
          : e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : null;
        if (b) await forwardDns(b, ws);
      } catch { /**/ }
    });
    return;
  }

  // TCP: resolve to IPv4 first to avoid Deno's IPv6-first bug
  const ip = await toIPv4(v.host);
  let conn: Deno.TcpConn;
  try {
    conn = await Deno.connect({ hostname: ip, port: v.port });
  } catch (e) {
    console.error('[vless] connect failed', ip, v.port, String(e));
    try { ws.close(); } catch { /**/ }
    return;
  }

  let done = false;
  const shut = () => {
    if (done) return; done = true;
    try { ws.close(); } catch { /**/ }
    try { conn.close(); } catch { /**/ }
  };

  const writer = conn.writable.getWriter();

  // Register WS→TCP listener BEFORE sending VLESS response (no race condition)
  let q = v.p.byteLength > 0
    ? Promise.resolve().then(async () => {
        try { await writer.write(v.p); } catch { shut(); }
      })
    : Promise.resolve();

  ws.addEventListener('message', (e: MessageEvent) => {
    q = q.then(async () => {
      if (done) return;
      try {
        const b = e.data instanceof ArrayBuffer ? new Uint8Array(e.data)
          : e.data instanceof Blob ? new Uint8Array(await e.data.arrayBuffer()) : null;
        if (b) await writer.write(b);
      } catch { shut(); }
    });
  });
  ws.addEventListener('close', shut);
  ws.addEventListener('error', shut);

  // TCP → WS
  (async () => {
    try {
      for await (const chunk of conn.readable) {
        if (done) break;
        try { ws.send(chunk); } catch { break; }
      }
    } catch { /**/ } finally { shut(); }
  })();

  // Send VLESS response after listener is ready
  ws.send(new Uint8Array([v.ver, 0]));
}

export default {
  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;

    if (path === '/check') {
      try {
        const ip = await toIPv4('one.one.one.one');
        const c = await Deno.connect({ hostname: ip, port: 53 });
        c.close();
        return new Response(`OK: Deno.connect works (1.1.1.1 → ${ip})\n`, { status: 200 });
      } catch (e) {
        return new Response(`FAIL: ${e}\n`, { status: 500 });
      }
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('ok', { status: 200 });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleVless(socket).catch(() => { try { socket.close(); } catch { /**/ } });
    return response;
  },
};
