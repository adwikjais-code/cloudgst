(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.Gstr2bParser = api;
    root.gpExtractB2bSellersFromData = api.gpExtractB2bSellersFromData;
    root.gpExtractEcoList = api.gpExtractEcoList;
    root.gpB2bSummaryFromSellers = api.gpB2bSummaryFromSellers;
    root.gpPackB2bJson = api.gpPackB2bJson;
    root.__gpExtractB2b = api.gpExtractB2bSellersFromData;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : null), function () {
  "use strict";

  function decodeBase64Utf8(raw) {
    if (typeof Buffer === "function") {
      return Buffer.from(raw, "base64").toString("utf8");
    }
    var bytes = Uint8Array.from(atob(raw), function (ch) { return ch.charCodeAt(0); });
    return new TextDecoder("utf-8").decode(bytes);
  }

  function pickTax(obj, primaryKey, portalKey) {
    if (!obj || typeof obj !== "object") return 0;
    var v1 = obj[primaryKey];
    var v2 = obj[portalKey];
    if (v1 !== undefined && v1 !== null && v1 !== "" && (Number(v1) !== 0 || v2 === undefined || v2 === null)) {
      return Number(v1) || 0;
    }
    return Number(v2 || 0) || 0;
  }

  function gpExtractB2bSellersFromObj(parsed) {
    var docRoot = (parsed && parsed.data && parsed.data.docdata) || (parsed && parsed.docdata) || {};
    var b2b = Array.isArray(docRoot.b2b) ? docRoot.b2b : [];
    return b2b.map(function (sup) {
      var invs = Array.isArray(sup && sup.inv) ? sup.inv : [];
      var taxable = 0, igst = 0, cgst = 0, sgst = 0, cess = 0;
      var invoices = [];
      invs.forEach(function (inv) {
        var items = Array.isArray(inv && inv.items) ? inv.items : (Array.isArray(inv && inv.itms) ? inv.itms : []);
        var iTx = 0, iI = 0, iC = 0, iS = 0, iCs = 0;
        var rates = new Set();
        if (items.length) {
          items.forEach(function (it) {
            var d = (it && it.itm_det && typeof it.itm_det === "object") ? it.itm_det : it;
            iTx += Number((d && d.txval) || 0) || 0;
            iI += pickTax(d, "igst", "iamt");
            iC += pickTax(d, "cgst", "camt");
            iS += pickTax(d, "sgst", "samt");
            iCs += pickTax(d, "cess", "csamt");
            if (d && d.rt !== undefined && d.rt !== null && d.rt !== "") rates.add(String(d.rt) + "%");
          });
        } else {
          iTx = Number((inv && inv.txval) || 0) || 0;
          iI = pickTax(inv, "igst", "iamt");
          iC = pickTax(inv, "cgst", "camt");
          iS = pickTax(inv, "sgst", "samt");
          iCs = pickTax(inv, "cess", "csamt");
          if (inv && inv.rt !== undefined && inv.rt !== null && inv.rt !== "") rates.add(String(inv.rt) + "%");
        }
        taxable += iTx; igst += iI; cgst += iC; sgst += iS; cess += iCs;
        invoices.push({
          num: String((inv && (inv.inum || inv.invnum)) || "").trim(),
          dt: String((inv && (inv.dt || inv.idt || inv.inv_dt || inv.docdt || inv.irngendate)) || "").trim(),
          val: Math.round(Number((inv && inv.val) || (iTx + iI + iC + iS + iCs)) * 100) / 100,
          txval: Math.round(iTx * 100) / 100,
          igst: Math.round(iI * 100) / 100,
          cgst: Math.round(iC * 100) / 100,
          sgst: Math.round(iS * 100) / 100,
          cess: Math.round(iCs * 100) / 100,
          rate: Array.from(rates).join("/"),
          itcavl: String((inv && inv.itcavl) || "Y").trim().toUpperCase(),
          rev: String((inv && inv.rev) || "N").trim().toUpperCase()
        });
      });
      return {
        name: String((sup && (sup.trdnm || sup.ctin)) || "Supplier").trim(),
        gstin: String((sup && sup.ctin) || "").trim().toUpperCase(),
        supfildt: String((sup && sup.supfildt) || "").trim(),
        invCount: invs.length,
        taxable: Math.round(taxable * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        cess: Math.round(cess * 100) / 100,
        invoices: invoices
      };
    });
  }

  function gpExtractB2bSellersFromData(data) {
    var g2b = data && data.gstr2b ? data.gstr2b : null;
    var srvSellers = (g2b && Array.isArray(g2b.b2bSellers)) ? g2b.b2bSellers : [];
    if (srvSellers.length && srvSellers.some(function (s) { return Array.isArray(s.invoices) && s.invoices.length; })) {
      return srvSellers;
    }
    var b64 = g2b && g2b.jsonBase64;
    if (!b64 || String(b64).indexOf("data:application/zip") === 0) return srvSellers;
    try {
      var str = String(b64);
      var raw = str.indexOf(",") >= 0 ? str.split(",")[1] : str;
      var text = decodeBase64Utf8(raw).replace(/^\uFEFF/, "");
      var parsed = JSON.parse(text);
      var parsedSellers = gpExtractB2bSellersFromObj(parsed);
      return parsedSellers.length ? parsedSellers : srvSellers;
    } catch (_) {
      return srvSellers;
    }
  }

  function gpExtractEcoList(data, fallbackPlatformsStr) {
    var rows = data && data.ecommerceTcs && data.ecommerceTcs.rows;
    if (Array.isArray(rows) && rows.length) {
      return rows.map(function (r) {
        return {
          name: String(r.ecoName || "E-Commerce Operator").trim(),
          gstin: String(r.ecoGstin || "").trim().toUpperCase(),
          gross: Number(r.grossTaxableAmount || 0),
          tcs: Number(r.tcsIgst || 0) + Number(r.tcsCgst || 0) + Number(r.tcsSgst || 0)
        };
      });
    }
    if (fallbackPlatformsStr) return [{ name: fallbackPlatformsStr, gstin: "", gross: 0, tcs: 0 }];
    return [];
  }

  function gpB2bSummaryFromSellers(list) {
    var arr = Array.isArray(list) ? list : [];
    var t = arr.reduce(function (a, s) {
      a.igst += Number((s && s.igst) || 0);
      a.cgst += Number((s && s.cgst) || 0);
      a.sgst += Number((s && s.sgst) || 0);
      a.cess += Number((s && s.cess) || 0);
      a.taxable += Number((s && s.taxable) || 0);
      return a;
    }, { igst: 0, cgst: 0, sgst: 0, cess: 0, taxable: 0 });
    return {
      igst: Math.round(t.igst * 100) / 100,
      cgst: Math.round(t.cgst * 100) / 100,
      sgst: Math.round(t.sgst * 100) / 100,
      cess: Math.round(t.cess * 100) / 100,
      taxable: Math.round(t.taxable * 100) / 100,
      b2bSuppliersCount: arr.length
    };
  }

  function gpPackB2bJson(sellers) {
    var LIMIT = 48000;
    var list = Array.isArray(sellers) ? sellers.slice() : [];
    var j = JSON.stringify(list);
    if (j.length <= LIMIT) return { json: j, note: "" };
    var stripInvoices = function (arr) {
      return arr.map(function (s) {
        return Object.assign({}, s, { invoices: [], invoiceDetailOmitted: true });
      });
    };
    var packed = stripInvoices(list);
    j = JSON.stringify(packed);
    if (j.length <= LIMIT) return { json: j, note: "B2B invoice detail sheet me nahi bheji (" + list.length + " suppliers ke totals bheje)" };
    var kept = list.slice().sort(function (a, b) { return Number(b.taxable || 0) - Number(a.taxable || 0); });
    while (j.length > LIMIT && kept.length > 1) {
      kept.pop();
      j = JSON.stringify(stripInvoices(kept));
    }
    return {
      json: j.length <= LIMIT ? j : "[]",
      note: "B2B JSON me sirf " + kept.length + "/" + list.length + " suppliers bheje (sheet cell limit) — kam value wale chhoot gaye"
    };
  }

  return {
    pickTax: pickTax,
    gpExtractB2bSellersFromObj: gpExtractB2bSellersFromObj,
    gpExtractB2bSellersFromData: gpExtractB2bSellersFromData,
    gpExtractEcoList: gpExtractEcoList,
    gpB2bSummaryFromSellers: gpB2bSummaryFromSellers,
    gpPackB2bJson: gpPackB2bJson
  };
});
