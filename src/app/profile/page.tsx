"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getClientId } from "@/lib/client-id";

interface ProfileStats {
  currentStreak: number;
  longestStreak: number;
  topicsCertified: number;
  topicsTotal: number;
  challengesSolved: number;
  challengesTotal: number;
  lessonsRead: number;
}

interface ActivityDay {
  day: string;
  lessons: number;
  tasks: number;
  quizzes: number;
  runs: number;
  solved?: number;
  n: number;
}

interface ProfileData {
  name: string;
  joined: string | null;
  today: string;
  days: ActivityDay[];
  stats: ProfileStats;
  daily: {
    streak: number;
    sheetDone: number;
    sheetTotal: number;
  } | null;
  next: {
    title: string;
    slug: string;
    step: string;
    estMinutes: number;
    levelLeft: number;
    levelTitle: string;
    courseLeft: number;
  } | null;
  levels: {
    id: number;
    title: string;
    total: number;
    certified: number;
    certificate: string | null;
  }[];
  certificates: {
    code: string;
    kind: "topic" | "level" | "course";
    title: string;
    issued_at: string;
  }[];
  topics: {
    id: number;
    level: number;
    slug: string;
    title: string;
    read: boolean;
    tasksDone: number;
    tasksTotal: number;
    quizBest: number | null;
    quizPassed: boolean;
    codeSolved: number;
    codeRequired: number;
    certified: boolean;
    estMinutes: number;
  }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const utc = (d: string) => Date.parse(d + "T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const nice = (d: string) => {
  const x = new Date(utc(d));
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const getLevel = (n: number) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [activeTip, setActiveTip] = useState("Hover or tap a square to see that day.");
  const [collapsedLevels, setCollapsedLevels] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const hmScrollRef = React.useRef<HTMLDivElement>(null);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";

  const loadProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${clientId}`).then((r) => r.json());
      setProfile(res);
      setName(res.name || "");
      if (hmScrollRef.current) {
        setTimeout(() => {
          if (hmScrollRef.current) hmScrollRef.current.scrollLeft = hmScrollRef.current.scrollWidth;
        }, 50);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [clientId]);

  const handleSaveName = async () => {
    try {
      const r = await fetch(`/api/learner/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => res.json());

