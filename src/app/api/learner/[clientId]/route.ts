import { NextRequest, NextResponse } from "next/server";
import { D, getTopicById, getLevelById } from "@/lib/course-data";
import { getClientStore, saveClientStore } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const store = await getClientStore(clientId);

  const getTitle = (c: (typeof store.certs)[0]) => {
    if (c.kind === "topic") {
      return getTopicById(c.refId)?.title || `Topic #${c.refId}`;
    }
    if (c.kind === "level") {
      return getLevelById(c.refId)?.title || `Level #${c.refId}`;
    }
    return "Java + DSA: Complete Course";
  };

  const certificates = store.certs
    .slice()
    .reverse()
    .map((c) => ({
      code: c.code,
      kind: c.kind,
      refId: c.refId,
      score: c.score,
      total: c.total,
      issuedAt: c.issuedAt,
      title: getTitle(c),
    }));

  return NextResponse.json({
    name: store.name || "",
    certificates,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const name = String(body.name || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

    const store = await getClientStore(clientId);
    store.name = name;
    await saveClientStore(clientId, store);

    return NextResponse.json({ ok: true, name: store.name });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
