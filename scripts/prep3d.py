# Persiapan data 3D Blok M: bangunan, pohon, POI sosial, medan angin LBM, tekstur dasar
import os, json, base64, math, time
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from skimage import measure

Image.MAX_IMAGE_PIXELS = None
os.makedirs('build', exist_ok=True)
SRC = '../Map/'
OUT = 'build/'
W2 = 'build/'
rng = np.random.default_rng(11)

full = np.array(Image.open(SRC + 'osm.png').convert('RGB')).astype(int)
FH, FW = full.shape[:2]
MPP_T = 1.44                        # m per px thumb (1400)
SF = 1400 / FW                      # full -> thumb
MPF = MPP_T * SF                    # m per px full (~0.722)
OX_T, OY_T = 515, 462               # MRT Blok M (thumb) = origin
def t2m(x, y): return ((x - OX_T) * MPP_T, (y - OY_T) * MPP_T)
def f2m(x, y): return t2m(x * SF, y * SF)
R, G, B = full[..., 0], full[..., 1], full[..., 2]
mx = full.max(-1); mn = full.min(-1); sat = mx - mn
def near(hexs, tol):
    m = np.zeros(R.shape, bool)
    for h in hexs:
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        m |= (abs(R - r) <= tol) & (abs(G - g) <= tol) & (abs(B - b) <= tol)
    return m

# ---------------- guna lahan (sama dengan dashboard 2D) ----------------
road = ((mn >= 244) & (sat <= 8)) | near(['#fcd6a4', '#f7fabf', '#f8f8f8'], 9)
bfill = near(['#d9d0c9'], 7)
bline = near(['#c4b6ab', '#cbbfb5', '#d0c4bc', '#d4ccc4'], 7)
green = ((G - R) > 10) & ((G - B) > 5) & (G > 170)
water = near(['#aad3df'], 10)
resid = near(['#e0dfdf', '#e2dcdc', '#dfdcdc'], 5)
comm = near(['#f2dad9', '#ffd6d1', '#f2e0dc', '#f0dcd8'], 7)
edu = near(['#ffffe5'], 6)
other = near(['#eeeeee', '#e8e8e8', '#d0d0d0', '#e9e9e9'], 3) & ~road
cls = np.zeros(R.shape, np.uint8)
for k, m in [(1, road), (2, bfill | bline), (7, water), (6, green), (4, comm), (5, edu), (3, resid), (8, other)]:
    cls[m & (cls == 0)] = k
known = np.isin(cls, [3, 4, 5, 6, 8])
_, li = ndi.distance_transform_edt(~known, return_indices=True)
lu = cls[li[0], li[1]]

# ---------------- tekstur dasar minimal ----------------
tex = np.zeros((FH, FW, 3), np.uint8); tex[:] = (236, 233, 228)
tex[np.isin(lu, [3])] = (233, 230, 225)
tex[np.isin(lu, [4])] = (238, 230, 226)
tex[np.isin(lu, [5])] = (236, 234, 220)
park = ndi.binary_opening(cls == 6, iterations=1)
tex[park] = (205, 225, 196)
tex[cls == 7] = (190, 216, 226)
rd = ndi.binary_closing(road, iterations=1)
tex[rd] = (252, 251, 249)
# garis tepi jalan halus
edge = rd ^ ndi.binary_erosion(rd, iterations=1)
tex[edge] = (226, 222, 216)
Image.fromarray(tex).save(OUT + 'dasar.webp', quality=85)
# peta OSM berwarna lembut + komposit satelit
Image.open('2d/peta.webp').save(OUT + 'peta.webp', quality=82)
osm_rgb = Image.open(SRC + 'osm.png').convert('RGB')
ge = Image.open(SRC + 'Google Earth.jpg').convert('RGB')
SB = [437, 285, 628, 331]   # kotak satelit di koordinat thumb
gw, gh = round(SB[2] / SF), round(SB[3] / SF)
comp = Image.fromarray((np.array(osm_rgb).astype(float) * .55 + 255 * .45).astype(np.uint8))
comp.paste(ge.resize((gw, gh), Image.LANCZOS), (round(SB[0] / SF), round(SB[1] / SF)))
comp.save(OUT + 'satelit.webp', quality=80)

