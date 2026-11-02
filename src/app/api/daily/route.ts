import { NextRequest, NextResponse } from "next/server";
import { getTodayKey, getDailyChallenge } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const day = getTodayKey();
  const pk = getDailyChallenge(day);

  if (!pk) {
    return NextResponse.json({ daily: null });
  }

  const sdone = store.daily.includes(day);

  // Daily streak
  const dailySet = new Set(store.daily);
  let streak = 0;
  const step = (d: string, k: number) => {
    const ms = Date.parse(d + "T12:00:00Z") + k * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  };
  let dDate = dailySet.has(day) ? day : step(day, -1);
  while (dailySet.has(dDate)) {
    streak++;
    dDate = step(dDate, -1);
  }

  return NextResponse.json({
    daily: {
      day,
      challengeId: pk.id,
      title: pk.title,
      difficulty: pk.difficulty,
      topicSlug: pk.topicSlug,
      topicTitle: pk.topicTitle,
      solved: sdone,
      streak,
      solvedBy: 37 + (sdone ? 1 : 0),
    },
  });
}
