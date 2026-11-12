#!/usr/bin/env python3
"""Build Operator's type-led identity from the bundled OFL-licensed Geist font."""
from pathlib import Path
import shutil,json,hashlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg
root=Path(__file__).resolve().parents[1];source=root/'.state/geist-package';out=root/'docs/brand';fonts=out/'fonts';fonts.mkdir(exist_ok=True)
if source.is_dir():
 for weight in [400,500,600]:shutil.copyfile(source/f'geist-latin-{weight}-normal.woff2',fonts/f'geist-latin-{weight}-normal.woff2')
 shutil.copyfile(source/'LICENSE',fonts/'OFL.txt')
def word(text,weight):
 f=TTFont(fonts/f'geist-latin-{weight}-normal.woff2');g=f.getGlyphSet();mapping=f.getBestCmap();paths=[];x=0;bounds=[]
 for char in text:
  name=mapping[ord(char)];p=SVGPathPen(g);g[name].draw(p);b=BoundsPen(g);g[name].draw(b)
  paths.append(f'<path d="{p.getCommands()}" transform="translate({x} 0)"/>')
  if b.bounds:bounds.append((b.bounds[0]+x,b.bounds[1],b.bounds[2]+x,b.bounds[3]))
  x+=f['hmtx'][name][0]-f['head'].unitsPerEm*.028
 box=(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
 return ''.join(paths),box
mark,mb=word('op',600);wm,wb=word('operator',500)
def fit(paths,box,x,y,w,h):
 a,b,c,d=box;scale=min(w/(c-a),h/(d-b));left=x+(w-(c-a)*scale)/2-a*scale;top=y+(h-(d-b)*scale)/2+d*scale
 return f'<g transform="translate({left:.5f} {top:.5f}) scale({scale:.6f} {-scale:.6f})">{paths}</g>'
def svg(w,h,body,title):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{title}</title>{body}</svg>\n'
(out/'operator-mark.svg').write_text(svg(128,128,'<g fill="currentColor">'+fit(mark,mb,12,20,104,88)+'</g>','Operator op monogram'))
(out/'operator-wordmark.svg').write_text(svg(500,130,'<g fill="currentColor">'+fit(wm,wb,3,20,494,90)+'</g>','Operator'))
(out/'operator-avatar.svg').write_text(svg(512,512,'<rect width="512" height="512" rx="112" fill="#f4f4f2"/><g fill="#121212">'+fit(mark,mb,92,97,328,318)+'</g>','Operator'))
(out/'preview.svg').write_text(svg(1200,630,'<rect width="1200" height="630" fill="#121212"/><rect x="240" y="243" width="144" height="144" rx="32" fill="#f4f4f2"/><g fill="#121212">'+fit(mark,mb,266,270,92,90)+'</g><g fill="#f4f4f2">'+fit(wm,wb,436,264,510,100)+'</g>','Operator'))
for filename in ['preview','operator-avatar']:cairosvg.svg2png(url=str(out/(filename+'.svg')),write_to=str(out/(filename+'.png')))
for weight,name in [(500,'medium'),(400,'regular')]:
 f=TTFont(fonts/f'geist-latin-{weight}-normal.woff2');f.flavor=None;f.save(root/f'.state/geist-{name}.ttf')
(out/'source.json').write_text(json.dumps({'font':'Geist','package':'@fontsource/geist','version':'5.3.0','license':'SIL Open Font License1.1','source':'https://www.npmjs.com/package/@fontsource/geist','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in fonts.glob('*')}},indent=2)+'\n')
