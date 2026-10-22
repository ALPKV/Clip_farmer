import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <article>
      <LegalTitle title="Terms of Use" updated="22 October 2026">
        These terms cover your use of Flipper. By creating an account or using the app, you agree to them. If you
        don&apos;t agree, please don&apos;t use Flipper.
      </LegalTitle>

      <Section title="The service">
        <p>
          Flipper is a free, non-commercial practice app for cricketers. It plans and logs training, tracks workload
          and goals, and turns net videos into clips with ball tracking. It is a personal project, offered as is.
          Features may change, and the service may be paused or shut down. Keep your own copies of anything that
          matters to you.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You must be at least 13. If you are under 18, you need a parent or guardian&apos;s permission.</li>
          <li>Give a real email address, keep your password private, and use one account per person.</li>
          <li>You are responsible for what happens under your account. You can delete it at any time from your Profile page.</li>
        </ul>
      </Section>

      <Section title="Your videos and content">
        <p>
          What you log and the videos you open stay yours. Videos are processed on your own device and never uploaded
          (see the <Link href="/privacy">Privacy Policy</Link>). Only open videos you have the right to use. If other
          people appear in them, especially children, make sure you have their or their parents&apos; permission
          before you share anything you make.
        </p>
      </Section>

      <Section title="Estimates, not advice">
        <p>
          Ball speed, length and line are estimates calculated from video timing and your camera setup. They can be
          wrong, and they are not a replacement for a radar gun or Hawk-Eye.
        </p>
        <p>
          Workload figures, injury-risk flags, carb targets and badges are general training guides, not medical,
          nutritional or coaching advice. Talk to a qualified coach, physio or doctor before you change your training
          because of them, and stop if you are hurt.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t:</p>
        <ul>
          <li>try to get into other people&apos;s accounts, or into parts of the service that aren&apos;t meant for you;</li>
          <li>overload, attack, scrape or reverse-engineer the service, or get around its limits;</li>
          <li>use Flipper for anything unlawful, or to store content that is abusive or infringes someone&apos;s rights.</li>
        </ul>
        <p>Accounts that break these rules may be suspended or deleted.</p>
      </Section>

      <Section title="Open source">
        <p>
          Flipper&apos;s code is public on <a href="https://github.com/ALPKV/Flipper" rel="noreferrer" target="_blank">GitHub</a>{" "}
          under its own licence. These terms cover the hosted app at this address.
        </p>
      </Section>

      <Section title="No warranty and limited liability">
        <p>
          Flipper is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind,
          including that it will be accurate, uninterrupted or free of errors, or that data will never be lost. To
          the fullest extent the law allows, Flipper and its developer are not liable for any indirect, incidental or
          consequential loss, or for injury, lost data or lost videos, arising from your use of the app. Nothing here
          limits rights you have by law that cannot be limited.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          These terms may be updated, and the date at the top will change when they are. Continuing to use Flipper
          after a change means you accept the new terms. These terms are governed by the laws of the State of
          Maryland, USA. Questions: open an issue on{" "}
          <a href="https://github.com/ALPKV/Flipper/issues" rel="noreferrer" target="_blank">GitHub</a>.
        </p>
      </Section>
    </article>
  );
}
