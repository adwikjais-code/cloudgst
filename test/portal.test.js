/* Portal flow tests — asli portal/browser ke bina, ek nakli (mock) page par.
 * Yahan wahi case test hota hai jo production me aaya tha:
 *   "GSTR-2B fetch issue: page.waitForSelector: Timeout 25000ms exceeded"
 *   "Menu me 'TDS and TCS credit received' link nahi mila"
 * Dono ka matlab tha: Returns Dashboard hi nahi khula.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  openReturnsDashboardAndSearch, selectDropdownByText, dismissModals, classifyStuckPage,
  guessSelectIndex, quarterAliases, monthAliases,
  RETURNS_DASHBOARD_URL, GST_AUTH_DASHBOARD_URL
} = require("../server.js");

/* ------------------------------- mock page ------------------------------- */
// Asli portal jaisa: FY / Quarter / Month ke <select>, options jo der se bharte hain,
// aur select karne par "change" event.
const DEFAULT_SELECTS = () => ([
  { i: 0, name: "fy", options: ["2024-25", "2025-26", "2026-27"] },
  { i: 1, name: "quarter", options: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"] },
  { i: 2, name: "mon", options: ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"] }
]);

function makePage(opts = {}) {
  const state = {
    url: opts.url || "https://services.gst.gov.in/services/auth/dashboard",
    hasSelect: opts.hasSelect !== false,
    title: opts.title || "GST Portal",
    text: opts.text || "",
    buttons: opts.buttons || [],
    gotos: [],
    clicked: [],
    picked: [],
    evaluates: 0,
    selects: opts.selects || DEFAULT_SELECTS(),
    selectsAfter: opts.selectsAfter || null,
    fillAfter: opts.fillAfter || 0, // itne evaluate ke baad options bhar jate hain (AJAX)
    gotoPlan: opts.gotoPlan || [],
    popupOnClick: !!opts.popupOnClick,
    pages: []
  };

  const newPage = () => ({
    url: () => RETURNS_DASHBOARD_URL,
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    waitForSelector: async () => ({}),
    evaluate: async (fn) => (fn.toString().includes("dispatchEvent")
      ? { matched: true, name: "fy", option: "2026-27" }
      : { url: RETURNS_DASHBOARD_URL, title: "Returns Dashboard", selects: 3, visibleSelects: 3, text: "", buttons: [] }),
    locator: () => ({ first: () => ({ count: async () => 1, isVisible: async () => false, click: async () => {} }), count: async () => 1 })
  });

  const page = {
    url: () => state.url,
    context: () => ({ pages: () => [page, ...state.pages] }),
    keyboard: { press: async () => {} },
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
    waitForSelector: async (sel, o) => {
      if (!state.hasSelect) throw new Error(`page.waitForSelector: Timeout ${(o && o.timeout) || 30000}ms exceeded.`);
      return {};
    },
    goto: async (url) => {
      state.gotos.push(url);
      const next = state.gotoPlan.length ? state.gotoPlan.shift() : { hasSelect: true };
      state.url = url;
      state.hasSelect = !!next.hasSelect;
      if (next.hasSelect === "throw") throw new Error("net::ERR_FAILED");
    },
    evaluate: async (fn, arg) => {
      const src = fn.toString();
      state.evaluates++;
      if (src.includes("document.title")) {
        return { url: state.url, title: state.title, selects: state.hasSelect ? 3 : 0, visibleSelects: state.hasSelect ? 3 : 0, text: state.text, buttons: state.buttons };
      }
      if (src.includes("options: Array.from(s.options)")) {
        return state.selects.map(x => ({ i: x.i, name: x.name, options: (x.options || []).slice(0, 15) }));
      }
      if (src.includes("dispatchEvent")) {
        // AJAX: kuch evaluate ke baad options bhar jate hain
        if (state.selectsAfter && !state.filled && state.evaluates > state.fillAfter) {
          state.selects = state.selectsAfter;
          state.filled = true;
        }
        const pool = arg.index >= 0 ? [state.selects[arg.index]].filter(Boolean) : state.selects;
        for (const sel of pool) {
          for (const want of arg.texts) {
            const hit = (sel.options || []).find(o => o.toLowerCase().includes(want));
            if (hit) {
              sel.value = hit;
              state.picked.push({ name: sel.name, option: hit });
              return { matched: true, name: sel.name, option: hit, tryNo: arg.tryNo };
            }
          }
        }
        return { matched: false, tryNo: arg.tryNo, seen: pool.map(x => (x.options || []).slice(0, 6)) };
      }
      return undefined;
    },
    locator: (sel) => ({
      first: () => ({
        count: async () => 1,
        isVisible: async () => (/RETURN DASHBOARD/i.test(sel) ? opts.retBtn !== false : false),
        click: async () => {
          state.clicked.push(sel);
          if (/RETURN DASHBOARD/i.test(sel)) {
            if (state.popupOnClick && !state.pages.length) state.pages.push(newPage());
            else if (opts.clickNavigates) { state.url = RETURNS_DASHBOARD_URL; state.hasSelect = true; }
          }
        }
      }),
      count: async () => 1
    }),
    _state: state
  };
  return page;
}

/* -------------------------------- tests --------------------------------- */
test("openReturnsDashboardAndSearch: happy path — dropdowns mile, period select + SEARCH", async () => {
  const page = makePage({ url: RETURNS_DASHBOARD_URL, hasSelect: true });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.equal(dbg.steps.gstr2b_dashboard.fyRes.matched, true);
  assert.equal(dbg.steps.gstr2b_dashboard.fyRes.option, "2026-27");
  assert.deepEqual(dbg.steps.gstr2b_dashboard.mRes.option, "October"); // app ko month name se select hota hai
  assert.ok(page._state.clicked.some(s => /SEARCH/.test(s)), "SEARCH button nahi dabaya");
});

test("openReturnsDashboardAndSearch: dashboard na khule to seedha URL par retry (production wala case)", async () => {
  // click karte hain par page auth dashboard par hi rehta hai (selects nahi) -> retry se ban jata hai
  const page = makePage({ hasSelect: false, clickNavigates: false, gotoPlan: [{ hasSelect: true }] });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.deepEqual(page._state.gotos, [RETURNS_DASHBOARD_URL], "retry me returns dashboard URL nahi khola");
  assert.ok(dbg.steps.gstr2b_selectTimeoutAt, "pehla timeout debug me record nahi hua");
  assert.ok(dbg.steps.gstr2b_dashboard, "retry ke baad dashboard step nahi mila");
});

test("openReturnsDashboardAndSearch: popup tab khule to usi page par kaam karta hai", async () => {
  const page = makePage({ hasSelect: false, popupOnClick: true });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.notEqual(out, page, "naya popup page adopt nahi hua");
  assert.equal(dbg.steps.gstr2b_adoptedPopup, RETURNS_DASHBOARD_URL);
});

test("openReturnsDashboardAndSearch: samajh na aaye wala page -> asli page ka diagnostic error", async () => {
  const page = makePage({ hasSelect: false, clickNavigates: false, gotoPlan: [{ hasSelect: false }], title: "Kuch Aur Page" });
  page._state.text = "maintenance chal raha hai";
  page._state.buttons = ["PROCEED", "LOGIN"];
  const dbg = { steps: {} };
  await assert.rejects(
    () => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /Returns Dashboard access nahi mila/);
      assert.match(err.message, /Kuch Aur Page/, "page title error me nahi aaya");
      assert.match(err.message, /gstr2b_stuck/, "debug key ka hint nahi aaya");
      return true;
    }
  );
  assert.equal(dbg.steps.gstr2b_stuck.title, "Kuch Aur Page");
  assert.equal(dbg.steps.gstr2b_stuck.visibleSelects, 0);
  assert.match(dbg.steps.gstr2b_stuck.text, /maintenance/);
});

