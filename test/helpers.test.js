/* Pure-helper tests: server.js ke saare parsing / period / file-name helpers.
 * Ye tests browser ke bina chalte hain (koi network, koi Playwright nahi).
 * Run: npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  periodFor, getMonthName, getQuarterForMonth, parseAmt, buildColumnLabels,
  mapTcsColumns, parseTcsTables, parseTcsRecordCount, parseNoticeTables,
  summarizeGstr2B, safeFileName, readJsonFilesFromBuffer, buildB2bSellers,
  normalizePeriod, partialOutcome, ERR_TEXT_RE, OK_TEXT_RE
} = require("../server.js");

const cell = (t, cs = 1, rs = 1) => ({ t, cs, rs });
const row = (...t) => t.map(c => cell(String(c)));

/* ------------------------------- periodFor ------------------------------- */
test("periodFor: FY ke andar Apr-Dec = same year, Jan-Mar = next year", () => {
  assert.equal(periodFor("2026-27", "10"), "102026");
  assert.equal(periodFor("2026-27", "04"), "042026");
  assert.equal(periodFor("2026-27", "12"), "122026");
  assert.equal(periodFor("2026-27", "01"), "012027");
  assert.equal(periodFor("2026-27", "03"), "032027");
  assert.equal(periodFor("2026-2027", "04"), "042026"); // 4-digit FY bhi chale
});

test("periodFor: khaali/galat input par khaali string (galat period kabhi na bane)", () => {
  assert.equal(periodFor("", "10"), "");
  assert.equal(periodFor("2026-27", ""), "");
  assert.equal(periodFor(null, "10"), "");
  assert.equal(periodFor("2026-27", "0"), "");
});

test("periodFor: 1-12 se bahar ka month reject hona chahiye", () => {
  // "13" / "00" jaise month par portal ka koi period nahi hota
  assert.equal(periodFor("2026-27", "13"), "");
  assert.equal(periodFor("2026-27", "00"), "");
});

/* ------------------------------ month/quarter ---------------------------- */
test("getMonthName: 1..12", () => {
  const all = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  all.forEach((name, i) => assert.equal(getMonthName(String(i + 1).padStart(2, "0")), name));
});

test("getMonthName: galat month par khaali string (chupchaap 'October' nahi)", () => {
  // Agar yahan October aaya to 13/99 month par client ka data October ka chala jayega.
  assert.equal(getMonthName("13"), "");
  assert.equal(getMonthName("00"), "");
  assert.equal(getMonthName("99"), "");
  assert.equal(getMonthName(""), "");
  assert.equal(getMonthName(null), "");
});

test("getQuarterForMonth: Apr-Jun Q1, Jul-Sep Q2, Oct-Dec Q3, Jan-Mar Q4", () => {
  assert.equal(getQuarterForMonth("04"), "Quarter 1");
  assert.equal(getQuarterForMonth("06"), "Quarter 1");
  assert.equal(getQuarterForMonth("07"), "Quarter 2");
  assert.equal(getQuarterForMonth("09"), "Quarter 2");
  assert.equal(getQuarterForMonth("10"), "Quarter 3");
  assert.equal(getQuarterForMonth("12"), "Quarter 3");
  assert.equal(getQuarterForMonth("01"), "Quarter 4");
  assert.equal(getQuarterForMonth("03"), "Quarter 4");
});

test("getQuarterForMonth: galat month par khaali (Q4 nahi)", () => {
  assert.equal(getQuarterForMonth("0"), "");
  assert.equal(getQuarterForMonth("13"), "");
});

/* -------------------------------- parseAmt ------------------------------- */
test("parseAmt: portal ke real amount formats", () => {
  assert.equal(parseAmt("1,25,000.00"), 125000);
  assert.equal(parseAmt("₹ 500"), 500);
  assert.equal(parseAmt("₹1,234.56"), 1234.56);
  assert.equal(parseAmt("(250.50)"), -250.5);
  assert.equal(parseAmt("( 250 )"), -250);
  assert.equal(parseAmt("-10"), -10);
  assert.equal(parseAmt("0.00"), 0);
  assert.equal(parseAmt("0"), 0);
  assert.equal(parseAmt("12"), 12);
  assert.equal(parseAmt("1 234.50"), 1234.5); // space thousand separator
});

