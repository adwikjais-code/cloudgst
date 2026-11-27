    (function () {
      const K_BRIDGE = "sa_bridge_url_v1";
      const K_SECRET = "sa_bridge_sec_v1";
      const K_CLOUD = "sa_cloud_url_v1";
      const K_PC = "sa_pc_url_v1";

      let gpCategoryFilter = "ALL";
      let gpCredsMode = false;
      let gpActiveWaClient = null;
      let gpActiveWaTpl = "etsy";
      let gpActiveFetches = 0;
      let gpActiveB2bKey = null;
      const gpExpanded = new Set();
      const gpExpandTimers = new Map();
      const GP_AUTO_HIDE_MS = 45000; // 45 sec baad expanded detail apne aap hide ho jayega
      function gpScheduleAutoHide(key) {
        if (gpExpandTimers.has(key)) clearTimeout(gpExpandTimers.get(key));
        const t = setTimeout(() => {
          gpExpandTimers.delete(key);
          if (gpExpanded.has(key)) {
            gpExpanded.delete(key);
            gpRenderSerialList();
          }
        }, GP_AUTO_HIDE_MS);
        gpExpandTimers.set(key, t);
      }
      function gpClearAutoHide(key) {
        if (gpExpandTimers.has(key)) {
          clearTimeout(gpExpandTimers.get(key));
          gpExpandTimers.delete(key);
        }
      }
      const gpRowState = new Map();

      // Auto-matched local GSTR-1 JSON files keyed by GSTIN -> { fileName, fp, invCount, jsonObj, uploaded }
      const gpMatchedJsons = new Map();
      function gpGetSelectedFp() {
        const fy = document.getElementById("gpFySel")?.value || "2026-27";
        const mm = String(document.getElementById("gpMonSel")?.value || "10").padStart(2, "0");
        const startYr = parseInt(fy.slice(0, 4), 10) || 2026;
        const yr = parseInt(mm, 10) >= 4 ? startYr : startYr + 1;
        return `${mm}${yr}`;
      }
      function gpGetSelectedPeriod() {
        const fy = document.getElementById("gpFySel")?.value || "2026-27";
        const mm = String(document.getElementById("gpMonSel")?.value || "10").padStart(2, "0");
        return `${fy} / ${mm}`;
      }
      function gpIsPeriodMatch(savedPeriod) {
        const sp = String(savedPeriod || "").trim();
        if (!sp) return false;
        const wantLabel = gpGetSelectedPeriod();
        const wantFp = gpGetSelectedFp();
        if (sp === wantLabel || sp === wantFp) return true;
        const norm = sp.replace(/\s+/g, "");
        if (norm === wantLabel.replace(/\s+/g, "")) return true;
        return false;
      }
      function gpGetActivePortalData(c) {
        if (!c || !c.portalData) return null;
        return gpIsPeriodMatch(c.portalData.period) ? c.portalData : null;
      }

      const gpToast = (msg) => {
        if (typeof showToast === "function") showToast(msg);
      };
      // Naya browser / cleared storage: khaali chhodo to Cloud (Railway) par hi jao — "URL set karein" wali dead-end na aaye
      const gpGetBridgeUrl = () => {
        let u = (localStorage.getItem(K_BRIDGE) || "").trim();
        if (!u) u = (localStorage.getItem(K_CLOUD) || "").trim();
        if (!u) u = "https://cloudgst-production.up.railway.app";
        return u.replace(/\/+$/, "");
      };
      const gpGetBridgeSec = () => (localStorage.getItem(K_SECRET) || "").trim();

      function gpEsc(v) {
        return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function gpFmtInr(n) {
        return "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
      }
      function gpCopyText(txt, label) {
        if (!txt) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).catch(() => {});
        } else {
          const ta = document.createElement("textarea");
          ta.value = txt; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); } catch (_) {}
          document.body.removeChild(ta);
        }
        gpToast(`📋 ${label || "Copied"}: ${txt}`);
      }

      function gpGetState(key) {
        if (!gpRowState.has(key)) {
          gpRowState.set(key, {
            phase: "idle", sessionId: null, captchaBase64: "", note: "",
            sheetStatus: "", liveRawData: null, driveSaving: false, showPw: false,
            cooldownUntil: 0, abort: null
          });
        }
        return gpRowState.get(key);
      }

      function gpGetAppClients() {
        const list = (typeof clients !== "undefined" && Array.isArray(clients)) ? clients : [];
        return list.map((c, idx) => {
          const key = (typeof getClientKey === "function" ? getClientKey(c) : (c.gstin || c.client || String(c.sr || idx + 1)));
          return {
            sr: c.sr || (idx + 1),
            sheetSr: c.sheetSr || c.sr || (idx + 1),
            clientKey: String(key),
            clientName: String(c.client || "").trim(),
            firm: String(c.firm || "").trim(),
            gstin: String(c.gstin || "").trim().toUpperCase(),
            portalId: String(c.id || "").trim(),
            rawPassword: String(c.password || "").trim(),
            mobile: String(c.mobile || "").trim(),
            category: c.category || "PAID CLINTS",
            portalData: c.portalData || null,
            _ref: c
          };
        });
      }

      async function gpDecryptLegacySa(val) {
        if (!String(val || "").startsWith("enc:sa:")) return null;
        try {
          const saltStr = localStorage.getItem("sa_vault_salt_v1") || "";
          if (!saltStr) return null;
          const p = String(val).split(":");
          const _vaultSec = (gpGetBridgeSec() || "").trim();
          if (!_vaultSec) return null; // secret set nahi -> decrypt nahi (pehle hardcoded default password chalta tha)
          const pass = "GST_STANDALONE_VAULT::" + _vaultSec;
          const unb64Local = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
          const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
          const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64Local(saltStr), iterations: 120000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
          return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64Local(p[2]) }, key, unb64Local(p[3])));
        } catch (_) { return null; }
      }

      async function gpResolvePassword(c) {
        if (!c || !c.rawPassword) return { ok: false, reason: "empty", pw: "" };
        let val = String(c.rawPassword).trim();
        if (val.startsWith("enc:v1:") && typeof getClientPw === "function") {
          const dec = await getClientPw(c._ref);
          if (dec === null) return { ok: false, reason: "locked", pw: "" };
          val = String(dec || "").trim();
        }
        if (val.startsWith("enc:sa:")) {
          const decSa = await gpDecryptLegacySa(val);
          if (!decSa) return { ok: false, reason: "encrypted", pw: "" };
          val = String(decSa).trim();
        }
        if (val.startsWith("enc:")) return { ok: false, reason: "encrypted", pw: "" };
        return { ok: !!val, reason: val ? "ok" : "empty", pw: val };
      }

      // ===== Bridge health / auto-retry (v5.9.14) =====
      // Net error par (Load failed / Failed to fetch) hi retry — HTTP error/CORS par nahi, warna bekar spam hoga.
      let gpBridgeOffline = false;
      function gpBridgeMark(up) {
        const was = gpBridgeOffline;
        gpBridgeOffline = !up;
        if (was !== gpBridgeOffline) { try { gpRenderSerialList(); } catch (_) {} }
      }
      function gpBridgeOrigin() { try { return (window.location && window.location.origin) || "-"; } catch (_) { return "-"; } }
      const GP_IDEMPOTENT_RE = /\/api\/gst\/(ping|health|fetch-status)$/;
      async function gpCallBridge(endpoint, bodyObj, callOpts) {
        const o = callOpts || {};
        const idem = bodyObj === null || GP_IDEMPOTENT_RE.test(endpoint) || /\/api\/gst\/init-login$/.test(endpoint);
        const waits = (o.retry === false || !idem) ? [0] : [0, 1800, 4500];
        let lastErr = null;
        for (let i = 0; i < waits.length; i++) {
          if (waits[i]) await new Promise(r => setTimeout(r, waits[i]));
          if (o.signal && o.signal.aborted) { const e = new Error("Aapne cancel kiya."); e.aborted = true; throw e; }
          try {
            const res = await gpCallBridgeOnce(endpoint, bodyObj, callOpts);
            gpBridgeMark(true);
            return res;
          } catch (e) {
            lastErr = e;
            if (!(e && e.network)) throw e;
            gpBridgeMark(false);
            if (i < waits.length - 1 && typeof o.onRetry === "function") {
              try { o.onRetry(i + 1, waits[i + 1]); } catch (_) {}
            }
          }
        }
        throw lastErr;
      }
      // /health me secret nahi chahiye — isliye CORS/auth ka panga nahi
      async function gpBridgeHealth(timeoutMs) {
        const base = gpGetBridgeUrl();
        if (!base) return { ok: false, reason: "Bridge URL set nahi hai" };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), Math.max(2000, Number(timeoutMs) || 6000));
        const t0 = Date.now();
        try {
          const r = await fetch(base + "/health", { method: "GET", signal: ctrl.signal, cache: "no-store" });
          const txt = await r.text();
          let d = null; try { d = JSON.parse(txt); } catch (_) {}
          const ms = Date.now() - t0;
          if (r.ok && d && d.ok) { gpBridgeMark(true); return { ok: true, ms, data: d, url: base }; }
          gpBridgeMark(false);
          return { ok: false, ms, http: r.status, reason: "HTTP " + r.status, url: base };
        } catch (e) {
          gpBridgeMark(false);
          const msg = (e && e.message) ? e.message : "network error";
          return { ok: false, ms: Date.now() - t0, reason: /abort/i.test(msg) ? "timeout" : msg, url: base };
        } finally { clearTimeout(timer); }
      }
      // Bridge down ho to chup-chaap fail na karo — thodi der khud intezaar karo
      async function gpWaitBridgeUp(maxMs, onTick) {
        const t0 = Date.now();
        let attempt = 0;
        while (true) {
          attempt++;
          const h = await gpBridgeHealth(6000);
          if (h.ok) return h;
          if (typeof onTick === "function") { try { onTick(attempt, Math.round((Date.now() - t0) / 1000), h); } catch (_) {} }
          if (Date.now() - t0 >= Math.max(0, Number(maxMs) || 0)) return { ok: false, last: h };
          await new Promise(r => setTimeout(r, 2500));
        }
      }
      // ===== GSTR-2B / E-Com options: yaad rakho + dono off par rok =====
      const K_OPT2B = "gst_opt_2b_v1", K_OPT_TCS = "gst_opt_tcs_v1";
      function gpReadOptions() {
        const a = document.getElementById("gpOpt2b"), b = document.getElementById("gpOptTcs");
        return { gstr2b: !!(a && a.checked), tcs: !!(b && b.checked), notices: false };
      }
      function gpSaveOptions() {
        try {
          localStorage.setItem(K_OPT2B, document.getElementById("gpOpt2b")?.checked ? "1" : "0");
          localStorage.setItem(K_OPT_TCS, document.getElementById("gpOptTcs")?.checked ? "1" : "0");
        } catch (_) {}
      }
      function gpInitOptions() {
        const apply = () => {
          try {
            const a = localStorage.getItem(K_OPT2B), b = localStorage.getItem(K_OPT_TCS);
            const ea = document.getElementById("gpOpt2b"), eb = document.getElementById("gpOptTcs");
            if (ea && a !== null) ea.checked = a === "1";
            if (eb && b !== null) eb.checked = b === "1";
          } catch (_) {}
        };
        apply();
        // Safari/iOS reload par form-state restore hota hai — uske baad phir apni saved value lagao
        try { window.addEventListener("pageshow", () => setTimeout(apply, 50)); } catch (_) {}
        try { window.addEventListener("pageshow", () => setTimeout(apply, 400)); } catch (_) {}
        document.getElementById("gpOpt2b")?.addEventListener("change", gpSaveOptions);
        document.getElementById("gpOptTcs")?.addEventListener("change", gpSaveOptions);
      }

      async function gpCallBridgeOnce(endpoint, bodyObj, callOpts) {
        const base = gpGetBridgeUrl();
        if (!base) {
          document.getElementById("gpSettingsDrawer")?.classList.remove("hidden");
          throw new Error("Bridge Server URL set karein (⚙️ Settings).");
        }
        const headers = { "Content-Type": "application/json" };
        const sec = gpGetBridgeSec();
        if (sec) headers["x-api-secret"] = sec;
        const o = callOpts || {};
        const timeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : 120000;
        const ctrl = new AbortController();
        const onOuterAbort = () => ctrl.abort();
        if (o.signal) {
          if (o.signal.aborted) ctrl.abort();
          else o.signal.addEventListener("abort", onOuterAbort, { once: true });
        }
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        let resp;
        try {
          resp = await fetch(base + endpoint, {
            method: bodyObj === null ? "GET" : "POST",
            headers,
            body: bodyObj === null ? undefined : JSON.stringify(bodyObj),
            signal: ctrl.signal
          });
        } catch (err) {
          clearTimeout(timer);
          if (o.signal) o.signal.removeEventListener("abort", onOuterAbort);
          const aborted = !!(err && (err.name === "AbortError" || /abort/i.test(String(err.message || ""))));
          if (aborted) {
            const e = new Error((o.signal && o.signal.aborted)
              ? "Aapne cancel kiya."
              : `Bridge ne ${Math.round(timeoutMs / 60000)} min me jawab nahi diya (timeout). Dobara try karein.`);
            e.aborted = true;
            throw e;
          }
          const _msg = (err && err.message) ? err.message : "network error";
          const _origin = (() => { try { return (window.location && window.location.origin) || "-"; } catch (_) { return "-"; } })();
          const e2 = new Error(`Bridge se connect nahi ho paya (${_msg}) — URL: ${base} · origin: ${_origin}. Internet / Bridge URL / CORS check karein.`);
          e2.network = true;
          e2.bridgeUrl = base;
          e2.origin = _origin;
          throw e2;
        }
        clearTimeout(timer);
        if (o.signal) o.signal.removeEventListener("abort", onOuterAbort);
        // Bridge kabhi HTML error page (502/504/timeout) bhej deta hai -> seedha resp.json() phatta tha
        let raw = "";
        try { raw = await resp.text(); } catch (_) { raw = ""; }
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
        if (!data) {
          const short = String(raw || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
          const e = new Error(`Bridge ne JSON ke bajaye HTTP ${resp.status} bheja${short ? " (" + short + ")" : ""}. Thodi der baad try karein.`);
          e.data = { ok: false, httpStatus: resp.status, rawExcerpt: short };
          throw e;
        }
        if (!resp.ok || !data.ok) {
          const e = new Error(data.error || ("HTTP " + resp.status));
          e.data = data;
          throw e;
        }
        return data;
      }

      async function gpSaveToGstDetailsSheet(clientWrap, data, saveDrive) {
        const periodLabel = `${data.fy || document.getElementById("gpFySel")?.value || "2026-27"} / ${String(data.month || document.getElementById("gpMonSel")?.value || "10").padStart(2, "0")}`;
        const prevSamePeriod = clientWrap._ref.portalData && gpIsPeriodMatch(clientWrap._ref.portalData.period);
        const _prevPd = prevSamePeriod ? clientWrap._ref.portalData : null;
        const merged = gpMergePortalSaveData(_prevPd, data, periodLabel);
        const localPortalObj = merged.localPortalObj;
        localPortalObj.updatedAt = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const prevDrive = localPortalObj.driveLink || "";
        const prevDocCol = !!localPortalObj.docCollected;
        const _b2bPack = merged.b2bPack;
        const ecoPlat = merged.ecomPlatforms;
        const ecoList = merged.ecoList;

        clientWrap._ref.portalData = localPortalObj;
        if (typeof saveClients === "function") saveClients();

        if (typeof postVerifiedToAppsScript !== "function" || !scriptUrl) {
          return { ok: false, label: "⚠️ Sheet URL missing", driveLink: prevDrive };
        }

        const res = await postVerifiedToAppsScript({
          action: "savePortalClientData",
          category: clientWrap.category,
          client: clientWrap.clientName,
          gstin: clientWrap.gstin,
          fy: data.fy || "",
          month: data.month || "",
          period: periodLabel,
          noticesCount: 0,
          noticesSummary: "",
          igst: localPortalObj.igst,
          cgst: localPortalObj.cgst,
          sgst: localPortalObj.sgst,
          cess: localPortalObj.cess,
          ineligible: localPortalObj.ineligible,
          suppliers: localPortalObj.suppliers,
          ecomGross: localPortalObj.ecomGross,
          ecomNet: localPortalObj.ecomNet,
          ecomTcs: localPortalObj.ecomTcs,
          ecomPlatforms: ecoPlat,
          b2bSellersJson: _b2bPack.json,
          b2bJsonNote: _b2bPack.note,
          ecoListJson: JSON.stringify(ecoList),
          docCollected: prevDocCol,
          gstr2bStatus: merged.gstr2bStatus,
          saveDrive: !!saveDrive,
          gstr2bFileName: data.gstr2b?.fileName || "",
          gstr2bJsonBase64: saveDrive ? (data.gstr2b?.jsonBase64 || "") : ""
        });

        if (res.ok) {
          if (res.data?.driveLink) clientWrap._ref.portalData.driveLink = res.data.driveLink;
          if (res.data?.updatedAt) clientWrap._ref.portalData.updatedAt = res.data.updatedAt;
          if (typeof saveClients === "function") saveClients();
          const isPartialSave = !!(localPortalObj.partialNote || localPortalObj.missing?.gstr2b || localPortalObj.missing?.tcs);
          const okLabel = isPartialSave
            ? "⚠️ Adhoora Sheet Synced"
            : (res.data?.driveLink && saveDrive ? "📗 Synced + ☁️ Drive" : "📗 GST Details Synced");
          return {
            ok: true,
            label: okLabel,
            driveLink: res.data?.driveLink || prevDrive
          };
        }
        return { ok: false, label: "❌ " + (res.message || "Sheet Err"), driveLink: prevDrive };
      }

      function gpUpdateQuickButtons() {
        const cur = gpGetBridgeUrl();
        const isPc = cur.includes("localhost") || cur.includes("127.0.0.1") || cur.includes("trycloudflare.com");
        const pcBtn = document.getElementById("gpQuickPcBtn");
        const clBtn = document.getElementById("gpQuickCloudBtn");
        if (pcBtn) pcBtn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold border transition " + (isPc ? "bg-emerald-600 border-emerald-600 text-white" : "bg-emerald-50 border-emerald-200 text-emerald-800");
        if (clBtn) clBtn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold border transition " + (!isPc && cur ? "bg-sky-600 border-sky-600 text-white" : "bg-sky-50 border-sky-200 text-sky-800");
      }

      // ---- Error history (page refresh ke baad bhi rahe) ----
      const GP_ERRLOG_KEY = "gst_gp_errlog_v1";
      function gpErrLogAll() { try { return JSON.parse(localStorage.getItem(GP_ERRLOG_KEY) || "{}") || {}; } catch (_) { return {}; } }
      function gpErrLogAdd(clientKey, msg) {
        if (!clientKey || !msg) return;
        const all = gpErrLogAll();
        const arr = Array.isArray(all[clientKey]) ? all[clientKey] : [];
        arr.unshift({ at: Date.now(), msg: String(msg).slice(0, 300) });
        all[clientKey] = arr.slice(0, 3);
        try { localStorage.setItem(GP_ERRLOG_KEY, JSON.stringify(all)); } catch (_) {}
      }
      function gpErrLogGet(clientKey) { const a = gpErrLogAll()[clientKey]; return Array.isArray(a) ? a : []; }
      function gpErrLogClear(clientKey) { const all = gpErrLogAll(); if (!all[clientKey]) return; delete all[clientKey]; try { localStorage.setItem(GP_ERRLOG_KEY, JSON.stringify(all)); } catch (_) {} }

      // ---- "Adhoora" filter: fail hua, ya partial data save hua ----
      function gpIsAdhoora(c) {
        const pd = gpGetActivePortalData(c);
        const st = gpGetState(c.clientKey);
        if (st && (st.phase === "error" || st.partialNote)) return true;
        return !!(pd && (pd.partialNote || (pd.missing && (pd.missing.gstr2b || pd.missing.tcs))));
      }
      function gpAdhooraClients() { return gpGetAppClients().filter(gpIsAdhoora); }

      function gpGetFilteredClients() {
        const all = gpGetAppClients();
        const q = (document.getElementById("gpSearchInp")?.value || "").trim().toLowerCase();
        return all.filter(c => {
          const pd = gpGetActivePortalData(c);
          const hasEcom = !!(pd && (Number(pd.ecomGross || 0) > 0 || Number(pd.ecomTcs || 0) > 0));
          if (gpCategoryFilter === "PAID CLINTS" && c.category !== "PAID CLINTS") return false;
          if (gpCategoryFilter === "Apne" && c.category !== "Apne") return false;
          if (gpCategoryFilter === "FETCHED" && !pd) return false;
          if (gpCategoryFilter === "PENDING" && pd) return false;
          if (gpCategoryFilter === "ECOM_NONZERO" && !hasEcom) return false;
          if (gpCategoryFilter === "DOC_PENDING" && !(hasEcom && !pd.docCollected)) return false;
          if (gpCategoryFilter === "JSON_READY" && !(c.gstin && gpMatchedJsons.has(c.gstin))) return false;
          if (gpCategoryFilter === "ADHOORA" && !gpIsAdhoora(c)) return false;
          if (!q) return true;
          const hay = `${c.sheetSr} #${c.sheetSr} ${c.sr} ${c.clientName} ${c.firm} ${c.gstin} ${c.portalId}`.toLowerCase();
          return hay.includes(q);
        });
      }

      function gpUpdateBadgesAndProgress() {
        const all = gpGetAppClients();
        const ready = all.filter(c => c.portalId && c.rawPassword).length;
        const activeFetched = all.filter(c => !!gpGetActivePortalData(c));
        const fetched = activeFetched.length;
        const hasAnyOldData = all.some(c => !!c.portalData && !gpGetActivePortalData(c));
        const pct = all.length ? Math.round((fetched / all.length) * 100) : 0;

        const rb = document.getElementById("gpReadyBadge");
        const ab = document.getElementById("gpActiveFetchBadge");
        if (rb) rb.textContent = `${ready}/${all.length} Ready`;

        const ecomClients = activeFetched.filter(c => {
          const pd = gpGetActivePortalData(c);
          return Number(pd.ecomGross || 0) > 0 || Number(pd.ecomTcs || 0) > 0;
        });
        const docPend = ecomClients.filter(c => !gpGetActivePortalData(c).docCollected).length;

        const ecEl = document.getElementById("gpEcomNonZeroCount");
        if (ecEl) ecEl.textContent = `(${ecomClients.length})`;
        const dpEl = document.getElementById("gpDocPendingCount");
        if (dpEl) dpEl.textContent = `(${docPend})`;
        const jrEl = document.getElementById("gpJsonReadyCount");
        if (jrEl) jrEl.textContent = `(${gpMatchedJsons.size})`;
        const adEl = document.getElementById("gpAdhooraCount");
        if (adEl) adEl.textContent = `(${gpAdhooraClients().length})`;
        if (ab) {
          ab.textContent = `⚡ ${gpActiveFetches} Active...`;
          ab.classList.toggle("hidden", gpActiveFetches <= 0);
        }

        const fc = document.getElementById("gpKpiFetchedCount");
        const tc = document.getElementById("gpKpiTotalCount");
        const pp = document.getElementById("gpKpiProgressPct");
        const pb = document.getElementById("gpKpiProgressBar");
        if (fc) fc.textContent = String(fetched);
        if (tc) tc.textContent = `/ ${all.length} clients`;
        if (pp) pp.textContent = `${pct}%`;
        if (pb) pb.style.width = `${pct}%`;

        const nmBanner = document.getElementById("gpNewMonthBanner");
        const nmTitle = document.getElementById("gpNewMonthTitle");
        if (nmBanner) nmBanner.classList.toggle("hidden", !(fetched === 0 && hasAnyOldData));
        if (nmTitle) nmTitle.textContent = `${gpGetSelectedPeriod()} — Saara GSTR-2B & E-Com Data Blank Hai!`;
      }

      function gpBuildDrawerHtml(c, st) {
        const pd = c.portalData;
        if (!pd) return "";
        let sellers = Array.isArray(pd.b2bSellers) && pd.b2bSellers.length ? pd.b2bSellers : (st.liveRawData ? gpExtractB2bSellersFromData(st.liveRawData) : []);
        const ecoList = (Array.isArray(pd.ecoList) && pd.ecoList.length)
          ? pd.ecoList
          : (pd.ecomPlatforms ? [{ name: pd.ecomPlatforms, gstin: "", gross: pd.ecomGross || 0, tcs: pd.ecomTcs || 0 }] : []);

        let drivePart = "";
        if (pd.driveLink) {
          drivePart = `<a href="${gpEsc(pd.driveLink)}" target="_blank" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition">☁️ 2B JSON Saved ↗</a>`;
        } else if (st.driveSaving) {
          drivePart = `<span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold">⏳ Saving Drive...</span>`;
        } else if (st.liveRawData?.gstr2b?.jsonBase64) {
          drivePart = `<button type="button" class="gp-manual-drive-btn px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition" data-k="${gpEsc(c.clientKey)}">☁️ Save 2B to Drive</button>`;
        }

        const supCount = sellers.length || Number(pd.suppliers || 0);
        const sellerBtn = supCount > 0
          ? `<div class="flex items-center gap-1.5">
              <span class="text-[11px] font-semibold text-slate-600">${supCount} B2B Sellers</span>
              <button type="button" class="gp-open-b2b-btn px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-bold transition" data-k="${gpEsc(c.clientKey)}" title="B2B Invoices Detail Dekhein">↗</button>
            </div>`
          : `<span class="text-[11px] font-medium text-slate-400">0 B2B Sellers</span>`;


        const is2bMissing = !!(pd.missing && pd.missing.gstr2b);
        const isTcsMissing = !!(pd.missing && pd.missing.tcs);
        const isPartial = !!(is2bMissing || isTcsMissing || st.partialNote || pd.partialNote);
        const gstr2bBodyHtml = pd.gstr2bNotGenerated
          ? `<div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 text-xs text-slate-600 italic">Is month ki GSTR-2B generate nahi hui hai (portal par koi record nahi / pichhli 3B pending / QRMP quarter).</div>`
          : (is2bMissing
            ? `<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-xs text-amber-800 font-medium">⚠️ GSTR-2B portal se fetch nahi ho paya (purana valid data bhi nahi tha) — dobara Fetch karke retry karein.</div>`
            : `<div class="grid grid-cols-3 gap-2">
                <div class="bg-slate-50 rounded-lg p-2.5">
                  <div class="text-[10px] text-slate-400 font-semibold">IGST</div>
                  <div class="text-sm font-bold text-slate-900 tabular-nums mt-0.5">${gpFmtInr(pd.igst)}</div>
                </div>
                <div class="bg-slate-50 rounded-lg p-2.5">
                  <div class="text-[10px] text-slate-400 font-semibold">CGST</div>
                  <div class="text-sm font-bold text-slate-900 tabular-nums mt-0.5">${gpFmtInr(pd.cgst)}</div>
                </div>
                <div class="bg-slate-50 rounded-lg p-2.5">
                  <div class="text-[10px] text-slate-400 font-semibold">SGST</div>
                  <div class="text-sm font-bold text-slate-900 tabular-nums mt-0.5">${gpFmtInr(pd.sgst)}</div>
                </div>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-3">
                  <span>Cess: <b class="text-slate-700">${gpFmtInr(pd.cess)}</b></span>
                  <span>Ineligible: <b class="${Number(pd.ineligible || 0) > 0 ? "text-amber-700" : "text-slate-700"}">${gpFmtInr(pd.ineligible)}</b></span>
                </div>
                ${drivePart}
              </div>`);

        const tcsBodyHtml = isTcsMissing
          ? `<div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-xs text-amber-800 font-medium">⚠️ E-Com / TCS portal se fetch nahi ho paya — dobara Fetch karke retry karein.</div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div class="sm:col-span-5 bg-emerald-50/60 rounded-lg p-2.5 border border-emerald-100 flex flex-col justify-center">
                    <div class="text-[10px] text-emerald-700 font-semibold">Gross Taxable</div>
                    <div class="text-sm font-extrabold text-emerald-800 tabular-nums mt-0.5">${gpFmtInr(pd.ecomGross)}</div>
                  </div>
                  <div class="sm:col-span-7 bg-slate-50 rounded-lg p-2.5 space-y-1.5">
                    <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">TCS Platform &amp; GSTIN</div>
                    ${ecoList.length ? ecoList.map(e => `
                      <div class="flex items-center justify-between gap-1.5 text-[11px]">
                        <div class="min-w-0 truncate">
                          <span class="font-semibold text-slate-800">${gpEsc(e.name)}</span>
                          ${e.gstin ? `<span class="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">${gpEsc(e.gstin)}</span>` : ""}
                        </div>
                        ${e.gstin ? `<button type="button" data-copy-gstin="${gpEsc(e.gstin)}" class="gp-copy-gstin-btn shrink-0 px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[10px] text-slate-600" title="Copy ECO GSTIN">📋</button>` : ""}
                      </div>`).join("") : '<div class="text-[11px] text-slate-400 italic">Koi E-Commerce TCS nahi kata</div>'}
                  </div>
                </div>`;

        const syncLabelText = st.sheetStatus || ((isPartial ? "⚠️ Adhoora Sync" : "📗 Synced") + (pd.updatedAt ? " • " + pd.updatedAt : ""));

        return `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div class="bg-white rounded-xl border ${is2bMissing ? "border-amber-200" : "border-slate-200/90"} p-3.5 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">GSTR-2B ITC Summary</span>
                ${sellerBtn}
              </div>
              ${gstr2bBodyHtml}
            </div>

            <div class="bg-white rounded-xl border ${isTcsMissing ? "border-amber-200" : "border-slate-200/90"} p-3.5 flex flex-col justify-between space-y-2.5">
              <div class="space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">E-Commerce Gross &amp; TCS</span>
                  <span class="text-[11px] font-semibold ${isTcsMissing ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50"} px-2 py-0.5 rounded-md">${isTcsMissing ? "TCS Fail" : ("TCS " + gpFmtInr(pd.ecomTcs))}</span>
                </div>
                ${tcsBodyHtml}
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Period: <b class="text-slate-700 font-mono">${gpEsc(pd.period || "—")}</b></span>
                <span class="${isPartial ? "text-amber-700" : "text-emerald-700"} font-semibold shrink-0">${gpEsc(syncLabelText)}</span>
              </div>
            </div>
          </div>`;
      }

      let gpCooldownTimer = null;
      function gpCooldownActive() {
        let any = false;
        gpRowState.forEach(st => { if (st && st.cooldownUntil && st.cooldownUntil > Date.now()) any = true; });
        return any;
      }
      function gpEnsureCooldownTicker() {
        if (gpCooldownTimer) return;
        gpCooldownTimer = setInterval(() => {
          if (!gpCooldownActive()) { clearInterval(gpCooldownTimer); gpCooldownTimer = null; }
          gpRenderSerialList();
        }, 1000);
      }

      // ===== Android APK: app ke andar portal khulein, ID/password pehle se bhare (sirf captcha dalna) =====
      function gpNativePortalBtn(c) {
        if (!window.CloudGSTNative || !c.portalId || !c.rawPassword) return "";
        return `<div class="mb-1"><button type="button" class="gp-native-portal-btn px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold w-full" data-k="${gpEsc(c.clientKey)}" title="App ke andar GST portal khulega, ID/password pehle se bhare hue — aapko sirf captcha dalna hai">🌐 Portal Login</button></div>`;
      }

      async function gpNativeOpenPortal(clientKey) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        if (!c) return;
        if (!window.CloudGSTNative) return gpToast("⚠️ Portal Login sirf Android app me chalta hai.");
        if (!c.portalId) return gpToast("⚠️ Portal ID save nahi hai — ✏️ se add karein.");
        const pwRes = await gpResolvePassword(c);
        if ((!pwRes.ok && pwRes.reason === "locked") || (!pwRes.pw && pwRes.reason === "locked")) {
          if (window.gpAskAppPassword) {
            gpAskAppPassword("👆 Fingerprint se app khula hai — is client ka portal password decrypt karne ke liye app ka password dalein.");
          }
          return gpToast("🔐 Client password dekhne ke liye app password dalein");
        }
        if (!pwRes.ok || !pwRes.pw || pwRes.pw.startsWith("enc:")) {
          return gpToast("⚠️ Password decrypt nahi hua — ✏️ se plain password save karein.");
        }
        try {
          // month/FY bhi bhejo -> app ke portal screen me "GSTR-1" button us month ka page kholta hai
          const fp = (typeof gpGetSelectedFp === "function") ? gpGetSelectedFp() : "";
          const perLabel = (typeof gpGetSelectedMonthDisplay === "function") ? gpGetSelectedMonthDisplay() : "";
          window.CloudGSTNative.openPortal(String(c.portalId || "").trim(), String(pwRes.pw || "").trim(), String(c.gstin || ""), String(fp || ""), String(perLabel || ""));
          // 📱 Phone mode: yaad rakho ki phone par is client ka portal login khula hai
          gpPhoneLoginClient(String(c.gstin || c.portalId || "").trim());
        } catch (e) {
          gpToast("❌ App ne portal nahi khola: " + (e.message || e));
        }
      }

      function gpBuildActionCellHtml(c, st, ready, isExp, pd) {
        if (!ready) {
          return `<button type="button" class="gp-edit-btn px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold" data-sr="${gpEsc(c.sr)}">✏️ Add Pass</button>`;
        }
        if (st.phase === "loading_cap") return '<span class="text-xs font-semibold text-indigo-600">⏳ Captcha...</span>';
        if (st.phase === "captcha") {
          const isUp = st.pendingAction === "UPLOAD";
          return `<div class="inline-flex flex-wrap items-center gap-1.5 justify-end">
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isUp ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-700"}">${isUp ? "GSTR-1" : "Fetch"}</span>
            <img src="${st.captchaBase64}" alt="Captcha" class="h-9 rounded-lg border border-slate-300 bg-white px-1 object-contain" />
            <input type="text" autocomplete="off" placeholder="Code" class="gp-cap-inp w-20 px-2 py-1.5 rounded-lg border ${isUp ? "border-purple-400" : "border-indigo-400"} text-xs font-mono bg-white outline-none" data-k="${gpEsc(c.clientKey)}" />
            <button type="button" class="gp-cap-submit-btn px-2.5 py-1.5 rounded-lg ${isUp ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white text-[11px] font-semibold" data-k="${gpEsc(c.clientKey)}">${isUp ? "Upload" : "Go"}</button>
            <button type="button" class="gp-cap-reload-btn px-1.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]" data-k="${gpEsc(c.clientKey)}" title="Refresh Captcha">🔄</button>
            <button type="button" class="gp-cap-cancel-btn px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold" data-k="${gpEsc(c.clientKey)}" title="Cancel Captcha">✕</button>
          </div>`;
        }
        if (st.phase === "otp") {
          return `<div class="inline-flex items-center gap-1.5 justify-end">
            <input type="text" placeholder="OTP" class="gp-otp-inp w-20 px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-mono outline-none" data-k="${gpEsc(c.clientKey)}" />
            <button type="button" class="gp-otp-submit-btn px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-semibold" data-k="${gpEsc(c.clientKey)}">Verify</button>
            <button type="button" class="gp-cap-cancel-btn px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold" data-k="${gpEsc(c.clientKey)}" title="Cancel">✕</button>
          </div>`;
        }
        if (st.phase === "fetching" || st.phase === "saving") {
          const lbl = st.pendingAction === "UPLOAD" ? "Uploading GSTR-1..." : (st.phase === "saving" ? "Saving..." : "Fetching...");
          return `<div class="inline-flex items-center gap-1.5 justify-end">
            <span class="text-xs font-semibold ${st.pendingAction === "UPLOAD" ? "text-purple-700" : "text-indigo-600"}">⏳ ${lbl}${st.progressText ? `<span class="block max-w-[220px] truncate text-[10px] font-normal text-slate-500" title="${gpEsc(st.progressText)}">${gpEsc(st.progressText)}</span>` : ""}</span>
            <button type="button" class="gp-cancel-fetch-btn px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold" data-k="${gpEsc(c.clientKey)}" title="Cancel (portal ka login bhi band ho jayega)">✕</button>
          </div>`;
        }
        // Fail ke baad 90s cool-down: bar-bar retry hi portal ke WAF se block karata hai
        const cdLeft = Math.max(0, Math.ceil(((st.cooldownUntil || 0) - Date.now()) / 1000));
        if (cdLeft > 0) {
          return `<div class="inline-flex items-center gap-1.5 justify-end">
            <button type="button" disabled class="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-semibold cursor-not-allowed" title="Bar-bar retry portal ko block karta hai — thoda rukein">⏳ ${cdLeft}s</button>
            ${pd ? `<button type="button" class="gp-toggle-exp-btn px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition" data-k="${gpEsc(c.clientKey)}">${isExp ? "▴ Hide" : "▾ View"}</button>` : ""}
          </div>`;
        }
        const mj = c.gstin ? gpMatchedJsons.get(c.gstin) : null;
        const wantFp = gpGetSelectedFp();
        const canUpload = !!(mj && (!mj.fp || mj.fp === wantFp) && !mj.uploaded);
        const uploadBtn = canUpload
          ? `<button type="button" class="gp-load-upload-cap-btn px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold transition" data-k="${gpEsc(c.clientKey)}" title="${gpEsc(mj.fileName)}">📤 Upload</button>`
          : "";
        return `<div class="inline-flex items-center gap-1.5 justify-end">
          ${uploadBtn}
          <button type="button" class="gp-load-cap-btn px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${pd ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-slate-900 hover:bg-indigo-600 text-white"}" data-k="${gpEsc(c.clientKey)}">${pd ? "🔄 Re-Fetch" : "🔐 Fetch"}</button>
          ${pd ? `<button type="button" class="gp-toggle-exp-btn px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition" data-k="${gpEsc(c.clientKey)}">${isExp ? "▴ Hide" : "▾ View"}</button>` : ""}
        </div>`;
      }

      function gpRenderSerialList(focusKey) {
        try {
          const _bb = document.getElementById("gpBridgeOfflineBanner");
          if (_bb) _bb.classList.toggle("hidden", !gpBridgeOffline);
          const _bs = document.getElementById("gpBridgeOfflineSub");
          if (_bs && gpBridgeOffline) _bs.textContent = "Bridge server jawab nahi de raha (" + (gpGetBridgeUrl() || "URL set nahi") + ") — app apne aap dobara try karta rahega.";
        } catch (_) {}
        gpUpdateBadgesAndProgress();
        const list = gpGetFilteredClients();
        const thead = document.getElementById("gpSerialTableHead");
        const tbody = document.getElementById("gpSerialTableBody");
        const expBtn = document.getElementById("gpExpandAllBtn");
        const credsBtn = document.getElementById("gpToggleCredsModeBtn");

        if (credsBtn) {
          credsBtn.textContent = gpCredsMode ? "↩ Back to Portal Data" : "🔑 ID / Password";
          credsBtn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-xs " + (gpCredsMode
            ? "bg-slate-900 hover:bg-slate-800 text-white"
            : "bg-indigo-600 hover:bg-indigo-700 text-white");
        }
        if (expBtn) expBtn.classList.toggle("hidden", gpCredsMode);

        if (gpCredsMode) {
          if (thead) {
            thead.innerHTML = `
              <tr class="bg-indigo-50/80 border-b border-indigo-200 text-[11px] font-semibold uppercase tracking-wider text-indigo-900">
                <th class="py-3 pl-4 pr-2 w-16">Sr #</th>
                <th class="py-3 px-3">Client &amp; GSTIN</th>
                <th class="py-3 px-3">Portal User ID</th>
                <th class="py-3 px-3">Portal Password</th>
                <th class="py-3 pl-3 pr-4 text-right">Action</th>
              </tr>`;
          }
          if (tbody) {
            tbody.innerHTML = list.length ? list.map(c => {
              const st = gpGetState(c.clientKey);
              const pwHtml = !c.rawPassword
                ? '<span class="text-slate-400 italic">No Pass</span>'
                : (st.showPw ? `<span class="font-mono font-semibold text-slate-900 gp-pw-plain" data-k="${gpEsc(c.clientKey)}">...</span>` : '<span class="font-mono text-slate-500">••••••••</span>');
              return `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-3 pl-4 pr-2 align-middle"><span class="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold flex items-center justify-center">${gpEsc(c.sheetSr)}</span></td>
                  <td class="py-3 px-3 align-middle">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-slate-900 text-xs sm:text-[13px]">${gpEsc(c.clientName)}</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.category === "Apne" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}">${c.category === "Apne" ? "Apne" : "PAID"}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">${c.firm ? gpEsc(c.firm) + " • " : ""}<span class="font-mono text-slate-400">${gpEsc(c.gstin || "No GSTIN")}</span></div>
                  </td>
                  <td class="py-3 px-3 align-middle">
                    <div class="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                      <span class="font-mono font-semibold text-slate-800">${gpEsc(c.portalId || "—")}</span>
                      ${c.portalId ? `<button type="button" data-copy-cred="${gpEsc(c.portalId)}" class="gp-copy-cred-btn text-slate-400 hover:text-indigo-700 text-xs" title="Copy ID">📋</button>` : ""}
                    </div>
                  </td>
                  <td class="py-3 px-3 align-middle">
                    <div class="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                      ${pwHtml}
                      ${c.rawPassword ? `<button type="button" class="gp-eye-btn text-slate-500 hover:text-slate-900 text-xs" data-k="${gpEsc(c.clientKey)}" title="Show/Hide">${st.showPw ? "🙈" : "👁️"}</button>` : ""}
                      ${c.rawPassword ? `<button type="button" class="gp-copy-pw-btn text-slate-400 hover:text-indigo-700 text-xs" data-k="${gpEsc(c.clientKey)}" title="Copy Password">📋</button>` : ""}
                    </div>
                  </td>
                  <td class="py-3 pl-3 pr-4 align-middle text-right">
                    <button type="button" class="gp-edit-btn px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 text-[11px] font-semibold transition" data-sr="${gpEsc(c.sr)}">✏️ Edit</button>
                  </td>
                </tr>`;
            }).join("") : '<tr><td colspan="5" class="py-10 text-center text-xs text-slate-400">Koi client match nahi hua.</td></tr>';
          }
        } else {
          if (thead) {
            thead.innerHTML = `
              <tr class="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th class="py-3 pl-4 pr-2 w-16">Sr #</th>
                <th class="py-3 px-3">Client &amp; GSTIN</th>
                <th class="py-3 px-3 text-right">GSTR-2B ITC</th>
                <th class="py-3 px-3 text-right">E-Com Gross</th>
                <th class="py-3 px-3 text-center">Doc Collection</th>
                <th class="py-3 px-3 text-center">Status</th>
                <th class="py-3 pl-3 pr-4 text-right">Action / Captcha</th>
              </tr>`;
          }
          if (tbody) {
            const waSvg = (typeof WA_ICON_SVG !== "undefined") ? WA_ICON_SVG : "💬";
            tbody.innerHTML = list.length ? list.map(c => {
              const st = gpGetState(c.clientKey);
              const pd = gpGetActivePortalData(c);
              const ready = !!(c.portalId && c.rawPassword);
              const isExp = !!pd && gpExpanded.has(c.clientKey);
              const itcSum = pd ? (Number(pd.igst || 0) + Number(pd.cgst || 0) + Number(pd.sgst || 0) + Number(pd.cess || 0)) : 0;
              const hasEcom = !!(pd && (Number(pd.ecomGross || 0) > 0 || Number(pd.ecomTcs || 0) > 0));

              let docCellHtml = '<span class="text-slate-300">—</span>';
              if (hasEcom) {
                const isRec = !!pd.docCollected;
                const docStatusBtn = isRec
                  ? `<button type="button" data-doc-k="${gpEsc(c.clientKey)}" class="gp-doc-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"><span>✓ Received</span></button>`
                  : `<button type="button" data-doc-k="${gpEsc(c.clientKey)}" class="gp-doc-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"><span>⏳ Pending</span></button>`;
                docCellHtml = `
                  <div class="inline-flex items-center gap-1.5">
                    ${docStatusBtn}
                    <button type="button" data-wa-k="${gpEsc(c.clientKey)}" class="gp-wa-doc-btn inline-flex items-center justify-center p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition" title="WhatsApp: Etsy Statement / Transport Bill mangein">${waSvg}</button>
                  </div>`;
              }

              let statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">Pending</span>';
              if (st.phase === "fetching" || st.phase === "saving") statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 animate-pulse">Working...</span>';
              else if (st.phase === "error") statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200" title="${gpEsc(st.note)}">Error</span>`;
              else if (pd && (st.partialNote || pd.partialNote || (pd.missing && (pd.missing.gstr2b || pd.missing.tcs)))) statusBadge = `<div class="inline-flex flex-col items-center gap-0.5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="${gpEsc(st.partialNote || pd.partialNote || "Kuch section portal se nahi mila.")}">⚠️ Adhoora</span><span class="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">${gpEsc(pd.period || "")}${pd.updatedAt ? " • " + gpEsc(pd.updatedAt) : ""}</span></div>`;
              else if (pd) statusBadge = `<div class="inline-flex flex-col items-center gap-0.5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Synced</span><span class="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">${gpEsc(pd.period || "")}${pd.updatedAt ? " • " + gpEsc(pd.updatedAt) : ""}</span></div>`;

              const mjBadge = (function() {
                const mj = c.gstin ? gpMatchedJsons.get(c.gstin) : null;
                if (!mj) return "";
                const wantFp = gpGetSelectedFp();
                const matchFp = !mj.fp || mj.fp === wantFp;
                if (mj.uploaded) return `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">✅ GSTR-1 Uploaded (${gpEsc(mj.fp || wantFp)})</div>`;
                if (!matchFp) return `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold" title="${gpEsc(mj.fileName)}">⚠️ JSON Month Mismatch (${gpEsc(mj.fp)})</div>`;
                return `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-bold" title="${gpEsc(mj.fileName)}">🧾 GSTR-1 Ready • ${mj.invCount} Inv</div>`;
              })();

              const mainRow = `
                <tr class="transition ${isExp ? "bg-indigo-50/30" : "hover:bg-slate-50/80"} ${st.phase === "captcha" ? "bg-indigo-50/50" : ""}">
                  <td class="py-3 pl-4 pr-2 align-middle"><span class="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold flex items-center justify-center">${gpEsc(c.sheetSr)}</span></td>
                  <td class="py-3 px-3 align-middle">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-slate-900 text-xs sm:text-[13px]">${gpEsc(c.clientName)}</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.category === "Apne" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}">${c.category === "Apne" ? "Apne" : "PAID"}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">${c.firm ? gpEsc(c.firm) + " • " : ""}<span class="font-mono text-slate-400">${gpEsc(c.gstin || "No GSTIN")}</span></div>
                    ${mjBadge}
                  </td>
                  <td class="py-3 px-3 align-middle text-right tabular-nums">${pd ? (pd.gstr2bNotGenerated
                    ? `<div class="text-[11px] font-semibold text-slate-500 italic leading-tight" title="Portal ne is month ki GSTR-2B generate hi nahi ki (koi record nahi / pichhli 3B pending / QRMP quarter month) — IMS Dashboard se manual compute karna hoga">not generated this month</div>`
                    : (pd.missing && pd.missing.gstr2b
                      ? `<div class="font-bold text-amber-600 text-[13px]" title="GSTR-2B is baar portal se fetch nahi ho paya (purana data bhi nahi tha)">—</div><div class="text-[10px] text-amber-600 font-semibold">2B fail hua</div>`
                      : `<div class="font-bold text-slate-900 text-[13px]">${gpFmtInr(itcSum)}</div><div class="text-[10px] text-slate-400">I ${gpFmtInr(pd.igst)} · C ${gpFmtInr(pd.cgst)}</div>`)
                  ) : '<span class="text-slate-300">—</span>'}</td>
                  <td class="py-3 px-3 align-middle text-right tabular-nums">${pd ? (pd.missing && pd.missing.tcs ? `<div class="font-bold text-amber-600 text-[13px]" title="E-Com / TCS is baar portal se fetch nahi ho paya">—</div><div class="text-[10px] text-amber-600 font-semibold">TCS fail hua</div>` : `<div class="font-bold ${hasEcom ? "text-emerald-700" : "text-slate-400"} text-[13px]">${gpFmtInr(pd.ecomGross)}</div><div class="text-[10px] text-slate-400">TCS ${gpFmtInr(pd.ecomTcs)}</div>`) : '<span class="text-slate-300">—</span>'}</td>
                  <td class="py-3 px-3 align-middle text-center">${docCellHtml}</td>
                  <td class="py-3 px-3 align-middle text-center">${statusBadge}</td>
                  <td class="py-3 pl-3 pr-4 align-middle text-right">${gpNativePortalBtn(c)}${gpBuildActionCellHtml(c, st, ready, isExp, pd)}</td>
                </tr>`;

              const _errLog = gpErrLogGet(c.clientKey);
              const _errWhen = h => h ? new Date(h.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
              const errStrip = (st.phase === "error" && st.note)
                ? `<tr class="bg-rose-50/80 border-b border-rose-100"><td colspan="7" class="px-4 py-2 text-xs text-rose-700 font-medium">❌ ${gpEsc(st.note)}${_errLog.length > 1 ? ` <span class="text-rose-500 font-semibold">• is client par total ${_errLog.length} baar fail (pichhla: ${gpEsc(_errWhen(_errLog[1]))})</span>` : ""}</td></tr>`
                : (_errLog.length ? `<tr class="bg-slate-50 border-b border-slate-100"><td colspan="7" class="px-4 py-1.5 text-[11px] text-slate-500">ℹ️ Pichhli koshish fail hui thi: ${gpEsc(_errLog[0].msg)} <span class="text-slate-400">(${gpEsc(_errWhen(_errLog[0]))})</span> — ab theek hai</td></tr>` : "");
              const detailRow = isExp ? `<tr class="bg-slate-50/80 border-b border-slate-200/80"><td colspan="7" class="px-4 py-3.5">${gpBuildDrawerHtml(c, st)}</td></tr>` : "";
              const _pnBase = (st.phase === "done" || st.phase === "idle") ? (st.partialNote || (pd && pd.partialNote) || "") : "";
              const _pn = [_pnBase, (pd && pd.b2bJsonNote) ? pd.b2bJsonNote : ""].filter(Boolean).join(" • ");
              const partialStrip = (pd && _pn) ? `<tr class="bg-amber-50/80 border-b border-amber-100"><td colspan="7" class="px-4 py-2 text-xs text-amber-800 font-medium">${gpEsc(_pn)}</td></tr>` : "";
              return mainRow + errStrip + partialStrip + detailRow;
            }).join("") : '<tr><td colspan="7" class="py-10 text-center text-xs text-slate-400">Koi client match nahi hua.</td></tr>';
          }
        }

        document.querySelectorAll("#pagePortalMain .gp-pw-plain").forEach(async (el) => {
          const k = el.getAttribute("data-k");
          const c = list.find(x => x.clientKey === k);
          if (!c) return;
          const res = await gpResolvePassword(c);
          el.textContent = (res.reason === "locked" || res.reason === "encrypted") ? "⚠️ Encrypted (✏️ se fix)" : (res.pw || "—");
        });

        document.querySelectorAll("#pagePortalMain .gp-eye-btn").forEach(b => b.addEventListener("click", () => {
          const st = gpGetState(b.getAttribute("data-k"));
          st.showPw = !st.showPw;
          gpRenderSerialList();
        }));
        document.querySelectorAll("#pagePortalMain .gp-copy-cred-btn").forEach(b => b.addEventListener("click", () => {
          gpCopyText(b.getAttribute("data-copy-cred"), "Portal ID");
        }));
        document.querySelectorAll("#pagePortalMain .gp-copy-pw-btn").forEach(b => b.addEventListener("click", async () => {
          const c = list.find(x => x.clientKey === b.getAttribute("data-k"));
          if (!c) return;
          const r = await gpResolvePassword(c);
          if (r.ok && r.pw) gpCopyText(r.pw, "Password");
          else gpToast("⚠️ Password decrypt nahi hua — ✏️ se plain password save karein.");
        }));
        document.querySelectorAll("#pagePortalMain .gp-edit-btn").forEach(b => b.addEventListener("click", () => {
          const sr = parseInt(b.getAttribute("data-sr"), 10);
          if (typeof openEditModal === "function" && !isNaN(sr)) openEditModal(sr);
        }));
        document.querySelectorAll("#pagePortalMain .gp-doc-btn").forEach(btn => btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          gpOpenDocStatusOption(btn.getAttribute("data-doc-k"), btn);
        }));
        document.querySelectorAll("#pagePortalMain .gp-wa-doc-btn").forEach(b => b.addEventListener("click", () => {
          gpOpenWaDocModal(b.getAttribute("data-wa-k"));
        }));
        document.querySelectorAll("#pagePortalMain .gp-toggle-exp-btn").forEach(b => b.addEventListener("click", () => {
          const k = b.getAttribute("data-k");
          if (gpExpanded.has(k)) { gpExpanded.delete(k); gpClearAutoHide(k); }
          else { gpExpanded.add(k); gpScheduleAutoHide(k); }
          gpRenderSerialList();
        }));
        document.querySelectorAll("#pagePortalMain .gp-native-portal-btn").forEach(b => b.addEventListener("click", () => {
          gpNativeOpenPortal(b.getAttribute("data-k"));
        }));
        document.querySelectorAll("#pagePortalMain .gp-load-cap-btn").forEach(b => b.addEventListener("click", () => {
          gpLoadCaptchaForClient(b.getAttribute("data-k"), "FETCH");
        }));
        document.querySelectorAll("#pagePortalMain .gp-cancel-fetch-btn").forEach(b => b.addEventListener("click", () => {
          const st = gpGetState(b.getAttribute("data-k"));
          if (st.abort) { try { st.abort.abort(); } catch (_) {} }
          if (st.sessionId) gpCallBridge("/api/gst/logout", { sessionId: st.sessionId }).catch(() => {});
        }));
        document.querySelectorAll("#pagePortalMain .gp-load-upload-cap-btn").forEach(b => b.addEventListener("click", () => {
          gpLoadCaptchaForClient(b.getAttribute("data-k"), "UPLOAD");
        }));
        document.querySelectorAll("#pagePortalMain .gp-cap-reload-btn").forEach(b => b.addEventListener("click", () => {
          const k = b.getAttribute("data-k");
          gpLoadCaptchaForClient(k, gpGetState(k).pendingAction || "FETCH");
        }));
        document.querySelectorAll("#pagePortalMain .gp-cap-submit-btn").forEach(b => b.addEventListener("click", () => {
          gpSubmitCaptchaForClient(b.getAttribute("data-k"));
        }));
        document.querySelectorAll("#pagePortalMain .gp-cap-cancel-btn").forEach(b => b.addEventListener("click", () => {
          const k = b.getAttribute("data-k");
          const st = gpGetState(k);
          if (st.sessionId) gpCallBridge("/api/gst/logout", { sessionId: st.sessionId }).catch(() => {});
          st.phase = "idle"; st.sessionId = null; st.captchaBase64 = ""; st.note = "";
          gpRenderSerialList();
        }));
        document.querySelectorAll("#pagePortalMain .gp-cap-inp").forEach(inp => inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); gpSubmitCaptchaForClient(inp.getAttribute("data-k")); }
        }));
        document.querySelectorAll("#pagePortalMain .gp-otp-submit-btn").forEach(b => b.addEventListener("click", () => {
          gpSubmitOtpForClient(b.getAttribute("data-k"));
        }));
        document.querySelectorAll("#pagePortalMain .gp-manual-drive-btn").forEach(b => b.addEventListener("click", () => {
          gpManualSaveDrive(b.getAttribute("data-k"));
        }));
        document.querySelectorAll("#pagePortalMain .gp-open-b2b-btn").forEach(b => b.addEventListener("click", () => {
          const k = b.getAttribute("data-k");
          if (gpExpanded.has(k)) gpScheduleAutoHide(k);
          gpOpenB2bModal(k);
        }));
        document.querySelectorAll("#pagePortalMain .gp-copy-gstin-btn").forEach(b => b.addEventListener("click", () => {
          gpCopyText(b.getAttribute("data-copy-gstin"), "ECO GSTIN");
        }));

        if (focusKey) {
          const inp = document.querySelector(`#pagePortalMain .gp-cap-inp[data-k="${CSS.escape(focusKey)}"]`);
          if (inp) { inp.focus(); inp.scrollIntoView({ behavior: "smooth", block: "center" }); }
        }
      }

      function gpOpenDocStatusOption(clientKey, anchor) {
        const old = document.getElementById("gpDocStatusOption");
        if (old) {
          const same = old.dataset.docKey === String(clientKey);
          old.remove();
          if (same) return;
        }
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        const pd = c ? gpGetActivePortalData(c) : null;
        if (!pd) return;

        const box = document.createElement("div");
        box.id = "gpDocStatusOption";
        box.dataset.docKey = String(clientKey);
        box.style.cssText = "position:fixed;z-index:99999;background:white;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px #0003;padding:12px;";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(pd.docCollected);
        checkbox.setAttribute("aria-label", "Document Received");
        checkbox.style.cssText = "width:20px;height:20px;cursor:pointer;accent-color:#059669;display:block;";
        box.appendChild(checkbox);
        document.body.appendChild(box);

        const rect = anchor.getBoundingClientRect();
        box.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - box.offsetWidth - 4)) + "px";
        box.style.top = (rect.bottom + box.offsetHeight + 4 <= window.innerHeight ? rect.bottom + 4 : Math.max(4, rect.top - box.offsetHeight - 4)) + "px";

        const dismiss = event => {
          if (!box.contains(event.target) && event.target !== anchor && !anchor.contains(event.target)) {
            box.remove();
            document.removeEventListener("pointerdown", dismiss);
          }
        };
        document.addEventListener("pointerdown", dismiss);

        checkbox.addEventListener("change", () => {
          box.remove();
          document.removeEventListener("pointerdown", dismiss);
          if (checkbox.checked !== Boolean(pd.docCollected)) {
            gpToggleDocCollected(clientKey, checkbox.checked);
          }
        });
        checkbox.focus();

        box.addEventListener("keydown", event => {
          if (event.key === "Escape") {
            box.remove();
            document.removeEventListener("pointerdown", dismiss);
            anchor.focus();
          }
        });
      }

      async function gpToggleDocCollected(clientKey, checked) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        const pd = c ? gpGetActivePortalData(c) : null;
        if (!pd) return;
        pd.docCollected = !!checked;
        pd._docLocalTs = Date.now();
        if (typeof saveClients === "function") saveClients();
        gpRenderSerialList();
        if (typeof postVerifiedToAppsScript === "function" && scriptUrl) {
          const res = await postVerifiedToAppsScript({
            action: "saveDocCollected",
            category: c.category,
            client: c.clientName,
            gstin: c.gstin,
            docCollected: !!checked
          }).catch(e => ({ ok: false, message: e?.message || "Network error" }));
          if (res.ok) {
            gpToast(checked
              ? `✅ ${c.clientName}: Doc Received (Sheet Checkbox Synced)`
              : `⏳ ${c.clientName}: Doc Pending (Sheet Checkbox Synced)`);
          } else {
            gpToast(`⚠️ ${c.clientName}: Local save hua, Sheet sync FAIL (${res.message || "GST_Details_AppSync.txt redeploy karein"})`);
          }
        }
      }

      function gpGetSelectedMonthDisplay() {
        const sel = document.getElementById("gpMonSel");
        const label = sel?.options[sel.selectedIndex]?.text || "October";
        return label.replace(/\s*\(\d+\)/, "").trim() + " (" + (document.getElementById("gpFySel")?.value || "2026-27") + ")";
      }

      function gpBuildWaDocMessage(c, tpl) {
        const mName = gpGetSelectedMonthDisplay();
        const firmPart = c.firm ? ` (${c.firm})` : "";
        if (tpl === "etsy") {
          return `Namaste ${c.clientName} ji${firmPart},\n\n${mName} ki GST return filing ke liye kripya apna *Etsy Monthly Statement (sirf CSV file, PDF nahi)* bhej dijiye taaki aapki GSTR-1 samay par file ho sake.\n\nDhanyawad!`;
        }
        if (tpl === "transport") {
          return `Namaste ${c.clientName} ji${firmPart},\n\n${mName} ki GST filing aur export records ke liye kripya is mahine ke *Transport Bills / Courier / Shipping Bills* bhej dijiye.\n\nDhanyawad!`;
        }
        return `Namaste ${c.clientName} ji${firmPart},\n\n${mName} ki GST return filing ke liye kripya ye dono documents bhej dijiye:\n1. *Etsy Monthly Statement (sirf CSV file, PDF nahi)*\n2. *Transport Bills / Shipping Bills*\n\nTaaki aapki return samay par file ho sake. Dhanyawad!`;
      }

      function gpUpdateWaTplUI() {
        if (!gpActiveWaClient) return;
        document.querySelectorAll("#gpWaDocModalOverlay .gp-wa-tpl-btn").forEach(b => {
          const on = b.getAttribute("data-gp-wa-tpl") === gpActiveWaTpl;
          b.className = "gp-wa-tpl-btn px-2 py-2.5 rounded-xl text-center transition " + (on
            ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
            : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold");
        });
        const area = document.getElementById("gpWaDocMsgArea");
        if (area) area.value = gpBuildWaDocMessage(gpActiveWaClient, gpActiveWaTpl);
      }

      function gpOpenWaDocModal(clientKey) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        if (!c) return;
        gpActiveWaClient = c;
        gpActiveWaTpl = "etsy";
        const tEl = document.getElementById("gpWaDocModalTitle");
        const sEl = document.getElementById("gpWaDocModalSub");
        if (tEl) tEl.textContent = `WhatsApp — ${c.clientName}`;
        if (sEl) sEl.textContent = `${c.firm || ""} • 📱 ${c.mobile || "Mobile nahi hai"} • ${gpGetSelectedMonthDisplay()}`;
        gpUpdateWaTplUI();
        document.getElementById("gpWaDocModalOverlay")?.classList.remove("hidden");
      }

      async function gpClearOldMonthInSheet() {
        if (typeof postVerifiedToAppsScript !== "function" || !scriptUrl) {
          return gpToast("⚠️ Pehle GST Details Sheet URL connect karein.");
        }
        const btn = document.getElementById("gpClearSheetMonthBtn");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ Clearing Sheet..."; }
        try {
          const res = await postVerifiedToAppsScript({ action: "clearPortalDataForNewMonth" });
          if (res.ok) {
            if (typeof clients !== "undefined" && Array.isArray(clients)) {
              clients.forEach(c => { c.portalData = null; });
              if (typeof saveClients === "function") saveClients();
            }
            gpExpanded.clear();
            gpRenderSerialList();
            gpToast("🧹 GST Details Sheet se pichhle month ka portal data clear ho gaya — ab naya month fetch karein!");
          } else {
            gpToast("❌ Sheet clear fail: " + (res.message || "Apps Script update karein"));
          }
        } catch (e) {
          gpToast("❌ Clear error: " + e.message);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = "🧹 Clear Old Month in Sheet"; }
        }
      }
      function gpRenderB2bModal() {
        const c = gpGetAppClients().find(x => x.clientKey === gpActiveB2bKey);
        if (!c || !c.portalData) return;
        const st = gpGetState(c.clientKey);
        const rawSellers = (Array.isArray(c.portalData.b2bSellers) && c.portalData.b2bSellers.length)
          ? c.portalData.b2bSellers
          : (st.liveRawData ? gpExtractB2bSellersFromData(st.liveRawData) : []);
        const q = (document.getElementById("gpB2bSearchInp")?.value || "").trim().toLowerCase();
        const sellers = rawSellers.filter(s => {
          if (!q) return true;
          const invTxt = (s.invoices || []).map(iv => `${iv.num} ${iv.dt}`).join(" ");
          return `${s.name} ${s.gstin} ${invTxt}`.toLowerCase().includes(q);
        });

        document.getElementById("gpB2bModalTitle").textContent = `${c.clientName} — GSTR-2B B2B Invoices`;
        document.getElementById("gpB2bModalSub").textContent = `${c.firm || ""} • ${c.gstin || ""} • Period: ${c.portalData.period || "—"}`;

        let sumInv = 0, sumTax = 0, sumI = 0, sumC = 0, sumS = 0, hasAnyInv = false;
        const rowsHtml = [];
        sellers.forEach((s, idx) => {
          const invs = Array.isArray(s.invoices) ? s.invoices : [];
          if (invs.length) hasAnyInv = true;
          const rowItc = Number(s.igst || 0) + Number(s.cgst || 0) + Number(s.sgst || 0);
          sumInv += Number(s.invCount || invs.length || 0);
          sumTax += Number(s.taxable || 0);
          sumI += Number(s.igst || 0);
          sumC += Number(s.cgst || 0);
          sumS += Number(s.sgst || 0);

          rowsHtml.push(`
            <tr class="bg-slate-50/90 font-semibold">
              <td class="py-2.5 pl-3 pr-2 text-slate-500 font-mono">${idx + 1}</td>
              <td class="py-2.5 px-3">
                <div class="font-bold text-slate-900">${gpEsc(s.name)}</div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">${gpEsc(s.gstin)}</span>
                  <button type="button" data-copy-seller="${gpEsc(s.gstin)}" class="gp-copy-seller-btn px-1 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[10px] text-slate-600" title="Copy Seller GSTIN">📋</button>
                </div>
              </td>
              <td class="py-2.5 px-3 text-center text-[10px] text-slate-400 whitespace-nowrap">${s.supfildt ? `Filed ${gpEsc(s.supfildt)}` : "—"}</td>
              <td class="py-2.5 px-3 text-center text-slate-700 tabular-nums whitespace-nowrap">${Number(s.invCount || invs.length || 0)} Inv</td>
              <td class="py-2.5 px-3 text-right text-slate-800 tabular-nums">${gpFmtInr(s.taxable)}</td>
              <td class="py-2.5 px-3 text-right text-slate-800 tabular-nums">${gpFmtInr(s.igst)}</td>
              <td class="py-2.5 px-3 text-right text-slate-800 tabular-nums">${gpFmtInr(s.cgst)}</td>
              <td class="py-2.5 px-3 text-right text-slate-800 tabular-nums">${gpFmtInr(s.sgst)}</td>
              <td class="py-2.5 pl-3 pr-4 text-right font-bold text-indigo-700 tabular-nums">${gpFmtInr(rowItc)}</td>
            </tr>`);

          invs.forEach(iv => {
            const ivItc = Number(iv.igst || 0) + Number(iv.cgst || 0) + Number(iv.sgst || 0);
            const invDate = String(iv.dt || iv.idt || iv.inv_dt || iv.docdt || iv.date || "").trim();
            rowsHtml.push(`
              <tr class="bg-white hover:bg-indigo-50/20 text-[11px]">
                <td class="py-1.5 pl-3 pr-2 text-slate-300">↳</td>
                <td class="py-1.5 px-3">
                  <span class="font-mono font-semibold text-slate-800">${gpEsc(iv.num || "—")}</span>
                  ${iv.rate ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">${gpEsc(iv.rate)}</span>` : ""}
                  <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${iv.itcavl === "N" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}">ITC: ${gpEsc(iv.itcavl || "Y")}</span>
                </td>
                <td class="py-1.5 px-3 text-center font-mono font-semibold text-slate-700 whitespace-nowrap">${gpEsc(invDate || "—")}</td>
                <td class="py-1.5 px-3 text-center text-slate-500 tabular-nums whitespace-nowrap">${gpFmtInr(iv.val)}</td>
                <td class="py-1.5 px-3 text-right text-slate-700 tabular-nums">${gpFmtInr(iv.txval)}</td>
                <td class="py-1.5 px-3 text-right text-slate-700 tabular-nums">${gpFmtInr(iv.igst)}</td>
                <td class="py-1.5 px-3 text-right text-slate-700 tabular-nums">${gpFmtInr(iv.cgst)}</td>
                <td class="py-1.5 px-3 text-right text-slate-700 tabular-nums">${gpFmtInr(iv.sgst)}</td>
                <td class="py-1.5 pl-3 pr-4 text-right font-semibold text-slate-900 tabular-nums">${gpFmtInr(ivItc)}</td>
              </tr>`);
          });
        });

        if (sellers.length && !hasAnyInv) {
          rowsHtml.push('<tr><td colspan="9" class="py-2.5 px-3 text-center text-[11px] font-medium bg-amber-50 text-amber-800">ℹ️ Purana fetched data hai — har invoice ki Date aur No. dekhne ke liye is client ko ek baar 🔄 Re-Fetch karein.</td></tr>');
        }

        document.getElementById("gpB2bTableBody").innerHTML = rowsHtml.join("") || (
          '<tr><td colspan="9" class="py-8 text-center text-slate-400">' +
          (rawSellers.length ? "Koi B2B seller ya invoice match nahi hua." : "Purana data bina invoice list ke save hua tha — poori invoice detail ke liye 🔄 Re-Fetch dabayein.") +
          '</td></tr>'
        );

        const grandItc = sumI + sumC + sumS;
        document.getElementById("gpB2bModalTotalsPill").textContent = `${sellers.length} Sellers • ${sumInv} Invoices • ITC ${gpFmtInr(grandItc)}`;
        document.getElementById("gpB2bTableFoot").innerHTML = sellers.length ? `
          <tr>
            <td colspan="3" class="py-2.5 pl-3 pr-3 text-xs uppercase tracking-wider text-slate-500">Total</td>
            <td class="py-2.5 px-3 text-center tabular-nums">${sumInv} Inv</td>
            <td class="py-2.5 px-3 text-right tabular-nums">${gpFmtInr(sumTax)}</td>
            <td class="py-2.5 px-3 text-right tabular-nums">${gpFmtInr(sumI)}</td>
            <td class="py-2.5 px-3 text-right tabular-nums">${gpFmtInr(sumC)}</td>
            <td class="py-2.5 px-3 text-right tabular-nums">${gpFmtInr(sumS)}</td>
            <td class="py-2.5 pl-3 pr-4 text-right text-indigo-700 tabular-nums">${gpFmtInr(grandItc)}</td>
          </tr>` : "";

        document.querySelectorAll("#gpB2bTableBody .gp-copy-seller-btn").forEach(b => b.addEventListener("click", () => {
          gpCopyText(b.getAttribute("data-copy-seller"), "Seller GSTIN");
        }));
      }

      function gpOpenB2bModal(clientKey) {
        gpActiveB2bKey = clientKey;
        const sInp = document.getElementById("gpB2bSearchInp");
        if (sInp) sInp.value = "";
        gpRenderB2bModal();
        document.getElementById("gpB2bModalOverlay")?.classList.remove("hidden");
      }
      function gpCloseB2bModal() {
        document.getElementById("gpB2bModalOverlay")?.classList.add("hidden");
        gpActiveB2bKey = null;
      }

      async function gpLoadCaptchaForClient(clientKey, actionMode) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        if (!c) return;
        const st0 = gpGetState(clientKey);
        if (st0.cooldownUntil && st0.cooldownUntil > Date.now()) {
          return gpToast(`⏳ ${Math.ceil((st0.cooldownUntil - Date.now()) / 1000)}s rukein — bar-bar retry portal ko block karta hai.`);
        }
        const pwCheck = await gpResolvePassword(c);
        if (pwCheck.reason === "locked" || pwCheck.reason === "encrypted") {
          return gpToast("⚠️ Is client ka password encrypted (enc:...) hai — ✏️ daba kar plain password save karein.");
        }
        if (!c.portalId || !pwCheck.pw) {
          return gpToast("⚠️ Is client ka Portal ID ya Password missing hai — ✏️ par click karke add karein.");
        }
        const st = gpGetState(clientKey);
        st.pendingAction = actionMode || "FETCH";
        if (gpPhoneModeNow() && gpPhoneLoginAvailable()) {
          // 📱 Phone mode = cloud jaisa: login chhupe WebView me, captcha app me, phir background fetch
          st.sessionId = "PHONE";
          st.captchaBase64 = "";
          st.note = "";
          st.cooldownUntil = 0;
          st.phase = "loading_cap";
          gpRenderSerialList();
          gpPhoneDbg("login start: " + (c.clientName || "") + " (" + (c.gstin || c.portalId || "") + ")");
          try {
            const pres = await gpPhoneLoginStart(c, (pwCheck && pwCheck.pw) || "");
            gpPhoneDbg("login reply: " + JSON.stringify(pres).slice(0, 200));
            if (pres && pres.loggedIn) {          // session pehle se zinda hai -> seedha fetch
              st.phase = "idle";
              gpRenderSerialList();
              return gpTriggerFetchInBackground(c, st);
            }
            st.captchaBase64 = (pres && pres.captchaBase64) || "";
            st.phase = st.captchaBase64 ? "captcha" : "error";
            if (!st.captchaBase64) st.note = "Phone login: captcha nahi mila";
          } catch (e) {
            if (e && (e.code === "manual_login" || e.code === "captcha_missing")) {
              // Portal screen par bhejne ke bajaye app ke andar hi login dikhata hai
              st.phase = "loading_cap";
              st.note = "🔐 App ke andar login — captcha/OTP daalein, phir apne aap aage";
              gpRenderSerialList(clientKey);
              try { window.CloudGSTNative.phoneLoginVisible(true); } catch (_) {}
              gpToast("🔐 " + (c.clientName || "Client") + ": login page app ke andar khul gayi — captcha/OTP daalein, baaki kaam apne aap");
              return;
            }
            st.phase = "error";
            st.note = e.message;
            gpErrLogAdd(clientKey, e.message);
            gpToast("❌ " + e.message);
          }
          gpRenderSerialList(clientKey);
          return;
        }
        st.phase = "loading_cap";
        st.note = "";
        gpRenderSerialList();
        try {
          const res = await gpCallBridge("/api/gst/init-login", { username: c.portalId, keepOthers: true });
          st.sessionId = res.sessionId;
          st.captchaBase64 = res.captchaBase64;
          st.phase = "captcha";
          gpRenderSerialList(clientKey);
        } catch (e) {
          st.phase = "error";
          st.note = e.message;
          gpErrLogAdd(clientKey, e.message);
          const _netFail = !!(e && e.network);
          st.cooldownUntil = _netFail ? 0 : (Date.now() + 90000);
          if (!_netFail) gpEnsureCooldownTicker();
          gpRenderSerialList();
          gpToast(_netFail
            ? ("☁️ Captcha load fail: " + e.message)
            : ("❌ Captcha load fail: " + e.message + " — 90s baad dobara try karein."));
        }
      }

      function gpTriggerFetchInBackground(c, st) {
        // Dono option OFF = kuchh fetch hi nahi hoga -> chup-chaap khaali save mat karo
        const _opts = gpReadOptions();
        if (!_opts.gstr2b && !_opts.tcs) {
          st.phase = "error";
          st.note = "⚠️ GSTR-2B aur E-Com dono OFF hain — upar kam se kam ek tick karein, phir Re-Fetch. (Kuchh save nahi kiya.)";
          gpErrLogAdd(c.clientKey, "2B + E-Com dono OFF the — fetch nahi chala");
          gpRenderSerialList();
          gpToast("⚠️ " + (c.clientName || "Client") + ": GSTR-2B aur E-Com dono OFF hain — pehle ek ON karein.");
          return;
        }
        st.phase = "fetching";
        st.note = "";
        st.partialNote = "";
        st.cooldownUntil = 0;
        const ctrl = new AbortController();
        st.abort = ctrl;
        st.progressText = st.sessionId === "PHONE" ? "📱 Phone se 2B la rahe hain (cloud nahi, screen band rakh sakte hain)…" : "Shuru ho raha hai…";
        const _progSid = st.sessionId;
        const _phoneMode = gpPhoneModeNow();
        let _progPoll = _phoneMode ? null : setInterval(() => {
          if (st.phase !== "fetching" && st.phase !== "saving") return;
          gpCallBridge("/api/gst/fetch-status?sessionId=" + encodeURIComponent(_progSid), null, { timeoutMs: 8000 })
            .then(pr => {
              const msg = pr && pr.progress && pr.progress.message;
              if (msg && msg !== st.progressText) { st.progressText = msg; gpRenderSerialList(); }
            })
            .catch(() => {});
        }, 5000);
        gpActiveFetches++;
        gpRenderSerialList();

        const fy = document.getElementById("gpFySel").value;
        const month = document.getElementById("gpMonSel").value;
        const options = gpReadOptions();
        const wantDrive = !!document.getElementById("gpAutoDriveChk")?.checked;

        const _runFetch = async () => {
          if (!_phoneMode) {
            // Cloud: pehle dekho bridge zinda hai — down ho to 60s tak khud intezaar, phir saaf message
            const up = await gpWaitBridgeUp(60000, (n, secs) => {
              st.progressText = `⏳ Bridge server jawab nahi de raha — dobara jud rahe hain (${secs}s)…`;
              gpRenderSerialList();
            });
            if (!up.ok) {
              const e = new Error("Bridge server down hai (60s tak jawab nahi aaya: " + ((up.last && up.last.reason) || "no response") + "). Server up hote hi Re-Fetch karein — kuchh save nahi hua.");
              e.code = "bridge_down";
              throw e;
            }
          }
          if (_phoneMode) {
            return gpPhoneFetch2b(fy, (typeof gpGetSelectedMonthDisplay === "function" ? gpGetSelectedMonthDisplay() : ""));
          }
          const initial = await gpCallBridge("/api/gst/fetch-all", { sessionId: st.sessionId, fy, month, autoClose: true, options, async: true }, {
            signal: ctrl.signal, timeoutMs: 900000, retry: false,
            onRetry: (n) => { st.progressText = `⏳ Connection toota — retry ${n}…`; gpRenderSerialList(); }
          });
          if (!(initial && initial.pending)) return initial;

          // Async background job: Railway/Safari 60s idle proxy drop se bachne ke liye short polls par result lo
          if (_progPoll) { try { clearInterval(_progPoll); } catch (_) {} _progPoll = null; }
          const deadline = Date.now() + 900000;
          while (Date.now() < deadline) {
            if (ctrl.signal.aborted) { const ea = new Error("Aapne cancel kiya."); ea.aborted = true; throw ea; }
            await new Promise(r => setTimeout(r, 2500));
            if (ctrl.signal.aborted) { const ea = new Error("Aapne cancel kiya."); ea.aborted = true; throw ea; }
            const pr = await gpCallBridge("/api/gst/fetch-status?sessionId=" + encodeURIComponent(_progSid), null, {
              timeoutMs: 10000, signal: ctrl.signal,
              onRetry: (n) => { st.progressText = `⏳ Connection check — retry ${n}…`; gpRenderSerialList(); }
            });
            const msg = pr && pr.progress && pr.progress.message;
            if (msg && msg !== st.progressText) { st.progressText = msg; gpRenderSerialList(); }
            if (pr && pr.done) {
              const finalRes = pr.result;
              if (!finalRes || !finalRes.ok) {
                const ef = new Error((finalRes && finalRes.error) || "Fetch fail hua.");
                ef.data = finalRes;
                throw ef;
              }
              return finalRes;
            }
          }
          const et = new Error("Bridge ne 15 min me jawab nahi diya (timeout). Dobara try karein.");
          et.aborted = true;
          throw et;
        };
        _runFetch()
          .then(async (data) => {
            st.liveRawData = data;
            st.phase = "saving";
            gpRenderSerialList();
            const saved = await gpSaveToGstDetailsSheet(c, data, wantDrive);
            st.sheetStatus = saved.label;
            st.phase = "done";
            gpErrLogClear(c.clientKey);
            st.cooldownUntil = 0;
            st.partialNote = (data.partial && data.partial.text) || "";
            gpExpanded.add(c.clientKey); gpScheduleAutoHide(c.clientKey);
            if (st.partialNote) gpToast(`✅ ${c.clientName}: jitna mila save ho gaya — ${st.partialNote}`);
            else gpToast(`✅ ${c.clientName}: GSTR-2B & E-Com fetch hokar GST Details Sheet me save ho gaya!`);
          })
          .catch(err => {
            if (err && err.aborted) {
              st.phase = "idle";
              st.note = "";
              gpToast(`⏹ ${c.clientName}: fetch cancel ho gaya.`);
            } else {
              st.phase = "error";
              st.note = err.message;
              gpErrLogAdd(c.clientKey, err.message);
              const _needLogin = err && err.code === "login_required";
              const _bridgeDown = !!(err && (err.code === "bridge_down" || err.network));
              st.cooldownUntil = (_needLogin || _bridgeDown) ? 0 : Date.now() + 90000;
              if (_bridgeDown) gpBridgeMark(false);
              if (!_needLogin && !_bridgeDown) gpEnsureCooldownTicker();
              gpToast(_bridgeDown
                ? `☁️ ${c.clientName}: ${err.message}`
                : (_needLogin
                  ? `🔐 ${c.clientName}: ${err.message}`
                  : `❌ ${c.clientName}: ${err.message} — 90s baad dobara try karein.`));
              gpPhoneDbg("fetch error: " + (err && err.message));
              if (_needLogin) {
                gpPhoneLoginClient("");
                // phone mode: captcha/OTP wala card khud khul jata hai (portal screen nahi)
                setTimeout(() => { try { gpLoadCaptchaForClient(c.clientKey, "FETCH"); } catch (_) {} }, 500);
              }
            }
            if (st.sessionId && st.sessionId !== "PHONE") gpCallBridge("/api/gst/logout", { sessionId: st.sessionId }).catch(() => {});
          })
          .finally(() => {
            try { clearInterval(_progPoll); } catch (_) {}
            st.progressText = "";
            st.abort = null;
            gpActiveFetches = Math.max(0, gpActiveFetches - 1);
            gpRenderSerialList();
          });
      }

      function gpTriggerGstr1UploadInBackground(c, st) {
        const mj = c.gstin ? gpMatchedJsons.get(c.gstin) : null;
        if (!mj || !mj.jsonObj) {
          st.phase = "error"; st.note = "Matched GSTR-1 JSON nahi mili."; gpRenderSerialList(); return;
        }
        st.phase = "fetching";
        st.note = "";
        gpActiveFetches++;
        gpRenderSerialList();
        const fy = document.getElementById("gpFySel").value;
        const month = document.getElementById("gpMonSel").value;
        gpCallBridge("/api/gst/upload-gstr1", {
          sessionId: st.sessionId,
          fy, month,
          jsonContent: mj.jsonObj,
          fileName: mj.fileName
        })
          .then(res => {
            mj.uploaded = true;
            st.phase = "done";
            st.pendingAction = "FETCH";
            gpToast(`🎉 ${c.clientName}: ${res.message || "GSTR-1 JSON upload ho gaya!"}`);
          })
          .catch(err => {
            st.phase = "error";
            st.note = "GSTR-1 Upload: " + err.message;
            gpToast(`❌ ${c.clientName} GSTR-1 Upload: ${err.message}`);
          })
          .finally(() => {
            if (st.sessionId) gpCallBridge("/api/gst/logout", { sessionId: st.sessionId }).catch(() => {});
            st.sessionId = null;
            gpActiveFetches = Math.max(0, gpActiveFetches - 1);
            gpUpdateFolderBanner();
            gpRenderSerialList();
          });
      }

      function gpUpdateFolderBanner() {
        const banner = document.getElementById("gpFolderBanner");
        const title = document.getElementById("gpFolderBannerTitle");
        const sub = document.getElementById("gpFolderBannerSub");
        const mPill = document.getElementById("gpFolderMatchedPill");
        const mmPill = document.getElementById("gpFolderMismatchPill");
        const total = gpMatchedJsons.size;
        if (banner) banner.classList.toggle("hidden", total === 0);
        if (!total) return;
        const wantFp = gpGetSelectedFp();
        let ready = 0, mismatch = 0, done = 0;
        gpMatchedJsons.forEach(mj => {
          if (mj.uploaded) done++;
          else if (!mj.fp || mj.fp === wantFp) ready++;
          else mismatch++;
        });
        if (title) title.textContent = `📂 ${total} GSTR-1 JSON Auto-Matched (Period ${wantFp})`;
        if (sub) sub.textContent = done > 0
          ? `${done} uploaded, ${ready} baaki hain — har matched client ke aage purple '📤 Upload' dabayein.`
          : "Har matched client ke aage purple '📤 Upload' button aa gaya hai — bas Captcha dalein.";
        if (mPill) mPill.textContent = `✓ ${ready} Ready` + (done ? ` • ${done} Done` : "");
        if (mmPill) { mmPill.textContent = `⚠ ${mismatch} Wrong Month`; mmPill.classList.toggle("hidden", mismatch === 0); }
      }

      // ===== Drive "json" folder: list + select (file chooser bilkul nahi) =====
      let gpSavedJsonLoading = false;
      function gpApplyGstr1JsonObject(name, obj, silent) {
        const byGstin = new Map();
        gpGetAppClients().forEach(c => { if (c.gstin) byGstin.set(c.gstin, c); });
        const gstin = String(obj.gstin || "").trim().toUpperCase();
        if (!gstin || !byGstin.has(gstin)) {
          if (!silent) gpToast(`⚠️ ${name}: is GSTIN ka client list me nahi mila (${gstin || "GSTIN missing"})`);
          return false;
        }
        const fp = String(obj.fp || "").trim();
        const invCount = (Array.isArray(obj.exp) ? obj.exp.reduce((a, g) => a + ((g.inv || []).length), 0) : 0)
          + (Array.isArray(obj.b2b) ? obj.b2b.reduce((a, g) => a + ((g.inv || []).length), 0) : 0)
          + (Array.isArray(obj.b2cs) ? obj.b2cs.length : 0);
        const wantFp = gpGetSelectedFp();
        gpMatchedJsons.set(gstin, { fileName: name, fp, invCount, jsonObj: obj, uploaded: false });
        gpUpdateFolderBanner();
        gpRenderSerialList();
        if (!silent) gpToast(`☁️ ${name} load ho gayi (${invCount} inv)` + (fp && fp !== wantFp ? ` — ⚠️ JSON ka month ${fp} hai, selected ${wantFp}` : ""));
        return true;
      }

      async function gpRefreshSavedJsonList(autoLoadLatest) {
        const sel = document.getElementById("gpSavedJsonSel");
        if (!sel || gpSavedJsonLoading) return;
        gpSavedJsonLoading = true;
        const prev = sel.value;
        sel.innerHTML = '<option value="">⏳ json folder load ho raha hai…</option>';
        try {
          const res = await postVerifiedToAppsScript({ action: "listGstr1Json" });
          if (!res.ok) {
            sel.innerHTML = `<option value="">⚠️ ${gpEsc(res.message || "Drive list fail")}</option>`;
            gpToast("❌ Drive 'json' folder list fail: " + (res.message || "") + " — Settings → 📋 Copy Code se naya Apps Script paste karein.");
            return;
          }
          const files = (res.data && Array.isArray(res.data.files)) ? res.data.files : [];
          if (!files.length) {
            sel.innerHTML = '<option value="">(json folder khaali — JSON page se “Drive me Save” karein)</option>';
            return;
          }
          sel.innerHTML = `<option value="">☁️ json folder (${files.length}) — file chunein</option>` + files.map(f =>
            `<option value="${gpEsc(f.id)}" data-name="${gpEsc(f.name)}">${gpEsc(f.name)}${f.updated ? " • " + gpEsc(f.updated) : ""}</option>`).join("");
          if (prev) sel.value = prev;
          if (autoLoadLatest && files.length) { sel.value = files[0].id; await gpLoadSavedJsonById(files[0].id); }
        } finally {
          gpSavedJsonLoading = false;
        }
      }

      async function gpLoadAllSavedJson() {
        const sel = document.getElementById("gpSavedJsonSel");
        if (!sel) return;
        const opts = Array.from(sel.options).filter(o => o.value);
        if (!opts.length) return gpToast("⚠️ json folder khaali hai — pehle JSON page se “Drive me Save” karein.");
        gpToast(`⏳ ${opts.length} JSON Drive se load ho rahi hain…`);
        let ok = 0;
        for (const o of opts) {
          try {
            const res = await postVerifiedToAppsScript({ action: "readGstr1Json", id: o.value });
            if (!res.ok) continue;
            const obj = JSON.parse(String((res.data && res.data.text) || "{}"));
            if (gpApplyGstr1JsonObject((res.data && res.data.name) || o.textContent, obj, true)) ok++;
          } catch (_) {}
        }
        gpUpdateFolderBanner();
        gpRenderSerialList();
        gpToast(`☁️ ${ok}/${opts.length} JSON match ho gayi (baaki clients list me nahi mile ya parse fail).`);
      }

      async function gpLoadSavedJsonById(id) {
        if (!id) return;
        const sel = document.getElementById("gpSavedJsonSel");
        const opt = sel ? Array.from(sel.options).find(o => o.value === id) : null;
        const nm = opt ? (opt.getAttribute("data-name") || opt.textContent) : "GSTR-1 JSON";
        gpToast(`⏳ ${nm} Drive se aa rahi hai…`);
        const res = await postVerifiedToAppsScript({ action: "readGstr1Json", id });
        if (!res.ok) return gpToast("❌ Drive se padh nahi paye: " + (res.message || ""));
        try {
          const obj = JSON.parse(String((res.data && res.data.text) || "{}"));
          gpApplyGstr1JsonObject((res.data && res.data.name) || nm, obj);
        } catch (e) {
          gpToast("❌ JSON parse fail: " + e.message);
        }
      }

      async function gpHandleGstr1Files(fileList) {
        const files = Array.from(fileList || []).filter(f => f.name.toLowerCase().endsWith(".json"));
        if (!files.length) return gpToast("⚠️ Koi .json file nahi mili.");
        const appClients = gpGetAppClients();
        const byGstin = new Map();
        appClients.forEach(c => { if (c.gstin) byGstin.set(c.gstin, c); });
        const wantFp = gpGetSelectedFp();
        let matched = 0, mismatch = 0, skipped = 0;

        for (const f of files) {
          try {
            const obj = JSON.parse(await f.text());
            const gstin = String(obj.gstin || "").trim().toUpperCase();
            if (!gstin || !byGstin.has(gstin)) { skipped++; continue; }
            const fp = String(obj.fp || "").trim();
            const invCount = (Array.isArray(obj.exp) ? obj.exp.reduce((a, g) => a + (g.inv?.length || 0), 0) : 0)
              + (Array.isArray(obj.b2b) ? obj.b2b.reduce((a, g) => a + (g.inv?.length || 0), 0) : 0)
              + (Array.isArray(obj.b2cs) ? obj.b2cs.length : 0);
            if (fp && fp !== wantFp) mismatch++; else matched++;
            gpMatchedJsons.set(gstin, { fileName: f.name, fp, invCount, jsonObj: obj, uploaded: false });
          } catch (_) { skipped++; }
        }
        gpUpdateFolderBanner();
        gpRenderSerialList();
        gpToast(`📂 ${matched} GSTR-1 JSON auto-match ho gayi!` + (mismatch ? ` (${mismatch} wrong month)` : "") + (skipped ? ` (${skipped} unmatched)` : ""));
      }

      function gpAutoOpenNextSerialCaptcha(currentKey, actionMode) {
        const nextChk = document.getElementById("gpAutoNextChk");
        if (nextChk && !nextChk.checked && (typeof gpPhoneModeNow === "function") && gpPhoneModeNow()) {
          nextChk.checked = true;   // 📱 Phone mode: ek ke baad ek sab clients (serial) — checkbox apne aap on
        }
        if (!document.getElementById("gpAutoNextChk")?.checked) return;
        const visible = gpGetFilteredClients();
        if (visible.length <= 1) return;
        const idx = visible.findIndex(x => x.clientKey === currentKey);
        if (idx < 0) return;
        const wantFp = gpGetSelectedFp();
        for (let i = idx + 1; i < visible.length; i++) {
          const nxt = visible[i];
          const nst = gpGetState(nxt.clientKey);
          if (!(nxt.portalId && nxt.rawPassword && nst.phase === "idle")) continue;
          if (actionMode === "UPLOAD") {
            const mj = nxt.gstin ? gpMatchedJsons.get(nxt.gstin) : null;
            if (!mj || mj.uploaded || (mj.fp && mj.fp !== wantFp)) continue;
          }
          const isCloud = !gpGetBridgeUrl().includes("localhost") && !gpGetBridgeUrl().includes("127.0.0.1");
          // 📱 Phone mode: ek hi chhupa WebView — isliye ek ke baad ek (serial), parallel nahi
          const isPhone = (typeof gpPhoneModeNow === "function") && gpPhoneModeNow();
          const maxPar = isPhone ? 1 : 2;
          if ((isPhone || isCloud) && gpActiveFetches >= maxPar) {
            const waitSlot = () => {
              if (gpActiveFetches < maxPar) gpLoadCaptchaForClient(nxt.clientKey, actionMode || "FETCH");
              else setTimeout(waitSlot, 1200);
            };
            setTimeout(waitSlot, 1200);
          } else {
            gpLoadCaptchaForClient(nxt.clientKey, actionMode || "FETCH");
          }
          break;
        }
      }

      async function gpSubmitCaptchaForClient(clientKey) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        if (!c) return;
        const st = gpGetState(clientKey);
        const inp = document.querySelector(`#pagePortalMain .gp-cap-inp[data-k="${CSS.escape(clientKey)}"]`);
        const cap = (inp?.value || "").trim();
        if (!cap) return gpToast("⚠️ Captcha dalein.");
        const pwRes = await gpResolvePassword(c);
        if (!pwRes.ok || !pwRes.pw || pwRes.pw.startsWith("enc:")) {
          return gpToast("⚠️ Password encrypted hai ya decrypt nahi hua — ✏️ se plain password save karein.");
        }

        const btn = document.querySelector(`#pagePortalMain .gp-cap-submit-btn[data-k="${CSS.escape(clientKey)}"]`);
        if (btn) { btn.disabled = true; btn.textContent = "⏳"; }

        if (gpPhoneModeNow() && gpPhoneLoginAvailable()) {
          // 📱 Phone mode: captcha chhupe WebView ke login page me jata hai (cloud ki zaroorat nahi)
          try {
            const pres = await gpPhoneLoginCaptcha(cap);
            if (pres && pres.otpRequired) {
              st.phase = "otp";
              gpRenderSerialList(clientKey);
            } else {
              st.phase = "idle";
              st.note = "";
              gpRenderSerialList();
              gpTriggerFetchInBackground(c, st);
              gpAutoOpenNextSerialCaptcha(clientKey, "FETCH");
            }
          } catch (e) {
            if (e && e.data && e.data.captchaBase64) {
              st.captchaBase64 = e.data.captchaBase64;
              st.phase = "captcha";
              st.note = "";
            } else {
              st.phase = "error";
              st.note = e.message;
              gpErrLogAdd(clientKey, e.message);
            }
            gpRenderSerialList(clientKey);
            gpToast("❌ " + e.message);
          }
          return;
        }

        try {
          const res = await gpCallBridge("/api/gst/submit-login", {
            sessionId: st.sessionId,
            username: String(c.portalId || "").trim(),
            password: String(pwRes.pw || "").trim(),
            captcha: cap
          });
          if (res.status === "otp_required") {
            st.phase = "otp";
            gpRenderSerialList();
          } else if (st.pendingAction === "UPLOAD") {
            gpTriggerGstr1UploadInBackground(c, st);
            gpAutoOpenNextSerialCaptcha(clientKey, "UPLOAD");
          } else {
            gpTriggerFetchInBackground(c, st);
            gpAutoOpenNextSerialCaptcha(clientKey, "FETCH");
          }
        } catch (e) {
          if (e.data?.captchaBase64) {
            st.captchaBase64 = e.data.captchaBase64;
            st.phase = "captcha";
            gpRenderSerialList(clientKey);
          } else {
            st.note = e.message;
            gpRenderSerialList();
          }
          gpToast("❌ " + e.message);
        }
      }

      async function gpSubmitOtpForClient(clientKey) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        if (!c) return;
        const st = gpGetState(clientKey);
        const inp = document.querySelector(`#pagePortalMain .gp-otp-inp[data-k="${CSS.escape(clientKey)}"]`);
        const otp = (inp?.value || "").trim();
        if (!otp) return gpToast("⚠️ OTP dalein.");

        if (gpPhoneModeNow() && gpPhoneLoginAvailable()) {
          try {
            await gpPhoneLoginOtp(otp);
            st.phase = "idle";
            st.note = "";
            gpRenderSerialList();
            gpTriggerFetchInBackground(c, st);
            gpAutoOpenNextSerialCaptcha(clientKey, "FETCH");
          } catch (e) {
            st.phase = "error";
            st.note = e.message;
            gpRenderSerialList(clientKey);
            gpToast("❌ " + e.message);
          }
          return;
        }

        try {
          await gpCallBridge("/api/gst/submit-otp", { sessionId: st.sessionId, otp });
          if (st.pendingAction === "UPLOAD") {
            gpTriggerGstr1UploadInBackground(c, st);
            gpAutoOpenNextSerialCaptcha(clientKey, "UPLOAD");
          } else {
            gpTriggerFetchInBackground(c, st);
            gpAutoOpenNextSerialCaptcha(clientKey, "FETCH");
          }
        } catch (e) {
          gpToast("❌ " + e.message);
        }
      }

      async function gpManualSaveDrive(clientKey) {
        const c = gpGetAppClients().find(x => x.clientKey === clientKey);
        const st = gpGetState(clientKey);
        if (!c || !st.liveRawData) return;
        st.driveSaving = true;
        gpRenderSerialList();
        try {
          const saved = await gpSaveToGstDetailsSheet(c, st.liveRawData, true);
          st.sheetStatus = saved.label;
          gpToast(saved.driveLink ? `☁️ ${c.clientName} GSTR-2B Drive folder me save ho gaya!` : "⚠️ Drive link nahi mila.");
        } catch (e) {
          gpToast("❌ Drive save error: " + e.message);
        } finally {
          st.driveSaving = false;
          gpRenderSerialList();
        }
      }

      async function gpPushAllPasswordsToGstDetails() {
        if (typeof postVerifiedToAppsScript !== "function" || !scriptUrl) {
          return gpToast("⚠️ Pehle GST Details Sheet URL (⚙️ Setup) connect karein.");
        }
        const appList = gpGetAppClients().filter(c => c.rawPassword);
        const items = [];
        let skippedEnc = 0;
        for (const c of appList) {
          const r = await gpResolvePassword(c);
          if (r.ok && r.pw && !r.pw.startsWith("enc:")) {
            c._ref.password = r.pw;
            items.push({ client: c.clientName, gstin: c.gstin, category: c.category, password: r.pw });
          } else {
            skippedEnc++;
          }
        }
        if (items.length && typeof saveClients === "function") saveClients();
        if (!items.length) {
          return gpToast(skippedEnc > 0
            ? "🔒 Passwords abhi encrypted hain — GST Details Sheet ya ✏️ se plain password dal dein."
            : "ℹ️ Abhi kisi client ka password saved nahi hai.");
        }
        const btn = document.getElementById("gpPushAllPwBtn");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ Syncing..."; }
        try {
          const res = await postVerifiedToAppsScript({ action: "syncAllPasswords", items });
          if (res.ok) {
            gpRenderSerialList();
            gpToast(`✅ ${items.length} plain passwords GST Details Sheet me sync ho gaye!`);
          } else {
            gpToast("❌ Password sync fail: " + (res.message || "Apps Script update karein"));
          }
        } catch (e) {
          gpToast("❌ Password sync error: " + e.message);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = "🔐 Sync Passwords"; }
        }
      }

      window.renderPortalPage = function renderPortalPage() {
        gpUpdateFolderBanner();
        gpRenderSerialList();
      };

      document.querySelectorAll(".gp-cat-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          gpCategoryFilter = btn.getAttribute("data-gp-cat") || "ALL";
          document.querySelectorAll(".gp-cat-btn").forEach(b => {
            const on = b.getAttribute("data-gp-cat") === gpCategoryFilter;
            b.className = "gp-cat-btn px-2.5 py-1.5 rounded-lg transition " + (on ? "font-semibold bg-white text-slate-900 shadow-2xs" : "font-medium text-slate-600 hover:text-slate-900");
          });
          gpRenderSerialList();
        });
      });



      document.getElementById("gpExpandAllBtn")?.addEventListener("click", () => {
        const fetchedKeys = gpGetFilteredClients().filter(c => !!c.portalData).map(c => c.clientKey);
        const allOpen = fetchedKeys.length > 0 && fetchedKeys.every(k => gpExpanded.has(k));
        if (allOpen) fetchedKeys.forEach(k => { gpExpanded.delete(k); gpClearAutoHide(k); });
        else fetchedKeys.forEach(k => { gpExpanded.add(k); gpScheduleAutoHide(k); });
        const btn = document.getElementById("gpExpandAllBtn");
        if (btn) btn.textContent = allOpen ? "Expand All" : "Collapse All";
        gpRenderSerialList();
      });

      document.getElementById("gpSearchInp")?.addEventListener("input", () => gpRenderSerialList());
      document.getElementById("gpPushAllPwBtn")?.addEventListener("click", gpPushAllPasswordsToGstDetails);
      document.getElementById("gpToggleSettingsBtn")?.addEventListener("click", () => document.getElementById("gpSettingsDrawer")?.classList.toggle("hidden"));

      document.getElementById("gpCloseB2bModalBtn")?.addEventListener("click", gpCloseB2bModal);
      document.getElementById("gpCloseB2bModalFooterBtn")?.addEventListener("click", gpCloseB2bModal);
      document.getElementById("gpB2bModalOverlay")?.addEventListener("click", (e) => { if (e.target.id === "gpB2bModalOverlay") gpCloseB2bModal(); });
      document.getElementById("gpB2bSearchInp")?.addEventListener("input", gpRenderB2bModal);

      document.getElementById("gpQuickPcBtn")?.addEventListener("click", async () => {
        const pc = localStorage.getItem(K_PC) || "http://localhost:3000";
        localStorage.setItem(K_BRIDGE, pc);
        document.getElementById("gpBridgeUrlInp").value = pc;
        gpUpdateQuickButtons();
        try { await gpCallBridge("/api/gst/ping", null); gpToast("💻 PC Fast Server connected!"); } catch (e) { gpToast("⚠️ PC Server off hai (" + pc + ")"); }
      });

      document.getElementById("gpQuickCloudBtn")?.addEventListener("click", async () => {
        const cl = localStorage.getItem(K_CLOUD) || "https://cloudgst-production.up.railway.app";
        localStorage.setItem(K_BRIDGE, cl);
        document.getElementById("gpBridgeUrlInp").value = cl;
        gpUpdateQuickButtons();
        try { await gpCallBridge("/api/gst/ping", null); gpToast("☁️ Cloud Server connected!"); } catch (e) { gpToast("⏳ Cloud wake ho raha hai: " + e.message); }
      });

      document.getElementById("gpSaveSettingsBtn")?.addEventListener("click", async () => {
        const bUrl = document.getElementById("gpBridgeUrlInp").value.trim().replace(/\/+$/, "");
        const bSec = document.getElementById("gpBridgeSecInp").value.trim();
        if (bUrl) {
          localStorage.setItem(K_BRIDGE, bUrl);
          if (bUrl.includes("localhost") || bUrl.includes("127.0.0.1") || bUrl.includes("trycloudflare.com")) localStorage.setItem(K_PC, bUrl);
          else localStorage.setItem(K_CLOUD, bUrl);
        }
        if (bSec) localStorage.setItem(K_SECRET, bSec);
        gpUpdateQuickButtons();
        if (bUrl) {
          try { await gpCallBridge("/api/gst/ping", null); gpToast("✅ Bridge Server connected!"); } catch (e) { gpToast("⚠️ Bridge check: " + e.message); }
        }
      });

      document.getElementById("gpExportCsvBtn")?.addEventListener("click", () => {
        const rows = [["Sr", "Category", "Client", "GSTIN", "Period", "IGST", "CGST", "SGST", "Cess", "Suppliers", "ECom_Gross", "ECom_TCS", "ECO_Platforms", "Drive_Link", "Updated"]];
        gpGetAppClients().forEach(c => {
          const pd = c.portalData || {};
          rows.push([c.sheetSr, c.category, c.clientName, c.gstin, pd.period || "", pd.igst || 0, pd.cgst || 0, pd.sgst || 0, pd.cess || 0, pd.suppliers || 0, pd.ecomGross || 0, pd.ecomTcs || 0, pd.ecomPlatforms || "", pd.driveLink || "", pd.updatedAt || ""]);
        });
        const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "GST_Portal_Fetched_Data.csv";
        a.click();
      });

      // ===== Android back / swipe gesture: pehle modal band, phir pichhla page, phir app =====
      window.cloudGstHandleBack = function () {
        try {
          // 1) sabse upar wala khula modal/popup band karo (jo bhi ho)
          const overlays = Array.prototype.slice.call(document.querySelectorAll('[id$="Overlay"]'));
          for (let i = overlays.length - 1; i >= 0; i--) {
            const el = overlays[i];
            const hidden = el.classList.contains("hidden") || (el.style && el.style.display === "none");
            if (!hidden) {
              el.classList.add("hidden");
              if (el.style) el.style.display = "";
              try { document.body.style.overflow = ""; } catch (_) {}
              return true;
            }
          }
          // 2) pichhla page
          if (window.__gpPageStack && window.__gpPageStack.length) {
            const prev = window.__gpPageStack.pop();
            window.__gpBackNav = true;
            switchAppPage(prev);
            return true;
          }
          // 3) kisi bhi dusre page se tracker par
          if (currentAppPage && currentAppPage !== "tracker") {
            window.__gpBackNav = true;
            switchAppPage("tracker");
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      };

      // ===== Fingerprint app-lock toggle (sirf Android APK me) =====
      (function gpInitBioLock() {
        const row = document.getElementById("gpBioLockRow");
        const btn = document.getElementById("gpBioLockBtn");
        if (!row || !btn || !window.CloudGSTNative) return;
        row.classList.remove("hidden");            // option HAMESHA dikhega (pehle chhup jata tha)
        const paint = () => {
          let on = false, canLock = true;
          try { on = !!window.CloudGSTNative.isBioLockEnabled(); } catch (_) {}
          try { canLock = !window.CloudGSTNative.bioStatus || window.CloudGSTNative.bioStatus() !== "none"; }
          catch (_) { canLock = true; }
          btn.textContent = canLock
            ? `🔒 App lock (fingerprint): ${on ? "ON" : "OFF"}`
            : "🔒 App lock: phone me fingerprint/PIN set nahi hai";
          btn.className = "px-3 py-2 rounded-xl text-xs font-semibold border transition " + (!canLock
            ? "bg-amber-50 text-amber-800 border-amber-300"
            : (on ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"));
        };
        try {
          if (!document.getElementById("gpPhoneDbgBtn")) {
            const dbg = document.createElement("button");
            dbg.id = "gpPhoneDbgBtn";
            dbg.type = "button";
            dbg.textContent = "📋 Phone mode debug copy";
            dbg.className = "px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 transition mt-2";
            dbg.addEventListener("click", () => gpPhoneDebugCopy());
            btn.insertAdjacentElement("afterend", dbg);
          }
        } catch (_) { }
        window.__gpPaintBioLock = paint;
        paint();
        btn.addEventListener("click", () => {
          if (typeof window.gpToggleNativeBio === "function") { window.gpToggleNativeBio(); return; }
          let on = false;
          try { on = !!window.CloudGSTNative.isBioLockEnabled(); } catch (_) {}
          try { window.CloudGSTNative.setBioLock(!on); } catch (_) {}
          setTimeout(paint, 400);
        });
      })();

      // ===== Data source: 📱 Phone (bina cloud) / ☁️ Cloud — header me switch =====
      const GP_SRC_KEY = "gst_data_source_v1";
      const GP_PHONE_CLIENT_KEY = "gst_phone_login_client_v1";
      function gpPhoneAvailable() {
        try { return !!(window.CloudGSTNative && CloudGSTNative.phoneFetch2b); } catch (_) { return false; }
      }
      // v5.9.13: ek baar sabko cloud par le aao (phone beta me atke na rahein)
      try {
        if (!localStorage.getItem("gst_src_reset_v13")) {
          localStorage.setItem("gst_src_reset_v13", "1");
          localStorage.setItem("gst_data_source_v1", "cloud");
        }
      } catch (_) { }

      function gpDataSource() {
        try { const v = localStorage.getItem(GP_SRC_KEY); if (v === "cloud" || v === "phone") return v; } catch (_) {}
        return "cloud";   // default cloud (jo pehle se chal raha hai); phone mode = beta, switch se on
      }
      // 📱 Phone-mode debug log (ek tap me copy karke bhej sakte hain)
      const GP_DBG_KEY = "gst_phone_debug_v1";
      function gpPhoneDbg(msg) {
        try {
          const line = new Date().toLocaleTimeString("en-IN") + " • " + String(msg).slice(0, 300);
          const arr = JSON.parse(localStorage.getItem(GP_DBG_KEY) || "[]");
          arr.push(line);
          while (arr.length > 60) arr.shift();
          localStorage.setItem(GP_DBG_KEY, JSON.stringify(arr));
        } catch (_) { }
      }
      function gpPhoneDebugText() {
        let base = "";
        try {
          base = "app " + (window.CloudGSTNative && CloudGSTNative.appVersion ? CloudGSTNative.appVersion() : "web")
            + " | source: " + gpDataSource()
            + " | phone api: " + (gpPhoneAvailable() ? "yes" : "no")
            + " | login api: " + (gpPhoneLoginAvailable() ? "yes" : "no");
          base += "\nstage: " + String(window.CloudGSTNative.phoneStage ? window.CloudGSTNative.phoneStage() : "-");
        } catch (_) { }
        let lines = [];
        try { lines = JSON.parse(localStorage.getItem(GP_DBG_KEY) || "[]"); } catch (_) { }
        return "CloudGST phone-mode debug\n" + base + "\n---\n" + (lines.join("\n") || "(koi entry nahi)");
      }
      async function gpPhoneDebugCopy() {
        const txt = gpPhoneDebugText();
        try {
          if (window.CloudGSTNative && CloudGSTNative.shareText) { CloudGSTNative.shareText(txt, "Phone mode debug"); return; }
        } catch (_) { }
        try { await navigator.clipboard.writeText(txt); gpToast("📋 Debug copy ho gaya"); }
        catch (_) { gpToast("Debug: " + txt.slice(0, 200)); }
      }
      window.gpPhoneDebugCopy = gpPhoneDebugCopy;
      window.__gpPhoneDebugText = gpPhoneDebugText;
      function gpSetDataSource(v) {
        const val = v === "cloud" ? "cloud" : "phone";
        try { localStorage.setItem(GP_SRC_KEY, val); } catch (_) {}
        if (window.__gpPaintSrcSwitch) window.__gpPaintSrcSwitch();
        gpToast(val === "phone"
          ? "📱 Phone mode: data seedha phone se (cloud nahi) — login chhupe me chalta hai"
          : "☁️ Cloud mode: Railway bridge se data (phone band kar sakte hain)");
      }
      function gpPhoneModeNow() { return gpDataSource() === "phone" && gpPhoneAvailable(); }
      function gpPhoneLoginClient(v) {
        try {
          if (v === undefined) return String(localStorage.getItem(GP_PHONE_CLIENT_KEY) || "");
          if (v) localStorage.setItem(GP_PHONE_CLIENT_KEY, String(v));
          else localStorage.removeItem(GP_PHONE_CLIENT_KEY);
        } catch (_) { }
        return "";
      }
      // debug/test hook (app ke andar bhi kaam aata hai)
      window.__gpGetSrc = gpDataSource;
      window.__gpSetSrc = gpSetDataSource;
      window.__gpPhoneMode = gpPhoneModeNow;
      window.__gpPhoneFetch = (fy, mon) => gpPhoneFetch2b(fy, mon);
      window.__gpPhoneLoginStart = (c, pw) => gpPhoneLoginStart(c, pw);
      window.__gpPhoneLoginCaptcha = (cap) => gpPhoneLoginCaptcha(cap);
      window.__gpPhoneLoginOtp = (otp) => gpPhoneLoginOtp(otp);
      window.__gpPhoneLoginAvailable = gpPhoneLoginAvailable;

      function gpPhoneLoginAvailable() {
        try { return !!(window.CloudGSTNative && CloudGSTNative.phoneLoginStart); } catch (_) { return false; }
      }
      let gpPhoneLoginId = "";
      const gpPhonePending = {};
      window.gpPhoneFetchReady = function (id) {
        const p = gpPhonePending[id];
        if (!p || !window.CloudGSTNative) return;
        try {
          let out = "", off = 0, guard = 0;
          while (guard++ < 80) {
            const ch = String(window.CloudGSTNative.phoneFetchChunk(String(id), off, 300000) || "");
            if (!ch) break;
            out += ch;
            off += ch.length;
          }
          delete gpPhonePending[id];
          const data = out ? JSON.parse(out) : { ok: false, error: "Phone mode: jawab khali aaya." };
          if (data && data.ok === false) {
            const e = new Error(data.error || "Phone mode fail");
            e.code = data.code || "";
            e.data = data;
            p.reject(e);
          } else {
            p.resolve(data);
          }
        } catch (e) {
          delete gpPhonePending[id];
          p.reject(new Error("Phone mode ka jawab padh nahi paye: " + (e.message || e)));
        }
      };
      // Native se jawab POLL karke lo (push miss ho jaye to bhi jawab milta hai) — stage bhi dikhta hai
      function gpNativePoll(id, label, timeoutMs, onStage) {
        return new Promise((resolve, reject) => {
          const started = Date.now();
          let lastStage = "";
          const tick = () => {
            let raw = "";
            try { raw = String(window.CloudGSTNative.phonePayloadFor(String(id)) || ""); } catch (_) { raw = ""; }
            try { lastStage = String(window.CloudGSTNative.phoneStage() || lastStage || ""); } catch (_) { }
            try { if (onStage) onStage(lastStage); } catch (_) { }
            if (raw) {
              clearInterval(timer);
              try {
                const data = JSON.parse(raw);
                if (data && data.ok === false) {
                  const e = new Error(data.error || (label + " fail"));
                  e.code = data.code || "";
                  e.data = data;
                  reject(e);
                } else resolve(data);
              } catch (e) {
                reject(new Error(label + ": jawab padh nahi paye"));
              }
              return;
            }
            if (Date.now() - started > timeoutMs) {
              clearInterval(timer);
              reject(new Error(label + ": time par jawab nahi aaya" + (lastStage ? " (step: " + lastStage + ")" : "")));
            }
          };
          const timer = setInterval(tick, 1200);
          tick();
        });
      }

      function gpPhoneLoginStart(c, pw) {
        return new Promise((resolve, reject) => {
          if (!gpPhoneLoginAvailable()) return reject(new Error("Phone login is app me nahi hai — app update karein (ya ☁️ Cloud mode)."));
          let id = "";
          try { id = String(window.CloudGSTNative.phoneLoginStart(String(c.portalId || "").trim(), String(pw || "")) || ""); } catch (e) { id = ""; }
          if (!id) return reject(new Error("Phone login start nahi ho paya."));
          gpPhoneLoginId = id;
          let shownOverlay = false;
          const onStage = (stage) => {
            if (shownOverlay) return;
            if (stage && stage.indexOf("manual-wait") >= 0) {
              shownOverlay = true;
              gpPhoneDbg("manual-wait -> overlay");
              try { window.CloudGSTNative.phoneLoginVisible(true); } catch (_) {}
              gpToast("🔐 Login page app ke andar hi khul gaya — captcha/OTP daalein, login hote hi aage chala jayega");
            }
          };
          gpNativePoll(id, "Phone login", 320000, onStage).then((r) => {
            try { window.CloudGSTNative.phoneLoginVisible(false); } catch (_) {}
            resolve(r);
          }, (e) => {
            try { window.CloudGSTNative.phoneLoginVisible(false); } catch (_) {}
            reject(e);
          });
        });
      }
      function gpPhoneLoginCaptcha(cap) {
        return new Promise((resolve, reject) => {
          if (!gpPhoneLoginId) return reject(new Error("Pehle phone login start karein."));
          try {
            if (window.CloudGSTNative.clearPhonePayload) window.CloudGSTNative.clearPhonePayload(gpPhoneLoginId);
            window.CloudGSTNative.phoneLoginCaptcha(String(cap || ""));
          }
          catch (e) { return reject(new Error("Captcha bhej nahi paye: " + (e.message || e))); }
          gpPhoneDbg("captcha submit: " + String(cap).slice(0, 12));
          gpNativePoll(gpPhoneLoginId, "Phone login (captcha)", 320000).then(resolve, reject);
        });
      }
      function gpPhoneLoginOtp(otp) {
        return new Promise((resolve, reject) => {
          if (!gpPhoneLoginId) return reject(new Error("Pehle phone login start karein."));
          try {
            if (window.CloudGSTNative.clearPhonePayload) window.CloudGSTNative.clearPhonePayload(gpPhoneLoginId);
            window.CloudGSTNative.phoneLoginOtp(String(otp || ""));
          }
          catch (e) { return reject(new Error("OTP bhej nahi paye: " + (e.message || e))); }
          gpPhoneDbg("otp submit");
          gpNativePoll(gpPhoneLoginId, "Phone login (OTP)", 320000).then(resolve, reject);
        });
      }

      function gpPhoneFetch2b(fy, mon) {
        return new Promise((resolve, reject) => {
          if (!gpPhoneAvailable()) return reject(new Error("Phone mode sirf Android app me chalta hai — ☁️ Cloud mode use karein."));
          let id = "";
          try { id = String(window.CloudGSTNative.phoneFetch2b(String(fy || ""), String(mon || "")) || ""); } catch (e) { id = ""; }
          if (!id) return reject(new Error("Phone mode start nahi ho paya — app dobara khol kar try karein."));
          gpPhoneDbg("2b fetch start");
          gpNativePoll(id, "Phone mode", 200000).then((r) => { gpPhoneDbg("2b ok"); resolve(r); },
            (e) => { gpPhoneDbg("2b fail: " + (e && e.message)); reject(e); });
        });
      }

      // Header switch: 📱 Phone | ☁️ Cloud (sirf app me; browser me poora hidden)
      (function gpInitSrcSwitch() {
        const lockBtn = document.getElementById("lockAppBtn");
        if (!lockBtn || document.getElementById("gpSrcSwitch")) return;
        const wrap = document.createElement("div");
        wrap.id = "gpSrcSwitch";
        wrap.className = "inline-flex items-center rounded-xl overflow-hidden border border-slate-700 bg-slate-800 text-[11px] font-bold";
        wrap.innerHTML = '<button type="button" data-src="phone" class="px-2.5 py-2">📱 Phone 🧪</button>'
          + '<button type="button" data-src="cloud" class="px-2.5 py-2">☁️ Cloud</button>';
        const anchorBtn = document.getElementById("gpNativeBioBtn") || lockBtn;
        anchorBtn.insertAdjacentElement("afterend", wrap);
        const paint = () => {
          if (!gpPhoneAvailable()) { wrap.classList.add("hidden"); return; }
          wrap.classList.remove("hidden");
          const cur = gpDataSource();
          wrap.querySelectorAll("button").forEach(b => {
            const on = b.getAttribute("data-src") === cur;
            b.className = "px-2.5 py-2 " + (on ? "bg-indigo-500 text-white" : "text-slate-300 hover:bg-slate-700");
            b.title = b.getAttribute("data-src") === "phone"
              ? "Phone mode: data seedha phone se fetch hota hai (cloud server ki zaroorat nahi)"
              : "Cloud mode: Railway cloud server se fetch hota hai (phone band kar sakte hain)";
          });
        };
        wrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
          if (b.getAttribute("data-src") === gpDataSource()) return;
          gpSetDataSource(b.getAttribute("data-src"));
        }));
        window.__gpPaintSrcSwitch = paint;
        paint();
        setTimeout(paint, 600);
      })();

      // ===== APK: header me seedha 👆 Fingerprint button (option dhoondhna na pade) =====
      (function gpInitNativeBioHeader() {
        const native = window.CloudGSTNative;
        if (!native) return;
        const lockBtn = document.getElementById("lockAppBtn");
        if (!lockBtn || document.getElementById("gpNativeBioBtn")) return;

        const btn = document.createElement("button");
        btn.id = "gpNativeBioBtn";
        btn.type = "button";
        btn.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 transition";
        btn.innerHTML = "<span>👆 Fingerprint: —</span>";
        lockBtn.insertAdjacentElement("afterend", btn);

        const status = () => {
          try { if (native.bioStatus) return String(native.bioStatus()); } catch (_) {}
          try { return native.hasBiometric() ? "ok" : "none"; } catch (_) { return "none"; }
        };
        const isOn = () => { try { return !!native.isBioLockEnabled(); } catch (_) { return false; } };

        const paint = () => {
          const st = status();
          if (st === "none") {
            btn.innerHTML = "<span>👆 Fingerprint: set nahi</span>";
            btn.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-500/40 bg-amber-500/15 text-amber-200 transition";
          } else if (isOn()) {
            btn.innerHTML = "<span>👆 Fingerprint: ON</span>";
            btn.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-400/50 bg-emerald-500 text-white transition";
          } else {
            btn.innerHTML = "<span>👆 Fingerprint: OFF</span>";
            btn.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 transition";
          }
        };

        btn.addEventListener("click", () => {
          if (status() === "none") {
            if (window.showToast) showToast("⚠️ Phone Settings → Security → Fingerprint / Screen lock (PIN) set karein, phir yeh dabayein");
            return;
          }
          try { native.setBioLock(!isOn()); } catch (_) {}
          setTimeout(() => { paint(); if (window.__gpPaintBioLock) window.__gpPaintBioLock(); }, 400);
        });

        window.gpToggleNativeBio = () => btn.click();
        paint();
        window.__gpPaintNativeBioHeader = paint;
      })();

      document.getElementById("gpSavedJsonSel")?.addEventListener("change", (e) => {
        const id = e.target.value;
        if (id) gpLoadSavedJsonById(id);
      });
      document.getElementById("gpRefreshSavedJsonBtn")?.addEventListener("click", () => gpRefreshSavedJsonList(false));
      document.getElementById("gpLoadAllSavedJsonBtn")?.addEventListener("click", () => gpLoadAllSavedJson());
      document.getElementById("gpClearFolderBtn")?.addEventListener("click", () => { gpMatchedJsons.clear(); gpUpdateFolderBanner(); gpRenderSerialList(); });
      document.getElementById("gpToggleCredsModeBtn")?.addEventListener("click", () => { gpCredsMode = !gpCredsMode; gpRenderSerialList(); });
      document.getElementById("gpClearSheetMonthBtn")?.addEventListener("click", gpClearOldMonthInSheet);
      document.getElementById("gpFySel")?.addEventListener("change", () => { gpExpanded.clear(); gpUpdateFolderBanner(); gpRenderSerialList(); });
      document.getElementById("gpMonSel")?.addEventListener("change", () => { gpExpanded.clear(); gpUpdateFolderBanner(); gpRenderSerialList(); });
      document.querySelectorAll("#gpWaDocModalOverlay .gp-wa-tpl-btn").forEach(b => b.addEventListener("click", () => {
        gpActiveWaTpl = b.getAttribute("data-gp-wa-tpl") || "etsy";
        gpUpdateWaTplUI();
      }));
      document.getElementById("gpCloseWaDocModalBtn")?.addEventListener("click", () => document.getElementById("gpWaDocModalOverlay")?.classList.add("hidden"));
      document.getElementById("gpWaDocModalOverlay")?.addEventListener("click", (e) => { if (e.target.id === "gpWaDocModalOverlay") document.getElementById("gpWaDocModalOverlay")?.classList.add("hidden"); });
      document.getElementById("gpWaDocCopyBtn")?.addEventListener("click", () => {
        gpCopyText(document.getElementById("gpWaDocMsgArea")?.value || "", "WhatsApp Message");
      });
      document.getElementById("gpWaDocSendBtn")?.addEventListener("click", () => {
        if (!gpActiveWaClient) return;
        const msg = (document.getElementById("gpWaDocMsgArea")?.value || "").trim();
        const digits = String(gpActiveWaClient.mobile || "").replace(/\D/g, "");
        if (!digits) { gpToast("⚠️ Is client ka Mobile No. saved nahi hai — ✏️ se mobile add karein."); return; }
        const phone = digits.length === 10 ? ("91" + digits) : digits;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
        document.getElementById("gpWaDocModalOverlay")?.classList.add("hidden");
      });

      const bInp = document.getElementById("gpBridgeUrlInp");
      const sInp = document.getElementById("gpBridgeSecInp");
      if (bInp) bInp.value = gpGetBridgeUrl() || "https://cloudgst-production.up.railway.app";
      if (sInp) sInp.value = gpGetBridgeSec();
      gpUpdateQuickButtons();
      gpInitOptions();
      document.getElementById("gpBridgeTestBtn")?.addEventListener("click", async () => {
        const info = document.getElementById("gpBridgeInfo");
        if (info) info.textContent = "checking…";
        const h = await gpBridgeHealth(8000);
        if (info) {
          info.textContent = h.ok
            ? `✅ v${(h.data && h.data.version) || "?"} · ${h.ms}ms · uptime ${(h.data && h.data.uptimeSec != null) ? h.data.uptimeSec + "s" : "-"} · ${h.url}`
            : `❌ ${h.reason || "fail"} · ${h.url}`;
        }
        gpToast(h.ok ? `✅ Bridge theek (v${(h.data && h.data.version) || "?"}, ${h.ms}ms)` : `❌ Bridge: ${h.reason || "fail"} — ${h.url}`);
      });
      document.getElementById("gpBridgeRetryBtn")?.addEventListener("click", async () => {
        gpToast("🔄 Bridge dobara check kar rahe hain…");
        const up = await gpWaitBridgeUp(20000, (n, secs) => {
          const sub = document.getElementById("gpBridgeOfflineSub");
          if (sub) sub.textContent = "Check ho raha hai… (" + secs + "s)";
        });
        if (up.ok) { gpBridgeMark(true); gpToast("✅ Bridge wapas aa gaya (v" + ((up.data && up.data.version) || "?") + ") — ab Re-Fetch karein."); }
        else { gpBridgeMark(false); gpToast("❌ Bridge abhi bhi down: " + ((up.last && up.last.reason) || "no response")); }
      });
      gpBridgeHealth(6000);
      window.renderPortalPage();
    })();
