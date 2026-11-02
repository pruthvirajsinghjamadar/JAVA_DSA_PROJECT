import { NextRequest, NextResponse } from "next/server";
import { getTopicBySlug, PASS_MARK } from "@/lib/course-data";
import { getClientStore, saveClientStore, logActivity } from "@/lib/db";
import { getCodingStats, tryCertifyTopic } from "@/lib/course-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId") || "anon";
  const store = await getClientStore(clientId);

  const topic = getTopicBySlug(slug);
  if (!topic) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
  }

  if (!store.reads.includes(topic.id)) {
    return NextResponse.json({ error: "Read the lesson first" }, { status: 403 });
  }

  return NextResponse.json(
    topic.quiz.map((q) => ({
      id: q.id,
      question: q.q,
      options: q.opts,
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await req.json();
    const clientId = body.clientId || "anon";
    const answers = body.answers || {};
    const store = await getClientStore(clientId);

    const topic = getTopicBySlug(slug);
    if (!topic) {
      return NextResponse.json({ error: "Unknown topic" }, { status: 404 });
    }

    if (!store.reads.includes(topic.id)) {
      return NextResponse.json({ error: "Read the lesson first" }, { status: 403 });
    }

    const results = topic.quiz.map((q) => {
      const chosen = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
      const correct = chosen === q.ans;
      return {
        id: q.id,
        chosen,
        correctIndex: q.ans,
        correct,
        explanation: q.e,
      };
    });

    const score = results.filter((r) => r.correct).length;
    const passed = score / topic.quiz.length >= PASS_MARK;

    store.attempts.push({
      topicId: topic.id,
      score,
      total: topic.quiz.length,
      passed,
    });
    logActivity(store, "quizzes");

    const certification = passed ? tryCertifyTopic(store, topic) : null;
    const cs = getCodingStats(store, topic);

    await saveClientStore(clientId, store);

    return NextResponse.json({
      score,
      total: topic.quiz.length,
      passed,
      passMark: PASS_MARK,
      results,
      certificate: certification ? certification.certificate : null,
      milestones: certification ? certification.milestones : [],
      coding: cs.total ? cs : null,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