test("parseAmt: number jaisa dikhne wala GSTIN / date / text NaN ho", () => {
  assert.ok(Number.isNaN(parseAmt("07AAACD1234A1Z5")));
  assert.ok(Number.isNaN(parseAmt("Oct-2026")));
  assert.ok(Number.isNaN(parseAmt("01-10-2026")));
  assert.ok(Number.isNaN(parseAmt("102026")) === false); // 6-digit period khud number hai — caller filter karta hai
  assert.ok(Number.isNaN(parseAmt("")));
  assert.ok(Number.isNaN(parseAmt(null)));
  assert.ok(Number.isNaN(parseAmt(undefined)));
  assert.ok(Number.isNaN(parseAmt("abc")));
  assert.ok(Number.isNaN(parseAmt("1.2.3")));
});

/* ---------------------------- buildColumnLabels -------------------------- */
test("buildColumnLabels: single-row header", () => {
  const labels = buildColumnLabels([row("GSTIN/UIN", "Trade Name", "Gross Taxable Value")]);
  assert.deepEqual(labels, ["gstin/uin", "trade name", "gross taxable value"]);
});

test("buildColumnLabels: rowspan + colspan (grouped header) sahi phailta hai", () => {
  const head = [
    [cell("GSTIN/UIN of E-Commerce Operator", 1, 2), cell("Trade/Legal Name", 1, 2), cell("Taxable Value", 3, 1), cell("Tax Amount", 3, 1)],
    [cell("Gross"), cell("Returned"), cell("Net"), cell("Integrated Tax"), cell("Central Tax"), cell("State/UT Tax")]
  ];
  const labels = buildColumnLabels(head);
  assert.equal(labels.length, 8);
  assert.equal(labels[0], "gstin/uin of e-commerce operator");
  assert.equal(labels[1], "trade/legal name");
  assert.equal(labels[2], "taxable value gross");
  assert.equal(labels[3], "taxable value returned");
  assert.equal(labels[4], "taxable value net");
  assert.equal(labels[5], "tax amount integrated tax");
  assert.equal(labels[7], "tax amount state/ut tax");
});

test("buildColumnLabels: khaali/missing thead crash na kare", () => {
  assert.deepEqual(buildColumnLabels([]), []);
  assert.deepEqual(buildColumnLabels(undefined), []);
  assert.deepEqual(buildColumnLabels(null), []);
});

/* ----------------------------- mapTcsColumns ----------------------------- */
test("mapTcsColumns: real TCS summary header ke saare 9 column milte hain", () => {
  const labels = buildColumnLabels([
    [cell("GSTIN/UIN of E-Commerce Operator", 1, 2), cell("Trade/Legal Name", 1, 2), cell("Taxable Value", 3, 1), cell("Tax Amount", 3, 1), cell("Tax Period", 1, 2)],
    [cell("Gross"), cell("Returned"), cell("Net"), cell("Integrated Tax"), cell("Central Tax"), cell("State/UT Tax")]
  ]);
  const m = mapTcsColumns(labels);
  assert.equal(m.gstin, 0);
  assert.equal(m.name, 1);
  assert.equal(m.gross, 2);
  assert.equal(m.ret, 3);
  assert.equal(m.net, 4);
  assert.equal(m.igst, 5);
  assert.equal(m.cgst, 6);
  assert.equal(m.sgst, 7);
  assert.equal(m.period, 8);
});

test("mapTcsColumns: 'Return Period' ko returned value na samjhe", () => {
  const labels = ["gstin/uin", "trade/legal name", "gross taxable value", "net taxable value", "return period"];
  const m = mapTcsColumns(labels);
  assert.equal(m.gross, 2);
  assert.equal(m.ret, -1, "return period galat tarah returned-value ban gaya");
  assert.equal(m.net, 3);
});

test("mapTcsColumns: jo column nahi hai wo -1", () => {
  const m = mapTcsColumns(["gstin/uin", "gross taxable value"]);
  assert.equal(m.gstin, 0);
  assert.equal(m.gross, 1);
  assert.equal(m.name, -1);
  assert.equal(m.cgst, -1);
});

