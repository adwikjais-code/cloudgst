const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");

const app = express();
const VERSION = "2.3.1";
const PORT = process.env.PORT || 3000;
const API_SECRET = (process.env.API_SECRET || "").trim();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({
  origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(",").map(s => s.trim()),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-secret"]
}));
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/debug") return next();
  if (!API_SECRET) return next();
  const provided = String(req.headers["x-api-secret"] || "").trim();
  if (provided !== API_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid x-api-secret" });
  }
  next();
});

// Shared Chromium browser + RAM-safe sequential fetch queue
let sharedBrowser = null;
const sessions = new Map();
const SESSION_TTL_MS = 18 * 60 * 1000;
const debugLog = [];
function logDebug(step, detail) {
  debugLog.push({ ts: new Date().toISOString(), step, detail });
  if (debugLog.length > 80) debugLog.shift();
}

async function ensureBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-gpu", "--disable-extensions", "--disable-background-networking",
      "--no-zygote", "--disable-blink-features=AutomationControlled"
    ]
  });
  sharedBrowser.on("disconnected", () => { sharedBrowser = null; });
  return sharedBrowser;
}

async function closeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;
  sessions.delete(sessionId);
  try { await s.context.close(); } catch (_) {}
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TTL_MS && !s.busy) closeSession(id);
  }
}, 60 * 1000);

function getSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  s.lastActive = Date.now();
  return s;
}

