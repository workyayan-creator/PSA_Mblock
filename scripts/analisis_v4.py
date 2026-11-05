# v4: analisis ulang untuk Public Space Analysis Blok M
#  1. Kebisingan dari jaringan jalan OSM vektor + area Terminal Bus Blok M + jalur busway + MRT layang
#  2. Muka aktif jalan (street life, PPS Sociability) per ruas
#  3. Rute kendaraan (graf jalan mobil OSM berarah, lajur kiri) dan titik aktivitas pejalan
import os, json, math, heapq, base64, random
import numpy as np, networkx as nx, osmnx as ox
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.strtree import STRtree
from pyproj import Transformer

OSM = os.environ.get('BLOKM_OSM', 'build/osm/blokm.osm')
W = os.environ.get('BLOKM_BUILD', 'build/')
REG = json.load(open(os.path.dirname(OSM) + '/reg.json'))
TW, TH, MPP, OX, OY, G = 1400, 717, 1.44, 515, 462, 4
CM = G * MPP
T = Transformer.from_crs(4326, 32748, always_xy=True)
c_, s_ = math.cos(math.radians(REG['th'])), math.sin(math.radians(REG['th']))
def ll2w(lon, lat):
    e, n = T.transform(np.asarray(lon, float), np.asarray(lat, float)); e = e - REG['E0']; n = n - REG['N0']
    x = (e * c_ - n * s_) / (MPP * REG['s']) + OX + REG['dx']; y = OY + REG['dy'] - (e * s_ + n * c_) / (MPP * REG['s'])
    return (x - OX) * MPP, (y - OY) * MPP
d3 = json.load(open(W + 'data3d.json')); V2 = json.load(open(W + 'data_v2.json')); DO = json.load(open(W + 'data_osm.json'))
GW, GH = d3['gmeta']['gw'], d3['gmeta']['gh']
INSIDE = np.frombuffer(base64.b64decode(V2['grid']['dalam']), np.uint8).reshape(GH, GW).astype(bool)
CORE = Polygon(V2['batas'])
FRAME = Polygon([(-OX * MPP, -OY * MPP), ((TW - OX) * MPP, -OY * MPP), ((TW - OX) * MPP, (TH - OY) * MPP), (-OX * MPP, (TH - OY) * MPP)])
def w2g(x, z): return (x / MPP + OX) / G, (z / MPP + OY) / G
B = d3['bld']

# terminal bus
ft = ox.features_from_xml(OSM, tags={'public_transport': 'station', 'amenity': 'bus_station'})
TERM = None
for idx, r in ft.iterrows():
    if 'Terminal' in str(r.get('name')) and r.geometry.geom_type in ('Polygon', 'MultiPolygon'):
        g = r.geometry if r.geometry.geom_type == 'Polygon' else max(r.geometry.geoms, key=lambda p: p.area)
        X, Z = ll2w(*g.exterior.coords.xy); TERM = Polygon(list(zip(X, Z)))
print('terminal', round(TERM.area), 'm²')

fpk = ox.features_from_xml(OSM, tags={'leisure': ['park', 'garden', 'playground', 'pitch'], 'landuse': ['grass', 'recreation_ground']})
TAMAN = []
for idx, r_ in fpk.iterrows():
    g = r_.geometry
    if g.geom_type not in ('Polygon', 'MultiPolygon'): continue
    for pg in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
        X, Z = ll2w(*pg.exterior.coords.xy); P_ = Polygon(list(zip(X, Z))).buffer(0)
        if P_.area > 80: TAMAN.append(P_)
from shapely.ops import unary_union as _uu
TAMAN_U = _uu(TAMAN) if TAMAN else Polygon()
print('poligon taman', len(TAMAN))
# ---------------- graf jalan kendaraan dari OSM ----------------
ox.settings.useful_tags_way = list(set(ox.settings.useful_tags_way + ['access', 'service', 'bus', 'psv']))
G0 = ox.graph_from_xml(OSM, simplify=False, retain_all=True)
def hw(d):
    h = d.get('highway'); return h[0] if isinstance(h, list) else h
