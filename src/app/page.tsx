"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getClientId } from "@/lib/client-id";

interface TopicItem {
  id: number;
  level_id: number;
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  estMinutes: number;
  needs: string[];
  read: boolean;
  tasksDone: number;
  tasksTotal: number;
  passed: boolean;
  bestScore: number | null;
  codeTotal: number;
  codeRequired: number;
  codeSolved: number;
  certificate: string | null;
}

interface LevelItem {
  id: number;
  title: string;
  summary: string;
  certificate: string | null;
  topics: TopicItem[];
}

interface CourseData {
  levels: LevelItem[];
  passMark: number;
  codePassMark: number;
  courseTotal: number;
  courseCertified: number;
  courseComplete: boolean;
  courseCertificate: string | null;
}

interface CertificateItem {
  code: string;
  kind: "topic" | "level" | "course";
  title: string;
  score: number | null;
  total: number | null;
  issuedAt: string;
}

interface ResourceItem {
  tag: string;
  name: string;
  description: string;
  url: string;
}

interface DailyData {
  day: string;
  challengeId: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topicSlug: string;
  topicTitle: string;
  solved: boolean;
  streak: number;
}

const DL = { easy: "Easy", medium: "Medium", hard: "Hard" };

export default function HomePage() {
  const [course, setCourse] = useState<CourseData | null>(null);
  const [certs, setCerts] = useState<CertificateItem[]>([]);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [learnerName, setLearnerName] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [finalName, setFinalName] = useState("");
  const [finalMsg, setFinalMsg] = useState("");
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";

  const loadData = async () => {
    try {
      const [cRes, lRes, rRes, dRes] = await Promise.all([
        fetch(`/api/course?clientId=${clientId}`).then((r) => r.json()),
        fetch(`/api/learner/${clientId}`).then((r) => r.json()),
        fetch(`/api/resources`).then((r) => r.json()),
        fetch(`/api/daily?clientId=${clientId}`).then((r) => r.json()).catch(() => null),
      ]);
      setCourse(cRes);
      setCerts(lRes.certificates || []);
      setLearnerName(lRes.name || "");
      setFinalName(lRes.name || "");
      setResources(rRes || []);
      if (dRes?.daily) setDaily(dRes.daily);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  const handleSaveName = async () => {
    try {
      const r = await fetch(`/api/learner/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: learnerName }),
      }).then((res) => res.json());
      setLearnerName(r.name);
      setFinalName(r.name);
      setNameMsg("Saved ✔");
      setTimeout(() => setNameMsg(""), 2500);
    } catch {
      setNameMsg("Could not save. Try again.");
    }
  };

  const handleCreateFinalCert = async () => {
    if (!finalName.trim()) {
      setFinalMsg("Please type your name first.");
      return;
    }
    try {
      const r = await fetch(`/api/course/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name: finalName }),
      }).then((res) => res.json());

      if (r.code) {
        window.location.href = `/certificate/${encodeURIComponent(r.code)}`;
      } else {
        setFinalMsg(r.error || "Could not create certificate.");
      }
    } catch {
      setFinalMsg("Could not create the certificate. Try again.");
    }
  };

  const handlePreviewFinishAll = async () => {
    await fetch("/api/preview/finish-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    loadData();
  };

  const allTopics = course ? course.levels.flatMap((l) => l.topics) : [];
  const certifiedCount = allTopics.filter((t) => t.certificate).length;
  const nextTopic = allTopics.find((t) => !t.certificate);

  const titleOfMap = new Map(allTopics.map((t) => [t.slug, t.title]));
  const fmtMin = (m: number) =>
    m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;

  const certLabels: Record<string, string> = {
    topic: "Topic certificate",
    level: "Level certificate",
    course: "Full course certificate",
  };

  return (
    <>
      <header className="wrap hero">
        <span className="pill">Free. Self-paced. Basic to advanced.</span>
        <h1>
          Learn Java. <em>Master</em> DSA.
        </h1>
        <p className="lede">
          Start from your very first program and climb to graphs and dynamic programming. Every topic has a{" "}
          <mark>lesson to read</mark>, practice tasks, a quiz and Java coding challenges that earn you a certificate.
        </p>
        <div className="cta">
          {nextTopic ? (
            <Link
              className="btn pri"
              id="continue"
              href={`/topic/${nextTopic.slug}`}
            >
              {certifiedCount || nextTopic.read
                ? `Continue: ${nextTopic.title}`
                : `Start with ${nextTopic.title}`}
            </Link>
          ) : (
            <Link className="btn pri" id="continue" href="#certs">
              Course complete! View certificates
            </Link>
          )}
          <Link className="btn" href="#certs">
            My certificates
          </Link>
        </div>
        <ol className="steps" aria-label="How each topic works">
          <li>
            <b>1</b>Read the lesson
          </li>
          <li>
            <b>2</b>Practise
          </li>
          <li>
            <b>3</b>Pass the quiz
          </li>
          <li>
            <b>4</b>Solve code
          </li>
          <li>
            <b>5</b>Get certified
          </li>
        </ol>
      </header>

      {daily && !daily.solved && (
        <div className="wrap">
          <div className="panel dbanner">
            <div>
              <b>⚡ Question of the day</b>
              <p>
                {daily.title} · {DL[daily.difficulty]} · about 10 min
                {daily.streak ? ` · 🔥 ${daily.streak} day streak to keep` : ""}
              </p>
            </div>
            <Link
              className="btn pri"
              href={`/topic/${encodeURIComponent(daily.topicSlug)}?c=${daily.challengeId}`}
            >
              Solve it now
            </Link>
          </div>
        </div>
      )}

      <main className="wrap">
        <section id="path">
          <h2>Your learning path</h2>
          <p className="sub">
            Five levels, 24 topics, from basic to hard. Go in order. Each topic needs at least 4 out of 5 on its quiz
            and most of its coding challenges solved.
          </p>

          {course && (
            <div className="panel overall" id="overall">
              <div>
                <div className="big" id="ovnum">
                  {certifiedCount} / {allTopics.length}
                </div>
                <div className="sub" style={{ margin: 0 }}>
                  topics certified
                </div>
              </div>
              <div className="meter">
                <div
                  id="ovbar"
                  style={{
                    width: `${allTopics.length ? (certifiedCount / allTopics.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div id="levels">
            {loading ? (
              <p className="sub">Loading...</p>
            ) : (
              (() => {
                let n = 0;
                return course?.levels.map((l) => {
                  const done = l.topics.filter((t) => t.certificate).length;
                  return (
                    <div className="level" key={l.id} data-l={l.id}>
                      <div className="lhead">
                        <span className="lnum">{l.id}</span>
                        <h3>{l.title}</h3>
                        <span className={`chip ${l.certificate ? "done" : ""}`}>
                          {l.certificate ? "Level certified" : `${done} / ${l.topics.length} done`}
                        </span>
                        <p>{l.summary}</p>
                      </div>

                    <div className="road">
                      <div className="track">
                        {l.topics.map((t, i) => {
                          n++;
                          const X = [0, 0.35, 0.7, 1, 0.7, 0.35];
                          const x = X[i % 6];
                          const nx = X[(i + 1) % 6];
                          const last = i === l.topics.length - 1;
                          const isNext = nextTopic && nextTopic.id === t.id;
                          const started = t.read || t.tasksDone || t.bestScore != null || t.codeSolved;
                          const st = t.certificate ? "done" : isNext ? "cur" : started ? "prog" : "todo";

                          const bits = t.certificate
                            ? "🎓 Certified"
                            : started
                            ? [
                                t.read ? "Read ✓" : "Read",
                                `Practice ${t.tasksDone}/${t.tasksTotal}`,
                                `Quiz${t.bestScore != null ? ` ${t.bestScore}/5` : ""}`,
                                t.codeTotal ? `Code ${t.codeSolved}/${t.codeTotal}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : "";

                          return (
                            <Link
                              key={t.id}
                              className={`stop ${st}`}
                              style={{ ["--x" as any]: x }}
                              href={`/topic/${t.slug}`}
                            >
                              {!last && (
                                <svg
                                  className="link"
                                  viewBox="0 0 1 1"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d={`M${x} 0 C ${x} 0.5, ${nx} 0.5, ${nx} 1`}
                                    fill="none"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                </svg>
                              )}
                              <span className="ball">{t.certificate ? "✓" : n}</span>
                              <span className="lab">
                                <b>{t.title}</b>
                                <small>
                                  {isNext ? "Up next · " : ""}⏱ {fmtMin(t.estMinutes)}
                                </small>
                                {t.needs.length && !t.certificate ? (
                                  <small className="needs">
                                    Needs: {t.needs.map((s) => titleOfMap.get(s) || s).join(", ")}
                                  </small>
                                ) : null}
                                {bits ? <small className="pr">{bits}</small> : null}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className={`panel levelcert ${l.certificate ? "got" : ""}`}>
                      <span className="lc-icon">{l.certificate ? "🎓" : "🔒"}</span>
                      <div>
                        <h4>{l.title} certificate</h4>
                        <p>
                          {l.certificate
                            ? "You finished every topic in this level. Your certificate is ready."
                            : `Certify all ${l.topics.length} topics (quiz + coding) to unlock it. You have ${done} of ${l.topics.length}.`}
                        </p>
                      </div>
                      {l.certificate ? (
                        <Link className="btn pri" href={`/certificate/${encodeURIComponent(l.certificate)}`}>
                          View certificate
                        </Link>
                      ) : (
                        <span className="chip">
                          {done} / {l.topics.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              });
            })()
          )}

            {course && (
              <div className={`panel levelcert final ${course.courseCertificate ? "got" : ""}`}>
                <span className="lc-icon">{course.courseCertificate ? "🏆" : "🔒"}</span>
                <div>
                  <h4>Full course certificate: Java + DSA</h4>
                  <p>
                    {course.courseCertificate
                      ? `You completed all ${allTopics.length} topics. Congratulations!`
                      : `Finish every topic in all 5 levels to unlock it. You have ${certifiedCount} of ${allTopics.length}.`}
                  </p>
                </div>
                {course.courseCertificate ? (
                  <Link
                    className="btn pri"
                    href={`/certificate/${encodeURIComponent(course.courseCertificate)}`}
                  >
                    View certificate
                  </Link>
                ) : (
                  <span className="chip">
                    {certifiedCount} / {allTopics.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <section id="final">
          <h2>Your final certificate</h2>
          <p className="sub">
            Finish every topic (quiz passed and coding solved) and you can create the full course certificate.
          </p>
          <div className="panel final" id="finalbox">
            {course?.courseCertificate ? (
              <>
                <div className="score">🏆</div>
                <h3>You finished the whole course!</h3>
                <p>Your full course certificate is ready.</p>
                <div className="cta">
                  <Link
                    className="btn pri"
                    href={`/certificate/${encodeURIComponent(course.courseCertificate)}`}
                  >
                    View and download certificate
                  </Link>
                </div>
              </>
            ) : course?.courseComplete ? (
              <>
                <div className="score">🎉</div>
                <h3>All {allTopics.length} topics done. Create your certificate</h3>
                <p>Type your name as it should appear on the certificate.</p>
                <div className="namebox">
                  <input
                    id="fname"
                    maxLength={60}
                    placeholder="Your full name"
                    aria-label="Your full name"
                    value={finalName}
                    onChange={(e) => setFinalName(e.target.value)}
                  />
                  <button className="btn pri" id="fmake" type="button" onClick={handleCreateFinalCert}>
                    Create my certificate
                  </button>
                </div>
                {finalMsg && (
                  <p className="sub" id="fmsg" style={{ margin: "8px 0 0" }}>
                    {finalMsg}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="score">🔒</div>
                <h3>Final certificate locked</h3>
                <p>
                  {certifiedCount} of {allTopics.length} topics certified. Finish the remaining{" "}
                  {allTopics.length - certifiedCount} to unlock it.
                </p>
                <div className="meter" style={{ maxWidth: 420, margin: "12px auto 0" }}>
                  <div
                    style={{
                      width: `${allTopics.length ? (certifiedCount / allTopics.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 14 }}
                  type="button"
                  onClick={handlePreviewFinishAll}
                >
                  Preview only: mark all 24 topics as done
                </button>
              </>
            )}
          </div>
        </section>

        <section id="certs">
          <h2>Your certificates</h2>
          <p className="sub">
            Pass a topic quiz and solve its coding challenges to earn a topic certificate. Finish every topic in a level
            for a level certificate, and create the full course certificate once all 24 are done.
          </p>
          <div className="panel howcert">
            <h3>How certificates work</h3>
            <ul>
              <li>
                <b>Topic certificate:</b> pass the quiz (at least 4 of 5 correct) <i>and</i> solve at least 3 of its 4
                coding challenges.
              </li>
              <li>
                <b>Level certificate:</b> earn the topic certificate in every topic of that level. It appears on its
                own.
              </li>
              <li>
                <b>Full course certificate:</b> earn all 24 topic certificates, then type your name and create it.
              </li>
            </ul>
            <p className="sub" style={{ margin: "8px 0 0" }}>
              Open your <Link href="/profile">profile</Link> to see what is done, what is pending, your quiz scores and
              your next milestone in one place.
            </p>
          </div>
          <div className="namebox">
            <input
              id="name"
              maxLength={60}
              placeholder="Your name as it should appear on certificates"
              aria-label="Your name"
              value={learnerName}
              onChange={(e) => setLearnerName(e.target.value)}
            />
            <button className="btn pri" id="savename" type="button" onClick={handleSaveName}>
              Save name
            </button>
            {nameMsg && (
              <span id="namemsg" className="sub" style={{ margin: 0 }}>
                {nameMsg}
              </span>
            )}
          </div>
          <div className="certgrid" id="certlist">
            {certs.length ? (
              certs.map((c) => (
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
                    {c.score != null ? `Score ${c.score}/${c.total} · ` : ""}Code {c.code}
                  </span>
                </Link>
              ))
            ) : (
              <div className="panel empty" style={{ gridColumn: "1/-1" }}>
                No certificates yet. Open a topic, read the lesson, pass its quiz and solve its coding challenges to earn
                your first one.
              </div>
            )}
          </div>
        </section>

        <section id="resources">
          <h2>Open source resources</h2>
          <p className="sub">
            Free, high-quality material to follow alongside the lessons. Pick one from each group and stick with it.
          </p>
          <div className="grid" id="os">
            {resources.map((o) => (
              <a
                key={o.name}
                className="panel card"
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="tag">{o.tag}</span>
                <b>{o.name}</b>
                <span>{o.description}</span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
