/* Portal flow tests — asli portal/browser ke bina, ek nakli (mock) page par.
 * Yahan wahi case test hota hai jo production me aaya tha:
 *   "GSTR-2B fetch issue: page.waitForSelector: Timeout 25000ms exceeded"
 *   "Menu me 'TDS and TCS credit received' link nahi mila"
 * Dono ka matlab tha: Returns Dashboard hi nahi khula.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  openReturnsDashboardAndSearch, selectDropdownByText, dismissModals, RETURNS_DASHBOARD_URL
} = require("../server.js");

/* ------------------------------- mock page ------------------------------- */
function makePage(opts = {}) {
  const state = {
    url: opts.url || "https://services.gst.gov.in/services/auth/dashboard",
    hasSelect: !!opts.hasSelect,
    title: opts.title || "GST Portal",
    gotos: [],
    clicked: [],
    gotoPlan: opts.gotoPlan || [], // [{hasSelect:true}, ...] — goto ke baad kya milega
    popupOnClick: !!opts.popupOnClick,
    pages: []
  };

  const newPage = (hasSelect) => ({
    url: () => RETURNS_DASHBOARD_URL,
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    waitForSelector: async () => { if (!hasSelect) throw new Error("timeout"); return {}; },
    evaluate: async (fn, arg) => (fn.toString().includes("dispatchEvent")
      ? { matched: true, name: "select", option: String(arg) }
      : { url: RETURNS_DASHBOARD_URL, title: "Returns Dashboard", selects: 3, visibleSelects: 3, text: "", buttons: [] }),
    locator: () => ({
      first: () => ({ isVisible: async () => false, count: async () => 1, click: async () => {} }),
      count: async () => 1
    })
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
      if (src.includes("dispatchEvent")) return { matched: true, name: "select", option: String(arg) };
      if (src.includes("document.title")) {
        return { url: state.url, title: state.title, selects: state.hasSelect ? 3 : 0, visibleSelects: state.hasSelect ? 3 : 0, text: state.text || "", buttons: state.buttons || [] };
      }
      return undefined;
    },
    locator: (sel) => ({
      first: () => ({
        count: async () => 1,
        isVisible: async () => /RETURN DASHBOARD/i.test(sel) ? (opts.retBtn !== false) : false,
        click: async () => {
          state.clicked.push(sel);
          if (/RETURN DASHBOARD/i.test(sel)) {
            if (state.popupOnClick && !state.pages.length) state.pages.push(newPage(true)); // naya tab
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
  assert.deepEqual(dbg.steps.gstr2b_dashboard.fyRes, { matched: true, name: "select", option: "2026-27" });
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

test("openReturnsDashboardAndSearch: dono koshish fail -> asli page ka diagnostic error", async () => {
  const page = makePage({ hasSelect: false, clickNavigates: false, gotoPlan: [{ hasSelect: false }], title: "Session Expired" });
  page._state.text = "You are already logged in from another device";
  page._state.buttons = ["PROCEED", "LOGIN"];
  const dbg = { steps: {} };
  await assert.rejects(
    () => openReturnsDashboardAndSearch(page, "2026-27", "10", dbg, "gstr2b"),
    (err) => {
      assert.match(err.message, /Returns Dashboard khul hi nahi paya/);
      assert.match(err.message, /Session Expired/, "page title error me nahi aaya");
      assert.match(err.message, /PROCEED/, "visible buttons error me nahi aaye");
      assert.match(err.message, /gstr2b_stuck/, "debug key ka hint nahi aaya");
      return true;
    }
  );
  assert.equal(dbg.steps.gstr2b_stuck.title, "Session Expired");
  assert.equal(dbg.steps.gstr2b_stuck.visibleSelects, 0);
  assert.match(dbg.steps.gstr2b_stuck.text, /already logged in/);
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
