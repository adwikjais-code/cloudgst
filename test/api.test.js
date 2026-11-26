/* HTTP layer tests: server ko asli process ki tarah chala kar endpoints check karte hain.
 * Playwright browser sandbox me nahi hai, isliye portal wale flows sirf "graceful error" tak test hote hain.
 * Run: npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { isGstr2bNotGenerated, isGstr2bNotGeneratedFast, gstr2bPageSaysNotGenerated, gstr2bPageSaysSessionExpired, isTcsEmpty, waitForBodyMatch, isReturnsDashboardUrl, partialOutcome } = require("../server.js");

const ROOT = path.join(__dirname, "..");
const SECRET = "test-secret-123";

function waitForHealth(base, tries = 100) {
  return new Promise((resolve, reject) => {
    const tick = async (n) => {
      try {
        const r = await fetch(base + "/health");
        if (r.ok) return resolve();
      } catch (_) {}
      if (n <= 0) return reject(new Error("server start nahi hua"));
      setTimeout(() => tick(n - 1), 100);
    };
    tick(tries);
  });
}

async function withServer(env, fn) {
  const port = 3900 + Math.floor(Math.random() * 80);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", d => { log += d; });
  child.stderr.on("data", d => { log += d; });
  const base = "http://127.0.0.1:" + port;
  try {
    await waitForHealth(base);
    await fn(base, () => log);
  } finally {
    child.kill("SIGKILL");
  }
}

const auth = (extra = {}) => ({ headers: { "x-api-secret": SECRET, "content-type": "application/json" }, ...extra });

test("public endpoints: /health bina secret khulta hai", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/health");
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.service, "gst-cloud-bridge");
    assert.equal(j.secretConfigured, true);
    assert.ok(j.version);
    assert.equal(j.activeSessions, 0);
  });
});

test("auth: secret ke bina / bina header / galat header par 401", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    assert.equal((await fetch(base + "/api/gst/ping")).status, 401);
    assert.equal((await fetch(base + "/api/gst/ping", { headers: { "x-api-secret": "galat" } })).status, 401);
    assert.equal((await fetch(base + "/debug")).status, 401);
    assert.equal((await fetch(base + "/api/gst/logout", { method: "POST" })).status, 401);
  });
});

test("auth: sahi secret par ping/debug/logout chalte hain", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const ping = await fetch(base + "/api/gst/ping", auth());
    assert.equal(ping.status, 200);
    assert.deepEqual(Object.keys(await ping.json()).includes("ok"), true);

    const dbg = await fetch(base + "/debug", auth());
    assert.equal(dbg.status, 200);
    JSON.parse(await dbg.text()); // valid JSON hona chahiye

    const out = await fetch(base + "/api/gst/logout", auth({ method: "POST", body: JSON.stringify({ sessionId: "nahi-hai" }) }));
    assert.equal(out.status, 200);
    assert.deepEqual(await out.json(), { ok: true });
  });
});

test("auth: secret set nahi hai aur ALLOW_NO_SECRET=1 hai to khula", async () => {
  await withServer({ API_SECRET: "", ALLOW_NO_SECRET: "1" }, async (base) => {
    assert.equal((await fetch(base + "/api/gst/ping")).status, 200);
  });
});

test("auth: secret set nahi hai to sab band (fail-closed, 503)", async () => {
  await withServer({ API_SECRET: "", ALLOW_NO_SECRET: "" }, async (base) => {
    const r = await fetch(base + "/api/gst/ping");
    assert.equal(r.status, 503);
    assert.equal((await r.json()).ok, false);
    assert.equal((await fetch(base + "/health")).status, 200); // health phir bhi zinda
  });
});

test("CORS: allowed origin ko header milta hai, anjaan origin ko nahi", async () => {
  await withServer({ API_SECRET: SECRET, ALLOWED_ORIGIN: "https://adwikjais-code.github.io" }, async (base) => {
    const ok = await fetch(base + "/api/gst/ping", auth({ headers: { "x-api-secret": SECRET, origin: "https://adwikjais-code.github.io" } }));
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://adwikjais-code.github.io");

    const bad = await fetch(base + "/api/gst/ping", auth({ headers: { "x-api-secret": SECRET, origin: "https://evil.example.com" } }));
    assert.equal(bad.headers.get("access-control-allow-origin"), null);

    const pre = await fetch(base + "/api/gst/fetch-all", {
      method: "OPTIONS",
      headers: { origin: "https://adwikjais-code.github.io", "access-control-request-method": "POST", "access-control-request-headers": "x-api-secret" }
    });
    assert.ok(pre.status === 204 || pre.status === 200);
    assert.equal(pre.headers.get("access-control-allow-origin"), "https://adwikjais-code.github.io");
  });
});

test("CORS: workers.dev origin bhi allowed hai", async () => {
  await withServer({ API_SECRET: SECRET, ALLOWED_ORIGIN: "https://adwikjais-code.github.io" }, async (base) => {
    const r = await fetch(base + "/api/gst/ping", auth({ headers: { "x-api-secret": SECRET, origin: "https://my-proxy.username.workers.dev" } }));
    assert.equal(r.headers.get("access-control-allow-origin"), "https://my-proxy.username.workers.dev");
  });
});

test("fetch-all: session ke bina 401 (0 data save na ho)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/fetch-all", auth({ method: "POST", body: JSON.stringify({ sessionId: "xyz", fy: "2026-27", month: "10" }) }));
    assert.equal(r.status, 401);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.match(j.error, /connect|login/i);
  });
});

test("fetch-all: sessionId hi na ho to bhi 401, crash nahi", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/fetch-all", auth({ method: "POST", body: JSON.stringify({}) }));
    assert.equal(r.status, 401);
  });
});

test("fetch-status: anjaan session par JSON 404 (HTML nahi), progress leak nahi", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/fetch-status?sessionId=nahi-hai", auth());
    assert.equal(r.status, 404);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.match(j.error, /session/i);
  });
});

test("fetch-status: secret ke bina 401", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/fetch-status?sessionId=x");
    assert.equal(r.status, 401);
  });
});

test("upload-gstr1: session/submit checks", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    // session ke bina -> 401
    let r = await fetch(base + "/api/gst/upload-gstr1", auth({ method: "POST", body: JSON.stringify({ sessionId: "no", jsonContent: "{}" }) }));
    assert.equal(r.status, 401);
    // body hi na ho -> 401/400 (crash nahi, JSON error)
    r = await fetch(base + "/api/gst/upload-gstr1", auth({ method: "POST", body: "{}" }));
    assert.ok([400, 401].includes(r.status));
    assert.equal((await r.json()).ok, false);
  });
});

test("init-login: browser na hone par bhi JSON error (hang nahi)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/init-login", auth({ method: "POST", body: JSON.stringify({ username: "test" }), signal: AbortSignal.timeout(60000) }));
    assert.equal(r.status, 500);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.ok(typeof j.error === "string" && j.error.length > 0);
  });
});

test("galat JSON body par saaf 4xx (server crash nahi)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/fetch-all", { method: "POST", headers: { "x-api-secret": SECRET, "content-type": "application/json" }, body: "{not json" });
    assert.ok(r.status >= 400 && r.status < 500, "status: " + r.status);
    // server zinda hai?
    assert.equal((await fetch(base + "/health")).status, 200);
  });
});

test("unknown route par JSON 404 (HTML nahi)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const r = await fetch(base + "/api/gst/kuch-bhi", auth());
    assert.equal(r.status, 404);
    const ct = r.headers.get("content-type") || "";
    assert.match(ct, /json/);
    assert.equal((await r.json()).ok, false);
  });
});

test("input validation: galat month/FY par 400 (portal par galat period ka fetch na jaye)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    let r = await fetch(base + "/api/gst/fetch-all", auth({ method: "POST", body: JSON.stringify({ sessionId: "s", fy: "2026-27", month: "13" }) }));
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /Month/i);

    r = await fetch(base + "/api/gst/fetch-all", auth({ method: "POST", body: JSON.stringify({ sessionId: "s", fy: "2026", month: "10" }) }));
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /FY/i);

    r = await fetch(base + "/api/gst/upload-gstr1", auth({ method: "POST", body: JSON.stringify({ sessionId: "s", fy: "2026-27", month: "0", jsonContent: "{}" }) }));
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /Month/i);
  });
});

test("body 25MB se bada ho to JSON error (HTML nahi)", async () => {
  await withServer({ API_SECRET: SECRET }, async (base) => {
    const big = "x".repeat(26 * 1024 * 1024);
    const r = await fetch(base + "/api/gst/upload-gstr1", {
      method: "POST", headers: { "x-api-secret": SECRET, "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s", jsonContent: big })
    });
    assert.ok(r.status >= 400 && r.status < 500, "status: " + r.status);
    assert.match(r.headers.get("content-type") || "", /json/);
    assert.equal((await r.json()).ok, false);
    assert.equal((await fetch(base + "/health")).status, 200); // server zinda
  });
});

/* ---------- GSTR-2B "not generated" detection (portal ka error page) ---------- */
test("gstr2b not-generated: portal ke asli messages pakadta hai", () => {
  const samples = [
    "Error! GSTR-2B could not be generated by the System. Kindly compute your GSTR 2B manually",
    "System will not generate GSTR 2B for the current return period in any one of the following circumstances",
    "There are no records to generate GSTR 2B for the current return period",
    "GSTR-2B has not been generated for this period"
  ];
  for (const s of samples) assert.equal(isGstr2bNotGenerated(s), true, s);
});

