IB="Idle_Loop"
# door pull-open: right hand on the handle, handle swings on a 0.8 m door hinged on the avatar's left
HX,HY=0.42,-0.45
def door(a0,a1):
    def f(t):
        a=lerp(a0,a1,ease((t-0.2)/0.6)); return V(HX-0.7*math.cos(a),HY+0.7*math.sin(a),1.0)
    return f
make_clip("Door_Open_Pull",IB,60,ik={'r':door(0,math.radians(55))},rot={'spine_01':lambda t:Euler((0.08,0,0))},woff={'r':V(0.0,0.07,-0.02)})
make_clip("Door_Close",IB,60,ik={'r':door(math.radians(55),0)},rot={'spine_01':lambda t:Euler((0.08,0,0))},woff={'r':V(0.0,0.07,-0.02)})
make_clip("Door_Push_Open",IB,60,ik={'r':lambda t:V(-0.12,lerp(-0.40,-0.58,ease((t-0.2)/0.5)),1.15)},rot={'spine_01':lambda t:Euler((0.10*ease((t-0.2)/0.5),0,0))},woff={'r':V(0.0,0.06,-0.08)})
# in-place turns (root yaw ramps; the walk system applies the final heading)
make_clip("Turn_L90",IB,30,rot={'root':lambda t:Euler((0,0,math.radians(90)*ease(t))),'pelvis':lambda t:Euler((0,0.04*math.sin(math.pi*t),0))})
make_clip("Turn_R90",IB,30,rot={'root':lambda t:Euler((0,0,-math.radians(90)*ease(t))),'pelvis':lambda t:Euler((0,-0.04*math.sin(math.pi*t),0))})
# idle variants
make_clip("Idle_LookAround",IB,180,rot={'Head':lambda t:Euler((0.03*math.sin(TAU*2*t),0.45*math.sin(TAU*t),0)),'spine_03':lambda t:Euler((0,0.12*math.sin(TAU*t),0))})
make_clip("Idle_WeightShift",IB,150,rot={'pelvis':lambda t:Euler((0,0.05*math.sin(TAU*t),0)),'spine_02':lambda t:Euler((0,-0.06*math.sin(TAU*t),0))})
make_clip("Idle_CheckWatch",IB,90,ik={'l':lambda t:lerp(V(0.22,0.0,0.88),V(0.05,-0.30,1.15),ease(t/0.25)*(1-ease((t-0.75)/0.25)))},rot={'Head':lambda t:Euler((0.35*ease(t/0.25)*(1-ease((t-0.75)/0.25)),0,0))},woff={'l':V(0.12,0.0,-0.02)})
