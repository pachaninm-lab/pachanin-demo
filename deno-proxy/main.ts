const UUID = '9f3cbdb8-4a9d-5811-1d8e-58603f42cfd6';

type VlessRequest = {
  ver: number;
  host: string;
  port: number;
  cmd: number;
  p: Uint8Array;
};

type DnsPacket = {
  query: Uint8Array;
  framed: boolean;
};

function parse(a: Uint8Array, uid: string): VlessRequest | null {
  if (a.length < 24) return null;

  const u = Array.from(a.slice(1, 17), (b: number) => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
  if (u !== uid) return null;

  const al = a[17];
  const o = 18 + al;
  if (o + 4 > a.length) return null;

  const cmd = a[o];
  if (cmd !== 1 && cmd !== 2) return null;

  const port = (a[o + 1] << 8) | a[o + 2];
  const at = a[o + 3];
  let host: string;
  let end: number;

  if (at === 1) {
    if (o + 8 > a.length) return null;
    host = `${a[o + 4]}.${a[o + 5]}.${a[o + 6]}.${a[o + 7]}`;
    end = o + 8;
  } else if (at === 2) {
    if (o + 5 > a.length) return null;
    const l = a[o + 4];
    if (o + 5 + l > a.length) return null;
    host = new TextDecoder().decode(a.slice(o + 5, o + 5 + l));
    end = o + 5 + l;
  } else if (at === 3) {
    if (o + 20 > a.length) return null;
    const dv = new DataView(a.buffer, a.byteOffset + o + 4, 16);
    host = Array.from({ length: 8 }, (_, i) => dv.getUint16(i * 2).toString(16)).join(':');
    end = o + 20;
  } else {
    return null;
  }

  return { ver: a[0], host, port, cmd, p: new Uint8Array(a.buffer.slice(a.byteOffset + end)) };
}

function decodeDnsPackets(data: Uint8Array): DnsPacket[] {
  if (data.byteLength === 0) return [];

  const framed: DnsPacket[] = [];
  let off = 0;
  let validFrames = true;

  while (off < data.length) {
    if (off + 2 > data.length) {
      validFrames = false;
      break;
    }

    const len = (data[off] << 8) | data[off + 1];
    off += 2;

    if (len === 0 || off + len > data.length) {
      validFrames = false;
      break;
    }

    framed.push({ query: data.slice(off, off + len), framed: true });
    off += len;
  }

  if (validFrames && framed.length > 0 && off === data.length) {
    return framed;
  }

  // Some Android/Xray clients can send the first UDP DNS payload as a raw DNS datagram.
  // Without this fallback the tunnel stays connected but DNS never answers, which appears as DNS_PROBE_STARTED.
  return [{ query: data, framed: false }];
}

function encodeDnsAnswer(answer: Uint8Array, framed: boolean): Uint8Array {
  if (!framed) return answer;

  const frame = new Uint8Array(2 + answer.byteLength);
  frame[0] = answer.byteLength >> 8;
  frame[1] = answer.byteLength & 0xff;
  frame.set(answer, 2);
  return frame;
}

async function forwardDns(data: Uint8Array, ws: WebSocket): Promise<void> {
  for (const packet of decodeDnsPackets(data)) {
    try {
      const r = await fetch('https://1.1.1.1/dns-query', {
        method: 'POST',
        headers: {
          accept: 'application/dns-message',
          'content-type': 'application/dns-message',
        },
        body: packet.query,
      });

      if (!r.ok) continue;

      const ans = new Uint8Array(await r.arrayBuffer());
      try {
        ws.send(encodeDnsAnswer(ans, packet.framed));
      } catch {
        // Socket may already be closed by the client.
      }
    } catch {
      // Keep the tunnel alive for the next DNS packet.
    }
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
  if (!v) {
    try { ws.close(); } catch { /**/ }
    return;
  }

  // UDP: safely support DNS only. Non-DNS UDP is intentionally rejected.
  if (v.cmd === 2) {
    if (v.port !== 53) {
      try { ws.close(); } catch { /**/ }
      return;
    }

    ws.send(new Uint8Array([v.ver, 0]));

    if (v.p.byteLength > 0) await forwardDns(v.p, ws);

    ws.addEventListener('message', async (e: MessageEvent) => {
      try {
        const bytes = e.data instanceof ArrayBuffer
          ? new Uint8Array(e.data)
          : e.data instanceof Blob
            ? new Uint8Array(await e.data.arrayBuffer())
            : null;
        if (bytes) await forwardDns(bytes, ws);
      } catch {
        // Ignore one bad DNS packet and keep the websocket open.
      }
    });
    return;
  }

  // TCP.
  let conn: Deno.TcpConn;
  try {
    conn = await Deno.connect({ hostname: v.host, port: v.port });
  } catch {
    try { ws.close(); } catch { /**/ }
    return;
  }

  let done = false;
  const shut = () => {
    if (done) return;
    done = true;
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
        const bytes = e.data instanceof ArrayBuffer
          ? new Uint8Array(e.data)
          : e.data instanceof Blob
            ? new Uint8Array(await e.data.arrayBuffer())
            : null;
        if (bytes) await writer.write(bytes);
      } catch {
        shut();
      }
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
    } catch {
      // Remote TCP close/reset.
    } finally {
      shut();
    }
  })();
}

async function canOpenTcp(): Promise<boolean> {
  let timer: number | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 2500);
    });

    const conn = await Promise.race<Deno.TcpConn | null>([
      Deno.connect({ hostname: '1.1.1.1', port: 443 }),
      timeout,
    ]);

    if (!conn) return false;
    try { conn.close(); } catch { /**/ }
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/check') {
      const tcp = await canOpenTcp();
      return Response.json({ ok: true, tcp, udpDnsMode: 'dns-over-https', version: 'dns-raw-fallback-2026-06-02' }, {
        headers: { 'cache-control': 'no-store' },
      });
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('ok', { status: 200, headers: { 'cache-control': 'no-store' } });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    handleVless(socket).catch(() => { try { socket.close(); } catch { /**/ } });
    return response;
  },
};
