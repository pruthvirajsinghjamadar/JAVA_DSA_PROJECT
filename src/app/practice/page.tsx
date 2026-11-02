"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getClientId } from "@/lib/client-id";

interface DailyChallenge {
  day: string;
  challengeId: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topicSlug: string;
  topicTitle: string;
  solved: boolean;
  solvedBy: number;
  streak: number;
  totalSolved: number;
  yesterday: {
    title: string;
    difficulty: "easy" | "medium" | "hard";
    topicSlug: string;
    challengeId: number;
    solved: boolean;
  } | null;
}

interface SheetProblem {
  key: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  url: string;
  done: boolean;
}

interface SheetTopic {
  name: string;
  problems: SheetProblem[];
}

interface RunnableItem {
  id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  passed: boolean;
}

interface RunnableGroup {
  slug: string;
  title: string;
  level: number;
  items: RunnableItem[];
}

interface PracticeData {
  daily: DailyChallenge | null;
  sheet: SheetTopic[];
  sheetDone: number;
  sheetTotal: number;
  runnable: RunnableGroup[];
}

export default function PracticePage() {
  const [data, setData] = useState<PracticeData | null>(null);
  const [view, setView] = useState<"sheet" | "run">("sheet");
  const [filt, setFilt] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [hideDone, setHideDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";

  const loadData = async () => {
    try {
      const res = await fetch(`/api/practice?clientId=${clientId}`).then((r) => r.json());
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const handleToggleSheetItem = async (key: string, checked: boolean) => {
    if (!data) return;
    setData({
      ...data,
      sheetDone: data.sheetDone + (checked ? 1 : -1),
      sheet: data.sheet.map((t) => ({
        ...t,
        problems: t.problems.map((p) => (p.key === key ? { ...p, done: checked } : p)),
      })),
    });
    try {
      await fetch(`/api/sheet/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, done: checked }),
      });
    } catch {}
  };

  if (loading) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <p className="sub">Loading practice questions...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <div className="panel empty">Could not load the practice page. Is the server running?</div>
      </main>
    );
  }

  const DL = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const dchip = (d: "easy" | "medium" | "hard") => <span className={`chip d-${d}`}>{DL[d]}</span>;

  const prettyDay = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  const D = data.daily;
  const keep = (q: SheetProblem) => (filt === "all" || q.difficulty === filt) && !(hideDone && q.done);
  const sheetPct = data.sheetTotal ? (data.sheetDone / data.sheetTotal) * 100 : 0;

  const runTotal = data.runnable.reduce((a, g) => a + g.items.length, 0);
  const runDone = data.runnable.reduce((a, g) => a + g.items.filter((i) => i.passed).length, 0);
  const runPct = runTotal ? (runDone / runTotal) * 100 : 0;

  return (
    <main className="wrap" id="app">
      <div className="crumbs">
        <Link href="/">Home</Link> / Practice
      </div>

      <div className="thead">
        <h1>Practice</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          Solve one question a day, then work through a full DSA problem list.
        </p>
      </div>

      {/* Daily Card */}
      {D && (
        <div className={`panel daily ${D.solved ? "done" : ""}`}>
          <div className="dtop">
            <span className="chip y">Question of the day</span>
            <span className="sub" style={{ margin: 0 }}>
              {prettyDay(D.day)}
            </span>
          </div>
          <h2>{D.title}</h2>
          <div className="dmeta">
            {dchip(D.difficulty)}
            <span className="chip">{D.topicTitle}</span>
            <span className="chip">⏱ about 10 min</span>
          </div>
          <p className="dline">
            {D.solved ? (
              <b>✓ Solved today. Come back tomorrow for the next one.</b>
            ) : (
              "Everyone gets the same question today. No lesson needed to try it."
            )}
            <span className="dstat">🔥 {D.streak} day streak</span>
            <span className="dstat">
              👥 {D.solvedBy} {D.solvedBy === 1 ? "person" : "people"} solved it today
            </span>
          </p>
          <div className="dact">
            <Link className="btn pri" href={`/topic/${encodeURIComponent(D.topicSlug)}?c=${D.challengeId}`}>
              {D.solved ? "Open it again" : "Solve it now"}
            </Link>
            {D.yesterday && (
              <Link
                className="sub"
                style={{ margin: 0 }}
                href={`/topic/${encodeURIComponent(D.yesterday.topicSlug)}?c=${D.yesterday.challengeId}`}
              >
                Yesterday: {D.yesterday.title}
                {D.yesterday.solved ? " ✓" : ""}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="filters" style={{ marginTop: 26 }}>
        <span className="seg" id="tabsw">
          <button
            type="button"
            className={view === "sheet" ? "on" : ""}
            onClick={() => setView("sheet")}
          >
            DSA sheet ({data.sheetTotal})
          </button>
          <button
            type="button"
            className={view === "run" ? "on" : ""}
            onClick={() => setView("run")}
          >
            Run on this site ({runTotal})
          </button>
        </span>
      </div>

      <div id="pbody">
        {view === "sheet" ? (
          <div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="meterline">
                <b>
                  {data.sheetDone} of {data.sheetTotal} problems done
                </b>
                <span>Tick a problem when you have solved it. It is saved to your profile.</span>
              </div>
              <div className="meter">
                <i style={{ width: `${sheetPct}%` }} />
              </div>
            </div>

            <div className="filters">
              <span className="seg" id="fseg">
                {(["all", "easy", "medium", "hard"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={filt === f ? "on" : ""}
                    onClick={() => setFilt(f)}
                  >
                    {f === "all" ? "All" : DL[f]}
                  </button>
                ))}
              </span>
              <label className="ck" style={{ padding: 0 }}>
                <input
                  type="checkbox"
                  id="hd"
                  checked={hideDone}
                  onChange={(e) => setHideDone(e.target.checked)}
                />
                <span>Hide solved</span>
              </label>
            </div>

            {data.sheet.map((t, ti) => {
              const shown = t.problems.filter(keep);
              const doneCount = t.problems.filter((q) => q.done).length;
              if (!shown.length) return null;

              return (
                <details
                  className="panel sheet-topic"
                  key={t.name}
                  open={ti === 0 || filt !== "all" || hideDone}
                >
                  <summary>
                    <b>{t.name}</b>
                    <span className={`chip ${doneCount === t.problems.length ? "done" : ""}`}>
                      {doneCount} / {t.problems.length}
                    </span>
                  </summary>
                  {shown.map((q) => (
                    <div className={`prow ${q.done ? "done" : ""}`} key={q.key}>
                      <label className="ck">
                        <input
                          type="checkbox"
                          checked={q.done}
                          onChange={(e) => handleToggleSheetItem(q.key, e.target.checked)}
                        />
                        <span />
                      </label>
                      <a href={q.url} target="_blank" rel="noopener noreferrer">
                        {q.title} <small>↗</small>
                      </a>
                      {dchip(q.difficulty)}
                    </div>
                  ))}
                </details>
              );
            })}

            <p className="sub" style={{ marginTop: 14 }}>
              These problems open on LeetCode in a new tab. This is a hand-picked practice list that follows the usual
              DSA topic order. It is not a copy of any other site&apos;s sheet, and the problem statements stay on their own pages.
            </p>
          </div>
        ) : (
          <div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="meterline">
                <b>
                  {runDone} of {runTotal} solved
                </b>
                <span>These run on the site: write Java, press Run, and the tests check it.</span>
              </div>
              <div className="meter">
                <i style={{ width: `${runPct}%` }} />
              </div>
            </div>

            {data.runnable.map((g) => (
              <div className="panel sheet-topic" key={g.slug}>
                <div className="rh">
                  <b>{g.title}</b>
                  <span className="chip">Level {g.level}</span>
                </div>
                {g.items.map((i) => (
                  <Link
                    key={i.id}
                    className={`prow ${i.passed ? "done" : ""}`}
                    href={`/topic/${encodeURIComponent(g.slug)}?c=${i.id}`}
                  >
                    <span className="tick">{i.passed ? "✓" : ""}</span>
                    <span className="pt">{i.title}</span>
                    {dchip(i.difficulty)}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
