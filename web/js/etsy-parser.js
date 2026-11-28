    let currentParsedOrders = [];
    let currentParsedRcm = 0;

    function parseEtsyNumber(val) {
      if (!val || val === "--") return 0.0;
      const s = String(val).replace(/â_x0082_¹|₹|,|\s/g, "");
      const m = s.match(/[-]?\d+(?:\.\d+)?/);
      return m ? Math.abs(parseFloat(m[0])) : 0.0;
    }

    let activeEtsyClient = null;

    // ===== ETSY STATEMENT (CSV) PARSER =====
    let lastEtsyParsed = null;
    let currentParsedRcmBase = 0;
    const ETSY_MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
    const ETSY_MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const ETSY_MON_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const etsyTaxable = o => Math.max(0, o.gross - o.refund - (o.buyerTax - (o.taxRefund || 0)));
    const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

    function etsyXmlDecode(s) {
      return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (m, e) => {
        if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
        return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e];
      });
    }
    // Toote hue characters theek karta hai: _x0082_ escape, â\u0082¹ / â‚¹ (= ₹), BOM, control chars
    function etsyFixText(v) {
      let s = String(v == null ? "" : v);
      s = s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      s = s.replace(/â\u0082¹|â\u201A¹/g, "₹");
      s = s.replace(/[\u0080-\u009f]/g, "");
      s = s.replace(/^(\uFEFF|ï»¿)+/, "");
      return s;
    }
    function etsyDelim(text) {
      const line = String(text).split(/\r\n|\n|\r/).find(l => l.trim()) || "";
      let best = ",", bc = -1;
      [",", ";", "\t", "|"].forEach(d => {
        let c = 0, q = false;
        for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === d) c++; }
        if (c > bc) { bc = c; best = d; }
      });
      return best;
    }
    function parseCsvRows(text, delim) {
      text = String(text).replace(/^(\uFEFF|\u00EF\u00BB\u00BF)+/, "");
      delim = delim || etsyDelim(text);
      const rows = [];
      let row = [], cur = "", q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
          if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === delim) { row.push(cur); cur = ""; }
        else if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (ch !== "\r") cur += ch;
      }
      if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
      return rows;
    }
    function etsyMoney(s) {
      s = etsyFixText(s).trim();
      if (!s || s === "--" || s === "-") return 0;
      const neg = /^\(.*\)$/.test(s) || s.indexOf("-") !== -1 || s.indexOf("\u2212") !== -1 || s.indexOf("\u2013") !== -1;
      const n = parseFloat(s.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? 0 : (neg ? -n : n);
    }
    const ETSY_MONTHS_3 = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    // Har tarah ki date: "31 Oct, 2026", "October 31, 2026", "Sat, 31-Oct-26", 31/10/2026, 10/31/2026, 31.10.26,
    // 2026-10-31(T00:00:00), 2026/10/31, 20261031, Excel serial (46326), epoch seconds/ms
    function etsyDate(v, order) {
      const s = String(v == null ? "" : v).trim();
      if (!s) return null;
      const mk = (d, m, y) => {
        d = +d; m = +m; y = +y;
        if (y < 100) y += y < 70 ? 2000 : 1900;
        if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
        if (new Date(Date.UTC(y, m - 1, d)).getUTCMonth() !== m - 1) return null;
        return { d: d, m: m, y: y };
      };
      const mon = w => {
        w = w.toLowerCase().replace(/\./g, "");
        if (ETSY_MONTHS[w]) return ETSY_MONTHS[w];
        return (w.length >= 3 && ETSY_MONTHS_3[w.slice(0, 3)] && ETSY_MON_FULL[ETSY_MONTHS_3[w.slice(0, 3)] - 1].toLowerCase().indexOf(w.slice(0, 3)) === 0) ? ETSY_MONTHS_3[w.slice(0, 3)] : 0;
      };
      let m;
      if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) {            // Excel serial
        const dt = new Date(Math.floor(+s - 25569) * 86400000);
        return mk(dt.getUTCDate(), dt.getUTCMonth() + 1, dt.getUTCFullYear());
      }
      if (/^\d{13}$/.test(s) || /^\d{10}$/.test(s)) {                          // epoch (IST)
        const dt = new Date((s.length === 13 ? +s : +s * 1000) + 19800000);
        return mk(dt.getUTCDate(), dt.getUTCMonth() + 1, dt.getUTCFullYear());
      }
      if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/))) { const r = mk(m[3], m[2], m[1]); if (r) return r; }
      if ((m = s.match(/(?:^|\D)(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/))) { const r = mk(m[3], m[2], m[1]); if (r) return r; }
      if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*([A-Za-z]{3,9})\.?[\s\-\/.,]*(\d{4}|\d{2})(?![\d:])/))) {
        const mo = mon(m[2]); if (mo) { const r = mk(m[1], mo, m[3]); if (r) return r; }
      }
      if ((m = s.match(/([A-Za-z]{3,9})\.?[\s\-\/.,]*(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]+(\d{4}|\d{2})(?![\d:])/))) {
        const mo = mon(m[1]); if (mo) { const r = mk(m[2], mo, m[3]); if (r) return r; }
      }
      if ((m = s.match(/(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?![\d:])/))) {
        const a = +m[1], b = +m[2];
        let d = a, mo = b;
        if (a > 12) { d = a; mo = b; } else if (b > 12) { d = b; mo = a; } else if (order === "mdy") { d = b; mo = a; }
        const r = mk(d, mo, m[3]); if (r) return r;
      }
      return null;
    }

    // ===== ETSY FILE READER: CSV / TSV / TXT / XLSX / XLSM / HTML-table(.xls) — koi bhi file =====
    async function etsyInflate(raw) {
      if (typeof DecompressionStream === "undefined") throw new Error("Is browser me .xlsx nahi khul sakti — Excel me 'Save As → CSV' karke upload karein.");
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    async function etsyUnzip(buf) {
      const u8 = new Uint8Array(buf), dv = new DataView(buf);
      let eocd = -1;
      for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error("Excel file kharab hai (zip end nahi mila).");
      const count = dv.getUint16(eocd + 10, true);
      let p = dv.getUint32(eocd + 16, true);
      const files = {}, td = new TextDecoder("utf-8");
      for (let n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true);
        const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
        const lo = dv.getUint32(p + 42, true);
        const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
        p += 46 + nl + el + cl;
        if (!/^xl\/(worksheets\/[^\/]+\.xml|sharedStrings\.xml|styles\.xml)$/.test(name)) continue;
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
        const raw = u8.subarray(start, start + csz);
        files[name] = td.decode(method === 0 ? raw : await etsyInflate(raw));
      }
      return files;
    }
    function etsyColIdx(ref) {
      const L = (/^[A-Z]+/i.exec(ref) || ["A"])[0].toUpperCase();
      let n = 0;
      for (let i = 0; i < L.length; i++) n = n * 26 + (L.charCodeAt(i) - 64);
      return n - 1;
    }
    function etsyIsDateFmt(id, code) {
      if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
      if (!code) return false;
      const c = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
      return /[dy]/i.test(c) && !/^general$/i.test(c);
    }
    function etsySerialToIso(n) {
      const dt = new Date(Math.floor(n - 25569) * 86400000);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
    }
    function etsySheetRows(xml, sst, dateXf) {
      const rows = [];
      (xml.match(/<row\b[\s\S]*?<\/row>/g) || []).forEach(rx => {
        const row = [];
        const re = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
        let m;
        while ((m = re.exec(rx))) {
          const at = m[1], body = m[3] || "";
          const ref = (/\br="([^"]+)"/.exec(at) || [])[1] || "";
          const t = (/\bt="([^"]+)"/.exec(at) || [])[1] || "n";
          const sIdx = +((/\bs="(\d+)"/.exec(at) || [])[1] || 0);
          const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
          let val = "";
          if (t === "s") val = vm ? (sst[+vm[1]] || "") : "";
          else if (t === "inlineStr") val = (body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => etsyXmlDecode(x.replace(/<[^>]*>/g, ""))).join("");
          else if (vm) {
            val = etsyXmlDecode(vm[1]);
            if (t === "n" && dateXf[sIdx] && isFinite(+val)) val = etsySerialToIso(+val);
          }
          const ci = ref ? etsyColIdx(ref) : row.length;
          while (row.length < ci) row.push("");
          row[ci] = val;
        }
        const rn = +((/\br="(\d+)"/.exec(rx.slice(0, 80)) || [])[1] || 0);
        while (rn && rows.length < rn - 1) rows.push([]);
        rows.push(row);
      });
      return rows;
    }
    async function etsyXlsxRows(buf) {
      const f = await etsyUnzip(buf);
      const sst = [];
      if (f["xl/sharedStrings.xml"]) {
        (f["xl/sharedStrings.xml"].match(/<si\b[\s\S]*?<\/si>/g) || []).forEach(si => {
          const clean = si.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
          sst.push((clean.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map(x => etsyXmlDecode(x.replace(/<[^>]*>/g, ""))).join(""));
        });
      }
      const fmts = {};
      const dateXf = [];
      if (f["xl/styles.xml"]) {
        const st = f["xl/styles.xml"];
        (st.match(/<numFmt\b[^>]*>/g) || []).forEach(x => {
          const id = (/numFmtId="(\d+)"/.exec(x) || [])[1], code = (/formatCode="([^"]*)"/.exec(x) || [])[1];
          if (id) fmts[id] = etsyXmlDecode(code || "");
        });
        const cx = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(st);
        if (cx) (cx[0].match(/<xf\b[^>]*>/g) || []).forEach(x => {
          const id = +((/numFmtId="(\d+)"/.exec(x) || [])[1] || 0);
          dateXf.push(etsyIsDateFmt(id, fmts[id]));
        });
      }
      const names = Object.keys(f).filter(n => /worksheets\/[^\/]+\.xml$/.test(n)).sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
      if (!names.length) throw new Error("Excel me koi sheet nahi mili.");
      let first = null;
      for (const n of names) {
        const rows = etsySheetRows(f[n], sst, dateXf);
        if (!first) first = rows;
        if (rows.slice(0, 25).some(r => { const h = r.map(c => etsyHeadNorm(c)); return h.indexOf("date") >= 0 && h.indexOf("type") >= 0; })) return rows;
      }
      return first;
    }
    function etsyDecodeText(u8) {
      if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder("utf-16le").decode(u8);
      if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder("utf-16be").decode(u8);
      try { return new TextDecoder("utf-8", { fatal: true }).decode(u8); } catch (_) { return new TextDecoder("windows-1252").decode(u8); }
    }
    function etsyHtmlRows(html) {
      const rows = [];
      (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || []).forEach(tr => {
        const cells = (tr.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) || []).map(c => etsyXmlDecode(c.replace(/<[^>]*>/g, "")).trim());
        if (cells.length) rows.push(cells);
      });
      return rows;
    }
    async function etsyFileToRows(file) {
      const buf = await file.arrayBuffer();
      const u8 = new Uint8Array(buf);
      if (u8.length < 4) throw new Error("File khali hai.");
      if (u8[0] === 0x50 && u8[1] === 0x4B) return await etsyXlsxRows(buf);                    // .xlsx / .xlsm
      if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) throw new Error("Ye purani .xls file hai — Excel me 'Save As → .xlsx ya CSV' karke dobara upload karein.");
      if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) throw new Error("Ye PDF hai — Etsy ki CSV ya Excel statement upload karein.");
      const text = etsyDecodeText(u8);
      if (/^\s*<(\?xml|html|table|!doctype)/i.test(text) && /<tr\b/i.test(text)) return etsyHtmlRows(text);
      return parseCsvRows(text);
    }
    function etsyHeadNorm(h) {
      return etsyFixText(h).toLowerCase().replace(/\band\b/g, "&").replace(/[^a-z& ]/g, "").replace(/\s+/g, " ").trim();
    }
    function etsyBadDateNote(p) {
      return (p && p.badDates && p.badDates.count) ? p.badDates.count + " row ki date samajh nahi aayi (add nahi hui): " + p.badDates.samples.join(", ") : "";
    }

    const pad2 = n => String(n).padStart(2, "0");

    function parseEtsyStatement(src) {
      let rows = Array.isArray(src) ? src : parseCsvRows(String(src));
      rows = rows.map(r => (r || []).map(etsyFixText));
      if (rows.length < 2) throw new Error("File khali hai.");
      let hr = -1, head = [];
      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const h = rows[i].map(etsyHeadNorm);
        if (h.indexOf("date") >= 0 && h.indexOf("type") >= 0 && h.indexOf("title") >= 0) { hr = i; head = h; break; }
      }
      if (hr < 0) throw new Error("Ye Etsy statement nahi lag rahi (Date, Type, Title, Amount, Fees & Taxes columns chahiye).");
      const ix = n => head.indexOf(n);
      const iDate = ix("date"), iType = ix("type"), iTitle = ix("title"), iInfo = ix("info"),
            iAmt = ix("amount"), iNet = ix("net");
      let iFee = head.findIndex(h => /^fees?\s*&?\s*tax/.test(h));
      if (iFee < 0) iFee = ix("fees & taxes");
      if (iDate < 0 || iType < 0 || iTitle < 0 || iAmt < 0 || iFee < 0)
        throw new Error("Ye Etsy statement nahi lag rahi (Date, Type, Title, Amount, Fees & Taxes columns chahiye).");
      // 31/10 vs 10/31 : poori file dekhkar tay hota hai (default din/mahina/saal)
      let order = "dmy";
      for (let r = hr + 1; r < rows.length; r++) {
        const mm = /(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?!\d)/.exec(String(rows[r][iDate] || ""));
        if (mm) { if (+mm[1] > 12) { order = "dmy"; break; } if (+mm[2] > 12) { order = "mdy"; break; } }
      }
      const badDates = { count: 0, samples: [] };

      const months = {};
      const getM = d => {
        const tab = ETSY_MON_SHORT[d.m - 1] + String(d.y).slice(-2);
        if (!months[tab]) months[tab] = { tab: tab, y: d.y, m: d.m, map: {},
          fees: { ads:[0,0], transaction:[0,0], processing:[0,0], regulatory:[0,0], listing:[0,0], other:[0,0] } };
        return months[tab];
      };
      const ignored = {};
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row.some(c => String(c).trim())) continue;
        const dt = etsyDate(row[iDate], order);
        if (!dt) {
          const tpx = String(row[iType] || "").trim();
          if (tpx && !/^total/i.test(tpx)) { badDates.count++; if (badDates.samples.length < 4) badDates.samples.push(String(row[iDate] || "").trim().slice(0, 24) || "(khali)"); }
          continue;
        }
        const type = (row[iType] || "").trim();
        const title = (row[iTitle] || "").trim();
        const info = iInfo >= 0 ? (row[iInfo] || "").trim() : "";
        const amt = etsyMoney(row[iAmt]);
        const fee = etsyMoney(row[iFee]);
        const net = iNet >= 0 ? etsyMoney(row[iNet]) : 0;
        const feeVal = fee !== 0 ? fee : net;
        const tl = title.toLowerCase();
        const tp = type.toLowerCase();
        const om = (title + " " + info).match(/Order\s*#?\s*(\d{6,})/i);
        const M = getM(dt);
        const iso = dt.y + "-" + pad2(dt.m) + "-" + pad2(dt.d);
        const ord = no => (M.map[no] = M.map[no] || { iso: "", orderNo: no, gross: 0, refund: 0, buyerTax: 0, taxRefund: 0, tcs: 0, tds: 0 });

        if (tp === "deposit") continue;                       // Payoneer deposit — GST me nahi aata
        if (tp === "sale") {
          if (om) { const o = ord(om[1]); o.gross += Math.abs(amt || net); if (!o.iso) o.iso = iso; }
          continue;
        }
        if (tp.indexOf("refund") > -1) {
          if (om) { const o = ord(om[1]); o.refund += Math.abs(amt || net); if (!o.iso) o.iso = iso; }
          continue;
        }
        if (tl.indexOf("tax collected at source") > -1 || tl.indexOf("(tcs)") > -1) { if (om) ord(om[1]).tcs += -feeVal; continue; }
        if (tl.indexOf("tax deducted at source") > -1 || tl.indexOf("(tds)") > -1) { if (om) ord(om[1]).tds += -feeVal; continue; }
        if (tl.indexOf("sales tax") > -1) {
          if (om) { const o = ord(om[1]); if (feeVal < 0) o.buyerTax += -feeVal; else o.taxRefund += feeVal; }
          continue;
        }
        if (tp === "fee" || tp === "marketing") {
          let key = "other";
          if (tp === "marketing" || tl.indexOf("etsy ads") > -1) key = "ads";
          else if (tl.indexOf("transaction fee") > -1) key = "transaction";
          else if (tl.indexOf("processing fee") > -1) key = "processing";
          else if (tl.indexOf("regulatory operating") > -1) key = "regulatory";
          else if (tl.indexOf("listing fee") > -1) key = "listing";
          if (feeVal < 0) M.fees[key][0] += -feeVal; else M.fees[key][1] += feeVal;
          continue;
        }
        ignored[type || "(blank)"] = (ignored[type || "(blank)"] || 0) + 1;
      }

      const out = { months: [], flat: [], ignored: ignored, taxOnlyOrders: 0, rcmBase: 0, badDates: badDates };
      Object.values(months).sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m)).forEach(M => {
        const orders = [];
        Object.values(M.map).forEach(o => {
          if (o.gross <= 0 && o.refund <= 0) { out.taxOnlyOrders++; return; }
          const x = { iso: o.iso, orderNo: o.orderNo, gross: r2(o.gross), refund: r2(o.refund), buyerTax: r2(o.buyerTax),
                      taxRefund: r2(o.taxRefund), tcs: r2(o.tcs), tds: r2(o.tds) };
          orders.push(x);
        });
        orders.sort((a, b) => (a.iso + a.orderNo).localeCompare(b.iso + b.orderNo));
        const fees = {};
        let hasFee = false;
        Object.keys(M.fees).forEach(k => {
          fees[k] = { charged: r2(M.fees[k][0]), credits: r2(M.fees[k][1]) };
          if (fees[k].charged || fees[k].credits) hasFee = true;
          out.rcmBase += fees[k].charged - fees[k].credits;
        });
        if (!orders.length && !hasFee) return;
        out.months.push({ tab: M.tab, label: ETSY_MON_FULL[M.m - 1] + " " + M.y, orders: orders, fees: fees });
        orders.forEach(o => {
          const p = o.iso.split("-");
          out.flat.push(Object.assign({ date: p[2] + "/" + p[1] + "/" + p[0], tab: M.tab }, o));
        });
      });
      out.rcmBase = r2(out.rcmBase);
      return out;
    }

    // Etsy button -> file choose -> parse -> PREVIEW modal (bhejna neeche button se hota hai)
    document.getElementById("rowEtsyFileInput").addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      if (!file || !activeEtsyClient) { e.target.value = ""; return; }
      const c = activeEtsyClient;
      showToast(`⏳ ${c.client}: ${file.name} padh raha hoon...`);
      try {
        const parsed = parseEtsyStatement(await etsyFileToRows(file));
        parsed.fileName = file.name;
        if (!parsed.months.length) { showToast("Is file me koi order ya fee nahi mili." + (etsyBadDateNote(parsed) ? " " + etsyBadDateNote(parsed) : "")); e.target.value = ""; return; }
        lastEtsyParsed = parsed;
        currentParsedOrders = parsed.flat;
        currentParsedRcmBase = parsed.rcmBase;
        currentParsedRcm = Math.round(Math.max(0, parsed.rcmBase) * 0.18);
        renderOrderWiseModal(file.name);
        const warn = [];
        if (etsyBadDateNote(parsed)) warn.push(etsyBadDateNote(parsed));
        if (parsed.taxOnlyOrders) warn.push(parsed.taxOnlyOrders + " order sirf tax/credit rows ke the (add nahi kiye)");
        const ig = Object.keys(parsed.ignored);
        if (ig.length) warn.push("Ignore hui types: " + ig.map(k => k + " (" + parsed.ignored[k] + ")").join(", "));
        if (warn.length) document.getElementById("orderWiseSubtitle").textContent += "  ⚠️ " + warn.join(" | ");
      } catch (err) {
        showToast("❌ " + (err && err.message ? err.message : "Etsy statement read nahi ho paayi."));
      }
      e.target.value = "";
    });

    function renderOrderWiseModal(filename) {
      document.getElementById("orderWiseSubtitle").textContent = `${activeEtsyClient ? activeEtsyClient.client + " (" + activeEtsyClient.firm + ") — " : ""}${filename || "Etsy Statement"} (Preview — sahi lage to neeche green button se Sheet me bhejein)`;
      let totGross = 0, totTax = 0, totTaxable = 0;

      const tbody = document.getElementById("orderWiseTableBody");
      tbody.innerHTML = currentParsedOrders.map((o, idx) => {
        const taxable = etsyTaxable(o);
        totGross += o.gross;
        totTax += o.buyerTax;
        totTaxable += taxable;

        return `
          <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="py-2 px-3 font-bold text-slate-500">${idx + 1}</td>
            <td class="py-2 px-3 text-slate-700">${o.date || "-"}</td>
            <td class="py-2 px-3 font-mono font-bold text-indigo-700">#${o.orderNo}</td>
            <td class="py-2 px-3 text-right font-mono font-semibold">₹${o.gross.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono text-amber-700">₹${o.buyerTax.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono text-slate-600">₹${o.tcs.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono text-slate-600">₹${o.tds.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${taxable.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-center font-mono text-slate-500">5703</td>
          </tr>
        `;
      }).join("");

      document.getElementById("kpiOrderCount").textContent = currentParsedOrders.length;
      document.getElementById("kpiGrossTotal").textContent = `₹${totGross.toLocaleString("en-IN")}`;
      document.getElementById("kpiTaxTotal").textContent = `₹${totTax.toLocaleString("en-IN")}`;
      document.getElementById("kpiTaxableTotal").textContent = `₹${totTaxable.toLocaleString("en-IN")}`;

      document.getElementById("orderRcmDetails").innerHTML = `Etsy Fees RCM Base: <b>₹${Math.round(currentParsedRcmBase).toLocaleString("en-IN")}</b> | 18% IGST Payable Under RCM: <b class="text-rose-700">₹${currentParsedRcm.toLocaleString("en-IN")}</b> (GSTR-3B Table 3.1(d) me bharein aur 4A(2) me ITC claim karein)`;

      document.getElementById("orderWiseModalOverlay").classList.remove("hidden");
      showToast(`✅ ${currentParsedOrders.length} orders safaltapoorvak load ho gaye!`);
    }


    // =====================================================================
    // 📁 Files dropdown: Drive / Master Etsy (current month tab) / Document Upload / Etsy Statement Upload
    // =====================================================================
    let filesMenuEl = null;
    let filesMenuSr = null;
    let activeDocClient = null;
    const DOC_MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file (Apps Script limit se bachne ke liye)

    // Master Etsy File me PICHHLE mahine ka tab khulta hai (e.g. Nov 2026 me -> Oct26, Jan me -> Dec of last year)
    function currentEtsyMonthTab() {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return ETSY_MON_SHORT[d.getMonth()] + String(d.getFullYear()).slice(-2);
    }

    function closeFilesMenu() {
      if (filesMenuEl) { filesMenuEl.remove(); filesMenuEl = null; }
      filesMenuSr = null;
    }

    function showStickyToast(msg, ms) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.classList.remove("hidden");
      if (toastTimer) clearTimeout(toastTimer);
      if (ms) toastTimer = setTimeout(() => { el.classList.add("hidden"); }, ms);
    }

    async function callAppsScript(payload) {
      const bodyObj = typeof withSyncSecret === "function" ? withSyncSecret(payload) : payload;
      const r = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(bodyObj)
      });
      return await r.json();
    }

    function openFilesMenu(sr, anchorBtn) {
      if (filesMenuEl && filesMenuSr === sr) { closeFilesMenu(); return; }
      closeFilesMenu();
      const c = clients.find(item => item.sr === sr);
      if (!c) return;
      const isEtsy = c.clientType === "Etsy Client";

      const items = [{ key: "drive", icon: "📁", label: "Drive", sub: "Is client ka Drive folder" }];
      items.push({ key: "docs", icon: "📎", label: "Document Upload", sub: "Select karke Drive ke 'Documents' folder me" });
      if (isEtsy) items.push({ key: "etsy", icon: "📤", label: "Etsy Statement Upload", sub: "CSV / Excel → Master Etsy Sheet (month wise)" });

      const menu = document.createElement("div");
      menu.className = "fixed z-[60] w-72 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-left";
      menu.innerHTML = '<div class="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">' +
        String(c.client || "").replace(/[<>&]/g, "") + '</div>' +
        items.map(it =>
          '<button type="button" data-files-action="' + it.key + '" class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 active:bg-amber-100 transition text-left">' +
            '<span class="text-lg leading-none">' + it.icon + '</span>' +
            '<span class="flex flex-col min-w-0">' +
              '<span class="text-xs font-bold text-slate-900">' + it.label + '</span>' +
              '<span class="text-[10px] text-slate-500 truncate">' + it.sub + '</span>' +
            '</span>' +
          '</button>'
        ).join("");
      document.body.appendChild(menu);

      const rect = anchorBtn.getBoundingClientRect();
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let left = Math.min(Math.max(8, rect.right - mw), window.innerWidth - mw - 8);
      let top = rect.bottom + 6;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      menu.querySelectorAll("[data-files-action]").forEach(b => {
        b.addEventListener("click", () => {
          const action = b.getAttribute("data-files-action");
          closeFilesMenu();
          handleFilesMenuAction(action, c);
        });
      });

      filesMenuEl = menu;
      filesMenuSr = sr;
    }

    // Bahar tap / scroll / resize / Esc par menu band
    document.addEventListener("pointerdown", e => {
      if (!filesMenuEl) return;
      if (filesMenuEl.contains(e.target) || (e.target.closest && e.target.closest(".client-files-btn, .client-wa-btn, .client-contact-trigger"))) return;
      closeFilesMenu();
    }, true);
    window.addEventListener("scroll", e => {
      if (filesMenuEl && !filesMenuEl.contains(e.target)) closeFilesMenu();
    }, true);
    window.addEventListener("resize", closeFilesMenu);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeFilesMenu(); });

    function handleFilesMenuAction(action, c) {
      if (action === "drive") {
        openClientDrive(c.sr);
      } else if (action === "docs") {
        activeDocClient = c;
        document.getElementById("rowDocFileInput").click(); // user gesture ke andar hi
      } else if (action === "etsy") {
        activeEtsyClient = c;
        document.getElementById("rowEtsyFileInput").click();
      }
    }


    // =====================================================================
    // 💬 WhatsApp reminder dropdown (Hindi messages)
    // =====================================================================
    const WA_ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    const HI_MONTHS = ["जनवरी","फ़रवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

    function prevMonthHindi() {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return HI_MONTHS[d.getMonth()] + " " + d.getFullYear();
    }

    function buildWaMessage(kind, c) {
      const nm = String(c.client || "").replace(/\*/g, "").trim();
      const firm = (c.firm && c.firm !== "-") ? " (" + c.firm + ")" : "";
      const hello = "नमस्ते " + nm + " जी" + firm + " 🙏\n\n";
      const bye = "\n\nधन्यवाद 🙏\n- Tax Consultancy";
      const mon = prevMonthHindi();

      if (kind === "returnStatus") {
        const statusLine = c.filed
          ? "✅ आपके *" + mon + "* माह की GST रिटर्न *फाइल हो चुकी है (Filed)*।"
          : "⏳ आपके *" + mon + "* माह की GST रिटर्न अभी *पेंडिंग / प्रक्रिया में (Pending)* है। यदि इस माह के सेल स्टेटमेंट या बिल बाकी हों तो कृपया भेज दें।";
        return hello + statusLine + "\n\n_(Free Account — कोई शुल्क देय नहीं है)_" + bye;
      }
      if (kind === "payment") {
        return hello +
          "आपकी GST फाइलिंग सेवाओं का भुगतान अभी बाकी है। कृपया सुविधा अनुसार जल्द से जल्द भुगतान कर दें, जिससे आपका काम बिना किसी रुकावट के समय पर होता रहे।\n\n" +
          "भुगतान करने के बाद कृपया स्क्रीनशॉट इसी नंबर पर भेज दें।" + bye;
      }
      if (kind === "etsyStatement") {
        return hello +
          mon + " की GST रिटर्न फाइल करनी है। कृपया अपना " + mon + " का Etsy स्टेटमेंट (CSV फ़ाइल) जल्द से जल्द इसी नंबर पर भेज दें।\n\n" +
          "स्टेटमेंट मिलते ही हम आपका रिटर्न तैयार कर देंगे। समय पर भेजने से लेट फीस और पेनल्टी से बचा जा सकता है।" + bye;
      }
      if (kind === "transportBillSend") {
        return hello +
          mon + " में जो माल आपने ट्रांसपोर्ट से भेजा है, उसके ट्रांसपोर्ट बिल / बिल्टी की फोटो या PDF कृपया इसी नंबर पर भेज दें।\n\n" +
          "ये बिल GST रिटर्न में सही एंट्री करने के लिए ज़रूरी हैं।" + bye;
      }
      if (kind === "transportBillCollect") {
        return hello +
          "कृपया अपने ट्रांसपोर्टर से " + mon + " का बिल समय पर ले लें और हमें भेज दें।\n\n" +
          "बिल मिलने में देरी होने पर आपका GST रिटर्न रुक सकता है, इसलिए अच्छा रहेगा कि आप आज ही ट्रांसपोर्टर से बिल माँग लें।" + bye;
      }
      // gstPending (purana reminder — Apne Free par fee/PT date nahi likhte)
      if (isApneFreeClient(c)) {
        return hello + "आपके *" + mon + "* माह की GST रिटर्न फाइलिंग के लिए कृपया आवश्यक बिल / स्टेटमेंट भेज दें।" + bye;
      }
      return "Namaste " + nm + " ji (" + (c.firm || "") + "), aapka GST return pending hai (" + c.dueMon + " Mon Due, PT Date: " + (c.ptDate || "N/A") + "). Kripya details bhej dein. - Tax Consultancy";
    }

    function sendWaReminder(kind, c) {
      const raw = String(c.mobile || "").replace(/\D/g, "");
      if (!raw || raw.length < 10) { showToast(c.client + " ka mobile number valid nahi hai!"); return; }
      const ph = raw.length === 10 ? "91" + raw : raw;
      window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(buildWaMessage(kind, c)), "_blank", "noopener,noreferrer");
      showToast(c.client + " ke liye WhatsApp khola gaya!");
    }

    function openContactMenu(sr, anchorBtn) {
      closeFilesMenu();
      const c = clients.find(item => item.sr === sr); if (!c) return;
      const raw = String(c.mobile || "").replace(/\D/g, "");
      const menu = document.createElement("div");
      menu.className = "fixed z-[60] w-64 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 text-left";
      menu.innerHTML = '<div class="px-3 pt-1 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contact • ' + String(c.client || "").replace(/[<>&]/g, "") + '</div>' +
        '<a href="tel:' + raw + '" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-50 text-slate-800 transition"><span class="text-lg">📞</span><span class="text-xs font-bold">Call</span></a>' +
        '<button type="button" class="contact-wa-action w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-50 text-slate-800 transition text-left"><span class="text-emerald-600">' + WA_ICON_SVG + '</span><span class="text-xs font-bold">WhatsApp message</span></button>';
      document.body.appendChild(menu);
      const rect=anchorBtn.getBoundingClientRect(), mw=menu.offsetWidth, mh=menu.offsetHeight;
      menu.style.left=Math.min(Math.max(8,rect.left),window.innerWidth-mw-8)+"px";
      menu.style.top=(rect.bottom+mh+8<window.innerHeight?rect.bottom+5:Math.max(8,rect.top-mh-5))+"px";
      menu.querySelector(".contact-wa-action").addEventListener("click",()=>{
        closeFilesMenu(); if(!raw || raw.length<10){showToast("Client ka mobile number valid nahi hai!");return;}
        const ph=raw.length===10?"91"+raw:raw;
        // Open a blank WhatsApp chat so the user can write a custom message.
        window.open("https://wa.me/"+ph,"_blank","noopener,noreferrer");
      });
      filesMenuEl=menu; filesMenuSr=sr;
    }

    function openWaMenu(sr, anchorBtn) {
      const key = "wa:" + sr;
      if (filesMenuEl && filesMenuSr === key) { closeFilesMenu(); return; }
      closeFilesMenu();
      const c = clients.find(item => item.sr === sr);
      if (!c) return;
      const isEtsy = c.clientType === "Etsy Client";
      const isFreeAcc = isApneFreeClient(c);

      const items = isFreeAcc
        ? [{ key: "returnStatus", icon: "✅", label: "रिटर्न स्टेटस सूचना (Free Account)", sub: c.filed ? "रिटर्न फाइल होने की सूचना भेजें" : "रिटर्न पेंडिंग स्टेटस भेजें" }]
        : [{ key: "payment", icon: "💰", label: "पेमेंट रिमाइंडर", sub: "बकाया पेमेंट के लिए" }];
      if (isEtsy) {
        items.push({ key: "etsyStatement", icon: "📄", label: "Etsy स्टेटमेंट भेजने के लिए", sub: "पिछले महीने का स्टेटमेंट माँगें" });
        items.push({ key: "transportBillSend", icon: "🚚", label: "ट्रांसपोर्ट बिल भेजने के लिए", sub: "ट्रांसपोर्ट बिल / बिल्टी माँगें" });
        items.push({ key: "transportBillCollect", icon: "⏰", label: "ट्रांसपोर्टर से समय पर बिल लेने के लिए", sub: "ट्रांसपोर्टर से बिल लेने की याद दिलाएँ" });
      }
      items.push({ key: "gstPending", icon: "📋", label: "GST रिटर्न पेंडिंग", sub: "रिटर्न बाकी होने की सूचना" });

      const menu = document.createElement("div");
      menu.className = "fixed z-[60] w-80 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-left";
      menu.innerHTML = '<div class="px-3 pt-1 pb-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide truncate">WhatsApp • ' +
        String(c.client || "").replace(/[<>&]/g, "") + '</div>' +
        items.map(it =>
          '<button type="button" data-wa-action="' + it.key + '" class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 active:bg-emerald-100 transition text-left">' +
            '<span class="text-lg leading-none">' + it.icon + '</span>' +
            '<span class="flex flex-col min-w-0">' +
              '<span class="text-xs font-bold text-slate-900">' + it.label + '</span>' +
              '<span class="text-[10px] text-slate-500">' + it.sub + '</span>' +
            '</span>' +
          '</button>'
        ).join("");
      document.body.appendChild(menu);

      const rect = anchorBtn.getBoundingClientRect();
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let left = Math.min(Math.max(8, rect.right - mw), window.innerWidth - mw - 8);
      let top = rect.bottom + 6;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      menu.querySelectorAll("[data-wa-action]").forEach(b => {
        b.addEventListener("click", () => {
          const kind = b.getAttribute("data-wa-action");
          closeFilesMenu();
          sendWaReminder(kind, c);
        });
      });

      filesMenuEl = menu;
      filesMenuSr = key;
    }

    // Naye tab ka chhota page: message + "Tab band karein" button (iPad par Sheets app khulne ke baad yahi dikhta hai)
    function writeMasterTabPage(w, msg, url) {
      const safeUrl = String(url || "").replace(/"/g, "%22");
      w.document.open();
      w.document.write(
        "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
        "<body style='font-family:-apple-system,sans-serif;padding:28px;color:#334155;text-align:center'>" +
        "<p style='font-size:17px;line-height:1.5'>" + msg + "</p>" +
        "<button onclick='window.close()' style='margin-top:14px;padding:14px 22px;font-size:16px;font-weight:700;border:0;border-radius:12px;background:#4338ca;color:#fff'>❌ Tab band karein</button>" +
        (safeUrl ? "<p style='margin-top:18px'><a href=\"" + safeUrl + "\" style='font-size:15px;color:#4338ca'>📊 Sheet dobara kholein</a></p>" : "") +
        "</body>");
      w.document.close();
    }

    // 2) Client ki Master Etsy File ka current month wala tab kholna
    async function openEtsyMasterCurrentMonth(c) {
      if (!scriptUrl) { showToast("⚠️ Sheet Sync URL nahi mila! Pehle ⚙️ Setup me 'Save & Sync' karein."); return; }
      const tab = currentEtsyMonthTab();
      // iPad/Safari popup block se bachne ke liye window click ke waqt hi khol lete hain
      const w = window.open("", "_blank");
      if (w) {
        try { w.opener = null; } catch (x) {}
        try { writeMasterTabPage(w, "⏳ " + tab + " ka tab khol raha hoon...", ""); } catch (x) {}
      }
      showStickyToast("⏳ " + c.client + ": Master Etsy File (" + tab + ") dhoondh raha hoon...");
      try {
        const res = await callAppsScript({ action: "getEtsyMasterUrl", client: c.client, category: c.category, tab: tab });
        if (!res || res.status !== "ok" || !res.url) {
          const msg = (res && res.message) ? res.message : "Apps Script purani hai — nayi AppSync.gs code paste karke 'New deployment' karein.";
          if (w) w.close();
          showStickyToast("❌ " + msg, 6000);
          return;
        }
        if (w) {
          try { writeMasterTabPage(w, "✅ " + tab + " ka tab khul gaya hai. Agar aap wapas yahan aaye hain to neeche button se is tab ko band karke app par jayein.", res.url); } catch (x) {}
          w.location.replace(res.url);
        }
        else if (!window.open(res.url, "_blank")) { window.location.href = res.url; }
        showStickyToast(res.tabFound
          ? "✅ " + c.client + " — " + tab + " ka tab khol diya gaya!"
          : "ℹ️ " + tab + " naam ka tab nahi mila — Master Etsy File khol di gayi.", 5000);
      } catch (err) {
        if (w) w.close();
        showStickyToast("❌ Master Etsy File nahi khul payi (internet / Apps Script check karein).", 6000);
      }
    }

    // 3) Document upload -> client ke Drive ke 'Documents' folder me (alag folder)
    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => { const r = String(fr.result || ""); resolve(r.slice(r.indexOf(",") + 1)); };
        fr.onerror = () => reject(fr.error || new Error("File read nahi hui"));
        fr.readAsDataURL(file);
      });
    }

    document.getElementById("rowDocFileInput").addEventListener("change", async e => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      const c = activeDocClient;
      if (!files.length || !c) return;
      if (!scriptUrl) { showToast("⚠️ Sheet Sync URL nahi mila! Pehle ⚙️ Setup me 'Save & Sync' karein."); return; }

      let ok = 0;
      const failed = [];
      let oldScript = false;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        showStickyToast("⏳ " + c.client + ": " + (i + 1) + "/" + files.length + " upload ho rahi hai — " + f.name);
        if (f.size > DOC_MAX_BYTES) { failed.push(f.name + " (20 MB se badi hai)"); continue; }
        try {
          const data = await fileToBase64(f);
          const res = await callAppsScript({
            action: "uploadDocument", client: c.client, category: c.category,
            fileName: f.name, mimeType: f.type || "application/octet-stream", data: data
          });
          if (res && res.status === "ok" && res.uploaded) { ok++; }
          else if (res && res.status === "error") { failed.push(f.name + ": " + (res.message || "error")); }
          else { oldScript = true; break; }
        } catch (err) {
          failed.push(f.name + " (jawab nahi mila — Drive > Documents me check karein)");
        }
      }

      if (oldScript) {
        showStickyToast("⚠️ Apps Script purani hai — nayi AppSync.gs code paste karke 'New deployment' karein.", 7000);
        return;
      }
      let msg = ok ? "✅ " + ok + "/" + files.length + " file " + c.client + " ke Drive > Documents folder me upload ho gayi." : "❌ Koi file upload nahi hui.";
      if (failed.length) msg += "  ⚠️ " + failed.join(" | ");
      showStickyToast(msg, failed.length ? 9000 : 5000);
    });

    document.getElementById("pushNowToDriveBtn").addEventListener("click", async () => {
      if (!activeEtsyClient || !lastEtsyParsed) { showToast("Pehle Etsy statement upload karein."); return; }
      if (!scriptUrl) { showToast("⚠️ Sheet Sync URL nahi mila! Pehle 'Save & Connect' karein."); return; }
      const c = activeEtsyClient;
      const btn = document.getElementById("pushNowToDriveBtn");
      const oldLabel = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = "<span>⏳ Sheet me bhej raha hoon...</span>";
      let taxableTotal = 0;
      currentParsedOrders.forEach(o => { taxableTotal += etsyTaxable(o); });
      const payload = { action: "etsyStatement", client: c.client, category: c.category, rov: taxableTotal, months: lastEtsyParsed.months };
      const body = JSON.stringify(typeof withSyncSecret === "function" ? withSyncSecret(payload) : payload);
      const sub = document.getElementById("orderWiseSubtitle");
      try {
        let res = null;
        try {
          const r = await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body });
          const txt = await r.text();
          if (!r.ok) throw new Error("HTTP " + r.status);
          if (txt.includes("accounts.google.com") || txt.includes("ServiceLogin")) {
            throw new Error("Apps Script Deploy me 'Who has access: Anyone' karein");
          }
          res = JSON.parse(txt);
        } catch (netErr) {
          const msg = (netErr && netErr.message) ? netErr.message : "Network/CORS error";
          sub.textContent = "❌ Sheet Sync FAIL: " + msg;
          showToast("❌ Sheet Sync FAIL (" + msg + ") — Drive sheet me save nahi ho paya!");
          return;
        }
        if (!res || res.status !== "ok") {
          const msg = (res && res.message) ? res.message : "Sheet me save nahi hua.";
          sub.textContent = "❌ " + msg;
          showToast("❌ " + msg);
          return;
        }
        if (!res.results) {
          const msg = "Apps Script purani hai — nayi AppSync.gs code paste karke 'New deployment' karein.";
          sub.textContent = "⚠️ " + msg;
          showToast("⚠️ " + msg);
          return;
        }
        const parts = res.results.map(x => x.error
          ? `${x.tab}: ❌ ${x.error}`
          : `${x.tab}: ${x.added} naye order add, ${x.skipped} pehle se the${x.feesUpdated ? ", fees update" : ""}`);
        sub.textContent = "✅ " + c.client + " — " + parts.join(" | ");
        showToast("✅ " + parts.join(" | "));
        c.rov = taxableTotal;
        c._rovLocal = true; c._rovTs = Date.now();
        saveClients();
        renderApp();
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldLabel;
      }
    });

    document.getElementById("openClientMasterEtsySheetBtn").addEventListener("click", () => {
      if (!activeEtsyClient) return;
      openClientDrive(activeEtsyClient.sr);
    });

    document.getElementById("closeOrderWiseModalBtn").addEventListener("click", () => {
      document.getElementById("orderWiseModalOverlay").classList.add("hidden");
    });
    document.getElementById("closeOrderWiseFooterBtn").addEventListener("click", () => {
      document.getElementById("orderWiseModalOverlay").classList.add("hidden");
    });

    // ---------- Branded PDF report (Jaiswal & Associates letterhead) ----------
    function jnaClientMeta() {
      const c = activeEtsyClient || clients.find(x => x.sr === Number(jsonState && jsonState.selectedSr)) || null;
      return {
        client: c ? c.client : "Etsy Client",
        firm: c ? (c.firm || "-") : "-",
        gstin: c ? (c.gstin || "-") : "-"
      };
    }
    function jnaPeriodLabel(parsed) {
      if (parsed && parsed.months && parsed.months.length) {
        return parsed.months.length === 1
          ? parsed.months[0].label
          : parsed.months[0].label + " to " + parsed.months[parsed.months.length - 1].label;
      }
      return "Etsy Sales Statement";
    }
    function jnaFeeTotalsForAll(parsed) {
      const keys = ["ads", "transaction", "processing", "regulatory", "listing", "other"];
      const acc = {};
      keys.forEach(k => acc[k] = { charged: 0, credits: 0 });
      let base = 0;
      (parsed && parsed.months ? parsed.months : []).forEach(m => {
        keys.forEach(k => {
          const f = (m.fees && m.fees[k]) || { charged: 0, credits: 0 };
          acc[k].charged += Number(f.charged || 0);
          acc[k].credits += Number(f.credits || 0);
          base += Number(f.charged || 0) - Number(f.credits || 0);
        });
      });
      return { fees: acc, base: Math.round(base * 100) / 100 };
    }
    // ---------- PDF Action Sheet: Download ya WhatsApp (2 options) ----------
    let pdfActionState = null;
    function downloadBlobFile(blob, fileName) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        try {
          const fr = new FileReader();
          fr.onload = () => { const str = String(fr.result || ""); resolve(str.slice(str.indexOf(",") + 1)); };
          fr.onerror = () => reject(fr.error || new Error("file read fail"));
          fr.readAsDataURL(blob);
        } catch (e) { reject(e); }
      });
    }
    // Android APK me native share sheet -> WhatsApp chunne par PDF FILE ATTACH hokar jati hai
    // (WebView me navigator.share files support nahi karta, isliye pehle wahan sirf link/text jata tha)
    async function shareFileNative(blob, fileName, text) {
      try {
        if (!window.CloudGSTNative || !window.CloudGSTNative.shareBase64) return false;
        const b64 = await blobToBase64(blob);
        window.CloudGSTNative.shareBase64(fileName, b64, text || "");
        return true;
      } catch (e) {
        return false;
      }
    }
    function normalizeWaNumber(m) {
      let d = String(m || "").replace(/\D/g, "");
      if (!d) return "";
      if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
      if (d.length === 10) d = "91" + d;
      return d;
    }
    function makeCsvPdfBlob() {
      if (!currentParsedOrders.length) { showToast("❌ Pehle Etsy order CSV upload karein."); return null; }
      const meta = jnaClientMeta();
      const ft = jnaFeeTotalsForAll(lastEtsyParsed);
      const rcmBase = ft.base || Number(currentParsedRcmBase || 0);
      const blob = buildEtsyPdfReport({
        client: meta.client, firm: meta.firm, gstin: meta.gstin,
        orders: currentParsedOrders, fees: ft.fees, rcmBase: rcmBase,
        rcm18: Math.round(Math.max(0, rcmBase) * 18) / 100,
        monthsLabel: jnaPeriodLabel(lastEtsyParsed),
        fileName: (lastEtsyParsed && lastEtsyParsed.fileName) || "Etsy Statement"
      });
      const safe = String(meta.client || "Client").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const stamp = (lastEtsyParsed && lastEtsyParsed.months && lastEtsyParsed.months.length)
        ? lastEtsyParsed.months[lastEtsyParsed.months.length - 1].tab : "Statement";
      const c = activeEtsyClient || clients.find(x => x.sr === Number(jsonState && jsonState.selectedSr)) || null;
      return { blob, fileName: `Etsy_Order_Wise_${safe}_${stamp}.pdf`, mobile: c ? c.mobile : "", clientName: meta.client, contextLabel: `${meta.client} • ${jnaPeriodLabel(lastEtsyParsed)}` };
    }
    function makeMasterMonthPdfBlob(tabKey) {
      const c = clients.find(x => x.sr === masterActiveClientSr);
      if (!c) { showToast("❌ Pehle Master Etsy me client chunein."); return null; }
      const wb = getClientWorkbook(c.sr);
      const metrics = computeFullWorkbookMetrics(wb);
      let tKey = tabKey;
      if (!tKey || tKey === "Summary" || tKey === "_InvoiceLog" || !wb.tabs[tKey]) {
        const latest = getLatestActiveWorkbookSummaryRow(wb, metrics, masterActiveTab);
        tKey = latest ? latest.tab : null;
      }
      if (!tKey || !wb.tabs[tKey]) { showToast("ℹ️ PDF ke liye koi active month tab nahi mila."); return null; }
      const tData = wb.tabs[tKey];
      const mMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === tKey);
      const monthLabel = mMeta ? mMeta.full : tKey;
      let orders = (tData.orders || []).map(o => ({
        date: o.payDate || "", orderNo: String(o.orderNo || ""),
        gross: Number(o.gross) || 0, refund: Number(o.refund) || 0,
        buyerTax: Number(o.buyerTax) || 0, taxRefund: Number(o.taxRefund) || 0,
        tcs: Number(o.tcs) || 0, tds: Number(o.tds) || 0
      }));
      // Invoice-wise fallback: is mahine ke orders khaali ho sakte hain, par Top Invoice table me
      // pichhle mahine ke orders se billed invoices ho sakte hain — tab PDF invoices se banegi.
      let invoiceMode = false;
      if (!orders.length) {
        const sRow = (metrics.allSummaryRows || []).find(r => r.tab === tKey);
        const invList = (sRow && sRow.invoices) || [];
        if (invList.length) {
          invoiceMode = true;
          orders = invList.map(inv => ({
            date: inv.invDate || inv.payDate || "", orderNo: String(inv.invNo || ""),
            gross: Number(inv.netVal) || 0, refund: 0,
            buyerTax: Number(inv.tax) || 0, taxRefund: 0, tcs: 0, tds: 0
          }));
        }
      }
      if (!orders.length) { showToast("ℹ️ " + tKey + " me na order hai na billed invoice — PDF ke liye data nahi."); return null; }
      // Fees object {charged,credits} ya array [charged,credits] — dono format safe
      const fees = {};
      Object.keys(tData.fees || {}).forEach(k => {
        const f = tData.fees[k];
        if (Array.isArray(f)) fees[k] = { charged: Number(f[0]) || 0, credits: Number(f[1]) || 0 };
        else if (f && typeof f === "object") fees[k] = { charged: Number(f.charged) || 0, credits: Number(f.credits) || 0 };
      });
      let base = 0;
      Object.values(fees).forEach(f => { base += (Number(f.charged || 0) - Number(f.credits || 0)); });
      base = r2(base);
      const blob = buildEtsyPdfReport({
        client: c.client, firm: c.firm || "-", gstin: c.gstin || "-",
        orders: orders, fees: fees, rcmBase: base, rcm18: r2(Math.max(0, base) * 0.18),
        monthsLabel: monthLabel, fileName: `${c.client} ${tKey}`,
        reportTitle: invoiceMode ? "ETSY INVOICE-WISE (BILLED) SALES & GST SUMMARY" : "",
        orderNoTitle: invoiceMode ? "INVOICE NO." : "",
        dateTitle: invoiceMode ? "INVOICE DATE" : ""
      });
      const safe = String(c.client || "Client").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return { blob, fileName: `Etsy_${invoiceMode ? "Invoice_Wise" : "Order_Wise"}_${safe}_${tKey}.pdf`, mobile: c.mobile || "", clientName: c.client, contextLabel: `${c.client} • ${monthLabel}${invoiceMode ? " (billed invoices)" : ""}` };
    }
    function openPdfActionSheet(state) {
      pdfActionState = state;
      const lbl = document.getElementById("pdfActionContextLabel");
      if (lbl) lbl.textContent = state.contextLabel || state.clientName || "";
      document.getElementById("pdfActionModalOverlay").classList.remove("hidden");
    }
    function closePdfActionSheet() {
      pdfActionState = null;
      document.getElementById("pdfActionModalOverlay").classList.add("hidden");
    }
    async function sendPdfViaWhatsApp(state) {
      const num = normalizeWaNumber(state.mobile);
      const msg = state.whatsappMessage || `Namaste ${state.clientName} ji, ${JNA_BRAND.name} ki taraf se aapka Etsy Sales & GST statement (PDF) bhej rahe hain. Kripya check karein.`;
      try {
        if (await shareFileNative(state.blob, state.fileName, msg)) {
          showToast("📤 Share sheet khula — WhatsApp chunein, PDF attach hokar jayegi");
          return;
        }
        const file = new File([state.blob], state.fileName, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          showToast("✅ PDF share ho gayi!");
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
      downloadBlobFile(state.blob, state.fileName);
      if (num) {
        window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(msg), "_blank");
        showToast("📥 PDF download ho gayi — client ka WhatsApp chat khul gaya. Bas file attach karke bhej dein.");
      } else {
        showToast("⚠️ Client ka mobile number nahi mila — PDF download ho gayi hai.");
      }
    }
    function downloadEtsyBrandedPdf() {
      try {
        const s = makeCsvPdfBlob();
        if (s) openPdfActionSheet(s);
      } catch (err) {
        console.error(err);
        showToast("❌ PDF banane me error: " + (err && err.message ? err.message : err));
      }
    }
    const pdfBtnEl = document.getElementById("downloadOrderWisePdfBtn");
    if (pdfBtnEl) pdfBtnEl.addEventListener("click", downloadEtsyBrandedPdf);
    const masterInvoicePdfBtnEl = document.getElementById("masterInvoicePdfBtn");
    if (masterInvoicePdfBtnEl) masterInvoicePdfBtnEl.addEventListener("click", () => {
      try {
        const s = makeMasterMonthPdfBlob(masterActiveTab);
        if (s) openPdfActionSheet(s);
      } catch (err) {
        console.error(err);
        showToast("❌ PDF banane me error: " + (err && err.message ? err.message : err));
      }
    });
    const pdfDlBtn = document.getElementById("pdfActionDownloadBtn");
    if (pdfDlBtn) pdfDlBtn.addEventListener("click", () => {
      if (!pdfActionState) return;
      downloadBlobFile(pdfActionState.blob, pdfActionState.fileName);
      showToast("✅ Branded PDF (Jaiswal & Associates letterhead) download ho gayi!");
      closePdfActionSheet();
    });
    const pdfWaBtn = document.getElementById("pdfActionWhatsAppBtn");
    if (pdfWaBtn) pdfWaBtn.addEventListener("click", async () => {
      if (!pdfActionState) return;
      const st = pdfActionState;
      closePdfActionSheet();
      await sendPdfViaWhatsApp(st);
    });
    const pdfCancelBtn = document.getElementById("pdfActionCancelBtn");
    if (pdfCancelBtn) pdfCancelBtn.addEventListener("click", closePdfActionSheet);
    const pdfOverlay = document.getElementById("pdfActionModalOverlay");
    if (pdfOverlay) pdfOverlay.addEventListener("click", (e) => { if (e.target === pdfOverlay) closePdfActionSheet(); });

    document.getElementById("downloadOrderWiseCsvBtn").addEventListener("click", () => {
      if (currentParsedOrders.length === 0) return;
      const headers = ["Sr", "Payment Date", "Order Number", "Gross Payment", "Refund", "Buyer Sales Tax", "TCS Net 0.5%", "TDS Net 0.1%", "Net Taxable Turnover", "HSN Code"];
      const lines = [headers.join(",")];
      currentParsedOrders.forEach((o, idx) => {
        const taxable = etsyTaxable(o);
        lines.push([idx + 1, `"${o.date}"`, `"${o.orderNo}"`, o.gross, o.refund, o.buyerTax, o.tcs, o.tds, taxable, "5703"].join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etsy_Order_Wise_Statement_${currentParsedOrders.length}_Orders.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Order-Wise CSV download ho gayi!");
    });

    // ===================================================================================
    // 📥 ANDROID SHARE INBOX (WhatsApp / Files / Gallery -> Client Document OR Etsy CSV + Document)
    // ===================================================================================
    (function initShareInbox() {
      let shareFiles = [];
      let shareSelectedSr = null;
      let shareBusy = false;

      function escHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[ch]));
      }

      function fmtBytes(n) {
        const b = Number(n) || 0;
        if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + " MB";
        if (b >= 1024) return Math.round(b / 1024) + " KB";
        return b + " B";
      }

      function isSpreadsheetFile(f) {
        const nm = String((f && f.name) || "").toLowerCase();
        const mt = String((f && f.mime) || "").toLowerCase();
        return /\.(csv|xlsx|xlsm|xls)$/i.test(nm)
          || mt.includes("csv")
          || mt.includes("excel")
          || mt.includes("spreadsheet")
          || mt === "text/plain";
      }

      function fileIcon(f) {
        const nm = String((f && f.name) || "").toLowerCase();
        const mt = String((f && f.mime) || "").toLowerCase();
        if (isSpreadsheetFile(f)) return "📊";
        if (mt.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(nm)) return "🖼️";
        if (mt.includes("pdf") || nm.endsWith(".pdf")) return "📕";
        return "📎";
      }

      function b64ToFile(f) {
        const bin = atob(String(f.b64 || ""));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], f.name || "shared_file", { type: f.mime || "application/octet-stream" });
      }

      function ensureShareModal() {
        let ov = document.getElementById("shareInboxModalOverlay");
        if (ov) return ov;
        ov = document.createElement("div");
        ov.id = "shareInboxModalOverlay";
        ov.className = "fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 hidden";
        ov.innerHTML = `
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-900 text-white">
              <div class="min-w-0">
                <div class="text-sm font-bold truncate">📥 Shared File — Client Chunein</div>
                <div class="text-[11px] text-slate-300">Document folder me save karein ya Etsy CSV upload karein</div>
              </div>
              <button id="shareInboxCloseBtn" type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">✕</button>
            </div>
            <div class="p-3.5 space-y-3 overflow-y-auto flex-1">
              <div>
                <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Shared Files</div>
                <div id="shareInboxFilesList" class="space-y-1.5"></div>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label for="shareInboxSearchInp" class="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Client Select Karein</label>
                  <span id="shareInboxSelectedBadge" class="text-[11px] font-semibold text-indigo-700 truncate max-w-[60%]">Koi client chuna nahi</span>
                </div>
                <input id="shareInboxSearchInp" type="text" placeholder="🔍 Client name, firm ya GSTIN search karein..." class="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-indigo-500 mb-2" />
                <div id="shareInboxClientsList" class="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/40"></div>
              </div>
              <div id="shareInboxStatus" class="hidden rounded-xl px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"></div>
            </div>
            <div class="p-3.5 border-t border-slate-100 bg-slate-50 space-y-2">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button id="shareInboxDocBtn" type="button" class="w-full px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs">
                  📎 Client Document me Save
                </button>
                <button id="shareInboxEtsyBtn" type="button" class="w-full px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs">
                  📊 Etsy CSV (Master + Doc)
                </button>
              </div>
              <div class="text-[10px] text-slate-500 text-center">
                Document: Client ke Drive &gt; Documents folder me • Etsy CSV: Master Etsy Sheet + Documents dono me
              </div>
            </div>
          </div>`;
        document.body.appendChild(ov);

        ov.addEventListener("click", (e) => {
          if (e.target === ov && !shareBusy) closeShareModal();
        });
        document.getElementById("shareInboxCloseBtn").addEventListener("click", () => {
          if (!shareBusy) closeShareModal();
        });
        document.getElementById("shareInboxSearchInp").addEventListener("input", renderShareClients);
        document.getElementById("shareInboxDocBtn").addEventListener("click", () => runShareUpload("docs"));
        document.getElementById("shareInboxEtsyBtn").addEventListener("click", () => runShareUpload("etsy"));
        return ov;
      }

      function closeShareModal() {
        const ov = document.getElementById("shareInboxModalOverlay");
        if (ov) ov.classList.add("hidden");
        shareFiles = [];
        shareSelectedSr = null;
      }

      function setShareStatus(msg, tone) {
        const el = document.getElementById("shareInboxStatus");
        if (!el) return;
        if (!msg) { el.classList.add("hidden"); el.textContent = ""; return; }
        el.classList.remove("hidden", "bg-slate-100", "text-slate-700", "border-slate-200",
          "bg-emerald-50", "text-emerald-800", "border-emerald-200",
          "bg-rose-50", "text-rose-800", "border-rose-200",
          "bg-amber-50", "text-amber-800", "border-amber-200");
        if (tone === "ok") el.classList.add("bg-emerald-50", "text-emerald-800", "border-emerald-200");
        else if (tone === "err") el.classList.add("bg-rose-50", "text-rose-800", "border-rose-200");
        else if (tone === "warn") el.classList.add("bg-amber-50", "text-amber-800", "border-amber-200");
        else el.classList.add("bg-slate-100", "text-slate-700", "border-slate-200");
        el.textContent = msg;
      }

      function renderShareFiles() {
        const box = document.getElementById("shareInboxFilesList");
        if (!box) return;
        box.innerHTML = shareFiles.map(f => `
          <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base leading-none">${fileIcon(f)}</span>
              <span class="text-xs font-semibold text-slate-800 truncate" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
            </div>
            <span class="text-[10px] font-mono text-slate-500 shrink-0">${fmtBytes(f.size)}</span>
          </div>`).join("");
      }

      function renderShareClients() {
        const box = document.getElementById("shareInboxClientsList");
        const q = String(document.getElementById("shareInboxSearchInp")?.value || "").trim().toLowerCase();
        const badge = document.getElementById("shareInboxSelectedBadge");
        if (!box) return;
        const hasSheetFile = shareFiles.some(isSpreadsheetFile);
        const list = (Array.isArray(clients) ? clients.slice() : []).filter(c => {
          if (!q) return true;
          const hay = [c.client, c.firm, c.gstin, c.mobile, c.category, c.clientType].join(" ").toLowerCase();
          return hay.includes(q);
        });
        if (hasSheetFile) {
          list.sort((a, b) => {
            const ae = a.clientType === "Etsy Client" ? 0 : 1;
            const be = b.clientType === "Etsy Client" ? 0 : 1;
            return ae - be || (Number(a.sr) - Number(b.sr));
          });
        }
        const selClient = (Array.isArray(clients) ? clients : []).find(x => String(x.sr) === String(shareSelectedSr));
        if (badge) {
          badge.textContent = selClient ? ("✓ " + selClient.client) : "Koi client chuna nahi";
        }
        if (!list.length) {
          box.innerHTML = '<div class="p-3 text-center text-xs text-slate-400">Koi client nahi mila</div>';
          return;
        }
        box.innerHTML = list.map(c => {
          const active = shareSelectedSr != null && String(c.sr) === String(shareSelectedSr);
          const isEtsy = c.clientType === "Etsy Client";
          return `<button type="button" data-share-sr="${escHtml(c.sr)}" class="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition ${active ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : "bg-white hover:bg-slate-50"}">
            <div class="min-w-0">
              <div class="text-xs font-bold ${active ? "text-indigo-900" : "text-slate-800"} truncate">${escHtml(c.client)}</div>
              <div class="text-[10px] text-slate-500 truncate">${escHtml(c.firm && c.firm !== "-" ? c.firm : (c.gstin || c.category || ""))}</div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${isEtsy ? '<span class="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">Etsy</span>' : ""}
              ${active ? '<span class="text-indigo-600 text-xs font-bold">✓</span>' : ""}
            </div>
          </button>`;
        }).join("");
        box.querySelectorAll("[data-share-sr]").forEach(btn => {
          btn.addEventListener("click", () => {
            shareSelectedSr = btn.getAttribute("data-share-sr");
            renderShareClients();
            updateShareButtons();
          });
        });
      }

      function updateShareButtons() {
        const docBtn = document.getElementById("shareInboxDocBtn");
        const etsyBtn = document.getElementById("shareInboxEtsyBtn");
        const c = (Array.isArray(clients) ? clients : []).find(x => String(x.sr) === String(shareSelectedSr));
        if (docBtn) docBtn.disabled = shareBusy || !c || !shareFiles.length;
        if (etsyBtn) etsyBtn.disabled = shareBusy || !c || !shareFiles.length;
      }

      async function uploadOneDocToClient(c, f) {
        if ((Number(f.size) || 0) > DOC_MAX_BYTES) {
          throw new Error(f.name + " (20 MB se badi hai)");
        }
        const res = await callAppsScript({
          action: "uploadDocument",
          client: c.client,
          category: c.category,
          fileName: f.name,
          mimeType: f.mime || "application/octet-stream",
          data: f.b64
        });
        if (res && res.status === "ok" && res.uploaded) return true;
        if (res && res.status === "error") throw new Error(res.message || "Document upload error");
        throw new Error("Apps Script purani hai — nayi AppSync.gs deploy karein.");
      }

      async function runShareUpload(mode) {
        if (shareBusy) return;
        const c = (Array.isArray(clients) ? clients : []).find(x => String(x.sr) === String(shareSelectedSr));
        if (!c) { setShareStatus("⚠️ Pehle list me se client select karein.", "warn"); return; }
        if (!scriptUrl) { setShareStatus("⚠️ Sheet Sync URL set nahi hai — ⚙️ Setup me 'Save & Sync' karein.", "err"); return; }
        if (!shareFiles.length) { setShareStatus("⚠️ Koi shared file nahi mili.", "err"); return; }

        if (mode === "etsy") {
          if (c.clientType !== "Etsy Client") {
            setShareStatus("⚠️ '" + c.client + "' Etsy Client nahi hai — Etsy CSV sirf Etsy Client ke liye upload hoti hai. Document ke liye neela button dabayein.", "warn");
            return;
          }
          const csvFiles = shareFiles.filter(isSpreadsheetFile);
          if (!csvFiles.length) {
            setShareStatus("⚠️ Shared file CSV/Excel nahi lag rahi — Document save karne ke liye '📎 Client Document me Save' dabayein.", "warn");
            return;
          }
        }

        shareBusy = true;
        updateShareButtons();
        const docBtn = document.getElementById("shareInboxDocBtn");
        const etsyBtn = document.getElementById("shareInboxEtsyBtn");
        const oldDocLbl = docBtn ? docBtn.innerHTML : "";
        const oldEtsyLbl = etsyBtn ? etsyBtn.innerHTML : "";
        if (mode === "docs" && docBtn) docBtn.innerHTML = "⏳ Uploading...";
        if (mode === "etsy" && etsyBtn) etsyBtn.innerHTML = "⏳ Uploading...";

        try {
          if (mode === "docs") {
            let ok = 0;
            const failed = [];
            for (let i = 0; i < shareFiles.length; i++) {
              const f = shareFiles[i];
              setShareStatus(`⏳ ${c.client}: Document ${i + 1}/${shareFiles.length} upload ho raha hai — ${f.name}`, "info");
              try {
                await uploadOneDocToClient(c, f);
                ok++;
              } catch (err) {
                failed.push(f.name + ": " + (err && err.message ? err.message : err));
              }
            }
            const summary = ok
              ? `✅ ${ok}/${shareFiles.length} file ${c.client} ke Drive > Documents folder me save ho gayi!` + (failed.length ? " ⚠️ " + failed.join(" | ") : "")
              : "❌ Upload fail: " + failed.join(" | ");
            setShareStatus(summary, ok && !failed.length ? "ok" : (ok ? "warn" : "err"));
            showStickyToast(summary, failed.length ? 8000 : 5000);
            if (ok && !failed.length) {
              setTimeout(() => { if (!shareBusy) closeShareModal(); }, 1200);
            }
            return;
          }

          // mode === "etsy": 1) Parse CSV/Excel -> push to Master Etsy Sheet, 2) ALSO save file(s) to Client Drive > Documents
          const csvFiles = shareFiles.filter(isSpreadsheetFile);
          const masterNotes = [];
          const masterErrors = [];
          let lastRov = null;

          for (let i = 0; i < csvFiles.length; i++) {
            const f = csvFiles[i];
            setShareStatus(`⏳ ${c.client}: Etsy CSV (${i + 1}/${csvFiles.length}) padh kar Master Etsy Sheet me bhej raha hoon — ${f.name}`, "info");
            try {
              const fileObj = b64ToFile(f);
              const parsed = parseEtsyStatement(await etsyFileToRows(fileObj));
              if (!parsed.months || !parsed.months.length) {
                throw new Error("Is file me koi order ya fee nahi mili.");
              }
              let taxableTotal = 0;
              (parsed.flat || []).forEach(o => { taxableTotal += etsyTaxable(o); });
              const res = await callAppsScript({
                action: "etsyStatement",
                client: c.client,
                category: c.category,
                rov: taxableTotal,
                months: parsed.months
              });
              if (!res || res.status !== "ok") {
                throw new Error((res && res.message) || "Master Etsy Sheet me save nahi hua.");
              }
              if (!res.results) {
                throw new Error("Apps Script purani hai — nayi AppSync.gs deploy karein.");
              }
              const parts = res.results.map(x => x.error
                ? `${x.tab}: ❌ ${x.error}`
                : `${x.tab}: ${x.added} naye, ${x.skipped} pehle se${x.feesUpdated ? ", fees ✓" : ""}`);
              masterNotes.push(parts.join(" | "));
              lastRov = taxableTotal;
            } catch (err) {
              masterErrors.push(f.name + ": " + (err && err.message ? err.message : err));
            }
          }

          if (lastRov !== null) {
            c.rov = lastRov;
            c._rovLocal = true;
            c._rovTs = Date.now();
            saveClients();
            renderApp();
          }

          // Step 2: Save shared file(s) to Client Drive > Documents folder as well
          let docOk = 0;
          const docFailed = [];
          for (let i = 0; i < shareFiles.length; i++) {
            const f = shareFiles[i];
            setShareStatus(`⏳ ${c.client}: File Drive > Documents me save ho rahi hai (${i + 1}/${shareFiles.length}) — ${f.name}`, "info");
            try {
              await uploadOneDocToClient(c, f);
              docOk++;
            } catch (err) {
              docFailed.push(f.name + ": " + (err && err.message ? err.message : err));
            }
          }

          const allParts = [];
          if (masterNotes.length) allParts.push("✅ Master Etsy: " + masterNotes.join(" ; "));
          if (masterErrors.length) allParts.push("❌ Master Etsy Error: " + masterErrors.join(" | "));
          if (docOk) allParts.push(`✅ Documents: ${docOk}/${shareFiles.length} file saved`);
          if (docFailed.length) allParts.push("❌ Documents Error: " + docFailed.join(" | "));
          const finalMsg = allParts.join("  •  ");
          const allGood = !masterErrors.length && !docFailed.length && masterNotes.length > 0 && docOk > 0;
          setShareStatus(finalMsg, allGood ? "ok" : ((masterNotes.length || docOk) ? "warn" : "err"));
          showStickyToast(finalMsg, allGood ? 6000 : 9000);
          if (allGood) {
            setTimeout(() => { if (!shareBusy) closeShareModal(); }, 1500);
          }
        } finally {
          shareBusy = false;
          if (docBtn) docBtn.innerHTML = oldDocLbl;
          if (etsyBtn) etsyBtn.innerHTML = oldEtsyLbl;
          updateShareButtons();
        }
      }

      function readNativeSharedFiles() {
        const native = window.CloudGSTNative;
        if (!native || !native.getPendingShareMeta || !native.getPendingShareChunk) return [];
        let meta = [];
        try {
          meta = JSON.parse(String(native.getPendingShareMeta() || "[]")) || [];
        } catch (_) {
          meta = [];
        }
        if (!Array.isArray(meta) || !meta.length) return [];
        const out = [];
        const CH = 200000;
        for (const m of meta) {
          let b64 = "";
          let off = 0;
          let guard = 0;
          while (guard++ < 200) {
            const part = String(native.getPendingShareChunk(Number(m.idx), off, CH) || "");
            if (!part) break;
            b64 += part;
            off += part.length;
            if (part.length < CH) break;
          }
          if (b64) {
            out.push({
              name: String(m.name || "Shared_File"),
              mime: String(m.mime || "application/octet-stream"),
              size: Number(m.size) || 0,
              b64
            });
          }
        }
        try { if (native.clearPendingShare) native.clearPendingShare(); } catch (_) {}
        return out;
      }

      function openShareInboxFromNative() {
        const incoming = readNativeSharedFiles();
        if (!incoming.length) return false;
        shareFiles = incoming;
        shareSelectedSr = null;
        const ov = ensureShareModal();
        const searchInp = document.getElementById("shareInboxSearchInp");
        if (searchInp) searchInp.value = "";
        setShareStatus("", "");
        renderShareFiles();
        renderShareClients();
        updateShareButtons();
        ov.classList.remove("hidden");
        return true;
      }

      window.cloudGstHandleSharedFiles = openShareInboxFromNative;
      setTimeout(() => { try { openShareInboxFromNative(); } catch (_) {} }, 400);
    })();

    // ===================================================================================
    // MULTI-PAGE ROUTER + PAGE 2 (FEE MANAGEMENT & TRACKER) + PAGE 3 (GST JSON GENERATOR)
