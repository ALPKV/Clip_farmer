"use client";

import Link from "next/link";
import { useState } from "react";
import type { BallAnalysis } from "@/lib/tracking/analyze";
import { MODEL_VERSION } from "@/lib/tracking/model";
import { FormError, useSend } from "./use-send";
import { Button } from "./ui";

/** Profile switch for sharing ball-tracking numbers, with a way to take back what was shared. */
export function TrainingSharing({ share, shared }: { share: boolean; shared: number }) {
  const { send, busy, error } = useSend();
  const [confirmOff, setConfirmOff] = useState(false);
  if (!share) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate">
          Off. {shared > 0 ? `You have ${shared.toLocaleString()} shared samples stored.` : "Nothing of yours has been shared."}
        </p>
        <FormError error={error} />
        <Button tone="navy" disabled={busy} onClick={() => send("PATCH", "/api/training", { share: true })}>
          Turn on sharing
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        <b>On.</b> {shared.toLocaleString()} samples shared so far. Thank you.
      </p>
      <FormError error={error} />
      {confirmOff ? (
        <div className="flex flex-wrap gap-2">
          <Button tone="ghost" disabled={busy} onClick={() => send("PATCH", "/api/training", { share: false })}>
            Turn off, keep what I shared
          </Button>
          <Button tone="danger" disabled={busy} onClick={() => send("PATCH", "/api/training", { share: false, deleteShared: true })}>
            Turn off and delete it all
          </Button>
          <Button tone="ghost" onClick={() => setConfirmOff(false)}>Cancel</Button>
        </div>
      ) : (
        <Button tone="ghost" onClick={() => setConfirmOff(true)}>Turn off sharing</Button>
      )}
    </div>
  );
}

/**
 * After a ball is tracked: asks whether the path is really the ball. With sharing on, the answer and
 * the numbers behind the path are sent to train the next model.
 */
export function TrackFeedback({ analysis, share }: { analysis: BallAnalysis; share: boolean }) {
  const [sent, setSent] = useState<"confirmed" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = analysis.training;
  if (!t || t.track.length < 3) return null;
  if (!share) {
    return (
      <p className="mb-3 text-xs text-mute">
        Help make tracking better: <Link href="/profile" className="font-semibold text-navy underline">share tracking numbers</Link>{" "}
        (never video) and tell Flipper when it got the ball right.
      </p>
    );
  }
  if (sent) {
    return (
      <p className="mb-3 text-sm text-ok">
        Thanks! {sent === "confirmed" ? "Marked as the ball" : "Marked as not the ball"} and shared to train the next version.
      </p>
    );
  }

  async function answer(source: "confirmed" | "rejected") {
    if (!t) return;
    setBusy(true);
    setError(null);
    const samples =
      source === "confirmed"
        ? [...t.track.map((features) => ({ label: 1, features })), ...t.others.map((features) => ({ label: 0, features }))]
        : t.track.map((features) => ({ label: 0, features }));
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          frame_w: t.w,
          frame_h: t.h,
          fps: Math.round(analysis.fps * 10) / 10,
          model_version: MODEL_VERSION,
          samples: samples.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status}).`);
      setSent(source);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-l-4 border-navy bg-navy-100/50 px-3 py-2">
      <p className="mr-auto text-sm text-ink">Is the yellow path the ball?</p>
      <Button size="sm" tone="navy" disabled={busy} onClick={() => answer("confirmed")}>Yes, it&apos;s the ball</Button>
      <Button size="sm" tone="ghost" disabled={busy} onClick={() => answer("rejected")}>No</Button>
      {error ? <p className="w-full text-sm text-risk">{error}</p> : null}
    </div>
  );
}
