"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Sends a request to the API, then refreshes the server-rendered page. */
export function useSend() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function send(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status}).`);
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Could not reach the server. Check your connection.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { send, error, busy, setError };
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="border-l-4 border-risk bg-risk/5 px-3 py-2 text-sm text-risk">
      {error}
    </p>
  );
}
