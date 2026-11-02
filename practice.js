// Practice page: today's question (same for everyone), the DSA sheet, and every runnable challenge
const DL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const dchip = d => `<span class="chip d-${d}">${DL[d]}</span>`;
let P = null, view = "sheet", filt = "all", hideDone = false;
const prettyDay = d => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dailyCard() {
  const D = P.daily;
  if (!D) return "";
  const go = `topic.html#${encodeURIComponent(D.topicSlug)}&c=${D.challengeId}`;
  return `<div class="panel daily ${D.solved ? "done" : ""}">
    <div class="dtop"><span class="chip y">Question of the day</span><span class="sub" style="margin:0">${esc(prettyDay(D.day))}</span></div>
    <h2>${esc(D.title)}</h2>
    <div class="dmeta">${dchip(D.difficulty)}<span class="chip">${esc(D.topicTitle)}</span><span class="chip">⏱ about 10 min</span></div>
    <p class="dline">${D.solved ? "<b>✓ Solved today.</b> Come back tomorrow for the next one." : "Everyone gets the same question today. No lesson needed to try it."}
      <span class="dstat">🔥 ${D.streak} day streak</span><span class="dstat">👥 ${D.solvedBy} ${D.solvedBy === 1 ? "person" : "people"} solved it today</span></p>
    <div class="dact"><a class="btn pri" href="${go}">${D.solved ? "Open it again" : "Solve it now"}</a>
      ${D.yesterday ? `<a class="sub" style="margin:0" href="topic.html#${encodeURIComponent(D.yesterday.topicSlug)}&c=${D.yesterday.challengeId}">Yesterday: ${esc(D.yesterday.title)}${D.yesterday.solved ? " ✓" : ""}</a>` : ""}</div>
  </div>`;
}

function sheetView() {
  const keep = q => (filt === "all" || q.difficulty === filt) && !(hideDone && q.done);
  const pct = P.sheetTotal ? P.sheetDone / P.sheetTotal * 100 : 0;
  return `<div class="panel" style="margin-bottom:14px"><div class="meterline"><b>${P.sheetDone} of ${P.sheetTotal} problems done</b><span>Tick a problem when you have solved it. It is saved to your profile.</span></div>
      <div class="meter"><i style="width:${pct}%"></i></div></div>
    <div class="filters"><span class="seg" id="fseg">${["all", "easy", "medium", "hard"].map(f => `<button type="button" data-f="${f}" class="${filt === f ? "on" : ""}">${f === "all" ? "All" : DL[f]}</button>`).join("")}</span>
      <label class="ck" style="padding:0"><input type="checkbox" id="hd" ${hideDone ? "checked" : ""}><span>Hide solved</span></label></div>
    ${P.sheet.map((t, ti) => { const shown = t.problems.filter(keep); const d = t.problems.filter(q => q.done).length; if (!shown.length) return "";
      return `<details class="panel sheet-topic" ${ti === 0 || filt !== "all" || hideDone ? "open" : ""}><summary><b>${esc(t.name)}</b><span class="chip ${d === t.problems.length ? "done" : ""}">${d} / ${t.problems.length}</span></summary>
        ${shown.map(q => `<div class="prow ${q.done ? "done" : ""}"><label class="ck"><input type="checkbox" data-k="${esc(q.key)}" ${q.done ? "checked" : ""}><span></span></label>
          <a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.title)} <small>↗</small></a>${dchip(q.difficulty)}</div>`).join("")}</details>`; }).join("")}
    <p class="sub" style="margin-top:14px">These problems open on LeetCode in a new tab. This is a hand-picked practice list that follows the usual DSA topic order. It is not a copy of any other site's sheet, and the problem statements stay on their own pages.</p>`;
}

function runView() {
  const n = P.runnable.reduce((a, g) => a + g.items.length, 0), d = P.runnable.reduce((a, g) => a + g.items.filter(i => i.passed).length, 0);
  return `<div class="panel" style="margin-bottom:14px"><div class="meterline"><b>${d} of ${n} solved</b><span>These run on the site: write Java, press Run, and the tests check it.</span></div><div class="meter"><i style="width:${n ? d / n * 100 : 0}%"></i></div></div>
    ${P.runnable.map(g => `<div class="panel sheet-topic"><div class="rh"><b>${esc(g.title)}</b><span class="chip">Level ${g.level}</span></div>
      ${g.items.map(i => `<a class="prow ${i.passed ? "done" : ""}" href="topic.html#${encodeURIComponent(g.slug)}&c=${i.id}"><span class="tick">${i.passed ? "✓" : ""}</span><span class="pt">${esc(i.title)}</span>${dchip(i.difficulty)}</a>`).join("")}</div>`).join("")}`;
}

function draw() {
  $("pbody").innerHTML = view === "sheet" ? sheetView() : runView();
  document.querySelectorAll("#tabsw button").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  if (view === "sheet") {
    $("fseg").onclick = e => { const b = e.target.closest("button"); if (b) { filt = b.dataset.f; draw(); } };
    $("hd").onchange = e => { hideDone = e.target.checked; draw(); };
    $("pbody").querySelectorAll("input[data-k]").forEach(c => c.onchange = async () => {
      const q = P.sheet.flatMap(t => t.problems).find(x => x.key === c.dataset.k);
      q.done = c.checked; P.sheetDone += c.checked ? 1 : -1;
      try { await send("PUT", "/api/sheet/" + q.key, { clientId, done: q.done }); } catch (e) { q.done = !q.done; P.sheetDone += q.done ? 1 : -1; }
      const y = window.scrollY; draw(); window.scrollTo(0, y);
    });
  }
}

async function load() {
  try { P = await get("/api/practice?clientId=" + clientId); }
  catch (e) { $("app").innerHTML = '<div class="panel empty" style="margin-top:50px">Could not load the practice page. Is the server running?</div>'; return; }
  $("app").innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / Practice</div>
    <div class="thead"><h1>Practice</h1><p class="sub" style="margin-bottom:0">Solve one question a day, then work through a full DSA problem list.</p></div>
    ${dailyCard()}
    <div class="filters" style="margin-top:26px"><span class="seg" id="tabsw"><button type="button" data-v="sheet">DSA sheet (${P.sheetTotal})</button><button type="button" data-v="run">Run on this site (${P.runnable.reduce((a, g) => a + g.items.length, 0)})</button></span></div>
    <div id="pbody"></div>`;
  $("tabsw").onclick = e => { const b = e.target.closest("button"); if (b) { view = b.dataset.v; draw(); } };
  draw();
}
load();
