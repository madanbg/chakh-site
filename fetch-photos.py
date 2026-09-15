#!/usr/bin/env python3
"""
Download every dish photo so the app stops depending on the internet.

    python3 fetch-photos.py

Writes into app/photos/. Once they are there the app loads them first and
never touches Wikimedia again, which is what you want on a stage with bad wifi.
"""
import os, urllib.request, hashlib, urllib.parse

FILES = {
 'kg':  'Neer_dosa_with_kundapur_style_kori(country_chicken)_gassy(curry).jpg',
 'mfm': 'Mangalore_Fish_Meal.jpg',
 'pd':  'Pundi_-_The_Rice_Dumpling_Food_Item_from_Tulunadu,_India..jpg',
 'gk':  'Gobi_manchurian.jpg',
 'av':  'Aviyal.JPG',
 'amc': 'Meen_curry_2_(cropped).JPG',
 'bu':  'Traditional_Beef_Ularthiyathu.JPG',
 'bb':  'Bebinca_com_gelado.jpg',
 # the four ambience shots on the restaurant page
 'r1':  'Tvdnindiancoffeehouse_(89).JPG',
 'r2':  'Kolkata_40,_Indian_Coffee_House_-_interior_(24793742026).jpg',
 'r3':  'Indian_restaurant_in_Long_Crendon_(geograph_4872364).jpg',
 'r4':  'Comida_en_un_Restaurante_en_Bangalore,_India.jpg',
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app', 'photos')
os.makedirs(OUT, exist_ok=True)

# Wikimedia asks automated downloads to identify themselves. Put your own
# contact in here before running it a lot.
UA = 'chakh-demo/1.0 (student project; hello@chakh.in)'

ok = bad = 0
for key, name in FILES.items():
    h = hashlib.md5(name.encode('utf-8')).hexdigest()
    url = 'https://upload.wikimedia.org/wikipedia/commons/%s/%s/%s' % (
        h[0], h[0:2], urllib.parse.quote(name))
    dest = os.path.join(OUT, key + '.jpg')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r, open(dest, 'wb') as f:
            f.write(r.read())
        kb = os.path.getsize(dest) / 1024
        print('  saved  %-4s %7.0f KB  %s' % (key, kb, name))
        ok += 1
    except Exception as e:
        print('  FAILED %-4s %s  (%s)' % (key, name, e))
        bad += 1

print('\n  %d saved, %d failed, into %s' % (ok, bad, OUT))
if ok:
    print('  The credits still have to stay visible. CC BY-SA requires it.')
    print('  Open app/index.html again and the photos come from your disk now.')