// Sequential queue (concurrency 1) to protect 512 MB / 1 GB cloud RAM
let fetchQueueChain = Promise.resolve();
function runQueued(fn) {
  const run = fetchQueueChain.then(() => fn(), () => fn());
  fetchQueueChain = run.catch(() => {});
  return run;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
function getMonthName(mm) { return MONTH_NAMES[parseInt(mm, 10) - 1] || "October"; }
function getQuarterForMonth(mm) {
  const m = parseInt(mm, 10);
  if (m >= 4 && m <= 6) return "Quarter 1 (Apr - Jun)";
  if (m >= 7 && m <= 9) return "Quarter 2 (Jul - Sep)";
  if (m >= 10 && m <= 12) return "Quarter 3 (Oct - Dec)";
  return "Quarter 4 (Jan - Mar)";
}

app.get("/health", (req, res) => {
  res.json({
    ok: true, service: "gst-cloud-bridge", version: VERSION,
    secretConfigured: !!API_SECRET, activeSessions: sessions.size,
    features: ["fetch-all", "upload-gstr1", "nil-gstr1-evc", "nil-gstr3b-evc"],
    timestamp: new Date().toISOString()
  });
});

app.get("/api/gst/ping", (req, res) => {
  res.json({ ok: true, version: VERSION, activeSessions: sessions.size });
});

app.get("/debug", (req, res) => {
  res.type("text/plain").send(debugLog.map(d => `[${d.ts}] ${d.step}: ${d.detail}`).join("\n") || "No debug logs yet.");
});

// ---------------------------------------------------------------------------
// 1. INIT LOGIN (CAPTCHA)
// ---------------------------------------------------------------------------
app.post("/api/gst/init-login", async (req, res) => {
  let context;
  try {
    const keepOthers = !!req.body?.keepOthers;
    if (!keepOthers) {
      for (const [oldId, s] of Array.from(sessions.entries())) {
        if (!s.busy) await closeSession(oldId);
      }
    } else {
      // Keep at most 2 idle unlogged captcha sessions to stay RAM-safe
      const unlogged = Array.from(sessions.entries()).filter(([, s]) => !s.loggedIn && !s.busy);
      while (unlogged.length >= 2) {
        const [oldId] = unlogged.shift();
        await closeSession(oldId);
      }
    }

    const browser = await ensureBrowser();
    context = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      acceptDownloads: true
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    // Block non-captcha images/fonts/media to cut RAM & speed up loading
    await context.route("**/*", (route) => {
      const rtype = route.request().resourceType();
      const rurl = route.request().url().toLowerCase();
      if (rtype === "font" || rtype === "media") return route.abort();
      if (rtype === "image" && !rurl.includes("captcha")) return route.abort();
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(35000);
    await page.goto("https://services.gst.gov.in/services/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#username", { timeout: 30000 });
    await page.click("#username");
    await page.locator("#username").pressSequentially(String(req.body?.username || "gstuser"), { delay: 35 });
    await page.click("#user_pass");
    await page.waitForTimeout(700);

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
    sessions.set(sessionId, { context, page, loggedIn: false, busy: false, lastActive: Date.now() });
    logDebug("init-login", `Session created (${sessionId.slice(0, 8)})`);
    res.json({ ok: true, sessionId, captchaBase64: "data:image/png;base64," + captchaBuffer.toString("base64") });
  } catch (err) {
    try { if (context) await context.close(); } catch (_) {}
    logDebug("init-login-err", err.message);
    res.status(500).json({ ok: false, error: err.message || "Init login failed" });
  }
});

// ---------------------------------------------------------------------------
// 2. SUBMIT LOGIN & LOGIN OTP
// ---------------------------------------------------------------------------
app.post("/api/gst/submit-login", async (req, res) => {
  const { sessionId, username, password, captcha } = req.body || {};
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ ok: false, error: "Session expired. Dobara Load Captcha karein." });
  if (s.loggedIn) return res.json({ ok: true, status: "logged_in", url: s.page.url() });
  if (s.busy) return res.status(429).json({ ok: false, error: "Login already in progress." });

  s.busy = true;
  const { page } = s;
  try {
    await page.fill("#username", String(username || "").trim());
    await page.fill("#user_pass", String(password || "").trim());
    await page.fill("#captcha", String(captcha || "").trim());
    await Promise.all([
      page.click("button[type='submit'], button:has-text('LOGIN')"),
      page.waitForTimeout(4200)
    ]);

    const otpInput = await page.$("input[name='otp'], #otp, input[placeholder*='OTP' i]");
    if (otpInput && await otpInput.isVisible()) {
      return res.json({ ok: true, status: "otp_required", message: "GST Portal ne Login OTP manga hai." });
    }

    const url = page.url();
    if (url.includes("/auth/") || url.includes("fowelcome") || url.includes("dashboard")) {
      s.loggedIn = true;
      logDebug("login-ok", `${username} -> ${url}`);
      return res.json({ ok: true, status: "logged_in", url });
    }

    const errMsg = await page.evaluate(() => {
      const el = document.querySelector(".err, .alert-danger, .text-danger, [ng-if*='err']");
      return el ? el.innerText.trim() : "";
    });
    let newCaptcha = null;
    const capEl = await page.$("#imgCaptcha, img[src*='captcha' i]");
    if (capEl) newCaptcha = "data:image/png;base64," + (await capEl.screenshot({ type: "png" })).toString("base64");
    return res.status(400).json({ ok: false, error: errMsg || "Invalid Username, Password, or Captcha.", captchaBase64: newCaptcha });
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
    await page.waitForTimeout(3800);
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

// ---------------------------------------------------------------------------
// SHARED PORTAL NAVIGATION HELPERS
// ---------------------------------------------------------------------------
async function dismissPopups(page) {
  const sels = [
    "button:has-text('CLOSE')", "button:has-text('OK')", "button:has-text('Later')",
    "button:has-text('REMIND ME LATER')", ".modal button.close"
  ];
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click().catch(() => {});
      await page.waitForTimeout(350);
    }
  }
}

async function ensureWelcomePage(page) {
  if (!page.url().includes("fowelcome")) {
    await page.goto("https://services.gst.gov.in/services/auth/fowelcome", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2400);
  }
  await dismissPopups(page);
}

async function openReturnsDashboardAndSearch(page, fy, monthNum) {
  if (!page.url().includes("/returns/auth/dashboard")) {
    await ensureWelcomePage(page);
    const retBtn = page.locator("button:has-text('RETURN DASHBOARD'), a:has-text('RETURN DASHBOARD')").first();
    if (await retBtn.isVisible().catch(() => false)) {
      await Promise.all([retBtn.click(), page.waitForLoadState("domcontentloaded").catch(() => {})]);
      await page.waitForTimeout(3000);
    } else {
      await page.goto("https://return.gst.gov.in/returns/auth/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
    }
  }
  await dismissPopups(page);
  await page.waitForSelector("select[name='fin'], #fin", { timeout: 25000 });
  await page.selectOption("select[name='fin'], #fin", { label: fy }).catch(() => page.selectOption("select[name='fin'], #fin", fy).catch(() => {}));
  await page.waitForTimeout(800);
  if (await page.$("select[name='quarter'], #quarter")) {
    await page.selectOption("select[name='quarter'], #quarter", { label: getQuarterForMonth(monthNum) }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.selectOption("select[name='mon'], #mon", { label: getMonthName(monthNum) }).catch(() => page.selectOption("select[name='mon'], #mon", String(monthNum)).catch(() => {}));
  await page.waitForTimeout(600);
  await page.click("button:has-text('SEARCH'), button[type='submit']");
  await page.waitForTimeout(3000);
  logDebug("returns-dash", `Opened FY=${fy} Month=${monthNum}`);
}

// ---------------------------------------------------------------------------
// 3. FETCH ALL (GSTR-2B, E-COM GROSS, NOTICES — RAM-SAFE SEQUENTIAL)
// ---------------------------------------------------------------------------
app.post("/api/gst/fetch-all", async (req, res) => {
  const { sessionId, fy, month, autoClose, options } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });

  const opts = {
    gstr2b: options?.gstr2b !== false,
    tcs: options?.tcs !== false,
    notices: !!options?.notices
  };

  try {
    const result = await runQueued(async () => {
      s.busy = true;
      const { page } = s;
      const out = {
        ok: true, fy: fy || "2026-27", month: String(month || "10").padStart(2, "0"),
        period: `${fy || "2026-27"} / ${String(month || "10").padStart(2, "0")}`,
        notices: [], gstr2b: { summary: null, jsonBase64: null, fileName: null },
        ecommerceTcs: { rows: [], totalGrossTaxable: 0, totalNetValue: 0, totalTcs: 0 },
        status: {}, warnings: []
      };

      try {
        // 1) GSTR-2B
        if (opts.gstr2b) {
          try {
            await openReturnsDashboardAndSearch(page, out.fy, out.month);
            const gstr2bCard = page.locator("div.card, div.panel, div[class*='tile'], div[class*='box']").filter({ hasText: /GSTR-?2B/i }).first();
            const downloadBtn = gstr2bCard.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')").first();
            if (await downloadBtn.count()) {
              await downloadBtn.click();
              await page.waitForTimeout(3200);
              const genJsonBtn = page.locator("button:has-text('GENERATE JSON'), a:has-text('GENERATE JSON')").first();
              if (await genJsonBtn.count()) {
                const dlPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
                await genJsonBtn.click();
                let download = await dlPromise;
                if (!download) {
                  await page.waitForTimeout(3200);
                  const fileLink = page.locator("a:has-text('Click here to download'), a:has-text('File 1')").first();
                  if (await fileLink.count()) {
                    const dlPromise2 = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
                    await fileLink.click();
                    download = await dlPromise2;
                  }
                }
                if (download) {
                  const rawJson = fs.readFileSync(await download.path(), "utf8");
                  const parsed = JSON.parse(rawJson);
                  out.gstr2b.fileName = download.suggestedFilename() || `GSTR2B_${out.month}${out.fy.slice(0, 4)}.json`;
                  out.gstr2b.jsonBase64 = "data:application/json;base64," + Buffer.from(rawJson, "utf8").toString("base64");
                  const itcSum = parsed?.data?.itcsumm?.itcavl?.nonrevsup || {};
                  const ineligible = parsed?.data?.itcsumm?.itcunavl?.nonrevsup || {};
                  out.gstr2b.summary = {
                    igst: Number(itcSum.igst || 0), cgst: Number(itcSum.cgst || 0), sgst: Number(itcSum.sgst || 0), cess: Number(itcSum.cess || 0),
                    ineligibleTotal: Number(ineligible.igst || 0) + Number(ineligible.cgst || 0) + Number(ineligible.sgst || 0),
                    b2bSuppliersCount: Array.isArray(parsed?.data?.docdata?.b2b) ? parsed.data.docdata.b2b.length : 0,
                    cdnrCount: Array.isArray(parsed?.data?.docdata?.cdnr) ? parsed.data.docdata.cdnr.length : 0
                  };
                  out.status.gstr2b = { ok: true, message: "Downloaded" };
                } else {
                  out.status.gstr2b = { ok: false, message: "Download trigger nahi hua" };
                  out.warnings.push("GSTR-2B JSON download trigger nahi hua.");
                }
              } else {
                out.status.gstr2b = { ok: false, message: "GENERATE JSON button nahi mila" };
                out.warnings.push("GSTR-2B GENERATE JSON button nahi mila.");
              }
            } else {
              out.status.gstr2b = { ok: false, message: "GSTR-2B card nahi mila" };
              out.warnings.push("GSTR-2B card ya Download button nahi mila.");
            }
          } catch (err) {
            out.status.gstr2b = { ok: false, message: err.message };
            out.warnings.push("GSTR-2B fetch issue: " + err.message);
          }
        }

        // 2) E-Commerce TCS Gross
        if (opts.tcs) {
          try {
            await openReturnsDashboardAndSearch(page, out.fy, out.month);
            const tcsCard = page.locator("div.card, div.panel, div[class*='tile'], div[class*='box']").filter({ hasText: /TDS and TCS credit received/i }).first();
            const prepBtn = tcsCard.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE'), button:has-text('VIEW')").first();
            if (await prepBtn.count()) {
              await prepBtn.click();
              await page.waitForTimeout(3500);
              const tcsTile = page.locator("div, a, button").filter({ hasText: /TCS Credit Received/i }).first();
              if (await tcsTile.count()) {
                await tcsTile.click();
                await page.waitForTimeout(3000);
              }
              const tcsRows = await page.evaluate(() => {
                const rows = [];
                document.querySelectorAll("table tbody tr").forEach(tr => {
                  const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
                  const gstinMatch = tds.find(v => /^[0-9]{2}[A-Z0-9]{13}$/i.test(v));
                  if (tds.length >= 5 && gstinMatch) {
                    const nums = tds.map(v => parseFloat(v.replace(/[₹,\s]/g, ""))).filter(n => !isNaN(n));
                    rows.push({
                      ecoGstin: gstinMatch,
                      ecoName: tds.find(v => v !== gstinMatch && isNaN(parseFloat(v.replace(/[₹,\s]/g, ""))) && v.length > 2) || "E-Commerce Operator",
                      grossTaxableAmount: nums[0] || 0, netValueSupplies: nums[1] || nums[0] || 0,
                      tcsIgst: nums[2] || 0, tcsCgst: nums[3] || 0, tcsSgst: nums[4] || 0
                    });
                  }
                });
                return rows;
              });
              out.ecommerceTcs.rows = tcsRows;
              out.ecommerceTcs.totalGrossTaxable = tcsRows.reduce((a, r) => a + (r.grossTaxableAmount || 0), 0);
              out.ecommerceTcs.totalNetValue = tcsRows.reduce((a, r) => a + (r.netValueSupplies || 0), 0);
              out.ecommerceTcs.totalTcs = tcsRows.reduce((a, r) => a + (r.tcsIgst + r.tcsCgst + r.tcsSgst), 0);
              out.status.tcs = { ok: true, count: tcsRows.length };
            } else {
              out.warnings.push("TDS/TCS Credit Received tile nahi mila.");
            }
          } catch (err) {
            out.warnings.push("E-Commerce TCS fetch issue: " + err.message);
          }
        }

        // 3) Notices (optional — default OFF)
        if (opts.notices) {
          try {
            await ensureWelcomePage(page);
            const servicesMenu = page.locator("a:has-text('Services'), li:has-text('Services')").first();
            await servicesMenu.hover().catch(() => {});
            await servicesMenu.click().catch(() => {});
            await page.waitForTimeout(500);
            const userServices = page.locator("a:has-text('User Services')").first();
            await userServices.hover().catch(() => {});
            await userServices.click().catch(() => {});
            await page.waitForTimeout(500);
            const viewNoticesLink = page.locator("a:has-text('View Notices and Orders')").first();
            if (await viewNoticesLink.count()) {
              await viewNoticesLink.click({ force: true });
              await page.waitForTimeout(3200);
              out.notices = await page.evaluate(() => {
                const rows = [];
                document.querySelectorAll("table tbody tr").forEach(tr => {
                  const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
                  if (tds.length >= 4 && !tds.join(" ").toLowerCase().includes("no records")) {
                    rows.push({ refNo: tds[0] || "", issuedBy: tds[1] || "", type: tds[2] || "", description: tds[3] || "", issueDate: tds[4] || "", dueDate: tds[5] || "", amount: tds[6] || "" });
                  }
                });
                return rows;
              });
            }
          } catch (err) {
            out.warnings.push("Notices fetch issue: " + err.message);
          }
        }

        return out;
      } finally {
        s.busy = false;
        if (autoClose) await closeSession(sessionId);
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. NIL FILING INIT — GSTR-1 NIL & GSTR-3B NIL (TRIGGERS EVC OTP)
// ---------------------------------------------------------------------------
async function selectDeclarationAndTriggerEvc(page, returnType) {
  await page.waitForTimeout(2200);
  await dismissPopups(page);

  // Tick visible verification / declaration checkbox (AngularJS safe)
  const decChk = page.locator("input[type='checkbox']:visible").first();
  if (await decChk.count()) {
    const isChecked = await decChk.isChecked().catch(() => false);
    if (!isChecked) await decChk.click({ force: true }).catch(() => decChk.check({ force: true }));
    await page.waitForTimeout(600);
  } else {
    const decLabel = page.locator("label:has-text('I hereby solemnly affirm'):visible, label:has-text('declare'):visible").first();
    if (await decLabel.count()) {
      await decLabel.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }

  // Select Authorized Signatory (first visible select with valid non-placeholder option)
  let signatory = "";
  const sigSelect = page.locator("select[name*='sign' i]:visible, select[id*='sign' i]:visible, select:visible").first();
  if (await sigSelect.count()) {
    const picked = await sigSelect.evaluate((el) => {
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        const t = (opt.text || "").trim();
        const v = (opt.value || "").trim();
        if (v && !/select/i.test(t)) {
          el.selectedIndex = i;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return t;
        }
      }
      return "";
    });
    signatory = picked || "";
    await page.waitForTimeout(900);
  }

  // Click visible FILE WITH EVC button
  const evcBtn = page.locator("button:has-text('FILE WITH EVC'):visible, button:has-text('WITH EVC'):visible, a:has-text('WITH EVC'):visible").first();
  await evcBtn.waitFor({ state: "visible", timeout: 15000 });
  await evcBtn.click();
  await page.waitForTimeout(2500);

  // Confirm EVC OTP input is visible
  const otpSel = "input[placeholder*='OTP' i]:visible, input[name*='otp' i]:visible, #otp:visible, input[maxlength='6']:visible";
  await page.waitForSelector(otpSel, { state: "visible", timeout: 15000 });
  return signatory;
}

app.post("/api/gst/nil-file-init", async (req, res) => {
  const { sessionId, fy, month, returnType } = req.body || {};
  const rType = String(returnType || "GSTR1").toUpperCase() === "GSTR3B" ? "GSTR3B" : "GSTR1";
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
  if (s.busy) return res.status(429).json({ ok: false, error: "Session busy hai, thoda wait karein." });

  s.busy = true;
  const { page } = s;
  try {
    await openReturnsDashboardAndSearch(page, fy || "2026-27", String(month || "10").padStart(2, "0"));

    if (rType === "GSTR1") {
      const gstr1Card = page.locator("div.card, div.panel, div[class*='tile'], div[class*='box']").filter({ hasText: /GSTR-?1\b/i }).first();
      if (!(await gstr1Card.count())) throw new Error("Returns Dashboard par GSTR-1 card nahi mila.");

      const cardText = (await gstr1Card.innerText().catch(() => "")).toLowerCase();
      if (cardText.includes("status") && cardText.includes("filed") && !cardText.includes("not filed")) {
        return res.json({ ok: true, status: "already_filed", returnType: rType, message: "GSTR-1 is mahine ke liye pehle se FILED hai." });
      }

      const prepBtn = gstr1Card.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE')").first();
      if (!(await prepBtn.count())) throw new Error("GSTR-1 PREPARE ONLINE button nahi mila.");
      await prepBtn.click();
      await page.waitForTimeout(3200);
      await dismissPopups(page);

      // Find visible File Nil GSTR-1 checkbox / label (triggers AngularJS ng-change cleanly)
      const nilLabel = page.locator("label:has-text('File Nil GSTR-1'):visible, label:has-text('Nil GSTR-1'):visible").first();
      const nilChk = page.locator("input[type='checkbox'][id*='nil' i]:visible, input[type='checkbox'][name*='nil' i]:visible, label:has-text('Nil GSTR-1') input[type='checkbox']").first();

      if (await nilChk.count()) {
        if (await nilChk.isDisabled().catch(() => false)) {
          return res.status(400).json({ ok: false, blocked: true, error: "GSTR-1 Nil disabled hai — portal par is mahine saved invoices/data maujood hain." });
        }
        const already = await nilChk.isChecked().catch(() => false);
        if (!already) {
          if (await nilLabel.count()) await nilLabel.click({ force: true }).catch(() => nilChk.click({ force: true }));
          else await nilChk.click({ force: true });
        }
      } else if (await nilLabel.count()) {
        await nilLabel.click({ force: true });
      } else {
        throw new Error("GSTR-1 Nil checkbox nahi mila — check karein ki is mahine koi saved invoice to nahi hai.");
      }
      await page.waitForTimeout(1500);

      // Click ONLY the visible FILE STATEMENT / PROCEED TO FILE button (ignore hidden ng-hide buttons!)
      const fileStmtBtn = page.locator("button:has-text('FILE STATEMENT'):visible, button:has-text('PROCEED TO FILE'):visible").first();
      await fileStmtBtn.waitFor({ state: "visible", timeout: 15000 });
      await fileStmtBtn.click();
      await page.waitForTimeout(2500);

      const signatory = await selectDeclarationAndTriggerEvc(page, "GSTR-1");
      logDebug("nil-gstr1-otp", `EVC OTP triggered (Signatory: ${signatory})`);
      return res.json({
        ok: true, status: "evc_otp_sent", returnType: rType, signatory,
        message: "GSTR-1 Nil EVC OTP client ke mobile/email par bhej diya gaya hai! 6-digit OTP dalein."
      });
    } else {
      // GSTR-3B NIL
      const gstr3bCard = page.locator("div.card, div.panel, div[class*='tile'], div[class*='box']").filter({ hasText: /GSTR-?3B/i }).first();
      if (!(await gstr3bCard.count())) throw new Error("Returns Dashboard par GSTR-3B card nahi mila.");

      const cardText = (await gstr3bCard.innerText().catch(() => "")).toLowerCase();
      if (cardText.includes("status") && cardText.includes("filed") && !cardText.includes("not filed")) {
        return res.json({ ok: true, status: "already_filed", returnType: rType, message: "GSTR-3B is mahine ke liye pehle se FILED hai." });
      }

      const prepBtn = gstr3bCard.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE')").first();
      if (!(await prepBtn.count())) throw new Error("GSTR-3B PREPARE ONLINE button nahi mila.");
      await prepBtn.click();
      await page.waitForTimeout(3200);
      await dismissPopups(page);

      // Questionnaire: "Do you want to file Nil return?" -> Yes
      const yesRadio = page.locator("input[type='radio'][value='Y'], input[type='radio'][id*='yes' i], label:has-text('Yes') input[type='radio']").first();
      if (await yesRadio.count()) {
        if (await yesRadio.isDisabled().catch(() => false)) {
          return res.status(400).json({ ok: false, blocked: true, error: "GSTR-3B Nil 'Yes' disabled hai — portal par GSTR-1 supply, ITC, ya tax liability maujood hai." });
        }
        await yesRadio.check({ force: true }).catch(() => yesRadio.click({ force: true }));
        await page.waitForTimeout(700);
        const nextBtn = page.locator("button:has-text('NEXT'):visible").first();
        if (await nextBtn.count()) {
          await nextBtn.click();
          await page.waitForTimeout(2500);
        }
        await dismissPopups(page);
      } else {
        throw new Error("GSTR-3B Nil questionnaire ('Do you want to file Nil return?') nahi mila — ho sakta hai non-Nil data pehle se saved ho.");
      }

      const signatory = await selectDeclarationAndTriggerEvc(page, "GSTR-3B");
      logDebug("nil-gstr3b-otp", `EVC OTP triggered (Signatory: ${signatory})`);
      return res.json({
        ok: true, status: "evc_otp_sent", returnType: rType, signatory,
        message: "GSTR-3B Nil EVC OTP client ke mobile/email par bhej diya gaya hai! 6-digit OTP dalein."
      });
    }
  } catch (err) {
    logDebug("nil-init-err", `${rType}: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    s.busy = false;
  }
});

// ---------------------------------------------------------------------------
// 5. NIL FILING VERIFY EVC OTP (COMPLETES FILING & EXTRACTS ARN)
// ---------------------------------------------------------------------------
app.post("/api/gst/nil-file-verify", async (req, res) => {
  const { sessionId, otp, returnType, autoClose } = req.body || {};
  const rType = String(returnType || "GSTR1").toUpperCase() === "GSTR3B" ? "GSTR3B" : "GSTR1";
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Session expired. Dobara Nil Captcha load karein." });
  if (s.busy) return res.status(429).json({ ok: false, error: "Request already in progress." });
  if (!otp || String(otp).trim().length < 4) return res.status(400).json({ ok: false, error: "Valid EVC OTP dalein." });

  s.busy = true;
  const { page } = s;
  try {
    const otpInp = page.locator("input[placeholder*='OTP' i]:visible, input[name*='otp' i]:visible, #otp:visible, input[maxlength='6']:visible").first();
    if (!(await otpInp.count())) throw new Error("EVC OTP input box screen par nahi mila.");
    await otpInp.fill(String(otp).trim());
    await page.waitForTimeout(400);

    const verifyBtn = page.locator("button:has-text('VERIFY'):visible, button:has-text('VALIDATE'):visible, button:has-text('SUBMIT'):visible").first();
    if (!(await verifyBtn.count())) throw new Error("OTP VERIFY button nahi mila.");
    await verifyBtn.click();
    await page.waitForTimeout(4500);

    const outcome = await page.evaluate(() => {
      const bodyTxt = document.body ? document.body.innerText : "";
      const errEl = document.querySelector(".err, .alert-danger, .text-danger");
      const okEl = document.querySelector(".alert-success, .alert-info");
      const arnMatch = bodyTxt.match(/\b([A-Z]{2}[0-9]{13})\b/);
      return {
        errText: errEl ? errEl.innerText.trim() : "",
        okText: okEl ? okEl.innerText.trim() : "",
        arn: arnMatch ? arnMatch[1] : "",
        hasSuccess: /successfully\s+filed|filing\s+successful|arn\s*(is|:)/i.test(bodyTxt)
      };
    });

    if (outcome.errText && !outcome.hasSuccess && !outcome.arn) {
      return res.status(400).json({ ok: false, error: outcome.errText || "EVC OTP galat hai ya verify nahi ho paya." });
    }

    logDebug("nil-filed-ok", `${rType} ARN=${outcome.arn || "N/A"}`);
    if (autoClose !== false) await closeSession(sessionId);

    return res.json({
      ok: true, status: "filed", returnType: rType,
      arn: outcome.arn || "FILED",
      message: outcome.okText || `${rType} Nil successfully file ho gaya!` + (outcome.arn ? ` ARN: ${outcome.arn}` : "")
    });
  } catch (err) {
    logDebug("nil-verify-err", err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    s.busy = false;
  }
});

// ---------------------------------------------------------------------------
// 6. UPLOAD GSTR-1 JSON & LOGOUT
// ---------------------------------------------------------------------------
app.post("/api/gst/upload-gstr1", async (req, res) => {
  const { sessionId, fy, month, jsonContent, fileName } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai." });
  if (!jsonContent) return res.status(400).json({ ok: false, error: "GSTR-1 JSON content missing hai." });
  if (s.busy) return res.status(429).json({ ok: false, error: "Session busy hai." });

  s.busy = true;
  const { page } = s;
  const tmpFile = path.join(os.tmpdir(), fileName || `GSTR1_${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpFile, typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent, null, 2), "utf8");
    await openReturnsDashboardAndSearch(page, fy || "2026-27", String(month || "10").padStart(2, "0"));
    const gstr1Card = page.locator("div.card, div.panel, div[class*='tile'], div[class*='box']").filter({ hasText: /GSTR-?1/i }).first();
    const offlineBtn = gstr1Card.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')").first();
    if (!(await offlineBtn.count())) throw new Error("GSTR-1 PREPARE OFFLINE button nahi mila.");
    await offlineBtn.click();
    await page.waitForTimeout(3000);
    const fileInput = await page.$("input[type='file']");
    if (!fileInput) throw new Error("JSON upload input field nahi mila.");
    await fileInput.setInputFiles(tmpFile);
    await page.waitForTimeout(4500);
    const statusInfo = await page.evaluate(() => {
      const tr = document.querySelector("table tbody tr");
      const msgEl = document.querySelector(".alert-success, .alert-info, .err, .alert-danger");
      return { alertText: msgEl ? msgEl.innerText.trim() : "", latestRow: tr ? Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim()) : [] };
    });
    res.json({ ok: true, message: "GSTR-1 JSON portal par upload ho gaya!", portalStatus: statusInfo });
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
