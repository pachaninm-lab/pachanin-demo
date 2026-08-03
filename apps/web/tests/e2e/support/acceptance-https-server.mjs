#!/usr/bin/env node
/**
 * HTTPS server for the Design System v8 acceptance run.
 *
 * The acceptance matrix signs in for real, and a real login sets `Secure`
 * cookies because the web app runs in production mode. WebKit will not store a
 * Secure cookie delivered over plain http://localhost, so the whole matrix
 * failed there while Chromium and Firefox passed — a transport artifact of
 * testing over http, not a product defect.
 *
 * Terminating TLS in a proxy in front of `next start` does not fix it: the
 * browser sends `Origin: https://…` while Next still builds its request URL
 * from the plain connection, and the same-origin CSRF check correctly rejects
 * the mismatch. Rewriting or stripping that header would disable a real
 * security control, so instead Next itself serves the TLS connection and sees
 * a genuine https origin — the same thing production does.
 *
 * Self-signed certificate, generated per run; Playwright trusts it via
 * ignoreHTTPSErrors.
 */

import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import next from 'next';

const port = Number(process.env.PC_ACCEPTANCE_HTTPS_PORT || 3443);
const cert = process.env.PC_ACCEPTANCE_TLS_CERT;
const key = process.env.PC_ACCEPTANCE_TLS_KEY;

if (!cert || !key) {
  console.error('PC_ACCEPTANCE_TLS_CERT and PC_ACCEPTANCE_TLS_KEY are required');
  process.exit(1);
}

const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

await app.prepare();

createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
  handle(req, res).catch((error) => {
    console.error('acceptance https handler failed', error);
    res.statusCode = 500;
    res.end('internal error');
  });
}).listen(port, () => {
  console.log(`Design System v8 acceptance server listening on https://localhost:${port}`);
});
