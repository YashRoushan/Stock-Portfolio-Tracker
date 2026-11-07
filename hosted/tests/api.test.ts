import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

let runtime: Miniflare;
const base = 'https://stock-tracker.test';
let counter = 0;
async function call(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const response = await runtime.dispatchFetch(base + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type':'application/json', 'CF-Connecting-IP':'192.0.2.' + ((counter++ % 200) + 1), ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: await response.json() as any };
}

before(async () => {
  runtime = new Miniflare({ cf:false, modules: true, scriptPath: 'dist/server/index.js', compatibilityDate: '2026-06-01', compatibilityFlags:['nodejs_compat'], d1Databases:['DB'], bindings:{ JWT_SECRET: randomBytes(48).toString('base64url') } });
  const db = await runtime.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) {
    const statements = (await readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
});
after(async () => { await runtime?.dispose(); });

test('The hosted API persists isolated portfolios, real trades and dividends', async () => {
  assert.equal((await call('/api/health')).status, 200);
  assert.equal((await call('/api/portfolios')).status, 401);
  const guestA = await call('/api/auth/demo', { method:'POST' });
  const guestB = await call('/api/auth/demo', { method:'POST' });
  assert.equal(guestA.status, 200);
  assert.equal(guestB.status, 200);
  const a = guestA.body.token, b = guestB.body.token;
  assert.ok(a && b && a !== b);
  const initial = await call('/api/portfolios', {token:a});
  assert.ok(initial.body.portfolios.length > 0);
  const other = await call('/api/portfolios', {token:b});
  const forbidden = other.body.portfolios[0].id;
  assert.equal((await call('/api/portfolios/' + forbidden, {token:a})).status, 404);
  assert.equal((await call('/api/transactions', {method:'POST',token:a,body:{portfolioId:forbidden,ticker:'AAPL',type:'BUY',quantity:1,price:100,fee:0,occurredAt:'2026-01-01T12:00:00.000Z'}})).status, 404);
  const created = await call('/api/portfolios', {method:'POST',token:a,body:{name:'Calculation check'}});
  assert.equal(created.status, 201);
  const id = created.body.portfolio.id;
  const trade = {portfolioId:id,ticker:'AAPL',type:'BUY',quantity:10,price:100,fee:1,occurredAt:'2026-01-01T12:00:00.000Z'};
  assert.equal((await call('/api/transactions', {method:'POST',token:a,body:trade})).status, 201);
  assert.equal((await call('/api/transactions', {method:'POST',token:a,body:{...trade,type:'SELL',quantity:4,price:150,fee:2,occurredAt:'2026-02-01T12:00:00.000Z'}})).status, 201);
  assert.equal((await call('/api/dividends', {method:'POST',token:a,body:{portfolioId:id,ticker:'AAPL',amount:2.5,occurredAt:'2026-02-02T12:00:00.000Z'}})).status, 201);
  const summary = await call('/api/portfolios/' + id + '/summary', {token:a});
  assert.equal(summary.status, 200);
  assert.equal(summary.body.summary.holdings[0].quantity, 6);
  assert.equal(summary.body.summary.holdings[0].costBasisCents, 60_060);
  assert.equal(summary.body.summary.holdings[0].realizedPlCents, 19_760);
  assert.equal(summary.body.summary.totals.totalDividendsCents, 250);
  assert.ok([400,409].includes((await call('/api/transactions', {method:'POST',token:a,body:{...trade,type:'SELL',quantity:7,occurredAt:'2026-03-01T12:00:00.000Z'}})).status));
  const concurrent = await Promise.all([1,2].map(() => call('/api/transactions', {method:'POST',token:a,body:{...trade,type:'SELL',quantity:4,occurredAt:'2026-03-02T12:00:00.000Z'}})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(), [201,409]);
  assert.equal((await call('/api/transactions', {method:'POST',token:a,body:{...trade,type:'SELL',quantity:3,occurredAt:'2026-01-15T12:00:00.000Z'}})).status,409);
  assert.equal((await call('/api/transactions', {token:b})).body.transactions.some((t:any)=>t.portfolioId===id),false);
  assert.equal((await call('/api/portfolios/' + id + '/summary', {token:'invalid-token'})).status,401);
});

test('Registration and login use the real account flow and reject invalid credentials',async()=>{
  const email='verify-'+randomBytes(5).toString('hex')+'@example.invalid';
  const password=randomBytes(20).toString('base64url');
  const registered=await call('/api/auth/register',{method:'POST',body:{email,password}});
  assert.equal(registered.status,200);
  assert.equal((await call('/api/auth/login',{method:'POST',body:{email,password}})).status,200);
  assert.equal((await call('/api/auth/login',{method:'POST',body:{email,password:'incorrect-password'}})).status,400);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email,password}})).status,400);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email:'invalid',password:'short'}})).status,400);
});

test('Public demo creation is rate limited and cross-origin writes are rejected', async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await runtime.dispatchFetch(base + '/api/auth/demo', {
      method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  const limited = await runtime.dispatchFetch(base + '/api/auth/demo', {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' },
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  const crossOrigin = await runtime.dispatchFetch(base + '/api/auth/demo', {
    method:'POST', headers:{ Origin:'https://another-site.invalid' },
  });
  assert.equal(crossOrigin.status, 403);
});
