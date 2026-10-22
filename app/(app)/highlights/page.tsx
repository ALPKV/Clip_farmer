import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";
import { Highlights } from "@/components/video/highlights";

export const metadata: Metadata = { title: "Highlights" };

export default function ClipsPage() {
  return (
    <>
      <PageHeader eyebrow="Video lab" title="Highlights">
        Drop in an unedited net session. Flipper listens for bat-on-ball contact and cuts a clip
        around every shot, ready to review, track or export.
      </PageHeader>
      <Container>
        <Highlights />
      </Container>
    </>
  );
}
