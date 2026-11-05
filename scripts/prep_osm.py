# v3: bangun ulang data 3D dari OpenStreetMap vektor (dibaca dengan OSMnx).
# Footprint bangunan, tinggi (building:levels bila ada), nama, guna, POI, halte/stasiun,
# lalu medan angin LBM dihitung ulang dengan footprint baru.
import os, json, math, base64, time
import numpy as np
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import Polygon, MultiPolygon, Point
from PIL import Image, ImageDraw

OSM = os.environ.get('BLOKM_OSM', 'build/osm/blokm.osm')
W = os.environ.get('BLOKM_BUILD', 'build/')
REG = json.load(open(os.path.dirname(OSM) + '/reg.json'))
rng = np.random.default_rng(7)
TW, TH, MPP, OX, OY = 1400, 717, 1.44, 515, 462

T = Transformer.from_crs(4326, 32748, always_xy=True)
c_, s_ = math.cos(math.radians(REG['th'])), math.sin(math.radians(REG['th']))
def ll2w(lon, lat):
    """lon/lat -> koordinat dunia dashboard (m; x timur, z selatan, asal MRT Blok M)."""
    e, n = T.transform(np.asarray(lon), np.asarray(lat)); e = e - REG['E0']; n = n - REG['N0']
    x = (e * c_ - n * s_) / (MPP * REG['s']) + OX + REG['dx']; y = OY + REG['dy'] - (e * s_ + n * c_) / (MPP * REG['s'])
    return (x - OX) * MPP, (y - OY) * MPP
X0, Z0, X1, Z1 = -OX * MPP, -OY * MPP, (TW - OX) * MPP, (TH - OY) * MPP
def in_ext(x, z, pad=0): return X0 + pad <= x <= X1 - pad and Z0 + pad <= z <= Z1 - pad

if not os.path.exists(W + 'data3d_raster.json'):
    import shutil; shutil.copy(W + 'data3d.json', W + 'data3d_raster.json')
old = json.load(open(W + 'data3d_raster.json'))   # versi raster (v2) sebagai sumber pohon & tinggi estimasi
d2 = json.load(open(W + 'data.json'))
GW, GH = d2['meta']['gw'], d2['meta']['gh']
lu = np.frombuffer(base64.b64decode(d2['grid']['lu']), np.uint8).reshape(GH, GW)
def lu_at(x, z):
    i, j = int((x / MPP + OX) / 4), int((z / MPP + OY) / 4)
    return int(lu[min(GH - 1, max(0, j)), min(GW - 1, max(0, i))])
# raster tinggi lama (estimasi tipologi v2) untuk bangunan tanpa tag lantai
him = Image.new('F', (TW, TH), 0.0); dr = ImageDraw.Draw(him); fim = Image.new('F', (TW, TH), 0.0); df = ImageDraw.Draw(fim)
for b in sorted(old['bld'], key=lambda b: b['h']):
    pts = [(b['p'][k] / MPP + OX, b['p'][k + 1] / MPP + OY) for k in range(0, len(b['p']), 2)]
    dr.polygon(pts, fill=float(b['h'])); df.polygon(pts, fill=float(b['f']))
HOLD = np.array(him); FOLD = np.array(fim)

# ---------------- bangunan ----------------
tags_b = {'building': True}
fb = ox.features_from_xml(OSM, tags=tags_b)
fb = fb[fb.geometry.type.isin(['Polygon', 'MultiPolygon'])]
COMM = {'commercial', 'retail', 'office', 'hotel', 'mall', 'supermarket', 'kiosk', 'shop', 'warehouse', 'industrial'}
RES = {'residential', 'house', 'apartments', 'detached', 'terrace', 'dormitory', 'semidetached_house', 'bungalow'}
PUB = {'school', 'university', 'college', 'government', 'public', 'civic', 'hospital', 'kindergarten', 'train_station', 'transportation', 'stadium', 'sports_centre'}
REL = {'mosque', 'church', 'religious', 'temple', 'chapel', 'cathedral'}
LM = [  # landmark terverifikasi (nama, x, z dunia dari titik thumb lama, lantai, tinggi, sumber)
    ('Menara Sentraya', 957, 489, 41, 172, 'detik.com 2014: 41 lantai'),
    ('Plaza Blok M', 452, 425, 7, 32, 'Kontan: tinggi tujuh lantai'),
    ('Blok M Square', 712, 452, 8, 36, 'mojok.co: masjid di lantai 7'),
    ('Menara Sekretariat ASEAN', 600, 38, 16, 70, 'Wikipedia/Setkab: 2 menara 16 lantai, ±70 m'),
    ('Pasaraya Blok M', 865, 455, 7, 32, 'estimasi tipologi (lantai tidak dipublikasi)'),
]
def g(r, k):
    v = r.get(k); return None if v is None or (isinstance(v, float) and math.isnan(v)) else v