def nama(d):
    n = d.get('name'); return n[0] if isinstance(n, list) else n
KELAS = {'primary': 'arteri', 'primary_link': 'arteri', 'trunk': 'arteri', 'trunk_link': 'arteri', 'secondary': 'kolektor', 'secondary_link': 'kolektor',
         'tertiary': 'tersier', 'tertiary_link': 'tersier', 'residential': 'lokal', 'living_street': 'lokal', 'unclassified': 'lokal', 'busway': 'busway', 'service': 'servis'}
def kelas(d):
    k = KELAS.get(hw(d))
    if k == 'servis' and isinstance(nama(d), str) and nama(d).startswith('Jalan'): k = 'servis_jalan'
    return k
rm = [(u, v, k) for u, v, k, d in G0.edges(keys=True, data=True) if kelas(d) is None or str(d.get('service')) in ('parking_aisle', 'driveway', 'drive-through')
      or (str(d.get('access')) in ('no', 'private') and kelas(d) not in ('servis_jalan', 'busway'))]
G0.remove_edges_from(rm); G0.remove_nodes_from(list(nx.isolates(G0)))
GD = ox.simplify_graph(G0)
for n, d in GD.nodes(data=True): d['wx'], d['wz'] = ll2w(d['x'], d['y'])
def geom(u, v, d):
    if 'geometry' in d: xs, ys = d['geometry'].xy
    else: xs, ys = [GD.nodes[u]['x'], GD.nodes[v]['x']], [GD.nodes[u]['y'], GD.nodes[v]['y']]
    X, Z = ll2w(list(xs), list(ys)); pts = list(zip(map(float, X), map(float, Z)))
    if math.hypot(pts[0][0] - GD.nodes[u]['wx'], pts[0][1] - GD.nodes[u]['wz']) > math.hypot(pts[-1][0] - GD.nodes[u]['wx'], pts[-1][1] - GD.nodes[u]['wz']): pts = pts[::-1]
    return pts
for u, v, k, d in GD.edges(keys=True, data=True):
    d['pts'] = geom(u, v, d); d['kl'] = kelas(d); d['L'] = LineString(d['pts']).length
# kendaraan tidak lewat jalan servis tanpa nama (kecuali di dalam terminal) dan tidak menembus taman
buang = []
for u, v, k, d in GD.edges(keys=True, data=True):
    ln = LineString(d['pts']); mid = ln.interpolate(.5, normalized=True)
    if d['kl'] == 'servis' and not TERM.buffer(5).contains(mid): buang.append((u, v, k)); continue
    if d['kl'] not in ('arteri', 'kolektor', 'busway') and ln.length > 0 and ln.intersection(TAMAN_U).length > .3 * ln.length: buang.append((u, v, k))
GD_KEND = GD.copy(); GD_KEND.remove_edges_from(buang)
print('ruas dibuang untuk kendaraan', len(buang))
print('graf kendaraan', GD.number_of_nodes(), 'simpul', GD.number_of_edges(), 'ruas')

# ---------------- 1. kebisingan ----------------
# Leq siang pada 7,5 m dari as jalan, dB(A). Arteri Jakarta terukur 71 sampai 77 dB(A) (mis. studi persimpangan di Semarang/Banda Aceh),
# terminal: 71,6 dB(A) di tengah Terminal Pinang Ranti (Trisakti), 65 sampai 74 dB(A) di Terminal Bulupitu.
LREF = {'arteri': 76.0, 'kolektor': 73.0, 'tersier': 69.0, 'busway': 71.0, 'servis_jalan': 64.0, 'lokal': 61.0, 'servis': 55.0, 'mrt': 66.0, 'terminal': 63.0}
LEBAR = {'arteri': 3, 'kolektor': 2, 'tersier': 2, 'busway': 1, 'servis_jalan': 1, 'lokal': 1, 'servis': 1}
SRC = {k: Image.new('L', (GW, GH), 0) for k in LREF}
for u, v, k, d in GD.edges(keys=True, data=True):
    ImageDraw.Draw(SRC[d['kl']]).line([w2g(x, z) for x, z in d['pts']], fill=1, width=LEBAR[d['kl']])
