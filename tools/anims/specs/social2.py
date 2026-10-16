IB="Idle_Loop"
make_clip("Wave",IB,60,ik={'r':lambda t:V(-0.30+0.08*math.sin(TAU*2*t),-0.10,1.72)},rot={'Head':lambda t:Euler((0,-0.1,0))},woff={'r':V(0.0,0.02,-0.18)})
make_clip("Point_Fwd",IB,60,ik={'r':lambda t:lerp(V(-0.24,-0.05,0.90),V(-0.22,-0.55,1.36),ease(t/0.3))},rot={},woff={'r':V(0.0,0.17,-0.01)})
def pres(t): return V(-0.50,lerp(-0.30,-0.15,0.5+0.5*math.sin(TAU*t)),lerp(1.10,1.45,0.5+0.5*math.sin(TAU*t+1)))
make_clip("Present_Loop",IB,120,ik={'r':pres,'l':lambda t:V(0.18,-0.25,1.05+0.03*math.sin(TAU*2*t))},rot={'Head':lambda t:Euler((0,-0.35+0.25*math.sin(TAU*t),0)),'spine_02':lambda t:Euler((0,-0.12,0))},
  woff={'r':V(0.10,0.10,-0.03),'l':V(0.03,0.12,-0.04)})
make_clip("Handshake",IB,60,ik={'r':lambda t:V(-0.06,-0.42,1.0+0.03*math.sin(TAU*3*t)*ease((t-0.2)/0.1))},rot={'spine_01':lambda t:Euler((0.06,0,0))},woff={'r':V(-0.02,0.10,0.0)})
# Freyja (receptionist, behind the lobby desk: counter top 1.05 m, 0.35 m in front)
CT=1.05
make_clip("Freyja_Desk_Idle",IB,120,ik={'l':lambda t:V(0.20,-0.36,CT),'r':lambda t:V(-0.20,-0.36,CT)},rot={'Head':lambda t:Euler((0,0.15*math.sin(TAU*t),0))},woff={'l':V(0.03,0.10,0.03),'r':V(-0.03,0.10,0.03)})
make_clip("Freyja_Greet",IB,90,ik={'r':lambda t:V(-0.30+0.07*math.sin(TAU*3*t),-0.12,1.70)},rot={'spine_01':lambda t:Euler((0.18*math.sin(math.pi*min(1,max(0,(t-0.55)/0.4))),0,0)),'Head':lambda t:Euler((0.15*math.sin(math.pi*min(1,max(0,(t-0.55)/0.4))),0,0))},woff={'r':V(0,0.02,-0.18)})
make_clip("Freyja_Guide",IB,90,ik={'r':lambda t:lerp(V(-0.24,-0.05,0.90),V(-0.50,-0.30,1.20),ease(t/0.35))},rot={'Head':lambda t:Euler((0,-0.5*ease(t/0.35)*(1-ease((t-0.7)/0.3)),0)),'spine_02':lambda t:Euler((0,-0.15*ease(t/0.35),0))},woff={'r':V(0.12,0.10,-0.02)})
# Hermod (store clerk, counter 1.0 m)
make_clip("Hermod_Register_Scan",IB,90,ik={'r':lambda t:lerp(V(-0.30,-0.40,1.02),V(0.06,-0.40,1.02),0.5-0.5*math.cos(TAU*2*t))+V(0,0,0.03*abs(math.sin(TAU*2*t))),'l':lambda t:V(0.22,-0.34,1.0)},rot={'Head':lambda t:Euler((0.25,0,0))},woff={'r':V(-0.03,0.09,0.04),'l':V(0.03,0.10,0.03)})
def shelf(x): return lambda t: lerp(V(x,-0.30,1.0),V(x,-0.48,1.55),ease(t/0.4)*(1-ease((t-0.6)/0.4)))
make_clip("Hermod_Shelve",IB,90,ik={'l':shelf(0.12),'r':shelf(-0.12)},rot={'Head':lambda t:Euler((-0.25*ease(t/0.4)*(1-ease((t-0.6)/0.4)),0,0))},woff={'l':V(0.06,0.07,-0.03),'r':V(-0.06,0.07,-0.03)})
def hand(x): return lambda t: lerp(V(x,-0.25,1.0),V(x,-0.52,1.12),ease((t-0.1)/0.4))
make_clip("Hermod_HandOver",IB,60,ik={'l':hand(0.11),'r':hand(-0.11)},rot={'spine_01':lambda t:Euler((0.12*ease((t-0.1)/0.4),0,0))},woff={'l':V(0.06,0.10,-0.03),'r':V(-0.06,0.10,-0.03)})
# arcade cabinet: stick on the left at 1.0 m, buttons right
make_clip("Arcade_Play_Loop",IB,60,ik={'l':lambda t:V(0.14+0.02*math.sin(TAU*4*t),-0.38+0.02*math.cos(TAU*3*t),1.02),'r':lambda t:V(-0.12,-0.40,0.99+0.012*max(0,math.sin(TAU*7*t)))},
  rot={'spine_01':lambda t:Euler((0.12,0,0)),'Head':lambda t:Euler((0.1,0,0))},woff={'l':V(0.0,0.06,-0.08),'r':V(-0.04,0.09,0.03)})
