// Tiny QR code generator (byte mode, error correction level M, versions 1-10 = up to 213 characters). No libraries needed.
// qrMatrix(text) -> array of rows of booleans (true = dark).  qrSvg(text) -> SVG markup.
(function (root) {
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];      // error correction codewords per block, by version (level M)
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];             // number of blocks, by version (level M)
  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];

  function mul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function divisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); }
    return r;
  }
  function remainder(data, div) {
    const r = new Array(div.length).fill(0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
    return r;
  }

  function encodeData(bytes, v) {
    const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v >= 10 ? 16 : 8); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(v) * 8;
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const out = []; for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    return out;
  }

  function withEcc(data, v) {
    const nb = BLOCKS[v], el = ECC[v], raw = Math.floor(rawModules(v) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) out.push(b[i]); });
    return out;
  }

  function build(codewords, v, mask) {
    const size = v * 4 + 17, m = [], fn = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const n = v === 1 ? 0 : Math.floor(v / 7) + 2, step = n ? Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2 : 0, pos = n ? [6] : [];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    pos.forEach((px, i) => pos.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    // format bits (level M = 0) and version bits are drawn after the data so they are never overwritten
    const fmtData = (0 << 3) | mask; let rem = fmtData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((fmtData << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(fb, i));
    set(8, 7, bit(fb, 6)); set(8, 8, bit(fb, 7)); set(7, 8, bit(fb, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fb, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fb, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fb, i));
    set(8, size - 8, true);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const vb = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(vb, i)); set(b, a, bit(vb, i)); }
    }
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && k < codewords.length * 8) { m[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
    const inv = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0][mask];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && inv(x, y)) m[y][x] = !m[y][x];
    return m;
  }

  function penalty(m) {
    const size = m.length; let p = 0;
    const lines = []; for (let i = 0; i < size; i++) { lines.push(m[i].map(b => b ? "1" : "0").join("")); lines.push(m.map(r => r[i] ? "1" : "0").join("")); }
    lines.forEach(s => {
      (s.match(/0{5,}|1{5,}/g) || []).forEach(r => { p += r.length - 2; });
      p += 40 * ((s.match(/(?=10111010000|00001011101)/g) || []).length);
    });
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    const dark = m.reduce((a, r) => a + r.filter(Boolean).length, 0), pct = dark * 100 / (size * size);
    return p + Math.floor(Math.abs(pct - 50) / 5) * 10;
  }

  function qrMatrix(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let v = 1;
    while (v <= 10 && dataCodewords(v) * 8 < 4 + (v >= 10 ? 16 : 8) + bytes.length * 8) v++;
    if (v > 10) throw new Error("Text is too long for the QR code");
    const words = withEcc(encodeData(bytes, v), v);
    let best = null, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) { const m = build(words, v, mask), p = penalty(m); if (p < bestP) { best = m; bestP = p; } }
    return best;
  }

  function qrSvg(text, opts) {
    const m = qrMatrix(text), q = (opts && opts.quiet) ?? 2, n = m.length + q * 2;
    let d = ""; m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
  }
  root.qrMatrix = qrMatrix; root.qrSvg = qrSvg;
  if (typeof module !== "undefined") module.exports = { qrMatrix, qrSvg };
})(typeof window !== "undefined" ? window : globalThis);
