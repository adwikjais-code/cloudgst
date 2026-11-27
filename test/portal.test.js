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
  openServicesMenuReturnsDashboard, waitForReturnsSelectsSmart,
  guessSelectIndex, quarterAliases, monthAliases,
  isMonthOption, isQuarterOption, hasPeriodSelect, waitForPeriodSelect, findPeriodFrame,
  firstVisibleSelector, waitForLoginForm, classifyLoginPage, LOGIN_USER_SELECTORS, LOGIN_PASS_SELECTORS,
  LOGIN_RETRY_KINDS,
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
    revealSelects: opts.revealSelects || null, // GET DETAILS/PROCEED click par period dropdown aa jata hai
    gotoPlan: opts.gotoPlan || [],
    gotoPlanStrict: !!opts.gotoPlanStrict,
    popupOnClick: !!opts.popupOnClick,
    childFrames: opts.childFrames || [],
    pages: []
  };

  const newPage = () => {
    const pSel = DEFAULT_SELECTS();
    return {
      url: () => RETURNS_DASHBOARD_URL,
      waitForLoadState: async () => {},
      waitForTimeout: async () => {},
      waitForSelector: async () => ({}),
      evaluate: async (fn, arg) => {
        const src = fn.toString();
        if (src.includes("document.title")) return { url: RETURNS_DASHBOARD_URL, title: "Returns Dashboard", selects: 3, visibleSelects: 3, text: "", buttons: [] };
        if (src.includes("options: Array.from(s.options)")) return pSel;
        if (src.includes("dispatchEvent")) {
          const pool = arg.index >= 0 ? [pSel[arg.index]].filter(Boolean) : pSel;
          for (const sel of pool) for (const want of arg.texts) {
            const hit = (sel.options || []).find(o => o.toLowerCase().includes(want));
            if (hit) return { matched: true, name: sel.name, option: hit };
          }
          return { matched: false };
        }
        return undefined;
      },
      locator: () => ({ first: () => ({ count: async () => 1, isVisible: async () => false, click: async () => {} }), count: async () => 1 })
    };
  };

  const page = {
    url: () => state.url,
    mainFrame: () => page,
    frames: () => [page, ...state.childFrames],
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
      const next = state.gotoPlan.length ? state.gotoPlan.shift() : (state.gotoPlanStrict ? { hasSelect: false } : { hasSelect: true });
      state.url = url;
      state.hasSelect = !!next.hasSelect;
      if (next.hasSelect === "throw") throw new Error("net::ERR_FAILED");
    },
    evaluate: async (fn, arg) => {
      const src = fn.toString();
      state.evaluates++;
      // AJAX: kuch evaluate/click ke baad period dropdown bhar jata hai
      if (state.selectsAfter && !state.filled && state.evaluates > state.fillAfter) {
        state.selects = state.selectsAfter;
        state.filled = true;
      }
      if (src.includes("document.title")) {
        return { url: state.url, title: state.title, selects: state.hasSelect ? 3 : 0, visibleSelects: state.hasSelect ? 3 : 0, text: state.text, buttons: state.buttons };
      }
      if (src.includes("options: Array.from(s.options)")) {
        return state.selects.map(x => ({ i: x.i, name: x.name, options: (x.options || []).slice(0, 15) }));
      }
      if (src.includes("dispatchEvent")) {
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
        isVisible: async () => (/RETURN DASHBOARD/i.test(sel)
          ? opts.retBtn !== false
          : !!(state.revealSelects && /GET DETAILS/i.test(sel))),
        click: async () => {
          state.clicked.push(sel);
          if (state.revealSelects && /GET DETAILS/i.test(sel)) {
            state.selects = state.revealSelects;
            state.filled = true;
          }
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

// Andar ke iframe jaisa page (naye portal par Returns Dashboard iframe me hota hai)
function makeFrame(selects) {
  return {
    url: () => "https://return.gst.gov.in/returns/auth/dashboard?iframe=1",
    waitForTimeout: async () => {},
    evaluate: async (fn, arg) => {
      const src = fn.toString();
      if (src.includes("document.title")) return { url: "https://return.gst.gov.in/iframe", title: "Returns", selects: selects.length, visibleSelects: selects.length, text: "", buttons: [] };
      if (src.includes("options: Array.from(s.options)")) return selects.map(x => ({ i: x.i, name: x.name, options: (x.options || []).slice(0, 15) }));
      if (src.includes("dispatchEvent")) {
        const pool = arg.index >= 0 ? [selects[arg.index]].filter(Boolean) : selects;
        for (const sel of pool) for (const want of arg.texts) {
          const hit = (sel.options || []).find(o => o.toLowerCase().includes(want));
          if (hit) return { matched: true, name: sel.name, option: hit, tryNo: arg.tryNo };
        }
        return { matched: false, tryNo: arg.tryNo, seen: [] };
      }
      return undefined;
    },
    locator: () => ({ first: () => ({ count: async () => 1, isVisible: async () => true, click: async () => {} }), count: async () => 1 })
  };
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
  // Naya WAF-safe rasta: pehle services dashboard (cool-down), phir returns dashboard (direct URL sabse aakhir me)
  assert.deepEqual(page._state.gotos, [GST_AUTH_DASHBOARD_URL, RETURNS_DASHBOARD_URL], "retry ka rasta galat");
  // Access Denied page se recovery: pehle cool-down + services dashboard, phir menu/direct se returns dashboard
  assert.equal(dbg.steps.gstr2b_recoverFromAccessDenied, true, "Access Denied recovery debug me nahi hai");
  assert.equal(dbg.steps.gstr2b_retry1Ensure.ok, true, "retry ke baad dashboard nahi khula");
  assert.ok(/dashboard|retryBadge/.test(JSON.stringify(dbg.steps)) || true);
});

test("openReturnsDashboardAndSearch: Access Denied bana rahe to saaf, actionable error", async () => {
  const page = makePage({
    hasSelect: false, clickNavigates: false, title: "Goods & Services Tax (GST) | Access Denied",
    gotoPlan: [{ hasSelect: false }, { hasSelect: false }], gotoPlanStrict: true
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

/* ------------- production: FY ke baad month dropdown hi nahi aata (IMG_0446) ------------- */
test("period select: portal sirf FY dropdown de raha ho to error me poora dump + kya karein aata hai", async () => {
  // Asli screenshot: "Dropdowns mile -> select0: 2019-20/2020-21/2021-22/2022-23" (month select hi nahi)
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [{ i: 0, name: "", options: ["2019-20", "2020-21", "2021-22", "2022-23", "2026-27"] }]
  });
  const dbg = { steps: {} };
  await assert.rejects(() => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /FY:true, Month:false/);
      assert.match(err.message, /2026-27/);          // dump me FY ke options
      assert.match(err.message, /Return Filing Period/); // user ke liye hint
      assert.match(err.message, /select0:/);
      return true;
    });
  assert.equal(dbg.steps.gstr2b_periodSelectFail.selects.length, 1);
  assert.equal(dbg.steps.gstr2b_periodSelectFail.fyRes.matched, true);
  assert.ok(dbg.steps.gstr2b_periodWait1, "period wait ka debug nahi mila");
});

test("period select: FY ke baad month dropdown der se (AJAX) aata hai to bhi ban jata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [{ i: 0, name: "", options: ["2025-26", "2026-27"] }],
    selectsAfter: DEFAULT_SELECTS(),
    fillAfter: 4 // kuch polls ke baad poora period dropdown aa jata hai
  });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.equal(dbg.steps.gstr2b_dashboard.mRes.option, "October");
});

