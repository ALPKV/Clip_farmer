# Trains the ball / not-ball classifier. POS lists the auto-labelled crops that were checked by hand and really are the ball
# (numbers from review_grid.py). See README.md in this folder.
import json, numpy as np
rng=np.random.default_rng(0)
POS={"A":{16,17,18,19,20,21,22,42,43,44,45,47,48,60,61,62,63,64,65,66,67,69,78,79,80,81,82,85,86,87,88,89,90,96,99,100,101,102,103,104,105,106,107,108,114,115,116,117,118},"B":{3,4,5,23,24,25,26,27}}
Xs=[];ys=[];g=[]
for v in "AB":
    meta=json.load(open(f"{v}.gray.meta.json")); dim=meta["dim"]
    X=np.fromfile(f"{v}.gray.feat.bin",dtype=np.float32).reshape(-1,dim)
    auto=[k for k,r in enumerate(meta["rows"]) if r["label"]==1]
    y=np.zeros(len(X)); hard=np.zeros(len(X),bool)
    for j,k in enumerate(auto):
        if j in POS[v]: y[k]=1
        else: hard[k]=True
    neg=np.where((y==0)&~hard)[0]; neg=rng.choice(neg,min(len(neg),4000),replace=False)
    keep=np.concatenate([np.where(y==1)[0],np.where(hard)[0],neg])
    Xs.append(X[keep]); ys.append(y[keep]); g.append(np.full(len(keep),v))
X=np.vstack(Xs).astype(np.float64); y=np.concatenate(ys); g=np.concatenate(g)
# Flip augmentation for positives (mirror the 9x9 patches left-right).
P=9; base=6
def flip(x):
    x=x.copy()
    for off in (base, base+P*P):
        blk=x[off:off+P*P].reshape(P,P)[:, ::-1]; x[off:off+P*P]=blk.ravel()
    return x
pi=np.where(y==1)[0]
X=np.vstack([X,np.array([flip(X[i]) for i in pi])]); y=np.concatenate([y,np.ones(len(pi))]); g=np.concatenate([g,g[pi]])
mu=X.mean(0); sd=X.std(0)+1e-6
def fit(X,y,l2=1.0,epochs=400,lr=0.1):
    Z=(X-mu)/sd; w=np.zeros(Z.shape[1]); b=0.0
    pw=(y==0).sum()/max(1,(y==1).sum())
    sw=np.where(y==1,pw,1.0); sw/=sw.mean()
    for _ in range(epochs):
        p=1/(1+np.exp(-(Z@w+b))); e=(p-y)*sw
        w-=lr*(Z.T@e/len(y)+l2*w/len(y)); b-=lr*e.mean()
    return w,b
def auc(s,y):
    o=np.argsort(s); r=np.empty(len(s)); r[o]=np.arange(1,len(s)+1)
    n1=(y==1).sum(); n0=len(y)-n1; return (r[y==1].sum()-n1*(n1+1)/2)/(n1*n0)
# 5-fold CV
idx=rng.permutation(len(y)); folds=np.array_split(idx,5); aucs=[]; hardacc=[]
for f in folds:
    tr=np.setdiff1d(idx,f); w,b=fit(X[tr],y[tr]); s=((X[f]-mu)/sd)@w+b; aucs.append(auc(s,y[f]))
print("CV AUC", np.round(aucs,3), "mean", round(float(np.mean(aucs)),3))
w,b=fit(X,y)
json.dump({"mu":mu.tolist(),"sd":sd.tolist(),"w":w.tolist(),"b":b,"patch":P},open("ball_model.json","w"))
print("pos",int((y==1).sum()),"neg",int((y==0).sum()))
# Honest check: train on one video, test on the other (no shared deliveries).
for tr_v, te_v in (("A","B"),("B","A")):
    tr=g==tr_v; te=g==te_v
    if (y[tr]==1).sum()<5 or (y[te]==1).sum()<5: print(tr_v,"->",te_v,"too few positives"); continue
    w2,b2=fit(X[tr],y[tr]); s=((X[te]-mu)/sd)@w2+b2
    # rank of true balls among hard negatives (things the old tracker confused with the ball)
    print(f"train {tr_v} -> test {te_v}: AUC {auc(s,y[te]):.3f}")
