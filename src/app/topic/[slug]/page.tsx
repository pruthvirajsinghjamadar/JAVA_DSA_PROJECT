"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getClientId } from "@/lib/client-id";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface TopicData {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  level: { id: number; title: string };
  lesson: string;
  tasks: { id: number; task: string; done: boolean }[];
  read: boolean;
  quizTotal: number;
  coding: { total: number; required: number; solved: number } | null;
  quizPassed: boolean;
  passMark: number;
  bestScore: number | null;
  certificate: string | null;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string; summary: string } | null;
  dailyId: number | null;
  estimate: { read: number; practice: number; quiz: number; code: number; total: number };
  prereqs: { slug: string; title: string; certified: boolean }[];
}

interface QuizItem {
  id: number;
  question: string;
  options: string[];
}

interface QuizResultItem {
  id: number;
  chosen: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

interface ChallengeItem {
  id: number;
  position: number;
  difficulty: "easy" | "medium" | "hard";
  title: string;
  prompt: string;
  hint: string;
  runs: number;
  canReveal: boolean;
  starter: string;
  code: string;
  passed: boolean;
  tests: { n: number; call: string; expected: string }[];
  hiddenCount: number;
}

function showCall(src: string): string {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      cur += c;
      if (c === "\\") cur += src[++i] || "";
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    if (c === ";" && depth === 0) {
      parts.push(cur.trim() + ";");
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.join("\n");
}

export default function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const wantCh = Number(searchParams?.get("c") || "0");

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [tab, setTab] = useState<"read" | "practice" | "quiz" | "code" | "cert">("read");
  const [toastMsg, setToastMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizItem[]>([]);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [quizResults, setQuizResults] = useState<{
    score: number;
    total: number;
    passed: boolean;
    passMark: number;
    results: QuizResultItem[];
    certificate: { code: string; isNew: boolean } | null;
  } | null>(null);
  const [qAnswersFeedback, setQAnswersFeedback] = useState<
    Record<number, { correct: boolean; correctIndex: number; explanation: string }>
  >({});

  // Code state
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [curChIdx, setCurChIdx] = useState(0);
  const [editorCode, setEditorCode] = useState("");
  const [codeTestResults, setCodeTestResults] = useState<any[] | null>(null);
  const [runStatus, setRunStatus] = useState<{
    type: "good" | "bad" | "info";
    title: string;
    detail: string;
    errorPre?: string;
  } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [solutionText, setSolutionText] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3200);
  };

  const loadTopic = async () => {
    try {
      const res = await fetch(`/api/topics/${encodeURIComponent(slug)}?clientId=${clientId}`).then((r) =>
        r.json()
      );
      if (res.error) {
        setTopic(null);
        return;
      }
      setTopic(res);

      if (wantCh && res.coding && (res.read || res.dailyId === wantCh)) {
        setTab("code");
      } else if (res.certificate) {
        setTab("cert");
      } else {
        setTab("read");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopic();
  }, [slug, clientId]);

  // Load Quiz
  useEffect(() => {
    if (tab === "quiz" && topic?.read) {
      fetch(`/api/topics/${slug}/quiz?clientId=${clientId}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) {
            setQuizQuestions(d);
            setPicks({});
            setQuizResults(null);
            setQAnswersFeedback({});
          }
        })
        .catch(() => {});
    }
  }, [tab, topic?.read, slug, clientId]);

  // Load Challenges
  useEffect(() => {
    if (tab === "code") {
      fetch(`/api/topics/${slug}/code?clientId=${clientId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.challenges && d.challenges.length > 0) {
            setChallenges(d.challenges);
            const wantIndex = wantCh ? d.challenges.findIndex((c: ChallengeItem) => c.id === wantCh) : -1;
            const firstUnsolved = d.challenges.findIndex((c: ChallengeItem) => !c.passed);
            const targetIndex = wantIndex >= 0 ? wantIndex : firstUnsolved >= 0 ? firstUnsolved : 0;
            setCurChIdx(targetIndex);
            setEditorCode(d.challenges[targetIndex].code || d.challenges[targetIndex].starter);
            setCodeTestResults(null);
            setRunStatus(null);
            setShowHint(false);
            setSolutionText(null);
          }
        })
        .catch(() => {});
    }
  }, [tab, slug, clientId, wantCh]);

