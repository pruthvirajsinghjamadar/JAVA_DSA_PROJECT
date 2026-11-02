"use client";

import { SessionProvider, useSession } from "next-auth/react";
import React, { useEffect, useRef } from "react";
import { getClientId } from "@/lib/client-id";

/**
 * Keeps the browser's progress id in sync with the signed-in Google account.
 *
 *  - Signed in on a new device -> the server merges this browser's local
 *    progress into the account and tells us the account's canonical id, which
 *    we store so every page loads the account's progress.
 *  - Signed out -> the id is cleared so the next visitor starts anonymous and
 *    never writes into the previous account.
 */
function AccountSync() {
  const { status } = useSession();
  const prevStatus = useRef<string>("loading");

  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;

    if (status === "authenticated") {
      const local = getClientId();
      // Prevent a reload loop if the server ever keeps returning another id.
      if (sessionStorage.getItem("jd_syncing") === "1") return;
      sessionStorage.setItem("jd_syncing", "1");
      fetch(`/api/auth/me?clientId=${encodeURIComponent(local)}`)
        .then((r) => r.json())
        .then((d) => {
          sessionStorage.removeItem("jd_syncing");
          if (d?.clientId && d.clientId !== local) {
            try {
              localStorage.setItem("clientId", d.clientId);
            } catch {}
            window.location.reload();
          }
        })
        .catch(() => sessionStorage.removeItem("jd_syncing"));
    } else if (status === "unauthenticated" && was === "authenticated") {
      // Just signed out: hand this browser a fresh anonymous identity.
      try {
        localStorage.removeItem("clientId");
      } catch {}
    }
  }, [status]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AccountSync />
      {children}
    </SessionProvider>
  );
}