/* ----------------------------- parseTcsTables ---------------------------- */
const tcsHeader = [
  [cell("GSTIN/UIN of E-Commerce Operator", 1, 2), cell("Trade/Legal Name", 1, 2), cell("Taxable Value", 3, 1), cell("Tax Amount", 3, 1)],
  [cell("Gross"), cell("Returned"), cell("Net"), cell("Integrated Tax"), cell("Central Tax"), cell("State/UT Tax")]
];

test("parseTcsTables: header ke hisaab se padhta hai (mode=header) aur totals deta hai", () => {
  const tables = [{
    head: tcsHeader,
    body: [
      ["29AABCU9603R1ZM", "FLAIPKART INTERNET PVT LTD", "1,00,000.00", "10,000.00", "90,000.00", "0.00", "500.00", "500.00"],
      ["07AAACD1234A1Z5", "AMAZON SELLER SERVICES", "50,000.00", "0.00", "50,000.00", "1,000.00", "0.00", "0.00"]
    ]
  }];
  const out = parseTcsTables(tables);
  assert.equal(out.mode, "header");
  assert.equal(out.rows.length, 2);
  assert.deepEqual(out.rows[0], {
    ecoGstin: "29AABCU9603R1ZM", ecoName: "FLAIPKART INTERNET PVT LTD", taxPeriod: "",
    grossTaxableAmount: 100000, returnedValue: 10000, netValueSupplies: 90000,
    tcsIgst: 0, tcsCgst: 500, tcsSgst: 500, rawCells: tables[0].body[0]
  });
  assert.equal(out.totals.totalGrossTaxable, 150000);
  assert.equal(out.totals.totalReturned, 10000);
  assert.equal(out.totals.totalNetValue, 140000);
  assert.equal(out.totals.totalTcs, 2000);
  assert.deepEqual(out.warnings, []);
});

test("parseTcsTables: net column na ho to gross - returned", () => {
  const tables = [{
    head: [row("GSTIN/UIN", "Trade Name", "Gross Taxable Value", "Returned Value", "Integrated Tax")],
    body: [["29AABCU9603R1ZM", "ECO", "1,000.00", "200.00", "50.00"]]
  }];
  const out = parseTcsTables(tables);
  assert.equal(out.mode, "header");
  assert.equal(out.rows[0].netValueSupplies, 800);
});

test("parseTcsTables: thead na ho (fallback) to anuman se padhe par warning de", () => {
  const tables = [{
    head: [],
    body: [["1", "29AABCU9603R1ZM", "FLAIPKART", "1,00,000.00", "10,000.00", "90,000.00", "2,000.00", "1,000.00", "1,000.00", "102026"]]
  }];
  const out = parseTcsTables(tables);
  assert.equal(out.mode, "fallback");
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].ecoGstin, "29AABCU9603R1ZM");
  assert.equal(out.rows[0].ecoName, "FLAIPKART");
  assert.equal(out.rows[0].grossTaxableAmount, 100000);
  assert.equal(out.rows[0].returnedValue, 10000);
  assert.equal(out.rows[0].netValueSupplies, 90000);
  assert.equal(out.rows[0].tcsIgst, 2000);
  assert.equal(out.rows[0].lowConfidence, true);
  assert.equal(out.warnings.length, 1);
});

test("parseTcsTables: koi GSTIN row nahi -> khaali result, mode none", () => {
  const out = parseTcsTables([{ head: tcsHeader, body: [["No records found", "", "", "", "", "", "", ""]] }]);
  assert.equal(out.mode, "none");
  assert.equal(out.rows.length, 0);
  assert.equal(out.totals.totalGrossTaxable, 0);
  assert.equal(out.totals.totalTcs, 0);
});

test("parseTcsTables: input hi na ho to crash na kare", () => {
  assert.deepEqual(parseTcsTables().rows, []);
  assert.deepEqual(parseTcsTables([]).rows, []);
  assert.deepEqual(parseTcsTables(null).totals, {
    totalGrossTaxable: 0, totalReturned: 0, totalNetValue: 0, totalTcs: 0
  });
});

