F=90  # 3 s loops at 30 fps
def kb_hand(side):
    base=(KEY_D if side=='l' else KEY_K)+Vector((0,0,0.004))
    def fn(t):
        dx=0.012*math.sin(TAU*2*t+(0 if side=='l' else 1.3)); dz=0.008*max(0,math.sin(TAU*6*t+(0 if side=='l' else 2)))
        return base+Vector((dx,0.0,dz))
    return fn
make_clip("Sit_Type_Loop","Sitting_Idle_Loop",F,
  ik={'l':kb_hand('l'),'r':kb_hand('r')},
  rot={'index_01_l':fing('l',6,0),'index_01_r':fing('r',6,2),'middle_01_l':fing('l',5,1),'middle_01_r':fing('r',5,3),
       'spine_01':lambda t:Euler((0.12,0,0)),'spine_02':lambda t:Euler((0.12,0,0)),'Head':lambda t:Euler((0.10,0.04*math.sin(TAU*t),0))})
ANCH['Sit_Type_Loop']={'l':'kb','r':'kb'}
def mouse_r(t):
    return MOUSE_TOP+Vector((0.012,-0.035,-0.003))+Vector((0.02*math.sin(TAU*2*t),0.015*math.sin(TAU*3*t+0.7),0))
make_clip("Sit_Mouse_Loop","Sitting_Idle_Loop",F,
  ik={'r':mouse_r,'l':lambda t:KEY_D+Vector((0,0,0.004))},
  rot={'index_01_r':lambda t:Euler((0.2+0.4*max(0,math.sin(TAU*4*t)),0,0)),'spine_01':lambda t:Euler((0.12,0,0)),'spine_02':lambda t:Euler((0.12,0,0.06)),'Head':lambda t:Euler((0.1,-0.05,0))},woff={'r':Vector((-0.01,0.10,-0.012))})
MW={'r':Vector((-0.01,0.10,-0.012))}
ANCH['Sit_Mouse_Loop']={'l':'kb','r':'mouse'}
SB="Sitting_Idle_Loop"; LEAN={'spine_01':lambda t:Euler((0.12,0,0)),'spine_02':lambda t:Euler((0.12,0,0))}
DESKY=PEL_Y-0.42; DZ=DESK+0.005
def R(d): r=dict(LEAN); r.update(d); return r
# read monitor: hands resting on desk, head scanning the screen
make_clip("Sit_ReadMonitor_Loop",SB,120,ik={'l':lambda t:V(0.16,DESKY,DZ),'r':lambda t:V(-0.16,DESKY,DZ)},
  rot=R({'Head':lambda t:Euler((-0.05,0.10*math.sin(TAU*t),0))}),woff={'l':V(0.04,0.10,0.025),'r':V(-0.04,0.10,0.025)})
# write on paper: right fingertip (pen) scribbles small loops, left hand flat holding the page
PAPER=V(-0.06,PEL_Y-0.40,DZ+0.003)
make_clip("Sit_Write_Loop",SB,90,ik={'r':lambda t:PAPER+V(0.03*math.sin(TAU*3*t)+0.025*math.sin(TAU*t),0.006*math.sin(TAU*9*t),0.004*max(0,math.sin(TAU*9*t))),
  'l':lambda t:V(0.14,PEL_Y-0.42,DZ)},rot=R({'Head':lambda t:Euler((0.30,0,0)),'index_01_r':lambda t:Euler((0.5,0,0)),'middle_01_r':lambda t:Euler((0.4,0,0))}),
  woff={'r':V(-0.03,0.08,0.035),'l':V(0.04,0.10,0.02)})
# shuffle papers: both hands grip the stack edges, lift and tap it square twice
def shuf(x):
    return lambda t: V(x,PEL_Y-0.44,DZ+0.01+0.07*ease(math.sin(TAU*2*t)*0.5+0.5)*(1 if t<0.8 else 0))
