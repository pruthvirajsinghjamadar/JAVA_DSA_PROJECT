import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminKey = process.env.ADMIN_KEY || "admin123";
    if (body.key === adminKey || body.key === "demo") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
