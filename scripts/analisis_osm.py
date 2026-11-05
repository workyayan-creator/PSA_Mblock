# v3: analisis jaringan jalan & morfologi Blok M dari OSM vektor.
# OSMnx (graf jalan kaki, statistik, orientasi), NetworkX (isokron jaringan nyata), momepy/shapely (blok, Spacematrix).
# Metodologi mengikuti open-urban-analysis (dzakybd) dan ambang ITDP TOD Standard (rangkuman Urban-Design-Skills).
import os, json, math, random
import numpy as np, networkx as nx, osmnx as ox
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

OSM = os.environ.get('BLOKM_OSM', 'build/osm/blokm.osm')
W = os.environ.get('BLOKM_BUILD', 'build/')
REG = json.load(open(os.path.dirname(OSM) + '/reg.json'))
MPP, OX, OY = 1.44, 515, 462
from pyproj import Transformer
T = Transformer.from_crs(4326, 32748, always_xy=True)
c_, s_ = math.cos(math.radians(REG['th'])), math.sin(math.radians(REG['th']))
def ll2w(lon, lat):
    e, n = T.transform(lon, lat); e -= REG['E0']; n -= REG['N0']
    x = (e * c_ - n * s_) / (MPP * REG['s']) + OX + REG['dx']; y = OY + REG['dy'] - (e * s_ + n * c_) / (MPP * REG['s'])
    return (x - OX) * MPP, (y - OY) * MPP
BND_T = [(422, 572), (420, 335), (478, 300), (522, 198), (588, 196), (590, 328), (842, 338), (1032, 575)]
CORE = Polygon([((x - OX) * MPP, (y - OY) * MPP) for x, y in BND_T])
AREA_KM2 = CORE.area / 1e6
FRAME = Polygon([(-OX * MPP, -OY * MPP), ((1400 - OX) * MPP, -OY * MPP), ((1400 - OX) * MPP, (717 - OY) * MPP), (-OX * MPP, (717 - OY) * MPP)])
d3 = json.load(open(W + 'data3d.json'))

# ---------------- graf jalan kaki ----------------
ox.settings.useful_tags_way = list(set(ox.settings.useful_tags_way + ['sidewalk', 'sidewalk:both', 'sidewalk:left', 'sidewalk:right', 'foot', 'footway', 'crossing']))
ox.settings.useful_tags_node = list(set(ox.settings.useful_tags_node + ['crossing', 'railway', 'name', 'entrance']))
G0 = ox.graph_from_xml(OSM, simplify=False, retain_all=True)
NOWALK = {'busway', 'motorway', 'motorway_link', 'trunk_link', 'construction', 'proposed', 'raceway', 'bus_guideway', 'platform', 'corridor', 'elevator'}
def hw(d):
    h = d.get('highway'); return h[0] if isinstance(h, list) else h
# Koreksi: Jl. Melawai I–IX di OSM bertag service + access=private, padahal jalan umum yang dilalui pejalan kaki.
# Jalan bernama "Jalan ..." diperlakukan sebagai jalan umum.
def jalan_umum(d):
    n = d.get('name'); n = n[0] if isinstance(n, list) else n
    return isinstance(n, str) and n.startswith('Jalan')
rm = [(u, v, k) for u, v, k, d in G0.edges(keys=True, data=True)
      if hw(d) is None or hw(d) in NOWALK or str(d.get('foot')) == 'no'
      or (str(d.get('access')) in ('no', 'private') and str(d.get('foot')) not in ('yes', 'designated') and not jalan_umum(d))]
n_koreksi = sum(1 for u, v, k, d in G0.edges(keys=True, data=True) if str(d.get('access')) == 'private' and jalan_umum(d))
G0.remove_edges_from(rm); G0.remove_nodes_from(list(nx.isolates(G0)))
G = ox.simplify_graph(G0)
G = ox.convert.to_undirected(G)
G = G.subgraph(max(nx.connected_components(G), key=len)).copy()
for n, d in G.nodes(data=True):
    d['wx'], d['wz'] = ll2w(d['x'], d['y'])
