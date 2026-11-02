import { NextResponse } from "next/server";
import { D } from "@/lib/course-data";

export async function GET() {
  return NextResponse.json(D.resources);
}
