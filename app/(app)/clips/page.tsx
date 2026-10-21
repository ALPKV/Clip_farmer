import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui";
import { ClipFarmer } from "@/components/video/clip-farmer";

export const metadata: Metadata = { title: "Clip Farmer" };

export default function ClipsPage() {
  return (
    <>
      <PageHeader eyebrow="Video lab" title="Clip Farmer">
        Drop in an unedited net session. Flipper listens for bat-on-ball contact and cuts a clip
        around every shot, ready to review, track or export.
      </PageHeader>
      <Container>
        <ClipFarmer />
      </Container>
    </>
  );
}