make_clip("Sit_ShufflePapers",SB,90,ik={'l':shuf(0.12),'r':shuf(-0.12)},rot=R({'Head':lambda t:Euler((0.25,0,0))}),woff={'l':V(0.07,0.06,0.0),'r':V(-0.07,0.06,0.0)})
# seated phone: right fingertips at the temple, left hand on the desk
make_clip("Sit_Phone_Loop",SB,120,ik={'r':lambda t:CUR['head']+V(-0.07,-0.02,0.06),'l':lambda t:V(0.15,DESKY,DZ)},
  rot={'Head':lambda t:Euler((0.05,-0.10,0.12+0.03*math.sin(TAU*t)))},woff={'r':V(-0.05,0.02,-0.13),'l':V(0.04,0.10,0.025)})
# coffee: reach mug, lift to mouth, sip, put back
MUG=V(-0.26,PEL_Y-0.40,DESK+0.10)
def cof(t):
    k=ease((t-0.15)/0.2)*(1-ease((t-0.7)/0.2)); mouth=CUR['head']+V(-0.03,-0.10,-0.07)
    return lerp(MUG,mouth,k)
make_clip("Sit_Coffee",SB,120,ik={'r':cof,'l':lambda t:V(0.15,DESKY,DZ)},rot={},woff={'r':V(-0.05,0.06,-0.04),'l':V(0.04,0.10,0.025)})
# stretch: arms rise overhead and come back down to the desk
def st(x):
    def f(t):
        k=ease(t/0.35)*(1-ease((t-0.7)/0.25)); return lerp(V(x*0.16,DESKY+0.12,DZ+0.04),CUR['head']+V(x*0.18,0.02,0.38),k)
    return f
make_clip("Sit_Stretch",SB,120,ik={'l':st(1),'r':st(-1)},rot={'spine_03':lambda t:Euler((-0.15*ease(t/0.35)*(1-ease((t-0.7)/0.25)),0,0))},
  woff={'l':V(0.03,0.02,-0.12),'r':V(-0.03,0.02,-0.12)})
# lean back: torso reclines, hands laced behind the head
BR=lambda t: 0.015*math.sin(TAU*2*t)          # 2 breaths per 4 s loop (integer cycles = clean loop)
SKULL=lambda: CUR['head']+V(0,0.095,0.085)        # back of the skull, from the Head joint
make_clip("Sit_LeanBack_Loop",SB,120,
  ik={'l':lambda t:SKULL()+V(-0.012,0,0),'r':lambda t:SKULL()+V(0.012,0,0)},          # fingers interlaced: tips meet just past centre
  rot={'pelvis':lambda t:Euler((-0.10,0,0)),'spine_01':lambda t:Euler((-0.12+BR(t)*0.5,0,0)),'spine_02':lambda t:Euler((-0.08+BR(t),0,0)),
       'spine_03':lambda t:Euler((-0.05,0,0)),'neck_01':lambda t:Euler((0.10,0,0)),'Head':lambda t:Euler((0.08+0.02*math.sin(TAU*t),0.05*math.sin(TAU*t),0))},
  woff={'l':V(0.085,-0.005,-0.015),'r':V(-0.085,-0.005,-0.015)},
  pole={'l':lambda t:CUR['head']+V(0.32,-0.03,0.03),'r':lambda t:CUR['head']+V(-0.32,-0.03,0.03)})
# chair pull-out (standing): grab the chair back and draw it 0.3 m toward the body
def cp(x):
    return lambda t: V(x,lerp(-0.45,-0.30,ease((t-0.25)/0.5)),0.86)
make_clip("Chair_PullOut","Idle_Loop",60,ik={'l':cp(0.18),'r':cp(-0.18)},rot={'spine_01':lambda t:Euler((0.25,0,0)),'spine_02':lambda t:Euler((0.15,0,0))},
  woff={'l':V(0.03,0.09,0.03),'r':V(-0.03,0.09,0.03)})