# ---------------- bangunan ----------------
bm = ndi.binary_fill_holes(bfill)
bm = ndi.binary_opening(bm, iterations=1)
lab, nb = ndi.label(bm)
objs = ndi.find_objects(lab)
areas = ndi.sum(np.ones_like(lab), lab, range(1, nb + 1))
LM = [  # landmark: nama, x,y thumb, lantai, tinggi m, sumber
    ('Menara Sentraya', 957, 489, 41, 172, 'detik.com 2014: 41 lantai'),
    ('Plaza Blok M', 452, 425, 7, 32, 'Kontan: tinggi tujuh lantai'),
    ('Blok M Square', 712, 452, 8, 36, 'mojok.co: masjid di lantai 7'),
    ('Menara Sekretariat ASEAN', 600, 38, 16, 70, 'Wikipedia/Setkab: 2 menara 16 lantai, ~70 m'),
    ('Pasaraya Blok M', 865, 455, 7, 32, 'estimasi tipologi (lantai tidak dipublikasi)'),
]
lm_id = {}
for name, x, y, fl, h, src in LM:
    fx, fy = int(x / SF), int(y / SF)
    win = lab[max(0, fy - 40):fy + 40, max(0, fx - 40):fx + 40]
    ids, cnt = np.unique(win[win > 0], return_counts=True)
    if len(ids) == 0: continue
    # pilih komponen terbesar di sekitar titik
    best = max(ids, key=lambda i: areas[i - 1])
    lm_id[best] = (name, fl, h, src)

# kalibrasi tinggi: rasio KLB/KDB audit TOD (Gifarry dkk. 2022)
#   hunian: KLB 0,4–0,93 / KDB 40–50%  -> rata-rata ±1,6 lantai
#   nonhunian: KLB 1,16–1,82 / KDB 42–52% -> rata-rata ±3,1 lantai
def lantai(a_m2, use):
    if use == 3:   # hunian
        base = 1 if a_m2 < 220 else 2 if a_m2 < 1500 else 3
        return max(1, base + (1 if rng.random() < .06 else 0))
    if use == 4:   # komersial
        base = 2 if a_m2 < 160 else 3 if a_m2 < 1200 else 4 if a_m2 < 3500 else 6
        return max(1, base + int(rng.integers(-1, 2)))
    if use == 5: return 2 if a_m2 < 400 else 3 if a_m2 < 2000 else 4
    return 2 if a_m2 < 500 else 3 if a_m2 < 3000 else 5

bld = []; fl_stat = {3: [], 4: []}
for i, sl in enumerate(objs, start=1):
    if sl is None: continue
    a_m2 = areas[i - 1] * MPF * MPF
    if a_m2 < 14: continue
    sub = (lab[sl] == i)
    pad = np.pad(sub, 1)
    cs = measure.find_contours(pad.astype(float), .5)
    if not cs: continue
    c = max(cs, key=len)
    c = measure.approximate_polygon(c, tolerance=1.1 if a_m2 < 2000 else 1.8)
    if len(c) < 4: continue
    ys = c[:, 0] - 1 + sl[0].start; xs = c[:, 1] - 1 + sl[1].start
    cy, cx = ndi.center_of_mass(sub); cy += sl[0].start; cx += sl[1].start
    use = int(np.bincount(lu[sl][sub].ravel(), minlength=9)[[3, 4, 5, 6, 8]].argmax()); use = [3, 4, 5, 6, 8][use]
    if i in lm_id:
        name, fl, h, src = lm_id[i]
    else:
        name, src = '', 'estimasi tipologi, dikalibrasi KLB/KDB'
        fl = lantai(a_m2, use); h = fl * (3.4 if use == 3 else 4.0) + rng.random() * .6
        if use in fl_stat: fl_stat[use].append((fl, a_m2))
    pts = [f2m(x, y) for x, y in zip(xs, ys)][:-1]
    px, pz = f2m(cx, cy)
    bld.append(dict(p=[round(v, 1) for xy in pts for v in xy], h=round(h, 1), f=fl, u=use, a=round(a_m2), c=[round(px, 1), round(pz, 1)], n=name, s=src if name else ''))
