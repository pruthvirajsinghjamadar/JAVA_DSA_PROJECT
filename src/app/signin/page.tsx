"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession, getProviders } from "next-auth/react";
import { getClientId } from "@/lib/client-id";

function getErrorMessage(error: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "Configuration":
      return "Google Sign-In is not configured properly on the server. Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your .env file.";
    case "AccessDenied":
      return "Access denied by Google. If your Google Cloud OAuth app is in 'Testing' mode, make sure your email is added under 'Test users' in the Google Cloud Console.";
    case "OAuthSignin":
      return "Could not initialize Google Sign-In. Please check your network and Google OAuth settings.";
    case "OAuthCallback":
      return "Google authentication callback failed. Check that 'http://localhost:3000/api/auth/callback/google' (or your production URL) is listed in Authorized redirect URIs in Google Cloud Console.";
    case "OAuthCreateAccount":
      return "Could not create user account during Google sign-in.";
    case "Callback":
      return "An error occurred during authentication callback.";
    case "OAuthAccountNotLinked":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return `Authentication error: ${error}`;
  }
}

function SignInContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const authErrorMsg = getErrorMessage(urlError);

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [hasGoogle, setHasGoogle] = useState<boolean | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";

  useEffect(() => {
    getProviders()
      .then((providers) => {
        setHasGoogle(Boolean(providers && providers.google));
      })
      .catch(() => {
        setHasGoogle(false);
      });
  }, []);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: "/profile" });
  };

  const handleSignOut = () => {
    // Start a fresh anonymous identity so the next visitor never writes into
    // this account's progress.
    try {
      localStorage.removeItem("clientId");
    } catch {}
    signOut({ callbackUrl: "/" });
  };

  const handleSimulatedSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em) {
      setMsg("Please enter an email address.");
      setIsError(true);
      return;
    }
    // Update local profile with email
    fetch(`/api/learner/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: em.split("@")[0] }),
    })
      .then(() => {
        setMsg("Signed in ✔");
        setIsError(false);
        setTimeout(() => {
          window.location.href = "/profile";
        }, 600);
      })
      .catch(() => {
        setMsg("Could not sign in.");
        setIsError(true);
      });
  };

  if (session?.user) {
    return (
      <main className="wrap" id="app" style={{ minHeight: "60vh", paddingTop: 40 }}>
        <div className="crumbs">
          <Link href="/">Home</Link> / Account
        </div>
        <div className="thead">
          <h1>You are signed in</h1>
        </div>
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User Avatar"}
                style={{ width: 54, height: 54, borderRadius: "50%" }}
              />
            )}
            <div>
              <h3 style={{ margin: 0 }}>{session.user.name || "Learner"}</h3>
              <p className="sub" style={{ margin: 0 }}>
                {session.user.email}
              </p>
            </div>
          </div>
          <p className="sub">
            Your progress, streaks, and certificates are synced with your Google account. Sign in with this account on
            any device to continue right where you left off.
          </p>
          <div className="dact" style={{ marginTop: 20 }}>
            <Link className="btn pri" href="/profile">
              Open my profile
            </Link>
            <button className="btn" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap" id="app" style={{ minHeight: "60vh", paddingTop: 40 }}>
      <div className="crumbs">
        <Link href="/">Home</Link> / Sign in
      </div>
      <div className="thead">
        <h1>Sign in</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          Sync your progress, certificates, and streaks across all devices for free.
        </p>
      </div>

      <div className="panel signbox">
        {/* Error notification from NextAuth callback */}
        {authErrorMsg && (
          <div
            style={{
              background: "rgba(234, 67, 53, 0.12)",
              border: "1px solid var(--nob, #ea4335)",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "13px",
              color: "var(--nob, #ea4335)",
              lineHeight: "1.45",
            }}
          >
            <b>Sign-in notice:</b> {authErrorMsg}
          </div>
        )}

        {/* Warning if Google OAuth credentials not found on server */}
        {hasGoogle === false && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid #f59e0b",
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "13px",
              color: "var(--fg)",
              lineHeight: "1.45",
            }}
          >
            <b>Google Sign-In is not configured:</b> <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code> are not set in the <code>.env</code> file.
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          className="btn"
          disabled={googleLoading || hasGoogle === false}
          onClick={handleGoogleSignIn}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            padding: "12px 20px",
            fontSize: "15px",
            fontWeight: 700,
            borderRadius: "12px",
            cursor: googleLoading || hasGoogle === false ? "not-allowed" : "pointer",
            opacity: hasGoogle === false ? 0.6 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div style={{ textAlign: "center", margin: "10px 0", color: "var(--muted)", fontSize: "14px" }}>
          — or continue with your email —
        </div>

        <form onSubmit={handleSimulatedSignIn} style={{ display: "grid", gap: 10 }}>
          <label htmlFor="semail">
            <b>Email</b>
          </label>
          <input
            id="semail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn pri" id="sgo" type="submit" style={{ marginTop: 4 }}>
            Continue
          </button>
        </form>

        {msg && <p className={`smsg ${isError ? "bad" : ""}`}>{msg}</p>}

        <p className="sub" style={{ margin: "16px 0 0" }}>
          Progress you already made in this browser is saved to your account the first time you sign in. Signing in on
          another device brings it with you.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="wrap" id="app" style={{ minHeight: "60vh", paddingTop: 40 }}>
          <div className="crumbs">
            <Link href="/">Home</Link> / Sign in
          </div>
          <div className="thead">
            <h1>Sign in</h1>
            <p className="sub">Loading...</p>
          </div>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
