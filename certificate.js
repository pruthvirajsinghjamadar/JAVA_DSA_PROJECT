// Certificate page: shows, prints and verifies a certificate by its code
const code = decodeURIComponent(location.hash.slice(1)).toUpperCase();
const heading = { topic: "Certificate of Completion", level: "Level Certificate", course: "Course Certificate" };
const line = { topic: "has successfully passed the quiz for", level: "has completed every topic in", course: "has completed all 24 topics of" };

async function load() {
  let C, mine = null;
  try { C = await get("/api/certificates/" + encodeURIComponent(code)); }
  catch (e) { $("app").innerHTML = `<div class="panel empty">${e.status === 404 ? "No certificate found for the code <b>" + esc(code) + "</b>. Check the code and try again." : "Could not load the certificate."}<br><br><a class="btn pri" href="index.html">Back to the site</a></div>`; return; }
  try { const L = await get("/api/learner/" + clientId); mine = L.certificates.some(c => c.code === C.code) ? L : null; } catch (e) {}

  document.title = C.title + " certificate · Java + DSA";
  const date = new Date(C.issuedAt.replace(" ", "T") + "Z").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const verifyUrl = location.href.split("#")[0] + "#" + C.code;
  const d = new Date(C.issuedAt.replace(" ", "T") + "Z");
  const linkedin = "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=" + encodeURIComponent(C.title + " (Java + DSA)") +
    "&organizationName=" + encodeURIComponent("Java + DSA") + "&issueYear=" + d.getFullYear() + "&issueMonth=" + (d.getMonth() + 1) +
    "&certUrl=" + encodeURIComponent(verifyUrl) + "&certId=" + encodeURIComponent(C.code);

  $("app").innerHTML = `
    ${mine ? `<div class="nameedit"><input id="nm" maxlength="60" value="${esc(mine.name)}" placeholder="Type your name for the certificate" aria-label="Your name"><button class="btn sm pri" id="nmsave">Save name</button></div>` : ""}
    <div class="certtools">
      <button class="btn pri" id="print">Print / Save as PDF</button>
      <button class="btn" id="copy">Copy verification link</button>
      ${mine ? `<a class="btn" target="_blank" rel="noopener" href="${linkedin}">Add to LinkedIn</a>` : ""}
    </div>
    <div class="cert" id="cert"><div class="in">
      <div class="brand"><span class="logo" aria-hidden="true"><i>J</i><i>D</i></span>Java + DSA: Learn at Your Own Pace</div>
      <div><h1 style="font-size:clamp(14px,2vw,20px);letter-spacing:.2em">${heading[C.kind]}</h1><p class="small" style="margin-top:8px">THIS IS TO CERTIFY THAT</p></div>
      <p class="who" id="who">${esc(C.learner || "Your Name")}</p>
      <div><p class="small">${line[C.kind]}</p><p class="what" style="margin-top:8px">${esc(C.title)}</p>${C.level ? `<p class="small" style="margin-top:8px">${esc(C.level)}</p>` : ""}</div>
      <div class="foot"><div style="text-align:left">Issued<br><b>${esc(date)}</b></div>
        <div class="sign"><div class="sigimg" id="sigimg"><img src="signature.png" alt="Signature of Pruthvirajsingh"></div><div class="sigline"></div><b>Pruthvirajsingh</b><br>Founder, Java + DSA</div>
        <div class="qr"><div class="qrbox" id="qrbox"></div>Scan to verify</div><div style="text-align:right">Certificate ID<br><b>${esc(C.code)}</b></div></div>
    </div></div>
    <p class="verify sub" style="text-align:center">Anyone can check this certificate at <b>${esc(verifyUrl)}</b></p>`;

  try { $("qrbox").innerHTML = qrSvg(verifyUrl); } catch (e) { $("qrbox").parentNode.remove(); }
  // a real signature image (public/signature.png) is used when it exists, otherwise a handwritten-style name
  $("sigimg").firstChild.onerror = e => { e.target.replaceWith(Object.assign(document.createElement("span"), { className: "sigtxt", textContent: "Pruthvirajsingh" })); };
  $("print").onclick = () => window.print();
  $("copy").onclick = async () => { try { await navigator.clipboard.writeText(verifyUrl); $("copy").textContent = "Copied ✔"; } catch (e) { prompt("Copy this link:", verifyUrl); } };
  if (mine) {
    $("nmsave").onclick = async () => {
      try { const r = await send("PUT", "/api/learner/" + clientId, { name: $("nm").value }); $("who").textContent = r.name || "Your Name"; $("nmsave").textContent = "Saved ✔"; setTimeout(() => $("nmsave").textContent = "Save name", 2000); }
      catch (e) { $("nmsave").textContent = "Error"; }
    };
    if (!C.learner) $("nm").focus();
  }
}
load();

window.addEventListener("hashchange", () => location.reload());
