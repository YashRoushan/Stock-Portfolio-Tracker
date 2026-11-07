import { Miniflare } from 'miniflare';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const runtime = new Miniflare({
  host: option('--host', '127.0.0.1'),
  port: Number(option('--port', '4173')),
  cf: false,
  modules: true,
  scriptPath: path.resolve('dist/server/index.js'),
  compatibilityDate: '2026-06-01',
  compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'stock-tracker-local' },
  d1Persist: path.resolve('.wrangler/state/d1'),
  bindings: { JWT_SECRET: randomBytes(48).toString('base64url') },
});
const database = await runtime.getD1Database('DB');
await database.prepare('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)').run();
for (const filename of (await readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) {
  const exists = await database.prepare('SELECT name FROM _local_migrations WHERE name = ?').bind(filename).first();
  if (exists) continue;
  const sql = await readFile(path.join('drizzle', filename), 'utf8');
  const statements = sql.split('--> statement-breakpoint').map(text => text.trim()).filter(Boolean);
  await database.batch([...statements.map(text => database.prepare(text)), database.prepare('INSERT INTO _local_migrations (name) VALUES (?)').bind(filename)]);
}
console.log('Stock Portfolio Tracker ready at ' + (await runtime.ready));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await runtime.dispose(); process.exit(0); });
