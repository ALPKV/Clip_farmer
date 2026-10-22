import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm, ProfileForm } from "@/components/forms";
import { TrainingSharing } from "@/components/training-sharing";
import { Container, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const shared = await queryOne<{ n: number }>("select count(*)::int as n from training_samples where user_id = $1", [user.id]);
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile">{user.email}</PageHeader>
      <Container className="max-w-3xl">
        <Panel title="Player details">
          <ProfileForm user={user} />
        </Panel>
        <div className="mt-5">
          <Panel title="Help train ball tracking">
            <p className="mb-4 text-sm text-slate">
              Optional. When it&apos;s on and you answer &ldquo;Is the yellow path the ball?&rdquo; after tracking, Flipper
              shares the numbers it used to judge each moving spot, so the next version finds the ball more often. Your
              video, frames, file names and times are never shared. Exactly what&apos;s sent is in the{" "}
              <Link href="/privacy#training" className="font-semibold text-navy underline">Privacy Policy</Link>.
            </p>
            <TrainingSharing share={user.share_training} shared={shared?.n ?? 0} />
          </Panel>
        </div>
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
