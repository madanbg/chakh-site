#!/usr/bin/env python3
"""Pre-deploy check: broken internal links, missing alt text, page weight.
Run it before every deploy:  python3 check.py"""
import re, os, glob, sys

pages = sorted(glob.glob('*.html') + glob.glob('demo/*.html'))
bad, noalt = [], []

def resolve(href):
    t = href.split('#')[0].split('?')[0]
    if not t: return None
    p = t.lstrip('/') or 'index.html'
    return p + 'index.html' if p.endswith('/') else p

for page in pages:
    html = open(page).read()
    for href in re.findall(r'(?:href|src)="([^"]+)"', html):
        if href.startswith(('http', 'mailto:', 'data:', '#')): continue
        target = resolve(href)
        if target and not os.path.exists(target): bad.append((page, href))
    for tag in re.findall(r'<img\b[^>]*>', html):
        if 'alt=' not in tag: noalt.append((page, tag[:60]))
    for tag in re.findall(r'<svg\b[^>]*>', html):
        if not any(k in tag for k in ('aria-label', 'aria-hidden', 'role="img"')):
            noalt.append((page, tag[:60]))

print(f"{len(pages)} pages")
print(f"broken internal links : {len(bad)}")
for b in bad: print("   ", *b)
print(f"missing alt text      : {len(noalt)}")
for m in noalt: print("   ", *m)

print("\npage weight (uncompressed, gzip roughly a third of this):")
for f in pages + ['style.css', 'og.png', 'favicon.svg', 'apple-touch-icon.png']:
    if os.path.exists(f):
        kb = os.path.getsize(f) / 1024
        flag = "  <-- over 200KB, look at this" if kb > 200 else ""
        print(f"   {f:<22} {kb:7.1f} KB{flag}")

sys.exit(1 if (bad or noalt) else 0)
