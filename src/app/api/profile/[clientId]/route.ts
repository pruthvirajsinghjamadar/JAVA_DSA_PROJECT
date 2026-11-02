import { NextRequest, NextResponse } from "next/server";
import { D, getTopicById, getLevelById, estimateTopicTime, getChallengesForTopic } from "@/lib/course-data";
import { getClientStore } from "@/lib/db";
import { getBestQuizScore, getCodingStats, getCertOf } from "@/lib/course-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const store = await getClientStore(clientId);

  const today = new Date().toISOString().slice(0, 10);
  const keys = Object.keys(store.act).sort();

  const step = (d: string, k: number) => {
    const ms = Date.parse(d + "T12:00:00Z") + k * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  };

  const countN = (r: { lessons: number; tasks: number; quizzes: number; runs: number }) =>
    (r.lessons || 0) + (r.tasks || 0) + (r.quizzes || 0) + (r.runs || 0);

  const days = keys.map((k) => ({
    day: k,
    ...store.act[k],
    n: countN(store.act[k]),
  }));

  // Streaks
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  keys.forEach((d) => {
    run = prev && step(prev, 1) === d ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  });

  let currentStreak = 0;
  let curDate = store.act[today] ? today : step(today, -1);
  while (store.act[curDate] && countN(store.act[curDate]) > 0) {
    currentStreak++;
    curDate = step(curDate, -1);
  }

  // Daily streak
  const dailySet = new Set(store.daily);
  let dStreak = 0;
  let dDate = dailySet.has(today) ? today : step(today, -1);
  while (dailySet.has(dDate)) {
    dStreak++;
    dDate = step(dDate, -1);
  }

  const certTopics = new Set(store.certs.filter((k) => k.kind === "topic").map((k) => k.refId));
  const topicsCertified = certTopics.size;

  const totalChallenges = Object.keys(D.challenges).reduce((acc, k) => acc + D.challenges[k].length, 0);
  const challengesSolved = Object.values(store.code).filter((c) => c.passed).length;

  const sheetTotal = D.sheet.reduce((acc, t) => acc + t.problems.length, 0);
  const sheetDone = store.sheet.length;

  // Next topic
  const nextTopic = D.topics.find((t) => !certTopics.has(t.id));
  let nextInfo = null;
  if (nextTopic) {
    const isRead = store.reads.includes(nextTopic.id);
    const quizBest = getBestQuizScore(store, nextTopic.id);
    const cs = getCodingStats(store, nextTopic);

    const stepLabel = !isRead
      ? "Read the lesson"
      : !quizBest.passed
      ? "Pass the quiz"
      : cs.solved < cs.required
      ? `Solve coding challenges (${cs.solved}/${cs.required})`
      : "Complete certification";

    const levelTopics = D.topics.filter((t) => t.level_id === nextTopic.level_id);
    const levelDone = levelTopics.filter((t) => certTopics.has(t.id)).length;

    nextInfo = {
      title: nextTopic.title,
      slug: nextTopic.slug,
      step: stepLabel,
      estMinutes: estimateTopicTime(nextTopic).total,
      levelLeft: levelTopics.length - levelDone,
      levelTitle: getLevelById(nextTopic.level_id)?.title || "",
      courseLeft: D.topics.length - topicsCertified,
    };
  }

  const levels = D.levels.map((l) => {
    const lTopics = D.topics.filter((t) => t.level_id === l.id);
    const certCount = lTopics.filter((t) => certTopics.has(t.id)).length;
    return {
      id: l.id,
      title: l.title,
      total: lTopics.length,
      certified: certCount,
      certificate: getCertOf(store, "level", l.id),
    };
  });

  const certificates = store.certs
    .slice()
    .reverse()
    .map((c) => ({
      code: c.code,
      kind: c.kind,
      title:
        c.kind === "topic"
          ? getTopicById(c.refId)?.title || ""
          : c.kind === "level"
          ? getLevelById(c.refId)?.title || ""
          : "Java + DSA: Complete Course",
      issued_at: c.issuedAt,
    }));

  const topicsChecklist = D.topics.map((t) => {
    const best = getBestQuizScore(store, t.id);
    const cs = getCodingStats(store, t);
    return {
      id: t.id,
      level: t.level_id,
      slug: t.slug,
      title: t.title,
      read: store.reads.includes(t.id),
      tasksDone: t.tasks.filter((x) => store.tasks.includes(x.id)).length,
      tasksTotal: t.tasks.length,
      quizBest: best.score,
      quizPassed: best.passed,
      codeSolved: cs.solved,
      codeRequired: cs.required,
      certified: certTopics.has(t.id),
      estMinutes: estimateTopicTime(t).total,
    };
  });

  return NextResponse.json({
    name: store.name || "",
    joined: keys.length ? `${keys[0]} 10:00:00` : null,
    today,
    days,
    stats: {
      currentStreak,
      longestStreak,
      topicsCertified,
      topicsTotal: D.topics.length,
      challengesSolved,
      challengesTotal: totalChallenges,
      lessonsRead: store.reads.length,
    },
    daily: {
      streak: dStreak,
      sheetDone,
      sheetTotal,
    },
    next: nextInfo,
    levels,
    certificates,
    topics: topicsChecklist,
  });
}