test("parseTcsTables: ek se zyada table (multi-page) jodta hai", () => {
  const t1 = { head: [row("GSTIN/UIN", "Trade Name", "Gross Taxable Value")], body: [["29AABCU9603R1ZM", "A", "100.00"]] };
  const t2 = { head: [row("GSTIN/UIN", "Trade Name", "Gross Taxable Value")], body: [["07AAACD1234A1Z5", "B", "200.00"]] };
  const out = parseTcsTables([t1, t2]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.totals.totalGrossTaxable, 300);
});

/* --------------------------- parseTcsRecordCount ------------------------- */
test("parseTcsRecordCount: tile/summary ka 'Total Number of Records'", () => {
  assert.equal(parseTcsRecordCount("TCS Credit received\nTotal Number of Records : 3"), 3);
  assert.equal(parseTcsRecordCount("TCS Credit received Total Number of Records: 12"), 12);
  assert.equal(parseTcsRecordCount("TCS  Credit   received  ...  Total Number of Records : 0"), 0);
  assert.equal(parseTcsRecordCount("TCS Credit received Amendments Total Number of Records : 5"), 5);
});

test("parseTcsRecordCount: pattern na mile to null", () => {
  assert.equal(parseTcsRecordCount(""), null);
  assert.equal(parseTcsRecordCount(null), null);
  assert.equal(parseTcsRecordCount("Total Number of Records : 3"), null); // TCS wala context nahi
});

/* ---------------------------- parseNoticeTables -------------------------- */
test("parseNoticeTables: portal layout (Ref|Type|Description|Date|Response)", () => {
  const tables = [{
    head: [row("Reference No.", "Type", "Description", "Date of Issue", "Response", "View")],
    body: [["AD262710012345", "DRC-01A", "Notice for mismatch", "31/10/2026", "View", ""]]
  }];
  const out = parseNoticeTables(tables);
  assert.equal(out.length, 1);
  assert.equal(out[0].refNo, "AD262710012345");
  assert.equal(out[0].type, "DRC-01A");
  assert.equal(out[0].description, "Notice for mismatch");
  assert.equal(out[0].issueDate, "31/10/2026");
});

test("parseNoticeTables: 'No records found' row ignore hota hai", () => {
  const tables = [{ head: [row("Ref", "Type", "Desc", "Date")], body: [["No records found", "", "", ""]] }];
  assert.deepEqual(parseNoticeTables(tables), []);
});

test("parseNoticeTables: khaali / 4 se kam cell wali row ignore", () => {
  const tables = [{ head: [], body: [["a", "b", "c"], ["", "", "", ""], ["", "", "", ""]] }];
  assert.deepEqual(parseNoticeTables(tables), []);
});

test("parseNoticeTables: non-notice table (late fee / footer) notice nahi banti", () => {
  const tables = [{
    head: [row("Sl No", "Description", "Amount", "Status")],
    body: [["1", "Late fee for Oct", "50.00", "Paid"], ["2", "Interest", "10.00", "Paid"]]
  }];
  assert.deepEqual(parseNoticeTables(tables), []);
});

test("parseNoticeTables: '31-Oct-2026' jaisi date wali row bhi pakdi jati hai", () => {
  const tables = [{
    head: [row("Reference No.", "Type", "Description", "Date of Issue", "Response", "View")],
    body: [["AD262710012345", "DRC-01A", "Mismatch", "31-Oct-2026", "View", ""]]
  }];
  const out = parseNoticeTables(tables);
  assert.equal(out.length, 1);
  assert.equal(out[0].issueDate, "31-Oct-2026");
  assert.equal(out[0].dueDate, "");
});

test("parseNoticeTables: 'No Record Found' (singular) bhi ignore", () => {
  const tables = [{ head: [], body: [["No Record Found", "", "", ""]] }];
  assert.deepEqual(parseNoticeTables(tables), []);
});

