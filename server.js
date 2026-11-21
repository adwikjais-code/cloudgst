const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");

const app = express();
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

const sessions = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000;
let lastDebug = { message: "No fetch run yet." };

async function closeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;
  sessions.delete(sessionId);
  try { await s.context.close(); } catch (_) {}
  try { await s.browser.close(); } catch (_) {}
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TTL_MS) closeSession(id);
  }
}, 60 * 1000);

function getSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  s.lastActive = Date.now();
  return s;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getMonthName(mm) {
  return MONTH_NAMES[parseInt(mm, 10) - 1] || "October";
}

function getQuarterForMonth(mm) {
  const m = parseInt(mm, 10);
  if (m >= 4 && m <= 6) return "Quarter 1";
  if (m >= 7 && m <= 9) return "Quarter 2";
  if (m >= 10 && m <= 12) return "Quarter 3";
  return "Quarter 4";
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "gst-cloud-bridge", version: "1.6.0", activeSessions: sessions.size, timestamp: new Date().toISOString() });
});

app.get("/debug", (req, res) => {
  res.type("text/plain").send(JSON.stringify(lastDebug, null, 2));
});

app.post("/api/gst/init-login", async (req, res) => {
  let browser, context;
  try {
    for (const oldId of Array.from(sessions.keys())) await closeSession(oldId);
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--disable-extensions", "--disable-background-networking",
        "--no-zygote", "--disable-blink-features=AutomationControlled"
      ]
    });
    context = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      acceptDownloads: true
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
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
    try { if (browser) await browser.close(); } catch (_) {}
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

