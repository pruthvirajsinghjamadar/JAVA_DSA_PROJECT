import { NextRequest, NextResponse } from "next/server";
import { D } from "@/lib/course-data";
import { getClientStore, saveClientStore } from "@/lib/db";
import { issueCertificate, getBestQuizScore } from "@/lib/course-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId || req.nextUrl.searchParams.get("clientId") || "anon";
    const store = await getClientStore(clientId);

    D.topics.forEach((t) => {
      if (!store.reads.includes(t.id)) store.reads.push(t.id);
      if (!getBestQuizScore(store, t.id).passed) {
        store.attempts.push({ topicId: t.id, score: 5, total: 5, passed: true });
      }
      (D.challenges[String(t.id)] || []).forEach((c) => {
        store.code[c.id] = { passed: 1, code: c.starter, runs: 1 };
      });
      issueCertificate(store, "topic", t.id, 5, 5);
    });

    D.levels.forEach((l) => {
      issueCertificate(store, "level", l.id);
    });

    await saveClientStore(clientId, store);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
