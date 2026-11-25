/* HTTP layer tests: server ko asli process ki tarah chala kar endpoints check karte hain.
 * Playwright browser sandbox me nahi hai, isliye portal wale flows sirf "graceful error" tak test hote hain.
 * Run: npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

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
