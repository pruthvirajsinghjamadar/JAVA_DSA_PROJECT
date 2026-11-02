import { NextRequest, NextResponse } from "next/server";
import { getClientStore, saveClientStore, logActivity } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const taskId = Number(body.taskId);
    const done = Boolean(body.done);
    const store = await getClientStore(clientId);

    const had = store.tasks.includes(taskId);
    store.tasks = store.tasks.filter((x) => x !== taskId);
    if (done) {
      store.tasks.push(taskId);
      if (!had) logActivity(store, "tasks");
    }

    await saveClientStore(clientId, store);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
