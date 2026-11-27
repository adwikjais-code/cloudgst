const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const GS_PATH = path.join(__dirname, "..", "APPS_SCRIPT_AppSync.gs");

function createGasContext(initialProps = {}, sheetMap = {}) {
  const propsStore = { ...initialProps };

  function makeRange(sheetObj, row1, col1, numRows, numCols) {
    return {
      getDisplayValues() {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const row = [];
          for (let c = 0; c < numCols; c++) {
            const val = (sheetObj.rows[row1 - 1 + r] && sheetObj.rows[row1 - 1 + r][col1 - 1 + c]);
            row.push(val === undefined || val === null ? "" : String(val));
          }
          out.push(row);
        }
        return out;
      },
      getValues() {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const row = [];
          for (let c = 0; c < numCols; c++) {
            const val = (sheetObj.rows[row1 - 1 + r] && sheetObj.rows[row1 - 1 + r][col1 - 1 + c]);
            row.push(val === undefined ? "" : val);
          }
          out.push(row);
        }
        return out;
      },
      setValues(vals) {
        for (let r = 0; r < vals.length; r++) {
          const idx = row1 - 1 + r;
          if (!sheetObj.rows[idx]) sheetObj.rows[idx] = [];
          for (let c = 0; c < vals[r].length; c++) {
            sheetObj.rows[idx][col1 - 1 + c] = vals[r][c];
          }
        }
        return this;
      },
      setValue(v) { return this.setValues([[v]]); },
      clearContent() {
        for (let r = 0; r < numRows; r++) {
          const idx = row1 - 1 + r;
          if (!sheetObj.rows[idx]) continue;
          for (let c = 0; c < numCols; c++) sheetObj.rows[idx][col1 - 1 + c] = "";
        }
        return this;
      },
      setFontWeight() { return this; },
      setBackground() { return this; },
      setFontColor() { return this; },
      setNumberFormat() { return this; },
      getDataValidations() { return []; },
      insertCheckboxes() { return this; },
      getFormula() { return ""; },
      getFormulas() { return [[]]; }
    };
  }

  function makeSheet(name, initialRows = [[]]) {
    const sheetObj = { name, rows: initialRows.map(r => [...r]), hidden: false };
    return {
      _raw: sheetObj,
      getName: () => name,
      getLastRow: () => sheetObj.rows.length,
      getLastColumn: () => sheetObj.rows.reduce((m, r) => Math.max(m, r.length), 0),
      getRange: (r, c, nr = 1, nc = 1) => makeRange(sheetObj, r, c, nr, nc),
      getDataRange: () => makeRange(sheetObj, 1, 1, Math.max(1, sheetObj.rows.length), Math.max(1, sheetObj.rows.reduce((m, r) => Math.max(m, r.length), 0))),
      hideSheet() { sheetObj.hidden = true; },
      setFrozenRows() {}
    };
  }

  const sheets = {};
  for (const [name, rows] of Object.entries(sheetMap)) {
    sheets[name] = makeSheet(name, rows);
  }

  const ss = {
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => { sheets[name] = makeSheet(name, []); return sheets[name]; },
    getSpreadsheetTimeZone: () => "Asia/Kolkata"
  };

  const ctx = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    decodeURIComponent,
    encodeURIComponent,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => Object.prototype.hasOwnProperty.call(propsStore, k) ? propsStore[k] : null,
        setProperty: (k, v) => { propsStore[k] = String(v); },
        deleteProperty: (k) => { delete propsStore[k]; }
      })
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush() {},
      DataValidationCriteria: { CHECKBOX: "CHECKBOX" }
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (txt) => ({
        _txt: txt,
        setMimeType() { return this; },
        getContent() { return this._txt; }
      })
    },
    Session: { getScriptTimeZone: () => "Asia/Kolkata" },
    Utilities: {
      formatDate: (_d, _tz, _fmt) => "20261127-000000"
    },
    DriveApp: {
      getFolderById: () => ({ getName: () => "Clients", getFolders: () => ({ hasNext: () => false }), getFiles: () => ({ hasNext: () => false }) })
    },
    _props: propsStore,
    _sheets: sheets
  };

  const src = fs.readFileSync(GS_PATH, "utf8");
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "APPS_SCRIPT_AppSync.gs" });
  return ctx;
}