// ---- production wala asli case: portal ne /services/error/accessdenied diya ----
test("openReturnsDashboardAndSearch: Access Denied par Auth Dashboard se retry karke nikal jata hai", async () => {
  const page = makePage({
    hasSelect: false, clickNavigates: false, title: "Goods & Services Tax (GST) | Access Denied",
    gotoPlan: [{ hasSelect: false }, { hasSelect: true }] // pehla goto bhi denied, doosra (auth dash) theek
  });
  page._state.url = "https://services.gst.gov.in/services/error/accessdenied";
  page._state.text = "Access Denied";
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.deepEqual(page._state.gotos, [RETURNS_DASHBOARD_URL, GST_AUTH_DASHBOARD_URL], "retry ka rasta galat");
  assert.equal(dbg.steps.gstr2b_stuck.kind, "access_denied");
  assert.ok(dbg.steps.gstr2b_dashboardAfterBlockRetry, "retry ke baad success debug me nahi hai");
});

test("openReturnsDashboardAndSearch: Access Denied bana rahe to saaf, actionable error", async () => {
  const page = makePage({
    hasSelect: false, clickNavigates: false, title: "Goods & Services Tax (GST) | Access Denied",
    gotoPlan: [{ hasSelect: false }, { hasSelect: false }]
  });
  page._state.url = "https://services.gst.gov.in/services/error/accessdenied";
  page._state.text = "Access Denied";
  const dbg = { steps: {} };
  await assert.rejects(
    () => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /Access Denied/i);
      assert.match(err.message, /Aakhri page: https:\/\//); // asli page ka URL error me hona chahiye
      assert.match(err.message, /logout|logged\s*in|WAF/i, "user ke liye hint nahi aaya");
      assert.match(err.message, /gstr2b_stuck/);
      return true;
    }
  );
  assert.equal(dbg.steps.gstr2b_stuck2.kind, "access_denied");
});

