// Sign in with an email code. The account owns your learner profile, so progress follows you to any device.
let ME = null, mailOk = true, em = "";
const setMsg = (t, bad) => { const m = $("smsg"); if (m) { m.textContent = t || ""; m.className = "smsg" + (bad ? " bad" : ""); } };
const post = async (u, body) => { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something went wrong. Try again."); return j; };

function signedIn() {
  $("app").innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / Account</div><div class="thead"><h1>You are signed in</h1></div>
    <div class="panel"><p style="margin:0 0 14px"><b>${esc(ME)}</b></p><p class="sub">Your progress, streaks and certificates are saved to this account. Sign in with the same email on any device to see them there too.</p>
    <div class="dact"><a class="btn pri" href="profile.html">Open my profile</a><button class="btn" id="out" type="button">Sign out</button></div></div>`;
  $("out").onclick = () => { try { localStorage.setItem("clientId", crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); localStorage.removeItem("jd-daily-seen"); } catch (e) {} location.href = "index.html"; };
}

function stepEmail() {
  $("app").innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / Sign in</div><div class="thead"><h1>Sign in</h1>
    <p class="sub" style="margin-bottom:0">Type your email. We send a 6-digit code. No password to remember.</p></div>
    <div class="panel signbox"><label for="semail"><b>Email</b></label>
      <input id="semail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" maxlength="120" value="${esc(em)}">
      <button class="btn pri" id="sgo" type="button">Send me a code</button><p id="smsg" class="smsg"></p>
      <p class="sub" style="margin:10px 0 0">Progress you already made in this browser is saved to your account the first time you sign in. Signing in on another device brings it with you.${mailOk ? "" : " <b>(Email is not set up on this server yet: see the README.)</b>"}</p></div>`;
  const go = async () => {
    em = $("semail").value.trim().toLowerCase(); if (!em) { setMsg("Please type your email.", true); return; }
    $("sgo").disabled = true; setMsg("Sending...");
    try { const r = await post("/api/auth/request", { email: em }); stepCode(r); }
    catch (e) { setMsg(e.message, true); $("sgo").disabled = false; }
  };
  $("sgo").onclick = go; $("semail").onkeydown = e => { if (e.key === "Enter") go(); }; $("semail").focus();
}

function stepCode(r) {
  $("app").innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / Sign in</div><div class="thead"><h1>Check your email</h1>
    <p class="sub" style="margin-bottom:0">${r && r.sent === false ? "Email is not set up on this server, so no email was sent (the site owner can read the code in the server log)." : "We sent a 6-digit code to <b>" + esc(em) + "</b>. It works for 10 minutes. Look in spam if you do not see it."}</p></div>
    <div class="panel signbox"><label for="scode"><b>6-digit code</b></label>
      <input id="scode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" style="letter-spacing:.3em;font-size:22px">
      <button class="btn pri" id="sver" type="button">Sign in</button><p id="smsg" class="smsg"></p>
      <p class="sub" style="margin:10px 0 0"><a href="#" id="sback">Use a different email</a></p></div>`;
  const ver = async () => {
    const code = $("scode").value.replace(/\D/g, ""); if (code.length !== 6) { setMsg("Type the 6 digits from the email.", true); return; }
    $("sver").disabled = true; setMsg("Checking...");
    try {
      const j = await post("/api/auth/verify", { email: em, code, clientId });
      try { localStorage.setItem("clientId", j.clientId); localStorage.removeItem("jd-daily-seen"); } catch (e) {}
      setMsg("Signed in ✔"); setTimeout(() => { location.href = "profile.html"; }, 500);
    } catch (e) { setMsg(e.message, true); $("sver").disabled = false; }
  };
  $("sver").onclick = ver; $("scode").onkeydown = e => { if (e.key === "Enter") ver(); }; $("scode").focus();
  $("sback").onclick = e => { e.preventDefault(); stepEmail(); };
  if (r && r.devCode) setMsg("Test mode code: " + r.devCode);
}

(async function () {
  try { const r = await get("/api/auth/me?clientId=" + clientId); ME = r.email; mailOk = r.mail; } catch (e) {}
  ME ? signedIn() : stepEmail();
})();
