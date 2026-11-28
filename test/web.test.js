const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const WEB_DIR = path.join(ROOT, "web");
const ASSETS_APP_DIR = path.join(ROOT, "android", "app", "src", "main", "assets", "app");

const gstr2bParser = require(path.join(WEB_DIR, "js", "gstr2b-parser.js"));
const { escapeHtmlText } = require(path.join(ROOT, "scripts", "build-web.js"));

test("web/js/*.js: every modular client script has valid JavaScript syntax", () => {
  const jsDir = path.join(WEB_DIR, "js");
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith(".js")).sort();
  assert.ok(files.length >= 10, "expected at least 10 JS modules in web/js");
  for (const file of files) {
    const src = fs.readFileSync(path.join(jsDir, file), "utf8");
    assert.doesNotThrow(
      () => new vm.Script(src, { filename: file }),
      `${file} should parse cleanly`
    );
  }
});

test("gstr2b-parser: extracts GST Portal iamt/camt/samt/csamt (fixes Phone-mode ₹0 tax bug)", () => {
  const portal2b = {
    data: {
      rtnprd: "102026",
      docdata: {
        b2b: [
          {
            ctin: "09ABCDE1234F1Z5",
            trdnm: "ALPHA EXPORTS LLP",
            inv: [
              {
                inum: "INV-001",
                dt: "05-10-2026",
                val: 11800,
                pos: "09",
                rchrg: "N",
                itms: [
                  { num: 1, itm_det: { txval: 10000, iamt: 1800, camt: 0, samt: 0, csamt: 0 } }
                ]
              },
              {
                inum: "INV-002",
                dt: "11-10-2026",
                val: 23600,
                pos: "09",
                rchrg: "N",
                itms: [
                  { num: 1, itm_det: { txval: 10000, iamt: 0, camt: 900, samt: 900, csamt: 50 } },
                  { num: 2, itm_det: { txval: 10000, iamt: 0, camt: 900, samt: 900, csamt: 0 } }
                ]
              }
            ]
          },
          {
            ctin: "27ZZZZZ9999Z1Z1",
            trdnm: "BRIDGE LEGACY TRADERS",
            inv: [
              {
                inum: "BL-99",
                dt: "20-10-2026",
                val: 5900,
                items: [
                  { txval: "5000", igst: "900", cgst: "0", sgst: "0", cess: "0" }
                ]
              }
            ]
          }
        ],
        ecom: [
          {
            ctin: "07AAACE1234F1Z2",
            trdnm: "ETSY SELLER SERVICES",
            inv: [
              {
                itms: [{ itm_det: { txval: 42000, iamt: 2100, camt: 0, samt: 0, csamt: 0 } }]
              }
            ]
          }
        ]
      }
    }
  };

  const b64 = "data:application/json;base64," + Buffer.from(JSON.stringify(portal2b), "utf8").toString("base64");
  const sellers = gstr2bParser.gpExtractB2bSellersFromData({
    gstr2b: { jsonBase64: b64, b2bSellers: [] }
  });
  assert.equal(sellers.length, 2);
  const alpha = sellers.find(s => s.gstin === "09ABCDE1234F1Z5");
  assert.ok(alpha);
  assert.equal(alpha.name, "ALPHA EXPORTS LLP");
  assert.equal(alpha.invCount, 2);
  assert.equal(alpha.taxable, 30000);
  assert.equal(alpha.igst, 1800);
  assert.equal(alpha.cgst, 1800);
  assert.equal(alpha.sgst, 1800);
  assert.equal(alpha.cess, 50);
  assert.equal(alpha.invoices.length, 2);
  assert.equal(alpha.invoices[1].cgst, 1800);
  assert.equal(alpha.invoices[1].sgst, 1800);
  assert.equal(alpha.invoices[1].cess, 50);

  // Also test UTF-8 BOM inside base64 payload + direct obj extraction
  const b64Bom = "data:application/json;base64," + Buffer.from("\uFEFF" + JSON.stringify(portal2b), "utf8").toString("base64");
  assert.equal(gstr2bParser.gpExtractB2bSellersFromData({ gstr2b: { jsonBase64: b64Bom } }).length, 2);
  assert.equal(gstr2bParser.gpExtractB2bSellersFromObj(portal2b).length, 2);

  const summary = gstr2bParser.gpB2bSummaryFromSellers(sellers);
  assert.equal(summary.igst, 2700);
  assert.equal(summary.cgst, 1800);
  assert.equal(summary.sgst, 1800);
  assert.equal(summary.cess, 50);
  assert.equal(summary.b2bSuppliersCount, 2);

  const eco = gstr2bParser.gpExtractEcoList({
    ecommerceTcs: {
      rows: [{ ecoName: "ETSY SELLER SERVICES", ecoGstin: "07AAACE1234F1Z2", grossTaxableAmount: 42000, tcsIgst: 210, tcsCgst: 0, tcsSgst: 0 }]
    }
  });
  assert.equal(eco.length, 1);
  assert.equal(eco[0].gross, 42000);
  assert.equal(eco[0].tcs, 210);
});

