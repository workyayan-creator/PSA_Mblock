# Analisis tambahan v2 untuk kawasan inti Blok M:
# batas kawasan, kebisingan (estimasi), sky view factor, fasilitas 10 menit, akses RTH 300 m,
# potensi PLTS atap, selubung intensitas (KLB) per blok.
import os, json, math, heapq, base64
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure
from skimage.morphology import closing, disk, dilation, remove_small_objects

Image.MAX_IMAGE_PIXELS = None
SRC = os.environ.get('BLOKM_MAP', '../Map/')
BUILD = os.environ.get('BLOKM_BUILD', 'build/')
d3 = json.load(open(BUILD + 'data3d.json'))
d2 = json.load(open(BUILD + 'data.json'))

TW, TH, MPP = 1400, 717, 1.44
OX, OY = 515, 462
G = 4                                   # grid analisis: 4 px thumb = 5,76 m (sama dgn grid 2D)
GW, GH = d2['meta']['gw'], d2['meta']['gh']
CM = G * MPP                            # m per sel
def cell_xy(i, j): return ((i * G + G / 2 - OX) * MPP, (j * G + G / 2 - OY) * MPP)
def m2cell(x, z): return (x / MPP + OX) / G, (z / MPP + OY) / G

# ---------- batas kawasan inti ----------
BND_T = [(422, 572), (420, 335), (478, 300), (522, 198), (588, 196), (590, 328), (842, 338), (1032, 575)]
bimg = Image.new('L', (GW, GH), 0); ImageDraw.Draw(bimg).polygon([(x / G, y / G) for x, y in BND_T], fill=1)
INSIDE = np.array(bimg).astype(bool)
area_ha = INSIDE.sum() * CM * CM / 1e4
print('luas kawasan inti', round(area_ha, 1), 'ha')

# ---------- kelas dari OSM ----------
full = np.array(Image.open(SRC + 'osm.png').convert('RGB')).astype(int)
R, Gc, B = full[..., 0], full[..., 1], full[..., 2]
mn = full.min(-1); sat = full.max(-1) - mn
def near(hexs, tol):
    m = np.zeros(R.shape, bool)
    for h in hexs:
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        m |= (abs(R - r) <= tol) & (abs(Gc - g) <= tol) & (abs(B - b) <= tol)
    return m
def pool(mask):
    return np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize((GW, GH), Image.BOX)) / 255.0
arteri = pool(near(['#fcd6a4', '#f9b29c', '#e892a2'], 10))
kolektor = pool(near(['#f7fabf'], 9))
lokal = pool((mn >= 244) & (sat <= 8))
green = pool(((Gc - R) > 10) & ((Gc - B) > 5) & (Gc > 170))
roadf = np.clip(arteri + kolektor + lokal, 0, 1)

# ---------- peta tinggi bangunan (grid analisis & 1,44 m) ----------
def raster_heights(scale):
    W, H = int(TW / scale), int(TH / scale)
    im = Image.new('F', (W, H), 0.0); dr = ImageDraw.Draw(im)
    for b in sorted(d3['bld'], key=lambda b: b['h']):
        pts = [((b['p'][k] / MPP + OX) / scale, (b['p'][k + 1] / MPP + OY) / scale) for k in range(0, len(b['p']), 2)]
        dr.polygon(pts, fill=float(b['h']))
    return np.array(im)
HM = raster_heights(1)            # 1,44 m per px
HG = raster_heights(G)            # 5,76 m per sel
BLD = HG > 0.5

# ---------- jaringan jalan kaki (sama dgn analisis 2D) ----------
walk = (roadf > 0.28) | (green > 0.5)
walk = closing(walk, disk(1)); walk = remove_small_objects(walk, max_size=20)
NB = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
def dijkstra(sources, passable, maxd=1e9):
    dist = np.full((GH, GW), np.inf); h = []
    for r, c in sources:
        if 0 <= r < GH and 0 <= c < GW and passable[r, c] and dist[r, c] > 0: dist[r, c] = 0; h.append((0.0, r, c))
    heapq.heapify(h)
    while h:
        d, r, c = heapq.heappop(h)
        if d > dist[r, c] or d > maxd: continue
        for dr, dc, w in NB:
            rr, cc = r + dr, c + dc
            if 0 <= rr < GH and 0 <= cc < GW and passable[rr, cc]:
                nd = d + w * CM
                if nd < dist[rr, cc]: dist[rr, cc] = nd; heapq.heappush(h, (nd, rr, cc))
    return dist