async function ensureWelcomePage(page) {
  if (!page.url().includes("fowelcome")) {
    await page.goto("https://services.gst.gov.in/services/auth/fowelcome", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
  }
  await dismissModals(page);
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

async function openReturnsDashboardAndSearch(page, fy, monthNum, dbg) {
  if (!page.url().includes("/returns/auth/dashboard")) {
    // First try direct return dashboard if already on a gst.gov.in auth subdomain
    await page.goto("https://return.gst.gov.in/returns/auth/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);

    // If bounced away from dashboard, go through fowelcome -> RETURN DASHBOARD button
    if (!page.url().includes("/returns/auth/dashboard")) {
      await ensureWelcomePage(page);
      const retBtn = page.locator("button:has-text('RETURN DASHBOARD'), a:has-text('RETURN DASHBOARD'), span:has-text('RETURN DASHBOARD')").first();
      if (await retBtn.count()) {
        await retBtn.click({ force: true });
        await page.waitForTimeout(4500);
      }
    }
  }

  await dismissModals(page);
  await page.waitForSelector("select[name='fin'], select", { timeout: 25000 });

  const fyRes = await selectDropdownByText(page, fy);
  await page.waitForTimeout(1000);
  const qRes = await selectDropdownByText(page, getQuarterForMonth(monthNum));
  await page.waitForTimeout(1000);
  const mRes = await selectDropdownByText(page, getMonthName(monthNum));
  await page.waitForTimeout(800);

  const searchBtn = page.locator("button:has-text('SEARCH'), button[type='submit']").first();
  if (await searchBtn.count()) {
    await searchBtn.click({ force: true });
    await page.waitForTimeout(4000);
  }

  if (dbg) {
    dbg.returnsDashboard = { url: page.url(), fyRes, qRes, mRes };
  }
}

app.post("/api/gst/fetch-all", async (req, res) => {
  const { sessionId, fy, month } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
  if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

  s.busy = true;
  const { page } = s;
  const dbg = { timestamp: new Date().toISOString(), version: "1.6.0", fy: fy || "2026-27", month: String(month || "10").padStart(2, "0"), steps: {} };
  const result = {
    ok: true, fy: dbg.fy, month: dbg.month,
    notices: [], gstr2b: { summary: null, jsonBase64: null, fileName: null },
    ecommerceTcs: { rows: [], totalGrossTaxable: 0, totalNetValue: 0, totalTcs: 0 }, warnings: []
  };

  try {
    // --- A. NOTICES & ORDERS (Open Services -> User Services -> View Notices and Orders) ---
    try {
      await ensureWelcomePage(page);
      const servicesMenu = page.locator("a:has-text('Services')").first();
      await servicesMenu.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const userServices = page.locator("a:has-text('User Services')").first();
      await userServices.hover().catch(() => {});
      await userServices.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);

      const clickedNotice = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const target = links.find(a => /notices and orders/i.test(a.textContent || ""));
        if (target) { target.click(); return (target.textContent || "").trim(); }
        return null;
      });
      await page.waitForTimeout(4500);

      dbg.steps.notices = { clickedNotice, url: page.url(), tableRows: await page.locator("table tbody tr").count() };
      if (clickedNotice) {
        result.notices = await page.evaluate(() => {
          const rows = [];
          document.querySelectorAll("table tbody tr").forEach(tr => {
            const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
            if (tds.length >= 4 && !tds.join(" ").toLowerCase().includes("no records")) {
              rows.push({ refNo: tds[0] || "", issuedBy: tds[1] || "", type: tds[2] || "", description: tds[3] || "", issueDate: tds[4] || "", dueDate: tds[5] || "", amount: tds[6] || "" });
            }
          });
          return rows;
        });
      } else {
        result.warnings.push("View Notices and Orders link menu me nahi mila.");
      }
    } catch (err) {
      result.warnings.push("Notices fetch issue: " + err.message);
      dbg.steps.noticesError = err.message;
    }

    // --- B. GSTR-2B (Wait for gstr2b.gst.gov.in to finish rendering buttons) ---
    try {
      await openReturnsDashboardAndSearch(page, result.fy, result.month, dbg);
      const gstr2bCard = page.locator("div").filter({ hasText: /GSTR-?2B/i }).filter({ has: page.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')") }).last();
      const downloadBtn = gstr2bCard.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')").first();
      dbg.steps.gstr2bCardFound = await downloadBtn.count();

      if (await downloadBtn.count()) {
        await downloadBtn.click({ force: true });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(4000);
        dbg.steps.gstr2bPageUrl = page.url();

        // Log visible buttons on gstr2b download page for diagnostics
        dbg.steps.gstr2bButtons = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button, a.btn")).map(b => b.innerText.trim()).filter(Boolean).slice(0, 15)
        );

        const genJsonBtn = page.locator("button:has-text('GENERATE JSON'), a:has-text('GENERATE JSON'), button:has-text('JSON')").first();
        if (await genJsonBtn.count()) {
          const dlPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
          await genJsonBtn.click({ force: true });
          let download = await dlPromise;
          if (!download) {
            await page.waitForTimeout(4500);
            const fileLink = page.locator("a:has-text('Click here to download'), a:has-text('File 1')").first();
            if (await fileLink.count()) {
              const dlPromise2 = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
              await fileLink.click({ force: true });
              download = await dlPromise2;
            }
          }
          if (download) {
            const rawJson = fs.readFileSync(await download.path(), "utf8");
            const parsed = JSON.parse(rawJson);
            result.gstr2b.fileName = download.suggestedFilename() || `GSTR2B_${result.month}${result.fy.slice(0, 4)}.json`;
            result.gstr2b.jsonBase64 = "data:application/json;base64," + Buffer.from(rawJson, "utf8").toString("base64");
            const itcSum = parsed?.data?.itcsumm?.itcavl?.nonrevsup || {};
            const ineligible = parsed?.data?.itcsumm?.itcunavl?.nonrevsup || {};
            result.gstr2b.summary = {
              igst: Number(itcSum.igst || 0), cgst: Number(itcSum.cgst || 0), sgst: Number(itcSum.sgst || 0), cess: Number(itcSum.cess || 0),
              ineligibleTotal: Number(ineligible.igst || 0) + Number(ineligible.cgst || 0) + Number(ineligible.sgst || 0),
              b2bSuppliersCount: Array.isArray(parsed?.data?.docdata?.b2b) ? parsed.data.docdata.b2b.length : 0,
              cdnrCount: Array.isArray(parsed?.data?.docdata?.cdnr) ? parsed.data.docdata.cdnr.length : 0
            };
          } else result.warnings.push("GSTR-2B JSON download trigger nahi hua.");
        } else result.warnings.push("GSTR-2B GENERATE JSON button nahi mila.");
      } else result.warnings.push("GSTR-2B card ya Download button nahi mila.");
    } catch (err) {
      result.warnings.push("GSTR-2B fetch issue: " + err.message);
      dbg.steps.gstr2bError = err.message;
    }

    // --- C. E-COMMERCE GROSS TAXABLE AMOUNT (TDS/TCS Credit Received) ---
    try {
      await openReturnsDashboardAndSearch(page, result.fy, result.month, null);
      const tcsCard = page.locator("div").filter({ hasText: /TDS and TCS credit received/i }).filter({ has: page.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE'), button:has-text('VIEW')") }).last();
      const prepBtn = tcsCard.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE'), button:has-text('VIEW')").first();
      dbg.steps.tcsCardFound = await prepBtn.count();

      if (await prepBtn.count()) {
        await prepBtn.click({ force: true });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3500);
        const tcsTile = page.locator("div, a, button").filter({ hasText: /TCS Credit Received/i }).last();
        if (await tcsTile.count()) {
          await tcsTile.click({ force: true });
          await page.waitForTimeout(3500);
        }
        dbg.steps.tcsPageUrl = page.url();
        const tcsRows = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll("table tbody tr").forEach(tr => {
            const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
            const gstinMatch = tds.find(v => /^[0-9]{2}[A-Z0-9]{13}$/i.test(v));
            if (tds.length >= 5 && gstinMatch) {
              const nums = tds.map(v => parseFloat(v.replace(/[₹,\s]/g, ""))).filter(n => !isNaN(n));
              out.push({
                ecoGstin: gstinMatch,
                ecoName: tds.find(v => v !== gstinMatch && isNaN(parseFloat(v.replace(/[₹,\s]/g, ""))) && v.length > 2) || "E-Commerce Operator",
                grossTaxableAmount: nums[0] || 0, netValueSupplies: nums[1] || nums[0] || 0,
                tcsIgst: nums[2] || 0, tcsCgst: nums[3] || 0, tcsSgst: nums[4] || 0, rawCells: tds
              });
            }
          });
          return out;
        });
        result.ecommerceTcs.rows = tcsRows;
        result.ecommerceTcs.totalGrossTaxable = tcsRows.reduce((a, r) => a + (r.grossTaxableAmount || 0), 0);
        result.ecommerceTcs.totalNetValue = tcsRows.reduce((a, r) => a + (r.netValueSupplies || 0), 0);
        result.ecommerceTcs.totalTcs = tcsRows.reduce((a, r) => a + (r.tcsIgst + r.tcsCgst + r.tcsSgst), 0);
        dbg.steps.tcsRowCount = tcsRows.length;
      } else result.warnings.push("TDS/TCS Credit Received tile nahi mila.");
    } catch (err) {
      result.warnings.push("E-Commerce TCS fetch issue: " + err.message);
      dbg.steps.tcsError = err.message;
    }

    dbg.warnings = result.warnings;
    lastDebug = dbg;
    res.json(result);
  } finally {
    s.busy = false;
  }
});

app.post("/api/gst/upload-gstr1", async (req, res) => {
  const { sessionId, fy, month, jsonContent, fileName } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
  if (!jsonContent) return res.status(400).json({ ok: false, error: "GSTR-1 JSON content missing hai." });
  if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

  s.busy = true;
  const { page } = s;
  const tmpFile = path.join(os.tmpdir(), fileName || `GSTR1_${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpFile, typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent, null, 2), "utf8");
    await openReturnsDashboardAndSearch(page, fy || "2026-27", String(month || "10").padStart(2, "0"), null);
    const gstr1Card = page.locator("div").filter({ hasText: /GSTR-?1/i }).filter({ has: page.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')") }).last();
    const offlineBtn = gstr1Card.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')").first();
    if (!(await offlineBtn.count())) throw new Error("GSTR-1 PREPARE OFFLINE button nahi mila.");
    await offlineBtn.click({ force: true });
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
    res.json({ ok: true, message: "GSTR-1 JSON portal par upload ho gaya! Ab portal par jaakar sirf Submit & File (EVC/DSC) karein.", portalStatus: statusInfo });
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

app.listen(PORT, () => console.log(`GST Cloud Bridge v1.6.0 running on port ${PORT}`));
