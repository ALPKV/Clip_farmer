# Ball model

A small ball / not-ball classifier (logistic regression on a 9×9 patch, its motion and the blob's
shape). Ball Tracking uses it to throw away blobs it is confident are not the ball (limbs, bats,
pads, netting) before the tracker looks for a ball path. Everything here is free and runs on a
normal laptop CPU; training takes under a minute.

## Current model (v2, October 2026)

- **Training data:** 27 clips from Aathyanth's Instagram export (12 net sessions, 15 match clips).
  432 auto-found tracks were reviewed by eye; 2,212 points from tracks that really are ball
  flights are "ball", 39,605 other moving blobs are "not ball".
- **Classifier quality** on footage it never saw: 0.94 AUC on held-out Instagram clips, 0.96 on a
  raw indoor net session filmed from behind the bowler (video A), 0.90 on an outdoor session
  filmed from the batter's end (video B).
- **Effect on tracking** (`analyzeFrames`, 13 deliveries in video A): before, a path for every
  delivery but almost all on the bowler's body. With the model, 4 clean release-to-batter arcs
  plus 2 plausible paths, no clearly wrong ones, and "no ball path found" on the other 7. On
  video B (batter's end) it finds almost nothing, where the old tracker was wrong every time.
- **Settings:** blobs scoring below 1.5 log-odds are dropped, and a path must end within 0.35 s
  of the bat contact (`lib/tracking/analyze.ts`). Pass `{ useModel: false }` to compare.

v1 (two raw videos, 57 hand-checked crops) scored 0.71–0.79 on unseen footage and was not used.

## Retraining

Needs Node 22+, Python 3 with `numpy` and `opencv-python`, and an `ffmpeg` binary.

1. Decode each clip to 360×640 grayscale frames:
   `ffmpeg -i clip.mp4 -vf "scale=360:640,format=gray" -f rawvideo ig/igNN.gray`
2. Auto-find candidate tracks: `node scripts/ball-model/label.mts ig/igNN.gray igNN 30`
3. Render the tracks for review: `python scripts/ball-model/track_grid.py ig ig/tg`. Look at each
   numbered thumbnail and put the real ball flights in `GOOD` (and doubtful ones in `UNSURE`) in
   `train_instagram.py`.
4. Train and evaluate: `python scripts/ball-model/train_instagram.py <folder>`. Trust the
   held-out-clip and unseen-video numbers, not plain cross-validation (neighbouring frames leak).
5. Copy the weights into `lib/tracking/ball-model.json`, then compare `analyzeFrames` with and
   without the model on deliveries the model has not seen before shipping.

Best footage for future training: unedited sessions on a tripod behind the bowler's stumps,
60 fps or more, with the release and the batter in view.
