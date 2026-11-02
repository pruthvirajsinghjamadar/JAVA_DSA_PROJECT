// Home page: learning path, certificates, resources
const fail = id => { $(id).innerHTML = '<p class="sub">Could not load this section. Is the server running?</p>'; };

async function loadCourse() {
  let C;
  try { C = await get("/api/course?clientId=" + clientId); } catch (e) { fail("levels"); return; }
  const all = C.levels.flatMap(l => l.topics);
  const titleOf = new Map(all.map(t => [t.slug, t.title]));
  const fmtMin = m => m < 60 ? m + " min" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  const certified = all.filter(t => t.certificate).length;
  const next = all.find(t => !t.certificate);          // first topic not yet certified

  $("overall").hidden = false;
  $("ovnum").textContent = certified + " / " + all.length;
  $("ovbar").style.width = (certified / all.length * 100) + "%";

  const cont = $("continue");
  if (!next) { cont.textContent = "Course complete! View certificates"; cont.href = "#certs"; }
  else { cont.textContent = certified || next.read ? "Continue: " + next.title : "Start with " + next.title; cont.href = "topic.html#" + next.slug; }

  renderFinal(C, all.length, certified);
  if (window.JD_PREVIEW && !C.courseComplete && !C.courseCertificate) { const bt = document.createElement("button"); bt.className = "btn"; bt.style.marginTop = "14px"; bt.textContent = "Preview only: mark all 24 topics as done"; bt.onclick = async () => { await send("POST", "/api/preview/finish-all", {}); location.reload(); }; $("finalbox").appendChild(bt); }

  let n = 0;
  $("levels").innerHTML = C.levels.map(l => {
    const done = l.topics.filter(t => t.certificate).length;
    return `<div class="level" data-l="${l.id}">
      <div class="lhead"><span class="lnum">${l.id}</span><h3>${esc(l.title)}</h3>
        <span class="chip ${l.certificate ? "done" : ""}">${l.certificate ? "Level certified" : done + " / " + l.topics.length + " done"}</span>
        <p>${esc(l.summary)}</p></div>
      <div class="road"><div class="track">${l.topics.map((t, i) => {
        n++;
        const X = [0, 0.35, 0.7, 1, 0.7, 0.35], x = X[i % 6], nx = X[(i + 1) % 6], last = i === l.topics.length - 1;
        const isNext = next && next.id === t.id;
        const started = t.read || t.tasksDone || t.bestScore != null || t.codeSolved;
        const st = t.certificate ? "done" : isNext ? "cur" : started ? "prog" : "todo";
        const bits = t.certificate ? "🎓 Certified" : started ? [t.read ? "Read ✓" : "Read", "Practice " + t.tasksDone + "/" + t.tasksTotal, "Quiz" + (t.bestScore != null ? " " + t.bestScore + "/5" : ""), t.codeTotal ? "Code " + t.codeSolved + "/" + t.codeTotal : ""].filter(Boolean).join(" · ") : "";
        return `<a class="stop ${st}" style="--x:${x}" href="topic.html#${esc(t.slug)}">
          ${last ? "" : `<svg class="link" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d="M${x} 0 C ${x} 0.5, ${nx} 0.5, ${nx} 1" fill="none" vector-effect="non-scaling-stroke"/></svg>`}
          <span class="ball">${t.certificate ? "✓" : n}</span>
          <span class="lab"><b>${esc(t.title)}</b>
            <small>${isNext ? "Up next · " : ""}⏱ ${fmtMin(t.estMinutes)}</small>
            ${t.needs.length && !t.certificate ? `<small class="needs">Needs: ${t.needs.map(s => esc(titleOf.get(s) || s)).join(", ")}</small>` : ""}
            ${bits ? `<small class="pr">${bits}</small>` : ""}</span></a>`;
      }).join("")}</div></div>
      <div class="panel levelcert ${l.certificate ? "got" : ""}">
        <span class="lc-icon">${l.certificate ? "🎓" : "🔒"}</span>
        <div><h4>${esc(l.title)} certificate</h4>
          <p>${l.certificate ? "You finished every topic in this level. Your certificate is ready." : `Certify all ${l.topics.length} topics (quiz + coding) to unlock it. You have ${done} of ${l.topics.length}.`}</p></div>
        ${l.certificate ? `<a class="btn pri" href="certificate.html#${esc(l.certificate)}">View certificate</a>` : `<span class="chip">${done} / ${l.topics.length}</span>`}
      </div>
    </div>`;
  }).join("") + `<div class="panel levelcert final ${C.courseCertificate ? "got" : ""}">
      <span class="lc-icon">${C.courseCertificate ? "🏆" : "🔒"}</span>
      <div><h4>Full course certificate: Java + DSA</h4>
        <p>${C.courseCertificate ? "You completed all " + all.length + " topics. Congratulations!" : `Finish every topic in all 5 levels to unlock it. You have ${certified} of ${all.length}.`}</p></div>
      ${C.courseCertificate ? `<a class="btn pri" href="certificate.html#${esc(C.courseCertificate)}">View certificate</a>` : `<span class="chip">${certified} / ${all.length}</span>`}
    </div>`;
}

