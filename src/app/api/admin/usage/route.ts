import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const span = Number(req.nextUrl.searchParams.get("days") || "30");

  const names = [
    "Asha Verma",
    "Rohan Patil",
    "Sneha Kulkarni",
    "Aman Shaikh",
    "Priya Nair",
    "Karan Mehta",
    "Divya Rao",
    "Imran Khan",
    "Neha Joshi",
    "Vikram Singh",
    "Pooja Desai",
  ];

  const ymd = (o: number) => new Date(Date.now() - o * 864e5).toISOString().slice(0, 10);

  const daily = [];
  const joined = [];

  for (let i = span - 1; i >= 0; i--) {
    const p = Math.max(0, Math.round(3 + (span - i) * 0.08 + Math.sin(i * 1.3) * 3 + (i < 10 ? 3 : 0)));
    if (i % 11 === 5) continue;
    daily.push({
      day: ymd(i),
      people: p,
      lessons: p * 2,
      tasks: p * 3,
      quizzes: p,
      runs: p * 4,
      solved: p,
    });
    if (i % 3 === 0) joined.push({ day: ymd(i), n: 1 + (i % 2) });
  }

  const people = names.map((n, k) => ({
    name: n,
    client_id: Math.random().toString(16).slice(2, 8),
    created_at: ymd(25 - k * 2) + " 10:00:00",
    lastActive: ymd(k % 6),
    activeDays: 12 - k,
    lessons: 20 - k,
    quizzes: 15 - k,
    runs: 60 - k * 4,
    solved: 14 - k,
    topicsCertified: Math.max(0, 8 - k),
    course: 0,
  }));

  const totals = {
    learners: 68,
    activeToday: 9,
    active7: 31,
    active30: 54,
    returning: 37,
    lessons: 812,
    quizzes: 540,
    runs: 2310,
    solved: 402,
    certificates: 96,
    courseCertificates: 2,
  };

  return NextResponse.json({
    totals,
    span,
    people,
    daily,
    joined,
  });
}
