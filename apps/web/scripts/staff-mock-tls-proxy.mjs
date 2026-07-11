import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const listenPort = Number(process.env.STAFF_TLS_PROXY_PORT || 4011);
const upstreamPort = Number(process.env.STAFF_MOCK_PORT || 4010);
const preserveHost = process.env.STAFF_TLS_PRESERVE_HOST === 'true' || upstreamPort === 3000;
const keyPath = process.env.STAFF_MOCK_TLS_KEY;
const certPath = process.env.STAFF_MOCK_TLS_CERT;
if (!keyPath || !certPath) throw new Error('STAFF_MOCK_TLS_KEY and STAFF_MOCK_TLS_CERT are required');

const server = https.createServer({
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}, (request, response) => {
  const externalHost = request.headers.host || `127.0.0.1:${listenPort}`;
  const headers = {
    ...request.headers,
    host: preserveHost ? externalHost : `127.0.0.1:${upstreamPort}`,
    'x-forwarded-proto': 'https',
    'x-forwarded-host': externalHost,
    'x-forwarded-port': String(listenPort),
  };
  if (preserveHost) {
    delete headers.origin;
    delete headers.referer;
  }
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ code: 'TLS_PROXY_UPSTREAM_UNAVAILABLE' }));
  });
  request.pipe(upstream);
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`staff TLS proxy on https://127.0.0.1:${listenPort}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));