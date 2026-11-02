"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getClientId } from "@/lib/client-id";

interface DailyData {
  day: string;
  challengeId: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topicSlug: string;
  topicTitle: string;
  solved: boolean;
  streak: number;
  solvedBy: number;
}

export function QotDPopup() {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only show on home page if not on practice or challenge
    if (typeof window === "undefined") return;
    if (window.location.pathname.includes("practice") || window.location.pathname.includes("topic")) {
      return;
    }

    const clientId = getClientId();
    fetch(`/api/daily?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.daily || d.daily.solved) return;
        const seen = localStorage.getItem("jd-daily-seen");
        if (seen === d.daily.day) return;

        setDaily(d.daily);
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      })
      .catch(() => {});
  }, []);

  const close = () => {
    if (daily) {
      try {
        localStorage.setItem("jd-daily-seen", daily.day);
      } catch {}
    }
    setIsOpen(false);
  };

  if (!isOpen || !daily) return null;

  const diffLabels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const targetUrl = `/topic/${encodeURIComponent(daily.topicSlug)}?c=${daily.challengeId}`;

  return (
    <div className="dpop-bg" role="dialog" aria-modal="true" aria-label="Question of the day" onClick={close}>
      <div className="dpop" onClick={(e) => e.stopPropagation()}>
        <span className="chip y">⚡ Question of the day</span>
        <h3>{daily.title}</h3>
        <div className="dmeta">
          <span className={`chip d-${daily.difficulty}`}>{diffLabels[daily.difficulty]}</span>
          <span className="chip">{daily.topicTitle}</span>
          <span className="chip">⏱ about 10 min</span>
        </div>
        <p>
          {daily.solvedBy
            ? `${daily.solvedBy} ${daily.solvedBy === 1 ? "person has" : "people have"} solved it today. `
            : "Be the first to solve it today. "}
          {daily.streak ? `Your ${daily.streak} day streak is waiting.` : "Solve one a day to build a streak."}
        </p>
        <div className="dpop-act">
          <Link className="btn pri" id="dp-go" href={targetUrl} onClick={close}>
            Solve it now
          </Link>
          <button className="btn" id="dp-later" type="button" onClick={close}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