mrt_pts = [(549, -30), (548, 60), (546, 104), (541, 230), (532, 340), (523, 410), (515, 462), (508, 540), (501, 640), (496, 760)]
ImageDraw.Draw(SRC['mrt']).line([(x / G, y / G) for x, y in mrt_pts], fill=1, width=2)
ImageDraw.Draw(SRC['terminal']).polygon([w2g(x, z) for x, z in TERM.exterior.coords], fill=1)
SRC = {k: np.array(v).astype(bool) for k, v in SRC.items()}
bim = Image.new('L', (GW * 2, GH * 2), 0); db = ImageDraw.Draw(bim)
for b in B: db.polygon([((b['p'][i] / MPP + OX) / G * 2, (b['p'][i + 1] / MPP + OY) / G * 2) for i in range(0, len(b['p']), 2)], fill=255)
BLD = np.array(bim.resize((GW, GH), Image.BOX)) > 140
OPEN = ~BLD
NB = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
def dijkstra(src, passable, maxd):
    dist = np.full((GH, GW), np.inf); h = []
    for r, c in src:
        if passable[r, c]: dist[r, c] = 0; h.append((0.0, r, c))
    heapq.heapify(h)
    while h:
        dd, r, c = heapq.heappop(h)
        if dd > dist[r, c] or dd > maxd: continue
        for a, b_, w in NB:
            rr, cc = r + a, c + b_
            if 0 <= rr < GH and 0 <= cc < GW and passable[rr, cc]:
                nd = dd + w * CM
                if nd < dist[rr, cc]: dist[rr, cc] = nd; heapq.heappush(h, (nd, rr, cc))
    return dist
E = np.zeros((GH, GW)); kontrib = {}
for k, m in SRC.items():
    if not m.any(): continue
    src = list(zip(*np.nonzero(m & OPEN))) or list(zip(*np.nonzero(m)))
    dg = dijkstra(src, OPEN | m, 450)
    de = ndi.distance_transform_edt(~m) * CM
    dg = np.where(np.isfinite(dg), dg, 450 + de)
    d = np.maximum(dg, 3.0)
    delta = np.clip(dg - de, 0, None)
    A = np.where(delta > .05, np.minimum(10 * np.log10(3 + 40 * delta / 0.68), 20), 0)
    L = LREF[k] - 10 * np.log10(d / 7.5) - A
    if k == 'mrt': L = L - 0                      # layang: tanpa difraksi tambahan
    E += 10 ** (L / 10); kontrib[k] = L
NOISE = 10 * np.log10(E + 1e-9)
NOISE[BLD] = np.nan
term_mask = SRC['terminal'] & OPEN
print('bising rata-rata terminal', round(float(np.nanmean(NOISE[term_mask])), 1), 'dB(A)')
# baku mutu per fungsi (KepMenLH 48/1996; KepGub DKI 551/2001)
BAKU = {3: 55, 4: 70, 5: 60, 8: 55}
def fasad(b):
    best = -1
    for i in range(0, len(b['p']), 2):
        ci, cj = w2g(b['p'][i], b['p'][i + 1])
        for a in (-1, 0, 1):
            for c in (-1, 0, 1):
                ii, jj = int(ci + a), int(cj + c)
                if 0 <= ii < GW and 0 <= jj < GH and not np.isnan(NOISE[jj, ii]): best = max(best, NOISE[jj, ii])
    return best