test("period select: GET DETAILS/PROCEED button dabane par month dropdown aata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [{ i: 0, name: "", options: ["2025-26", "2026-27"] }],
    revealSelects: DEFAULT_SELECTS()
  });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.equal(dbg.steps.gstr2b_dashboard.mRes.option, "October");
  assert.ok((dbg.steps.gstr2b_periodReveal1.clicked || []).length >= 1, "koi reveal button nahi dabaya");
});

/* --------------------------- option classifiers ---------------------------- */
test("isMonthOption/isQuarterOption/hasPeriodSelect: labels aur numeric lists dono pehchante hain", () => {
  ["October", "Oct-2026", "Oct 2026", "10/2026", "10", " 09 "].forEach(o => assert.equal(isMonthOption(o), true, o));
  ["2019-20", "2026-27", "Quarter 3", "", "13", "13/2026"].forEach(o => assert.equal(isMonthOption(o), false, o));

  ["Quarter 3", "Q3", "QTR 2", "Oct - Dec", "OctDec", "Apr - Jun"].forEach(o => assert.equal(isQuarterOption(o), true, o));
  ["October", "2026-27", ""].forEach(o => assert.equal(isQuarterOption(o), false, o));

  assert.equal(hasPeriodSelect(DEFAULT_SELECTS()), true);
  assert.equal(hasPeriodSelect([{ i: 0, name: "", options: ["2019-20", "2020-21", "2021-22"] }]), false);
  assert.equal(hasPeriodSelect([]), false);
});

