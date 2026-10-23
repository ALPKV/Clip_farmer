import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <article>
      <LegalTitle title="Terms of Use" updated="23 October 2026">
        These terms cover your use of Flipper. By using the app, you agree to them. If you don&apos;t agree, please
        don&apos;t use Flipper.
      </LegalTitle>

      <Section title="The service">
        <p>
          Flipper is a free, non-commercial app that cuts a clip for every shot in a net session video and tracks the
          ball. It is a personal project, offered as is. Features may change, and the service may be paused or shut
          down. Save your own copies of any clips that matter to you.
        </p>
      </Section>

      <Section title="Your videos">
        <p>
          The videos you open stay yours and are processed on your own device, never uploaded (see the{" "}
          <Link href="/privacy">Privacy Policy</Link>). Only open videos you have the right to use. If other people
          appear in them, especially children, make sure you have their or their parents&apos; permission before you
          share anything you make.
        </p>
      </Section>

      <Section title="Estimates, not measurements">
        <p>
          Ball speed, length and line are estimates calculated from video timing and your camera setup. They can be
          wrong, and they are not a replacement for a radar gun or Hawk-Eye. Don&apos;t rely on them for coaching or
          safety decisions.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t overload, attack or scrape the service, or use Flipper for anything unlawful.</p>
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
          including that it will be accurate, uninterrupted or free of errors. To the fullest extent the law allows,
          Flipper and its developer are not liable for any indirect, incidental or consequential loss, or for lost
          videos, arising from your use of the app. Nothing here limits rights you have by law that cannot be limited.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          These terms may be updated, and the date at the top will change when they are. These terms are governed by
          the laws of the State of Maryland, USA. Questions: open an issue on{" "}
          <a href="https://github.com/ALPKV/Flipper/issues" rel="noreferrer" target="_blank">GitHub</a>.
        </p>
      </Section>
    </article>
  );
}
