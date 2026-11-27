    const STORAGE_KEY = "gst_tracker_verified_clients_v5";
    const SCRIPT_URL_KEY = "gst_tracker_apps_script_url_permanent";
    const PIN_STORAGE_KEY = "gst_tracker_pin_code_permanent";
    const SYNC_SECRET_KEY = "gst_apps_script_sync_secret_v1";
    const FEE_REV_KEY = "gst_fee_revision_v1";

    let clients = [];
    let scriptUrl = "";
    let appPin = "";
    function getSyncSecret() {
      try { return String(localStorage.getItem(SYNC_SECRET_KEY) || "").trim(); } catch (e) { return ""; }
    }
    function saveSyncSecret(sec) {
      try {
        const s = String(sec || "").trim();
        if (s) localStorage.setItem(SYNC_SECRET_KEY, s);
        else localStorage.removeItem(SYNC_SECRET_KEY);
      } catch (e) {}
    }
    function withSyncSecret(payload) {
      const sec = getSyncSecret();
      return sec ? Object.assign({}, payload || {}, { syncSecret: sec }) : (payload || {});
    }
    function getLocalFeeRevision() {
      try { return Number(localStorage.getItem(FEE_REV_KEY) || 0) || 0; } catch (e) { return 0; }
    }
    function setLocalFeeRevision(rev) {
      try {
        const n = Number(rev);
        if (Number.isFinite(n) && n >= 0) localStorage.setItem(FEE_REV_KEY, String(n));
      } catch (e) {}
    }
    let searchQuery = "";
    let activeTab = "ALL";
    let activeClientType = "ALL";
    let activeDueFilter = "ALL";
    let activeRefFilter = "ALL";
    let activeStatusFilter = "ALL";
    let showInactive = false;
    const isInactive = c => String(c.status || "").toLowerCase() === "inactive";
    let toastTimer = null;

    function updateReferenceSuggestions() {
      const datalist = document.getElementById("referenceSuggestionsList");
      if (!datalist) return;
      const refSet = new Set();
      // Add from current clients in database
      clients.forEach(c => {
        const r = (c.reference || "").trim();
        if (r && r !== "-" && r !== "0") refSet.add(r);
      });
      // Add standard frequent references
      [
        "ARBAZ BHAI (7355977287)",
        "ARBAZ VIA RUHAN (9305942171)",
        "ARBAZ VIA ARHAM (6386616397)",
        "ADWIK JAISWAL (9140000950)",
        "AFTAB(NAJMA GST){6389185397}",
        "AHSAN BUSARA F (9119861010)",
        "AZAD (9956968105)",
        "R ANSARI (7068122215)",
        "QASIM ANSARI(9580717609)",
        "SHADAB (Qasim) 8423014044",
        "Hamza Bhai (9721768510)",
        "BABLU ANSARI (8423293337)",
        "FAHAD ANSARI (9511193897)",
        "FAISAL ANSARI",
        "RUHAN ANSARI (9305942171)",
        "SAMEER BHAI (80819 22184)",
        "Saleem Bhai (8576822672)",
        "RAZIK BHAI (7499119887)",
        "ROHIT UPADHYAY(9565795745)",
        "BUSRA HUSBEND (8604479012)",
        "BUSRA HELP (9532281898)"
      ].forEach(r => refSet.add(r));

      // Sort alphabetically so 'A' items come first
      const sorted = Array.from(refSet).sort((a, b) => a.localeCompare(b));
      datalist.innerHTML = sorted.map(r => `<option value="${r}"></option>`).join("");
    }

        // Device Identity & Email OTP Verification
        // Modern WebAuthn Biometric / Fingerprint Authentication
    async function triggerBiometricAuthentication() {
      if (!bioEnrolled()) {
        showToast("🔐 Pehle is device par password se login karein — uske baad hi Fingerprint/Face chalega.");
        return;
      }
      try {
        const stored = localStorage.getItem(BIO_KEY) || getCookie(BIO_KEY);
        showToast("👆 Fingerprint / Face verify karein...");
        const cred = await navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            timeout: 60000,
            userVerification: "required",
            allowCredentials: [{ type: "public-key", id: unb64(stored), transports: ["internal"] }]
          }
        });
        if (cred && b64(cred.rawId) === stored) {
          unlockApp("🎉 Fingerprint Verified! (Client passwords dekhne ke liye app password se unlock karein)");
        }
      } catch (err) {
        showToast(err && err.name === "NotAllowedError" ? "❌ Fingerprint verify cancel/fail hua. Password dalein." : "ℹ️ Fingerprint chala nahi. Password dalein.");
      }
    }

    function getDeviceId() {
      let id = null;
      try { id = localStorage.getItem("gst_device_unique_id"); } catch (e) {}
      if (!id) id = getCookie("gst_device_unique_id");
      if (!id) {
        id = "dev_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
        try {
          localStorage.setItem("gst_device_unique_id", id);
          setCookie("gst_device_unique_id", id, 365);
        } catch(e) {}
      }
      return id;
    }

    function isDeviceTrusted() {
      return true; // email OTP security hata di gayi
    }

    function markDeviceTrusted() {
      try {
        localStorage.setItem("gst_device_trusted", "true");
        setCookie("gst_device_trusted", "true", 365);
      } catch(e) {}
    }

    async function sendDeviceEmailOtp() {
      if (!scriptUrl) return;
      const devId = getDeviceId();
      document.getElementById("otpModalSubtitle").textContent = "Aapke Gmail par OTP bheja ja raha hai...";
      try {
        const r = await postVerifiedToAppsScript({ action: "sendDeviceOtp", deviceId: devId });
        const d = r && r.data ? r.data : null;
        const sub = document.getElementById("otpModalSubtitle");
        if (r && r.ok && d && d.email) {
          sub.textContent = "OTP is address par bhej diya gaya hai: " + d.email + " (Spam/Promotions bhi dekhein)";
          showToast("📩 OTP bhej diya gaya!");
        } else if (r && r.ok) {
          sub.textContent = "❌ Apps Script ka purana version chal raha hai (OTP wala code nahi hai). Naya code paste karke 'New version' deploy karein.";
        } else {
          sub.textContent = "❌ OTP nahi gaya: " + ((r && r.message) || "Apps Script ne error diya") + " — Gmail permission / deploy settings check karein.";
        }
      } catch(e) {
        document.getElementById("otpModalSubtitle").textContent = "❌ Apps Script se connect nahi ho paya. Deploy me 'Who has access: Anyone' rakhein, URL /exec wala ho, aur Resend dabayein.";
      }
    }

    // ===== APK: native fingerprint lock ON hai to app ka apna password popup dobara na aaye =====
    function gpNativeBioOn() {
      try { return !!(window.CloudGSTNative && CloudGSTNative.isBioLockEnabled && CloudGSTNative.isBioLockEnabled()); } catch (_) { return false; }
    }

    // Native fingerprint verify hone ke baad app isse bulati hai -> lock screen hat jata hai
    window.cloudGstNativeUnlocked = function () {
      try {
        document.getElementById("pinLockOverlay").classList.add("hidden");
        document.getElementById("pinErrorMsg").classList.add("hidden");
        document.getElementById("pinInput").value = "";
        if (typeof showToast === "function") showToast("👆 Fingerprint verified — app unlock ho gaya!");
      } catch (_) {}
    };

    // Client ka portal password (enc:v1:) dekhne ke liye app password chahiye hota hai
    window.gpAskAppPassword = function (subtitle) {
      try {
        const sub = document.getElementById("pinModalSubtitle");
        if (sub && subtitle) sub.textContent = subtitle;
        document.getElementById("pinInput").value = "";
        document.getElementById("pinErrorMsg").classList.add("hidden");
        document.getElementById("pinLockOverlay").classList.remove("hidden");
        setTimeout(() => { const f = document.getElementById("pinInput"); if (f) f.focus(); }, 120);
      } catch (_) {}
    };

    function checkDeviceAndAuthenticate() {
      // Fingerprint lock ON (APK) -> native lock screen hi gate hai, dobara password popup nahi
      if (gpNativeBioOn()) {
        document.getElementById("deviceOtpOverlay").classList.add("hidden");
        document.getElementById("pinLockOverlay").classList.add("hidden");
        return;
      }
      // Fresh install (na strong password, na legacy PIN): seedha strong password set karao (no hardcoded fallback PIN)
      document.getElementById("deviceOtpOverlay").classList.add("hidden");
      if (!hasStrongPw() && !appPin) {
        document.getElementById("pinLockOverlay").classList.remove("hidden");
        if (typeof openPwModal === "function") openPwModal("migrate");
        return;
      }
      // Email OTP wali device-security hata di gayi hai: seedha password screen
      document.getElementById("pinInput").value = "";
      document.getElementById("pinErrorMsg").classList.add("hidden");
      document.getElementById("pinLockOverlay").classList.remove("hidden");
      setTimeout(() => { const f = document.getElementById("pinInput"); if (f) f.focus(); }, 100);
    }

    function loadClients() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 78) {
            clients = parsed;
            return;
          }
        }
      } catch (e) {}
      clients = JSON.parse(JSON.stringify(INITIAL_CLIENTS));
      saveClients();
    }

    function safeStorageSet(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        // QuotaExceededError recovery: compact ya clear cached Master Etsy workbooks taaki critical data/password kabhi fail na ho
        try {
          if (typeof MASTER_ETSY_STORAGE_KEY !== "undefined" && key !== MASTER_ETSY_STORAGE_KEY) {
            if (typeof saveMasterWorkbooks === "function") saveMasterWorkbooks();
            try {
              localStorage.setItem(key, value);
              return true;
            } catch (e2) {
              localStorage.removeItem(MASTER_ETSY_STORAGE_KEY);
              localStorage.setItem(key, value);
              return true;
            }
          }
        } catch (e3) {}
        return false;
      }
    }

    function saveClients() {
      safeStorageSet(STORAGE_KEY, JSON.stringify(clients));
    }

    function setCookie(name, value, days) {
      try {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
      } catch(e) {}
    }

    function getCookie(name) {
      try {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      } catch(e) { return null; }
    }

    function loadScriptUrl() {
      try {
        const saved = localStorage.getItem(SCRIPT_URL_KEY) ||
                      localStorage.getItem("gst_permanent_sync_url") ||
                      localStorage.getItem("gst_tracker_apps_script_url_v1") ||
                      localStorage.getItem("gst_tracker_apps_script_url_v3") ||
                      getCookie("gst_permanent_sync_url") ||
                      sessionStorage.getItem(SCRIPT_URL_KEY);
        if (saved && saved.trim()) {
          scriptUrl = saved.trim();
          document.getElementById("scriptUrlInput").value = scriptUrl;
          const directInp = document.getElementById("directBannerScriptUrlInput");
          if (directInp) directInp.value = scriptUrl;
        }
      } catch (e) {}
      updateSyncBanner();
    }

    function savePermanentConfig(url, pin) {
      if (url) {
        scriptUrl = url.trim();
        try {
          localStorage.setItem(SCRIPT_URL_KEY, scriptUrl);
          localStorage.setItem("gst_permanent_sync_url", scriptUrl);
          localStorage.setItem("gst_tracker_apps_script_url_v1", scriptUrl);
          sessionStorage.setItem(SCRIPT_URL_KEY, scriptUrl);
          setCookie("gst_permanent_sync_url", scriptUrl, 365);
        } catch(e) {}
      }
      if (pin) {
        appPin = String(pin).trim();
        try {
          localStorage.setItem(PIN_STORAGE_KEY, appPin);
          localStorage.setItem("gst_permanent_pin", appPin);
          localStorage.setItem("gst_tracker_pin_code_v3", appPin);
          localStorage.setItem("gst_user_custom_pin_set", "true");
          setCookie("gst_permanent_pin", appPin, 365);
          setCookie("gst_user_custom_pin_set", "true", 365);
        } catch(e) {}
      }
    }

    function loadPin() {
      try {
        const saved = localStorage.getItem(PIN_STORAGE_KEY) ||
                      localStorage.getItem("gst_permanent_pin") ||
                      getCookie("gst_permanent_pin");
        if (saved && saved.length === 6 && saved !== "123456") {
          appPin = saved;
        } else {
          appPin = "";
        }
      } catch (e) {
        appPin = "";
      }
      document.getElementById("pinModalSubtitle").textContent = hasStrongPw()
        ? "Apna Strong Password dalein"
        : (appPin ? "Upgrade: pehle purana 6-digit PIN dalein, phir naya strong password banayein" : "Naya Strong Password set karein");
    }

    function showToast(msg) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.classList.remove("hidden");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.classList.add("hidden"); }, 3000);
    }

    const MON_SHORT_ARR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function formatDdmmyyyyMon(dateObj = new Date()) {
      const d = String(dateObj.getDate()).padStart(2, "0");
      const m = MON_SHORT_ARR[dateObj.getMonth()];
      const y = dateObj.getFullYear();
      return `${d}-${m}-${y}`;
    }
    function getDefaultMonthEndPtDate(dateObj = new Date()) {
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      const day = m === 1 ? lastDay : Math.min(30, lastDay);
      return `${String(day).padStart(2, "0")}-${MON_SHORT_ARR[m]}-${y}`;
    }
    function getCurrentMonYearLabel(dateObj = new Date()) {
      return `${MON_SHORT_ARR[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }

    function cleanClientKeyName(n) {
      return String(n || "").replace(/\*/g, "").trim().toUpperCase();
    }
    function getClientKey(c) {
      if (!c) return "";
      const gst = String(c.gstin || "").trim().toUpperCase();
      if (gst && gst.length >= 10) return "GST:" + gst;
      const uid = String(c.uid || "").trim().toUpperCase();
      if (uid) return "UID:" + uid;
      const cat = String(c.category || "PAID CLINTS").trim().toUpperCase();
      return "NM:" + cat + ":" + cleanClientKeyName(c.client);
    }
    function findClientByReceipt(item) {
      if (!item) return null;
      if (item.clientKey) {
        const byKey = clients.find(c => getClientKey(c) === item.clientKey);
        if (byKey) return byKey;
      }
      if (item.gstin) {
        const g = String(item.gstin).trim().toUpperCase();
        const byG = clients.find(c => String(c.gstin || "").trim().toUpperCase() === g);
        if (byG) return byG;
      }
      if (item.client) {
        const nm = cleanClientKeyName(item.client);
        const byN = clients.find(c => cleanClientKeyName(c.client) === nm);
        if (byN) return byN;
      }
      return clients.find(c => c.sr === item.sr) || null;
    }

    // Delete/clear se pehle sabse confirmation lene wala common helper
    function confirmDelete(msg) {
      try { return window.confirm(msg || "Kya aap pakka ye delete karna chahte hain?\n\nYe wapas nahi aa sakta."); }
      catch (e) { return false; }
    }

    const PENDING_SYNC_QUEUE_KEY = "gst_pending_sheet_sync_v1";
    const FEE_DIRTY_KEY = "gst_fee_dirty_v1";
    const FEE_DELETED_RECEIPTS_KEY = "gst_fee_deleted_rcps_v1";
    let syncInFlight = false;
    let lastSyncHealthState = ""; // "ok" | "error" | "offline"
    let lastSyncHealthMsg = "";

    function getPendingSyncQueue() {
      try {
        const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }
    function savePendingSyncQueue(arr) {
      try { localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(arr || [])); } catch (e) {}
    }
    function queuePendingSheetSync(action, clientObj) {
      const q = getPendingSyncQueue();
      const key = getClientKey(clientObj);
      const copy = Object.assign({}, clientObj);
      // Client password GST Details Sheet ke Password column me sync hoga
      const idx = q.findIndex(it => it.action === action && it.key === key);
      const entry = { action, key, clientObj: copy, ts: Date.now() };
      if (idx >= 0) q[idx] = entry;
      else q.push(entry);
      savePendingSyncQueue(q);
      updateSyncBanner();
    }
    function isFeeDirty() {
      try { return localStorage.getItem(FEE_DIRTY_KEY) === "1"; } catch (e) { return false; }
    }
    function setFeeDirty(flag) {
      try {
        if (flag) localStorage.setItem(FEE_DIRTY_KEY, "1");
        else localStorage.removeItem(FEE_DIRTY_KEY);
      } catch (e) {}
    }
    function getDeletedReceiptIds() {
      try {
        const raw = localStorage.getItem(FEE_DELETED_RECEIPTS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }
    function addDeletedReceiptId(rNo) {
      if (!rNo) return;
      const arr = getDeletedReceiptIds();
      if (!arr.includes(rNo)) arr.push(rNo);
      try { localStorage.setItem(FEE_DELETED_RECEIPTS_KEY, JSON.stringify(arr.slice(-200))); } catch (e) {}
    }
    function clearDeletedReceiptIds() {
      try { localStorage.removeItem(FEE_DELETED_RECEIPTS_KEY); } catch (e) {}
    }

    function setSyncHealth(state, msg = "") {
      lastSyncHealthState = state;
      lastSyncHealthMsg = msg;
      updateSyncBanner();
    }

    function updateSyncBanner() {
      const dot = document.getElementById("syncStatusDot");
      const label = document.getElementById("syncStatusLabel");
      if (!dot || !label) return;
      const pendingCount = getPendingSyncQueue().length;
      if (!scriptUrl) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
        label.textContent = "Offline / Local Mode (Sheet se auto-sync ke liye ⚙️ Setup me URL dalein)";
      } else if (lastSyncHealthState === "error" || pendingCount > 0) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse";
        const pendTxt = pendingCount > 0 ? ` (${pendingCount} pending retry)` : "";
        label.textContent = `Sheet Sync Error${pendTxt}: ${lastSyncHealthMsg || "Connection check karein"}`;
      } else if (lastSyncHealthState === "offline") {
        dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
        label.textContent = `Offline Mode: ${lastSyncHealthMsg || "Internet band hai"}`;
      } else {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
        label.textContent = "Google Sheet 2-Way Sync Active (Connected)";
      }
    }

    async function postVerifiedToAppsScript(payload) {
      if (!scriptUrl) {
        return { ok: false, noUrl: true, message: "Sheet Sync URL set nahi hai" };
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { ok: false, offline: true, message: "Internet band hai" };
      }
      const res = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(withSyncSecret(payload))
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}` };
      }
      if (text.includes("accounts.google.com") || text.includes("ServiceLogin")) {
        return { ok: false, message: "Apps Script Deploy me 'Who has access: Anyone' karein" };
      }
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) {}
      if (!parsed || parsed.status !== "ok") {
        return { ok: false, message: (parsed && parsed.message) || "Apps Script ne valid ok response nahi diya" };
      }
      return { ok: true, data: parsed };
    }

    async function pushClientToSheet(action, clientObj, opts = {}) {
      if (!scriptUrl) {
        setSyncHealth("offline", "Sheet Sync URL nahi mila");
        if (!opts.silent) showToast("⚠️ Sirf browser me save hua — Sheet Sync URL set nahi hai!");
        return { ok: false, noUrl: true, message: "Sync URL missing" };
      }
      const payload = Object.assign({ action: action }, clientObj);
      // Client password GST Details Sheet ke alag Password column me sync hota hai
      try {
        const res = await postVerifiedToAppsScript(payload);
        if (!res.ok) {
          if (!opts.skipQueue) queuePendingSheetSync(action, clientObj);
          setSyncHealth(res.offline ? "offline" : "error", res.message);
          if (!opts.silent) {
            showToast(`❌ Sheet Sync FAIL (${res.message}) — Sirf browser me save hua!`);
          }
          return res;
        }
        setSyncHealth("ok");
        return res;
      } catch (err) {
        const msg = (err && err.message) ? err.message : "Network error";
        if (!opts.skipQueue) queuePendingSheetSync(action, clientObj);
        setSyncHealth("error", msg);
        if (!opts.silent) {
          showToast(`❌ Sheet Sync FAIL (${msg}) — Sirf browser me save hua!`);
        }
        return { ok: false, message: msg };
      }
    }

    let feePushSeq = 0;
    function removeDeletedReceiptIds(ids) {
      if (!Array.isArray(ids) || !ids.length) return;
      const drop = new Set(ids);
      const rest = getDeletedReceiptIds().filter(x => !drop.has(x));
      try {
        if (rest.length) localStorage.setItem(FEE_DELETED_RECEIPTS_KEY, JSON.stringify(rest));
        else localStorage.removeItem(FEE_DELETED_RECEIPTS_KEY);
      } catch (e) {}
    }
    async function pushFeeDataToSheet(opts = {}) {
      const myPushSeq = ++feePushSeq;
      const sentDeletedIds = getDeletedReceiptIds().slice();
      setFeeDirty(true);
      if (!scriptUrl) {
        setSyncHealth("offline", "Sheet Sync URL nahi mila");
        return { ok: false, noUrl: true, message: "Sync URL missing" };
      }
      const clientNames = {};
      clients.forEach(c => {
        const k = getClientKey(c);
        if (k) clientNames[k] = c.client || "";
      });
      const payload = {
        action: "saveFeeData",
        baseRevision: getLocalFeeRevision(),
        deletedReceipts: sentDeletedIds,
        ledger: feeLedger,
        profiles: clientFeeProfiles,
        customFees: customClientFees,
        rates: defaultFeeRates,
        clientNames: clientNames
      };
      try {
        const res = await postVerifiedToAppsScript(payload);
        if (!res.ok) {
          setSyncHealth(res.offline ? "offline" : "error", res.message);
          if (!opts.silent) showToast(`⚠️ Fee data browser me save hai, par Sheet Sync FAIL (${res.message})`);
          return res;
        }
        if (res.data && res.data.feeSaved === true) {
          if (res.data.revision !== undefined) setLocalFeeRevision(res.data.revision);
          // Agar is request ke dauran koi aur change/delete hua hai to dirty flag mat hatao (naya push usse handle karega)
          if (myPushSeq === feePushSeq) setFeeDirty(false);
          if (!res.data.merged) removeDeletedReceiptIds(sentDeletedIds);
          setSyncHealth("ok");
          return { ok: true, feeSaved: true, data: res.data };
        }
        return { ok: true, feeSaved: false, message: "Apps Script update karein (AppSync_Fixed.txt) tab Fee Ledger bhi Sheet me sync hoga" };
      } catch (err) {
        const msg = (err && err.message) ? err.message : "Network error";
        setSyncHealth("error", msg);
        if (!opts.silent) showToast(`⚠️ Fee data browser me save hai, par Sheet Sync FAIL (${msg})`);
        return { ok: false, message: msg };
      }
    }

    let flushQueueInFlight = false;
    async function flushPendingSheetQueue() {
      const q = getPendingSyncQueue();
      if (!q.length || !scriptUrl || (typeof navigator !== "undefined" && navigator.onLine === false)) return true;
      if (flushQueueInFlight) return false;
      flushQueueInFlight = true;
      try {
        const done = new Set();
        for (const item of q) {
          const r = await pushClientToSheet(item.action, item.clientObj, { silent: true, skipQueue: true });
          if (r.ok) done.add(item.action + "|" + item.key + "|" + item.ts);
        }
        // Flush ke dauran jo naye items queue me aaye wo bhi bachaye jaayein: sirf bheje ja chuke items hatao
        const latest = getPendingSyncQueue().filter(it => !done.has(it.action + "|" + it.key + "|" + it.ts));
        savePendingSyncQueue(latest);
        updateSyncBanner();
        return latest.length === 0;
      } finally {
        flushQueueInFlight = false;
      }
    }

    // Sheet se client list aane ke baad jo changes abhi sheet tak nahi pahunche (pending queue) unko dobara upar laga do
    function overlayPendingQueueOnClients(list) {
      const q = getPendingSyncQueue();
      if (!q.length || !Array.isArray(list)) return list;
      q.forEach(item => {
        if (!item || !item.clientObj) return;
        const idx = list.findIndex(c => getClientKey(c) === item.key);
        if (idx >= 0) {
          list[idx] = Object.assign({}, list[idx], item.clientObj);
        } else if (item.action === "add") {
          list.unshift(Object.assign({}, item.clientObj));
        }
      });
      return list;
    }

    function migrateClientKeyAcrossMaps(oldKey, newKey) {
      if (!oldKey || !newKey || oldKey === newKey) return;
      if (clientFeeProfiles[oldKey] && !clientFeeProfiles[newKey]) {
        clientFeeProfiles[newKey] = clientFeeProfiles[oldKey];
        delete clientFeeProfiles[oldKey];
      }
      if (customClientFees[oldKey] !== undefined && customClientFees[newKey] === undefined) {
        customClientFees[newKey] = customClientFees[oldKey];
        delete customClientFees[oldKey];
      }
      if (typeof masterWorkbooks === "object" && masterWorkbooks && masterWorkbooks[oldKey] && !masterWorkbooks[newKey]) {
        masterWorkbooks[newKey] = masterWorkbooks[oldKey];
        delete masterWorkbooks[oldKey];
      }
      feeLedger.forEach(item => {
        if (item.clientKey === oldKey) item.clientKey = newKey;
      });
    }

    function migrateLegacySrKeys() {
      let changedFee = false;
      let changedMaster = false;
      [clientFeeProfiles, customClientFees].forEach(mapObj => {
        if (!mapObj || typeof mapObj !== "object") return;
        Object.keys(mapObj).forEach(k => {
          if (/^\d+$/.test(k)) {
            const c = clients.find(x => String(x.sr) === k);
            if (c) {
              const nk = getClientKey(c);
              if (nk && mapObj[nk] === undefined) mapObj[nk] = mapObj[k];
              delete mapObj[k];
              changedFee = true;
            }
          }
        });
      });
      if (typeof masterWorkbooks === "object" && masterWorkbooks) {
        Object.keys(masterWorkbooks).forEach(k => {
          if (/^\d+$/.test(k)) {
            const c = clients.find(x => String(x.sr) === k);
            if (c) {
              const nk = getClientKey(c);
              if (nk && masterWorkbooks[nk] === undefined) masterWorkbooks[nk] = masterWorkbooks[k];
              delete masterWorkbooks[k];
              changedMaster = true;
            }
          }
        });
      }
      feeLedger.forEach(item => {
        if (!item.clientKey) {
          const c = findClientByReceipt(item);
          if (c) {
            item.clientKey = getClientKey(c);
            if (!item.gstin && c.gstin) item.gstin = c.gstin;
            changedFee = true;
          }
        }
      });
      if (changedFee && typeof saveFeeState === "function") saveFeeState();
      if (changedMaster && typeof saveMasterWorkbooks === "function") saveMasterWorkbooks();
    }

    function mergeFeeDataFromSheet(sheetFee) {
      if (!sheetFee || !sheetFee.supported) return;
      if (Array.isArray(sheetFee.deletedReceipts)) {
        sheetFee.deletedReceipts.forEach(id => addDeletedReceiptId(id));
      }
      const delSet = new Set(getDeletedReceiptIds());
      const rawLedger = Array.isArray(sheetFee.ledger) ? sheetFee.ledger : [];
      const sLedger = rawLedger.filter(sr => !(sr && sr.receiptNo && delSet.has(String(sr.receiptNo).trim())));
      const sProfiles = (sheetFee.profiles && typeof sheetFee.profiles === "object") ? sheetFee.profiles : {};
      const sCustom = (sheetFee.customFees && typeof sheetFee.customFees === "object") ? sheetFee.customFees : {};
      const sRates = (sheetFee.rates && typeof sheetFee.rates === "object") ? sheetFee.rates : null;

      const sheetEmpty = rawLedger.length === 0 && Object.keys(sProfiles).length === 0 && Object.keys(sCustom).length === 0 && !sRates;
      const localHasData = feeLedger.length > 0 || Object.keys(clientFeeProfiles).length > 0 || Object.keys(customClientFees).length > 0;

      if (sheetEmpty && localHasData) {
        pushFeeDataToSheet({ silent: true });
        return;
      }

      if (isFeeDirty()) {
        const seen = new Set(feeLedger.map(r => `${r.receiptNo}|${r.clientKey || r.client}|${r.date}|${r.amount}`));
        sLedger.forEach(sr => {
          const sig = `${sr.receiptNo}|${sr.clientKey || sr.client}|${sr.date}|${sr.amount}`;
          if (!seen.has(sig)) {
            feeLedger.push(sr);
            seen.add(sig);
          }
        });
        Object.keys(sProfiles).forEach(k => {
          if (!clientFeeProfiles[k]) clientFeeProfiles[k] = sProfiles[k];
        });
        Object.keys(sCustom).forEach(k => {
          if (customClientFees[k] === undefined) customClientFees[k] = sCustom[k];
        });
        if (sheetFee.revision !== undefined) setLocalFeeRevision(sheetFee.revision);
        saveFeeState();
        pushFeeDataToSheet({ silent: true });
        return;
      }

      if (sRates) {
        defaultFeeRates = {
          sixMonthPkg: Number(sRates.sixMonthPkg ?? 1200),
          activePaid: Number(sRates.activePaid ?? 300),
          nilUnpaid: 0,
          etsy: Number(sRates.etsy ?? 500),
          regular: Number(sRates.regular ?? 500),
          apne: Number(sRates.apne ?? 0)
        };
      }
      clientFeeProfiles = Object.assign({}, sProfiles);
      customClientFees = Object.assign({}, sCustom);
      feeLedger = sLedger.slice();
      if (sheetFee.revision !== undefined) setLocalFeeRevision(sheetFee.revision);
      migrateLegacySrKeys();
      saveFeeState();
      if (typeof applyFeeRateInputsToUi === "function") applyFeeRateInputsToUi();
    }

    async function syncFromGoogleSheet(showModalIfMissing = false, isBackground = false) {
      if (syncInFlight) return;
      let cleanUrl = (scriptUrl || "").trim();
      if (!cleanUrl) {
        if (showModalIfMissing) {
          document.getElementById("syncSetupModalOverlay").classList.remove("hidden");
        }
        if (!isBackground) showToast("ℹ️ Pehle upar URL box me Web App URL paste karein");
        return;
      }

      if (cleanUrl.includes("script.google.com/home") || cleanUrl.includes("/edit")) {
        setSyncHealth("error", "Galat Editor link (/exec URL dalein)");
        if (!isBackground) showToast("❌ Yeh Editor link hai! 'Deploy > Manage deployments' se '/exec' wala Web App URL dalein.");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setSyncHealth("offline", "Internet band hai");
        if (!isBackground) showToast("❌ Internet band hai — Google Sheet sync nahi ho paya!");
        return;
      }

      syncInFlight = true;
      scriptUrl = cleanUrl;
      const btnText = document.getElementById("syncBtnText");
      if (btnText) btnText.textContent = "Syncing...";

      try {
        const flushedOk = await flushPendingSheetQueue();

        const syncSec = getSyncSecret();
        const queryUrl = scriptUrl + (scriptUrl.includes("?") ? "&" : "?") + "t=" + Date.now() + (syncSec ? "&syncSecret=" + encodeURIComponent(syncSec) : "");
        const res = await fetch(queryUrl, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        const textResponse = await res.text();
        if (!res.ok) {
          setSyncHealth("error", `HTTP ${res.status}`);
          if (!isBackground) showToast(`❌ Sheet Sync FAIL (HTTP ${res.status})`);
          return;
        }
        let data = null;
        try {
          data = JSON.parse(textResponse);
        } catch (jsonErr) {
          if (textResponse.includes("accounts.google.com") || textResponse.includes("ServiceLogin")) {
            setSyncHealth("error", "'Who has access: Anyone' set nahi hai");
            if (!isBackground) showToast("❌ Google Access Error: Apps Script Deploy me 'Who has access' ko 'Anyone' karein!");
            return;
          }
        }

        if (data && data.status === "ok") {
          let localCustomPin = null; try { localCustomPin = localStorage.getItem("gst_user_custom_pin_set"); } catch (e) {}
          if (hasStrongPw()) {
            /* strong password sirf is device par rehta hai, cloud PIN ignore */
          } else if (data.appPin && data.appPin.length === 6 && data.appPin !== "123456") {
            savePermanentConfig(null, data.appPin);
            loadPin();
          } else if (!localCustomPin && data.appPin && data.appPin.length === 6) {
            savePermanentConfig(null, data.appPin);
            loadPin();
          }

          if (data.vaultSalt && typeof readVaultSalt === "function" && !readVaultSalt()) {
            try { writeVaultSalt(data.vaultSalt); } catch (e) {}
          } else if (typeof readVaultSalt === "function" && readVaultSalt() && !data.vaultSalt && scriptUrl) {
            postVerifiedToAppsScript({ action: "saveVaultSalt", salt: readVaultSalt() }).catch(() => {});
          }

          if (Array.isArray(data.clients) && data.clients.length > 0) {
            const portalByKey = new Map();
            const portalByName = new Map();
            clients.forEach(c => {
              if (!c.portalData) return;
              const k = getClientKey(c);
              const nm = `${String(c.category || "").toUpperCase()}:${cleanClientKeyName(c.client)}`;
              if (k) portalByKey.set(k, c.portalData);
              portalByName.set(nm, c.portalData);
            });
            const pwByUid = new Map();
            const pwByGstin = new Map();
            const pwByName = new Map();
            const pwByKey = new Map();
            const rovByKey = new Map();
            const rovByName = new Map();
            clients.forEach(c => {
              const k = getClientKey(c);
              const nm = `${String(c.category || "").toUpperCase()}:${cleanClientKeyName(c.client)}`;
              if (c._rovLocal) {
                const rovEntry = { rov: Number(c.rov) || 0, ts: Number(c._rovTs) || 0 };
                if (k) rovByKey.set(k, rovEntry);
                rovByName.set(nm, rovEntry);
              }
              if (!c.password) return;
              if (k) pwByKey.set(k, c.password);
              if (c.uid) pwByUid.set(String(c.uid).trim().toUpperCase(), c.password);
              if (c.gstin) pwByGstin.set(String(c.gstin).trim().toUpperCase(), c.password);
              pwByName.set(nm, c.password);
            });
            clients = overlayPendingQueueOnClients(data.clients);
            clients.forEach(c => {
              const k = getClientKey(c);
              const uid = c.uid ? String(c.uid).trim().toUpperCase() : "";
              const gst = c.gstin ? String(c.gstin).trim().toUpperCase() : "";
              const nm = `${String(c.category || "").toUpperCase()}:${cleanClientKeyName(c.client)}`;
              // Sheet ROV hi authoritative hai — sirf TTL ke andar wala local override ya missing ROV column par local rakhte hain
              {
                const loc = (k && rovByKey.get(k)) || rovByName.get(nm);
                if (loc && (!c.hasRovCol || (Date.now() - (loc.ts || 0) < ROV_LOCAL_TTL_MS))) {
                  c.rov = loc.rov; c._rovLocal = true; c._rovTs = loc.ts || Date.now();
                }
              }
              const locPortal = (k && portalByKey.get(k)) || portalByName.get(nm) || null;
              if (!c.portalData) {
                if (locPortal) c.portalData = locPortal;
              } else if (locPortal && String(c.portalData.period || "").trim() === String(locPortal.period || "").trim()) {
                const recentLocalDoc = locPortal._docLocalTs && (Date.now() - locPortal._docLocalTs < 30000);
                if (c.portalData.docCollected === undefined || (recentLocalDoc && Boolean(locPortal.docCollected) !== Boolean(c.portalData.docCollected))) {
                  c.portalData.docCollected = Boolean(locPortal.docCollected);
                  if (locPortal._docLocalTs) c.portalData._docLocalTs = locPortal._docLocalTs;
                }
                if (locPortal.gstr2bNotGenerated && !c.portalData.gstr2bNotGenerated && Number(c.portalData.igst || 0) === 0 && Number(c.portalData.suppliers || 0) === 0) {
                  c.portalData.gstr2bNotGenerated = true;
                }
              }
              if (c.password) return;
              const matchedPw =
                (uid && pwByUid.get(uid)) ||
                (gst && pwByGstin.get(gst)) ||
                (k && pwByKey.get(k)) ||
                pwByName.get(nm) || "";
              if (matchedPw) c.password = matchedPw;
            });
            migrateLegacySrKeys();
            saveClients();
          }

          if (data.feeData) {
            mergeFeeDataFromSheet(data.feeData);
          }
          if (typeof normalizeApneFreeClients === "function") {
            normalizeApneFreeClients();
            saveClients();
          }

          renderApp();
          if (typeof populateJsonClientDropdown === "function") populateJsonClientDropdown();
          if (currentAppPage === "fees") renderFeePage();
          if (currentAppPage === "json") {
            if (typeof syncMasterInvoicePartToJsonPage === "function") syncMasterInvoicePartToJsonPage({ autoPickLatest: false });
            renderJsonPage();
          }
          if (currentAppPage === "master") renderMasterEtsyPage();
          if (typeof renderPortalPage === "function") renderPortalPage();

          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          document.getElementById("lastSyncTime").textContent = `(Last synced: ${nowStr})`;
          if (flushedOk) setSyncHealth("ok");
          if (!isBackground) {
            showToast(`✅ Google Sheet se sabhi ${clients.length} clients & fee data live sync ho gaye!`);
          }
        } else {
          const msg = (data && data.message) || "Invalid JSON response";
          setSyncHealth("error", msg);
          if (!isBackground) showToast(`❌ Sheet Sync FAIL: ${msg}`);
        }
      } catch (err) {
        const msg = (err && err.message) ? err.message : "Network error";
        setSyncHealth("error", msg);
        if (!isBackground) showToast("❌ Sync fail: URL check karein ya Deploy me 'Who has access: Anyone' karein.");
      } finally {
        syncInFlight = false;
        if (btnText) btnText.textContent = "Sync Sheet";
      }
    }

    // Local (app me calculate / edit hui) ROV itne der tak Sheet ki purani IMPORTRANGE value se overwrite nahi hogi
    const ROV_LOCAL_TTL_MS = 12 * 60 * 60 * 1000;

    // ROV Sync Now button — Sheet se ROV turant refresh
    document.addEventListener("DOMContentLoaded", () => {
      const rovBtn = document.getElementById("rovSyncBtn");
      if (rovBtn) {
        rovBtn.addEventListener("click", async () => {
          if (!scriptUrl) {
            showToast("⚠️ Pehle upar Apps Script URL (scriptUrl) set karein — bina uske Sheet se data nahi aayega!");
            const urlInput = document.getElementById("scriptUrlInput");
            if (urlInput) { urlInput.focus(); urlInput.scrollIntoView({ behavior: "smooth", block: "center" }); }
            return;
          }
          rovBtn.disabled = true;
          rovBtn.querySelector("span").textContent = "ROV Syncing...";
          try {
            await syncFromGoogleSheet(false, false);
            showToast("⏳ Sabhi clients ka live ROV la rahe hain...");
            const live = await pullAllRovLive();
            if (live.ok) {
              renderApp();
              if (currentAppPage === "master") renderMasterEtsyPage();
              showToast(`✅ ROV sync: ${live.matched} Etsy clients live Master sheet se, ${live.changed} ka ROV badla` +
                (live.skipped ? ` (${live.skipped} ka Master sheet nahi mila/tab missing)` : "") +
                (live.partial ? " — kuch baaki hain, ek baar aur dabayein" : ""));
            } else {
              // Purana Apps Script deployed ho to purane tareeke se (local workbook + Drive pull)
              refreshAllClientRovsFromWorkbooks();
              await pullAllClientRovsFresh();
              renderApp();
              showToast("⚠️ Live ROV nahi mil paya (" + live.message + "). Purane tareeke se refresh kiya — ⚙️ Setup se naya Apps Script code deploy karein.");
            }
          } finally {
            rovBtn.disabled = false;
            rovBtn.querySelector("span").textContent = "₹ ROV Sync";
          }
        });
      }
    });

    const CURRENT_ACTIVE_CLIENTS_FOLDER_ID = "1_L9YfSkK_AUwKcKR5a31YPznkcyqO9VR";

    function openClientDrive(sr) {
      const c = clients.find(item => item.sr === sr);
      if (!c) return;
      const cleanUpper = (c.client || "").trim().toUpperCase().replace(/\*/g, "").trim();
      const cleanName = (c.client || "").trim().replace(/\*/g, "").trim();

      // Check KNOWN_CLIENT_FOLDERS first (100% complete for all 78 clients!)
      if (c.folderId) {
        window.open("https://drive.google.com/drive/folders/" + c.folderId, "_blank", "noopener,noreferrer");
        showToast(`📁 ${cleanName} ka personal folder khol diya gaya!`);
        return;
      }

      if (KNOWN_CLIENT_FOLDERS[cleanUpper]) {
        window.open(KNOWN_CLIENT_FOLDERS[cleanUpper], "_blank", "noopener,noreferrer");
        showToast(`📁 ${cleanName} ka personal folder khol diya gaya!`);
        return;
      }

      if (c.driveUrl && c.driveUrl.startsWith("https://drive.google.com/drive/folders/")) {
        window.open(c.driveUrl, "_blank", "noopener,noreferrer");
        showToast(`📁 ${cleanName} ka personal folder khol diya gaya!`);
        return;
      }

      window.open(`https://drive.google.com/drive/folders/${CURRENT_ACTIVE_CLIENTS_FOLDER_ID}`, "_blank", "noopener,noreferrer");
    }

    function copyText(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
        }
      } catch (e) {}
      return Promise.resolve(legacyCopy(text));
    }
    function legacyCopy(text) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }

    let gstLoginPanelTimer = null;
    function closeGstLoginPanel() {
      const old = document.getElementById("gstLoginPanel");
      if (old) old.remove();
      if (gstLoginPanelTimer) { clearTimeout(gstLoginPanelTimer); gstLoginPanelTimer = null; }
    }
    function showGstLoginPanel(clientName, username, pwd) {
      closeGstLoginPanel();
      const box = document.createElement("div");
      box.id = "gstLoginPanel";
      box.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;width:min(94vw,380px);background:#fff;border:2px solid #4f46e5;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);padding:12px;font-family:inherit;";
      const title = document.createElement("div");
      title.style.cssText = "font-weight:700;font-size:13px;color:#312e81;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;";
      const t = document.createElement("span");
      t.textContent = "🚀 " + clientName + " — GST Login";
      const x = document.createElement("button");
      x.type = "button"; x.textContent = "✕"; x.style.cssText = "font-weight:700;color:#64748b;";
      x.addEventListener("click", closeGstLoginPanel);
      title.appendChild(t); title.appendChild(x);
      box.appendChild(title);

      const mk = (label, value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText = "display:block;width:100%;margin-top:6px;padding:10px;border-radius:12px;font-weight:700;font-size:13px;background:#4f46e5;color:#fff;";
        b.addEventListener("click", async () => {
          const ok = await copyText(value);
          showToast(ok ? "✅ Copy ho gaya — ab portal ke box me Paste karein" : "❌ Copy nahi hua — browser clipboard permission check karein");
        });
        box.appendChild(b);
      };
      mk("📋 1) ID copy karein: " + username, username);
      if (pwd) mk("🔑 2) Password copy karein", pwd);
      else {
        const n = document.createElement("div");
        n.style.cssText = "margin-top:8px;font-size:12px;color:#b45309;";
        n.textContent = "Password available nahi hai (app password se unlock karein ya ✏️ Edit me password dalein).";
        box.appendChild(n);
      }
      const hint = document.createElement("div");
      hint.style.cssText = "margin-top:8px;font-size:11px;color:#64748b;";
      hint.textContent = "Portal me ID paste → password paste → captcha bharein. Ye panel 90 sec me band ho jayega.";
      box.appendChild(hint);
      document.body.appendChild(box);
      gstLoginPanelTimer = setTimeout(closeGstLoginPanel, 90000);
    }

    async function triggerGstLogin(sr) {
      const c = clients.find(item => item.sr === sr);
      if (!c) return;
      const username = (c.id || "").trim();

      if (!username) {
        showToast(`${c.client} ka Portal ID set nahi hai! ✏️ Edit karke dalein.`);
        return;
      }

      // 1) Click ke turant baad: ID copy + portal tab kholna (browser user-gesture ke andar hi allow karta hai)
      legacyCopy(username);
      window.open("https://services.gst.gov.in/services/login", "_blank", "noopener,noreferrer");

      // 2) Password (encrypted ho to decrypt karke) — panel me alag button se copy hoga
      let pwd = "";
      try {
        const p = await getClientPw(c);
        pwd = (p || "").trim();
      } catch (e) { pwd = ""; }

      showGstLoginPanel((c.client || "").replace(/\*/g, "").trim(), username, pwd);
      showToast(`🚀 GST Portal khul gaya! ID (${username}) copy ho gayi.`);
    }

    function openFilingStatusOption(sr, anchor) {
      const old = document.getElementById("filingStatusOption");
      if (old) { const same = old.dataset.sr === String(sr); old.remove(); if (same) return; }
      const client = clients.find(c => c.sr === sr);
      if (!client) return;
      const box = document.createElement("div");
      box.id = "filingStatusOption";
      box.dataset.sr = String(sr);
      box.style.cssText = "position:fixed;z-index:99999;background:white;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px #0003;padding:12px;";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(client.filed);
      checkbox.setAttribute("aria-label", "Filed");
      checkbox.style.cssText = "width:20px;height:20px;cursor:pointer;accent-color:#059669;display:block;";
      box.appendChild(checkbox);
      document.body.appendChild(box);
      const rect = anchor.getBoundingClientRect();
      box.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - box.offsetWidth - 4)) + "px";
      box.style.top = (rect.bottom + box.offsetHeight + 4 <= window.innerHeight ? rect.bottom + 4 : Math.max(4, rect.top - box.offsetHeight - 4)) + "px";
      checkbox.addEventListener("change", () => { box.remove(); if (checkbox.checked !== Boolean(client.filed)) toggleFilingStatus(sr); });
      checkbox.focus();
      const dismiss = event => { if (!box.contains(event.target) && event.target !== anchor && !anchor.contains(event.target)) { box.remove(); document.removeEventListener("pointerdown", dismiss); } };
      document.addEventListener("pointerdown", dismiss);
      box.addEventListener("keydown", event => { if (event.key === "Escape") { box.remove(); document.removeEventListener("pointerdown", dismiss); anchor.focus(); } });
    }

    async function toggleFilingStatus(sr) {
      const target = clients.find(c => c.sr === sr);
      if (!target) return;
      updateReferenceSuggestions();
      target.filed = !target.filed;
      saveClients();
      renderApp();
      const syncRes = await pushClientToSheet("update", target, { silent: true });
      if (syncRes.ok) {
        showToast(`${target.client}: ${target.filed ? "Filed ✓" : "Pending !"} (Sheet Synced)`);
      } else {
        showToast(`⚠️ ${target.client}: Browser me ${target.filed ? "Filed ✓" : "Pending !"} hua, par Sheet Sync FAIL (${syncRes.message})!`);
      }
    }

    function matchesRefGroup(refString, groupKey) {
      if (groupKey === "ALL") return true;
      const r = (refString || "").toUpperCase();
      if (groupKey === "ARBAZ") return r.includes("ARBAZ");
      if (groupKey === "R ANSARI") return r.includes("R ANSARI") || r.includes("R. ANSARI");
      if (groupKey === "QASIM") return r.includes("QASIM") || r.includes("SHADAB") || r.includes("SADAB");
      if (groupKey === "HAMZA") return r.includes("HAMZA");
      if (groupKey === "ADWIK") return r.includes("ADWIK") || r.includes("JAISWAL");
      if (groupKey === "OTHER") {
        return !r.includes("ARBAZ") && !r.includes("R ANSARI") && !r.includes("QASIM") && !r.includes("SHADAB") && !r.includes("HAMZA") && !r.includes("ADWIK");
      }
      return true;
    }

    function getCurrentlyFilteredClients() {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = c => !q || (
        c.client.toLowerCase().includes(q) || c.firm.toLowerCase().includes(q) ||
        c.gstin.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) || c.mobile.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q));
      if (showInactive) return clients.filter(c => isInactive(c) && matchesSearch(c));
      const tabFiltered = clients.filter(c => !isInactive(c) && (activeTab === "ALL" || c.category === activeTab));
      return tabFiltered.filter(c => {
        if (activeClientType === "ETSY" && c.clientType !== "Etsy Client") return false;
        if (activeClientType === "REGULAR" && c.clientType !== "Regular Client") return false;
        const freeApne = typeof isApneFreeClient === "function" && isApneFreeClient(c);
        if (activeDueFilter === "RED" && (freeApne || !(c.dueMon > 1))) return false;
        if (activeDueFilter === "YELLOW" && (freeApne || c.dueMon !== 1)) return false;
        if (activeDueFilter === "GREEN" && !freeApne && c.dueMon !== 0) return false;
        if (!matchesRefGroup(c.reference, activeRefFilter)) return false;
        if (activeStatusFilter === "PENDING" && c.filed) return false;
        if (activeStatusFilter === "FILED" && !c.filed) return false;
        if (activeStatusFilter === "NOTICE" && !c.noticeStatus) return false;
        if (activeStatusFilter === "ROV" && !(Number(c.rov || 0) > 0)) return false;
        if (!q) return true;
        return (
          c.client.toLowerCase().includes(q) ||
          c.firm.toLowerCase().includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.reference.toLowerCase().includes(q) ||
          c.mobile.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
        );
      });
    }

    function updateSummaryCardStyles() {
      const allCard = document.getElementById("cardAllBtn");
      const filedCard = document.getElementById("cardFiledBtn");
      const pendingCard = document.getElementById("cardPendingBtn");

      allCard.className = "text-left bg-white rounded-2xl p-5 shadow-xs border cursor-pointer transition flex items-center justify-between " +
        (activeStatusFilter === "ALL" ? "border-indigo-500 ring-2 ring-indigo-500/15 bg-indigo-50/10" : "border-slate-200 hover:border-slate-300");

      filedCard.className = "text-left bg-white rounded-2xl p-5 shadow-xs border cursor-pointer transition flex items-center justify-between " +
        (activeStatusFilter === "FILED" ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/10" : "border-slate-200 hover:border-emerald-300");

      pendingCard.className = "text-left bg-white rounded-2xl p-5 shadow-xs border cursor-pointer transition flex items-center justify-between " +
        (activeStatusFilter === "PENDING" ? "border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/10" : "border-slate-200 hover:border-amber-300");
    }

    function renderApp() {
      updateSummaryCardStyles();
      const activeList = clients.filter(c => !isInactive(c));
      document.getElementById("tabCountAll").textContent = activeList.length;
      document.getElementById("tabCountPaid").textContent = activeList.filter(c => c.category === "PAID CLINTS").length;
      document.getElementById("tabCountApne").textContent = activeList.filter(c => c.category === "Apne").length;
      document.getElementById("typeCountEtsy").textContent = activeList.filter(c => c.clientType === "Etsy Client").length;
      document.getElementById("typeCountReg").textContent = activeList.filter(c => c.clientType === "Regular Client").length;
      document.getElementById("inactiveCount").textContent = clients.filter(isInactive).length;
      const inBtn = document.getElementById("inactiveClBtn");
      inBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition " + (showInactive ? "bg-slate-700 text-white ring-2 ring-offset-1 ring-slate-700" : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200");

      const tabFiltered = activeList.filter(c => activeTab === "ALL" || c.category === activeTab);
      const totalCount = tabFiltered.length;
      const filedCount = tabFiltered.filter(c => c.filed).length;
      const pendingCount = totalCount - filedCount;

      document.getElementById("totalCount").textContent = totalCount;
      document.getElementById("filedCount").textContent = filedCount;
      document.getElementById("pendingCount").textContent = pendingCount;

      document.getElementById("dueRedCount").textContent = tabFiltered.filter(c => !isApneFreeClient(c) && c.dueMon > 1).length;
      document.getElementById("dueYellowCount").textContent = tabFiltered.filter(c => !isApneFreeClient(c) && c.dueMon === 1).length;
      document.getElementById("dueGreenCount").textContent = tabFiltered.filter(c => isApneFreeClient(c) || c.dueMon === 0).length;

      // Quick filter counts (Has Notices / ROV Balance)
      const noticeCountEl = document.getElementById("quickNoticeCount");
      const rovCountEl = document.getElementById("quickRovCount");
      if (noticeCountEl) noticeCountEl.textContent = tabFiltered.filter(c => Boolean(c.noticeStatus)).length;
      if (rovCountEl) rovCountEl.textContent = tabFiltered.filter(c => Number(c.rov || 0) > 0).length;

      document.querySelectorAll(".status-quick-btn").forEach(b => {
        const q = b.getAttribute("data-quick");
        const on = activeStatusFilter === q;
        b.classList.toggle("ring-2", on);
        b.classList.toggle("ring-offset-1", on);
        b.classList.toggle("ring-purple-500", on && q === "NOTICE");
        b.classList.toggle("ring-emerald-500", on && q === "ROV");
      });

      const filtered = getCurrentlyFilteredClients();
      document.getElementById("visibleClientCount").textContent = filtered.length;

      const tbody = document.getElementById("clientTableBody");
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400">Koi client nahi mila. Filter reset karein.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(c => {
        const tabBadge = c.category === "PAID CLINTS"
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">#${c.sheetSr}</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-teal-50 text-teal-800 border border-teal-200">#${c.sheetSr} Apne</span>`;

        const isFreeAcc = isApneFreeClient(c);
        let dueBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">0 Due</span>`;
        if (isFreeAcc) {
          dueBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">🆓 Free Account</span>`;
        } else if (c.dueMon > 1) {
          dueBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">🔴 ${c.dueMon} Mon</span>`;
        } else if (c.dueMon === 1) {
          dueBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">🟡 1 Mon</span>`;
        }

        const noticeBadge = c.noticeStatus
          ? `<div class="mt-1"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">🔔 Notice</span></div>`
          : "";

        const statusBtn = c.filed
          ? `<button type="button" data-sr="${c.sr}" class="toggle-status-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"><span>✓ Filed</span></button>`
          : `<button type="button" data-sr="${c.sr}" class="toggle-status-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"><span>⏳ Pending</span></button>`;

        return `
          <tr class="hover:bg-slate-50/80 transition border-b border-slate-100">
            <td class="py-3.5 px-4 text-xs font-semibold text-slate-500">${tabBadge}</td>
            <td class="py-3.5 px-4 cursor-pointer master-etsy-btn" data-masteretsy-sr="${c.sr}" role="button" tabindex="0" aria-label="Master Etsy: ${String(c.client || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-slate-900 text-xs sm:text-[13px]">${c.client}</span>
                ${isInactive(c) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">🚫 Inactive</span>` : ""}
                ${c.clientType === "Etsy Client"
                  ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">🛍️ Etsy</span>`
                  : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200/80">🏢 Regular</span>`}
              </div>
              <div class="text-xs text-indigo-600 font-medium mt-0.5">${c.firm || "-"}</div>
              <div class="text-[11px] text-slate-400 truncate max-w-xs">${c.address || "-"}</div>
            </td>
            <td class="py-3.5 px-4">
              <button type="button" data-edit-sr="${c.sr}" aria-label="Edit GSTIN" class="edit-client-btn inline-block font-mono text-xs font-semibold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60 cursor-pointer">${c.gstin || "-"}</button>
              <div class="text-[11px] text-slate-500 mt-1 font-mono">ID: <span class="font-semibold text-slate-700">${c.id || "-"}</span></div>
            </td>
            <td class="py-3.5 px-4">
              <div class="text-xs font-medium text-slate-800">${c.reference || "-"}</div>
              <button type="button" data-contact-sr="${c.sr}" title="Call ya WhatsApp options" class="client-contact-trigger text-[11px] text-slate-500 hover:text-indigo-700 font-mono mt-0.5 bg-transparent border-0 p-0 cursor-pointer">📞 ${c.mobile || "-"}</button>
            </td>
            <td class="py-3.5 px-4 text-center">
              ${dueBadge}
              ${noticeBadge}
              <div class="text-[11px] ${isFreeAcc ? 'text-teal-700 font-medium' : 'text-slate-500'} mt-1 font-mono">${isFreeAcc ? 'PT: <b>FREE</b>' : `PT: <b class="text-slate-700">${c.ptDate || "-"}</b>`}</div>
            </td>
            <td class="py-3.5 px-4 text-right font-mono text-xs font-semibold ${c.rov > 0 ? 'text-slate-900' : 'text-slate-400'}">
              ₹${Number(c.rov || 0).toLocaleString('en-IN')}
            </td>
            <td class="py-3.5 px-4 text-center">${statusBtn}</td>
            <td class="py-3.5 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5 flex-wrap">
                <button type="button" data-files-sr="${c.sr}" title="Drive, Documents aur Etsy options" class="client-files-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 transition">
                  <span>📁 Files</span><span class="text-[9px] text-slate-500">▾</span>
                </button>
                <button type="button" data-login-sr="${c.sr}" title="Open GST Portal &amp; Copy ID" class="gst-login-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px]"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3.2"/><path d="M5.5 19a7 7 0 0 1 13 0"/></svg><span>Login</span>
                </button>
                <button type="button" data-wa-sr="${c.sr}" title="WhatsApp reminder" class="client-wa-btn inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition">
                  ${WA_ICON_SVG}<span class="text-[9px]">▾</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      document.querySelectorAll(".toggle-status-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openFilingStatusOption(parseInt(btn.getAttribute("data-sr"), 10), btn);
        });
      });

      document.querySelectorAll(".client-files-btn").forEach(btn => {
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          openFilesMenu(parseInt(btn.getAttribute("data-files-sr"), 10), btn);
        });
      });

      document.querySelectorAll(".master-etsy-btn").forEach(btn => {
        const open = () => openClientInMasterEtsyEditor(parseInt(btn.getAttribute("data-masteretsy-sr"), 10));
        btn.addEventListener("click", open);
        btn.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
      });

      document.querySelectorAll(".gst-login-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          triggerGstLogin(parseInt(btn.getAttribute("data-login-sr"), 10));
        });
      });

      document.querySelectorAll(".client-wa-btn").forEach(btn => {
        btn.addEventListener("click", ev => {
          ev.stopPropagation();
          openWaMenu(parseInt(btn.getAttribute("data-wa-sr"), 10), btn);
        });
      });

      document.querySelectorAll(".client-contact-trigger").forEach(btn => {
        btn.addEventListener("click", ev => { ev.stopPropagation(); openContactMenu(parseInt(btn.getAttribute("data-contact-sr"), 10), btn); });
      });

      document.querySelectorAll(".edit-client-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openEditModal(parseInt(btn.getAttribute("data-edit-sr"), 10));
          document.getElementById("formGstin").focus();
        });
      });

    }

    // Browser ki chhupi hui validation ("Please fill out this field") ki jagah apna saaf message
    (function setupClientFormValidationHints() {
      const form = document.getElementById("clientForm");
      if (!form) return;
      form.addEventListener("invalid", (ev) => {
        const el = ev.target;
        if (!el) return;
        const label = el.id ? el.id.replace(/^form/, "") : "field";
        showToast(`⚠️ ${label} sahi nahi hai — ek baar check karein`);
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
      }, true);
    })();

    function openAddModal() {
      updateReferenceSuggestions();
      document.getElementById("modalTitle").textContent = "+ Add New GST Client";
      document.getElementById("modalSubtitle").textContent = "Naye client ki details bharein";
      document.getElementById("formClientSr").value = "";
      const initCat = activeTab === "Apne" ? "Apne" : "PAID CLINTS";
      document.getElementById("formCategory").value = initCat;
      document.getElementById("formClientType").value = "Etsy Client";
      document.getElementById("formStatus").value = "Active";
      document.getElementById("formClientName").value = "";
      document.getElementById("formFirm").value = "";
      document.getElementById("formGstin").value = "";
      document.getElementById("formClientId").value = "";
      document.getElementById("formPassword").value = ""; document.getElementById("formPassword").dataset.locked = "";
      document.getElementById("formMobile").value = "";
      document.getElementById("formReference").value = "";
      document.getElementById("formRDate").value = formatDdmmyyyyMon(new Date());
      document.getElementById("formPtDate").value = (initCat === "Apne" && Number(defaultFeeRates.apne || 0) === 0) ? "FREE" : getDefaultMonthEndPtDate(new Date());
      document.getElementById("formDueMon").value = 0;
      document.getElementById("formRov").value = 0;
      document.getElementById("formAddress").value = "";
      document.getElementById("formDriveFolder").value = "";
      document.getElementById("clientModalOverlay").classList.remove("hidden");
    }

    function openEditModal(sr) {
      const target = clients.find(c => c.sr === sr);
      if (!target) return;
      document.getElementById("modalTitle").textContent = `Edit Client: ${target.client}`;
      document.getElementById("modalSubtitle").textContent = `${target.firm} (${target.category} #${target.sheetSr})`;
      document.getElementById("formClientSr").value = String(target.sr);
      document.getElementById("formCategory").value = target.category || "PAID CLINTS";
      document.getElementById("formClientType").value = target.clientType || "Etsy Client";
      document.getElementById("formStatus").value = isInactive(target) ? "Inactive" : "Active";
      document.getElementById("formClientName").value = target.client || "";
      document.getElementById("formFirm").value = target.firm || "";
      document.getElementById("formGstin").value = target.gstin || "";
      document.getElementById("formClientId").value = target.id || "";
      { const pf = document.getElementById("formPassword"); pf.value = ""; pf.dataset.locked = ""; pf.placeholder = "e.g. Zara@1234";
        if (isEnc(target.password)) {
          getClientPw(target).then(v => { if (v === null) { pf.dataset.locked = "1"; pf.placeholder = "🔒 App password se unlock karke dekhein"; } else pf.value = v; });
        } else pf.value = target.password || ""; }
      document.getElementById("formMobile").value = target.mobile || "";
      document.getElementById("formReference").value = target.reference || "";
      document.getElementById("formRDate").value = target.rDate || "";
      document.getElementById("formPtDate").value = target.ptDate || "";
      document.getElementById("formDueMon").value = Number(target.dueMon || 0);
      document.getElementById("formRov").value = Number(target.rov || 0);
      document.getElementById("formAddress").value = target.address || "";
      document.getElementById("formDriveFolder").value = target.driveUrl || "";
      document.getElementById("clientModalOverlay").classList.remove("hidden");
    }

    function closeClientModal() {
      document.getElementById("clientModalOverlay").classList.add("hidden");
    }

    document.getElementById("openAddModalBtn").addEventListener("click", openAddModal);
    {
      const scanBtn = document.getElementById("scanDriveCertsBtn");
      if (scanBtn) scanBtn.addEventListener("click", scanDriveGstCerts);
    }
    document.getElementById("formCategory").addEventListener("change", e => {
      if (e.target.value === "Apne" && Number(defaultFeeRates.apne || 0) === 0) {
        document.getElementById("formPtDate").value = "FREE";
        document.getElementById("formDueMon").value = 0;
      } else if (String(document.getElementById("formPtDate").value || "").trim().toUpperCase() === "FREE") {
        document.getElementById("formPtDate").value = getDefaultMonthEndPtDate(new Date());
      }
    });
    document.getElementById("closeModalBtn").addEventListener("click", closeClientModal);
    document.getElementById("cancelModalBtn").addEventListener("click", closeClientModal);

    document.getElementById("clientForm").addEventListener("submit", async e => {
      e.preventDefault();
      const saveBtnEl = document.getElementById("saveClientBtn");
      if (saveBtnEl && saveBtnEl.disabled) return; // double click se do save na jaye

      const srVal = document.getElementById("formClientSr").value;
      const category = document.getElementById("formCategory").value;
      const clientType = document.getElementById("formClientType").value;
      const status = document.getElementById("formStatus").value === "Inactive" ? "Inactive" : "Active";
      const clientName = document.getElementById("formClientName").value.trim().toUpperCase();
      const firm = document.getElementById("formFirm").value.trim().toUpperCase();
      const gstin = document.getElementById("formGstin").value.trim().toUpperCase();
      const id = document.getElementById("formClientId").value.trim();
      const password = document.getElementById("formPassword").value.trim();
      const pwField = document.getElementById("formPassword");
      let storedPw;
      if (pwField.dataset.locked === "1" && !password) storedPw = undefined;
      else storedPw = password; // Plain text save hoga taaki GST Portal login aur GST Details Sheet me kabhi wrong password/encryption issue na aaye
      const mobile = document.getElementById("formMobile").value.trim();
      const reference = document.getElementById("formReference").value.trim();
      const rDate = document.getElementById("formRDate").value.trim() || formatDdmmyyyyMon(new Date());
      const rawPtDate = document.getElementById("formPtDate").value.trim();
      const isApneFreeSubmit = category === "Apne" && Number(defaultFeeRates.apne || 0) === 0;
      const ptDate = isApneFreeSubmit ? "FREE" : rawPtDate;
      // Number input me comma / space / khaali value aane par browser chup-chaap submit rok deta tha —
      // isliye ab khud saaf karte hain ("1,200" bhi 1200)
      const numOf = (v) => {
        const n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
        return isFinite(n) ? n : 0;
      };
      const dueMon = isApneFreeSubmit ? 0 : Math.min(36, Math.max(0, Math.round(numOf(document.getElementById("formDueMon").value))));
      const rov = Math.max(0, numOf(document.getElementById("formRov").value));
      const address = document.getElementById("formAddress").value.trim();
      const driveUrl = document.getElementById("formDriveFolder").value.trim();

      if (!clientName) {
        showToast("⚠️ Client ka naam khaali hai — naam bharein");
        const el = document.getElementById("formClientName");
        if (el) { el.focus(); el.classList.add("ring-2", "ring-rose-400"); setTimeout(() => el.classList.remove("ring-2", "ring-rose-400"), 2500); }
        return;
      }
      if (!firm) {
        showToast("⚠️ Firm ka naam khaali hai — firm bharein");
        const el = document.getElementById("formFirm");
        if (el) { el.focus(); el.classList.add("ring-2", "ring-rose-400"); setTimeout(() => el.classList.remove("ring-2", "ring-rose-400"), 2500); }
        return;
      }
      if (saveBtnEl) { saveBtnEl.disabled = true; saveBtnEl.dataset.oldText = saveBtnEl.textContent; saveBtnEl.textContent = "Saving…"; }

      let pendingPushAction = null;
      let pendingPushObj = null;
      let okMsg = "";

      if (srVal) {
        // sr kabhi string hota hai (Sheet se aane par), isliye Number() se compare — pehle yahan silent fail hota tha
        const target = clients.find(c => Number(c.sr) === Number(srVal));
        if (!target) {
          showToast("⚠️ Ye client record nahi mila (list refresh ho gayi hogi) — modal band karke dobara Edit dabayein");
          if (saveBtnEl) { saveBtnEl.disabled = false; saveBtnEl.textContent = saveBtnEl.dataset.oldText || "Save Changes"; }
          return;
        }
        if (target) {
          const oldKey = getClientKey(target);
          target.category = category;
          target.clientType = clientType;
          target.status = status;
          target.client = clientName;
          target.firm = firm;
          target.gstin = gstin;
          target.id = id;
          if (storedPw !== undefined) target.password = storedPw;
          target.mobile = mobile;
          target.reference = reference;
          target.rDate = rDate;
          target.ptDate = ptDate;
          target.dueMon = dueMon;
          target.rov = rov;
          target._rovLocal = true; target._rovTs = Date.now();
          target.address = address;
          target.driveUrl = driveUrl;
          const newKey = getClientKey(target);
          if (oldKey !== newKey) {
            migrateClientKeyAcrossMaps(oldKey, newKey);
            saveFeeState();
            saveMasterWorkbooks();
          }
          pendingPushAction = "update";
          pendingPushObj = target;
          okMsg = `${clientName} Sheet me update ho gaya!`;
        }
      } else {
        const maxSr = clients.reduce((m, c) => Math.max(m, c.sr), 0);
        const catCount = clients.filter(c => c.category === category).length;
        const newObj = {
          sr: maxSr + 1,
          sheetSr: catCount + 1,
          category: category,
          clientType: clientType,
          status: status,
          client: clientName,
          id: id,
          password: storedPw === undefined ? "" : storedPw,
          gstin: gstin,
          firm: firm,
          mobile: mobile,
          rDate: rDate,
          filed: false,
          ptDate: ptDate,
          dueMon: dueMon,
          noticeStatus: "",
          noticeDate: "",
          rov: rov,
          activeM: "",
          reference: reference,
          address: address,
          driveUrl: driveUrl
        };
        clients.unshift(newObj);
        pendingPushAction = "add";
        pendingPushObj = newObj;
        okMsg = `Naya client ${clientName} Sheet me add ho gaya!`;
      }

      try {
        saveClients();
        closeClientModal();
        renderApp();
        if (typeof renderPortalPage === "function") renderPortalPage();
        if (pendingPushAction && pendingPushObj) {
          const syncRes = await pushClientToSheet(pendingPushAction, pendingPushObj, { silent: true });
          if (syncRes.ok) showToast(`✅ ${okMsg}`);
          else showToast(`⚠️ ${clientName} browser me save hua, par Sheet Sync FAIL (${syncRes.message})!`);
        } else {
          showToast("✅ Save ho gaya");
        }
      } catch (err) {
        showToast("❌ Save me error: " + ((err && err.message) || "unknown") + " — dobara try karein");
      } finally {
        if (saveBtnEl) { saveBtnEl.disabled = false; saveBtnEl.textContent = saveBtnEl.dataset.oldText || "Save Changes"; }
      }
    });

    // Robust GST Certificate PDF Parser (With Full Address Extraction)
    function parseGstCertificateText(rawText, filename) {
      const text = String(rawText || "").replace(/\r/g, "\n");
      const out = { gstin: "", client: "", firm: "", address: "", pin: "", rDate: formatDdmmyyyyMon(new Date()) };

      // 1. GSTIN (15 characters)
      const gstMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i);
      if (gstMatch) out.gstin = gstMatch[1].toUpperCase();

      // 2. Legal Name (Client Name) - Multiple fallback strategies
      const legalPatterns = [
        /Legal\s+Name\s*[:\-]?\s*([A-Za-z0-9\s.&()-]+?)(?=\s*(?:2\.|Trade|Additional|Constitution|\n|$))/i,
        /1\.\s*Legal\s+Name\s+([A-Za-z\s]+?)(?=\s*(?:2\.|Trade|\n|$))/i,
        /Details\s+of\s+Proprietor[\s\S]*?Name\s+([A-Za-z\s]+?)(?=\s*Designation|\n)/i
      ];
      for (const pat of legalPatterns) {
        const m = text.match(pat);
        if (m && m[1] && m[1].trim()) {
          out.client = m[1].replace(/[0-9]+$/g, "").replace(/\s+/g, " ").trim().toUpperCase();
          break;
        }
      }

      // If text extraction yielded no name (e.g. image/scanned PDF), use file name
      if (!out.client || out.client === "0") {
        const cleanBase = filename.replace(/\.pdf$/i, "").replace(/GST|Registration|Certificate|REG-06/gi, "").replace(/[-_]/g, " ").trim();
        if (cleanBase.length > 2) {
          out.client = cleanBase.toUpperCase();
        } else {
          out.client = "NEW CLIENT (" + (out.gstin || "REG-06") + ")";
        }
      }

      // 3. Trade Name (Firm Name)
      const tradePatterns = [
        /Trade\s+Name(?:,\s*if\s*any)?\s*[:\-]?\s*([A-Za-z0-9\s.&()-]+?)(?=\s*(?:3\.|Additional|Constitution|\n|$))/i,
        /2\.\s*Trade\s+Name[^\n]*\s+([A-Za-z0-9\s.&()-]+?)(?=\s*(?:3\.|Additional|\n|$))/i
      ];
      for (const pat of tradePatterns) {
        const m = text.match(pat);
        if (m && m[1] && m[1].trim()) {
          out.firm = m[1].replace(/\s+/g, " ").trim().toUpperCase();
          break;
        }
      }
      if (!out.firm) out.firm = out.client;

      // 4. Address of Principal Place of Business
      const addrMatch = text.match(/5\.\s*Address\s+of\s+Principal\s+Place\s+of\s+Business([\s\S]*?)(?=\s*(?:6\.|Date\s+of\s+Liability|Annexure|Signature|$))/i);
      if (addrMatch) {
        let rawAddr = addrMatch[1];
        rawAddr = rawAddr.replace(/Building\s+No\.?\/Flat\s+No\.?\s*:\s*/gi, "");
        rawAddr = rawAddr.replace(/Road\/Street\s*:\s*/gi, ", ");
        rawAddr = rawAddr.replace(/City\/Town\/Village\s*:\s*/gi, ", ");
        rawAddr = rawAddr.replace(/District\s*:\s*/gi, ", ");
        rawAddr = rawAddr.replace(/State\s*:\s*/gi, ", ");
        rawAddr = rawAddr.replace(/PIN\s+Code\s*:\s*/gi, " - ");
        rawAddr = rawAddr.replace(/[\r\n]+/g, " ");
        rawAddr = rawAddr.replace(/\s*,\s*/g, ", ");
        rawAddr = rawAddr.replace(/^\s*0\s*,?\s*/, "");
        out.address = rawAddr.replace(/\s+/g, " ").trim().replace(/^,|,$/g, "");
      }

      // 4B. PIN Code
      const pinMatch = text.match(/\b(2[0-9]{5})\b/);
      if (pinMatch) {
        out.pin = pinMatch[1];
        if (!out.address) out.address = `PIN: ${pinMatch[1]}`;
      }

      // 5. Date of Registration (DD/MM/YYYY)
      const dateMatch = text.match(/Date\s+of\s+issue\s+of\s+Certificate\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                        text.match(/\b(\d{2}\/\d{2}\/202\d)\b/);
      if (dateMatch) {
        const parts = dateMatch[1].split("/");
        if (parts.length === 3) {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            out.rDate = `${parts[0]}-${months[mIdx]}-${parts[2]}`;
          }
        }
      }

      return out;
    }

    // Auto-Add from GST Certificate PDF
    document.getElementById("quickHeaderCertInput").addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      showToast(`⏳ ${file.name} padha ja raha hai...`);

      let extracted = { gstin: "", client: "", firm: "", pin: "", rDate: formatDdmmyyyyMon(new Date()) };

      try {
        if (window.pdfjsLib && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
          const buf = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
          let text = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(" ") + "\n";
          }
          extracted = parseGstCertificateText(text, file.name);
        } else {
          extracted = parseGstCertificateText("", file.name);
        }
      } catch (err) {
        extracted = parseGstCertificateText("", file.name);
      }

      const clientName = extracted.client.trim();
      const firm = extracted.firm.trim();
      const gstin = extracted.gstin.trim();
      const firstWord = clientName.split(" ")[0].replace(/[^A-Za-z]/g, "");
      const cleanWord = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() : "Client";
      const autoId = `Ad${cleanWord}${new Date().getFullYear()}`;

      // Check if client with this name or GSTIN already exists
      const existing = clients.find(c => (gstin && c.gstin === gstin) || (c.client && c.client.toUpperCase() === clientName.toUpperCase()));
      if (existing) {
        showToast(`⚠️ ${clientName} pehle se list me maujood hai!`);
        searchQuery = clientName;
        document.getElementById("searchInput").value = clientName;
        renderApp();
        e.target.value = "";
        return;
      }

      const maxSr = clients.reduce((m, c) => Math.max(m, c.sr), 0);
      const catCount = clients.filter(c => c.category === "PAID CLINTS").length;

      const newClient = {
        sr: maxSr + 1,
        sheetSr: catCount + 1,
        category: "PAID CLINTS",
        clientType: (firm.includes("RUGS") || firm.includes("CARPET")) ? "Etsy Client" : "Regular Client",
        status: "Active",
        client: clientName,
        id: autoId,
        password: "",
        gstin: gstin,
        firm: firm,
        mobile: "",
        rDate: extracted.rDate,
        filed: false,
        ptDate: getDefaultMonthEndPtDate(new Date()),
        dueMon: 0,
        noticeStatus: "",
        noticeDate: "",
        rov: 0,
        activeM: "",
        reference: "",
        address: extracted.address || (extracted.pin ? `PIN: ${extracted.pin}` : ""),
        driveUrl: ""
      };

      // Add to top of clients list
      clients.unshift(newClient);
      saveClients();
      pushClientToSheet("add", newClient, { silent: true }).then(syncRes => {
        if (!syncRes.ok) {
          showToast(`⚠️ ${clientName} browser me add hua, par Sheet Sync FAIL (${syncRes.message})!`);
        }
      });

      // Reset search filter so the newly added client is immediately visible on top
      searchQuery = "";
      document.getElementById("searchInput").value = "";
      activeStatusFilter = "ALL";

      renderApp();
      showToast(`✅ Naya Client '${clientName}' (${firm}) list me sabse upar jud gaya!`);
      e.target.value = "";
    });

    /* ===== ➕ Client dropdown — 3 options ek saaf button me (manual / 1 file / Drive scan) ===== */
    (function setupAddClientMenu() {
      const wrap = document.getElementById("addClientMenuWrap");
      const btn = document.getElementById("addClientMenuBtn");
      const menu = document.getElementById("addClientMenu");
      if (!wrap || !btn || !menu) return;
      const closeMenu = () => { menu.classList.add("hidden"); btn.setAttribute("aria-expanded", "false"); };
      // Mobile (chhoti screen) par dropdown absolute right-0 se screen ke bahar chala jata tha
      // -> phone par fixed panel, chaudi aur screen ke andar
      const isNarrowScreen = () => {
        try { return window.matchMedia("(max-width: 768px)").matches; } catch (_) { return window.innerWidth <= 768; }
      };
      const placeMenu = () => {
        if (!isNarrowScreen()) {
          menu.style.position = ""; menu.style.left = ""; menu.style.right = "";
          menu.style.width = ""; menu.style.top = ""; menu.style.maxHeight = ""; menu.style.zIndex = "";
          return;
        }
        const r = btn.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.left = "10px";
        menu.style.right = "10px";
        menu.style.width = "auto";
        menu.style.top = Math.round(r.bottom + 8) + "px";
        menu.style.maxHeight = Math.max(200, Math.round(window.innerHeight - r.bottom - 24)) + "px";
        menu.style.overflowY = "auto";
        menu.style.zIndex = "80";
      };
      const openMenu = () => { placeMenu(); menu.classList.remove("hidden"); btn.setAttribute("aria-expanded", "true"); };
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        if (menu.classList.contains("hidden")) openMenu(); else closeMenu();
      });
      document.addEventListener("click", ev => { if (!wrap.contains(ev.target)) closeMenu(); });
      document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeMenu(); });
      wrap.querySelectorAll("[data-add-opt]").forEach(el => el.addEventListener("click", () => setTimeout(closeMenu, 80)));
      window.addEventListener("scroll", () => { if (!menu.classList.contains("hidden")) closeMenu(); }, { passive: true });
      window.addEventListener("resize", () => { if (!menu.classList.contains("hidden")) placeMenu(); });
    })();

    /* ===== ☁️ Drive "GST Certificates" folder scan → preview → ek click me add ===== */
    function driveCertNormGstin(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

    async function scanDriveGstCerts() {
      if (!scriptUrl) { showToast("⚠️ Pehle ⚙️ Setup me Apps Script URL daalein"); return; }
      const btn = document.getElementById("scanDriveCertsBtn");
      const old = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }
      showToast("⏳ Drive folder scan ho raha hai… pehli baar OCR me 1-2 min lag sakte hain");
      let res = null;
      try {
        const r = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(withSyncSecret({ action: "scanGstCerts" }))
        });
        res = JSON.parse(await r.text());
      } catch (err) {
        showToast("❌ Scan fail: " + ((err && err.message) || "network error"));
      }
      if (btn) { btn.disabled = false; btn.style.opacity = ""; btn.innerHTML = old; }
      if (!res) return;
      if (res.status !== "ok") {
        if (res.code === "folder_not_found" || /folder nahi mila/i.test(String(res.message || ""))) { showDriveFolderMissing(res); return; }
        const msg = String(res.message || "Scan fail");
        if (/unknown\s*action/i.test(msg)) {
          showToast("⚠️ Apps Script purani hai — app me ⚙️ Setup → 📋 Copy Code dabayein, Sheet ke Apps Script me paste karke Deploy (Manage deployments → ✏️ → New version) karein");
        } else {
          showToast("❌ " + msg);
        }
        return;
      }
      if (res.created) { showDriveFolderCreated(res); return; }
      if (res.code === "folder_not_found") { showDriveFolderMissing(res); return; }
      openDriveCertModal(res);
    }

    // Folder khud ban gaya (json folder ki tarah) — seedha link dikhate hain
    function showDriveFolderCreated(res) {
      const prev = document.getElementById("driveCertOverlay");
      if (prev) prev.remove();
      const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
      const wrap = document.createElement("div");
      wrap.id = "driveCertOverlay";
      wrap.className = "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4";
      wrap.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200">
            <div class="text-sm font-bold text-slate-900">📁 Folder ban gaya</div>
          </div>
          <div class="px-5 py-4 text-[12.5px] text-slate-600 leading-relaxed">
            Drive me <b>${esc(res.folder)}</b> folder khud ban gaya hai — aapko kuch karne ki zaroorat nahi.
            Ab isme GST certificates (PDF/photo) daal dein, phir dobara scan karein. Agli baar seedha isi folder me dekhega.
          </div>
          <div class="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-end gap-2">
            <button id="driveCertCreatedClose" type="button" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition">Band karein</button>
            ${res.folderUrl ? `<a href="${esc(res.folderUrl)}" target="_blank" rel="noopener" class="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition">📂 Folder kholein</a>` : ""}
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = () => wrap.remove();
      wrap.addEventListener("click", ev => { if (ev.target === wrap) close(); });
      const b = document.getElementById("driveCertCreatedClose");
      if (b) b.addEventListener("click", close);
    }

    // Folder na mile to: 2 raste — folder banaiye, ya ek baar folder ka link paste kar dijiye (hamesha wahi use hoga)
    function showDriveFolderMissing(res) {
      const prev = document.getElementById("driveCertOverlay");
      if (prev) prev.remove();
      const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
      const wrap = document.createElement("div");
      wrap.id = "driveCertOverlay";
      wrap.className = "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4";
      wrap.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200">
            <div class="text-sm font-bold text-slate-900">📁 GST Certificates folder</div>
            <div class="text-[11px] text-slate-500 mt-0.5">App sirf isi ek folder me dekhta hai — kisi doosre folder me nahi.</div>
          </div>
          <div class="px-5 py-4 space-y-3">
            <div class="text-[12.5px] text-slate-600 leading-relaxed">
              <b>Rasta 1:</b> My Drive me folder banaiye — naam bilkul <b>GST Certificates</b> — phir dobara scan karein.
            </div>
            <div class="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
              <div class="text-[12px] font-semibold text-slate-700">Rasta 2: folder ka link paste karein (ek baar)</div>
              <div class="text-[10.5px] text-slate-500 mt-0.5">Drive me folder kholein → link copy kariye → yahan paste → Set. Iske baad hamesha yahi folder use hoga.</div>
              <div class="mt-2 flex items-center gap-2">
                <input id="driveCertFolderInput" type="text" placeholder="https://drive.google.com/drive/folders/..." class="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-[11.5px] font-mono focus:ring-2 focus:ring-indigo-500" />
                <button id="driveCertFolderSave" type="button" class="px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition">Set</button>
              </div>
              <div id="driveCertFolderMsg" class="text-[10.5px] mt-1.5 text-slate-500"></div>
            </div>
          </div>
          <div class="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-end gap-2">
            <button id="driveCertMissingClose" type="button" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition">Band karein</button>
            <button id="driveCertRescan" type="button" class="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition">🔄 Dobara scan</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.addEventListener("click", ev => { if (ev.target === wrap) close(); });
      document.getElementById("driveCertMissingClose").addEventListener("click", close);
      document.getElementById("driveCertRescan").addEventListener("click", () => { close(); scanDriveGstCerts(); });

      const saveBtn = document.getElementById("driveCertFolderSave");
      const inp = document.getElementById("driveCertFolderInput");
      const msg = document.getElementById("driveCertFolderMsg");
      saveBtn.addEventListener("click", async () => {
        const link = (inp.value || "").trim();
        if (!link) { msg.textContent = "Pehle link paste kariye."; msg.className = "text-[10.5px] mt-1.5 text-amber-600"; return; }
        saveBtn.disabled = true; saveBtn.textContent = "…";
        msg.textContent = "Set ho raha hai…"; msg.className = "text-[10.5px] mt-1.5 text-slate-500";
        try {
          const r = await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(withSyncSecret({ action: "setGstCertFolder", folderLink: link })) });
          const out = JSON.parse(await r.text());
          if (out && out.status === "ok") {
            msg.textContent = `✅ Folder set: ${out.folder}`;
            msg.className = "text-[10.5px] mt-1.5 text-emerald-600";
            close();
            scanDriveGstCerts();
            return;
          }
          msg.textContent = "❌ " + ((out && out.message) || "Set nahi hua");
          msg.className = "text-[10.5px] mt-1.5 text-rose-600";
        } catch (err) {
          msg.textContent = "❌ " + ((err && err.message) || "network error");
          msg.className = "text-[10.5px] mt-1.5 text-rose-600";
        }
        saveBtn.disabled = false; saveBtn.textContent = "Set";
      });
      setTimeout(() => inp && inp.focus(), 120);
    }

    function openDriveCertModal(res) {
      const prev = document.getElementById("driveCertOverlay");
      if (prev) prev.remove();

      const localGstins = new Set((clients || []).map(c => driveCertNormGstin(c.gstin)).filter(Boolean));
      const all = (res.candidates || []).map(c => Object.assign({}, c, {
        dupLocal: localGstins.has(driveCertNormGstin(c.gstin))
      }));
      const fresh = all.filter(c => !c.dupLocal);
      const skipped = res.skipped || [];

      if (!fresh.length) {
        showToast(`✅ Koi naya GSTIN nahi mila — ${skipped.length} pehle se hain, ${all.length} local me maujood`);
        return;
      }

      const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
      const rows = fresh.map((c, i) => `
        <label class="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" class="driveCertPick mt-1 accent-indigo-600" data-idx="${i}" checked />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[12.5px] font-bold text-slate-900">${esc(c.client)}</span>
              ${c.firm && c.firm !== c.client ? `<span class="text-[10.5px] text-slate-500">· ${esc(c.firm)}</span>` : ""}
              <span class="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600">${esc(c.gstin)}</span>
            </div>
            <div class="text-[10.5px] text-slate-500 mt-0.5">
              ${esc(c.state || "")}${c.state && c.rDate ? " · " : ""}${esc(c.rDate || "")}${c.address ? " · " + esc(c.address).slice(0, 90) : ""}
            </div>
            ${c.warn ? `<div class="text-[10px] text-amber-600 mt-0.5">⚠️ ${esc(c.warn)}</div>` : ""}
          </div>
          <span class="text-[9.5px] uppercase tracking-wide text-slate-300">${esc(c.source === "ocr" ? "OCR" : "file")}</span>
        </label>`).join("");

      const ocrNote = res.ocrAvailable === false
        ? `<span class="text-amber-600">· OCR service off (file name me GSTIN hona chahiye)</span>`
        : (res.ocrUsed ? `<span class="text-slate-400">· ${res.ocrUsed} file OCR se padhi</span>` : "");

      const wrap = document.createElement("div");
      wrap.id = "driveCertOverlay";
      wrap.className = "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4";
      wrap.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
          <div class="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-bold text-slate-900">☁️ Drive folder se naye clients</div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                Folder <b>${esc(res.folder)}</b> · ${Number(res.total) || 0} file · <b class="text-emerald-600">${fresh.length} naye</b> ·
                ${skipped.length} skip (pehle se hain) ${ocrNote}
              </div>
            </div>
            <button id="driveCertClose" type="button" class="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">✕</button>
          </div>
          <div class="flex-1 overflow-auto divide-y divide-slate-100">${rows}</div>
          <div class="px-4 sm:px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
            <label class="inline-flex items-center gap-2 text-[11.5px] font-medium text-slate-600 cursor-pointer">
              <input type="checkbox" id="driveCertAll" class="accent-indigo-600" checked /> Sab select
            </label>
            <div class="flex items-center gap-2">
              <button id="driveCertCancel" type="button" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition">Cancel</button>
              <button id="driveCertAdd" type="button" class="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition">
                ➕ Add selected (<span id="driveCertCount">${fresh.length}</span>)
              </button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap);

      const picks = Array.from(wrap.querySelectorAll(".driveCertPick"));
      const countEl = document.getElementById("driveCertCount");
      const syncCount = () => {
        const n = picks.filter(p => p.checked).length;
        if (countEl) countEl.textContent = String(n);
        const addBtn = document.getElementById("driveCertAdd");
        if (addBtn) addBtn.disabled = n === 0;
      };
      picks.forEach(p => p.addEventListener("change", syncCount));
      const allBox = document.getElementById("driveCertAll");
      if (allBox) allBox.addEventListener("change", () => { picks.forEach(p => { p.checked = allBox.checked; }); syncCount(); });

      const close = () => wrap.remove();
      document.getElementById("driveCertClose").addEventListener("click", close);
      document.getElementById("driveCertCancel").addEventListener("click", close);
      wrap.addEventListener("click", ev => { if (ev.target === wrap) close(); });

      const addBtn = document.getElementById("driveCertAdd");
      if (addBtn) addBtn.addEventListener("click", () => {
        const chosen = picks.filter(p => p.checked).map(p => fresh[Number(p.dataset.idx)]);
        close();
        addDriveCertClients(chosen);
      });
      syncCount();
    }

    function addDriveCertClients(list) {
      let added = 0;
      const failed = [];
      (list || []).forEach(c => {
        const gstin = driveCertNormGstin(c.gstin);
        if (gstin && clients.some(x => driveCertNormGstin(x.gstin) === gstin)) return; // double safety
        const clientName = String(c.client || c.firm || gstin || "Client").trim();
        const firm = String(c.firm || clientName).trim();
        const firstWord = clientName.split(" ")[0].replace(/[^A-Za-z]/g, "");
        const cleanWord = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() : "Client";
        const maxSr = clients.reduce((m, x) => Math.max(m, Number(x.sr) || 0), 0);
        const catCount = clients.filter(x => x.category === "PAID CLINTS").length;
        const addrParts = [];
        if (c.state) addrParts.push(c.state);
        if (c.address) addrParts.push(c.address);
        const newClient = {
          sr: maxSr + 1,
          sheetSr: catCount + 1,
          category: "PAID CLINTS",
          clientType: /RUGS|CARPET/i.test(firm) ? "Etsy Client" : "Regular Client",
          status: "Active",
          client: clientName,
          id: `Ad${cleanWord}${new Date().getFullYear()}`,
          password: "",
          gstin: gstin,
          firm: firm,
          mobile: "",
          rDate: c.rDate || formatDdmmyyyyMon(new Date()),
          filed: false,
          ptDate: getDefaultMonthEndPtDate(new Date()),
          dueMon: 0,
          noticeStatus: "",
          noticeDate: "",
          rov: 0,
          activeM: "",
          reference: "",
          address: addrParts.join(" · "),
          driveUrl: ""
        };
        clients.unshift(newClient);
        added++;
        pushClientToSheet("add", newClient, { silent: true }).then(sr => {
          if (!sr.ok) failed.push(clientName);
        });
      });
      saveClients();
      searchQuery = "";
      const si = document.getElementById("searchInput");
      if (si) si.value = "";
      activeStatusFilter = "ALL";
      renderApp();
      if (added) {
        showToast(`✅ ${added} naye client add ho gaye${failed.length ? ` (${failed.length} ka Sheet sync fail — Sync Sheet dabayein)` : ""}`);
      } else {
        showToast("⚠️ Kuch add nahi hua — sab pehle se list me hain");
      }
    }

    // Inactive CL button
    document.getElementById("inactiveClBtn").addEventListener("click", () => {
      showInactive = !showInactive;
      renderApp();
      showToast(showInactive ? "🚫 Sabhi Inactive clients (dono tab se)" : "✅ Active clients");
    });

    // Summary card clicks
    document.getElementById("cardAllBtn").addEventListener("click", () => {
      showInactive = false;
      activeStatusFilter = "ALL";
      renderApp();
      showToast("📋 Sabhi clients dikh rahe hain");
    });
    document.getElementById("cardFiledBtn").addEventListener("click", () => {
      showInactive = false;
      activeStatusFilter = activeStatusFilter === "FILED" ? "ALL" : "FILED";
      renderApp();
      showToast(activeStatusFilter === "FILED" ? "✓ Sirf FILED clients" : "📋 Sabhi clients");
    });
    document.getElementById("cardPendingBtn").addEventListener("click", () => {
      showInactive = false;
      activeStatusFilter = activeStatusFilter === "PENDING" ? "ALL" : "PENDING";
      renderApp();
      showToast(activeStatusFilter === "PENDING" ? "⏳ Sirf PENDING clients" : "📋 Sabhi clients");
    });

    // Tab buttons
    document.querySelectorAll(".tab-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showInactive = false;
        activeTab = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab-filter-btn").forEach(b => {
          b.className = "tab-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition " +
            (b.getAttribute("data-tab") === activeTab ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200");
        });
        renderApp();
      });
    });

    // Type buttons (Etsy vs Regular)
    document.querySelectorAll(".type-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showInactive = false;
        const t = btn.getAttribute("data-type");
        activeClientType = activeClientType === t ? "ALL" : t;
        document.querySelectorAll(".type-filter-btn").forEach(b => {
          const bt = b.getAttribute("data-type");
          if (bt === activeClientType) {
            b.className = "type-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold ring-2 ring-offset-1 " + (bt === "ETSY" ? "bg-amber-500 text-slate-950 ring-amber-500" : "bg-sky-600 text-white ring-sky-600") + " transition";
          } else {
            b.className = "type-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold " + (bt === "ETSY" ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100" : "bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100") + " transition";
          }
        });
        renderApp();
      });
    });

    // Due buttons
    document.querySelectorAll(".due-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showInactive = false;
        const d = btn.getAttribute("data-due");
        activeDueFilter = activeDueFilter === d ? "ALL" : d;
        document.querySelectorAll(".due-filter-btn").forEach(b => {
          const bd = b.getAttribute("data-due");
          b.classList.toggle("ring-2", bd === activeDueFilter);
          b.classList.toggle("ring-offset-1", bd === activeDueFilter);
        });
        renderApp();
      });
    });

    // Select filters
    document.getElementById("refFilterSelect").addEventListener("change", e => {
      showInactive = false;
      activeRefFilter = e.target.value;
      renderApp();
    });
    // Quick status filter buttons (Has Notices / ROV Balance)
    document.querySelectorAll(".status-quick-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showInactive = false;
        const v = btn.getAttribute("data-quick");
        activeStatusFilter = activeStatusFilter === v ? "ALL" : v;
        renderApp();
        if (activeStatusFilter === "NOTICE") showToast("🔔 Sirf Has Notices clients");
        else if (activeStatusFilter === "ROV") showToast("💵 Sirf ROV Balance wale clients");
        else showToast("📋 Sabhi clients");
      });
    });
    document.getElementById("clearAllFiltersBtn").addEventListener("click", () => {
      showInactive = false;
      activeTab = "ALL";
      activeClientType = "ALL";
      activeDueFilter = "ALL";
      activeRefFilter = "ALL";
      activeStatusFilter = "ALL";
      searchQuery = "";
      document.getElementById("searchInput").value = "";
      document.getElementById("refFilterSelect").value = "ALL";
      document.querySelectorAll(".tab-filter-btn").forEach(b => {
        b.className = "tab-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition " +
          (b.getAttribute("data-tab") === "ALL" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200");
      });
      document.querySelectorAll(".type-filter-btn").forEach(b => {
        const bt = b.getAttribute("data-type");
        b.className = "type-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold " + (bt === "ETSY" ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100" : "bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100") + " transition";
      });
      document.querySelectorAll(".due-filter-btn").forEach(b => {
        b.classList.remove("ring-2", "ring-offset-1");
      });
      renderApp();
      showToast("Saare filters reset ho gaye");
    });

    document.getElementById("searchInput").addEventListener("input", e => {
      searchQuery = e.target.value;
      renderApp();
    });

    // Sync Handlers
    document.getElementById("syncSheetBtn").addEventListener("click", () => {
      syncFromGoogleSheet(true); // Open modal only if user explicitly clicks Sync button and URL is missing
    });
    document.getElementById("openSyncSetupBtn").addEventListener("click", () => {
      document.getElementById("scriptUrlInput").value = scriptUrl;
      const ssInp = document.getElementById("syncSecretInput");
      if (ssInp) ssInp.value = getSyncSecret();
      document.getElementById("syncSetupModalOverlay").classList.remove("hidden");
    });
    document.getElementById("bannerSetupLinkBtn").addEventListener("click", () => {
      document.getElementById("scriptUrlInput").value = scriptUrl;
      const ssInp = document.getElementById("syncSecretInput");
      if (ssInp) ssInp.value = getSyncSecret();
      document.getElementById("syncSetupModalOverlay").classList.remove("hidden");
    });
    document.getElementById("saveSyncSecretBtn")?.addEventListener("click", () => {
      const val = (document.getElementById("syncSecretInput")?.value || "").trim();
      saveSyncSecret(val);
      showToast(val ? "🔐 Apps Script SYNC_SECRET save ho gaya!" : "🔓 SYNC_SECRET local se hata diya gaya.");
      if (scriptUrl) syncFromGoogleSheet();
    });
    document.getElementById("closeSyncModalBtn").addEventListener("click", () => {
      document.getElementById("syncSetupModalOverlay").classList.add("hidden");
    });
    document.getElementById("closeSyncModalFooterBtn").addEventListener("click", () => {
      document.getElementById("syncSetupModalOverlay").classList.add("hidden");
    });

    document.getElementById("directBannerSaveSyncBtn").addEventListener("click", () => {
      const val = document.getElementById("directBannerScriptUrlInput").value.trim();
      savePermanentConfig(val, null);
      document.getElementById("scriptUrlInput").value = val;
      updateSyncBanner();
      if (val) {
        showToast("✅ Apps Script Sync URL hamesha ke liye save ho gaya!");
        syncFromGoogleSheet();
      } else {
        showToast("URL hata diya gaya");
      }
    });

    document.getElementById("saveScriptUrlBtn").addEventListener("click", () => {
      const val = document.getElementById("scriptUrlInput").value.trim();
      savePermanentConfig(val, null);
      const directInp = document.getElementById("directBannerScriptUrlInput");
      if (directInp) directInp.value = val;
      updateSyncBanner();
      document.getElementById("syncSetupModalOverlay").classList.add("hidden");
      if (val) {
        showToast("✅ Apps Script Sync URL hamesha ke liye save ho gaya!");
        syncFromGoogleSheet();
      } else {
        showToast("Local mode active (URL hata diya gaya)");
      }
    });

    document.getElementById("copyAppsScriptBtn").addEventListener("click", () => {
      const code = document.getElementById("appsScriptCodeBlock").textContent;
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("AppSync.gs code copy ho gaya!");
      } catch (e) {
        showToast("Code copy fail hua");
      }
    });

    // CSV Export
    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      const rows = getCurrentlyFilteredClients();
      if (rows.length === 0) {
        showToast("Export karne ke liye koi client nahi hai!");
        return;
      }
      const headers = ["Sr No", "Category", "Type", "Client Name", "Portal ID", "GSTIN", "Firm", "Mobile", "R Date", "Filing Status", "PT Date", "Due Mon", "ROV", "Reference", "Address", "Status"];
      const escape = val => {
        const str = String(val === undefined || val === null ? "" : val);
        return str.includes(",") || str.includes('"') ? '"' + str.replace(/"/g, '""') + '"' : str;
      };
      const lines = [headers.join(",")];
      rows.forEach(c => {
        lines.push([c.sheetSr, c.category, c.clientType, c.client, c.id, c.gstin, c.firm, c.mobile, c.rDate, c.filed ? "FILED" : "PENDING", c.ptDate, c.dueMon, c.rov, c.reference, c.address, isInactive(c) ? "Inactive" : "Active"].map(escape).join(","));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST_Clients_${rows.length}_records.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`${rows.length} clients ki CSV download ho gayi!`);
    });

    // Lock Screen & PIN
    document.getElementById("lockAppBtn").addEventListener("click", () => {
      loadPin();
      document.getElementById("pinInput").value = "";
      document.getElementById("pinErrorMsg").classList.add("hidden");
      document.getElementById("pinLockOverlay").classList.remove("hidden");
      document.getElementById("pinInput").focus();
    });

        // Device OTP Handlers
    document.getElementById("deviceOtpForm").addEventListener("submit", async e => {
      e.preventDefault();
      const enteredOtp = document.getElementById("otpCodeInput").value.trim();
      const devId = getDeviceId();
      const errEl = document.getElementById("otpErrorMsg");
      errEl.classList.add("hidden");

      if (enteredOtp.length !== 6) {
        errEl.textContent = "❌ Theek 6-digit OTP dalein!";
        errEl.classList.remove("hidden");
        return;
      }

      showToast("⏳ OTP verify ho raha hai...");
      try {
        const r = await postVerifiedToAppsScript({ action: "verifyDeviceOtp", deviceId: devId, otp: enteredOtp });
        if (r && r.ok) {
          markDeviceTrusted();
          document.getElementById("deviceOtpOverlay").classList.add("hidden");
          showToast("🎉 Naya Device safaltapoorvak Trust ho gaya!");
          // Proceed to Password prompt
          document.getElementById("pinLockOverlay").classList.remove("hidden");
          document.getElementById("pinInput").focus();
        } else {
          errEl.textContent = "❌ " + ((r && r.message) || "Galat OTP! Kripya apna sahi email OTP dalein.");
          errEl.classList.remove("hidden");
        }
      } catch(err) {
        errEl.textContent = "❌ OTP verify fail. Internet check karein ya Resend dabayein.";
        errEl.classList.remove("hidden");
      }
    });

    document.getElementById("resendOtpBtn").addEventListener("click", () => {
      sendDeviceEmailOtp();
    });

    document.getElementById("skipOtpEmergencyBtn").addEventListener("click", () => {
      const otpInp = document.getElementById("otpCodeInput");
      otpInp.placeholder = "Enter Master Key (Emergency)";
      otpInp.focus();
      showToast("🔑 Emergency: Upar box me apni Master Key likhein aur Verify dabayein!");
    });

    document.getElementById("biometricUnlockBtn").addEventListener("click", () => {
      triggerBiometricAuthentication();
    });

    document.getElementById("deviceBiometricBtn").addEventListener("click", () => {
      triggerBiometricAuthentication();
    });

    // ================= STRONG PASSWORD MODULE =================
    const AUTH_KEY = "gst_auth_v2";
    const AUTH_COOKIE_KEY = "gst_auth_v2_ck";
    const FAIL_KEY = "gst_auth_fail_v2";
    const PW_MIN_LEN = 10;
    const PW_COMMON = ["password","passw0rd","qwerty","admin","letmein","welcome","abc123","123456","111111","iloveyou","gst","tax","adwik"];
    let pwMode = "change"; // change | migrate | reset
    let memAuthRaw = null;
    let memVaultSalt = null;

    // IndexedDB backup for Auth & Vault Salt (survives localStorage quota & cookie limits)
    const SEC_IDB_NAME = "gst_tracker_sec_v1";
    const SEC_IDB_STORE = "kv";
    function openSecIdb() {
      return new Promise(resolve => {
        try {
          if (typeof indexedDB === "undefined" || !indexedDB) return resolve(null);
          const req = indexedDB.open(SEC_IDB_NAME, 1);
          req.onupgradeneeded = () => {
            try {
              const db = req.result;
              if (!db.objectStoreNames.contains(SEC_IDB_STORE)) db.createObjectStore(SEC_IDB_STORE);
            } catch (e) {}
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }
    async function idbSetSec(k, v) {
      const db = await openSecIdb();
      if (!db) return false;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(SEC_IDB_STORE, "readwrite");
          tx.objectStore(SEC_IDB_STORE).put(v, k);
          tx.oncomplete = () => { try { db.close(); } catch (e) {} resolve(true); };
          tx.onerror = () => { try { db.close(); } catch (e) {} resolve(false); };
        } catch (e) { try { db.close(); } catch (x) {} resolve(false); }
      });
    }
    async function idbGetSec(k) {
      const db = await openSecIdb();
      if (!db) return null;
      return new Promise(resolve => {
        try {
          const tx = db.transaction(SEC_IDB_STORE, "readonly");
          const req = tx.objectStore(SEC_IDB_STORE).get(k);
          req.onsuccess = () => { try { db.close(); } catch (e) {} resolve(req.result || null); };
          req.onerror = () => { try { db.close(); } catch (e) {} resolve(null); };
        } catch (e) { try { db.close(); } catch (x) {} resolve(null); }
      });
    }
    async function idbClearSec() {
      const db = await openSecIdb();
      if (!db) return;
      await new Promise(resolve => {
        try {
          const tx = db.transaction(SEC_IDB_STORE, "readwrite");
          tx.objectStore(SEC_IDB_STORE).clear();
          tx.oncomplete = () => { try { db.close(); } catch (e) {} resolve(); };
          tx.onerror = () => { try { db.close(); } catch (e) {} resolve(); };
        } catch (e) { try { db.close(); } catch (x) {} resolve(); }
      });
    }

    function readAuthRaw() {
      let raw = null;
      try { raw = localStorage.getItem(AUTH_KEY); } catch (e) {}
      if (!raw) raw = getCookie(AUTH_COOKIE_KEY);
      if (!raw) { try { raw = sessionStorage.getItem(AUTH_KEY); } catch (e) {} }
      if (!raw && memAuthRaw) raw = memAuthRaw;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.s && parsed.h && parsed.i) {
            memAuthRaw = raw;
            // Self-heal missing layers silently
            try { if (!localStorage.getItem(AUTH_KEY)) safeStorageSet(AUTH_KEY, raw); } catch (e) {}
            if (!getCookie(AUTH_COOKIE_KEY)) setCookie(AUTH_COOKIE_KEY, raw, 365);
            try { sessionStorage.setItem(AUTH_KEY, raw); } catch (e) {}
            return raw;
          }
        } catch (e) {}
      }
      return null;
    }

    const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

    async function pwDerive(pw, saltBytes, iter) {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
      return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: iter }, key, 256));
    }
    function hasStrongPw() { return !!readAuthRaw(); }

    // ===== VAULT: client portal passwords AES-GCM se encrypt (key = app password se, sirf memory me) =====
    let vaultKey = null;
    const VAULT_SALT_KEY = "gst_vault_salt_v1";
    const VAULT_SALT_COOKIE_KEY = "gst_vault_salt_v1_ck";
    function readVaultSalt() {
      let s = null;
      try { s = localStorage.getItem(VAULT_SALT_KEY); } catch (e) {}
      if (!s) s = getCookie(VAULT_SALT_COOKIE_KEY);
      if (!s) { try { s = sessionStorage.getItem(VAULT_SALT_KEY); } catch (e) {} }
      if (!s && memVaultSalt) s = memVaultSalt;
      if (s) {
        memVaultSalt = s;
        try { if (!localStorage.getItem(VAULT_SALT_KEY)) safeStorageSet(VAULT_SALT_KEY, s); } catch (e) {}
        if (!getCookie(VAULT_SALT_COOKIE_KEY)) setCookie(VAULT_SALT_COOKIE_KEY, s, 365);
        try { sessionStorage.setItem(VAULT_SALT_KEY, s); } catch (e) {}
      }
      return s;
    }
    function writeVaultSalt(salt) {
      memVaultSalt = salt;
      safeStorageSet(VAULT_SALT_KEY, salt);
      setCookie(VAULT_SALT_COOKIE_KEY, salt, 365);
      try { sessionStorage.setItem(VAULT_SALT_KEY, salt); } catch (e) {}
      idbSetSec(VAULT_SALT_KEY, salt);
    }

    // Startup IndexedDB restore: agar localStorage + cookie dono clear hue hon, IndexedDB se turant wapas laayein
    (async function restoreSecFromIdbOnBoot() {
      try {
        if (!readVaultSalt()) {
          const idbSalt = await idbGetSec(VAULT_SALT_KEY);
          if (idbSalt) writeVaultSalt(idbSalt);
        } else {
          idbSetSec(VAULT_SALT_KEY, readVaultSalt());
        }
        if (!readAuthRaw()) {
          const idbAuth = await idbGetSec(AUTH_KEY);
          if (idbAuth) {
            memAuthRaw = idbAuth;
            safeStorageSet(AUTH_KEY, idbAuth);
            setCookie(AUTH_COOKIE_KEY, idbAuth, 365);
            try { sessionStorage.setItem(AUTH_KEY, idbAuth); } catch (e) {}
            loadPin();
            refreshBioUI();
            if (typeof refreshOtpSetupUI === "function") refreshOtpSetupUI();
          }
        } else {
          idbSetSec(AUTH_KEY, readAuthRaw());
        }
      } catch (e) {}
    })();

    const isEnc = v => typeof v === "string" && v.indexOf("enc:v1:") === 0;
    async function deriveVaultKey(pw, saltB64) {
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
      return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: 210000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    async function encPw(plain) {
      if (!plain) return "";
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, vaultKey, new TextEncoder().encode(plain));
      return "enc:v1:" + b64(iv) + ":" + b64(ct);
    }
    async function decPw(s) { // null = decrypt nahi ho paya (app locked / galat key)
      if (!isEnc(s)) return s || "";
      if (!vaultKey) return null;
      try {
        const p = s.split(":");
        return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(p[2]) }, vaultKey, unb64(p[3])));
      } catch (e) { return null; }
    }
    async function getClientPw(c) { return decPw(c.password); }
    async function setupVault(pw, plainByKey) {
      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      writeVaultSalt(salt);
      if (scriptUrl) { postVerifiedToAppsScript({ action: "saveVaultSalt", salt: salt }).catch(() => {}); }
      vaultKey = await deriveVaultKey(pw, salt);
      for (const c of clients) {
        let p = c.password || "";
        const ck = getClientKey(c);
        if (isEnc(p)) {
          const recovered = (plainByKey && (plainByKey.has(ck) ? plainByKey.get(ck) : plainByKey.get(c.sr))) || "";
          if (recovered) c.password = recovered;
        }
      }
      saveClients();
    }

    // ===== BIOMETRIC: sirf password login ke BAAD enable hota hai, is device par =====
    const BIO_KEY = "gst_bio_cred_v1";
    function bioEnrolled() { try { return !!(localStorage.getItem(BIO_KEY) || getCookie(BIO_KEY)) && hasStrongPw() && isDeviceTrusted(); } catch (e) { return false; } }
    async function bioSupported() {
      try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
    }
    function refreshBioUI() {
      document.getElementById("biometricBtnContainer").classList.toggle("hidden", !bioEnrolled());
      document.getElementById("deviceBiometricBtn").classList.add("hidden"); // naye device par biometric se bypass nahi
    }
    async function maybeOfferBio() {
      if (bioEnrolled() || !isDeviceTrusted() || !(await bioSupported())) return;
      document.getElementById("bioOfferBar").classList.remove("hidden");
    }
    async function enrollBiometric() {
      document.getElementById("bioOfferBar").classList.add("hidden");
      if (!hasStrongPw() || !isDeviceTrusted()) return;
      try {
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: "GST Client Portal" },
            user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "admin", displayName: "Administrator" },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
            timeout: 60000
          }
        });
        if (cred) {
          const rawB64 = b64(cred.rawId);
          safeStorageSet(BIO_KEY, rawB64);
          setCookie(BIO_KEY, rawB64, 365);
          refreshBioUI();
          showToast("✅ Fingerprint/Face unlock is device par on ho gaya!");
        }
      } catch (e) { showToast("❌ Fingerprint on nahi ho paya (cancel ya support nahi)."); }
    }
    async function unlockVault(pw) {
      const salt = readVaultSalt();
      if (!salt) return setupVault(pw, null);
      vaultKey = await deriveVaultKey(pw, salt);
      // Purane enc:v1 passwords ko auto-decrypt karke clean plain text bana dein (re-encrypt nahi karna)
      let changed = false;
      for (const c of clients) {
        if (c.password && isEnc(c.password)) {
          const dec = await decPw(c.password);
          if (dec !== null && dec !== "" && !String(dec).startsWith("enc:")) {
            c.password = dec;
            changed = true;
          }
        }
      }
      if (changed) saveClients();
    }

    async function setStrongPassword(pw) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iter = 210000;
      const h = await pwDerive(pw, salt, iter);
      const authPayload = JSON.stringify({ s: b64(salt), h: h, i: iter });
      memAuthRaw = authPayload;
      const lsSaved = safeStorageSet(AUTH_KEY, authPayload);
      setCookie(AUTH_COOKIE_KEY, authPayload, 365);
      try { sessionStorage.setItem(AUTH_KEY, authPayload); } catch (e) {}
      await idbSetSec(AUTH_KEY, authPayload);
      try {
        // purana kamzor PIN / master key / cookies hamesha ke liye hata do
        ["gst_tracker_pin_code_permanent","gst_permanent_pin","gst_tracker_pin_code_v3","gst_user_custom_pin_set","gst_custom_master_key"].forEach(k => localStorage.removeItem(k));
        localStorage.removeItem(FAIL_KEY);
        localStorage.removeItem("gst_bio_cred_v1"); // password badla to fingerprint dobara on karna hoga
      } catch (e) {}
      ["gst_permanent_pin","gst_user_custom_pin_set","gst_custom_master_key", BIO_KEY].forEach(k => setCookie(k, "", -1));
      return lsSaved || !!getCookie(AUTH_COOKIE_KEY);
    }
    async function verifyStrongPw(pw) {
      try {
        const raw = readAuthRaw();
        if (!raw) return false;
        const r = JSON.parse(raw);
        const h = await pwDerive(pw, unb64(r.s), r.i);
        let d = h.length ^ r.h.length;
        for (let k = 0; k < h.length; k++) d |= h.charCodeAt(k) ^ (r.h.charCodeAt(k) || 0);
        return d === 0;
      } catch (e) { return false; }
    }

    // ---- policy + meter ----
    function pwRuleList(pw) {
      const low = pw.toLowerCase();
      return [
        [`Kam se kam ${PW_MIN_LEN} characters`, pw.length >= PW_MIN_LEN],
        ["Capital letter (A-Z)", /[A-Z]/.test(pw)],
        ["Small letter (a-z)", /[a-z]/.test(pw)],
        ["Number (0-9)", /\d/.test(pw)],
        ["Symbol (@ # $ ! ...)", /[^A-Za-z0-9]/.test(pw)],
        ["Aam word / ek hi character 3 baar nahi", !PW_COMMON.some(w => low.includes(w)) && !/(.)\1{2,}/.test(pw)]
      ];
    }
    function validatePw(pw) {
      const bad = pwRuleList(pw).find(r => !r[1]);
      return bad ? "❌ Password rule poora nahi: " + bad[0] : "";
    }
    function pwScore(pw) {
      if (!pw) return 0;
      const rules = pwRuleList(pw);
      if (!rules.every(r => r[1])) return 1;
      let s = 2;
      if (pw.length >= 14) s++;
      if (pw.length >= 18) s++;
      return s;
    }
    function renderMeter() {
      const pw = document.getElementById("newPinInputSecure").value;
      const sc = pwScore(pw);
      const cols = ["#e2e8f0", "#ef4444", "#f59e0b", "#10b981", "#059669"];
      const names = ["", "Kamzor", "Theek-thaak", "Strong", "Bahut Strong"];
      document.querySelectorAll(".pw-seg").forEach((el, n) => { el.style.background = n < sc ? cols[sc] : "#e2e8f0"; });
      const lb = document.getElementById("pwStrengthLabel");
      lb.textContent = pw ? names[sc] : "";
      lb.style.color = cols[sc];
      document.getElementById("pwRules").innerHTML = pwRuleList(pw).map(r => `<li style="color:${r[1] ? "#059669" : "#64748b"}">${r[1] ? "✅" : "⬜"} ${r[0]}</li>`).join("");
    }
    function generatePw() {
      const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", L = "abcdefghijkmnopqrstuvwxyz", D = "23456789", S = "!@#$%^&*?-_";
      const all = U + L + D + S;
      const rnd = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
      const c = [U[rnd(U.length)], L[rnd(L.length)], D[rnd(D.length)], S[rnd(S.length)]];
      while (c.length < 16) c.push(all[rnd(all.length)]);
      for (let k = c.length - 1; k > 0; k--) { const m = rnd(k + 1); [c[k], c[m]] = [c[m], c[k]]; }
      return c.join("");
    }

    // ---- brute-force lockout (5 galat try ke baad 30s, phir double, max 1 ghanta) ----
    function getFail() { try { return JSON.parse(localStorage.getItem(FAIL_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
    function lockLeft() { return Math.max(0, getFail().until - Date.now()); }
    function recordFail() {
      const f = getFail(); f.n++;
      if (f.n >= 5) f.until = Date.now() + Math.min(30000 * Math.pow(2, f.n - 5), 3600000);
      try { localStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch (e) {}
      return f;
    }
    let lockTimer = null;
    function refreshLockUI() {
      const err = document.getElementById("pinErrorMsg"), btn = document.getElementById("unlockPinBtn");
      const left = lockLeft();
      if (left > 0) {
        err.textContent = `⏳ Bahut zyada galat koshish. ${Math.ceil(left / 1000)} sec baad try karein.`;
        err.classList.remove("hidden"); btn.disabled = true; btn.style.opacity = .5;
        if (!lockTimer) lockTimer = setInterval(refreshLockUI, 1000);
      } else {
        btn.disabled = false; btn.style.opacity = 1;
        if (lockTimer) { clearInterval(lockTimer); lockTimer = null; err.classList.add("hidden"); }
      }
    }
    function unlockApp(msg, viaPw) {
      document.getElementById("pinLockOverlay").classList.add("hidden");
      document.getElementById("pinErrorMsg").classList.add("hidden");
      document.getElementById("pinInput").value = "";
      showToast(msg || "App Unlocked! 🔓");
      if (viaPw) maybeOfferBio();
    }

    // ---- password modal ----
    function openPwModal(mode) {
      pwMode = mode;
      const ov = document.getElementById("changePinModalOverlay");
      const isChange = mode === "change";
      document.getElementById("oldPwWrap").classList.toggle("hidden", !isChange);
      document.getElementById("oldPinInput").required = isChange;
      document.getElementById("cancelChangePinBtn").classList.toggle("hidden", !isChange);
      document.getElementById("changePwTitle").textContent = isChange ? "Password Badlein" : (mode === "migrate" ? "Strong Password Banayein" : "Naya Password Set Karein");
      document.getElementById("changePwSub").textContent = isChange ? "Pehle purana password verify karein" : "Purana 6-digit PIN ab band hoga. Naya strong password zaroori hai.";
      ov.style.zIndex = isChange ? "" : "60"; // migrate/reset me lock screen ke upar
      ["oldPinInput","newPinInputSecure","confirmNewPinInput"].forEach(id => { const el = document.getElementById(id); el.value = ""; el.type = "password"; });
      document.getElementById("changePinErrorMsg").classList.add("hidden");
      renderMeter();
      ov.classList.remove("hidden");
      document.getElementById(isChange ? "oldPinInput" : "newPinInputSecure").focus();
    }

    document.addEventListener("click", e => {
      const eye = e.target.closest(".pw-eye");
      if (eye) { const el = document.getElementById(eye.dataset.target); el.type = el.type === "password" ? "text" : "password"; }
    });
    document.getElementById("newPinInputSecure").addEventListener("input", renderMeter);
    document.getElementById("genPwBtn").addEventListener("click", () => {
      const pw = generatePw();
      ["newPinInputSecure","confirmNewPinInput"].forEach(id => { const el = document.getElementById(id); el.value = pw; el.type = "text"; });
      renderMeter();
      showToast("🎲 Password ban gaya — isse kisi safe jagah note kar lein!");
    });

    document.getElementById("pinUnlockForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = document.getElementById("pinErrorMsg");
      if (lockLeft() > 0) { refreshLockUI(); return; }
      const entered = document.getElementById("pinInput").value;
      let ok;
      if (hasStrongPw()) ok = await verifyStrongPw(entered);
      else ok = Boolean(appPin && entered === appPin); // sirf ek baar: purane PIN se upgrade
      if (ok) {
        try { localStorage.removeItem(FAIL_KEY); } catch (e) {}
        if (hasStrongPw()) { await unlockVault(entered); unlockApp(undefined, true); }
        else { document.getElementById("pinInput").value = ""; openPwModal("migrate"); }
      } else {
        const f = recordFail();
        document.getElementById("pinInput").value = "";
        if (f.n >= 5) { refreshLockUI(); }
        else { err.textContent = `❌ Galat Password! (${5 - f.n} koshish baaki)`; err.classList.remove("hidden"); document.getElementById("pinInput").focus(); }
      }
    });

    document.getElementById("forgotPinBtn").addEventListener("click", () => {
      document.getElementById("forgotPinBox").classList.toggle("hidden");
    });
    document.getElementById("wipeDeviceBtn").addEventListener("click", async () => {
      const er = document.getElementById("resetErrorMsg");
      if (document.getElementById("resetConfirmInput").value.trim().toUpperCase() !== "RESET") {
        er.textContent = "❌ Confirm ke liye RESET likhein."; er.classList.remove("hidden"); return;
      }
      memAuthRaw = null;
      memVaultSalt = null;
      try { await idbClearSec(); } catch (e) {}
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
      try { document.cookie.split(";").forEach(c => { const n = c.split("=")[0].trim(); if (n) document.cookie = n + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"; }); } catch (e) {}
      location.reload();
    });

    document.getElementById("openChangePinModalBtn").addEventListener("click", () => openPwModal("change"));
    document.getElementById("cancelChangePinBtn").addEventListener("click", () => {
      document.getElementById("changePinModalOverlay").classList.add("hidden");
    });

    document.getElementById("secureChangePinForm").addEventListener("submit", async e => {
      e.preventDefault();
      const errEl = document.getElementById("changePinErrorMsg");
      const fail = m => { errEl.textContent = m; errEl.classList.remove("hidden"); };
      const oldPw = document.getElementById("oldPinInput").value;
      const np = document.getElementById("newPinInputSecure").value;
      const cp = document.getElementById("confirmNewPinInput").value;
      if (pwMode === "change") {
        if (lockLeft() > 0) return fail("⏳ Kuch der baad try karein.");
        const okOld = hasStrongPw() ? await verifyStrongPw(oldPw) : Boolean(appPin && oldPw === appPin);
        if (!okOld) { recordFail(); return fail("❌ Purana password galat hai!"); }
      }
      const msg = validatePw(np);
      if (msg) return fail(msg);
      if (np !== cp) return fail("❌ Naya password aur Confirm match nahi ho rahe!");
      let plainBySr = null;
      if (pwMode === "change") {
        const vs = readVaultSalt();
        if (!vaultKey && vs) vaultKey = await deriveVaultKey(oldPw, vs);
        plainBySr = new Map();
        for (const c of clients) { const pl = await decPw(c.password); if (pl !== null) plainBySr.set(getClientKey(c), pl); }
      } else if (pwMode === "reset") {
        const n = clients.filter(c => isEnc(c.password)).length;
        const formEl = document.getElementById("secureChangePinForm");
        if (n > 0 && formEl.dataset.confirmWipe !== "1") {
          formEl.dataset.confirmWipe = "1";
          return fail("⚠️ Reset karne par " + n + " clients ke saved GST portal passwords mit jayenge. Confirm karne ke liye dobara 'Save Strong Password' dabayein.");
        }
        if (formEl) formEl.dataset.confirmWipe = "";
      }
      await setStrongPassword(np);
      await setupVault(np, plainBySr);
      loadPin();
      document.getElementById("changePinModalOverlay").classList.add("hidden");
      document.getElementById("changePinModalOverlay").style.zIndex = "";
      if (pwMode !== "change") unlockApp("🔐 Strong password set ho gaya! App unlock hai.", true);
      else { showToast("🔐 Naya strong password save ho gaya!"); maybeOfferBio(); }
    });

    document.getElementById("lockAppBtn").addEventListener("click", () => { vaultKey = null; refreshBioUI(); });
    document.getElementById("bioOfferYes").addEventListener("click", enrollBiometric);
    document.getElementById("bioOfferLater").addEventListener("click", () => document.getElementById("bioOfferBar").classList.add("hidden"));
    refreshBioUI();

    // Fingerprint ek baar on hone ke baad lock screen aate hi apne se prompt aayega (button dabane ki zarurat nahi)
    let bioAutoBusy = false;
    async function autoBio() {
      if (bioAutoBusy || !bioEnrolled()) return;
      const lock = document.getElementById("pinLockOverlay");
      if (lock.classList.contains("hidden") || document.hidden) return;
      bioAutoBusy = true;
      try { await triggerBiometricAuthentication(); } finally { bioAutoBusy = false; }
    }
    setTimeout(autoBio, 500);
    document.getElementById("lockAppBtn").addEventListener("click", () => setTimeout(autoBio, 400));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(autoBio, 300); });


    // Fresh device (na password, na Sheet URL): OTP screen par hi URL daalne ka option
    function refreshOtpSetupUI() {
      const need = !scriptUrl && !hasStrongPw();
      document.getElementById("otpSetupUrlBox").classList.toggle("hidden", !need);
      if (need) document.getElementById("otpModalSubtitle").textContent = "Is device par Sheet connect nahi hai. Pehle neeche Apps Script URL dalein, phir Gmail par OTP aayega.";
    }
    document.getElementById("otpConnectUrlBtn").addEventListener("click", () => {
      if (scriptUrl || hasStrongPw()) return; // sirf bilkul fresh setup me
      const u = document.getElementById("otpScriptUrlInput").value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) {
        showToast("❌ Sahi Apps Script URL dalein (https://script.google.com/macros/s/.../exec)");
        return;
      }
      savePermanentConfig(u, null);
      scriptUrl = u;
      refreshOtpSetupUI();
      sendDeviceEmailOtp();
    });

    // Emergency/master-key button ab nahi chalega (backdoor hata diya)
    document.getElementById("skipOtpEmergencyBtn").classList.add("hidden");

    // 10-minute idle auto-lock removed as requested — app locks only via manual Lock button or fresh launch.

