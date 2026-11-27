    // =====================================================================
    // All 22 Official GSTR-1 Portal Tables Catalog (13 Main "Add Record" + 9 "Amend Record" Tables)
    const GSTR1_PORTAL_TABLES = [
      { id: "b2b", code: "4A, 4B, 6B, 6C", title: "B2B, SEZ, DE Invoices", sub: "Taxable supplies to registered persons", cat: "ADD", sec: "b2b", icon: "🏢" },
      { id: "b2cl", code: "5A", title: "B2C (Large) Invoices", sub: "Inter-state supplies > ₹2.5 Lakh to unregistered", cat: "ADD", sec: "b2cl", icon: "💎" },
      { id: "exp", code: "6A", title: "Exports Invoices (WPAY / WOPAY)", sub: "Exports with/without payment of tax (LUT)", cat: "ADD", sec: "exp", icon: "🌍" },
      { id: "b2cs", code: "7", title: "B2C (Others / Small)", sub: "Supplies to unregistered persons (Other than 5A)", cat: "ADD", sec: "b2cs", icon: "🛒" },
      { id: "nil", code: "8A, 8B, 8C, 8D", title: "Nil Rated, Exempted & Non-GST", sub: "Nil rated, exempted & non-GST outward supplies", cat: "ADD", sec: "nil", icon: "⭕" },
      { id: "cdnr", code: "9B (Reg.)", title: "Credit / Debit Notes (Registered)", sub: "CDNR issued to registered GSTIN buyers", cat: "ADD", sec: "cdnr", icon: "📝" },
      { id: "cdnur", code: "9B (Unreg.)", title: "Credit / Debit Notes (Unregistered)", sub: "CDNUR issued for B2CL & Exports", cat: "ADD", sec: "cdnur", icon: "📝" },
      { id: "at", code: "11A(1), 11A(2)", title: "Tax Liability (Advances Received)", sub: "Advances received without invoice in current month", cat: "ADD", sec: "at", icon: "💵" },
      { id: "txpd", code: "11B(1), 11B(2)", title: "Adjustment of Advances", sub: "Advances received earlier & adjusted this month", cat: "ADD", sec: "txpd", icon: "🔄" },
      { id: "hsn", code: "12", title: "HSN-wise Summary of Outward Supplies", sub: "HSN 5703 / goods & services summary", cat: "ADD", sec: "hsn", icon: "📦" },
      { id: "doc_issue", code: "13", title: "Documents Issued", sub: "Invoice series from/to, cancelled & net issued", cat: "ADD", sec: "docs", icon: "📄" },
      { id: "supeco", code: "14(a), 14(b)", title: "Supplies through E-Commerce (SUPECO)", sub: "Etsy/Amazon TCS u/s 52 & 9(5) supplies", cat: "ADD", sec: "supeco", icon: "🌐" },
      { id: "eco", code: "15", title: "Supplies u/s 9(5) (ECO)", sub: "Supplies on which E-Com operator pays tax u/s 9(5)", cat: "ADD", sec: "supeco", icon: "🛍️" },
      // Amendment Tables
      { id: "b2ba", code: "9A (B2B)", title: "Amended B2B, SEZ, DE Invoices", sub: "Amendments to earlier B2B invoices", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "b2cla", code: "9A (B2CL)", title: "Amended B2C (Large) Invoices", sub: "Amendments to earlier B2CL invoices", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "expa", code: "9A (EXP)", title: "Amended Exports Invoices", sub: "Amendments to earlier Export 6A invoices", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "cdnra", code: "9C (Reg.)", title: "Amended Credit/Debit Notes (Reg)", sub: "Amendments to earlier CDNR notes", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "cdnura", code: "9C (Unreg.)", title: "Amended Credit/Debit Notes (Unreg)", sub: "Amendments to earlier CDNUR notes", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "b2csa", code: "10", title: "Amended B2C (Others)", sub: "Amendments to earlier B2CS summary", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "ata", code: "11A (Amend)", title: "Amended Advances Received (ATA)", sub: "Amendments to earlier Table 11A advances", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "txpda", code: "11B (Amend)", title: "Amended Adjustment of Advances", sub: "Amendments to earlier Table 11B adjustments", cat: "AMEND", sec: "amend", icon: "✏️" },
      { id: "supecoa", code: "14A", title: "Amended E-Commerce Supplies", sub: "Amendments to earlier Table 14 supeco", cat: "AMEND", sec: "amend", icon: "✏️" }
    ];

    let jsonState = {
      selectedSr: 1,
      gstin: "",
      firm: "",
      fpMonth: "10",
      fpYear: "2026",
      activeSec: "exp",
      activeTableId: "exp",
      gridCategory: "ADD", // ADD | AMEND | ALL
      filterEditorTabsBySelected: true,
      selectedTables: {
        b2b: false, b2cl: false, exp: true, b2cs: false, nil: false,
        cdnr: false, cdnur: false, at: false, txpd: false,
        hsn: true, doc_issue: true, supeco: true, eco: false,
        b2ba: false, b2cla: false, expa: false, cdnra: false, cdnura: false,
        b2csa: false, ata: false, txpda: false, supecoa: false
      },
      b2cs: [
        { sply_ty: "INTRA", pos: "09", typ: "OE", rt: 5, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }
      ],
      b2cl: [],
      exp: [],
      b2b: [],
      cdnr: [],
      cdnur: [],
      at: [],
      txpd: [],
      supecoRows: [],
      amendRows: [],
      hsn: [],
      tcsTotal: 0,
      tdsTotal: 0,
      rcmBase: 0,
      rcmIgst: 0,
      isNilReturn: false
    };

    let jsonClientSearchTerm = "";

    function getMatchingJsonClients(queryStr) {
      const activeList = clients.filter(c => !isInactive(c));
      const q = String(queryStr || "").trim().toLowerCase();
      if (!q) return activeList;
      return activeList.filter(c =>
        String(c.client || "").toLowerCase().includes(q) ||
        String(c.firm || "").toLowerCase().includes(q) ||
        String(c.gstin || "").toLowerCase().includes(q) ||
        String(c.id || "").toLowerCase().includes(q) ||
        String(c.reference || "").toLowerCase().includes(q) ||
        String(c.mobile || "").toLowerCase().includes(q) ||
        String(c.sheetSr || "").toLowerCase() === q.replace(/^#/, "")
      );
    }

    function populateJsonClientDropdown(filterQuery) {
      const sel = document.getElementById("jsonClientSelect");
      if (!sel) return;
      const q = filterQuery !== undefined ? filterQuery : jsonClientSearchTerm;
      const matched = getMatchingJsonClients(q);
      const badge = document.getElementById("jsonClientMatchCountBadge");
      if (badge) badge.textContent = `${matched.length} Client${matched.length === 1 ? "" : "s"}`;

      // Ensure currently selected client remains in the select options or select the first match
      const listForSelect = matched.length > 0 ? matched : clients.filter(c => !isInactive(c));
      sel.innerHTML = listForSelect.map(c =>
        `<option value="${c.sr}">#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"}) [${c.clientType}]</option>`
      ).join("");

      if (jsonState.selectedSr && listForSelect.some(c => c.sr === jsonState.selectedSr)) {
        sel.value = String(jsonState.selectedSr);
      } else if (listForSelect.length > 0) {
        sel.value = String(listForSelect[0].sr);
      }
    }

    // Computes Etsy Ireland UC's official Indian State-Specific TCS Collector GSTIN (<StateCode>AADCC8224G1C<CheckDigit>)
    // PAN: AADCC8224G (Acclime India Pvt Ltd / Etsy Ireland Unlimited Company, Tax Collector u/s 52)
    // Example for Uttar Pradesh (09): 09AADCC8224G1C0
    function getEtsyTcsGstinForState(supplierGstin) {
      const raw = String(supplierGstin || "").trim().toUpperCase();
      const stCode = raw.slice(0, 2);
      const st = (/^[0-9]{2}$/.test(stCode) && stCode !== "97") ? stCode : "09";
      const base14 = `${st}AADCC8224G1C`;
      const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let sum = 0;
      for (let i = 0; i < 14; i++) {
        const v = chars.indexOf(base14[i]);
        const p = v * (i % 2 === 0 ? 1 : 2);
        sum += Math.floor(p / 36) + (p % 36);
      }
      const checkChar = chars[(36 - (sum % 36)) % 36];
      return base14 + checkChar;
    }

    const TABLE14_DEFAULT_ETIN_STORAGE_KEY = "gst_table14_default_etin_v1";
    let defaultTable14Etin = "";

    function loadDefaultTable14Etin() {
      try {
        const saved = (localStorage.getItem(TABLE14_DEFAULT_ETIN_STORAGE_KEY) || "").trim().toUpperCase();
        defaultTable14Etin = /^[0-9A-Z]{15}$/.test(saved) ? saved : "";
      } catch (e) {
        defaultTable14Etin = "";
      }
      return defaultTable14Etin;
    }

    function getEffectiveTable14Etin(supplierGstin) {
      if (defaultTable14Etin && /^[0-9A-Z]{15}$/.test(defaultTable14Etin)) {
        return defaultTable14Etin;
      }
      return getEtsyTcsGstinForState(supplierGstin || jsonState.gstin);
    }

    function refreshDefaultTable14EtinUi() {
      const autoEtin = getEtsyTcsGstinForState(jsonState.gstin);
      const topInp = document.getElementById("jsonDefaultTable14EtinInput");
      if (topInp) {
        topInp.value = defaultTable14Etin || "";
        topInp.placeholder = `Auto Etsy: ${autoEtin}`;
      }
      const badge = document.getElementById("defaultTable14EtinStatusBadge");
      if (badge) {
        if (defaultTable14Etin) {
          badge.textContent = `🔒 Default Locked: ${defaultTable14Etin}`;
          badge.className = "px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-bold text-[11px]";
        } else {
          badge.textContent = `✨ Auto State Etsy (${autoEtin})`;
          badge.className = "px-2.5 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-mono font-bold text-[11px]";
        }
      }
      const clearBtn = document.getElementById("clearDefaultTable14EtinBtn");
      if (clearBtn) {
        clearBtn.classList.toggle("opacity-60", !defaultTable14Etin);
      }
      ["supecoEtinDefaultHint", "ecoEtinDefaultHint"].forEach(hid => {
        const hEl = document.getElementById(hid);
        if (!hEl) return;
        hEl.textContent = defaultTable14Etin ? `🔒 Default: ${defaultTable14Etin}` : `✨ Auto Etsy (${autoEtin})`;
      });
    }

    function saveDefaultTable14Etin(rawVal) {
      const val = String(rawVal || "").trim().toUpperCase();
      if (!val) {
        defaultTable14Etin = "";
        try { localStorage.removeItem(TABLE14_DEFAULT_ETIN_STORAGE_KEY); } catch (e) {}
        const autoEtin = getEtsyTcsGstinForState(jsonState.gstin);
        ["supecoEtinInput", "ecoEtinRowInput"].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = autoEtin;
        });
        (jsonState.supecoRows || []).forEach(r => {
          if (r.secType === "14A_TCS") r.etin = autoEtin;
        });
        refreshDefaultTable14EtinUi();
        if (typeof renderJsonPage === "function") renderJsonPage();
        showToast(`↺ Table 14 Default hata diya — ab Auto State Etsy (${autoEtin}) chalega.`);
        return true;
      }

      const prob = gstinProblem(val, "party");
      if (prob || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][A-Z][0-9A-Z]$/.test(val) || val.slice(0, 2) === "97") {
        showToast(`❌ Sahi 15-digit Indian GSTIN dalein (${prob || "format/state galat hai"})!`);
        return false;
      }

      defaultTable14Etin = val;
      try { localStorage.setItem(TABLE14_DEFAULT_ETIN_STORAGE_KEY, val); } catch (e) {}
      ["supecoEtinInput", "ecoEtinRowInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      (jsonState.supecoRows || []).forEach(r => {
        if (r.secType === "14A_TCS") r.etin = val;
      });
      refreshDefaultTable14EtinUi();
      if (typeof renderJsonPage === "function") renderJsonPage();
      if (val[13] === "C") {
        showToast(`🔒 Table 14 Default E-Com GSTIN set: ${val}! Jab tak change nahi karenge, yahi chalega.`);
      } else {
        showToast(`⚠️ Default set: ${val} (Note: Table 14(a) TCS ke liye 14th character 'C' hona zaroori hai).`);
      }
      return true;
    }

    // Ensures #supecoEtinInput and #ecoEtinRowInput hold the saved default Table 14 GSTIN (or state-matching Etsy TCS GSTIN)
    function ensureValidEtsySupecoEtin(supplierGstin) {
      const targetEtin = getEffectiveTable14Etin(supplierGstin || jsonState.gstin);
      ["supecoEtinInput", "ecoEtinRowInput"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const cur = (el.value || "").trim().toUpperCase();
        if (defaultTable14Etin) {
          el.value = defaultTable14Etin;
        } else if (!cur || cur === "9917USA00001OS9" || /^[0-9]{2}AADCC8224G1C[0-9A-Z]$/.test(cur)) {
          el.value = targetEtin;
        }
      });
      refreshDefaultTable14EtinUi();
      return ((document.getElementById("supecoEtinInput") && document.getElementById("supecoEtinInput").value) || targetEtin).trim().toUpperCase();
    }

    // Sanitize invoice / document serial number to strict GSTN rule: max 16 chars, only A-Z, 0-9, / and -
    function cleanGstDocNum(rawStr, fallbackStr = "INV001") {
      const cleaned = String(rawStr || "").trim().replace(/[^A-Za-z0-9\/-]/g, "").slice(0, 16);
      return cleaned || fallbackStr;
    }

    // Normalize DD/MM/YYYY or YYYY-MM-DD to GST Portal DD-MM-YYYY format
    function toGstPortalDateStr(dStr, fallbackStr) {
      const s = String(dStr || "").trim();
      if (!s) return fallbackStr || "";
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s.replace(/\//g, "-");
      if (typeof parseFlexDate === "function") {
        const dt = parseFlexDate(s);
        if (dt && dt.d && dt.m && dt.y) {
          return `${String(dt.d).padStart(2, "0")}-${String(dt.m).padStart(2, "0")}-${dt.y}`;
        }
      }
      return fallbackStr || s;
    }

    function toSlashDateStr(dStr) {
      const s = String(dStr || "").trim();
      if (!s) return "";
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s.replace(/-/g, "/");
      if (typeof parseFlexDate === "function") {
        const dt = parseFlexDate(s);
        if (dt && dt.d && dt.m && dt.y) {
          return `${String(dt.d).padStart(2, "0")}/${String(dt.m).padStart(2, "0")}/${dt.y}`;
        }
      }
      return s;
    }

    function getJsonSelectedMasterTabMeta() {
      const mNum = parseInt((document.getElementById("jsonMonthSelect") && document.getElementById("jsonMonthSelect").value) || jsonState.fpMonth || "9", 10);
      const yNum = parseInt((document.getElementById("jsonYearSelect") && document.getElementById("jsonYearSelect").value) || jsonState.fpYear || "2026", 10);
      if (typeof ALL_MASTER_MONTH_TABS !== "undefined") {
        const found = ALL_MASTER_MONTH_TABS.find(x => x.m === mNum && x.y === yNum);
        if (found) return found;
      }
      return null;
    }

    // Keep jsonPageOrders synchronized with jsonState.exp so switching modes never loses inline edits or added rows
    function syncJsonPageOrdersFromExpState() {
      jsonPageOrders = {
        rcmBase: jsonState.rcmBase || 0,
        orders: (jsonState.exp || []).map((r, idx) => ({
          payDate: r.payDate || "",
          srcTab: r.srcTab || "",
          srcRow: r.srcRow || (45 + idx),
          invNo: r.inum,
          orderNo: r.inum,
          invDate: toSlashDateStr(r.idt),
          date: toSlashDateStr(r.idt),
          txval: r.txval,
          gross: r.txval,
          refund: 0,
          buyerTax: 0,
          taxRefund: 0,
          tcs: 0,
          tds: 0,
          hsn: r.hsn || "5703",
          rate: Number(r.rt || 0),
          tax: r.iamt || 0,
          netVal: r.val || r.txval,
          portCode: r.sbpcode || "",
          sbNo: r.sbnum || "",
          sbDate: toSlashDateStr(r.sbdt || ""),
          csNcs: r.csNcs || "NCS"
        }))
      };
    }

    // Pulls the Etsy Master Sheet's Invoice Part (Top Invoice Working Table Rows 7–38, Cols A–L)
    // for the selected client & month directly into the JSON Generator!
    function syncMasterInvoicePartToJsonPage(opts = {}) {
      const c = clients.find(x => x.sr === Number(jsonState.selectedSr));
      if (!c || typeof getClientWorkbook !== "function" || typeof computeFullWorkbookMetrics !== "function") return false;
      ensureValidEtsySupecoEtin(c.gstin || jsonState.gstin);
      const wb = getClientWorkbook(c.sr);
      const metrics = computeFullWorkbookMetrics(wb);

      let targetMeta = getJsonSelectedMasterTabMeta();
      let mRow = targetMeta ? (metrics.allSummaryRows || []).find(r => r.tab === targetMeta.tab) : null;

      // If autoPickLatest is true and current month has 0 billed invoices, pick the latest month tab with billed invoices
      if (opts.autoPickLatest && (!mRow || mRow.invoicesCount === 0)) {
        const withInv = (metrics.allSummaryRows || []).filter(r => r.invoicesCount > 0);
        if (withInv.length > 0) {
          mRow = withInv[withInv.length - 1];
          targetMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === mRow.tab) || targetMeta;
        } else {
          const withOrders = (metrics.allSummaryRows || []).filter(r => {
            const td = wb.tabs[r.tab];
            return td && (td.orders || []).length > 0;
          });
          if (withOrders.length > 0) {
            mRow = withOrders[withOrders.length - 1];
            targetMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === mRow.tab) || targetMeta;
          }
        }
        if (targetMeta) {
          jsonState.fpMonth = String(targetMeta.m).padStart(2, "0");
          jsonState.fpYear = String(targetMeta.y);
          const mSel = document.getElementById("jsonMonthSelect");
          const ySel = document.getElementById("jsonYearSelect");
          if (mSel) mSel.value = jsonState.fpMonth;
          if (ySel && [...ySel.options].some(o => o.value === jsonState.fpYear)) ySel.value = jsonState.fpYear;
          masterActiveFy = targetMeta.fy;
          const fySel = document.getElementById("jsonMasterFySelect");
          if (fySel) fySel.value = masterActiveFy;
        }
      }

      if (!targetMeta) return false;
      if (targetMeta.fy) {
        masterActiveFy = targetMeta.fy;
        const fySel = document.getElementById("jsonMasterFySelect");
        if (fySel) fySel.value = masterActiveFy;
      }

      // Update default Invoice Date & Invoice No placeholders in the Add Export form to match selected month & workbook prefix
      const lastDay = new Date(targetMeta.y, targetMeta.m, 0).getDate();
      const expIdtEl = document.getElementById("expIdtInput");
      if (expIdtEl) expIdtEl.value = `${String(lastDay).padStart(2, "0")}-${String(targetMeta.m).padStart(2, "0")}-${targetMeta.y}`;
      const expInumEl = document.getElementById("expInumInput");
      if (expInumEl) expInumEl.placeholder = `${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`;

      const tData = wb.tabs[targetMeta.tab] || { orders: [], fees: {}, invMeta: {} };
      mRow = (metrics.allSummaryRows || []).find(r => r.tab === targetMeta.tab) || {
        month: targetMeta.full, tab: targetMeta.tab, invoicesCount: 0,
        c4PrevRov: 0, d4GrossOrder: 0, d8Taxable: 0, g8Tax: 0, h8Net: 0, d5Rov: 0, invoices: []
      };

      // Calculate RCM Base & TCS/TDS from this month tab
      let rcmBase = 0;
      if (typeof FEE_KEYS_META !== "undefined") {
        FEE_KEYS_META.forEach(fk => {
          const f = (tData.fees && tData.fees[fk.key]) || { charged: 0, credits: 0 };
          rcmBase += Math.max(0, Number(f.charged || 0) - Number(f.credits || 0));
        });
      }
      let totTcs = 0, totTds = 0;
      (tData.orders || []).forEach(o => {
        totTcs += Number(o.tcs || 0);
        totTds += Number(o.tds || 0);
      });

      // Build invoice records directly from Master Sheet Invoice Part (mRow.invoices = Cols A to L)
      const invRecords = (mRow.invoices || []).map(inv => ({
        payDate: inv.payDate || "",
        srcTab: inv.srcTab || targetMeta.tab,
        srcRow: inv.srcRow || 45,
        invNo: inv.invNo,
        orderNo: inv.invNo,
        invDate: inv.invDate,
        date: inv.invDate,
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
      }));

      resetJsonTablesData();
      jsonState.tcsTotal = r2(totTcs);
      jsonState.tdsTotal = r2(totTds);
      jsonState.rcmBase = r2(rcmBase);
      jsonState.rcmIgst = Math.round(Math.max(0, jsonState.rcmBase) * 0.18);

      if (invRecords.length > 0) {
        applyOrdersToJsonState(invRecords, rcmBase, targetMeta.m, targetMeta.y);
      } else if (c.clientType !== "Etsy Client" && Number(c.rov || 0) > 0) {
        const tv = r2(Number(c.rov));
        const taxes = computeTaxesForRow("INTRA", 5, tv);
        jsonState.b2cs = [{
          sply_ty: "INTRA",
          pos: (jsonState.gstin.slice(0, 2) || "09"),
          typ: "OE",
          rt: 5,
          txval: taxes.txval,
          iamt: taxes.iamt,
          camt: taxes.camt,
          samt: taxes.samt,
          csamt: 0
        }];
        jsonState.isNilReturn = false;
        autoSyncHsnFromTables();
      }
      return invRecords.length > 0;
    }

    function selectClientInJsonPageBySr(sr, closeSearchList = true) {
      const c = clients.find(x => x.sr === Number(sr));
      if (!c) return;
      const wipedOld = resetJsonDataIfClientChanges(c.sr);
      jsonState.selectedSr = c.sr;
      jsonState.gstin = (c.gstin || "").trim().toUpperCase();
      jsonState.firm = (c.firm || c.client || "").trim();
      masterActiveClientSr = c.sr;

      populateJsonClientDropdown(jsonClientSearchTerm);
      const sel = document.getElementById("jsonClientSelect");
      if (sel) sel.value = String(c.sr);
      const sInp = document.getElementById("jsonClientSearchInput");
      if (sInp && closeSearchList) {
        sInp.value = `#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"})`;
      }
      document.getElementById("jsonGstinInput").value = jsonState.gstin;
      document.getElementById("jsonFirmInput").value = jsonState.firm;
      ensureValidEtsySupecoEtin(jsonState.gstin);

      syncMasterInvoicePartToJsonPage({ autoPickLatest: true });
      if (typeof maybeAutoPullMasterForClient === "function") {
        maybeAutoPullMasterForClient(c.sr);
      }

      if (closeSearchList) {
        const dd = document.getElementById("jsonClientSearchDropdown");
        if (dd) dd.classList.add("hidden");
      }
      renderJsonPage();
      showToast(`✅ Selected: #${c.sheetSr} ${c.client} (${c.firm}) — Master Sheet Invoice Part synced!`);
    }

    function renderJsonClientSearchAutocomplete() {
      const dd = document.getElementById("jsonClientSearchDropdown");
      const inp = document.getElementById("jsonClientSearchInput");
      const clearBtn = document.getElementById("jsonClientSearchClearBtn");
      if (!dd || !inp) return;

      const q = inp.value.trim();
      jsonClientSearchTerm = q;
      if (clearBtn) clearBtn.classList.toggle("hidden", !q);
      populateJsonClientDropdown(q);

      const matched = getMatchingJsonClients(q);
      if (matched.length === 0) {
        dd.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">❌ "${q.replace(/[<>&]/g, "")}" naam/GSTIN ka koi client nahi mila</div>`;
        dd.classList.remove("hidden");
        return;
      }

      dd.innerHTML = matched.slice(0, 30).map(c => {
        const isSel = c.sr === jsonState.selectedSr;
        return `
          <button type="button" data-search-pick-sr="${c.sr}" class="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center justify-between gap-2 transition ${isSel ? 'bg-indigo-50/80 font-bold' : ''}">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">#${c.sheetSr}</span>
                <span class="text-xs font-extrabold text-slate-900 truncate">${c.client}</span>
                <span class="text-[11px] font-semibold text-indigo-700 truncate">— ${c.firm || "-"}</span>
              </div>
              <div class="text-[10px] text-slate-500 font-mono mt-0.5">
                GSTIN: <b class="text-slate-700">${c.gstin || "N/A"}</b> • ID: ${c.id || "-"} • Ref: ${c.reference || "-"}
              </div>
            </div>
            <span class="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${c.clientType === 'Etsy Client' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}">
              ${c.clientType === 'Etsy Client' ? '🛍️ Etsy' : '🏢 Regular'}
            </span>
          </button>
        `;
      }).join("");

      dd.classList.remove("hidden");

      dd.querySelectorAll("[data-search-pick-sr]").forEach(btn => {
        btn.addEventListener("click", () => {
          const pickedSr = parseInt(btn.getAttribute("data-search-pick-sr"), 10);
          const c = clients.find(x => x.sr === pickedSr);
          if (c) inp.value = `${c.client} — ${c.firm}`;
          selectClientInJsonPageBySr(pickedSr, true);
        });
      });
    }

    function computeTaxesForRow(splyTy, rate, txval) {
      const r = Number(rate || 0);
      const tv = r2(Number(txval || 0));
      const totalTax = r2(tv * (r / 100));
      if (splyTy === "INTER") {
        return { txval: tv, iamt: totalTax, camt: 0, samt: 0, csamt: 0 };
      }
      const half = r2(totalTax / 2);
      return { txval: tv, iamt: 0, camt: half, samt: half, csamt: 0 };
    }

    function autoSyncHsnFromTables() {
      const defaultHsn = (document.getElementById("jsonDefaultHsnInput").value || "5703").trim();
      const defaultUqc = document.getElementById("jsonDefaultUqcSelect").value || "PCS";
      const byRate = {};
      const addBucket = (supplyType, hsnCode, rt, txval, iamt, camt, samt, qtyAdd) => {
        const code = String(hsnCode || defaultHsn || "5703").trim().replace(/[^0-9]/g, "") || "5703";
        const sType = supplyType === "B2B" ? "B2B" : "B2C";
        const key = `${sType}_${code}_${rt}`;
        if (!byRate[key]) {
          byRate[key] = {
            supplyType: sType,
            hsn_sc: code,
            desc: code === "5703" ? "CARPETS AND TEXTILE FLOORING" : "HANDICRAFTS AND TEXTILE GOODS",
            uqc: code.startsWith("99") ? "NA" : defaultUqc,
            qty: 0,
            rt: Number(rt || 0),
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0
          };
        }
        byRate[key].qty = code.startsWith("99") ? 0 : (byRate[key].qty + Number(qtyAdd || 1));
        byRate[key].txval = r2(byRate[key].txval + Number(txval || 0));
        byRate[key].iamt = r2(byRate[key].iamt + Number(iamt || 0));
        byRate[key].camt = r2(byRate[key].camt + Number(camt || 0));
        byRate[key].samt = r2(byRate[key].samt + Number(samt || 0));
      };

      jsonState.b2b.forEach(r => { if (r.txval > 0) addBucket("B2B", defaultHsn, r.rt, r.txval, r.iamt, r.camt, r.samt, 1); });
      jsonState.b2cs.forEach(r => { if (r.txval > 0) addBucket("B2C", defaultHsn, r.rt, r.txval, r.iamt, r.camt, r.samt, Math.max(1, Math.round(r.txval / 4500))); });
      jsonState.b2cl.forEach(r => { if (r.txval > 0) addBucket("B2C", defaultHsn, r.rt, r.txval, r.iamt, 0, 0, 1); });
      jsonState.exp.forEach(r => { if (r.txval > 0) addBucket("B2C", r.hsn || defaultHsn, r.rt, r.txval, r.iamt, 0, 0, 1); });

      jsonState.hsn = Object.values(byRate);
    }

    // Automatically updates Table 13 (Documents Issued) & Table 14 (SUPECO) from the Master Sheet Invoice Part rows!
    function syncDocsAndSupecoFromExpInvoices() {
      const validExp = (jsonState.exp || []).filter(r => Number(r.txval || 0) > 0);
      const fromEl = document.getElementById("docFromInput");
      const toEl = document.getElementById("docToInput");
      const totEl = document.getElementById("docTotnumInput");
      const canEl = document.getElementById("docCancelInput");
      const supInp = document.getElementById("supecoSuppvalInput");
      const supChk = document.getElementById("includeSupecoCheckbox");

      if (validExp.length > 0) {
        const sortedInums = validExp.map(r => cleanGstDocNum(r.inum, "")).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const fromInum = sortedInums[0] || cleanGstDocNum(validExp[0].inum, `EXP/${jsonState.fpYear.slice(-2)}/${jsonState.fpMonth}/001`);
        const toInum = sortedInums[sortedInums.length - 1] || cleanGstDocNum(validExp[validExp.length - 1].inum, fromInum);
        const count = validExp.length;
        if (fromEl) fromEl.value = fromInum.slice(0, 16);
        if (toEl) toEl.value = toInum.slice(0, 16);
        if (totEl) totEl.value = String(count);
        if (canEl && !canEl.value) canEl.value = "0";

        let totTxval = 0, totIgst = 0;
        validExp.forEach(r => {
          totTxval += Number(r.txval || 0);
          totIgst += Number(r.iamt || 0);
        });
        totTxval = r2(totTxval);
        totIgst = r2(totIgst);

        if (supInp) supInp.value = String(totTxval);
        const etinVal = ensureValidEtsySupecoEtin(jsonState.gstin);
        if (jsonState.selectedTables.supeco && (!supChk || supChk.checked) && etinVal && totTxval > 0) {
          jsonState.supecoRows = [{
            secType: "14A_TCS",
            etin: etinVal,
            suppval: totTxval,
            igst: totIgst,
            cgst: 0,
            sgst: 0
          }];
        } else {
          jsonState.supecoRows = [];
        }
      } else if (jsonState.b2cs.filter(r => r.txval > 0).length === 0 && jsonState.b2b.length === 0) {
        if (fromEl) fromEl.value = "";
        if (toEl) toEl.value = "";
        if (totEl) totEl.value = "0";
        if (supInp) supInp.value = "0";
        jsonState.supecoRows = [];
      }
      syncJsonPageOrdersFromExpState();
    }

    function applyOrdersToJsonState(orders, rcmBaseVal, monthNum, yearNum) {
      jsonPageOrders = { orders: orders, rcmBase: rcmBaseVal };
      if (monthNum) {
        jsonState.fpMonth = String(monthNum).padStart(2, "0");
        document.getElementById("jsonMonthSelect").value = jsonState.fpMonth;
      }
      if (yearNum) {
        jsonState.fpYear = String(yearNum);
        const ySel = document.getElementById("jsonYearSelect");
        if ([...ySel.options].some(o => o.value === jsonState.fpYear)) ySel.value = jsonState.fpYear;
      }

      const defaultHsn = (document.getElementById("jsonDefaultHsnInput") && document.getElementById("jsonDefaultHsnInput").value || "5703").trim();
      const defaultRate = parseFloat((document.getElementById("masterDefaultTaxRateSelect") && document.getElementById("masterDefaultTaxRateSelect").value) || "5");
      const etinVal = ensureValidEtsySupecoEtin(jsonState.gstin);

      let totTaxable = 0, totTcs = 0, totTds = 0;
      orders.forEach(o => {
        const tv = o.txval !== undefined ? Number(o.txval) : etsyTaxable(o);
        totTaxable += tv;
        totTcs += Number(o.tcs || 0);
        totTds += Number(o.tds || 0);
      });
      totTaxable = r2(totTaxable);
      if (totTcs > 0 || !jsonState.tcsTotal) jsonState.tcsTotal = r2(totTcs);
      if (totTds > 0 || !jsonState.tdsTotal) jsonState.tdsTotal = r2(totTds);
      jsonState.rcmBase = r2(Number(rcmBaseVal || 0));
      jsonState.rcmIgst = Math.round(Math.max(0, jsonState.rcmBase) * 0.18);
      jsonState.isNilReturn = totTaxable <= 0;

      const mode = document.getElementById("jsonEtsyReportModeSelect").value;
      jsonState.b2cs = [];
      jsonState.exp = [];

      const lastDay = new Date(parseInt(jsonState.fpYear, 10), parseInt(jsonState.fpMonth, 10), 0).getDate();
      const endOfMonthDate = `${String(lastDay).padStart(2, "0")}-${jsonState.fpMonth}-${jsonState.fpYear}`;
      const activeMeta = getJsonSelectedMasterTabMeta();

      if (mode === "EXP_WOPAY_ORDERWISE" || mode === "EXP_WOPAY_CONSOLIDATED") {
        // Select Tables 6A (exp), 12 (hsn), 13 (doc_issue), AND Table 14 (supeco) with Etsy's state-specific TCS GSTIN!
        jsonState.selectedTables.exp = true;
        jsonState.selectedTables.hsn = true;
        jsonState.selectedTables.doc_issue = true;
        jsonState.selectedTables.supeco = true;
        jsonState.selectedTables.b2cs = false;

        if (mode === "EXP_WOPAY_ORDERWISE") {
          orders.forEach((o, idx) => {
            const tv = r2(o.txval !== undefined ? Number(o.txval) : etsyTaxable(o));
            if (tv <= 0) return;
            const rawDt = o.invDate || o.date || endOfMonthDate;
            const dStr = toGstPortalDateStr(rawDt, endOfMonthDate);
            const rt = o.rate !== undefined ? Number(o.rate) : (o.rt !== undefined ? Number(o.rt) : 0);
            const expTyp = rt > 0 ? "WPAY" : "WOPAY";
            const iamt = expTyp === "WPAY" ? r2(tv * (rt / 100)) : 0;
            const inum = cleanGstDocNum(o.invNo || o.orderNo || `EXP-${idx + 1}`, `EXP-${idx + 1}`);

            jsonState.exp.push({
              payDate: o.payDate || toSlashDateStr(o.date || rawDt),
              srcTab: o.srcTab || (activeMeta ? activeMeta.tab : ""),
              srcRow: o.srcRow || (45 + idx),
              exp_typ: expTyp,
              inum: inum,
              idt: dStr,
              val: r2(tv + iamt),
              hsn: String(o.hsn || defaultHsn || "5703").trim(),
              sbpcode: String(o.portCode || o.sbpcode || "").trim().toUpperCase(),
              sbnum: String(o.sbNo || o.sbnum || "").trim(),
              sbdt: String(o.sbDate || o.sbdt || "").trim(),
              csNcs: String(o.csNcs || o.sb || "NCS").trim() || "NCS",
              rt: rt,
              txval: tv,
              iamt: iamt
            });
          });
        } else if (totTaxable > 0) {
          // Consolidated Invoice from Master Sheet Invoice Part
          const firstRate = orders.length > 0 && orders[0].rate !== undefined ? Number(orders[0].rate) : 0;
          const expTyp = firstRate > 0 ? "WPAY" : "WOPAY";
          const iamt = expTyp === "WPAY" ? r2(totTaxable * (firstRate / 100)) : 0;
          const firstInum = orders.length > 0 && (orders[0].invNo || orders[0].orderNo)
            ? cleanGstDocNum(orders[0].invNo || orders[0].orderNo, `EXP/${jsonState.fpMonth}${jsonState.fpYear.slice(-2)}/001`)
            : `EXP/${jsonState.fpMonth}${jsonState.fpYear.slice(-2)}/001`;
          jsonState.exp.push({
            payDate: orders.length > 0 ? (orders[0].payDate || "") : "",
            srcTab: activeMeta ? activeMeta.tab : "",
            exp_typ: expTyp,
            inum: firstInum,
            idt: endOfMonthDate,
            val: r2(totTaxable + iamt),
            hsn: defaultHsn || "5703",
            sbpcode: "",
            sbnum: "",
            sbdt: "",
            csNcs: "NCS",
            rt: firstRate,
            txval: totTaxable,
            iamt: iamt
          });
        }

        const supChkEl = document.getElementById("includeSupecoCheckbox");
        if (supChkEl) supChkEl.checked = true;
        syncDocsAndSupecoFromExpInvoices();
        jsonPageOrders = { orders: orders, rcmBase: rcmBaseVal };
        switchJsonSectionTab("exp", "exp");
      } else {
        // B2CS_SUMMARY or B2CS_PLUS_SUPECO
        jsonState.selectedTables.b2cs = true;
        jsonState.selectedTables.hsn = true;
        jsonState.selectedTables.doc_issue = true;
        jsonState.selectedTables.exp = false;

        const rate = orders.length > 0 && orders[0].rate !== undefined ? Number(orders[0].rate) : defaultRate;
        const taxes = computeTaxesForRow("INTRA", rate, totTaxable);
        if (totTaxable > 0) {
          jsonState.b2cs.push({
            sply_ty: "INTRA",
            pos: (jsonState.gstin || "09").slice(0, 2) || "09",
            typ: "OE",
            rt: rate,
            txval: taxes.txval,
            iamt: taxes.iamt,
            camt: taxes.camt,
            samt: taxes.samt,
            csamt: 0
          });
        }
        if (mode === "B2CS_PLUS_SUPECO") {
          jsonState.selectedTables.supeco = true;
          document.getElementById("includeSupecoCheckbox").checked = true;
          document.getElementById("supecoSuppvalInput").value = String(totTaxable);
          jsonState.supecoRows = (totTaxable > 0 && etinVal) ? [{
            secType: "14A_TCS",
            etin: etinVal,
            suppval: totTaxable,
            igst: taxes.iamt,
            cgst: taxes.camt,
            sgst: taxes.samt
          }] : [];
        } else {
          jsonState.selectedTables.supeco = false;
          document.getElementById("includeSupecoCheckbox").checked = false;
          document.getElementById("supecoSuppvalInput").value = "0";
          jsonState.supecoRows = [];
        }
        const count = Math.max(1, orders.length);
        const firstInum = orders[0] && (orders[0].invNo || orders[0].orderNo) ? cleanGstDocNum(orders[0].invNo || orders[0].orderNo) : `INV/${jsonState.fpYear.slice(-2)}/${jsonState.fpMonth}/001`;
        const lastInum = orders[orders.length - 1] && (orders[orders.length - 1].invNo || orders[orders.length - 1].orderNo) ? cleanGstDocNum(orders[orders.length - 1].invNo || orders[orders.length - 1].orderNo) : `INV/${jsonState.fpYear.slice(-2)}/${jsonState.fpMonth}/${String(count).padStart(3, "0")}`;
        document.getElementById("docFromInput").value = firstInum.slice(0, 16);
        document.getElementById("docToInput").value = lastInum.slice(0, 16);
        document.getElementById("docTotnumInput").value = String(count);
        document.getElementById("docCancelInput").value = "0";
        switchJsonSectionTab("b2cs", "b2cs");
      }

      autoSyncHsnFromTables();
      renderJsonPage();
    }

    function openClientInJsonGenerator(sr) {
      const c = clients.find(x => x.sr === sr);
      if (!c) return;
      resetJsonDataIfClientChanges(c.sr);
      jsonState.selectedSr = c.sr;
      jsonState.gstin = (c.gstin || "").trim().toUpperCase();
      jsonState.firm = (c.firm || c.client || "").trim();
      masterActiveClientSr = c.sr;

      switchAppPage("json");
      populateJsonClientDropdown();
      document.getElementById("jsonClientSelect").value = String(c.sr);
      const sInp = document.getElementById("jsonClientSearchInput");
      if (sInp) sInp.value = `#${c.sheetSr} ${c.client} — ${c.firm} (${c.gstin || "No GSTIN"})`;
      document.getElementById("jsonGstinInput").value = jsonState.gstin;
      document.getElementById("jsonFirmInput").value = jsonState.firm;
      ensureValidEtsySupecoEtin(jsonState.gstin);

      syncMasterInvoicePartToJsonPage({ autoPickLatest: true });
      if (typeof maybeAutoPullMasterForClient === "function") {
        maybeAutoPullMasterForClient(c.sr);
      }
      renderJsonPage();
      showToast(`🧾 ${c.client} (${c.firm}) Master Sheet Invoice Part ke saath JSON Generator me load ho gaya!`);
    }

    // =====================================================================
    // v11 FIX: full data reset + real pre-upload validation for JSON page
    // =====================================================================
    // Orders last applied on THIS page for the CURRENT client (never another client's orders)
    let jsonPageOrders = null;

    function jsonPageHasAnyData() {
      const num = id => parseFloat((document.getElementById(id) && document.getElementById(id).value) || "0") || 0;
      const txt = id => ((document.getElementById(id) && document.getElementById(id).value) || "").trim();
      if (jsonState.b2cs.some(r => Number(r.txval || 0) > 0)) return true;
      if (["b2cl", "exp", "b2b", "cdnr", "cdnur", "at", "txpd", "supecoRows", "amendRows", "hsn"].some(k => jsonState[k].length > 0)) return true;
      if (num("supecoSuppvalInput") > 0 || num("nilExptAmtInput") > 0 || num("docTotnumInput") > 0) return true;
      if (txt("docFromInput") || txt("docToInput")) return true;
      let nilSum = 0;
      document.querySelectorAll(".nil-matrix-inp").forEach(i => { nilSum += parseFloat(i.value || "0") || 0; });
      return nilSum > 0 || !!jsonState.isNilReturn;
    }

    // Clears EVERYTHING that can reach the JSON file (all 22 tables + quick boxes). Period, GSTIN and
    // table selection (ticks) are kept.
    function resetJsonTablesData() {
      ["b2cs", "b2cl", "exp", "b2b", "cdnr", "cdnur", "at", "txpd", "supecoRows", "amendRows", "hsn"].forEach(k => { jsonState[k] = []; });
      jsonState.tcsTotal = 0;
      jsonState.tdsTotal = 0;
      jsonState.rcmBase = 0;
      jsonState.rcmIgst = 0;
      jsonState.isNilReturn = false;
      jsonPageOrders = null;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      const supChk = document.getElementById("includeSupecoCheckbox");
      if (supChk) supChk.checked = Boolean(jsonState.selectedTables && jsonState.selectedTables.supeco);
      ensureValidEtsySupecoEtin(jsonState.gstin);
      setVal("supecoSuppvalInput", "0");
      setVal("nilExptAmtInput", "0");
      document.querySelectorAll(".nil-matrix-inp").forEach(i => { i.value = "0"; });
      setVal("docFromInput", "");
      setVal("docToInput", "");
      setVal("docTotnumInput", "0");
      setVal("docCancelInput", "0");
    }

    // Call BEFORE loading another client into the JSON page. Returns true if old data was wiped.
    function resetJsonDataIfClientChanges(newSr) {
      if (Number(newSr) === Number(jsonState.selectedSr)) return false;
      const had = jsonPageHasAnyData();
      resetJsonTablesData();
      return had;
    }

    const GST_VALID_STATE_CODES = new Set([
      "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
      "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "97"
    ]);
    const GST_DOC_NUM_RE = /^[A-Za-z0-9\/-]{1,16}$/;

    function gstinCheckDigitOk(g) {
      const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let sum = 0;
      for (let i = 0; i < 14; i++) {
        const v = chars.indexOf(g[i]);
        if (v < 0) return false;
        const p = v * (i % 2 === 0 ? 1 : 2);
        sum += Math.floor(p / 36) + (p % 36);
      }
      return chars[(36 - (sum % 36)) % 36] === g[14];
    }

    // Returns "" when OK, otherwise a short reason. kind: "supplier" | "party"
    function gstinProblem(g, kind) {
      g = String(g || "").trim().toUpperCase();
      if (!g) return "khali hai";
      if (g.length !== 15) return `15 character ka hona chahiye (abhi ${g.length})`;
      const panBased = kind === "supplier"
        ? /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
        : /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][A-Z][0-9A-Z]$/;
      if (panBased.test(g)) {
        if (!GST_VALID_STATE_CODES.has(g.slice(0, 2))) return `state code ${g.slice(0, 2)} galat hai`;
        if (!gstinCheckDigitOk(g)) return "check digit match nahi karta (typing galti?)";
        return "";
      }
      // UIN / Govt / NRTP / OIDAR style IDs (only allowed for the other party)
      if (kind !== "supplier" && /^[0-9]{4}[A-Z]{3}[0-9]{5}[0-9A-Z]{3}$/.test(g)) return "";
      return "GSTIN format galat hai";
    }

    function parseGstDate(s) {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || "").trim());
      if (!m) return null;
      const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
      return dt;
    }

    // Checks the data that will go into the file. errors = portal reject karega / data pakka galat,
    // warnings = dekh lein. Reads raw rows (before any trimming) + the built payload.
    function validateGstr1Json(payload) {
      const errors = [], warnings = [];
      const E = m => errors.push(m), W = m => warnings.push(m);
      const sel = jsonState.selectedTables;
      const inr = n => "₹" + r2(Number(n || 0)).toLocaleString("en-IN");
      const gstin = String(payload.gstin || "").trim().toUpperCase();
      const supState = gstin.slice(0, 2);
      const supStateOk = GST_VALID_STATE_CODES.has(supState);

      // ---- Header: GSTIN + period
      const gProb = gstinProblem(gstin, "supplier");
      if (gProb) E(`Supplier GSTIN "${gstin || "-"}" ${gProb}`);
      const selClient = clients.find(x => x.sr === jsonState.selectedSr);
      const selGstin = selClient ? String(selClient.gstin || "").trim().toUpperCase() : "";
      if (selClient && selGstin && gstin && selGstin !== gstin) {
        W(`GSTIN box (${gstin}) chune hue client ${selClient.client || ""} ke GSTIN (${selGstin}) se alag hai`);
      }
      const fpM = parseInt(String(payload.fp || "").slice(0, 2), 10);
      const fpY = parseInt(String(payload.fp || "").slice(2), 10);
      const periodOk = fpM >= 1 && fpM <= 12 && fpY >= 2017;
      if (!periodOk) E(`Return period "${payload.fp}" galat hai`);
      const periodStart = periodOk ? new Date(fpY, fpM - 1, 1) : null;
      const periodEnd = periodOk ? new Date(fpY, fpM, 0) : null;
      const periodName = periodOk ? `${PT_MON_NAMES[fpM - 1]} ${fpY}` : String(payload.fp);
      if (periodOk && periodStart > new Date()) W(`Return period ${periodName} abhi shuru nahi hua hai`);

      const checkDate = (label, s) => {
        const d = parseGstDate(s);
        if (!d) {
          if (/^\d{2}-\d{2}-\d{4}$/.test(String(s || "").trim())) E(`${label}: date ${s} calendar me hoti hi nahi`);
          else E(`${label}: date "${s || "khali"}" galat hai (DD-MM-YYYY chahiye)`);
          return;
        }
        if (!periodOk) return;
        if (d > periodEnd) E(`${label}: date ${s} return period ${periodName} ke baad ki hai`);
        else if (d < periodStart) W(`${label}: date ${s} ${periodName} se pehle ki hai (tabhi rakhein jab pehle report nahi hua)`);
      };
      const checkDocNum = (label, s) => {
        const v = String(s || "").trim();
        if (!v) { E(`${label}: number khali hai`); return false; }
        if (v.length > 16) { E(`${label}: number ${v.length} character ka hai, portal max 16 leta hai`); return false; }
        if (!GST_DOC_NUM_RE.test(v)) { E(`${label}: number me sirf A-Z, 0-9, "/" aur "-" chalte hain`); return false; }
        return true;
      };
      const checkPos = (label, pos) => {
        if (!GST_VALID_STATE_CODES.has(String(pos || ""))) { E(`${label}: place of supply "${pos || "-"}" valid state code nahi hai`); return false; }
        return true;
      };

      // ---- Invoice numbers must be unique across 4A / 5A / 6A (same-invoice multi-rate items within 4A or 5A merge into itms[])
      const seenInv = {};
      const seenInvRate = {};
      const noteDup = (tbl, inum, rtKey, ctinKey) => {
        const k = String(inum || "").trim().toUpperCase();
        if (!k) return;
        const rateSig = `${tbl}|${String(ctinKey || "").trim().toUpperCase()}|${k}|${rtKey}`;
        if (seenInv[k] && seenInv[k].tbl !== tbl) {
          E(`Invoice number ${inum} do baar aaya hai (${seenInv[k].tbl} aur ${tbl})`);
        } else if (seenInv[k] && seenInv[k].tbl === tbl && tbl === "6A") {
          E(`Invoice number ${inum} do baar aaya hai (${seenInv[k].tbl} aur ${tbl})`);
        } else if (seenInv[k] && seenInvRate[rateSig]) {
          E(`Invoice number ${inum} (${rtKey}%) do baar aaya hai (${tbl} me ek hi rate dobara)`);
        } else {
          if (!seenInv[k]) seenInv[k] = { tbl };
          seenInvRate[rateSig] = true;
        }
      };
      let invoiceCount = 0;

      // ---- Table 4A B2B
      if (sel.b2b) {
        const b2bSeenInvs = new Set();
        jsonState.b2b.forEach((r, i) => {
          const L = `Table 4A B2B row ${i + 1} (${r.inum || "-"})`;
          const cp = gstinProblem(r.ctin, "party");
          if (cp) E(`${L}: receiver GSTIN "${r.ctin || "-"}" ${cp}`);
          else if (String(r.ctin).toUpperCase() === gstin) E(`${L}: receiver GSTIN aur supplier GSTIN same hain`);
          checkDocNum(L, r.inum);
          checkDate(L, r.idt);
          const rtNum = (r.rt !== undefined && r.rt !== "" && !isNaN(Number(r.rt))) ? Number(r.rt) : 0;
          noteDup("4A", r.inum, rtNum, r.ctin);
          const invKey = `${String(r.ctin || "").trim().toUpperCase()}|${String(r.inum || "").trim().toUpperCase()}`;
          if (!b2bSeenInvs.has(invKey)) { b2bSeenInvs.add(invKey); invoiceCount++; }
          if (checkPos(L, r.pos) && supStateOk) {
            const intra = r.pos === supState;
            if (intra && Number(r.iamt || 0) > 0) E(`${L}: same state supply par IGST laga hai (CGST+SGST hona chahiye). Row hata kar dobara add karein`);
            if (!intra && (Number(r.camt || 0) > 0 || Number(r.samt || 0) > 0)) E(`${L}: dusre state ki supply par CGST/SGST laga hai (IGST hona chahiye). Row hata kar dobara add karein`);
          }
          if (!(Number(r.txval || 0) > 0)) E(`${L}: taxable value 0 hai`);
        });
      }

      // ---- Table 5A B2CL (total invoice value across merged rates must exceed 1,00,000)
      if (sel.b2cl) {
        const b2clTotals = {};
        jsonState.b2cl.forEach(r => {
          const ik = `${String(r.pos || "")}|${String(r.inum || "").trim().toUpperCase()}`;
          b2clTotals[ik] = r2((b2clTotals[ik] || 0) + Number(r.txval || 0) + Number(r.iamt || 0));
        });
        const b2clSeenInvs = new Set();
        jsonState.b2cl.forEach((r, i) => {
          const L = `Table 5A B2CL row ${i + 1} (${r.inum || "-"})`;
          checkDocNum(L, r.inum);
          checkDate(L, r.idt);
          const rtNum = (r.rt !== undefined && r.rt !== "" && !isNaN(Number(r.rt))) ? Number(r.rt) : 0;
          noteDup("5A", r.inum, rtNum, r.pos);
          const ik = `${String(r.pos || "")}|${String(r.inum || "").trim().toUpperCase()}`;
          if (!b2clSeenInvs.has(ik)) {
            b2clSeenInvs.add(ik);
            invoiceCount++;
            if (b2clTotals[ik] <= 100000) E(`${L}: invoice value ${inr(b2clTotals[ik])} hai, 5A me sirf ₹1,00,000 se upar ke invoice aate hain (chhote Table 7 me)`);
          }
          if (checkPos(L, r.pos) && supStateOk && r.pos === supState) E(`${L}: place of supply apna hi state hai, 5A sirf inter-state ke liye hai`);
        });
      }

      // ---- Table 6A Exports (Master Sheet Invoice Part)
      if (sel.exp) {
        jsonState.exp.filter(r => Number(r.txval || 0) > 0).forEach((r, i) => {
          const L = `Table 6A Export row #${9 + i} (${r.inum || "-"})`;
          checkDocNum(L, r.inum);
          checkDate(L, toGstPortalDateStr(r.idt, ""));
          noteDup("6A", r.inum);
          invoiceCount++;
          if (r.exp_typ === "WPAY" && !(Number(r.rt || 0) > 0)) W(`${L}: WPAY (tax ke saath) export me rate 0% hai`);
          const hasPort = Boolean(String(r.sbpcode || "").trim());
          const hasSbNum = Boolean(String(r.sbnum || "").trim());
          const hasSbDt = Boolean(String(r.sbdt || "").trim());
          if (hasPort || hasSbNum || hasSbDt) {
            if (!hasPort || !hasSbNum || !hasSbDt) {
              W(`${L}: Port Code, SB No. aur SB Date teeno hone par hi JSON me shipping bill jayega (adhura SB data portal reject na kare isliye JSON se skip kiya gaya hai)`);
            } else {
              if (!/^[A-Za-z0-9]{6}$/.test(String(r.sbpcode).trim())) E(`${L}: port code "${r.sbpcode}" 6 alphanumeric character ka hona chahiye`);
              if (!/^[0-9]{3,7}$/.test(String(r.sbnum).trim())) E(`${L}: shipping bill number "${r.sbnum}" 3 se 7 digits ka hona chahiye`);
              checkDate(`${L} SB Date`, toGstPortalDateStr(r.sbdt, ""));
            }
          }
        });
      }

      // ---- Table 7 B2CS (payload auto-aggregates matching sply_ty+pos+rt)
      if (sel.b2cs) {
        jsonState.b2cs.filter(r => Number(r.txval || 0) > 0).forEach((r, i) => {
          const L = `Table 7 B2CS row ${i + 1}`;
          if (checkPos(L, r.pos) && supStateOk) {
            const intra = r.pos === supState;
            if ((r.sply_ty !== "INTER") !== intra) {
              E(`${L}: ${r.sply_ty || "INTRA"} likha hai par place of supply ${r.pos} ${intra ? "apna hi state" : "dusra state"} hai`);
            }
          }
        });
      }

      // ---- Table 9B CDNR / CDNUR
      const seenNotes = {};
      const noteDupNt = (tbl, n) => {
        const k = String(n || "").trim().toUpperCase();
        if (!k) return;
        if (seenNotes[k]) E(`Note number ${n} do baar aaya hai (${seenNotes[k]} aur ${tbl})`);
        else seenNotes[k] = tbl;
      };
      if (sel.cdnr) {
        jsonState.cdnr.forEach((r, i) => {
          const L = `Table 9B CDNR row ${i + 1} (${r.nt_num || "-"})`;
          const cp = gstinProblem(r.ctin, "party");
          if (cp) E(`${L}: receiver GSTIN "${r.ctin || "-"}" ${cp}`);
          checkDocNum(L, r.nt_num);
          checkDate(L, r.nt_dt);
          noteDupNt("CDNR", r.nt_num);
          checkPos(L, r.pos);
        });
      }
      if (sel.cdnur) {
        jsonState.cdnur.forEach((r, i) => {
          const L = `Table 9B CDNUR row ${i + 1} (${r.nt_num || "-"})`;
          checkDocNum(L, r.nt_num);
          checkDate(L, r.nt_dt);
          noteDupNt("CDNUR", r.nt_num);
          if (r.typ === "B2CL") {
            if (!GST_VALID_STATE_CODES.has(String(r.pos || "")) || (supStateOk && r.pos === supState)) {
              E(`${L}: B2CL note me place of supply "${r.pos || "-"}" galat hai (buyer ka state chahiye)`);
            }
          }
        });
      }

      // ---- Table 11A / 11B Advances (payload auto-groups by pos+sply_ty and merges rates)
      [["at", "Table 11A Advance"], ["txpd", "Table 11B Adjustment"]].forEach(([key, name]) => {
        if (!sel[key]) return;
        jsonState[key].forEach((r, i) => {
          const L = `${name} row ${i + 1}`;
          if (checkPos(L, r.pos) && supStateOk) {
            const intra = r.pos === supState;
            if ((r.sply_ty !== "INTER") !== intra) {
              E(`${L}: ${r.sply_ty || "INTRA"} likha hai par place of supply ${r.pos} ${intra ? "apna hi state" : "dusra state"} hai`);
            }
          }
        });
      });

      // ---- Table 14 E-commerce (Strict TCS Collector GSTIN validation)
      if (sel.supeco && !payload.supeco) {
        const rawEtin = ((document.getElementById("supecoEtinInput") && document.getElementById("supecoEtinInput").value) || "").trim().toUpperCase();
        const rawSuppVal = parseFloat((document.getElementById("supecoSuppvalInput") && document.getElementById("supecoSuppvalInput").value) || "0");
        if (rawSuppVal > 0 && rawEtin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]C[0-9A-Z]$/.test(rawEtin)) {
          E(`Table 14(a): E-Com GSTIN "${rawEtin}" valid Indian TCS Collector GSTIN nahi hai (14th character "C" aur state code 01–38 hona chahiye, e.g. ${getEtsyTcsGstinForState(jsonState.gstin)})`);
        }
      }
      if (payload.supeco) {
        [["clttx", "Table 14(a)"], ["paytx", "Table 14(b)"]].forEach(([key, name]) => {
          const seen = {};
          (payload.supeco[key] || []).forEach((x, i) => {
            const et = String(x.etin || "").trim().toUpperCase();
            const L = `${name} row ${i + 1}`;
            if (!/^[0-9A-Z]{15}$/.test(et) || !GST_VALID_STATE_CODES.has(et.slice(0, 2))) {
              E(`${L}: e-commerce GSTIN "${et || "-"}" valid 15-digit state GSTIN nahi hai (e.g. ${getEtsyTcsGstinForState(jsonState.gstin)})`);
            } else if (key === "clttx" && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]C[0-9A-Z]$/.test(et)) {
              E(`${L}: "${et}" TCS-registered GSTIN nahi hai (14th character "C" hona zaroori hai, e.g. ${getEtsyTcsGstinForState(jsonState.gstin)})`);
            } else if (!gstinCheckDigitOk(et)) {
              E(`${L}: E-Com TCS GSTIN "${et}" ka 15th check-digit galat hai (sahi GSTIN: ${getEtsyTcsGstinForState(et)})`);
            }
            if (seen[et]) E(`${L}: GSTIN ${et} do baar aaya hai`);
            seen[et] = true;
          });
        });
      }

      // ---- Tables whose JSON layout in this app is not the portal layout yet
      if (payload.eco) E(`Table 15: ye table e-commerce operator bharta hai aur iska format portal wala nahi hai. Ise untick karein`);
      const amendKeys = ["b2ba", "b2cla", "expa", "cdnra", "cdnura", "b2csa", "ata", "txpda", "supecoa"].filter(k => payload[k]);
      if (amendKeys.length) E(`Amendment tables (${amendKeys.join(", ")}) ka format abhi portal wala nahi hai, upload reject hoga. Inhe untick karein aur amendment portal par karein`);

      // ---- Totals from the payload (what really goes into the file)
      const sum = arr => arr.reduce((a, b) => a + Number(b || 0), 0);
      const itmVals = invs => sum((invs || []).flatMap(inv => (inv.itms || []).map(it => (it.itm_det ? it.itm_det.txval : it.txval))));
      const b2bTot = sum((payload.b2b || []).map(p => itmVals(p.inv)));
      const b2clTot = sum((payload.b2cl || []).map(p => itmVals(p.inv)));
      const expTot = sum((payload.exp || []).map(p => itmVals(p.inv)));
      const b2csTot = sum((payload.b2cs || []).map(r => r.txval));
      const sign = n => (n.ntty === "D" ? 1 : -1);
      const cdnrTot = sum((payload.cdnr || []).flatMap(p => (p.nt || []).map(n => sign(n) * itmVals([n]))));
      const cdnurTot = sum((payload.cdnur || []).map(n => sign(n) * itmVals([n])));
      const nilRows = (payload.nil && payload.nil.inv) || [];
      const nilOf = types => sum(nilRows.filter(n => types.includes(n.sply_ty)).map(n => Number(n.nil_amt || 0) + Number(n.expt_amt || 0) + Number(n.ngsup_amt || 0)));
      const sideB2B = r2(b2bTot + cdnrTot + nilOf(["INTRB2B", "INTRAB2B"]));
      const sideB2C = r2(b2clTot + expTot + b2csTot + cdnurTot + nilOf(["INTRB2C", "INTRAB2C"]));
      const hasSupplies = b2bTot + b2clTot + expTot + b2csTot > 0 || (payload.cdnr || []).length > 0 || (payload.cdnur || []).length > 0;

      // ---- Table 12 HSN
      if (sel.hsn) {
        jsonState.hsn.filter(r => Number(r.txval || 0) > 0).forEach((r, i) => {
          const L = `Table 12 HSN row ${i + 1}`;
          const code = String(r.hsn_sc || "").trim();
          if (!/^(\d{4}|\d{6}|\d{8})$/.test(code)) E(`${L}: HSN "${code || "-"}" 4, 6 ya 8 ank ka hona chahiye`);
          if (!(Number(r.qty || 0) > 0)) W(`${L}: quantity 0 hai`);
        });
      }
      if (payload.hsn) {
        const hsnTot = arr => r2(sum((arr || []).map(r => r.txval)));
        if (payload.hsn.data) {
          const h = hsnTot(payload.hsn.data);
          if (Math.abs(h - (sideB2B + sideB2C)) > 1) W(`Table 12 HSN ka total ${inr(h)} hai, baaki tables ka total ${inr(sideB2B + sideB2C)} hai`);
        } else {
          const hb = hsnTot(payload.hsn.hsn_b2b), hc = hsnTot(payload.hsn.hsn_b2c);
          if (Math.abs(hb - sideB2B) > 1) W(`Table 12 HSN (B2B tab) ka total ${inr(hb)} hai, B2B tables ka total ${inr(sideB2B)} hai`);
          if (Math.abs(hc - sideB2C) > 1) W(`Table 12 HSN (B2C tab) ka total ${inr(hc)} hai, B2C/Export tables ka total ${inr(sideB2C)} hai`);
        }
      } else if (hasSupplies) {
        W(`Table 12 HSN summary file me nahi hai jabki invoices hain`);
      }

      // ---- Table 13 Documents issued
      const docTxt = id => ((document.getElementById(id) && document.getElementById(id).value) || "").trim();
      const docInc = !!(document.getElementById("includeDocIssueCheckbox") && document.getElementById("includeDocIssueCheckbox").checked);
      if (payload.doc_issue) {
        const d = payload.doc_issue.doc_det[0].docs[0];
        if (!GST_DOC_NUM_RE.test(d.from)) E(`Table 13: "From" number "${d.from}" galat hai (max 16 character; A-Z, 0-9, "/", "-")`);
        if (!GST_DOC_NUM_RE.test(d.to)) E(`Table 13: "To" number "${d.to}" galat hai (max 16 character; A-Z, 0-9, "/", "-")`);
        if (d.cancel > d.totnum) E(`Table 13: cancelled (${d.cancel}) total issued (${d.totnum}) se zyada hai`);
        if (invoiceCount > 0 && d.net_issue < invoiceCount) W(`Table 13 me net ${d.net_issue} documents hain, par file me ${invoiceCount} invoice hain`);
      } else if (!jsonState.isNilReturn) {
        const fromV = docTxt("docFromInput"), toV = docTxt("docToInput"), totV = parseInt(docTxt("docTotnumInput") || "0", 10) || 0;
        if (docInc && sel.doc_issue && (fromV || toV || totV > 0)) E(`Table 13 adhura hai: From, To aur Total Issued teeno bharein`);
        else if (hasSupplies) W(`Table 13 (Documents Issued) file me nahi hai jabki invoices hain`);
      }

      // ---- Nil mode / empty file
      const dataKeys = Object.keys(payload).filter(k => !["gstin", "fp", "gt", "cur_gt", "version", "hash", "nil"].includes(k));
      if (jsonState.isNilReturn && dataKeys.length) E(`Nil Return mode ON hai lekin file me data hai (${dataKeys.join(", ")}). "Clear All" dabakar dobara bharein`);
      if (!jsonState.isNilReturn && dataKeys.length === 0 && !payload.nil) W(`File me koi table nahi hai (khali JSON)`);

      return { errors, warnings };
    }

    function renderJsonValidationResult(v, fp) {

      const valBanner = document.getElementById("jsonValidationSummaryText");
      const list = document.getElementById("jsonValidationIssuesList");
      const nE = v.errors.length, nW = v.warnings.length;
      if (nE > 0) {


        valBanner.textContent = `❌ ${nE} galti mili${nW ? ` aur ${nW} chetavni` : ""}. Upload se pehle theek karein:`;
        valBanner.className = "text-xs text-rose-300 font-bold mt-0.5";
      } else if (nW > 0) {


        valBanner.textContent = `⚠️ Koi pakki galti nahi, par ${nW} cheez dekh lein:`;
        valBanner.className = "text-xs text-amber-300 font-bold mt-0.5";
      } else {


        valBanner.textContent = `✅ Jaanch pass (${fp}): GSTIN, dates, invoice numbers, duplicates aur totals thik hain. Asli jaanch portal par upload ke baad hogi.`;
        valBanner.className = "text-xs text-emerald-400 mt-0.5";
      }
      if (list) {
        list.innerHTML = "";
        const MAX = 12;
        const all = v.errors.map(m => ["❌", m, "text-rose-200"]).concat(v.warnings.map(m => ["⚠️", m, "text-amber-200"]));
        all.slice(0, MAX).forEach(([icon, msg, cls]) => {
          const li = document.createElement("li");
          li.className = cls;
          li.textContent = `${icon} ${msg}`;
          list.appendChild(li);
        });
        if (all.length > MAX) {
          const li = document.createElement("li");
          li.className = "text-slate-400";
          li.textContent = `… aur ${all.length - MAX} (upar wali theek karne par dikhengi)`;
          list.appendChild(li);
        }
        list.classList.toggle("hidden", all.length === 0);
      }
    }

    let lastForceExportConfirmTs = 0;
    // Used by Download / Copy: if there are errors, show issues in the validation banner & toast and allow 2nd click within 8s
    function confirmJsonExportDespiteErrors(actionText) {
      const v = validateGstr1Json(buildGstPortalJsonObject());
      if (v.errors.length === 0) return true;
      const now = Date.now();
      if (now - lastForceExportConfirmTs < 8000) {
        lastForceExportConfirmTs = 0;
        return true;
      }
      lastForceExportConfirmTs = now;
      const list = document.getElementById("jsonValidationIssuesList");
      if (list) {
        list.classList.remove("hidden");
        list.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      showStickyToast(`⚠️ Is JSON me ${v.errors.length} galti hai (${v.errors[0]}). Phir bhi ${actionText} karne ke liye 8 sec me dobara click karein!`, 6000);
      return false;
    }

    function buildGstPortalJsonObject() {
      const gstin = (document.getElementById("jsonGstinInput").value || "").trim().toUpperCase();
      const fpMonth = document.getElementById("jsonMonthSelect").value || "09";
      const fpYear = document.getElementById("jsonYearSelect").value || "2026";
      const fp = `${fpMonth}${fpYear}`;
      const schemaMode = (document.getElementById("jsonHsnSchemaSelect") && document.getElementById("jsonHsnSchemaSelect").value) || "SPLIT_B2B_B2C";
      const lastDay = new Date(parseInt(fpYear, 10), parseInt(fpMonth, 10), 0).getDate();
      const fallbackIdt = `${String(lastDay).padStart(2, "0")}-${fpMonth}-${fpYear}`;

      // Under GSTN Offline Tool v3.2.4 schema, root-level gt and cur_gt are prohibited/omitted
      const payload = {
        gstin: gstin,
        fp: fp,
        version: schemaMode === "SPLIT_B2B_B2C" ? "GST3.2.4" : "GST3.1.6",
        hash: "hash"
      };

      const numOr = (v, fb = 0) => (v !== undefined && v !== null && v !== "" && !isNaN(Number(v))) ? Number(v) : fb;
      const supStCode = gstin.slice(0, 2);
      const isInterPos = (posVal, iamtVal) => (GST_VALID_STATE_CODES.has(supStCode) && posVal && posVal !== supStCode) || Number(iamtVal || 0) > 0;

      // 1. B2B (Table 4A) — Group by CTIN and merge multi-rate items sharing the same invoice number
      if (jsonState.b2b.length > 0) {
        const byCtin = {};
        const byCtinInv = {};
        jsonState.b2b.forEach((row, idx) => {
          const ctin = (row.ctin || "").trim().toUpperCase();
          if (!byCtin[ctin]) { byCtin[ctin] = []; byCtinInv[ctin] = {}; }
          const inum = cleanGstDocNum(row.inum || `INV-${idx + 1}`, `INV-${idx + 1}`);
          const posVal = row.pos || ctin.slice(0, 2) || "09";
          const rtVal = numOr(row.rt, 0);
          const itemVal = r2(Number(row.txval || 0) + Number(row.iamt || 0) + Number(row.camt || 0) + Number(row.samt || 0));
          const itemDet = { txval: r2(row.txval), rt: rtVal, csamt: 0 };
          if (isInterPos(posVal, row.iamt)) itemDet.iamt = r2(row.iamt || 0);
          else { itemDet.camt = r2(row.camt || 0); itemDet.samt = r2(row.samt || 0); }

          const invKey = inum.toUpperCase();
          const itmNum = Math.round(rtVal * 100) + 1;
          if (!byCtinInv[ctin][invKey]) {
            const invObj = {
              inum: inum,
              idt: toGstPortalDateStr(row.idt, fallbackIdt),
              val: itemVal,
              pos: posVal,
              rchrg: "N",
              inv_typ: "R",
              itms: [{ num: itmNum, itm_det: itemDet }]
            };
            byCtinInv[ctin][invKey] = invObj;
            byCtin[ctin].push(invObj);
          } else {
            const exInv = byCtinInv[ctin][invKey];
            exInv.val = r2(exInv.val + itemVal);
            const exItm = exInv.itms.find(it => it.itm_det.rt === rtVal);
            if (exItm) {
              exItm.itm_det.txval = r2(exItm.itm_det.txval + itemDet.txval);
              if (exItm.itm_det.iamt !== undefined || itemDet.iamt !== undefined) exItm.itm_det.iamt = r2((exItm.itm_det.iamt || 0) + (itemDet.iamt || 0));
              if (exItm.itm_det.camt !== undefined || itemDet.camt !== undefined) {
                exItm.itm_det.camt = r2((exItm.itm_det.camt || 0) + (itemDet.camt || 0));
                exItm.itm_det.samt = r2((exItm.itm_det.samt || 0) + (itemDet.samt || 0));
              }
            } else {
              exInv.itms.push({ num: itmNum, itm_det: itemDet });
            }
          }
        });
        payload.b2b = Object.keys(byCtin).map(ctin => ({ ctin: ctin, inv: byCtin[ctin] }));
      }

      // 2. B2CS (Table 7) — Aggregate rows by (sply_ty, pos, rt)
      const validB2cs = jsonState.b2cs.filter(r => Number(r.txval || 0) > 0);
      if (validB2cs.length > 0) {
        const b2csMap = {};
        validB2cs.forEach(r => {
          const sply = r.sply_ty || "INTRA";
          const posVal = r.pos || "09";
          const rtVal = numOr(r.rt, 0);
          const k = `${sply}|${posVal}|${rtVal}`;
          if (!b2csMap[k]) {
            b2csMap[k] = { sply_ty: sply, pos: posVal, typ: "OE", txval: 0, rt: rtVal, csamt: 0 };
            if (sply === "INTER") b2csMap[k].iamt = 0;
            else { b2csMap[k].camt = 0; b2csMap[k].samt = 0; }
          }
          b2csMap[k].txval = r2(b2csMap[k].txval + Number(r.txval || 0));
          if (sply === "INTER") b2csMap[k].iamt = r2(b2csMap[k].iamt + Number(r.iamt || 0));
          else {
            b2csMap[k].camt = r2(b2csMap[k].camt + Number(r.camt || 0));
            b2csMap[k].samt = r2(b2csMap[k].samt + Number(r.samt || 0));
          }
        });
        payload.b2cs = Object.values(b2csMap);
      }

      // 3. Exports (Table 6A — Built from Master Sheet Invoice Part Rows 9–38)
      const validExp = jsonState.exp.filter(r => Number(r.txval || 0) > 0);
      let totExpIgst = 0;
      if (validExp.length > 0) {
        const byTyp = {};
        validExp.forEach(r => {
          const rtNum = Number(r.rt || 0);
          const t = r.exp_typ || (rtNum > 0 ? "WPAY" : "WOPAY");
          const iamtVal = t === "WPAY" ? r2(r.iamt !== undefined ? r.iamt : (r.txval * rtNum / 100)) : 0;
          totExpIgst += iamtVal;
          if (!byTyp[t]) byTyp[t] = [];
          const invObj = {
            inum: cleanGstDocNum(r.inum || "EXP-001", "EXP-001"),
            idt: toGstPortalDateStr(r.idt, fallbackIdt),
            val: r2(Number(r.txval || 0) + iamtVal),
            itms: [{
              txval: r2(r.txval),
              rt: rtNum,
              iamt: iamtVal,
              csamt: 0
            }]
          };
          const pCode = String(r.sbpcode || "").trim().toUpperCase();
          const sbNum = String(r.sbnum || "").trim();
          const sbDt = toGstPortalDateStr(r.sbdt, "");
          if (/^[A-Za-z0-9]{6}$/.test(pCode) && /^[0-9]{3,7}$/.test(sbNum) && /^\d{2}-\d{2}-\d{4}$/.test(sbDt)) {
            invObj.sbpcode = pCode;
            invObj.sbnum = sbNum;
            invObj.sbdt = sbDt;
          }
          byTyp[t].push(invObj);
        });
        payload.exp = Object.keys(byTyp).map(t => ({ exp_typ: t, inv: byTyp[t] }));
      }

      // 4. Table 14 E-Commerce Supplies (supeco fallback when supecoRows has no 14A_TCS entry)
      const incSupeco = document.getElementById("includeSupecoCheckbox") && document.getElementById("includeSupecoCheckbox").checked;
      const suppVal = parseFloat((document.getElementById("supecoSuppvalInput") && document.getElementById("supecoSuppvalInput").value) || "0");
      const has14aRow = (jsonState.supecoRows || []).some(r => r.secType === "14A_TCS");
      if (incSupeco && suppVal > 0 && jsonState.selectedTables.supeco && !has14aRow) {
        const rawEtin = ((document.getElementById("supecoEtinInput") && document.getElementById("supecoEtinInput").value) || "").trim().toUpperCase();
        const etin = rawEtin || getEffectiveTable14Etin(gstin);
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][A-Z][0-9A-Z]$/.test(etin)) {
          const supTax = computeQuickSupecoTaxes(suppVal);
          payload.supeco = {
            clttx: [{
              etin: etin,
              suppval: r2(suppVal),
              igst: supTax.igst,
              cgst: supTax.cgst,
              sgst: supTax.sgst,
              cess: 0
            }]
          };
        }
      }

      // 6. Table 12 HSN Summary (Dynamically bifurcated into hsn_b2b and hsn_b2c per GST3.2.4 schema)
      const validHsn = jsonState.hsn.filter(r => Number(r.txval || 0) > 0);
      if (validHsn.length > 0) {
        const formatHsnItem = (r, idx) => {
          const code = String(r.hsn_sc || "5703").trim().replace(/[^0-9]/g, "") || "5703";
          const cleanDesc = String(r.desc || "CARPETS AND TEXTILE FLOORING").replace(/[^A-Za-z0-9 .-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30) || "GOODS";
          return {
            num: idx + 1,
            hsn_sc: code,
            desc: cleanDesc,
            uqc: code.startsWith("99") ? "NA" : (r.uqc || "PCS"),
            qty: code.startsWith("99") ? 0 : r2(Number(r.qty || 1)),
            rt: Number(r.rt || 0),
            txval: r2(r.txval),
            iamt: r2(r.iamt || 0),
            camt: r2(r.camt || 0),
            samt: r2(r.samt || 0),
            csamt: 0
          };
        };
        if (schemaMode === "SPLIT_B2B_B2C") {
          const b2bRows = validHsn.filter(r => r.supplyType === "B2B");
          const b2cRows = validHsn.filter(r => r.supplyType !== "B2B");
          payload.hsn = {};
          if (b2bRows.length > 0) payload.hsn.hsn_b2b = b2bRows.map(formatHsnItem);
          if (b2cRows.length > 0) payload.hsn.hsn_b2c = b2cRows.map(formatHsnItem);
          if (!payload.hsn.hsn_b2b && !payload.hsn.hsn_b2c) {
            payload.hsn.hsn_b2c = validHsn.map(formatHsnItem);
          }
        } else {
          payload.hsn = { data: validHsn.map(formatHsnItem) };
        }
      }

      // 7. Table 13 Documents Issued (Strictly { doc_num, docs } without forbidden "doc_typ" property)
      const incDoc = document.getElementById("includeDocIssueCheckbox") && document.getElementById("includeDocIssueCheckbox").checked;
      if (incDoc && !jsonState.isNilReturn) {
        const fromSr = cleanGstDocNum(document.getElementById("docFromInput").value || "", "");
        const toSr = cleanGstDocNum(document.getElementById("docToInput").value || "", "");
        const totNum = Math.max(0, parseInt(document.getElementById("docTotnumInput").value || "0", 10) || 0);
        const cancelNum = Math.max(0, parseInt(document.getElementById("docCancelInput").value || "0", 10) || 0);
        if (fromSr && toSr && totNum >= 1) payload.doc_issue = {
          doc_det: [{
            doc_num: 1,
            docs: [{
              num: 1,
              from: fromSr,
              to: toSr,
              totnum: totNum,
              cancel: cancelNum,
              net_issue: Math.max(0, totNum - cancelNum)
            }]
          }]
        };
      }

      // 8. Table 5A B2CL (Large Inter-State Invoices > 1L) — preserve 0% & merge multi-rate items per invoice
      if (jsonState.selectedTables.b2cl && jsonState.b2cl.length > 0) {
        const byPos = {};
        const byPosInv = {};
        jsonState.b2cl.forEach(r => {
          const p = r.pos || "07";
          if (!byPos[p]) { byPos[p] = []; byPosInv[p] = {}; }
          const inum = cleanGstDocNum(r.inum || "B2CL001", "B2CL001");
          const rtVal = numOr(r.rt, 0);
          const itemVal = r2(Number(r.txval || 0) + Number(r.iamt || 0));
          const itmDet = { rt: rtVal, txval: r2(r.txval), iamt: r2(r.iamt || 0), csamt: 0 };
          const itmNum = Math.round(rtVal * 100) + 1;
          const ik = inum.toUpperCase();
          if (!byPosInv[p][ik]) {
            const invObj = {
              inum: inum,
              idt: toGstPortalDateStr(r.idt, fallbackIdt),
              val: itemVal,
              itms: [{ num: itmNum, itm_det: itmDet }]
            };
            byPosInv[p][ik] = invObj;
            byPos[p].push(invObj);
          } else {
            const exInv = byPosInv[p][ik];
            exInv.val = r2(exInv.val + itemVal);
            const exItm = exInv.itms.find(it => it.itm_det.rt === rtVal);
            if (exItm) {
              exItm.itm_det.txval = r2(exItm.itm_det.txval + itmDet.txval);
              exItm.itm_det.iamt = r2(exItm.itm_det.iamt + itmDet.iamt);
            } else {
              exInv.itms.push({ num: itmNum, itm_det: itmDet });
            }
          }
        });
        payload.b2cl = Object.keys(byPos).map(pos => ({ pos: pos, inv: byPos[pos] }));
      }

      // 9. Table 8A-8D Full Nil / Exempt / Non-GST Matrix
      if (jsonState.selectedTables.nil) {
        const readNil = (k, f) => parseFloat((document.getElementById(`nil${k}_${f}`) && document.getElementById(`nil${k}_${f}`).value) || "0");
        const quickNil = parseFloat((document.getElementById("nilExptAmtInput") && document.getElementById("nilExptAmtInput").value) || "0");
        const matrix = [
          { sply_ty: "INTRB2B", nil_amt: r2(readNil("8A", "nil")), expt_amt: r2(readNil("8A", "expt")), ngsup_amt: r2(readNil("8A", "ngsup")) },
          { sply_ty: "INTRAB2B", nil_amt: r2(readNil("8B", "nil")), expt_amt: r2(readNil("8B", "expt")), ngsup_amt: r2(readNil("8B", "ngsup")) },
          { sply_ty: "INTRB2C", nil_amt: r2(readNil("8C", "nil") + quickNil), expt_amt: r2(readNil("8C", "expt")), ngsup_amt: r2(readNil("8C", "ngsup")) },
          { sply_ty: "INTRAB2C", nil_amt: r2(readNil("8D", "nil")), expt_amt: r2(readNil("8D", "expt")), ngsup_amt: r2(readNil("8D", "ngsup")) }
        ];
        const hasAnyNil = matrix.some(m => m.nil_amt > 0 || m.expt_amt > 0 || m.ngsup_amt > 0);
        if (hasAnyNil || jsonState.isNilReturn) {
          payload.nil = { inv: matrix };
        }
      }

      // 10. Table 9B CDNR (Credit/Debit Notes Registered) — preserve 0%, inter-state keys, merge multi-rate notes
      if (jsonState.selectedTables.cdnr && jsonState.cdnr.length > 0) {
        const byCtin = {};
        const byCtinNt = {};
        jsonState.cdnr.forEach(r => {
          const ctin = (r.ctin || "").trim().toUpperCase();
          if (!byCtin[ctin]) { byCtin[ctin] = []; byCtinNt[ctin] = {}; }
          const posVal = r.pos || ctin.slice(0, 2) || "09";
          const rtVal = numOr(r.rt, 0);
          const det = { rt: rtVal, txval: r2(r.txval), csamt: 0 };
          if (isInterPos(posVal, r.iamt)) det.iamt = r2(r.iamt || 0);
          else { det.camt = r2(r.camt || 0); det.samt = r2(r.samt || 0); }
          const ntNum = cleanGstDocNum(r.nt_num || "CN001", "CN001");
          const itemVal = r2(Number(r.txval || 0) + Number(r.iamt || 0) + Number(r.camt || 0) + Number(r.samt || 0));
          const itmNum = Math.round(rtVal * 100) + 1;
          const nk = ntNum.toUpperCase();
          if (!byCtinNt[ctin][nk]) {
            const ntObj = {
              ntty: r.ntty || "C",
              nt_num: ntNum,
              nt_dt: toGstPortalDateStr(r.nt_dt, fallbackIdt),
              val: itemVal,
              pos: posVal,
              rchrg: "N",
              inv_typ: "R",
              itms: [{ num: itmNum, itm_det: det }]
            };
            byCtinNt[ctin][nk] = ntObj;
            byCtin[ctin].push(ntObj);
          } else {
            const exNt = byCtinNt[ctin][nk];
            exNt.val = r2(exNt.val + itemVal);
            const exItm = exNt.itms.find(it => it.itm_det.rt === rtVal);
            if (exItm) {
              exItm.itm_det.txval = r2(exItm.itm_det.txval + det.txval);
              if (exItm.itm_det.iamt !== undefined || det.iamt !== undefined) exItm.itm_det.iamt = r2((exItm.itm_det.iamt || 0) + (det.iamt || 0));
              if (exItm.itm_det.camt !== undefined || det.camt !== undefined) {
                exItm.itm_det.camt = r2((exItm.itm_det.camt || 0) + (det.camt || 0));
                exItm.itm_det.samt = r2((exItm.itm_det.samt || 0) + (det.samt || 0));
              }
            } else {
              exNt.itms.push({ num: itmNum, itm_det: det });
            }
          }
        });
        payload.cdnr = Object.keys(byCtin).map(ctin => ({ ctin: ctin, nt: byCtin[ctin] }));
      }

      // 11. Table 9B CDNUR (Credit/Debit Notes Unregistered)
      if (jsonState.selectedTables.cdnur && jsonState.cdnur.length > 0) {
        payload.cdnur = jsonState.cdnur.map(r => {
          const rtVal = numOr(r.rt, 0);
          return {
            typ: r.typ || "EXPWOP",
            ntty: r.ntty || "C",
            nt_num: r.nt_num,
            nt_dt: r.nt_dt,
            val: r2(Number(r.txval || 0) + Number(r.iamt || 0)),
            pos: r.pos || "96",
            itms: [{ num: Math.round(rtVal * 100) + 1, itm_det: { rt: rtVal, txval: r2(r.txval), iamt: r2(r.iamt || 0), csamt: 0 } }]
          };
        });
      }

      // Helper: Group Table 11A (at) / Table 11B (txpd) by (pos, sply_ty) and merge rates into itms[]
      const buildAdvGrouped = rows => {
        const grpMap = {};
        rows.forEach(r => {
          const posVal = r.pos || "09";
          const sply = r.sply_ty || "INTRA";
          const rtVal = numOr(r.rt, 0);
          const gk = `${posVal}|${sply}`;
          if (!grpMap[gk]) grpMap[gk] = { pos: posVal, sply_ty: sply, itms: [] };
          const ex = grpMap[gk].itms.find(it => it.rt === rtVal);
          if (ex) {
            ex.ad_amt = r2(ex.ad_amt + Number(r.ad_amt || 0));
            if (sply === "INTER") ex.iamt = r2((ex.iamt || 0) + Number(r.iamt || 0));
            else {
              ex.camt = r2((ex.camt || 0) + Number(r.camt || 0));
              ex.samt = r2((ex.samt || 0) + Number(r.samt || 0));
            }
          } else {
            const itm = { rt: rtVal, ad_amt: r2(r.ad_amt), csamt: 0 };
            if (sply === "INTER") itm.iamt = r2(r.iamt || 0);
            else { itm.camt = r2(r.camt || 0); itm.samt = r2(r.samt || 0); }
            grpMap[gk].itms.push(itm);
          }
        });
        return Object.values(grpMap);
      };

      // 12. Table 11A Advances Received (at)
      if (jsonState.selectedTables.at && jsonState.at.length > 0) {
        payload.at = buildAdvGrouped(jsonState.at);
      }

      // 13. Table 11B Adjustment of Advances (txpd)
      if (jsonState.selectedTables.txpd && jsonState.txpd.length > 0) {
        payload.txpd = buildAdvGrouped(jsonState.txpd);
      }

      // 14. Table 14 (supeco) & Table 15 (eco) from dedicated E-Com rows
      if (jsonState.supecoRows.length > 0) {
        const clttx = [];
        const paytx = [];
        const ecoList = [];
        jsonState.supecoRows.forEach(r => {
          const item = {
            etin: String(r.etin || "").trim().toUpperCase(),
            suppval: r2(r.suppval),
            igst: r2(r.igst || 0),
            cgst: r2(r.cgst || 0),
            sgst: r2(r.sgst || 0),
            cess: 0
          };
          if (r.secType === "14A_TCS") clttx.push(item);
          else if (r.secType === "14B_95") paytx.push(item);
          else if (r.secType === "15_ECO") ecoList.push(item);
        });
        if ((clttx.length || paytx.length) && jsonState.selectedTables.supeco) {
          payload.supeco = payload.supeco || {};
          if (clttx.length) payload.supeco.clttx = clttx;
          if (paytx.length) payload.supeco.paytx = paytx;
        }
        if (ecoList.length && jsonState.selectedTables.eco) {
          payload.eco = { eco_reg: ecoList };
        }
      }

      // 15. Amendment Tables (b2ba, b2cla, expa, cdnra, cdnura, b2csa, ata, txpda, supecoa)
      jsonState.amendRows.forEach(r => {
        if (!jsonState.selectedTables[r.tableKey]) return;
        if (!payload[r.tableKey]) payload[r.tableKey] = [];
        payload[r.tableKey].push({
          orig_ref: r.origRef,
          rev_ref: r.revRef,
          rt: numOr(r.rt, 0),
          txval: r2(r.txval),
          iamt: r2(r.iamt || 0),
          camt: r2(r.camt || 0),
          samt: r2(r.samt || 0),
          csamt: 0
        });
      });

      // Filter out unselected main tables if user unchecked them in the Portal Table Selector Grid
      if (!jsonState.selectedTables.b2b) delete payload.b2b;
      if (!jsonState.selectedTables.b2cl) delete payload.b2cl;
      if (!jsonState.selectedTables.exp) delete payload.exp;
      if (!jsonState.selectedTables.b2cs) delete payload.b2cs;
      if (!jsonState.selectedTables.nil) delete payload.nil;
      if (!jsonState.selectedTables.cdnr) delete payload.cdnr;
      if (!jsonState.selectedTables.cdnur) delete payload.cdnur;
      if (!jsonState.selectedTables.at) delete payload.at;
      if (!jsonState.selectedTables.txpd) delete payload.txpd;
      if (!jsonState.selectedTables.hsn) delete payload.hsn;
      if (!jsonState.selectedTables.doc_issue) delete payload.doc_issue;
      if (!jsonState.selectedTables.supeco) delete payload.supeco;
      if (!jsonState.selectedTables.eco) delete payload.eco;

      return payload;
    }

    const ALL_JSON_SECTIONS = ["exp", "b2cs", "b2b", "b2cl", "nil", "cdnr", "cdnur", "at", "txpd", "hsn", "docs", "supeco", "amend"];

    function getTableStats(tableId) {
      if (tableId === "b2b") {
        let s = 0; jsonState.b2b.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.b2b.length, val: r2(s) };
      }
      if (tableId === "b2cl") {
        let s = 0; jsonState.b2cl.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.b2cl.length, val: r2(s) };
      }
      if (tableId === "exp") {
        let s = 0; jsonState.exp.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.exp.length, val: r2(s) };
      }
      if (tableId === "b2cs") {
        const valid = jsonState.b2cs.filter(r => r.txval > 0);
        let s = 0; valid.forEach(r => { s += Number(r.txval || 0); });
        return { count: valid.length, val: r2(s) };
      }
      if (tableId === "nil") {
        let s = parseFloat((document.getElementById("nilExptAmtInput") && document.getElementById("nilExptAmtInput").value) || "0");
        ["8A", "8B", "8C", "8D"].forEach(k => {
          ["nil", "expt", "ngsup"].forEach(f => {
            const el = document.getElementById(`nil${k}_${f}`);
            if (el) s += parseFloat(el.value || "0");
          });
        });
        return { count: (jsonState.isNilReturn || s > 0) ? 4 : 0, val: r2(s) };
      }
      if (tableId === "cdnr") {
        let s = 0; jsonState.cdnr.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.cdnr.length, val: r2(s) };
      }
      if (tableId === "cdnur") {
        let s = 0; jsonState.cdnur.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.cdnur.length, val: r2(s) };
      }
      if (tableId === "at") {
        let s = 0; jsonState.at.forEach(r => { s += Number(r.ad_amt || 0); });
        return { count: jsonState.at.length, val: r2(s) };
      }
      if (tableId === "txpd") {
        let s = 0; jsonState.txpd.forEach(r => { s += Number(r.ad_amt || 0); });
        return { count: jsonState.txpd.length, val: r2(s) };
      }
      if (tableId === "hsn") {
        let s = 0; jsonState.hsn.forEach(r => { s += Number(r.txval || 0); });
        return { count: jsonState.hsn.length, val: r2(s) };
      }
      if (tableId === "doc_issue") {
        const inc = document.getElementById("includeDocIssueCheckbox") && document.getElementById("includeDocIssueCheckbox").checked;
        const tot = parseInt((document.getElementById("docTotnumInput") && document.getElementById("docTotnumInput").value) || "0", 10);
        const docFilled = ((document.getElementById("docFromInput") && document.getElementById("docFromInput").value) || "").trim() &&
          ((document.getElementById("docToInput") && document.getElementById("docToInput").value) || "").trim() && tot >= 1;
        return { count: inc && docFilled ? 1 : 0, val: tot || 0 };
      }
      if (tableId === "supeco") {
        const rows = jsonState.supecoRows.filter(r => r.secType !== "15_ECO");
        if (rows.length > 0) {
          let s = 0;
          rows.forEach(r => { s += Number(r.suppval || 0); });
          return { count: rows.length, val: r2(s) };
        }
        const inc = document.getElementById("includeSupecoCheckbox") && document.getElementById("includeSupecoCheckbox").checked;
        const quickVal = parseFloat((document.getElementById("supecoSuppvalInput") && document.getElementById("supecoSuppvalInput").value) || "0");
        return { count: (inc && quickVal > 0) ? 1 : 0, val: inc ? r2(quickVal) : 0 };
      }
      if (tableId === "eco") {
        const rows = jsonState.supecoRows.filter(r => r.secType === "15_ECO");
        let s = 0; rows.forEach(r => { s += Number(r.suppval || 0); });
        return { count: rows.length, val: r2(s) };
      }
      // Amendment tables
      const aRows = jsonState.amendRows.filter(r => r.tableKey === tableId);
      let aSum = 0; aRows.forEach(r => { aSum += Number(r.txval || 0); });
      return { count: aRows.length, val: r2(aSum) };
    }

    function renderGstrPortalTableGrid() {
      const grid = document.getElementById("gstrPortalTablesGrid");
      if (!grid) return;

      document.querySelectorAll(".gstr-grid-cat-btn").forEach(btn => {
        const c = btn.getAttribute("data-grid-cat");
        const active = c === jsonState.gridCategory;
        btn.className = "gstr-grid-cat-btn px-3 py-1.5 rounded-xl font-bold transition " +
          (active ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300");
      });

      const visibleTables = GSTR1_PORTAL_TABLES.filter(t => jsonState.gridCategory === "ALL" || t.cat === jsonState.gridCategory);
      const selCount = Object.values(jsonState.selectedTables).filter(Boolean).length;
      const selBadge = document.getElementById("selectedGstrTablesCountBadge");
      if (selBadge) selBadge.textContent = String(selCount);

      const curT = GSTR1_PORTAL_TABLES.find(t => t.id === jsonState.activeTableId) || GSTR1_PORTAL_TABLES[3];
      const curNameBadge = document.getElementById("currentWorkingTableNameBadge");
      if (curNameBadge && curT) curNameBadge.textContent = `Table ${curT.code} — ${curT.title}`;

      grid.innerHTML = visibleTables.map(t => {
        const isChecked = !!jsonState.selectedTables[t.id];
        const isCurrent = jsonState.activeTableId === t.id || (jsonState.activeSec === t.sec && isChecked && jsonState.activeTableId === t.id);
        const st = getTableStats(t.id);
        const valText = t.id === "doc_issue" ? `${st.val} Docs` : `₹${st.val.toLocaleString("en-IN")}`;

        return `
          <div data-portal-card="${t.id}" data-portal-sec="${t.sec}" class="portal-table-card group relative rounded-2xl p-3.5 border-2 transition cursor-pointer flex flex-col justify-between gap-2.5 ${
            isCurrent
              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/30 shadow-sm'
              : isChecked
                ? 'border-emerald-300 bg-emerald-50/20 hover:border-indigo-400 hover:bg-indigo-50/20'
                : 'border-slate-200 bg-slate-50/60 opacity-80 hover:opacity-100 hover:border-slate-300'
          }">
            <div>
              <div class="flex items-start justify-between gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                  t.cat === 'AMEND' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-900 text-white'
                }">
                  <span>${t.icon}</span>
                  <span>Table ${t.code}</span>
                </span>
                <label class="inline-flex items-center gap-1 cursor-pointer select-none" title="Check/Uncheck to work on this table &amp; include in JSON">
                  <input type="checkbox" data-portal-check="${t.id}" ${isChecked ? 'checked' : ''} class="portal-table-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                  <span class="text-[10px] font-bold ${isChecked ? 'text-emerald-700' : 'text-slate-400'}">${isChecked ? 'Selected' : 'Select'}</span>
                </label>
              </div>
              <h4 class="font-extrabold text-slate-900 text-xs sm:text-[13px] mt-2 leading-snug group-hover:text-indigo-700 transition">${t.title}</h4>
              <p class="text-[11px] text-slate-500 mt-0.5 leading-tight">${t.sub}</p>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px]">
              <span class="font-mono font-bold ${st.count > 0 ? 'text-emerald-700' : 'text-slate-400'}">
                ${st.count} Rec • ${valText}
              </span>
              <span class="font-bold text-indigo-700 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                ${isCurrent ? '⚡ Working Now' : 'Work on Table →'}
              </span>
            </div>
          </div>
        `;
      }).join("");

      // Checkbox clicks (toggle table inclusion without losing current view)
      grid.querySelectorAll(".portal-table-checkbox").forEach(chk => {
        chk.addEventListener("click", ev => {
          ev.stopPropagation();
          const tid = chk.getAttribute("data-portal-check");
          jsonState.selectedTables[tid] = chk.checked;
          if (chk.checked) {
            const meta = GSTR1_PORTAL_TABLES.find(x => x.id === tid);
            if (meta) {
              jsonState.activeTableId = tid;
              switchJsonSectionTab(meta.sec, tid);
            }
          }
          renderJsonPage();
        });
      });

      // Populate the compact #selectTableQuickDropdown with all 22 GSTR-1 Portal Tables
      const quickTableSel = document.getElementById("selectTableQuickDropdown");
      if (quickTableSel) {
        const addTables = GSTR1_PORTAL_TABLES.filter(t => t.cat === "ADD");
        const amendTables = GSTR1_PORTAL_TABLES.filter(t => t.cat === "AMEND");
        const fmtOpt = t => {
          const st = getTableStats(t.id);
          const selMark = jsonState.selectedTables[t.id] ? "☑️ " : "";
          const countInfo = st.count > 0 ? ` (${st.count} Rec)` : "";
          return `<option value="${t.id}">${selMark}${t.icon} Table ${t.code} — ${t.title}${countInfo}</option>`;
        };
        quickTableSel.innerHTML =
          `<optgroup label="📋 Add Record Details (13 Main Tables)">${addTables.map(fmtOpt).join("")}</optgroup>` +
          `<optgroup label="✏️ Amend Record Details (9 Amendment Tables)">${amendTables.map(fmtOpt).join("")}</optgroup>`;
        if (jsonState.activeTableId) quickTableSel.value = jsonState.activeTableId;
      }

      // Card clicks -> Select table, open its editor panel immediately, AND auto-collapse drawer so page stays clean!
      grid.querySelectorAll(".portal-table-card").forEach(card => {
        card.addEventListener("click", () => {
          const tid = card.getAttribute("data-portal-card");
          selectAndOpenGstrTableById(tid, true);
        });
      });

      // Map each editor panel to its corresponding GSTR-1 table IDs
      const secToTableIds = {
        b2b: ["b2b"],
        b2cl: ["b2cl"],
        exp: ["exp"],
        b2cs: ["b2cs"],
        nil: ["nil"],
        cdnr: ["cdnr"],
        cdnur: ["cdnur"],
        at: ["at"],
        txpd: ["txpd"],
        hsn: ["hsn"],
        docs: ["doc_issue"],
        supeco: ["supeco", "eco"],
        amend: ["b2ba", "b2cla", "expa", "cdnra", "cdnura", "b2csa", "ata", "txpda", "supecoa"]
      };

      // Open ALL selected table panels simultaneously stacked one below another ("ek ke niche ek")!
      let openSectionNames = [];
      ALL_JSON_SECTIONS.forEach(s => {
        const mappedIds = secToTableIds[s] || [s];
        const isSelected = mappedIds.some(id => jsonState.selectedTables[id]);
        const panel = document.getElementById("jsonSecPanel_" + s);
        if (panel) {
          panel.classList.toggle("hidden", !isSelected);
          if (isSelected) openSectionNames.push(s);
        }
      });

      // Fallback: if user unchecked everything, keep activeSec visible so editor isn't blank
      if (openSectionNames.length === 0) {
        const fallbackPanel = document.getElementById("jsonSecPanel_" + (jsonState.activeSec || "exp"));
        if (fallbackPanel) fallbackPanel.classList.remove("hidden");
      }

      const activeBadgesText = Object.keys(jsonState.selectedTables)
        .filter(k => jsonState.selectedTables[k])
        .map(k => {
          const m = GSTR1_PORTAL_TABLES.find(t => t.id === k);
          return m ? `Table ${m.code.split(",")[0]}` : k.toUpperCase();
        });
      if (curNameBadge) {
        curNameBadge.textContent = activeBadgesText.length > 0
          ? activeBadgesText.join(" + ") + " (Stacked Open Below ↓)"
          : "None Selected";
      }

      document.querySelectorAll(".json-sec-tab-btn").forEach(btn => {
        const sec = btn.getAttribute("data-json-sec");
        const mappedIds = secToTableIds[sec] || [sec];
        const anySelected = mappedIds.some(id => jsonState.selectedTables[id]);
        if (jsonState.filterEditorTabsBySelected && !anySelected) {
          btn.classList.add("hidden");
        } else {
          btn.classList.remove("hidden");
          btn.className = "json-sec-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition " +
            (anySelected ? "bg-indigo-600 text-white shadow-xs" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300");
        }
      });
    }

    function switchJsonSectionTab(secName, optionalTableId) {
      jsonState.activeSec = secName;
      if (optionalTableId) {
        jsonState.activeTableId = optionalTableId;
        jsonState.selectedTables[optionalTableId] = true;
      } else {
        const match = GSTR1_PORTAL_TABLES.find(t => t.sec === secName);
        if (match) {
          jsonState.activeTableId = match.id;
          jsonState.selectedTables[match.id] = true;
        }
      }
      renderGstrPortalTableGrid();
      const targetPanel = document.getElementById("jsonSecPanel_" + secName);
      if (targetPanel && !targetPanel.classList.contains("hidden")) {
        targetPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    document.querySelectorAll(".json-sec-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        switchJsonSectionTab(btn.getAttribute("data-json-sec"));
      });
    });

    function renderJsonPage() {
      const sel = document.getElementById("jsonClientSelect");
      if (sel && sel.options.length === 0) populateJsonClientDropdown();

      const gstin = (document.getElementById("jsonGstinInput").value || "").trim().toUpperCase();
      const fpMonth = document.getElementById("jsonMonthSelect").value || "10";
      const fpYear = document.getElementById("jsonYearSelect").value || "2026";
      const fp = `${fpMonth}${fpYear}`;
      const monName = PT_MON_NAMES[parseInt(fpMonth, 10) - 1] || "Oct";

      document.getElementById("jsonFilenamePreviewBadge").textContent = `GSTR1_${gstin || "GSTIN"}_${fp}.json`;

      // Calculate KPI Totals across all currently selected GSTR-1 tables
      const selT = jsonState.selectedTables || {};
      let totTxval = 0, totIgst = 0, totCgst = 0, totSgst = 0, recCount = 0;
      if (selT.b2cs) jsonState.b2cs.forEach(r => { if (r.txval > 0) { totTxval += r.txval; totIgst += Number(r.iamt || 0); totCgst += Number(r.camt || 0); totSgst += Number(r.samt || 0); recCount++; } });
      if (selT.exp) jsonState.exp.forEach(r => { if (r.txval > 0) { totTxval += r.txval; totIgst += Number(r.iamt || 0); recCount++; } });
      if (selT.b2b) jsonState.b2b.forEach(r => { if (r.txval > 0) { totTxval += r.txval; totIgst += Number(r.iamt || 0); totCgst += Number(r.camt || 0); totSgst += Number(r.samt || 0); recCount++; } });
      if (selT.b2cl) jsonState.b2cl.forEach(r => { if (r.txval > 0) { totTxval += r.txval; totIgst += Number(r.iamt || 0); recCount++; } });
      if (selT.cdnr) jsonState.cdnr.forEach(r => {
        if (r.txval > 0) {
          const s = r.ntty === "D" ? 1 : -1;
          totTxval += s * r.txval; totIgst += s * Number(r.iamt || 0); totCgst += s * Number(r.camt || 0); totSgst += s * Number(r.samt || 0); recCount++;
        }
      });
      if (selT.cdnur) jsonState.cdnur.forEach(r => {
        if (r.txval > 0) {
          const s = r.ntty === "D" ? 1 : -1;
          totTxval += s * r.txval; totIgst += s * Number(r.iamt || 0); recCount++;
        }
      });
      if (selT.at) jsonState.at.forEach(r => { if (r.ad_amt > 0) { totTxval += r.ad_amt; totIgst += Number(r.iamt || 0); totCgst += Number(r.camt || 0); totSgst += Number(r.samt || 0); recCount++; } });
      if (selT.txpd) jsonState.txpd.forEach(r => { if (r.ad_amt > 0) { totTxval -= r.ad_amt; totIgst -= Number(r.iamt || 0); totCgst -= Number(r.camt || 0); totSgst -= Number(r.samt || 0); recCount++; } });
      if (selT.supeco && recCount === 0 && (jsonState.supecoRows || []).length > 0) {
        jsonState.supecoRows.forEach(r => {
          if (r.secType !== "15_ECO" && Number(r.suppval || 0) > 0) {
            totTxval += Number(r.suppval || 0); totIgst += Number(r.igst || 0); totCgst += Number(r.cgst || 0); totSgst += Number(r.sgst || 0); recCount++;
          }
        });
      }



      const totTax = r2(totIgst + totCgst + totSgst);







      // Update Tab Counts
      document.getElementById("jsonTabCountB2cs").textContent = String(jsonState.b2cs.filter(r => r.txval > 0).length);
      document.getElementById("jsonTabCountExp").textContent = String(jsonState.exp.filter(r => r.txval > 0).length);
      document.getElementById("jsonTabCountB2b").textContent = String(jsonState.b2b.filter(r => r.txval > 0).length);
      document.getElementById("jsonTabCountHsn").textContent = String(jsonState.hsn.filter(r => r.txval > 0).length);

      // Render B2CS Table
      const b2csBody = document.getElementById("jsonB2csTableBody");
      const validB2cs = jsonState.b2cs.filter(r => r.txval > 0);
      b2csBody.innerHTML = validB2cs.length === 0
        ? `<tr><td colspan="9" class="text-center py-6 text-slate-400">Koi B2CS entry nahi hai. Upar Taxable Value daal kar <b>➕ Add B2CS Row</b> dabayein ya Etsy CSV upload karein.</td></tr>`
        : validB2cs.map((r, i) => `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
            <td class="py-2 px-3 font-bold">${r.sply_ty}</td>
            <td class="py-2 px-3 font-mono">${r.pos}</td>
            <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.camt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.samt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-center"><button type="button" data-del-b2cs="${i}" class="del-b2cs-btn text-rose-600 font-bold hover:underline">✕</button></td>
          </tr>
        `).join("");
      b2csBody.querySelectorAll(".del-b2cs-btn").forEach(b => {
        b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
          const validIdx = parseInt(b.getAttribute("data-del-b2cs"), 10);
          jsonState.b2cs = validB2cs.filter((_, idx) => idx !== validIdx);
          autoSyncHsnFromTables();
          renderJsonPage();
        });
      });

      // Render Master Sheet Month Tabs Strip & Invoice Part Header Cards (C4, D4, B8/D8, G8/H8, D5)
      {
        const selClient = clients.find(x => x.sr === Number(jsonState.selectedSr)) || clients[0];
        const wb = (selClient && typeof getClientWorkbook === "function") ? getClientWorkbook(selClient.sr) : null;
        const metrics = (wb && typeof computeFullWorkbookMetrics === "function") ? computeFullWorkbookMetrics(wb) : null;
        const activeMeta = getJsonSelectedMasterTabMeta();
        const activeTabName = activeMeta ? activeMeta.tab : "Sep26";
        const mRow = (metrics && metrics.allSummaryRows)
          ? (metrics.allSummaryRows.find(r => r.tab === activeTabName) || null)
          : null;

        const tabBadge = document.getElementById("jsonActiveMasterTabBadge");
        if (tabBadge) tabBadge.textContent = activeMeta ? `${activeMeta.tab}` : activeTabName;
        const expMonthLbl = document.getElementById("jsonExpMasterMonthLabel");
        if (expMonthLbl) expMonthLbl.textContent = activeMeta ? `${activeMeta.tab}` : activeTabName;
        const stripLbl = document.getElementById("jsonMasterStripClientMonthLabel");
        if (stripLbl && selClient) {
          stripLbl.textContent = `${selClient.client} (${selClient.firm || "-"}) • ${activeMeta ? `${activeMeta.tab}` : activeTabName}`;
        }

        // Render 12 FY Month Tab Buttons on JSON Page showing Invoice Count from Master Sheet Invoice Part
        const stripEl = document.getElementById("jsonMasterMonthTabsStrip");
        if (stripEl && typeof getActiveFyMonthTabs === "function") {
          const fyMonths = getActiveFyMonthTabs();
          stripEl.replaceChildren();
          fyMonths.forEach(m => {
            const rSum = (metrics && metrics.allSummaryRows) ? metrics.allSummaryRows.find(x => x.tab === m.tab) : null;
            const invCnt = rSum ? rSum.invoicesCount : 0;
            const ordCnt = (wb && wb.tabs[m.tab] && wb.tabs[m.tab].orders) ? wb.tabs[m.tab].orders.length : 0;
            const badgeTxt = invCnt > 0 ? ` · ${invCnt}` : (ordCnt > 0 ? ` · ${ordCnt}` : "");
            const tabBtn = document.createElement("button");
            tabBtn.type = "button"; tabBtn.setAttribute("role", "tab"); tabBtn.setAttribute("aria-selected", m.tab === activeTabName ? "true" : "false");
            tabBtn.className = "month-tab-btn" + (m.tab === activeTabName ? " is-active" : ""); tabBtn.textContent = m.tab + badgeTxt;
            tabBtn.addEventListener("click", () => {
            const mVal = String(selected.m).padStart(2, "0");
            const yVal = String(selected.y);
            const tKey = selected.tab;
            jsonState.fpMonth = mVal;
            jsonState.fpYear = yVal;
            masterActiveTab = tKey;
            const mSel = document.getElementById("jsonMonthSelect");
            const ySel = document.getElementById("jsonYearSelect");
            if (mSel) mSel.value = mVal;
            if (ySel && [...ySel.options].some(o => o.value === yVal)) ySel.value = yVal;
            syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
            renderJsonPage();
            showToast(`📑 Master Sheet Tab ${tKey} ka Invoice Part load ho gaya!`);
            });
            stripEl.appendChild(tabBtn);
          });
        }

        // Compute live Invoice Part totals (from jsonState.exp when active, or mRow)
        let expTxSum = 0, expTaxSum = 0, expNetSum = 0;
        jsonState.exp.forEach(r => {
          const tv = Number(r.txval || 0);
          const tx = Number(r.iamt || 0);
          expTxSum += tv;
          expTaxSum += tx;
          expNetSum += (tv + tx);
        });
        expTxSum = r2(expTxSum);
        expTaxSum = r2(expTaxSum);
        expNetSum = r2(expNetSum);

        const c4Val = mRow ? mRow.c4PrevRov : 0;
        const d4Val = mRow ? mRow.d4GrossOrder : 0;
        const d8Val = jsonState.exp.length > 0 ? expTxSum : (mRow ? mRow.d8Taxable : 0);
        const g8Val = jsonState.exp.length > 0 ? expTaxSum : (mRow ? mRow.g8Tax : 0);
        const h8Val = jsonState.exp.length > 0 ? expNetSum : (mRow ? mRow.h8Net : 0);
        const b8Cnt = jsonState.exp.length > 0 ? jsonState.exp.length : (mRow ? mRow.invoicesCount : 0);
        const d5Val = r2(c4Val + d4Val - d8Val);
        const tabOrdCnt = (wb && wb.tabs[activeTabName] && wb.tabs[activeTabName].orders) ? wb.tabs[activeTabName].orders.length : 0;

        const setElTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
        const setElHtml = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
        setElTxt("jsonMasterCellC4", `₹${c4Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElTxt("jsonMasterCellD4", `₹${d4Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElHtml("jsonMasterCellD4Sub", `${tabOrdCnt} Etsy Orders in ${activeTabName}<span class="sref"> (Cell I75)</span>`);
        setElTxt("jsonMasterCellD8", `₹${d8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElHtml("jsonMasterCellB8", `${b8Cnt} Invoices billed in ${activeTabName}<span class="sref"> (Rows 9–38)</span>`);
        setElHtml("jsonMasterCellG8", `Tax<span class="sref"> (G8)</span>: ₹${g8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElHtml("jsonMasterCellH8", `Net Value<span class="sref"> (H8)</span>: ₹${h8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElTxt("jsonMasterCellD5", `₹${d5Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);

        setElTxt("jsonExpCellB8Count", String(b8Cnt));
        setElTxt("jsonExpCellD8Total", `₹${d8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElTxt("jsonExpCellG8Total", `₹${g8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
        setElTxt("jsonExpCellH8Total", `₹${h8Val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
      }

      // Render EXP Table (Restructured as Etsy Master Sheet Top Invoice Working Table: Rows 9–38, Cols A–L)
      const expBody = document.getElementById("jsonExpTableBody");
      const expFoot = document.getElementById("jsonExpTableFoot");
      let totExpTxval = 0, totExpTax = 0, totExpNet = 0;

      if (jsonState.exp.length === 0) {
        expBody.innerHTML = `<tr><td data-sref-colspan-off="13" colspan="14" class="text-center py-7 text-slate-400">Is mahine ke Master Sheet Invoice Part <span class="sref">(Rows 9–38)</span> me abhi koi billed invoice nahi hai. Master Etsy Editor me <b>Col K (Invoice date)</b> bharein, dusra Month Tab chunein, ya neeche form se Invoice add karein.</td></tr>`;
        if (expFoot) expFoot.innerHTML = "";
      } else {
        expBody.innerHTML = jsonState.exp.map((r, i) => {
          const rtNum = Number(r.rt || 0);
          const expTyp = r.exp_typ || (rtNum > 0 ? "WPAY" : "WOPAY");
          const iamt = expTyp === "WPAY" ? r2(Number(r.txval || 0) * (rtNum / 100)) : 0;
          const netVal = r2(Number(r.txval || 0) + iamt);
          r.iamt = iamt;
          r.val = netVal;
          r.exp_typ = expTyp;
          totExpTxval += Number(r.txval || 0);
          totExpTax += iamt;
          totExpNet += netVal;

          const payDtDisp = r.payDate || toSlashDateStr(r.idt);
          const srcBadge = r.srcTab ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">${r.srcTab}</span>` : "";

          return `
            <tr class="border-b border-slate-100 hover:bg-indigo-50/30">
              <td class="py-2 px-2 font-mono text-slate-400 font-bold sref-col">#${9 + i}</td>
              <td class="py-1.5 px-2">
                <div class="flex items-center gap-1">
                  <input type="text" value="${payDtDisp}" data-json-exp-idx="${i}" data-json-exp-field="payDate" placeholder="DD/MM/YYYY" class="json-exp-inline-inp w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono text-slate-700" />
                  ${srcBadge}
                </div>
              </td>
              <td class="py-1.5 px-2">
                <input type="text" value="${r.inum || ''}" maxlength="16" data-json-exp-idx="${i}" data-json-exp-field="inum" class="json-exp-inline-inp w-24 rounded border border-indigo-200 bg-indigo-50/40 px-2 py-1 text-xs font-mono font-black text-indigo-800" />
              </td>
              <td class="py-1.5 px-2">
                <input type="text" value="${r.idt || ''}" data-json-exp-idx="${i}" data-json-exp-field="idt" placeholder="DD-MM-YYYY" class="json-exp-inline-inp w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-800" />
              </td>
              <td class="py-1.5 px-2 text-right">
                <input type="number" step="0.01" value="${r.txval || 0}" data-json-exp-idx="${i}" data-json-exp-field="txval" class="json-exp-inline-inp w-28 rounded border border-emerald-300 bg-emerald-50/30 px-2 py-1 text-xs font-mono font-bold text-right text-emerald-800" />
              </td>
              <td class="py-1.5 px-2 text-center">
                <input type="text" value="${r.hsn || '5703'}" data-json-exp-idx="${i}" data-json-exp-field="hsn" class="json-exp-inline-inp w-16 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono text-center" />
              </td>
              <td class="py-1.5 px-2 text-center bg-amber-50/50">
                <div class="flex items-center justify-center gap-1">
                  <select data-json-exp-idx="${i}" data-json-exp-field="rt" aria-label="Tax Rate for ${r.inum}" class="json-exp-inline-inp rounded border border-amber-300 bg-white px-1.5 py-1 text-xs font-bold">
                    <option value="0" ${rtNum === 0 ? 'selected' : ''}>0%</option>
                    <option value="5" ${rtNum === 5 ? 'selected' : ''}>5%</option>
                    <option value="8" ${rtNum === 8 ? 'selected' : ''}>8%</option>
                    <option value="12" ${rtNum === 12 ? 'selected' : ''}>12%</option>
                    <option value="18" ${rtNum === 18 ? 'selected' : ''}>18%</option>
                  </select>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black ${expTyp === 'WPAY' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}">${expTyp}</span>
                </div>
              </td>
              <td class="py-2 px-2 text-right font-mono font-semibold text-slate-800">₹${iamt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-2 px-2 text-right font-mono font-black text-slate-900">₹${netVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              <td class="py-1.5 px-2 bg-amber-50/50">
                <input type="text" value="${r.sbpcode || ''}" maxlength="6" data-json-exp-idx="${i}" data-json-exp-field="sbpcode" placeholder="Port" class="json-exp-inline-inp w-20 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono uppercase" />
              </td>
              <td class="py-1.5 px-2 bg-amber-50/50">
                <input type="text" value="${r.sbnum || ''}" data-json-exp-idx="${i}" data-json-exp-field="sbnum" placeholder="SB No" class="json-exp-inline-inp w-24 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono" />
              </td>
              <td class="py-1.5 px-2 bg-amber-50/50">
                <input type="text" value="${r.sbdt || ''}" data-json-exp-idx="${i}" data-json-exp-field="sbdt" placeholder="DD-MM-YYYY" class="json-exp-inline-inp w-24 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-mono" />
              </td>
              <td class="py-1.5 px-2 text-center bg-amber-50/50">
                <select data-json-exp-idx="${i}" data-json-exp-field="csNcs" aria-label="CS/NCS for ${r.inum}" class="json-exp-inline-inp rounded border border-amber-300 bg-white px-1.5 py-1 text-xs font-bold">
                  <option value="NCS" ${(r.csNcs || 'NCS') === 'NCS' ? 'selected' : ''}>NCS</option>
                  <option value="CS" ${r.csNcs === 'CS' ? 'selected' : ''}>CS</option>
                </select>
              </td>
              <td class="py-2 px-2 text-center"><button type="button" data-del-exp="${i}" class="del-exp-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `;
        }).join("");

        if (expFoot) {
          expFoot.innerHTML = `
            <tr>
              <td data-sref-colspan-off="3" colspan="4" class="py-2.5 px-3 font-black text-amber-300"><span class="sref">Row 8 </span>Total • ${jsonState.exp.length} Billed Invoices <span class="sref">(Cell B8)</span></td>
              <td class="py-2.5 px-2 text-right text-emerald-300 font-black">₹${r2(totExpTxval).toLocaleString("en-IN", { minimumFractionDigits: 2 })}<span class="sref"> (D8)</span></td>
              <td colspan="2" class="py-2.5 px-2 text-center text-slate-300">HSN 5703</td>
              <td class="py-2.5 px-2 text-right text-amber-300 font-black">₹${r2(totExpTax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}<span class="sref"> (G8)</span></td>
              <td class="py-2.5 px-2 text-right text-white font-black">₹${r2(totExpNet).toLocaleString("en-IN", { minimumFractionDigits: 2 })}<span class="sref"> (H8)</span></td>
              <td colspan="5"></td>
            </tr>
          `;
        }
      }

      // Wire inline edits on the Master Sheet Invoice Part table on JSON Page -> full 2-way sync with Master Workbook (orders + invMeta)!
      expBody.querySelectorAll(".json-exp-inline-inp").forEach(inp => {
        inp.addEventListener("change", () => {
          const idx = parseInt(inp.getAttribute("data-json-exp-idx"), 10);
          const field = inp.getAttribute("data-json-exp-field");
          const row = jsonState.exp[idx];
          if (!row) return;
          const oldInum = row.inum;

          if (field === "rt") {
            const newRt = parseFloat(inp.value || "0");
            row.rt = newRt;
            row.exp_typ = newRt > 0 ? "WPAY" : "WOPAY";
            row.iamt = row.exp_typ === "WPAY" ? r2(Number(row.txval || 0) * (newRt / 100)) : 0;
            row.val = r2(Number(row.txval || 0) + row.iamt);
          } else if (field === "txval") {
            const newTv = Math.max(0, parseFloat(inp.value || "0") || 0);
            row.txval = r2(newTv);
            row.iamt = row.exp_typ === "WPAY" ? r2(row.txval * (Number(row.rt || 0) / 100)) : 0;
            row.val = r2(row.txval + row.iamt);
          } else if (field === "idt") {
            row.idt = toGstPortalDateStr(inp.value.trim(), row.idt);
          } else if (field === "inum") {
            const cleanedInum = cleanGstDocNum(inp.value.trim(), row.inum);
            const dupInJson = jsonState.exp.some((x, xi) => xi !== idx && String(x.inum || "").trim().toUpperCase() === cleanedInum.toUpperCase());
            const selClCheck = clients.find(x => x.sr === Number(jsonState.selectedSr));
            const wbCheck = (selClCheck && typeof getClientWorkbook === "function") ? getClientWorkbook(selClCheck.sr) : null;
            const srcTabKeyCheck = row.srcTab || (getJsonSelectedMasterTabMeta() && getJsonSelectedMasterTabMeta().tab) || "";
            const srcOrdIdxCheck = row.srcRow ? (row.srcRow - 45) : -1;
            const dupInWb = wbCheck && cleanedInum.toUpperCase() !== String(oldInum || "").trim().toUpperCase() &&
                            getActiveWorkbookInvSet(wbCheck, srcTabKeyCheck, srcOrdIdxCheck).has(cleanedInum.toUpperCase());
            if (dupInJson || dupInWb) {
              inp.value = oldInum;
              showToast(`⚠️ Invoice ${cleanedInum} pehle se maujood hai! Alag Invoice No. dalein.`);
              return;
            }
            row.inum = cleanedInum;
          } else if (field === "sbpcode") {
            row.sbpcode = inp.value.trim().toUpperCase();
          } else {
            row[field] = inp.value.trim();
          }

          // Full 2-way sync back to Master Etsy Workbook (invMeta, sequence, log, AND underlying order in srcTab)
          const selClient = clients.find(x => x.sr === Number(jsonState.selectedSr));
          const activeMeta = getJsonSelectedMasterTabMeta();
          if (selClient && activeMeta && typeof getClientWorkbook === "function") {
            const wb = getClientWorkbook(selClient.sr);
            const parsedRowIdt = typeof parseFlexDate === "function" ? parseFlexDate(toSlashDateStr(row.idt)) : null;
            const idtTabMeta = parsedRowIdt && typeof ALL_MASTER_MONTH_TABS !== "undefined" ? ALL_MASTER_MONTH_TABS.find(x => x.m === parsedRowIdt.m && x.y === parsedRowIdt.y) : null;
            const metaTabKey = (idtTabMeta && wb.tabs[idtTabMeta.tab]) ? idtTabMeta.tab : activeMeta.tab;
            const tData = wb.tabs[metaTabKey];
            if (tData && row.inum) {
              tData.invMeta = tData.invMeta || {};
              if (oldInum && oldInum !== row.inum && tData.invMeta[oldInum]) {
                delete tData.invMeta[oldInum];
              }
              tData.invMeta[row.inum] = {
                rate: Number(row.rt || 0),
                portCode: row.sbpcode || "",
                sbNo: row.sbnum || "",
                sbDate: toSlashDateStr(row.sbdt || ""),
                csNcs: row.csNcs || "NCS"
              };
            }
            const srcTabKey = row.srcTab || activeMeta.tab;
            const srcTabObj = wb.tabs[srcTabKey];
            if (srcTabObj && Array.isArray(srcTabObj.orders)) {
              let ordIdx = (row.srcRow && srcTabObj.orders[row.srcRow - 45]) ? (row.srcRow - 45) : -1;
              let ordObj = ordIdx >= 0 ? srcTabObj.orders[ordIdx] : null;
              if (!ordObj || (oldInum && ordObj.invNo !== oldInum)) {
                ordIdx = srcTabObj.orders.findIndex(o => o.invNo === oldInum || o.invNo === row.inum);
                ordObj = ordIdx >= 0 ? srcTabObj.orders[ordIdx] : null;
              }
              if (ordObj) {
                if (field === "payDate") ordObj.payDate = toSlashDateStr(row.payDate);
                if (field === "inum") {
                  if (oldInum && oldInum.toUpperCase() !== row.inum.toUpperCase()) {
                    logInvoiceRelease(wb, srcTabKey, 45 + ordIdx, oldInum, ordObj.invDate, "RELEASED", ordObj.orderNo);
                  }
                  ordObj.invNo = row.inum;
                  syncWorkbookSeqFromManualInv(wb, row.inum);
                  wb.invoiceLog.unshift({
                    ts: new Date().toLocaleString("en-IN"),
                    tab: srcTabKey,
                    row: 45 + ordIdx,
                    orderNo: ordObj.orderNo ? String(ordObj.orderNo) : "",
                    invNo: row.inum,
                    invDate: ordObj.invDate || toSlashDateStr(row.idt),
                    event: "ASSIGNED"
                  });
                }
                if (field === "idt") ordObj.invDate = toSlashDateStr(row.idt);
                if (field === "hsn") ordObj.hsn = row.hsn;
                if (field === "csNcs") ordObj.sb = row.csNcs;
                if (field === "txval") {
                  const deductions = Number(ordObj.refund || 0) + (Number(ordObj.buyerTax || 0) - Number(ordObj.taxRefund || 0));
                  ordObj.gross = r2(row.txval + deductions);
                }
              } else if (field === "inum") {
                syncWorkbookSeqFromManualInv(wb, row.inum);
              }
            }
            const expInumEl = document.getElementById("expInumInput");
            if (expInumEl) expInumEl.placeholder = `${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`;
            if (typeof saveMasterWorkbooks === "function") saveMasterWorkbooks();
            if (typeof triggerMasterAutoSync === "function") triggerMasterAutoSync(activeMeta.tab);
          }

          syncDocsAndSupecoFromExpInvoices();
          autoSyncHsnFromTables();
          renderJsonPage();
        });
      });

      expBody.querySelectorAll(".del-exp-btn").forEach(b => {
        b.addEventListener("click", () => {
          const delIdx = parseInt(b.getAttribute("data-del-exp"), 10);
          const removed = jsonState.exp[delIdx];
          if (!confirmDelete(`Invoice ${removed && removed.inum ? removed.inum + " " : ""}delete karna hai?`)) return;
          jsonState.exp.splice(delIdx, 1);

          // Sync deletion/unbilling into Master Workbook so deleted invoice never comes back or repeats!
          const selClient = clients.find(x => x.sr === Number(jsonState.selectedSr));
          const activeMeta = getJsonSelectedMasterTabMeta();
          if (removed && removed.inum && selClient && typeof getClientWorkbook === "function") {
            const wb = getClientWorkbook(selClient.sr);
            const remInumUpper = String(removed.inum).trim().toUpperCase();
            let syncTabKey = (removed.srcTab && wb.tabs[removed.srcTab]) ? removed.srcTab : (activeMeta ? activeMeta.tab : "");
            Object.keys(wb.tabs || {}).forEach(tk => {
              const td = wb.tabs[tk];
              if (td && td.invMeta && td.invMeta[removed.inum]) delete td.invMeta[removed.inum];
              if (!td || !Array.isArray(td.orders)) return;
              for (let oi = td.orders.length - 1; oi >= 0; oi--) {
                const o = td.orders[oi];
                if (o && String(o.invNo || "").trim().toUpperCase() === remInumUpper) {
                  syncTabKey = tk;
                  const rowNo = 45 + oi;
                  logInvoiceRelease(wb, tk, rowNo, o.invNo, o.invDate, "DELETED", o.orderNo);
                  if (o._addedFromJson) {
                    td.orders.splice(oi, 1);
                    if (Array.isArray(wb.invoiceLog)) {
                      wb.invoiceLog.forEach(l => { if (l && l.tab === tk && Number(l.row) > rowNo) l.row = Number(l.row) - 1; });
                    }
                    masterForcePushTabs.add(selClient.sr + ":" + tk);
                  } else {
                    o.invNo = "";
                    o.invDate = "";
                    o.hsn = "";
                  }
                }
              }
            });
            recalcNextSeqAfterRelease(wb, removed.inum);
            const expInumEl = document.getElementById("expInumInput");
            if (expInumEl) expInumEl.placeholder = `${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`;
            saveMasterWorkbooks();
            if (syncTabKey && typeof triggerMasterAutoSync === "function") triggerMasterAutoSync(syncTabKey);
          }

          syncDocsAndSupecoFromExpInvoices();
          autoSyncHsnFromTables();
          renderJsonPage();
          showToast(`🗑️ Invoice ${removed ? removed.inum : ""} delete ho gaya!${selClient ? "" : ""}`);
        });
      });

      // Render B2B Table
      const b2bBody = document.getElementById("jsonB2bTableBody");
      b2bBody.innerHTML = jsonState.b2b.length === 0
        ? `<tr><td colspan="11" class="text-center py-6 text-slate-400">Koi B2B invoice nahi hai. Regular client ke B2B bills upar se add karein.</td></tr>`
        : jsonState.b2b.map((r, i) => `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
            <td class="py-2 px-3 font-mono font-bold text-indigo-700">${r.ctin}</td>
            <td class="py-2 px-3 font-mono font-bold">${r.inum}</td>
            <td class="py-2 px-3 font-mono">${r.idt}</td>
            <td class="py-2 px-3 text-center font-mono">${r.pos}</td>
            <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.camt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${r.samt.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-center"><button type="button" data-del-b2b="${i}" class="del-b2b-btn text-rose-600 font-bold hover:underline">✕</button></td>
          </tr>
        `).join("");
      b2bBody.querySelectorAll(".del-b2b-btn").forEach(b => {
        b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
          jsonState.b2b.splice(parseInt(b.getAttribute("data-del-b2b"), 10), 1);
          autoSyncHsnFromTables();
          renderJsonPage();
        });
      });

      // Render HSN Table
      const hsnBody = document.getElementById("jsonHsnTableBody");
      hsnBody.innerHTML = jsonState.hsn.length === 0
        ? `<tr><td colspan="11" class="text-center py-6 text-slate-400">HSN table khali hai. Invoices add karne par HSN 5703 apne-aap ban jayega.</td></tr>`
        : jsonState.hsn.map((r, i) => `
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
            <td class="py-2 px-3 font-mono font-bold text-indigo-700">${r.hsn_sc}</td>
            <td class="py-2 px-3 text-slate-700">${r.desc}</td>
            <td class="py-2 px-3 text-center font-mono">${r.uqc}</td>
            <td class="py-2 px-3 text-right font-mono">${r.qty}</td>
            <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${(r.iamt || 0).toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${(r.camt || 0).toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-right font-mono">₹${(r.samt || 0).toLocaleString("en-IN")}</td>
            <td class="py-2 px-3 text-center"><button type="button" data-del-hsn="${i}" class="del-hsn-btn text-rose-600 font-bold hover:underline">✕</button></td>
          </tr>
        `).join("");
      hsnBody.querySelectorAll(".del-hsn-btn").forEach(b => {
        b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
          jsonState.hsn.splice(parseInt(b.getAttribute("data-del-hsn"), 10), 1);
          renderJsonPage();
        });
      });

      // (v11 FIX: validation ab function ke end me poori file par chalti hai — validateGstr1Json)

      // Update New Table Tab Counts
      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
      setTxt("jsonTabCountB2cl", jsonState.b2cl.length);
      setTxt("jsonTabCountNil", getTableStats("nil").count);
      setTxt("jsonTabCountCdnr", jsonState.cdnr.length);
      setTxt("jsonTabCountCdnur", jsonState.cdnur.length);
      setTxt("jsonTabCountAt", jsonState.at.length);
      setTxt("jsonTabCountTxpd", jsonState.txpd.length);
      setTxt("jsonTabCountSupeco", jsonState.supecoRows.length);
      setTxt("jsonTabCountAmend", jsonState.amendRows.length);

      // Render B2CL Table
      const b2clBody = document.getElementById("jsonB2clTableBody");
      if (b2clBody) {
        b2clBody.innerHTML = jsonState.b2cl.length === 0
          ? `<tr><td colspan="9" class="text-center py-6 text-slate-400">Koi B2CL (> ₹2.5L Inter-State) invoice nahi hai.</td></tr>`
          : jsonState.b2cl.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-mono font-bold">${r.pos}</td>
              <td class="py-2 px-3 font-mono font-bold text-indigo-700">${r.inum}</td>
              <td class="py-2 px-3 font-mono">${r.idt}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono font-bold">₹${r2(r.txval + r.iamt).toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-b2cl="${i}" class="del-b2cl-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        b2clBody.querySelectorAll(".del-b2cl-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.b2cl.splice(parseInt(b.getAttribute("data-del-b2cl"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render CDNR Table
      const cdnrBody = document.getElementById("jsonCdnrTableBody");
      if (cdnrBody) {
        cdnrBody.innerHTML = jsonState.cdnr.length === 0
          ? `<tr><td colspan="10" class="text-center py-6 text-slate-400">Koi Registered Credit/Debit Note (CDNR) nahi hai.</td></tr>`
          : jsonState.cdnr.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-mono font-bold text-indigo-700">${r.ctin}</td>
              <td class="py-2 px-3 font-bold">${r.ntty === 'C' ? 'Credit Note' : 'Debit Note'}</td>
              <td class="py-2 px-3 font-mono font-bold">${r.nt_num}</td>
              <td class="py-2 px-3 font-mono">${r.nt_dt}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r2(r.camt + r.samt).toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-cdnr="${i}" class="del-cdnr-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        cdnrBody.querySelectorAll(".del-cdnr-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.cdnr.splice(parseInt(b.getAttribute("data-del-cdnr"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render CDNUR Table
      const cdnurBody = document.getElementById("jsonCdnurTableBody");
      if (cdnurBody) {
        cdnurBody.innerHTML = jsonState.cdnur.length === 0
          ? `<tr><td colspan="9" class="text-center py-6 text-slate-400">Koi Unregistered Credit/Debit Note (CDNUR) nahi hai.</td></tr>`
          : jsonState.cdnur.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-mono font-bold text-indigo-700">${r.typ}</td>
              <td class="py-2 px-3 font-bold">${r.ntty === 'C' ? 'Credit' : 'Debit'}</td>
              <td class="py-2 px-3 font-mono font-bold">${r.nt_num}</td>
              <td class="py-2 px-3 font-mono">${r.nt_dt}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-cdnur="${i}" class="del-cdnur-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        cdnurBody.querySelectorAll(".del-cdnur-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.cdnur.splice(parseInt(b.getAttribute("data-del-cdnur"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render AT (11A) Table
      const atBody = document.getElementById("jsonAtTableBody");
      if (atBody) {
        atBody.innerHTML = jsonState.at.length === 0
          ? `<tr><td colspan="8" class="text-center py-6 text-slate-400">Koi Table 11A Advance Received entry nahi hai.</td></tr>`
          : jsonState.at.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-bold">${r.sply_ty}</td>
              <td class="py-2 px-3 font-mono">${r.pos}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.ad_amt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r2(r.camt + r.samt).toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-at="${i}" class="del-at-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        atBody.querySelectorAll(".del-at-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.at.splice(parseInt(b.getAttribute("data-del-at"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render TXPD (11B) Table
      const txpdBody = document.getElementById("jsonTxpdTableBody");
      if (txpdBody) {
        txpdBody.innerHTML = jsonState.txpd.length === 0
          ? `<tr><td colspan="8" class="text-center py-6 text-slate-400">Koi Table 11B Advance Adjustment entry nahi hai.</td></tr>`
          : jsonState.txpd.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-bold">${r.sply_ty}</td>
              <td class="py-2 px-3 font-mono">${r.pos}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.ad_amt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.iamt.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r2(r.camt + r.samt).toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-txpd="${i}" class="del-txpd-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        txpdBody.querySelectorAll(".del-txpd-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.txpd.splice(parseInt(b.getAttribute("data-del-txpd"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render SUPECO / ECO (Table 14 & 15)
      const supecoBody = document.getElementById("jsonSupecoTableBody");
      if (supecoBody) {
        supecoBody.innerHTML = jsonState.supecoRows.length === 0
          ? `<tr><td colspan="8" class="text-center py-6 text-slate-400">Koi Table 14 (SUPECO) ya Table 15 (ECO) entry nahi hai.</td></tr>`
          : jsonState.supecoRows.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-bold text-indigo-700">${r.secType}</td>
              <td class="py-2 px-3 font-mono font-bold">${r.etin}</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.suppval.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.igst.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.cgst.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r.sgst.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-supeco="${i}" class="del-supeco-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        supecoBody.querySelectorAll(".del-supeco-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.supecoRows.splice(parseInt(b.getAttribute("data-del-supeco"), 10), 1);
            renderJsonPage();
          });
        });
      }

      // Render Amendments Table
      const amendBody = document.getElementById("jsonAmendTableBody");
      if (amendBody) {
        amendBody.innerHTML = jsonState.amendRows.length === 0
          ? `<tr><td colspan="8" class="text-center py-6 text-slate-400">Koi Amendment (9A/9C/10/11/14A) entry nahi hai.</td></tr>`
          : jsonState.amendRows.map((r, i) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
              <td class="py-2 px-3 font-bold text-slate-500">${i + 1}</td>
              <td class="py-2 px-3 font-mono font-bold text-amber-900 uppercase">${r.tableKey}</td>
              <td class="py-2 px-3 font-mono">${r.origRef}</td>
              <td class="py-2 px-3 font-mono">${r.revRef}</td>
              <td class="py-2 px-3 text-center font-bold">${r.rt}%</td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-700">₹${r.txval.toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-right font-mono">₹${r2(r.iamt + r.camt + r.samt).toLocaleString("en-IN")}</td>
              <td class="py-2 px-3 text-center"><button type="button" data-del-amend="${i}" class="del-amend-btn text-rose-600 font-bold hover:underline">✕</button></td>
            </tr>
          `).join("");
        amendBody.querySelectorAll(".del-amend-btn").forEach(b => {
          b.addEventListener("click", () => {
          if (!confirmDelete("Ye row delete karni hai?")) return;
            jsonState.amendRows.splice(parseInt(b.getAttribute("data-del-amend"), 10), 1);
            renderJsonPage();
          });
        });
      }

      renderGstrPortalTableGrid();

      const jsonObj = buildGstPortalJsonObject();
      document.getElementById("gstJsonLivePreview").textContent = JSON.stringify(jsonObj, null, 2);
      renderJsonValidationResult(validateGstr1Json(jsonObj), fp);
    }

    function setSelectTableDrawerOpen(open) {
      const drawer = document.getElementById("selectTableDropdownDrawer");
      const label = document.getElementById("toggleSelectTableDrawerLabel");
      const arrow = document.getElementById("toggleSelectTableDrawerArrow");
      if (!drawer) return;
      drawer.classList.toggle("hidden", !open);
      if (label) {
        label.textContent = open
          ? "🔼 Select Table Upar Karein (Hide List)"
          : "📋 Select Table (22 GSTR-1 Tables)";
      }
      if (arrow) {
        arrow.textContent = open ? "▴" : "▾";
      }
    }

    function selectAndOpenGstrTableById(tid, autoCollapse = true) {
      const meta = GSTR1_PORTAL_TABLES.find(x => x.id === tid);
      if (!meta) return;
      jsonState.selectedTables[tid] = true;
      jsonState.activeTableId = tid;
      const sec = meta.sec;
      if (sec === "amend") {
        const amendSel = document.getElementById("amendTableKeySelect");
        if (amendSel && [...amendSel.options].some(o => o.value === tid)) {
          amendSel.value = tid;
        }
      }
      if (tid === "eco") {
        const ecoSel = document.getElementById("ecoSecTypeSelect");
        if (ecoSel) ecoSel.value = "15_ECO";
      } else if (tid === "supeco") {
        const ecoSel = document.getElementById("ecoSecTypeSelect");
        if (ecoSel) ecoSel.value = "14A_TCS";
      }
      if (autoCollapse) setSelectTableDrawerOpen(false);
      switchJsonSectionTab(sec, tid);
      renderJsonPage();
      showToast(`🏛️ Table ${meta.code} (${meta.title}) open ho gayi!`);
    }

    const quickTableDropdownEl = document.getElementById("selectTableQuickDropdown");
    if (quickTableDropdownEl) {
      quickTableDropdownEl.addEventListener("change", e => {
        selectAndOpenGstrTableById(e.target.value, true);
      });
    }

    const toggleDrawerBtn = document.getElementById("toggleSelectTableDrawerBtn");
    if (toggleDrawerBtn) {
      toggleDrawerBtn.addEventListener("click", () => {
        const drawer = document.getElementById("selectTableDropdownDrawer");
        const isCurrentlyHidden = drawer && drawer.classList.contains("hidden");
        setSelectTableDrawerOpen(Boolean(isCurrentlyHidden));
      });
    }

    const collapseTopBtn = document.getElementById("collapseSelectTableDrawerTopBtn");
    if (collapseTopBtn) {
      collapseTopBtn.addEventListener("click", () => {
        setSelectTableDrawerOpen(false);
        showToast("🔼 Table list upar band kar di gayi!");
      });
    }

    const collapseBottomBtn = document.getElementById("collapseSelectTableDrawerBottomBtn");
    if (collapseBottomBtn) {
      collapseBottomBtn.addEventListener("click", () => {
        setSelectTableDrawerOpen(false);
        showToast("🔼 Table list upar band kar di gayi!");
      });
    }

    // Wire GSTR-1 Portal Grid Category & Preset Buttons + New Table Add Buttons
    document.querySelectorAll(".gstr-grid-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        jsonState.gridCategory = btn.getAttribute("data-grid-cat");
        renderGstrPortalTableGrid();
      });
    });

    // =====================================================================
    // SEARCHABLE CLIENT SELECTOR LISTENERS + EDITABLE / CUSTOM QUICK PRESETS
    // =====================================================================
    const searchInpEl = document.getElementById("jsonClientSearchInput");
    const searchClearEl = document.getElementById("jsonClientSearchClearBtn");
    const searchDdEl = document.getElementById("jsonClientSearchDropdown");

    if (searchInpEl) {
      searchInpEl.addEventListener("focus", () => {
        searchInpEl.select();
        // Show full client list if current value is the formatted selected label
        if (searchInpEl.value.startsWith("#")) {
          jsonClientSearchTerm = "";
          populateJsonClientDropdown("");
          const dd = document.getElementById("jsonClientSearchDropdown");
          if (dd) {
            const savedVal = searchInpEl.value;
            searchInpEl.value = "";
            renderJsonClientSearchAutocomplete();
            searchInpEl.value = savedVal;
          }
        } else {
          renderJsonClientSearchAutocomplete();
        }
      });
      searchInpEl.addEventListener("input", () => {
        renderJsonClientSearchAutocomplete();
      });
      searchInpEl.addEventListener("keydown", e => {
        if (e.key === "Escape" && searchDdEl) searchDdEl.classList.add("hidden");
        if (e.key === "Enter") {
          e.preventDefault();
          const matched = getMatchingJsonClients(searchInpEl.value);
          if (matched.length > 0) {
            selectClientInJsonPageBySr(matched[0].sr, true);
          }
        }
      });
    }

    if (searchClearEl) {
      searchClearEl.addEventListener("click", () => {
        if (searchInpEl) searchInpEl.value = "";
        jsonClientSearchTerm = "";
        searchClearEl.classList.add("hidden");
        populateJsonClientDropdown("");
        if (searchDdEl) searchDdEl.classList.add("hidden");
        showToast("🔍 Client search filter saaf ho gaya");
      });
    }

    document.addEventListener("click", e => {
      const wrap = document.getElementById("jsonClientSearchWrapper");
      if (wrap && !wrap.contains(e.target) && searchDdEl) {
        searchDdEl.classList.add("hidden");
      }
    });

    // ---- Custom & Editable Quick Presets Storage & Engine ----
    const QUICK_PRESETS_STORAGE_KEY = "gst_gstr1_quick_presets_v4";

    const DEFAULT_QUICK_PRESETS = [
      {
        id: "etsy_default",
        isBuiltIn: true,
        name: "🛍️ Etsy Exporter Tables",
        color: "amber",
        tables: ["exp", "hsn", "doc_issue", "supeco"]
      },
      {
        id: "regular_default",
        isBuiltIn: true,
        name: "🏢 Regular Business Tables",
        color: "sky",
        tables: ["b2b", "b2cs", "nil", "cdnr", "hsn", "doc_issue"]
      }
    ];

    let quickPresets = [];
    let editingPresetId = "etsy_default"; // id or "NEW"
    let modalCheckedTables = new Set(["exp", "hsn", "doc_issue", "supeco"]);

    function loadQuickPresets() {
      try {
        const raw = localStorage.getItem(QUICK_PRESETS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            quickPresets = parsed;
            renderQuickPresetButtonsBar();
            return;
          }
        }
      } catch (e) {}
      quickPresets = JSON.parse(JSON.stringify(DEFAULT_QUICK_PRESETS));
      saveQuickPresets();
      renderQuickPresetButtonsBar();
    }

    function saveQuickPresets() {
      try {
        localStorage.setItem(QUICK_PRESETS_STORAGE_KEY, JSON.stringify(quickPresets));
      } catch (e) {}
    }

    function formatPresetTablesShort(tableIds) {
      const codes = (tableIds || []).map(tid => {
        const m = GSTR1_PORTAL_TABLES.find(t => t.id === tid);
        return m ? m.code.split(",")[0].trim() : tid.toUpperCase();
      });
      if (codes.length <= 5) return codes.join(", ");
      return codes.slice(0, 4).join(", ") + ` +${codes.length - 4}`;
    }

    function applyQuickPresetById(presetId) {
      const p = quickPresets.find(x => x.id === presetId);
      if (!p) return;
      Object.keys(jsonState.selectedTables).forEach(k => { jsonState.selectedTables[k] = false; });
      (p.tables || []).forEach(tid => {
        if (tid in jsonState.selectedTables) jsonState.selectedTables[tid] = true;
      });
      // Switch active editor tab to the first selected table in this preset
      if (p.tables && p.tables.length > 0) {
        const firstMeta = GSTR1_PORTAL_TABLES.find(t => t.id === p.tables[0]);
        if (firstMeta) {
          jsonState.activeTableId = firstMeta.id;
          switchJsonSectionTab(firstMeta.sec, firstMeta.id);
        }
      }
      renderJsonPage();
      showToast(`⚡ "${p.name}" (${p.tables.length} Tables: ${formatPresetTablesShort(p.tables)}) select ho gayi!`);
    }

    function getColorClasses(color) {
      const map = {
        amber: { btn: "bg-amber-100 hover:bg-amber-200 text-amber-950", edit: "bg-amber-200/80 hover:bg-amber-300 text-amber-950 border-amber-300", wrap: "border-amber-300" },
        sky: { btn: "bg-sky-100 hover:bg-sky-200 text-sky-950", edit: "bg-sky-200/80 hover:bg-sky-300 text-sky-950 border-sky-300", wrap: "border-sky-300" },
        emerald: { btn: "bg-emerald-100 hover:bg-emerald-200 text-emerald-950", edit: "bg-emerald-200/80 hover:bg-emerald-300 text-emerald-950 border-emerald-300", wrap: "border-emerald-300" },
        purple: { btn: "bg-purple-100 hover:bg-purple-200 text-purple-950", edit: "bg-purple-200/80 hover:bg-purple-300 text-purple-950 border-purple-300", wrap: "border-purple-300" },
        rose: { btn: "bg-rose-100 hover:bg-rose-200 text-rose-950", edit: "bg-rose-200/80 hover:bg-rose-300 text-rose-950 border-rose-300", wrap: "border-rose-300" },
        indigo: { btn: "bg-indigo-100 hover:bg-indigo-200 text-indigo-950", edit: "bg-indigo-200/80 hover:bg-indigo-300 text-indigo-950 border-indigo-300", wrap: "border-indigo-300" }
      };
      return map[color] || map.indigo;
    }

    function renderQuickPresetButtonsBar() {
      const etsyP = quickPresets.find(x => x.id === "etsy_default") || DEFAULT_QUICK_PRESETS[0];
      const regP = quickPresets.find(x => x.id === "regular_default") || DEFAULT_QUICK_PRESETS[1];

      const etsyBtn = document.getElementById("presetEtsyTablesBtn");
      if (etsyBtn && etsyP) {
        etsyBtn.textContent = `${etsyP.name} (${formatPresetTablesShort(etsyP.tables)})`;
      }
      const regBtn = document.getElementById("presetRegularTablesBtn");
      if (regBtn && regP) {
        regBtn.textContent = `${regP.name} (${formatPresetTablesShort(regP.tables)})`;
      }

      const customContainer = document.getElementById("customQuickPresetsList");
      if (!customContainer) return;
      const customList = quickPresets.filter(x => !x.isBuiltIn);
      customContainer.innerHTML = customList.map(p => {
        const cls = getColorClasses(p.color);
        return `
          <div class="inline-flex items-center rounded-lg overflow-hidden border ${cls.wrap} shadow-2xs">
            <button type="button" data-apply-qp="${p.id}" class="custom-qp-apply-btn px-2.5 py-1 font-bold ${cls.btn} transition">
              ${p.name} (${formatPresetTablesShort(p.tables)})
            </button>
            <button type="button" data-edit-qp="${p.id}" title="Edit '${p.name}' tables" class="custom-qp-edit-btn px-1.5 py-1 ${cls.edit} border-l font-bold text-[11px] transition">
              ✏️
            </button>
          </div>
        `;
      }).join("");

      customContainer.querySelectorAll(".custom-qp-apply-btn").forEach(b => {
        b.addEventListener("click", () => applyQuickPresetById(b.getAttribute("data-apply-qp")));
      });
      customContainer.querySelectorAll(".custom-qp-edit-btn").forEach(b => {
        b.addEventListener("click", () => openQuickPresetModal(b.getAttribute("data-edit-qp")));
      });
    }

    // Wire built-in preset buttons and their inline edit buttons
    document.getElementById("presetEtsyTablesBtn").addEventListener("click", () => applyQuickPresetById("etsy_default"));
    document.getElementById("presetRegularTablesBtn").addEventListener("click", () => applyQuickPresetById("regular_default"));
    document.getElementById("editPresetEtsyBtn").addEventListener("click", () => openQuickPresetModal("etsy_default"));
    document.getElementById("editPresetRegularBtn").addEventListener("click", () => openQuickPresetModal("regular_default"));

    document.getElementById("createNewQuickPresetFromSelectionBtn").addEventListener("click", () => {
      openQuickPresetModal("NEW");
    });
    document.getElementById("openManageQuickPresetsModalBtn").addEventListener("click", () => {
      openQuickPresetModal("etsy_default");
    });

    function openQuickPresetModal(targetId) {
      editingPresetId = targetId || "NEW";
      if (editingPresetId === "NEW") {
        // Pre-fill from currently selected tables on the page!
        const curSelected = Object.keys(jsonState.selectedTables).filter(k => jsonState.selectedTables[k]);
        modalCheckedTables = new Set(curSelected.length > 0 ? curSelected : ["b2cs", "hsn"]);
        document.getElementById("qpButtonNameInput").value = `⚡ My Custom Tables (${curSelected.length})`;
        document.getElementById("qpButtonColorSelect").value = "emerald";
      } else {
        const p = quickPresets.find(x => x.id === editingPresetId) || quickPresets[0];
        if (p) {
          editingPresetId = p.id;
          modalCheckedTables = new Set(p.tables || []);
          document.getElementById("qpButtonNameInput").value = p.name || "";
          document.getElementById("qpButtonColorSelect").value = p.color || "amber";
        }
      }
      renderQuickPresetModal();
      document.getElementById("quickPresetModalOverlay").classList.remove("hidden");
    }

    function renderQuickPresetModal() {
      const strip = document.getElementById("qpExistingButtonsSelectorStrip");
      if (strip) {
        strip.innerHTML = quickPresets.map(p => {
          const isAct = editingPresetId === p.id;
          return `
            <button type="button" data-modal-pick-qp="${p.id}" class="modal-pick-qp-btn px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isAct ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }">
              ${p.name} (${(p.tables || []).length})
            </button>
          `;
        }).join("") + `
          <button type="button" data-modal-pick-qp="NEW" class="modal-pick-qp-btn px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            editingPresetId === 'NEW' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-xs' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300'
          }">
            ➕ New Custom Quick Button
          </button>
        `;

        strip.querySelectorAll(".modal-pick-qp-btn").forEach(b => {
          b.addEventListener("click", () => {
            openQuickPresetModal(b.getAttribute("data-modal-pick-qp"));
          });
        });
      }

      const delBtn = document.getElementById("qpDeletePresetBtn");
      const currentObj = quickPresets.find(x => x.id === editingPresetId);
      if (delBtn) {
        delBtn.classList.toggle("hidden", !currentObj || !!currentObj.isBuiltIn);
      }

      document.getElementById("qpSelectedTablesCountText").textContent = String(modalCheckedTables.size);

      const grid = document.getElementById("qpTablesChecklistGrid");
      if (grid) {
        grid.innerHTML = GSTR1_PORTAL_TABLES.map(t => {
          const checked = modalCheckedTables.has(t.id);
          return `
            <label class="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition ${
              checked ? 'bg-indigo-50/80 border-indigo-500 font-bold text-indigo-950' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }">
              <input type="checkbox" data-qp-table-chk="${t.id}" ${checked ? 'checked' : ''} class="qp-table-chk mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
              <div class="min-w-0 leading-tight">
                <div class="text-xs font-extrabold">${t.icon} Table ${t.code}</div>
                <div class="text-[11px] text-slate-600 truncate">${t.title}</div>
              </div>
            </label>
          `;
        }).join("");

        grid.querySelectorAll(".qp-table-chk").forEach(chk => {
          chk.addEventListener("change", () => {
            const tid = chk.getAttribute("data-qp-table-chk");
            if (chk.checked) modalCheckedTables.add(tid);
            else modalCheckedTables.delete(tid);
            renderQuickPresetModal();
          });
        });
      }
    }

    document.getElementById("qpStartNewBtn").addEventListener("click", () => openQuickPresetModal("NEW"));
    document.getElementById("qpUsePageSelectionBtn").addEventListener("click", () => {
      const curSelected = Object.keys(jsonState.selectedTables).filter(k => jsonState.selectedTables[k]);
      modalCheckedTables = new Set(curSelected);
      renderQuickPresetModal();
      showToast(`📥 Page par abhi tick ki gayi ${curSelected.length} tables copy ho gayi!`);
    });
    document.getElementById("qpCheckAllBtn").addEventListener("click", () => {
      modalCheckedTables = new Set(GSTR1_PORTAL_TABLES.map(t => t.id));
      renderQuickPresetModal();
    });
    document.getElementById("qpUncheckAllBtn").addEventListener("click", () => {
      modalCheckedTables.clear();
      renderQuickPresetModal();
    });

    function closeQuickPresetModal() {
      document.getElementById("quickPresetModalOverlay").classList.add("hidden");
    }
    document.getElementById("closeQuickPresetModalBtn").addEventListener("click", closeQuickPresetModal);
    document.getElementById("cancelQuickPresetModalBtn").addEventListener("click", closeQuickPresetModal);

    document.getElementById("saveQuickPresetBtn").addEventListener("click", () => {
      const name = (document.getElementById("qpButtonNameInput").value || "").trim();
      const color = document.getElementById("qpButtonColorSelect").value || "indigo";
      const tablesArr = Array.from(modalCheckedTables);

      if (!name) {
        showToast("⚠️ Kripya Quick Button ka naam likhein!");
        return;
      }
      if (tablesArr.length === 0) {
        showToast("⚠️ Kam se kam 1 GSTR-1 table zaroor tick karein!");
        return;
      }

      if (editingPresetId === "NEW") {
        const newId = "custom_" + Date.now();
        quickPresets.push({
          id: newId,
          isBuiltIn: false,
          name: name,
          color: color,
          tables: tablesArr
        });
        saveQuickPresets();
        renderQuickPresetButtonsBar();
        applyQuickPresetById(newId);
        closeQuickPresetModal();
        showToast(`🎉 Naya Quick Button "${name}" ban gaya aur save ho gaya!`);
      } else {
        const target = quickPresets.find(x => x.id === editingPresetId);
        if (target) {
          target.name = name;
          target.color = color;
          target.tables = tablesArr;
          saveQuickPresets();
          renderQuickPresetButtonsBar();
          applyQuickPresetById(target.id);
          closeQuickPresetModal();
          showToast(`✅ Quick Button "${name}" update aur save ho gaya!`);
        }
      }
    });

    document.getElementById("qpDeletePresetBtn").addEventListener("click", () => {
      const idx = quickPresets.findIndex(x => x.id === editingPresetId && !x.isBuiltIn);
      if (idx < 0) return;
      const removedName = quickPresets[idx].name;
      if (!confirmDelete(`Quick Button "${removedName}" delete karna hai?`)) return;
      quickPresets.splice(idx, 1);
      saveQuickPresets();
      renderQuickPresetButtonsBar();
      openQuickPresetModal("etsy_default");
      showToast(`🗑️ Custom Quick Button "${removedName}" hata diya gaya.`);
    });

    document.getElementById("qpResetDefaultsBtn").addEventListener("click", () => {
      if (!confirmDelete("Saare custom Quick Buttons hat kar default wapas aa jayenge.\n\nContinue?")) return;
      quickPresets = JSON.parse(JSON.stringify(DEFAULT_QUICK_PRESETS));
      saveQuickPresets();
      renderQuickPresetButtonsBar();
      openQuickPresetModal("etsy_default");
      showToast("🔄 Default Quick Select Buttons restore ho gaye!");
    });

    document.getElementById("presetSelectAllTablesBtn").addEventListener("click", () => {
      const allSelected = GSTR1_PORTAL_TABLES.every(t => jsonState.selectedTables[t.id]);
      GSTR1_PORTAL_TABLES.forEach(t => { jsonState.selectedTables[t.id] = !allSelected; });
      if (allSelected) {
        // Keep at least b2cs and hsn active so user isn't left with 0
        jsonState.selectedTables.b2cs = true;
        jsonState.selectedTables.hsn = true;
      }
      renderJsonPage();
      showToast(allSelected ? "🎯 Sirf core tables (7, 12) select rakhi gayi" : "☑️ Sabhi 22 GSTR-1 Portal Tables select ho gayi!");
    });

    document.getElementById("presetFilterTabsToggleBtn").addEventListener("click", e => {
      jsonState.filterEditorTabsBySelected = !jsonState.filterEditorTabsBySelected;
      e.currentTarget.textContent = jsonState.filterEditorTabsBySelected
        ? "🎯 Filter Editor Tabs: ON (Show Selected Only)"
        : "🎯 Filter Editor Tabs: OFF (Showing All Tabs)";
      renderJsonPage();
    });

    document.querySelectorAll(".nil-matrix-inp").forEach(inp => {
      inp.addEventListener("input", () => {
        jsonState.selectedTables.nil = true;
        renderJsonPage();
      });
    });

    document.getElementById("addB2clRowBtn").addEventListener("click", () => {
      const pos = document.getElementById("b2clPosSelect").value;
      const inum = (document.getElementById("b2clInumInput").value || `B2CL/${jsonState.b2cl.length + 1}`).trim();
      const idt = (document.getElementById("b2clIdtInput").value || "31-10-2026").trim();
      const rt = parseFloat(document.getElementById("b2clRateSelect").value || "5");
      const txval = parseFloat(document.getElementById("b2clTxvalInput").value || "0");
      if (txval <= 0) { showToast("⚠️ B2CL Taxable Value dalein!"); return; }
      const taxes = computeTaxesForRow("INTER", rt, txval);
      jsonState.selectedTables.b2cl = true;
      jsonState.isNilReturn = false;
      jsonState.b2cl.push({ pos, inum, idt, rt, txval: taxes.txval, iamt: taxes.iamt });
      document.getElementById("b2clTxvalInput").value = "";
      renderJsonPage();
      showToast("💎 Table 5A (B2CL) Invoice add ho gaya!");
    });

    document.getElementById("addCdnrRowBtn").addEventListener("click", () => {
      const ctin = (document.getElementById("cdnrCtinInput").value || "").trim().toUpperCase();
      const ntty = document.getElementById("cdnrNttySelect").value;
      const nt_num = (document.getElementById("cdnrNumInput").value || `CN/${jsonState.cdnr.length + 1}`).trim();
      const nt_dt = (document.getElementById("cdnrDtInput").value || "31-10-2026").trim();
      const rt = parseFloat(document.getElementById("cdnrRateSelect").value || "5");
      const txval = parseFloat(document.getElementById("cdnrTxvalInput").value || "0");
      if (ctin.length !== 15) { showToast("⚠️ Receiver ka 15-digit GSTIN dalein!"); return; }
      if (txval <= 0) { showToast("⚠️ Note Taxable Value dalein!"); return; }
      const supState = (document.getElementById("jsonGstinInput").value || "09").slice(0, 2);
      const recState = ctin.slice(0, 2);
      const taxes = computeTaxesForRow(supState === recState ? "INTRA" : "INTER", rt, txval);
      jsonState.selectedTables.cdnr = true;
      jsonState.isNilReturn = false;
      jsonState.cdnr.push({ ctin, ntty, nt_num, nt_dt, pos: recState, rt, txval: taxes.txval, iamt: taxes.iamt, camt: taxes.camt, samt: taxes.samt });
      document.getElementById("cdnrTxvalInput").value = "";
      renderJsonPage();
      showToast("📝 Table 9B (CDNR) Note add ho gaya!");
    });

    document.getElementById("addCdnurRowBtn").addEventListener("click", () => {
      const typ = document.getElementById("cdnurTypSelect").value;
      const ntty = document.getElementById("cdnurNttySelect").value;
      const nt_num = (document.getElementById("cdnurNumInput").value || `CNU/${jsonState.cdnur.length + 1}`).trim();
      const nt_dt = (document.getElementById("cdnurDtInput").value || "31-10-2026").trim();
      const rt = parseFloat(document.getElementById("cdnurRateSelect").value || "0");
      const txval = parseFloat(document.getElementById("cdnurTxvalInput").value || "0");
      if (txval <= 0) { showToast("⚠️ Note Taxable Value dalein!"); return; }
      const iamt = typ === "EXPWOP" ? 0 : r2(txval * (rt / 100));
      jsonState.selectedTables.cdnur = true;
      jsonState.isNilReturn = false;
      jsonState.cdnur.push({ typ, ntty, nt_num, nt_dt, pos: "96", rt, txval: r2(txval), iamt });
      document.getElementById("cdnurTxvalInput").value = "";
      renderJsonPage();
      showToast("📝 Table 9B (CDNUR) Note add ho gaya!");
    });

    document.getElementById("addAtRowBtn").addEventListener("click", () => {
      const sply_ty = document.getElementById("atSplyTySelect").value;
      const pos = document.getElementById("atPosSelect").value;
      const rt = parseFloat(document.getElementById("atRateSelect").value || "5");
      const ad_amt = parseFloat(document.getElementById("atAdAmtInput").value || "0");
      if (ad_amt <= 0) { showToast("⚠️ Advance Amount dalein!"); return; }
      const taxes = computeTaxesForRow(sply_ty, rt, ad_amt);
      jsonState.selectedTables.at = true;
      jsonState.isNilReturn = false;
      jsonState.at.push({ sply_ty, pos, rt, ad_amt: taxes.txval, iamt: taxes.iamt, camt: taxes.camt, samt: taxes.samt });
      document.getElementById("atAdAmtInput").value = "";
      renderJsonPage();
      showToast("💵 Table 11A (Advance Received) add ho gaya!");
    });

    document.getElementById("addTxpdRowBtn").addEventListener("click", () => {
      const sply_ty = document.getElementById("txpdSplyTySelect").value;
      const pos = document.getElementById("txpdPosSelect").value;
      const rt = parseFloat(document.getElementById("txpdRateSelect").value || "5");
      const ad_amt = parseFloat(document.getElementById("txpdAdAmtInput").value || "0");
      if (ad_amt <= 0) { showToast("⚠️ Advance Adjusted Amount dalein!"); return; }
      const taxes = computeTaxesForRow(sply_ty, rt, ad_amt);
      jsonState.selectedTables.txpd = true;
      jsonState.isNilReturn = false;
      jsonState.txpd.push({ sply_ty, pos, rt, ad_amt: taxes.txval, iamt: taxes.iamt, camt: taxes.camt, samt: taxes.samt });
      document.getElementById("txpdAdAmtInput").value = "";
      renderJsonPage();
      showToast("🔄 Table 11B (Advance Adjustment) add ho gaya!");
    });

    document.getElementById("addEcoSupecoRowBtn").addEventListener("click", () => {
      const secType = document.getElementById("ecoSecTypeSelect").value;
      const etin = (document.getElementById("ecoEtinRowInput").value || getEffectiveTable14Etin(jsonState.gstin)).trim().toUpperCase();
      if (secType === "14A_TCS") {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]C[0-9A-Z]$/.test(etin) || !gstinCheckDigitOk(etin)) { showToast("⚠️ Valid 15-digit Indian TCS GSTIN (14th char C) dalein!"); return; }
      } else if (gstinProblem(etin, "party")) {
        showToast("⚠️ Valid 15-digit E-Com GSTIN dalein!"); return;
      }
      const suppval = parseFloat(document.getElementById("ecoSuppValRowInput").value || "0");
      const igst = parseFloat(document.getElementById("ecoIgstRowInput").value || "0");
      const csTotal = parseFloat(document.getElementById("ecoCgstSgstRowInput").value || "0");
      if (suppval <= 0) { showToast("⚠️ Net Supply Value dalein!"); return; }
      if (secType === "15_ECO") jsonState.selectedTables.eco = true;
      else jsonState.selectedTables.supeco = true;
      jsonState.isNilReturn = false;
      jsonState.supecoRows.push({
        secType,
        etin,
        suppval: r2(suppval),
        igst: r2(igst),
        cgst: r2(csTotal / 2),
        sgst: r2(csTotal / 2)
      });
      document.getElementById("ecoSuppValRowInput").value = "";
      renderJsonPage();
      showToast("🌐 E-Commerce (Table 14/15) entry add ho gayi!");
    });

    document.getElementById("addAmendRowBtn").addEventListener("click", () => {
      const tableKey = document.getElementById("amendTableKeySelect").value;
      const origRef = (document.getElementById("amendOrigRefInput").value || "092026").trim();
      const revRef = (document.getElementById("amendRevRefInput").value || "09").trim();
      const rt = parseFloat(document.getElementById("amendRateSelect").value || "5");
      const txval = parseFloat(document.getElementById("amendTxvalInput").value || "0");
      if (txval <= 0) { showToast("⚠️ Revised Taxable Value dalein!"); return; }
      const taxes = computeTaxesForRow("INTRA", rt, txval);
      jsonState.selectedTables[tableKey] = true;
      jsonState.isNilReturn = false;
      jsonState.amendRows.push({
        tableKey,
        origRef,
        revRef,
        rt,
        txval: taxes.txval,
        iamt: taxes.iamt,
        camt: taxes.camt,
        samt: taxes.samt
      });
      document.getElementById("amendTxvalInput").value = "";
      renderJsonPage();
      showToast(`✏️ Amendment (${tableKey.toUpperCase()}) entry add ho gayi!`);
    });

    // Client Select & Period Change Listeners on JSON Page
    document.getElementById("jsonClientSelect").addEventListener("change", e => {
      const sr = parseInt(e.target.value, 10);
      selectClientInJsonPageBySr(sr, true);
    });

    ["jsonMonthSelect", "jsonYearSelect"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          jsonState.fpMonth = document.getElementById("jsonMonthSelect").value || "09";
          jsonState.fpYear = document.getElementById("jsonYearSelect").value || "2026";
          syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
          renderJsonPage();
        });
      }
    });

    function computeQuickSupecoTaxes(suppVal) {
      const sv = Number(suppVal || 0);
      let baseTx = 0, igst = 0, cgst = 0, sgst = 0;
      if (jsonState.selectedTables.b2cs && (jsonState.b2cs || []).some(r => Number(r.txval || 0) > 0)) {
        jsonState.b2cs.forEach(r => {
          if (Number(r.txval || 0) > 0) {
            baseTx += Number(r.txval || 0);
            igst += Number(r.iamt || 0);
            cgst += Number(r.camt || 0);
            sgst += Number(r.samt || 0);
          }
        });
      }
      if (jsonState.selectedTables.exp && (jsonState.exp || []).some(r => Number(r.txval || 0) > 0)) {
        jsonState.exp.forEach(r => {
          if (Number(r.txval || 0) > 0) {
            baseTx += Number(r.txval || 0);
            igst += Number(r.iamt || 0);
          }
        });
      }
      if (baseTx > 0 && sv > 0 && Math.abs(sv - baseTx) > 0.01) {
        const ratio = sv / baseTx;
        return { igst: r2(igst * ratio), cgst: r2(cgst * ratio), sgst: r2(sgst * ratio) };
      }
      return { igst: r2(igst), cgst: r2(cgst), sgst: r2(sgst) };
    }

    // Keep supecoRows synced when user edits Table 14 quick fields (#includeSupecoCheckbox, #supecoEtinInput, #supecoSuppvalInput)
    ["includeSupecoCheckbox", "supecoEtinInput", "supecoSuppvalInput"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const syncQuickSupeco = () => {
        const inc = document.getElementById("includeSupecoCheckbox") && document.getElementById("includeSupecoCheckbox").checked;
        const etin = ((document.getElementById("supecoEtinInput") && document.getElementById("supecoEtinInput").value) || "").trim().toUpperCase();
        const suppVal = parseFloat((document.getElementById("supecoSuppvalInput") && document.getElementById("supecoSuppvalInput").value) || "0");
        jsonState.selectedTables.supeco = Boolean(inc);
        const otherRows = (jsonState.supecoRows || []).filter(r => r.secType !== "14A_TCS");
        if (inc && suppVal > 0 && etin) {
          const taxes = computeQuickSupecoTaxes(suppVal);
          jsonState.supecoRows = [{
            secType: "14A_TCS",
            etin: etin,
            suppval: r2(suppVal),
            igst: taxes.igst,
            cgst: taxes.cgst,
            sgst: taxes.sgst
          }, ...otherRows];
        } else if (!inc || suppVal <= 0) {
          jsonState.supecoRows = otherRows;
        }
        renderJsonPage();
      };
      el.addEventListener("input", syncQuickSupeco);
      el.addEventListener("change", syncQuickSupeco);
    });

    const saveDefT14Btn = document.getElementById("saveDefaultTable14EtinBtn");
    const defT14Inp = document.getElementById("jsonDefaultTable14EtinInput");
    const clearDefT14Btn = document.getElementById("clearDefaultTable14EtinBtn");
    const pinSupBtn = document.getElementById("pinSupecoEtinAsDefaultBtn");
    const pinEcoBtn = document.getElementById("pinEcoEtinAsDefaultBtn");
    if (saveDefT14Btn && defT14Inp) {
      saveDefT14Btn.addEventListener("click", () => saveDefaultTable14Etin(defT14Inp.value));
      defT14Inp.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); saveDefaultTable14Etin(defT14Inp.value); }
      });
    }
    if (clearDefT14Btn) {
      clearDefT14Btn.addEventListener("click", () => saveDefaultTable14Etin(""));
    }
    if (pinSupBtn) {
      pinSupBtn.addEventListener("click", () => {
        const v = (document.getElementById("supecoEtinInput") && document.getElementById("supecoEtinInput").value) || "";
        saveDefaultTable14Etin(v);
      });
    }
    if (pinEcoBtn) {
      pinEcoBtn.addEventListener("click", () => {
        const v = (document.getElementById("ecoEtinRowInput") && document.getElementById("ecoEtinRowInput").value) || "";
        saveDefaultTable14Etin(v);
      });
    }
    const jsonGstinInpEl = document.getElementById("jsonGstinInput");
    if (jsonGstinInpEl) {
      jsonGstinInpEl.addEventListener("change", () => {
        jsonState.gstin = (jsonGstinInpEl.value || "").trim().toUpperCase();
        ensureValidEtsySupecoEtin(jsonState.gstin);
        renderJsonPage();
      });
    }

    ["jsonGstinInput", "jsonFirmInput", "jsonHsnSchemaSelect",
     "includeDocIssueCheckbox", "docFromInput", "docToInput", "docTotnumInput", "docCancelInput",
     "nilExptAmtInput"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", renderJsonPage);
      if (el) el.addEventListener("change", renderJsonPage);
    });

    document.getElementById("jsonEtsyReportModeSelect").addEventListener("change", () => {
      if (jsonPageOrders && jsonPageOrders.orders && jsonPageOrders.orders.length > 0) {
        applyOrdersToJsonState(jsonPageOrders.orders, jsonPageOrders.rcmBase, null, null);
      } else {
        renderJsonPage();
      }
    });

    // Add Row Handlers (B2CS, EXP, B2B, HSN)
    document.getElementById("addB2csRowBtn").addEventListener("click", () => {
      const splyTy = document.getElementById("b2csSplyTy").value;
      const pos = document.getElementById("b2csPos").value;
      const rt = parseFloat(document.getElementById("b2csRate").value || "5");
      const txval = parseFloat(document.getElementById("b2csTxval").value || "0");
      if (txval <= 0) { showToast("⚠️ Taxable Value 0 se zyada dalein!"); return; }
      const taxes = computeTaxesForRow(splyTy, rt, txval);
      jsonState.b2cs = jsonState.b2cs.filter(r => r.txval > 0);
      const exB2cs = jsonState.b2cs.find(r => r.sply_ty === splyTy && r.pos === pos && Number(r.rt) === rt);
      if (exB2cs) {
        exB2cs.txval = r2(exB2cs.txval + taxes.txval);
        exB2cs.iamt = r2(exB2cs.iamt + taxes.iamt);
        exB2cs.camt = r2(exB2cs.camt + taxes.camt);
        exB2cs.samt = r2(exB2cs.samt + taxes.samt);
      } else {
        jsonState.b2cs.push({
          sply_ty: splyTy,
          pos: pos,
          typ: "OE",
          rt: rt,
          txval: taxes.txval,
          iamt: taxes.iamt,
          camt: taxes.camt,
          samt: taxes.samt,
          csamt: 0
        });
      }
      jsonState.isNilReturn = false;
      document.getElementById("b2csTxval").value = "";
      autoSyncHsnFromTables();
      renderJsonPage();
      showToast("🛒 B2CS entry add ho gayi!");
    });

    // Sync expRateSelect <-> expTypSelect automatically
    const expRateSelEl = document.getElementById("expRateSelect");
    const expTypSelEl = document.getElementById("expTypSelect");
    if (expRateSelEl && expTypSelEl) {
      expRateSelEl.addEventListener("change", () => {
        const rVal = parseFloat(expRateSelEl.value || "0");
        expTypSelEl.value = rVal > 0 ? "WPAY" : "WOPAY";
      });
      expTypSelEl.addEventListener("change", () => {
        if (expTypSelEl.value === "WOPAY") expRateSelEl.value = "0";
        else if (parseFloat(expRateSelEl.value || "0") === 0) expRateSelEl.value = "5";
      });
    }

    function applyBulkRateToExpInvoices(newRate) {
      if (!jsonState.exp || jsonState.exp.length === 0) {
        showToast("⚠️ Abhi Invoice table me koi invoice nahi hai.");
        return;
      }
      const rt = Number(newRate || 0);
      const expTyp = rt > 0 ? "WPAY" : "WOPAY";
      const selClient = clients.find(x => x.sr === Number(jsonState.selectedSr));
      const activeMeta = getJsonSelectedMasterTabMeta();
      const wb = (selClient && typeof getClientWorkbook === "function") ? getClientWorkbook(selClient.sr) : null;
      const tData = (wb && activeMeta && wb.tabs[activeMeta.tab]) ? wb.tabs[activeMeta.tab] : null;

      jsonState.exp.forEach(r => {
        r.rt = rt;
        r.exp_typ = expTyp;
        r.iamt = expTyp === "WPAY" ? r2(Number(r.txval || 0) * (rt / 100)) : 0;
        r.val = r2(Number(r.txval || 0) + r.iamt);
        if (tData && r.inum) {
          tData.invMeta = tData.invMeta || {};
          tData.invMeta[r.inum] = Object.assign(tData.invMeta[r.inum] || { portCode: "", sbNo: "", sbDate: "", csNcs: "NCS" }, { rate: rt });
        }
      });
      if (wb && typeof saveMasterWorkbooks === "function") saveMasterWorkbooks();
      if (activeMeta && typeof triggerMasterAutoSync === "function") triggerMasterAutoSync(activeMeta.tab);
      syncDocsAndSupecoFromExpInvoices();
      autoSyncHsnFromTables();
      renderJsonPage();
      showToast(`⚡ Sabhi ${jsonState.exp.length} Invoices par Tax Rate ${rt}% (${expTyp}) lag gaya aur Master Sheet me sync ho gaya!`);
    }

    [["jsonBulkRate0Btn", 0], ["jsonBulkRate5Btn", 5], ["jsonBulkRate8Btn", 8], ["jsonBulkRate18Btn", 18]].forEach(([btnId, rtVal]) => {
      const b = document.getElementById(btnId);
      if (b) b.addEventListener("click", () => applyBulkRateToExpInvoices(rtVal));
    });

    ["jsonSyncFromMasterSheetBtn", "jsonTopSyncMasterBtn"].forEach(btnId => {
      const b = document.getElementById(btnId);
      if (b) {
        b.addEventListener("click", () => {
          const has = syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
          renderJsonPage();
          showToast(has ? "🔄 Master Sheet ke Top Invoice Working Table (Rows 7–38) se Invoices sync ho gaye!" : "ℹ️ Is mahine me abhi koi billed invoice nahi hai (Master Sheet me Invoice Date dalein ya dusra mahina chunein).");
        });
      }
    });

    const jsonMasterFySelEl = document.getElementById("jsonMasterFySelect");
    if (jsonMasterFySelEl) {
      jsonMasterFySelEl.addEventListener("change", e => {
        masterActiveFy = e.target.value;
        const fyTabs = getActiveFyMonthTabs();
        if (fyTabs.length > 0) {
          if (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog" && !fyTabs.some(t => t.tab === masterActiveTab)) {
            masterActiveTab = fyTabs[0].tab;
          }
          const c = clients.find(x => x.sr === Number(jsonState.selectedSr));
          const wb = c ? getClientWorkbook(c.sr) : null;
          const metrics = wb ? computeFullWorkbookMetrics(wb) : null;
          const fyWithInv = metrics ? fyTabs.filter(t => {
            const mr = (metrics.allSummaryRows || []).find(r => r.tab === t.tab);
            return mr && mr.invoicesCount > 0;
          }) : [];
          const pickTab = fyWithInv.length > 0 ? fyWithInv[fyWithInv.length - 1] : fyTabs[0];
          jsonState.fpMonth = String(pickTab.m).padStart(2, "0");
          jsonState.fpYear = String(pickTab.y);
          if (masterActiveTab !== "Summary" && masterActiveTab !== "_InvoiceLog") {
            masterActiveTab = pickTab.tab;
          }
          const mSel = document.getElementById("jsonMonthSelect");
          const ySel = document.getElementById("jsonYearSelect");
          if (mSel) mSel.value = jsonState.fpMonth;
          if (ySel && [...ySel.options].some(o => o.value === jsonState.fpYear)) ySel.value = jsonState.fpYear;
          syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
          renderJsonPage();
        }
      });
    }

    const jsonOpenMasterBtnEl = document.getElementById("jsonOpenMasterEtsyPageBtn");
    if (jsonOpenMasterBtnEl) {
      jsonOpenMasterBtnEl.addEventListener("click", () => {
        const activeMeta = getJsonSelectedMasterTabMeta();
        if (activeMeta) masterActiveTab = activeMeta.tab;
        openClientInMasterEtsyEditor(jsonState.selectedSr);
      });
    }

    function nextUniqueJsonDocNum(rows, fieldName, defaultPrefix) {
      const used = new Set((rows || []).map(r => String((r && r[fieldName]) || "").trim().toUpperCase()).filter(Boolean));
      let maxNum = 0;
      let detectedPref = defaultPrefix;
      (rows || []).forEach(r => {
        const p = typeof parseInvPrefixSeq === "function" ? parseInvPrefixSeq(r && r[fieldName]) : null;
        if (p && p.seq > maxNum) {
          maxNum = p.seq;
          detectedPref = p.prefix;
        }
      });
      let n = Math.max((rows || []).length + 1, maxNum + 1);
      while (used.has(`${detectedPref}${n}`.toUpperCase()) || used.has(`${detectedPref}${String(n).padStart(3, "0")}`.toUpperCase())) {
        n++;
      }
      return detectedPref.endsWith("/") ? `${detectedPref}${n}` : `${detectedPref}${String(n).padStart(3, "0")}`;
    }

    document.getElementById("addExpRowBtn").addEventListener("click", () => {
      const selClient = clients.find(x => x.sr === Number(jsonState.selectedSr));
      const wb = (selClient && typeof getClientWorkbook === "function") ? getClientWorkbook(selClient.sr) : null;
      const activeMeta = getJsonSelectedMasterTabMeta();
      const pref = (wb && wb.prefix) ? wb.prefix : "AD";
      const nextSeq = (wb && wb.nextSeq) ? wb.nextSeq : (jsonState.exp.length + 1);

      const payDate = (document.getElementById("expPayDateInput") && document.getElementById("expPayDateInput").value || "").trim();
      const rt = parseFloat(document.getElementById("expRateSelect").value || "0");
      const expTyp = rt > 0 ? "WPAY" : (document.getElementById("expTypSelect").value || "WOPAY");
      const rawInum = (document.getElementById("expInumInput").value || "").trim();
      const rawIdt = (document.getElementById("expIdtInput").value || `30-${jsonState.fpMonth}-${jsonState.fpYear}`).trim();
      const idt = toGstPortalDateStr(rawIdt, `30-${jsonState.fpMonth}-${jsonState.fpYear}`);
      const txval = parseFloat(document.getElementById("expTxvalInput").value || "0");
      const hsn = (document.getElementById("expHsnInput") && document.getElementById("expHsnInput").value || "5703").trim();
      const port = (document.getElementById("expPortInput").value || "").trim().toUpperCase();
      const sbnum = (document.getElementById("expSbNumInput") && document.getElementById("expSbNumInput").value || "").trim();
      const sbdt = (document.getElementById("expSbDtInput") && document.getElementById("expSbDtInput").value || "").trim();
      const csNcs = (document.getElementById("expCsNcsSelect") && document.getElementById("expCsNcsSelect").value || "NCS").trim();
      if (txval <= 0) { showToast("⚠️ Invoice Taxable Value (Col D) dalein!"); return; }

      let inum = "";
      if (rawInum) {
        inum = cleanGstDocNum(rawInum, rawInum).toUpperCase();
      } else if (wb) {
        const usedAll = getActiveWorkbookInvSet(wb);
        (jsonState.exp || []).forEach(r => { if (r && r.inum) usedAll.add(String(r.inum).trim().toUpperCase()); });
        let seq = Math.max(1, nextSeq, getHighestWorkbookSeq(wb, pref) + 1);
        while (usedAll.has(`${pref}${String(seq).padStart(3, "0")}`.toUpperCase())) seq++;
        inum = `${pref}${String(seq).padStart(3, "0")}`.toUpperCase();
      } else {
        inum = nextUniqueJsonDocNum(jsonState.exp, "inum", pref).toUpperCase();
      }

      // Prevent duplicate invoice number in JSON table or Master Workbook
      const dupJson = (jsonState.exp || []).some(r => String(r.inum || "").trim().toUpperCase() === inum);
      const dupWb = wb ? getActiveWorkbookInvSet(wb).has(inum) : false;
      if (dupJson || dupWb) {
        const nextSuggested = wb ? `${wb.prefix || "AD"}${String(Math.max(wb.nextSeq || 1, getHighestWorkbookSeq(wb, wb.prefix || "AD") + 1)).padStart(3, "0")}` : "";
        showToast(`⚠️ Invoice ${inum} pehle se maujood hai!${nextSuggested ? " Agla free no. " + nextSuggested + " hai." : ""}`);
        return;
      }

      const iamt = expTyp === "WPAY" ? r2(txval * (rt / 100)) : 0;

      const payDtFormatted = payDate ? toSlashDateStr(payDate) : toSlashDateStr(idt);
      const invDtSlash = toSlashDateStr(idt);
      let srcRowNum = 45 + jsonState.exp.length;

      // Also persist into Master Workbook so Master Sheet & Reload stay 100% in sync!
      if (wb && activeMeta && wb.tabs[activeMeta.tab]) {
        const tData = wb.tabs[activeMeta.tab];
        srcRowNum = 45 + tData.orders.length;
        const genOrderNo = String(Math.floor(4200000000 + Math.random() * 90000000));
        tData.orders.push({
          payDate: payDtFormatted,
          orderNo: genOrderNo,
          gross: r2(txval),
          refund: 0,
          buyerTax: 0,
          taxRefund: 0,
          tcs: 0,
          tds: 0,
          invNo: inum,
          invDate: invDtSlash,
          country: "US",
          hsn: hsn,
          sb: csNcs,
          _addedFromJson: true
        });
        tData.invMeta = tData.invMeta || {};
        tData.invMeta[inum] = {
          rate: rt,
          portCode: port,
          sbNo: sbnum,
          sbDate: toSlashDateStr(sbdt),
          csNcs: csNcs
        };
        syncWorkbookSeqFromManualInv(wb, inum);
        wb.invoiceLog.unshift({
          ts: new Date().toLocaleString("en-IN"),
          tab: activeMeta.tab,
          row: srcRowNum,
          orderNo: genOrderNo,
          invNo: inum,
          invDate: invDtSlash,
          event: "ASSIGNED"
        });
        const expInumEl = document.getElementById("expInumInput");
        if (expInumEl) expInumEl.placeholder = `${wb.prefix || "AD"}${String(wb.nextSeq || 1).padStart(3, "0")}`;
        saveMasterWorkbooks();
        if (typeof triggerMasterAutoSync === "function") triggerMasterAutoSync(activeMeta.tab);
      }

      jsonState.exp.push({
        payDate: payDtFormatted,
        srcTab: activeMeta ? activeMeta.tab : "",
        srcRow: srcRowNum,
        exp_typ: expTyp,
        inum: inum,
        idt: idt,
        val: r2(txval + iamt),
        hsn: hsn,
        sbpcode: port,
        sbnum: sbnum,
        sbdt: sbdt,
        csNcs: csNcs,
        rt: rt,
        txval: r2(txval),
        iamt: iamt
      });
      jsonState.isNilReturn = false;
      document.getElementById("expTxvalInput").value = "";
      document.getElementById("expInumInput").value = "";
      syncDocsAndSupecoFromExpInvoices();
      autoSyncHsnFromTables();
      renderJsonPage();
      showToast(`🧾 Invoice ${inum} Master Sheet Invoice Part & Table 6A dono me add aur sync ho gayi!`);
    });

    document.getElementById("addB2bRowBtn").addEventListener("click", () => {
      const ctin = (document.getElementById("b2bCtinInput").value || "").trim().toUpperCase();
      const rawB2bInum = (document.getElementById("b2bInumInput").value || "").trim();
      const inum = (rawB2bInum || nextUniqueJsonDocNum(jsonState.b2b, "inum", "GST/")).trim();
      const idt = (document.getElementById("b2bIdtInput").value || "31-10-2026").trim();
      const rt = parseFloat(document.getElementById("b2bRateSelect").value || "5");
      const txval = parseFloat(document.getElementById("b2bTxvalInput").value || "0");
      if (ctin.length !== 15) { showToast("⚠️ Receiver ka 15-digit GSTIN dalein!"); return; }
      if (txval <= 0) { showToast("⚠️ Taxable Value dalein!"); return; }
      if (jsonState.b2b.some(r => String(r.inum || "").trim().toUpperCase() === inum.toUpperCase())) {
        showToast(`⚠️ B2B Invoice ${inum} pehle se maujood hai! Alag Invoice No. dalein.`);
        return;
      }
      const supState = (document.getElementById("jsonGstinInput").value || "09").slice(0, 2);
      const recState = ctin.slice(0, 2);
      const splyTy = supState === recState ? "INTRA" : "INTER";
      const taxes = computeTaxesForRow(splyTy, rt, txval);
      jsonState.b2b.push({
        ctin: ctin,
        inum: inum,
        idt: idt,
        pos: recState,
        rt: rt,
        txval: taxes.txval,
        iamt: taxes.iamt,
        camt: taxes.camt,
        samt: taxes.samt
      });
      jsonState.isNilReturn = false;
      document.getElementById("b2bTxvalInput").value = "";
      document.getElementById("b2bInumInput").value = "";
      autoSyncHsnFromTables();
      renderJsonPage();
      showToast("🏢 B2B Invoice add ho gaya!");
    });

    document.getElementById("addHsnRowBtn").addEventListener("click", () => {
      const hsn = (document.getElementById("hsnCodeInput").value || "5703").trim();
      const desc = (document.getElementById("hsnDescInput").value || "CARPETS AND OTHER TEXTILE FLOOR COVERINGS").trim();
      const uqc = document.getElementById("hsnUqcSelect").value || "PCS";
      const qty = parseFloat(document.getElementById("hsnQtyInput").value || "1");
      const modeVal = (document.getElementById("hsnSupplyTaxModeSelect") && document.getElementById("hsnSupplyTaxModeSelect").value) || "B2C_INTRA";
      const supplyType = modeVal.startsWith("B2B") ? "B2B" : "B2C";
      const splyMode = modeVal.endsWith("INTER") ? "INTER" : "INTRA";
      const rt = parseFloat(document.getElementById("hsnRateSelect").value || "5");
      const txval = parseFloat(document.getElementById("hsnTxvalInput").value || "0");
      if (txval <= 0) { showToast("⚠️ HSN Taxable Value dalein!"); return; }
      const taxes = computeTaxesForRow(splyMode, rt, txval);
      jsonState.hsn.push({
        supplyType: supplyType,
        hsn_sc: hsn,
        desc: desc,
        uqc: uqc,
        qty: qty,
        rt: rt,
        txval: taxes.txval,
        iamt: taxes.iamt,
        camt: taxes.camt,
        samt: taxes.samt,
        csamt: 0
      });
      document.getElementById("hsnTxvalInput").value = "";
      renderJsonPage();
      showToast("📦 HSN Summary row add ho gayi!");
    });

    document.getElementById("syncHsnFromTablesBtn").addEventListener("click", () => {
      autoSyncHsnFromTables();
      renderJsonPage();
      showToast("🔄 Active invoices se HSN 5703 summary update ho gayi!");
    });

    document.getElementById("jsonClearAllTablesBtn").addEventListener("click", () => {
      if (!confirmDelete("Saari GSTR-1 tables ka data clear ho jayega.\n\nContinue?")) return;
      resetJsonTablesData();
      renderJsonPage();
      showToast("🗑️ Saari GSTR-1 tables clear ho gayi!");
    });

    document.getElementById("jsonQuickNilBtn").addEventListener("click", () => {
      resetJsonTablesData();
      jsonState.isNilReturn = true;
      renderJsonPage();
      showToast("⭕ Nil GSTR-1 Return JSON taiyar hai! Neeche se Download karein.");
    });

    // Upload Etsy CSV directly on JSON Generator Page -> Also saves & bills in Master Etsy Workbook so Sheet never loses it!
    document.getElementById("jsonPageEtsyCsvInput").addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const parsed = parseEtsyStatement(await etsyFileToRows(file));
        parsed.fileName = file.name;
        if (!parsed.months.length) { showToast("❌ Is file me koi order ya fee nahi mili." + (etsyBadDateNote(parsed) ? " " + etsyBadDateNote(parsed) : "")); return; }
        if (etsyBadDateNote(parsed)) { if (typeof showStickyToast === "function") showStickyToast("⚠️ " + etsyBadDateNote(parsed), 7000); else showToast("⚠️ " + etsyBadDateNote(parsed)); }
        lastEtsyParsed = parsed;
        currentParsedOrders = parsed.flat;
        currentParsedRcmBase = parsed.rcmBase;
        currentParsedRcm = Math.round(Math.max(0, parsed.rcmBase) * 0.18);

        const c = clients.find(x => x.sr === Number(jsonState.selectedSr)) || clients[0];
        const wb = c ? getClientWorkbook(c.sr) : null;
        let targetTab = "Sep26";
        if (wb) {
          const pref = (wb.prefix || "AD").trim().toUpperCase();
          let seq = parseInt(String(wb.nextSeq || 1), 10);
          parsed.months.forEach(m => {
            if (!wb.tabs[m.tab]) return;
            targetTab = m.tab;
            const mObj = ALL_MASTER_MONTH_TABS.find(x => x.tab === m.tab);
            if (mObj) masterActiveFy = mObj.fy;
            const lastDay = mObj ? new Date(mObj.y, mObj.m, 0).getDate() : 30;
            const defaultInvDate = mObj ? `${String(lastDay).padStart(2, "0")}/${String(mObj.m).padStart(2, "0")}/${mObj.y}` : "30/09/2026";
            const existingSet = new Set(wb.tabs[m.tab].orders.map(o => String(o.orderNo)));
            (m.orders || []).forEach(o => {
              if (existingSet.has(String(o.orderNo))) return;
              const p = String(o.iso || "").split("-");
              const dFormatted = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : defaultInvDate;
              const rowNum = 45 + wb.tabs[m.tab].orders.length;
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
                hsn: "5703",
                sb: "NCS"
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
          wb.prefix = pref;
          wb.nextSeq = seq;
          masterActiveTab = targetTab;
          saveMasterWorkbooks();
          if (typeof triggerMasterAutoSync === "function") triggerMasterAutoSync(targetTab);
        }

        const latestM = parsed.months[parsed.months.length - 1];
        const mMeta = ALL_MASTER_MONTH_TABS.find(x => x.tab === latestM.tab);
        if (mMeta) {
          jsonState.fpMonth = String(mMeta.m).padStart(2, "0");
          jsonState.fpYear = String(mMeta.y);
          document.getElementById("jsonMonthSelect").value = jsonState.fpMonth;
          document.getElementById("jsonYearSelect").value = jsonState.fpYear;
        }
        syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
        renderJsonPage();
        showToast(`✅ ${file.name}: ${currentParsedOrders.length} orders Master Sheet (${targetTab}) aur GSTR-1 JSON dono me save ho gaye!`);
      } catch (err) {
        showToast("❌ " + (err && err.message ? err.message : "Etsy CSV parse nahi ho saki."));
      }
    });

    // 1-Click Restore Master Sheet Invoices & Orders from a generated GSTR-1 .JSON file!
    async function restoreMasterSheetFromGstr1JsonFile(file) {
      if (!file) return;
      try {
        const rawText = await file.text();
        const data = JSON.parse(rawText);
        if (!data || typeof data !== "object") {
          showToast("❌ Ye valid GSTR-1 JSON file nahi hai.");
          return;
        }
        // Match client by GSTIN if present
        const fileGstin = String(data.gstin || "").trim().toUpperCase();
        let targetClient = clients.find(x => String(x.gstin || "").trim().toUpperCase() === fileGstin) ||
                           clients.find(x => x.sr === Number(jsonState.selectedSr)) ||
                           clients[0];
        if (targetClient) {
          jsonState.selectedSr = targetClient.sr;
          masterActiveClientSr = targetClient.sr;
          jsonState.gstin = (targetClient.gstin || fileGstin).trim().toUpperCase();
          jsonState.firm = (targetClient.firm || targetClient.client || "").trim();
          const sel = document.getElementById("jsonClientSelect");
          if (sel) sel.value = String(targetClient.sr);
          document.getElementById("jsonGstinInput").value = jsonState.gstin;
          document.getElementById("jsonFirmInput").value = jsonState.firm;
          ensureValidEtsySupecoEtin(jsonState.gstin);
        }

        // Parse return period fp (MMYYYY)
        const fpStr = String(data.fp || "").trim();
        let mNum = parseInt(jsonState.fpMonth || "9", 10);
        let yNum = parseInt(jsonState.fpYear || "2026", 10);
        if (/^\d{6}$/.test(fpStr)) {
          mNum = parseInt(fpStr.slice(0, 2), 10);
          yNum = parseInt(fpStr.slice(2, 6), 10);
          jsonState.fpMonth = String(mNum).padStart(2, "0");
          jsonState.fpYear = String(yNum);
          const mSel = document.getElementById("jsonMonthSelect");
          const ySel = document.getElementById("jsonYearSelect");
          if (mSel) mSel.value = jsonState.fpMonth;
          if (ySel && [...ySel.options].some(o => o.value === jsonState.fpYear)) ySel.value = jsonState.fpYear;
        }

        const targetMeta = ALL_MASTER_MONTH_TABS.find(x => x.m === mNum && x.y === yNum) || getJsonSelectedMasterTabMeta() || getActiveFyMonthTabs()[0];
        const tKey = targetMeta.tab;
        masterActiveFy = targetMeta.fy;
        masterActiveTab = tKey;

        const wb = getClientWorkbook(targetClient.sr);
        const tData = wb.tabs[tKey];
        tData.invMeta = tData.invMeta || {};

        // Extract all invoices from data.exp (Table 6A) or data.b2cs (Table 7)
        const restoredInvoices = [];
        if (Array.isArray(data.exp)) {
          data.exp.forEach(grp => {
            const expTyp = grp.exp_typ || "WOPAY";
            (grp.inv || []).forEach(inv => {
              const itm = (inv.itms && inv.itms[0]) || {};
              const txval = r2(Number(itm.txval !== undefined ? itm.txval : inv.val) || 0);
              const rt = Number(itm.rt !== undefined ? itm.rt : (expTyp === "WPAY" ? 5 : 0));
              const iamt = r2(Number(itm.iamt || 0));
              restoredInvoices.push({
                inum: String(inv.inum || "").trim(),
                idt: toSlashDateStr(inv.idt || `30/${String(mNum).padStart(2, "0")}/${yNum}`),
                txval: txval,
                rt: rt,
                iamt: iamt,
                portCode: String(inv.sbpcode || "").trim(),
                sbNo: String(inv.sbnum || "").trim(),
                sbDate: toSlashDateStr(inv.sbdt || "")
              });
            });
          });
        }
        if (restoredInvoices.length === 0 && Array.isArray(data.b2cs)) {
          data.b2cs.forEach((b, idx) => {
            const txval = r2(Number(b.txval || 0));
            if (txval > 0) {
              restoredInvoices.push({
                inum: `${wb.prefix || "AD"}${String((wb.nextSeq || 1) + idx).padStart(3, "0")}`,
                idt: `30/${String(mNum).padStart(2, "0")}/${yNum}`,
                txval: txval,
                rt: (b.rt !== undefined && b.rt !== "" && !isNaN(Number(b.rt))) ? Number(b.rt) : 5,
                iamt: r2(Number(b.iamt || 0) + Number(b.camt || 0) + Number(b.samt || 0)),
                portCode: "",
                sbNo: "",
                sbDate: ""
              });
            }
          });
        }

        if (restoredInvoices.length === 0) {
          showToast("⚠️ Is JSON file me koi Export (6A) ya B2CS invoice nahi mila.");
          return;
        }

        let matchedCount = 0, addedCount = 0;
        restoredInvoices.forEach((rinv, idx) => {
          const parsedIdt = parseFlexDate(rinv.idt);
          const idtTabMeta = parsedIdt ? ALL_MASTER_MONTH_TABS.find(x => x.m === parsedIdt.m && x.y === parsedIdt.y) : null;
          const metaTabKey = (idtTabMeta && wb.tabs[idtTabMeta.tab]) ? idtTabMeta.tab : tKey;
          wb.tabs[metaTabKey].invMeta = wb.tabs[metaTabKey].invMeta || {};
          wb.tabs[metaTabKey].invMeta[rinv.inum] = {
            rate: rinv.rt,
            portCode: rinv.portCode,
            sbNo: rinv.sbNo,
            sbDate: rinv.sbDate,
            csNcs: "NCS"
          };

          // Search across all tabs for an existing order matching by invNo, or in target tab matching by taxable value
          let foundOrd = null;
          let foundTabKey = tKey;
          let foundRowNum = 45;
          ALL_MASTER_MONTH_TABS.forEach(m => {
            const tabOrders = (wb.tabs[m.tab] && wb.tabs[m.tab].orders) || [];
            tabOrders.forEach((o, oIdx) => {
              if (!foundOrd && String(o.invNo || "").trim().toUpperCase() === rinv.inum.toUpperCase()) {
                foundOrd = o;
                foundTabKey = m.tab;
                foundRowNum = 45 + oIdx;
              }
            });
          });
          if (!foundOrd) {
            // Try matching an unbilled order in tKey or previous months with the exact same taxable value
            ALL_MASTER_MONTH_TABS.forEach(m => {
              const tabOrders = (wb.tabs[m.tab] && wb.tabs[m.tab].orders) || [];
              tabOrders.forEach((o, oIdx) => {
                if (!foundOrd && !o.invDate && Math.abs(calcOrderTaxable(o) - rinv.txval) < 0.05) {
                  foundOrd = o;
                  foundTabKey = m.tab;
                  foundRowNum = 45 + oIdx;
                }
              });
            });
          }

          if (foundOrd) {
            foundOrd.invNo = rinv.inum;
            foundOrd.invDate = rinv.idt;
            foundOrd.hsn = foundOrd.hsn || "5703";
            matchedCount++;
          } else {
            foundRowNum = 45 + tData.orders.length;
            tData.orders.push({
              payDate: rinv.idt,
              orderNo: rinv.inum,
              gross: rinv.txval,
              refund: 0,
              buyerTax: 0,
              taxRefund: 0,
              tcs: 0,
              tds: 0,
              invNo: rinv.inum,
              invDate: rinv.idt,
              country: "US",
              hsn: "5703",
              sb: "NCS",
              _addedFromJson: true
            });
            addedCount++;
          }

          const mSeq = rinv.inum.match(/^([A-Za-z]+)(\d+)$/);
          if (mSeq) {
            wb.prefix = mSeq[1].toUpperCase();
            const seqNum = parseInt(mSeq[2], 10);
            if (seqNum >= (wb.nextSeq || 1)) wb.nextSeq = seqNum + 1;
          }
          if (!wb.invoiceLog.some(l => l.invNo === rinv.inum && l.tab === foundTabKey)) {
            wb.invoiceLog.unshift({
              ts: new Date().toLocaleString("en-IN"),
              tab: foundTabKey,
              row: foundRowNum,
              invNo: rinv.inum,
              invDate: rinv.idt,
              event: "ASSIGNED"
            });
          }
        });

        saveMasterWorkbooks();
        syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
        renderJsonPage();
        renderMasterEtsyPage();
        await pushMasterTabToDrive("Summary", false);
        showToast(`✅ JSON se ${restoredInvoices.length} Invoices (${matchedCount} matched, ${addedCount} recreated) Master Sheet (${tKey}) aur Google Drive me wapas restore ho gaye!`);
      } catch (err) {
        showToast("❌ JSON Restore Error: " + (err && err.message ? err.message : "File padhi nahi ja saki"));
      }
    }

    ["jsonRestoreSheetFromJsonInput", "masterRestoreSheetFromJsonInput"].forEach(inpId => {
      const el = document.getElementById(inpId);
      if (el) {
        el.addEventListener("change", async e => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (f) await restoreMasterSheetFromGstr1JsonFile(f);
        });
      }
    });

    const jsonRestorePushBtn = document.getElementById("jsonRestorePushSheetBtn");
    if (jsonRestorePushBtn) {
      jsonRestorePushBtn.addEventListener("click", async () => {
        const c = clients.find(x => x.sr === Number(jsonState.selectedSr)) || clients[0];
        if (!c) return;
        masterActiveClientSr = c.sr;
        const wb = getClientWorkbook(c.sr);
        reconcileWorkbookWithInvoiceLog(wb, c);
        const activeMeta = getJsonSelectedMasterTabMeta() || getActiveFyMonthTabs()[0];
        const tKey = activeMeta.tab;
        const tData = wb.tabs[tKey];

        // Also ensure any invoices currently in jsonState.exp are present in wb.tabs
        (jsonState.exp || []).forEach(r => {
          if (!r.inum || !(Number(r.txval || 0) > 0)) return;
          const srcKey = r.srcTab && wb.tabs[r.srcTab] ? r.srcTab : tKey;
          const srcOrders = wb.tabs[srcKey].orders;
          let ord = srcOrders.find(o => String(o.invNo || "").toUpperCase() === String(r.inum).toUpperCase());
          if (!ord) {
            ord = srcOrders.find(o => !o.invDate && Math.abs(calcOrderTaxable(o) - Number(r.txval)) < 0.05);
          }
          if (ord) {
            ord.invNo = r.inum;
            ord.invDate = toSlashDateStr(r.idt);
            ord.hsn = r.hsn || "5703";
          } else {
            srcOrders.push({
              payDate: r.payDate || toSlashDateStr(r.idt),
              orderNo: r.inum,
              gross: r2(r.txval),
              refund: 0,
              buyerTax: 0,
              taxRefund: 0,
              tcs: 0,
              tds: 0,
              invNo: r.inum,
              invDate: toSlashDateStr(r.idt),
              country: "US",
              hsn: r.hsn || "5703",
              sb: r.csNcs || "NCS",
              _addedFromJson: true
            });
          }
          const parsedIdt = parseFlexDate(toSlashDateStr(r.idt));
          const idtTabMeta = parsedIdt ? ALL_MASTER_MONTH_TABS.find(x => x.m === parsedIdt.m && x.y === parsedIdt.y) : null;
          const metaTabKey = (idtTabMeta && wb.tabs[idtTabMeta.tab]) ? idtTabMeta.tab : tKey;
          wb.tabs[metaTabKey].invMeta = wb.tabs[metaTabKey].invMeta || {};
          wb.tabs[metaTabKey].invMeta[r.inum] = {
            rate: (r.rt !== undefined && r.rt !== "" && !isNaN(Number(r.rt))) ? Number(r.rt) : 0,
            portCode: r.sbpcode || "",
            sbNo: r.sbnum || "",
            sbDate: toSlashDateStr(r.sbdt || ""),
            csNcs: r.csNcs || "NCS"
          };
        });

        saveMasterWorkbooks();
        syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
        renderJsonPage();
        renderMasterEtsyPage();
        await pushMasterTabToDrive("Summary", false);
      });
    }

    // Load Sample Etsy Orders Button (for quick testing / demo)
    document.getElementById("jsonLoadDemoOrdersBtn").addEventListener("click", () => {
      const sampleOrders = [
        { date: "04/10/2026", orderNo: "3410982311", gross: 18450, refund: 0, buyerTax: 1450, taxRefund: 0, tcs: 85, tds: 17 },
        { date: "12/10/2026", orderNo: "3415628904", gross: 26800, refund: 0, buyerTax: 2100, taxRefund: 0, tcs: 123.5, tds: 24.7 },
        { date: "19/10/2026", orderNo: "3421094432", gross: 31200, refund: 0, buyerTax: 2400, taxRefund: 0, tcs: 144, tds: 28.8 },
        { date: "27/10/2026", orderNo: "3428910045", gross: 15900, refund: 0, buyerTax: 1150, taxRefund: 0, tcs: 73.75, tds: 14.75 }
      ];
      currentParsedOrders = sampleOrders;
      currentParsedRcmBase = 9420;
      currentParsedRcm = Math.round(9420 * 0.18);
      applyOrdersToJsonState(sampleOrders, 9420, 10, 2026);
      showToast("⚡ Sample Etsy Orders (Oct 2026) load ho gaye — GSTR-1 JSON ready hai!");
    });

    // Button inside Order-Wise Etsy Modal to jump straight to JSON Generator
    document.getElementById("sendOrderWiseToJsonBtn").addEventListener("click", () => {
      document.getElementById("orderWiseModalOverlay").classList.add("hidden");
      if (activeEtsyClient) {
        resetJsonDataIfClientChanges(activeEtsyClient.sr);
        jsonState.selectedSr = activeEtsyClient.sr;
        jsonState.gstin = (activeEtsyClient.gstin || "").trim().toUpperCase();
        jsonState.firm = (activeEtsyClient.firm || activeEtsyClient.client || "").trim();
        masterActiveClientSr = activeEtsyClient.sr;
      }
      switchAppPage("json");
      populateJsonClientDropdown();
      if (activeEtsyClient) {
        document.getElementById("jsonClientSelect").value = String(activeEtsyClient.sr);
        const jsInp = document.getElementById("jsonClientSearchInput");
        if (jsInp) jsInp.value = `#${activeEtsyClient.sheetSr} ${activeEtsyClient.client} — ${activeEtsyClient.firm} (${activeEtsyClient.gstin || "No GSTIN"})`;
        document.getElementById("jsonGstinInput").value = jsonState.gstin;
        document.getElementById("jsonFirmInput").value = jsonState.firm;
        ensureValidEtsySupecoEtin(jsonState.gstin);
      }
      let mNum = 10, yNum = 2026;
      if (lastEtsyParsed && lastEtsyParsed.months && lastEtsyParsed.months.length) {
        const latestM = lastEtsyParsed.months[lastEtsyParsed.months.length - 1];
        const idx = ETSY_MON_SHORT.findIndex(x => latestM.tab.startsWith(x));
        if (idx >= 0) mNum = idx + 1;
        yNum = 2000 + parseInt(latestM.tab.slice(-2), 10);
      }
      applyOrdersToJsonState(currentParsedOrders, currentParsedRcmBase, mNum, yNum);
      showToast("🧾 Etsy Statement se GSTR-1 Portal JSON taiyar ho gaya!");
    });

    // Copy & Download JSON Buttons
    document.getElementById("copyGstJsonCodeBtn").addEventListener("click", async () => {
      if (!confirmJsonExportDespiteErrors("copy karein")) return;
      const code = document.getElementById("gstJsonLivePreview").textContent;
      const ok = await copyText(code);
      showToast(ok ? "📋 GSTR-1 JSON clipboard me copy ho gaya!" : "❌ Copy fail hua");
    });

    // JSON download ki jagah: seedha Google Drive ke "json" folder me save (file chooser/download khatam)
    document.getElementById("saveGstr1JsonBtn").addEventListener("click", async () => {
      if (!confirmJsonExportDespiteErrors("save karein")) return;
      const btn = document.getElementById("saveGstr1JsonBtn");
      const oldHtml = btn ? btn.innerHTML : "";
      const jsonObj = buildGstPortalJsonObject();
      const gstin = (jsonObj.gstin || "GSTIN").replace(/[^A-Z0-9]/gi, "");
      const fp = jsonObj.fp || "102026";
      const fileName = `GSTR1_${gstin}_${fp}.json`;
      if (btn) { btn.disabled = true; btn.innerHTML = "<span>⏳ Drive me save ho raha hai…</span>"; }
      try {
        const res = await postVerifiedToAppsScript({ action: "saveGstr1Json", fileName, gstin, fp, jsonText: JSON.stringify(jsonObj, null, 2) });
        if (!res.ok) throw new Error(res.message || "Drive save fail");
        const dd = res.data || {};
        showToast(`☁️ ${dd.name || fileName} Drive ke '${dd.folder || "json"}' folder me save ho gaya! Portal page par select list me aa gaya.`);
        if (typeof gpRefreshSavedJsonList === "function") gpRefreshSavedJsonList(false);
      } catch (e) {
        showToast("❌ Drive save fail: " + (e.message || e) + " — Settings → 📋 Copy Code se naya Apps Script paste karein.");
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
      }
    });

    document.getElementById("jsonOpenPortalLoginBtn").addEventListener("click", () => {
      const sr = parseInt(document.getElementById("jsonClientSelect").value || "1", 10);
      triggerGstLogin(sr);
    });

