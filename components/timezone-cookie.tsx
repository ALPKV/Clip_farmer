"use client";

import { useEffect } from "react";

/** Tells the server the viewer's time zone, so "today" and weeks match the player's calendar. */
export function TimezoneCookie() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && !document.cookie.includes(`flipper_tz=${encodeURIComponent(tz)}`)) {
      document.cookie = `flipper_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
