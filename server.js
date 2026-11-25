/* GST Cloud Bridge — v1.19.0 (login: portal downtime par khud retry) / v1.18.0 (login page robust) / v1.17.0 (period dropdown wait/iframe fix) / v1.16.0 (period select fix) / v1.15.0 (access-denied handling) / v1.14.0 (returns-dashboard retry + diagnostics) / v1.13.0 (app-contract) / v1.12.0 (parsing fixes)
 * Base: v1.9.6
 * v1.19.0 fixes (portal downtime / WAF ke baad login page khulta hi nahi tha):
 *  - Login page na khule aur wajah "portal_down"/"blank_page" ho to 45s ruk kar ek teesri koshish (auto-heal).
 *  - Baaki wajahon (access denied, already logged in, password change) par turant saaf error — bewajah lamba wait nahi.
 * v1.18.0 fixes ("page.waitForSelector: Timeout 30000ms exceeded ... locator('#username') to be visible"):
 *  - Login page kholne ke 2 koshish (pehle 30s, phir cache-buster ke saath 20s) + har field ke alternate
 *    selectors (id badal jaye to bhi chale) — pehle sirf #username ka 30s wait tha.
 *  - Login page na khule to portal ne kya dikhaya wo classify hota hai (already_logged_in / password_change /
 *    portal_down / blank_page / access_denied) aur error me saaf wajah + kya karein aata hai.
 *  - submit-login bhi wahi selectors use karta hai (session me yaad rehte hain).
 * v1.17.0 fixes ("FY:true, Month:false — Dropdowns mile -> select0: 2019-20/2020-21/..."):
 *  - FY set hone ke baad Month/Quarter dropdown ka 12-15s tak intezaar (waitForPeriodSelect) — pehle
 *    sirf 1.2s dekha jata tha, isliye der se render hone wale dashboard par month "gayab" milta tha.
 *  - Period dropdown na dikhe to page reload ka intezaar + aage badhne wale buttons (GET DETAILS / PROCEED /
 *    CONTINUE / SUBMIT / SEARCH) try karke dobara dekhte hain (revealPeriodDropdown).
 *  - Naye portal par Returns Dashboard andar ke iframe me ho sakta hai -> findPeriodFrame se wahan ke
 *    selects bhi padhte/select karte hain (main page par sirf FY milta tha).
 *  - Month options ab numeric bhi pehchane jate hain ("10", "10/2026"); matching pehle exact phir substring
 *    (warna "10" "2010-11" me match ho jata).
 *  - Fail par error me page title/URL + har dropdown ke POORE options (+ frames) aate hain, aur QRMP
 *    (sirf Quarter) case ki alag wajah likhi jati hai.
 * v1.16.0 fixes ("Portal par period select nahi ho paya (FY:true, Quarter:false, Month:false)"):
 *  - Portal ke FY/Quarter/Month <select> ab naam/options se PEHCHANE jate hain (readSelectOptions +
 *    guessSelectIndex) — pehle sirf text se dhundha jata tha, isliye galti se doosra dropdown select ho jata tha.
 *  - Quarter ke label variants ("Quarter 3" / "Q3" / "Oct - Dec") aur month ke year-wale labels
 *    ("Oct-2026") bhi match hote hain; bare "Oct" nahi (warna quarter ke "Oct - Dec" se match ho jata tha).
 *  - Options AJAX se der se aate hain -> 600ms polling (FY 9s, quarter 6s, month 9s) + poora period 2 baar.
 *  - Quarter optional: dropdown hi na ho to bhi month se period pakka hota hai (pehle quarter na milne par
 *    fetch rok diya jata tha). FY + Month match hona ab zaroori shart hai.
 *  - Fail par error me asli dropdown options aate hain ("Dropdowns mile -> fy: ... | mon: ...").
 * v1.15.0 fixes (production me mila: /services/error/accessdenied):
 *  - Fail page ko classify karta hai: access_denied / concurrent_session / gstin_inactive / session_expired / unknown
 *  - Access Denied (ya "already logged in") par cooldown + Auth Dashboard se fresh click wala retry,
 *    phir bhi na chale to user ke liye saaf wajah + kya karein (logout / 5-10 min baad / GSTIN status check)
 * v1.14.0 fixes ("page.waitForSelector: Timeout 25000ms" / "'TDS and TCS credit received' link nahi mila" wala case):
 *  - Returns Dashboard na khule to ek retry: seedha return.gst.gov.in/returns/auth/dashboard kholta hai
 *  - Click se naya tab (popup) khule to us page ko adopt karta hai (pehle purane tab par atka reh jata tha)
 *  - Dropdown ka wait 25s -> 40s (portal slow ho to), modals zyada tarah se dismiss (Proceed/Continue/Esc)
 *  - Fail hone par error me ASLI page ka URL/title/visible buttons aate hain + debug me `*_stuck` snapshot
 *  - TCS menu link na mile to page ke TDS/TCS/returns links debug me (`tcsLinks`) — agla fix aasan
 * v1.13.0 fixes (Drive ke app v5.4 — gst_client_tracker.html — ke contract ke hisaab se):
 *  - b2bSellers me ab har seller ke saath `invoices[]` bhi jata hai (num/dt/val/txval/igst/cgst/sgst/cess/
 *    rate/itcavl/rev) + `supfildt` + `cess`. App ka B2B modal isi shape par chalta hai; `invoices` na hone se
 *    wo apna fallback parser chalata tha jo 2B ki iamt/camt/samt keys nahi padhta (modal + sheet me tax 0).
 *    ZIP 2B par bhi ab invoice-level detail milti hai.
 *  - `partial` contract: kuch section fail + kuch ok -> ok:true + partial{gstr2b,tcs,notices,text}, taaki app
 *    jo mila wo save kare aur fail section ka purana data rakhe. Sab maange gaye section fail -> ok:false.
 * v1.12.0 fixes (npm test se pakde gaye):
 *  - GSTR-2B B2B sellers: 2B JSON me items `itms[].itm_det{txval,iamt,camt,samt}` me hote hain — pehle
 *    `items[].igst/cgst/sgst` padha ja raha tha, isliye har supplier ka taxable/tax 0 aata tha
 *  - Galat month (0/13/abc) par pehle chupchaap "October"/"Quarter 4" select hota tha (galat period ka data) —
 *    ab 400 error, aur dropdown khaali text par match nahi karta
 *  - Notices: 4-cell wali koi bhi table (late fee/footer) notice ban jati thi — ab date/reference wali row hi notice hai;
 *    "31-Oct-2026" jaisi date par bhi layout sahi padhta hai
 *  - Unknown route / bad JSON body par JSON error (express ka HTML nahi); submit-otp par busy-guard
 *  - Test: `npm test` (pure helpers + HTTP endpoints, browser ke bina)
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

// Galat month (0, 13...) par khaali string — pehle chupchaap "October"/"Quarter 4" ban jata tha
// (us se client ka data galat period ka fetch ho jata tha).
function getMonthName(mm) {
  const m = parseInt(mm, 10);
  return m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : "";
}
function getQuarterForMonth(mm) {
  const m = parseInt(mm, 10);
  if (m >= 4 && m <= 6) return "Quarter 1";
  if (m >= 7 && m <= 9) return "Quarter 2";
  if (m >= 10 && m <= 12) return "Quarter 3";
  if (m >= 1 && m <= 3) return "Quarter 4";
  return "";
}
// fy "2026-27", mm "10" -> "102026" ; mm "02" -> "022027"
function periodFor(fy, mm) {
  const start = parseInt(String(fy).slice(0, 4), 10);
  const m = parseInt(mm, 10);
  if (!start || !(m >= 1 && m <= 12)) return "";
  return String(m).padStart(2, "0") + (m >= 4 ? start : start + 1);
}

// Request se aane wala fy/month ek jagah validate hota hai (fetch-all + upload-gstr1 dono ke liye)
function normalizePeriod(fy, month) {
  const fyIn = fy == null || String(fy).trim() === "" ? "2026-27" : String(fy).trim();
  const mRaw = month == null || String(month).trim() === "" ? "10" : String(month).trim();
  if (!/^\d{4}-\d{2,4}$/.test(fyIn)) return { ok: false, error: `FY "${fyIn}" galat format me hai (sahi example: 2026-27).` };
  const m = parseInt(mRaw, 10);
  if (!(m >= 1 && m <= 12) || String(m) !== mRaw.replace(/^0+(?=\d)/, "")) {
    return { ok: false, error: `Month "${mRaw}" galat hai — 1 se 12 ke beech ka number dein (jaise 10).` };
  }
  const mm = String(m).padStart(2, "0");
  return { ok: true, fy: fyIn, month: mm, period: periodFor(fyIn, mm) };
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

const NOTICE_DATE_RE = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/;
const NOTICE_DATE2_RE = /^\d{1,2}[-\s,]+[A-Za-z]{3,9}[-\s,]+\d{2,4}$/; // "31-Oct-2026", "31 Oct, 2026"
const isNoticeDate = v => { const s = String(v || "").trim(); return NOTICE_DATE_RE.test(s) || NOTICE_DATE2_RE.test(s); };
// Reference No / ARN jaisa kuch (kam se kam 8 char, usme digit bhi ho, sirf amount nahi)
const isNoticeRef = v => {
  const s = String(v || "").trim();
  return s.length >= 8 && /\d/.test(s) && /[A-Za-z]/.test(s) && !/^[\d,.\s()-]+$/.test(s);
};

function parseNoticeTables(tables) {
  const out = [];
  for (const tbl of tables || []) {
    const labels = buildColumnLabels(tbl.head);
    for (const tds of tbl.body || []) {
      // Notices page ki table hi nahi hoti — 4-cell wali koi bhi doosri table (late fee, footer,
      // totals) notice ban jati thi. Isliye row me date ya reference-jaisa kuch hona zaroori hai.
      if (tds.length < 4 || tds.join(" ").toLowerCase().includes("no records")) continue;
      if (!tds.some(isNoticeDate) && !tds.some(isNoticeRef)) continue;
      // Portal ka dekha hua layout: Ref No | Type | Description | Date | Due/Response | View
      // (date "31/10/2026" ya "31-Oct-2026" — dono format par layout yahi rehta hai)
      const portalLayout = tds.length >= 5 && isNoticeDate(tds[3]);
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

/* ---- GSTR-2B B2B sellers list (app ka "B2B Sellers / Invoices" modal isi se banta hai) ----
 * 2B JSON me invoice items `inv.itms[].itm_det{txval,iamt,camt,samt,csamt}` me hote hain —
 * `items[].igst/cgst/sgst` (GSTR-1 style) 2B me nahi hota.
 * App har seller ke saath `invoices[]` expect karta hai (warna wo apna fallback parser chalata hai);
 * isliye yahan invoice-level detail bhi bhejte hain, app ke field names ke saath:
 *   num, dt, val, txval, igst, cgst, sgst, cess, rate, itcavl, rev
 */