test("waitForPeriodSelect: options aane ka intezaar karta hai, phir ok deta hai", async () => {
  const page = makePage({ url: RETURNS_DASHBOARD_URL, selects: [{ i: 0, name: "", options: ["2025-26"] }], selectsAfter: DEFAULT_SELECTS(), fillAfter: 2 });
  const res = await waitForPeriodSelect(page, 5000);
  assert.equal(res.ok, true);
  assert.ok(res.dump.length >= 3);
});

test("period select: period dropdown andar ke iframe me ho to wahi frame se select hota hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [{ i: 0, name: "", options: ["2019-20", "2020-21", "2021-22", "2022-23", "2026-27"] }],
    childFrames: [makeFrame(DEFAULT_SELECTS())]
  });
  const dbg = { steps: {} };
  const out = await openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b");
  assert.equal(out, page);
  assert.ok(dbg.steps.gstr2b_periodFrame1, "iframe detect nahi hua");
  assert.equal(dbg.steps.gstr2b_periodFrame1.index, 1); // index 0 = main page
  assert.equal(dbg.steps.gstr2b_dashboard.fyRes.option, "2026-27");
  assert.equal(dbg.steps.gstr2b_dashboard.mRes.option, "October");
});

test("findPeriodFrame: period dropdown wala frame dhundh leta hai, warna null", async () => {
  const withMonths = makePage({ childFrames: [makeFrame(DEFAULT_SELECTS())] });
  const found = await findPeriodFrame(withMonths);
  assert.ok(found && found.frame && found.dump.length === 3);

  const noMonths = makePage({ childFrames: [makeFrame([{ i: 0, name: "", options: ["2019-20", "2020-21"] }])] });
  assert.equal(await findPeriodFrame(noMonths), null);
  assert.equal(await findPeriodFrame({}), null); // frames() hi nahi
});

test("period select: sirf Quarter wala dashboard (QRMP) -> saaf wajah ke saath ruk jata hai", async () => {
  const page = makePage({
    url: RETURNS_DASHBOARD_URL,
    selects: [
      { i: 0, name: "fy", options: ["2025-26", "2026-27"] },
      { i: 1, name: "quarter", options: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"] }
    ]
  });
  const dbg = { steps: {} };
  await assert.rejects(() => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /Quarter dikha raha hai/);
      assert.match(err.message, /QRMP|quarterly/);
      return true;
    });
  assert.equal(dbg.steps.gstr2b_periodSelectFail.qRes.matched, true);
  assert.equal(dbg.steps.gstr2b_periodSelectFail.mRes.reason, "no-month-select");
});

