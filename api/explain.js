// /api/explain — the only place the Anthropic key exists.
//
// Item 3, "secrets off the frontend", is the one on your list that is a real
// security bug rather than a polish item. A key in browser JavaScript is
// public the moment the page loads: anyone can open devtools, copy it and
// spend your money. It stays here, in an environment variable, on the server.
//
// Vercel:  Settings -> Environment Variables -> ANTHROPIC_API_KEY
// Netlify: Site configuration -> Environment variables
// Never commit it. Add .env to .gitignore.

const hits = new Map();                     // crude per-IP limit; swap for Upstash at scale

function trustedOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true;
  const host = req.headers.host || '';
  const ownOrigins = [`https://${host}`, `http://${host}`];
  const configured = (process.env.PUBLIC_SITE_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  return ownOrigins.concat(configured).includes(origin);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!trustedOrigin(req)) return res.status(403).json({ error: 'forbidden' });

  const ip = (req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const now = Date.now();
  const log = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (log.length >= 30) return res.status(429).json({ error: 'slow down' });
  log.push(now); hits.set(ip, log);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'server not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msgs = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
    if (!msgs.length) return res.status(400).json({ error: 'no messages' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,              // an explanation is ~80 words; cap the bill
        messages: msgs
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'upstream error' });

    // Cache identical dish explanations at the edge for a day. This is the line
    // that keeps inference cost flat no matter how many people sit down.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'explain failed' });
  }
}