function buildB2bSellers(parsedList) {
  const map = new Map();
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  // 2B keys (iamt/camt/samt/csamt) pehle, phir GSTR-1 style keys (igst/cgst/sgst/cess)
  const pick = (o, a, b) => (o && o[a] !== undefined && o[a] !== null && o[a] !== "" ? o[a] : (o ? o[b] : undefined));
  for (const parsed of parsedList || []) {
    const b2b = Array.isArray(parsed?.data?.docdata?.b2b) ? parsed.data.docdata.b2b : [];
    for (const sup of b2b) {
      const invs = Array.isArray(sup.inv) ? sup.inv : [];
      const gstin = String(sup.ctin || "").trim().toUpperCase();
      const key = gstin || String(sup.trdnm || "Supplier");
      const cur = map.get(key) || {
        name: String(sup.trdnm || sup.ctin || "Supplier").trim(), gstin, supfildt: "",
        invCount: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, invoices: []
      };
      if (!cur.supfildt && sup.supfildt) cur.supfildt = String(sup.supfildt).trim();
      for (const inv of invs) {
        const items = Array.isArray(inv.itms) ? inv.itms : (Array.isArray(inv.items) ? inv.items : []);
        let tx = 0, ig = 0, cg = 0, sg = 0, cs = 0;
        const rates = new Set();
        if (items.length) {
          for (const it of items) {
            const d = it.itm_det || it.itm || it || {};
            tx += num(d.txval);
            ig += num(pick(d, "iamt", "igst"));
            cg += num(pick(d, "camt", "cgst"));
            sg += num(pick(d, "samt", "sgst"));
            cs += num(pick(d, "csamt", "cess"));
            if (d.rt !== undefined && d.rt !== null && d.rt !== "") rates.add(String(d.rt) + "%");
          }
        } else {
          // Items hi nahi hain (kabhi 2B me sirf invoice level values hoti hain).
          // txval na ho to invoice value (val) — wo tax ke saath hota hai, isliye sirf last resort.
          tx = num(pick(inv, "txval", "val"));
          ig = num(pick(inv, "iamt", "igst"));
          cg = num(pick(inv, "camt", "cgst"));
          sg = num(pick(inv, "samt", "sgst"));
          cs = num(pick(inv, "csamt", "cess"));
          if (inv.rt !== undefined && inv.rt !== null && inv.rt !== "") rates.add(String(inv.rt) + "%");
        }
        cur.invoices.push({
          num: String(inv.inum || inv.invnum || "").trim(),
          dt: String(pick(inv, "idt", "dt") || inv.inv_dt || "").trim(),
          val: r2(inv.val !== undefined && inv.val !== null && inv.val !== "" ? inv.val : (tx + ig + cg + sg + cs)),
          txval: r2(tx), igst: r2(ig), cgst: r2(cg), sgst: r2(sg), cess: r2(cs),
          rate: Array.from(rates).join("/"),
          itcavl: String(inv.itcavl || "Y").trim().toUpperCase(),
          rev: String(pick(inv, "rev", "rchrg") || "N").trim().toUpperCase()
        });
        cur.invCount += 1;
        cur.taxable += tx; cur.igst += ig; cur.cgst += cg; cur.sgst += sg; cur.cess += cs;
      }
      map.set(key, cur);
    }
  }
  return Array.from(map.values()).map(x => ({
    name: x.name, gstin: x.gstin, supfildt: x.supfildt, invCount: x.invCount,
    taxable: r2(x.taxable), igst: r2(x.igst), cgst: r2(x.cgst), sgst: r2(x.sgst), cess: r2(x.cess),
    invoices: x.invoices
  }));
}