def num(v):
    try: return float(str(v).split(';')[0].replace(',', '.').split()[0])
    except Exception: return None
def lantai_tip(a, use):
    if use == 3: return 1 if a < 120 else 2 if a < 600 else 3
    if use == 4: return 2 if a < 160 else 3 if a < 1200 else 4 if a < 3500 else 6
    if use == 5: return 2 if a < 400 else 3 if a < 2000 else 4
    return 2 if a < 500 else 3
bld = []; n_lv = n_old = n_tip = 0
for idx, r in fb.iterrows():
    geom = r.geometry
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    for poly in polys:
        poly = poly.simplify(0.0000035)
        xs, ys = poly.exterior.coords.xy
        X, Z = ll2w(np.array(xs), np.array(ys))
        cx, cz = float(np.mean(X[:-1])), float(np.mean(Z[:-1]))
        if not in_ext(cx, cz, 4): continue
        pw = Polygon(list(zip(X, Z)))
        a = pw.area
        if a < 12: continue
        bt = str(g(r, 'building') or 'yes'); am = str(g(r, 'amenity') or ''); name = g(r, 'name') or ''
        if bt in COMM or g(r, 'shop') or am in ('bank', 'restaurant', 'cafe', 'marketplace', 'fast_food'): use = 4
        elif bt in RES: use = 3
        elif bt in PUB or am in ('school', 'university', 'college', 'hospital', 'clinic', 'townhall', 'police', 'library'): use = 5
        elif bt in REL or am == 'place_of_worship': use = 8
        else:
            use = lu_at(cx, cz); use = use if use in (3, 4, 5, 8) else 3 if use in (0, 1, 2) else 8
        lv = num(g(r, 'building:levels')); hh = num(g(r, 'height'))
        src = ''
        if lv and lv >= 1:
            fl = int(round(lv)); h = hh or fl * (3.4 if use == 3 else 4.0) + .6; src = f'OSM building:levels = {fl}'; n_lv += 1
        else:
            i, j = int(min(TW - 1, max(0, cx / MPP + OX))), int(min(TH - 1, max(0, cz / MPP + OY)))
            if HOLD[j, i] > 0 and a > 60:
                h = float(HOLD[j, i]); fl = max(1, int(round(FOLD[j, i]))); n_old += 1
            else:
                fl = lantai_tip(a, use); h = fl * (3.4 if use == 3 else 4.0) + rng.random() * .6; n_tip += 1
            src = 'estimasi tipologi (KLB/KDB audit TOD)'
        coords = [round(float(v), 1) for p in zip(X[:-1], Z[:-1]) for v in p]
        bld.append(dict(p=coords, h=round(h, 1), f=fl, u=use, a=round(a), c=[round(cx, 1), round(cz, 1)], n=str(name)[:60], s=src, lm=0, osm=f'{idx[0]}/{idx[1]}'))
# landmark terverifikasi: bangunan terbesar yang memuat / dekat titik
for nm, tx, ty, fl, h, src in LM:
    x, z = (tx - OX) * MPP, (ty - OY) * MPP; pt = Point(x, z)
    cand = [b for b in bld if math.hypot(b['c'][0] - x, b['c'][1] - z) < 90]
    inside = [b for b in cand if Polygon(list(zip(b['p'][0::2], b['p'][1::2]))).buffer(4).contains(pt)]
    pick = max(inside or cand, key=lambda b: b['a']) if (inside or cand) else None
    if not pick: print('landmark tak ketemu', nm); continue
    if pick['s'].startswith('OSM') and src.startswith('estimasi'): pass          # OSM lebih baik dari estimasi
    else:
        catat = f" (OSM: {pick['f']} lantai)" if pick['s'].startswith('OSM') and pick['f'] != fl else ''
        pick.update(f=fl, h=h, s=src + catat)
    pick['n'] = pick['n'] or nm; pick['lm'] = 1; pick['lmn'] = nm