/* ---------------------------- classifyStuckPage ---------------------------- */
test("classifyStuckPage: portal ke alag-alag block pages pehchanta hai", () => {
  assert.equal(classifyStuckPage({ url: "https://services.gst.gov.in/services/error/accessdenied" }).kind, "access_denied");
  assert.equal(classifyStuckPage({ title: "GST | Access Denied" }).kind, "access_denied");
  assert.equal(classifyStuckPage({ text: "You are already logged in from another device" }).kind, "concurrent_session");
  assert.equal(classifyStuckPage({ text: "Your GSTIN is suspended" }).kind, "gstin_inactive");
  assert.equal(classifyStuckPage({ text: "Your session has expired, please login again" }).kind, "session_expired");
  assert.equal(classifyStuckPage({ text: "kuch bhi" }).kind, "unknown");
  assert.equal(classifyStuckPage(null).kind, "unknown");
  // har kind ka user-facing hint hona chahiye
  ["access_denied", "concurrent_session", "gstin_inactive", "session_expired", "unknown"].forEach(k => {
    assert.ok(classifyStuckPage({ text: k === "access_denied" ? "Access Denied" : k === "gstin_inactive" ? "suspended" : k === "session_expired" ? "session expired" : k === "concurrent_session" ? "already logged in" : "x" }).hint.length > 10);
  });
});

test("openReturnsDashboardAndSearch: period select na ho to wahi purana saaf error (galat period ka data na uthe)", async () => {
  const page = makePage({ url: RETURNS_DASHBOARD_URL, hasSelect: true });
  // month "13" par getMonthName khaali deta hai -> selectDropdownByText {matched:false}
  const dbg = { steps: {} };
  await assert.rejects(() => openReturnsDashboardAndSearch(page, "2026-27", "13", dbg, "gstr2b"),
    /period select nahi ho paya/);
  assert.ok(dbg.steps.gstr2b_periodSelectFail);
});

test("selectDropdownByText: khaali text par kuch bhi select nahi karta", async () => {
  const page = makePage({ hasSelect: true });
  assert.deepEqual(await selectDropdownByText(page, ""), { matched: false, reason: "empty" });
  assert.deepEqual(await selectDropdownByText(page, null), { matched: false, reason: "empty" });
  assert.equal((await selectDropdownByText(page, "October")).matched, true);
});

test("dismissModals: page par close/OK buttons na ho to bhi crash nahi", async () => {
  const page = makePage({});
  await assert.doesNotReject(() => dismissModals(page));
});

/* ------------------- dropdown label/polling wale real cases ------------------- */
test("period select: quarter ka label 'Q3' aur month 'Oct-2026' ho to bhi chal jata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [
      { i: 0, name: "fy", options: ["2025-26", "2026-27"] },
      { i: 1, name: "quarter", options: ["Q1", "Q2", "Q3", "Q4"] },
      { i: 2, name: "mon", options: ["Apr-2026", "May-2026", "Jun-2026", "Jul-2026", "Aug-2026", "Sep-2026", "Oct-2026", "Nov-2026", "Dec-2026"] }
    ]
  });
  const dbg = { steps: {} };
  await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.deepEqual(dbg.steps.gstr2b_dashboard.qRes.option, "Q3");
  assert.deepEqual(dbg.steps.gstr2b_dashboard.mRes.option, "Oct-2026");
});

