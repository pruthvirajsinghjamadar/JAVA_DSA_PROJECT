import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { getMongoDb, isMongoConfigured } from "@/lib/mongodb";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim().length > 0 &&
    !process.env.DATABASE_URL.includes("hostname:5432") &&
    !process.env.DATABASE_URL.includes("user:password") &&
    !process.env.DATABASE_URL.includes("USER:PASSWORD")
);

export const prisma =
  global.prismaGlobal ||
  (hasDatabaseUrl
    ? new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : (null as unknown as PrismaClient));

if (process.env.NODE_ENV !== "production" && hasDatabaseUrl) {
  global.prismaGlobal = prisma;
}

export interface ClientStore {
  reads: number[];
  tasks: number[];
  attempts: { topicId: number; score: number; total: number; passed: boolean }[];
  certs: {
    code: string;
    kind: "topic" | "level" | "course";
    refId: number;
    score: number | null;
    total: number | null;
    issuedAt: string;
  }[];
  name: string;
  code: Record<number, { passed: number; code: string; runs: number }>;
  act: Record<string, { lessons: number; tasks: number; quizzes: number; runs: number; solved: number }>;
  sheet: string[];
  daily: string[];
}

export function emptyStore(): ClientStore {
  return {
    reads: [],
    tasks: [],
    attempts: [],
    certs: [],
    name: "",
    code: {},
    act: {},
    sheet: [],
    daily: [],
  };
}

/** Defensive rehydration: guarantees every field exists and is the right type. */
function normalizeStore(raw: unknown): ClientStore {
  const s = (raw || {}) as Partial<ClientStore>;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const obj = (v: unknown): Record<string, never> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, never>) : {});
  return {
    reads: arr<number>(s.reads),
    tasks: arr<number>(s.tasks),
    attempts: arr<ClientStore["attempts"][0]>(s.attempts),
    certs: arr<ClientStore["certs"][0]>(s.certs),
    name: typeof s.name === "string" ? s.name : "",
    code: obj(s.code) as ClientStore["code"],
    act: obj(s.act) as ClientStore["act"],
    sheet: arr<string>(s.sheet),
    daily: arr<string>(s.daily),
  };
}

// ---------- Local JSON fallback (development without DATABASE_URL) ----------

const localStorePath = path.join(process.cwd(), "data", "local-store.json");

function readLocalStore(): Record<string, ClientStore> {
  try {
    if (fs.existsSync(localStorePath)) {
      return JSON.parse(fs.readFileSync(localStorePath, "utf8"));
    }
  } catch (e) {
    console.error("Error reading local store:", e);
  }
  return {};
}

function writeLocalStore(data: Record<string, ClientStore>) {
  try {
    const dir = path.dirname(localStorePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error writing local store:", e);
  }
}

// ---------- Public store API (Postgres first, file fallback) ----------

export async function getClientStore(clientId: string): Promise<ClientStore> {
  if (hasDatabaseUrl && prisma) {
    try {
      const row = await prisma.learnerState.findUnique({ where: { clientId } });
      return normalizeStore(row?.data);
    } catch (e) {
      console.warn("Postgres connection failed, falling back to local store:", (e as any)?.message || e);
    }
  }
  const all = readLocalStore();
  if (!all[clientId]) {
    all[clientId] = emptyStore();
    writeLocalStore(all);
  }
  return all[clientId];
}

export async function saveClientStore(clientId: string, store: ClientStore): Promise<void> {
  if (hasDatabaseUrl && prisma) {
    try {
      await prisma.learnerState.upsert({
        where: { clientId },
        create: { clientId, data: store as object },
        update: { data: store as object },
      });
      return;
    } catch (e) {
      console.warn("Postgres upsert failed, falling back to local store:", (e as any)?.message || e);
    }
  }
  const all = readLocalStore();
  all[clientId] = store;
  writeLocalStore(all);
}

export function logActivity(store: ClientStore, kind: "lessons" | "tasks" | "quizzes" | "runs" | "solved", dayKey?: string) {
  const day = dayKey || new Date().toISOString().slice(0, 10);
  if (!store.act[day]) {
    store.act[day] = { lessons: 0, tasks: 0, quizzes: 0, runs: 0, solved: 0 };
  }
  store.act[day][kind] = (store.act[day][kind] || 0) + 1;
}

export function generateCertCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `JD-${part(4)}-${part(4)}`;
}

/**
 * Merge a device-local store into an account store so no progress is lost
 * when a learner signs in. Account data wins on conflicts; activity counts
 * are summed per day.
 */
export function mergeStores(account: ClientStore, local: ClientStore): ClientStore {
  const out = normalizeStore(JSON.parse(JSON.stringify(account)));

  const uniqNums = (a: number[], b: number[]) => Array.from(new Set([...a, ...b]));
  out.reads = uniqNums(out.reads, local.reads);
  out.tasks = uniqNums(out.tasks, local.tasks);
  out.sheet = Array.from(new Set([...out.sheet, ...local.sheet]));
  out.daily = Array.from(new Set([...out.daily, ...local.daily]));
  out.attempts = [...out.attempts, ...local.attempts];
  out.certs = [...out.certs, ...local.certs.filter((lc) => !out.certs.some((c) => c.code === lc.code))];

  for (const [idStr, lc] of Object.entries(local.code || {})) {
    const id = Number(idStr);
    const ac = out.code[id];
    out.code[id] = ac
      ? {
          passed: Math.max(ac.passed || 0, lc.passed || 0) ? 1 : 0,
          runs: (ac.runs || 0) + (lc.runs || 0),
          code: ac.code || lc.code,
        }
      : { passed: lc.passed || 0, code: lc.code, runs: lc.runs || 0 };
  }

  for (const [day, la] of Object.entries(local.act || {})) {
    if (!out.act[day]) out.act[day] = { lessons: 0, tasks: 0, quizzes: 0, runs: 0, solved: 0 };
    out.act[day].lessons += la.lessons || 0;
    out.act[day].tasks += la.tasks || 0;
    out.act[day].quizzes += la.quizzes || 0;
    out.act[day].runs += la.runs || 0;
    out.act[day].solved += la.solved || 0;
  }

  if (!out.name && local.name) out.name = local.name;
  return out;
}

/** True if the store holds anything worth merging into an account. */
export function hasProgress(store: ClientStore): boolean {
  return Boolean(
    store.reads.length ||
      store.tasks.length ||
      store.attempts.length ||
      store.certs.length ||
      store.sheet.length ||
      store.daily.length ||
      Object.keys(store.code || {}).length ||
      Object.keys(store.act || {}).length ||
      store.name
  );
}