# landmark tambahan: bangunan bernama yang tinggi atau besar
for b in bld:
    if b['n'] and not b['lm'] and b['f'] >= 15 and not b['n'].startswith('Stasiun'): b['lm'] = 1
print('bangunan', len(bld), '| tag lantai OSM', n_lv, '| tinggi v2', n_old, '| tipologi', n_tip, '| bernama', sum(1 for b in bld if b['n']), '| label', sum(b['lm'] for b in bld))

# ---------------- POI ----------------
fp = ox.features_from_xml(OSM, tags={'amenity': True, 'shop': True, 'tourism': ['hotel', 'guest_house', 'hostel'], 'office': True})
KATS = ['kuliner', 'belanja', 'akomodasi', 'jasa', 'kesehatan', 'ibadah']
def kat(r):
    am = str(g(r, 'amenity') or ''); tu = str(g(r, 'tourism') or '')
    if am in ('restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub', 'ice_cream'): return 0
    if g(r, 'shop') or am == 'marketplace': return 1
    if tu: return 2
    if am in ('hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'): return 4
    if am == 'place_of_worship': return 5
    if am in ('bank', 'atm', 'post_office', 'bureau_de_change', 'money_transfer', 'coworking_space', 'townhall', 'police', 'courthouse', 'library', 'community_centre', 'arts_centre', 'cinema', 'theatre', 'school', 'university', 'college', 'kindergarten') or g(r, 'office'): return 3
    return None
pois = []; names = []
for idx, r in fp.iterrows():
    k = kat(r)
    if k is None: continue
    c = r.geometry.centroid; x, z = ll2w(c.x, c.y); x, z = float(x), float(z)
    if not in_ext(x, z): continue
    pois.append([round(x, 1), round(z, 1), k]); names.append(str(g(r, 'name') or ''))
from collections import Counter
print('POI OSM', len(pois), {KATS[k]: v for k, v in Counter(p[2] for p in pois).items()})

# ---------------- transit ----------------
ft = ox.features_from_xml(OSM, tags={'public_transport': True, 'highway': 'bus_stop', 'railway': 'station'})
UTAMA = {'Blok M BCA': ('MRT Blok M BCA', 'MRT'), 'ASEAN Headquarters': ('MRT ASEAN', 'MRT'), 'Terminal Bus Kota Blok M': ('Terminal Bus Blok M', 'Bus/TransJakarta'),
         'CSW 2': ('Halte TJ CSW', 'TransJakarta'), 'Kejaksaan Agung': ('Halte TJ Kejaksaan Agung', 'TransJakarta'), 'Blok M': ('Halte TJ Blok M', 'TransJakarta'), 'Masjid Agung': ('Halte TJ Masjid Agung', 'TransJakarta')}
transit = []; seen = set()
for idx, r in ft.iterrows():
    nm = str(g(r, 'name') or ''); c = r.geometry.centroid; x, z = ll2w(c.x, c.y); x, z = float(x), float(z)
    if not in_ext(x, z): continue
    if nm in UTAMA and UTAMA[nm][0] not in seen and (g(r, 'railway') == 'station' or g(r, 'public_transport') in ('station', 'platform', 'stop_position')):
        if nm in ('Blok M BCA', 'ASEAN Headquarters') and g(r, 'railway') != 'station': continue
        seen.add(UTAMA[nm][0]); transit.append(dict(id=f'osm{idx[1]}', nama=UTAMA[nm][0], jenis=UTAMA[nm][1], m=[round(x, 1), round(z, 1)]))
    elif g(r, 'highway') == 'bus_stop' or g(r, 'public_transport') == 'platform':
        key = (round(x / 25), round(z / 25))
        if key in seen: continue
        seen.add(key); transit.append(dict(id=f'osm{idx[1]}', nama=nm or 'Halte bus', jenis='Bus', m=[round(x, 1), round(z, 1)], kecil=1))
print('transit', len(transit), [t['nama'] for t in transit if not t.get('kecil')])

