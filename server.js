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

// Optional API Secret Guard
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!API_SECRET) return next();
  const provided = String(req.headers["x-api-secret"] || "").trim();
  if (provided !== API_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid x-api-secret" });
  }
  next();
});

// In-memory Playwright session store (auto-expires after 20 min idle)
const sessions = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000;

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
    if (now - s.lastActive > SESSION_TTL_MS) {
      closeSession(id);
    }
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
  const idx = parseInt(mm, 10) - 1;
  return MONTH_NAMES[idx] || "October";
}

function getQuarterForMonth(mm) {
  const m = parseInt(mm, 10);
  if (m >= 4 && m <= 6) return "Quarter 1 (Apr - Jun)";
  if (m >= 7 && m <= 9) return "Quarter 2 (Jul - Sep)";
  if (m >= 10 && m <= 12) return "Quarter 3 (Oct - Dec)";
  return "Quarter 4 (Jan - Mar)";
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "gst-cloud-bridge",
    activeSessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

// 1. INIT LOGIN -> Open GST Portal Login Page & Return CAPTCHA Image
app.post("/api/gst/init-login", async (req, res) => {
  let browser, context;
  try {
    // Close any stale sessions to stay safely within 512MB RAM on Render Free tier
    for (const oldId of Array.from(sessions.keys())) {
      await closeSession(oldId);
    }
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-zygote"
      ]
    });
    context = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      acceptDownloads: true
    });
    const page = await context.newPage();
    page.setDefaultTimeout(35000);

    await page.goto("https://services.gst.gov.in/services/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#username", { timeout: 25000 });

    // Wait for captcha image to load (triggered on username focus or page load)
    await page.click("#username");
    await page.waitForSelector("#imgCaptcha", { timeout: 15000 });
    await page.waitForFunction(() => {
      const img = document.querySelector("#imgCaptcha");
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 15000 }).catch(() => {});

    const captchaEl = await page.$("#imgCaptcha");
    if (!captchaEl) {
      throw new Error("GST Portal CAPTCHA image load nahi ho payi.");
    }
    const captchaBuffer = await captchaEl.screenshot({ type: "png" });
    const sessionId = crypto.randomUUID();

    sessions.set(sessionId, {
      browser,
      context,
      page,
      loggedIn: false,
      gstin: "",
      lastActive: Date.now()
    });

    res.json({
      ok: true,
      sessionId,
      captchaBase64: "data:image/png;base64," + captchaBuffer.toString("base64")
    });
  } catch (err) {
    try { if (context) await context.close(); } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}
    res.status(500).json({ ok: false, error: err.message || "Init login failed" });
  }
});