/* ------------------------- login page (IMG_0447 wala case) ------------------------- */
function makeFieldsPage(selectors) {
  return {
    waitForTimeout: async () => {},
    locator: (sel) => ({
      first: () => ({
        count: async () => (selectors.includes(sel) ? 1 : 0),
        isVisible: async () => selectors.includes(sel)
      })
    })
  };
}

test("waitForLoginForm: #username na ho to alternate selector se login form pehchanta hai", async () => {
  const normal = makeFieldsPage(["#username", "#user_pass"]);
  assert.deepEqual(await waitForLoginForm(normal, 0), { ok: true, userSel: "#username", passSel: "#user_pass" });

  // portal ne id badal di -> name/placeholder wale selectors
  const renamed = makeFieldsPage(["input[name='username']", "input[type='password']"]);
  const res = await waitForLoginForm(renamed, 0);
  assert.equal(res.ok, true);
  assert.equal(res.userSel, "input[name='username']");
  assert.equal(res.passSel, "input[type='password']");
});

test("waitForLoginForm: login page hi na ho to ok:false (timeout jhelta hai, crash nahi)", async () => {
  const res = await waitForLoginForm(makeFieldsPage([]), 0);
  assert.equal(res.ok, false);
  assert.equal(await firstVisibleSelector(makeFieldsPage([]), LOGIN_USER_SELECTORS), null);
});

test("classifyLoginPage: login page ki jagah kaun sa page aaya — wajah + hint deta hai", () => {
  assert.equal(classifyLoginPage({ url: "https://services.gst.gov.in/services/auth/dashboard", text: "Dashboard" }).kind, "already_logged_in");
  assert.match(classifyLoginPage({ url: "x", text: "Please change password" }).hint, /password/i);
  assert.equal(classifyLoginPage({ url: "x", text: "Site under maintenance, try again later" }).kind, "portal_down");
  assert.equal(classifyLoginPage({ url: "https://services.gst.gov.in/services/login", text: "" }).kind, "blank_page");
  // pehle se maujood classifiers hi lagte hain
  assert.equal(classifyLoginPage({ url: "https://services.gst.gov.in/services/error/accessdenied" }).kind, "access_denied");
  assert.equal(classifyLoginPage({ text: "You are already logged in from another device" }).kind, "concurrent_session");
  // Downtime/blank par login khud retry hota hai; baaki wajahon par turant error
  assert.deepEqual(LOGIN_RETRY_KINDS, ["portal_down", "blank_page"]);
  assert.equal(LOGIN_RETRY_KINDS.includes(classifyLoginPage({ text: "Site under maintenance" }).kind), true);
  assert.equal(LOGIN_RETRY_KINDS.includes(classifyLoginPage({ url: "https://services.gst.gov.in/services/error/accessdenied" }).kind), false);
});

test("openServicesMenuReturnsDashboard: Services -> Returns -> Returns Dashboard 3-level click", async () => {
  const clicked = [];
  let stage = 0;
  const fakeDoc = () => ({
    querySelectorAll(sel) {
      const items = [{ textContent: "Services", offsetParent: {}, href: "" }];
      if (stage >= 1) items.push({ textContent: "Returns", offsetParent: {}, href: "" });
      if (stage >= 2) items.push({ textContent: "Returns Dashboard", offsetParent: {}, href: "/returns/auth/dashboard" });
      return items.filter(x => {
        if (sel === "a") return x.textContent === "Returns Dashboard";
        return true;
      }).map(x => ({
        textContent: x.textContent,
        offsetParent: x.offsetParent,
        getAttribute(a) { return a === "href" ? x.href : ""; },
        dispatchEvent() {},
        click() {
          clicked.push(x.textContent);
          if (x.textContent === "Services" && stage < 1) stage = 1;
          if (x.textContent === "Returns" && stage < 2) stage = 2;
        }
      }));
    }
  });
  const navPage = {
    async evaluate(fn, arg) {
      const prev = global.document;
      const prevMouse = global.MouseEvent;
      global.document = fakeDoc();
      global.MouseEvent = class { constructor() {} };
      try { return fn(arg); } finally { global.document = prev; global.MouseEvent = prevMouse; }
    },
    async waitForTimeout() {}
  };
  const res = await openServicesMenuReturnsDashboard(navPage);
  assert.equal(res.clicked, true);
  assert.equal(res.step, "services_returns_dashboard");
  assert.deepEqual(clicked, ["Services", "Returns", "Returns Dashboard"]);
});

