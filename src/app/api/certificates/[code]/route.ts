import { NextRequest, NextResponse } from "next/server";
import { getTopicById, getLevelById } from "@/lib/course-data";
import { getClientStore, hasDatabaseUrl, prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

interface CertMatch {
  code: string;
  kind: string;
  refId: number;
  score: number | null;
  total: number | null;
  issuedAt: string;
  learnerName: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  let foundCert: CertMatch | null = null;

  if (hasDatabaseUrl && prisma) {
    try {
      // Search every learner's certificate list for this code (JSONB containment).
      const rows = await prisma.$queryRaw<{ data: any }[]>`
        SELECT data FROM "LearnerState"
        WHERE data->'certs' @> ${JSON.stringify([{ code: upperCode }])}::jsonb
        LIMIT 1
      `;
      const match = rows[0]?.data?.certs?.find((c: any) => c.code === upperCode);
      if (match) {
        foundCert = { ...match, learnerName: rows[0].data.name || "" };
      }
    } catch (e) {
      console.warn("Cert Postgres query failed, falling back to local file:", e);
    }
  }

  if (!foundCert) {
    // Development fallback: scan the local JSON store.
    const localStorePath = path.join(process.cwd(), "data", "local-store.json");
    if (fs.existsSync(localStorePath)) {
      try {
        const all = JSON.parse(fs.readFileSync(localStorePath, "utf8"));
        for (const clientId of Object.keys(all)) {
          const store = all[clientId];
          const match = store.certs.find((c: any) => c.code === upperCode);
          if (match) {
            foundCert = { ...match, learnerName: store.name || "" };
            break;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Last resort: check the shared anon store
  if (!foundCert) {
    const store = await getClientStore("anon");
    const match = store.certs.find((c) => c.code === upperCode);
    if (match) {
      foundCert = { ...match, learnerName: store.name || "" };
    }
  }

  if (!foundCert) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  let title = "Java + DSA: Complete Course";
  let level = null;

  if (foundCert.kind === "topic") {
    const t = getTopicById(foundCert.refId);
    title = t?.title || `Topic #${foundCert.refId}`;
    level = t ? getLevelById(t.level_id)?.title || null : null;
  } else if (foundCert.kind === "level") {
    title = getLevelById(foundCert.refId)?.title || `Level #${foundCert.refId}`;
  }

  return NextResponse.json({
    code: foundCert.code,
    kind: foundCert.kind,
    title,
    level,
    learner: foundCert.learnerName,
    score: foundCert.score,
    total: foundCert.total,
    issuedAt: foundCert.issuedAt,
  });
}
