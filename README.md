# Public Space Analysis · BLOK M

Peta 3D interaktif untuk menganalisis ruang publik **kawasan inti Blok M** (±29 ha, Jakarta Selatan). Penilaiannya memakai kerangka **Place Diagram dari Project for Public Spaces (PPS)**, lalu dibandingkan dengan skor kelayakan AHP hasil studi sebelumnya. Bisa dibuka di HP (potret dan lanskap), tablet, desktop, dan TV.

| Halaman | Isi |
|---|---|
| `index.html` | **Peta 3D v4**: 4 atribut PPS dengan 13 lensa, tema gelap/terang, orang, kendaraan, dan MRT bergerak |
| `2d/index.html` | **Dashboard 2D**: skor 4 parameter utama dalam radius 800 m dari MRT |

## Struktur analisis (Place Diagram PPS)

| Atribut | Lensa |
|---|---|
| Akses & Keterhubungan | Akses transit, Walkability (isokron jaringan nyata), Konektivitas blok (ITDP) |
| Kenyamanan & Citra | Termal & bayangan, Angin (CFD Lattice-Boltzmann), Kebisingan (jalan, busway, terminal), Ruang hijau 300 m |
| Kegunaan & Aktivitas | Keragaman fungsi, Kota 10 menit, Bentuk & kepadatan (Spacematrix) |
| Sosiabilitas | Keramaian per jam, Muka aktif jalan |

- Setiap atribut punya halaman ringkasan: indikator terukur (berlabel TERUKUR, AUDIT, atau MODEL), kualitas tak berwujud, dan pengukuran PPS yang masih perlu survei.
- Setiap lensa punya tombol **Metodologi**: apa yang diukur, rumus, data, asumsi, batasan, dan rujukan.
- **Ringkasan**: diagram cincin Place Diagram dan perbandingan skor PPS dengan skor AHP per atribut.

## Fitur tampilan

- **Tema gelap (bawaan) dan terang** untuk panel. Peta 3D selalu terang agar isi jalan terlihat jelas.
- **Navigasi menyesuaikan perangkat**:
  - Desktop: rel atribut di kiri dan panel di kanan.
  - Tablet: rel ikon dan panel yang bisa dilipat.
  - HP: tab bawah dan lembar geser.
  - TV: tampilan diperbesar dan bisa dikendalikan dengan tombol arah.
- **Menu bertingkat** (Menu, submenu, opsi) beranimasi. Sudut pandang hanya ada di toolbar atas.
- **Panduan singkat** saat pertama dibuka, tur cerita 8 langkah, dan pintasan keyboard/remote.
- **Simulasi 3D**:
  - Orang berjalan, berkelompok, duduk, dan menunggu; jumlahnya mengikuti keramaian per jam.
  - Mobil, motor, bus kota, dan TransJakarta di lajur kiri mengikuti arah jalan OSM, dengan lampu kendaraan di malam hari.
  - MRT berhenti 30 detik di stasiun dengan kecepatan nyata. Headway asli 5/10 menit, tampil dengan rasio 1:3 secara bawaan (bisa diubah ke 1:1 atau 1:2 di menu Lapisan 3D).
  - Kendaraan hanya melewati jalan kendaraan (tidak menembus taman) dan tetap di dalam batas peta. Lajur menyesuaikan kelas jalan.
- **Ringan**: data berat (medan angin, peta OSM, citra satelit) dimuat hanya saat dibutuhkan. Muatan awal ±3,3 MB, sebelumnya ±6,2 MB. Kualitas grafis otomatis turun ke mode hemat bila perangkat berat; bisa diatur di menu Lapisan 3D.

## Menjalankan

Klik dua kali `index.html`. Tidak perlu server, karena data dan gambar sudah dibundel. `data_angin.js`, `aset_peta.js`, dan `aset_satelit.js` dimuat otomatis saat lensa atau peta dasarnya dipilih. Tambahkan `?lite` di URL untuk perangkat lemah.

## GitHub Pages

1. Unggah seluruh isi folder ini ke repo (`index.html` di root).
2. **Settings → Pages → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Tautan langsung ke lensa memakai hash, misalnya `#pakses`, `#bising`, `#muka`.

## Mengubah kode

```sh
npm install
npm run build          # src/app.js -> app.js
cp src/index.html index.html
```

## Mengolah ulang data

```sh
pip install numpy scipy scikit-image pillow osmnx momepy
python scripts/analisis_spasial.py   # grid dasar (dashboard 2D)
python scripts/build2d.py
python scripts/prep3d.py             # tekstur, pohon dari citra satelit
python scripts/ambil_osm.py          # unduh OSM (api.openstreetmap.org)
python scripts/osm_merge.py
python scripts/osm_reg.py            # registrasi ke peta dasar (hasil kami: scripts/reg.json)
python scripts/prep_osm.py           # bangunan, POI, halte dari OSM + medan angin LBM
python scripts/analisis_v2.py        # fasilitas, RTH, termal pendukung
python scripts/analisis_osm.py       # graf jalan OSMnx, Spacematrix, ITDP
python scripts/analisis_v4.py        # kebisingan OSM + terminal, muka aktif, rute kendaraan
python scripts/bundle_data3d.py
```

## Batasan

- Kebisingan, indeks panas, angin, dan keramaian adalah **model**, jadi pakai untuk membandingkan lokasi, bukan sebagai angka absolut.
- Kualitas tak berwujud PPS dan pengukuran sosial (komposisi pengunjung, kriminalitas, kebersihan) perlu survei lapangan seperti Place Game dan behavior mapping.
- Data OSM hanya memuat yang sudah dipetakan.

## Atribusi

- Peta © kontributor [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL. Citra satelit: Google Earth, jadi periksa ketentuannya sebelum repo dibuat publik.
- Kerangka: [Project for Public Spaces](https://www.pps.org/article/grplacefeat). Metode OSM: [open-urban-analysis](https://github.com/dzakybd/open-urban-analysis). Ambang ITDP: [Urban-Design-Skills](https://github.com/Abhinavbwj/Urban-Design-Skills-Claude).
- Perangkat: [OSMnx](https://github.com/gboeing/osmnx) (MIT), NetworkX, momepy, shapely (BSD), [three.js](https://threejs.org), camera-controls, anime.js (MIT), [Apache ECharts](https://echarts.apache.org) (Apache-2.0). Font Plus Jakarta Sans (OFL).