for u in fl_stat:
    a = np.array(fl_stat[u]); print('rata-rata lantai (berbobot luas) guna', u, round(float((a[:, 0] * a[:, 1]).sum() / a[:, 1].sum()), 2), 'n', len(a))
print('bangunan', len(bld), 'landmark', [b['n'] for b in bld if b['n']])

# ---------------- pohon dari indeks kehijauan satelit + taman OSM ----------------
gea = np.array(ge.resize((round(SB[2] / SF * .5), round(SB[3] / SF * .5)), Image.BOX)).astype(float)  # ~1.44 m/px
exg = (2 * gea[..., 1] - gea[..., 0] - gea[..., 2]) / (gea.sum(-1) + 1)
veg = ndi.gaussian_filter(exg, 1.2) > 0.075
trees = []
step = 4  # ~5,8 m
for yy in range(0, veg.shape[0], step):
    for xx in range(0, veg.shape[1], step):
        if veg[yy, xx] and rng.random() < .85:
            tx = SB[0] + (xx + rng.random() * step) * (SB[2] / veg.shape[1]); ty = SB[1] + (yy + rng.random() * step) * (SB[3] / veg.shape[0])
            fx, fy = int(tx / SF), int(ty / SF)
            if 0 <= fy < FH and 0 <= fx < FW and not bm[fy, fx]:
                x, z = t2m(tx, ty); trees.append([round(x, 1), round(z, 1), round(3 + rng.random() * 4, 1)])
# luar cakupan satelit: taman OSM
pk = ndi.binary_erosion(cls == 6, iterations=3)
ys, xs = np.nonzero(pk[::9, ::9]);
for y, x in zip(ys * 9, xs * 9):
    tx, ty = x * SF, y * SF
    if SB[0] <= tx <= SB[0] + SB[2] and SB[1] <= ty <= SB[1] + SB[3]: continue
    if rng.random() < .55:
        xx_, zz_ = f2m(x + rng.random() * 6, y + rng.random() * 6); trees.append([round(xx_, 1), round(zz_, 1), round(3 + rng.random() * 4, 1)])
print('pohon', len(trees))

# ---------------- POI dari ikon OSM ----------------
POI_COL = {
    'kuliner': (['#c77400'], 18), 'belanja': (['#ac39ac'], 18), 'akomodasi': (['#0092da'], 16),
    'jasa': (['#734a08'], 16), 'kesehatan': (['#bf0000'], 16), 'ibadah': (['#000000'], 6),
}
pois = []
for cat, (hx, tol) in POI_COL.items():
    m = near(hx, tol)
    if cat == 'ibadah': m &= ~(lab > 0)  # hindari teks gelap? (ikon masjid ada di dalam bangunan)
    md = ndi.binary_dilation(m, iterations=2)
    L, n = ndi.label(md)
    for sl in ndi.find_objects(L):
        h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if not (4 <= h_ <= 26 and 4 <= w_ <= 26): continue
        if max(h_, w_) / min(h_, w_) > 1.7: continue
        core = m[sl].sum()
        if core < 6: continue
        cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
        x, z = f2m(cx, cy); pois.append([round(x, 1), round(z, 1), list(POI_COL).index(cat)])
from collections import Counter
print('POI', len(pois), Counter(p[2] for p in pois))

# ---------------- medan angin: LBM D2Q9 ----------------
CS = 6.0  # m per sel
NXc, NYc = int(FW * MPF / CS), int(FH * MPF / CS)
solid = np.array(Image.fromarray((bm * 255).astype(np.uint8)).resize((NXc, NYc), Image.BOX)) > 110
print('grid angin', NXc, NYc, 'padat', round(solid.mean() * 100, 1), '%')
EX = np.array([0, 1, 0, -1, 0, 1, -1, -1, 1]); EY = np.array([0, 0, 1, 0, -1, 1, 1, -1, -1])
WT = np.array([4 / 9] + [1 / 9] * 4 + [1 / 36] * 4); OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6]
def feq(rho, ux, uy):
    cu = 3 * (EX[:, None, None] * ux + EY[:, None, None] * uy)
    return WT[:, None, None] * rho * (1 + cu + .5 * cu * cu - 1.5 * (ux * ux + uy * uy))