wl, wn = ndi.label(walk, structure=np.ones((3, 3)))
reach = wl == (np.bincount(wl.ravel())[1:].argmax() + 1)
_, idx = ndi.distance_transform_edt(~reach, return_indices=True)
edt = ndi.distance_transform_edt(~reach) * CM
def to_all(dnet):
    return edt + dnet[idx[0], idx[1]]
def snap(x, z):
    i, j = m2cell(x, z); i, j = int(min(GW - 1, max(0, i))), int(min(GH - 1, max(0, j)))
    return int(idx[0][j, i]), int(idx[1][j, i])

# ---------- 1. kebisingan lalu lintas (estimasi indikatif) ----------
# tingkat Leq siang pada 7,5 m dari as jalan (dB(A)); arteri Jakarta terukur 70–80+ dB(A)
LREF = {'arteri': 76.0, 'kolektor': 70.0, 'lokal': 60.0, 'mrt': 66.0}
open_ = ~BLD
mrt_pts = [(549, -30), (548, 60), (546, 104), (541, 230), (532, 340), (523, 410), (515, 462), (508, 540), (501, 640), (496, 760)]
mrt_mask = Image.new('L', (GW, GH), 0); ImageDraw.Draw(mrt_mask).line([(x / G, y / G) for x, y in mrt_pts], fill=1, width=2)
SRCMASK = {'arteri': arteri > .35, 'kolektor': (kolektor > .35) & ~(arteri > .35), 'lokal': (lokal > .5) & ~(arteri > .35) & ~(kolektor > .35), 'mrt': np.array(mrt_mask).astype(bool)}
E = np.zeros((GH, GW))
for k, m in SRCMASK.items():
    src = list(zip(*np.nonzero(m & open_)))
    dg = dijkstra(src, open_ | m, maxd=400)            # jarak geodesik lewat ruang terbuka
    de = ndi.distance_transform_edt(~m) * CM            # jarak lurus
    dg = np.where(np.isfinite(dg), dg, 400 + de)
    d = np.maximum(dg, 3.0)
    delta = np.clip(dg - de, 0, None)                  # selisih lintasan (difraksi)
    A = np.where(delta > .05, np.minimum(10 * np.log10(3 + 40 * delta / 0.68), 20), 0)   # Maekawa, 500 Hz
    L = LREF[k] - 10 * np.log10(d / 7.5) - A
    E += 10 ** (L / 10)
NOISE = 10 * np.log10(E + 1e-9)
NOISE[BLD] = np.nan
# fasad: nilai maks di sekeliling bangunan
def facade_max(b):
    i0, j0 = m2cell(*b['c'])
    xs = [m2cell(b['p'][k], b['p'][k + 1]) for k in range(0, len(b['p']), 2)]
    best = -1
    for (ci, cj) in xs:
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                ii, jj = int(ci + di), int(cj + dj)
                if 0 <= ii < GW and 0 <= jj < GH and not np.isnan(NOISE[jj, ii]): best = max(best, NOISE[jj, ii])
    return best
print('kebisingan dihitung')

# ---------- 2. sky view factor ----------
ys, xs = np.mgrid[0:GH, 0:GW]
px = (xs * G + G / 2); py = (ys * G + G / 2)           # koordinat thumb
H0 = 1.5
nAz, step, maxd = 24, 3.0, 220.0
sin2 = np.zeros((GH, GW))
for a in range(nAz):
    th = 2 * math.pi * a / nAz; dx, dy = math.cos(th), math.sin(th)
    best = np.zeros((GH, GW))
    for d in np.arange(step, maxd, step):
        sx = np.clip((px + dx * d / MPP).astype(int), 0, TW - 1); sy = np.clip((py + dy * d / MPP).astype(int), 0, TH - 1)
        h = HM[sy, sx]
        best = np.maximum(best, (h - H0) / d)
    beta = np.arctan(np.clip(best, 0, None))
    sin2 += np.sin(beta) ** 2
SVF = 1 - sin2 / nAz
SVF[BLD] = np.nan
print('SVF dihitung')

# ---------- 3. fasilitas 10 menit (800 m) ----------
KAT = d3['poi_cat']
dist_kat = {}
for ci, cat in enumerate(KAT):
    src = [snap(p[0], p[1]) for p in d3['poi'] if p[2] == ci]
    dist_kat[cat] = to_all(dijkstra(src, reach))