/* ---------------------------- summarizeGstr2B ---------------------------- */
function sample2B() {
  return {
    data: {
      gstin: "29AABCU9603R1ZM", rtnprd: "102026",
      itcsumm: {
        itcavl: {
          nonrevsup: { igst: 120.5, cgst: 60.25, sgst: 60.25, cess: 5 },
          revsup: { igst: 10, cgst: 0, sgst: 0, cess: 0 },
          isdsup: { igst: 0, cgst: 7, sgst: 7, cess: 0 },
          imsup: { igst: 300, cgst: 0, sgst: 0, cess: 12 },
          othersup: { igst: 0, cgst: 0, sgst: 0, cess: 0 }
        },
        itcunavl: {
          nonrevsup: { igst: 1, cgst: 2, sgst: 3, cess: 4 },
          revsup: { igst: 0, cgst: 0, sgst: 0, cess: 0 }
        }
      },
      docdata: {
        b2b: [
          { ctin: "29AABCU9603R1ZM", trdnm: "SUPPLIER ONE", inv: [{ inum: "A/1", val: 1180, itms: [{ num: 1, itm_det: { rt: 18, txval: 1000, iamt: 0, camt: 90, samt: 90, csamt: 0 } }] }] },
          { ctin: "07AAACD1234A1Z5", trdnm: "SUPPLIER TWO", inv: [
            { inum: "B/1", val: 590, itms: [{ num: 1, itm_det: { rt: 18, txval: 250, iamt: 45, camt: 0, samt: 0, csamt: 0 } }] },
            { inum: "B/2", val: 590, itms: [{ num: 1, itm_det: { rt: 18, txval: 250, iamt: 45, camt: 0, samt: 0, csamt: 0 } }] }
          ] }
        ],
        cdnr: [{ ctin: "29AABCU9603R1ZM", nt: [] }]
      }
    }
  };
}

test("summarizeGstr2B: itcavl ke SAB groups (rcm, isd, import, other) jodta hai", () => {
  const s = summarizeGstr2B(sample2B());
  assert.equal(s.igst, 430.5);   // 120.5 + 10 + 0 + 300 + 0
  assert.equal(s.cgst, 67.25);   // 60.25 + 0 + 7
  assert.equal(s.sgst, 67.25);
  assert.equal(s.cess, 17);      // 5 + 12
  assert.equal(s.ineligibleTotal, 10); // 1+2+3+4
  assert.deepEqual(s.ineligible, { igst: 1, cgst: 2, sgst: 3, cess: 4 });
  assert.equal(s.gstin, "29AABCU9603R1ZM");
  assert.equal(s.rtnprd, "102026");
  assert.equal(s.b2bSuppliersCount, 2);
  assert.equal(s.cdnrCount, 1);
  assert.deepEqual(s.warnings, []);
  assert.equal(Object.keys(s.availableBreakup).length, 5);
});

test("summarizeGstr2B: number strings bhi jodta hai", () => {
  const s = summarizeGstr2B({ data: { itcsumm: { itcavl: { nonrevsup: { igst: "100.50", cgst: "0", sgst: "0", cess: "1.25" } } } } });
  assert.equal(s.igst, 100.5);
  assert.equal(s.cess, 1.25);
});

test("summarizeGstr2B: data wrapper na ho to bhi chalta hai", () => {
  const s = summarizeGstr2B({ itcsumm: { itcavl: { nonrevsup: { igst: 5, cgst: 0, sgst: 0, cess: 0 } } } });
  assert.equal(s.igst, 5);
});

test("summarizeGstr2B: itcsumm na mile to warning + zero", () => {
  const s = summarizeGstr2B({ data: { rtnprd: "102026" } });
  assert.equal(s.igst, 0);
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /itcsumm/i);
});

test("summarizeGstr2B: null/undefined par crash na kare", () => {
  assert.doesNotThrow(() => summarizeGstr2B(null));
  assert.doesNotThrow(() => summarizeGstr2B(undefined));
  assert.doesNotThrow(() => summarizeGstr2B({}));
});

/* ----------------------------- buildB2bSellers --------------------------- */
test("buildB2bSellers: 2B ke itms/itm_det (iamt/camt/samt) se totals", () => {
  const sellers = buildB2bSellers([sample2B()]);
  assert.equal(sellers.length, 2);
  const one = sellers.find(s => s.gstin === "29AABCU9603R1ZM");
  const two = sellers.find(s => s.gstin === "07AAACD1234A1Z5");
  assert.equal(one.invCount, 1);
  assert.equal(one.taxable, 1000);
  assert.equal(one.cgst, 90);
  assert.equal(one.sgst, 90);
  assert.equal(two.invCount, 2);
  assert.equal(two.taxable, 500);
  assert.equal(two.igst, 90);
});