  // Handle Mark as Read
  const handleMarkRead = async () => {
    try {
      await fetch(`/api/topics/${slug}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      setTopic((prev) => (prev ? { ...prev, read: true } : prev));
      showToast("Lesson marked as read. The quiz and coding challenges are unlocked.");
    } catch {
      showToast("Could not save. Check your connection.");
    }
  };

  // Handle Task checkbox
  const handleToggleTask = async (taskId: number, checked: boolean) => {
    if (!topic) return;
    setTopic({
      ...topic,
      tasks: topic.tasks.map((t) => (t.id === taskId ? { ...t, done: checked } : t)),
    });
    try {
      await fetch(`/api/progress/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, done: checked }),
      });
    } catch {
      showToast("Could not save. Check your connection.");
    }
  };

  // Instant Check Quiz Question
  const handleCheckQuestion = async (qid: number, choice: number) => {
    setPicks((p) => ({ ...p, [qid]: choice }));
    try {
      const res = await fetch(`/api/questions/${qid}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, choice }),
      }).then((r) => r.json());

      setQAnswersFeedback((f) => ({
        ...f,
        [qid]: res,
      }));
    } catch {}
  };

  // Submit full quiz
  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/topics/${slug}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, answers: picks }),
      }).then((r) => r.json());

      setQuizResults(res);
      if (res.passed) {
        setTopic((t) => (t ? { ...t, quizPassed: true, bestScore: Math.max(t.bestScore || 0, res.score) } : t));
        if (res.certificate) {
          setTopic((t) => (t ? { ...t, certificate: res.certificate.code } : t));
          showToast(`🎓 Certificate earned for ${topic?.title || "this topic"}!`);
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showToast("Could not submit quiz. Try again.");
    }
  };

  // Run Java tests
  const handleRunCode = async () => {
    const cur = challenges[curChIdx];
    if (!cur || isRunning) return;
    setIsRunning(true);
    setRunStatus({
      type: "info",
      title: "Compiling and running your code...",
      detail: "This takes a couple of seconds...",
    });

    try {
      const res = await fetch(`/api/challenges/${cur.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, code: editorCode }),
      }).then((r) => r.json());

      if (res.compile && !res.compile.ok) {
        setRunStatus({
          type: "bad",
          title: "Compile error",
          detail: "",
          errorPre: res.compile.error,
        });
        setCodeTestResults(null);
      } else {
        const tests = res.tests || [];
        setCodeTestResults(tests);
        const okCount = tests.filter((t: any) => t.passed).length;

        if (res.passed) {
          const extra = res.certificate?.isNew
            ? "🎓 That was the last step: your topic certificate is ready."
            : res.coding && res.coding.solved >= res.coding.required
            ? res.quizPassed
              ? "Enough challenges solved. You can keep going for practice."
              : "Enough challenges solved. Pass the quiz to get your certificate."
            : `${res.coding ? `${res.coding.solved} of ${res.coding.required} needed for the certificate.` : ""}`;

          setRunStatus({
            type: "good",
            title: `All ${tests.length} tests passed 🎉`,
            detail: extra,
          });

          showToast("All tests passed! Great job!");
          setChallenges((prev) =>
            prev.map((c, i) => (i === curChIdx ? { ...c, passed: true, runs: c.runs + 1, code: editorCode } : c))
          );
          if (res.certificate) {
            setTopic((t) => (t ? { ...t, certificate: res.certificate.code } : t));
            if (res.certificate.isNew) {
              showToast(`🎓 Certificate earned for ${topic?.title || "this topic"}!`);
            }
          }
          if (res.milestones) {
            res.milestones.forEach((m: any) =>
              showToast(m.kind === "course" ? "🏆 You finished the whole course!" : "🎖️ Level complete: " + m.title)
            );
          }
        } else {
          setRunStatus({
            type: "bad",
            title: `${okCount} of ${tests.length} tests passed`,
            detail: "Read the failed test below, fix your code and run again.",
          });
          setChallenges((prev) =>
            prev.map((c, i) => (i === curChIdx ? { ...c, runs: c.runs + 1, code: editorCode } : c))
          );
        }
      }

      if (res.coding && topic) {
        setTopic({ ...topic, coding: res.coding });
      }
    } catch {
      setRunStatus({
        type: "bad",
        title: "Could not run your code",
        detail: "Check your connection and try again.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Skip challenge (preview mode)
  const handleSkipCode = async () => {
    const cur = challenges[curChIdx];
    if (!cur) return;
    try {
      const res = await fetch(`/api/preview/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, challengeId: cur.id }),
      }).then((r) => r.json());

      if (res.passed) {
        showToast("Challenge marked as passed!");
        setChallenges((prev) =>
          prev.map((c, i) => (i === curChIdx ? { ...c, passed: true, code: editorCode } : c))
        );
        if (res.certificate) {
          setTopic((t) => (t ? { ...t, certificate: res.certificate.code } : t));
          if (res.certificate.isNew) {
            showToast(`🎓 Certificate earned for ${topic?.title || "this topic"}!`);
          }
        }
        if (res.milestones) {
          res.milestones.forEach((m: any) =>
            showToast(m.kind === "course" ? "🏆 You finished the whole course!" : "🎖️ Level complete: " + m.title)
          );
        }
        if (res.coding && topic) {
          setTopic({ ...topic, coding: res.coding });
        }
      }
    } catch {
      showToast("Could not skip.");
    }
  };

  // Reveal solution
  const handleShowSolution = async () => {
    const cur = challenges[curChIdx];
    if (!cur) return;
    if (solutionText) {
      setSolutionText(null);
      return;
    }
    try {
      const res = await fetch(`/api/challenges/${cur.id}/solution?clientId=${clientId}`).then((r) => r.json());
      if (res.solution) {
        setSolutionText(res.solution);
      } else {
        showToast(res.error || "Run your code at least 3 times first.");
      }
    } catch {
      showToast("Could not load the solution.");
    }
  };

  // Code editor keyboard indentation support
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ed = e.currentTarget;
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const start = ed.selectionStart;
      const end = ed.selectionEnd;
      const val = ed.value;
      const updated = val.slice(0, start) + "    " + val.slice(end);
      setEditorCode(updated);
      setTimeout(() => {
        ed.selectionStart = ed.selectionEnd = start + 4;
      }, 0);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunCode();
    } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const pos = ed.selectionStart;
      const before = ed.value.slice(0, pos);
      const line = before.slice(before.lastIndexOf("\n") + 1);
      const ind = (line.match(/^\s*/) || [""])[0];
      const extraIndent = /\{\s*$/.test(line) ? "    " : "";
      const insertion = "\n" + ind + extraIndent;
      const updated = ed.value.slice(0, pos) + insertion + ed.value.slice(ed.selectionEnd);
      setEditorCode(updated);
      setTimeout(() => {
        ed.selectionStart = ed.selectionEnd = pos + insertion.length;
      }, 0);
    }
  };

  if (loading) {
    <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
      <p className="sub">Loading topic...</p>
    </main>;
  }

  if (!topic) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <div className="panel empty">
          This topic does not exist.
          <br />
          <br />
          <Link className="btn pri" href="/#path">
            Back to the learning path
          </Link>
        </div>
      </main>
    );
  }

  const tasksDone = topic.tasks.filter((t) => t.done).length;
  const C = topic.coding;
  const codeDone = !C || C.solved >= C.required;
  const needQuiz = Math.round(topic.passMark * topic.quizTotal);

  const tabs = [
    { id: "read", label: "Read", ok: topic.read },
    { id: "practice", label: "Practice", ok: tasksDone === topic.tasks.length },
    { id: "quiz", label: "Quiz", ok: topic.quizPassed, lock: !topic.read },
    ...(C
      ? [
          {
            id: "code",
            label: "Code",
            ok: codeDone,
            lock: !topic.read && !(topic.dailyId && topic.dailyId === wantCh),
          },
        ]
      : []),
    { id: "cert", label: "Certificate", ok: Boolean(topic.certificate) },
  ];

  const fmtMin = (m: number) =>
    m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;

  const curCh = challenges[curChIdx];
  const diffLabels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const lastCh = curChIdx === challenges.length - 1;

  return (
    <main className="wrap" id="app">
      <div className={`toast ${toastMsg ? "show" : ""}`} id="toast">
        {toastMsg}
      </div>

      <div className="crumbs">
        <Link href="/#path">Learning path</Link> / Level {topic.level.id}: {topic.level.title}
      </div>

      <div className="thead">
        <h1>{topic.title}</h1>
        <div className="meta">
          <span
            className="chip hl"
            title={`Reading ${topic.estimate.read} min · practice ${topic.estimate.practice} min · quiz ${
              topic.estimate.quiz
            } min${C ? ` · coding ${topic.estimate.code} min` : ""}`}
          >
            ⏱ About {fmtMin(topic.estimate.total)} in total
          </span>
          <span className="chip">{topic.minutes} min read</span>
          <span className="chip">{topic.tasks.length} practice tasks</span>
          <span className={`chip ${topic.quizPassed ? "done" : ""}`}>
            {topic.quizPassed ? "✓ " : ""}
            {topic.quizTotal} question quiz
          </span>
          {C && (
            <span className={`chip ${codeDone ? "done" : ""}`}>
              {codeDone ? "✓ " : ""}
              {C.total} coding challenges
            </span>
          )}
          {topic.certificate && <span className="chip done">✓ Certified</span>}
        </div>
        <p className="sub" style={{ marginBottom: 0 }}>
          {topic.summary}
        </p>
        {topic.prereqs.length ? (
          <p className="prereq">
            <b>Before this topic:</b>{" "}
            {topic.prereqs.map((p) => (
              <Link
                key={p.slug}
                className={`chip ${p.certified ? "done" : ""}`}
                href={`/topic/${p.slug}`}
              >
                {p.certified ? "✓ " : ""}
                {p.title}
              </Link>
            ))}{" "}
            {!topic.prereqs.every((p) => p.certified) && (
              <span className="sub" style={{ margin: 0 }}>
                Finish these first if anything feels new.
              </span>
            )}
          </p>
        ) : (
          <p className="prereq">
            <b>Before this topic:</b> nothing. You can start here.
          </p>
        )}
      </div>

      <ul className="tabs" role="tablist">
        {tabs.map((x, i) => (
          <li key={x.id}>
            <button
              className={`${tab === x.id ? "on" : ""} ${x.ok ? "ok" : ""}`}
              disabled={Boolean(x.lock)}
              title={x.lock ? "Read the lesson first" : ""}
              onClick={() => {
                setTab(x.id as any);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <b>{x.ok ? "✓" : i + 1}</b>
              {x.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Pane: READ */}
      <div className={`pane ${tab === "read" ? "on" : ""}`}>
        <article className="panel lesson">
          <MarkdownRenderer content={topic.lesson} />
          <div className="readbar">
            {topic.read ? (
              <>
                <span className="chip done">✓ Lesson read</span>
                <button
                  className="btn pri"
                  type="button"
                  onClick={() => {
                    setTab("practice");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Next: practice tasks
                </button>
              </>
            ) : (
              <>
                <button className="btn pri" id="markread" type="button" onClick={handleMarkRead}>
                  I have read this lesson
                </button>
                <span className="sub" style={{ margin: 0 }}>
                  This unlocks the quiz{C ? " and the coding challenges" : ""}.
                </span>
              </>
            )}
          </div>
        </article>
      </div>

      {/* Pane: PRACTICE */}
      <div className={`pane ${tab === "practice" ? "on" : ""}`}>
        <div className="panel tasklist">
          <h3 style={{ margin: "0 0 4px" }}>Practice tasks</h3>
          <p className="sub" style={{ marginBottom: 10 }}>
            Write each one in Java yourself, run it, then tick it. Typing the code is how it sticks.{" "}
            <span style={{ fontWeight: 700 }}>
              {tasksDone} of {topic.tasks.length} done
            </span>
          </p>
          {topic.tasks.map((x) => (
            <label className="ck" key={x.id}>
              <input
                type="checkbox"
                checked={x.done}
                onChange={(e) => handleToggleTask(x.id, e.target.checked)}
              />
              <span>{x.task}</span>
            </label>
          ))}
          <div className="tip">
            <b>Stuck?</b> Go back to the lesson and re-read the example. Then try again before looking anything up.
          </div>
          <div className="readbar" style={{ marginTop: 18 }}>
            <button
              className="btn pri"
              type="button"
              onClick={() => {
                setTab(topic.read ? "quiz" : "read");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {topic.read ? "Next: take the quiz" : "Read the lesson first"}
            </button>
          </div>
        </div>
      </div>

      {/* Pane: QUIZ */}
      <div className={`pane ${tab === "quiz" ? "on" : ""}`}>
        {quizResults ? (
          <div>
            <div className={`panel result ${quizResults.passed ? "pass" : "fail"}`} style={{ marginBottom: 20 }}>
              <div className="score">
                {quizResults.score} / {quizResults.total}
              </div>
              <h3>
                {!quizResults.passed
                  ? "Not quite yet"
                  : C && !topic.certificate
                  ? "Quiz passed ✓ One step left"
                  : "Passed! Certificate earned 🎓"}
              </h3>
              <p>
                {!quizResults.passed
                  ? `You need ${Math.round(quizResults.passMark * quizResults.total)} correct. Read the explanations below, re-read the lesson, and try again.`
                  : C && !topic.certificate
                  ? `Now solve at least ${C.required} of ${C.total} coding challenges in the Code section (you have solved ${C.solved}). Your certificate arrives as soon as you do.`
                  : "Great work. Your certificate is ready to view, print or add to LinkedIn."}
              </p>
              <div className="cta">
                {C && !topic.certificate && quizResults.passed ? (
                  <button className="btn pri" type="button" onClick={() => setTab("code")}>
                    Go to the coding challenges
                  </button>
                ) : quizResults.passed && quizResults.certificate ? (
                  <Link
                    className="btn pri"
                    href={`/certificate/${encodeURIComponent(quizResults.certificate.code)}`}
                  >
                    View certificate
                  </Link>
                ) : (
                  <button
                    className="btn pri"
                    type="button"
                    onClick={() => {
                      setQuizResults(null);
                      setPicks({});
                    }}
                  >
                    Try again
                  </button>
                )}
                {quizResults.passed ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setQuizResults(null);
                      setPicks({});
                    }}
                  >
                    Retake quiz
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => setTab("read")}>
                    Re-read lesson
                  </button>
                )}
              </div>
            </div>

            {quizQuestions.map((q, i) => {
              const x = quizResults.results[i];
              return (
                <div key={q.id} className="panel qcard review">
                  <h4>
                    Question {i + 1} · {x.correct ? "Correct" : "Incorrect"}
                  </h4>
                  <h3>{q.question}</h3>
                  <div className="opts">
                    {q.options.map((o, j) => (
                      <div
                        key={j}
                        className={`opt ${j === x.correctIndex ? "right" : j === x.chosen ? "wrong" : ""}`}
                      >
                        <span>
                          {j === x.correctIndex ? "✓ " : j === x.chosen ? "✗ " : ""}
                          {o}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="why">
                    <b>Why:</b> {x.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <b>{quizQuestions.length} questions.</b> You need {needQuiz} correct. After each answer you see right
              away whether it was correct and why. You can retry the whole quiz as many times as you like.
              {C && (
                <span>
                  {" "}
                  After the quiz, the <b>Code</b> section has {C.total} coding challenges. The certificate needs both.
                </span>
              )}
            </div>
            <form onSubmit={handleSubmitQuiz}>
              {quizQuestions.map((q, i) => {
                const fb = qAnswersFeedback[q.id];
                return (
                  <div className="panel qcard" key={q.id}>
                    <h4>
                      Question {i + 1} of {quizQuestions.length}
                    </h4>
                    <h3>{q.question}</h3>
                    <div className="opts">
                      {q.options.map((o, j) => {
                        const isChosen = picks[q.id] === j;
                        let optClass = "opt";
                        if (fb) {
                          if (j === fb.correctIndex) optClass += " right";
                          else if (isChosen) optClass += " wrong";
                        } else if (isChosen) {
                          optClass += " sel";
                        }
                        return (
                          <label className={optClass} key={j}>
                            <input
                              type="radio"
                              name={`q${q.id}`}
                              value={j}
                              disabled={Boolean(fb)}
                              checked={isChosen}
                              onChange={() => handleCheckQuestion(q.id, j)}
                            />
                            <span>{o}</span>
                          </label>
                        );
                      })}
                    </div>
                    {fb && (
                      <p className={`why ${fb.correct ? "ok" : "no"}`}>
                        <b>{fb.correct ? "✓ Correct." : "✗ Not quite."}</b>{" "}
                        {!fb.correct && "The right answer is highlighted in green. "}
                        {fb.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="qbar">
                <button
                  className="btn pri"
                  id="submitq"
                  type="submit"
                  disabled={Object.keys(picks).length < quizQuestions.length}
                >
                  Submit answers
                </button>
                <span className="count">
                  {Object.keys(picks).length} of {quizQuestions.length} answered
                </span>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Pane: CODE */}
      {C && (
        <div className={`pane ${tab === "code" ? "on" : ""}`}>
          <div className="panel codehead">
            <div className="meterline">
              <b>
                {codeDone ? "✓ " : ""}Solved {C.solved} of {C.total}
              </b>
              <span>
                Solve at least <b>{C.required}</b> to earn the certificate
                {topic.quizPassed ? "" : ", and pass the quiz too"}.
              </span>
            </div>
            <div className="meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (C.solved / C.total) * 100)}%` }} />
              <s style={{ left: `${(C.required / C.total) * 100}%` }} />
            </div>
            {codeDone && !topic.quizPassed && (
              <p className="sub" style={{ margin: "10px 0 0" }}>
                Coding done ✓ Now{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setTab("quiz");
                  }}
                >
                  pass the quiz
                </a>{" "}
                to get your certificate.
              </p>
            )}
            <div className="pills" role="tablist">
              {challenges.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pill ${i === curChIdx ? "on" : ""} ${c.passed ? "done" : ""} d-${c.difficulty}`}
                  onClick={() => {
                    setCurChIdx(i);
                    setEditorCode(c.code || c.starter);
                    setCodeTestResults(null);
                    setRunStatus(null);
                    setShowHint(false);
                    setSolutionText(null);
                  }}
                >
                  <b>{c.passed ? "✓" : c.position}</b>
                  <span>{c.title}</span>
                  <em>{diffLabels[c.difficulty]}</em>
                </button>
              ))}
            </div>
          </div>

          {curCh && (
            <div className="panel code-card">
              <h4>
                Challenge {curCh.position} of {C.total} ·{" "}
                <span className={`dchip d-${curCh.difficulty}`}>{diffLabels[curCh.difficulty]}</span> · Java
              </h4>
              <h3>
                {curCh.title}{" "}
                <span className={`chip ${curCh.passed ? "done" : ""}`}>
                  {curCh.passed ? "✓ Passed" : "Not passed yet"}
                </span>
              </h3>
              <div className="lesson code-prompt">
                <MarkdownRenderer content={curCh.prompt} />
              </div>
              <label className="editor-label" htmlFor="editor">
                Your code <span>(file: Solution.java)</span>
              </label>
              <textarea
                id="editor"
                className="editor"
                rows={Math.min(28, Math.max(12, editorCode.split("\n").length + 2))}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                wrap="off"
                aria-label="Java code editor"
                value={editorCode}
                onChange={(e) => setEditorCode(e.target.value)}
                onKeyDown={handleEditorKeyDown}
              />
              <div className="codebar">
                <button
                  type="button"
                  className="btn pri"
                  id="runcode"
                  disabled={isRunning}
                  onClick={handleRunCode}
                >
                  {isRunning ? "Running..." : "▶ Run tests"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditorCode(curCh.starter);
                    setCodeTestResults(null);
                    setRunStatus(null);
                  }}
                >
                  Reset code
                </button>
                {curCh.hint && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowHint(!showHint)}
                  >
                    💡 {showHint ? "Hide hint" : "Show hint"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={curCh.runs < 3}
                  title={curCh.runs < 3 ? "Run your code at least 3 times first" : ""}
                  onClick={handleShowSolution}
                >
                  {curCh.runs >= 3 ? (solutionText ? "Hide solution" : "Show solution") : "Solution (opens after 3 runs)"}
                </button>
                <button type="button" className="btn" onClick={handleSkipCode}>
                  Skip (preview only)
                </button>
                <span className="count">Ctrl + Enter to run</span>
              </div>

              {showHint && curCh.hint && (
                <div className="hintbox">
                  <b>Hint</b>
                  <MarkdownRenderer content={curCh.hint} />
                </div>
              )}

              {solutionText && (
                <div className="solbox">
                  <b>Reference solution</b>
                  <p className="sub" style={{ margin: "4px 0 8px" }}>
                    Reading it does not count as solving the challenge. Close it, type your own version and run the
                    tests.
                  </p>
                  <pre>
                    <code>{solutionText}</code>
                  </pre>
                </div>
              )}

              <div className="codeout" aria-live="polite" style={{ marginTop: 14 }}>
                {runStatus && (
                  <div
                    className={`runmsg ${
                      runStatus.type === "good" ? "good" : runStatus.type === "bad" ? "bad" : ""
                    }`}
                  >
                    <b>{runStatus.title}</b>
                    {runStatus.detail && <span> {runStatus.detail}</span>}
                    {runStatus.errorPre && <pre>{runStatus.errorPre}</pre>}
                  </div>
                )}
                {!codeTestResults ? (
                  <>
                    {curCh.tests.map((t) => (
                      <div key={t.n} className="trowt wait">
                        <span className="tb">○</span>
                        <div>
                          <b>Test {t.n}</b>
                          <code>{showCall(t.call)}</code>
                          <span>
                            Expected: <code>{t.expected}</code>
                          </span>
                        </div>
                      </div>
                    ))}
                    {curCh.hiddenCount > 0 && (
                      <div className="trowt wait">
                        <span className="tb">○</span>
                        <div>
                          <b>{curCh.hiddenCount} hidden tests</b>
                          <span>Edge cases and bigger inputs. You will see only pass or fail.</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  codeTestResults
                    .slice()
                    .sort((x, y) => (x.passed ? 1 : 0) - (y.passed ? 1 : 0))
                    .map((t, idx) => (
                      <div key={idx} className={`trowt ${t.passed ? "pass" : "fail"}`}>
                        <span className="tb">{t.passed ? "✓" : "✗"}</span>
                        <div>
                          {t.hidden ? (
                            <>
                              <b>Hidden test {t.n}</b>
                              <span>
                                {t.passed
                                  ? "Passed"
                                  : t.status === "timeout"
                                  ? "Too slow: it did not finish in 1.5 seconds. Try a faster approach."
                                  : t.status === "error"
                                  ? "Your code threw an error on this input."
                                  : "Wrong answer. Think about edge cases and larger inputs."}
                              </span>
                            </>
                          ) : (
                            <>
                              <b>Test {t.n}</b>
                              <code>{showCall(t.call)}</code>
                              <span>
                                Expected: <code>{t.expected}</code>
                              </span>
                              {!t.passed && (
                                <span className="got">
                                  {t.status === "error"
                                    ? "Error"
                                    : t.status === "timeout" || t.status === "crash"
                                    ? "Problem"
                                    : "Got"}
                                  : <code>{t.actual === "" ? "(empty)" : t.actual || t.got}</code>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="readbar" id="nextbar" style={{ marginTop: 18 }}>
                {!curCh.passed ? (
                  <span className="sub" style={{ margin: 0 }}>
                    {lastCh ? "" : "Stuck? You can open another challenge and come back."}
                  </span>
                ) : lastCh ? (
                  topic.certificate ? (
                    <Link
                      className="btn pri"
                      href={`/certificate/${encodeURIComponent(topic.certificate)}`}
                    >
                      View certificate
                    </Link>
                  ) : (
                    <span className="chip done">✓ Last challenge passed</span>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn pri"
                    id="nextch"
                    onClick={() => {
                      const nextIdx = curChIdx + 1;
                      setCurChIdx(nextIdx);
                      setEditorCode(challenges[nextIdx].code || challenges[nextIdx].starter);
                      setCodeTestResults(null);
                      setRunStatus(null);
                      setShowHint(false);
                      setSolutionText(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Next challenge →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pane: CERTIFICATE */}
      <div className={`pane ${tab === "cert" ? "on" : ""}`}>
        <div className={`panel result ${topic.certificate ? "pass" : ""}`}>
          {topic.certificate ? (
            <>
              <div className="score">🎓</div>
              <h3>You are certified in {topic.title}</h3>
              <p>
                Best quiz score: {topic.bestScore} / {topic.quizTotal}
                {C ? ` · Coding: ${C.solved} of ${C.total} solved` : ""}. Certificate code{" "}
                <b>{topic.certificate}</b>.
              </p>
              <div className="cta">
                <Link
                  className="btn pri"
                  href={`/certificate/${encodeURIComponent(topic.certificate)}`}
                >
                  View and download certificate
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="score">🔒</div>
              <h3>Certificate locked</h3>
              <p>To earn it you need both:</p>
              <ul className="reqs">
                <li className={topic.quizPassed ? "ok" : ""}>
                  {topic.quizPassed ? "✓" : "○"} Quiz: at least {needQuiz} of {topic.quizTotal} correct
                  {topic.bestScore != null ? ` (your best: ${topic.bestScore})` : ""}
                </li>
                {C && (
                  <li className={codeDone ? "ok" : ""}>
                    {codeDone ? "✓" : "○"} Code: solve at least {C.required} of {C.total} coding challenges (solved:{" "}
                    {C.solved})
                  </li>
                )}
              </ul>
              <div className="cta">
                <button
                  className="btn pri"
                  type="button"
                  onClick={() => {
                    setTab(!topic.read ? "read" : !topic.quizPassed ? "quiz" : "code");
                  }}
                >
                  {!topic.read
                    ? "Start with the lesson"
                    : !topic.quizPassed
                    ? "Take the quiz"
                    : "Go to the coding challenges"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Up next box */}
      {tab === "cert" && topic.next && (
        <div className="panel nextbox">
          <span className="chip next-tag">Up next</span>
          <div>
            <h4>{topic.next.title}</h4>
            <p>{topic.next.summary}</p>
          </div>
          <Link className="btn pri" href={`/topic/${topic.next.slug}`}>
            Open topic →
          </Link>
        </div>
      )}

      {/* Pager */}
      <div className="pager">
        {topic.prev ? (
          <Link className="btn" href={`/topic/${topic.prev.slug}`}>
            ← {topic.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {topic.next ? (
          <Link className="btn" href={`/topic/${topic.next.slug}`}>
            {topic.next.title} →
          </Link>
        ) : (
          <Link className="btn" href="/#certs">
            All certificates →
          </Link>
        )}
      </div>

      {/* Toast Notification */}
      <div className={`toast ${toastMsg ? "show" : ""}`} id="toast" role="status">
        {toastMsg}
      </div>
    </main>
  );
}
