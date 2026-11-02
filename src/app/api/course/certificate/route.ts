import { NextRequest, NextResponse } from "next/server";
import { D } from "@/lib/course-data";
import { getClientStore, saveClientStore } from "@/lib/db";
import { issueCertificate } from "@/lib/course-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId = body.clientId || "anon";
    const store = await getClientStore(clientId);

    const have = new Set(store.certs.filter((k) => k.kind === "topic").map((k) => k.refId)).size;
    if (have < D.topics.length) {
      return NextResponse.json(
        { error: `Finish every topic first (${have} of ${D.topics.length} certified).` },
        { status: 403 }
      );
    }

    if (typeof body.name === "string" && body.name.trim()) {
      store.name = body.name.replace(/\s+/g, " ").trim().slice(0, 60);
    }

    const c = issueCertificate(store, "course", 0);
    await saveClientStore(clientId, store);

    return NextResponse.json({ code: c.code, isNew: c.isNew });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
