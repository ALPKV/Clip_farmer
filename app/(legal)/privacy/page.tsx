import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article>
      <LegalTitle title="Privacy Policy" updated="22 October 2026">
        Flipper is a free, non-commercial practice app for cricketers. This page explains what it keeps about you,
        what it never sees, and how to delete everything. The short version: your videos never leave your device,
        and you can erase your account and all of its data yourself at any time.
      </LegalTitle>

      <Section title="Your videos are never uploaded">
        <p>
          Highlights and Ball Tracking run entirely in your web browser. When you choose a video, it is read straight
          from your device. It is not sent to Flipper&apos;s servers or to anyone else, and Flipper has no copy of it.
        </p>
        <ul>
          <li>Clips and highlights videos are made on your device and saved only where you download them.</li>
          <li>
            The video and everything made from it are held in the open tab&apos;s memory only. They are wiped when you
            press <b>Change video</b>, sign out, or close or reload the tab. Nothing is written to your browser&apos;s
            storage.
          </li>
          <li>
            If you press <b>Save</b> on a tracked delivery, only the numbers are stored in your account: speed, length,
            line, the date, the video&apos;s file name and the time of the clip within it. No frames or images are
            saved.
          </li>
        </ul>
      </Section>

      <Section title="Optional: helping train ball tracking" id="training">
        <p>
          Sharing is <b>off</b> unless you turn it on in your Profile. When it&apos;s on and you answer &ldquo;Is the
          yellow path the ball?&rdquo; after tracking a delivery, Flipper sends numbers describing the spots it
          tracked, labelled with your answer. Up to 200 sets per answer, each with:
        </p>
        <ul>
          <li>the spot&apos;s size and shape, how bright it is and how crowded its surroundings are;</li>
          <li>
            a 9&times;9-pixel greyscale square around the spot, from a copy of the frame shrunk to 360 pixels wide, with
            its brightness evened out, and how much each of those pixels moved. The square is about the size of the
            ball, far too small and blurry to show a face, a person or a place;
          </li>
          <li>the frame size, the frame rate and which version of the model chose the spots.</li>
        </ul>
        <p>
          Never shared: the video, whole frames, the file name, when in the video it happened, or anything else about
          you. Shared samples are linked to your account only so you can delete them and so no one can flood the
          training set. They are used only to train Flipper&apos;s ball model. Turn sharing off at any time, and choose
          whether to delete what you shared. Deleting your account deletes it too.
        </p>
      </Section>

      <Section title="What Flipper stores">
        <ul>
          <li><b>Account:</b> your name, email address and password. The password is stored only as a salted scrypt hash, never as text.</li>
          <li><b>Profile:</b> your playing role, and your body weight and season dates if you enter them.</li>
          <li>
            <b>What you log:</b> practice sessions, match logs and dismissals, goals, carb logs, mindset entries,
            inventory and saved deliveries.
          </li>
          <li><b>If you opt in:</b> the ball-tracking numbers described above.</li>
          <li><b>Sign-in:</b> a session record, so you stay signed in, kept for as long as the session lasts or until you sign out.</li>
          <li>
            <b>Abuse protection:</b> a count of recent sign-in attempts per email address and of sign-ups per network
            (IP) address, used to slow down password guessing. Counts older than a day are deleted.
          </li>
        </ul>
        <p>
          Your browser also keeps two small settings on your device: your time zone (as a cookie, so dates show
          correctly) and your Ball Tracking camera setup (in local storage).
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Flipper uses one sign-in cookie, <code>flipper_session</code>, and one time-zone cookie. Both are needed for
          the app to work. There are no advertising, analytics or tracking cookies.
        </p>
      </Section>

      <Section title="How it is used">
        <p>
          Your data is used only to run Flipper for you: to show your plans, workload, goals and results. It is not
          sold, rented or shared for advertising, and your logs are never used to train AI models. The only training
          data is the optional ball-tracking numbers described above, used for Flipper&apos;s own ball model. No one
          else can see your account.
        </p>
      </Section>

      <Section title="Services Flipper relies on">
        <ul>
          <li><b>Vercel</b> hosts the website. Like any web host, it handles your IP address and basic request details to serve pages.</li>
          <li><b>Neon</b> hosts the database that holds your account and logs.</li>
          <li>
            <b>jsDelivr</b> serves the video engine (FFmpeg), which your browser downloads once the first time you open a
            video tab. It sees an ordinary download request, not your video.
          </li>
        </ul>
        <p>These providers process data on Flipper&apos;s behalf, under their own security and privacy terms.</p>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can delete any entry from the page where you made it. To delete everything, open{" "}
          <Link href="/profile">Profile</Link> and use <b>Delete account</b>. Your account and every session, match,
          goal, log and saved delivery are erased from the database at once. This cannot be undone.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Connections use HTTPS, passwords are hashed with scrypt, sign-in cookies are HTTP-only, and requests from
          other websites are refused. No system is perfectly secure, so use a password you don&apos;t use anywhere
          else.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Flipper is not meant for children under 13, and they should not create an account. If you are under 18,
          ask a parent or guardian before signing up. If a child under 13 has made an account, delete it from the
          Profile page or ask us to.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the date at the top will change too. Questions or requests: open an issue on{" "}
          <a href="https://github.com/ALPKV/Flipper/issues" rel="noreferrer" target="_blank">Flipper&apos;s GitHub page</a>.
          Don&apos;t include personal details there, since issues are public. Also see the{" "}
          <Link href="/terms">Terms of Use</Link>.
        </p>
      </Section>
    </article>
  );
}