test("gstr2b not-generated: normal text par false (false positive nahi)", () => {
  const samples = [
    "GSTR-2B Summary",
    "DOWNLOAD GSTR-2B JSON",
    "GSTR-2B generated successfully",
    "",
    null,
    undefined
  ];
  for (const s of samples) assert.equal(isGstr2bNotGenerated(s), false, String(s));
});

test("gstr2b not-generated: screenshot wala exact wording (multiline body)", () => {
  const body = [
    "GSTIN - 09AJLPA7426Q1ZM",
    "Financial Year - 2026-27",
    "Return Period - October",
    "Error!",
    "GSTR-2B could not be generated by the System. Kindly compute your GSTR 2B manually by clicking Compute",
    "GSTR-2B button available at IMS Dashboard",
    "Attention: System will not generate GSTR 2B for the current return period in any one of the following",
    "circumstances:",
    "i. There are no records to generate GSTR 2B for the current return period",
    "Or",
    "ii. GSTR 3B of last return period is not filed till GSTR 2B generation date of current return period"
  ].join("\n");
  assert.equal(isGstr2bNotGenerated(body), true);
});

/* ---------- FAST result: jaldi mil jaye to turant wapas, na mile to bhi der na kare ---------- */
test("waitForBodyMatch: text turant mil jaye to foran return (poora timeout nahi)", async () => {
  let waits = 0;
  const fakePage = {
    locator: () => ({ innerText: async () => "GSTR-2B could not be generated by the System" }),
    waitForTimeout: async () => { waits++; }
  };
  const out = await waitForBodyMatch(fakePage, /could not be generated/i, 4000, 700);
  assert.ok(out && /could not be generated/.test(out));
  assert.equal(waits, 0, "match mil gaya to ek bhi extra wait nahi hona chahiye");
});