/* ---- Section outcome (app ke `partial` contract ke liye) ----
 * App ek hi request me 2B + TCS maangta hai. Pehle bridge kisi ek section ke fail hone par
 * poora response ok:false kar deta tha -> app kuch bhi save nahi karta tha (jo mila wo bhi loss).
 * Ab: sab maange gaye section fail -> ok:false (kuch save na ho);
 *     kuch fail + kuch ok    -> ok:true + partial{...}, app sirf fail section ka purana data rakhta hai.
 */
function partialOutcome(status, opts) {
  const asked = [], failed = [];
  const check = (key, label) => {
    asked.push(label);
    const st = status && status[key];
    if (st && st.state === "failed") failed.push(label + ": " + (st.message || "fetch nahi hua"));
  };
  if (opts && opts.gstr2b) check("gstr2b", "GSTR-2B");
  if (opts && opts.tcs) check("tcs", "E-Com TCS");
  if (opts && opts.notices) check("notices", "Notices");
  const allFailed = failed.length > 0 && failed.length >= asked.length;
  const partial = failed.length && !allFailed ? {
    gstr2b: !!(opts && opts.gstr2b) && status?.gstr2b?.state === "failed",
    tcs: !!(opts && opts.tcs) && status?.tcs?.state === "failed",
    notices: !!(opts && opts.notices) && status?.notices?.state === "failed",
    text: "Adhoora fetch — " + failed.join(" | ")
  } : null;
  return { asked, failed, allFailed, partial };
}

/* ======================= PORTAL (Playwright) HELPERS — browser ke bina testable ======================= */
const RETURNS_DASHBOARD_URL = "https://return.gst.gov.in/returns/auth/dashboard";
const GST_AUTH_DASHBOARD_URL = "https://services.gst.gov.in/services/auth/dashboard";

async function dismissModals(page) {
  const selectors = [
    "button:has-text('Remind me later')", "button:has-text('CLOSE')", "button:has-text('OK')", ".modal .close",
    "button:has-text('Proceed')", "button:has-text('Continue')", "button:has-text('I Agree')"
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(350);
    }
  }
  // Kuch modals sirf Esc se band hote hain
  try { if (page.keyboard) await page.keyboard.press("Escape"); } catch (_) {}
}

// Dropdown ke options page par der se aate hain (Angular/AJAX) — isliye polling wala select.
// `also` = alternative labels (Quarter "Q3"/"Oct - Dec", month "Oct-2026"), `selectIndex` = sirf usi select me.
async function selectDropdownByText(page, targetText, opts) {
  const o = opts || {};
  const texts = [targetText, ...(Array.isArray(o.also) ? o.also : [])]
    .map(t => String(t == null ? "" : t).trim().toLowerCase()).filter(Boolean);
  // Khaali text par har option match ho jata tha ("" sab me includes hai) -> galat period select
  if (!texts.length) return { matched: false, reason: "empty" };
  const index = Number.isInteger(o.selectIndex) ? o.selectIndex : -1;
  const timeoutMs = Number(o.timeoutMs) || 0;
  const maxTries = timeoutMs ? Math.max(1, Math.ceil(timeoutMs / 600)) : 1;
  let last = { matched: false };
  for (let i = 1; i <= maxTries; i++) {
    last = await page.evaluate((args) => {
      const selects = Array.from(document.querySelectorAll("select"));
      const pool = args.index >= 0 ? selects.filter((_, idx) => idx === args.index) : selects;
      const norm = t => String(t == null ? "" : t).trim().toLowerCase();
      // Pehle poora match (warna "10" jaise numeric month "2010-11" me bhi match ho jata), phir substring
      for (const exact of [true, false]) {
        for (const sel of pool) {
          const list = Array.from(sel.options);
          for (const want of args.texts) {
            const opt = list.find(x => (exact ? norm(x.text) === want : norm(x.text).includes(want)));
            if (opt) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              return { matched: true, name: sel.name || sel.id || "", option: (opt.text || "").trim(), tryNo: args.tryNo };
            }
          }
        }
      }
      return { matched: false, tryNo: args.tryNo, seen: pool.map(x => Array.from(x.options).map(y => (y.text || "").trim()).slice(0, 6)) };
    }, { texts, index, tryNo: i });
    if (last.matched) return last;
    if (i < maxTries) await page.waitForTimeout(600);
  }
  return last;
}

// Kisi option ka label month lagta hai? ("October", "Oct-2026", "10", "10/2026")
function isMonthOption(o) {
  const s = String(o == null ? "" : o).trim();
  if (!s) return false;
  if (/^\d{1,2}$/.test(s)) return Number(s) >= 1 && Number(s) <= 12;
  const dmy = s.match(/^(\d{1,2})\s*[-\/.]\s*(\d{4})$/);
  if (dmy) return Number(dmy[1]) >= 1 && Number(dmy[1]) <= 12;
  const low = s.toLowerCase();
  return MONTH_NAMES.some(n => low.startsWith(n.slice(0, 3).toLowerCase()));
}

// Quarter ka label? ("Quarter 3", "Q3", "Oct - Dec", "OctDec")
function isQuarterOption(o) {
  return /quart|\bqtr\b|\bq[1-4]\b|apr\s*-\s*jun|jul\s*-\s*sep|oct\s*-\s*dec|jan\s*-\s*mar|aprjun|julsep|octdec|janmar/i
    .test(String(o == null ? "" : o));
}

// Page par period chunne wala dropdown (Month ya Quarter) aa gaya?
function hasPeriodSelect(dump) {
  const rows = Array.isArray(dump) ? dump : [];
  return rows.some(r => (r.options || []).filter(isMonthOption).length >= 3)
    || rows.some(r => (r.options || []).filter(isQuarterOption).length >= 2);
}

