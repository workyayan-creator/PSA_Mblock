# Unduh data OSM kawasan Blok M dari API resmi OpenStreetMap (4 petak, masing-masing di bawah batas 50.000 node).
# Overpass bisa diblokir di beberapa jaringan; API v0.6 ini cukup untuk area kecil.
import os, urllib.request
os.makedirs('build/osm', exist_ok=True)
LON = [106.7880, 106.8005, 106.8135]; LAT = [-6.2510, -6.2430, -6.2350]
k = 0
for i in (0, 1):
    for j in (0, 1):
        k += 1
        bbox = f'{LON[i]},{LAT[j]},{LON[i + 1]},{LAT[j + 1]}'
        url = f'https://api.openstreetmap.org/api/0.6/map?bbox={bbox}'
        req = urllib.request.Request(url, headers={'User-Agent': 'blok-m-feasibility-dashboard/3.0'})
        with urllib.request.urlopen(req, timeout=180) as r, open(f'build/osm/osm_{k}.osm', 'wb') as f:
            f.write(r.read())
        print(k, bbox, os.path.getsize(f'build/osm/osm_{k}.osm'), 'byte')