test("waitForBodyMatch: kuch na mile to timeout ke baad null (crash nahi)", async () => {
  let waits = 0;
  const fakePage = {
    locator: () => ({ innerText: async () => "Loading…" }),
    waitForTimeout: async () => { waits++; await new Promise(r => setTimeout(r, 5)); }
  };
  const out = await waitForBodyMatch(fakePage, /never-appears/, 60, 10);
  assert.equal(out, null);
  assert.ok(waits >= 2, "kai baar check hona chahiye");
});

test("isTcsEmpty: 'no records / no data' pakadta hai, normal data par false", () => {
  assert.equal(isTcsEmpty("No records found for the selected period"), true);
  assert.equal(isTcsEmpty("No data available"), true);
  assert.equal(isTcsEmpty("Taxpayer does not have any record for this period"), true);
  assert.equal(isTcsEmpty("TCS Credit Received - Summary"), false);
  assert.equal(isTcsEmpty(""), false);
  assert.equal(isTcsEmpty(null), false);
});

test("isGstr2bNotGeneratedFast: sirf pakki lines (normal page ke disclaimer par false)", () => {
  assert.equal(isGstr2bNotGeneratedFast("Error! GSTR-2B could not be generated by the System"), true);
  assert.equal(isGstr2bNotGeneratedFast("There are no records to generate GSTR 2B for the current return period"), true);
  // broad regex inhe pakadti hai, par polling me turant rukna nahi chahiye
  assert.equal(isGstr2bNotGeneratedFast("Note: system will not generate GSTR 2B if 3B is pending"), false);
  assert.equal(isGstr2bNotGeneratedFast("GSTR-2B has not been generated"), false);
  assert.equal(isGstr2bNotGeneratedFast(""), false);
});

/* ---------- 2B: GENERATE JSON button na mile (error page) -> turant "not generated" ---------- */
test("gstr2bPageSaysNotGenerated: screenshot wala error page = true", () => {
  const body = "Error!\nGSTR-2B could not be generated by the System. Kindly compute your GSTR 2B manually";
  assert.equal(gstr2bPageSaysNotGenerated(body), true);
});

