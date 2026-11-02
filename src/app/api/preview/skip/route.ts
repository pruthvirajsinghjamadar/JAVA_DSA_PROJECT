import { NextRequest, NextResponse } from "next/server";
import { getChallengeById, getTodayKey, getDailyChallenge } from "@/lib/course-data";
import { getClientStore, saveClientStore, logActivity } from "@/lib/db";
import { getCodingStats, getBestQuizScore, tryCertifyTopic } from "@/lib/course-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const challengeId = Number(body.challengeId);
    const clientId = body.clientId || "anon";
    const store = await getClientStore(clientId);

    const found = getChallengeById(challengeId);
    if (!found) {
      return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
    }

    const { challenge, topic } = found;

    if (!store.code[challenge.id]?.passed) {
      logActivity(store, "runs");
      logActivity(store, "solved");
    }

    store.code[challenge.id] = {
      passed: 1,
      code: store.code[challenge.id]?.code || challenge.starter,
      runs: (store.code[challenge.id]?.runs || 0) + 1,
    };

    const today = getTodayKey();
    const daily = getDailyChallenge(today);
    if (daily && daily.id === challenge.id && !store.daily.includes(today)) {
      store.daily.push(today);
    }

    const certification = tryCertifyTopic(store, topic);
    await saveClientStore(clientId, store);

    const codingStats = getCodingStats(store, topic);
    const quizStats = getBestQuizScore(store, topic.id);

    return NextResponse.json({
      passed: true,
      everPassed: true,
      compile: { ok: true },
      tests: [],
      coding: codingStats,
      certificate: certification ? certification.certificate : null,
      milestones: certification ? certification.milestones : [],
      quizPassed: quizStats.passed,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