test("buildB2bSellers: ek hi GSTIN multiple files me ho to merge", () => {
  const a = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S1", inv: [{ itms: [{ itm_det: { txval: 100 } }] }] }] } } };
  const b = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S1", inv: [{ itms: [{ itm_det: { txval: 250 } }] }] }] } } };
  const out = buildB2bSellers([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].taxable, 350);
  assert.equal(out[0].invCount, 2);
});

test("buildB2bSellers: itms na ho to inv-level txval/val fallback", () => {
  const a = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S1", inv: [{ val: 1180, txval: 1000 }] }] } } };
  const out = buildB2bSellers([a]);
  assert.equal(out[0].taxable, 1000);
});

test("buildB2bSellers: khaali input par crash na kare", () => {
  assert.deepEqual(buildB2bSellers([]), []);
  assert.deepEqual(buildB2bSellers([null, undefined, {}]), []);
});

/* -------------------------- readJsonFilesFromBuffer ---------------------- */
function makeZip(files) {
  // Minimal ZIP writer (method 8 = deflate). Ek hi entry list ke liye kaafi.
  const zlib = require("zlib");
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const raw = Buffer.from(f.text, "utf8");
    const comp = zlib.deflateRawSync(raw);
    const crc = (() => {
      let c, crcTable = [];
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c;
      }
      let crc = 0 ^ -1;
      for (let i = 0; i < raw.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ raw[i]) & 0xff];
      return (crc ^ -1) >>> 0;
    })();
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp);
    centrals.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

test("readJsonFilesFromBuffer: plain JSON file (BOM ke saath)", () => {
  const out = readJsonFilesFromBuffer(Buffer.from("\uFEFF{\"data\":{\"rtnprd\":\"102026\"}}", "utf8"));
  assert.equal(out.isZip, false);
  assert.equal(out.files.length, 1);
  assert.equal(JSON.parse(out.files[0].text).data.rtnprd, "102026");
});

test("readJsonFilesFromBuffer: ZIP ke andar ki JSON files", () => {
  const zip = makeZip([
    { name: "GSTR2B_1.json", text: "{\"data\":{\"rtnprd\":\"102026\",\"n\":1}}" },
    { name: "GSTR2B_2.json", text: "{\"data\":{\"rtnprd\":\"102026\",\"n\":2}}" },
    { name: "notjson.txt", text: "ignore me" }
  ]);
  const out = readJsonFilesFromBuffer(zip);
  assert.equal(out.isZip, true);
  assert.equal(out.files.length, 2);
  assert.equal(JSON.parse(out.files[1].text).data.n, 2);
});

test("readJsonFilesFromBuffer: kharab ZIP par saaf error", () => {
  const buf = Buffer.alloc(40);
  buf[0] = 0x50; buf[1] = 0x4b; buf[2] = 3; buf[3] = 4;
  assert.throws(() => readJsonFilesFromBuffer(buf), /ZIP/i);
});

test("readJsonFilesFromBuffer: unsupported compression method aur path traversal reject", () => {
  // Valid deflate zip then corrupt method to 9 (Deflate64) and name to ../evil.json
  const zipGood = makeZip([{ name: "GSTR2B_1.json", text: "{}" }]);
  const badMethod = Buffer.from(zipGood);
  const cdOff = badMethod.readUInt32LE(badMethod.length - 6);
  badMethod.writeUInt16LE(9, cdOff + 10);
  assert.throws(() => readJsonFilesFromBuffer(badMethod), /unsupported compression method/i);

  const traversalZip = makeZip([{ name: "../evil.json", text: "{}" }]);
  assert.throws(() => readJsonFilesFromBuffer(traversalZip), /unsafe file path/i);
});

/* ----------------------------- normalizePeriod --------------------------- */
test("normalizePeriod: default, padding aur valid FY", () => {
  assert.deepEqual(normalizePeriod(undefined, undefined), { ok: true, fy: "2026-27", month: "10", period: "102026" });
  assert.deepEqual(normalizePeriod("2026-27", 3), { ok: true, fy: "2026-27", month: "03", period: "032027" });
  assert.equal(normalizePeriod(" 2026-2027 ", "02").period, "022027");
  assert.equal(normalizePeriod("2026-27", "10").ok, true);
});

