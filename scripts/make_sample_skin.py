"""Creates an ORIGINAL illustrative 64x64 skin, not a reconstruction of the user's skin."""
from PIL import Image, ImageDraw
from pathlib import Path
import random
R=random.Random(27)
root=Path(__file__).resolve().parents[1]
im=Image.new('RGBA',(64,64),(0,0,0,0));d=ImageDraw.Draw(im)
def fill(x,y,w,h,rgb,noise=2):
 for yy in range(y,y+h):
  for xx in range(x,x+w):
   shift=R.randint(-noise,noise) if noise else 0
   d.point((xx,yy),fill=tuple(max(0,min(255,c+shift)) for c in rgb)+(255,))
def box(u,v,w,h,dep,rgb):
 for x,y,ww,hh in [(u+dep,v,w,dep),(u+dep+w,v,w,dep),(u,v+dep,dep,h),(u+dep,v+dep,w,h),(u+dep+w,v+dep,dep,h),(u+dep*2+w,v+dep,w,h)]:fill(x,y,ww,hh,rgb)
# Basic body / limbs and skin shades
box(0,0,8,8,8,(194,169,145))
box(16,16,8,12,4,(34,29,26))
box(40,16,4,12,4,(203,198,188))
box(32,48,4,12,4,(203,198,188))
box(0,16,4,12,4,(48,43,39))
box(16,48,4,12,4,(48,43,39))
# Hair and face: front of head x8..15, y8..15
fill(8,8,8,3,(45,35,27))
fill(8,11,1,2,(54,40,31));fill(15,11,1,2,(54,40,31))
# teal hair accents
fill(11,8,2,2,(26,132,131));fill(12,10,1,2,(17,101,107))
# light surrounding eye area and clear eye positions x2,x5 y3 within face
fill(9,11,2,2,(216,229,223));fill(13,11,2,2,(216,229,223))
fill(10,11,1,2,(8,125,130));fill(13,11,1,2,(8,125,130))
fill(8,13,8,3,(221,213,199));fill(9,13,6,1,(224,217,205))
# head sides and back brown hair
for x,y,w,h in [(0,8,8,3),(16,8,8,3),(24,8,8,5),(8,0,8,8)]:fill(x,y,w,h,(52,38,28))
# outer hair accessory UV: mostly transparent, front strands and accent
fill(40,8,8,1,(48,37,28))
fill(43,8,3,2,(29,143,139))
# white coat jacket outer UV; front at (20,36)-(27,47), opening shirt at x23-24
for r in [(16,32,8,4),(20,36,8,12),(16,36,4,12),(28,36,4,12),(32,36,8,12)]:
 fill(*r,(218,211,199),3)
fill(22,36,4,11,(42,32,26))
fill(21,36,1,9,(236,232,218));fill(26,36,1,9,(236,232,218))
fill(23,36,1,2,(221,210,192))
# sleeves overlay
box(40,32,4,12,4,(225,219,208));box(48,48,4,12,4,(225,219,208))
# small trouser overlays at bottom
fill(4,36,4,12,(54,51,47));fill(20,52,4,12,(54,51,47))
out=root/'web/assets/sample-skin.png';im.save(out)
# App/tray icon from user's supplied reference, cropped in a small opaque disc.
source=Image.open(root/'assets/reference/ZpkDxGames-pfp.png').convert('RGBA')
icon=source.resize((256,256),Image.Resampling.LANCZOS)
(root/'src-tauri/icons').mkdir(exist_ok=True,parents=True)
icon.save(root/'src-tauri/icons/icon.png')
icon.save(root/'src-tauri/icons/32x32.png') if False else None
icon.resize((32,32),Image.Resampling.LANCZOS).save(root/'src-tauri/icons/32x32.png')
icon.save(root/'src-tauri/icons/icon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Generated sample skin (not exact user skin) and app icons.')
