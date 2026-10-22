import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";
import { BallTracking } from "@/components/video/ball-tracking";
import { requireUser } from "@/lib/auth";
import { listDeliveries, serverToday } from "@/lib/data";

export const metadata: Metadata = { title: "Ball Tracking" };

export default async function TrackingPage() {
  const user = await requireUser();
  const [deliveries, today] = await Promise.all([listDeliveries(user.id), serverToday()]);
  return (
    <>
      <PageHeader eyebrow="Video lab" title="Ball Tracking">
        Follow the ball through a delivery, then time it for speed and length. Switch the overlay
        on and off on the same video to compare.
      </PageHeader>
      <Container>
        <p role="note" className="mb-5 border-l-4 border-gold bg-gold/10 px-4 py-3 text-sm text-ink">
          <b className="font-display uppercase tracking-wide text-navy">Work in progress.</b> Ball tracking is still being
          trained and improved, so it won&apos;t find the ball on every delivery yet. You can still try it, and you can
          always mark the release and bounce by hand to get speed and length. To help train it, turn on sharing in your
          Profile and answer &ldquo;Is the yellow path the ball?&rdquo; after tracking.
        </p>
        <BallTracking deliveries={deliveries} today={today} shareTraining={user.share_training} />
      </Container>
    </>
  );
}
