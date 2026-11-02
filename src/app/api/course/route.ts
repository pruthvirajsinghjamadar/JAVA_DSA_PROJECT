import { NextRequest, NextResponse } from "next/server";
import { D, PASS_MARK, CODE_PASS_MARK, estimateTopicTime } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";
import { getBestQuizScore, getCodingStats, getCertOf } from "@/lib/course-engine";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const levels = D.levels.map((l) => ({
    ...l,
    certificate: getCertOf(store, "level", l.id),
    topics: D.topics
      .filter((t) => t.level_id === l.id)
      .map((t) => {
        const b = getBestQuizScore(store, t.id);
        const cs = getCodingStats(store, t);
        return {
          id: t.id,
          level_id: t.level_id,
          slug: t.slug,
          title: t.title,
          summary: t.summary,
          minutes: t.minutes,
          needs: t.needs || [],
          estMinutes: estimateTopicTime(t).total,
          read: store.reads.includes(t.id),
          tasksDone: t.tasks.filter((x) => store.tasks.includes(x.id)).length,
          tasksTotal: t.tasks.length,
          passed: b.passed,
          bestScore: b.score,
          codeTotal: cs.total,
          codeRequired: cs.required,
          codeSolved: cs.solved,
          certificate: getCertOf(store, "topic", t.id),
        };
      }),
  }));

  const nCert = new Set(store.certs.filter((k) => k.kind === "topic").map((k) => k.refId)).size;

  return NextResponse.json({
    levels,
    passMark: PASS_MARK,
    codePassMark: CODE_PASS_MARK,
    courseTotal: D.topics.length,
    courseCertified: nCert,
    courseComplete: nCert === D.topics.length,
    courseCertificate: getCertOf(store, "course", 0),
  });
}
