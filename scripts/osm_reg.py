import osmnx as ox, numpy as np, json, math, os
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.signal import fftconvolve
Image.MAX_IMAGE_PIXELS=None
SRC=os.environ.get('BLOKM_MAP', '../Map/')
full=np.array(Image.open(SRC+'osm.png').convert('RGB')).astype(int)
FH,FW=full.shape[:2]; SF=1400/FW
R,G,B=full[...,0],full[...,1],full[...,2]; mx=full.max(-1); mn=full.min(-1); sat=mx-mn
def near(hexs,tol):
    m=np.zeros(R.shape,bool)
    for h in hexs:
        r,g,b=int(h[1:3],16),int(h[3:5],16),int(h[5:7],16); m|=(abs(R-r)<=tol)&(abs(G-g)<=tol)&(abs(B-b)<=tol)
    return m
road=((mn>=244)&(sat<=8))|near(['#fcd6a4','#f7fabf','#f8f8f8'],9)
rt=np.array(Image.fromarray((road*255).astype(np.uint8)).resize((1400,717),Image.BOX))/255.
# OSM
import osmnx.settings
ox.settings.useful_tags_way=list(set(ox.settings.useful_tags_way+['name','surface','sidewalk','footway']))
G_=ox.graph_from_xml('build/osm/blokm.osm',simplify=False,retain_all=True)
F=ox.features_from_xml('build/osm/blokm.osm',tags={'railway':['station','subway_entrance'],'public_transport':'station'})
print(F[[c for c in ['name','railway','station','public_transport'] if c in F]].head(30).to_string())
from pyproj import Transformer
T=Transformer.from_crs(4326,32748,always_xy=True)
mrt=F.loc[('node',6196107726)].geometry
E0,N0=T.transform(mrt.x,mrt.y)
print('MRT',mrt.x,mrt.y)
_,ed=ox.graph_to_gdfs(G_)
W={'primary':7,'primary_link':4,'secondary':6,'secondary_link':4,'tertiary':5,'tertiary_link':3,'residential':3,'living_street':3,'service':2,'unclassified':3}
segs=[]
for _,r in ed.iterrows():
    hw=r['highway']; hw=hw[0] if isinstance(hw,list) else hw
    if hw not in W: continue
    xs,ys=r.geometry.xy; e,n=T.transform(np.array(xs),np.array(ys))
    segs.append((e-E0,n-N0,W[hw]))
def rast(s,th,dx,dy):
    im=Image.new('L',(1400,717),0); d=ImageDraw.Draw(im); c,sn=math.cos(th),math.sin(th)
    for e,n,w in segs:
        x=e*c-n*sn; y=e*sn+n*c
        pts=list(zip(515+dx+x/(1.44*s),462+dy-y/(1.44*s)))
        d.line(pts,fill=255,width=max(1,int(round(w/(1.44*s)))))
    return np.array(im)/255.
best=None
rz=rt-rt.mean()
for s in np.arange(.94,1.07,.01):
  for thd in [-1.5,-.75,0,.75,1.5]:
    m=rast(s,math.radians(thd),0,0)
    cc=fftconvolve(rz,m[::-1,::-1],mode='same')
    # restrict to +-60px
    cy,cx=717//2,1400//2
    win=cc[cy-60:cy+61,cx-60:cx+61]; j=np.unravel_index(win.argmax(),win.shape)
    v=win[j]; dy,dx=j[0]-60,j[1]-60
    if best is None or v>best[0]: best=(v,s,thd,dx,dy)
print('best',best)
v,s,thd,dx,dy=best
for s2 in np.arange(s-.008,s+.009,.002):
  for t2 in np.arange(thd-.5,thd+.51,.25):
    m=rast(s2,math.radians(t2),0,0); cc=fftconvolve(rz,m[::-1,::-1],mode='same')
    win=cc[717//2-60:717//2+61,700-60:700+61]; j=np.unravel_index(win.argmax(),win.shape)
    if win[j]>best[0]: best=(win[j],s2,t2,j[1]-60,j[0]-60)
print('refined',best)
v,s,thd,dx,dy=best
m=rast(s,math.radians(thd),dx,dy)
ov=np.stack([rt*255,(m*255),np.zeros_like(rt)],-1).astype(np.uint8)
Image.fromarray(ov).save('build/osm/osm_reg.png')
json.dump(dict(E0=E0,N0=N0,s=float(s),th=float(thd),dx=float(dx),dy=float(dy)),open('build/osm/reg.json','w'))