in_b = V2['dalam_bld']
fac = {i: fasad(B[i]) for i in in_b}
over = [i for i in in_b if fac[i] > BAKU.get(B[i]['u'], 70)]
pub = INSIDE & OPEN
bising = dict(bising_rata=round(float(np.nanmean(NOISE[pub])), 1), bising_70=round(float((NOISE[pub] > 70).mean() * 100), 1),
              bising_55=round(float((NOISE[pub] > 55).mean() * 100), 1), fasad_lewat=round(100 * len(over) / len(in_b), 1),
              bising_terminal=round(float(np.nanmean(NOISE[term_mask])), 1),
              bising_hist=np.histogram(NOISE[pub], bins=np.arange(40, 90, 5))[0].tolist(),
              fasad_per_fungsi={str(u): [sum(1 for i in in_b if B[i]['u'] == u and i in over), sum(1 for i in in_b if B[i]['u'] == u)] for u in BAKU})
print(bising)

# ---------------- 2. muka aktif jalan ----------------
POI = np.array([[p[0], p[1]] for p in d3['poi']])
ptree = STRtree([Point(*p) for p in POI])
kom = [Polygon(list(zip(b['p'][0::2], b['p'][1::2]))).buffer(0) for b in B if b['u'] == 4]
ktree = STRtree(kom)
aktif = []; L_in = L_akt = 0.0
for g in DO['seg']:
    p = g['p']; ln = LineString(list(zip(p[0::2], p[1::2])))
    if ln.length < 1: aktif.append(0); continue
    n = max(2, int(ln.length / 6)); ok = 0
    for t in np.linspace(0, ln.length, n):
        q = ln.interpolate(t)
        if len(ptree.query(q.buffer(22))) or len(ktree.query(q.buffer(10), predicate='intersects')): ok += 1
    f = ok / n; aktif.append(round(f, 2))
    if g['c'] <= 5 and ln.intersects(CORE):
        li = ln.intersection(CORE).length; L_in += li; L_akt += li * f
muka = round(100 * L_akt / max(1, L_in), 1)
print('muka aktif kawasan inti', muka, '%')

# ---------------- 3. rute kendaraan (lajur kiri, mengikuti arah oneway) ----------------
random.seed(5)
BOBOT = {'arteri': 5, 'kolektor': 4, 'tersier': 3, 'busway': 0, 'servis_jalan': 1.6, 'lokal': 1, 'servis': .25}
nodes = list(GD.nodes)
def heading(pts, end=True):
    (x0, z0), (x1, z1) = (pts[-2], pts[-1]) if end else (pts[0], pts[1])
    return math.atan2(x1 - x0, z1 - z0)
KODE = {'arteri': 0, 'kolektor': 1, 'tersier': 2, 'lokal': 3, 'servis_jalan': 3, 'busway': 4, 'servis': 5}
DALAM = FRAME.buffer(-14)
def walk(start, busway=False, maxL=1800):
    path = []; kls = []; L = 0; cur = start; prev_h = None; seen = set()
    while L < maxL:
        outs = [(v, k, d) for _, v, k, d in GD_KEND.out_edges(cur, keys=True, data=True) if (d['kl'] == 'busway') == busway and (cur, v, k) not in seen]
        if not outs: break
        wts = []
        for v, k, d in outs:
            w = BOBOT.get(d['kl'], 1) if not busway else 1
            if prev_h is not None:
                dh = abs((heading(d['pts'], False) - prev_h + math.pi) % (2 * math.pi) - math.pi)
                w *= 3.0 if dh < .5 else 1.0 if dh < 1.9 else .02
            wts.append(w)
        v, k, d = random.choices(outs, weights=wts)[0]
        seen.add((cur, v, k)); p_ = d['pts'] if not path else d['pts'][1:]; path.extend(p_); kls.extend([KODE[d['kl']]] * len(p_)); L += d['L']; prev_h = heading(d['pts']); cur = v
    # klip: ambil potongan terpanjang yang seluruhnya di dalam peta 3D
    best, cur_ = [], []
    for i, p in enumerate(path):
        if DALAM.contains(Point(p)): cur_.append(i)
        else:
            if len(cur_) > len(best): best = cur_
            cur_ = []
    if len(cur_) > len(best): best = cur_
    path = [path[i] for i in best]; kls = [kls[i] for i in best]
    L = LineString(path).length if len(path) > 1 else 0
    return path, L, kls