// FY badalne ke baad portal Month/Quarter dropdown AJAX se der se render karta hai (kabhi page reload
// ke baad) — production me 1.2s wait me sirf FY wala select mila tha, month gayab tha.
async function waitForPeriodSelect(page, timeoutMs) {
  const limit = Number(timeoutMs) || 0;
  const started = Date.now();
  let dump = [];
  let tries = 0;
  while (tries++ < 200) {
    dump = await readSelectOptions(page);
    if (hasPeriodSelect(dump)) return { ok: true, dump, tries };
    if (Date.now() - started >= limit) break;
    await page.waitForTimeout(700);
  }
  return { ok: false, dump, tries };
}

// Period dropdown na dikhe to portal ke "aage badhne" wale buttons (PROCEED/GET DETAILS/SEARCH...) try
// karte hain — kai layouts par month list inhi ke click se load hoti hai.
async function revealPeriodDropdown(page) {
  const names = ["GET DETAILS", "PROCEED", "CONTINUE", "SUBMIT", "SEARCH"];
  const clicked = [];
  for (const name of names) {
    const btn = page.locator(`button:has-text('${name}'), a:has-text('${name}'), input[value='${name}']`).first();
    if (!(await btn.count().catch(() => 0))) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.click({ force: true, timeout: 8000 }).catch(() => {});
    clicked.push(name);
    await page.waitForTimeout(2500);
    if (clicked.length >= 2) break;
  }
  return { clicked };
}

// Naye portal par kabhi Returns Dashboard andar ke iframe me hota hai — wahan ke selects alag hote hain.
// Main page par period dropdown na mile to child frames me dhundhte hain (wo frame hi select karne ke kaam aata hai).
async function findPeriodFrame(page) {
  let frames = [];
  try { frames = typeof page.frames === "function" ? (page.frames() || []) : []; } catch (_) { return null; }
  const main = page.mainFrame && typeof page.mainFrame === "function" ? page.mainFrame() : null;
  for (let i = 0; i < frames.length && i < 8; i++) {
    const f = frames[i];
    if (!f || (main && f === main)) continue;
    if (typeof f.evaluate !== "function") continue;
    const dump = await readSelectOptions(f).catch(() => []);
    if (hasPeriodSelect(dump)) return { frame: f, index: i, url: (typeof f.url === "function" ? f.url() : "") || "", dump };
  }
  return null;
}

// Page ke saare select + unke options (kaun sa FY/Quarter/Month hai, ye pata karne ke liye)
async function readSelectOptions(page) {
  const dump = await page.evaluate(() => Array.from(document.querySelectorAll("select")).map((s, i) => ({
    i, name: String(s.name || s.id || "").slice(0, 40),
    options: Array.from(s.options).map(o => String(o.text || "").trim()).filter(Boolean).slice(0, 15)
  }))).catch(() => []);
  return Array.isArray(dump) ? dump : [];
}

// Kaun sa <select> FY / Quarter / Month hai — naam se, aur naam na ho to options dekh kar
function guessSelectIndex(dump, kind) {
  const rows = Array.isArray(dump) ? dump : [];
  const nameRe = kind === "fy" ? /fy|financ|year/i : kind === "quarter" ? /quart|qtr/i : /mon|period|month/i;
  const byName = rows.findIndex(r => nameRe.test(String((r && r.name) || "")));
  if (byName >= 0) return byName;
  if (kind === "fy") return rows.findIndex(r => (r.options || []).some(o => /^\d{4}-\d{2,4}$/.test(String(o))));
  if (kind === "quarter") return rows.findIndex(r => (r.options || []).filter(isQuarterOption).length >= 2);
  return rows.findIndex(r => (r.options || []).filter(isMonthOption).length >= 3);
}

// Portal par quarter ke label jagah-jagah alag hote hain: "Quarter 3", "Q3", "Oct - Dec"
function quarterAliases(mm) {
  const m = parseInt(mm, 10);
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : (m >= 10 && m <= 12 ? 3 : 4);
  const span = { 1: "Apr - Jun", 2: "Jul - Sep", 3: "Oct - Dec", 4: "Jan - Mar" }[q];
  return ["Quarter " + q, "Quarter-" + q, "Qtr " + q, "Q" + q, span, span.replace(/ /g, "")];
}

// Month ke alternatives — sirf year wale (bare "Oct" quarter ke "Oct - Dec" se match ho jata hai)
function monthAliases(mm, fy) {
  const m = parseInt(mm, 10);
  if (!(m >= 1 && m <= 12)) return [];
  const start = parseInt(String(fy || "").slice(0, 4), 10) || 0;
  const year = start ? (m >= 4 ? start : start + 1) : 0;
  const name = MONTH_NAMES[m - 1];
  const short = name.slice(0, 3);
  const pad = String(m).padStart(2, "0");
  const out = [name];
  if (year) out.push(`${short}-${year}`, `${short} ${year}`, `${short}/${year}`, `${pad}-${year}`, `${pad}/${year}`);
  // Sirf-numeric month list ("01".."12") — exact match wali pass me hi lagta hai
  out.push(String(m), pad);
  return out;
}

/* Portal ne kaun sa "block" page dikhaya — ye pata hona zaroori hai, warna retry andha hota hai.
 * (Production me dekha: https://services.gst.gov.in/services/error/accessdenied) */
function classifyStuckPage(snap) {
  const url = String((snap && snap.url) || "");
  const title = String((snap && snap.title) || "");
  const text = String((snap && snap.text) || "");
  const all = url + " " + title + " " + text;
  if (/access\s*denied|accessdenied/i.test(all)) {
    return {
      kind: "access_denied",
      hint: "Portal ne Access Denied diya. Aksar wajah: (1) yahi GSTIN kisi doosre device/browser par pehle se login hai, " +
        "(2) bahut jaldi-jaldi logins (portal ka WAF/rate limit), (3) GSTIN cancelled/suspended hai, ya (4) multi-GSTIN login me GSTIN select nahi hua. " +
        "Portal par purana session logout karke (ya 5-10 min baad) dobara Fetch karein."
    };
  }
  if (/already\s*logged\s*in|logged\s*in\s*from|another\s+(device|session|browser|system)/i.test(all)) {
    return {
      kind: "concurrent_session",
      hint: "Is GSTIN ka session portal par pehle se khula hai (doosra device/browser). Portal par 'Logout' karke ya 10 min baad dobara Fetch karein."
    };
  }
  if (/\bcancel+ed\b|suspended|inactive\s+gstin|not\s+active/i.test(all)) {
    return { kind: "gstin_inactive", hint: "Client ka GSTIN portal par cancelled/suspended lagta hai — portal par status check karein." };
  }
  if (/session\s*(is\s*)?(expired|timed?\s*out)|please\s+login|login\s+again|invalid\s+session/i.test(all)) {
    return { kind: "session_expired", hint: "Portal session expire ho gaya — dobara Fetch (naya captcha+OTP) karein." };
  }
  return { kind: "unknown", hint: "Portal ne apni normal Returns Dashboard nahi dikhai. /debug ke stuck snapshot (page text) se wajah pata chalegi." };
}

