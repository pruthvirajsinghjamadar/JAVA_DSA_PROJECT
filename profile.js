// Profile page: yearly activity heat map, streaks, totals, level progress
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const utc = d => Date.parse(d + "T00:00:00Z");
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const nice = d => { const x = new Date(utc(d)); return MONTHS[x.getUTCMonth()] + " " + x.getUTCDate() + ", " + x.getUTCFullYear(); };
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const level = n => n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;

function what(r) {
  const p = [];
  if (r.lessons) p.push(plural(r.lessons, "lesson") + " read");
  if (r.tasks) p.push(plural(r.tasks, "practice task") + " done");
  if (r.quizzes) p.push(plural(r.quizzes, "quiz attempt"));
  if (r.runs) p.push(plural(r.runs, "code run"));
  if (r.solved) p.push(plural(r.solved, "challenge") + " solved");
  return p.join(", ");
}

function heatmap(P) {
  const byDay = new Map(P.days.map(r => [r.day, r]));
  const dow = new Date(utc(P.today)).getUTCDay();                 // 0 = Sunday
  const start = utc(P.today) - (dow + 52 * 7) * 86400000;          // a Sunday, 53 weeks back
  const cells = [], labels = [];
  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const first = new Date(start + w * 7 * 86400000);
    const m = first.getUTCMonth();
    labels.push(m !== lastMonth && first.getUTCDate() <= 7 ? MONTHS[m] : "");
    if (m !== lastMonth && first.getUTCDate() <= 7) lastMonth = m;
    for (let d = 0; d < 7; d++) {
      const day = iso(start + (w * 7 + d) * 86400000);
      if (day > P.today) { cells.push('<i class="hm-cell empty"></i>'); continue; }
      const r = byDay.get(day), n = r ? r.n : 0;
      const tip = n ? nice(day) + ": " + what(r) : nice(day) + ": no activity";
      cells.push(`<i class="hm-cell l${level(n)}" tabindex="0" data-day="${day}" data-tip="${esc(tip)}" aria-label="${esc(tip)}"></i>`);
    }
  }
  return `<div class="hm-scroll"><div class="hm">
      <div class="hm-months">${labels.map(l => `<span>${l}</span>`).join("")}</div>
      <div class="hm-body"><div class="hm-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
      <div class="hm-grid">${cells.join("")}</div></div></div></div>
    <div class="hm-foot"><span id="hm-tip" class="hm-tip">Hover or tap a square to see that day.</span>
      <span class="hm-legend">Less <i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i> More</span></div>`;
}


function nextCard(P) {
  const n = P.next;
  if (!n) return `<div class="panel nextstep"><div><h3>🎉 Every topic is certified</h3><p>Create your full course certificate from the learning path.</p></div><a class="btn pri" href="index.html#path">Open learning path</a></div>`;
  return `<div class="panel nextstep"><div><h3>Up next: ${esc(n.title)}</h3><p>${esc(n.step)} · ⏱ about ${fmtMin(n.estMinutes)}</p>
    <p style="font-weight:400;margin-top:4px">${plural(n.levelLeft, "topic")} left in ${esc(n.levelTitle)} · ${n.courseLeft} of ${P.stats.topicsTotal} left in the course</p></div>
    <a class="btn pri" href="topic.html#${esc(n.slug)}">Continue</a></div>`;
}
function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min"; }