test("normalizePeriod: galat month / FY par saaf error (portal call hi na ho)", () => {
  ["0", "13", "99", "10abc", "1.5", "October", "-1"].forEach(m => {
    const r = normalizePeriod("2026-27", m);
    assert.equal(r.ok, false, "month " + m + " accept ho gaya");
    assert.match(r.error, /Month/i);
  });
  ["2026", "26-27", "abc", "2026/27", "2026-27-01"].forEach(fy => {
    const r = normalizePeriod(fy, "10");
    assert.equal(r.ok, false, "FY " + fy + " accept ho gaya");
    assert.match(r.error, /FY/i);
  });
});

/* ------------------------------ safeFileName ----------------------------- */
test("safeFileName: path traversal / weird chars saaf hote hain", () => {
  assert.equal(safeFileName("../../etc/passwd", "x.json"), "passwd");
  assert.equal(safeFileName("GSTR1 Oct 2026.json", "x.json"), "GSTR1_Oct_2026.json");
  assert.equal(safeFileName("", "x.json"), "x.json");
  assert.equal(safeFileName(null, "x.json"), "x.json");
  assert.equal(safeFileName("..", "x.json"), "x.json");
  assert.equal(safeFileName(".", "x.json"), "x.json");
  const long = "a".repeat(200) + ".json";
  assert.ok(safeFileName(long, "x.json").length <= 80);
});

/* -------------------------------- regexes -------------------------------- */
test("ERR_TEXT_RE / OK_TEXT_RE: portal ke real messages", () => {
  ["Error: Invalid GSTIN", "upload failed", "File rejected", "captcha is invalid", "Something went wrong. Unable to process"]
    .forEach(t => assert.ok(ERR_TEXT_RE.test(t), t));
  ["Uploaded successfully", "File processed", "JSON generated", "Completed"].forEach(t => assert.ok(OK_TEXT_RE.test(t), t));
  assert.equal(ERR_TEXT_RE.test("Details saved successfully"), false);
});

/* ------------- app v5.4 (gst_client_tracker.html) ka B2B contract --------- */
// App ka modal: s.name/gstin/s.upfildt/invCount/taxable/igst/cgst/sgst aur s.invoices[] padhta hai,
// invoice: num/dt/val/txval/igst/cgst/sgst/rate/itcavl. In tests se wahi shape lock hoti hai.
test("buildB2bSellers: app ke B2B modal ka poora shape (invoices ke saath)", () => {
  const parsed = {
    data: {
      docdata: {
        b2b: [{
          ctin: "29AABCU9603R1ZM", trdnm: "SUPPLIER ONE", supfildt: "12/11/2026",
          inv: [{
            inum: "INV/001", idt: "01-10-2026", val: 1180, itcavl: "Y", rchrg: "N",
            itms: [{ num: 1, itm_det: { rt: 18, txval: 1000, iamt: 0, camt: 90, samt: 90, csamt: 0 } }]
          }]
        }]
      }
    }
  };
  const [seller] = buildB2bSellers([parsed]);
  assert.equal(seller.name, "SUPPLIER ONE");
  assert.equal(seller.gstin, "29AABCU9603R1ZM");
  assert.equal(seller.supfildt, "12/11/2026");
  assert.equal(seller.invCount, 1);
  assert.equal(seller.taxable, 1000);
  assert.equal(seller.igst, 0);
  assert.equal(seller.cgst, 90);
  assert.equal(seller.sgst, 90);
  assert.equal(seller.cess, 0);
  assert.equal(seller.invoices.length, 1);
  assert.deepEqual(seller.invoices[0], {
    num: "INV/001", dt: "01-10-2026", val: 1180, txval: 1000,
    igst: 0, cgst: 90, sgst: 90, cess: 0, rate: "18%", itcavl: "Y", rev: "N"
  });
});