// Portal ke login page ke fields — id kabhi badal jate hain, isliye har field ke kai selector.
// (Production: "waiting for locator('#username') to be visible" timeout — page hi login page nahi tha.)
const LOGIN_USER_SELECTORS = ["#username", "input[name='username']", "input[id*='user' i][type='text']", "input[placeholder*='username' i]"];
const LOGIN_PASS_SELECTORS = ["#user_pass", "input[type='password']", "input[name='password']"];
const LOGIN_CAPTCHA_SELECTORS = ["#captcha", "input[name='captcha']", "input[id*='captcha' i]"];
const LOGIN_SUBMIT_SELECTORS = ["button[type='submit']", "button:has-text('LOGIN')", "#loginBtn", "input[type='submit']"];

// Pehla selector jo page par dikh raha hai (na mile to null)
async function firstVisibleSelector(page, selectors) {
  for (const sel of Array.isArray(selectors) ? selectors : []) {
    try {
      const loc = page.locator(sel);
      const first = loc && typeof loc.first === "function" ? loc.first() : null;
      if (!first) continue;
      if (((await first.count().catch(() => 0)) || 0) === 0) continue;
      if (await first.isVisible().catch(() => false)) return sel;
    } catch (_) {}
  }
  return null;
}

// Login form ka intezaar — username/password dono dhundhta hai (polling, kyunki portal slow ho sakta hai)
async function waitForLoginForm(page, timeoutMs) {
  const limit = Number(timeoutMs) || 0;
  const started = Date.now();
  let tries = 0;
  while (tries++ < 200) {
    const userSel = await firstVisibleSelector(page, LOGIN_USER_SELECTORS);
    if (userSel) {
      const passSel = await firstVisibleSelector(page, LOGIN_PASS_SELECTORS);
      return { ok: true, userSel, passSel };
    }
    if (Date.now() - started >= limit) break;
    await page.waitForTimeout(800);
  }
  return { ok: false };
}

// In wajahon par login page khud theek ho sakta hai (portal downtime/WAF) -> thoda ruk kar ek aur koshish
const LOGIN_RETRY_KINDS = ["portal_down", "blank_page"];

// Login page ki jagah portal ne kya dikhaya — user ko exact wajah batane ke liye
function classifyLoginPage(snap) {
  const base = classifyStuckPage(snap);
  if (base.kind !== "unknown") return base;
  const url = String((snap && snap.url) || "");
  const title = String((snap && snap.title) || "");
  const text = String((snap && snap.text) || "");
  const all = url + " " + title + " " + text;
  if (/\/auth\/dashboard|\/returns\/auth\//i.test(url) || /returns\s+dashboard/i.test(all)) {
    return {
      kind: "already_logged_in",
      hint: "Portal is browser ko pehle se logged in maan raha hai (login page ki jagah dashboard dikha) — us client ka purana session logout karein ya 10 min ruk kar dobara Fetch karein."
    };
  }
  if (/change\s+password|password\s+(expired|expiry)|reset\s+password/i.test(all)) {
    return { kind: "password_change", hint: "Portal password change/expiry ka page dikha raha hai — portal par manually login karke password set karein, phir Fetch karein." };
  }
  if (/maintenance|under\s+maintenance|service\s+unavailable|try\s+again\s+later|502|503/i.test(all)) {
    return { kind: "portal_down", hint: "Portal maintenance/overload par lagta hai — 10-15 min baad dobara Fetch karein." };
  }
  if (!text.trim()) {
    return { kind: "blank_page", hint: "Portal ne khaali page diya (network/WAF block) — internet check karke 2-3 min baad dobara Fetch karein." };
  }
  return base;
}

async function waitForDashboardSelects(page, timeoutMs) {
  try { await page.waitForSelector("select", { timeout: timeoutMs }); return true; } catch (_) { return false; }
}

// Fail hone par "page par kya dikh raha hai" — error message + /debug dono me jata hai
async function pageSnapshotBrief(page) {
  const info = await page.evaluate(() => {
    const clean = t => String(t || "").replace(/\s+/g, " ").trim();
    const vis = el => el.offsetParent !== null;
    return {
      url: location.href, title: document.title,
      selects: document.querySelectorAll("select").length,
      visibleSelects: Array.from(document.querySelectorAll("select")).filter(vis).length,
      text: clean(document.body.innerText).slice(0, 500),
      buttons: Array.from(document.querySelectorAll("button, a.btn, a[role='button']")).filter(vis).map(b => clean(b.innerText)).filter(Boolean).slice(0, 12)
    };
  }).catch(e => ({ error: String((e && e.message) || e) }));
  return info || {};
}

// Click se naya tab khula ho to us page ko apna lein (warna hum purane tab par atke rehte hain)
async function adoptNewPopupPage(context, currentPage, pagesBefore) {
  if (!context || typeof context.pages !== "function") return currentPage;
  let pages = [];
  try { pages = context.pages() || []; } catch (_) { return currentPage; }
  if (pages.length <= pagesBefore) return currentPage;
  const np = pages[pages.length - 1];
  try { await np.waitForLoadState("domcontentloaded", { timeout: 15000 }); } catch (_) {}
  return np;
}

/* Returns Dashboard kholna + FY/Quarter/Month select karna.
 * Fail hone par ek retry (seedha return.gst.gov.in URL), aur phir bhi fail ho to ASLI page ka
 * diagnostic error deta hai (pehle sirf "waitForSelector Timeout 25000ms" aata tha — pata hi nahi
 * chalta tha ki portal ne kaun sa page dikhaya tha).
 * Returns: page (popup adopt hua ho to naya page) — caller ko isi page se aage kaam karna chahiye.
 */
