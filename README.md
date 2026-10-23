# Flipper

Drop in an unedited net session video and get a clip for every shot, then track the ball. It grew
out of Clip Farmer, an audio-based auto-clipper (the original Streamlit version is in `legacy/`).

**Live:** https://flipper-cricket.vercel.app

| Tab | What it does |
| --- | --- |
| **Highlights** | A sound louder than the sensitivity makes a clip; sounds within the skip gap after it (3 s by default) are ignored. Talking is filtered out. Untick or remove (Not a shot) any clip, then save clips one by one or join them into one highlights video, made in parts so long sessions don't run out of memory. Save to Photos on phones. |
| **Ball Tracking** | Follows the ball through a clip and draws it over the video (toggle on and off). Times speed and length from release, bounce and contact marks. Pitch map of the deliveries tracked in the session. |

Everything runs on your device: there are no accounts, no database and no uploads (FFmpeg compiled to
WebAssembly, plus a tracker written for this app).

## How shots are found

`lib/tracking/hits.ts`: sudden jumps in the 1.5–7.5 kHz band against the last 3 s of background (so
it works in a quiet net or a loud hall), talking dropped (a vowel follows a spoken "t" or "k"), then
the simple rule above. Results on labelled sessions are in `scripts/deliveries/README.md`.

## How speed is measured (and how accurate it is)

Speed is **timed**, not guessed from pixels: the ball travels a known distance (17.68 m, crease to
crease, by default) between release and bat contact. Contact comes from the audio, accurate to a few
milliseconds. Release comes from the first frame the ball is seen. **Check every auto mark** with
the frame-step buttons; one frame at 30 fps is about 5% of the speed. Film at 60 fps or more, on a
tripod, with the release and the batter both in view. Length assumes the ball keeps that speed to the
bounce. Line needs the camera behind the stumps and the stumps marked. All are estimates, not radar.

## Run it on your computer

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm test          # unit tests (shot finding, tracking, speed maths)
npm run lint
npm run typecheck
```

## Put it online for free

On [vercel.com](https://vercel.com) (free Hobby plan): **Add New → Project**, import **Flipper**,
**Deploy**. Every push to `main` redeploys. Nothing else to set up.

## Project layout

| Path | What it is |
| --- | --- |
| `app/` | Pages: `(app)/highlights`, `(app)/tracking`, `(legal)/privacy`, `(legal)/terms` |
| `components/video/` | Highlights, Ball Tracking, the player and clip bar |
| `lib/tracking/` | Shot finding from sound, ball detection and tracking, bounce, speed/length/line maths |
| `lib/video/` | FFmpeg.wasm (audio, clips and highlights video) and frame capture |
| `scripts/` | Evaluation of shot finding and ball-model training |
| `legacy/` | The original Streamlit version (then called Clip Farmer), kept for reference |

`config.yaml` (old Streamlit logins) is no longer tracked, but earlier commits of this public
repository still contain it. Don't reuse those passwords anywhere.