def eg(u, v, k, d):
    if 'geometry' in d: xs, ys = d['geometry'].xy
    else: xs, ys = [G.nodes[u]['x'], G.nodes[v]['x']], [G.nodes[u]['y'], G.nodes[v]['y']]
    pts = [ll2w(a, b) for a, b in zip(xs, ys)]
    # orientasi garis: mulai dari u
    if math.hypot(pts[0][0] - G.nodes[u]['wx'], pts[0][1] - G.nodes[u]['wz']) > math.hypot(pts[-1][0] - G.nodes[u]['wx'], pts[-1][1] - G.nodes[u]['wz']): pts = pts[::-1]
    return pts
for u, v, k, d in G.edges(keys=True, data=True):
    d['pts'] = eg(u, v, k, d); d['wlen'] = LineString(d['pts']).length
print('graf jalan kaki: simpul', G.number_of_nodes(), 'ruas', G.number_of_edges())

inside_n = [n for n, d in G.nodes(data=True) if CORE.contains(Point(d['wx'], d['wz']))]
# persimpangan dikonsolidasi (toleransi 10 m) seperti Boeing (2019) agar jalur ganda & bundaran tidak dihitung berkali-kali
Gp = ox.project_graph(ox.simplify_graph(G0.copy()), to_crs='EPSG:32748')
Gc = ox.consolidate_intersections(Gp, tolerance=10, rebuild_graph=True, dead_ends=True)
def utm2w(e, n):
    e -= REG['E0']; n -= REG['N0']
    x = (e * c_ - n * s_) / (MPP * REG['s']) + OX + REG['dx']; y = OY + REG['dy'] - (e * s_ + n * c_) / (MPP * REG['s'])
    return (x - OX) * MPP, (y - OY) * MPP
Gcu = ox.convert.to_undirected(Gc)
cin = [n for n, d in Gcu.nodes(data=True) if CORE.contains(Point(*utm2w(d['x'], d['y'])))]
Gi = Gcu.subgraph(cin).copy()
cdeg = dict(Gcu.degree())
inter = [n for n in cin if cdeg[n] >= 3]
dead = [n for n in cin if cdeg[n] == 1]
print('simpul terkonsolidasi di kawasan', len(cin), 'persimpangan', len(inter))
e_in = [(u, v, k, d) for u, v, k, d in G.edges(keys=True, data=True) if LineString(d['pts']).intersects(CORE)]
len_in = sum(LineString(d['pts']).intersection(CORE).length for *_, d in e_in)
ped = {'footway', 'pedestrian', 'path', 'steps', 'living_street'}
ped_len = sum(LineString(d['pts']).intersection(CORE).length for u, v, k, d in e_in if hw(d) in ped)
drive_e = [(u, v, k, d) for u, v, k, d in e_in if hw(d) not in ped]
def has_sw(d):
    for c in ('sidewalk', 'sidewalk:both', 'sidewalk:left', 'sidewalk:right'):
        v = d.get(c)
        if v is not None and str(v) not in ('no', 'none', "['no']", 'nan'): return True
    return False
sw = sum(LineString(d['pts']).intersection(CORE).length for u, v, k, d in drive_e if has_sw(d))
dl = sum(LineString(d['pts']).intersection(CORE).length for u, v, k, d in drive_e)
cross = sum(1 for n, d in G0.nodes(data=True) if d.get('highway') == 'crossing' and CORE.contains(Point(*ll2w(d['x'], d['y']))))
# meshedness (momepy): (e - v + 1) / (2v - 5) pada subgraf kawasan
e_n, v_n = Gi.number_of_edges(), Gi.number_of_nodes()
mesh = (e_n - v_n + 1) / (2 * v_n - 5)
conn_idx = e_n / v_n
# circuity & directness: pasangan asal-tujuan acak di kawasan
random.seed(3)
cand = [n for n in inside_n]
rat = []
for _ in range(4000):
    a, b = random.sample(cand, 2)
    pa, pb = G.nodes[a], G.nodes[b]; de = math.hypot(pa['wx'] - pb['wx'], pa['wz'] - pb['wz'])
    if de < 250: continue
    try: dn = nx.shortest_path_length(G, a, b, weight='wlen')
    except nx.NetworkXNoPath: continue
    rat.append(dn / de)
    if len(rat) >= 300: break