rute = []
for kind, busway, n in (('umum', False, 300), ('tj', True, 36)):
    cand = [n_ for n_ in GD_KEND.nodes if any((d['kl'] == 'busway') == busway for *_, d in GD_KEND.out_edges(n_, keys=True, data=True))]
    tries = 0
    while sum(1 for r in rute if r['k'] == kind) < n and tries < n * 12:
        tries += 1
        p, L, kls = walk(random.choice(cand), busway)
        if L < 250: continue
        ln = LineString(p)
        rute.append(dict(k=kind, p=[round(c * 2) / 2 for xy in p for c in xy], c=''.join(map(str, kls)), L=round(L), t=1 if ln.intersects(TERM) else 0))
print('rute', len(rute), 'lewat terminal', sum(r['t'] for r in rute))

# ---------------- 4. titik aktivitas pejalan ----------------
fs = ox.features_from_xml(OSM, tags={'leisure': ['park', 'playground', 'garden'], 'place': 'square', 'highway': 'pedestrian', 'amenity': ['marketplace', 'food_court']})
spot = []
for idx, r in fs.iterrows():
    g = r.geometry
    if g.geom_type not in ('Polygon', 'MultiPolygon'): continue
    g = g if g.geom_type == 'Polygon' else max(g.geoms, key=lambda p: p.area)
    X, Z = ll2w(*g.exterior.coords.xy); P = Polygon(list(zip(X, Z))).buffer(0)
    if P.area < 150 or not P.intersects(FRAME): continue
    c = P.representative_point(); jenis = 'taman' if str(r.get('leisure')) in ('park', 'garden', 'playground') else 'plaza'
    spot.append(dict(j=jenis, c=[round(c.x, 1), round(c.y, 1)], r=round(min(45, math.sqrt(P.area / math.pi) * .7), 1), n=str(r.get('name') or '')[:40], a=round(P.area)))
# titik terkenal yang di OSM tidak bertag ruang publik
TERKENAL = [('M Bloc Space', 548, 228, 'plaza', 22), ('Taman Literasi', 548, 352, 'taman', 26), ('Little Tokyo (Melawai)', 585, 432, 'kuliner', 30), ('Plaza Blok M Square', 712, 400, 'plaza', 24), ('Terminal Blok M', 600, 375, 'halte', 30)]
for n_, x, y, j, r_ in TERKENAL: spot.append(dict(j=j, c=[round((x - OX) * MPP, 1), round((y - OY) * MPP, 1)], r=r_, n=n_, a=0))
print('titik aktivitas', len(spot))

out = dict(bising_grid=base64.b64encode((np.where(np.isfinite(NOISE), np.clip((NOISE - 40) / 45, 0, 1) * 254 + 1, 0)).astype(np.uint8).tobytes()).decode(),
           bising=bising, baku=BAKU, lref=LREF, aktif=aktif, muka=muka, rute=rute, spot=spot,
           terminal=[[round(x, 1), round(z, 1)] for x, z in list(TERM.exterior.coords)[:-1]])
json.dump(out, open(W + 'data_v4.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('data_v4.json', round(os.path.getsize(W + 'data_v4.json') / 1e6, 2), 'MB')
def cm(a, lo, hi):
    t = np.clip((np.nan_to_num(a, nan=lo) - lo) / (hi - lo), 0, 1); return (np.stack([t, 1 - abs(t - .5) * 2, 1 - t], -1) * 255).astype(np.uint8)
Image.fromarray(cm(NOISE, 45, 80)).resize((1400, 716)).save(W + 'v4_bising.png')