      setName(r.name);
      setMsg("Saved ✔");
      setTimeout(() => setMsg(""), 2500);
    } catch {
      setMsg("Could not save. Try again.");
    }
  };

  if (loading) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <p className="sub">Loading profile...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <div className="panel empty">Could not load your profile. Is the server running?</div>
      </main>
    );
  }

  const S = profile.stats;
  const yearActive = profile.days.filter((r) => r.n > 0).length;
  const todayRow = profile.days.find((r) => r.day === profile.today);
  const doneToday = Boolean(todayRow && todayRow.n > 0);

  const what = (r: ActivityDay) => {
    const p: string[] = [];
    if (r.lessons) p.push(plural(r.lessons, "lesson") + " read");
    if (r.tasks) p.push(plural(r.tasks, "practice task") + " done");
    if (r.quizzes) p.push(plural(r.quizzes, "quiz attempt"));
    if (r.runs) p.push(plural(r.runs, "code run"));
    if (r.solved) p.push(plural(r.solved, "challenge") + " solved");
    return p.join(", ");
  };

  // Build heatmap cells
  const byDay = new Map(profile.days.map((r) => [r.day, r]));
  const dow = new Date(utc(profile.today)).getUTCDay();
  const start = utc(profile.today) - (dow + 52 * 7) * 86400000;
  const cells = [];
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < 53; w++) {
    const first = new Date(start + w * 7 * 86400000);
    const m = first.getUTCMonth();
    monthLabels.push(m !== lastMonth && first.getUTCDate() <= 7 ? MONTHS[m] : "");
    if (m !== lastMonth && first.getUTCDate() <= 7) lastMonth = m;

    for (let d = 0; d < 7; d++) {
      const day = iso(start + (w * 7 + d) * 86400000);
      if (day > profile.today) {
        cells.push(<i key={day} className="hm-cell empty" />);
        continue;
      }
      const r = byDay.get(day);
      const n = r ? r.n : 0;
      const tip = n ? `${nice(day)}: ${what(r)}` : `${nice(day)}: no activity`;

      cells.push(
        <i
          key={day}
          className={`hm-cell l${getLevel(n)}`}
          tabIndex={0}
          onMouseEnter={() => setActiveTip(tip)}
          onFocus={() => setActiveTip(tip)}
          onClick={() => setActiveTip(tip)}
          aria-label={tip}
        />
      );
    }
  }

  const fmtMin = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;

  const certLabels: Record<string, string> = {
    topic: "Topic certificate",
    level: "Level certificate",
    course: "Full course certificate",
  };

  return (
    <main className="wrap" id="app">
      <div className="crumbs">
        <Link href="/">Home</Link> / Profile
      </div>

      <div className="thead">
        <h1>{profile.name || "My profile"}</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          {profile.joined ? `Learning since ${nice(profile.joined.slice(0, 10))}. ` : ""}
          Everything you do on the site is saved here, day by day.
        </p>
      </div>

      {/* Account / Sync Nudge */}
      <div className={`panel nudge ${session?.user?.email ? "done" : ""}`}>
        {session?.user?.email ? (
          <>
            <b>✓ Signed in as {session.user.email}.</b> Your progress follows you to any device.{" "}
            <Link href="/signin">Account</Link>
          </>
        ) : (
          <>
            <b>Your progress is saved only in this browser.</b> Sign in with your Google account to keep it safe and
            sync it across all devices.{" "}
            <Link className="btn sm pri" href="/signin">
              Sign in with Google
            </Link>
          </>
        )}
      </div>

      {/* Daily learning status */}
      <div className={`panel nudge ${doneToday ? "done" : ""}`}>
        {doneToday ? (
          <>
            <b>✓ You learned today.</b> {todayRow ? what(todayRow) : ""}.
            {S.currentStreak > 1
              ? ` That is a ${S.currentStreak} day streak. Keep it going tomorrow!`
              : ""}
          </>
        ) : (
          <>
            <b>Nothing yet today.</b>{" "}
            {S.currentStreak
              ? `Your ${S.currentStreak} day streak ends tonight, so do one small thing now.`
              : "Read a lesson or solve a challenge to start a streak."}{" "}
            <Link className="btn sm pri" href="/#path">
              Open learning path
            </Link>
          </>
        )}
      </div>

      {/* Next Card */}
      {profile.next ? (
        <div className="panel nextstep">
          <div>
            <h3>Up next: {profile.next.title}</h3>
            <p>
              {profile.next.step} · ⏱ about {fmtMin(profile.next.estMinutes)}
            </p>
            <p style={{ fontWeight: 400, marginTop: 4 }}>
              {plural(profile.next.levelLeft, "topic")} left in {profile.next.levelTitle} ·{" "}
              {profile.next.courseLeft} of {S.topicsTotal} left in the course
            </p>
          </div>
          <Link className="btn pri" href={`/topic/${profile.next.slug}`}>
            Continue
          </Link>
        </div>
      ) : (
        <div className="panel nextstep">
          <div>
            <h3>🎉 Every topic is certified</h3>
            <p>Create your full course certificate from the learning path.</p>
          </div>
          <Link className="btn pri" href="/#path">
            Open learning path
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats">
        <div className={`panel stat ${S.currentStreak > 0 ? "hl" : ""}`}>
          <div className="big">
            {S.currentStreak}
            <small> day{S.currentStreak === 1 ? "" : "s"}</small>
          </div>
          <div>Current streak 🔥</div>
        </div>
        <div className="panel stat">
          <div className="big">
            {S.longestStreak}
            <small> day{S.longestStreak === 1 ? "" : "s"}</small>
          </div>
          <div>Longest streak</div>
        </div>
        <div className="panel stat">
          <div className="big">{yearActive}</div>
          <div>Active days this year</div>
        </div>
        <div className="panel stat">
          <div className="big">
            {S.topicsCertified} / {S.topicsTotal}
          </div>
          <div>Topics certified</div>
        </div>
        <div className="panel stat">
          <div className="big">
            {S.challengesSolved} / {S.challengesTotal}
          </div>
          <div>Coding challenges solved</div>
        </div>
        <div className="panel stat">
          <div className="big">{S.lessonsRead}</div>
          <div>Lessons read</div>
        </div>
        {profile.daily && (
          <>
            <div className="panel stat">
              <div className="big">
                {profile.daily.streak}
                <small> day{profile.daily.streak === 1 ? "" : "s"}</small>
              </div>
              <div>Daily question streak ⚡</div>
            </div>
            <div className="panel stat">
              <div className="big">
                {profile.daily.sheetDone} / {profile.daily.sheetTotal}
              </div>
              <div>DSA sheet problems done</div>
            </div>
          </>
        )}
      </div>

      <h2 className="ph">How certificates work</h2>
      <div className="panel">
        <ul className="reqs">
          <li>
            <b>Topic certificate:</b> score at least 4 of 5 on the quiz and solve at least 3 of the 4 coding
            challenges.
          </li>
          <li>
            <b>Level certificate:</b> earned automatically once every topic in the level is certified.
          </li>
          <li>
            <b>Full course certificate:</b> certify all {S.topicsTotal} topics, then create it with your name.
          </li>
        </ul>
      </div>

      {/* Daily Activity Heatmap */}
      <h2 className="ph">Daily activity</h2>
      <div className="panel hmbox">
        <div className="hm-scroll" ref={hmScrollRef}>
          <div className="hm">
            <div className="hm-months">
              {monthLabels.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
            <div className="hm-body">
              <div className="hm-days">
                <span />
                <span>Mon</span>
                <span />
                <span>Wed</span>
                <span />
                <span>Fri</span>
                <span />
              </div>
              <div className="hm-grid">{cells}</div>
            </div>
          </div>
        </div>
        <div className="hm-foot">
          <span id="hm-tip" className="hm-tip">
            {activeTip}
          </span>
          <span className="hm-legend">
            Less <i className="hm-cell l0" />
            <i className="hm-cell l1" />
            <i className="hm-cell l2" />
            <i className="hm-cell l3" />
            <i className="hm-cell l4" /> More
          </span>
        </div>
      </div>

      {/* Progress by Level */}
      <h2 className="ph">Progress by level</h2>
      <div className="panel lvlprog">
        {profile.levels.map((l) => (
          <div className="lp" key={l.id}>
            <div className="lp-top">
              <b>
                {l.id}. {l.title}
              </b>
              <span>
                {l.certified} / {l.total} topics
                {l.certificate && (
                  <>
                    {" · "}
                    <Link href={`/certificate/${encodeURIComponent(l.certificate)}`}>🎓 certificate</Link>
                  </>
                )}
              </span>
            </div>
            <div className="meter">
              <div
                style={{
                  width: `${l.total ? (l.certified / l.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* My Certificates */}
      <h2 className="ph">My certificates</h2>
      <div className="certgrid">
        {profile.certificates.length ? (
          profile.certificates.map((c) => (
            <Link
              key={c.code}
              className="panel certitem"
              href={`/certificate/${encodeURIComponent(c.code)}`}
            >
              <span
                className={`chip ${c.kind === "topic" ? "" : "hl"}`}
                style={{ alignSelf: "flex-start" }}
              >
                {certLabels[c.kind]}
              </span>
              <b>{c.title}</b>
              <span>
                {nice(c.issued_at.slice(0, 10))} · Code {c.code}
              </span>
            </Link>
          ))
        ) : (
          <div className="panel empty" style={{ gridColumn: "1/-1" }}>
            No certificates yet. Pass a quiz and solve 3 of its 4 coding challenges to earn your first one.
          </div>
        )}
      </div>

      {/* Name on certificates */}
      <h2 className="ph">Your name on certificates</h2>
      <div className="namebox">
        <input
          id="pname"
          maxLength={60}
          placeholder="Your full name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn pri" id="psave" type="button" onClick={handleSaveName}>
          Save name
        </button>
        {msg && (
          <span id="pmsg" className="sub" style={{ margin: 0 }}>
            {msg}
          </span>
        )}
      </div>

      {/* Checklist Table */}
      <details className="glance">
        <summary>
          <span>Every topic at a glance</span>
          <small>
            {S.topicsCertified} / {S.topicsTotal} certified · tap to open
          </small>
        </summary>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="cl-scroll">
            <table className="checklist">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Read</th>
                  <th>Practice</th>
                  <th>Quiz</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let curLevel = 0;
                  const rows: React.ReactNode[] = [];
                  profile.topics.forEach((t) => {
                    if (t.level !== curLevel) {
                      curLevel = t.level;
                      const lvlId = curLevel;
                      const lvlObj = profile.levels.find((x) => x.id === lvlId);
                      const isShut = Boolean(collapsedLevels[lvlId]);
                      rows.push(
                        <tr
                          key={`lvl-${lvlId}`}
                          className={`lvl ${isShut ? "shut" : ""}`}
                          data-l={lvlId}
                          tabIndex={0}
                          onClick={() => setCollapsedLevels((prev) => ({ ...prev, [lvlId]: !prev[lvlId] }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCollapsedLevels((prev) => ({ ...prev, [lvlId]: !prev[lvlId] }));
                            }
                          }}
                        >
                          <td colSpan={7}>
                            <span className="car">{isShut ? "▸" : "▾"}</span> {lvlId}. {lvlObj?.title || ""}
                          </td>
                        </tr>
                      );
                    }
                    const isHidden = Boolean(collapsedLevels[t.level]);
                    const statusText = t.certified ? (
                      <span className="ok">✓ Certified</span>
                    ) : t.read || t.tasksDone || t.quizBest != null || t.codeSolved ? (
                      "In progress"
                    ) : (
                      <span className="pend">Not started</span>
                    );

                    rows.push(
                      <tr key={t.id} data-l={t.level} hidden={isHidden}>
                        <td>
                          <Link href={`/topic/${t.slug}`}>{t.title}</Link>
                        </td>
                        <td>{t.read ? <span className="ok">✓</span> : <span className="pend">–</span>}</td>
                        <td>
                          {t.tasksDone}/{t.tasksTotal}
                        </td>
                        <td>
                          {t.quizBest == null ? (
                            <span className="pend">–</span>
                          ) : (
                            <>
                              {t.quizBest}/5
                              {t.quizPassed && <span className="ok"> ✓</span>}
                            </>
                          )}
                        </td>
                        <td>
                          {t.codeSolved}/{t.codeRequired}
                        </td>
                        <td>{statusText}</td>
                        <td>{fmtMin(t.estMinutes)}</td>
                      </tr>
                    );
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </main>
  );
}
