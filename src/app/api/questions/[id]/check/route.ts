import { NextRequest, NextResponse } from "next/server";
import { D } from "@/lib/course-data";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const qid = Number(id);
    const choice = Number(body.choice);

    const question = D.topics.flatMap((t) => t.quiz).find((q) => q.id === qid);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({
      correct: choice === question.ans,
      correctIndex: question.ans,
      explanation: question.e,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