// 2. SUBMIT LOGIN -> Username + Password + Captcha
app.post("/api/gst/submit-login", async (req, res) => {
  const { sessionId, username, password, captcha } = req.body || {};
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ ok: false, error: "Session expired. Dobara Connect karein." });

  const { page } = s;
  try {
    await page.fill("#username", String(username || "").trim());
    await page.fill("#user_pass", String(password || ""));
    await page.fill("#captcha", String(captcha || "").trim());

    await Promise.all([
      page.click("button[type='submit'], button:has-text('LOGIN')"),
      page.waitForTimeout(3500)
    ]);

    // Check if OTP modal/page appeared
    const otpInput = await page.$("input[name='otp'], #otp, input[placeholder*='OTP' i]");
    if (otpInput && await otpInput.isVisible()) {
      return res.json({ ok: true, status: "otp_required", message: "GST Portal ne OTP manga hai. Registered mobile/email OTP enter karein." });
    }

    // Check for login error message
    const errMsg = await page.evaluate(() => {
      const el = document.querySelector(".err, .alert-danger, .text-danger, [ng-if*='err']");
      return el ? el.innerText.trim() : "";
    });

    const url = page.url();
    if (url.includes("/auth/") || url.includes("fowelcome") || url.includes("dashboard")) {
      s.loggedIn = true;
      return res.json({ ok: true, status: "logged_in", url });
    }

    // Refresh captcha if login failed
    let newCaptcha = null;
    const capEl = await page.$("#imgCaptcha");
    if (capEl) {
      const buf = await capEl.screenshot({ type: "png" });
      newCaptcha = "data:image/png;base64," + buf.toString("base64");
    }

    return res.status(400).json({
      ok: false,
      error: errMsg || "Login fail hua (Username, Password ya Captcha check karein).",
      captchaBase64: newCaptcha
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. SUBMIT OTP (if prompted)
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
    await page.waitForTimeout(3500);

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

// Helper: Navigate to Returns Dashboard & select FY + Quarter + Month
async function selectReturnPeriod(page, fy, monthNum) {
  await page.goto("https://return.gst.gov.in/returns/auth/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("select[name='fin'], #fin", { timeout: 25000 });

  const monthName = getMonthName(monthNum);
  const quarterName = getQuarterForMonth(monthNum);

  // Select Financial Year (e.g. "2026-27")
  await page.selectOption("select[name='fin'], #fin", { label: fy }).catch(async () => {
    await page.selectOption("select[name='fin'], #fin", fy).catch(() => {});
  });
  await page.waitForTimeout(800);

  // Select Quarter if present
  const qSel = await page.$("select[name='quarter'], #quarter");
  if (qSel) {
    await page.selectOption("select[name='quarter'], #quarter", { label: quarterName }).catch(() => {});
    await page.waitForTimeout(800);
  }

  // Select Period / Month
  await page.selectOption("select[name='mon'], #mon", { label: monthName }).catch(async () => {
    await page.selectOption("select[name='mon'], #mon", String(monthNum)).catch(() => {});
  });
  await page.waitForTimeout(500);

  await page.click("button:has-text('SEARCH'), button[type='submit']");
  await page.waitForTimeout(2500);
}

// 4. FETCH ALL 3 ITEMS: Notices, GSTR-2B, E-Commerce Platform Gross Taxable Amount (TCS)
app.post("/api/gst/fetch-all", async (req, res) => {
  const { sessionId, fy, month } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) {
    return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
  }

  const { page } = s;
  const result = {
    ok: true,
    fy: fy || "2026-27",
    month: String(month || "10").padStart(2, "0"),
    notices: [],
    gstr2b: { summary: null, jsonBase64: null, fileName: null },
    ecommerceTcs: { rows: [], totalGrossTaxable: 0, totalNetValue: 0, totalTcs: 0 },
    warnings: []
  };

  // --- A. FETCH NOTICES & ORDERS ---
  try {
    await page.goto("https://services.gst.gov.in/services/auth/viewnotices", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const noticeRows = await page.evaluate(() => {
      const rows = [];
      const trs = document.querySelectorAll("table tbody tr");
      trs.forEach(tr => {
        const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
        if (tds.length >= 4 && !tds[0].toLowerCase().includes("no records")) {
          rows.push({
            refNo: tds[0] || "",
            issuedBy: tds[1] || "",
            type: tds[2] || "",
            description: tds[3] || "",
            issueDate: tds[4] || "",
            dueDate: tds[5] || "",
            amount: tds[6] || ""
          });
        }
      });
      return rows;
    });
    result.notices = noticeRows;
  } catch (err) {
    result.warnings.push("Notices fetch issue: " + err.message);
  }

  // --- B. FETCH GSTR-2B ---
  try {
    await selectReturnPeriod(page, result.fy, result.month);

    // Click GSTR-2B DOWNLOAD button on Returns Dashboard
    const gstr2bCard = page.locator("div, .card, .panel").filter({ hasText: /GSTR-?2B/i }).first();
    const downloadBtn = gstr2bCard.locator("button:has-text('DOWNLOAD'), a:has-text('DOWNLOAD')").first();

    if (await downloadBtn.count()) {
      await downloadBtn.click();
      await page.waitForTimeout(2500);

      // Intercept JSON download from "GENERATE JSON FILE TO DOWNLOAD"
      const genJsonBtn = page.locator("button:has-text('GENERATE JSON'), a:has-text('GENERATE JSON')").first();
      if (await genJsonBtn.count()) {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 25000 }).catch(() => null),
          genJsonBtn.click()
        ]);
        if (download) {
          const tmpPath = await download.path();
          const rawJson = fs.readFileSync(tmpPath, "utf8");
          const parsed = JSON.parse(rawJson);
          result.gstr2b.fileName = download.suggestedFilename() || `GSTR2B_${result.month}${result.fy.slice(0, 4)}.json`;
          result.gstr2b.jsonBase64 = "data:application/json;base64," + Buffer.from(rawJson, "utf8").toString("base64");

          // Extract ITC Summary from official GSTR-2B JSON schema
          const itcSum = parsed?.data?.itcsumm?.itcavl?.nonrevsup || {};
          const ineligible = parsed?.data?.itcsumm?.itcunavl?.nonrevsup || {};
          result.gstr2b.summary = {
            igst: Number(itcSum.igst || 0),
            cgst: Number(itcSum.cgst || 0),
            sgst: Number(itcSum.sgst || 0),
            cess: Number(itcSum.cess || 0),
            ineligibleTotal: Number(ineligible.igst || 0) + Number(ineligible.cgst || 0) + Number(ineligible.sgst || 0),
            b2bSuppliersCount: Array.isArray(parsed?.data?.docdata?.b2b) ? parsed.data.docdata.b2b.length : 0,
            cdnrCount: Array.isArray(parsed?.data?.docdata?.cdnr) ? parsed.data.docdata.cdnr.length : 0
          };
        }
      }
    } else {
      result.warnings.push("GSTR-2B card ya Download button is period ke liye nahi mila.");
    }
  } catch (err) {
    result.warnings.push("GSTR-2B fetch issue: " + err.message);
  }

  // --- C. FETCH E-COMMERCE PLATFORM GROSS TAXABLE AMOUNT (TDS / TCS CREDIT RECEIVED) ---
  try {
    await selectReturnPeriod(page, result.fy, result.month);

    const tcsCard = page.locator("div, .card, .panel").filter({ hasText: /TDS and TCS Credit Received/i }).first();
    const prepBtn = tcsCard.locator("button:has-text('PREPARE ONLINE'), a:has-text('PREPARE ONLINE'), button:has-text('VIEW')").first();

    if (await prepBtn.count()) {
      await prepBtn.click();
      await page.waitForTimeout(3000);

      // Click TCS Credit Received tile
      const tcsTile = page.locator("div, a, button").filter({ hasText: /TCS Credit Received/i }).first();
      if (await tcsTile.count()) {
        await tcsTile.click();
        await page.waitForTimeout(2500);
      }

      const tcsRows = await page.evaluate(() => {
        const out = [];
        const trs = document.querySelectorAll("table tbody tr");
        trs.forEach(tr => {
          const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
          if (tds.length >= 6 && /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/i.test(tds.join(" "))) {
            const nums = tds.map(v => parseFloat(v.replace(/,/g, ""))).filter(n => !isNaN(n));
            out.push({
              ecoGstin: tds.find(v => /^[0-9]{2}[A-Z0-9]{13}$/i.test(v)) || tds[0],
              ecoName: tds[1] || tds[2] || "E-Commerce Operator",
              grossTaxableAmount: nums[0] || 0,
              netValueSupplies: nums[1] || nums[0] || 0,
              tcsIgst: nums[2] || 0,
              tcsCgst: nums[3] || 0,
              tcsSgst: nums[4] || 0,
              rawCells: tds
            });
          }
        });
        return out;
      });

      result.ecommerceTcs.rows = tcsRows;
      result.ecommerceTcs.totalGrossTaxable = tcsRows.reduce((acc, r) => acc + (r.grossTaxableAmount || 0), 0);
      result.ecommerceTcs.totalNetValue = tcsRows.reduce((acc, r) => acc + (r.netValueSupplies || 0), 0);
      result.ecommerceTcs.totalTcs = tcsRows.reduce((acc, r) => acc + (r.tcsIgst + r.tcsCgst + r.tcsSgst), 0);
    } else {
      result.warnings.push("TDS/TCS Credit Received tile is period ke liye nahi mila.");
    }
  } catch (err) {
    result.warnings.push("E-Commerce TCS fetch issue: " + err.message);
  }

  res.json(result);
});

