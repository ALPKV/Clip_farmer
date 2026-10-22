import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm, ProfileForm } from "@/components/forms";
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
        <div className="mt-5">
          <Panel title="Your data">
            <p className="mb-4 text-sm text-slate">
              Videos are never uploaded. Everything else you log is stored in your account until you delete it. See the{" "}
              <Link href="/privacy" className="font-semibold text-navy underline">Privacy Policy</Link>.
            </p>
            <DeleteAccountForm />
          </Panel>
        </div>
      </Container>
    </>
  );
}
