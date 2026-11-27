    // ===================================================================================
    // PAGE 4 LOGIC: 📊 MASTER ETSY FILE (LIVE VIEW, EDIT & 2-WAY AUTOMATIC DRIVE SYNC)
    // ===================================================================================
    const MASTER_ETSY_STORAGE_KEY = "gst_master_etsy_workbooks_v1";
    let masterActiveFy = "2026-27"; // "2026-27" | "2027-28" | "2028-29"

    const ALL_MASTER_MONTH_TABS = [
      // FY 2025-26
      { tab: "Apr25", full: "April 2025", m: 4, y: 2025, fy: "2025-26" },
      { tab: "May25", full: "May 2025", m: 5, y: 2025, fy: "2025-26" },
      { tab: "Jun25", full: "June 2025", m: 6, y: 2025, fy: "2025-26" },
      { tab: "Jul25", full: "July 2025", m: 7, y: 2025, fy: "2025-26" },
      { tab: "Aug25", full: "August 2025", m: 8, y: 2025, fy: "2025-26" },
      { tab: "Sep25", full: "September 2025", m: 9, y: 2025, fy: "2025-26" },
      { tab: "Oct25", full: "October 2025", m: 10, y: 2025, fy: "2025-26" },
      { tab: "Nov25", full: "November 2025", m: 11, y: 2025, fy: "2025-26" },
      { tab: "Dec25", full: "December 2025", m: 12, y: 2025, fy: "2025-26" },
      { tab: "Jan26", full: "January 2026", m: 1, y: 2026, fy: "2025-26" },
      { tab: "Feb26", full: "February 2026", m: 2, y: 2026, fy: "2025-26" },
      { tab: "Mar26", full: "March 2026", m: 3, y: 2026, fy: "2025-26" },
      // FY 2026-27 (Current FY)
      { tab: "Apr26", full: "April 2026", m: 4, y: 2026, fy: "2026-27" },
      { tab: "May26", full: "May 2026", m: 5, y: 2026, fy: "2026-27" },
      { tab: "Jun26", full: "June 2026", m: 6, y: 2026, fy: "2026-27" },
      { tab: "Jul26", full: "July 2026", m: 7, y: 2026, fy: "2026-27" },
      { tab: "Aug26", full: "August 2026", m: 8, y: 2026, fy: "2026-27" },
      { tab: "Sep26", full: "September 2026", m: 9, y: 2026, fy: "2026-27" },
      { tab: "Oct26", full: "October 2026", m: 10, y: 2026, fy: "2026-27" },
      { tab: "Nov26", full: "November 2026", m: 11, y: 2026, fy: "2026-27" },
      { tab: "Dec26", full: "December 2026", m: 12, y: 2026, fy: "2026-27" },
      { tab: "Jan27", full: "January 2027", m: 1, y: 2027, fy: "2026-27" },
      { tab: "Feb27", full: "February 2027", m: 2, y: 2027, fy: "2026-27" },
      { tab: "Mar27", full: "March 2027", m: 3, y: 2027, fy: "2026-27" },
      // FY 2027-28 (Post March 27 Automatic Roll-Over!)
      { tab: "Apr27", full: "April 2027", m: 4, y: 2027, fy: "2027-28" },
      { tab: "May27", full: "May 2027", m: 5, y: 2027, fy: "2027-28" },
      { tab: "Jun27", full: "June 2027", m: 6, y: 2027, fy: "2027-28" },
      { tab: "Jul27", full: "July 2027", m: 7, y: 2027, fy: "2027-28" },
      { tab: "Aug27", full: "August 2027", m: 8, y: 2027, fy: "2027-28" },
      { tab: "Sep27", full: "September 2027", m: 9, y: 2027, fy: "2027-28" },
      { tab: "Oct27", full: "October 2027", m: 10, y: 2027, fy: "2027-28" },
      { tab: "Nov27", full: "November 2027", m: 11, y: 2027, fy: "2027-28" },
      { tab: "Dec27", full: "December 2027", m: 12, y: 2027, fy: "2027-28" },
      { tab: "Jan28", full: "January 2028", m: 1, y: 2028, fy: "2027-28" },
      { tab: "Feb28", full: "February 2028", m: 2, y: 2028, fy: "2027-28" },
      { tab: "Mar28", full: "March 2028", m: 3, y: 2028, fy: "2027-28" },
      // FY 2028-29
      { tab: "Apr28", full: "April 2028", m: 4, y: 2028, fy: "2028-29" },
      { tab: "May28", full: "May 2028", m: 5, y: 2028, fy: "2028-29" },
      { tab: "Jun28", full: "June 2028", m: 6, y: 2028, fy: "2028-29" },
      { tab: "Jul28", full: "July 2028", m: 7, y: 2028, fy: "2028-29" },
      { tab: "Aug28", full: "August 2028", m: 8, y: 2028, fy: "2028-29" },
      { tab: "Sep28", full: "September 2028", m: 9, y: 2028, fy: "2028-29" },
      { tab: "Oct28", full: "October 2028", m: 10, y: 2028, fy: "2028-29" },
      { tab: "Nov28", full: "November 2028", m: 11, y: 2028, fy: "2028-29" },
      { tab: "Dec28", full: "December 2028", m: 12, y: 2028, fy: "2028-29" },
      { tab: "Jan29", full: "January 2029", m: 1, y: 2029, fy: "2028-29" },
      { tab: "Feb29", full: "February 2029", m: 2, y: 2029, fy: "2028-29" },
      { tab: "Mar29", full: "March 2029", m: 3, y: 2029, fy: "2028-29" }
    ];

    function getActiveFyMonthTabs() {
      return ALL_MASTER_MONTH_TABS.filter(m => m.fy === masterActiveFy);
    }

    function ensureWorkbookHasAllFyTabs(wb) {
      if (!wb.tabs) wb.tabs = {};
      ALL_MASTER_MONTH_TABS.forEach(m => {
        if (!wb.tabs[m.tab]) {
          wb.tabs[m.tab] = {
            orders: [],
            fees: {
              ads: { charged: 0, credits: 0 },
              transaction: { charged: 0, credits: 0 },
              processing: { charged: 0, credits: 0 },
              regulatory: { charged: 0, credits: 0 },
              listing: { charged: 0, credits: 0 },
              other: { charged: 0, credits: 0 }
            },
            invMeta: {},
            manualGov: 0
          };
        }
      });
    }

    const FEE_KEYS_META = [
      { key: "ads", label: "Etsy Ads (marketing)" },
      { key: "transaction", label: "Transaction fee" },
      { key: "processing", label: "Processing fee" },
      { key: "regulatory", label: "Regulatory operating fee" },
      { key: "listing", label: "Listing fee" },
      { key: "other", label: "Other fee (if any)" }
    ];

    let masterWorkbooks = {}; // { [clientSr]: { prefix: "AD", nextSeq: 7, tabs: { Apr26: { orders:[], fees:{}, invMeta:{} } }, invoiceLog: [] } }
    let masterActiveClientSr = 2; // Default #2 BUSARA BANO (has real Jul26, Aug26, Sep26 data from user's Drive!)
    let masterActiveTab = "Sep26"; // "Summary" | "Apr26".."Mar27" | "_InvoiceLog"
    let masterAutoSyncTimer = null;
    const masterAutoSyncTimers = {}; // har client ka apna debounce timer (client badalne par push gadbad na ho)

    function createEmptyMasterWorkbook(clientObj) {
      const wb = {
        prefix: "AD",
        nextSeq: 1,
        tabs: {},
        invoiceLog: []
      };
      ALL_MASTER_MONTH_TABS.forEach(m => {
        wb.tabs[m.tab] = {
          orders: [],
          fees: {
            ads: { charged: 0, credits: 0 },
            transaction: { charged: 0, credits: 0 },
            processing: { charged: 0, credits: 0 },
            regulatory: { charged: 0, credits: 0 },
            listing: { charged: 0, credits: 0 },
            other: { charged: 0, credits: 0 }
          },
          invMeta: {}, // { [invNo]: { rate: 5, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" } }
          manualGov: 0
        };
      });

      // Pre-populate #2 BUSARA BANO with exact real data from user's BUSARA BANO Master Etsy Statement on Google Drive!
      if (clientObj && (clientObj.sr === 2 || String(clientObj.client || "").toUpperCase().includes("BUSARA"))) {
        wb.prefix = "AD";
        wb.nextSeq = 7;
        wb.tabs["Jul26"].orders = [
          { payDate: "18/07/2026", orderNo: "4120111488", gross: 49245, refund: 0, buyerTax: 0, taxRefund: 0, tcs: 246, tds: 49, invNo: "AD004", invDate: "30/09/2026", country: "US", hsn: "5703", sb: "" }
        ];
        wb.tabs["Aug26"].orders = [
          { payDate: "02/08/2026", orderNo: "4133578692", gross: 59670, refund: 0, buyerTax: 5670, taxRefund: 0, tcs: 270, tds: 54, invNo: "AD001", invDate: "02/08/2026", country: "US", hsn: "5703", sb: "NCS" },
          { payDate: "05/08/2026", orderNo: "4136006037", gross: 46225, refund: 0, buyerTax: 3325, taxRefund: 0, tcs: 215, tds: 43, invNo: "AD002", invDate: "05/08/2026", country: "US", hsn: "5703", sb: "NCS" },
          { payDate: "08/08/2026", orderNo: "4139103289", gross: 42460, refund: 0, buyerTax: 0, taxRefund: 0, tcs: 212, tds: 42, invNo: "AD003", invDate: "08/08/2026", country: "US", hsn: "5703", sb: "NCS" },
          { payDate: "30/08/2026", orderNo: "4159967258", gross: 69724, refund: 0, buyerTax: 5684, taxRefund: 0, tcs: 320, tds: 64, invNo: "AD005", invDate: "30/09/2026", country: "US", hsn: "5703", sb: "NCS" }
        ];
        wb.tabs["Aug26"].invMeta = {
          "AD001": { rate: 0, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" },
          "AD002": { rate: 0, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" },
          "AD003": { rate: 0, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" }
        };
        wb.tabs["Sep26"].orders = [
          { payDate: "05/09/2026", orderNo: "4165867443", gross: 27437, refund: 0, buyerTax: 2237, taxRefund: 0, tcs: 126, tds: 25, invNo: "AD006", invDate: "30/09/2026", country: "US", hsn: "5703", sb: "" },
          { payDate: "14/09/2026", orderNo: "4174148361", gross: 46707, refund: 0, buyerTax: 3807, taxRefund: 0, tcs: 215, tds: 43, invNo: "", invDate: "", country: "US", hsn: "", sb: "" },
          { payDate: "19/09/2026", orderNo: "4178261485", gross: 33660, refund: 0, buyerTax: 1980, taxRefund: 0, tcs: 158, tds: 32, invNo: "", invDate: "", country: "US", hsn: "", sb: "" },
          { payDate: "23/09/2026", orderNo: "4182642339", gross: 49940, refund: 0, buyerTax: 4540, taxRefund: 0, tcs: 227, tds: 45, invNo: "", invDate: "", country: "US", hsn: "", sb: "" },
          { payDate: "25/09/2026", orderNo: "4185364666", gross: 24761, refund: 0, buyerTax: 1781, taxRefund: 0, tcs: 115, tds: 23, invNo: "", invDate: "", country: "US", hsn: "", sb: "" }
        ];
        wb.tabs["Sep26"].fees = {
          ads: { charged: 33045, credits: 0 },
          transaction: { charged: 10931, credits: 0 },
          processing: { charged: 9250, credits: 0 },
          regulatory: { charged: 84, credits: 0 },
          listing: { charged: 0, credits: 0 },
          other: { charged: 0, credits: 0 }
        };
        wb.tabs["Sep26"].invMeta = {
          "AD004": { rate: 5, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" },
          "AD005": { rate: 5, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" },
          "AD006": { rate: 5, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" }
        };
        wb.invoiceLog = [
          { ts: "02/08/2026 10:00", tab: "Aug26", row: 45, invNo: "AD001", invDate: "02/08/2026", event: "ASSIGNED" },
          { ts: "05/08/2026 10:00", tab: "Aug26", row: 46, invNo: "AD002", invDate: "05/08/2026", event: "ASSIGNED" },
          { ts: "08/08/2026 10:00", tab: "Aug26", row: 47, invNo: "AD003", invDate: "08/08/2026", event: "ASSIGNED" },
          { ts: "07/11/2026 01:03", tab: "Jul26", row: 45, invNo: "AD004", invDate: "30/09/2026", event: "ASSIGNED" },
          { ts: "09/11/2026 12:30", tab: "Aug26", row: 48, invNo: "AD005", invDate: "30/09/2026", event: "ASSIGNED" },
          { ts: "09/11/2026 12:37", tab: "Sep26", row: 45, invNo: "AD006", invDate: "30/09/2026", event: "ASSIGNED" }
        ];
      }
      return wb;
    }

    function isMasterTabNonEmpty(t) {
      if (!t || typeof t !== "object") return false;
      if (Array.isArray(t.orders) && t.orders.length > 0) return true;
      if (Number(t.manualGov) > 0) return true;
      if (t.invMeta && typeof t.invMeta === "object" && Object.keys(t.invMeta).length > 0) return true;
      if (t.fees && typeof t.fees === "object") {
        for (const k of Object.keys(t.fees)) {
          const f = t.fees[k];
          if (f && (Number(f.charged) !== 0 || Number(f.credits) !== 0)) return true;
        }
      }
      return false;
    }

    function buildCompactMasterWorkbooks() {
      const compact = {};
      if (!masterWorkbooks || typeof masterWorkbooks !== "object") return compact;
      Object.keys(masterWorkbooks).forEach(ck => {
        const wb = masterWorkbooks[ck];
        if (!wb || typeof wb !== "object") return;
        const cTabs = {};
        if (wb.tabs && typeof wb.tabs === "object") {
          Object.keys(wb.tabs).forEach(tk => {
            if (isMasterTabNonEmpty(wb.tabs[tk])) {
              cTabs[tk] = wb.tabs[tk];
            }
          });
        }
        const hasLogs = Array.isArray(wb.invoiceLog) && wb.invoiceLog.length > 0;
        const hasCustomMeta = (wb.prefix && wb.prefix !== "AD") || (Number(wb.nextSeq) > 1);
        if (Object.keys(cTabs).length > 0 || hasLogs || hasCustomMeta) {
          compact[ck] = {
            prefix: wb.prefix || "AD",
            nextSeq: wb.nextSeq || 1,
            tabs: cTabs,
            invoiceLog: Array.isArray(wb.invoiceLog) ? wb.invoiceLog : []
          };
        }
      });
      return compact;
    }

    function loadMasterWorkbooks() {
      try {
        const raw = localStorage.getItem(MASTER_ETSY_STORAGE_KEY);
        if (raw) {
          masterWorkbooks = JSON.parse(raw) || {};
          let hadBloated = false;
          Object.keys(masterWorkbooks).forEach(k => {
            const wb = masterWorkbooks[k];
            if (wb && typeof wb === "object") {
              if (wb.tabs && Object.keys(wb.tabs).length >= 24) hadBloated = true;
              ensureWorkbookHasAllFyTabs(wb);
            }
          });
          // Purane 48-empty-tab bloated storage ko turant compact karke space khali karein
          if (hadBloated || raw.length > 200000) {
            saveMasterWorkbooks();
          }
        }
      } catch (e) { masterWorkbooks = {}; }
    }

    function saveMasterWorkbooks() {
      try {
        localStorage.setItem(MASTER_ETSY_STORAGE_KEY, JSON.stringify(buildCompactMasterWorkbooks()));
      } catch (e) {}
    }

    // ---- Invoice lock & sequence helpers: duplicate / repeat prevention + release audit ----
    function parseInvPrefixSeq(invStr) {
      const s = String(invStr || "").trim();
      const m = s.match(/^(.+?[^0-9])(\d+)$/) || s.match(/^([A-Za-z]+)(\d+)$/);
      if (!m || !m[1]) return null;
      const seq = parseInt(m[2], 10);
      if (isNaN(seq)) return null;
      return { prefix: m[1].toUpperCase(), seq: seq, padLen: Math.max(3, m[2].length) };
    }

    function getActiveWorkbookInvSet(wb, ignoreTab = null, ignoreIdx = -1) {
      const set = new Set();
      if (!wb || !wb.tabs) return set;
      Object.keys(wb.tabs).forEach(tk => {
        const orders = (wb.tabs[tk] && wb.tabs[tk].orders) || [];
        orders.forEach((o, i) => {
          if (tk === ignoreTab && i === ignoreIdx) return;
          const v = String((o && o.invNo) || "").trim().toUpperCase();
          if (v) set.add(v);
        });
      });
      return set;
    }

    function getHighestWorkbookSeq(wb, prefUpper) {
      const targetPref = String(prefUpper || (wb && wb.prefix) || "AD").trim().toUpperCase();
      let maxSeq = 0;
      if (!wb || !wb.tabs) return 0;
      Object.keys(wb.tabs).forEach(tk => {
        ((wb.tabs[tk] && wb.tabs[tk].orders) || []).forEach(o => {
          const p = parseInvPrefixSeq(o && o.invNo);
          if (p && p.prefix === targetPref && p.seq > maxSeq) maxSeq = p.seq;
        });
      });
      return maxSeq;
    }

    function syncWorkbookSeqFromManualInv(wb, invNo) {
      if (!wb || !invNo) return;
      const p = parseInvPrefixSeq(invNo);
      if (!p) return;
      wb.prefix = p.prefix;
      const highest = getHighestWorkbookSeq(wb, p.prefix);
      wb.nextSeq = Math.max(wb.nextSeq || 1, p.seq + 1, highest + 1);
    }

    function allocateNextWorkbookInvNo(wb, customPrefix, requestedSeq) {
      const pref = String(customPrefix || (wb && wb.prefix) || "AD").trim().toUpperCase() || "AD";
      const used = getActiveWorkbookInvSet(wb);
      const highest = getHighestWorkbookSeq(wb, pref);
      let seq = parseInt(String(requestedSeq !== undefined && requestedSeq !== null ? requestedSeq : ((wb && wb.nextSeq) || 1)), 10);
      if (isNaN(seq) || seq < 1) seq = Math.max(1, highest + 1);
      while (used.has(`${pref}${String(seq).padStart(3, "0")}`)) {
        seq++;
      }
      const assigned = `${pref}${String(seq).padStart(3, "0")}`;
      if (wb) {
        wb.prefix = pref;
        wb.nextSeq = Math.max(seq + 1, highest + 1);
      }
      return assigned;
    }

    function isInvReleasedInLog(wb, invNo) {
      if (!wb || !invNo || !Array.isArray(wb.invoiceLog)) return false;
      const target = String(invNo).trim().toUpperCase();
      const latest = wb.invoiceLog.find(x => x && String(x.invNo || "").trim().toUpperCase() === target);
      return !!(latest && (latest.event === "DELETED" || latest.event === "RELEASED"));
    }

    function logInvoiceRelease(wb, tab, row, invNo, invDate, event, orderNo) {
      if (!wb || !invNo) return;
      if (!Array.isArray(wb.invoiceLog)) wb.invoiceLog = [];
      wb.invoiceLog.unshift({
        ts: new Date().toLocaleString("en-IN"),
        tab: tab,
        row: row,
        orderNo: orderNo ? String(orderNo) : "",
        invNo: invNo,
        invDate: invDate || "",
        event: event || "RELEASED"
      });
    }

    // Agar sabse last invoice no. delete/release hua to next number wapas sahi jagah aa jata hai, aur active max se kabhi kam nahi hota
    function recalcNextSeqAfterRelease(wb, relInvNo) {
      if (!wb) return;
      const p = parseInvPrefixSeq(relInvNo);
      const pref = p ? p.prefix : String(wb.prefix || "AD").trim().toUpperCase();
      const maxSeq = getHighestWorkbookSeq(wb, pref);
      if (p && p.seq > maxSeq) {
        wb.nextSeq = maxSeq > 0 ? (maxSeq + 1) : 1;
      } else {
        wb.nextSeq = Math.max(wb.nextSeq || 1, maxSeq + 1);
      }
    }

    // Reconciles workbook orders with _InvoiceLog and default seed data so billed invoices are never lost AND never duplicated
    function reconcileWorkbookWithInvoiceLog(wb, c) {
      if (!wb || !wb.tabs) return false;
      let changed = false;
      // 1. If #2 BUSARA BANO had Jul26/Aug26/Sep26 wiped to empty array (and not intentionally deleted in log), restore seed orders
      if (c && (c.sr === 2 || String(c.client || "").toUpperCase().includes("BUSARA"))) {
        const hasAnyLogRelease = Array.isArray(wb.invoiceLog) && wb.invoiceLog.some(l => l && (l.event === "DELETED" || l.event === "RELEASED"));
        if (!hasAnyLogRelease) {
          const seedWb = createEmptyMasterWorkbook(c);
          ["Jul26", "Aug26", "Sep26"].forEach(tKey => {
            if (wb.tabs[tKey] && (!Array.isArray(wb.tabs[tKey].orders) || wb.tabs[tKey].orders.length === 0)) {
              wb.tabs[tKey].orders = JSON.parse(JSON.stringify(seedWb.tabs[tKey].orders));
              wb.tabs[tKey].invMeta = Object.assign({}, seedWb.tabs[tKey].invMeta, wb.tabs[tKey].invMeta || {});
              changed = true;
            }
          });
        }
      }
      // 2. Re-apply ASSIGNED invoice numbers & dates ONLY if that invoice number is NOT already active anywhere in wb
      if (Array.isArray(wb.invoiceLog) && wb.invoiceLog.length > 0) {
        const usedSet = getActiveWorkbookInvSet(wb);
        const latestByInv = new Map();
        wb.invoiceLog.forEach(x => {
          const key = x && x.invNo ? String(x.invNo).trim().toUpperCase() : "";
          if (key && !latestByInv.has(key)) latestByInv.set(key, x);
        });
        const assignedLogs = Array.from(latestByInv.values())
          .filter(x => x.event === "ASSIGNED" && x.tab && x.invNo && x.invDate)
          .reverse();
        assignedLogs.forEach(log => {
          const invKey = String(log.invNo).trim().toUpperCase();
          if (usedSet.has(invKey)) return; // Already on an active order -> never duplicate!
          const tObj = wb.tabs[log.tab];
          if (!tObj || !Array.isArray(tObj.orders)) return;
          let ord = null;
          if (log.orderNo) {
            ord = tObj.orders.find(o => o && String(o.orderNo || "") === String(log.orderNo)) || null;
          }
          if (!ord && !log.orderNo) {
            const idx = Number(log.row || 45) - 45;
            const cand = (idx >= 0 && idx < tObj.orders.length) ? tObj.orders[idx] : null;
            if (cand && !cand.invNo && !cand.invDate) ord = cand;
          }
          if (ord && !ord.invNo && !ord.invDate) {
            ord.invNo = log.invNo;
            ord.invDate = log.invDate;
            ord.hsn = ord.hsn || "5703";
            usedSet.add(invKey);
            changed = true;
          }
        });
      }
      // Ensure wb.nextSeq is always strictly ahead of the highest active invoice number
      const highestActive = getHighestWorkbookSeq(wb, wb.prefix || "AD");
      if (highestActive >= (wb.nextSeq || 1)) {
        wb.nextSeq = highestActive + 1;
        changed = true;
      }
      if (changed) saveMasterWorkbooks();
      return changed;
    }

    function getClientWorkbook(sr) {
      const c = clients.find(x => x.sr === Number(sr)) || clients[0];
      const ck = getClientKey(c);
      if (!masterWorkbooks[ck] && masterWorkbooks[c.sr]) {
        masterWorkbooks[ck] = masterWorkbooks[c.sr];
        delete masterWorkbooks[c.sr];
        saveMasterWorkbooks();
      }
      if (!masterWorkbooks[ck]) {
        masterWorkbooks[ck] = createEmptyMasterWorkbook(c);
        saveMasterWorkbooks();
      }
      ensureWorkbookHasAllFyTabs(masterWorkbooks[ck]);
      reconcileWorkbookWithInvoiceLog(masterWorkbooks[ck], c);
      return masterWorkbooks[ck];
    }

    function calcOrderTaxable(o) {
      return Math.max(0, r2((Number(o.gross) || 0) - (Number(o.refund) || 0) - ((Number(o.buyerTax) || 0) - (Number(o.taxRefund) || 0))));
    }

    // Parse DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, or YYYY-MM-DD into { d, m, y }
    function parseFlexDate(dStr) {
      const s = String(dStr || "").trim();
      if (!s) return null;
      let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (m) return { d: parseInt(m[3], 10), m: parseInt(m[2], 10), y: parseInt(m[1], 10) };
      m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (m) {
        let p1 = parseInt(m[1], 10), p2 = parseInt(m[2], 10), yr = parseInt(m[3], 10);
        if (yr < 100) yr += 2000;
        if (p2 > 12 && p1 <= 12) return { d: p2, m: p1, y: yr };
        return { d: p1, m: p2, y: yr };
      }
      const monMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      m = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,})[\/\-\s](\d{2,4})$/);
      if (m) {
        const mo = monMap[m[2].slice(0, 3).toLowerCase()];
        let yr = parseInt(m[3], 10);
        if (yr < 100) yr += 2000;
        if (mo) return { d: parseInt(m[1], 10), m: mo, y: yr };
      }
      return null;
    }

    // Replicates the exact Google Sheet LET(VSTACK(Data_Part_Apr26..Mar27)) formula & Summary!A5:H17 calculations!
    function computeFullWorkbookMetrics(wb) {
      const defaultRate = parseFloat((document.getElementById("masterDefaultTaxRateSelect") && document.getElementById("masterDefaultTaxRateSelect").value) || "5");
      // Collect all orders across all 12 tabs that have both invNo (Col J) and invDate (Col K)
      const billedByMonthTab = {};
      ALL_MASTER_MONTH_TABS.forEach(m => { billedByMonthTab[m.tab] = []; });

      ALL_MASTER_MONTH_TABS.forEach(srcMeta => {
        const tData = wb.tabs[srcMeta.tab];
        if (!tData || !Array.isArray(tData.orders)) return;
        tData.orders.forEach((o, idx) => {
          const invNo = String(o.invNo || "").trim();
          const invDate = String(o.invDate || "").trim();
          if (!invNo || !invDate) return;
          const dt = parseFlexDate(invDate);
          if (!dt) return;
          const targetMeta = ALL_MASTER_MONTH_TABS.find(x => x.m === dt.m && x.y === dt.y);
          if (!targetMeta) return;
          const targetTabObj = wb.tabs[targetMeta.tab];
          const metaOverride = (targetTabObj && targetTabObj.invMeta && targetTabObj.invMeta[invNo]) || {};
          const rate = metaOverride.rate !== undefined ? Number(metaOverride.rate) : defaultRate;
          const txval = calcOrderTaxable(o);
          const tax = r2(txval * (rate / 100));
          const netVal = r2(txval + tax);

          billedByMonthTab[targetMeta.tab].push({
            srcTab: srcMeta.tab,
            srcRow: 45 + idx,
            payDate: o.payDate || "",
            invNo: invNo,
            invDate: invDate,
            txval: txval,
            hsn: o.hsn || "5703",
            rate: rate,
            tax: tax,
            netVal: netVal,
            portCode: metaOverride.portCode || "",
            sbNo: metaOverride.sbNo || "",
            sbDate: metaOverride.sbDate || "",
            csNcs: metaOverride.csNcs || o.sb || "NCS"
          });
        });
      });

      // Now compute sequential monthly C4 (prev ROV), D4 (Gross Order Value = sum of Taxable Value of orders in that tab), D8 (Billed Invoices Taxable), D5 (Remaining Order Value = C4 + D4 - D8)
      const summaryRows = [];
      let prevRov = 0;
      ALL_MASTER_MONTH_TABS.forEach(m => {
        const tData = wb.tabs[m.tab] || { orders: [], fees: {}, manualGov: 0 };
        let ordersTaxableSum = 0;
        (tData.orders || []).forEach(o => {
          ordersTaxableSum += calcOrderTaxable(o);
        });
        ordersTaxableSum = r2(ordersTaxableSum);
        const manualGovVal = r2(Number(tData.manualGov || 0));
        const d4GrossOrderVal = ordersTaxableSum > 0 ? ordersTaxableSum : manualGovVal;

        const invList = billedByMonthTab[m.tab] || [];
        let d8Taxable = 0, g8Tax = 0, h8Net = 0;
        invList.forEach(inv => {
          d8Taxable += inv.txval;
          g8Tax += inv.tax;
          h8Net += inv.netVal;
        });
        d8Taxable = r2(d8Taxable);
        g8Tax = r2(g8Tax);
        h8Net = r2(h8Net);

        const c4Prev = r2(prevRov);
        const d5Rov = r2(c4Prev + d4GrossOrderVal - d8Taxable);
        prevRov = d5Rov;

        summaryRows.push({
          month: m.full,
          tab: m.tab,
          invoicesCount: invList.length,
          c4PrevRov: c4Prev,
          d4GrossOrder: d4GrossOrderVal,
          d8Taxable: d8Taxable,
          g8Tax: g8Tax,
          h8Net: h8Net,
          d5Rov: d5Rov,
          invoices: invList
        });
      });

      return {
        allSummaryRows: summaryRows,
        summaryRows: summaryRows.filter(r => {
          const mObj = ALL_MASTER_MONTH_TABS.find(x => x.tab === r.tab);
          return !mObj || mObj.fy === masterActiveFy;
        }),
        billedByMonthTab: billedByMonthTab
      };
    }

    function getLatestActiveWorkbookSummaryRow(wb, metrics, preferredTab) {
      const allRows = (metrics && metrics.allSummaryRows) || [];
      const activeRows = allRows.filter(r => {
        const t = wb.tabs[r.tab];
        const hasFees = t && Object.values(t.fees || {}).some(f => Number(f.charged || 0) || Number(f.credits || 0));
        return (t && ((t.orders || []).length > 0 || Number(t.manualGov || 0) > 0)) || r.invoicesCount > 0 || hasFees;
      });
      if (activeRows.length > 0) return activeRows[activeRows.length - 1];
      return allRows.find(r => r.tab === preferredTab) || (metrics.summaryRows && metrics.summaryRows[0]) || null;
    }

    function buildMasterTabSyncPayload(wb, tKey, metrics) {
      const tabIdx = ALL_MASTER_MONTH_TABS.findIndex(x => x.tab === tKey);
      const prevTabName = tabIdx > 0 ? ALL_MASTER_MONTH_TABS[tabIdx - 1].tab : "";
      const fullMonthName = tabIdx >= 0 ? ALL_MASTER_MONTH_TABS[tabIdx].full : tKey;
      const tData = wb.tabs[tKey] || { orders: [], fees: {} };
      const mRow = (metrics.allSummaryRows || []).find(r => r.tab === tKey);
      return {
        tab: tKey,
        prevTab: prevTabName,
        fullMonthName: fullMonthName,
        orders: tData.orders || [],
        topInvoices: mRow ? mRow.invoices : [],
        fees: tData.fees || {},
        manualGov: r2(Number(tData.manualGov || 0))
      };
    }

    function triggerMasterAutoSync(tabName) {
      saveMasterWorkbooks();
      const c = clients.find(x => x.sr === masterActiveClientSr);
      const wb = getClientWorkbook(masterActiveClientSr);
      const metrics = computeFullWorkbookMetrics(wb);
      const latestSummary = getLatestActiveWorkbookSummaryRow(wb, metrics, tabName || masterActiveTab);
      if (c && latestSummary) {
        c.rov = latestSummary.d5Rov;
        c._rovLocal = true; c._rovTs = Date.now();
        const saleTabs = getDetectedSaleMonthsForClient(c);
        if (saleTabs.length > 0) {
          const prof = ensureClientFeeProfile(c);
          prof.activeDueMon = saleTabs.length;
          saveFeeState();
        }
        saveClients();
      }

      const autoChk = document.getElementById("masterAutoSyncCheckbox");
      if (!autoChk || !autoChk.checked) return;

      const badge = document.getElementById("masterSyncStatusBadgeText");
      if (badge) badge.textContent = "⏳ Saving & Auto-Syncing to Drive Master Etsy Sheet...";

      const trigSr = masterActiveClientSr;
      const trigTab = tabName || masterActiveTab;
      if (masterAutoSyncTimers[trigSr]) clearTimeout(masterAutoSyncTimers[trigSr]);
      masterAutoSyncTimers[trigSr] = setTimeout(() => {
        delete masterAutoSyncTimers[trigSr];
        pushMasterTabToDrive(trigTab, true, trigSr);
      }, 700);
    }

    async function pushMasterTabToDrive(tabName, isSilentAuto = false, targetSr = null) {
      const c = clients.find(x => x.sr === (targetSr || masterActiveClientSr));
      if (!c) return;
      const wb = getClientWorkbook(c.sr);
      const metrics = computeFullWorkbookMetrics(wb);
      const latestSummary = getLatestActiveWorkbookSummaryRow(wb, metrics, tabName || masterActiveTab);
      const latestRov = latestSummary ? latestSummary.d5Rov : c.rov;

      c.rov = latestRov;
      c._rovLocal = true; c._rovTs = Date.now();
      saveClients();

      const badge = document.getElementById("masterSyncStatusBadgeText");
      if (!scriptUrl) {
        if (badge) badge.textContent = "✅ Saved Locally (Drive Auto-Sync ke liye ⚙️ Setup me Sheet URL jodein)";
        if (!isSilentAuto) showToast("💾 Local Master Etsy Sheet me save ho gaya! (Drive Sync ke liye ⚙️ Setup me URL dalein)");
        return;
      }

      const isSingleMonth = tabName && tabName !== "Summary" && tabName !== "_InvoiceLog" && wb.tabs[tabName];
      const syncSet = new Set();

      if (!isSilentAuto || !isSingleMonth) {
        // Manual Push or Summary tab: sync all tabs containing orders, invoices, fees, or invMeta
        ALL_MASTER_MONTH_TABS.forEach(m => {
          const t = wb.tabs[m.tab];
          if (!t) return;
          const hasOrders = (t.orders || []).length > 0 || Number(t.manualGov || 0) > 0;
          const hasFees = Object.values(t.fees || {}).some(f => Number(f.charged || 0) || Number(f.credits || 0));
          const hasMeta = t.invMeta && Object.keys(t.invMeta).length > 0;
          const mRow = (metrics.allSummaryRows || []).find(r => r.tab === m.tab);
          if (hasOrders || hasFees || hasMeta || (mRow && mRow.invoicesCount > 0)) {
            syncSet.add(m.tab);
          }
        });
        if (syncSet.size === 0) {
          syncSet.add(isSingleMonth ? tabName : getActiveFyMonthTabs()[0].tab);
        }
      } else {
        // Silent auto-sync on a monthly tab: sync active tab + any linked cross-month invoice tabs
        syncSet.add(tabName);
        const activeMRow = (metrics.allSummaryRows || []).find(r => r.tab === tabName);
        if (activeMRow && Array.isArray(activeMRow.invoices)) {
          activeMRow.invoices.forEach(inv => {
            if (inv.srcTab && wb.tabs[inv.srcTab]) syncSet.add(inv.srcTab);
          });
        }
        ((wb.tabs[tabName] && wb.tabs[tabName].orders) || []).forEach(o => {
          const dt = parseFlexDate(o.invDate);
          if (dt) {
            const destMeta = ALL_MASTER_MONTH_TABS.find(x => x.m === dt.m && x.y === dt.y);
            if (destMeta && wb.tabs[destMeta.tab]) syncSet.add(destMeta.tab);
          }
        });
      }

      // Pending delete/clear tabs must be sent by manual Push as well as auto-sync.
      // Otherwise an empty month is omitted from a manual sync and stale rows stay in Drive.
      const forcePrefix = String(c.sr) + ":";
      masterForcePushTabs.forEach(forceKey => {
        const key = String(forceKey || "");
        if (!key.startsWith(forcePrefix)) return;
        const forcedTab = key.slice(forcePrefix.length);
        if (wb.tabs[forcedTab]) syncSet.add(forcedTab);
      });

      let tabsPayload = Array.from(syncSet).map(tKey => buildMasterTabSyncPayload(wb, tKey, metrics));
      // During silent auto-sync, never push a completely empty tab that could overwrite non-empty sheet rows
      if (isSilentAuto) {
        tabsPayload = tabsPayload.filter(tp => (tp.orders && tp.orders.length > 0) || (tp.topInvoices && tp.topInvoices.length > 0) || Number(tp.manualGov || 0) > 0 || masterForcePushTabs.has(c.sr + ":" + tp.tab));
        if (tabsPayload.length === 0) return;
      }
      // User ne is tab me order delete kiya hai: khaali hone par bhi Sheet ki purani rows saaf honi chahiye (server guard allowEmptyClear maangta hai)
      tabsPayload.forEach(tp => { if (masterForcePushTabs.has(c.sr + ":" + tp.tab)) tp.allowEmptyClear = true; });
      const firstTab = tabsPayload[0];
      const label = tabsPayload.length === 1 ? firstTab.tab : `${tabsPayload.length} tabs (${tabsPayload.map(x => x.tab).join(", ")})`;

      try {
        // Include root-level orders, topInvoices, fees, manualGov alongside tabs[] so both old and new Apps Script deployments write all rows properly!
        const payload = {
          action: "saveMasterEtsyTab",
          client: c.client,
          category: c.category,
          tab: firstTab.tab,
          prevTab: firstTab.prevTab,
          fullMonthName: firstTab.fullMonthName,
          orders: firstTab.orders,
          topInvoices: firstTab.topInvoices,
          fees: firstTab.fees,
          manualGov: firstTab.manualGov,
          allowEmptyClear: firstTab.allowEmptyClear === true,
          tabs: tabsPayload,
          rov: latestRov
        };
        const res = await postVerifiedToAppsScript(payload);
        const resSyncedTabs = (res.data && Array.isArray(res.data.syncedTabs)) ? res.data.syncedTabs : (res.raw && Array.isArray(res.raw.syncedTabs) ? res.raw.syncedTabs : null);
        const syncedTabNames = new Set();
        if (res.ok) {
          if (Array.isArray(resSyncedTabs)) {
            resSyncedTabs.forEach(t => syncedTabNames.add(String(t)));
          } else {
            // Legacy Apps Script may confirm only the root-level first tab.
            syncedTabNames.add(String(firstTab.tab));
          }

          // Retry any tabs the server did not confirm; preserve allowEmptyClear and check every response.
          const retryTabs = tabsPayload.filter(tp => !syncedTabNames.has(String(tp.tab)));
          for (const tp of retryTabs) {
            try {
              const retryRes = await postVerifiedToAppsScript({
                action: "saveMasterEtsyTab",
                client: c.client,
                category: c.category,
                tab: tp.tab,
                prevTab: tp.prevTab,
                fullMonthName: tp.fullMonthName,
                orders: tp.orders,
                topInvoices: tp.topInvoices,
                fees: tp.fees,
                manualGov: tp.manualGov,
                allowEmptyClear: tp.allowEmptyClear === true,
                rov: latestRov
              });
              if (retryRes && retryRes.ok) syncedTabNames.add(String(tp.tab));
            } catch (retryErr) {}
          }
        }

        const failedTabs = tabsPayload.filter(tp => !syncedTabNames.has(String(tp.tab)));
        const allSynced = res.ok && failedTabs.length === 0;
        tabsPayload.forEach(tp => {
          if (syncedTabNames.has(String(tp.tab))) masterForcePushTabs.delete(c.sr + ":" + tp.tab);
        });
        if (allSynced) {
          if (badge) badge.textContent = `✅ Auto-Synced ${c.client} (${label}) to Google Drive Master Sheet!`;
          if (!isSilentAuto) showToast(`☁️ ${c.client} (${label}) Drive Master Etsy Sheet me sync ho gaya!`);
        } else {
          const failure = res.ok
            ? `Tabs sync nahi hue: ${failedTabs.map(tp => tp.tab).join(", ")}`
            : (res.message || "Apps Script sync fail");
          if (badge) badge.textContent = `❌ Sync Failed: ${failure}`;
          if (!isSilentAuto) showToast(`❌ Master Sheet Sync FAIL (${failure}) — Sirf browser me save hai!`);
        }
      } catch (e) {
        if (badge) badge.textContent = "⚠️ Local Saved (Drive sync connection check karein)";
        if (!isSilentAuto) showToast("⚠️ Master Sheet Sync FAIL — connection check karein!");
      }
    }

    // Jin tabs me user ne order delete kiya hai unhe khaali hone par bhi Sheet me push karna hai (warna purani rows wapas aa jati hain)
    const masterForcePushTabs = new Set();
    const masterAutoPulledClients = new Set();
    const masterPullInFlight = new Set();

    function maybeAutoPullMasterForClient(sr) {
      const numSr = Number(sr);
      if (!scriptUrl || !numSr || masterAutoPulledClients.has(numSr) || masterPullInFlight.has(numSr)) return;
      masterAutoPulledClients.add(numSr);
      pullMasterFromDrive(true, numSr);
    }

    async function pullMasterFromDrive(isSilent = false, targetSr = null) {
      const sr = Number(targetSr || masterActiveClientSr);
      const c = clients.find(x => x.sr === sr);
      if (!c) return;
      if (!scriptUrl) {
        if (!isSilent) showToast("⚠️ Drive se pull karne ke liye pehle ⚙️ Setup me Apps Script URL save karein.");
        return;
      }
      if (masterPullInFlight.has(c.sr)) return;
      masterPullInFlight.add(c.sr);
      if (!isSilent) showStickyToast(`⏳ ${c.client} ki Master Etsy Statement Google Drive se la raha hoon...`, 4000);
      try {
        const res = await callAppsScript({ action: "readMasterEtsyFull", client: c.client, category: c.category });
        if (res && res.status === "ok" && res.tabs) {
          masterAutoPulledClients.add(c.sr);
          const wb = getClientWorkbook(c.sr);
          Object.keys(res.tabs).forEach(tKey => {
            if (!wb.tabs[tKey]) return;
            const incoming = res.tabs[tKey];
            const existingOrders = Array.isArray(wb.tabs[tKey].orders) ? wb.tabs[tKey].orders : [];
            if (Array.isArray(incoming.orders)) {
              if (incoming.orders.length === 0 && existingOrders.length > 0) {
                // Keep local orders if Drive tab returned empty so local billed invoices are never wiped!
              } else if (incoming.orders.length > 0) {
                // Smart merge: preserve local invNo, invDate, hsn, sb if Drive row is blank, respect locally deleted/released invoices, and retain _addedFromJson rows
                const mergedOrders = incoming.orders.map((incO, idx) => {
                  const matchLocal = existingOrders.find(lo => lo.orderNo && String(lo.orderNo) === String(incO.orderNo)) || existingOrders[idx];
                  if (incO.invNo && isInvReleasedInLog(wb, incO.invNo)) {
                    // Ye invoice abhi local me delete/release kiya gaya hai — purani Drive copy se wapas mat aane do!
                    incO.invNo = "";
                    incO.invDate = "";
                  }
                  if (matchLocal) {
                    if (!incO.invNo && matchLocal.invNo && !isInvReleasedInLog(wb, matchLocal.invNo)) incO.invNo = matchLocal.invNo;
                    if (!incO.invDate && matchLocal.invDate && incO.invNo) incO.invDate = matchLocal.invDate;
                    if (!incO.hsn && matchLocal.hsn) incO.hsn = matchLocal.hsn;
                    if (!incO.sb && matchLocal.sb) incO.sb = matchLocal.sb;
                  }
                  return incO;
                });
                const incomingOrderNos = new Set(mergedOrders.map(o => String(o.orderNo || "")));
                const incomingInvNos = new Set(mergedOrders.map(o => String(o.invNo || "").toUpperCase()).filter(Boolean));
                existingOrders.forEach(lo => {
                  if (lo._addedFromJson && lo.invNo && !isInvReleasedInLog(wb, lo.invNo) && !incomingInvNos.has(String(lo.invNo).toUpperCase()) && !incomingOrderNos.has(String(lo.orderNo || ""))) {
                    mergedOrders.push(lo);
                  }
                });
                wb.tabs[tKey].orders = mergedOrders;
              }
            }
            if (incoming.invMeta && typeof incoming.invMeta === "object") {
              wb.tabs[tKey].invMeta = Object.assign({}, wb.tabs[tKey].invMeta || {}, incoming.invMeta);
            }
            if (incoming.manualGov !== undefined && Number(incoming.manualGov) > 0) {
              wb.tabs[tKey].manualGov = Number(incoming.manualGov) || 0;
            }
            if (incoming.fees) {
              FEE_KEYS_META.forEach(fk => {
                if (incoming.fees[fk.key]) {
                  const ch = Number(incoming.fees[fk.key][0] || 0);
                  const cr = Number(incoming.fees[fk.key][1] || 0);
                  if (ch > 0 || cr > 0 || !wb.tabs[tKey].fees[fk.key]) {
                    wb.tabs[tKey].fees[fk.key] = { charged: ch, credits: cr };
                  }
                }
              });
            }
          });
          reconcileWorkbookWithInvoiceLog(wb, c);
          const maxPulledSeq = getHighestWorkbookSeq(wb, wb.prefix || "AD");
          wb.nextSeq = Math.max(wb.nextSeq || 1, maxPulledSeq + 1);
          const pulledMetrics = computeFullWorkbookMetrics(wb);
          const latestSummary = getLatestActiveWorkbookSummaryRow(wb, pulledMetrics, masterActiveTab);
          if (latestSummary) {
            c.rov = latestSummary.d5Rov;
            c._rovLocal = true; c._rovTs = Date.now();
            saveClients();
            if (typeof renderApp === "function") renderApp();
          }
          saveMasterWorkbooks();
          if (masterActiveClientSr === c.sr) {
            renderMasterEtsyPage();
            const badge = document.getElementById("masterSyncStatusBadgeText");
            if (badge) badge.textContent = `✅ Live Drive Data Loaded (${c.client})`;
          }
          if (currentAppPage === "json" && Number(jsonState.selectedSr) === Number(c.sr)) {
            syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
            renderJsonPage();
          }
          if (!isSilent) showToast(`✅ ${c.client} ki Live Master Etsy File Drive se load aur merge ho gayi!`);
        } else {
          if (!isSilent) showToast(`ℹ️ ${(res && res.message) || "Apps Script me naya code update karein (⚙️ Setup)"}`);
        }
      } catch (err) {
        if (!isSilent) showToast("ℹ️ Local Master Etsy replica active hai (Live pull ke liye ⚙️ Setup me naya AppSync.gs deploy karein).");
      } finally {
        masterPullInFlight.delete(c.sr);
      }
    }

    function openClientInMasterEtsyEditor(sr) {
      const c = clients.find(x => x.sr === Number(sr));
      if (!c) return;
      masterActiveClientSr = c.sr;
      const inp = document.getElementById("masterClientSearchInput");
      if (inp) inp.value = `#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"})`;
      switchAppPage("master");
      renderMasterEtsyPage();
      maybeAutoPullMasterForClient(c.sr);
      showToast(`📊 ${c.client} ki Master Etsy File khul gayi!`);
    }

    function renderMasterClientAutocomplete() {
      const inp = document.getElementById("masterClientSearchInput");
      const dd = document.getElementById("masterClientSearchDropdown");
      if (!inp || !dd) return;
      const rawQ = inp.value.startsWith("#") ? "" : inp.value.trim().toLowerCase();
      const etsyClients = clients.filter(c => !isInactive(c));
      const matched = !rawQ ? etsyClients : etsyClients.filter(c =>
        String(c.client || "").toLowerCase().includes(rawQ) ||
        String(c.firm || "").toLowerCase().includes(rawQ) ||
        String(c.gstin || "").toLowerCase().includes(rawQ) ||
        String(c.sheetSr || "") === rawQ
      );

      dd.innerHTML = matched.slice(0, 30).map(c => `
        <button type="button" data-master-pick-sr="${c.sr}" class="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center justify-between gap-2 transition ${c.sr === masterActiveClientSr ? 'bg-amber-50 font-bold' : ''}">
          <div class="min-w-0">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">#${c.sheetSr}</span>
            <span class="text-xs font-extrabold text-slate-900 ml-1">${c.client}</span>
            <span class="text-[11px] font-semibold text-indigo-700"> — ${c.firm || "-"}</span>
            <div class="text-[10px] font-mono text-slate-500">GSTIN: ${c.gstin || "N/A"} • ROV: ₹${Number(c.rov || 0).toLocaleString("en-IN")}</div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">📊 Master</span>
        </button>
      `).join("");
      dd.classList.remove("hidden");

      dd.querySelectorAll("[data-master-pick-sr]").forEach(btn => {
        btn.addEventListener("click", () => {
          const sr = parseInt(btn.getAttribute("data-master-pick-sr"), 10);
          const c = clients.find(x => x.sr === sr);
          if (c) {
            masterActiveClientSr = c.sr;
            inp.value = `#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"})`;
          }
          dd.classList.add("hidden");
          renderMasterEtsyPage();
          if (c) {
            maybeAutoPullMasterForClient(c.sr);
            showToast(`📊 ${c.client} ki Master Etsy File load ho gayi!`);
          }
        });
      });
    }

    const masterSearchInp = document.getElementById("masterClientSearchInput");
    const masterSearchDd = document.getElementById("masterClientSearchDropdown");
    const masterSearchClear = document.getElementById("masterClientSearchClearBtn");
    if (masterSearchInp) {
      masterSearchInp.addEventListener("focus", () => {
        masterSearchInp.select();
        renderMasterClientAutocomplete();
      });
      masterSearchInp.addEventListener("input", renderMasterClientAutocomplete);
    }
    if (masterSearchClear) {
      masterSearchClear.addEventListener("click", () => {
        if (masterSearchInp) { masterSearchInp.value = ""; masterSearchInp.focus(); }
        renderMasterClientAutocomplete();
      });
    }
    document.addEventListener("click", e => {
      const wrap = document.getElementById("masterClientSearchWrapper");
      if (wrap && !wrap.contains(e.target) && masterSearchDd) masterSearchDd.classList.add("hidden");
    });

    function renderMasterEtsyPage() {
      const c = clients.find(x => x.sr === masterActiveClientSr) || clients[0];
      if (!c) return;
      const wb = getClientWorkbook(c.sr);

      const sInp = document.getElementById("masterClientSearchInput");
      if (sInp && (!sInp.value || document.activeElement !== sInp)) {
        sInp.value = `#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"})`;
      }

      document.getElementById("masterInvPrefixInput").value = wb.prefix || "AD";
      document.getElementById("masterInvNextNumInput").value = String(wb.nextSeq || 1);

      const metrics = computeFullWorkbookMetrics(wb);

      const fySel = document.getElementById("masterFySelect");
      if (fySel) fySel.value = masterActiveFy;
      const activeFyMonths = getActiveFyMonthTabs();
      const fyHeading = document.getElementById("masterSummaryFyHeading");
      if (fyHeading && activeFyMonths.length === 12) {
        fyHeading.textContent = `📈 Monthly Summary, FY ${masterActiveFy} (${activeFyMonths[0].tab} to ${activeFyMonths[11].tab})`;
      }

      // Render Sheet Tabs Bar (Summary + Active FY's 12 Months + _InvoiceLog)
      const tabsBar = document.getElementById("masterSheetTabsBar");
      const allTabs = [
        { id: "Summary", label: `📈 Summary (${masterActiveFy})` },
        ...activeFyMonths.map(m => {
          const tOrders = (wb.tabs[m.tab] && wb.tabs[m.tab].orders.length) || 0;
          return { id: m.tab, label: `${m.tab}${tOrders > 0 ? ` (${tOrders})` : ""}` };
        }),
        { id: "_InvoiceLog", label: `🔒 _InvoiceLog (${wb.invoiceLog.length})` }
      ];

      tabsBar.replaceChildren();
      allTabs.forEach(t => {
        const btn = document.createElement("button"); btn.type = "button"; btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", masterActiveTab === t.id ? "true" : "false");
        btn.className = "month-tab-btn" + (masterActiveTab === t.id ? " is-active" : "");
        btn.textContent = t.id === "Summary" ? "Summary" : (t.id === "_InvoiceLog" ? `Invoice Log (${wb.invoiceLog.length})` : t.label);
        btn.title = t.label; btn.addEventListener("click", () => { masterActiveTab = t.id; renderMasterEtsyPage(); });
        tabsBar.appendChild(btn);
      });

      const vSum = document.getElementById("masterViewSummary");
      const vMon = document.getElementById("masterViewMonth");
      const vLog = document.getElementById("masterViewInvoiceLog");

      vSum.classList.toggle("hidden", masterActiveTab !== "Summary");
      vLog.classList.toggle("hidden", masterActiveTab !== "_InvoiceLog");
      vMon.classList.toggle("hidden", masterActiveTab === "Summary" || masterActiveTab === "_InvoiceLog");

      if (masterActiveTab === "Summary") {
        document.getElementById("masterSummaryClientLabel").textContent = `${c.client} (${c.firm})`;
        let totInv = 0, totTx = 0, totTax = 0, totNet = 0, totGross = 0;
        const sumBody = document.getElementById("masterSummaryTableBody");
        sumBody.innerHTML = metrics.summaryRows.map(r => {
          totInv += r.invoicesCount;
          totTx += r.d8Taxable;
          totTax += r.g8Tax;
          totNet += r.h8Net;
          totGross += r.d4GrossOrder;
          return `
            <tr class="hover:bg-indigo-50/40 border-b border-slate-100 cursor-pointer" data-sum-goto="${r.tab}">
              <td class="py-2.5 px-3 font-bold text-slate-800">${r.tab}</td>
              <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-mono font-bold">${r.tab}</span></td>
              <td class="py-2.5 px-3 text-center font-mono font-bold ${r.invoicesCount > 0 ? 'text-indigo-700' : 'text-slate-400'}">${r.invoicesCount}</td>
              <td class="py-2.5 px-3 text-right font-mono font-semibold">₹${r.d8Taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-right font-mono">₹${r.g8Tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-right font-mono font-semibold">₹${r.h8Net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-right font-mono font-bold bg-amber-50/40 text-amber-950">₹${r.d4GrossOrder.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-right font-mono font-black bg-emerald-50/50 text-emerald-800">₹${r.d5Rov.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2.5 px-3 text-center">
                <button type="button" data-sum-open-btn="${r.tab}" class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">Open ${r.tab} →</button>
              </td>
            </tr>
          `;
        }).join("");

        const lastRov = metrics.summaryRows[metrics.summaryRows.length - 1].d5Rov;
        document.getElementById("masterSummaryTableFoot").innerHTML = `
          <tr>
            <td class="py-3 px-3 font-black">Total <span class="sref">(Row 17)</span></td>
            <td class="py-3 px-3 text-center">-</td>
            <td class="py-3 px-3 text-center">${totInv}</td>
            <td class="py-3 px-3 text-right">₹${r2(totTx).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-3 px-3 text-right">₹${r2(totTax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-3 px-3 text-right">₹${r2(totNet).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-3 px-3 text-right text-amber-300">₹${r2(totGross).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-3 px-3 text-right text-emerald-300">Closing ROV: ₹${r2(lastRov).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr>
        `;

        sumBody.querySelectorAll("[data-sum-goto]").forEach(rowEl => {
          rowEl.addEventListener("click", () => {
            masterActiveTab = rowEl.getAttribute("data-sum-goto");
            renderMasterEtsyPage();
          });
        });
        return;
      }

      if (masterActiveTab === "_InvoiceLog") {
        const logBody = document.getElementById("masterInvoiceLogTableBody");
        logBody.innerHTML = wb.invoiceLog.length === 0
          ? `<tr><td data-sref-colspan-off="5" colspan="6" class="text-center py-8 text-slate-400">Abhi tak koi Invoice No. assign nahi hua hai.</td></tr>`
          : wb.invoiceLog.map(item => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3">${item.ts}</td>
              <td class="py-2 px-3 font-bold text-indigo-700">${item.tab}</td>
              <td class="py-2 px-3 sref-col">${item.row}</td>
              <td class="py-2 px-3 font-black text-emerald-700">${item.invNo}</td>
              <td class="py-2 px-3">${item.invDate}</td>
              <td class="py-2 px-3"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">${item.event}</span></td>
            </tr>
          `).join("");
        return;
      }

      // Render Active Monthly Tab (align FY/tab safely so cross-FY never crashes)
      let mMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === masterActiveTab);
      if (mMeta && mMeta.fy !== masterActiveFy) {
        masterActiveFy = mMeta.fy;
        if (fySel) fySel.value = masterActiveFy;
      }
      if (!mMeta) mMeta = getActiveFyMonthTabs()[0];
      const tData = wb.tabs[mMeta.tab];
      const mRow = (metrics.allSummaryRows || []).find(x => x.tab === mMeta.tab) || metrics.summaryRows[0];

      document.getElementById("masterMonthClientTitle").textContent = `${c.client} (${c.firm})`;
      document.getElementById("masterMonthNameSubtitle").textContent = `${mMeta.tab}`;
      document.getElementById("masterTopInvMonthLabel").textContent = `${mMeta.tab}`;
      document.getElementById("masterGstSummaryMonthBadge").textContent = mMeta.tab;

      document.getElementById("masterCellC4PrevRov").textContent = `₹${mRow.c4PrevRov.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      document.getElementById("masterCellD4GrossOrder").textContent = `₹${mRow.d4GrossOrder.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      const ordersSumForTab = r2((tData.orders || []).reduce((acc, o) => acc + calcOrderTaxable(o), 0));
      const d4Note = document.getElementById("masterCellD4ModeNote");
      const mgWrap = document.getElementById("masterManualGovWrap");
      const mgInp = document.getElementById("masterManualGovInput");
      if (ordersSumForTab > 0) {
        if (d4Note) d4Note.innerHTML = 'Auto = Data Part Total<span class="sref"> (I75)</span>';
        if (mgWrap) mgWrap.classList.add("hidden");
      } else {
        if (d4Note) d4Note.textContent = "Data Part 0 — E4:P4 Fallback Active";
        if (mgWrap) mgWrap.classList.remove("hidden");
        if (mgInp) mgInp.value = String(Number(tData.manualGov || 0));
      }
      document.getElementById("masterCellD8InvoicedVal").textContent = `₹${mRow.d8Taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      document.getElementById("masterCellB8InvoiceCount").textContent = `${mRow.invoicesCount} Invoices billed in ${mMeta.tab}`;
      document.getElementById("masterCellD5RemainingRov").textContent = `₹${mRow.d5Rov.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

      document.getElementById("masterCellG8TaxTotal").textContent = `₹${mRow.g8Tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      document.getElementById("masterCellH8NetTotal").textContent = `₹${mRow.h8Net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

      // 1. Render Top Invoices Table (Rows 9 to 38)
      const topInvBody = document.getElementById("masterTopInvoicesTableBody");
      if (mRow.invoices.length === 0) {
        topInvBody.innerHTML = `<tr><td data-sref-colspan-off="12" colspan="13" class="text-center py-6 text-slate-400">Is mahine (${mMeta.tab}) me abhi koi Invoice Date <span class="sref">(Col K)</span> assign nahi hai. Neeche <b>1. ETSY ORDERS</b> me kisi order ke <b>Col K (Invoice date)</b> me manually date dalein!</td></tr>`;
      } else {
        topInvBody.innerHTML = mRow.invoices.map((inv, idx) => `
          <tr class="hover:bg-indigo-50/30 border-b border-slate-100">
            <td class="py-2 px-2.5 font-mono text-slate-400 font-bold sref-col">#${9 + idx}</td>
            <td class="py-2 px-2.5 font-mono text-slate-700">${inv.payDate} <span class="text-[10px] text-slate-400">(${inv.srcTab})</span></td>
            <td class="py-2 px-2.5 font-mono font-black text-indigo-700">${inv.invNo}</td>
            <td class="py-2 px-2.5 font-mono font-bold text-slate-800">${inv.invDate}</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-emerald-800">₹${inv.txval.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-2 px-2.5 text-center font-mono">${inv.hsn}</td>
            <td class="py-2 px-2.5 text-center bg-amber-50/50">
              <select data-topinv-no="${inv.invNo}" data-topinv-field="rate" aria-label="Tax Rate for ${inv.invNo}" class="topinv-edit-inp rounded border border-amber-300 bg-white px-1.5 py-1 text-xs font-bold">
                <option value="0" ${inv.rate === 0 ? 'selected' : ''}>0%</option>
                <option value="5" ${inv.rate === 5 ? 'selected' : ''}>5%</option>
                <option value="8" ${inv.rate === 8 ? 'selected' : ''}>8%</option>
                <option value="18" ${inv.rate === 18 ? 'selected' : ''}>18%</option>
              </select>
            </td>
            <td class="py-2 px-2.5 text-right font-mono">₹${inv.tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold">₹${inv.netVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="py-2 px-2.5 bg-amber-50/50"><input type="text" value="${inv.portCode}" data-topinv-no="${inv.invNo}" data-topinv-field="portCode" placeholder="Port" class="topinv-edit-inp w-20 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono uppercase" /></td>
            <td class="py-2 px-2.5 bg-amber-50/50"><input type="text" value="${inv.sbNo}" data-topinv-no="${inv.invNo}" data-topinv-field="sbNo" placeholder="SB No" class="topinv-edit-inp w-24 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono" /></td>
            <td class="py-2 px-2.5 bg-amber-50/50"><input type="text" value="${inv.sbDate}" data-topinv-no="${inv.invNo}" data-topinv-field="sbDate" placeholder="DD/MM/YYYY" class="topinv-edit-inp w-24 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono" /></td>
            <td class="py-2 px-2.5 text-center bg-amber-50/50">
              <select data-topinv-no="${inv.invNo}" data-topinv-field="csNcs" aria-label="CS/NCS for ${inv.invNo}" class="topinv-edit-inp rounded border border-amber-300 bg-white px-1.5 py-1 text-xs font-bold">
                <option value="NCS" ${inv.csNcs === 'NCS' ? 'selected' : ''}>NCS</option>
                <option value="CS" ${inv.csNcs === 'CS' ? 'selected' : ''}>CS</option>
              </select>
            </td>
          </tr>
        `).join("");

        topInvBody.querySelectorAll(".topinv-edit-inp").forEach(el => {
          el.addEventListener("change", () => {
            const invNo = el.getAttribute("data-topinv-no");
            const field = el.getAttribute("data-topinv-field");
            tData.invMeta[invNo] = tData.invMeta[invNo] || { rate: 5, portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" };
            tData.invMeta[invNo][field] = field === "rate" ? parseFloat(el.value || "0") : el.value.trim();
            triggerMasterAutoSync(mMeta.tab);
            renderMasterEtsyPage();
          });
        });
      }

      // 2. Render Section 1: 1. ETSY ORDERS (Rows 45 to 75)
      const ordBody = document.getElementById("masterOrdersTableBody");
      let totGross = 0, totRefund = 0, totBuyerTax = 0, totTaxRefund = 0, totTcs = 0, totTds = 0, totTaxable = 0;

      if (tData.orders.length === 0) {
        ordBody.innerHTML = `<tr><td data-sref-colspan-off="15" colspan="16" class="text-center py-8 text-slate-400">Is tab (${mMeta.tab}) me abhi koi Etsy Order nahi hai. Upar <b>📤 Upload Etsy CSV to Master</b> ya <b>➕ Add New Order Row</b> dabayein.</td></tr>`;
      } else {
        ordBody.innerHTML = tData.orders.map((o, idx) => {
          const txval = calcOrderTaxable(o);
          totGross += Number(o.gross || 0);
          totRefund += Number(o.refund || 0);
          totBuyerTax += Number(o.buyerTax || 0);
          totTaxRefund += Number(o.taxRefund || 0);
          totTcs += Number(o.tcs || 0);
          totTds += Number(o.tds || 0);
          totTaxable += txval;
          const hsnVal = o.invDate ? (o.hsn || "5703") : "";

          return `
            <tr class="hover:bg-amber-50/30 border-b border-slate-100">
              <td class="py-1.5 px-2 font-mono text-slate-400 font-bold sref-col">#${45 + idx}</td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="text" value="${o.payDate || ''}" data-ord-idx="${idx}" data-ord-field="payDate" placeholder="DD/MM/YYYY" class="master-ord-inp w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="text" value="${o.orderNo || ''}" data-ord-idx="${idx}" data-ord-field="orderNo" placeholder="Order #" class="master-ord-inp w-28 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-indigo-800" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.gross || 0}" data-ord-idx="${idx}" data-ord-field="gross" class="master-ord-inp w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right font-bold" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.refund || 0}" data-ord-idx="${idx}" data-ord-field="refund" class="master-ord-inp w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.buyerTax || 0}" data-ord-idx="${idx}" data-ord-field="buyerTax" class="master-ord-inp w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right text-amber-800" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.taxRefund || 0}" data-ord-idx="${idx}" data-ord-field="taxRefund" class="master-ord-inp w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.tcs || 0}" data-ord-idx="${idx}" data-ord-field="tcs" class="master-ord-inp w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="number" step="0.01" value="${o.tds || 0}" data-ord-idx="${idx}" data-ord-field="tds" class="master-ord-inp w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right" /></td>
              <td class="py-1.5 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">₹${txval.toLocaleString("en-IN")}</td>
              <td class="py-1.5 px-1.5 bg-indigo-50/40"><input type="text" value="${o.invNo || ''}" data-ord-idx="${idx}" data-ord-field="invNo" placeholder="Auto Lock" class="master-ord-inp w-20 rounded border border-indigo-200 bg-white px-2 py-1 text-xs font-mono font-black text-indigo-800" /></td>
              <td class="py-1.5 px-1.5 bg-amber-100/60"><input type="text" value="${o.invDate || ''}" data-ord-idx="${idx}" data-ord-field="invDate" placeholder="DD/MM/YYYY" class="master-ord-inp w-24 rounded border-2 border-amber-400 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-900" /></td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="text" value="${o.country || ''}" data-ord-idx="${idx}" data-ord-field="country" placeholder="US" class="master-ord-inp w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-mono uppercase text-center" /></td>
              <td class="py-1.5 px-2 text-center font-mono text-slate-600 bg-slate-50">${hsnVal}</td>
              <td class="py-1.5 px-1.5 bg-amber-50/30"><input type="text" value="${o.sb || ''}" data-ord-idx="${idx}" data-ord-field="sb" placeholder="NCS/SB" class="master-ord-inp w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono" /></td>
              <td class="py-1.5 px-2 text-center"><button type="button" data-del-master-ord="${idx}" class="del-master-ord-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `;
        }).join("");

        ordBody.querySelectorAll(".master-ord-inp").forEach(inp => {
          inp.addEventListener("change", () => {
            const idx = parseInt(inp.getAttribute("data-ord-idx"), 10);
            const field = inp.getAttribute("data-ord-field");
            const ord = tData.orders[idx];
            if (!ord) return;
            const prevInvNo = String(ord.invNo || "").trim();
            const prevInvDate = String(ord.invDate || "").trim();
            const numFields = ["gross", "refund", "buyerTax", "taxRefund", "tcs", "tds"];
            if (numFields.includes(field)) {
              ord[field] = Math.max(0, parseFloat(inp.value || "0"));
            } else {
              ord[field] = inp.value.trim();
            }

            if (field === "invNo") {
              const newInvNo = String(ord.invNo || "").trim().toUpperCase();
              ord.invNo = newInvNo;
              if (newInvNo) {
                const usedSet = getActiveWorkbookInvSet(wb, mMeta.tab, idx);
                if (usedSet.has(newInvNo)) {
                  ord.invNo = prevInvNo;
                  inp.value = prevInvNo;
                  const suggested = `${wb.prefix || "AD"}${String(Math.max(wb.nextSeq || 1, getHighestWorkbookSeq(wb, wb.prefix || "AD") + 1)).padStart(3, "0")}`;
                  showToast(`⚠️ Invoice ${newInvNo} pehle se maujood hai! Agla free no. ${suggested} dalein.`);
                  return;
                }
              }
              if (prevInvNo && prevInvNo.toUpperCase() !== newInvNo) {
                logInvoiceRelease(wb, mMeta.tab, 45 + idx, prevInvNo, prevInvDate, "RELEASED", ord.orderNo);
                if (tData.invMeta && tData.invMeta[prevInvNo]) {
                  if (newInvNo && !tData.invMeta[newInvNo]) tData.invMeta[newInvNo] = tData.invMeta[prevInvNo];
                  delete tData.invMeta[prevInvNo];
                }
              }
              if (!newInvNo) {
                // Invoice No. hatane par Date bhi clear karein taaki adhura/duplicate state na bache
                ord.invDate = "";
                ord.hsn = "";
                if (prevInvNo) {
                  recalcNextSeqAfterRelease(wb, prevInvNo);
                  showToast(`🔓 Invoice No. ${prevInvNo} release ho gaya`);
                }
              } else {
                ord.hsn = ord.hsn || "5703";
                syncWorkbookSeqFromManualInv(wb, newInvNo);
                if (ord.invDate) {
                  wb.invoiceLog.unshift({
                    ts: new Date().toLocaleString("en-IN"),
                    tab: mMeta.tab,
                    row: 45 + idx,
                    orderNo: ord.orderNo ? String(ord.orderNo) : "",
                    invNo: newInvNo,
                    invDate: ord.invDate,
                    event: "ASSIGNED"
                  });
                }
                showToast(`✅ Invoice ${newInvNo} set ho gaya — Next No.: ${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`);
              }
              saveMasterWorkbooks();
            } else if (field === "invDate") {
              if (prevInvDate && !ord.invDate) {
                // Date hatane par us row ka Invoice lock bhi release karein
                if (prevInvNo) {
                  logInvoiceRelease(wb, mMeta.tab, 45 + idx, prevInvNo, prevInvDate, "RELEASED", ord.orderNo);
                  ord.invNo = "";
                  recalcNextSeqAfterRelease(wb, prevInvNo);
                  showToast(`🔓 Invoice ${prevInvNo} release ho gaya`);
                }
                ord.hsn = "";
                saveMasterWorkbooks();
              } else if (ord.invDate && !ord.invNo) {
                // Automatic Invoice No. Lock when Column K (invDate) is entered — skips any already-used number!
                const pref = (document.getElementById("masterInvPrefixInput").value || wb.prefix || "AD").trim().toUpperCase();
                const reqSeq = parseInt(document.getElementById("masterInvNextNumInput").value || String(wb.nextSeq || 1), 10);
                const assignedInvNo = allocateNextWorkbookInvNo(wb, pref, reqSeq);
                ord.invNo = assignedInvNo;
                ord.hsn = ord.hsn || "5703";
                wb.invoiceLog.unshift({
                  ts: new Date().toLocaleString("en-IN"),
                  tab: mMeta.tab,
                  row: 45 + idx,
                  orderNo: ord.orderNo ? String(ord.orderNo) : "",
                  invNo: assignedInvNo,
                  invDate: ord.invDate,
                  event: "ASSIGNED"
                });
                saveMasterWorkbooks();
                showToast(`🔒 Invoice No. ${assignedInvNo} lock ho gaya (Next: ${wb.prefix}${String(wb.nextSeq).padStart(3, "0")})!`);
              } else if (ord.invDate && ord.invNo) {
                // User ne pehle Invoice No. likha tha aur ab Date dali: sequence aur log dono update karein!
                ord.invNo = String(ord.invNo).trim().toUpperCase();
                ord.hsn = ord.hsn || "5703";
                syncWorkbookSeqFromManualInv(wb, ord.invNo);
                wb.invoiceLog.unshift({
                  ts: new Date().toLocaleString("en-IN"),
                  tab: mMeta.tab,
                  row: 45 + idx,
                  orderNo: ord.orderNo ? String(ord.orderNo) : "",
                  invNo: ord.invNo,
                  invDate: ord.invDate,
                  event: "ASSIGNED"
                });
                saveMasterWorkbooks();
                showToast(`🔒 Invoice No. ${ord.invNo} lock ho gaya (Next: ${wb.prefix}${String(wb.nextSeq).padStart(3, "0")})!`);
              }
            }

            triggerMasterAutoSync(mMeta.tab);
            renderMasterEtsyPage();
          });
        });

        ordBody.querySelectorAll(".del-master-ord-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-del-master-ord"), 10);
            const delOrd = tData.orders[idx];
            if (!confirmDelete(`Master Sheet se ye order delete karna hai${delOrd && delOrd.invNo ? " (Invoice " + delOrd.invNo + ")" : ""}?`)) return;
            const delRow = 45 + idx;
            tData.orders.splice(idx, 1);
            // Niche ki rows ek upar khisak gayi: log ke row numbers bhi usi hisab se adjust karo
            if (Array.isArray(wb.invoiceLog)) {
              wb.invoiceLog.forEach(l => { if (l && l.tab === mMeta.tab && Number(l.row) > delRow) l.row = Number(l.row) - 1; });
            }
            if (delOrd && delOrd.invNo) {
              if (tData.invMeta && tData.invMeta[delOrd.invNo]) delete tData.invMeta[delOrd.invNo];
              logInvoiceRelease(wb, mMeta.tab, delRow, delOrd.invNo, delOrd.invDate, "DELETED", delOrd.orderNo);
              recalcNextSeqAfterRelease(wb, delOrd.invNo);
              showToast(`🗑️ Invoice ${delOrd.invNo} delete ho gaya — Next No.: ${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`);
            }
            masterForcePushTabs.add(masterActiveClientSr + ":" + mMeta.tab);
            saveMasterWorkbooks();
            triggerMasterAutoSync(mMeta.tab);
            renderMasterEtsyPage();
          });
        });
      }

      document.getElementById("masterOrdersTableFoot").innerHTML = `
        <tr>
          <td data-sref-colspan-off="2" colspan="3" class="py-2.5 px-2 font-black text-amber-300">***** <span class="sref">(Row 75 Total)</span></td>
          <td class="py-2.5 px-2 text-right">₹${r2(totGross).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right">₹${r2(totRefund).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right">₹${r2(totBuyerTax).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right">₹${r2(totTaxRefund).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right">₹${r2(totTcs).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right">₹${r2(totTds).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2 text-right text-emerald-300 font-black">₹${r2(totTaxable).toLocaleString("en-IN")}</td>
          <td colspan="6"></td>
        </tr>
      `;

      // 3. Render Section 2: 2. ETSY FEES (Rows 87 to 93)
      const feesBody = document.getElementById("masterFeesTableBody");
      let totFeeCharged = 0, totFeeCredits = 0, totFeeNet = 0, totFeeIgst = 0;

      feesBody.innerHTML = FEE_KEYS_META.map((fk, idx) => {
        const fObj = (tData.fees && tData.fees[fk.key]) || { charged: 0, credits: 0 };
        const net = r2(Math.max(0, Number(fObj.charged || 0) - Number(fObj.credits || 0)));
        const igst = Math.round(net * 0.18);
        totFeeCharged += Number(fObj.charged || 0);
        totFeeCredits += Number(fObj.credits || 0);
        totFeeNet += net;
        totFeeIgst += igst;

        return `
          <tr class="hover:bg-rose-50/30 border-b border-slate-100">
            <td class="py-2 px-3 font-bold text-slate-800">${fk.label} <span class="text-[10px] font-mono text-slate-400">(#${87 + idx})</span></td>
            <td class="py-1.5 px-2 bg-amber-50/40"><input type="number" step="0.01" value="${fObj.charged || 0}" data-fee-key="${fk.key}" data-fee-col="charged" aria-label="${fk.label} Charged" class="master-fee-inp w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right font-bold" /></td>
            <td class="py-1.5 px-2 bg-amber-50/40"><input type="number" step="0.01" value="${fObj.credits || 0}" data-fee-key="${fk.key}" data-fee-col="credits" aria-label="${fk.label} Credits" class="master-fee-inp w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-right" /></td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-slate-900">₹${net.toLocaleString("en-IN")}</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-rose-700">₹${igst.toLocaleString("en-IN")}</td>
            <td class="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">₹${igst.toLocaleString("en-IN")}</td>
          </tr>
        `;
      }).join("");

      feesBody.querySelectorAll(".master-fee-inp").forEach(inp => {
        inp.addEventListener("change", () => {
          const k = inp.getAttribute("data-fee-key");
          const col = inp.getAttribute("data-fee-col");
          tData.fees[k] = tData.fees[k] || { charged: 0, credits: 0 };
          tData.fees[k][col] = Math.max(0, parseFloat(inp.value || "0"));
          triggerMasterAutoSync(mMeta.tab);
          renderMasterEtsyPage();
        });
      });

      const feeQuickBadge = document.getElementById("masterFeesHeaderQuickBadge");
      if (feeQuickBadge) {
        feeQuickBadge.textContent = `RCM Base: ₹${Math.round(totFeeNet).toLocaleString("en-IN")} | IGST: ₹${totFeeIgst.toLocaleString("en-IN")}`;
      }

      document.getElementById("masterFeesTableFoot").innerHTML = `
        <tr>
          <td class="py-2.5 px-3 font-black">Total<span class="sref"> (Row 93)</span></td>
          <td class="py-2.5 px-2.5 text-right">₹${r2(totFeeCharged).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2.5 text-right">₹${r2(totFeeCredits).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2.5 text-right text-amber-300">₹${r2(totFeeNet).toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2.5 text-right text-rose-300">₹${totFeeIgst.toLocaleString("en-IN")}</td>
          <td class="py-2.5 px-2.5 text-right text-emerald-300">₹${totFeeIgst.toLocaleString("en-IN")}</td>
        </tr>
      `;

      // 4. Render Section 3: 3. GST SUMMARY (Rows 100 to 114)
      const netSalesInclTax = r2(totGross - totRefund);
      const buyerTaxNet = r2(totBuyerTax - totTaxRefund);
      const tcsPct = totTaxable > 0 ? ((totTcs / totTaxable) * 100).toFixed(2) + "%" : "0.00%";
      const tdsPct = totTaxable > 0 ? ((totTds / totTaxable) * 100).toFixed(2) + "%" : "0.00%";

      const gstSummaryRows = [
        ["Row 100 • Month", mMeta.tab, "font-bold text-indigo-800"],
        ["Row 101 • Gross payments received (=C75)", `₹${r2(totGross).toLocaleString("en-IN")}`, "font-mono font-bold"],
        ["Row 102 • Less: refunds (=D75)", `₹${r2(totRefund).toLocaleString("en-IN")}`, "font-mono"],
        ["Row 103 • Net sales (incl. buyer tax) (=B101-B102)", `₹${netSalesInclTax.toLocaleString("en-IN")}`, "font-mono font-semibold"],
        ["Row 104 • Less: buyer sales tax (net of refund) (=E75-F75)", `₹${buyerTaxNet.toLocaleString("en-IN")}`, "font-mono text-amber-800"],
        ["Row 105 • Taxable value (outward supply) (=B103-B104)", `₹${r2(totTaxable).toLocaleString("en-IN")}`, "font-mono font-black text-emerald-700 text-sm bg-emerald-50/60"],
        ["Row 107 • TCS credit (net, expected 0.5%) (=G75)", `₹${r2(totTcs).toLocaleString("en-IN")} (${tcsPct})`, "font-mono font-semibold"],
        ["Row 109 • TDS (income tax - not GST) (=H75)", `₹${r2(totTds).toLocaleString("en-IN")} (${tdsPct})`, "font-mono"],
        ["Row 112 • Etsy fees - net value (RCM base) (=D93)", `₹${r2(totFeeNet).toLocaleString("en-IN")}`, "font-mono font-bold text-rose-800"],
        ["Row 113 • IGST payable under RCM (18%) (=E93)", `₹${totFeeIgst.toLocaleString("en-IN")}`, "font-mono font-black text-rose-700 bg-rose-50/50"],
        ["Row 114 • ITC on RCM (=F93)", `₹${totFeeIgst.toLocaleString("en-IN")}`, "font-mono font-bold text-emerald-700"]
      ];

      document.getElementById("masterGstSummaryTableBody").innerHTML = gstSummaryRows.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="py-2 px-3 text-slate-700 font-medium">${r[0]}</td>
          <td class="py-2 px-3 text-right ${r[2]}">${r[1]}</td>
        </tr>
      `).join("");
    }

    // Master Etsy Page Action Button Listeners
    document.getElementById("masterAddOrderRowBtn").addEventListener("click", () => {
      const wb = getClientWorkbook(masterActiveClientSr);
      const tKey = (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog") ? masterActiveTab : "Sep26";
      masterActiveTab = tKey;
      const mMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === tKey) || getActiveFyMonthTabs()[0];
      wb.tabs[tKey].orders.push({
        payDate: `15/${String(mMeta.m).padStart(2, "0")}/${mMeta.y}`,
        orderNo: String(Math.floor(4200000000 + Math.random() * 90000000)),
        gross: 0,
        refund: 0,
        buyerTax: 0,
        taxRefund: 0,
        tcs: 0,
        tds: 0,
        invNo: "",
        invDate: "",
        country: "US",
        hsn: "",
        sb: ""
      });
      saveMasterWorkbooks();
      renderMasterEtsyPage();
      showToast(`➕ ${tKey} me nayi Order Row (#${44 + wb.tabs[tKey].orders.length}) jud gayi!`);
    });

    document.getElementById("masterPullFromDriveBtn").addEventListener("click", () => pullMasterFromDrive(false));
    const masterInvPrefInpEl = document.getElementById("masterInvPrefixInput");
    if (masterInvPrefInpEl) {
      masterInvPrefInpEl.addEventListener("change", () => {
        const wb = getClientWorkbook(masterActiveClientSr);
        wb.prefix = (masterInvPrefInpEl.value || "AD").trim().toUpperCase() || "AD";
        masterInvPrefInpEl.value = wb.prefix;
        saveMasterWorkbooks();
      });
    }
    const masterInvNextInpEl = document.getElementById("masterInvNextNumInput");
    if (masterInvNextInpEl) {
      masterInvNextInpEl.addEventListener("change", () => {
        const wb = getClientWorkbook(masterActiveClientSr);
        const v = parseInt(masterInvNextInpEl.value || "1", 10);
        if (!isNaN(v) && v >= 1) {
          wb.nextSeq = v;
          saveMasterWorkbooks();
        }
      });
    }
    const masterManualGovInpEl = document.getElementById("masterManualGovInput");
    if (masterManualGovInpEl) {
      masterManualGovInpEl.addEventListener("change", () => {
        const wb = getClientWorkbook(masterActiveClientSr);
        const tKey = (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog") ? masterActiveTab : "Sep26";
        if (!wb.tabs[tKey]) return;
        wb.tabs[tKey].manualGov = Math.max(0, parseFloat(masterManualGovInpEl.value || "0") || 0);
        triggerMasterAutoSync(tKey);
        renderMasterEtsyPage();
      });
    }
    const masterFySelectEl = document.getElementById("masterFySelect");
    if (masterFySelectEl) {
      masterFySelectEl.addEventListener("change", e => {
        masterActiveFy = e.target.value;
        const fyTabs = getActiveFyMonthTabs();
        if (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog") {
          masterActiveTab = fyTabs[0].tab; // Switch to April of the selected FY (e.g. Apr27)
        }
        renderMasterEtsyPage();
        showToast(`📅 Financial Year switched to FY ${masterActiveFy} (${fyTabs[0].tab}–${fyTabs[11].tab}) — Previous Closing ROV carried forward!`);
      });
    }

    document.getElementById("masterPushToDriveBtn").addEventListener("click", () => {
      pushMasterTabToDrive(masterActiveTab, false);
    });
    document.getElementById("masterOpenDriveSheetBtn").addEventListener("click", () => {
      const c = clients.find(x => x.sr === masterActiveClientSr);
      if (c) openEtsyMasterCurrentMonth(c);
    });

    document.getElementById("toggleMasterFeesSecBtn").addEventListener("click", () => {
      const body = document.getElementById("masterFeesAccordionBody");
      const arrow = document.getElementById("masterFeesToggleArrow");
      if (!body) return;
      const willOpen = body.classList.contains("hidden");
      body.classList.toggle("hidden", !willOpen);
      if (arrow) arrow.textContent = willOpen ? "▴ Band Karein" : "▾ Kholein";
    });

    document.getElementById("toggleMasterGstSummarySecBtn").addEventListener("click", () => {
      const body = document.getElementById("masterGstSummaryAccordionBody");
      const arrow = document.getElementById("masterGstSummaryToggleArrow");
      if (!body) return;
      const willOpen = body.classList.contains("hidden");
      body.classList.toggle("hidden", !willOpen);
      if (arrow) arrow.textContent = willOpen ? "▴ Band Karein" : "▾ Kholein";
    });

    // Upload Etsy CSV directly into Master Etsy Workbook (auto-routes to the CSV's month tab!)
    document.getElementById("masterPageCsvInput").addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const parsed = parseEtsyStatement(await etsyFileToRows(file));
        if (!parsed.months.length) { showToast("❌ Is file me koi order ya fee nahi mili." + (etsyBadDateNote(parsed) ? " " + etsyBadDateNote(parsed) : "")); return; }
        if (etsyBadDateNote(parsed)) { if (typeof showStickyToast === "function") showStickyToast("⚠️ " + etsyBadDateNote(parsed), 7000); else showToast("⚠️ " + etsyBadDateNote(parsed)); }
        const wb = getClientWorkbook(masterActiveClientSr);
        let targetTab = masterActiveTab;
        parsed.months.forEach(m => {
          if (!wb.tabs[m.tab]) return;
          targetTab = m.tab;
          const mObj = ALL_MASTER_MONTH_TABS.find(x => x.tab === m.tab);
          if (mObj) masterActiveFy = mObj.fy;
          const existingSet = new Set(wb.tabs[m.tab].orders.map(o => String(o.orderNo)));
          (m.orders || []).forEach(o => {
            if (existingSet.has(String(o.orderNo))) return;
            const p = String(o.iso || "").split("-");
            const dFormatted = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "";
            wb.tabs[m.tab].orders.push({
              payDate: dFormatted,
              orderNo: String(o.orderNo),
              gross: o.gross,
              refund: o.refund,
              buyerTax: o.buyerTax,
              taxRefund: o.taxRefund,
              tcs: o.tcs,
              tds: o.tds,
              invNo: "",
              invDate: "",
              country: "US",
              hsn: "",
              sb: ""
            });
          });
          if (m.fees) {
            Object.keys(m.fees).forEach(k => {
              if (wb.tabs[m.tab].fees[k]) {
                wb.tabs[m.tab].fees[k] = {
                  charged: Number(m.fees[k].charged || 0),
                  credits: Number(m.fees[k].credits || 0)
                };
              }
            });
          }
        });
        masterActiveTab = targetTab;
        triggerMasterAutoSync(targetTab);
        renderMasterEtsyPage();
        showToast(`✅ ${file.name} Master Etsy Sheet (${targetTab}) me import aur sync ho gayi!`);
      } catch (err) {
        showToast("❌ " + (err && err.message ? err.message : "CSV parse nahi ho saki."));
      }
    });

    // Send Current Month's Billed Invoices / Orders from Master Etsy Page straight to GSTR-1 JSON Page (Tables 6A, 12, 13, 14)!
    document.getElementById("masterSendMonthToJsonBtn").addEventListener("click", () => {
      const c = clients.find(x => x.sr === masterActiveClientSr);
      if (!c) return;
      const wb = getClientWorkbook(c.sr);
      const metrics = computeFullWorkbookMetrics(wb);
      const billedRows = (metrics.allSummaryRows || []).filter(r => r.invoicesCount > 0);
      const latestBilledRow = billedRows.length > 0 ? billedRows[billedRows.length - 1] : null;
      const latestRow = latestBilledRow || getLatestActiveWorkbookSummaryRow(wb, metrics, getActiveFyMonthTabs()[0].tab);
      const tKey = (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog")
        ? masterActiveTab
        : (latestRow ? latestRow.tab : getActiveFyMonthTabs()[0].tab);
      const mMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === tKey) || getActiveFyMonthTabs()[0];
      const tData = wb.tabs[mMeta.tab] || { orders: [], fees: {} };
      const mRow = (metrics.allSummaryRows || []).find(x => x.tab === mMeta.tab);

      if ((!mRow || mRow.invoices.length === 0) && (tData.orders || []).length > 0) {
        showToast(`⚠️ ${mMeta.tab} me ${tData.orders.length} unbilled orders hain — pehle neeche Col K (Invoice Date) me date dalein!`);
        return;
      }

      selectClientInJsonPageBySr(c.sr, true);
      let rcmBase = 0;
      FEE_KEYS_META.forEach(fk => {
        const f = (tData.fees && tData.fees[fk.key]) || { charged: 0, credits: 0 };
        rcmBase += Math.max(0, Number(f.charged || 0) - Number(f.credits || 0));
      });

      const ordersToUse = (mRow && mRow.invoices.length > 0)
        ? mRow.invoices.map(inv => ({
            payDate: inv.payDate || "",
            srcTab: inv.srcTab || mMeta.tab,
            srcRow: inv.srcRow || 45,
            invNo: inv.invNo,
            orderNo: inv.invNo,
            invDate: inv.invDate,
            date: inv.invDate.replace(/-/g, "/"),
            txval: inv.txval,
            gross: inv.txval,
            refund: 0,
            buyerTax: 0,
            taxRefund: 0,
            tcs: 0,
            tds: 0,
            hsn: inv.hsn || "5703",
            rate: inv.rate !== undefined ? Number(inv.rate) : 5,
            tax: inv.tax,
            netVal: inv.netVal,
            portCode: inv.portCode || "",
            sbNo: inv.sbNo || "",
            sbDate: inv.sbDate || "",
            csNcs: inv.csNcs || "NCS"
          }))
        : [];

      applyOrdersToJsonState(ordersToUse, rcmBase, mMeta.m, mMeta.y);
      switchAppPage("json");
      showToast(`🧾 ${c.client} (${mMeta.tab}) ka Master Sheet Invoice Part (Cols A–L) GSTR-1 JSON Generator me sync ho gaya!`);
    });


    // Sabhi Etsy clients ka LIVE ROV ek hi call me Master Etsy sheets (D5) se — IMPORTRANGE ki der nahi
    async function pullAllRovLive() {
      if (!scriptUrl) return { ok: false, message: "Apps Script URL set nahi hai" };
      try {
        const res = await callAppsScript({ action: "getAllRov" });
        if (!res || res.status !== "ok" || !Array.isArray(res.rov)) {
          return { ok: false, message: (res && res.message) || "Apps Script me naya code update karein (⚙️ Setup)" };
        }
        const mk = (cat, nm) => String(cat || "").toUpperCase() + ":" + String(nm || "").toUpperCase().replace(/\*/g, "").trim();
        const byKey = new Map();
        res.rov.forEach(x => byKey.set(mk(x.category, x.client), Number(x.rov) || 0));
        let matched = 0, changed = 0;
        clients.forEach(c => {
          const key = mk(c.category, c.client);
          if (!byKey.has(key)) return;
          matched++;
          const v = byKey.get(key);
          if (Math.abs((Number(c.rov) || 0) - v) > 0.005) changed++;
          c.rov = v; c._rovLocal = true; c._rovTs = Date.now();
        });
        saveClients();
        return { ok: true, matched: matched, changed: changed, skipped: (res.skipped || []).length, partial: !!res.partial };
      } catch (e) {
        return { ok: false, message: String((e && e.message) || e) };
      }
    }

    // Sabhi Etsy clients ka ROV turant local workbook se compute karein (bina Master Etsy khole)
    function refreshAllClientRovsFromWorkbooks() {
      let changed = false;
      clients.forEach(c => {
        if (c.clientType !== "Etsy Client" || isInactive(c)) return;
        const ck = getClientKey(c);
        const wb = masterWorkbooks[ck] || masterWorkbooks[c.sr];
        if (!wb || !wb.tabs) return;
        try {
          const metrics = computeFullWorkbookMetrics(wb);
          const latest = getLatestActiveWorkbookSummaryRow(wb, metrics, masterActiveTab);
          if (latest && typeof latest.d5Rov === "number" && c.rov !== latest.d5Rov) {
            c.rov = latest.d5Rov;
            c._rovLocal = true; c._rovTs = Date.now();
            changed = true;
          }
        } catch (e) { /* ignore */ }
      });
      if (changed) saveClients();
      return changed;
    }

    // Background me sabhi clients ka fresh Master Etsy data Drive se laayein aur ROV live update karein
    async function pullAllClientRovsFresh() {
      if (!scriptUrl) return;
      const etsyClients = clients.filter(c => c.clientType === "Etsy Client" && !isInactive(c));
      for (const c of etsyClients) {
        if (masterPullInFlight.has(c.sr)) continue;
        try {
          await pullMasterFromDrive(true, c.sr);
          const ck = getClientKey(c);
          const wb = masterWorkbooks[ck] || masterWorkbooks[c.sr];
          if (wb) {
            const metrics = computeFullWorkbookMetrics(wb);
            const latest = getLatestActiveWorkbookSummaryRow(wb, metrics, masterActiveTab);
            if (latest && typeof latest.d5Rov === "number") {
              c.rov = latest.d5Rov;
              c._rovLocal = true; c._rovTs = Date.now();
              saveClients();
              if (currentAppPage === "tracker") renderApp();
            }
          }
        } catch (e) { /* ignore, agla client try karega */ }
      }
    }

    // Start App: Always Lock on Launch & Require Password First
    loadClients();
    loadFeeState();
    normalizeApneFreeClients();
    loadQuickPresets();
    loadMasterWorkbooks();
    refreshAllClientRovsFromWorkbooks();
    loadDefaultTable14Etin();
    migrateLegacySrKeys();
    {
      const autoSyncBtnInit = document.getElementById("autoSyncDueFromPtDateBtn");
      if (autoSyncBtnInit) {
        autoSyncBtnInit.textContent = `🔄 Recalculate Due Months from PT Date (${getCurrentMonYearLabel()})`;
      }
      const busaraInit = clients.find(x => String(x.client || "").toUpperCase().includes("BUSARA"));
      if (busaraInit) masterActiveClientSr = busaraInit.sr;
    }
    updateReferenceSuggestions();
    loadScriptUrl();
    loadPin();
    renderApp();
    populateJsonClientDropdown();
    if (clients.length > 0) {
      const initClient = clients.find(x => x.sr === masterActiveClientSr) || clients[0];
      jsonState.selectedSr = initClient.sr;
      jsonState.gstin = (initClient.gstin || "").trim().toUpperCase();
      jsonState.firm = (initClient.firm || initClient.client || "").trim();
      document.getElementById("jsonGstinInput").value = jsonState.gstin;
      document.getElementById("jsonFirmInput").value = jsonState.firm;
      ensureValidEtsySupecoEtin(jsonState.gstin);
      const jSel = document.getElementById("jsonClientSelect");
      if (jSel) jSel.value = String(initClient.sr);
      const jSearch = document.getElementById("jsonClientSearchInput");
      if (jSearch) jSearch.value = `#${initClient.sheetSr} ${initClient.client} — ${initClient.firm} (${initClient.gstin || "No GSTIN"})`;
      syncMasterInvoicePartToJsonPage({ autoPickLatest: true });
      switchJsonSectionTab("exp", "exp");
    }
    switchAppPage(currentAppPage);
    // Portal tab par "json" folder ki list (Apps Script URL load hone ke baad)
    if (currentAppPage === "portal") setTimeout(() => { if (typeof gpRefreshSavedJsonList === "function") gpRefreshSavedJsonList(false); }, 1500);

    // Start Device Check: If New Device -> Require Email OTP First!
    checkDeviceAndAuthenticate();

    // Auto-Sync: Sheet se naya data check karega automatically agar URL connected hai
    if (scriptUrl) {
      syncFromGoogleSheet(false, false);
      // Sabhi clients ka fresh ROV background me laayein (bina Master Etsy khole)
      setTimeout(async () => { const lv = await pullAllRovLive(); if (lv.ok) { renderApp(); } else { pullAllClientRovsFresh(); } }, 2500);
      // Auto-refresh every 60 seconds (silent on success, banner updates on error)
      setInterval(() => {
        if (scriptUrl && !document.hidden) {
          syncFromGoogleSheet(false, true);
        }
      }, 60000);
    }
