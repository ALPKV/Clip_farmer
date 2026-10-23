import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";
import { BallTracking } from "@/components/video/ball-tracking";

export const metadata: Metadata = { title: "Ball Tracking" };

export default function TrackingPage() {
  return (
    <>
      <PageHeader eyebrow="Video lab" title="Ball Tracking">
        Follow the ball through a delivery, then time it for speed and length.
      </PageHeader>
      <Container>
        <p role="note" className="mb-5 border-l-4 border-gold bg-gold/10 px-4 py-3 text-sm text-ink">
          <b className="font-display uppercase tracking-wide text-navy">Work in progress.</b> Ball tracking won&apos;t find
          the ball on every delivery yet. You can always mark the release and bounce by hand to get speed and length.
        </p>
        <BallTracking />
      </Container>
    </>
  );
}
