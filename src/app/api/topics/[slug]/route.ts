import { NextRequest, NextResponse } from "next/server";
import { D, getTopicBySlug, getLevelById, PASS_MARK, estimateTopicTime, getDailyChallenge } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";
import { getBestQuizScore, getCodingStats, getCertOf } from "@/lib/course-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const topic = getTopicBySlug(slug);
  if (!topic) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
  }

  const b = getBestQuizScore(store, topic.id);
  const cs = getCodingStats(store, topic);
  const i = D.topics.indexOf(topic);

  const pn = (x?: (typeof D.topics)[0]) => (x ? { slug: x.slug, title: x.title } : null);

  const daily = getDailyChallenge();

  return NextResponse.json({
    slug: topic.slug,
    title: topic.title,
    summary: topic.summary,
    minutes: topic.minutes,
    level: { id: topic.level_id, title: getLevelById(topic.level_id)?.title || "" },
    lesson: topic.lesson,
    tasks: topic.tasks.map((x) => ({
      id: x.id,
      task: x.task,
      done: store.tasks.includes(x.id),
    })),
    read: store.reads.includes(topic.id),
    quizTotal: topic.quiz.length,
    coding: cs.total ? cs : null,
    quizPassed: b.passed,
    passMark: PASS_MARK,
    bestScore: b.score,
    certificate: getCertOf(store, "topic", topic.id),
    prev: pn(D.topics[i - 1]),
    next: D.topics[i + 1] ? { ...pn(D.topics[i + 1]), summary: D.topics[i + 1].summary } : null,
    dailyId: daily?.topicSlug === topic.slug ? daily.id : null,
    estimate: estimateTopicTime(topic),
    prereqs: (topic.needs || []).map((x) => {
      const neededTopic = getTopicBySlug(x);
      return {
        slug: x,
        title: neededTopic?.title || x,
        certified: !!(neededTopic && getCertOf(store, "topic", neededTopic.id)),
      };
    }),
  });
}