# ---------------- medan angin LBM dengan footprint OSM ----------------
CS = 6.0; NXc, NYc = old['wind']['nx'], old['wind']['ny']
sim = Image.new('L', (NXc * 4, NYc * 4), 0); ds = ImageDraw.Draw(sim)
for b in bld:
    ds.polygon([((b['p'][k] - X0) / CS * 4, (b['p'][k + 1] - Z0) / CS * 4) for k in range(0, len(b['p']), 2)], fill=255)
solid = np.array(sim.resize((NXc, NYc), Image.BOX)) > 110
print('grid angin', NXc, NYc, 'padat', round(solid.mean() * 100, 1), '%')
EX = np.array([0, 1, 0, -1, 0, 1, -1, -1, 1]); EY = np.array([0, 0, 1, 0, -1, 1, 1, -1, -1])
WT = np.array([4 / 9] + [1 / 9] * 4 + [1 / 36] * 4); OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6]
def feq(rho, ux, uy):
    cu = 3 * (EX[:, None, None] * ux + EY[:, None, None] * uy)
    return WT[:, None, None] * rho * (1 + cu + .5 * cu * cu - 1.5 * (ux * ux + uy * uy))
def lbm(ang_from, steps=2600, U0=.08, tau=.56):
    th = math.radians(ang_from); ux0, uy0 = -math.sin(th) * U0, math.cos(th) * U0
    ny, nx = solid.shape
    f = feq(np.ones((ny, nx)), np.full((ny, nx), ux0), np.full((ny, nx), uy0)); fin = f.copy()
    bnd = np.zeros((ny, nx), bool); bnd[:2] = bnd[-2:] = True; bnd[:, :2] = bnd[:, -2:] = True
    om = 1 / tau
    for s in range(steps):
        rho = f.sum(0); ux = (f * EX[:, None, None]).sum(0) / rho; uy = (f * EY[:, None, None]).sum(0) / rho
        ux[solid] = 0; uy[solid] = 0
        f += om * (feq(rho, ux, uy) - f); f[:, bnd] = fin[:, bnd]
        for k in range(9): f[k] = np.roll(np.roll(f[k], EX[k], axis=1), EY[k], axis=0)
        fs = f[:, solid]; f[:, solid] = fs[OPP]
    rho = f.sum(0); ux = (f * EX[:, None, None]).sum(0) / rho; uy = (f * EY[:, None, None]).sum(0) / rho
    ux[solid] = 0; uy[solid] = 0
    return ux / U0, uy / U0
wind = {}
if os.environ.get('BLOKM_SKIP_LBM'):
    wind = old['wind']['dirs']
else:
    for nm, ang in [('B', 270), ('BL', 315), ('T', 90), ('TG', 135), ('U', 0)]:
        t0 = time.time(); ux, uy = lbm(ang); k = np.hypot(ux, uy)
        print('angin', nm, round(float(k[~solid].mean()), 2), round(time.time() - t0), 's')
        q = lambda a: base64.b64encode(np.clip(np.round(a * 60), -127, 127).astype(np.int8).tobytes()).decode()
        wind[nm] = dict(u=q(ux), v=q(uy))

out = dict(old)
out.update(bld=bld, poi=pois, poi_nama=names, poi_cat=KATS, transit=transit,
           wind=dict(nx=NXc, ny=NYc, cs=CS, scale=60, dirs=wind, solid=base64.b64encode(np.packbits(solid.ravel())).decode()),
           osm=dict(n_bld=len(bld), n_levels=n_lv, n_named=sum(1 for b in bld if b['n']), n_poi=len(pois), tanggal='2026-11-03', reg=REG))
bim = Image.new('L', (TW, TH), 0); db = ImageDraw.Draw(bim)
for b in bld: db.polygon([(b['p'][k] / MPP + OX, b['p'][k + 1] / MPP + OY) for k in range(0, len(b['p']), 2)], fill=1)
bim = np.array(bim)
out['trees'] = [t for t in old['trees'] if not bim[int(min(TH - 1, max(0, t[1] / MPP + OY))), int(min(TW - 1, max(0, t[0] / MPP + OX)))]]
print('pohon', len(old['trees']), '->', len(out['trees']))
json.dump(out, open(W + 'data3d.json', 'w'), separators=(',', ':'))
print('data3d.json', round(os.path.getsize(W + 'data3d.json') / 1e6, 2), 'MB')
