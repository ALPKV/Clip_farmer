# Ball model (experimental, off by default)

A small ball / not-ball classifier that can help the tracker ignore limbs, bats and pads.
Everything here is free and runs on a normal laptop CPU in under a minute.

## Status (October 2026)

Trained on 2 net-session videos (2.5 minutes, 30 fps): 57 hand-checked ball crops and about
8,100 not-ball blobs. On footage it has not seen it scores 0.71–0.79 AUC. Tested on 13
deliveries from another session it fixed one, broke one and changed nothing on the rest, so
**it is not enabled** (`lib/tracking/analyze.ts` does not pass a scorer). The weights are in
`lib/tracking/ball-model.json` and the inference code in `lib/tracking/model.ts`.

It needs more and better footage to be worth switching on: aim for 20–30 minutes of
unedited sessions, tripod, 60 fps or more, with the release and the batter in view.

## Retraining

Needs Node 22+, Python 3 with `numpy` and `opencv-python`, and an `ffmpeg` binary.

1. Decode each video to 360×640 grayscale frames:
   `ffmpeg -i session.mov -vf "scale=360:640,format=gray" -f rawvideo A.gray`
2. Auto-label candidates (long, smooth tracks are labelled "ball"):
   `node scripts/ball-model/label.mts A.gray A 30`
3. Review the auto-labels, because many are wrong (shoes, legs, netting):
   `python scripts/ball-model/review_grid.py A 0 70 grid.jpg` and note the numbers of the
   crops that really are the ball. Put them in `POS` in `train.py`.
4. Train and evaluate: `python scripts/ball-model/train.py`. Check the train-on-one-video,
   test-on-the-other AUC, not just the cross-validation number (neighbouring frames leak).
5. Copy the weights into `lib/tracking/ball-model.json`, then compare tracks with and without
   the model on deliveries the model has not seen before turning it on.
