"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export function Footer() {
  const { data: session } = useSession();

  return (
    <footer>
      Made with <span className="heart">❤</span> by{" "}
      <a
        className="byme"
        href="https://www.linkedin.com/in/pruthvirajsingh-jamadar-82aa4b383/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <b>Pruthvirajsingh</b>
      </a>
      <br />
      <Link href="/admin" style={{ fontSize: "14px" }}>
        Admin dashboard (demo data)
      </Link>
      <br />
      <Link href="/signin" className="foot-signin" style={{ fontSize: "14px" }}>
        {session?.user?.email ? `Signed in as ${session.user.email}` : "Sign in"}
      </Link>
    </footer>
  );
}
