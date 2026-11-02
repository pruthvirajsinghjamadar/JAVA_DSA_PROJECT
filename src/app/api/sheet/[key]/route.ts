import { NextRequest, NextResponse } from "next/server";
import { getClientStore, saveClientStore } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const body = await req.json();
    const clientId = body.clientId || "anon";
    const done = Boolean(body.done);
    const store = await getClientStore(clientId);

    store.sheet = store.sheet.filter((k) => k !== key);
    if (done) {
      store.sheet.push(key);
    }

    await saveClientStore(clientId, store);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
