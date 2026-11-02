import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "data", "admin-config.json");

export async function GET() {
  let url = "https://github.com/you/java-notes";
  if (fs.existsSync(configPath)) {
    try {
      const conf = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (conf.githubUrl) url = conf.githubUrl;
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ url });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ githubUrl: body.url }, null, 2), "utf8");
    return NextResponse.json({ ok: true, url: body.url });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
