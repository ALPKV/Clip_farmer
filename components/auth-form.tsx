"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" ? (
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="field" id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 10 : 1}
          required
        />
        {mode === "signup" ? <p className="mt-1 text-xs text-mute">At least 10 characters.</p> : null}
      </div>
      {error ? (
        <p role="alert" className="border-l-4 border-risk bg-risk/5 px-3 py-2 text-sm text-risk">{error}</p>
      ) : null}
      <Button type="submit" tone="gold" disabled={busy} className="w-full">
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-slate">
        {mode === "signup" ? (
          <>Already have an account? <Link className="font-semibold text-navy underline" href="/login">Sign in</Link></>
        ) : (
          <>New to Flipper? <Link className="font-semibold text-navy underline" href="/signup">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