async function openReturnsDashboardAndSearch(page, fy, monthNum, dbg, tag) {
  const t = tag || "ret";
  const step = (k, v) => { if (dbg && dbg.steps) dbg.steps[t + "_" + k] = v; };
  const context = typeof page.context === "function" ? page.context() : null;
  const pagesBefore = context && typeof context.pages === "function" ? (context.pages() || []).length : 0;
  const startedOn = page;

  await dismissModals(page);
  if (!String(page.url() || "").includes("/returns/auth/dashboard")) {
    const retBtn = page.locator("button:has-text('RETURN DASHBOARD'), a:has-text('RETURN DASHBOARD'), span:has-text('RETURN DASHBOARD')").first();
    if (await retBtn.isVisible().catch(() => false)) {
      await retBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(4500);
    } else {
      // Koi cheez (e.g. modal) click rok rahi ho to page par link dhundh kar click karte hain
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const retLink = links.find(a => /returns dashboard/i.test(a.textContent || "") || (a.getAttribute("href") || "").includes("/returns/auth/dashboard"));
        if (retLink) retLink.click();
      }).catch(() => {});
      await page.waitForTimeout(4500);
    }
    page = await adoptNewPopupPage(context, page, pagesBefore);
  }
  await dismissModals(page);
  if (page !== startedOn) step("adoptedPopup", page.url());
  step("urlBeforeSelect", page.url());

  let ok = await waitForDashboardSelects(page, 40000);
  let stuck = null;
  if (!ok) {
    // Retry 1: kabhi menu click navigate nahi karta; WAF/portal slow hone par 40s bhi kam pad jate hain
    const snap1 = await pageSnapshotBrief(page);
    step("selectTimeoutAt", Object.assign({ url: page.url(), kind: classifyStuckPage(snap1).kind }, snap1));
    await page.goto(RETURNS_DASHBOARD_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3000);
    await dismissModals(page);
    page = await adoptNewPopupPage(context, page, pagesBefore);
    ok = await waitForDashboardSelects(page, 25000);
    if (!ok) stuck = await pageSnapshotBrief(page);
  }
  if (!ok) {
    const cls = classifyStuckPage(stuck);
    step("stuck", Object.assign({ kind: cls.kind }, stuck));

    // Retry 2 (sirf Access Denied / concurrent session par): portal ko thoda "cool down" do, phir
    // Auth Dashboard se fresh click — direct URL goto se portal ka WAF aksar naraz hota hai.
    if (cls.kind === "access_denied" || cls.kind === "concurrent_session") {
      await page.waitForTimeout(cls.kind === "concurrent_session" ? 4000 : 8000);
      await page.goto(GST_AUTH_DASHBOARD_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(3000);
      await dismissModals(page);
      page = await adoptNewPopupPage(context, page, pagesBefore);
      const retryBtn = page.locator("button:has-text('RETURN DASHBOARD'), a:has-text('RETURN DASHBOARD'), span:has-text('RETURN DASHBOARD')").first();
      if (await retryBtn.isVisible().catch(() => false)) {
        await retryBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(5000);
        page = await adoptNewPopupPage(context, page, pagesBefore);
      }
      ok = await waitForDashboardSelects(page, 30000);
      if (ok) step("dashboardAfterBlockRetry", page.url());
      else stuck = await pageSnapshotBrief(page);
    }
    if (!ok) {
      const cls2 = classifyStuckPage(stuck);
      step("stuck2", Object.assign({ kind: cls2.kind }, stuck));
      const where = (stuck && stuck.url) || page.url() || "?";
      const hint2 = (stuck && stuck.title) ? " (" + stuck.title + ")" : "";
      const finalHint = cls2.hint || cls.hint;
      throw new Error(`Returns Dashboard access nahi mila${hint2}. Aakhri page: ${where}. ${finalHint} [${t}_stuck dekhein]`);
    }
  }

  // Har dropdown ko pehchan kar select karna (options der se aate hain, isliye polling) + ek retry
  let periodHost = null; // period selection kahan hui (main page ya andar ka iframe)
  const periodAttempt = async (attempt) => {
    let dump = await readSelectOptions(page);
    if (attempt === 1) step("selects", dump);
    let fyRes = await selectDropdownByText(page, fy, { selectIndex: guessSelectIndex(dump, "fy"), timeoutMs: 9000 });
    await page.waitForTimeout(1200);

    // FY set hone ke baad Month/Quarter dropdown der se aata hai (AJAX, ya poore page reload ke baad).
    // Production me yahan sirf FY wala select mila tha (select0: 2019-20/2020-21/...) -> month gayab.
    let wait = await waitForPeriodSelect(page, attempt === 1 ? 12000 : 15000);
    if (!wait.ok) {
      const snap = await pageSnapshotBrief(page);
      step("periodWait" + attempt, { ok: false, dump: wait.dump, url: snap.url || page.url(), title: snap.title, buttons: (snap.buttons || []).slice(0, 12) });
      // Page reload ho gaya ho (selects gayab) to dashboard dobara wait, phir aage badhne wale button try
      if (!(await waitForDashboardSelects(page, 20000))) { /* phir bhi try karte hain */ }
      const revealed = await revealPeriodDropdown(page);
      step("periodReveal" + attempt, revealed);
      if (revealed.clicked.length) wait = await waitForPeriodSelect(page, 8000);
    }
    dump = (wait.dump && wait.dump.length) ? wait.dump : await readSelectOptions(page);

    // Portal ne period dropdown andar ke iframe me rakha ho to wahi frame use karte hain
    let host = page;
    if (!hasPeriodSelect(dump)) {
      const inFrame = await findPeriodFrame(page);
      if (inFrame) {
        step("periodFrame" + attempt, { index: inFrame.index, url: inFrame.url, dump: inFrame.dump });
        host = inFrame.frame;
        dump = inFrame.dump;
        periodHost = host;
        // Poore dropdowns frame me ho sakte hain -> FY wahan dobara set karte hain
        if (guessSelectIndex(dump, "fy") >= 0) {
          const fyInFrame = await selectDropdownByText(host, fy, { selectIndex: guessSelectIndex(dump, "fy"), timeoutMs: 6000 });
          if (fyInFrame.matched) fyRes = fyInFrame;
          await page.waitForTimeout(1000);
          dump = await readSelectOptions(host);
        }
      }
    }
    step("periodSelects" + attempt, dump);

    const qIdx = guessSelectIndex(dump, "quarter");
    // Quarter optional: kuch dashboard par hota hi nahi, kuch par label "Q3"/"Oct - Dec" hota hai
    const qRes = qIdx >= 0
      ? await selectDropdownByText(host, getQuarterForMonth(monthNum), { also: quarterAliases(monthNum), selectIndex: qIdx, timeoutMs: 6000 })
      : { matched: false, reason: "no-quarter-select" };
    await page.waitForTimeout(1200);

    dump = await readSelectOptions(host);
    const mIdx = guessSelectIndex(dump, "month");
    const mRes = mIdx >= 0
      ? await selectDropdownByText(host, getMonthName(monthNum), { also: monthAliases(monthNum, fy), selectIndex: mIdx, timeoutMs: 9000 })
      : { matched: false, reason: "no-month-select" };
    await page.waitForTimeout(800);
    return { fyRes, qRes, mRes, dump };
  };

  let per = await periodAttempt(1);
  if (!per.fyRes.matched || !per.mRes.matched) {
    // Doosri koshish — password change/redirect ke baad portal ka dashboard der se bharta hai
    await page.waitForTimeout(2500);
    await dismissModals(page).catch(() => {});
    per = await periodAttempt(2);
  }
  const { fyRes, qRes, mRes } = per;

  // Month hi asli period hai — FY + Month match hona zaroori. Quarter ka label fix nahi hota, isliye
  // wo na mile to bhi chalta hai (month list se period pakka ho jata hai).
  if (!fyRes.matched || !mRes.matched) {
    const dump = per.dump || [];
    const snap = await pageSnapshotBrief(page);
    let framesDebug = [];
    try {
      const frames = typeof page.frames === "function" ? (page.frames() || []) : [];
      framesDebug = frames.slice(0, 6).map((f, i) => ({ i, url: (typeof f.url === "function" ? f.url() : "") }));
    } catch (_) {}
    step("periodSelectFail", { fyRes, qRes, mRes, url: snap.url || page.url(), title: snap.title, buttons: (snap.buttons || []).slice(0, 12), selects: dump, frames: framesDebug });
    const summary = dump.slice(0, 4).map(d => `${d.name || "select" + d.i}: ${(d.options || []).join("/")}`).join(" | ").slice(0, 400);
    const where = (snap.title ? snap.title + " — " : "") + (snap.url || page.url() || "?");
    const quarterOnly = mRes.reason === "no-month-select" && qRes.matched;
    const hint = quarterOnly
      ? "Is client ka dashboard month ki jagah sirf Quarter dikha raha hai (QRMP/quarterly account) — " +
        "2B month-wise chahiye, isliye galat data se bachne ke liye fetch roka gaya."
      : "Returns Dashboard par \"Financial Year\" ke saath \"Return Filing Period\" (Month) bhi dikhna chahiye — " +
        "portal par is client ka dashboard manually kholein.";
    throw new Error(`Portal par period select nahi ho paya (FY:${fyRes.matched}, Month:${mRes.matched}). ` +
      `Page: ${where}. Dropdowns mile -> ${summary || "koi select nahi mila"}. ${hint} [${t}_selects / ${t}_periodSelectFail dekhein]`);
  }
  if (!qRes.matched) step("quarterSkipped", qRes);

  const searchHost = periodHost || page;
  const searchBtn = searchHost.locator("button:has-text('SEARCH'), button[type='submit']").first();
  if (await searchBtn.count().catch(() => 0)) {
    await searchBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
  } else if (searchHost !== page) {
    const mainSearch = page.locator("button:has-text('SEARCH'), button[type='submit']").first();
    if (await mainSearch.count().catch(() => 0)) {
      await mainSearch.click({ force: true }).catch(() => {});
      await page.waitForTimeout(4000);
    }
  }
  step("dashboard", { url: page.url(), fyRes, qRes, mRes });

  return page;
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

      // Login page kholna: portal kabhi dashboard/access-denied/blank page de deta hai (purana session, WAF,
      // slow load). Pehle 30s, phir cache-buster ke saath dobara 20s — phir bhi na khule to saaf wajah.
      const loginUrl = "https://services.gst.gov.in/services/login";
      let loginInfo = { ok: false };
      let loginSnap = null;
      for (let attempt = 1; attempt <= 3 && !loginInfo.ok; attempt++) {
        // Portal downtime/WAF aksar 1-2 min me khud theek ho jata hai -> teesri koshish se pehle 45s rukte hain
        if (attempt === 3) {
          if (!LOGIN_RETRY_KINDS.includes(classifyLoginPage(loginSnap).kind)) break;
          await page.waitForTimeout(45000);
        }
        const url = attempt === 1 ? loginUrl : loginUrl + "?_=" + Date.now();
        await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
        await dismissModals(page).catch(() => {});
        loginInfo = await waitForLoginForm(page, attempt === 1 ? 30000 : 20000);
        if (!loginInfo.ok) {
          loginSnap = await pageSnapshotBrief(page);
          if (attempt < 3) await page.waitForTimeout(2500);
        }
      }
      if (!loginInfo.ok) {
        const cls = classifyLoginPage(loginSnap);
        lastDebug = {
          step: "init-login", timestamp: new Date().toISOString(), version: VERSION, kind: cls.kind, snapshot: loginSnap
        };
        const where = ((loginSnap && loginSnap.title) ? loginSnap.title + " — " : "") + ((loginSnap && loginSnap.url) || "?");
        throw new Error(`GST Portal ka login page nahi khula (username field nahi mila). Aakhri page: ${where}. ${cls.hint} [init-login_stuck dekhein]`);
      }
      const userSel = loginInfo.userSel;
      const passSel = loginInfo.passSel || LOGIN_PASS_SELECTORS[0];
      await page.click(userSel).catch(() => {});
      await page.locator(userSel).pressSequentially(String(req.body?.username || "gstuser"), { delay: 60 });
      await page.click(passSel).catch(() => {});
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
      const loginSelectors = {
        user: userSel,
        pass: passSel,
        captcha: await firstVisibleSelector(page, LOGIN_CAPTCHA_SELECTORS),
        submit: await firstVisibleSelector(page, LOGIN_SUBMIT_SELECTORS)
      };
      sessions.set(sessionId, { browser, context, page, loggedIn: false, busy: false, lastActive: Date.now(), loginSelectors });
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
      // Field ids badal jayein to bhi kaam chale (init-login me jo selector mile the wahi pehle)
      const stored = s.loginSelectors || {};
      const userSel = (stored.user && (await firstVisibleSelector(page, [stored.user]))) || await firstVisibleSelector(page, LOGIN_USER_SELECTORS);
      const passSel = (stored.pass && (await firstVisibleSelector(page, [stored.pass]))) || await firstVisibleSelector(page, LOGIN_PASS_SELECTORS);
      const capSel = stored.captcha || await firstVisibleSelector(page, LOGIN_CAPTCHA_SELECTORS);
      const submitSel = stored.submit || await firstVisibleSelector(page, LOGIN_SUBMIT_SELECTORS);
      if (!userSel || !passSel) {
        const snap2 = await pageSnapshotBrief(page);
        const cls2 = classifyLoginPage(snap2);
        throw new Error(`Login form ke fields nahi mile (page badal gaya). Aakhri page: ${snap2.url || "?"}. ${cls2.hint}`);
      }
      await page.fill(userSel, String(username || "").trim());
      await page.fill(passSel, String(password || ""));
      if (capSel) await page.fill(capSel, String(captcha || "").trim());
      await Promise.all([
        page.click(submitSel || LOGIN_SUBMIT_SELECTORS[0]),
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
    if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });
    s.busy = true;
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
    } finally {
      s.busy = false;
    }
  });

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

  app.post("/api/gst/fetch-all", async (req, res) => {
    const { sessionId, fy, month, autoClose, options } = req.body || {};
    const opts = { gstr2b: options?.gstr2b !== false, tcs: options?.tcs !== false, notices: !!options?.notices };
    // Galat FY/month par portal se kuch bhi fetch na ho (chupchaap October ka data na aa jaye)
    const per = normalizePeriod(fy, month);
    if (!per.ok) return res.status(400).json({ ok: false, error: per.error });
    const s = getSession(sessionId);
    if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
    if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

    s.busy = true;
    let page = s.page; // popup tab adopt ho sakta hai -> naya page wapas milta hai
    const dbg = { timestamp: new Date().toISOString(), version: VERSION, fy: per.fy, month: per.month, steps: {} };
    const result = {
      ok: true, fy: dbg.fy, month: dbg.month, period: per.period,
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
        page = await openReturnsDashboardAndSearch(page, result.fy, result.month, dbg, "gstr2b");
        s.page = page;
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
        try {
          page = await openReturnsDashboardAndSearch(page, result.fy, result.month, dbg, "tcs");
          s.page = page;
        } catch (e) { dbg.steps.tcsDashboardError = e.message; }
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
          await page.goto(RETURNS_DASHBOARD_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForTimeout(3500);
          await dismissModals(page);
          menu = await clickTcsMenu();
        }
        mark("menuClick", { menu });
        if (!menu) {
          // Debug: page par TDS/TCS/returns se juda kya link hai (agle fix ke liye zaroori)
          dbg.steps.tcsLinks = await page.evaluate(() => Array.from(document.querySelectorAll("a"))
            .filter(a => a.offsetParent !== null)
            .map(a => ({ t: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60), h: (a.getAttribute("href") || "").slice(0, 90) }))
            .filter(x => x.t && /tds|tcs|return|dashboard/i.test(x.t + " " + x.h)).slice(0, 25)).catch(() => []);
          const hint = (dbg.steps.tcsLinks || []).map(x => x.t).slice(0, 4).join(" / ");
          throw new Error("Menu me 'TDS and TCS credit received' link nahi mila." + (hint ? " (Page par ye links mile: " + hint + ")" : "") + " Debug me tcsLinks dekhein.");
        }
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForSelector("select", { timeout: 20000 });
        await page.waitForTimeout(1500);

        const dumpTcs = await readSelectOptions(page);
        const fyRes = await selectDropdownByText(page, result.fy, { selectIndex: guessSelectIndex(dumpTcs, "fy"), timeoutMs: 9000 });
        await page.waitForTimeout(800);
        const dumpTcs2 = await readSelectOptions(page);
        const mRes = await selectDropdownByText(page, getMonthName(result.month), {
          also: monthAliases(result.month, result.fy), selectIndex: guessSelectIndex(dumpTcs2, "month"), timeoutMs: 9000
        });
        mark("period", { fyRes, mRes, selects: dumpTcs2 });
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

      // Maanga gaya har section fail -> ok:false (sheet me kuch save na ho).
      // Kuch section ok, kuch fail -> ok:true + partial (app fail section ka purana data rakhta hai,
      // aur jo mila use save kar deta hai — pehle yahan sab kuch chhoot jata tha).
      const outcome = partialOutcome(result.status, opts);
      if (outcome.allFailed) {
        dbg.status = result.status; dbg.warnings = result.warnings; lastDebug = dbg;
        return res.json(Object.assign({}, result, { ok: false, error: "Data fetch nahi hua (Sheet me save nahi kiya) -> " + outcome.failed.join(" | ") }));
      }
      if (outcome.partial) {
        result.partial = outcome.partial;
        result.warnings.push("[partial] " + outcome.partial.text);
      }
      dbg.status = result.status;
      dbg.warnings = result.warnings;
      if (result.partial) dbg.partial = result.partial;
      lastDebug = dbg;
      res.json(result);
    } finally {
      s.busy = false;
      release();
      if (autoClose) await closeSession(sessionId);
    }
  });

  app.post("/api/gst/upload-gstr1", async (req, res) => {
    const { sessionId, fy, month, jsonContent, fileName } = req.body || {};
    const per = normalizePeriod(fy, month);
    if (!per.ok) return res.status(400).json({ ok: false, error: per.error });
    const s = getSession(sessionId);
    if (!s || !s.loggedIn) return res.status(401).json({ ok: false, error: "Portal se connected nahi hai. Pehle login karein." });
    if (!jsonContent) return res.status(400).json({ ok: false, error: "GSTR-1 JSON content missing hai." });
    if (s.busy) return res.status(429).json({ ok: false, error: "Pichhla request chal raha hai, thoda wait karein." });

    // Galat period ki JSON upload na ho: JSON ka fp (MMYYYY) aur chuna hua month/FY match hone chahiye
    let obj = null;
    try { obj = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent; } catch (_) {
      return res.status(400).json({ ok: false, error: "GSTR-1 JSON valid nahi hai (parse nahi hui)." });
    }
    const wantFp = per.period;
    if (obj && obj.fp && String(obj.fp) !== wantFp) {
      return res.status(400).json({ ok: false, error: `JSON ka period (fp) ${obj.fp} hai, par aapne ${wantFp} select kiya hai. Upload roka gaya.` });
    }

    s.busy = true;
    let page = s.page;
    const tmpFile = path.join(os.tmpdir(), `${crypto.randomUUID()}_${safeFileName(fileName, "GSTR1.json")}`);
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), "utf8");
      page = await openReturnsDashboardAndSearch(page, per.fy, per.month, null, "gstr1");
      s.page = page;
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

  // Client har response JSON expect karta hai — Express ka default HTML error na jaye
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Endpoint nahi mila: ${req.method} ${req.path}` });
  });
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err && err.status >= 400 && err.status < 500 ? err.status : 500;
    const msg = err && err.type === "entity.too.large"
      ? "Request body 25MB limit se bada hai."
      : (err && err.type === "entity.parse.failed" ? "Request body valid JSON nahi hai." : (err && err.message) || "Server error");
    res.status(status).json({ ok: false, error: msg });
  });

  app.listen(PORT, () => console.log(`GST Cloud Bridge v${VERSION} running on port ${PORT}`));
}

module.exports = {
  parseTcsRecordCount, parseAmt, buildColumnLabels, mapTcsColumns, parseTcsTables, parseNoticeTables,
  summarizeGstr2B, periodFor, safeFileName, getQuarterForMonth, ERR_TEXT_RE, OK_TEXT_RE,
  // naye helpers bhi test ke liye bahar (browser ke bina testable)
  readJsonFilesFromBuffer, buildB2bSellers, partialOutcome, getMonthName, normalizePeriod,
  openReturnsDashboardAndSearch, dismissModals, selectDropdownByText, pageSnapshotBrief, adoptNewPopupPage,
  classifyStuckPage, readSelectOptions, guessSelectIndex, quarterAliases, monthAliases,
  isMonthOption, isQuarterOption, hasPeriodSelect, waitForPeriodSelect, findPeriodFrame,
  firstVisibleSelector, waitForLoginForm, classifyLoginPage, LOGIN_USER_SELECTORS, LOGIN_PASS_SELECTORS,
  LOGIN_RETRY_KINDS,
  RETURNS_DASHBOARD_URL, GST_AUTH_DASHBOARD_URL, startServer
};

if (require.main === module) startServer();
