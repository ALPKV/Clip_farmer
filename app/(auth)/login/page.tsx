import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <p className="eyebrow text-mute">Welcome back</p>
      <h1 className="display mb-6 mt-1 text-4xl font-extrabold text-navy">Sign in</h1>
      <AuthForm mode="login" />
    </>
  );
}
