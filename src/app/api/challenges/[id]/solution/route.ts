import { NextRequest, NextResponse } from "next/server";
import { getChallengeById } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challengeId = Number(id);
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const found = getChallengeById(challengeId);
  if (!found) {
    return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
  }

  const runs = store.code[challengeId]?.runs || 0;
  if (runs < 3) {
    return NextResponse.json(
      { error: "Run your code at least 3 times first. Try the hint before you look at the solution." },
      { status: 403 }
    );
  }

  return NextResponse.json({ solution: found.challenge.solution });
}
