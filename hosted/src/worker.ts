import api from './api';
import type { HostedBindings } from './types';
import { assets } from '../generated/assets';

function assetResponse(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const pathname = new URL(request.url).pathname;
  const key = Object.hasOwn(assets, pathname) ? pathname : pathname.includes('.') ? null : '/index.html';
  const asset = key ? assets[key] : undefined;
  if (!asset) return new Response('Page unavailable', { status: 404 });
  const headers = new Headers({
    'Content-Type': asset.type,
    'Cache-Control': key === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ETag: asset.etag,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  });
  if (request.headers.get('If-None-Match') === asset.etag) return new Response(null, { status: 304, headers });
  if (request.method === 'HEAD') return new Response(null, { headers });
  const binary = atob(asset.body);
  const body = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Response(body, { headers });
}

export default {
  fetch(request: Request, env: HostedBindings, ctx: ExecutionContext) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) return api.fetch(request, env, ctx);
    return assetResponse(request);
  },
};