test("buildB2bSellers: multi-rate invoice -> rate '12%/18%', cess aur paise (2 dp) bache", () => {
  const parsed = { data: { docdata: { b2b: [{ ctin: "07AAACD1234A1Z5", trdnm: "X", inv: [{
    inum: "B/9", idt: "05-10-2026", val: 2500.5,
    itms: [
      { itm_det: { rt: 12, txval: 1000.25, iamt: 120.03, camt: 0, samt: 0, csamt: 10 } },
      { itm_det: { rt: 18, txval: 500.5, iamt: 0, camt: 45.045, samt: 45.045 } }
    ]
  }] }] } } };
  const [seller] = buildB2bSellers([parsed]);
  assert.equal(seller.invoices[0].rate, "12%/18%");
  assert.equal(seller.invoices[0].txval, 1500.75);
  assert.equal(seller.invoices[0].igst, 120.03);
  assert.equal(seller.invoices[0].cess, 10);
  assert.equal(seller.cgst, 45.05); // 45.045 -> 2 dp
  assert.equal(seller.igst, 120.03);
});

test("buildB2bSellers: multi-file 2B me ek hi supplier ki invoices jodti hain (ZIP case)", () => {
  const f1 = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S1", supfildt: "01-10-2026",
    inv: [{ inum: "A", itms: [{ itm_det: { txval: 100, camt: 9, samt: 9 } }] }] }] } } };
  const f2 = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S1",
    inv: [{ inum: "B", itms: [{ itm_det: { txval: 200, camt: 18, samt: 18 } }] }] }] } } };
  const out = buildB2bSellers([f1, f2]);
  assert.equal(out.length, 1);
  assert.equal(out[0].invCount, 2);
  assert.deepEqual(out[0].invoices.map(i => i.num), ["A", "B"]);
  assert.equal(out[0].taxable, 300);
  assert.equal(out[0].supfildt, "01-10-2026");
});

test("buildB2bSellers: items na hone par invoice-level fallback + val jab txval na ho", () => {
  const a = { data: { docdata: { b2b: [{ ctin: "29AABCU9603R1ZM", trdnm: "S", inv: [
    { inum: "X1", val: 1180, txval: 1000 },
    { inum: "X2", val: 590 }
  ] }] } } };
  const [s] = buildB2bSellers([a]);
  assert.equal(s.taxable, 1590); // 1000 + 590 (val last resort)
  assert.equal(s.invoices.length, 2);
  assert.equal(s.invoices[0].val, 1180);
});

/* ------------------- app ke `partial` contract (fetch-all) ---------------- */
test("partialOutcome: sab ok -> partial null, allFailed false", () => {
  const o = partialOutcome({ gstr2b: { state: "ok" }, tcs: { state: "ok" }, notices: { state: "skipped" } }, { gstr2b: true, tcs: true, notices: false });
  assert.equal(o.allFailed, false);
  assert.equal(o.partial, null);
  assert.deepEqual(o.asked, ["GSTR-2B", "E-Com TCS"]);
});

test("partialOutcome: ek section fail -> ok response + partial flag", () => {
  const o = partialOutcome({ gstr2b: { state: "ok" }, tcs: { state: "failed", message: "table nahi mili" } }, { gstr2b: true, tcs: true });
  assert.equal(o.allFailed, false);
  assert.equal(o.partial.tcs, true);
  assert.equal(o.partial.gstr2b, false);
  assert.match(o.partial.text, /E-Com TCS: table nahi mili/);
});

test("partialOutcome: saare maange gaye section fail -> ok:false (kuch save na ho)", () => {
  const o = partialOutcome({ gstr2b: { state: "failed", message: "download nahi hui" }, tcs: { state: "failed", message: "x" } }, { gstr2b: true, tcs: true });
  assert.equal(o.allFailed, true);
  assert.equal(o.partial, null);
});

test("partialOutcome: 'empty' (koi record nahi) failure nahi hai, aur 'uncertain' bhi nahi", () => {
  const o = partialOutcome({ gstr2b: { state: "uncertain" }, tcs: { state: "empty" } }, { gstr2b: true, tcs: true });
  assert.equal(o.allFailed, false);
  assert.equal(o.partial, null);
});

test("partialOutcome: option off ho to us section ko count hi nahi karte", () => {
  const o = partialOutcome({ gstr2b: { state: "ok" }, tcs: { state: "skipped" } }, { gstr2b: true, tcs: false });
  assert.equal(o.allFailed, false);
  assert.deepEqual(o.asked, ["GSTR-2B"]);
  const o2 = partialOutcome({ gstr2b: { state: "failed", message: "x" } }, { gstr2b: true, tcs: false });
  assert.equal(o2.allFailed, true);
});
