    // ===================================================================================
    // Default page: window.DEFAULT_START_PAGE -> ?page= -> #hash -> tracker
    // (pehle har tab ke liye alag 1MB HTML copy thi; ab ek hi file + chhote redirect stubs)
    let currentAppPage = window.DEFAULT_START_PAGE || (function () {
      try {
        const valid = ["tracker", "fees", "json", "master", "portal"];
        const qp = String((new URLSearchParams(location.search || "")).get("page") || "").toLowerCase();
        const hp = String(location.hash || "").replace(/^#\/?/, "").toLowerCase();
        const pick = valid.includes(qp) ? qp : (valid.includes(hp) ? hp : "");
        return pick || "tracker";
      } catch (_) { return "tracker"; }
    })();

    const FEE_RATES_KEY = "gst_tracker_fee_rates_v2";
    const FEE_CUSTOM_MAP_KEY = "gst_tracker_custom_client_fees_v1";
    const FEE_PROFILES_KEY = "gst_tracker_client_fee_profiles_v2";
    const FEE_LEDGER_KEY = "gst_tracker_fee_ledger_v1";

    // 6-Month-Only Nil Package + Active (Sale) Month Fee Structure:
    // - Monthly Nil Fee (₹200) removed; only 6-Month Nil Filing Package (default ₹1,200)
    // - No Active Month + Nil Unpaid (PT expired): PT Date ke hisab se Delay Months show + ONLY 6M Nil Package due
    // - Paying 6M Nil Package advances PT Date by +6M starting from the month right after current PT Date
    // - Active Month + 6M Nil Paid: ₹300 / Active Month | Active Month + Nil Unpaid: ₹500 / Active Month
    let defaultFeeRates = {
      sixMonthPkg: 1200,
      activePaid: 300,
      nilUnpaid: 0,
      etsy: 500,     // Active (Sale) Month when 6M Nil is NOT Paid (₹500)
      regular: 500,
      apne: 0
    };
    let customClientFees = {}; // { [clientKey]: number } optional custom override
    let clientFeeProfiles = {}; // { [clientKey]: { sixMonthPaid: boolean, nilDueMon: number, activeDueMon: number } }
    let feeLedger = [];
    let feeSearchQuery = "";
    let feeStatusFilter = "ALL"; // ALL | DUE_ANY | ACTIVE_SALE | SIX_M_PAID | SIX_M_UNPAID | DUE_RED | DUE_YELLOW | CLEAR
    let feeCategoryFilter = "ALL";
    let feeTypeFilter = "ALL";
    let feeRefFilter = "ALL";
    let feeSortBy = "DUE_DESC";
    let feeLedgerMonthFilter = "ALL";
    let feeActiveMonthsDropdownOpen = true;

    const ACTIVE_MON_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function toIsoInputDate(dateStr) {
      const s = String(dateStr || "").trim();
      if (!s) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const mText = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{2,4})$/);
      if (mText) {
        const mi = ACTIVE_MON_ABBRS.findIndex(x => x.toLowerCase() === mText[2].slice(0, 3).toLowerCase());
        const yr = mText[3].length === 2 ? "20" + mText[3] : mText[3];
        if (mi >= 0) return `${yr}-${String(mi + 1).padStart(2, "0")}-${String(parseInt(mText[1], 10)).padStart(2, "0")}`;
      }
      const mNum = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (mNum) {
        return `${mNum[3]}-${String(parseInt(mNum[2], 10)).padStart(2, "0")}-${String(parseInt(mNum[1], 10)).padStart(2, "0")}`;
      }
      return "";
    }

    function isoToDisplayDate(str) {
      const iso = toIsoInputDate(str);
      if (!iso) return String(str || "").trim();
      const [y, m, d] = iso.split("-");
      const mi = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
      return `${d}-${ACTIVE_MON_ABBRS[mi]}-${y}`;
    }

    function getMonthBucketFromDate(str) {
      const iso = toIsoInputDate(str);
      if (!iso) return { key: "UNKNOWN", label: "Other Dates" };
      const [y, m] = iso.split("-");
      const mi = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
      return { key: `${y}-${m}`, label: `${ACTIVE_MON_ABBRS[mi]} ${y}` };
    }

    function sortSaleTabNames(arr) {
      const orderMap = {};
      if (typeof ALL_MASTER_MONTH_TABS !== "undefined" && Array.isArray(ALL_MASTER_MONTH_TABS)) {
        ALL_MASTER_MONTH_TABS.forEach((m, idx) => { orderMap[m.tab] = idx; });
      }
      return arr.slice().sort((a, b) => {
        const ia = orderMap[a] !== undefined ? orderMap[a] : 999;
        const ib = orderMap[b] !== undefined ? orderMap[b] : 999;
        if (ia !== ib) return ia - ib;
        return String(a).localeCompare(String(b));
      });
    }

    function getDetectedSaleMonthsForClient(c) {
      if (!c) return [];
      const set = new Set();
      try {
        const ck = getClientKey(c);
        const wbObj = (typeof masterWorkbooks === "object" && masterWorkbooks)
          ? (masterWorkbooks[ck] || masterWorkbooks[c.sr])
          : null;
        if (wbObj && wbObj.tabs) {
          const tabs = wbObj.tabs;
          Object.keys(tabs).forEach(tKey => {
            const tObj = tabs[tKey];
            if (tObj && Array.isArray(tObj.orders) && tObj.orders.length > 0) {
              const hasPositiveSale = tObj.orders.some(o => (Number(o.gross) || 0) > 0);
              if (hasPositiveSale) set.add(tKey);
            }
          });
        } else if (String(c.client || "").toUpperCase().includes("BUSARA")) {
          set.add("Jul26"); set.add("Aug26"); set.add("Sep26");
        }
        const prof = clientFeeProfiles[ck];
        if (prof) {
          if (Array.isArray(prof.manualActiveMonths)) {
            prof.manualActiveMonths.forEach(m => { if (m) set.add(String(m).trim()); });
          }
          if (prof.activeMonthPayments && typeof prof.activeMonthPayments === "object") {
            Object.keys(prof.activeMonthPayments).forEach(m => { if (m) set.add(String(m).trim()); });
          }
        }
      } catch (e) {}
      if (set.size === 0 && c.activeM && String(c.activeM).trim()) {
        const raw = String(c.activeM).trim();
        if (isNaN(Number(raw))) {
          raw.split(/[,;/\s]+/).filter(Boolean).forEach(x => set.add(x));
        }
      }
      return sortSaleTabNames(Array.from(set));
    }

    function parsePtDateObjStrict(ptStr) {
      const s = String(ptStr || "").trim();
      if (!s || s === "-" || s.toLowerCase() === "closed" || s.toLowerCase() === "n/a") return null;
      const mText = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{2,4})$/);
      if (mText) {
        const monIdx = ACTIVE_MON_ABBRS.findIndex(x => x.toLowerCase() === mText[2].slice(0, 3).toLowerCase());
        const yr = mText[3].length === 2 ? 2000 + parseInt(mText[3], 10) : parseInt(mText[3], 10);
        if (monIdx >= 0) return { d: parseInt(mText[1], 10), m: monIdx, y: yr };
      }
      const mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (mIso) {
        return { d: parseInt(mIso[3], 10), m: parseInt(mIso[2], 10) - 1, y: parseInt(mIso[1], 10) };
      }
      const mNum = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (mNum) {
        return { d: parseInt(mNum[1], 10), m: parseInt(mNum[2], 10) - 1, y: parseInt(mNum[3], 10) };
      }
      return null;
    }

    function getDelayMonthsFromPtDate(ptStr, refDate = new Date()) {
      const p = parsePtDateObjStrict(ptStr);
      if (!p) return null;
      return Math.max(0, (refDate.getFullYear() * 12 + refDate.getMonth()) - (p.y * 12 + p.m));
    }

    function getMonthTabTotalMonths(tabName) {
      const s = String(tabName || "").trim();
      const m = s.match(/^([A-Za-z]{3})(\d{2,4})$/);
      if (!m) return null;
      const mi = ACTIVE_MON_ABBRS.findIndex(x => x.toLowerCase() === m[1].toLowerCase());
      if (mi < 0) return null;
      const yr = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
      return yr * 12 + mi;
    }

    function isMonthTabAfterPtDate(tabName, ptStr) {
      const tIdx = getMonthTabTotalMonths(tabName);
      const p = parsePtDateObjStrict(ptStr);
      if (tIdx === null || !p) return false;
      return tIdx > (p.y * 12 + p.m);
    }

    function isApneFreeClient(c) {
      return Boolean(c && c.category === "Apne" && Number(defaultFeeRates.apne || 0) === 0);
    }

    function normalizeApneFreeClients() {
      clients.forEach(c => {
        if (!isApneFreeClient(c)) return;
        c.ptDate = "FREE";
        c.dueMon = 0;
        const ck = getClientKey(c);
        if (clientFeeProfiles[ck]) {
          clientFeeProfiles[ck].sixMonthPaid = true;
          clientFeeProfiles[ck].nilDueMon = 0;
        }
      });
    }

    function ensureClientFeeProfile(c) {
      if (!c) return { sixMonthPaid: true, nilDueMon: 0, activeDueMon: 0, activePaidMon: 0, activeMonthPayments: {}, manualActiveMonths: [], saleMonths: [] };
      const ck = getClientKey(c);
      if (!clientFeeProfiles[ck] && clientFeeProfiles[c.sr]) {
        clientFeeProfiles[ck] = clientFeeProfiles[c.sr];
        delete clientFeeProfiles[c.sr];
      }
      const ptDelay = getDelayMonthsFromPtDate(c.ptDate);
      const dm = ptDelay !== null ? ptDelay : Math.max(0, Number(c.dueMon || 0));
      if (!clientFeeProfiles[ck]) {
        const isPaid6M = dm === 0;
        const detectedEarly = getDetectedSaleMonthsForClient(c);
        let initActive = 0;
        if (c.activeM && !isNaN(Number(c.activeM)) && Number(c.activeM) > 0) {
          initActive = Math.max(0, parseInt(c.activeM, 10));
        } else if (detectedEarly.length > 0) {
          initActive = detectedEarly.length;
        } else if (Number(c.rov || 0) > 0) {
          initActive = 1;
        }
        clientFeeProfiles[ck] = {
          sixMonthPaid: isPaid6M,
          nilDueMon: isPaid6M ? 0 : Math.max(1, dm),
          activeDueMon: initActive,
          activePaidMon: 0,
          activeMonthPayments: {},
          manualActiveMonths: []
        };
      }
      const prof = clientFeeProfiles[ck];
      if (!prof.activeMonthPayments || typeof prof.activeMonthPayments !== "object") prof.activeMonthPayments = {};
      if (!Array.isArray(prof.manualActiveMonths)) prof.manualActiveMonths = [];

      if (isApneFreeClient(c)) {
        prof.sixMonthPaid = true;
        prof.nilDueMon = 0;
        c.dueMon = 0;
        c.ptDate = "FREE";
        return prof;
      }

      // Keep delay & 6M Nil Paid status synced with live PT Date unless explicitly toggled for this exact PT Date
      if (ptDelay !== null) {
        const hasManualToggleForCurPt = Boolean(prof.manualSixMonthForPt && prof.manualSixMonthForPt === String(c.ptDate || "").trim());
        if (ptDelay === 0) {
          if (!hasManualToggleForCurPt) {
            prof.sixMonthPaid = true;
            prof.nilDueMon = 0;
          } else if (!prof.sixMonthPaid) {
            prof.nilDueMon = Math.max(1, Number(prof.nilDueMon || 1));
          }
        } else {
          prof.nilDueMon = ptDelay;
          if (!hasManualToggleForCurPt) {
            prof.sixMonthPaid = false;
          }
        }
      } else {
        prof.nilDueMon = prof.sixMonthPaid ? 0 : Math.max(1, Number(prof.nilDueMon || dm || 1));
      }

      const detectedSales = getDetectedSaleMonthsForClient(c);
      prof.saleMonths = detectedSales;
      if (detectedSales.length > 0) {
        let paidCnt = 0;
        let unpaidCnt = 0;
        detectedSales.forEach(m => {
          const entry = prof.activeMonthPayments[m];
          if (entry && String(entry.date || "").trim()) paidCnt++;
          else unpaidCnt++;
        });
        prof.activePaidMon = paidCnt;
        prof.activeDueMon = unpaidCnt;
      } else {
        prof.activePaidMon = Math.max(0, Number(prof.activePaidMon || 0));
        prof.activeDueMon = Math.max(0, Number(prof.activeDueMon || 0));
      }
      return prof;
    }

    function setClientActiveMonthPayment(c, monTab, rawDate, rawAmt, modeStr) {
      if (!c || !monTab) return;
      const ck = getClientKey(c);
      const prof = ensureClientFeeProfile(c);
      const iso = toIsoInputDate(rawDate);
      const defaultRate = prof.sixMonthPaid
        ? Math.max(0, Number(defaultFeeRates.activePaid ?? 300))
        : Math.max(0, Number(defaultFeeRates.etsy ?? 500));
      const amt = (rawAmt !== undefined && rawAmt !== null && rawAmt !== "" && !isNaN(Number(rawAmt)))
        ? Math.max(0, Number(rawAmt))
        : defaultRate;
      const payMode = modeStr || (document.getElementById("feeFormModeSelect") && document.getElementById("feeFormModeSelect").value) || "UPI / GPay / PhonePe";

      if (iso) {
        const prevEntry = prof.activeMonthPayments[monTab];
        let ptAdvFrom = (prevEntry && prevEntry.ptAdvancedFrom) ? prevEntry.ptAdvancedFrom : "";
        if (!ptAdvFrom && !prof.sixMonthPaid && isMonthTabAfterPtDate(monTab, c.ptDate)) {
          ptAdvFrom = String(c.ptDate || "").trim();
          c.ptDate = addMonthsToPtDate(ptAdvFrom, 1);
          delete prof.manualSixMonthForPt;
        }
        prof.activeMonthPayments[monTab] = ptAdvFrom
          ? { date: iso, amount: amt, ptAdvancedFrom: ptAdvFrom }
          : { date: iso, amount: amt };
      } else {
        const oldEntry = prof.activeMonthPayments[monTab];
        if (oldEntry && oldEntry.ptAdvancedFrom && String(c.ptDate || "").trim() === addMonthsToPtDate(oldEntry.ptAdvancedFrom, 1)) {
          c.ptDate = oldEntry.ptAdvancedFrom;
          delete prof.manualSixMonthForPt;
        }
        delete prof.activeMonthPayments[monTab];
      }

      if (typeof prof.saleMonths === "object" && !prof.saleMonths.includes(monTab) && iso) {
        if (!prof.manualActiveMonths.includes(monTab)) prof.manualActiveMonths.push(monTab);
      }

      // Sync matching deterministic ledger entry for this client + active month
      const existingIdx = feeLedger.findIndex(it => it.clientKey === ck && String(it.saleMonthTag || "") === monTab);
      if (iso) {
        const dispDate = isoToDisplayDate(iso);
        const remark = `Active Sale Month (${monTab})`;
        if (existingIdx >= 0) {
          feeLedger[existingIdx].date = dispDate;
          feeLedger[existingIdx].amount = amt;
          feeLedger[existingIdx].mode = payMode;
          feeLedger[existingIdx].newPtDate = c.ptDate || "-";
          feeLedger[existingIdx].remarks = remark;
          feeLedger[existingIdx].activeMonthsPaid = 1;
        } else {
          feeLedger.unshift({
            receiptNo: nextReceiptNo(),
            clientKey: ck,
            gstin: c.gstin || "",
            sr: c.sr,
            client: c.client,
            firm: c.firm,
            months: 1,
            activeMonthsPaid: 1,
            saleMonthTag: monTab,
            amount: amt,
            mode: payMode,
            newPtDate: c.ptDate || "-",
            date: dispDate,
            remarks: remark
          });
        }
      } else if (existingIdx >= 0) {
        const removed = feeLedger.splice(existingIdx, 1)[0];
        if (removed && removed.receiptNo) addDeletedReceiptId(removed.receiptNo);
      }

      ensureClientFeeProfile(c);
      syncClientDueMonFromProfile(c);
      saveFeeState();
      saveClients();
    }

    function applyFeeRateInputsToUi() {
      const pkgInp = document.getElementById("default6mPkgFeeInput");
      const actPaidInp = document.getElementById("defaultActivePaidFeeInput");
      const etsyInp = document.getElementById("defaultEtsyFeeInput");
      const regInp = document.getElementById("defaultRegFeeInput");
      const apneInp = document.getElementById("defaultApneFeeInput");
      if (pkgInp) pkgInp.value = defaultFeeRates.sixMonthPkg;
      if (actPaidInp) actPaidInp.value = defaultFeeRates.activePaid;
      if (etsyInp) etsyInp.value = defaultFeeRates.etsy;
      if (regInp) regInp.value = defaultFeeRates.regular;
      if (apneInp) apneInp.value = defaultFeeRates.apne;

      const bPaid = document.getElementById("feeBannerPaidActiveRate");
      const bPkg = document.getElementById("feeBannerPkgRate");
      const bUnp = document.getElementById("feeBannerUnpaidActiveRate");
      const legend = document.getElementById("feeDirFormulaLegend");
      if (bPaid) bPaid.textContent = `₹${defaultFeeRates.activePaid} / Mon`;
      if (bPkg) bPkg.textContent = `6M Nil Pkg (₹${Number(defaultFeeRates.sixMonthPkg || 1200).toLocaleString("en-IN")})`;
      if (bUnp) bUnp.textContent = `₹${defaultFeeRates.etsy} / Mon`;
      if (legend) {
        legend.innerHTML = `<b>🟢 6M Paid:</b> Nil = ₹0, Active = <b>₹${defaultFeeRates.activePaid}/M</b> &nbsp;|&nbsp; <b>🔴 6M Unpaid (PT Delay):</b> Active na ho to <b>6M Nil Pkg (₹${Number(defaultFeeRates.sixMonthPkg || 1200).toLocaleString("en-IN")})</b>, Active ho to <b>₹${defaultFeeRates.etsy}/M</b>`;
      }
    }

    function loadFeeState() {
      try {
        const r = localStorage.getItem(FEE_RATES_KEY);
        if (r) {
          const parsed = JSON.parse(r);
          if (parsed && typeof parsed === "object") {
            defaultFeeRates = {
              sixMonthPkg: Number(parsed.sixMonthPkg ?? 1200),
              activePaid: Number(parsed.activePaid ?? 300),
              nilUnpaid: 0,
              etsy: Number(parsed.etsy ?? 500),
              regular: Number(parsed.regular ?? 500),
              apne: Number(parsed.apne ?? 0)
            };
          }
        }
      } catch (e) {}
      try {
        const cm = localStorage.getItem(FEE_CUSTOM_MAP_KEY);
        if (cm) customClientFees = JSON.parse(cm) || {};
      } catch (e) {}
      try {
        const fp = localStorage.getItem(FEE_PROFILES_KEY);
        if (fp) clientFeeProfiles = JSON.parse(fp) || {};
      } catch (e) {}
      try {
        const lg = localStorage.getItem(FEE_LEDGER_KEY);
        if (lg) feeLedger = JSON.parse(lg) || [];
      } catch (e) {}

      applyFeeRateInputsToUi();
    }

    function saveFeeState() {
      safeStorageSet(FEE_RATES_KEY, JSON.stringify(defaultFeeRates));
      safeStorageSet(FEE_CUSTOM_MAP_KEY, JSON.stringify(customClientFees));
      safeStorageSet(FEE_PROFILES_KEY, JSON.stringify(clientFeeProfiles));
      safeStorageSet(FEE_LEDGER_KEY, JSON.stringify(feeLedger));
    }

    // 6-Month-Only Nil Package + Active (Sale) Month Breakdown:
    // - 6M Nil Paid (PT valid): Nil = ₹0, Active = ₹300/mo
    // - 6M Nil Unpaid (PT delay) & NO Active Month: ONLY 6M Nil Package (₹1,200 / configured rate) due; delayMon shown from PT Date
    // - 6M Nil Unpaid (PT delay) & HAS Active Month(s): Active = ₹500/mo (no extra monthly Nil fee)
    function getClientFeeBreakdown(c) {
      if (!c) {
        return {
          sixMonthPaid: true,
          nilDueMon: 0,
          delayMon: 0,
          activeDueMon: 0,
          activePaidMon: 0,
          nilRate: 0,
          pkgRate: 1200,
          activeRate: 300,
          nilFee: 0,
          activeFee: 0,
          totalPending: 0,
          totalDueMonths: 0,
          saleMonths: [],
          formulaShort: "₹0"
        };
      }
      const prof = ensureClientFeeProfile(c);
      const pkgRate = Math.max(0, Number(defaultFeeRates.sixMonthPkg ?? 1200));
      if (isApneFreeClient(c)) {
        return {
          isFreeApne: true,
          sixMonthPaid: true,
          nilDueMon: 0,
          delayMon: 0,
          activeDueMon: 0,
          activePaidMon: 0,
          nilRate: 0,
          pkgRate: 0,
          activeRate: 0,
          nilFee: 0,
          activeFee: 0,
          totalPending: 0,
          totalDueMonths: 0,
          saleMonths: prof.saleMonths || [],
          formulaShort: "🆓 Free Account (No Fee)"
        };
      }

      const sixMonthPaid = Boolean(prof.sixMonthPaid);
      const delayMon = sixMonthPaid ? 0 : Math.max(1, Number(prof.nilDueMon || getDelayMonthsFromPtDate(c.ptDate) || 1));
      const nilDueMon = delayMon;
      const activeDueMon = Math.max(0, Number(prof.activeDueMon || 0));
      const activePaidMon = Math.max(0, Number(prof.activePaidMon || 0));

      const activeRate = sixMonthPaid
        ? Math.max(0, Number(defaultFeeRates.activePaid ?? 300))
        : Math.max(0, Number(defaultFeeRates.etsy ?? 500));

      let nilFee = 0;
      let activeFee = 0;
      let totalPending = 0;
      let totalDueMonths = 0;
      let formulaShort = "🟢 Clear (₹0)";

      if (sixMonthPaid) {
        activeFee = activeDueMon * activeRate;
        totalPending = activeFee;
        totalDueMonths = activeDueMon;
        formulaShort = activeDueMon > 0
          ? `${activeDueMon} Sale × ₹${activeRate} = ₹${totalPending.toLocaleString("en-IN")}`
          : "6M Nil Paid (₹0 Due)";
      } else if (activeDueMon > 0) {
        activeFee = activeDueMon * activeRate;
        totalPending = activeFee;
        totalDueMonths = activeDueMon;
        formulaShort = `${activeDueMon} Active (Nil Unpaid) × ₹${activeRate} = ₹${totalPending.toLocaleString("en-IN")}`;
      } else {
        nilFee = pkgRate;
        totalPending = pkgRate;
        totalDueMonths = delayMon;
        formulaShort = `6M Nil Pkg (${delayMon}M Delay) = ₹${pkgRate.toLocaleString("en-IN")}`;
      }

      return {
        sixMonthPaid,
        nilDueMon,
        delayMon,
        activeDueMon,
        activePaidMon,
        nilRate: nilFee,
        pkgRate,
        activeRate,
        nilFee,
        activeFee,
        totalPending,
        totalDueMonths,
        saleMonths: prof.saleMonths || [],
        formulaShort
      };
    }

    function getClientMonthlyFee(c) {
      if (!c) return 0;
      const fb = getClientFeeBreakdown(c);
      return fb.sixMonthPaid ? fb.activeRate : (fb.activeDueMon > 0 ? fb.activeRate : fb.pkgRate);
    }

    function getClientPendingFee(c) {
      return getClientFeeBreakdown(c).totalPending;
    }

    function syncClientDueMonFromProfile(c) {
      if (!c) return;
      if (isApneFreeClient(c)) {
        c.ptDate = "FREE";
        c.dueMon = 0;
        c.activeM = "";
        return;
      }
      const prof = ensureClientFeeProfile(c);
      const ptDelay = getDelayMonthsFromPtDate(c.ptDate);
      c.dueMon = prof.sixMonthPaid ? 0 : Math.max(0, ptDelay !== null ? ptDelay : Number(prof.nilDueMon || 0));
      c.activeM = prof.activeDueMon > 0 ? String(prof.activeDueMon) : "";
    }

    function switchAppPage(pageName) {
      if (!["tracker", "fees", "json", "master", "portal"].includes(pageName)) pageName = "tracker";
      // Android back/swipe ke liye page history
      if (!window.__gpBackNav && currentAppPage && currentAppPage !== pageName) {
        window.__gpPageStack = window.__gpPageStack || [];
        window.__gpPageStack.push(currentAppPage);
        if (window.__gpPageStack.length > 20) window.__gpPageStack.shift();
      }
      window.__gpBackNav = false;
      currentAppPage = pageName;
      // URL me page yaad rakho -> refresh/share karne par wahi tab khule
      try { if (history.replaceState && location.hash !== "#" + pageName) history.replaceState(null, "", location.pathname + location.search + "#" + pageName); } catch (_) {}
      const pTracker = document.getElementById("pageTrackerMain");
      const pFees = document.getElementById("pageFeeMain");
      const pJson = document.getElementById("pageJsonMain");
      const pMaster = document.getElementById("pageMasterMain");
      const pPortal = document.getElementById("pagePortalMain");

      if (pTracker) pTracker.classList.toggle("hidden", pageName !== "tracker");
      if (pFees) pFees.classList.toggle("hidden", pageName !== "fees");
      if (pJson) pJson.classList.toggle("hidden", pageName !== "json");
      if (pMaster) pMaster.classList.toggle("hidden", pageName !== "master");
      if (pPortal) pPortal.classList.toggle("hidden", pageName !== "portal");

      document.querySelectorAll(".app-page-tab-btn").forEach(btn => {
        const active = btn.getAttribute("data-app-page") === pageName;
        btn.className = "app-page-tab-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition " +
          (active
            ? "bg-slate-900 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/70");
      });

      if (pageName === "fees") renderFeePage();
      if (pageName === "json") renderJsonPage();
      if (pageName === "master") {
        renderMasterEtsyPage();
        maybeAutoPullMasterForClient(masterActiveClientSr);
      }
      if (pageName === "portal" && typeof renderPortalPage === "function") {
        renderPortalPage();
      }
    }

    document.querySelectorAll(".app-page-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        switchAppPage(btn.getAttribute("data-app-page"));
      });
    });

    // Helper: advance PT Date string (e.g. "30-Oct-2026") by N months
    const PT_MON_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function parsePtDateObj(ptStr) {
      const strict = typeof parsePtDateObjStrict === "function" ? parsePtDateObjStrict(ptStr) : null;
      if (strict) return strict;
      const m = String(ptStr || "").trim().match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})$/);
      if (m) {
        const monIdx = PT_MON_NAMES.findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase());
        if (monIdx >= 0) return { d: parseInt(m[1], 10), m: monIdx, y: parseInt(m[3], 10) };
      }
      const nowD = new Date();
      return { d: 30, m: nowD.getMonth(), y: nowD.getFullYear() };
    }

    function addMonthsToPtDate(ptStr, monthsToAdd) {
      const parsed = parsePtDateObj(ptStr);
      const totalM = parsed.y * 12 + parsed.m + Number(monthsToAdd || 0);
      const newY = Math.floor(totalM / 12);
      const newM = ((totalM % 12) + 12) % 12;
      const lastDayOfNewMonth = new Date(newY, newM + 1, 0).getDate();
      const day = newM === 1 ? lastDayOfNewMonth : Math.min(30, lastDayOfNewMonth);
      return `${String(day).padStart(2, "0")}-${PT_MON_NAMES[newM]}-${newY}`;
    }

    // =====================================================================
    // PAGE 2 LOGIC: FEE MANAGEMENT & TRACKER (6M NIL + ACTIVE SALE STRUCTURE)
    // =====================================================================
    function getFilteredFeeClients() {
      const activeList = clients.filter(c => !isInactive(c));
      const q = feeSearchQuery.trim().toLowerCase();

      const filtered = activeList.filter(c => {
        if (feeCategoryFilter !== "ALL" && c.category !== feeCategoryFilter) return false;
        if (feeTypeFilter !== "ALL" && c.clientType !== feeTypeFilter) return false;
        if (!matchesRefGroup(c.reference, feeRefFilter)) return false;

        const fb = getClientFeeBreakdown(c);
        if (feeStatusFilter === "DUE_ANY" && fb.totalPending <= 0) return false;
        if (feeStatusFilter === "ACTIVE_SALE" && fb.activeDueMon < 1) return false;
        if (feeStatusFilter === "SIX_M_PAID" && (fb.isFreeApne || !fb.sixMonthPaid)) return false;
        if (feeStatusFilter === "SIX_M_UNPAID" && (fb.isFreeApne || fb.sixMonthPaid)) return false;
        if (feeStatusFilter === "DUE_RED" && !(fb.delayMon > 1 || fb.totalDueMonths > 1)) return false;
        if (feeStatusFilter === "DUE_YELLOW" && !(fb.totalPending > 0 && fb.delayMon <= 1 && fb.totalDueMonths <= 1)) return false;
        if (feeStatusFilter === "CLEAR" && (fb.isFreeApne || fb.totalPending !== 0)) return false;
        if (feeStatusFilter === "FREE_APNE" && !fb.isFreeApne) return false;

        if (!q) return true;
        return (
          (c.client || "").toLowerCase().includes(q) ||
          (c.firm || "").toLowerCase().includes(q) ||
          (c.gstin || "").toLowerCase().includes(q) ||
          (c.reference || "").toLowerCase().includes(q) ||
          (c.mobile || "").toLowerCase().includes(q) ||
          (c.ptDate || "").toLowerCase().includes(q) ||
          (fb.saleMonths.join(" ").toLowerCase().includes(q))
        );
      });

      filtered.sort((a, b) => {
        if (feeSortBy === "DUE_DESC") {
          const diff = getClientPendingFee(b) - getClientPendingFee(a);
          if (diff !== 0) return diff;
          return getClientFeeBreakdown(b).totalDueMonths - getClientFeeBreakdown(a).totalDueMonths;
        }
        if (feeSortBy === "MON_DESC") {
          const diff = getClientFeeBreakdown(b).totalDueMonths - getClientFeeBreakdown(a).totalDueMonths;
          if (diff !== 0) return diff;
          return getClientPendingFee(b) - getClientPendingFee(a);
        }
        if (feeSortBy === "NAME_ASC") {
          return String(a.client || "").localeCompare(String(b.client || ""));
        }
        return (Number(a.sr) || 0) - (Number(b.sr) || 0);
      });

      return filtered;
    }

    function renderFeePage() {
      const autoSyncBtnEl = document.getElementById("autoSyncDueFromPtDateBtn");
      if (autoSyncBtnEl) {
        autoSyncBtnEl.textContent = `🔄 Recalculate Due Months from PT Date (${getCurrentMonYearLabel()})`;
      }
      const activeList = clients.filter(c => !isInactive(c));
      let sixMonthPaidCount = 0;
      let activeSaleDueCount = 0;
      let activeSaleDueAmt = 0;
      let totalPendingAmt = 0;
      let totalDueClients = 0;
      let totalDueMonths = 0;
      let unpaidPkgAmt = 0;
      let unpaidPkgClients = 0;
      let clearClients = 0;
      let freeApneCount = 0;

      activeList.forEach(c => {
        const fb = getClientFeeBreakdown(c);
        if (fb.isFreeApne) {
          freeApneCount++;
          return;
        }
        if (fb.sixMonthPaid) {
          sixMonthPaidCount++;
        } else {
          unpaidPkgClients++;
          unpaidPkgAmt += fb.totalPending;
        }
        if (fb.activeDueMon > 0) {
          activeSaleDueCount++;
          activeSaleDueAmt += fb.activeFee;
        }
        if (fb.totalPending > 0) {
          totalPendingAmt += fb.totalPending;
          totalDueClients++;
          totalDueMonths += fb.totalDueMonths;
        } else {
          clearClients++;
        }
      });

      let totalCollected = 0;
      const monthlyNetMap = {};
      feeLedger.forEach(item => {
        const amt = Number(item.amount || 0);
        totalCollected += amt;
        const b = getMonthBucketFromDate(item.date);
        if (!monthlyNetMap[b.key]) monthlyNetMap[b.key] = { key: b.key, label: b.label, total: 0, count: 0 };
        monthlyNetMap[b.key].total += amt;
        monthlyNetMap[b.key].count += 1;
      });
      const monthBuckets = Object.values(monthlyNetMap).sort((a, b) => b.key.localeCompare(a.key));
      if (feeLedgerMonthFilter !== "ALL" && !monthlyNetMap[feeLedgerMonthFilter]) {
        feeLedgerMonthFilter = "ALL";
      }
      const selBucket = feeLedgerMonthFilter === "ALL" ? null : monthlyNetMap[feeLedgerMonthFilter];
      const shownNetAmt = selBucket ? selBucket.total : totalCollected;
      const shownNetCnt = selBucket ? selBucket.count : feeLedger.length;
      const curMonBucket = getMonthBucketFromDate(formatDdmmyyyyMon(new Date()));
      const curMonSum = monthlyNetMap[curMonBucket.key] ? monthlyNetMap[curMonBucket.key].total : 0;

      document.getElementById("feeKpiMonthlyTotal").textContent = `${sixMonthPaidCount} Paid`;
      document.getElementById("feeKpiMonthlySub").textContent = `6M Nil Paid (${activeSaleDueCount} Sale Mon @ ₹${defaultFeeRates.activePaid}) →`;

      document.getElementById("feeKpiPendingTotal").textContent = `₹${totalPendingAmt.toLocaleString("en-IN")}`;
      document.getElementById("feeKpiPendingSub").textContent = `${totalDueClients} Clients (${totalDueMonths} Mon Pending) →`;

      document.getElementById("feeKpiRedTotal").textContent = `₹${unpaidPkgAmt.toLocaleString("en-IN")}`;
      document.getElementById("feeKpiRedSub").textContent = `${unpaidPkgClients} Clients (6M Pkg ₹${Number(defaultFeeRates.sixMonthPkg || 1200).toLocaleString("en-IN")} / Active ₹${defaultFeeRates.etsy}) →`;

      document.getElementById("feeKpiClearCount").textContent = `${clearClients} Clients`;
      const kpiClearSub = document.getElementById("feeKpiClearSub");
      if (kpiClearSub) kpiClearSub.textContent = freeApneCount > 0 ? `Paid Clear (+ ${freeApneCount} Free Apne) →` : "Time par fee paid hai →";
      const kpiColTitle = document.getElementById("feeKpiCollectedTitle");
      if (kpiColTitle) kpiColTitle.textContent = selBucket ? `Net Collection (${selBucket.label})` : `Net Collection (All)`;
      document.getElementById("feeKpiCollectedTotal").textContent = `₹${shownNetAmt.toLocaleString("en-IN")}`;
      document.getElementById("feeKpiCollectedSub").textContent = `${shownNetCnt} Receipts • ${curMonBucket.label}: ₹${curMonSum.toLocaleString("en-IN")} ↓`;

      const monthSelEl = document.getElementById("feeNetCollectionMonthSelect");
      if (monthSelEl) {
        monthSelEl.innerHTML = `<option value="ALL">📅 All Months Net Collection (₹${totalCollected.toLocaleString("en-IN")})</option>` +
          monthBuckets.map(b => `<option value="${b.key}">${b.label} — ₹${b.total.toLocaleString("en-IN")} (${b.count})</option>`).join("");
        monthSelEl.value = feeLedgerMonthFilter;
      }

      const pillsWrap = document.getElementById("feeMonthNetCollectionPills");
      if (pillsWrap) {
        pillsWrap.innerHTML = `<span class="font-extrabold text-emerald-950">💰 Net Collection:</span>` +
          `<button type="button" data-net-month="ALL" class="fee-net-month-pill px-2.5 py-1 rounded-lg font-bold transition ${feeLedgerMonthFilter === 'ALL' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}">All: ₹${totalCollected.toLocaleString('en-IN')} (${feeLedger.length})</button>` +
          monthBuckets.map(b => `<button type="button" data-net-month="${b.key}" class="fee-net-month-pill px-2.5 py-1 rounded-lg font-bold transition ${feeLedgerMonthFilter === b.key ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100'}">${b.label}: ₹${b.total.toLocaleString('en-IN')} (${b.count})</button>`).join("");
        pillsWrap.querySelectorAll(".fee-net-month-pill").forEach(btn => {
          btn.addEventListener("click", () => {
            feeLedgerMonthFilter = btn.getAttribute("data-net-month") || "ALL";
            renderFeePage();
          });
        });
      }

      // Update status filter pills visual state
      document.querySelectorAll(".fee-status-filter-btn").forEach(b => {
        const st = b.getAttribute("data-fee-status");
        const active = st === feeStatusFilter;
        if (active) {
          b.className = "fee-status-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white ring-2 ring-indigo-300 transition";
        } else {
          b.className = "fee-status-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition";
        }
      });

      // Render Fee Table Rows
      const filtered = getFilteredFeeClients();
      document.getElementById("feeVisibleClientCount").textContent = String(filtered.length);
      let visibleDueSum = 0;
      filtered.forEach(c => { visibleDueSum += getClientPendingFee(c); });
      document.getElementById("feeVisibleDueSum").textContent = `₹${visibleDueSum.toLocaleString("en-IN")}`;

      const tbody = document.getElementById("feeTableBody");
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400">Is filter me koi client nahi mila.</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map(c => {
          const fb = getClientFeeBreakdown(c);
          const catBadge = c.category === "PAID CLINTS"
            ? `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">#${c.sheetSr}</span>`
            : `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">#${c.sheetSr} Apne</span>`;

          const pkgCellHtml = fb.isFreeApne
            ? `<div class="flex flex-col items-center gap-1">
                 <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">🆓 Free Account</span>
                 <span class="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">PT: FREE</span>
               </div>`
            : `<div class="flex flex-col items-center gap-1">
                 ${fb.sixMonthPaid
                   ? `<button type="button" data-toggle-6m-sr="${c.sr}" title="Click to toggle 6-Month Nil Package Paid / Unpaid" class="toggle-6m-pkg-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition">🟢 6M Nil Paid</button>`
                   : `<button type="button" data-toggle-6m-sr="${c.sr}" title="Click to toggle 6-Month Nil Package Paid / Unpaid" class="toggle-6m-pkg-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 transition">🔴 6M Not Paid</button>`}
                 <span class="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${fb.sixMonthPaid ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-900 border border-amber-200'}">PT: ${c.ptDate || "-"}</span>
               </div>`;

          const nilColumnHtml = fb.isFreeApne
            ? `<div class="flex flex-col items-center gap-0.5">
                 <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">✓ Free Filing</span>
                 <span class="text-[10px] text-emerald-700 font-semibold">No Nil Charge</span>
               </div>`
            : (fb.sixMonthPaid
                ? `<div class="flex flex-col items-center gap-0.5">
                     <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">✓ Covered in 6M</span>
                     <span class="text-[10px] text-slate-400 font-mono">Nil Fee = ₹0</span>
                   </div>`
                : (fb.activeDueMon > 0
                    ? `<div class="flex flex-col items-center gap-1">
                         <span class="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-800">${fb.delayMon} Mon Delay</span>
                         <span class="text-[10px] font-mono font-bold text-amber-800">Active @ ₹${fb.activeRate}/M</span>
                       </div>`
                    : `<div class="flex flex-col items-center gap-1">
                         <span class="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-800">${fb.delayMon} Mon Delay</span>
                         <span class="text-[10px] font-mono font-bold text-rose-700">6M Nil Pkg = ₹${fb.nilFee.toLocaleString("en-IN")}</span>
                       </div>`));

          const profRow = ensureClientFeeProfile(c);
          const actPayMap = profRow.activeMonthPayments || {};
          const saleStatusPills = fb.saleMonths.length > 0
            ? `<div class="flex flex-wrap items-center justify-center gap-1">` +
              fb.saleMonths.map(m => {
                const paidDt = actPayMap[m] && actPayMap[m].date ? isoToDisplayDate(actPayMap[m].date) : "";
                return paidDt
                  ? `<span title="Paid on ${paidDt}" class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">${m} ✓</span>`
                  : `<span title="Date pending (Due)" class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">${m} ⏳</span>`;
              }).join("") + `</div>`
            : (Number(c.rov || 0) > 0 ? `<div class="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">ROV: ₹${Number(c.rov).toLocaleString("en-IN")}</div>` : "");

          const activeColumnHtml = fb.isFreeApne
            ? `<div class="flex flex-col items-center gap-0.5">
                 <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">✓ Free Account</span>
                 <span class="text-[10px] text-slate-500">Sale / Nil = ₹0</span>
               </div>`
            : `
            <div class="flex flex-col items-center gap-1">
              <span class="px-2.5 py-0.5 rounded text-[11px] font-extrabold ${fb.activeDueMon > 0 ? 'bg-amber-400 text-slate-950 shadow-2xs' : 'bg-emerald-100 text-emerald-800'}">${fb.activeDueMon} Active</span>
              <span class="text-[10px] font-mono font-bold ${fb.sixMonthPaid ? 'text-emerald-800' : 'text-amber-900'}">
                @ ₹${fb.activeRate}/M (${fb.sixMonthPaid ? '6M Paid' : 'Unpaid'}) = ₹${fb.activeFee.toLocaleString("en-IN")}
              </span>
              ${saleStatusPills}
            </div>
          `;

          const pendingCellHtml = fb.isFreeApne
            ? `<div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-black">FREE (₹0)</div>
               <div class="text-[10px] font-semibold text-emerald-700 mt-0.5">No Fee (Apne)</div>`
            : `<div class="font-mono text-sm font-black ${fb.totalPending > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                 ₹${fb.totalPending.toLocaleString("en-IN")}
               </div>
               <div class="text-[10px] font-mono font-semibold text-slate-500 mt-0.5">
                 ${fb.formulaShort}
               </div>`;

          const actionsCellHtml = fb.isFreeApne
            ? `<div class="flex items-center justify-center gap-1.5 flex-wrap">
                 <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                   🆓 Free Account
                 </span>
                 <button type="button" data-feewa-sr="${c.sr}" title="WhatsApp par GST Return Filing Status bhejein (No Fee)" class="fee-wa-remind-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                   ${WA_ICON_SVG}
                 </button>
               </div>`
            : `<div class="flex items-center justify-center gap-1.5 flex-wrap">
                 <button type="button" data-openpay-sr="${c.sr}" class="open-fee-pay-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition">
                   💵 Pay
                 </button>
                 <button type="button" data-feewa-sr="${c.sr}" title="Send Detailed Fee Structure Reminder on WhatsApp" class="fee-wa-remind-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                   ${WA_ICON_SVG}
                 </button>
               </div>`;

          return `
            <tr class="hover:bg-slate-50/90 transition border-b border-slate-100">
              <td class="py-2.5 px-2.5 align-middle">${catBadge}</td>
              <td class="py-2.5 px-3 align-middle">
                <div class="font-bold text-slate-900 text-xs">${c.client}</div>
                <div class="text-[11px] text-indigo-700 font-semibold">${c.firm || "-"}</div>
                <div class="text-[10px] font-mono text-slate-400">${c.gstin || "-"}</div>
              </td>
              <td class="py-2.5 px-2.5 align-middle">
                <div class="text-xs font-medium text-slate-700">${c.reference || "-"}</div>
                <div class="text-[11px] text-slate-500">📞 ${c.mobile || "-"}</div>
              </td>
              <td class="py-2.5 px-2.5 align-middle text-center bg-indigo-50/20">
                ${pkgCellHtml}
              </td>
              <td class="py-2.5 px-2.5 align-middle text-center">
                ${nilColumnHtml}
              </td>
              <td class="py-2.5 px-2.5 align-middle text-center bg-amber-50/20">
                ${activeColumnHtml}
              </td>
              <td class="py-2.5 px-3 align-middle text-right">
                ${pendingCellHtml}
              </td>
              <td class="py-2.5 px-2.5 align-middle text-center bg-emerald-50/30 border-l border-emerald-100">
                ${actionsCellHtml}
              </td>
            </tr>
          `;
        }).join("");
      }

      // Wire listeners for 6M Package Status Toggle
      tbody.querySelectorAll(".toggle-6m-pkg-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const sr = parseInt(btn.getAttribute("data-toggle-6m-sr"), 10);
          const c = clients.find(x => x.sr === sr);
          if (!c) return;
          const prof = ensureClientFeeProfile(c);
          prof.sixMonthPaid = !prof.sixMonthPaid;
          prof.manualSixMonthForPt = String(c.ptDate || "").trim();
          const ptDelay = getDelayMonthsFromPtDate(c.ptDate);
          if (!prof.sixMonthPaid) {
            prof.nilDueMon = Math.max(1, ptDelay !== null ? ptDelay : Number(c.dueMon || 1));
          } else {
            prof.nilDueMon = 0;
          }
          syncClientDueMonFromProfile(c);
          saveFeeState();
          saveClients();
          renderFeePage();
          renderApp();
          const [cRes, fRes] = await Promise.all([
            pushClientToSheet("update", c, { silent: true }),
            pushFeeDataToSheet({ silent: true })
          ]);
          const baseMsg = prof.sixMonthPaid
            ? `🟢 ${c.client}: 6-Month Nil Package PAID (Nil = ₹0, Sale = ₹${defaultFeeRates.activePaid})`
            : `🔴 ${c.client}: 6-Month Nil UNPAID (Active na ho to 6M Pkg ₹${defaultFeeRates.sixMonthPkg}, Active ho to ₹${defaultFeeRates.etsy})`;
          if (cRes.ok && fRes.ok) {
            showToast(baseMsg + " — Sheet Synced!");
          } else {
            showToast(`⚠️ ${baseMsg}, par Sheet Sync FAIL (${(cRes.ok ? fRes.message : cRes.message) || "error"})!`);
          }
        });
      });

      tbody.querySelectorAll(".open-fee-pay-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openFeePaymentModal(parseInt(btn.getAttribute("data-openpay-sr"), 10));
        });
      });

      tbody.querySelectorAll(".fee-wa-remind-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          sendDetailedFeeWaReminder(parseInt(btn.getAttribute("data-feewa-sr"), 10));
        });
      });

      renderFeeLedgerTable();
    }

    function renderFeeLedgerTable() {
      const visibleEntries = feeLedger
        .map((item, idx) => ({ item, idx }))
        .filter(pair => feeLedgerMonthFilter === "ALL" || getMonthBucketFromDate(pair.item.date).key === feeLedgerMonthFilter);
      const badge = document.getElementById("feeLedgerCountBadge");
      if (badge) badge.textContent = `${visibleEntries.length} Receipts`;
      const tbody = document.getElementById("feeLedgerTableBody");
      if (!tbody) return;
      if (visibleEntries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">Is month me koi fee payment record nahi hai. Kisi client ke samne <b>💵 Pay</b> dabaa kar Active Month date ya fee jama karein.</td></tr>`;
        return;
      }
      tbody.innerHTML = visibleEntries.map(({ item, idx }) => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="py-2 px-3 font-mono font-bold text-indigo-700">${item.receiptNo}</td>
          <td class="py-2 px-3 text-slate-700">${item.date}</td>
          <td class="py-2 px-3">
            <div class="font-bold text-slate-900">${item.client}${item.saleMonthTag ? ` <span class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono">${item.saleMonthTag}</span>` : ""}</div>
            <div class="text-[10px] text-slate-500">${item.firm || "-"}</div>
          </td>
          <td class="py-2 px-3 text-center font-bold">${item.months} Mon</td>
          <td class="py-2 px-3 text-right font-mono font-black text-emerald-700">₹${Number(item.amount || 0).toLocaleString("en-IN")}</td>
          <td class="py-2 px-3 text-center">
            <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">${item.mode}</span>
          </td>
          <td class="py-2 px-3 text-center font-mono font-bold text-indigo-900">${item.newPtDate}</td>
          <td class="py-2 px-3 text-slate-600">${item.remarks || "-"}</td>
          <td class="py-2 px-3 text-center">
            <div class="inline-flex items-center gap-1">
              <button type="button" data-ledger-pdf="${idx}" title="Branded receipt PDF / WhatsApp" class="ledger-pdf-btn px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-bold">🧾 PDF / WA</button><button type="button" data-ledger-wa="${idx}" title="WhatsApp Receipt Confirmation" class="ledger-wa-btn px-2 py-1 rounded bg-[#25D366] text-white text-[11px] font-bold">💬 WA Receipt</button>
              <button type="button" data-ledger-del="${idx}" title="Delete Entry" class="ledger-del-btn px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold">🗑️</button>
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll(".ledger-pdf-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const item = feeLedger[parseInt(btn.getAttribute("data-ledger-pdf"), 10)];
          if (!item) return;
          const c = findClientByReceipt(item);
          const safe = String(item.client || "Client").replace(/[^a-z0-9_-]+/gi, "_");
          const blob = buildFeeReceiptPdf(item);
          openPdfActionSheet({ blob, fileName: `Fee_Receipt_${safe}_${item.receiptNo || ""}.pdf`, mobile: c ? c.mobile : "", clientName: item.client || "Client", contextLabel: `${item.client || "Client"} • Fee Receipt ${item.receiptNo || ""}`, whatsappMessage: `Namaste ${item.client || ""} ji, ${JNA_BRAND.name} ki taraf se aapki fee payment receipt PDF bhej rahe hain. Dhanyavaad.` });
        });
      });
      tbody.querySelectorAll(".ledger-wa-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const item = feeLedger[parseInt(btn.getAttribute("data-ledger-wa"), 10)];
          if (!item) return;
          const c = findClientByReceipt(item);
          const raw = String((c && c.mobile) || "").replace(/\D/g, "");
          if (!raw || raw.length < 10) { showToast("Client ka mobile number valid nahi hai!"); return; }
          const ph = raw.length === 10 ? "91" + raw : raw;
          const msg = `नमस्ते ${item.client} जी (${item.firm || ""}) 🙏\n\n✅ आपकी GST कंसल्टेंसी फ़ीस *₹${Number(item.amount).toLocaleString("en-IN")}* (${item.remarks || item.months + " Month"}, Mode: ${item.mode}) प्राप्त हो गई है।\n🧾 रसीद नं: ${item.receiptNo}\n📅 आपकी अपडेटेड Paid Till (PT Date): *${item.newPtDate}*\n\nधन्यवाद 🙏\n- Tax Consultancy`;
          window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank", "noopener,noreferrer");
        });
      });

      tbody.querySelectorAll(".ledger-del-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const idx = parseInt(btn.getAttribute("data-ledger-del"), 10);
          const toDel = feeLedger[idx];
          if (!toDel) return;
          if (!confirmDelete(`Receipt ${toDel.receiptNo || ""} (${toDel.client || ""}, ₹${Number(toDel.amount || 0).toLocaleString("en-IN")}) delete karni hai?\n\nYe Google Sheet se bhi hat jayegi.`)) return;
          const removed = feeLedger.splice(idx, 1)[0];
          if (removed && removed.receiptNo) addDeletedReceiptId(removed.receiptNo);
          if (removed && (removed.saleMonthTag || Number(removed.activeMonthsPaid) > 0)) {
            const c = findClientByReceipt(removed);
            if (c) {
              const prof = ensureClientFeeProfile(c);
              if (removed.saleMonthTag && prof.activeMonthPayments && prof.activeMonthPayments[removed.saleMonthTag]) {
                const oldE = prof.activeMonthPayments[removed.saleMonthTag];
                if (oldE && oldE.ptAdvancedFrom && String(c.ptDate || "").trim() === addMonthsToPtDate(oldE.ptAdvancedFrom, 1)) {
                  c.ptDate = oldE.ptAdvancedFrom;
                  delete prof.manualSixMonthForPt;
                }
                delete prof.activeMonthPayments[removed.saleMonthTag];
                ensureClientFeeProfile(c);
              } else {
                const revA = Number(removed.activeMonthsPaid) || 0;
                prof.activePaidMon = Math.max(0, Number(prof.activePaidMon || 0) - revA);
                if (Array.isArray(prof.saleMonths) && prof.saleMonths.length > 0) {
                  prof.activeDueMon = Math.max(0, prof.saleMonths.length - prof.activePaidMon);
                } else {
                  prof.activeDueMon = Math.max(0, Number(prof.activeDueMon || 0) + revA);
                }
              }
              syncClientDueMonFromProfile(c);
              saveClients();
              pushClientToSheet("update", c, { silent: true });
            }
          }
          saveFeeState();
          renderFeePage();
          renderApp();
          const fRes = await pushFeeDataToSheet({ silent: true });
          if (fRes.ok && fRes.feeSaved) {
            showToast("🗑️ Receipt ledger & Google Sheet se hata di gayi.");
          } else if (fRes.ok) {
            showToast("🗑️ Browser ledger se hatai gayi (Sheet sync ke liye AppSync_Fixed.txt deploy karein).");
          } else {
            showToast(`⚠️ Browser se hatai gayi, par Sheet Sync FAIL (${fRes.message})!`);
          }
        });
      });
    }

    function refreshFeeModalPlanSelectOptions(c, fb, forceDefaultPlan = false) {
      const planSel = document.getElementById("feeFormPlanTypeSelect");
      if (!planSel) return "PKG_6M_NIL";
      const hasActive = fb.activeDueMon > 0;
      const pkgRate = Number(defaultFeeRates.sixMonthPkg || 1200);
      const actPaidRate = Number(defaultFeeRates.activePaid || 300);
      const actUnpaidRate = Number(defaultFeeRates.etsy || 500);

      const optAuto = planSel.querySelector('option[value="AUTO_PENDING"]');
      const optPkg = planSel.querySelector('option[value="PKG_6M_NIL"]');
      const opt300 = planSel.querySelector('option[value="ACTIVE_300"]');
      const opt500 = planSel.querySelector('option[value="ACTIVE_500"]');

      if (optPkg) optPkg.textContent = `📦 6-Month Nil Filing Package (₹${pkgRate.toLocaleString("en-IN")} — PT Date ke agle mahine se 6M)`;
      if (opt300) opt300.textContent = `🟢 Active (Sale) Month Fee — 6M Nil Paid (@ ₹${actPaidRate} / Active Mon)`;
      if (opt500) opt500.textContent = `🔥 Active (Sale) Month Fee — 6M Nil Unpaid (@ ₹${actUnpaidRate} / Active Mon)`;

      if (!fb.sixMonthPaid && !hasActive) {
        // No Active Month + Nil Unpaid => ONLY 6-Month Nil Package option is available
        if (optAuto) optAuto.disabled = true;
        if (opt300) opt300.disabled = true;
        if (opt500) opt500.disabled = true;
        if (optPkg) optPkg.disabled = false;
        planSel.value = "PKG_6M_NIL";
      } else if (!fb.sixMonthPaid && hasActive) {
        // Active Month + Nil Unpaid => ₹500/Active Mon default (or optional 6M Package)
        if (optAuto) {
          optAuto.disabled = false;
          optAuto.textContent = `🧾 Pay Current Pending Fee (${fb.activeDueMon} Active × ₹${actUnpaidRate} = ₹${fb.totalPending})`;
        }
        if (opt300) opt300.disabled = true;
        if (opt500) opt500.disabled = false;
        if (optPkg) optPkg.disabled = false;
        if (forceDefaultPlan || planSel.selectedOptions[0]?.disabled) {
          planSel.value = "AUTO_PENDING";
        }
      } else if (fb.sixMonthPaid && hasActive) {
        if (optAuto) {
          optAuto.disabled = false;
          optAuto.textContent = `🧾 Pay Current Pending Fee (${fb.activeDueMon} Active × ₹${actPaidRate} = ₹${fb.totalPending})`;
        }
        if (opt300) opt300.disabled = false;
        if (opt500) opt500.disabled = true;
        if (optPkg) optPkg.disabled = false;
        if (forceDefaultPlan || planSel.selectedOptions[0]?.disabled) {
          planSel.value = "AUTO_PENDING";
        }
      } else {
        // Clear client (6M Paid & 0 Active Due)
        if (optAuto) {
          optAuto.disabled = false;
          optAuto.textContent = `✅ Clear (₹0 Pending — Save Date Edits / Advance 6M Pkg)`;
        }
        if (opt300) opt300.disabled = true;
        if (opt500) opt500.disabled = true;
        if (optPkg) optPkg.disabled = false;
        if (forceDefaultPlan || planSel.selectedOptions[0]?.disabled) {
          planSel.value = "PKG_6M_NIL";
        }
      }
      return planSel.value;
    }

    function openFeePaymentModal(sr) {
      if (sr) {
        const directTarget = clients.find(x => x.sr === Number(sr));
        if (directTarget && isApneFreeClient(directTarget)) {
          showToast(`🆓 ${directTarget.client} ek Free Account (Apne) hai — iski fee jama karne ki zarurat nahi hai!`);
          return;
        }
      }
      const select = document.getElementById("feeFormClientSelect");
      const activeList = clients.filter(c => !isInactive(c) && !isApneFreeClient(c));
      select.innerHTML = activeList.map(c => {
        const fb = getClientFeeBreakdown(c);
        return `<option value="${c.sr}">#${c.sheetSr} ${c.client} — ${c.firm} (${fb.sixMonthPaid ? '6M Paid' : fb.delayMon + 'M Delay'}, Pending: ₹${fb.totalPending})</option>`;
      }).join("");
      const chosenSr = sr || (activeList[0] && activeList[0].sr) || 1;
      select.value = String(chosenSr);

      const c = clients.find(x => x.sr === Number(chosenSr));
      const fb = getClientFeeBreakdown(c);
      refreshFeeModalPlanSelectOptions(c, fb, true);
      const payDateInp = document.getElementById("feeFormPayDate");
      if (payDateInp) payDateInp.value = formatDdmmyyyyMon(new Date());
      syncFeeModalFieldsFromClient(true);
      document.getElementById("feePaymentModalOverlay").classList.remove("hidden");
    }

    function syncFeeModalFieldsFromClient(resetCountsFromPlan = false, fromClientSwitch = false) {
      const sr = parseInt(document.getElementById("feeFormClientSelect").value, 10);
      const c = clients.find(x => x.sr === sr);
      if (!c) return;
      const prof = ensureClientFeeProfile(c);
      const fb = getClientFeeBreakdown(c);
      const planType = refreshFeeModalPlanSelectOptions(c, fb, fromClientSwitch);

      const pkgEl = document.getElementById("feeFormCurPkgStatus");
      if (pkgEl) {
        pkgEl.textContent = fb.sixMonthPaid ? "🟢 6M Nil Paid" : `🔴 ${fb.delayMon}M Delay`;
        pkgEl.className = "text-xs font-extrabold mt-0.5 " + (fb.sixMonthPaid ? "text-emerald-700" : "text-rose-600");
      }
      document.getElementById("feeFormCurPtDate").textContent = c.ptDate || "Not Set";
      document.getElementById("feeFormCurDueMon").textContent = fb.sixMonthPaid
        ? `0 Delay • ${fb.activeDueMon} Active (₹${fb.totalPending})`
        : `${fb.delayMon}M Delay • ${fb.activeDueMon} Active (₹${fb.totalPending})`;
      document.getElementById("feeFormCurRate").textContent = fb.sixMonthPaid
        ? `6M Paid | Sale ₹${defaultFeeRates.activePaid}/M`
        : (fb.activeDueMon > 0 ? `Nil Unpaid | Sale ₹${defaultFeeRates.etsy}/M` : `Only 6M Pkg ₹${defaultFeeRates.sixMonthPkg}`);

      const nilInp = document.getElementById("feeFormNilMonthsInput");
      const actInp = document.getElementById("feeFormActiveMonthsInput");
      const monSel = document.getElementById("feeFormMonthsPaid");
      const calcTxt = document.getElementById("feeFormCalcSummaryText");
      const remInp = document.getElementById("feeFormRemarks");

      if (typeof renderFeeActiveMonthsDropdown === "function") {
        renderFeeActiveMonthsDropdown(c);
      }

      const calcPostPtActiveCount = (maxCount) => {
        const unpaidTabs = (fb.saleMonths || []).filter(m => !(prof.activeMonthPayments[m] && prof.activeMonthPayments[m].date));
        if (unpaidTabs.length > 0) {
          return unpaidTabs.slice(0, maxCount).filter(m => isMonthTabAfterPtDate(m, c.ptDate)).length;
        }
        return Math.min(maxCount, fb.delayMon);
      };

      if (resetCountsFromPlan) {
        if (planType === "PKG_6M_NIL") {
          nilInp.value = "6";
          actInp.value = "0";
          monSel.value = "6";
        } else if (planType === "ACTIVE_300" || (planType === "AUTO_PENDING" && fb.sixMonthPaid)) {
          nilInp.value = "0";
          actInp.value = String(fb.activeDueMon);
          monSel.value = "0";
        } else if (planType === "ACTIVE_500" || (planType === "AUTO_PENDING" && !fb.sixMonthPaid)) {
          nilInp.value = "0";
          actInp.value = String(fb.activeDueMon);
          monSel.value = String(Math.min(12, calcPostPtActiveCount(fb.activeDueMon)));
        }
      }

      const nM = planType === "PKG_6M_NIL" ? 6 : 0;
      if (nilInp) nilInp.value = String(nM);
      const aM = Math.max(0, parseInt(actInp.value || "0", 10));
      const ptAddM = Math.max(0, parseInt(monSel.value || "0", 10));

      let calcAmount = 0;
      let summaryNote = "";
      const basePtStr = c.ptDate || getDefaultMonthEndPtDate(new Date());
      const nextPtStr = ptAddM > 0 ? addMonthsToPtDate(basePtStr, ptAddM) : basePtStr;

      if (planType === "PKG_6M_NIL") {
        const pkgRate = Number(defaultFeeRates.sixMonthPkg || 1200);
        const actRate = Number(defaultFeeRates.activePaid || 300);
        calcAmount = pkgRate + (aM * actRate);
        summaryNote = `6M Nil Package (PT ${basePtStr} ke agle mahine se 6M → ${nextPtStr}) = ₹${pkgRate}` + (aM > 0 ? ` + ${aM} Active × ₹${actRate} = ₹${calcAmount}` : "");
      } else if (planType === "ACTIVE_300" || (planType === "AUTO_PENDING" && fb.sixMonthPaid)) {
        const actRate = Number(defaultFeeRates.activePaid || 300);
        calcAmount = aM * actRate;
        summaryNote = aM > 0
          ? `6M Nil Paid Client: ${aM} Active (Sale) Month × ₹${actRate} = ₹${calcAmount}`
          : `Clear (₹0 Due) — Payment dates saved`;
      } else {
        const actRate = Number(defaultFeeRates.etsy || 500);
        calcAmount = aM * actRate;
        summaryNote = `Active Month (Nil Unpaid): ${aM} Active × ₹${actRate} = ₹${calcAmount}`;
      }

      if (calcTxt) calcTxt.textContent = "Hisab: " + summaryNote;
      document.getElementById("feeFormAmountInput").value = String(calcAmount);
      document.getElementById("feeFormNewPtDate").value = nextPtStr;
      const remDelay = Math.max(0, getDelayMonthsFromPtDate(nextPtStr) ?? 0);
      const remAct = Math.max(0, fb.activeDueMon - aM);
      document.getElementById("feeFormNewDueMon").value = String(remDelay + remAct);
      if (remInp && !remInp.value) {
        remInp.placeholder = summaryNote;
      }
    }

    let feeActiveDatePushTimer = null;
    let feePendingSyncClient = null;
    function flushFeeDateSyncNow() {
      if (feeActiveDatePushTimer) {
        clearTimeout(feeActiveDatePushTimer);
        feeActiveDatePushTimer = null;
        const cl = feePendingSyncClient;
        feePendingSyncClient = null;
        if (cl) pushClientToSheet("update", cl, { silent: true });
        pushFeeDataToSheet({ silent: true });
      }
    }
    function scheduleFeeSyncAfterDateEdit(c) {
      clearTimeout(feeActiveDatePushTimer);
      feePendingSyncClient = c || null;
      feeActiveDatePushTimer = setTimeout(async () => {
        feeActiveDatePushTimer = null;
        const cl = feePendingSyncClient;
        feePendingSyncClient = null;
        if (cl) pushClientToSheet("update", cl, { silent: true });
        pushFeeDataToSheet({ silent: true });
      }, 250);
    }

    function renderFeeActiveMonthsDropdown(c) {
      const badgeEl = document.getElementById("activeMonthsDropdownBadge");
      const arrowEl = document.getElementById("activeMonthsDropdownArrow");
      const bodyEl = document.getElementById("activeMonthsDropdownBody");
      const rowsEl = document.getElementById("activeMonthsRowsContainer");
      const addSelEl = document.getElementById("addManualActiveMonthSelect");
      if (!badgeEl || !bodyEl || !rowsEl) return;

      const prof = ensureClientFeeProfile(c);
      const fb = getClientFeeBreakdown(c);
      const payMap = prof.activeMonthPayments || {};
      const monthsList = fb.saleMonths || [];
      badgeEl.textContent = `${monthsList.length} Sale • ${fb.activePaidMon} Paid • ${fb.activeDueMon} Due`;
      bodyEl.classList.toggle("hidden", !feeActiveMonthsDropdownOpen);
      if (arrowEl) arrowEl.textContent = feeActiveMonthsDropdownOpen ? "▲" : "▼";

      if (addSelEl && typeof ALL_MASTER_MONTH_TABS !== "undefined") {
        addSelEl.innerHTML = ALL_MASTER_MONTH_TABS
          .filter(m => !monthsList.includes(m.tab))
          .map(m => `<option value="${m.tab}">${m.label} (${m.tab})</option>`)
          .join("") || `<option value="">All months added</option>`;
      }

      if (monthsList.length === 0) {
        rowsEl.innerHTML = `<div class="text-[11px] text-slate-500 py-2 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">Koi Active (Sale) month detect nahi hua hai. Neeche <b>+ Add Active Month</b> se month jodein ya Master Etsy sync karein.</div>`;
        return;
      }

      rowsEl.innerHTML = monthsList.map(m => {
        const entry = payMap[m];
        const isoDate = entry && entry.date ? toIsoInputDate(entry.date) : "";
        const amtVal = (entry && entry.amount !== undefined && entry.amount !== "") ? Number(entry.amount) : fb.activeRate;
        const isPaid = Boolean(isoDate);
        return `
          <div class="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border ${isPaid ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/70 border-amber-200'}">
            <div class="flex items-center gap-1.5 min-w-[92px]">
              <span class="font-mono text-xs font-black text-slate-900">${m}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold ${isPaid ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-slate-950'}">${isPaid ? '✓ Paid' : '⏳ Due'}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <input type="date" data-active-month-date="${m}" value="${isoDate}" class="active-month-date-inp rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-mono font-bold text-slate-800" />
              <div class="flex items-center rounded-md border border-slate-300 bg-white px-1.5 py-1">
                <span class="text-[10px] text-slate-500 mr-0.5">₹</span>
                <input type="number" min="0" step="50" data-active-month-amt="${m}" value="${amtVal}" class="active-month-amt-inp w-14 text-[11px] font-mono font-bold text-slate-800 focus:outline-none" />
              </div>
              <button type="button" data-active-month-clear="${m}" title="Date hatayein (Due karein)" class="active-month-clear-btn px-1.5 py-1 rounded-md text-[10px] font-bold ${isPaid ? 'bg-rose-100 hover:bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-400'}">✕</button>
            </div>
          </div>
        `;
      }).join("");

      rowsEl.querySelectorAll(".active-month-date-inp").forEach(inp => {
        inp.addEventListener("change", () => {
          const m = inp.getAttribute("data-active-month-date");
          const amtEl = rowsEl.querySelector(`.active-month-amt-inp[data-active-month-amt="${m}"]`);
          const amt = amtEl ? amtEl.value : fb.activeRate;
          if (!inp.value && !confirmDelete(`${c.client} (${m}) ki payment date hatane se uski receipt bhi delete ho jayegi.\n\nContinue?`)) {
            renderFeePage(); syncFeeModalFieldsFromClient(true); return;
          }
          setClientActiveMonthPayment(c, m, inp.value, amt);
          syncFeeModalFieldsFromClient(true);
          renderFeePage();
          renderApp();
          scheduleFeeSyncAfterDateEdit(c);
          if (inp.value) {
            const b = getMonthBucketFromDate(inp.value);
            showToast(`✅ ${c.client} (${m}): ${isoToDisplayDate(inp.value)} save → ${b.label} Net Collection me juda!`);
          }
        });
      });

      rowsEl.querySelectorAll(".active-month-amt-inp").forEach(amtInp => {
        amtInp.addEventListener("change", () => {
          const m = amtInp.getAttribute("data-active-month-amt");
          const dtEl = rowsEl.querySelector(`.active-month-date-inp[data-active-month-date="${m}"]`);
          if (dtEl && dtEl.value) {
            setClientActiveMonthPayment(c, m, dtEl.value, amtInp.value);
            syncFeeModalFieldsFromClient(true);
            renderFeePage();
            scheduleFeeSyncAfterDateEdit(c);
          }
        });
      });

      rowsEl.querySelectorAll(".active-month-clear-btn").forEach(clrBtn => {
        clrBtn.addEventListener("click", () => {
          const m = clrBtn.getAttribute("data-active-month-clear");
          if (!confirmDelete(`${c.client} (${m}) ki payment hatane se uski receipt bhi delete ho jayegi.\n\nContinue?`)) return;
          setClientActiveMonthPayment(c, m, "", 0);
          syncFeeModalFieldsFromClient(true);
          renderFeePage();
          renderApp();
          scheduleFeeSyncAfterDateEdit(c);
          showToast(`⏳ ${c.client} (${m}): Payment date hata di gayi (Due me wapas)`);
        });
      });
    }

    const toggleActiveDdBtn = document.getElementById("toggleActiveMonthsDropdownBtn");
    if (toggleActiveDdBtn) {
      toggleActiveDdBtn.addEventListener("click", () => {
        feeActiveMonthsDropdownOpen = !feeActiveMonthsDropdownOpen;
        const sr = parseInt(document.getElementById("feeFormClientSelect").value, 10);
        const c = clients.find(x => x.sr === sr);
        if (c) renderFeeActiveMonthsDropdown(c);
      });
    }

    const addManualMonBtn = document.getElementById("addManualActiveMonthBtn");
    if (addManualMonBtn) {
      addManualMonBtn.addEventListener("click", () => {
        const sr = parseInt(document.getElementById("feeFormClientSelect").value, 10);
        const c = clients.find(x => x.sr === sr);
        const sel = document.getElementById("addManualActiveMonthSelect");
        const mon = sel && sel.value ? sel.value.trim() : "";
        if (!c || !mon) return;
        const prof = ensureClientFeeProfile(c);
        if (!prof.manualActiveMonths.includes(mon)) prof.manualActiveMonths.push(mon);
        ensureClientFeeProfile(c);
        syncClientDueMonFromProfile(c);
        saveFeeState();
        saveClients();
        feeActiveMonthsDropdownOpen = true;
        syncFeeModalFieldsFromClient(true);
        renderFeePage();
        renderApp();
        scheduleFeeSyncAfterDateEdit(c);
      });
    }

    const netMonSel = document.getElementById("feeNetCollectionMonthSelect");
    if (netMonSel) {
      netMonSel.addEventListener("change", () => {
        feeLedgerMonthFilter = netMonSel.value || "ALL";
        renderFeePage();
      });
    }

    document.getElementById("feeFormClientSelect").addEventListener("change", () => syncFeeModalFieldsFromClient(true, true));
    document.getElementById("feeFormPlanTypeSelect").addEventListener("change", () => syncFeeModalFieldsFromClient(true));
    document.getElementById("feeFormNilMonthsInput").addEventListener("input", () => syncFeeModalFieldsFromClient(false));
    document.getElementById("feeFormActiveMonthsInput").addEventListener("input", () => syncFeeModalFieldsFromClient(false));
    document.getElementById("feeFormMonthsPaid").addEventListener("change", () => syncFeeModalFieldsFromClient(false));

    function closeFeePaymentModal() {
      flushFeeDateSyncNow();
      document.getElementById("feePaymentModalOverlay").classList.add("hidden");
    }
    document.getElementById("closeFeeModalBtn").addEventListener("click", closeFeePaymentModal);
    document.getElementById("cancelFeeModalBtn").addEventListener("click", closeFeePaymentModal);
    const openNewFeePaymentBtnEl = document.getElementById("openNewFeePaymentBtn");
    if (openNewFeePaymentBtnEl) openNewFeePaymentBtnEl.addEventListener("click", () => openFeePaymentModal(null));

    function nextReceiptNo() {
      let maxNum = 1000;
      feeLedger.forEach(it => {
        const m = String(it.receiptNo || "").match(/(\d+)$/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      });
      // Delete ho chuki receipts ke number dobara use na hon
      try { maxNum = Math.max(maxNum, parseInt(localStorage.getItem("gst_last_receipt_no_v1") || "0", 10) || 0); } catch (e) {}
      const next = Math.max(maxNum + 1, 1001 + feeLedger.length);
      try { localStorage.setItem("gst_last_receipt_no_v1", String(next)); } catch (e) {}
      return "RCP-" + String(next);
    }

    document.getElementById("feePaymentForm").addEventListener("submit", async e => {
      e.preventDefault();
      const sr = parseInt(document.getElementById("feeFormClientSelect").value, 10);
      const c = clients.find(x => x.sr === sr);
      if (!c) return;
      const prof = ensureClientFeeProfile(c);
      const planType = document.getElementById("feeFormPlanTypeSelect").value;
      const nM = Math.max(0, parseInt(document.getElementById("feeFormNilMonthsInput").value || "0", 10));
      const aM = Math.max(0, parseInt(document.getElementById("feeFormActiveMonthsInput").value || "0", 10));
      const monthsPaid = Math.max(0, parseInt(document.getElementById("feeFormMonthsPaid").value || "0", 10));
      const amount = Math.max(0, parseFloat(document.getElementById("feeFormAmountInput").value || "0"));
      const mode = document.getElementById("feeFormModeSelect").value;
      const newPtDate = document.getElementById("feeFormNewPtDate").value.trim() || c.ptDate;
      const newDueMon = Math.max(0, parseInt(document.getElementById("feeFormNewDueMon").value || "0", 10));
      const payDate = document.getElementById("feeFormPayDate").value.trim() || formatDdmmyyyyMon(new Date());
      const calcTxt = document.getElementById("feeFormCalcSummaryText").textContent.replace(/^Hisab:\s*/, "");
      const remarks = document.getElementById("feeFormRemarks").value.trim() || calcTxt;

      // If Active months were already paid directly via dropdown dates so bottom amount is 0 and no Nil/PT change
      if (amount === 0 && nM === 0 && aM === 0 && planType !== "PKG_6M_NIL") {
        c.ptDate = newPtDate;
        syncClientDueMonFromProfile(c);
        saveFeeState();
        saveClients();
        closeFeePaymentModal();
        renderFeePage();
        renderApp();
        const [cRes, fRes] = await Promise.all([
          pushClientToSheet("update", c, { silent: true }),
          pushFeeDataToSheet({ silent: true })
        ]);
        showToast(cRes.ok && fRes.ok
          ? `✅ ${c.client}: Active Month payment dates saved & Sheet Synced!`
          : `⚠️ ${c.client}: Browser me save hua, par Sheet Sync FAIL!`);
        return;
      }

      if (planType === "PKG_6M_NIL") {
        c.ptDate = newPtDate;
        delete prof.manualSixMonthForPt;
        const postDelay = getDelayMonthsFromPtDate(c.ptDate);
        const remDelay = postDelay !== null ? postDelay : 0;
        prof.nilDueMon = remDelay;
        prof.sixMonthPaid = remDelay === 0;
      }

      // If user paid Active Months via main Save button while unpaid saleMonths exist, auto-tag those unpaid months with payDate
      const unpaidTabs = (prof.saleMonths || []).filter(m => !(prof.activeMonthPayments[m] && prof.activeMonthPayments[m].date));
      const perActiveRate = (planType === "PKG_6M_NIL" || prof.sixMonthPaid)
        ? Math.max(0, Number(defaultFeeRates.activePaid ?? 300))
        : Math.max(0, Number(defaultFeeRates.etsy ?? 500));
      let remainingExtraAmt = amount;

      if (aM > 0 && unpaidTabs.length > 0) {
        const toAssign = Math.min(aM, unpaidTabs.length);
        const isoPay = toIsoInputDate(payDate) || toIsoInputDate(formatDdmmyyyyMon(new Date()));
        for (let idx = 0; idx < toAssign; idx++) {
          const mTab = unpaidTabs[idx];
          const mAmt = Math.min(perActiveRate, remainingExtraAmt > 0 ? remainingExtraAmt : perActiveRate);
          remainingExtraAmt = Math.max(0, remainingExtraAmt - mAmt);
          setClientActiveMonthPayment(c, mTab, isoPay, mAmt, mode);
        }
      } else if (aM > 0) {
        prof.activePaidMon = Math.max(0, Number(prof.activePaidMon || 0) + aM);
        prof.activeDueMon = Math.max(0, prof.activeDueMon - aM);
      }

      if (planType !== "PKG_6M_NIL") {
        c.ptDate = newPtDate;
        delete prof.manualSixMonthForPt;
      }

      ensureClientFeeProfile(c);
      syncClientDueMonFromProfile(c);
      saveClients();

      if (planType === "PKG_6M_NIL" || nM > 0 || remainingExtraAmt > 0 || unpaidTabs.length === 0) {
        const receiptAmt = (unpaidTabs.length === 0 || aM === 0) ? amount : Math.max(0, remainingExtraAmt);
        if (receiptAmt > 0 || planType === "PKG_6M_NIL" || nM > 0) {
          feeLedger.unshift({
            receiptNo: nextReceiptNo(),
            clientKey: getClientKey(c),
            gstin: c.gstin || "",
            sr: c.sr,
            client: c.client,
            firm: c.firm,
            months: monthsPaid || nM || aM || 1,
            activeMonthsPaid: unpaidTabs.length === 0 ? aM : 0,
            amount: receiptAmt,
            mode: mode,
            newPtDate: newPtDate,
            date: payDate,
            remarks: remarks
          });
        }
      }
      saveFeeState();
      closeFeePaymentModal();
      renderFeePage();
      renderApp();

      const [cRes, fRes] = await Promise.all([
        pushClientToSheet("update", c, { silent: true }),
        pushFeeDataToSheet({ silent: true })
      ]);
      if (cRes.ok && fRes.ok && fRes.feeSaved) {
        showToast(`✅ ${c.client}: ₹${amount.toLocaleString("en-IN")} fee jama & Sheet Synced! PT Date: ${newPtDate}`);
      } else if (cRes.ok && fRes.ok) {
        showToast(`✅ ${c.client}: ₹${amount.toLocaleString("en-IN")} jama (PT Date synced; Receipt Sheet sync ke liye AppSync_Fixed.txt deploy karein)`);
      } else {
        showToast(`⚠️ ${c.client}: ₹${amount.toLocaleString("en-IN")} browser me jama hua, par Sheet Sync FAIL (${(cRes.ok ? fRes.message : cRes.message) || "error"})!`);
      }
    });

    function sendDetailedFeeWaReminder(sr) {
      const c = clients.find(x => x.sr === sr);
      if (!c) return;
      const raw = String(c.mobile || "").replace(/\D/g, "");
      if (!raw || raw.length < 10) {
        showToast(`${c.client} ka mobile number valid nahi hai!`);
        return;
      }
      const ph = raw.length === 10 ? "91" + raw : raw;
      const fb = getClientFeeBreakdown(c);
      const nm = String(c.client || "").replace(/\*/g, "").trim();
      const firm = (c.firm && c.firm !== "-") ? ` (${c.firm})` : "";

      if (fb.isFreeApne) {
        const mon = prevMonthHindi();
        const gstLine = c.gstin ? `GSTIN: *${c.gstin}*\n` : "";
        const statusMsg = c.filed
          ? `✅ आपके *${mon}* माह की GST रिटर्न *फाइल हो चुकी है (Filed)*।`
          : `⏳ आपके *${mon}* माह की GST रिटर्न अभी *प्रक्रिया में / पेंडिंग (Pending)* है। यदि इस माह के स्टेटमेंट या ट्रांसपोर्ट बिल बाकी हों तो कृपया भेज दें।`;
        const freeMsg =
          `नमस्ते ${nm} जी${firm} 🙏\n\n` +
          gstLine +
          `${statusMsg}\n\n` +
          `_(यह खाता Free Account / Apne के अंतर्गत है — कोई शुल्क देय नहीं है)_` +
          `\n\nधन्यवाद 🙏\n- Tax Consultancy`;
        window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(freeMsg), "_blank", "noopener,noreferrer");
        showToast(`💬 ${c.client} ko Return Status WhatsApp message khola gaya!`);
        return;
      }

      let breakdownLines = "";
      if (fb.sixMonthPaid) {
        const actCount = Math.max(1, fb.activeDueMon);
        const actTotal = actCount * fb.activeRate;
        const saleDetail = fb.saleMonths.length
          ? ` (Total: ${fb.saleMonths.join(", ")}${fb.activePaidMon > 0 ? `, Paid: ${fb.activePaidMon}` : ""})`
          : (fb.activePaidMon > 0 ? ` (Paid: ${fb.activePaidMon})` : "");
        breakdownLines =
          `• 6-Month Nil Filing Package: *Paid (PT Date: ${c.ptDate || "N/A"})*\n` +
          `• Active (Sale) Months Due: *${actCount} Month(s)*${saleDetail}\n` +
          `• Active Month Fee (@ ₹${fb.activeRate}/माह): *₹${actTotal.toLocaleString("en-IN")}*\n` +
          `• *कुल देय राशि (Total Due): ₹${actTotal.toLocaleString("en-IN")}*`;
      } else {
        const dCount = fb.delayMon;
        const aCount = fb.activeDueMon;
        const total = fb.totalPending;
        breakdownLines =
          `• Paid Till (PT Date): *${c.ptDate || "N/A"}* (*${dCount} Month(s) Delay* — 6M Nil Package Due)\n` +
          (aCount > 0
            ? `• Active (Sale) Months (Nil Unpaid @ ₹${fb.activeRate}/माह): *${aCount} Month(s)* = *₹${fb.activeFee.toLocaleString("en-IN")}*\n`
            : `• 6-Month Nil Filing Package (PT Date के अगले महीने से 6 माह): *₹${fb.pkgRate.toLocaleString("en-IN")}*\n`) +
          `• *कुल बकाया राशि (Total Pending Fee): ₹${total.toLocaleString("en-IN")}*\n` +
          `_(नोट: 6 महीने का Nil Filing पैकेज ₹${defaultFeeRates.sixMonthPkg} का है; Active (Sale) माह में 6M पैकेज Paid होने पर ₹${defaultFeeRates.activePaid} और Unpaid होने पर ₹${defaultFeeRates.etsy} शुल्क लगता है)_`;
      }

      const msg =
        `नमस्ते ${nm} जी${firm} 🙏\n\n` +
        `आपकी GST रिटर्न फाइलिंग सेवाओं का शुल्क (Fee) विवरण नीचे दिया गया है:\n` +
        breakdownLines + `\n\n` +
        `कृपया सुविधा अनुसार जल्द से जल्द भुगतान कर दें और स्क्रीनशॉट इसी नंबर पर भेज दें ताकि आपकी GST फाइलिंग समय पर होती रहे।\n\n` +
        `धन्यवाद 🙏\n- Tax Consultancy`;
      window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank", "noopener,noreferrer");
      showToast(`💬 ${c.client} ke liye Fee WhatsApp reminder khola gaya!`);
    }

    function sendReferenceConsolidatedWa(groupKey, groupLabel, defaultPhone) {
      const activeList = clients.filter(c => !isInactive(c) && matchesRefGroup(c.reference, groupKey) && getClientPendingFee(c) > 0);
      if (activeList.length === 0) {
        showToast("Is Reference ke sabhi clients ki fee clear hai!");
        return;
      }
      let grandTotal = 0;
      const lines = activeList.map((c, i) => {
        const fb = getClientFeeBreakdown(c);
        grandTotal += fb.totalPending;
        return `${i + 1}. *${c.client}* (${c.firm}) — ${fb.formulaShort} (PT: ${c.ptDate || "-"}) = *₹${fb.totalPending.toLocaleString("en-IN")}*`;
      });
      const msg =
        `नमस्ते ${groupLabel} जी 🙏\n\n` +
        `आपके रेफरेंस के निम्नलिखित *${activeList.length} GST क्लाइंट्स* की फ़ीस बकाया (Due) है:\n` +
        `_(6M Nil Paid होने पर Active ₹${defaultFeeRates.activePaid}/M | 6M Unpaid होने पर Active न हो तो 6M Pkg ₹${defaultFeeRates.sixMonthPkg}, Active होने पर ₹${defaultFeeRates.etsy}/M)_\n\n` +
        lines.join("\n") +
        `\n\n💰 *कुल बकाया (Total Pending Fee): ₹${grandTotal.toLocaleString("en-IN")}*\n\n` +
        `कृपया इन क्लाइंट्स से बात करके समय पर पेमेंट करवाने में सहयोग करें।\nधन्यवाद 🙏`;
      const url = defaultPhone
        ? `https://wa.me/${defaultPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      showToast(`📲 ${groupLabel} ke ${activeList.length} due clients ki list WhatsApp par taiyar!`);
    }

    // Fee Page Filter & Button Listeners
    function setFeeRatesDropdownOpen(isOpen) {
      const panel = document.getElementById("feeRatesDropdownPanel");
      const btn = document.getElementById("toggleFeeRatesDropdownBtn");
      const arrow = document.getElementById("feeRatesDropdownArrow");
      if (panel) panel.classList.toggle("hidden", !isOpen);
      if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (arrow) arrow.textContent = isOpen ? "▴" : "▾";
    }
    const toggleRatesBtnEl = document.getElementById("toggleFeeRatesDropdownBtn");
    if (toggleRatesBtnEl) {
      toggleRatesBtnEl.addEventListener("click", e => {
        e.stopPropagation();
        const panel = document.getElementById("feeRatesDropdownPanel");
        const willOpen = panel ? panel.classList.contains("hidden") : true;
        setFeeRatesDropdownOpen(willOpen);
      });
    }
    const closeRatesBtnEl = document.getElementById("closeFeeRatesDropdownBtn");
    if (closeRatesBtnEl) closeRatesBtnEl.addEventListener("click", () => setFeeRatesDropdownOpen(false));
    document.addEventListener("click", e => {
      const wrap = document.getElementById("feeRatesDropdownWrap");
      const panel = document.getElementById("feeRatesDropdownPanel");
      if (wrap && panel && !panel.classList.contains("hidden") && !wrap.contains(e.target)) {
        setFeeRatesDropdownOpen(false);
      }
    });

    document.getElementById("saveDefaultFeeRatesBtn").addEventListener("click", async () => {
      defaultFeeRates.sixMonthPkg = Math.max(0, parseFloat(document.getElementById("default6mPkgFeeInput").value || "1200"));
      defaultFeeRates.activePaid = Math.max(0, parseFloat(document.getElementById("defaultActivePaidFeeInput").value || "300"));
      defaultFeeRates.nilUnpaid = 0;
      defaultFeeRates.etsy = Math.max(0, parseFloat(document.getElementById("defaultEtsyFeeInput").value || "500"));
      defaultFeeRates.regular = Math.max(0, parseFloat(document.getElementById("defaultRegFeeInput").value || "500"));
      defaultFeeRates.apne = Math.max(0, parseFloat(document.getElementById("defaultApneFeeInput").value || "0"));
      applyFeeRateInputsToUi();
      normalizeApneFreeClients();
      saveFeeState();
      saveClients();
      renderFeePage();
      renderApp();
      setFeeRatesDropdownOpen(false);
      const fRes = await pushFeeDataToSheet({ silent: true });
      const msg = `Fee Structure save ho gaya: 6M Nil Pkg=₹${defaultFeeRates.sixMonthPkg} | Active (6M Paid)=₹${defaultFeeRates.activePaid}/M | Active (Unpaid)=₹${defaultFeeRates.etsy}/M`;
      showToast(fRes.ok ? `✅ ${msg} (Sheet Synced!)` : `⚠️ ${msg}, par Sheet Sync FAIL (${fRes.message})`);
    });

    document.getElementById("syncActiveMonthsFromMasterBtn").addEventListener("click", async () => {
      let syncedCount = 0;
      clients.forEach(c => {
        if (isInactive(c) || isApneFreeClient(c)) return;
        const prof = ensureClientFeeProfile(c);
        const saleTabs = getDetectedSaleMonthsForClient(c);
        if (saleTabs.length > 0) {
          ensureClientFeeProfile(c);
          syncedCount++;
        } else if (Number(c.rov || 0) > 0 && prof.activePaidMon === 0 && prof.activeDueMon === 0) {
          prof.activeDueMon = 1;
          syncedCount++;
        }
        syncClientDueMonFromProfile(c);
      });
      saveFeeState();
      saveClients();
      renderFeePage();
      renderApp();
      const fRes = await pushFeeDataToSheet({ silent: true });
      showToast(fRes.ok
        ? `🛍️ ${syncedCount} clients ke Active Months (Total Sale − Paid Active) update aur Sheet sync ho gaye!`
        : `⚠️ ${syncedCount} clients locally update hue, par Sheet Sync FAIL (${fRes.message})`);
    });

    document.getElementById("feeSearchInput").addEventListener("input", e => {
      feeSearchQuery = e.target.value;
      renderFeePage();
    });

    document.querySelectorAll(".fee-status-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        feeStatusFilter = btn.getAttribute("data-fee-status");
        renderFeePage();
      });
    });

    document.getElementById("feeCategoryFilterSelect").addEventListener("change", e => {
      feeCategoryFilter = e.target.value;
      renderFeePage();
    });
    document.getElementById("feeTypeFilterSelect").addEventListener("change", e => {
      feeTypeFilter = e.target.value;
      renderFeePage();
    });
    document.getElementById("feeRefFilterSelect").addEventListener("change", e => {
      feeRefFilter = e.target.value;
      renderFeePage();
    });
    document.getElementById("feeSortSelect").addEventListener("change", e => {
      feeSortBy = e.target.value;
      renderFeePage();
    });
    document.getElementById("resetFeeFiltersBtn").addEventListener("click", () => {
      feeSearchQuery = "";
      feeStatusFilter = "ALL";
      feeCategoryFilter = "ALL";
      feeTypeFilter = "ALL";
      feeRefFilter = "ALL";
      feeSortBy = "DUE_DESC";
      document.getElementById("feeSearchInput").value = "";
      document.getElementById("feeCategoryFilterSelect").value = "ALL";
      document.getElementById("feeTypeFilterSelect").value = "ALL";
      document.getElementById("feeRefFilterSelect").value = "ALL";
      document.getElementById("feeSortSelect").value = "DUE_DESC";
      renderFeePage();
      showToast("Saare Fee filters reset ho gaye!");
    });

    // KPI Cards on Fee Page
    document.getElementById("feeCardAllBtn").addEventListener("click", () => { feeStatusFilter = "SIX_M_PAID"; renderFeePage(); });
    document.getElementById("feeCardPendingBtn").addEventListener("click", () => { feeStatusFilter = "DUE_ANY"; renderFeePage(); });
    document.getElementById("feeCardRedBtn").addEventListener("click", () => { feeStatusFilter = "SIX_M_UNPAID"; renderFeePage(); });
    document.getElementById("feeCardClearBtn").addEventListener("click", () => { feeStatusFilter = "CLEAR"; renderFeePage(); });
    document.getElementById("feeCardCollectedBtn").addEventListener("click", () => {
      const sec = document.getElementById("feeLedgerSection");
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("autoSyncDueFromPtDateBtn").addEventListener("click", async () => {
      const nowRefD = new Date();
      let updatedCount = 0;
      clients.forEach(c => {
        if (isInactive(c)) return;
        if (isApneFreeClient(c)) {
          c.ptDate = "FREE";
          c.dueMon = 0;
          syncClientDueMonFromProfile(c);
          return;
        }
        const ptDelay = getDelayMonthsFromPtDate(c.ptDate, nowRefD);
        const calcDue = ptDelay !== null ? ptDelay : 0;
        const prof = ensureClientFeeProfile(c);
        delete prof.manualSixMonthForPt;
        prof.sixMonthPaid = calcDue === 0;
        prof.nilDueMon = calcDue === 0 ? 0 : calcDue;
        if (c.dueMon !== calcDue) {
          c.dueMon = calcDue;
          updatedCount++;
        }
        syncClientDueMonFromProfile(c);
      });
      saveFeeState();
      saveClients();
      renderFeePage();
      renderApp();
      const fRes = await pushFeeDataToSheet({ silent: true });
      const baseLbl = getCurrentMonYearLabel(nowRefD);
      if (fRes.ok && fRes.feeSaved) {
        showToast(`🔄 PT Date (${baseLbl} base) se ${updatedCount} clients update aur Google Sheet me sync ho gaye!`);
      } else if (fRes.ok) {
        showToast(`🔄 PT Date (${baseLbl} base) se ${updatedCount} clients locally update hue (Sheet sync ke liye AppSync_Fixed.txt deploy karein).`);
      } else {
        showToast(`⚠️ PT Date (${baseLbl} base) se ${updatedCount} clients locally update hue, par Sheet Sync FAIL (${fRes.message})!`);
      }
    });

    document.getElementById("exportFeeTrackerCsvBtn").addEventListener("click", () => {
      const rows = getFilteredFeeClients();
      const headers = ["Sr", "Category", "Client Name", "Firm Name", "GSTIN", "Reference", "Mobile", "6M Nil Package Status", "Paid Till (PT Date)", "PT Delay Months", "6M Nil Pkg Due (INR)", "Active (Sale) Months Due", "Active Rate (INR)", "Pending Fee (INR)", "Calculation Breakdown"];
      const lines = [headers.join(",")];
      const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      rows.forEach(c => {
        const fb = getClientFeeBreakdown(c);
        lines.push([
          c.sheetSr,
          c.category,
          c.client,
          c.firm,
          c.gstin,
          c.reference,
          c.mobile,
          fb.isFreeApne ? "Free Account (Apne)" : (fb.sixMonthPaid ? "6M Nil Paid" : `PT Delay (${fb.delayMon}M)`),
          fb.isFreeApne ? "FREE" : c.ptDate,
          fb.delayMon,
          fb.nilFee,
          fb.activeDueMon,
          fb.activeRate,
          fb.totalPending,
          fb.formulaShort
        ].map(esc).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST_Fee_Tracker_${rows.length}_Clients.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("📥 Fee Tracker CSV download ho gayi!");
    });

    document.getElementById("exportFeeLedgerCsvBtn").addEventListener("click", () => {
      if (feeLedger.length === 0) { showToast("Ledger me abhi koi entry nahi hai!"); return; }
      const headers = ["Receipt No", "Payment Date", "Client Name", "Firm", "Months Paid", "Amount Paid (INR)", "Payment Mode", "Updated PT Date", "Remarks"];
      const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [headers.join(",")];
      feeLedger.forEach(r => {
        lines.push([r.receiptNo, r.date, r.client, r.firm, r.months, r.amount, r.mode, r.newPtDate, r.remarks].map(esc).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST_Fee_Payment_Ledger_${feeLedger.length}_Receipts.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("📥 Payment Ledger CSV download ho gayi!");
    });


    // =====================================================================
    // PAGE 3 LOGIC: 🧾 GST PORTAL JSON GENERATOR (GSTR-1 OFFLINE TOOL READY)
