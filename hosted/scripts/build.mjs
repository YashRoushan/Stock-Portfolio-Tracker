import { execFileSync } from "node:child_process";
import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build", "--workspace", "frontend"], {
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: "", VITE_DEMO_MODE: "true" },
});
const frontend = path.resolve('frontend/dist');
const assets = {};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await collect(file); continue; }
    const data = await readFile(file);
    const name = '/' + path.relative(frontend, file).split(path.sep).join('/');
    assets[name] = { body: data.toString('base64'), type: mime[path.extname(file)] || 'application/octet-stream', etag: '"' + createHash('sha256').update(data).digest('hex').slice(0, 24) + '"' };
  }
}
await collect(frontend);
if (!assets['/index.html']) throw new Error('Build the frontend before packaging the Worker.');
await mkdir('hosted/generated', { recursive: true });
await writeFile('hosted/generated/assets.ts', 'export const assets: Record<string, {body:string;type:string;etag:string}> = ' + JSON.stringify(assets) + ';\n');
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await build({ entryPoints: ['hosted/src/worker.ts'], outfile: 'dist/server/index.js', bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true, legalComments: 'eof', external: ['cloudflare:workers', 'node:*'] });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Built a server Worker with ' + Object.keys(assets).length + ' embedded frontend assets.');
