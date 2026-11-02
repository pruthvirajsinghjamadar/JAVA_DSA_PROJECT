import { NextRequest, NextResponse } from "next/server";
import { getChallengeById, getTodayKey, getDailyChallenge } from "@/lib/course-data";
import { getClientStore, saveClientStore, logActivity } from "@/lib/db";
import { evaluateJavaCode } from "@/lib/java-evaluator";
import { getCodingStats, getBestQuizScore, tryCertifyTopic } from "@/lib/course-engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const challengeId = Number(id);
    const clientId = body.clientId || "anon";
    const userCode = body.code || "";
    const store = await getClientStore(clientId);

    const found = getChallengeById(challengeId);
    if (!found) {
      return NextResponse.json({ error: "Unknown challenge" }, { status: 404 });
    }

    const { challenge, topic } = found;

    if (!store.code[challenge.id]) {
      store.code[challenge.id] = { passed: 0, code: challenge.starter, runs: 0 };
    }

    store.code[challenge.id].runs = (store.code[challenge.id].runs || 0) + 1;
    store.code[challenge.id].code = userCode;
    logActivity(store, "runs");

    // Evaluate Java Code
    const evaluation = evaluateJavaCode(challenge, userCode);

    let certification = null;
    if (evaluation.passed) {
      store.code[challenge.id].passed = 1;
      logActivity(store, "solved");

      // Check daily challenge match
      const today = getTodayKey();
      const daily = getDailyChallenge(today);
      if (daily && daily.id === challenge.id && !store.daily.includes(today)) {
        store.daily.push(today);
      }

      certification = tryCertifyTopic(store, topic);
    }

    await saveClientStore(clientId, store);

    const codingStats = getCodingStats(store, topic);
    const quizStats = getBestQuizScore(store, topic.id);

    return NextResponse.json({
      compile: evaluation.compile,
      tests: evaluation.tests,
      passed: evaluation.passed,
      everPassed: Boolean(store.code[challenge.id]?.passed),
      coding: codingStats,
      certificate: certification ? certification.certificate : null,
      milestones: certification ? certification.milestones : [],
      quizPassed: quizStats.passed,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
