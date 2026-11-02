import { NextRequest, NextResponse } from "next/server";
import { getTopicBySlug, getChallengesForTopic, getDailyChallenge } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";
import { getBestQuizScore, getCodingStats } from "@/lib/course-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const topic = getTopicBySlug(slug);
  if (!topic) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
  }

  const daily = getDailyChallenge();
  const isDaily = daily && daily.topicSlug === topic.slug;

  if (!store.reads.includes(topic.id) && !isDaily) {
    return NextResponse.json({ error: "Read the lesson first" }, { status: 403 });
  }

  const cs = getCodingStats(store, topic);
  const challenges = getChallengesForTopic(topic.id);
  const bestQuiz = getBestQuizScore(store, topic.id);

  return NextResponse.json({
    ...cs,
    quizPassed: bestQuiz.passed,
    previewSkip: true,
    challenges: challenges.map((c) => {
      const pr = store.code[c.id] || { runs: 0, code: c.starter, passed: 0 };
      return {
        id: c.id,
        position: c.position,
        difficulty: c.difficulty,
        title: c.title,
        prompt: c.prompt,
        hint: c.hint,
        runs: pr.runs || 0,
        canReveal: (pr.runs || 0) >= 3 && Boolean(c.solution),
        starter: c.starter,
        code: pr.code || c.starter,
        passed: Boolean(pr.passed),
        tests: c.tests,
        hiddenCount: c.hiddenCount,
      };
    }),
  });
}