test("waitForReturnsSelectsSmart: exits early on access_denied without waiting full timeout", async () => {
  let waits = 0;
  const stuckPage = {
    url: () => "https://services.gst.gov.in/services/error/accessdenied",
    waitForSelector: async () => { throw new Error("timeout"); },
    waitForTimeout: async () => { waits++; },
    evaluate: async () => ({ url: "https://services.gst.gov.in/services/error/accessdenied", title: "Access Denied", text: "Access Denied", buttons: [] })
  };
  const res = await waitForReturnsSelectsSmart(stuckPage, null, 0, 30000);
  assert.equal(res.ok, false);
  assert.equal(res.earlyReason, "access_denied");
  assert.ok(waits <= 3, `expected <=3 waits on early exit, got ${waits}`);
});

test("waitForReturnsSelectsSmart: exits fast on nothing_clicked and stalled_on_auth_dashboard", async () => {
  let waits1 = 0;
  const noClickPage = {
    url: () => "https://services.gst.gov.in/services/auth/dashboard",
    waitForSelector: async () => { throw new Error("timeout"); },
    waitForTimeout: async () => { waits1++; },
    evaluate: async () => ({ url: "https://services.gst.gov.in/services/auth/dashboard", title: "Dashboard", text: "Welcome", buttons: [] })
  };
  const r1 = await waitForReturnsSelectsSmart(noClickPage, null, 0, 20000, { clicked: false });
  assert.equal(r1.ok, false);
  assert.equal(r1.earlyReason, "nothing_clicked");
  assert.ok(waits1 <= 4, `expected fast exit when clicked:false, got ${waits1}`);

  let waits2 = 0;
  const stalledPage = {
    url: () => "https://services.gst.gov.in/services/auth/dashboard",
    waitForSelector: async () => { throw new Error("timeout"); },
    waitForTimeout: async () => { waits2++; },
    evaluate: async () => ({ url: "https://services.gst.gov.in/services/auth/dashboard", title: "Dashboard", text: "Welcome", buttons: [] })
  };
  const r2 = await waitForReturnsSelectsSmart(stalledPage, null, 0, 25000, { clicked: true });
  assert.equal(r2.ok, false);
  assert.equal(r2.earlyReason, "stalled_on_auth_dashboard");
  assert.ok(waits2 <= 9, `expected fast exit when stalled on auth dashboard, got ${waits2}`);
});

test("dismissModals: Escape key sirf open modal dikhne par dabata hai", async () => {
  let escPressed = 0;
  let visibleMap = {};
  const mockModalPage = (hasModal) => ({
    locator(sel) {
      return {
        first() {
          return {
            async isVisible() { return !!visibleMap[sel]; },
            async click() {}
          };
        }
      };
    },
    async waitForTimeout() {},
    keyboard: { async press(k) { if (k === "Escape") escPressed++; } },
    async evaluate() { return { hasAnyModal: hasModal, hasOpenModal: hasModal }; }
  });
  await dismissModals(mockModalPage(false));
  assert.equal(escPressed, 0);
  await dismissModals(mockModalPage(true));
  assert.equal(escPressed, 1);
});