def lbm(ang_from, steps=2600, U0=.08, tau=.56):
    # arah angin "dari" (derajat kompas) -> vektor tujuan di grid (x timur, y selatan)
    th = math.radians(ang_from)
    ux0, uy0 = -math.sin(th) * U0, math.cos(th) * U0   # dari utara (0°) -> bergerak ke selatan (+y)
    ny, nx = solid.shape
    rho = np.ones((ny, nx)); ux = np.full((ny, nx), ux0); uy = np.full((ny, nx), uy0)
    f = feq(rho, ux, uy); fin = feq(np.ones((ny, nx)), np.full((ny, nx), ux0), np.full((ny, nx), uy0))
    bnd = np.zeros((ny, nx), bool); bnd[:2] = bnd[-2:] = True; bnd[:, :2] = bnd[:, -2:] = True
    om = 1 / tau
    for s in range(steps):
        rho = f.sum(0); ux = (f * EX[:, None, None]).sum(0) / rho; uy = (f * EY[:, None, None]).sum(0) / rho
        ux[solid] = 0; uy[solid] = 0
        f += om * (feq(rho, ux, uy) - f)
        f[:, bnd] = fin[:, bnd]
        for k in range(9): f[k] = np.roll(np.roll(f[k], EX[k], axis=1), EY[k], axis=0)
        # bounce-back
        fs = f[:, solid]; f[:, solid] = fs[OPP]
    rho = f.sum(0); ux = (f * EX[:, None, None]).sum(0) / rho; uy = (f * EY[:, None, None]).sum(0) / rho
    ux[solid] = 0; uy[solid] = 0
    return ux / U0, uy / U0   # rasio terhadap kecepatan bebas
wind = {}
for nm, ang in [('B', 270), ('BL', 315), ('T', 90), ('TG', 135), ('U', 0)]:
    t0 = time.time(); ux, uy = lbm(ang)
    k = np.hypot(ux, uy)
    print('angin', nm, 'rasio rata2 (luar bangunan)', round(float(k[~solid].mean()), 2), 'maks', round(float(k.max()), 2), round(time.time() - t0, 1), 's')
    q = lambda a: base64.b64encode(np.clip(np.round(a * 60), -127, 127).astype(np.int8).tobytes()).decode()
    wind[nm] = dict(u=q(ux), v=q(uy))

# ---------------- grid analisis dari dashboard 2D ----------------
d2 = json.load(open(W2 + 'data.json'))
out = dict(
    meta=dict(mpp=MPP_T, origin=[OX_T, OY_T], extent=[round(-OX_T * MPP_T, 1), round(-OY_T * MPP_T, 1), round((1400 - OX_T) * MPP_T, 1), round((717 - OY_T) * MPP_T, 1)],
              lat=-6.2443, lon=106.7984, sat_box=SB),
    bld=bld, trees=trees, poi=pois, poi_cat=list(POI_COL),
    wind=dict(nx=NXc, ny=NYc, cs=CS, scale=60, dirs=wind, solid=base64.b64encode(np.packbits(solid.ravel())).decode()),
    grid=d2['grid'], gmeta=dict(gw=d2['meta']['gw'], gh=d2['meta']['gh']),
    transit=[dict(t, m=[round(v, 1) for v in t2m(t['x'], t['y'])]) for t in d2['transit']],
    paths=[dict(s=p['s'], p=[[round(v, 1) for v in t2m(a, b)] for a, b in p['p']]) for p in d2['paths']],
    stat2d=d2['stat'],
)
json.dump(out, open(W2 + 'data3d.json', 'w'), separators=(',', ':'))
print('data3d.json', round(len(json.dumps(out, separators=(',', ':'))) / 1e6, 2), 'MB')