test("gstr2b-parser: gpPackB2bJson respects 48k cell limit cleanly", () => {
  const many = Array.from({ length: 800 }, (_, i) => ({
    name: "SUPPLIER " + i,
    gstin: "09ABCDE" + String(1000 + i) + "1Z5",
    invCount: 1,
    taxable: i + 100,
    igst: 18,
    cgst: 0,
    sgst: 0,
    cess: 0,
    invoices: [{ num: "INV-" + i, dt: "01-10-2026", txval: i + 100, igst: 18, cgst: 0, sgst: 0, cess: 0, val: i + 118 }]
  }));
  const packed = gstr2bParser.gpPackB2bJson(many);
  assert.ok(packed.note.length > 0);
  assert.ok(packed.json.length <= 48000);
  const parsed = JSON.parse(packed.json);
  assert.ok(Array.isArray(parsed) && parsed.length < many.length && parsed.length > 0);
});

test("built assets/app matches web/ sources, embeds APPS_SCRIPT_AppSync.gs, and removes external CDNs/secrets", () => {
  const builtIndex = fs.readFileSync(path.join(ASSETS_APP_DIR, "index.html"), "utf8");
  const webIndex = fs.readFileSync(path.join(WEB_DIR, "index.html"), "utf8");
  const gsRaw = fs.readFileSync(path.join(ROOT, "APPS_SCRIPT_AppSync.gs"), "utf8");

  assert.equal(builtIndex.includes("<!-- __APPS_SCRIPT_CODE_BLOCK__ -->"), false);
  assert.equal(builtIndex, webIndex.replace("<!-- __APPS_SCRIPT_CODE_BLOCK__ -->", escapeHtmlText(gsRaw)));
  assert.equal(/cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/i.test(builtIndex), false);

  // Verify no hardcoded bridge secret or default PIN literals remain
  assert.equal(/AdwikGst2026/.test(builtIndex), false);
  assert.equal(/type="password"[^>]*id="gpBridgeSecInp"|id="gpBridgeSecInp"[^>]*type="password"/.test(builtIndex), true);
  assert.ok(builtIndex.includes('id="syncSecretInput"'), "Sync Setup modal must expose optional SYNC_SECRET input");

  // Verify modular JS sync + offline vendor bundles exist
  for (const rel of ["vendor/tailwind.min.css", "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "css/design-system.css"]) {
    const p = path.join(ASSETS_APP_DIR, rel);
    assert.ok(fs.existsSync(p) && fs.statSync(p).size > 0, `Missing or empty ${rel}`);
  }
  const webJsFiles = fs.readdirSync(path.join(WEB_DIR, "js")).filter(f => f.endsWith(".js"));
  for (const f of webJsFiles) {
    const src = fs.readFileSync(path.join(WEB_DIR, "js", f), "utf8");
    const dst = fs.readFileSync(path.join(ASSETS_APP_DIR, "js", f), "utf8");
    assert.equal(dst, src, `${f} in android assets must match web/js/${f}`);
  }

  const trackerJs = fs.readFileSync(path.join(WEB_DIR, "js", "tracker-and-sync.js"), "utf8");
  assert.equal(/"947183"/.test(trackerJs), false, "Default weak PIN 947183 must be removed");
  assert.equal(/AdwikGst2026/.test(trackerJs), false, "Default bridge secret literal must be removed");
  assert.ok(trackerJs.includes("vendor/pdf.worker.min.js"), "PDF.js worker must load locally");
});

test("gstr2b-parser: gpMergePortalSaveData keeps failed/NOT_GENERATED flags accurately across retries", () => {
  const period = "2026-27 / 11";

  // 1. Fresh client: GSTR-2B failed, TCS succeeded -> missing.gstr2b=true, gstr2bStatus="2B_FAILED" (not false ₹0 synced!)
  const partialFail = {
    fy: "2026-27",
    month: "11",
    status: { gstr2b: { state: "failed", message: "Access Denied" }, tcs: { state: "ok", message: "1 row" } },
    partial: { gstr2b: true, tcs: false, text: "Adhoora fetch — GSTR-2B: Access Denied" },
    ecommerceTcs: {
      totalGrossTaxable: 787849,
      totalReturned: 0,
      totalNetValue: 787849,
      totalTcs: 3939,
      rows: [{ ecoName: "ETSY", ecoGstin: "9921USA29004OSP", grossTaxableAmount: 787849, tcsIgst: 3939, tcsCgst: 0, tcsSgst: 0 }]
    }
  };
  const m1 = gstr2bParser.gpMergePortalSaveData(null, partialFail, period);
  assert.equal(m1.localPortalObj.missing.gstr2b, true);
  assert.equal(m1.localPortalObj.missing.tcs, false);
  assert.equal(m1.localPortalObj.gstr2bNotGenerated, false);
  assert.equal(m1.gstr2bStatus, "2B_FAILED");
  assert.equal(m1.localPortalObj.ecomGross, 787849);
  assert.equal(m1.localPortalObj.ecomTcs, 3939);

  // 2. Retrying client whose previous same-period attempt ALSO failed 2B -> missing.gstr2b stays true!
  const m2 = gstr2bParser.gpMergePortalSaveData(m1.localPortalObj, partialFail, period);
  assert.equal(m2.localPortalObj.missing.gstr2b, true);
  assert.equal(m2.gstr2bStatus, "2B_FAILED");

  // 3. Client with prior NOT_GENERATED whose 2B fetch fails later -> NOT_GENERATED preserved (not wiped to "")!
  const prevNotGen = {
    period,
    igst: 0, cgst: 0, sgst: 0, cess: 0, ineligible: 0, suppliers: 0,
    b2bSellers: [],
    ecomGross: 0, ecomNet: 0, ecomTcs: 0, ecomPlatforms: "", ecoList: [],
    gstr2bNotGenerated: true,
    missing: { gstr2b: false, tcs: false }
  };
  const m3 = gstr2bParser.gpMergePortalSaveData(prevNotGen, partialFail, period);
  assert.equal(m3.localPortalObj.gstr2bNotGenerated, true);
  assert.equal(m3.localPortalObj.missing.gstr2b, false);
  assert.equal(m3.gstr2bStatus, "NOT_GENERATED");
  assert.equal(m3.localPortalObj.ecomGross, 787849);

  // 4. Client with valid prior 2B whose 2B retry fails -> preserves valid ITC numbers without overwriting with 0!
  const prevValid2b = {
    period,
    igst: 1200, cgst: 600, sgst: 600, cess: 0, ineligible: 0, suppliers: 2,
    b2bSellers: [{ name: "SUP", gstin: "09ABCDE1234F1Z5", taxable: 10000 }],
    gstr2bNotGenerated: false,
    missing: { gstr2b: false, tcs: false }
  };
  const m4 = gstr2bParser.gpMergePortalSaveData(prevValid2b, partialFail, period);
  assert.equal(m4.localPortalObj.igst, 1200);
  assert.equal(m4.localPortalObj.suppliers, 2);
  assert.equal(m4.localPortalObj.missing.gstr2b, false);
  assert.equal(m4.gstr2bStatus, "");

  // 5. Status token parse/build round-trip
  assert.deepEqual(gstr2bParser.gpParseGstr2bStatusFlags("NOT_GENERATED|TCS_FAILED"), {
    gstr2bStatus: "NOT_GENERATED|TCS_FAILED",
    gstr2bNotGenerated: true,
    missing: { gstr2b: false, tcs: true },
    partialNote: "Adhoora fetch — E-Com / TCS portal se fetch nahi hua"
  });
  assert.deepEqual(gstr2bParser.gpParseGstr2bStatusFlags("2B_FAILED"), {
    gstr2bStatus: "2B_FAILED",
    gstr2bNotGenerated: false,
    missing: { gstr2b: true, tcs: false },
    partialNote: "Adhoora fetch — GSTR-2B portal se fetch nahi hua"
  });
});

test("android & portal-module: 100% hidden phone mode preserves security/stability guards", () => {
  const androidJavaDir = path.join(ROOT, "android", "app", "src", "main", "java", "com", "cloudgst", "app");
  const mainAct = fs.readFileSync(path.join(androidJavaDir, "MainActivity.java"), "utf8");
  const phoneLogin = fs.readFileSync(path.join(androidJavaDir, "PhoneLogin.java"), "utf8");
  const phoneFetch = fs.readFileSync(path.join(androidJavaDir, "PhoneFetch.java"), "utf8");
  const portalJs = fs.readFileSync(path.join(WEB_DIR, "js", "portal-module.js"), "utf8");

  // MainActivity: never surfaces loginOverlay / visible WebView, preserves BuildConfig version + separate payload locks
  assert.match(mainAct, /BuildConfig\.VERSION_NAME/);
  assert.match(mainAct, /public void phoneLoginVisible\(final boolean show\)/);
  assert.match(mainAct, /public void clearPhonePayload\(final String id\)/);
  assert.match(mainAct, /wv\.setAlpha\(0f\)/);
  assert.doesNotMatch(mainAct, /wv\.setAlpha\(1f\)/);
  assert.doesNotMatch(mainAct, /rootView\.addView\(loginOverlay/);

  // PhoneLogin: canvas capture + CAPWAIT + cookie cleanup on switch + preserves awaitingUserInput / wrongCapPending
  assert.match(phoneLogin, /imgToDataUrl/);
  assert.match(phoneLogin, /CAPWAIT/);
  assert.match(phoneLogin, /lastLoggedInUser/);
  assert.match(phoneLogin, /removeAllCookies/);
  assert.match(phoneLogin, /awaitingUserInput/);
  assert.match(phoneLogin, /wrongCapPending/);
  assert.doesNotMatch(phoneLogin, /setLoginOverlayVisible\(true\)/);

  // PhoneFetch: hidden WebView + 25MB download guard + HTML guard + chunk retry limit
  assert.match(phoneFetch, /wv\.setAlpha\(0f\)/);
  assert.match(phoneFetch, /MAX_DOWNLOAD_BYTES/);
  assert.match(phoneFetch, /startsWith\("<"\)/);

  // portal-module: never opens native portal login overlay
  assert.doesNotMatch(portalJs, /phoneLoginVisible\(true\)/);

  // 5-Tab Multi-Profile Phone Mode + Phone TCS guards (v6.0.0)
  assert.match(mainAct, /phoneMaxParallel/);
  assert.match(mainAct, /phoneLoginStartSlot/);
  assert.match(mainAct, /phoneFetch2bSlot/);
  assert.match(phoneLogin, /WebViewCompat\.setProfile/);
  assert.match(phoneLogin, /gst_slot_/);
  assert.match(phoneFetch, /WebViewCompat\.setProfile/);
  assert.match(phoneFetch, /TCS\|/);
  assert.match(portalJs, /gpAllocPhoneSlot/);
  assert.match(portalJs, /gpPhoneLoginOtp\(otp,\s*st\.phoneSlot/);
  assert.equal(portalJs.includes("\x08"), false, "portal-module.js must not contain raw backspace bytes in regexes");

  const gradle = fs.readFileSync(path.join(ROOT, "android", "app", "build.gradle"), "utf8");
  const vcMatch = gradle.match(/versionCode\s+(\d+)/);
  assert.ok(vcMatch && Number(vcMatch[1]) >= 88, "versionCode must be >= 88 to upgrade cleanly over v6.2.0 (87)");
  assert.match(gradle, /versionName\s+'6\.2\.1'/);

  // Portal checkboxes default OFF (GSTR-2B, E-Com, Auto-Next, Drive) & no auto-expand dropdown on fetch completion
  const webHtml = fs.readFileSync(path.join(WEB_DIR, "index.html"), "utf8");
  for (const id of ["gpOpt2b", "gpOptTcs", "gpAutoNextChk", "gpAutoDriveChk"]) {
    const tagMatch = webHtml.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(tagMatch, `expected checkbox #${id} in web/index.html`);
    assert.equal(/\bchecked\b/i.test(tagMatch[0]), false, `#${id} must NOT be pre-checked by default`);
  }
  assert.doesNotMatch(portalJs, /nextChk\.checked\s*=\s*true/, "Auto-Next must not auto-check itself");
  assert.doesNotMatch(portalJs, /gpExpanded\.add\(c\.clientKey\)/, "Fetched client details must not auto-expand");

  // v6.0.2/v6.0.3: External physical keyboard blocks soft IME natively & Spacebar triggers next Fetch/Re-Fetch on Portal
  const manifest = fs.readFileSync(path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
  assert.match(manifest, /android:configChanges="[^"]*\bkeyboard\b[^"]*"/, "AndroidManifest must handle keyboard configChanges without recreating Activity");
  assert.match(mainAct, /detectExternalKeyboard/, "MainActivity must detect connected external keyboards");
  assert.match(mainAct, /isPhysicalKeyboardDevice/, "MainActivity must detect physical keyboards including USB/BT dongles via hasTypingKeys");
  assert.match(mainAct, /InputDeviceListener/, "MainActivity must react dynamically to external keyboard connect/disconnect");
  assert.match(mainAct, /onCreateInputConnection/, "MainActivity WebView must block soft IME InputConnection when external keyboard is connected");
  assert.match(mainAct, /onCheckIsTextEditor/, "MainActivity WebView must return false from onCheckIsTextEditor when external keyboard is connected");
  assert.match(mainAct, /FLAG_ALT_FOCUSABLE_IM/, "MainActivity must set FLAG_ALT_FOCUSABLE_IM when external keyboard is connected");
  assert.match(mainAct, /WindowInsets\.Type\.ime\(\)/, "MainActivity must hide IME via WindowInsetsController on Android 11+");
  assert.match(mainAct, /SOFT_INPUT_STATE_ALWAYS_HIDDEN/, "MainActivity must suppress soft keyboard when external keyboard is connected");
  assert.match(mainAct, /injectExternalKeyboardGuard/, "MainActivity must inject inputmode=none guard into WebView");
  assert.match(mainAct, /HTMLElement\.prototype\.focus/, "MainActivity guard must apply inputmode=none synchronously before focus()");
  assert.match(mainAct, /public boolean hasExternalKeyboard\(\)/, "CloudGSTNative must expose hasExternalKeyboard()");
  assert.match(mainAct, /public void hideSoftKeyboard\(\)/, "CloudGSTNative must expose hideSoftKeyboard()");
  assert.match(portalJs, /let gpLastFetchKey\s*=\s*null;/, "portal-module must track gpLastFetchKey for Spacebar next Fetch/Re-Fetch");
  assert.match(portalJs, /function gpTriggerNextFetchBySpace\(\)/, "portal-module must define gpTriggerNextFetchBySpace()");
  assert.match(portalJs, /e\.code !== "Space"/, "portal-module must bind Space keydown shortcut on Portal");

  // v6.1.0: Phone Mode GSTR-1 JSON Upload + APK-only hides PC/Cloud options while Web App keeps them
  assert.match(phoneFetch, /public void startUploadGstr1\(/, "PhoneFetch must implement startUploadGstr1()");
  assert.match(phoneFetch, /buildUploadTickScript/, "PhoneFetch must implement buildUploadTickScript() for GSTR-1 PREPARE OFFLINE");
  assert.match(phoneFetch, /PREPARE\\\\s\+OFFLINE/, "PhoneFetch upload script must target GSTR-1 PREPARE OFFLINE");
  assert.match(phoneFetch, /DataTransfer/, "PhoneFetch upload script must attach JSON file via DataTransfer");
  assert.match(mainAct, /public String phoneUploadGstr1Slot\(/, "CloudGSTNative must expose phoneUploadGstr1Slot()");
  assert.match(mainAct, /public boolean phoneUploadInit\(/, "CloudGSTNative must expose chunked phoneUploadInit()");
  assert.match(mainAct, /public boolean phoneUploadAppend\(/, "CloudGSTNative must expose chunked phoneUploadAppend()");
  assert.match(portalJs, /function gpPhoneUploadGstr1\(/, "portal-module must implement gpPhoneUploadGstr1()");
  assert.match(portalJs, /if \(!gpPhoneAvailable\(\)\) gpBridgeHealth\(6000\);/, "APK must not ping Cloud Bridge on startup");
  assert.match(portalJs, /if \(!isApk\) return;/, "Web App must keep PC/Cloud options visible while APK hides them");

  // v6.2.0: Android Share Sheet (ACTION_SEND / ACTION_SEND_MULTIPLE) -> Client Document OR Etsy CSV (Master + Doc)
  assert.match(manifest, /android\.intent\.action\.SEND"/, "AndroidManifest must accept ACTION_SEND shares");
  assert.match(manifest, /android\.intent\.action\.SEND_MULTIPLE"/, "AndroidManifest must accept ACTION_SEND_MULTIPLE shares");
  assert.match(manifest, /android:launchMode="singleTask"/, "MainActivity should use singleTask for clean incoming share handling");
  assert.match(mainAct, /captureSharedIntent/, "MainActivity must capture incoming shared files");
  assert.match(mainAct, /public String getPendingShareMeta\(\)/, "CloudGSTNative must expose getPendingShareMeta()");
  assert.match(mainAct, /public String getPendingShareChunk\(/, "CloudGSTNative must expose chunked getPendingShareChunk()");
  assert.match(mainAct, /public void clearPendingShare\(\)/, "CloudGSTNative must expose clearPendingShare()");
  const etsyJs = fs.readFileSync(path.join(WEB_DIR, "js", "etsy-parser.js"), "utf8");
  assert.match(etsyJs, /window\.cloudGstHandleSharedFiles\s*=/, "etsy-parser must register window.cloudGstHandleSharedFiles");
  assert.match(etsyJs, /shareInboxModalOverlay/, "etsy-parser must render shareInboxModalOverlay");
  assert.match(etsyJs, /shareInboxDocBtn/, "Share inbox modal must provide Client Document Upload option");
  assert.match(etsyJs, /shareInboxEtsyBtn/, "Share inbox modal must provide Etsy CSV (Master + Doc) upload option");
  assert.match(etsyJs, /shareInboxAddClientBtn/, "Share inbox modal must provide Add New Client from GST Paper option");
  assert.match(etsyJs, /runShareAddNewClient/, "Share inbox must parse shared GST PDF and open pre-filled Add Client modal");
  const trackerSyncJs = fs.readFileSync(path.join(WEB_DIR, "js", "tracker-and-sync.js"), "utf8");
  assert.match(trackerSyncJs, /__cloudGstPendingNewClientDocs/, "Adding a client from shared GST paper must also upload the paper to Drive Documents");
});