dist_kat['transit'] = to_all(dijkstra([snap(*t['m']) for t in d3['transit']], reach))
parkm = (green > .5)
plab, pn = ndi.label(parkm)
psz = ndi.sum(np.ones_like(plab), plab, range(1, pn + 1)) * CM * CM
keep = np.isin(plab, [i + 1 for i, s in enumerate(psz) if s >= 1500])   # taman >= 0,15 ha
park_src = list(zip(*np.nonzero(keep & reach))) or list(zip(*np.nonzero(keep)))
dist_kat['ruang hijau'] = to_all(dijkstra(park_src, reach | keep))
FAS = sum((dist_kat[k] <= 800).astype(int) for k in dist_kat)
NKAT = len(dist_kat)
RTH = dist_kat['ruang hijau']
print('fasilitas & RTH dihitung', list(dist_kat))

# ---------- 4. potensi PLTS atap ----------
def sunpos(doy, jam, lat=-6.2443, lon=106.7984):
    g = 2 * math.pi / 365 * (doy - 1 + (jam - 12) / 24)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = 0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g)
    tst = jam * 60 + eqt + 4 * lon - 420; ha = math.radians(tst / 4 - 180); la = math.radians(lat)
    cz = math.sin(la) * math.sin(decl) + math.cos(la) * math.cos(decl) * math.cos(ha); el = math.pi / 2 - math.acos(max(-1, min(1, cz)))
    az = math.atan2(math.sin(ha), math.cos(ha) * math.sin(la) - math.tan(decl) * math.cos(la)) + math.pi
    return el, az
SUNS = []
for doy in (21, 80, 172, 264, 355):
    for jam in np.arange(6.5, 18, 1.0):
        el, az = sunpos(doy, jam)
        if el > math.radians(5): SUNS.append((el, az, math.sin(el)))
wsum = sum(s[2] for s in SUNS)
YIELD = 1250.0     # kWh/kWp/tahun, PLTS atap komersial Jakarta (EREM 2024: 1.161–1.258)
KWP_M2 = 0.20      # kWp per m² panel (efisiensi ±20%)
USABLE = 0.5       # porsi atap yang dapat dipasang
pv = []
for b in d3['bld']:
    if b['a'] < 30: pv.append(0); continue
    # sampel beberapa titik atap
    pts = [(b['c'][0], b['c'][1])] + [(b['p'][k] * .6 + b['c'][0] * .4, b['p'][k + 1] * .6 + b['c'][1] * .4) for k in range(0, min(len(b['p']), 16), 4)]
    shade = 0.0
    for el, az, w in SUNS:
        sx, sz = math.sin(az), -math.cos(az); tanE = math.tan(el); blk = 0
        for (x, z) in pts:
            for d in np.arange(3, 400, 3):
                tx, ty = (x + sx * d) / MPP + OX, (z + sz * d) / MPP + OY
                if tx < 0 or ty < 0 or tx >= TW or ty >= TH: break
                need = b['h'] + d * tanE
                if need > 175: break
                if HM[int(ty), int(tx)] > need: blk += 1; break
        shade += w * blk / len(pts)
    sf = shade / wsum
    pv.append(round(b['a'] * USABLE * KWP_M2 * YIELD * (1 - sf)))
print('PLTS dihitung')

