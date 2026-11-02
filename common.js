// Shared helpers used by every page
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TZ = { "X-Tz-Offset": String(new Date().getTimezoneOffset()) };   // so the server counts activity on the learner's own day
const get = u => fetch(u, { headers: TZ }).then(r => { if (!r.ok) { const e = new Error(r.status); e.status = r.status; throw e; } return r.json(); });
const send = (method, u, body) => fetch(u, { method, headers: { ...TZ, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; throw e; } return d; });

// anonymous learner id, kept in this browser so progress is saved on the server
let clientId = null;
try { clientId = localStorage.getItem("clientId"); } catch (e) {}
if (!clientId) {
  clientId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  try { localStorage.setItem("clientId", clientId); } catch (e) {}
}

// ---------- tiny markdown renderer for lessons ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function renderMarkdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", list = null, para = [], i = 0;
  const endPara = () => { if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; } };
  const endList = () => { if (list) { html += `</${list}>`; list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^(~~~|```)\s*(\w*)\s*$/);
    if (fence) {                                  // code block
      endPara(); endList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[1])) code.push(lines[i++]);
      i++;
      html += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
      continue;
    }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { endPara(); endList(); const n = m[1].length + 1; html += `<h${n}>${inline(m[2])}</h${n}>`; }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { endPara(); if (list !== "ul") { endList(); html += "<ul>"; list = "ul"; } html += "<li>" + inline(m[1]) + "</li>"; }
    else if ((m = line.match(/^\d+\.\s+(.*)$/))) { endPara(); if (list !== "ol") { endList(); html += "<ol>"; list = "ol"; } html += "<li>" + inline(m[1]) + "</li>"; }
    else if (!line.trim()) { endPara(); endList(); }
    else { endList(); para.push(line.trim()); }
    i++;
  }
  endPara(); endList();
  return html;
}

// ---------- theme toggle ----------
(function () {
  var r = document.documentElement, b = $("theme"), t = null;
  if (!b) return;
  try { t = localStorage.getItem("theme"); } catch (e) {}
  if (!t) t = "light";   // first visit: always light mode
  function set(v) { r.setAttribute("data-theme", v); b.textContent = v === "dark" ? "☀️" : "🌙"; b.setAttribute("aria-label", v === "dark" ? "Switch to light mode" : "Switch to dark mode"); }
  set(t);
  b.addEventListener("click", function () { t = t === "dark" ? "light" : "dark"; set(t); try { localStorage.setItem("theme", t); } catch (e) {} });
})();

// ---------- question of the day: menu dot, home banner and a once-a-day pop-up ----------
(function () {
  var onPractice = /practice\.html$/.test(location.pathname);
  var link = document.querySelector('.nav nav a[href$="practice.html"]');
  if (!link || typeof get !== "function") return;
  get("/api/daily?clientId=" + clientId).then(function (r) {
    var D = r && r.daily;
    if (!D || D.solved) return;
    var go = "topic.html#" + encodeURIComponent(D.topicSlug) + "&c=" + D.challengeId;
    var dot = document.createElement("span"); dot.className = "ndot"; dot.title = "Today's question is waiting"; dot.setAttribute("aria-label", "new question today"); link.appendChild(dot);
    var DL = { easy: "Easy", medium: "Medium", hard: "Hard" };
    var main = document.querySelector("main");
    if (main && document.getElementById("levels")) {          // home page banner
      var b = document.createElement("div"); b.className = "panel dbanner";
      b.innerHTML = '<div><b>⚡ Question of the day</b><p>' + esc(D.title) + " · " + DL[D.difficulty] + " · about 10 min" + (D.streak ? " · 🔥 " + D.streak + " day streak to keep" : "") + '</p></div><a class="btn pri" href="' + go + '">Solve it now</a>';
      var w = document.createElement("div"); w.className = "wrap"; w.appendChild(b); main.parentNode.insertBefore(w, main);
    }
    var seen = null; try { seen = localStorage.getItem("jd-daily-seen"); } catch (e) {}
    if (onPractice || seen === D.day || /\bc=\d+/.test(location.search + location.hash)) return;
    setTimeout(function () {
      var o = document.createElement("div"); o.className = "dpop-bg"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Question of the day");
      o.innerHTML = '<div class="dpop"><span class="chip y">⚡ Question of the day</span><h3>' + esc(D.title) + '</h3>' +
        '<div class="dmeta"><span class="chip d-' + D.difficulty + '">' + DL[D.difficulty] + '</span><span class="chip">' + esc(D.topicTitle) + '</span><span class="chip">⏱ about 10 min</span></div>' +
        '<p>' + (D.solvedBy ? D.solvedBy + (D.solvedBy === 1 ? " person has" : " people have") + " solved it today. " : "Be the first to solve it today. ") + (D.streak ? "Your " + D.streak + " day streak is waiting." : "Solve one a day to build a streak.") + '</p>' +
        '<div class="dpop-act"><a class="btn pri" id="dp-go" href="' + go + '">Solve it now</a><button class="btn" id="dp-later" type="button">Maybe later</button></div></div>';
      document.body.appendChild(o);
      var close = function () { try { localStorage.setItem("jd-daily-seen", D.day); } catch (e) {} o.remove(); document.removeEventListener("keydown", esc2); };
      var esc2 = function (e) { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", esc2);
      o.addEventListener("click", function (e) { if (e.target === o) close(); });
      document.getElementById("dp-later").onclick = close;
      document.getElementById("dp-go").addEventListener("click", function () { try { localStorage.setItem("jd-daily-seen", D.day); } catch (e) {} });
      document.getElementById("dp-go").focus();
    }, 900);
  }).catch(function () {});
})();

// ---------- sign in / account link in the menu and footer ----------
(function () {
  var nav = document.querySelector(".nav nav"), foot = document.querySelector("footer");
  if (!nav || typeof get !== "function") return;
  var mk = function (t) { var a = document.createElement("a"); a.href = "signin.html"; a.textContent = t; return a; };
  var navA = mk("Sign in"); navA.className = "keep signin-link"; nav.insertBefore(navA, nav.querySelector('a[href$="profile.html"]'));
  var footA = null;
  if (foot) { footA = mk("Sign in"); footA.className = "foot-signin"; foot.appendChild(document.createElement("br")); foot.appendChild(footA); }
  get("/api/auth/me?clientId=" + clientId).then(function (r) {
    window.JD_ME = r.email || null;
    if (r.email) { navA.textContent = "Account"; navA.title = r.email; if (footA) footA.textContent = "Signed in as " + r.email; }
  }).catch(function () {});
})();
