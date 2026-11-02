"use client";

export function getClientId(): string {
  if (typeof window === "undefined") return "anon";
  let id = "";
  try {
    id = localStorage.getItem("clientId") || "";
  } catch {}
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem("clientId", id);
    } catch {}
  }
  return id;
}
