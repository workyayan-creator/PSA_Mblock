# Analisis spasial Blok M dari osm.png (OSM) + Google Earth.jpg
import os, json, heapq, random, base64
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from skimage.morphology import skeletonize, binary_closing, disk, remove_small_objects

Image.MAX_IMAGE_PIXELS = None
os.makedirs('build', exist_ok=True)
SRC = '../Map/'
OUT = 'build/'
random.seed(7)

# ---------- skala ----------
TW, TH = 1400, 717            # kanvas tampilan (thumb OSM)
MPP_T = 1.44                  # meter per px thumb (kalibrasi dari skala 50 m infografis + dimensi blok)
G = 2                         # 1 sel grid = 2 px thumb
GW, GH = TW // G, TH // G + (TH % G > 0)
GH = TH // G
MPC = MPP_T * G               # meter per sel (2,88 m)

full = np.array(Image.open(SRC + 'osm.png').convert('RGB')).astype(int)
R, Gc, B = full[..., 0], full[..., 1], full[..., 2]
mx = full.max(-1); mn = full.min(-1); sat = mx - mn

def near(hexs, tol=10):
    m = np.zeros(R.shape, bool)
    for h in hexs:
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        m |= (abs(R - r) <= tol) & (abs(Gc - g) <= tol) & (abs(B - b) <= tol)
    return m

road = ((mn >= 244) & (sat <= 8)) | near(['#fcd6a4', '#f7fabf', '#f8f8f8'], 9)
building = near(['#d9d0c9', '#c4b6ab', '#cbbfb5', '#d0c4bc', '#d4ccc4'], 7)
green = ((Gc - R) > 10) & ((Gc - B) > 5) & (Gc > 170)
water = near(['#aad3df'], 10)
resid = near(['#e0dfdf', '#e2dcdc', '#dfdcdc'], 5)
comm = near(['#f2dad9', '#ffd6d1', '#f2e0dc', '#f0dcd8'], 7)
edu = near(['#ffffe5'], 6)
other = near(['#eeeeee', '#e8e8e8', '#d0d0d0', '#e9e9e9'], 3) & ~road

# kelas: 0 tak dikenal,1 jalan,2 bangunan,3 hunian,4 komersial,5 pendidikan/publik,6 hijau,7 air,8 lain
cls = np.zeros(R.shape, np.uint8)
for k, m in [(1, road), (2, building), (7, water), (6, green), (4, comm), (5, edu), (3, resid), (8, other)]:
    cls[m & (cls == 0)] = k

def pool(mask):
    im = Image.fromarray((mask * 255).astype(np.uint8)).resize((GW, GH), Image.BOX)
    return np.array(im) / 255.0

frac = {k: pool(cls == k) for k in range(1, 9)}
roadf, bldf, greenf = frac[1], frac[2], frac[6]

# ---------- jaringan jalan (walkable) ----------
walk = (roadf > 0.28) | (greenf > 0.5)
walk = binary_closing(walk, disk(2))
walk = remove_small_objects(walk, 60)

# simpul transit (koordinat thumb 1400)
TRANSIT = [
    dict(id='mrt_blokm', nama='MRT Blok M BCA', jenis='MRT', x=515, y=462),
    dict(id='mrt_asean', nama='MRT ASEAN', jenis='MRT', x=546, y=104),
    dict(id='terminal', nama='Terminal Bus Blok M', jenis='Bus/TransJakarta', x=640, y=372),
    dict(id='tj_csw', nama='Halte TJ CSW', jenis='TransJakarta', x=548, y=88),
    dict(id='tj_blokm', nama='Halte TJ Blok M', jenis='TransJakarta', x=822, y=368),
    dict(id='tj_masjidagung', nama='Halte TJ Kejaksaan Agung', jenis='TransJakarta', x=553, y=310),
]

def snap(x, y):
    gx, gy = x // G, y // G
    d = ndi.distance_transform_edt(~walk, return_indices=True)[1]
    return int(d[0][gy, gx]), int(d[1][gy, gx])

