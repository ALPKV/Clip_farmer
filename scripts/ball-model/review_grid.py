import sys, json, numpy as np, cv2
W,H=360,640
name,start,n,outf=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
meta=json.load(open(f"{name}.gray.meta.json")); idx=[k for k,r in enumerate(meta["rows"]) if r["label"]==1]
raw=np.memmap(f"{name}.gray",dtype=np.uint8,mode="r"); out=[]
for j,k in enumerate(idx[start:start+n]):
    r=meta["rows"][k]; f=raw[r["i"]*W*H:(r["i"]+1)*W*H].reshape(H,W)
    x,y=int(r["x"]),int(r["y"]); x0,y0=max(0,x-16),max(0,y-16)
    c=np.zeros((32,32),np.uint8); p=f[y0:y0+32,x0:x0+32]; c[:p.shape[0],:p.shape[1]]=p
    c=cv2.cvtColor(cv2.resize(c,(96,96),interpolation=cv2.INTER_NEAREST),cv2.COLOR_GRAY2BGR)
    cv2.circle(c,(3*(x-x0),3*(y-y0)),10,(0,0,255),1)
    cv2.putText(c,str(start+j),(2,12),0,0.4,(0,255,255),1); out.append(c)
while len(out)%10: out.append(np.zeros_like(out[0]))
cv2.imwrite(outf,np.vstack([np.hstack(out[k:k+10]) for k in range(0,len(out),10)]))
print(len(idx))
