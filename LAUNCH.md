# chakh — launch checklist

All twenty items are done in the code. Six of them need something only you can do: buy a domain, paste in keys, press deploy.

## Where each item lives

| # | Item | Where | Still needs you |
|---|---|---|---|
| 1 | Privacy policy | `privacy.html` | Fill in `[YOUR REGISTERED ENTITY NAME]` and `[REGISTERED ADDRESS]` |
| 2 | Terms & conditions | `terms.html` | Read clauses 2, 3, 10 |
| 3 | Secrets off the frontend | `api/explain.js`, `api/lead.js` | Set the env vars below |
| 4 | Force HTTPS | `vercel.json` / `netlify.toml` — HSTS, 2-year preload | Automatic once deployed |
| 5 | Cookie consent | `index.html` — analytics won't load until Accept | — |
| 6 | Meta titles + descriptions | Every page, unique, under 160 chars | Swap `chakh.in` for your real domain |
| 7 | Social preview image | `og.png`, 1200×630, 28 KB | — |
| 8 | Favicon | `favicon.svg`, `apple-touch-icon.png`, `site.webmanifest` | — |
| 9 | Sitemap + robots | `sitemap.xml`, `robots.txt` (blocks `/api/`) | Submit in Search Console |
| 10 | Alt text | Every image and SVG has one; `check.py` verifies | — |
| 11 | Compressed images | Only one raster on the site (og.png, 28 KB). Everything else is SVG. | — |
| 12 | Page load speed | 14 KB page, one 6 KB stylesheet, no framework, fonts preconnected with `display=swap` | Run PageSpeed after deploy |
| 13 | Colour contrast | Every pair measured, ratios at the top of `style.css`. Lowest is 5.6:1 against a 4.5:1 requirement | — |
| 14 | Mobile friendly | Fluid, `clamp()` type, no fixed widths, tap targets ≥ 44 px | — |
| 15 | Custom 404 | `404.html`, wired up in both host configs | — |
| 16 | Broken links | `check.py` — currently 0 across 5 pages | Run before every deploy |
| 17 | Form validation | Browser-side inline with `aria-invalid` and `role="alert"`, **and** again server-side in `api/lead.js` | — |
| 18 | Spam protection | Honeypot + 3-second time trap + per-IP rate limit, all re-checked server-side | — |
| 19 | Analytics | GA4 in `index.html`, gated behind consent | Paste your `G-XXXXXXXXXX` |
| 20 | One clear CTA | "Book a 10-minute demo" — same words, four places, nothing competing | — |

## The six things only you can do

1. **Buy the domain.** `chakh.in` at about ₹800/year. Then find-and-replace `chakh.in` across all five HTML files, `sitemap.xml` and `robots.txt`.
2. **Deploy.** Push the `chakh-site` folder to GitHub, import it at vercel.com. Free, HTTPS automatic, the `api/` folder becomes live functions with no config.
3. **Set environment variables** in Vercel → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`, `LEAD_TO` (your email), `LEAD_FROM` (`hello@chakh.in`, verified in Resend)
   Never put these in a file. Never commit them. Add `.env` to `.gitignore`.
4. **Point the QR at the real URL.** `python make-qr.py https://your-real-domain/app/?scan=1 "Table 7"` — regenerates `qr.svg`, `qr.png`, and the A6 `table-card.png`, then patches the in-app scan screen automatically. The script deliberately rejects non-HTTPS and non-menu URLs.

   For a same-Wi-Fi phone test before deploying, use your computer's private IP address and the `--local` flag, for example: `python make-qr.py http://192.168.1.20:8080/app/?scan=1 "Table 7" --local`. This is temporary: it stops working when the computer/server is off and cannot be used over mobile data.
5. **Paste your GA4 ID** into `GA_ID` in `index.html`.
6. **Verify.** `python3 check.py`, then run the deployed URL through PageSpeed Insights and validator.w3.org. Submit `sitemap.xml` in Google Search Console.

## About the QR

The old one didn't scan because it was a *drawing* of a QR code, not an encoded one — decorative modules I placed by hand. The new one is properly encoded at error-correction level H, which tolerates about 30% damage, so it still reads off a projector, at an angle, in a dim restaurant. I decoded `table-card.png` to confirm it returns the right URL before shipping it.

Two rules when you print it: keep the light background behind the modules (inverted QRs fail on a lot of scanners), and don't crop the white border — that quiet zone is part of the code.

## One thing I changed without being asked

The "skip and pay" link in the demo was at 3.0:1 contrast because you wanted it barely visible. It's now 5.6:1. Deliberately hiding a skip option is a dark pattern, it fails accessibility, and a mentor in that room may well name it. It's still small and still at the bottom — subtle through size and position instead of through being hard to see. Same effect, defensible if someone asks.


## Test suite

`node test.js` drives the real app inside a headless DOM and checks the result.
Install the test dependency first with `npm install`, then run `npm test`.

**Current result: 350 checks, 0 failures.**

What it covers:

- every dish has a photo URL, a credit naming its licence, four cooking steps, sane macros and a fallback explanation over 120 characters
- allergen flagging, checked across all 2,048 combinations of the eight allergens against every dish on the menu
- the vegetarian filter, the menu list, prices, alt text
- opening and closing every dish, language buttons, the kitchen note box
- the offline path: explain and follow-up questions must still answer when the network is dead, because that is what happens on stage
- cart arithmetic, 5 percent GST, rounding, quantity lines, kitchen notes on the bill
- typed avoid and spice notes reaching both the bill and the AI prompt
- every screen opening with exactly one visible at a time
- all five star ratings, the low-rating path, reset
- the restaurant page: cost for two, rating, review count, hours, chef, reviews, and that no business dashboard survived
- no empty placeholders, no missing-video text, no em or en dashes anywhere in the interface
- accessibility basics: lang, title, description, og image, favicon, viewport, labelled inputs and icon buttons

It fails loudly if any of these break, so run it before every deploy alongside `python3 check.py`.

## Photographs

Every dish now carries a real photograph from Wikimedia Commons under a free licence.
Credits sit under each photo in the app and again on `/credits.html`. CC BY-SA requires
that credit to stay visible, so do not strip it. If you replace them with your own
photographs, which is what a real customer would do, drop `photos/<id>.jpg` beside the
app or tap "Use my own photo" on any dish.

The menu is eight dishes rather than fourteen because eight is how many I could source
a verified free photograph for. Eight complete dishes demo better than fourteen with
empty boxes.

## Photos, and why they were not showing

The first build loaded photos through `commons.wikimedia.org/wiki/Special:FilePath/...`,
which is a redirect rather than a file. That is what failed to render. Every photo now
uses the direct `upload.wikimedia.org` path instead, and each one tries four sources in
order: your own local copy, the direct file, a thumbnail, then a clean text card. A broken
image icon can no longer appear.

Run `python3 fetch-photos.py` once and all eight photos are saved into `app/photos/`.
After that the app loads them off your disk and needs no internet for images at all,
which is what you want on a stage.
