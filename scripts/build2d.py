# Menyisipkan build/data.json (hasil analisis_spasial.py) ke template 2D -> 2d/index.html
t = open('scripts/template2d.html', encoding='utf-8').read()
d = open('build/data.json', encoding='utf-8').read()
open('2d/index.html', 'w', encoding='utf-8').write(t.replace('/*DATA*/null', d))
