/* GST Cloud Bridge — v1.11.0 (new app v4: b2bSellers) / v1.10.0 (v1.9.6 + ZIP 2B, options/autoClose, keepOthers, shared Chromium, fail-par-error)
 * Base: v1.9.6
 * Fixes over v1.8.0:
 *  - E-Com TCS: columns ab table header se pehchane jate hain (pehle GSTIN ka "07" / serial no. gross ban jata tha)
 *  - Har section ka status (ok / empty / uncertain / failed) screen tak jata hai — fail hone par "Koi notice nahi" nahi dikhega
 *  - GSTR-2B: ITC sab groups (RCM, ISD, Import, other) ko jodkar; cess bhi; period mismatch warning
 *  - GSTR-1 upload: portal ka error/success text padha jata hai, period (fp) mismatch par upload nahi hota, file name safe
 *  - Security: API_SECRET ke bina server band (fail-closed), /debug bhi protected, CORS default sirf aapki site
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const VERSION = (() => { try { return require("./package.json").version; } catch (_) { return "1.9.6"; } })();

/* ======================= PURE HELPERS (browser ke bina testable) ======================= */

const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/i;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMonthName(mm) { return MONTH_NAMES[parseInt(mm, 10) - 1] || "October"; }
function getQuarterForMonth(mm) {
  const m = parseInt(mm, 10);
  if (m >= 4 && m <= 6) return "Quarter 1";
  if (m >= 7 && m <= 9) return "Quarter 2";
  if (m >= 10 && m <= 12) return "Quarter 3";
  return "Quarter 4";
}
// fy "2026-27", mm "10" -> "102026" ; mm "02" -> "022027"
function periodFor(fy, mm) {
  const start = parseInt(String(fy).slice(0, 4), 10);
  const m = parseInt(mm, 10);
  if (!start || !m) return "";
  return String(m).padStart(2, "0") + (m >= 4 ? start : start + 1);
}