# ---------- 5. blok & selubung intensitas ----------
# blok = area non-jalan yang dibatasi jaringan jalan (grid 2 px = 2,88 m)
G2 = 2; W2, H2 = TW // G2, TH // G2
rd2 = np.array(Image.fromarray(((full.min(-1) >= 244) & ((full.max(-1) - full.min(-1)) <= 8) | near(['#fcd6a4', '#f7fabf'], 9)).astype(np.uint8) * 255).resize((W2, H2), Image.BOX)) > 60
rd2 = dilation(closing(rd2, disk(2)), disk(1))
blab, bn = ndi.label(~rd2)
bins2 = np.array(Image.fromarray(np.kron(INSIDE, np.ones((2, 2))).astype(np.uint8)[:H2, :W2] * 255)) > 0
blocks = []
cent_b = [(m2cell(*b['c']), b) for b in d3['bld']]
for k, sl in enumerate(ndi.find_objects(blab), start=1):
    if sl is None: continue
    sub = blab[sl] == k; a = sub.sum() * (G2 * MPP) ** 2
    if a < 600 or a > 60000: continue
    cy, cx = ndi.center_of_mass(sub); cy += sl[0].start; cx += sl[1].start
    if not bins2[int(cy), int(cx)]: continue
    cs = measure.find_contours(np.pad(sub, 1).astype(float), .5)
    c = measure.approximate_polygon(max(cs, key=len), 1.2)
    poly = [((x - 1 + sl[1].start) * G2, (y - 1 + sl[0].start) * G2) for y, x in c][:-1]    # thumb
    # bangunan di dalam blok
    msk = Image.new('L', (W2, H2), 0); ImageDraw.Draw(msk).polygon([(x / G2, y / G2) for x, y in poly], fill=1); msk = np.array(msk).astype(bool)
    gfa = 0; uses = []
    for (ci, cj), b in cent_b:
        x2, y2 = int(ci * G / G2), int(cj * G / G2)
        if 0 <= y2 < H2 and 0 <= x2 < W2 and msk[y2, x2]: gfa += b['a'] * b['f']; uses.append((b['u'], b['a']))
    if not uses: continue
    w = {}
    for u, aa in uses: w[u] = w.get(u, 0) + aa
    dom = max(w, key=w.get)
    if dom == 4: klb, kdb, fh, zona = 6.65, .55, 4.0, 'K (perkantoran, perdagangan & jasa)'
    elif dom == 3: klb, kdb, fh, zona = 1.2, .50, 3.5, 'R (perumahan)'
    else: continue
    izin = a * klb
    blocks.append(dict(p=[round(v, 1) for x, y in poly for v in ((x - OX) * MPP, (y - OY) * MPP)], a=round(a), gfa=round(gfa), klb=klb, kdb=kdb,
                       klb_eks=round(gfa / a, 2), izin=round(izin), sisa=round(max(0, izin - gfa)), h=round(klb / kdb * fh, 1), zona=zona))
print('blok', len(blocks))

# ---------- statistik kawasan inti ----------
def inside_mean(a): v = a[INSIDE & np.isfinite(a)]; return float(v.mean())
def inside_pct(cond, valid=None):
    v = INSIDE & (np.isfinite(valid) if valid is not None else True); return float(100 * (cond & v).sum() / max(1, v.sum()))
akses = np.frombuffer(base64.b64decode(d2['grid']['akses']), np.uint8).reshape(GH, GW) / 255 * 15
walkg = np.frombuffer(base64.b64decode(d2['grid']['walk']), np.uint8).reshape(GH, GW) / 255 * 100
mixg = np.frombuffer(base64.b64decode(d2['grid']['mix']), np.uint8).reshape(GH, GW) / 255
panas = np.frombuffer(base64.b64decode(d2['grid']['panas']), np.uint8).reshape(GH, GW) / 255
lu = np.frombuffer(base64.b64decode(d2['grid']['lu']), np.uint8).reshape(GH, GW)
in_b = []
for i, b in enumerate(d3['bld']):
    ci, cj = m2cell(*b['c'])
    if 0 <= int(cj) < GH and 0 <= int(ci) < GW and INSIDE[int(cj), int(ci)]: in_b.append(i)
fac = {}
for i in in_b:
    b = d3['bld'][i]; fac[i] = facade_max(b)
