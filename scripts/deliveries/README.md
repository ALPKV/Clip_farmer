# Finding deliveries

Highlights finds every ball in a net session in two ways, both in the browser:

1. **Bat sounds** (`lib/tracking/hits.ts`). Sudden jumps in the 1.5–7.5 kHz band are measured against
   the previous 3 seconds of background, not a fixed loudness level, so this works in a quiet net or a
   loud hall. One ball makes several sounds (the shot, then the ball hitting the net or being
   returned), so sounds within 1.8 s of the loudest one, and dull thuds up to 2.4 s after, are grouped
   into one delivery. The bat contact is the first sharp sound of the group. A sound counts as a shot
   when it is within the chosen number of dB of the session's big hits (90th percentile).
   Talking is ignored: a "t" or "k" sounds like a click, but a voiced vowel follows it (it repeats
   80–400 times a second), while a bat crack dies away into silence or net noise. Sounds clearly more
   voiced in the 150 ms after than just before are dropped (voicing over 0.6 and at least 0.3 more
   than before). That sits between the talking in session A (0.79, +0.41) and the most voiced real
   delivery (0.65, +0.22). One talking example is thin: more labelled sessions with chatter needed.
2. **Bowling actions** (`lib/tracking/deliveries.ts`, `lib/video/motion.ts`, opt-in). The video is played
   fast in a hidden player while a 90×160 grey copy is compared about ten times a second of video. A
   bowler running in and bowling is a sharp peak in how much of the picture changes. A peak with no bat
   sound in the next 2.6 s becomes a "No bat sound" clip: misses, leaves and bowled balls.

## Results (October 2026)

Two raw sessions, every delivery labelled frame by frame (`labels.json`). A delivery is found when a
clip lands between 0.8 s before its release and 2.6 s after it; a second clip of the same ball is a
duplicate.

| Session | Old detector (fixed loudness, 3 s gap) | Bat sounds, −25 dB | + bowling actions |
| --- | --- | --- | --- |
| Outdoor nets, behind the bowler (19 balls) | 10 found, 2 false | 18 found, 1 duplicate | 19 found, 1 duplicate, 1 false |
| Indoor nets, behind the bowler (21 balls) | 13 found | 21 found | 21 found, 2 duplicate |

The old detector also drifted in noisy halls: anything loud started a clip and the next 3 s were
ignored, so clips landed every 3.3 s whatever was happening.

Not done yet: telling bat from stumps or pads by sound. That needs labelled examples of each, which
these sessions don't have enough of.

## Re-running

Needs Node 22+ and an `ffmpeg` binary. For each session in `labels.json`:

```
ffmpeg -i session.mov -vn -ac 1 -ar 16000 -f s16le <dir>/<name>.s16
```

and, for the motion scan, `<dir>/<name>_motion.json` as `{ "t": [...], "m": [...] }`: the fraction of
pixels of a 90×160 grey copy that changed by more than 20 levels, ten times a second. Then:

```
node --experimental-strip-types scripts/deliveries/eval.mts <dir>
```
