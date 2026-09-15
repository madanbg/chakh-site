#!/usr/bin/env python3
"""
Make a real, scannable QR code and a printable table card.

    pip install qrcode pillow
    python make-qr.py https://your-domain.example/app/?scan=1 "Table 7"

Outputs into this folder:
    qr.svg              vector QR, drop into slides or the website
    table-card.png      A6 at 300dpi, print it, stand it on the table

Why the old one didn't scan: it was a drawing of a QR code, not an encoded one.
This one is encoded properly, with the 4-module quiet zone scanners need, and
dark modules on a light background (never the other way round — half the
scanners on the market fail on inverted codes).
"""
import sys, os, re, ipaddress
from urllib.parse import urlparse
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont

ARGS = [arg for arg in sys.argv[1:] if arg != "--local"]
LOCAL_TEST = "--local" in sys.argv[1:]
if not ARGS:
    raise SystemExit("Usage: python make-qr.py https://your-live-domain/app/?scan=1 \"Table 7\"")

URL   = ARGS[0].strip()
TABLE = ARGS[1].strip() if len(ARGS) > 1 else "Table 7"
HERE  = os.path.dirname(os.path.abspath(__file__))

parsed = urlparse(URL)
if not parsed.netloc:
    raise SystemExit("Use a complete URL with a host name.")
if parsed.scheme != "https":
    try:
        is_private_ip = ipaddress.ip_address(parsed.hostname or "").is_private
    except ValueError:
        is_private_ip = False
    if not (LOCAL_TEST and parsed.scheme == "http" and is_private_ip):
        raise SystemExit("Use the final public HTTPS URL. For same-Wi-Fi testing only, add --local to a private IPv4 URL.")
if "/app" not in parsed.path:
    raise SystemExit("The QR must point to the menu page, e.g. https://your-domain.example/app/?scan=1")

INK   = (21, 15, 12)       # #150F0C
CREAM = (244, 233, 216)    # #F4E9D8
BRASS = (224, 163, 63)     # #E0A33F
CHILLI= (196, 59, 34)      # #C43B22
MUTED = (138, 116, 98)

# ERROR_CORRECT_H tolerates ~30% damage, so it still scans off a projector,
# through a phone camera, at an angle, in a dim restaurant.
qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=10, border=4)
qr.add_data(URL)
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)

# ---------- qr.svg ----------
BOX = 10
size = n * BOX
rects = "".join(
    f'<rect x="{x*BOX}" y="{y*BOX}" width="{BOX}" height="{BOX}"/>'
    for y, row in enumerate(m) for x, cell in enumerate(row) if cell
)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
       f'width="{size}" height="{size}" shape-rendering="crispEdges" '
       f'role="img" aria-label="QR code linking to {URL}">'
       f'<rect width="{size}" height="{size}" fill="#F4E9D8"/>'
       f'<g fill="#150F0C">{rects}</g></svg>')
with open(os.path.join(HERE, "qr.svg"), "w", encoding="utf-8") as f:
    f.write(svg)

# ---------- table-card.png : A6 (105 x 148 mm) at 300dpi ----------
W, H = 1240, 1748
card = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(card)

def font(path, sz):
    try:
        return ImageFont.truetype(path, sz)
    except OSError:
        return ImageFont.load_default()

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIFB= "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS  = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def centre(text, y, f, fill):
    w = d.textbbox((0, 0), text, font=f)[2]
    d.text(((W - w) / 2, y), text, font=f, fill=fill)

# logo mark
cx, top = W // 2, 150
d.rounded_rectangle([cx-62, top, cx+62, top+124], radius=34, outline=BRASS, width=13)
d.ellipse([cx-24, top+38, cx+24, top+86], fill=CHILLI)
centre("chakh", top + 160, font(SERIFB, 76), CREAM)

centre("SCAN FOR THE MENU", 462, font(SANS, 36), BRASS)

# QR, on a cream plate with generous quiet zone
qs = 700
qimg = qr.make_image(fill_color=INK, back_color=CREAM).convert("RGB").resize((qs, qs), Image.NEAREST)
plate_pad = 48
d.rounded_rectangle([cx-qs//2-plate_pad, 590-plate_pad, cx+qs//2+plate_pad, 590+qs+plate_pad],
                    radius=44, fill=CREAM)
card.paste(qimg, (cx - qs // 2, 590))

centre("Every dish, explained.", 590 + qs + 130, font(SERIF, 50), CREAM)
centre("No app. Works in your camera.", 590 + qs + 205, font(SANS, 32), MUTED)
centre(TABLE.upper(), H - 150, font(SANS, 34), BRASS)

card.save(os.path.join(HERE, "table-card.png"), "PNG", optimize=True, dpi=(300, 300))

# A standalone PNG is convenient for WhatsApp, a printer, and phones that do
# not render SVG previews. It contains the same QR modules as the table card.
qimg.save(os.path.join(HERE, "qr.png"), "PNG", optimize=True, dpi=(300, 300))

print(f"encoded : {URL}")
print(f"version : {qr.version}  ({n}x{n} modules, error correction H)")
print("wrote   : qr.svg, qr.png, table-card.png")
print("test it by scanning table-card.png off your own screen before you print it.")
if LOCAL_TEST:
    print("LOCAL TEST ONLY: this QR works only while this computer is running and the phone uses the same Wi-Fi.")

# ---------- keep the in-app scan screen in sync ----------
app = os.path.join(HERE, "app", "index.html")
with open(app, encoding="utf-8") as f:
    html = f.read()

# JSON escaping makes the SVG safe inside JavaScript regardless of quotation.
import json
replacement = "const QR_SVG=" + json.dumps(svg, ensure_ascii=False) + ";"
patched, substitutions = re.subn(r"const QR_SVG=.*?;", replacement, html, count=1, flags=re.S)
if substitutions != 1:
    raise SystemExit("Could not find QR_SVG in app/index.html; no page was changed.")
with open(app, "w", encoding="utf-8", newline="") as f:
    f.write(patched)
print("patched : app/index.html scan screen now points at", URL)
