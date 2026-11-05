# Bundel data untuk web (v5): pisahkan data berat agar dimuat hanya saat dibutuhkan
#   data3d.js     bangunan, pohon, grid, statistik angin ringkas (tanpa medan angin & jalur lama)
#   data_angin.js medan angin LBM (dimuat saat lensa Angin dibuka)
#   aset.js       tekstur peta minimal; aset_peta.js & aset_satelit.js dimuat saat dipilih
import json, base64, math, os, sys
import numpy as np
W = sys.argv[1] if len(sys.argv) > 1 else 'build/'      # folder JSON hasil analisis
OUT = sys.argv[2] if len(sys.argv) > 2 else './'
ASET = sys.argv[3] if len(sys.argv) > 3 else None                   # aset.js lama (berisi 3 tekstur)
def tulis(nama, isi): open(OUT + nama, 'w', encoding='utf-8').write(isi); print(nama, round(os.path.getsize(OUT + nama) / 1e3), 'KB')
J = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False)
h2 = lambda v: round(v * 2) / 2

d3 = json.load(open(W + 'data3d.json')); v2 = json.load(open(W + 'data_v2.json'))
# ---- statistik angin ringkas (sama dengan statAngin() di app, kecepatan referensi 2,6 m/s) ----
w = d3['wind']; nx, ny, cs, sc = w['nx'], w['ny'], w['cs'], w['scale']
EXT = d3['meta']['extent']; MPP = d3['meta']['mpp']; ORI = d3['meta']['origin']; GW, GH = d3['gmeta']['gw'], d3['gmeta']['gh']
lu = np.frombuffer(base64.b64decode(d3['grid']['lu']), np.uint8); dalam = np.frombuffer(base64.b64decode(v2['grid']['dalam']), np.uint8)
p = np.frombuffer(base64.b64decode(w['solid']), np.uint8); sol = np.unpackbits(p)[:nx * ny]
idx = np.nonzero((lu == 1) & (dalam == 1))[0]
X = ((idx % GW) * 4 + 2 - ORI[0]) * MPP; Z = ((idx // GW) * 4 + 2 - ORI[1]) * MPP
stat = {}
for k, f in w['dirs'].items():
    u = np.frombuffer(base64.b64decode(f['u']), np.int8).astype(float); v = np.frombuffer(base64.b64decode(f['v']), np.int8).astype(float)
    gx = (X - EXT[0]) / cs - .5; gz = (Z - EXT[1]) / cs - .5; i = np.floor(gx).astype(int); j = np.floor(gz).astype(int)
    ok = (i >= 0) & (j >= 0) & (i < nx - 1) & (j < ny - 1); i, j, gx, gz = i[ok], j[ok], gx[ok], gz[ok]; fx, fz = gx - i, gz - j; kk = j * nx + i
    bil = lambda a: ((a[kk] * (1 - fx) + a[kk + 1] * fx) * (1 - fz) + (a[kk + nx] * (1 - fx) + a[kk + nx + 1] * fx) * fz) / sc
    ms = np.hypot(bil(u), bil(v)) * 2.6 * .78; m = sol[kk] == 0; ms = ms[m]
    stat[k] = dict(rata=float(ms.mean()), stag=float((ms < .3).mean() * 100), nyaman=float(((ms >= .3) & (ms < 4)).mean() * 100), kencang=float((ms >= 4).mean() * 100))
print('statistik angin', {k: round(v['nyaman']) for k, v in stat.items()})

tulis('data_angin.js', 'window.DANGIN=' + J(w) + ';')
d = dict(d3); d['grid'] = {k: x for k, x in d3['grid'].items() if k != 'walk'}; d.pop('wind'); d.pop('paths', None); d.pop('grid_sumber', None); d.pop('poi_nama', None); d['angin_stat'] = stat
for b in d['bld']: b['p'] = [h2(x) for x in b['p']]; b['c'] = [h2(x) for x in b['c']]
d['trees'] = [[h2(t[0]), h2(t[1]), round(t[2], 1)] for t in d['trees']]
tulis('data3d.js', 'window.D3=' + J(d) + ';')
v = dict(v2); v['grid'] = {k: x for k, x in v2['grid'].items() if k not in ('bising', 'svf')}; v.pop('pv', None)
tulis('data_v2.js', 'window.DV2=' + J(v) + ';')
o = json.load(open(W + 'data_osm.json'))
for g in o['seg']: g['p'] = [h2(x) for x in g['p']]
tulis('data_osm.js', 'window.DOSM=' + J(o) + ';')
tulis('data_v4.js', 'window.DV4=' + open(W + 'data_v4.json', encoding='utf-8').read() + ';')
if ASET:
    a = json.loads(open(ASET).read()[len('window.ASET='):-1])
    tulis('aset.js', 'window.ASET=' + J({'dasar': a['dasar']}) + ';')
    tulis('aset_peta.js', 'window.ASET_PETA=' + J(a['peta']) + ';')
    tulis('aset_satelit.js', 'window.ASET_SATELIT=' + J(a['satelit']) + ';')
