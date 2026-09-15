// /api/lead — validates demo requests and sends them through Resend.
const hits = new Map();
const clean = value => String(value || '').slice(0, 600).replace(/[<>]/g, '');
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
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
  const log = (hits.get(ip) || []).filter(time => now - time < 3600000);
  if (log.length >= 5) return json({ error: 'too many' }, 429);
  log.push(now); hits.set(ip, log);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (body.company_website) return json({ ok: true });
  if (body.t && Date.now() - Number(body.t) < 3000) return json({ error: 'too fast' }, 400);
  const name = clean(body.name), restaurant = clean(body.restaurant), email = clean(body.email), note = clean(body.note);
  const phone = clean(body.phone).replace(/[^0-9]/g, '').slice(-10);
  if (name.length < 2 || restaurant.length < 2) return json({ error: 'missing name' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'bad email' }, 400);
  if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: 'bad phone' }, 400);
  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.LEAD_FROM, to: process.env.LEAD_TO, reply_to: email,
        subject: `Demo request — ${restaurant}`, text: `${name} at ${restaurant}\n${email}\n+91 ${phone}\n\n${note || '(no note)'}` })
    });
    if (!upstream.ok) throw new Error('Resend rejected request');
    return json({ ok: true });
  } catch { return json({ error: 'could not send' }, 500); }
}

export const config = { path: '/api/lead' };