test("period select: quarter dropdown hi na ho to month se kaam chal jata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [
      { i: 0, name: "fy", options: ["2025-26", "2026-27"] },
      { i: 1, name: "mon", options: ["April", "May", "June", "July", "August", "September", "October", "November", "December"] }
    ]
  });
  const dbg = { steps: {} };
  await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(dbg.steps.gstr2b_dashboard.fyRes.matched, true);
  assert.equal(dbg.steps.gstr2b_dashboard.mRes.option, "October");
  assert.equal(dbg.steps.gstr2b_quarterSkipped.reason, "no-quarter-select");
});

test("period select: options der se aate hain (password change ke baad wala case) -> polling/retry se ban jata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [{ i: 0, name: "fy", options: [] }, { i: 1, name: "quarter", options: [] }, { i: 2, name: "mon", options: [] }],
    selectsAfter: DEFAULT_SELECTS(),
    fillAfter: 3 // pehle 3 evaluate tak kuch nahi, uske baad options aa jate hain
  });
  const dbg = { steps: {} };
  await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(dbg.steps.gstr2b_dashboard.mRes.option, "October");
  assert.ok(page._state.picked.some(p => p.name === "mon" && p.option === "October"));
});

test("period select: month hi na mile to error me dropdown ke asli options aate hain", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [
      { i: 0, name: "fy", options: ["2025-26", "2026-27"] },
      { i: 1, name: "quarter", options: ["Quarter 1", "Quarter 2", "Quarter 3"] },
      { i: 2, name: "mon", options: ["April", "May", "June", "July", "August", "September"] }
    ]
  });
  const dbg = { steps: {} };
  await assert.rejects(() => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /period select nahi ho paya/);
      assert.match(err.message, /MONTH:false/i);
      assert.match(err.message, /mon:/);
      assert.match(err.message, /April/);
      return true;
    });
  assert.ok(dbg.steps.gstr2b_periodSelectFail.selects.length >= 2);
});

/* ------------------------------ aliases/guessers ---------------------------- */
test("guessSelectIndex: naam se, ya naam na ho to options dekh kar pehchanta hai", () => {
  const named = [
    { i: 0, name: "fy", options: ["2026-27"] },
    { i: 1, name: "quarter", options: ["Q3"] },
    { i: 2, name: "mon", options: ["October"] }
  ];
  assert.equal(guessSelectIndex(named, "fy"), 0);
  assert.equal(guessSelectIndex(named, "quarter"), 1);
  assert.equal(guessSelectIndex(named, "month"), 2);

  const unnamed = [
    { i: 0, name: "", options: ["2024-25", "2025-26"] },
    { i: 1, name: "", options: ["Quarter 1", "Quarter 2"] },
    { i: 2, name: "", options: ["April", "May", "June", "July"] }
  ];
  assert.equal(guessSelectIndex(unnamed, "fy"), 0);
  assert.equal(guessSelectIndex(unnamed, "quarter"), 1);
  assert.equal(guessSelectIndex(unnamed, "month"), 2);
  assert.equal(guessSelectIndex([], "month"), -1);
});

test("quarterAliases / monthAliases: portal ke label variants cover hote hain (aur 'Oct' galti se quarter na bane)", () => {
  assert.ok(quarterAliases("10").includes("Quarter 3"));
  assert.ok(quarterAliases("10").includes("Q3"));
  assert.ok(quarterAliases("10").some(a => /oct\s*-\s*dec/i.test(a)));
  assert.ok(quarterAliases("02").includes("Q4"));

  const mA = monthAliases("10", "2026-27");
  assert.ok(mA.includes("October"));
  assert.ok(mA.includes("Oct-2026"));
  assert.ok(!mA.includes("Oct"), "bare 'Oct' quarter ke 'Oct - Dec' se match ho jata — nahi hona chahiye");
  assert.ok(monthAliases("02", "2026-27").includes("Feb-2027")); // Jan-Mar next year
  assert.deepEqual(monthAliases("13", "2026-27"), []);
});
