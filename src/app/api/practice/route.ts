import { NextRequest, NextResponse } from "next/server";
import { D, getTodayKey, getDailyChallenge } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const day = getTodayKey();
  const pk = getDailyChallenge(day);
  const yp = getDailyChallenge(new Date(Date.now() - 86400000).toISOString().slice(0, 10));

  const passedIds = new Set(
    Object.entries(store.code)
      .filter(([, v]) => v.passed)
      .map(([k]) => Number(k))
  );

  const sheet = D.sheet.map((t) => ({
    name: t.name,
    problems: t.problems.map((q) => ({
      ...q,
      done: store.sheet.includes(q.key),
    })),
  }));

  const sheetDone = sheet.reduce((a, t) => a + t.problems.filter((q) => q.done).length, 0);
  const sheetTotal = sheet.reduce((a, t) => a + t.problems.length, 0);

  const runnable = D.topics.map((t) => ({
    slug: t.slug,
    title: t.title,
    level: t.level_id,
    items: (D.challenges[String(t.id)] || []).map((c) => ({
      id: c.id,
      title: c.title,
      difficulty: c.difficulty,
      passed: passedIds.has(c.id),
    })),
  }));

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
    daily: pk
      ? {
          day,
          challengeId: pk.id,
          title: pk.title,
          difficulty: pk.difficulty,
          topicSlug: pk.topicSlug,
          topicTitle: pk.topicTitle,
          solved: sdone,
          solvedBy: 37 + (sdone ? 1 : 0),
          streak,
          totalSolved: store.daily.length,
          yesterday: yp
            ? {
                title: yp.title,
                difficulty: yp.difficulty,
                topicSlug: yp.topicSlug,
                challengeId: yp.id,
                solved: passedIds.has(yp.id),
              }
            : null,
        }
      : null,
    sheet,
    sheetDone,
    sheetTotal,
    runnable,
  });
}
