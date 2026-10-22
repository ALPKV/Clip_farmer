# Trains the ball model from reviewed TRACKS (not single crops). GOOD lists the track numbers from
# track_grid.py that are real ball flights; UNSURE ones are left out. See README.md.
import json, numpy as np, os, sys
S=sys.argv[1]  # folder holding ig/ (Instagram clips) and train/ (test videos)
rng=np.random.default_rng(0)
R=lambda a,b: list(range(a,b+1))
GOOD=set([1,2,3,4,7,8,9,10,11,12,17,18,19,20,21,22,23,24,25,26,27,
 60,61,69,70,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,111,112,113,114,115,116,
 121,122,123,124,127,128,129,133,134,135,136,137,138,139,140,141,142,146,147,148,149,150,153,154,155,156,167,168,169,170,171,172,175,176,177,178,179]
 +[x for x in R(180,212) if x!=213]+R(218,224)+R(226,228)+R(234,237)
 +R(262,269)+[271,272,274,275]+R(277,282)+R(293,299)
 +[301,302,303,304,305,306,307,309,310,311,312,316,317,318,319,320,321,324,325,326,327,333,334,335,336,337,338,346,347,348,349,350,351,352,354,355,359]
 +[360,363,366,367]+R(368,372)+R(376,384)+[386,388,389,390]+R(391,401)+[403,406,407,409]+R(416,421)+[428,429])
UNSURE=set(R(240,250)+R(284,292)+[322,323,329,330,331,332,339,340,341,344,345,408,423,424,425,431,109,110,117,144,210,211,212,213,229,230,231,232,238,239,251,252,253,35,36,37,38,39])
GOOD-=UNSURE
idx=json.load(open(S+"/ig/tg_index.json"))
good_tracks={(v,t) for n,(v,t) in enumerate(idx) if n in GOOD}
bad_tracks={(v,t) for n,(v,t) in enumerate(idx) if n not in GOOD and n not in UNSURE}
X=[];y=[];grp=[]
for v in sorted({v for v,_ in idx}):
    meta=json.load(open(f"{S}/ig/{v}.gray.meta.json")); dim=meta["dim"]
    F=np.fromfile(f"{S}/ig/{v}.gray.feat.bin",dtype=np.float32).reshape(-1,dim)
    rows=meta["rows"]; tr=np.array([r["track"] for r in rows])
    crowd=F[:,3]*6
    pos=[k for k,r in enumerate(rows) if (v,r["track"]) in good_tracks and crowd[k]<=1]
    hard=[k for k,r in enumerate(rows) if (v,r["track"]) in bad_tracks]
    rest=[k for k,r in enumerate(rows) if r["track"]<0]
    rest=list(rng.choice(rest,min(len(rest),1500),replace=False))
    for k in pos: X.append(F[k]); y.append(1); grp.append(v)
    for k in hard+rest: X.append(F[k]); y.append(0); grp.append(v)
X=np.array(X,np.float64); y=np.array(y); grp=np.array(grp)
P=9; base=6
def flip(x):
    x=x.copy()
    for off in (base,base+P*P): x[off:off+P*P]=x[off:off+P*P].reshape(P,P)[:,::-1].ravel()
    return x
pi=np.where(y==1)[0]
X=np.vstack([X,[flip(X[i]) for i in pi]]); y=np.concatenate([y,np.ones(len(pi))]); grp=np.concatenate([grp,grp[pi]])
mu=X.mean(0); sd=X.std(0)+1e-6
def fit(X,y,l2=5.0,epochs=600,lr=0.1):
    Z=(X-mu)/sd; w=np.zeros(Z.shape[1]); b=0.0
    pw=(y==0).sum()/max(1,(y==1).sum()); sw=np.where(y==1,pw,1.0); sw/=sw.mean()
    for _ in range(epochs):
        p=1/(1+np.exp(-(Z@w+b))); e=(p-y)*sw
        w-=lr*(Z.T@e/len(y)+l2*w/len(y)); b-=lr*e.mean()
    return w,b
def auc(s,y):
    o=np.argsort(s); r=np.empty(len(s)); r[o]=np.arange(1,len(s)+1); n1=(y==1).sum(); n0=len(y)-n1
    return (r[y==1].sum()-n1*(n1+1)/2)/(n1*n0)
# Grouped CV: hold out whole clips.
vids=np.array(sorted(set(grp))); rng.shuffle(vids); folds=np.array_split(vids,5); aucs=[]
for f in folds:
    te=np.isin(grp,f); tr=~te
    if (y[te]==1).sum()<5: continue
    w,b=fit(X[tr],y[tr]); aucs.append(auc(((X[te]-mu)/sd)@w+b,y[te]))
print("Instagram clips, held-out-clip AUC:",np.round(aucs,3),"mean",round(float(np.mean(aucs)),3))
w,b=fit(X,y)
# Test on the two raw videos with the earlier hand-checked labels (never used here).
POS={"A":{16,17,18,19,20,21,22,42,43,44,45,47,48,60,61,62,63,64,65,66,67,69,78,79,80,81,82,85,86,87,88,89,90,96,99,100,101,102,103,104,105,106,107,108,114,115,116,117,118},"B":{3,4,5,23,24,25,26,27}}
for v in "AB":
    meta=json.load(open(f"{S}/train/{v}.gray.meta.json")); F=np.fromfile(f"{S}/train/{v}.gray.feat.bin",dtype=np.float32).reshape(-1,meta["dim"]).astype(np.float64)
    rows=meta["rows"]; auto=[k for k,r in enumerate(rows) if r["label"]==1]
    yy=np.zeros(len(rows)); ok=np.ones(len(rows),bool)
    for j,k in enumerate(auto):
        if j in POS[v]: yy[k]=1
    s=((F-mu)/sd)@w+b
    print(f"video {v} (unseen): AUC {auc(s,yy):.3f}  ({int(yy.sum())} checked balls vs {len(yy)-int(yy.sum())} other blobs)")
print("train pos",int((y==1).sum()),"neg",int((y==0).sum()))
json.dump({"mu":mu.tolist(),"sd":sd.tolist(),"w":w.tolist(),"b":b,"patch":P},open(S+"/train/ball_model2.json","w"))
