// /api/explain — keeps the Anthropic key on the server.
// Uses standard Request/Response objects, so it runs on Vercel and Netlify.
const hits = new Map();
const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
});

function trustedOrigin(req) {
  const origin = req.headers.get('origin') || '';
  if (!origin) return true;
  const host = req.headers.get('host') || new URL(req.url).host;
  const configured = (process.env.PUBLIC_SITE_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  return [`https://${host}`, `http://${host}`, ...configured].includes(origin);
}

export default async function handler(req, context) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!trustedOrigin(req)) return json({ error: 'forbidden' }, 403);
  const ip = (req.headers.get('x-forwarded-for') || context?.ip || 'local').split(',')[0].trim();
  const now = Date.now();
  const log = (hits.get(ip) || []).filter(time => now - time < 60000);
  if (log.length >= 30) return json({ error: 'slow down' }, 429);
  log.push(now); hits.set(ip, log);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'server not configured' }, 500);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  if (!messages.length) return json({ error: 'no messages' }, 400);
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages })
    });
    const data = await upstream.json();
    if (!upstream.ok) return json({ error: data?.error?.message || 'upstream error' }, upstream.status);
    return json(data, 200, { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' });
  } catch { return json({ error: 'explain failed' }, 500); }
}

export const config = { path: '/api/explain' };