_, idx = ndi.distance_transform_edt(~walk, return_indices=True)
def snapi(x, y):
    gx, gy = min(GW - 1, x // G), min(GH - 1, y // G)
    return int(idx[0][gy, gx]), int(idx[1][gy, gx])

NB = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]

def dijkstra(sources, want_prev=False):
    dist = np.full((GH, GW), np.inf); prev = np.full((GH, GW), -1, np.int64) if want_prev else None
    h = []
    for (r, c) in sources:
        dist[r, c] = 0; heapq.heappush(h, (0.0, r, c))
    while h:
        d, r, c = heapq.heappop(h)
        if d > dist[r, c]: continue
        for dr, dc, w in NB:
            rr, cc = r + dr, c + dc
            if 0 <= rr < GH and 0 <= cc < GW and walk[rr, cc]:
                nd = d + w
                if nd < dist[rr, cc]:
                    dist[rr, cc] = nd
                    if want_prev: prev[rr, cc] = r * GW + c
                    heapq.heappush(h, (nd, rr, cc))
    return dist * MPC, prev

# jarak jaringan ke transit terdekat (semua simpul)
src_all = [snapi(t['x'], t['y']) for t in TRANSIT]
dnet, _ = dijkstra(src_all)
# sel non-jalan: jarak lurus ke jalan terdekat + jarak jaringan di titik itu
reach_net = walk & np.isfinite(dnet)
edt0, idx = ndi.distance_transform_edt(~reach_net, return_indices=True)
edt = edt0 * MPC
dfull = edt + dnet[idx[0], idx[1]]
dfull[~np.isfinite(dfull)] = 2000
menit = dfull / 80.0   # 80 m/menit (4,8 km/jam)

# per stasiun utama: isokron dari MRT Blok M
d_mrt, prev_mrt = dijkstra([snapi(515, 462)], want_prev=True)
d_mrt_full = edt + d_mrt[idx[0], idx[1]]
d_mrt_full[~np.isfinite(d_mrt_full)] = 9999

# ---------- walkability ----------
yy, xx = np.mgrid[0:GH, 0:GW]
cx, cy = 515 / G, 462 / G
eu = np.hypot(xx - cx, yy - cy) * MPC
ped = {}
for Rm in (400, 800):
    circ = eu <= Rm
    reach = circ & (d_mrt_full <= Rm) & (edt <= 35)
    ped[Rm] = dict(rasio=round(100 * reach.sum() / circ.sum(), 1),
                   luas_lingkaran_ha=round(circ.sum() * MPC ** 2 / 1e4, 1),
                   luas_terjangkau_ha=round(reach.sum() * MPC ** 2 / 1e4, 1),
                   terpotong_bingkai=bool(Rm > min(cy, GH - cy) * MPC))

# simpang (intersection density) dari skeleton
sk = skeletonize(walk & (roadf > 0.28))
nbc = ndi.convolve(sk.astype(int), np.ones((3, 3), int), mode='constant') - 1
junc = sk & (nbc >= 3)
lab, nj = ndi.label(ndi.binary_dilation(junc, iterations=3))
jpts = np.array(ndi.center_of_mass(junc, lab, range(1, nj + 1)))
jmap = np.zeros((GH, GW));
for r, c in jpts: jmap[int(r), int(c)] = 1
rad = int(200 / MPC)
ker = (np.hypot(*np.mgrid[-rad:rad + 1, -rad:rad + 1]) <= rad).astype(float)
area_km2 = ker.sum() * MPC ** 2 / 1e6
jdens = ndi.convolve(jmap, ker, mode='constant') / area_km2   # simpang / km2
for Rm in (400, 800):
    circ = eu <= Rm
    ped[Rm]['simpang'] = int(sum(1 for r, c in jpts if circ[int(r), int(c)]))
    ped[Rm]['simpang_per_km2'] = round(ped[Rm]['simpang'] / (circ.sum() * MPC ** 2 / 1e6), 0)