// Strict amount: "1,25,000.00", "₹ 500", "(250.50)", "-10" -> number ; baaki sab NaN (GSTIN "07AAAC.." ab 7 nahi banega)
function parseAmt(v) {
  let s = String(v == null ? "" : v).replace(/[₹,\s]/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = parseFloat(s);
  return neg ? -n : n;
}
const amt0 = v => { const n = parseAmt(v); return isNaN(n) ? 0 : n; };

// thead (rowspan/colspan ke saath) -> har column ka label
function buildColumnLabels(head) {
  const labels = [];
  const occupied = [];
  (head || []).forEach((row, r) => {
    occupied[r] = occupied[r] || {};
    let c = 0;
    row.forEach(cell => {
      while (occupied[r][c]) c++;
      const cs = cell.cs || 1, rs = cell.rs || 1;
      for (let i = 0; i < cs; i++) {
        labels[c + i] = ((labels[c + i] || "") + " " + (cell.t || "")).trim();
        for (let j = 1; j < rs; j++) { occupied[r + j] = occupied[r + j] || {}; occupied[r + j][c + i] = true; }
      }
      c += cs;
    });
  });
  return labels.map(l => String(l || "").toLowerCase());
}

function mapTcsColumns(labels) {
  const find = (re, exclude) => labels.findIndex((l, i) => re.test(l) && !(exclude || []).includes(i));
  const gstin = find(/gstin|gstn|\buin\b/);
  const name = find(/name/, [gstin]);
  const gross = find(/gross/);
  const ret = find(/return(?!\s*period)/, [gross]);
  const net = find(/\bnet\b/, [gross, ret]);
  const igst = find(/integrated|igst/);
  const cgst = find(/central|cgst/);
  const sgst = find(/state|sgst|utgst/);
  const period = find(/period/, [gross, ret, net]);
  return { gstin, name, gross, ret, net, igst, cgst, sgst, period };
}

function looksLikePeriod(v) {
  const s = String(v).trim();
  return /^\d{6}$/.test(s) || /^\d{2}[-\/]\d{4}$/.test(s) || /^[A-Za-z]{3,9}[-\s,]*\d{2,4}$/.test(s);
}

// tables = [{head:[[{t,cs,rs}]], body:[[cell,...]]}]
function parseTcsTables(tables) {
  const rows = [];
  const warnings = [];
  const headersSeen = [];
  let mode = "none";

  for (const tbl of tables || []) {
    const body = (tbl.body || []).filter(r => r.some(v => GSTIN_RE.test(String(v).trim())));
    if (!body.length) continue;
    const labels = buildColumnLabels(tbl.head);
    headersSeen.push(labels);
    const m = mapTcsColumns(labels);
    const headerOk = m.gstin >= 0 && m.gross >= 0 && body.every(r => r.length === labels.length);

    if (headerOk) {
      mode = mode === "fallback" ? "fallback" : "header";
      for (const r of body) {
        const gstin = String(r[m.gstin] || "").trim();
        if (!GSTIN_RE.test(gstin)) continue;
        const gross = amt0(r[m.gross]);
        const returned = m.ret >= 0 ? amt0(r[m.ret]) : 0;
        const net = m.net >= 0 ? amt0(r[m.net]) : (m.ret >= 0 ? gross - returned : gross);
        rows.push({
          ecoGstin: gstin.toUpperCase(),
          ecoName: (m.name >= 0 && String(r[m.name] || "").trim()) || "E-Commerce Operator",
          taxPeriod: m.period >= 0 ? String(r[m.period] || "").trim() : "",
          grossTaxableAmount: gross, returnedValue: returned, netValueSupplies: net,
          tcsIgst: m.igst >= 0 ? amt0(r[m.igst]) : 0,
          tcsCgst: m.cgst >= 0 ? amt0(r[m.cgst]) : 0,
          tcsSgst: m.sgst >= 0 ? amt0(r[m.sgst]) : 0,
          rawCells: r
        });
      }
    } else {
      mode = "fallback";
      warnings.push("TCS table ke column header pehchane nahi gaye — anuman se padha gaya. Screen ke numbers portal se zaroor match karein.");
      for (const r of body) {
        const gi = r.findIndex(v => GSTIN_RE.test(String(v).trim()));
        const gstin = String(r[gi]).trim();
        const name = r.find((v, i) => i !== gi && isNaN(parseAmt(v)) && !looksLikePeriod(v) && String(v).trim().length > 2) || "E-Commerce Operator";
        const a = r.slice(gi + 1)
          .filter(v => !/^\d{6}$/.test(String(v).trim()) && !looksLikePeriod(v))
          .map(parseAmt).filter(n => !isNaN(n));
        let gross = a[0] || 0, returned = 0, net, igst, cgst, sgst;
        if (a.length >= 6) { returned = a[1]; net = a[2]; igst = a[3]; cgst = a[4]; sgst = a[5]; }
        else { net = a.length > 1 ? a[1] : gross; igst = a[2] || 0; cgst = a[3] || 0; sgst = a[4] || 0; }
        rows.push({ ecoGstin: gstin.toUpperCase(), ecoName: name, grossTaxableAmount: gross, returnedValue: returned,
          netValueSupplies: net, tcsIgst: igst || 0, tcsCgst: cgst || 0, tcsSgst: sgst || 0, rawCells: r, lowConfidence: true });
      }
    }
  }
  const sum = f => rows.reduce((s, r) => s + (f(r) || 0), 0);
  return {
    rows, mode, warnings, headersSeen,
    totals: {
      totalGrossTaxable: sum(r => r.grossTaxableAmount),
      totalReturned: sum(r => r.returnedValue),
      totalNetValue: sum(r => r.netValueSupplies),
      totalTcs: sum(r => r.tcsIgst + r.tcsCgst + r.tcsSgst)
    }
  };
}

// "TDS and TCS credit received" cards page se: TCS Credit received ke "Total Number of Records : N"
function parseTcsRecordCount(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  const m = /TCS\s+Credit\s+received.{0,160}?Total\s+Number\s+of\s+Records\s*:?\s*(\d+)/i.exec(t);
  return m ? parseInt(m[1], 10) : null;
}

function parseNoticeTables(tables) {
  const out = [];
  const DATE_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/;
  for (const tbl of tables || []) {
    const labels = buildColumnLabels(tbl.head);
    for (const tds of tbl.body || []) {
      if (tds.length >= 4 && !tds.join(" ").toLowerCase().includes("no records")) {
        // Portal ka dekha hua layout: Ref No | Type | Description | Date | Due/Response | View
        const portalLayout = tds.length >= 5 && DATE_RE.test(String(tds[3]).trim());
        out.push(portalLayout ? {
          refNo: tds[0] || "", type: tds[1] || "", description: tds[2] || "", issuedBy: "",
          issueDate: tds[3] || "", dueDate: /^view$/i.test(String(tds[4]).trim()) ? "" : (tds[4] || ""), amount: "",
          rawCells: tds, headers: labels
        } : {
          refNo: tds[0] || "", issuedBy: tds[1] || "", type: tds[2] || "", description: tds[3] || "",
          issueDate: tds[4] || "", dueDate: tds[5] || "", amount: tds[6] || "",
          rawCells: tds, headers: labels
        });
      }
    }
  }
  return out;
}

// GSTR-2B JSON summary: itcavl / itcunavl ke SAB groups (nonrevsup, revsup, isdsup, imsup, othersup...) jodta hai
function summarizeGstr2B(parsed) {
  const TAX = ["igst", "cgst", "sgst", "cess"];
  const d = parsed && parsed.data ? parsed.data : (parsed || {});
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const hasTax = o => o && typeof o === "object" && TAX.some(k => o[k] !== undefined && o[k] !== null && o[k] !== "" && isFinite(Number(o[k])));
  const sumGroup = grp => {
    const total = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
    const parts = {};
    if (!grp || typeof grp !== "object") return { total, parts };
    const kids = Object.entries(grp).filter(([, v]) => hasTax(v));
    if (kids.length) {
      kids.forEach(([k, v]) => { parts[k] = {}; TAX.forEach(t => { parts[k][t] = num(v[t]); total[t] += num(v[t]); }); });
    } else if (hasTax(grp)) {
      TAX.forEach(t => { total[t] += num(grp[t]); });
    }
    return { total, parts };
  };
  const itc = d.itcsumm || {};
  const avl = sumGroup(itc.itcavl);
  const unavl = sumGroup(itc.itcunavl);
  const warnings = [];
  if (!d.itcsumm) warnings.push("GSTR-2B JSON me itcsumm nahi mila — file ka structure alag hai, summary adhoori ho sakti hai.");
  const docdata = d.docdata || {};
  return {
    igst: avl.total.igst, cgst: avl.total.cgst, sgst: avl.total.sgst, cess: avl.total.cess,
    availableBreakup: avl.parts,
    ineligibleTotal: unavl.total.igst + unavl.total.cgst + unavl.total.sgst + unavl.total.cess,
    ineligible: unavl.total,
    b2bSuppliersCount: Array.isArray(docdata.b2b) ? docdata.b2b.length : 0,
    cdnrCount: Array.isArray(docdata.cdnr) ? docdata.cdnr.length : 0,
    gstin: d.gstin || "", rtnprd: d.rtnprd || "",
    warnings
  };
}

function safeFileName(name, fallback) {
  const base = path.basename(String(name || "")).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return base && base !== "." && base !== ".." ? base : fallback;
}

function timingSafeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

const ERR_TEXT_RE = /error|invalid|fail|reject|incorrect|unable|not\s+(allowed|valid|uploaded)|mismatch/i;
const OK_TEXT_RE = /success|uploaded|processed|generated|saved|complet/i;

/* ---- GSTR-2B download kabhi plain JSON, kabhi ZIP (PK...) aata hai: dono padhta hai ---- */
const zlib = require("zlib");
function readJsonFilesFromBuffer(buf) {
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) return { isZip: false, files: [{ name: "gstr2b.json", text: buf.toString("utf8").replace(/^\uFEFF/, "") }] };
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP file kharab hai (end record nahi mila)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commLen;
    if (!/\.json$/i.test(name)) continue;
    const lNameLen = buf.readUInt16LE(localOff + 26), lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + compSize);
    const data = method === 0 ? raw : zlib.inflateRawSync(raw);
    files.push({ name, text: data.toString("utf8").replace(/^\uFEFF/, "") });
  }
  if (!files.length) throw new Error("ZIP ke andar koi JSON file nahi mili");
  return { isZip: true, files };
}

