import sys, json, glob, numpy as np, cv2, os
W,H=360,640; os.chdir(sys.argv[1]); out=sys.argv[2]
items=[]
for meta_f in sorted(glob.glob("*.gray.meta.json")):
    v=meta_f.split(".")[0]; meta=json.load(open(meta_f))
    for t,tr in enumerate(meta.get("tracks",[])): items.append((v,t,tr["pts"]))
json.dump([[v,t] for v,t,_ in items],open(out+"_index.json","w"))
tiles=[]
for n,(v,t,pts) in enumerate(items):
    raw=np.memmap(v+".gray",dtype=np.uint8,mode="r"); mid=pts[len(pts)//2]["i"]
    f=raw[mid*W*H:(mid+1)*W*H].reshape(H,W)
    im=cv2.cvtColor(f,cv2.COLOR_GRAY2BGR)
    xs=[p["x"] for p in pts]; ys=[p["y"] for p in pts]
    x0=max(0,min(xs)-50); x1=min(W,max(xs)+50); y0=max(0,min(ys)-50); y1=min(H,max(ys)+50)
    for a,b in zip(pts,pts[1:]): cv2.line(im,(a["x"],a["y"]),(b["x"],b["y"]),(0,255,255),1)
    for p in pts: cv2.circle(im,(p["x"],p["y"]),2,(0,0,255),-1)
    crop=cv2.resize(im[y0:y1,x0:x1],(140,140))
    cv2.rectangle(crop,(0,0),(44,13),(0,0,0),-1); cv2.putText(crop,str(n),(2,11),0,0.4,(0,255,0),1)
    tiles.append(crop)
for g in range(0,len(tiles),60):
    T=tiles[g:g+60]
    while len(T)%10: T.append(np.zeros_like(T[0]))
    cv2.imwrite(f"{out}_{g//60}.jpg",np.vstack([np.hstack(T[i:i+10]) for i in range(0,len(T),10)]))
print(len(items),"tracks")
