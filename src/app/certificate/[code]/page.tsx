"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { getClientId } from "@/lib/client-id";
import { qrSvg } from "@/lib/qr";

interface CertData {
  code: string;
  kind: "topic" | "level" | "course";
  title: string;
  level: string | null;
  learner: string;
  score: number | null;
  total: number | null;
  issuedAt: string;
}

export default function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [cert, setCert] = useState<CertData | null>(null);
  const [isMine, setIsMine] = useState(false);
  const [learnerName, setLearnerName] = useState("");
  const [saveStatus, setSaveStatus] = useState("Save name");
  const [copyStatus, setCopyStatus] = useState("Copy verification link");
  const [qrMarkup, setQrMarkup] = useState("");
  const [loading, setLoading] = useState(true);

  const clientId = typeof window !== "undefined" ? getClientId() : "anon";
  const upperCode = code.toUpperCase();

  useEffect(() => {
    const loadCert = async () => {
      try {
        const [cRes, lRes] = await Promise.all([
          fetch(`/api/certificates/${encodeURIComponent(upperCode)}`).then((r) => r.json()),
          fetch(`/api/learner/${clientId}`).then((r) => r.json()).catch(() => ({})),
        ]);

        if (cRes.error) {
          setCert(null);
          return;
        }

        setCert(cRes);
        setLearnerName(cRes.learner || lRes.name || "");

        const hasMine = (lRes.certificates || []).some((c: any) => c.code === cRes.code);
        setIsMine(hasMine || !cRes.learner);

        // QR Code
        if (typeof window !== "undefined") {
          const verifyUrl = `${window.location.origin}/certificate/${encodeURIComponent(cRes.code)}`;
          setQrMarkup(qrSvg(verifyUrl));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadCert();
  }, [upperCode, clientId]);

  const handleSaveName = async () => {
    try {
      const r = await fetch(`/api/learner/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: learnerName }),
      }).then((res) => res.json());

      setLearnerName(r.name || "Your Name");
      if (cert) {
        setCert({ ...cert, learner: r.name });
      }
      setSaveStatus("Saved ✔");
      setTimeout(() => setSaveStatus("Save name"), 2000);
    } catch {
      setSaveStatus("Error");
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === "undefined" || !cert) return;
    const verifyUrl = `${window.location.origin}/certificate/${encodeURIComponent(cert.code)}`;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopyStatus("Copied ✔");
      setTimeout(() => setCopyStatus("Copy verification link"), 2500);
    } catch {
      prompt("Copy this link:", verifyUrl);
    }
  };

  if (loading) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <p className="sub">Loading certificate...</p>
      </main>
    );
  }

  if (!cert) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingTop: 50 }}>
        <div className="panel empty">
          No certificate found for the code <b>{upperCode}</b>. Check the code and try again.
          <br />
          <br />
          <Link className="btn pri" href="/">
            Back to the site
          </Link>
        </div>
      </main>
    );
  }

  const headings: Record<string, string> = {
    topic: "Certificate of Completion",
    level: "Level Certificate",
    course: "Course Certificate",
  };

  const lines: Record<string, string> = {
    topic: "has successfully passed the quiz for",
    level: "has completed every topic in",
    course: "has completed all 24 topics of",
  };

  const d = new Date(cert.issuedAt.replace(" ", "T") + "Z");
  const dateFormatted = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/certificate/${encodeURIComponent(cert.code)}`
      : "";

  const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    cert.title + " (Java + DSA)"
  )}&organizationName=${encodeURIComponent("Java + DSA")}&issueYear=${d.getFullYear()}&issueMonth=${
    d.getMonth() + 1
  }&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(cert.code)}`;

  return (
    <main className="wrap certpage" id="app">
      {isMine && (
        <div className="nameedit">
          <input
            id="nm"
            maxLength={60}
            value={learnerName}
            onChange={(e) => setLearnerName(e.target.value)}
            placeholder="Type your name for the certificate"
            aria-label="Your name"
          />
          <button className="btn sm pri" id="nmsave" type="button" onClick={handleSaveName}>
            {saveStatus}
          </button>
        </div>
      )}

      <div className="certtools">
        <button className="btn pri" id="print" type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button className="btn" id="copy" type="button" onClick={handleCopyLink}>
          {copyStatus}
        </button>
        {isMine && (
          <a className="btn" target="_blank" rel="noopener noreferrer" href={linkedinUrl}>
            Add to LinkedIn
          </a>
        )}
      </div>

      <div className="cert" id="cert">
        <div className="in">
          <div className="brand">
            <span className="logo" aria-hidden="true">
              <i>J</i>
              <i>D</i>
            </span>
            Java + DSA: Learn at Your Own Pace
          </div>

          <div>
            <h1 style={{ fontSize: "clamp(14px,2vw,20px)", letterSpacing: ".2em" }}>
              {headings[cert.kind]}
            </h1>
            <p className="small" style={{ marginTop: 8 }}>
              THIS IS TO CERTIFY THAT
            </p>
          </div>

          <p className="who" id="who">
            {cert.learner || learnerName || "Your Name"}
          </p>

          <div>
            <p className="small">{lines[cert.kind]}</p>
            <p className="what" style={{ marginTop: 8 }}>
              {cert.title}
            </p>
            {cert.level && (
              <p className="small" style={{ marginTop: 8 }}>
                {cert.level}
              </p>
            )}
          </div>

          <div className="foot">
            <div style={{ textAlign: "left" }}>
              Issued
              <br />
              <b>{dateFormatted}</b>
            </div>

            <div className="sign">
              <div className="sigimg" id="sigimg">
                <span className="sigtxt">Pruthvirajsingh</span>
              </div>
              <div className="sigline" />
              <b>Pruthvirajsingh</b>
              <br />
              Founder, Java + DSA
            </div>

            <div className="qr">
              <div
                className="qrbox"
                id="qrbox"
                dangerouslySetInnerHTML={{ __html: qrMarkup }}
              />
              Scan to verify
            </div>

            <div style={{ textAlign: "right" }}>
              Certificate ID
              <br />
              <b>{cert.code}</b>
            </div>
          </div>
        </div>
      </div>

      <p className="verify sub" style={{ textAlign: "center", marginTop: 24 }}>
        Anyone can check this certificate at <b>{verifyUrl}</b>
      </p>
    </main>
  );
}