# ---------- land use (isi bangunan dgn guna lahan sekitarnya) ----------
lu_full = cls.copy()
known = np.isin(lu_full, [3, 4, 5, 6, 8])
_, li = ndi.distance_transform_edt(~known, return_indices=True)
lu_full = lu_full[li[0], li[1]]
LU = {3: 'Hunian', 4: 'Komersial & jasa', 5: 'Pendidikan & publik', 6: 'Ruang hijau', 8: 'Fasilitas lain (parkir, ibadah, kantor)'}
luf = {k: pool(lu_full == k) for k in LU}
lu_arg = np.argmax(np.stack([luf[k] for k in LU]), 0)
lu_cls = np.array(list(LU.keys()))[lu_arg]
lu_cls[walk & (roadf > 0.5)] = 1

# entropi campuran guna lahan dlm radius 150 m
rad = int(150 / MPC)
kk = (np.hypot(*np.mgrid[-rad:rad + 1, -rad:rad + 1]) <= rad).astype(float)
P = np.stack([ndi.convolve((lu_cls == k).astype(float), kk, mode='nearest') for k in LU])
P = P / np.maximum(P.sum(0), 1e-9)
ent = -(P * np.log(np.where(P > 0, P, 1))).sum(0) / np.log(len(LU))

def shares(mask):
    tot = sum((lu_cls[mask] == k).sum() for k in LU)
    return {LU[k]: round(100 * (lu_cls[mask] == k).sum() / tot, 1) for k in LU}
mix800 = shares(eu <= 800); mix400 = shares(eu <= 400)
def entropy_of(sh):
    p = np.array([v / 100 for v in sh.values() if v > 0]); return round(float(-(p * np.log(p)).sum() / np.log(len(LU))), 2)

# ---------- termal: vegetasi dari citra satelit + OSM ----------
ge = np.array(Image.open(OUT + 'ge1400.jpg').convert('RGB').resize((round(1400 / 2.23), round(738 / 2.23)), Image.BOX)).astype(float)
OX, OY = 437, 285
gr, gg, gb = ge[..., 0], ge[..., 1], ge[..., 2]
exg = (2 * gg - gr - gb) / (gr + gg + gb + 1)
veg_ge = np.clip((exg - 0.02) / 0.12, 0, 1)
bright = (gr + gg + gb) / 765
veg_t = np.full((TH, TW), np.nan); veg_t[OY:OY + ge.shape[0], OX:OX + ge.shape[1]] = veg_ge
br_t = np.full((TH, TW), np.nan); br_t[OY:OY + ge.shape[0], OX:OX + ge.shape[1]] = bright
veg = np.array(Image.fromarray(np.nan_to_num(veg_t, nan=-1).astype(np.float32)).resize((GW, GH), Image.BOX))
brt = np.array(Image.fromarray(np.nan_to_num(br_t, nan=-1).astype(np.float32)).resize((GW, GH), Image.BOX))
has_sat = veg >= 0
# di luar cakupan satelit: dari OSM (hijau) + asumsi pohon jalan kawasan hunian
veg_osm = np.clip(greenf * 0.9 + (lu_cls == 3) * 0.18 + (lu_cls == 5) * 0.12, 0, 1)
vegm = np.where(has_sat, veg, veg_osm)
v_local = ndi.gaussian_filter(vegm, 10 / MPC)
v_near = ndi.gaussian_filter(vegm, 60 / MPC)
imperv = np.clip(roadf * 1.0 + bldf * 0.85 + (lu_cls == 8) * 0.3, 0, 1)
dark = np.where(has_sat, np.clip((0.55 - brt) / 0.35, 0, 1), roadf * 0.7)   # permukaan gelap (aspal) menyerap panas
heat = 0.55 * imperv + 0.25 * dark - 0.75 * v_local - 0.45 * v_near + 0.45
heat = ndi.gaussian_filter(heat, 6 / MPC)
lo, hi = np.percentile(heat, 2), np.percentile(heat, 98)
heat = np.clip((heat - lo) / (hi - lo), 0, 1)

# ---------- skor walkability komposit per sel ----------
f_trans = np.clip(1 - menit / 12, 0, 1)
f_simp = np.clip(jdens / 120, 0, 1)
f_mix = ent
f_shade = np.clip(v_local * 1.6, 0, 1)
walkscore = 100 * (0.30 * f_trans + 0.25 * f_simp + 0.25 * f_mix + 0.20 * f_shade)
walkscore = ndi.gaussian_filter(walkscore, 15 / MPC)

