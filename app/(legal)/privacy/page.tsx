import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article>
      <LegalTitle title="Privacy Policy" updated="23 October 2026">
        Flipper is a free, non-commercial app that turns a net session video into clips and tracks the ball. The
        short version: there are no accounts, and your videos never leave your device.
      </LegalTitle>

      <Section title="Your videos stay on your device">
        <p>
          Clipping and ball tracking run entirely in your web browser. When you choose a video it is read straight from
          your device. It is not sent to Flipper or to anyone else, and Flipper has no copy of it.
        </p>
        <ul>
          <li>Clips and highlights videos are made on your device and saved only where you save them.</li>
          <li>
            The video and everything made from it are held in the open tab&apos;s memory only, and are wiped when you
            press <b>Change video</b> or close or reload the tab.
          </li>
          <li>Tracked speeds and lengths are shown for the session only and are not stored anywhere.</li>
        </ul>
      </Section>

      <Section title="What Flipper keeps">
        <p>
          Nothing about you on a server: there are no accounts, no database and no sign-in. Your browser keeps two small
          settings on your own device: your Ball Tracking camera setup and whether you chose bigger parts for highlights
          videos. There are no advertising, analytics or tracking cookies.
        </p>
      </Section>

      <Section title="Services Flipper relies on">
        <ul>
          <li><b>Vercel</b> hosts the website. Like any web host, it handles your IP address and basic request details to serve pages.</li>
          <li>
            <b>jsDelivr</b> serves the video engine (FFmpeg), which your browser downloads once the first time you open a
            video. It sees an ordinary download request, not your video.
          </li>
        </ul>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, the date at the top will change too. Questions: open an issue on{" "}
          <a href="https://github.com/ALPKV/Flipper/issues" rel="noreferrer" target="_blank">Flipper&apos;s GitHub page</a>.
          Don&apos;t include personal details there, since issues are public. Also see the{" "}
          <Link href="/terms">Terms of Use</Link>.
        </p>
      </Section>
    </article>
  );
}
