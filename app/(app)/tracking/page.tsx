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
        <BallTracking deliveries={deliveries} today={today} />
      </Container>
    </>
  );
}