lim = lambda u: 55 if u == 3 else 70
over = [i for i in in_b if fac[i] > lim(d3['bld'][i]['u'])]
rth_ok = [i for i in in_b if RTH[int(m2cell(*d3['bld'][i]['c'])[1]), int(m2cell(*d3['bld'][i]['c'])[0])] <= 300]
pv_in = sum(pv[i] for i in in_b)
gfa_in = sum(d3['bld'][i]['a'] * d3['bld'][i]['f'] for i in in_b)
stat = dict(
    luas_ha=round(area_ha, 1), n_bangunan=len(in_b), gfa_eks=round(gfa_in), tapak=round(sum(d3['bld'][i]['a'] for i in in_b)),
    klb_eks=round(gfa_in / (area_ha * 1e4), 2),
    akses5=round(inside_pct(akses <= 5), 1), akses_rata=round(inside_mean(akses), 1),
    walk_rata=round(inside_mean(walkg), 1), mix_rata=round(inside_mean(mixg), 2), panas_tinggi=round(inside_pct(panas > .66), 1),
    lu={n: round(float(100 * ((lu == k) & INSIDE).sum() / max(1, (INSIDE & (lu != 1)).sum())), 1) for k, n in [(3, 'Hunian'), (4, 'Komersial & jasa'), (5, 'Pendidikan & publik'), (6, 'Ruang hijau'), (8, 'Fasilitas lain')]},
    bising_rata=round(float(np.nanmean(np.where(INSIDE, NOISE, np.nan))), 1),
    bising_70=round(inside_pct(NOISE > 70, NOISE), 1), bising_55=round(inside_pct(NOISE > 55, NOISE), 1),
    fasad_lewat=round(100 * len(over) / max(1, len(in_b)), 1),
    svf_rata=round(float(np.nanmean(np.where(INSIDE & (roadf > .3), SVF, np.nan))), 2),
    svf_rendah=round(inside_pct((SVF < .5) & (roadf > .3), SVF), 1),
    fas_kat={k: round(inside_pct(dist_kat[k] <= 800), 1) for k in dist_kat}, fas5={k: round(inside_pct(dist_kat[k] <= 400), 1) for k in dist_kat},
    bising_hist=np.histogram(NOISE[INSIDE & np.isfinite(NOISE)], bins=np.arange(40, 90, 5))[0].tolist(),
    svf_hist=np.histogram(SVF[INSIDE & np.isfinite(SVF) & (roadf > .3)], bins=np.linspace(0, 1, 11))[0].tolist(),
    rth_hist=np.histogram(np.minimum(RTH[INSIDE & ~BLD], 999), bins=np.arange(0, 1100, 100))[0].tolist(),
    akses_hist=np.histogram(akses[INSIDE], bins=np.arange(0, 16, 1))[0].tolist(),
    akses10=round(inside_pct(akses <= 10), 1),
    fas_lengkap=round(inside_pct(FAS >= NKAT - 1), 1), fas_rata=round(inside_mean(FAS.astype(float)), 1), n_kat=NKAT,
    rth300=round(100 * len(rth_ok) / max(1, len(in_b)), 1),
    pv_mwh=round(pv_in / 1000), pv_kwp=round(pv_in / YIELD),
    blok_izin=round(sum(b['izin'] for b in blocks)), blok_gfa=round(sum(b['gfa'] for b in blocks)), blok_sisa=round(sum(b['sisa'] for b in blocks)), n_blok=len(blocks),
)
print(json.dumps(stat, indent=1, ensure_ascii=False))

def enc(a, lo, hi, nan=0):
    a = np.where(np.isfinite(a), np.clip((a - lo) / (hi - lo), 0, 1) * 254 + 1, nan)
    return base64.b64encode(a.astype(np.uint8).tobytes()).decode()
out = dict(
    batas=[[round(v, 1) for v in ((x - OX) * MPP, (y - OY) * MPP)] for x, y in BND_T],
    grid=dict(dalam=base64.b64encode(INSIDE.astype(np.uint8).tobytes()).decode(),
              bising=enc(NOISE, 40, 85), svf=enc(SVF, 0, 1), fas=base64.b64encode(FAS.astype(np.uint8).tobytes()).decode(),
              rth=enc(np.minimum(RTH, 1000), 0, 1000)),
    pv=pv, blok=blocks, dalam_bld=in_b, stat=stat, kat=list(dist_kat),
    sumber=dict(yield_kwh_kwp=YIELD, kwp_m2=KWP_M2, usable=USABLE, lref=LREF),
)
json.dump(out, open(BUILD + 'data_v2.json', 'w'), separators=(',', ':'))
print('data_v2.json', round(os.path.getsize(BUILD + 'data_v2.json') / 1e6, 2), 'MB')
# pratinjau
def cm(a, lo, hi):
    t = np.clip((np.nan_to_num(a, nan=lo) - lo) / (hi - lo), 0, 1); return (np.stack([t, 1 - abs(t - .5) * 2, 1 - t], -1) * 255).astype(np.uint8)
Image.fromarray(np.vstack([np.hstack([cm(NOISE, 45, 80), cm(SVF, 0, 1)]), np.hstack([cm(FAS, 0, NKAT), cm(np.minimum(RTH, 600), 0, 600)])])).resize((1400, 716)).save(BUILD + 'pv_v2.png')
