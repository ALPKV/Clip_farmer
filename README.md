# Flipper

A practice command centre for cricketers, built from the WillowFlow PRD. It grew out of Clip Farmer, an audio-based auto-clipper (the original Streamlit version is in `legacy/`).

| Tab | What it does |
| --- | --- |
| **Command Centre** | This week's load, the three pillars (physical, technical, mental), Optimal status, injury-risk alert, goals, badges |
| **Planner** | Plan or log open nets, scenario nets, drills, bowling machine, spot bowling, new skills and conditioning, each with a pre-session intent, RPE and reflection. Logs must be made within 2 hours of finishing. |
| **Calendar** | Month view of work and rest, weekly load chart. A week more than 20% above the previous one is flagged High Injury Risk. |
| **Matches** | Batting and bowling figures, dismissal and error analysis, trends |
| **Mindset** | Strengths and weaknesses inventory, intent vs reflection |
| **Goals** | Season targets that update from your logs (targets are fixed once set), badges |
| **Fuel** | Carb tracker with daily targets from body weight and day type |
| **Highlights** | Drop in an unedited net session: shots are found from the audio (bat-on-ball crack) and clipped. Tick the clips you want and join them into one highlights video (fast, or exact frame cuts). |
| **Ball Tracking** | Follows the ball through a clip and draws it over the video (toggle on and off). Times speed and length from release, bounce and contact marks. Pitch map. |
| **Portfolio** | Printable summary for coaches and academies |

Videos never leave the browser: audio scanning, clipping and ball tracking run on your own device
(FFmpeg compiled to WebAssembly, plus a tracker written for this app). Only the numbers you choose to
save, such as a delivery's speed, are stored on the server.

## How speed is measured (and how accurate it is)

Speed is **timed**, not guessed from pixels: the ball travels a known distance (17.68 m, crease to
crease, by default) between release and bat contact. Contact comes from the audio, accurate to a few
milliseconds. Release comes from the first frame the ball is seen. **Check every auto mark** with
the frame-step buttons; one frame at 30 fps is about 5% of the speed. Film at 60 fps or more, on a
tripod, with the release and the batter both in view. Length assumes the ball keeps that speed to the
bounce. Line needs the camera behind the stumps and the stumps marked. All are estimates, not radar.

## Run it on your computer

Needs Node.js 22 or newer. No database to install: without `DATABASE_URL` it uses an embedded
Postgres (PGlite) saved in `.data/`.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and create an account.

```bash
npm test          # unit tests (PRD rules, tracking, speed maths)
npm run lint
npm run typecheck
```

## Put it online for free (Vercel + Neon)

You do this once; after that every push to `main` redeploys automatically.

1. Go to [vercel.com](https://vercel.com), choose **Sign up → Continue with GitHub**, and pick the free **Hobby** plan.
2. Click **Add New → Project**, find **Flipper**, click **Import**, then **Deploy**. Leave every setting as it is.
   The first deploy shows an error page saying the database isn't set up. That's expected.
3. In the project, open **Storage → Create Database → Neon (Serverless Postgres)**, choose the free plan,
   and connect it to the project for all environments. This adds `DATABASE_URL` for you.
4. Open **Deployments**, click the **⋯** menu on the latest one and choose **Redeploy**.
5. Visit your site and create your account. Check `https://<your-site>/api/health` shows `"database":"postgres"`.

Costs: both free tiers are enough for a personal app. Vercel's Hobby plan is for non-commercial use;
if you start charging users you'll need Vercel Pro. Neon's free tier sleeps when idle, so the first
request after a quiet spell takes a second or two longer.

## Project layout

| Path | What it is |
| --- | --- |
| `app/` | Pages (`(app)/…` signed-in tabs, `(auth)/…` sign-in) and the API (`app/api/…`) |
| `components/` | UI. `components/video/` is Highlights and Ball Tracking. |
| `lib/domain.ts` | PRD rules: workload, 20% spike, 2-hour logging window, pillars, badges, carb ranges |
| `lib/tracking/` | Ball detection and tracking, bounce detection, audio hit detection, speed/length/line maths |
| `lib/video/` | FFmpeg.wasm (audio, clip and reel export) and frame capture |
| `lib/db.ts`, `lib/schema.ts` | Database connection and tables (created automatically) |
| `legacy/` | The original Streamlit version (then called Clip Farmer), kept for reference |

## Security notes

- Passwords are hashed with scrypt; sessions are random tokens stored hashed, in an HTTP-only cookie.
- State-changing API requests from other sites are refused; sign-in attempts are rate-limited.
- `config.yaml` (old Streamlit logins) is no longer tracked, but earlier commits of this public
  repository still contain it. Don't reuse those passwords anywhere.
