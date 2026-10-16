# Full-size ANSI 104 layout -> key rects (units) + legend texture (top-down). Also a mouse top-view in the right strip.
from PIL import Image, ImageDraw, ImageFont
import json
U=1.0
rows=[ # (y, [(label,width) or ('',-gap)])
 (0,[('Esc',1),('',-1),('F1',1),('F2',1),('F3',1),('F4',1),('',-.5),('F5',1),('F6',1),('F7',1),('F8',1),('',-.5),('F9',1),('F10',1),('F11',1),('F12',1),('',-.25),('Prt',1),('Scr',1),('Pau',1)]),
 (1.25,[('`',1),('1',1),('2',1),('3',1),('4',1),('5',1),('6',1),('7',1),('8',1),('9',1),('0',1),('-',1),('=',1),('Back',2),('',-.25),('Ins',1),('Hm',1),('PgU',1),('',-.25),('Num',1),('/',1),('*',1),('-',1)]),
 (2.25,[('Tab',1.5),('Q',1),('W',1),('E',1),('R',1),('T',1),('Y',1),('U',1),('I',1),('O',1),('P',1),('[',1),(']',1),('\\',1.5),('',-.25),('Del',1),('End',1),('PgD',1),('',-.25),('7',1),('8',1),('9',1),('+',1,2)]),
 (3.25,[('Caps',1.75),('A',1),('S',1),('D',1),('F',1),('G',1),('H',1),('J',1),('K',1),('L',1),(';',1),("'",1),('Enter',2.25),('',-3.5),('4',1),('5',1),('6',1)]),
 (4.25,[('Shift',2.25),('Z',1),('X',1),('C',1),('V',1),('B',1),('N',1),('M',1),(',',1),('.',1),('/',1),('Shift',2.75),('',-1.25),('^',1),('',-1.25),('1',1),('2',1),('3',1),('Ent',1,2)]),
 (5.25,[('Ctrl',1.25),('Win',1.25),('Alt',1.25),('',6.25),('Alt',1.25),('Fn',1.25),('Mnu',1.25),('Ctrl',1.25),('',-.25),('<',1),('v',1),('>',1),('',-.25),('0',2),('.',1)]),
]
keys=[]
for y,row in rows:
    x=0
    for k in row:
        lab,w=k[0],k[1]; h=k[2] if len(k)>2 else 1
        if w<0: x+=-w; continue
        keys.append(dict(l=lab,x=x,y=y,w=w,h=h)); x+=w
W,H=22.5,6.25
PX=44; M=12; tw=int(W*PX)+2*M; th=int(H*PX)+2*M
img=Image.new('RGB',(1024,512),(20,21,24)); d=ImageDraw.Draw(img)
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',13); Fs=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',10)
except: F=Fs=ImageFont.load_default()
sx=(1024-2*M)/W  # keyboard occupies top region 1024 x (H*sx)
def R(x,y): return (M+x*sx, M+y*sx)
for k in keys:
    a=R(k['x']+.04,k['y']+.04); b=R(k['x']+k['w']-.04,k['y']+k['h']-.04)
    d.rounded_rectangle([a,b],radius=5,fill=(46,48,54))
    if k['l']:
        f=F if len(k['l'])<=2 else Fs; d.text((a[0]+6,a[1]+4),k['l'],fill=(205,210,220),font=f)
    if k['l'] in('F','J'): d.line([( (a[0]+b[0])/2-5,b[1]-7),((a[0]+b[0])/2+5,b[1]-7)],fill=(160,165,175),width=2)
kbH=M*2+H*sx
# mouse top view in the bottom strip: x 0..256 region below keyboard
my=int(kbH)+10; mb=[40,my,40+120,my+200]
d.rounded_rectangle(mb,radius=58,fill=(38,40,45)); d.line([(100,my+4),(100,my+80)],fill=(12,12,14),width=3)
d.line([(46,my+82),(154,my+82)],fill=(12,12,14),width=2); d.rounded_rectangle([93,my+22,107,my+56],radius=6,fill=(90,92,98))
img.save('kb_legend.png')
json.dump(dict(keys=keys,W=W,H=H,M=M,sx=sx,kbH=kbH,mouse=mb,tex=[1024,512]),open('layout.json','w'))
print(len(keys),'keys', kbH)