test("gstr2bPageSaysNotGenerated: broad line + 'Attention' = true", () => {
  const body = "Attention: System will not generate GSTR 2B for the current return period";
  assert.equal(gstr2bPageSaysNotGenerated(body), true);
});

test("gstr2bPageSaysNotGenerated: normal page (disclaimer bina Error) = false", () => {
  assert.equal(gstr2bPageSaysNotGenerated("Note: system will not generate GSTR 2B if 3B is pending"), false);
  assert.equal(gstr2bPageSaysNotGenerated("GSTR-2B Summary\nDOWNLOAD"), false);
  assert.equal(gstr2bPageSaysNotGenerated(""), false);
});

test("gstr2bPageSaysSessionExpired: expired/login-again pakadta hai", () => {
  assert.equal(gstr2bPageSaysSessionExpired("Your session has expired. Please login again"), true);
  assert.equal(gstr2bPageSaysSessionExpired("Session timed out"), true);
  assert.equal(gstr2bPageSaysSessionExpired("GSTR-2B Summary"), false);
});

/* ---------- 2B generate app KABHI nahi dabata (regression guard) ---------- */
test("2B: generate click hai par 90s wait nahi (10s cap, turant error detect)", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.equal(/90000/.test(src), false, "2B ke liye 90s wait nahi hona chahiye");
  assert.ok(/GENERATE JSON/.test(src), "portal ka GENERATE JSON button dabana chahiye");
  assert.ok(/Date\.now\(\) - started < 10000/.test(src), "generate ke baad max 10s ka intezaar hona chahiye");
  assert.ok(/setGstr2bNotGenerated/.test(src), "not-generated path hona chahiye");
});

/* ---------- Returns dashboard page detection (TCS/2B dono isi par depend karte hain) ---------- */
test("isReturnsDashboardUrl: returns dashboard vs user dashboard", () => {
  assert.equal(isReturnsDashboardUrl("https://services.gst.gov.in/services/returns/auth/dashboard"), true);
  assert.equal(isReturnsDashboardUrl("https://services.gst.gov.in/services/returns/auth/dashboard?fy=2026-27"), true);
  assert.equal(isReturnsDashboardUrl("https://services.gst.gov.in/services/auth/dashboard"), false);
  assert.equal(isReturnsDashboardUrl("https://gstr2b.gst.gov.in/gstr2b/auth/gstr2b"), false);
  assert.equal(isReturnsDashboardUrl(""), false);
  assert.equal(isReturnsDashboardUrl(null), false);
});

/* ---------- naya portal wording (26-Nov screenshots) ---------- */
test("2B: 'Either there is no record ... or ... is not generated by system' bhi pakadta hai", () => {
  const body = "Error! Either there is no record for GSTR 2B or GSTR 2B for current return period is not generated by system (due to non-filing GSTR 3B of last return period till GSTR 2B cut-off date of current return period), kindly go to IMS dashboard, and compute your GSTR 2B manually.";
  assert.equal(isGstr2bNotGenerated(body), true);
  assert.equal(isGstr2bNotGeneratedFast(body), true);
  assert.equal(gstr2bPageSaysNotGenerated(body), true);
});

test("2B: normal offline-download page (GENERATE JSON buttons) par false", () => {
  const body = "Offline Download for GSTR-2B\nHelp\nFORM GSTR-2B has been generated on the basis of the information furnished by the suppliers\nGENERATE JSON FILE TO DOWNLOAD\nGENERATE EXCEL FILE TO DOWNLOAD";
  assert.equal(isGstr2bNotGenerated(body), false);
  assert.equal(gstr2bPageSaysNotGenerated(body), false);
});

/* ---------- 2B "not generated" error nahi hai ---------- */
test("partialOutcome: gstr2b not_generated ko failure nahi ginta (sheet save hota rahe)", () => {
  const st = {
    gstr2b: { state: "not_generated", code: "gstr2b_not_generated", message: "is month generate nahi hui" },
    tcs: { state: "ok", message: "1 ECO row mili." }
  };
  const out = partialOutcome(st, { gstr2b: true, tcs: true });
  assert.equal(out.allFailed, false);
  assert.equal(out.partial, null);
  assert.deepEqual(out.failed, []);

  // sirf 2B maanga aur generate nahi hui -> phir bhi ok
  const only2b = partialOutcome({ gstr2b: st.gstr2b }, { gstr2b: true });
  assert.equal(only2b.allFailed, false);

  // asli failure (navigation/portal issue) ab bhi failure rahe
  const realFail = partialOutcome({ gstr2b: { state: "failed", message: "portal error" } }, { gstr2b: true });
  assert.equal(realFail.allFailed, true);
});
