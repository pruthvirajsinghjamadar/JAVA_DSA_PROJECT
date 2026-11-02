"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPage() {
  const [key, setKey] = useState("demo");
  const [unlocked, setUnlocked] = useState(false);
  const [span, setSpan] = useState<7 | 30 | 90>(30);
  const [usage, setUsage] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [ghUrl, setGhUrl] = useState("");
  const [ghMsg, setGhMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUnlock = async () => {
    try {
      const res = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      }).then((r) => r.json());

      if (res.ok) {
        setUnlocked(true);
        loadDashboardData(span);
      } else {
        setErrorMsg("Incorrect admin key.");
      }
    } catch {
      setErrorMsg("Error unlocking admin.");
    }
  };

  const loadDashboardData = async (days: number) => {
    try {
      const [uRes, sRes, gRes] = await Promise.all([
        fetch(`/api/admin/usage?days=${days}`).then((r) => r.json()),
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch("/api/admin/github").then((r) => r.json()),
      ]);
      setUsage(uRes);
      setStats(sRes);
      setGhUrl(gRes.url || "");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveGithub = async () => {
    try {
      const res = await fetch("/api/admin/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ghUrl.trim() }),
      });
      if (res.ok) {
        setGhMsg("Saved ✔");
      } else {
        setGhMsg("Error: the link must start with http:// or https://");
      }
      setTimeout(() => setGhMsg(""), 2500);
    } catch {
      setGhMsg("Error saving.");
    }
  };

  // Compute SVG chart data
  const renderChart = () => {
    if (!usage?.daily) return null;
    const days = span;
    const by = new Map(usage.daily.map((r: any) => [r.day, r]));
    const nw = new Map((usage.joined || []).map((r: any) => [r.day, r.n]));
    const pts: any[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const r: any = by.get(d);
      pts.push({ d, n: r ? r.people : 0, j: nw.get(d) || 0, r });
    }

    const mxv = Math.max(1, ...pts.map((p) => p.n));
    const top = Math.max(4, Math.ceil(mxv / 4) * 4);
    const tot = pts.reduce((a, p) => a + p.n, 0);
    const act = pts.filter((p) => p.n > 0).length;
    const peak = pts.reduce((a, p) => (p.n > a.n ? p : a), pts[0] || { n: 0, d: "" });

    const csumText = `Average ${(tot / days).toFixed(1)} people per day · peak ${peak.n}${
      peak.n ? ` on ${peak.d}` : ""
    } · ${act} of ${days} days had visitors`;

    const W = 900,
      H = 260,
      L = 34,
      R = 8,
      T = 14,
      B = 30,
      cw = (W - L - R) / days,
      ph = H - T - B,
      y = (v: number) => T + ph - (v / top) * ph;

    const step = days <= 7 ? 1 : days <= 30 ? 5 : 15;
    const bw = Math.max(2, cw * 0.7);

    const polyPoints = pts.map((p, i) => `${L + i * cw + cw / 2},${y(Math.min(p.j, top))}`).join(" ");

    return (
      <>
        <div id="csum" className="sub" style={{ margin: "0 0 10px" }}>
          {csumText}
        </div>
        <div style={{ overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="img" aria-label="Daily active people">
            {[0, 1, 2, 3, 4].map((k) => {
              const v = (top / 4) * k;
              return (
                <React.Fragment key={k}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="gl" />
                  <text x={L - 6} y={y(v) + 4} textAnchor="end" className="ax">
                    {v}
                  </text>
                </React.Fragment>
              );
            })}
            {pts.map((p, i) => {
              const x = L + i * cw + (cw - bw) / 2;
              const hh = (p.n / top) * ph;
              const titleText = `${p.d}: ${p.n} active, ${p.j} new${
                p.r ? ` · ${p.r.lessons} lessons, ${p.r.quizzes} quizzes, ${p.r.runs} runs` : ""
              }`;
              return (
                <g key={p.d}>
                  <title>{titleText}</title>
                  <rect x={x} y={y(p.n)} width={bw} height={Math.max(hh, p.n ? 1 : 0)} className="bar" />
                  {days <= 30 && p.n > 0 && (
                    <text x={x + bw / 2} y={y(p.n) - 3} textAnchor="middle" className="ax">
                      {p.n}
                    </text>
                  )}
                  {(days - 1 - i) % step === 0 && (
                    <text x={L + i * cw + cw / 2} y={H - 10} textAnchor="middle" className="ax">
                      {p.d.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
            {pts.some((p) => p.j) && <polyline className="nl" fill="none" points={polyPoints} />}
          </svg>
        </div>
      </>
    );
  };

  return (
    <>
      <div
        style={{
          background: "#ffe01a",
          color: "#111",
          textAlign: "center",
          fontWeight: 700,
          padding: 6,
          fontSize: 13,
        }}
      >
        Demo data only. On your real site this shows your real learners.
      </div>

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 60, minHeight: "80vh" }}>
        <div className="crumbs">
          <Link href="/">Home</Link> / Admin
        </div>
        <h1 style={{ maxWidth: "none", fontSize: 40, marginTop: 10 }}>Admin</h1>
        <p className="sub">
          Set your GitHub link and see how learners are doing. Lessons and quizzes live in the database (see README).
        </p>

        {!unlocked ? (
          <div className="panel">
            <div className="row">
              <label htmlFor="key">Admin key</label>
              <input
                id="key"
                type="password"
                placeholder="ADMIN_KEY from the server"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
              />
              <button className="btn pri" id="load" type="button" onClick={handleUnlock}>
                Unlock
              </button>
            </div>
            {errorMsg && (
              <p className="sub" style={{ color: "#ef4444", marginTop: 8 }}>
                {errorMsg}
              </p>
            )}
            <p className="sub" style={{ marginTop: 12 }}>
              Default development key is <code>demo</code> or <code>admin123</code> (configured in <code>.env.local</code>).
            </p>
          </div>
        ) : (
          <div id="form">
            <h2 className="ph">Usage</h2>
            {usage && (
              <div className="stats">
                <div className="panel stat">
                  <div className="big">{usage.totals.learners}</div>
                  <div>Learners (all time)</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.accounts || 0}</div>
                  <div>Signed in with email</div>
                </div>
                <div className="panel stat hl">
                  <div className="big">{usage.totals.activeToday}</div>
                  <div>Active today</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.active7}</div>
                  <div>Active last 7 days</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.active30}</div>
                  <div>Active last 30 days</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.returning}</div>
                  <div>Came back on 2+ days</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.lessons}</div>
                  <div>Lessons read</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.quizzes}</div>
                  <div>Quiz attempts</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.runs}</div>
                  <div>Code runs</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.solved}</div>
                  <div>Challenges solved</div>
                </div>
                <div className="panel stat">
                  <div className="big">{usage.totals.certificates}</div>
                  <div>Certificates ({usage.totals.courseCertificates} full course)</div>
                </div>
              </div>
            )}

            {/* People using the site each day */}
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, flex: 1 }}>People using the site each day</h3>
                <span className="seg" id="range">
                  {[7, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={span === d ? "on" : ""}
                      onClick={() => {
                        setSpan(d as any);
                        loadDashboardData(d);
                      }}
                    >
                      {d} days
                    </button>
                  ))}
                </span>
              </div>

              {renderChart()}

              <div className="legend">
                <span>
                  <i className="lg a" /> People active that day
                </span>
                <span>
                  <i className="lg b" /> New learners that day
                </span>
              </div>
              <p className="sub" style={{ margin: "8px 0 0" }}>
                A person counts once per day if they read a lesson, did a task, took a quiz or ran code. Days are in
                UTC.
              </p>
            </div>

            {/* Learners Table */}
            <div className="panel" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
              <h3 style={{ margin: "16px 16px 8px" }}>Learners (most recently active first)</h3>
              <div className="cl-scroll">
                <table className="checklist">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>ID</th>
                      <th>Joined</th>
                      <th>Last active</th>
                      <th>Active days</th>
                      <th>Lessons</th>
                      <th>Quiz tries</th>
                      <th>Code runs</th>
                      <th>Solved</th>
                      <th>Topic certs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage?.people?.length ? (
                      usage.people.map((p: any) => (
                        <tr key={p.client_id}>
                          <td>{p.name || "(no name)"}</td>
                          <td>{p.email || "-"}</td>
                          <td>
                            <code>{p.client_id}</code>
                          </td>
                          <td>{(p.created_at || "").slice(0, 10)}</td>
                          <td>{p.lastActive || "-"}</td>
                          <td>{p.activeDays}</td>
                          <td>{p.lessons}</td>
                          <td>{p.quizzes}</td>
                          <td>{p.runs}</td>
                          <td>{p.solved}</td>
                          <td>
                            {p.topicsCertified}
                            {p.course ? " 🎓" : ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11}>No learners yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GitHub Link */}
            <div className="panel" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>GitHub link</h3>
              <div className="row">
                <label htmlFor="gh">GitHub notes</label>
                <input
                  id="gh"
                  placeholder="https://github.com/you/repo"
                  value={ghUrl}
                  onChange={(e) => setGhUrl(e.target.value)}
                />
              </div>
              <button
                className="btn pri"
                id="save"
                type="button"
                onClick={handleSaveGithub}
                style={{ marginTop: 8 }}
              >
                Save
              </button>{" "}
              {ghMsg && <span style={{ fontWeight: 700, marginLeft: 8 }}>{ghMsg}</span>}
            </div>

            {/* Results per Topic */}
            <div className="panel" style={{ marginTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>Results per topic</h3>
              {stats && (
                <p id="stats" className="sub">
                  Learners: {stats.learners} · Quiz attempts: {stats.attempts} · Certificates issued:{" "}
                  {stats.certificates}
                </p>
              )}
              <div className="cl-scroll">
                <table className="checklist">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Quiz attempts</th>
                      <th>Quiz passes</th>
                      <th>Coding passes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.topics?.map((t: any) => (
                      <tr key={t.title}>
                        <td>{t.title}</td>
                        <td>{t.attempts}</td>
                        <td>{t.passes}</td>
                        <td>{t.codePasses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
