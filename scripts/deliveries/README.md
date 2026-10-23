# Finding shots

Highlights finds shots from the sound track, in the browser (`lib/tracking/hits.ts`):

1. **Impacts:** sudden jumps in the 1.5–7.5 kHz band, measured against the previous 3 seconds of
   background rather than a fixed loudness level, so this works in a quiet net or a loud hall.
2. **Talking dropped:** a spoken "t" or "k" clicks like a bat, but a voiced vowel follows it (it
   repeats 80–400 times a second). Sounds clearly more voiced in the 150 ms after than just before are
   dropped (voicing over 0.6 and at least 0.3 more than before).
3. **The rule:** a sound within the sensitivity (dB below the session's big hits, its 90th-percentile
   loudness) makes a clip, and any sound within the skip gap after it is ignored. Of sounds less than
   0.4 s apart the loudest is kept, so a footstep just before the crack doesn't take its place.

Each clip stops short of its neighbours, so every shot keeps its own clip.

## Results (October 2026)

Three sessions, every delivery labelled frame by frame (`labels.json`). A delivery is found when a
clip lands between 0.8 s before its release and 2.6 s after it; a second clip of the same ball is a
duplicate.

| Session | −25 dB, skip 3 s (default) | −25 dB, skip 2 s | −15 dB, skip 3 s |
| --- | --- | --- | --- |
| Outdoor nets, behind the bowler (19 balls) | 17 found | 19 found, 2 duplicate | 13 found |
| Indoor nets, several bowlers (21 balls) | 20 found | 21 found | 15 found |
| Indoor nets, lots of talking (10 balls) | 8 found, 13 false | 9 found, 15 false | 7 found, 5 false |

In a noisy hall the simple rule makes false clips (the ball being thrown back, other nets); remove
them with Not a shot, or raise the sensitivity. An earlier version also checked the video for the
bowler's action before each sound (13 false clips down to 1 on the talking session) but was slow on
long 4K sessions on phones, so it was removed to keep the app fast; it is in the git history.

## Re-running

Needs Node 22+ and an `ffmpeg` binary. For each session in `labels.json`:

```
ffmpeg -i session.mov -vn -ac 1 -ar 16000 -f s16le <dir>/<name>.s16
node --experimental-strip-types scripts/deliveries/eval.mts <dir>
```