function renderFinal(C, total, certified) {
  const box = $("finalbox");
  if (C.courseCertificate) {
    box.innerHTML = `<div class="score">🏆</div><h3>You finished the whole course!</h3><p>Your full course certificate is ready.</p><div class="cta"><a class="btn pri" href="certificate.html#${esc(C.courseCertificate)}">View and download certificate</a></div>`;
  } else if (C.courseComplete) {
    box.innerHTML = `<div class="score">🎉</div><h3>All ${total} topics done. Create your certificate</h3><p>Type your name as it should appear on the certificate.</p>
      <div class="namebox"><input id="fname" maxlength="60" placeholder="Your full name" aria-label="Your full name"><button class="btn pri" id="fmake" type="button">Create my certificate</button></div><p class="sub" id="fmsg" style="margin:8px 0 0"></p>`;
    $("fname").value = ($("name") && $("name").value) || "";
    $("fmake").onclick = async () => {
      const nm = $("fname").value.trim();
      if (!nm) { $("fmsg").textContent = "Please type your name first."; return; }
      $("fmake").disabled = true;
      try { const r = await send("POST", "/api/course/certificate", { clientId, name: nm }); location.href = "certificate.html#" + encodeURIComponent(r.code); }
      catch (e) { $("fmsg").textContent = e.message || "Could not create the certificate. Try again."; $("fmake").disabled = false; }
    };
  } else {
    box.innerHTML = `<div class="score">🔒</div><h3>Final certificate locked</h3><p>${certified} of ${total} topics certified. Finish the remaining ${total - certified} to unlock it.</p>
      <div class="meter" style="max-width:420px;margin:12px auto 0"><div style="width:${certified / total * 100}%"></div></div>`;
  }
}

async function loadCerts() {
  let L;
  try { L = await get("/api/learner/" + clientId); } catch (e) { fail("certlist"); return; }
  $("name").value = L.name || "";
  const label = { topic: "Topic certificate", level: "Level certificate", course: "Full course certificate" };
  $("certlist").innerHTML = L.certificates.length
    ? L.certificates.map(c => `<a class="panel certitem" href="certificate.html#${esc(c.code)}"><span class="chip ${c.kind === "topic" ? "" : "hl"}" style="align-self:flex-start">${label[c.kind]}</span><b>${esc(c.title)}</b><span>${c.score != null ? "Score " + c.score + "/" + c.total + " · " : ""}Code ${esc(c.code)}</span></a>`).join("")
    : '<div class="panel empty" style="grid-column:1/-1">No certificates yet. Open a topic, read the lesson, pass its quiz and solve its coding challenges to earn your first one.</div>';
}
$("savename").onclick = async () => {
  try { const r = await send("PUT", "/api/learner/" + clientId, { name: $("name").value }); $("name").value = r.name; $("namemsg").textContent = "Saved ✔"; }
  catch (e) { $("namemsg").textContent = "Could not save. Try again."; }
  setTimeout(() => $("namemsg").textContent = "", 2500);
};

async function loadResources() {
  try {
    const R = await get("/api/resources");
    $("os").innerHTML = R.map(o => `<a class="panel card" href="${esc(o.url)}" target="_blank" rel="noopener"><span class="tag">${esc(o.tag)}</span><b>${esc(o.name)}</b><span>${esc(o.description)}</span></a>`).join("");
  } catch (e) { fail("os"); }
}

loadCourse(); loadCerts(); loadResources();
