import type { Metadata } from "next";
import { ProfileForm } from "@/components/forms";
import { Container, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile">{user.email}</PageHeader>
      <Container className="max-w-3xl">
        <Panel title="Player details">
          <ProfileForm user={user} />
        </Panel>
      </Container>
    </>
  );
}