def stat_in(arr, Rm):
    return round(float(arr[eu <= Rm].mean()), 1)

# ---------- jejak pergerakan pejalan kaki (untuk animasi) ----------
# tujuan: sel komersial/hijau yang dapat dijalani, berbobot
comm_cells = np.argwhere(walk & (ndi.maximum_filter((lu_cls == 4) | (lu_cls == 6), 5)))
paths = []
for t in TRANSIT:
    d, prv = dijkstra([snapi(t['x'], t['y'])], want_prev=True)
    n = 70 if t['jenis'] == 'MRT' else 45
    cand = [p for p in comm_cells if np.isfinite(d[p[0], p[1]]) and 40 < d[p[0], p[1]] < 850]
    for p in random.sample(cand, min(n, len(cand))):
        r, c = int(p[0]), int(p[1]); pts = []
        while r * GW + c != -1 and prv[r, c] != -1:
            pts.append((c * G + G / 2, r * G + G / 2)); k = prv[r, c]; r, c = divmod(int(k), GW)
        pts.append((c * G + G / 2, r * G + G / 2)); pts = pts[::-1]
        simp = pts[::4] + [pts[-1]]
        paths.append(dict(s=t['id'], p=[[round(a), round(b)] for a, b in simp]))

# ---------- ekspor grid (diperkecil 2x untuk ukuran) ----------
def enc(a, lo_, hi_):
    a = np.clip((a - lo_) / (hi_ - lo_), 0, 1)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((GW // 2, GH // 2), Image.BOX)
    return base64.b64encode(np.array(im).tobytes()).decode()
lu_small = np.array(Image.fromarray(lu_cls.astype(np.uint8)).resize((GW // 2, GH // 2), Image.NEAREST))

data = dict(
    meta=dict(tw=TW, th=TH, gw=GW // 2, gh=GH // 2, mpp=MPP_T, origin_mrt=[515, 462], sat_box=[OX, OY, ge.shape[1], ge.shape[0]]),
    transit=TRANSIT,
    grid=dict(akses=enc(menit, 0, 15), walk=enc(walkscore, 0, 100), mix=enc(ent, 0, 1), panas=enc(heat, 0, 1),
              iso=enc(np.minimum(d_mrt_full, 1600), 0, 1600),
              lu=base64.b64encode(lu_small.tobytes()).decode()),
    paths=paths,
    stat=dict(
        pedshed=ped,
        akses=dict(menit_rata_400=stat_in(menit, 400), menit_rata_800=stat_in(menit, 800),
                   persen_5menit_800=round(100 * float((menit[eu <= 800] <= 5).mean()), 1),
                   persen_10menit_800=round(100 * float((menit[eu <= 800] <= 10).mean()), 1)),
        walk=dict(skor_400=stat_in(walkscore, 400), skor_800=stat_in(walkscore, 800)),
        mix=dict(r400=mix400, r800=mix800, entropi_400=entropy_of(mix400), entropi_800=entropy_of(mix800)),
        panas=dict(veg_cover_sat=round(100 * float((veg[has_sat] > 0.4).mean()), 1),
                   persen_panas_tinggi_800=round(100 * float((heat[eu <= 800] > 0.66).mean()), 1),
                   persen_sejuk_800=round(100 * float((heat[eu <= 800] < 0.33).mean()), 1)),
    ))
json.dump(data, open(OUT + 'data.json', 'w'), separators=(',', ':'))
print(json.dumps(data['stat'], indent=1, ensure_ascii=False)); print('paths', len(paths), 'simpang total', nj)

# pratinjau
def cm(a):
    a = np.clip(a, 0, 1); return (np.stack([a, 1 - abs(a - .5) * 2, 1 - a], -1) * 255).astype(np.uint8)
Image.fromarray(np.hstack([cm(menit / 15), cm(walkscore / 100)])).save(OUT + 'pv1.png')
Image.fromarray(np.hstack([cm(ent), cm(heat)])).save(OUT + 'pv2.png')
Image.fromarray(((walk * 200) + sk * 55).astype(np.uint8)).save(OUT + 'pv_walk.png')