directness = float(np.mean(rat))
print('kawasan', round(AREA_KM2, 3), 'km2; persimpangan', len(inter), 'dead-end', len(dead), 'directness', round(directness, 2), 'mesh', round(mesh, 3))

# ---------------- orientasi jalan (Boeing 2019) ----------------
bins = np.zeros(36)
for u, v, k, d in e_in:
    if hw(d) in ped: continue
    p = d['pts']
    for (x0, z0), (x1, z1) in zip(p[:-1], p[1:]):
        L = math.hypot(x1 - x0, z1 - z0)
        if L < .5: continue
        b = math.degrees(math.atan2(x1 - x0, -(z1 - z0))) % 360    # 0 = utara
        for bb in (b, (b + 180) % 360): bins[int(((bb + 5) % 360) // 10)] += L
pr = bins / bins.sum(); H = float(-(pr[pr > 0] * np.log(pr[pr > 0])).sum())
Hmax, Hg = math.log(36), 1.386
phi = 1 - ((H - Hg) / (Hmax - Hg)) ** 2
print('entropi orientasi', round(H, 3), 'keteraturan phi', round(phi, 3))

# ---------------- isokron jaringan dari MRT Blok M BCA & semua halte ----------------
def nearest(x, z):
    return min(G.nodes, key=lambda n: (G.nodes[n]['wx'] - x) ** 2 + (G.nodes[n]['wz'] - z) ** 2)
ent = [ll2w(d['x'], d['y']) for n, d in G0.nodes(data=True) if d.get('railway') == 'subway_entrance']
mrt = [t for t in d3['transit'] if t['nama'] == 'MRT Blok M BCA'][0]['m']
ent_mrt = [e for e in ent if math.hypot(e[0] - mrt[0], e[1] - mrt[1]) < 260] or [tuple(mrt)]
src_mrt = list({nearest(*e) for e in ent_mrt})
D_mrt = nx.multi_source_dijkstra_path_length(G, src_mrt, weight='wlen')
src_tr = list({nearest(*t['m']) for t in d3['transit']})
D_tr = nx.multi_source_dijkstra_path_length(G, src_tr, weight='wlen')
print('pintu MRT', len(ent_mrt))
# sampel titik di kawasan inti (grid 10 m) -> jarak ke jaringan + jarak jaringan
pts = [(x, z) for x in np.arange(CORE.bounds[0], CORE.bounds[2], 10) for z in np.arange(CORE.bounds[1], CORE.bounds[3], 10) if CORE.contains(Point(x, z))]
edges_geo = [(LineString(d['pts']), u, v, d['wlen']) for u, v, k, d in G.edges(keys=True, data=True)]
tree = STRtree([e[0] for e in edges_geo])
def net_dist(x, z, D):
    i = tree.nearest(Point(x, z)); ln, u, v, L = edges_geo[i]
    t = ln.project(Point(x, z)); off = ln.distance(Point(x, z))
    du, dv = D.get(u, 1e9), D.get(v, 1e9)
    return off + min(du + t, dv + (L - t)), off
tr500 = mrt800 = mrt400 = 0
for x, z in pts:
    dt, off = net_dist(x, z, D_tr); dm, _ = net_dist(x, z, D_mrt)
    tr500 += dt <= 500; mrt800 += dm <= 800; mrt400 += dm <= 400
tr500, mrt800, mrt400 = [100 * v / len(pts) for v in (tr500, mrt800, mrt400)]
# pedshed nyata: luas jangkauan jaringan 400 m / luas lingkaran 400 m (diukur di semua titik frame)
fr_pts = [(x, z) for x in np.arange(mrt[0] - 820, mrt[0] + 820, 10) for z in np.arange(mrt[1] - 820, mrt[1] + 820, 10) if FRAME.contains(Point(x, z))]
ped_r = {}
for R in (400, 800):
    circ = [p for p in fr_pts if math.hypot(p[0] - mrt[0], p[1] - mrt[1]) <= R]
    ok = sum(1 for p in circ if net_dist(*p, D_mrt)[0] <= R)
    ped_r[R] = 100 * ok / max(1, len(circ))
print('transit 500 m', round(tr500, 1), '| MRT 400/800', round(mrt400, 1), round(mrt800, 1), '| pedshed', {k: round(v, 1) for k, v in ped_r.items()})


# ---------------- grid akses & isokron dari jaringan OSM (menggantikan versi raster) ----------------
import base64, shapely
from PIL import Image
GW_, GH_ = d3['gmeta']['gw'], d3['gmeta']['gh']
jj, ii = np.mgrid[0:GH_, 0:GW_]
gx = ((ii * 4 + 2) - OX) * MPP; gz = ((jj * 4 + 2) - OY) * MPP
gp = shapely.points(gx.ravel(), gz.ravel())
lines_ = np.array([e[0] for e in edges_geo], dtype=object)
near_i = tree.query_nearest(gp, return_distance=False, all_matches=False)[1]
L_ = lines_[near_i]
tpos = shapely.line_locate_point(L_, gp); off = shapely.distance(L_, gp)
Ls = np.array([edges_geo[k][3] for k in near_i]); uu = [edges_geo[k][1] for k in near_i]; vv = [edges_geo[k][2] for k in near_i]
def grid_dist(D):
    du = np.array([D.get(u, 1e9) for u in uu]); dv = np.array([D.get(v, 1e9) for v in vv])
    return (off + np.minimum(du + tpos, dv + (Ls - tpos))).reshape(GH_, GW_)
D_main = nx.multi_source_dijkstra_path_length(G, list({nearest(*t['m']) for t in d3['transit'] if not t.get('kecil')}), weight='wlen')
G_tr = grid_dist(D_main); G_mrt = grid_dist(D_mrt)
menit = G_tr / 80.0   # ke stasiun MRT, halte BRT TransJakarta & terminal (angkutan massal)
def enc(a, lo, hi): return base64.b64encode((np.clip((a - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8).tobytes()).decode()
d3['grid']['akses'] = enc(menit, 0, 15); d3['grid']['iso'] = enc(np.minimum(G_mrt, 1600), 0, 1600)
d3['grid_sumber'] = 'jaringan jalan kaki OSM (OSMnx), 80 m/menit'
INS = np.frombuffer(base64.b64decode(json.load(open(W + 'data_v2.json'))['grid']['dalam']), np.uint8).reshape(GH_, GW_).astype(bool)
ov = dict(akses5=round(float((menit[INS] <= 5).mean() * 100), 1), akses10=round(float((menit[INS] <= 10).mean() * 100), 1),
          akses_rata=round(float(menit[INS].mean()), 1), akses_hist=np.histogram(np.minimum(menit[INS], 14.99), bins=np.arange(0, 16, 1))[0].tolist())
print('akses jaringan OSM', ov)
json.dump(d3, open(W + 'data3d.json', 'w'), separators=(',', ':'))

# ruas untuk animasi isokron (seluruh frame), jarak dari MRT di kedua ujung
CLS = {'primary': 0, 'primary_link': 0, 'secondary': 1, 'secondary_link': 1, 'tertiary': 2, 'tertiary_link': 2, 'residential': 3, 'living_street': 3, 'unclassified': 3, 'service': 4, 'footway': 5, 'pedestrian': 5, 'path': 5, 'steps': 5, 'cycleway': 5}
seg = []
for u, v, k, d in G.edges(keys=True, data=True):
    ln = LineString(d['pts'])
    if not ln.intersects(FRAME): continue
    p = d['pts']; d0, d1 = D_mrt.get(u, 9999), D_mrt.get(v, 9999)
    seg.append(dict(p=[round(c, 1) for xy in p for c in xy], d=[round(min(d0, 9999)), round(min(d1, 9999))], c=CLS.get(hw(d), 4),
                    n=str(d.get('name', ''))[:40] if not isinstance(d.get('name'), list) else str(d['name'][0])[:40]))
print('ruas ekspor', len(seg))

# ---------------- blok & Spacematrix ----------------
lines = [LineString(d['pts']) for u, v, k, d in G.edges(keys=True, data=True) if hw(d) != 'service' or jalan_umum(d)]
polys = list(polygonize(unary_union(lines)))
B = d3['bld']
bpoly = [Polygon(list(zip(b['p'][0::2], b['p'][1::2]))).buffer(0) for b in B]
btree = STRtree([Point(*b['c']) for b in B])
blocks = []
for pg in polys:
    if pg.area < 300 or not CORE.contains(pg.representative_point()): continue
    ids = btree.query(pg, predicate='contains')
    if len(ids) == 0 and pg.area < 3000: continue        # pulau lalu lintas / median, bukan blok
    fp = sum(B[i]['a'] for i in ids); gfa = sum(B[i]['a'] * B[i]['f'] for i in ids)
    gsi, fsi = fp / pg.area, gfa / pg.area
    uses = {}
    for i in ids: uses[B[i]['u']] = uses.get(B[i]['u'], 0) + B[i]['a']
    s = pg.simplify(1.0)
    blocks.append(dict(p=[round(c, 1) for xy in list(s.exterior.coords)[:-1] for c in xy], a=round(pg.area), kel=round(pg.length), n=len(ids),
                       gsi=round(gsi, 3), fsi=round(fsi, 2), L=round(fsi / gsi, 1) if gsi > 0 else 0, u=max(uses, key=uses.get) if uses else 0))
per = np.array([b['kel'] for b in blocks if b['n'] > 0])
b250, b400 = float((per < 250).mean() * 100), float((per < 400).mean() * 100)
# tipe Spacematrix (Berghauser Pont & Haupt 2010), disederhanakan
def tipe(b):
    if b['n'] == 0 or b['gsi'] < .05: return 'Ruang terbuka'
    if b['L'] >= 7: return 'Tinggi'
    if b['gsi'] >= .45: return 'Rendah padat' if b['L'] < 3 else 'Menengah padat'
    return 'Rendah renggang' if b['L'] < 3 else 'Menengah renggang'
for b in blocks: b['t'] = tipe(b)
print('blok', len(blocks), 'keliling<250', round(b250, 1), '<400', round(b400, 1), 'median keliling', round(float(np.median(per))))

# ---------------- skor ITDP (indikator yang bisa dihitung dari OSM) ----------------
def band(v, th, pts_):
    for t, p in zip(th, pts_):
        if v >= t: return p
    return 0
idens = len(inter) / AREA_KM2
uses_present = set()
for b in B:
    if CORE.contains(Point(*b['c'])): uses_present.add(b['u'])
kat_poi = set(p[2] for p in d3['poi'] if CORE.contains(Point(p[0], p[1])))
mix_k = {'hunian': 3 in uses_present, 'kantor/komersial': 4 in uses_present or 3 in kat_poi, 'ritel': 0 in kat_poi or 1 in kat_poi,
         'sipil/publik': 5 in uses_present or 8 in uses_present, 'ruang terbuka': True, 'akomodasi': 2 in kat_poi}
ITDP = [
    dict(k='1.2', p='WALK', n='Blok kecil (keliling < 250 m)', v=round(b250, 1), u='% blok', s=band(b250, [90, 75, 50], [3, 2, 1]), m=3),
    dict(k='3.1', p='CONNECT', n='Kepadatan persimpangan', v=round(idens), u='/km²', s=band(idens, [120, 100, 80, 60, 40], [5, 4, 3, 2, 1]), m=5),
    dict(k='3.2', p='CONNECT', n='Blok keliling < 400 m', v=round(b400, 1), u='% blok', s=band(b400, [90, 75, 60, 40], [4, 3, 2, 1]), m=4),
    dict(k='3.3', p='CONNECT', n='Kelurusan rute (jaringan/garis lurus)', v=round(directness, 2), u='rasio', s=3 if directness < 1.3 else 2 if directness < 1.5 else 1 if directness < 1.8 else 0, m=3),
    dict(k='3.4', p='CONNECT', n='Indeks konektivitas (ruas/simpul)', v=round(conn_idx, 2), u='rasio', s=band(conn_idx, [1.6, 1.4, 1.2], [3, 2, 1]), m=3),
    dict(k='4.1', p='TRANSIT', n='Kawasan ≤ 500 m jalan kaki ke halte/stasiun', v=round(tr500, 1), u='% luas', s=2 if tr500 >= 99.95 else 1 if tr500 >= 80 else 0, m=2),
    dict(k='5.1', p='MIX', n='Kategori guna lahan komplementer', v=sum(mix_k.values()), u='dari 6', s=min(5, max(0, sum(mix_k.values()) if sum(mix_k.values()) >= 2 else 0)), m=5),
]
itdp_s, itdp_m = sum(i['s'] for i in ITDP), sum(i['m'] for i in ITDP)
print('ITDP terhitung', itdp_s, '/', itdp_m, [(i['k'], i['v'], i['s']) for i in ITDP])

# ---------------- kelengkapan data OSM ----------------
nb_in = [b for b in B if CORE.contains(Point(*b['c']))]
mutu = dict(
    bangunan=len(nb_in), lantai_osm=round(100 * sum(1 for b in nb_in if b['s'].startswith('OSM')) / len(nb_in), 1),
    bernama=round(100 * sum(1 for b in nb_in if b['n']) / len(nb_in), 1), trotoar=round(100 * sw / max(1, dl), 1),
    poi=sum(1 for p in d3['poi'] if CORE.contains(Point(p[0], p[1]))), halte=sum(1 for t in d3['transit'] if CORE.contains(Point(*t['m']))),
)
stat = dict(
    luas_km2=round(AREA_KM2, 3), simpul=v_n, ruas=e_n, persimpangan=len(inter), dens_simpang=round(idens), dead_end=round(100 * len(dead) / max(1, len(cin)), 1),
    dens_jalan=round(len_in / 1000 / AREA_KM2, 1), ped_km=round(ped_len / 1000, 2), ped_dens=round(ped_len / 1000 / AREA_KM2, 1),
    penyeberangan=cross, dens_penyeberangan=round(cross / AREA_KM2, 1), circuity=round(directness, 2), meshed=round(mesh, 3), konektivitas=round(conn_idx, 2),
    entropi=round(H, 3), phi=round(phi, 3), orientasi=[round(float(v), 4) for v in pr],
    tr500=round(tr500, 1), mrt400=round(mrt400, 1), mrt800=round(mrt800, 1), pedshed400=round(ped_r[400], 1), pedshed800=round(ped_r[800], 1),
    blok_n=len(blocks), blok250=round(b250, 1), blok400=round(b400, 1), blok_med=round(float(np.median(per))),
    gsi=round(sum(b['gsi'] * b['a'] for b in blocks) / sum(b['a'] for b in blocks), 3), fsi=round(sum(b['fsi'] * b['a'] for b in blocks) / sum(b['a'] for b in blocks), 2),
    ov=ov, pintu=len(ent_mrt), simpang=[[round(c, 1) for c in utm2w(Gcu.nodes[n]['x'], Gcu.nodes[n]['y'])] for n in inter], itdp_s=itdp_s, koreksi_private=n_koreksi, itdp_m=itdp_m, mix_k=mix_k, mutu=mutu,
    tipe={t: sum(1 for b in blocks if b['t'] == t) for t in sorted(set(b['t'] for b in blocks))},
)
print(json.dumps({k: v for k, v in stat.items() if k != 'orientasi'}, ensure_ascii=False))
json.dump(dict(seg=seg, blok=blocks, itdp=ITDP, stat=stat), open(W + 'data_osm.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('data_osm.json', round(os.path.getsize(W + 'data_osm.json') / 1e6, 2), 'MB')
