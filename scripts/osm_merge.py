import xml.etree.ElementTree as ET, glob, collections
src = sorted(glob.glob('build/osm/osm_*.osm'))
nodes, ways, rels = {}, {}, {}
for f in src:
    r = ET.parse(f).getroot()
    for e in r:
        d = {'node': nodes, 'way': ways, 'relation': rels}.get(e.tag)
        if d is not None: d[e.get('id')] = e
root = ET.Element('osm', version='0.6', generator='merge')
ET.SubElement(root, 'bounds', minlat='-6.2510', minlon='106.7880', maxlat='-6.2350', maxlon='106.8135')
for d in (nodes, ways, rels):
    for e in d.values(): root.append(e)
ET.ElementTree(root).write('build/osm/blokm.osm', encoding='utf-8', xml_declaration=True)
print(len(nodes), len(ways), len(rels))
c = collections.Counter()
for w in ways.values():
    t = {x.get('k'): x.get('v') for x in w.findall('tag')}
    if 'building' in t: c['building'] += 1; c['b_levels'] += 'building:levels' in t; c['b_height'] += 'height' in t; c['b_name'] += 'name' in t
    if 'highway' in t: c['hw:' + t['highway']] += 1
    if 'landuse' in t: c['lu:' + t['landuse']] += 1
    if 'leisure' in t: c['le:' + t['leisure']] += 1
for n in nodes.values():
    t = {x.get('k'): x.get('v') for x in n.findall('tag')}
    for k in ('amenity', 'shop', 'public_transport', 'tourism', 'office', 'leisure'):
        if k in t: c['poi:' + k] += 1
for k, v in sorted(c.items()): print(k, v)
