# Bundel data web (bisa dibuka lewat file:// tanpa server). Data berat dipisah agar dimuat hanya saat dibutuhkan:
#   aset.js (peta minimal) | aset_peta.js, aset_satelit.js (saat dipilih) | data_angin.js (saat lensa Angin dibuka)
import base64, json, subprocess, sys, os
def webp(k): return 'data:image/webp;base64,' + base64.b64encode(open(f'build/{k}.webp', 'rb').read()).decode()
open('build/aset_semua.js', 'w').write('window.ASET=' + json.dumps({k: webp(k) for k in ['dasar', 'peta', 'satelit']}) + ';')
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'bundle_web.py'), 'build/', './', 'build/aset_semua.js'], check=True)
