import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <p className="eyebrow text-mute">Free account</p>
      <h1 className="display mb-6 mt-1 text-4xl font-extrabold text-navy">Join Flipper</h1>
      <AuthForm mode="signup" />
    </>
  );
}