/* ---- GSTR-2B B2B sellers list (naya app ka "B2B Sellers" modal isi se banta hai) ---- */
function buildB2bSellers(parsedList) {
  const map = new Map();
  for (const parsed of parsedList) {
    const b2b = Array.isArray(parsed?.data?.docdata?.b2b) ? parsed.data.docdata.b2b : [];
    for (const sup of b2b) {
      const invs = Array.isArray(sup.inv) ? sup.inv : [];
      let taxable = 0, igst = 0, cgst = 0, sgst = 0;
      for (const inv of invs) {
        const items = Array.isArray(inv.items) ? inv.items : [];
        if (items.length) {
          for (const it of items) {
            taxable += Number(it.txval || 0); igst += Number(it.igst || 0); cgst += Number(it.cgst || 0); sgst += Number(it.sgst || 0);
          }
        } else {
          taxable += Number(inv.txval || 0); igst += Number(inv.igst || 0); cgst += Number(inv.cgst || 0); sgst += Number(inv.sgst || 0);
        }
      }
      const gstin = String(sup.ctin || "").trim().toUpperCase();
      const key = gstin || String(sup.trdnm || "Supplier");
      const cur = map.get(key) || { name: String(sup.trdnm || sup.ctin || "Supplier").trim(), gstin, invCount: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      cur.invCount += invs.length; cur.taxable += taxable; cur.igst += igst; cur.cgst += cgst; cur.sgst += sgst;
      map.set(key, cur);
    }
  }
  return Array.from(map.values()).map(x => ({
    name: x.name, gstin: x.gstin, invCount: x.invCount,
    taxable: Math.round(x.taxable), igst: Math.round(x.igst), cgst: Math.round(x.cgst), sgst: Math.round(x.sgst)
  }));
}

/* ======================= SERVER ======================= */

function startServer() {
  const express = require("express");
  const cors = require("cors");
  const { chromium } = require("playwright");

  const app = express();
  const PORT = process.env.PORT || 3000;
  const API_SECRET = (process.env.API_SECRET || "").trim();
  const ALLOW_NO_SECRET = process.env.ALLOW_NO_SECRET === "1";
  const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || "https://adwikjais-code.github.io").trim();

  if (!API_SECRET && !ALLOW_NO_SECRET) {
    console.warn("⚠️  API_SECRET set nahi hai — health ke alawa saare endpoints band rahenge. Render > Environment me API_SECRET daalein.");
  }

  const allowedList = ALLOWED_ORIGIN.split(",").map(x => x.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGIN === "*") return cb(null, true);
      if (allowedList.includes(origin) || /^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-secret"]
  }));
  app.use(express.json({ limit: "25mb" }));

  // /health sirf "server zinda hai" batata hai (koi private data nahi). Baaki sab protected.
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    if (!API_SECRET) {
      if (ALLOW_NO_SECRET) return next();
      return res.status(503).json({ ok: false, error: "Server par API_SECRET set nahi hai. Render > Environment me API_SECRET daalein, wahi secret app ki Cloud Server Settings me bhi daalein." });
    }
    if (!timingSafeEq(String(req.headers["x-api-secret"] || "").trim(), API_SECRET)) {
      return res.status(401).json({ ok: false, error: "Unauthorized: x-api-secret galat hai." });
    }
    next();
  });

  const sessions = new Map();
  // Ek hi shared Chromium (RAM bachane ke liye); har login ka alag context
  let sharedBrowser = null;
  async function ensureBrowser() {
    if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions",
        "--disable-background-networking", "--no-zygote", "--disable-blink-features=AutomationControlled"]
    });
    sharedBrowser.on("disconnected", () => { lastDebug = { message: "Chromium band/crash hua (aksar RAM kam padne se)", at: new Date().toISOString() }; sharedBrowser = null; });
    return sharedBrowser;
  }
  // Ek time par sirf ek fetch chalta hai (baaki line me wait karte hain) — RAM safe
  let fetchLockP = Promise.resolve();
  function acquireFetchSlot() {
    let release;
    const next = new Promise(r => { release = r; });
    const prev = fetchLockP;
    fetchLockP = prev.then(() => next);
    return prev.then(() => release);
  }
  const SESSION_TTL_MS = 20 * 60 * 1000;
  let lastDebug = { message: "No fetch run yet." };

  async function closeSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;
    sessions.delete(sessionId);
    try { await s.context.close(); } catch (_) {}
  }
  setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions.entries()) if (now - s.lastActive > SESSION_TTL_MS && !s.busy) closeSession(id);
  }, 60 * 1000);

  function getSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return null;
    s.lastActive = Date.now();
    return s;
  }

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "gst-cloud-bridge", version: VERSION, secretConfigured: !!API_SECRET, activeSessions: sessions.size, timestamp: new Date().toISOString() });
  });
  // Save & Test ke liye: secret sahi hai ya nahi, ye wahi batata hai
  app.get("/api/gst/ping", (req, res) => res.json({ ok: true, version: VERSION }));
  app.get("/debug", (req, res) => res.type("text/plain").send(JSON.stringify(lastDebug, null, 2)));

  app.post("/api/gst/init-login", async (req, res) => {
    let browser, context;
    try {
      const keepOthers = !!req.body?.keepOthers;
      if (!keepOthers) {
        // Chalta hua (busy) session kabhi band nahi karte
        for (const [oldId, os_] of Array.from(sessions.entries())) if (!os_.busy) await closeSession(oldId);
      } else {
        // Zyada se zyada 2 idle bina-login captcha sessions rakho (RAM safe)
        const unlogged = Array.from(sessions.entries()).filter(([, x]) => !x.loggedIn && !x.busy);
        while (unlogged.length >= 2) { const [oldId] = unlogged.shift(); await closeSession(oldId); }
      }
      browser = await ensureBrowser();
      context = await browser.newContext({
        viewport: { width: 1366, height: 860 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        acceptDownloads: true
      });
      await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
      const page = await context.newPage();
      page.setDefaultTimeout(35000);

      await page.goto("https://services.gst.gov.in/services/login", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#username", { timeout: 30000 });
      await page.click("#username");
      await page.locator("#username").pressSequentially(String(req.body?.username || "gstuser"), { delay: 60 });
      await page.click("#user_pass");
      await page.waitForTimeout(800);

      const captchaSelector = "#imgCaptcha, img[src*='captcha' i], img[id*='captcha' i]";
      await page.waitForSelector(captchaSelector, { state: "visible", timeout: 25000 });
      await page.waitForFunction((sel) => {
        const img = document.querySelector(sel);
        return img && img.complete && img.naturalWidth > 0;
      }, captchaSelector, { timeout: 20000 }).catch(() => {});

      const captchaEl = await page.$(captchaSelector);
      if (!captchaEl) throw new Error("GST Portal CAPTCHA image load nahi ho payi.");
      const captchaBuffer = await captchaEl.screenshot({ type: "png" });
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { browser, context, page, loggedIn: false, busy: false, lastActive: Date.now() });
      res.json({ ok: true, sessionId, captchaBase64: "data:image/png;base64," + captchaBuffer.toString("base64") });
    } catch (err) {
      try { if (context) await context.close(); } catch (_) {}
      res.status(500).json({ ok: false, error: err.message || "Init login failed" });
    }
  });

  app.post("/api/gst/submit-login", async (req, res) => {
    const { sessionId, username, password, captcha } = req.body || {};
    const s = getSession(sessionId);
    if (!s) return res.status(404).json({ ok: false, error: "Session expired. Dobara Connect karein." });
    if (s.loggedIn) return res.json({ ok: true, status: "logged_in", url: s.page.url() });
    if (s.busy) return res.status(429).json({ ok: false, error: "Login already in progress, thoda wait karein." });

    s.busy = true;
    const { page } = s;
    try {
      await page.fill("#username", String(username || "").trim());
      await page.fill("#user_pass", String(password || ""));
      await page.fill("#captcha", String(captcha || "").trim());
      await Promise.all([
        page.click("button[type='submit'], button:has-text('LOGIN')"),
        page.waitForTimeout(5000)
      ]);

      const otpInput = await page.$("input[name='otp'], #otp, input[placeholder*='OTP' i]");
      if (otpInput && await otpInput.isVisible()) {
        return res.json({ ok: true, status: "otp_required", message: "GST Portal ne OTP manga hai." });
      }
      const url = page.url();
      if (url.includes("/auth/") || url.includes("fowelcome") || url.includes("dashboard")) {
        s.loggedIn = true;
        return res.json({ ok: true, status: "logged_in", url });
      }
      const errMsg = await page.evaluate(() => {
        const el = document.querySelector(".err, .alert-danger, .text-danger, [ng-if*='err']");
        return el ? el.innerText.trim() : "";
      });
      let newCaptcha = null;
      const capEl = await page.$("#imgCaptcha, img[src*='captcha' i]");
      if (capEl) newCaptcha = "data:image/png;base64," + (await capEl.screenshot({ type: "png" })).toString("base64");
      return res.status(400).json({ ok: false, error: errMsg || "Login fail hua.", captchaBase64: newCaptcha });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      s.busy = false;
    }
  });

  app.post("/api/gst/submit-otp", async (req, res) => {
    const { sessionId, otp } = req.body || {};
    const s = getSession(sessionId);
    if (!s) return res.status(404).json({ ok: false, error: "Session expired." });
    const { page } = s;
    try {
      const otpInput = await page.$("input[name='otp'], #otp, input[placeholder*='OTP' i]");
      if (!otpInput) return res.status(400).json({ ok: false, error: "OTP input box nahi mila." });
      await otpInput.fill(String(otp || "").trim());
      await page.click("button:has-text('VALIDATE'), button:has-text('SUBMIT'), button[type='submit']");
      await page.waitForTimeout(4500);
      const url = page.url();
      if (url.includes("/auth/") || url.includes("fowelcome") || url.includes("dashboard")) {
        s.loggedIn = true;
        return res.json({ ok: true, status: "logged_in", url });
      }
      return res.status(400).json({ ok: false, error: "OTP invalid ya verify nahi ho paya." });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  async function dismissModals(page) {
    for (const sel of ["button:has-text('Remind me later')", "button:has-text('CLOSE')", "button:has-text('OK')", ".modal .close"]) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    }
  }

  async function selectDropdownByText(page, targetText) {
    return await page.evaluate((txt) => {
      const lower = txt.toLowerCase();
      const selects = Array.from(document.querySelectorAll("select"));
      for (const sel of selects) {
        const opt = Array.from(sel.options).find(o => (o.text || "").toLowerCase().includes(lower));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return { matched: true, name: sel.name || sel.id || "", option: opt.text.trim() };
        }
      }
      return { matched: false };
    }, targetText);
  }

  // Page ki visible tables + visible text (plain data) — parsing Node me hoti hai
  async function snapshotPage(page) {
    return await page.evaluate(() => {
      const clean = t => String(t || "").replace(/\s+/g, " ").trim();
      const tables = Array.from(document.querySelectorAll("table")).filter(t => t.offsetParent !== null).map(tbl => ({
        head: Array.from(tbl.querySelectorAll("thead tr")).map(tr =>
          Array.from(tr.children).filter(c => /^(TH|TD)$/.test(c.tagName)).map(c => ({ t: clean(c.innerText), cs: c.colSpan || 1, rs: c.rowSpan || 1 }))),
        body: Array.from(tbl.querySelectorAll("tbody tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => clean(td.innerText)))
      }));
      const vis = el => el.offsetParent !== null;
      const buttons = Array.from(document.querySelectorAll("button, a.btn, a[role='button'], input[type='button']")).filter(vis).map(b => clean(b.innerText || b.value)).filter(Boolean).slice(0, 40);
      return { tables, buttons, bodyText: String(document.body.innerText || "").slice(0, 20000), url: location.href };
    });
  }

  // Debug ke liye: page par har visible button/link aur uske card ka heading text
  async function dumpTiles(page) {
    return await page.evaluate(() => {
      const clean = t => String(t || "").replace(/\s+/g, " ").trim();
      const vis = el => el.offsetParent !== null;
      const out = [];
      document.querySelectorAll("button, a.btn, a[role='button']").forEach(b => {
        if (!vis(b)) return;
        const label = clean(b.innerText);
        if (!label || label.length > 40) return;
        let el = b.parentElement, card = "";
        for (let i = 0; i < 7 && el; i++, el = el.parentElement) {
          const t = clean(el.innerText);
          if (t.length > label.length + 8 && t.length < 400) { card = t.slice(0, 140); break; }
        }
        out.push({ button: label, card });
      });
      return out.slice(0, 40);
    });
  }

  // Card (tile) dhundh kar uska visible button dabata hai; "View e-Filed Returns" jaise page-level links ko chhodta hai
  async function clickCardButton(page, reSource) {
    return await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const vis = el => el.offsetParent !== null;
      const hits = Array.from(document.querySelectorAll("div,section,h1,h2,h3,h4,h5,span,p,li"))
        .filter(e => vis(e) && re.test(e.innerText || "") && (e.innerText || "").length < 600)
        .sort((a, b) => a.innerText.length - b.innerText.length);
      for (const h of hits) {
        let el = h;
        for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
          const t = el.innerText || "";
          if (t.length > 600) break;
          const btn = Array.from(el.querySelectorAll("button, a")).find(b => vis(b)
            && /prepare online|view|download|open/i.test(b.innerText || "")
            && !/efiledReturns/i.test(b.getAttribute("href") || ""));
          if (btn) { const label = (btn.innerText || "").trim(); btn.click(); return { label, card: t.replace(/\s+/g, " ").slice(0, 140) }; }
        }
      }
      return null;
    }, reSource);
  }
  const shortErr = e => String((e && e.message) || e).split("\n")[0].slice(0, 200);

  async function openReturnsDashboardAndSearch(page, fy, monthNum, dbg, tag) {
    await dismissModals(page);
    if (!page.url().includes("/returns/auth/dashboard")) {
      const retBtn = page.locator("button:has-text('RETURN DASHBOARD'), a:has-text('RETURN DASHBOARD'), span:has-text('RETURN DASHBOARD')").first();
      if (await retBtn.isVisible().catch(() => false)) {
        await retBtn.click({ force: true });
        await page.waitForTimeout(4500);
      } else {
        await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          const retLink = links.find(a => /returns dashboard/i.test(a.textContent || "") || (a.getAttribute("href") || "").includes("/returns/auth/dashboard"));
          if (retLink) retLink.click();
        });
        await page.waitForTimeout(4500);
        if (!page.url().includes("/returns/auth/dashboard")) {
          await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForTimeout(3500);
        }
      }
    }
    await dismissModals(page);
    if (dbg) dbg.steps[(tag || "ret") + "_urlBeforeSelect"] = page.url();
    await page.waitForSelector("select", { timeout: 25000 });

    const fyRes = await selectDropdownByText(page, fy);
    await page.waitForTimeout(1000);
    const qRes = await selectDropdownByText(page, getQuarterForMonth(monthNum));
    await page.waitForTimeout(1000);
    const mRes = await selectDropdownByText(page, getMonthName(monthNum));
    await page.waitForTimeout(800);

    // Agar FY / Quarter / Month me se koi dropdown match nahi hua to galat period ka data na uthe
    if (!fyRes.matched || !qRes.matched || !mRes.matched) {
      throw new Error(`Portal par period select nahi ho paya (FY:${fyRes.matched}, Quarter:${qRes.matched}, Month:${mRes.matched}).`);
    }
    const searchBtn = page.locator("button:has-text('SEARCH'), button[type='submit']").first();
    if (await searchBtn.count()) {
      await searchBtn.click({ force: true });
      await page.waitForTimeout(4000);
    }
    if (dbg) dbg.steps[(tag || "ret") + "_dashboard"] = { url: page.url(), fyRes, qRes, mRes };
  }

  app.post("/api/gst/fetch-all", async (req, res) => {
    const { sessionId, fy, month, autoClose, options } = req.body || {};
    const opts = { gstr2b: options?.gstr2b !== false, tcs: options?.tcs !== false, notices: !!options?.notices };
    const s = getSession(sessionId);
    if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
    if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

    s.busy = true;
    const { page } = s;
    const dbg = { timestamp: new Date().toISOString(), version: VERSION, fy: fy || "2026-27", month: String(month || "10").padStart(2, "0"), steps: {} };
    const result = {
      ok: true, fy: dbg.fy, month: dbg.month, period: periodFor(dbg.fy, dbg.month),
      notices: [], gstr2b: { summary: null, jsonBase64: null, fileName: null },
      ecommerceTcs: { rows: [], totalGrossTaxable: 0, totalReturned: 0, totalNetValue: 0, totalTcs: 0, mode: "none" },
      // har section ka sach: ok | empty | uncertain | failed  (screen is par chalti hai)
      status: {
        tcs: { state: "failed", message: "Ye step chala hi nahi." },
        gstr2b: { state: "failed", message: "Ye step chala hi nahi." },
        notices: { state: "failed", message: "Ye step chala hi nahi." }
      },
      warnings: []
    };
    const setStatus = (key, state, message) => {
      result.status[key] = { state, message: message || "" };
      if (state === "failed" || state === "uncertain") result.warnings.push(`[${key}] ${message}`);
    };

    const release = await acquireFetchSlot();
    try {
      // --- STEP 1: GSTR-2B ---
      if (!opts.gstr2b) { result.status.gstr2b = { state: "skipped", message: "Option off tha." }; } else try {
        await openReturnsDashboardAndSearch(page, result.fy, result.month, dbg, "gstr2b");
        const gstr2bCard = page.locator("div").filter({ hasText: /GSTR-?2B/i }).filter({ has: page.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')") }).last();
        const downloadBtn = gstr2bCard.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')").first();
        dbg.steps.gstr2bCardFound = await downloadBtn.count();

        if (!(await downloadBtn.count())) {
          setStatus("gstr2b", "failed", "GSTR-2B card ya Download button nahi mila (2B abhi generate na hui ho to bhi aisa hota hai).");
        } else {
          await downloadBtn.click({ force: true });
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(4500);
          dbg.steps.gstr2bPageUrl = page.url();
          dbg.steps.gstr2bButtons = await page.evaluate(() =>
            Array.from(document.querySelectorAll("button, a.btn, input[type='button']")).map(b => (b.innerText || b.value || "").trim()).filter(Boolean).slice(0, 15));

          const genJsonBtn = page.locator("button:has-text('GENERATE JSON'), a:has-text('GENERATE JSON'), button:has-text('JSON')").first();
          if (!(await genJsonBtn.count())) {
            setStatus("gstr2b", "failed", "GSTR-2B GENERATE JSON button nahi mila.");
          } else {
            // Portal JSON file async banata hai: click ke baad 90 second tak har 3 second par check karte hain
            // (download event ya "Click here to download / File 1" link)
            const downloads = [];
            const onDl = d => downloads.push(d);
            page.on("download", onDl);
            let download = null, polls = 0, linkClicked = 0;
            try {
              await genJsonBtn.click({ force: true });
              const started = Date.now();
              while (Date.now() - started < 90000) {
                await page.waitForTimeout(3000);
                polls++;
                if (downloads.length) { download = downloads[0]; break; }
                await dismissModals(page);
                if (!linkClicked) {
                  const link = page.locator("a:has-text('Click here to download'), a:has-text('File 1')").first();
                  if (await link.count()) { linkClicked++; await link.click({ force: true, timeout: 8000 }).catch(() => {}); }
                }
              }
            } finally {
              page.off("download", onDl);
            }
            const after = await snapshotPage(page);
            const multiFile = (await page.locator("a:has-text('File 2')").count().catch(() => 0)) > 0;
            dbg.steps.gstr2bAfterGenerate = { polls, linkClicked, gotDownload: !!download, multiFile, url: after.url, buttons: after.buttons, bodyExcerpt: after.bodyText.slice(0, 1500) };
            const portalMsg = after.bodyText.split("\n").map(x => x.trim())
              .filter(x => x.length > 8 && x.length < 260 && /generat|process|wait|not\s+(available|generated)|no\s+(data|record)|try again|download/i.test(x) && !/^GENERATE (JSON|EXCEL)/i.test(x))
              .slice(0, 3).join(" | ");
            if (!download) {
              setStatus("gstr2b", "failed", "GSTR-2B JSON 90 second me download nahi hui." + (portalMsg ? " Portal ka message: " + portalMsg : "") + " Portal par check karein ki is client ki 2B is month ke liye generate hui hai ya nahi.");
            } else {
              const rawBuf = fs.readFileSync(await download.path());
              const pack = readJsonFilesFromBuffer(rawBuf);
              const parsedList = pack.files.map(f => JSON.parse(f.text));
              const parsed = parsedList.find(x => x && x.data && x.data.itcsumm) || parsedList[0];
              const sugg = download.suggestedFilename() || `GSTR2B_${result.month}${result.fy.slice(0, 4)}`;
              if (pack.isZip && pack.files.length > 1) {
                result.gstr2b.fileName = /\.zip$/i.test(sugg) ? sugg : sugg.replace(/\.json$/i, "") + ".zip";
                result.gstr2b.jsonBase64 = "data:application/zip;base64," + rawBuf.toString("base64");
              } else {
                result.gstr2b.fileName = /\.json$/i.test(sugg) ? sugg : (pack.isZip ? safeFileName(pack.files[0].name, sugg + ".json") : sugg + ".json");
                result.gstr2b.jsonBase64 = "data:application/json;base64," + Buffer.from(pack.files[0].text, "utf8").toString("base64");
              }
              const sm = summarizeGstr2B(parsed);
              const countOf = key => parsedList.reduce((acc, x) => acc + (Array.isArray(x?.data?.docdata?.[key]) ? x.data.docdata[key].length : 0), 0);
              sm.b2bSuppliersCount = countOf("b2b");
              sm.cdnrCount = countOf("cdnr");
              result.gstr2b.summary = sm;
              result.gstr2b.b2bSellers = buildB2bSellers(parsedList);
              if (result.gstr2b.b2bSellers.length) sm.b2bSuppliersCount = result.gstr2b.b2bSellers.length;
              dbg.steps.gstr2bFiles = { isZip: pack.isZip, files: pack.files.map(f => f.name) };
              dbg.steps.gstr2bItcKeys = { avl: Object.keys(parsed?.data?.itcsumm?.itcavl || {}), unavl: Object.keys(parsed?.data?.itcsumm?.itcunavl || {}) };
              const problems = sm.warnings.slice();
              if (multiFile && !(pack.isZip && pack.files.length > 1)) problems.push("2B ki ek se zyada file hain — sirf File 1 ka summary li gayi hai, totals adhoore ho sakte hain.");
              if (sm.rtnprd && sm.rtnprd !== result.period) problems.push(`Download hui 2B ka period ${sm.rtnprd} hai, jabki maanga gaya ${result.period}.`);
              if (problems.length) setStatus("gstr2b", "uncertain", problems.join(" "));
              else setStatus("gstr2b", "ok", "GSTR-2B mil gayi.");
            }
          }
        }
      } catch (err) {
        setStatus("gstr2b", "failed", "GSTR-2B fetch issue: " + shortErr(err));
        dbg.steps.gstr2bError = err.message;
      }

      // --- STEP 2: E-COMMERCE TCS  (Services > Returns > TDS and TCS credit received > PREPARE ONLINE > TCS Credit received) ---
      // Sirf padhta hai — portal par ACCEPT / REJECT kabhi nahi dabata.
      // Agar 2B band hai to bhi E-Com se pehle Returns Dashboard kholna padta hai
      if (!opts.gstr2b && opts.tcs) {
        try { await openReturnsDashboardAndSearch(page, result.fy, result.month, dbg, "tcs"); } catch (e) { dbg.steps.tcsDashboardError = e.message; }
      }
      if (!opts.tcs) { result.status.tcs = { state: "skipped", message: "Option off tha." }; } else try {
        const flow = dbg.steps.tcsFlow = [];
        const mark = (name, extra) => flow.push(Object.assign({ step: name, url: page.url() }, extra || {}));
        const clickTcsMenu = () => page.evaluate(() => {
          const a = Array.from(document.querySelectorAll("a")).find(x => /^\s*TDS\s+and\s+TCS\s+credit\s+received\s*$/i.test(x.textContent || ""));
          if (!a) return null;
          const href = a.getAttribute("href") || "";
          a.click();
          return { href };
        });
        await dismissModals(page);
        let menu = await clickTcsMenu();
        if (!menu) {
          await page.goto("https://return.gst.gov.in/returns/auth/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForTimeout(3500);
          await dismissModals(page);
          menu = await clickTcsMenu();
        }
        mark("menuClick", { menu });
        if (!menu) throw new Error("Menu me 'TDS and TCS credit received' link nahi mila.");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForSelector("select", { timeout: 20000 });
        await page.waitForTimeout(1500);

        const fyRes = await selectDropdownByText(page, result.fy);
        await page.waitForTimeout(800);
        const mRes = await selectDropdownByText(page, getMonthName(result.month));
        mark("period", { fyRes, mRes });
        if (!fyRes.matched || !mRes.matched) throw new Error(`TCS page par FY/Month select nahi ho paya (FY:${fyRes.matched}, Month:${mRes.matched}).`);
        await page.locator("button:has-text('SEARCH'):visible").first().click({ timeout: 10000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3500);

        let prep = page.locator("button:has-text('PREPARE ONLINE'):visible, a:has-text('PREPARE ONLINE'):visible").first();
        if (!(await prep.count())) {
          const pg = await snapshotPage(page);
          mark("noPrepareOnline", { buttons: pg.buttons });
          dbg.steps.tcsPageExcerpt = pg.bodyText.slice(0, 1500);
          // Form pehle se file ho chuka ho to PREPARE ONLINE ki jagah VIEW jaisa button aa sakta hai (PREVIEW nahi)
          prep = page.locator("button:visible, a.btn:visible").filter({ hasText: /^\s*VIEW\b/i }).first();
          if (!(await prep.count())) throw new Error("'TDS and TCS credit received' page par PREPARE ONLINE (ya VIEW) button nahi mila. Debug me tcsPageExcerpt dekhein.");
          mark("usingViewButton");
        }
        await prep.click({ timeout: 10000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(4500);

        let snap = await snapshotPage(page);
        mark("cardsPage", { buttons: snap.buttons });
        dbg.steps.tcsCardsExcerpt = snap.bodyText.slice(0, 1500);
        const cnt = parseTcsRecordCount(snap.bodyText);
        dbg.steps.tcsRecordCount = cnt;

        {
          // NOTE: tile ka "Total Number of Records" bharosemand nahi (screenshot me tile par 0 tha, summary me 1 record) —
          // isliye 0 dikhne par bhi summary kholkar table padhte hain; "empty" tabhi jab summary khuli aur khali mili.
          // "TCS Credit received" card kholna (heading -> poora card -> record count, teen tarah se koshish)
          const clickCard = (mode) => page.evaluate((mode) => {
            const vis = el => el.offsetParent !== null;
            const norm = t => String(t || "").replace(/\s+/g, " ").trim();
            const cands = Array.from(document.querySelectorAll("div,span,p,h1,h2,h3,h4,h5,h6,a,button,li"))
              .filter(e => vis(e) && /^TCS credit received$/i.test(norm(e.innerText)));
            for (const c of cands) {
              let el = c;
              for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
                const t = norm(el.innerText);
                if (t.length > 500) break;
                if (/number of records/i.test(t) && !/amendments/i.test(t)) {
                  let target = c;
                  if (mode === "root") target = el;
                  if (mode === "count") target = Array.from(el.querySelectorAll("*")).find(x => /total number of records/i.test(norm(x.innerText)) && x.children.length === 0) || el;
                  target.click();
                  return { mode, tag: target.tagName, text: norm(target.innerText).slice(0, 60) };
                }
              }
            }
            return null;
          }, mode);
          const isSummary = s2 => /TCS\s+Credit\s+Received\s*-\s*Summary/i.test(s2.bodyText) || s2.tables.some(t => (t.body || []).some(r => r.some(v => GSTIN_RE.test(String(v).trim()))));
          const attempts = [];
          for (const mode of ["heading", "root", "count"]) {
            const c = await clickCard(mode);
            attempts.push(c);
            if (!c) continue;
            await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(4000);
            snap = await snapshotPage(page);
            if (isSummary(snap)) break;
          }
          dbg.steps.tcsCardClickAttempts = attempts;
          mark("summaryPage", { buttons: snap.buttons });
          dbg.steps.tcsBodyExcerpt = snap.bodyText.slice(0, 1500);

          const parsed = parseTcsTables(snap.tables);
          dbg.steps.tcsParseMode = parsed.mode;
          dbg.steps.tcsHeaders = parsed.headersSeen;
          dbg.steps.tcsTableCount = snap.tables.length;
          result.ecommerceTcs = Object.assign({ rows: parsed.rows, mode: parsed.mode }, parsed.totals);
          parsed.warnings.forEach(w => result.warnings.push("[tcs] " + w));

          if (parsed.rows.length) {
            if (parsed.mode !== "header") setStatus("tcs", "uncertain", "Column header pehchane nahi gaye — numbers portal se zaroor match karein.");
            else if (cnt === 0) setStatus("tcs", "ok", `${parsed.rows.length} ECO row mili (tile par count 0 dikh raha tha, par summary table me data hai).`);
            else if (cnt !== null && cnt !== parsed.rows.length) setStatus("tcs", "uncertain", `Portal ne ${cnt} record bataye par ${parsed.rows.length} row padhi gayi (page 2 ho sakta hai) — portal se match karein.`);
            else setStatus("tcs", "ok", `${parsed.rows.length} ECO row mili.`);
          } else if (isSummary(snap)) {
            setStatus("tcs", "empty", "TCS Credit Received summary khuli, par usme is month ka koi record nahi hai.");
          } else {
            setStatus("tcs", "failed", cnt ? `Portal ne ${cnt} TCS record bataye par table padh nahi payi. Debug dekhein.` : "TCS summary page khul nahi payi ya table nahi mili. Debug dekhein.");
          }
        }
      } catch (err) {
        setStatus("tcs", "failed", "E-Commerce TCS fetch issue: " + shortErr(err));
        dbg.steps.tcsError = shortErr(err);
      }

      // --- STEP 3: NOTICES & ORDERS ---
      if (!opts.notices) { result.status.notices = { state: "skipped", message: "Option off tha." }; } else try {
        const clickedNotice = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          const target = links.find(a => /notices and orders/i.test(a.textContent || ""));
          if (target) { target.click(); return (target.textContent || "").trim(); }
          return null;
        });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(5000);
        await dismissModals(page);
        const snap = await snapshotPage(page);
        dbg.steps.notices = { clickedNotice, url: snap.url, tableCount: snap.tables.length, buttons: snap.buttons, bodyExcerpt: snap.bodyText.slice(0, 1800) };

        if (!clickedNotice) {
          setStatus("notices", "failed", "'View Notices and Orders' link menu me nahi mila.");
        } else {
          result.notices = parseNoticeTables(snap.tables);
          if (result.notices.length) setStatus("notices", "ok", `${result.notices.length} notice/order row mili.`);
          else if (/no\s+(records?|notices?|orders?|data|additional)|not\s+found|there\s+(is|are)\s+no|no\s+.{0,30}\s+(available|found)/i.test(snap.bodyText)) setStatus("notices", "empty", "Portal par koi notice/order nahi hai.");
          else if (/Notice\/Demand\s+Order\s+Id/i.test(snap.bodyText)) {
            // Table ke headers dikhe par row nahi — lazy load ho sakta hai, isliye ek baar aur wait karke dekhte hain
            await page.waitForTimeout(6000);
            const snap2 = await snapshotPage(page);
            result.notices = parseNoticeTables(snap2.tables);
            dbg.steps.notices.retryRows = result.notices.length;
            dbg.steps.notices.retryExcerpt = snap2.bodyText.slice(0, 1200);
            if (result.notices.length) setStatus("notices", "ok", `${result.notices.length} notice/order row mili.`);
            else setStatus("notices", "empty", "Notices page poori khuli (table headers dikhe), par koi notice/order row nahi — portal par koi notice nahi hai.");
          }
          else setStatus("notices", "failed", "Notices ka table padh nahi paya.");
        }
      } catch (err) {
        setStatus("notices", "failed", "Notices fetch issue: " + shortErr(err));
        dbg.steps.noticesError = err.message;
      }

      dbg.status = result.status;
      dbg.warnings = result.warnings;
      lastDebug = dbg;
      // GSTR-2B / E-Com maanga gaya tha par fail hua -> app ko error do (0 save na ho)
      const failed = [];
      if (opts.gstr2b && result.status.gstr2b?.state === "failed") failed.push("GSTR-2B: " + result.status.gstr2b.message);
      if (opts.tcs && result.status.tcs?.state === "failed") failed.push("E-Com TCS: " + result.status.tcs.message);
      if (failed.length) return res.json(Object.assign({}, result, { ok: false, error: "Data fetch nahi hua (Sheet me save nahi kiya) -> " + failed.join(" | ") }));
      res.json(result);
    } finally {
      s.busy = false;
      release();
      if (autoClose) await closeSession(sessionId);
    }
  });

  app.post("/api/gst/upload-gstr1", async (req, res) => {
    const { sessionId, fy, month, jsonContent, fileName } = req.body || {};
    const s = getSession(sessionId);
    if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
    if (!jsonContent) return res.status(400).json({ ok: false, error: "GSTR-1 JSON content missing hai." });
    if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

    // Galat period ki JSON upload na ho: JSON ka fp (MMYYYY) aur chuna hua month/FY match hone chahiye
    let obj = null;
    try { obj = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent; } catch (_) {
      return res.status(400).json({ ok: false, error: "GSTR-1 JSON valid nahi hai (parse nahi hui)." });
    }
    const wantFp = periodFor(fy || "2026-27", String(month || "10").padStart(2, "0"));
    if (obj && obj.fp && String(obj.fp) !== wantFp) {
      return res.status(400).json({ ok: false, error: `JSON ka period (fp) ${obj.fp} hai, par aapne ${wantFp} select kiya hai. Upload roka gaya.` });
    }

    s.busy = true;
    const { page } = s;
    const tmpFile = path.join(os.tmpdir(), `${crypto.randomUUID()}_${safeFileName(fileName, "GSTR1.json")}`);
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), "utf8");
      await openReturnsDashboardAndSearch(page, fy || "2026-27", String(month || "10").padStart(2, "0"), null, "gstr1");
      const gstr1Card = page.locator("div").filter({ hasText: /GSTR-?1/i }).filter({ has: page.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')") }).last();
      const offlineBtn = gstr1Card.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')").first();
      if (!(await offlineBtn.count())) throw new Error("GSTR-1 PREPARE OFFLINE button nahi mila.");
      await offlineBtn.click({ force: true });
      await page.waitForTimeout(3000);
      const fileInput = await page.$("input[type='file']");
      if (!fileInput) throw new Error("JSON upload input field nahi mila.");
      await fileInput.setInputFiles(tmpFile);
      await page.waitForTimeout(6000);

      const statusInfo = await page.evaluate(() => {
        const vis = el => el.offsetParent !== null;
        const alerts = Array.from(document.querySelectorAll(".alert-success, .alert-info, .alert-danger, .err, .text-danger, .alert-warning"))
          .filter(vis).map(el => el.innerText.trim()).filter(Boolean);
        const tr = document.querySelector("table tbody tr");
        return { alertText: alerts.join(" | "), latestRow: tr ? Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim()) : [] };
      });

      const text = statusInfo.alertText + " " + statusInfo.latestRow.join(" ");
      if (ERR_TEXT_RE.test(statusInfo.alertText)) {
        return res.status(400).json({ ok: false, error: "Portal ne upload me error diya: " + statusInfo.alertText, portalStatus: statusInfo });
      }
      if (OK_TEXT_RE.test(text)) {
        return res.json({ ok: true, verified: true, message: "GSTR-1 JSON portal par upload ho gayi (portal ne confirm kiya). Ab portal par jaakar summary check karke Submit & File (EVC/DSC) karein.", portalStatus: statusInfo });
      }
      return res.json({ ok: true, verified: false, message: "⚠️ File portal ko bhej di gayi, par portal ki taraf se success/error ka message padh nahi paya. Portal par jaakar upload status zaroor check karein.", portalStatus: statusInfo });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    } finally {
      s.busy = false;
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
    }
  });

  app.post("/api/gst/logout", async (req, res) => {
    await closeSession(req.body?.sessionId);
    res.json({ ok: true });
  });

  app.listen(PORT, () => console.log(`GST Cloud Bridge v${VERSION} running on port ${PORT}`));
}

module.exports = { parseTcsRecordCount, parseAmt, buildColumnLabels, mapTcsColumns, parseTcsTables, parseNoticeTables, summarizeGstr2B, periodFor, safeFileName, getQuarterForMonth, ERR_TEXT_RE, OK_TEXT_RE };

if (require.main === module) startServer();
