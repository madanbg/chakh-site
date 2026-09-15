# Getting chakh live. Do these in order.

Total time about 25 minutes. Everything below is either a copy and paste or a click.
Nothing here needs a credit card.

---

## Why nothing works yet

`chakh.in` is a placeholder I wrote into the files as your future address. Nobody owns it,
so there is no server, and the QR points at it. That is the only reason the QR fails.

Two other things only work once the app is on a real https link:

- **The camera view.** Browsers refuse camera access to a file opened off your disk. This
  is a browser rule, not a bug in the app.
- **The QR.** A phone camera cannot open a file that lives on your laptop.

So the deploy is not optional polish. It is the thing that turns the demo on.

---

## Step 1. Download the photos so they never depend on wifi

Open a terminal in the `chakh-site` folder and run:

```
python3 fetch-photos.py
```

You should see twelve lines saying `saved`. That puts all eight dish photos and all four
room photos into `app/photos/`. After this the app reads images off disk and needs no
internet for them at all. Do this before the venue wifi has a chance to embarrass you.

If it fails, the app still falls back to loading them from Wikimedia. It just needs a
connection to do it.

---

## Step 2. Put it online

**The fast way, two minutes, no account needed at first.**

1. Go to **app.netlify.com/drop**
2. Drag the whole `chakh-site` folder onto the page
3. Wait about twenty seconds

You get a live link like `https://silly-name-a1b2c3.netlify.app`. Write it down. Everything
works on it: the menu, the photos, the restaurant page, the 3D room, the camera view, the
QR. The only thing that does not is the live AI explanation, because that needs a server
function. It falls back to the written explanations, which are good enough that nobody
will notice.

**The better way, fifteen minutes, gets the AI working too.**

1. Put the `chakh-site` folder in a GitHub repo
2. Go to **vercel.com**, sign in with GitHub, click Add New, Project, import the repo
3. Click Deploy
4. When it is done, go to Settings, Environment Variables and add:
   - `ANTHROPIC_API_KEY` — your key from console.anthropic.com
   - `RESEND_API_KEY`, `LEAD_TO`, `LEAD_FROM` — only if you want the contact form to email you
5. Click Redeploy

Now the Explain button calls the real model, and your API key sits on the server where
nobody can steal it.

---

## Step 3. Point the QR at the real link

Back in the terminal, using whatever link Step 2 gave you:

```
python3 make-qr.py https://your-real-link/app/?scan=1 "Table 7"
```

This does three things: rewrites `qr.svg`, reprints `table-card.png` ready to print, and
updates the QR inside the app itself.

The `?scan=1` on the end matters. It means a guest who scans the card skips the splash and
lands directly in the menu, exactly like a real table.

**Then test it yourself.** Open `table-card.png` on your screen and scan it with your own
phone. If the menu opens, you are done. If it does not, the link is wrong, and you will
know now rather than on stage.

---

## Step 4. Replace `chakh.in` everywhere

Find and replace `chakh.in` with your real link in these seven files:

```
index.html   app/index.html   privacy.html   terms.html
credits.html   sitemap.xml   robots.txt
```

Any text editor does this. It only affects the sharing preview and search listing, so it is
the one step you can skip if you are short on time.

---

## Step 5. Check it before you trust it

```
python3 check.py      # broken links, missing alt text, page weight
node test.js          # 345 checks on the app itself, needs: npm install jsdom
```

Both should come back clean. Then open your live link on your phone and walk the whole
thing once, end to end.

---

## What the judges will see, in order

1. **You hold up the printed table card.** A judge scans it with their own phone.
2. **Their phone opens the menu.** No app, no install, no typing. This is the moment.
3. **They pick shellfish under things they avoid.** The squid dish goes red before they
   have ordered anything.
4. **They open a dish and tap the phonetic button.** It says the name.
5. **They tap Explain.** Then they type their own question and it answers.
6. **They tap "See it on your table" and point the phone down.** The plate appears on the
   table in front of them at the size it arrives.
7. **You switch to The restaurant.** The name writes itself in gold, the room opens, they
   walk through it.

Seven beats, about ninety seconds, and six of them happen on the judge's own phone rather
than your laptop. That is the whole pitch.

---

## Things I could not do, so you should

**A cooking video.** There is no free video of these dishes that I can legitimately give
you. The slot is built. Drop `app/videos/kg.mp4` beside the app and a Watch button appears
by itself on that dish. Twenty seconds filmed in any kitchen on any phone.

**Photos of the actual restaurant.** The four room photos are real Indian dining rooms, not
Karavalli, and the caption says so. Walk in one evening, take four photos, save them as
`app/photos/r1.jpg` through `r4.jpg`. They replace the borrowed ones automatically.

**Voice recordings of the dish names.** Right now the phonetic button uses the browser's
robot voice. Record the eight names on your phone's voice memo app, one take each, save
them as `app/audio/kg.m4a` and so on. The app plays the recording and only falls back to
the robot if the file is missing. Ten minutes of work, and it is the difference between
sounding like a product and sounding like a prototype.

**A true 3D copy of the room.** What I built is a model of a restaurant, not a scan of
theirs. Scan the real room with Polycam or Matterport on your phone. That is how hotels
make their virtual tours, and a judge will recognise it instantly.

---

## If something breaks on stage

- **Images missing.** You skipped Step 1. The app falls back to a clean text card with the
  dish name, so it looks deliberate rather than broken.
- **Explain does nothing.** No network. It falls back to the written explanation for that
  dish, which is a paragraph long and accurate. Keep talking.
- **Camera view black.** You are on http or a file. Use the deployed https link.
- **3D room blank.** It pulls the 3D engine from a CDN on first load only. Open the
  restaurant page once on the venue wifi before you go on, and it stays cached.

Every one of these degrades quietly instead of showing an error. That was deliberate.
