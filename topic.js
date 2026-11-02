// Topic page: Read -> Practice -> Quiz -> Code -> Certificate
const slug = decodeURIComponent(location.hash.slice(1).split("&c=")[0]);
let T = null, tab = "read";
const wantCh = Number((location.hash.split("&c=")[1] || "0")) || 0;   // opened from the Practice page

const fmtMin = m => m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
const toast = msg => { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3200); };

async function load(keepTab) {
  try { T = await get(`/api/topics/${encodeURIComponent(slug)}?clientId=${clientId}`); }
  catch (e) { $("app").innerHTML = `<div class="panel empty" style="margin-top:50px">${e.status === 404 ? "This topic does not exist." : "Could not load the topic. Is the server running?"}<br><br><a class="btn pri" href="index.html">Back to the learning path</a></div>`; return; }
  document.title = T.title + " · Java + DSA";
  if (!keepTab) tab = wantCh && T.coding && (T.read || T.dailyId === wantCh) ? "code" : T.certificate ? "cert" : "read";
  render();
}

const codeDone = () => !T.coding || T.coding.solved >= T.coding.required;

function render() {
  const tasksDone = T.tasks.filter(x => x.done).length;
  const C = T.coding;
  const tabs = [
    { id: "read", label: "Read", ok: T.read },
    { id: "practice", label: "Practice", ok: tasksDone === T.tasks.length },
    { id: "quiz", label: "Quiz", ok: T.quizPassed, lock: !T.read },
    ...(C ? [{ id: "code", label: "Code", ok: codeDone(), lock: !T.read && !(T.dailyId && T.dailyId === wantCh) }] : []),
    { id: "cert", label: "Certificate", ok: !!T.certificate },
  ];
  const needQuiz = Math.round(T.passMark * T.quizTotal);
  $("app").innerHTML = `
    <div class="crumbs"><a href="index.html#path">Learning path</a> / Level ${T.level.id}: ${esc(T.level.title)}</div>
    <div class="thead"><h1>${esc(T.title)}</h1>
      <div class="meta"><span class="chip hl" title="Reading ${T.estimate.read} min · practice ${T.estimate.practice} min · quiz ${T.estimate.quiz} min${C ? " · coding " + T.estimate.code + " min" : ""}">⏱ About ${fmtMin(T.estimate.total)} in total</span><span class="chip">${T.minutes} min read</span><span class="chip">${T.tasks.length} practice tasks</span><span class="chip ${T.quizPassed ? "done" : ""}">${T.quizPassed ? "✓ " : ""}${T.quizTotal} question quiz</span>${C ? `<span class="chip ${codeDone() ? "done" : ""}">${codeDone() ? "✓ " : ""}${C.total} coding challenges</span>` : ""}${T.certificate ? '<span class="chip done">✓ Certified</span>' : ""}</div>
      <p class="sub" style="margin-bottom:0">${esc(T.summary)}</p>
      ${T.prereqs.length ? `<p class="prereq"><b>Before this topic:</b> ${T.prereqs.map(p => `<a class="chip ${p.certified ? "done" : ""}" href="topic.html#${esc(p.slug)}">${p.certified ? "✓ " : ""}${esc(p.title)}</a>`).join(" ")}${T.prereqs.every(p => p.certified) ? "" : ' <span class="sub" style="margin:0">Finish these first if anything feels new.</span>'}</p>` : '<p class="prereq"><b>Before this topic:</b> nothing. You can start here.</p>'}</div>

    <ul class="tabs" role="tablist">
      ${tabs.map((x, i) => `<li><button data-tab="${x.id}" class="${tab === x.id ? "on" : ""} ${x.ok ? "ok" : ""}" ${x.lock ? 'disabled title="Read the lesson first"' : ""}><b>${x.ok ? "✓" : i + 1}</b>${x.label}</button></li>`).join("")}
    </ul>

    <div class="pane ${tab === "read" ? "on" : ""}" id="p-read">
      <article class="panel lesson">${renderMarkdown(T.lesson)}
        <div class="readbar">${T.read
          ? `<span class="chip done">✓ Lesson read</span><button class="btn pri" data-go="practice">Next: practice tasks</button>`
          : `<button class="btn pri" id="markread">I have read this lesson</button><span class="sub" style="margin:0">This unlocks the quiz${C ? " and the coding challenges" : ""}.</span>`}</div>
      </article>
    </div>

    <div class="pane ${tab === "practice" ? "on" : ""}" id="p-practice">
      <div class="panel tasklist"><h3 style="margin:0 0 4px">Practice tasks</h3>
        <p class="sub" style="margin-bottom:10px">Write each one in Java yourself, run it, then tick it. Typing the code is how it sticks. <span id="tcount" style="font-weight:700">${tasksDone} of ${T.tasks.length} done</span></p>
        ${T.tasks.map(x => `<label class="ck"><input type="checkbox" data-id="${x.id}" ${x.done ? "checked" : ""}><span>${esc(x.task)}</span></label>`).join("")}
        <div class="tip"><b>Stuck?</b> Go back to the lesson and re-read the example. Then try again before looking anything up.</div>
        <div class="readbar" style="margin-top:18px"><button class="btn pri" data-go="${T.read ? "quiz" : "read"}">${T.read ? "Next: take the quiz" : "Read the lesson first"}</button></div>
      </div>
    </div>

    <div class="pane ${tab === "quiz" ? "on" : ""}" id="p-quiz"></div>
    <div class="pane ${tab === "code" ? "on" : ""}" id="p-code"></div>

    <div class="pane ${tab === "cert" ? "on" : ""}" id="p-cert">
      <div class="panel result ${T.certificate ? "pass" : ""}">${T.certificate
        ? `<div class="score">🎓</div><h3>You are certified in ${esc(T.title)}</h3><p>Best quiz score: ${T.bestScore} / ${T.quizTotal}${C ? ` · Coding: ${C.solved} of ${C.total} solved` : ""}. Certificate code <b>${esc(T.certificate)}</b>.</p><div class="cta"><a class="btn pri" href="certificate.html#${esc(T.certificate)}">View and download certificate</a></div>`
        : `<div class="score">🔒</div><h3>Certificate locked</h3><p>To earn it you need both:</p>
           <ul class="reqs"><li class="${T.quizPassed ? "ok" : ""}">${T.quizPassed ? "✓" : "○"} Quiz: at least ${needQuiz} of ${T.quizTotal} correct${T.bestScore != null ? ` (your best: ${T.bestScore})` : ""}</li>
           ${C ? `<li class="${codeDone() ? "ok" : ""}">${codeDone() ? "✓" : "○"} Code: solve at least ${C.required} of ${C.total} coding challenges (solved: ${C.solved})</li>` : ""}</ul>
           <div class="cta"><button class="btn pri" data-go="${!T.read ? "read" : !T.quizPassed ? "quiz" : "code"}">${!T.read ? "Start with the lesson" : !T.quizPassed ? "Take the quiz" : "Go to the coding challenges"}</button></div>`}</div>
    </div>

    ${tab === "cert" && T.next ? `<div class="panel nextbox"><span class="chip next-tag">Up next</span><div><h4>${esc(T.next.title)}</h4><p>${esc(T.next.summary)}</p></div><a class="btn pri" href="topic.html#${esc(T.next.slug)}">Open topic →</a></div>` : ""}

    <div class="pager">
      ${T.prev ? `<a class="btn" href="topic.html#${esc(T.prev.slug)}">← ${esc(T.prev.title)}</a>` : "<span></span>"}
      ${T.next ? `<a class="btn" href="topic.html#${esc(T.next.slug)}">${esc(T.next.title)} →</a>` : '<a class="btn" href="index.html#certs">All certificates →</a>'}
    </div>`;

  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go(b.dataset.tab));
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  if ($("markread")) $("markread").onclick = markRead;
  document.querySelectorAll(".tasklist input").forEach(c => c.onchange = async e => {
    const x = T.tasks.find(t => t.id === +e.target.dataset.id);
    x.done = e.target.checked;
    const n = T.tasks.filter(t => t.done).length;
    $("tcount").textContent = n + " of " + T.tasks.length + " done";
    try { await send("PUT", "/api/progress/" + clientId, { taskId: x.id, done: x.done }); } catch (err) { toast("Could not save. Check your connection."); }
  });
  if (tab === "quiz") startQuiz();
  if (tab === "code") startCode();
}

