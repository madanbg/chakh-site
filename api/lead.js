// /api/lead — receives the demo-booking form and emails it to you.
//
// Validation runs again here on purpose. Browser-side validation is a
// convenience for humans; a bot posts straight to this URL and never sees it.
//
// Env vars needed:  RESEND_API_KEY, LEAD_TO (your email), LEAD_FROM (a verified
// sender on your domain, e.g. hello@chakh.in)

const hits = new Map();
const clean = s => String(s || '').slice(0, 600).replace(/[<>]/g, '');

// The same site can be served from a Vercel preview URL, a Netlify URL, or
// the final custom domain. Accept its own Host header, plus any explicitly
// configured production origins, instead of hard-coding one placeholder URL.
function trustedOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return true; // non-browser/server request; validation still runs below
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
  const log = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (log.length >= 5) return res.status(429).json({ error: 'too many' });
  log.push(now); hits.set(ip, log);

  const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

  // spam trap 1: honeypot. A human never sees this field, so a filled one is a bot.
  // Return 200 so the bot thinks it worked and doesn't retry.
  if (b.company_website) return res.status(200).json({ ok: true });

  // spam trap 2: filled in under three seconds
  if (b.t && Date.now() - Number(b.t) < 3000) return res.status(400).json({ error: 'too fast' });

  const name = clean(b.name), restaurant = clean(b.restaurant);
  const email = clean(b.email), note = clean(b.note);
  const phone = clean(b.phone).replace(/[^0-9]/g, '').slice(-10);

  if (name.length < 2 || restaurant.length < 2) return res.status(400).json({ error: 'missing name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'bad email' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'bad phone' });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.LEAD_FROM,
        to: process.env.LEAD_TO,
        reply_to: email,
        subject: `Demo request — ${restaurant}`,
        text: `${name} at ${restaurant}\n${email}\n+91 ${phone}\n\n${note || '(no note)'}`
      })
    });
    if (!r.ok) throw new Error(await r.text());
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'could not send' });
  }
}
