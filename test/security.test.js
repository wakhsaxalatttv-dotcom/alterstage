import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {createApp} from '../server/app.js';
import {fixedWindowLimiter} from '../server/security.js';

async function runServer(run) {
  const folder = await mkdtemp('/tmp/offres-security-');
  const token = randomBytes(32).toString('hex');
  const app = createApp({folder, adminToken: token, pipelineOptions: {sources: async () => []}});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`, app, token); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    app.locals.store.close();
    await rm(folder, {recursive: true, force: true});
  }
}

test('fixed window limits retain active counters, cap IP storage and expire without timers', () => {
  let time = 100000;
  const limiter = fixedWindowLimiter({limit: 2, windowMs: 1000, maxKeys: 2, now: () => time});
  assert.equal(limiter.consume('a'), 0);
  assert.equal(limiter.consume('a'), 0);
  assert.equal(limiter.blocked('a'), 1);
  assert.equal(limiter.consume('b'), 0);
  assert.equal(limiter.consume('c'), 1);
  assert.equal(limiter.consume('a'), 1);
  limiter.reset('b');
  assert.equal(limiter.consume('c'), 0);
  time += 60001;
  assert.equal(limiter.blocked('a'), 0);
  assert.equal(limiter.consume('d'), 0);
});

test('failed administrator requests are throttled across endpoints; spoofed forwarding does not bypass direct-host limits', () => runServer(async (base, app, token) => {
  const auth = {Authorization: `Bearer ${token}`};
  assert.equal((await fetch(base + '/api/admin/submissions', {headers: auth})).status, 200);
  for (let n = 0; n < 10; n++) {
    const response = await fetch(base + (n % 2 ? '/api/admin/reports' : '/api/admin/submissions'), {headers: {'X-Forwarded-For': `198.51.100.${n}`}});
    assert.equal(response.status, 401);
  }
  const denied = await fetch(base + '/api/admin/submissions', {headers: auth});
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers.get('retry-after')) > 0);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(base + '/api/offers')).status, 200);
}));

test('cross-site writes and non-JSON bodies are rejected before changing data, while same-origin requests work', () => runServer(async (base, app, token) => {
  const endpoint = base + '/api/admin/submissions/missing/review';
  const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${token}`};
  for (const extra of [{Origin: 'https://untrusted.example'}, {Origin: 'null'}, {'Sec-Fetch-Site': 'cross-site'}]) {
    assert.equal((await fetch(endpoint, {method: 'POST', headers: {...headers, ...extra}, body: '{}'})).status, 403);
  }
  assert.equal((await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{}'})).status, 415);
  assert.equal((await fetch(endpoint, {method: 'POST'})).status, 401);
  assert.equal((await fetch(base + '/api/admin/submissions', {headers: {...headers, Origin: base}})).status, 200);
  // A same-origin invalid body reaches normal validation, rather than being
  // blocked as a foreign request; no submitted record is created.
  assert.equal((await fetch(base + '/api/submissions', {method: 'POST', headers: {...headers, Origin: base}, body: '{}'})).status, 400);
  assert.equal((await app.locals.store.query({})).total, 0);
}));

test('browser restrictions and private cache controls are present; HSTS is limited to HTTPS requests', () => runServer(async (base, app) => {
  const response = await fetch(base + '/api/health');
  const csp = response.headers.get('content-security-policy');
  for (const directive of ["script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'"]) assert.ok(csp.includes(directive));
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('strict-transport-security'), null);
  const admin = await fetch(base + '/administration/');
  assert.match(admin.headers.get('x-robots-tag'), /noindex/);
  assert.equal(admin.headers.get('cache-control'), 'no-store');
  // Simulate Render's single trusted reverse-proxy hop, without enabling
  // trust for arbitrary forwarding headers in ordinary local execution.
  app.set('trust proxy', 1);
  const tls = await fetch(base + '/api/health', {headers: {'X-Forwarded-Proto': 'https'}});
  assert.equal(tls.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.ok(tls.headers.get('content-security-policy').includes('upgrade-insecure-requests'));
}));