function go(t) { tab = t; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }

async function markRead() {
  try { await send("PUT", `/api/topics/${slug}/read`, { clientId }); T.read = true; toast("Lesson marked as read. The quiz and coding challenges are unlocked."); render(); }
  catch (e) { toast("Could not save. Check your connection."); }
}

// ---------- quiz (multiple choice) ----------
let Q = [], picks = {};

function updateSubmit() {
  const n = Object.keys(picks).length;
  $("qcount").textContent = n + " of " + Q.length + " answered";
  $("submitq").disabled = n < Q.length;
}

async function startQuiz() {
  const box = $("p-quiz");
  box.innerHTML = '<p class="sub">Loading quiz...</p>';
  try { Q = await get(`/api/topics/${slug}/quiz?clientId=${clientId}`); }
  catch (e) { box.innerHTML = `<div class="panel locked"><h3>Quiz locked</h3><p class="sub">${e.status === 403 ? "Read the lesson first, then come back." : "Could not load the quiz."}</p></div>`; return; }
  picks = {};
  const need = Math.round(T.passMark * Q.length);
  const qCard = (q, i) => `<div class="panel qcard" data-q="${q.id}"><h4>Question ${i + 1} of ${Q.length}</h4><h3>${inline(q.question)}</h3>
      <div class="opts">${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${q.id}" value="${j}"><span>${inline(o)}</span></label>`).join("")}</div></div>`;
  box.innerHTML = `<div class="panel" style="margin-bottom:16px"><b>${Q.length} questions.</b> You need ${need} correct. After each answer you see right away whether it was correct and why. You can retry the whole quiz as many times as you like.${T.coding ? " After the quiz, the <b>Code</b> section has " + T.coding.total + " coding challenges. The certificate needs both." : ""}</div>
    <form id="qform">${Q.map(qCard).join("")}
      <div class="qbar"><button class="btn pri" id="submitq" type="submit" disabled>Submit answers</button><span class="count" id="qcount"></span></div></form>`;
  updateSubmit();
  $("qform").onchange = async e => {
    if (e.target.type !== "radio") return;
    const qid = e.target.name.slice(1), card = document.querySelector(`[data-q="${qid}"]`), choice = +e.target.value;
    picks[qid] = choice;
    card.querySelectorAll(".opt").forEach(o => o.classList.toggle("sel", o.contains(e.target)));
    card.querySelectorAll("input").forEach(i => { i.disabled = true; });      // the answer is final for this attempt
    updateSubmit();
    try {
      const r = await send("POST", `/api/questions/${qid}/check`, { clientId, choice });
      card.querySelectorAll(".opt").forEach((o, j) => { o.classList.remove("sel"); if (j === r.correctIndex) o.classList.add("right"); else if (j === choice) o.classList.add("wrong"); });
      card.insertAdjacentHTML("beforeend", `<p class="why ${r.correct ? "ok" : "no"}"><b>${r.correct ? "✓ Correct." : "✗ Not quite."}</b> ${r.correct ? "" : "The right answer is highlighted in green. "}${inline(r.explanation)}</p>`);
    } catch (err) { card.querySelectorAll("input").forEach(i => { i.disabled = false; }); }
  };
  $("qform").onsubmit = async e => {
    e.preventDefault();
    $("submitq").disabled = true;
    try { showResult(await send("POST", `/api/topics/${slug}/quiz`, { clientId, answers: picks })); }
    catch (err) { toast(err.message || "Could not submit. Try again."); updateSubmit(); }
  };
}

function showResult(r) {
  const box = $("p-quiz");
  if (r.passed) { T.quizPassed = true; T.bestScore = Math.max(T.bestScore || 0, r.score); }
  if (r.certificate) T.certificate = r.certificate.code;
  if (r.coding) T.coding = r.coding;
  const needCode = r.passed && !r.certificate && T.coding;
  const lines = r.milestones.map(m => `<li>${m.kind === "course" ? "🏆 You finished the whole course!" : "🎖️ Level complete: " + esc(m.title)}</li>`).join("");
  box.innerHTML = `<div class="panel result ${r.passed ? "pass" : "fail"}" style="margin-bottom:20px">
      <div class="score">${r.score} / ${r.total}</div>
      <h3>${!r.passed ? "Not quite yet" : needCode ? "Quiz passed ✓ One step left" : "Passed! Certificate earned 🎓"}</h3>
      <p>${!r.passed ? "You need " + Math.round(r.passMark * r.total) + " correct. Read the explanations below, re-read the lesson, and try again."
        : needCode ? `Now solve at least <b>${T.coding.required} of ${T.coding.total}</b> coding challenges in the Code section (you have solved ${T.coding.solved}). Your certificate arrives as soon as you do.`
        : "Great work. Your certificate is ready to view, print or add to LinkedIn."}</p>
      ${lines ? `<ul style="list-style:none;padding:0;font-weight:700">${lines}</ul>` : ""}
      <div class="cta">${needCode ? '<button class="btn pri" data-go="code">Go to the coding challenges</button>' : r.passed && r.certificate ? `<a class="btn pri" href="certificate.html#${esc(r.certificate.code)}">View certificate</a>` : '<button class="btn pri" id="retry">Try again</button>'}
        ${r.passed && !needCode && T.next ? `<a class="btn" href="topic.html#${esc(T.next.slug)}">Next topic →</a>` : ""}
        ${r.passed ? '<button class="btn" id="retry">Retake quiz</button>' : '<button class="btn" data-go="read">Re-read lesson</button>'}</div></div>
    ${Q.map((q, i) => { const x = r.results[i];
      return `<div class="panel qcard review"><h4>Question ${i + 1} · ${x.correct ? "Correct" : "Incorrect"}</h4><h3>${inline(q.question)}</h3>
        <div class="opts">${q.options.map((o, j) => `<div class="opt ${j === x.correctIndex ? "right" : j === x.chosen ? "wrong" : ""}"><span>${j === x.correctIndex ? "✓ " : j === x.chosen ? "✗ " : ""}${inline(o)}</span></div>`).join("")}</div>
        <p class="why"><b>Why:</b> ${inline(x.explanation)}</p></div>`; }).join("")}`;
  document.querySelectorAll("#p-quiz [data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  if ($("retry")) $("retry").onclick = startQuiz;
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshTabs();
}

// update the tab ticks and header chips without rebuilding the page
function refreshTabs() {
  const ok = { read: T.read, quiz: T.quizPassed, code: codeDone(), cert: !!T.certificate };
  document.querySelectorAll("[data-tab]").forEach(b => {
    const k = b.dataset.tab;
    if (k in ok) { b.classList.toggle("ok", !!ok[k]); if (ok[k]) b.querySelector("b").textContent = "✓"; }
  });
}

// ---------- code section: several coding challenges, shown after the quiz ----------
let CS = null, CH = null, curIdx = 0;
const DIFF = { easy: "Easy", medium: "Medium", hard: "Hard" };

async function startCode() {
  const box = $("p-code");
  box.innerHTML = '<p class="sub">Loading coding challenges...</p>';
  try { CS = await get(`/api/topics/${slug}/code?clientId=${clientId}`); }
  catch (e) { box.innerHTML = `<div class="panel locked"><h3>Coding challenges locked</h3><p class="sub">${e.status === 403 ? "Read the lesson first, then come back." : "Could not load the coding challenges."}</p></div>`; return; }
  if (curIdx >= CS.challenges.length) curIdx = 0;
  if (!startCode.visited) { const first = CS.challenges.findIndex(c => !c.passed), want = CS.challenges.findIndex(c => c.id === wantCh); curIdx = want >= 0 ? want : first < 0 ? 0 : first; startCode.visited = true; }
  drawCode();
}

function meterHtml() {
  const pct = Math.min(100, CS.solved / CS.total * 100), req = CS.required / CS.total * 100;
  const done = CS.solved >= CS.required;
  return `<div class="panel codehead">
      <div class="meterline"><b>${done ? "✓ " : ""}Solved ${CS.solved} of ${CS.total}</b><span>Solve at least <b>${CS.required}</b> to earn the certificate${T.quizPassed ? "" : ", and pass the quiz too"}.</span></div>
      <div class="meter" aria-hidden="true"><i style="width:${pct}%"></i><s style="left:${req}%"></s></div>
      ${done && !T.quizPassed ? '<p class="sub" style="margin:10px 0 0">Coding done ✓ Now <a href="#" data-go="quiz">pass the quiz</a> to get your certificate.</p>' : ""}
      <div class="pills" role="tablist">${CS.challenges.map((c, i) => `<button type="button" class="pill ${i === curIdx ? "on" : ""} ${c.passed ? "done" : ""} d-${c.difficulty}" data-ch="${i}"><b>${c.passed ? "✓" : c.position}</b><span>${esc(c.title)}</span><em>${DIFF[c.difficulty]}</em></button>`).join("")}</div>
    </div>`;
}

function drawCode() {
  const box = $("p-code");
  CH = CS.challenges[curIdx];
  box.innerHTML = meterHtml() + codeCard();
  box.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => { CH.code = $("editor").value; curIdx = +b.dataset.ch; drawCode(); });
  box.querySelectorAll("[data-go]").forEach(b => b.onclick = e => { e.preventDefault(); go(b.dataset.go); });
  wireCode();
}

// a test is one expression, or several statements separated by ";" (the last one is the value that is checked)
function showCall(src) {
  const parts = []; let depth = 0, cur = "", quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) { cur += c; if (c === "\\") cur += src[++i] || ""; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if ("([{".includes(c)) depth++; else if (")]}".includes(c)) depth--;
    if (c === ";" && depth === 0) { parts.push(cur.trim() + ";"); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.join("\n");
}

function codeCard() {
  const last = curIdx === CS.challenges.length - 1;
  return `<div class="panel code-card" id="codecard">
    <h4>Challenge ${CH.position} of ${CS.total} · <span class="dchip d-${CH.difficulty}">${DIFF[CH.difficulty]}</span> · Java</h4>
    <h3>${esc(CH.title)} <span class="chip ${CH.passed ? "done" : ""}" id="codechip">${CH.passed ? "✓ Passed" : "Not passed yet"}</span></h3>
    <div class="lesson code-prompt">${renderMarkdown(CH.prompt)}</div>
    <label class="editor-label" for="editor">Your code <span>(file: Solution.java)</span></label>
    <textarea id="editor" class="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Java code editor"></textarea>
    <div class="codebar">
      <button type="button" class="btn pri" id="runcode">▶ Run tests</button>
      <button type="button" class="btn" id="resetcode">Reset code</button>
      ${CH.hint ? '<button type="button" class="btn" id="hintbtn">💡 Show hint</button>' : ""}
      <button type="button" class="btn" id="solbtn" ${CH.canReveal ? "" : "disabled"} title="${CH.canReveal ? "" : "Run your code at least 3 times first"}">${CH.canReveal ? "Show solution" : "Solution (opens after 3 runs)"}</button>
      ${CS.previewSkip ? '<button type="button" class="btn" id="skipcode">Skip (preview only)</button>' : ""}
      <span class="count" id="runhint">Ctrl + Enter to run</span>
    </div>
    <div id="hintbox" class="hintbox" hidden></div>
    <div id="solbox" class="solbox" hidden></div>
    <div id="codeout" class="codeout" aria-live="polite">${testRows(null)}</div>
    <div class="readbar" id="nextbar" style="margin-top:18px">${nextHtml(last)}</div>
  </div>`;
}

function nextHtml(last) {
  if (!CH.passed) return `<span class="sub" style="margin:0">${last ? "" : "Stuck? You can open another challenge and come back."}</span>`;
  return last ? (T.certificate ? `<a class="btn pri" href="certificate.html#${esc(T.certificate)}">View certificate</a>` : `<span class="chip done">✓ Last challenge passed</span>`)
    : `<button type="button" class="btn pri" id="nextch">Next challenge →</button>`;
}

function testRows(res) {
  const visible = CH.tests;
  const rows = [];
  const call = t => `<code>${esc(showCall(t.call))}</code>`;
  if (!res) {
    visible.forEach(t => rows.push(`<div class="trowt wait"><span class="tb">○</span><div><b>Test ${t.n}</b>${call(t)}<span>Expected: <code>${esc(t.expected)}</code></span></div></div>`));
    if (CH.hiddenCount) rows.push(`<div class="trowt wait"><span class="tb">○</span><div><b>${CH.hiddenCount} hidden tests</b><span>Edge cases and bigger inputs. You will see only pass or fail.</span></div></div>`);
    return rows.join("");
  }
  res.tests.slice().sort((x, y) => (x.passed ? 1 : 0) - (y.passed ? 1 : 0)).forEach(t => {   // failed tests first
    if (t.hidden) rows.push(`<div class="trowt ${t.passed ? "pass" : "fail"}"><span class="tb">${t.passed ? "✓" : "✗"}</span><div><b>Hidden test ${t.n}</b><span>${t.passed ? "Passed" : t.status === "timeout" ? "Too slow: it did not finish in 1.5 seconds. Try a faster approach." : t.status === "error" ? "Your code threw an error on this input." : "Wrong answer. Think about edge cases and larger inputs."}</span></div></div>`);
    else rows.push(`<div class="trowt ${t.passed ? "pass" : "fail"}"><span class="tb">${t.passed ? "✓" : "✗"}</span><div><b>Test ${t.n}</b>${call(t)}<span>Expected: <code>${esc(t.expected)}</code></span>${t.passed ? "" : `<span class="got">${t.status === "error" ? "Error" : t.status === "timeout" || t.status === "crash" ? "Problem" : "Got"}: <code>${esc(t.actual === "" ? "(empty)" : t.actual)}</code></span>`}</div></div>`);
  });
  return rows.join("");
}

function wireCode() {
  const ed = $("editor");
  ed.value = CH.code;
  ed.rows = Math.min(28, Math.max(12, CH.code.split("\n").length + 2));
  const ind = line => (line.match(/^\s*/) || [""])[0];
  ed.addEventListener("keydown", e => {
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); ed.setRangeText("    ", ed.selectionStart, ed.selectionEnd, "end"); }
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const pos = ed.selectionStart, before = ed.value.slice(0, pos), line = before.slice(before.lastIndexOf("\n") + 1);
      e.preventDefault();
      ed.setRangeText("\n" + ind(line) + (/\{\s*$/.test(line) ? "    " : ""), pos, ed.selectionEnd, "end");
    }
  });
  $("runcode").onclick = run;
  $("resetcode").onclick = () => { ed.value = CH.starter; $("codeout").innerHTML = testRows(null); };
  if ($("skipcode")) $("skipcode").onclick = async () => {
    try { applyCoding(await send("POST", `/api/preview/skip`, { clientId, challengeId: CH.id })); } catch (e) { toast("Could not skip."); }
  };
  if ($("hintbtn")) $("hintbtn").onclick = () => { const b = $("hintbox"); b.hidden = !b.hidden; b.innerHTML = '<b>Hint</b>' + renderMarkdown(CH.hint); $("hintbtn").textContent = b.hidden ? "💡 Show hint" : "Hide hint"; };
  $("solbtn").onclick = async () => {
    const b = $("solbox");
    if (!b.hidden) { b.hidden = true; $("solbtn").textContent = "Show solution"; return; }
    try {
      const r = await get(`/api/challenges/${CH.id}/solution?clientId=${clientId}`);
      b.innerHTML = `<b>Reference solution</b><p class="sub" style="margin:4px 0 8px">Reading it does not count as solving the challenge. Close it, type your own version and run the tests.</p><pre><code>${esc(r.solution)}</code></pre>`;
      b.hidden = false; $("solbtn").textContent = "Hide solution";
    } catch (e) { toast(e.message || "Could not load the solution."); }
  };
  wireNext();
}

// after each run, count it so the solution button can unlock after 3 runs
function countRun() {
  CH.runs = (CH.runs || 0) + 1;
  if (CH.runs >= 3 && !CH.canReveal) { CH.canReveal = true; const b = $("solbtn"); if (b) { b.disabled = false; b.title = ""; b.textContent = "Show solution"; } }
}

function wireNext() {
  if ($("nextch")) $("nextch").onclick = () => { CH.code = $("editor").value; curIdx++; drawCode(); window.scrollTo({ top: 0, behavior: "smooth" }); };
}

// take the new progress numbers from a run result: update the challenge, header numbers, tabs and the certificate
function applyCoding(r) {
  if (r.coding) { Object.assign(CS, { solved: r.coding.solved, required: r.coding.required, total: r.coding.total }); T.coding = { ...r.coding }; }
  if (r.everPassed || r.passed) CH.passed = true;
  if (r.quizPassed) T.quizPassed = true;
  if (r.certificate) {
    T.certificate = r.certificate.code;
    if (r.certificate.isNew) toast("🎓 Certificate earned for " + T.title + "!");
  }
  (r.milestones || []).forEach(m => toast(m.kind === "course" ? "🏆 You finished the whole course!" : "🎖️ Level complete: " + m.title));
  const out = $("codeout"), keep = out ? out.innerHTML : "";
  const sx = window.scrollY;
  drawCode();
  if (out) $("codeout").innerHTML = keep;
  window.scrollTo(0, sx);
  refreshTabs();
}

let running = false;
async function run() {
  if (running) return;
  running = true;
  const btn = $("runcode"), out = $("codeout");
  btn.disabled = true; btn.textContent = "Running...";
  out.innerHTML = '<div class="runmsg">Compiling and running your code. This takes a couple of seconds...</div>';
  try {
    const r = await send("POST", `/api/challenges/${CH.id}/run`, { clientId, code: $("editor").value });
    CH.code = $("editor").value;
    countRun();
    let html;
    if (!r.compile.ok) {
      html = `<div class="runmsg bad"><b>${r.compile.mismatch ? "Your code does not match the tests" : "Compile error"}</b><pre>${esc(r.compile.error)}</pre></div>` + testRows(null);
    } else {
      const ok = r.tests.filter(t => t.passed).length;
      const extra = !r.passed ? "<span>Read the failed test below, fix your code and run again.</span>"
        : r.certificate && r.certificate.isNew ? "<span>🎓 That was the last step: your topic certificate is ready.</span>"
        : r.coding && r.coding.solved >= r.coding.required ? (r.quizPassed ? "<span>Enough challenges solved. You can keep going for practice.</span>" : "<span>Enough challenges solved. Pass the quiz to get your certificate.</span>")
        : `<span>${r.coding ? r.coding.solved + " of " + r.coding.required + " needed for the certificate." : ""}</span>`;
      html = `<div class="runmsg ${r.passed ? "good" : "bad"}"><b>${r.passed ? "All " + r.tests.length + " tests passed 🎉" : ok + " of " + r.tests.length + " tests passed"}</b>${extra}</div>` + testRows(r);
    }
    if (r.compile.ok && (r.passed || r.everPassed)) { applyCoding(r); $("codeout").innerHTML = html; }
    else out.innerHTML = html;
  } catch (e) {
    out.innerHTML = `<div class="runmsg bad"><b>${e.status === 429 ? "Slow down a little" : "Could not run your code"}</b><span>${esc(e.message || "Check your connection and try again.")}</span></div>` + testRows(null);
  } finally { running = false; const b = $("runcode"); if (b) { b.disabled = false; b.textContent = "▶ Run tests"; } }
}

load();

window.addEventListener("hashchange", () => location.reload());