// 5. UPLOAD GSTR-1 JSON (Prepare Offline -> Upload JSON)
app.post("/api/gst/upload-gstr1", async (req, res) => {
  const { sessionId, fy, month, jsonContent, fileName } = req.body || {};
  const s = getSession(sessionId);
  if (!s || !s.loggedIn) {
    return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
  }
  if (!jsonContent) {
    return res.status(400).json({ ok: false, error: "GSTR-1 JSON content missing hai." });
  }

  const { page } = s;
  const tmpFile = path.join(os.tmpdir(), fileName || `GSTR1_${Date.now()}.json`);
  try {
    const jsonStr = typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent, null, 2);
    fs.writeFileSync(tmpFile, jsonStr, "utf8");

    await selectReturnPeriod(page, fy || "2026-27", String(month || "10").padStart(2, "0"));

    const gstr1Card = page.locator("div, .card, .panel").filter({ hasText: /GSTR-?1/i }).first();
    const offlineBtn = gstr1Card.locator("button:has-text('PREPARE OFFLINE'), a:has-text('PREPARE OFFLINE')").first();
    if (!(await offlineBtn.count())) {
      throw new Error("GSTR-1 PREPARE OFFLINE button nahi mila.");
    }
    await offlineBtn.click();
    await page.waitForTimeout(2500);

    const fileInput = await page.$("input[type='file']");
    if (!fileInput) {
      throw new Error("JSON upload input field nahi mila.");
    }
    await fileInput.setInputFiles(tmpFile);
    await page.waitForTimeout(4000);

    const statusInfo = await page.evaluate(() => {
      const tr = document.querySelector("table tbody tr");
      const cells = tr ? Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim()) : [];
      const msgEl = document.querySelector(".alert-success, .alert-info, .err, .alert-danger");
      return {
        alertText: msgEl ? msgEl.innerText.trim() : "",
        latestRow: cells
      };
    });

    res.json({
      ok: true,
      message: "GSTR-1 JSON portal par upload ho gaya! Ab portal par jaakar sirf Submit & File (EVC/DSC) karein.",
      portalStatus: statusInfo
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
  }
});

// 6. LOGOUT
app.post("/api/gst/logout", async (req, res) => {
  const { sessionId } = req.body || {};
  await closeSession(sessionId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`GST Cloud Bridge running on port ${PORT}`);
});
