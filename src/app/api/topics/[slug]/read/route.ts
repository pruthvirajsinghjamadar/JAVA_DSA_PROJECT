import { NextRequest, NextResponse } from "next/server";
import { getTopicBySlug } from "@/lib/course-data";
import { getClientStore, saveClientStore, logActivity } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await req.json();
    const clientId = body.clientId || "anon";
    const store = await getClientStore(clientId);

    const topic = getTopicBySlug(slug);
    if (!topic) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 404 });
    }

    if (!store.reads.includes(topic.id)) {
      store.reads.push(topic.id);
      logActivity(store, "lessons");
      await saveClientStore(clientId, store);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
