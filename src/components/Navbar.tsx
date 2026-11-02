"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getClientId } from "@/lib/client-id";

export function Navbar() {
  const { data: session } = useSession();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasDaily, setHasDaily] = useState(false);

  useEffect(() => {
    // Theme setup
    let savedTheme: "light" | "dark" = "light";
    try {
      savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    } catch {}
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Daily notification check
    const clientId = getClientId();
    fetch(`/api/daily?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.daily && !d.daily.solved) {
          setHasDaily(true);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {}
  };

  const accountLabel = session?.user?.email ? "Account" : "Sign in";

  return (
    <div className="nav">
      <Link className="brand" href="/">
        <span className="logo" aria-hidden="true">
          <i>J</i>
          <i>D</i>
        </span>
        Java + DSA
      </Link>
      <nav>
        <Link className="keep" href="/#path">
          Learning path
        </Link>
        <Link className="keep" href="/#certs">
          Certificates
        </Link>
        <Link className="keep" href="/practice">
          Practice
          {hasDaily && (
            <span className="ndot" title="Today's question is waiting" aria-label="new question today" />
          )}
        </Link>
        <Link className="keep signin-link" href="/signin" title={session?.user?.email || ""}>
          {accountLabel}
        </Link>
        <Link className="keep" href="/profile">
          Profile
        </Link>
        <Link href="/#resources">Resources</Link>
      </nav>
      <button
        id="theme"
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