test("APPS_SCRIPT: enforces SYNC_SECRET when configured and defaults APP_PIN to empty", () => {
  const ctxOpen = createGasContext({}, { "PAID CLINTS": [["Sr. No.", "Client", "ID", "GST No."]], "Apne": [["Sr. No.", "Client"]] });
  const openRes = JSON.parse(ctxOpen.doGet({ parameter: {} }).getContent());
  assert.equal(openRes.status, "ok");
  assert.equal(openRes.hasSyncSecret, false);
  assert.equal(openRes.appPin, "", "APP_PIN must default to empty, never '123456'");

  const ctxAuth = createGasContext(
    { SYNC_SECRET: "super-secret-xyz" },
    { "PAID CLINTS": [["Sr. No.", "Client", "ID", "GST No."]], "Apne": [["Sr. No.", "Client"]] }
  );
  const deniedGet = JSON.parse(ctxAuth.doGet({ parameter: {} }).getContent());
  assert.equal(deniedGet.status, "error");
  assert.equal(deniedGet.code, "unauthorized");

  const okGet = JSON.parse(ctxAuth.doGet({ parameter: { syncSecret: "super-secret-xyz" } }).getContent());
  assert.equal(okGet.status, "ok");
  assert.equal(okGet.hasSyncSecret, true);

  const deniedPost = JSON.parse(ctxAuth.doPost({ postData: { contents: JSON.stringify({ action: "savePin", pin: "556677" }) } }).getContent());
  assert.equal(deniedPost.status, "error");
  assert.equal(deniedPost.code, "unauthorized");

  const okPost = JSON.parse(ctxAuth.doPost({ postData: { contents: JSON.stringify({ syncSecret: "super-secret-xyz", action: "savePin", pin: "556677" }) } }).getContent());
  assert.equal(okPost.status, "ok");
  assert.equal(ctxAuth._props.APP_PIN, "556677");
});

test("APPS_SCRIPT: doGet blocks state-mutating actions while allowing read-only sync actions", () => {
  const ctx = createGasContext({});
  assert.equal(ctx.isSafeGetAction_("getAllRov"), true);
  assert.equal(ctx.isSafeGetAction_("getEtsyMasterUrl"), true);
  assert.equal(ctx.isSafeGetAction_("listGstr1Json"), true);
  assert.equal(ctx.isSafeGetAction_("readGstr1Json"), true);
  assert.equal(ctx.isSafeGetAction_("saveClients"), false);
  assert.equal(ctx.isSafeGetAction_("saveFeeData"), false);
  assert.equal(ctx.isSafeGetAction_("sendDeviceOtp"), false);
  assert.equal(ctx.isSafeGetAction_("verifyDeviceOtp"), false);

  const blocked = JSON.parse(ctx.doGet({
    parameter: { payload: encodeURIComponent(JSON.stringify({ action: "saveFeeData", ledger: [] })) }
  }).getContent());
  assert.equal(blocked.status, "error");
  assert.equal(blocked.code, "method_not_allowed");
});

test("APPS_SCRIPT: getTabCols tracks GSTR2B_Status in maxCol", () => {
  const ctx = createGasContext({}, {
    "PAID CLINTS": [["Sr. No.", "Client", "ID", "GST No.", "GSTR2B_IGST", "GSTR2B_Status"]]
  });
  const cols = ctx.getTabCols(ctx._sheets["PAID CLINTS"]);
  assert.equal(cols.gstr2bIgst, 5);
  assert.equal(cols.gstr2bStatus, 6);
  assert.ok(cols.maxCol >= 23);
});

test("APPS_SCRIPT: saveFeeData merges stale revisions and honors deleted receipt tombstones", () => {
  const ctx = createGasContext({});
  const ss = ctx.SpreadsheetApp.getActiveSpreadsheet();

  const r1 = ctx.saveFeeData(ss, {
    baseRevision: 0,
    ledger: [
      { receiptNo: "RCP-1", clientKey: "C1", client: "ALPHA", amount: 500, date: "01/11/2026" },
      { receiptNo: "RCP-2", clientKey: "C2", client: "BETA", amount: 800, date: "02/11/2026" }
    ],
    profiles: { C1: { activeDueMon: 0 }, C2: { activeDueMon: 0 } },
    customFees: { C1: 500 },
    rates: { apne: 0 }
  });
  assert.equal(r1.status, "ok");
  assert.equal(r1.revision, 1);
  assert.equal(r1.merged, false);

  // Device B deletes RCP-1 on baseRevision=1 -> revision 2
  const r2 = ctx.saveFeeData(ss, {
    baseRevision: 1,
    deletedReceipts: ["RCP-1"],
    ledger: [{ receiptNo: "RCP-2", clientKey: "C2", client: "BETA", amount: 800, date: "02/11/2026" }],
    profiles: { C1: { activeDueMon: 1 }, C2: { activeDueMon: 0 } },
    customFees: { C1: 500 },
    rates: { apne: 0 }
  });
  assert.equal(r2.revision, 2);
  assert.deepEqual(Array.from(r2.deletedReceipts), ["RCP-1"]);

  // Device A syncs stale revision=0 still carrying RCP-1 plus a new RCP-3 -> merged without resurrecting RCP-1!
  const r3 = ctx.saveFeeData(ss, {
    baseRevision: 0,
    ledger: [
      { receiptNo: "RCP-1", clientKey: "C1", client: "ALPHA", amount: 500, date: "01/11/2026" },
      { receiptNo: "RCP-3", clientKey: "C3", client: "GAMMA", amount: 1200, date: "03/11/2026" }
    ],
    profiles: { C3: { activeDueMon: 0 } },
    customFees: { C3: 1200 },
    rates: { apne: 0 }
  });
  assert.equal(r3.status, "ok");
  assert.equal(r3.merged, true);
  assert.equal(r3.revision, 3);
  const savedNos = Array.from(ctx.readFeeData(ss).ledger.map(x => String(x.receiptNo))).sort();
  assert.deepStrictEqual(savedNos, ["RCP-2", "RCP-3"]);
});