function checklist(P) {
  let rows = "", lv = 0;
  P.topics.forEach(t => {
    if (t.level !== lv) { lv = t.level; const L = P.levels.find(x => x.id === lv); rows += `<tr class="lvl" data-l="${lv}" tabindex="0"><td colspan="7"><span class="car">▾</span> ${lv}. ${esc(L ? L.title : "")}</td></tr>`; }
    const st = t.certified ? '<span class="ok">✓ Certified</span>' : (t.read || t.tasksDone || t.quizBest != null || t.codeSolved) ? "In progress" : '<span class="pend">Not started</span>';
    rows += `<tr data-l="${lv}"><td><a href="topic.html#${esc(t.slug)}">${esc(t.title)}</a></td>
      <td>${t.read ? '<span class="ok">✓</span>' : '<span class="pend">–</span>'}</td>
      <td>${t.tasksDone}/${t.tasksTotal}</td>
      <td>${t.quizBest == null ? '<span class="pend">–</span>' : t.quizBest + "/5" + (t.quizPassed ? ' <span class="ok">✓</span>' : "")}</td>
      <td>${t.codeSolved}/${t.codeRequired}</td>
      <td>${st}</td><td>${fmtMin(t.estMinutes)}</td></tr>`;
  });
  return `<div class="cl-scroll"><table class="checklist"><thead><tr><th>Topic</th><th>Read</th><th>Practice</th><th>Quiz</th><th>Code</th><th>Status</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function load() {
  let P;
  try { P = await get("/api/profile/" + clientId); }
  catch (e) { $("app").innerHTML = '<div class="panel empty" style="margin-top:50px">Could not load your profile. Is the server running?</div>'; return; }
  let me = null; try { me = (await get("/api/auth/me?clientId=" + clientId)).email; } catch (e) {}
  const S = P.stats;
  const year = P.days.filter(r => r.n > 0).length;
  const todayRow = P.days.find(r => r.day === P.today);
  const doneToday = todayRow && todayRow.n > 0;
  const since = P.joined ? nice(P.joined.slice(0, 10)) : null;
  const stat = (big, label, hl) => `<div class="panel stat ${hl ? "hl" : ""}"><div class="big">${big}</div><div>${label}</div></div>`;

  $("app").innerHTML = `
    <div class="crumbs"><a href="index.html">Home</a> / Profile</div>
    <div class="thead"><h1>${esc(P.name || "My profile")}</h1>
      <p class="sub" style="margin-bottom:0">${since ? "Learning since " + esc(since) + ". " : ""}Everything you do on the site is saved here, day by day.</p></div>

    <div class="panel nudge ${me ? "done" : ""}">${me ? `<b>✓ Signed in as ${esc(me)}.</b> Your progress follows you to any device. <a href="signin.html">Account</a>` : `<b>Your progress is saved only in this browser.</b> Sign in with your email to keep it safe and use it on any device. <a class="btn sm pri" href="signin.html">Sign in</a>`}</div>

    <div class="panel nudge ${doneToday ? "done" : ""}">${doneToday
      ? `<b>✓ You learned today.</b> ${esc(what(todayRow))}.${S.currentStreak > 1 ? " That is a " + S.currentStreak + " day streak. Keep it going tomorrow!" : ""}`
      : `<b>Nothing yet today.</b> ${S.currentStreak ? "Your " + S.currentStreak + " day streak ends tonight, so do one small thing now." : "Read a lesson or solve a challenge to start a streak."} <a class="btn sm pri" href="index.html#path">Open learning path</a>`}</div>

    ${nextCard(P)}

    <div class="stats">
      ${stat(S.currentStreak + '<small> day' + (S.currentStreak === 1 ? "" : "s") + "</small>", "Current streak 🔥", S.currentStreak > 0)}
      ${stat(S.longestStreak + '<small> day' + (S.longestStreak === 1 ? "" : "s") + "</small>", "Longest streak")}
      ${stat(year, "Active days this year")}
      ${stat(S.topicsCertified + " / " + S.topicsTotal, "Topics certified")}
      ${stat(S.challengesSolved + " / " + S.challengesTotal, "Coding challenges solved")}
      ${stat(S.lessonsRead, "Lessons read")}
      ${P.daily ? stat(P.daily.streak + '<small> day' + (P.daily.streak === 1 ? "" : "s") + "</small>", "Daily question streak ⚡") + stat(P.daily.sheetDone + " / " + P.daily.sheetTotal, "DSA sheet problems done") : ""}
    </div>

    <h2 class="ph">How certificates work</h2>
    <div class="panel"><ul class="reqs"><li><b>Topic certificate:</b> score at least 4 of 5 on the quiz and solve at least 3 of the 4 coding challenges.</li>
      <li><b>Level certificate:</b> earned automatically once every topic in the level is certified.</li>
      <li><b>Full course certificate:</b> certify all ${S.topicsTotal} topics, then create it with your name.</li></ul></div>

    <h2 class="ph">Daily activity</h2>
    <div class="panel hmbox">${heatmap(P)}</div>

    <h2 class="ph">Progress by level</h2>
    <div class="panel lvlprog">${P.levels.map(l => `<div class="lp"><div class="lp-top"><b>${l.id}. ${esc(l.title)}</b><span>${l.certified} / ${l.total} topics${l.certificate ? ` · <a href="certificate.html#${esc(l.certificate)}">🎓 certificate</a>` : ""}</span></div>
      <div class="meter"><div style="width:${l.total ? l.certified / l.total * 100 : 0}%"></div></div></div>`).join("")}</div>

    <h2 class="ph">My certificates</h2>
    <div class="certgrid">${P.certificates.length ? P.certificates.map(c => `<a class="panel certitem" href="certificate.html#${esc(c.code)}"><span class="chip ${c.kind === "topic" ? "" : "hl"}" style="align-self:flex-start">${{ topic: "Topic certificate", level: "Level certificate", course: "Full course certificate" }[c.kind]}</span><b>${esc(c.title)}</b><span>${nice(c.issued_at.slice(0, 10))} · Code ${esc(c.code)}</span></a>`).join("")
      : '<div class="panel empty" style="grid-column:1/-1">No certificates yet. Pass a quiz and solve 3 of its 4 coding challenges to earn your first one.</div>'}</div>

    <h2 class="ph">Your name on certificates</h2>
    <div class="namebox"><input id="pname" maxlength="60" placeholder="Your full name" aria-label="Your name" value="${esc(P.name || "")}"><button class="btn pri" id="psave" type="button">Save name</button><span id="pmsg" class="sub" style="margin:0"></span></div>

    <details class="glance"><summary><span>Every topic at a glance</span><small>${S.topicsCertified} / ${S.topicsTotal} certified · tap to open</small></summary>
    <div class="panel" style="padding:0;overflow:hidden">${checklist(P)}</div></details>`;

  document.querySelectorAll(".checklist tr.lvl").forEach(r => {
    const tg = () => { const c = r.classList.toggle("shut"); r.querySelector(".car").textContent = c ? "▸" : "▾"; document.querySelectorAll('.checklist tr[data-l="' + r.dataset.l + '"]:not(.lvl)').forEach(x => x.hidden = c); };
    r.onclick = tg; r.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tg(); } };
  });
  const tip = $("hm-tip");
  const show = e => { const c = e.target.closest && e.target.closest(".hm-cell[data-tip]"); if (c) tip.textContent = c.dataset.tip; };
  const grid = document.querySelector(".hm-grid");
  grid.addEventListener("mouseover", show); grid.addEventListener("focusin", show); grid.addEventListener("click", show);
  const sc = document.querySelector(".hm-scroll"); sc.scrollLeft = sc.scrollWidth;   // start at today on small screens
  $("psave").onclick = async () => {
    try { const r = await send("PUT", "/api/learner/" + clientId, { name: $("pname").value }); $("pname").value = r.name; $("pmsg").textContent = "Saved ✔"; document.querySelector(".thead h1").textContent = r.name || "My profile"; }
    catch (e) { $("pmsg").textContent = "Could not save. Try again."; }
    setTimeout(() => $("pmsg").textContent = "", 2500);
  };
}
load();
