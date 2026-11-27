/* =====================================================================================
   JAISWAL & ASSOCIATES — Branded PDF Builder (pure vanilla JS, no external library)
   Tax & GST Consultancy • GT Road, Padav Gopiganj, beside INDUSIND Bank • 9140000950
   ===================================================================================== */
/* JNA_LOGO_B64 hata diya — ab J&A vector monogram draw hota hai (transparent background) */
const JNA_BRAND = {
  name: "JAISWAL & ASSOCIATES",
  tag: "Tax & GST Consultancy",
  mobile: "9140000950",
  address: "GT Road, Padav, Gopiganj, Dist. Bhadohi (UP) — Beside INDUSIND Bank",
  shortAddr: "GT Road, Padav Gopiganj, beside INDUSIND Bank"
};

/* ---------- PDF writer ---------- */
class JnaPdf {
  constructor(opts) {
    this.W = (opts && opts.width) || 595.28;   // A4 portrait
    this.H = (opts && opts.height) || 841.89;
    this.cur = [];
    this.images = [];   // {name,w,h,data}
    this.pages = [];    // [{content:[ops]}]
  }
  n(v) { return String(Math.round(v * 1000) / 1000); }
  op(s) { this.cur.push(s); }
  setFill(r, g, b) { this.op(`${this.n(r)} ${this.n(g)} ${this.n(b)} rg`); }
  setStroke(r, g, b) { this.op(`${this.n(r)} ${this.n(g)} ${this.n(b)} RG`); }
  setLineWidth(w) { this.op(`${this.n(w)} w`); }
  rect(x, y, w, h, mode) { this.op(`${this.n(x)} ${this.n(y)} ${this.n(w)} ${this.n(h)} re ${mode || 'F'}`); }
  line(x1, y1, x2, y2) { this.op(`${this.n(x1)} ${this.n(y1)} m ${this.n(x2)} ${this.n(y2)} l S`); }
  roundRect(x, y, w, h, r, mode) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const k = 0.5523 * r;
    this.op(`${this.n(x + r)} ${this.n(y)} m`);
    this.op(`${this.n(x + w - r)} ${this.n(y)} l`);
    this.op(`${this.n(x + w - r + k)} ${this.n(y)} ${this.n(x + w)} ${this.n(y + r - k)} ${this.n(x + w)} ${this.n(y + r)} c`);
    this.op(`${this.n(x + w)} ${this.n(y + h - r)} l`);
    this.op(`${this.n(x + w)} ${this.n(y + h - r + k)} ${this.n(x + w - r + k)} ${this.n(y + h)} ${this.n(x + w - r)} ${this.n(y + h)} c`);
    this.op(`${this.n(x + r)} ${this.n(y + h)} l`);
    this.op(`${this.n(x + r - k)} ${this.n(y + h)} ${this.n(x)} ${this.n(y + h - r + k)} ${this.n(x)} ${this.n(y + h - r)} c`);
    this.op(`${this.n(x)} ${this.n(y + r)} l`);
    this.op(`${this.n(x)} ${this.n(y + r - k)} ${this.n(x + r - k)} ${this.n(y)} ${this.n(x + r)} ${this.n(y)} c`);
    this.op(mode || 'F');
  }
  clean(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/[\u0080-\u009F]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u20B9/g, "Rs.")
      .replace(/[\u2022\u00B7\u25CF\u25AA]/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/[^\u0000-\u00FF]/g, "");
  }
  esc(s) { return this.clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
  textWidth(str, size, bold) {
    const s = this.clean(str);
    const T = bold
      ? { " ": 278, "!": 333, '"': 474, "#": 556, "$": 556, "%": 889, "&": 722, "'": 238, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278, ":": 333, ";": 333, "<": 584, "=": 584, ">": 584, "?": 611, "@": 975, "[": 333, "]": 333, "^": 584, "_": 556, "`": 333, "{": 389, "|": 280, "}": 389, "~": 584 }
      : { " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, "[": 278, "]": 278, "^": 469, "_": 556, "`": 333, "{": 334, "|": 260, "}": 334, "~": 584 };
    let total = 0;
    for (const ch of s) {
      if (ch >= "0" && ch <= "9") total += 556;
      else if (T[ch] !== undefined) total += T[ch];
      else if (ch >= "A" && ch <= "Z") total += bold ? 722 : 667;
      else if (ch >= "a" && ch <= "z") total += bold ? 556 : 500;
      else total += 556;
    }
    return total * size / 1000;
  }
  text(str, x, y, size, opts) {
    opts = opts || {};
    const bold = !!opts.bold;
    const s = this.esc(str);
    if (!s) return;
    let xx = x;
    if (opts.align === "center") xx = x - this.textWidth(str, size, bold) / 2;
    else if (opts.align === "right") xx = x - this.textWidth(str, size, bold);
    if (opts.color) this.setFill(opts.color[0], opts.color[1], opts.color[2]);
    if (opts.spacing) this.op(`${this.n(opts.spacing)} Tc`);
    this.op(`BT /${bold ? "F2" : "F1"} ${this.n(size)} Tf ${this.n(xx)} ${this.n(y)} Td (${s}) Tj ET`);
    if (opts.spacing) this.op(`0 Tc`);
  }
  textLines(lines, x, y, size, opts) {
    opts = opts || {};
    const lh = opts.lineHeight || size * 1.32;
    (lines || []).forEach((l, i) => this.text(l, x, y - i * lh, size, opts));
    return lines.length ? y - (lines.length - 1) * lh : y;
  }
  wrap(str, maxW, size, bold) {
    const words = this.clean(str).split(/\s+/).filter(Boolean);
    const lines = []; let curLine = "";
    words.forEach(w => {
      const t = curLine ? curLine + " " + w : w;
      if (this.textWidth(t, size, bold) > maxW && curLine) { lines.push(curLine); curLine = w; }
      else curLine = t;
    });
    if (curLine) lines.push(curLine);
    return lines;
  }
  /* commit current ops as a page, start a new (white) page */
  newPage(blank) {
    this.finish();
    this.cur = blank ? [] : ["q 1 1 1 rg 0 0 " + this.n(this.W) + " " + this.n(this.H) + " re f Q"];
  }
  /* commit whatever is being drawn as a page */
  finish() {
    if (this.cur.length) { this.pages.push({ content: this.cur.slice() }); this.cur = []; }
  }
  drawImage(img, x, y, w, h) {
    this.op(`q ${this.n(w)} 0 0 ${this.n(h)} ${this.n(x)} ${this.n(y)} cm /${img.name} Do Q`);
  }
  addJpeg(dataB64, w, h, name) {
    const bin = atob(dataB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const img = { name: name || ("Im" + (this.images.length + 1)), w, h, data: bytes };
    this.images.push(img);
    return img;
  }
  /* run fn while drawing into an existing committed page (for footers / stamps) */
  drawOnPage(index, fn) {
    const saved = this.cur;
    this.cur = this.pages[index].content;
    fn();
    this.cur = saved;
  }
  build(meta) {
    this.finish();
    const enc = new TextEncoder();
    const streams = this.pages.map(p => enc.encode(p.content.join("\n")));
    const NIMG = this.images.length;
    const firstPageObj = 5 + NIMG;
    const pageObjNums = [], contentObjNums = [];
    let n = 4 + NIMG;
    this.pages.forEach(() => { n++; pageObjNums.push(n); n++; contentObjNums.push(n); });

    const objs = [];
    objs[1] = enc.encode(`<< /Type /Catalog /Pages 2 0 R >>`);
    objs[2] = enc.encode(`<< /Type /Pages /Kids [${pageObjNums.map(p => p + " 0 R").join(" ")}] /Count ${pageObjNums.length} >>`);
    objs[3] = enc.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objs[4] = enc.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    this.images.forEach((img, k) => {
      const head = enc.encode(`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`);
      const tail = enc.encode("\nendstream");
      const body = new Uint8Array(head.length + img.data.length + tail.length);
      body.set(head, 0); body.set(img.data, head.length); body.set(tail, head.length + img.data.length);
      objs[5 + k] = body;
    });
    const xobj = this.images.map((img, k) => `/${img.name} ${5 + k} 0 R`).join(" ");
    this.pages.forEach((p, k) => {
      const stream = streams[k];
      objs[pageObjNums[k]] = enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.n(this.W)} ${this.n(this.H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobj} >> >> /Contents ${contentObjNums[k]} 0 R >>`);
      const cHead = enc.encode(`<< /Length ${stream.length} >>\nstream\n`);
      const cTail = enc.encode("\nendstream");
      const cb = new Uint8Array(cHead.length + stream.length + cTail.length);
      cb.set(cHead, 0); cb.set(stream, cHead.length); cb.set(cTail, cHead.length + stream.length);
      objs[contentObjNums[k]] = cb;
    });

    const maxObj = objs.length - 1;
    const infoNum = maxObj + 1;
    const parts = [];
    const header = enc.encode("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
    parts.push(header);
    let total = header.length;
    const offsets = [];
    for (let k = 1; k <= maxObj; k++) {
      offsets[k] = total;
      const h = enc.encode(`${k} 0 obj\n`), t = enc.encode("\nendobj\n");
      const body = objs[k] || enc.encode("null");
      parts.push(h, body, t);
      total += h.length + body.length + t.length;
    }
    offsets[infoNum] = total;
    const info = enc.encode(`<< /Title (${this.esc((meta && meta.title) || "Jaiswal & Associates")}) /Author (${this.esc(JNA_BRAND.name)}) /Creator (Jaiswal & Associates GST Web App) /Producer (JNA PDF Engine 1.0) /CreationDate (D:${(meta && meta.date) || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}) >>`);
    const ih = enc.encode(`${infoNum} 0 obj\n`), it = enc.encode("\nendobj\n");
    parts.push(ih, info, it);
    total += ih.length + info.length + it.length;

    const xrefPos = total;
    let xref = `xref\n0 ${infoNum + 1}\n0000000000 65535 f \n`;
    for (let k = 1; k <= infoNum; k++) xref += String(offsets[k] || 0).padStart(10, "0") + " 00000 n \n";
    xref += `trailer\n<< /Size ${infoNum + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    parts.push(enc.encode(xref));

    let len = 0; parts.forEach(p => len += p.length);
    const out = new Uint8Array(len);
    let pos = 0; parts.forEach(ch => { out.set(ch, pos); pos += ch.length; });
    return out;
  }
}

/* =====================================================================================
   REPORT: Etsy Order-Wise Sales & GST Reconciliation (branded)
   opts = { client, firm, gstin, orders[], fees{}, rcmBase, rcm18, monthsLabel, fileName }
   ===================================================================================== */

function buildFeeReceiptPdf(item) {
  const doc = new JnaPdf(); const W=doc.W, H=doc.H, M=36, CW=W-2*M;
  const NAVY=[0.08,0.16,0.29], BLUE=[0.16,0.35,0.62], GOLD=[0.82,0.64,0.31], SOFT=[0.94,0.96,0.98], LINE=[0.82,0.86,0.91], MUTED=[0.38,0.43,0.51];
  doc.newPage();
  doc.setFill(...NAVY); doc.rect(0,H-112,W,112,'F');
  doc.setStroke(...GOLD); doc.setLineWidth(1.6); doc.roundRect(M+1,H-80,58,58,29,'S'); doc.setLineWidth(.7); doc.roundRect(M+5.5,H-75.5,49,49,24.5,'S');
  doc.text('J&A',M+30,H-57.5,19,{bold:true,color:[1,1,1],align:'center'});
  const tx=M+80;
  doc.text(JNA_BRAND.name,tx,H-38,16,{bold:true,color:[1,1,1]});
  doc.text(JNA_BRAND.tag,tx,H-53,8.4,{color:[.8,.85,.93]});
  doc.text('Mob: '+JNA_BRAND.mobile,tx,H-68,8.4,{color:[.8,.85,.93]});
  doc.text('GT Road, Padav Gopiganj',W-M,H-38,8.4,{align:'right',bold:true,color:[1,1,1]});
  doc.text('Beside INDUSIND Bank',W-M,H-53,8,{align:'right',color:[.87,.91,.96]});
  doc.text('Dist. Bhadohi, Uttar Pradesh',W-M,H-68,7.5,{align:'right',color:[.7,.78,.89]});
  doc.setFill(...SOFT); doc.rect(M,H-147,CW,24,'F'); doc.setStroke(...LINE); doc.setLineWidth(.6); doc.rect(M,H-147,CW,24,'S'); doc.setFill(...BLUE); doc.rect(M,H-147,3,24,'F');
  doc.text('FEE PAYMENT RECEIPT',M+12,H-137,10,{bold:true,color:NAVY,spacing:.25});
  doc.text(String(item.date||''),W-M-10,H-137,8.5,{align:'right',bold:true,color:BLUE});
  let y=H-181;
  doc.setFill(...SOFT); doc.roundRect(M,y-94,CW,104,8,'F');
  doc.text('RECEIPT NO.',M+16,y-10,7.2,{bold:true,color:MUTED,spacing:.4}); doc.text(item.receiptNo||'-',M+16,y-27,12,{bold:true,color:NAVY});
  doc.text('CLIENT',M+16,y-48,7.2,{bold:true,color:MUTED,spacing:.4}); doc.text(item.client||'-',M+16,y-65,11,{bold:true,color:NAVY});
  doc.text('FIRM / BUSINESS',W-M-16,y-48,7.2,{bold:true,color:MUTED,spacing:.4,align:'right'}); doc.text(item.firm||'-',W-M-16,y-65,9,{bold:true,color:NAVY,align:'right'});
  y-=128;
  const rows=[['Payment Date',item.date||'-'],['Fee / Service Period',(item.remarks||((item.months||'')+' Month')).trim()||'-'],['Payment Mode',item.mode||'-'],['Paid Till (PT Date)',item.newPtDate||'-']];
  rows.forEach((r,i)=>{doc.setStroke(...LINE);doc.setLineWidth(.45);doc.line(M,y-6,W-M,y-6);doc.text(r[0].toUpperCase(),M+8,y-23,7.1,{bold:true,color:MUTED,spacing:.3});doc.text(r[1],W-M-8,y-23,9.4,{bold:true,color:NAVY,align:'right'});y-=39;});
  doc.setFill(...NAVY); doc.roundRect(M,y-51,CW,38,7,'F'); doc.text('AMOUNT RECEIVED',M+14,y-37,8.3,{bold:true,color:[1,1,1],spacing:.3}); doc.text('Rs. '+Number(item.amount||0).toLocaleString('en-IN'),W-M-14,y-39,15,{bold:true,color:[1,1,1],align:'right'});
  y-=96; doc.text('Payment received with thanks.',W/2,y,9.5,{align:'center',bold:true,color:BLUE});
  doc.setStroke(...LINE); doc.setLineWidth(.6); doc.line(M,44,W-M,44);
  doc.text('Computer generated fee payment receipt.',M,33,7,{color:MUTED});
  doc.text(JNA_BRAND.name+'  |  '+JNA_BRAND.mobile+'  |  '+JNA_BRAND.shortAddr,W/2,22,6.5,{align:'center',color:MUTED});
  return new Blob([doc.build({title:'Fee Payment Receipt '+(item.receiptNo||'')})],{type:'application/pdf'});
}

function buildEtsyPdfReport(opts) {
  const doc = new JnaPdf();
  const W = doc.W, H = doc.H;
  const M = 34;
  const CW = W - M * 2;

  const NAVY = [0.07, 0.15, 0.36], BLUE = [0.13, 0.42, 0.68], GOLD = [0.76, 0.60, 0.22];
  const INK = [0.13, 0.16, 0.22], MUTED = [0.42, 0.47, 0.55], LINE = [0.85, 0.88, 0.92];
  const SOFT = [0.955, 0.968, 0.984], SOFT2 = [0.976, 0.980, 0.988];
  const GREEN = [0.05, 0.42, 0.30], AMBER = [0.62, 0.42, 0.02], ROSE = [0.62, 0.13, 0.20];

  // Logo ab vector J&A monogram hai (header() me) — transparent background
  const orders = (opts.orders || []).slice();
  const fees = opts.fees || {};
  const money = v => {
    const num = Number(v || 0);
    return (num < 0 ? "-" : "") + Math.abs(num).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const taxableOf = o => Math.max(0, (o.gross || 0) - (o.refund || 0) - ((o.buyerTax || 0) - (o.taxRefund || 0)));

  const totals = orders.reduce((a, o) => {
    a.gross += o.gross || 0; a.refund += o.refund || 0; a.buyerTax += o.buyerTax || 0;
    a.tcs += o.tcs || 0; a.tds += o.tds || 0; a.taxable += taxableOf(o);
    return a;
  }, { gross: 0, refund: 0, buyerTax: 0, tcs: 0, tds: 0, taxable: 0 });

  /* ---- page furniture ---- */
  function header() {
    doc.setFill(...NAVY); doc.rect(0, H - 86, W, 86, "F");
    doc.setFill(...GOLD); doc.rect(0, H - 89.5, W, 3.5, "F");

    // J&A monogram — vector draw, transparent background (koi white box / JPEG nahi)
    const lw = 62;
    doc.setStroke(...GOLD); doc.setLineWidth(1.6);
    doc.roundRect(M + 1, H - 75, 58, 58, 29, "S");
    doc.setLineWidth(0.7);
    doc.roundRect(M + 5.5, H - 70.5, 49, 49, 24.5, "S");
    doc.text("J&A", M + 30, H - 52.5, 19, { bold: true, color: [1, 1, 1], align: "center" });

    const tx = M + lw + 18;
    doc.text(JNA_BRAND.name, tx, H - 33, 16, { bold: true, color: [1, 1, 1] });
    doc.text(JNA_BRAND.tag, tx, H - 47, 8.4, { color: [0.80, 0.85, 0.93] });
    doc.text(`Mob: ${JNA_BRAND.mobile}`, tx, H - 62, 8.4, { color: [0.80, 0.85, 0.93] });
    doc.text("Tax & GST Consultant  |  GST Practitioner", tx, H - 74, 7, { color: [0.60, 0.69, 0.82] });

    doc.text("OFFICE", W - M, H - 27, 6.8, { align: "right", color: GOLD, spacing: 0.7, bold: true });
    doc.text("GT Road, Padav Gopiganj", W - M, H - 42, 9, { align: "right", color: [1, 1, 1], bold: true });
    doc.text("Beside INDUSIND Bank", W - M, H - 55, 8.2, { align: "right", color: [0.87, 0.91, 0.96] });
    doc.text("Dist. Bhadohi, Uttar Pradesh", W - M, H - 67, 7.8, { align: "right", color: [0.70, 0.78, 0.89] });

    // title strip
    doc.setFill(...SOFT); doc.rect(M, H - 118, CW, 24, "F");
    doc.setStroke(...LINE); doc.setLineWidth(0.6);
    doc.line(M, H - 118, M + CW, H - 118);
    doc.line(M, H - 94, M + CW, H - 94);
    doc.setFill(...BLUE); doc.rect(M, H - 118, 3, 24, "F");
    doc.text(opts.reportTitle || "ETSY ORDER-WISE SALES & GST RECONCILIATION", M + 12, H - 108, 9.4, { bold: true, color: NAVY, spacing: 0.2 });
    doc.text(opts.monthsLabel || "", W - M - 10, H - 108, 8.2, { align: "right", color: BLUE, bold: true });
    return H - 118;
  }

  function footer(pageNo, totalPages) {
    doc.setStroke(...LINE); doc.setLineWidth(0.6);
    doc.line(M, 44, M + CW, 44);
    doc.text("Computer generated statement of Etsy sales reconciliation for GST return purposes.", M, 34, 6.8, { color: MUTED });
    doc.text(`${JNA_BRAND.name}  •  ${JNA_BRAND.mobile}  •  ${JNA_BRAND.shortAddr}`, W / 2, 24, 6.6, { align: "center", color: MUTED });
    doc.text(`Page ${pageNo} of ${totalPages}`, W - M, 34, 7.4, { align: "right", color: NAVY, bold: true });
  }

  /* ---- page 1 ---- */
  doc.newPage();
  let y = header();

  // Client strip
  y -= 16;
  const cardH = 50;
  doc.setFill(...SOFT2); doc.roundRect(M, y - cardH, CW, cardH, 6, "F");
  doc.setStroke(...LINE); doc.setLineWidth(0.6); doc.roundRect(M, y - cardH, CW, cardH, 6, "S");
  doc.setFill(...BLUE); doc.rect(M, y - cardH, 3, cardH, "F");
  doc.text("CLIENT / GSTIN DETAILS", M + 12, y - 13, 6.8, { bold: true, color: MUTED, spacing: 0.5 });
  doc.text(String(opts.client || "-").toUpperCase(), M + 12, y - 28, 11.5, { bold: true, color: NAVY });
  doc.text(`Firm: ${opts.firm || "-"}`, M + 12, y - 40, 8, { color: INK });
  const rx = M + CW - 12;
  doc.text("GSTIN", rx, y - 13, 6.8, { align: "right", bold: true, color: MUTED, spacing: 0.5 });
  doc.text(opts.gstin || "-", rx, y - 28, 9.6, { align: "right", bold: true, color: INK });
  doc.text(`Period: ${opts.monthsLabel || "-"}`, rx, y - 40, 7.2, { align: "right", color: MUTED });
  y -= cardH + 14;

  // KPI tiles
  const tiles = [
    { label: opts.orderNoTitle ? "TOTAL INVOICES" : "TOTAL ORDERS", value: String(orders.length), sub: opts.orderNoTitle ? "billed in this month" : "orders in statement", rgb: NAVY, bg: [0.94, 0.96, 0.99] },
    { label: opts.orderNoTitle ? "INVOICE VALUE" : "GROSS SALES", value: "Rs. " + money(totals.gross), sub: opts.orderNoTitle ? "taxable + GST" : "buyer paid (incl. tax)", rgb: BLUE, bg: [0.93, 0.96, 1.0] },
    { label: opts.orderNoTitle ? "GST ON INVOICES" : "BUYER SALES TAX", value: "Rs. " + money(totals.buyerTax), sub: opts.orderNoTitle ? "as per invoice rate" : "collected by Etsy", rgb: AMBER, bg: [1.0, 0.98, 0.92] },
    { label: "NET TAXABLE TURNOVER", value: "Rs. " + money(totals.taxable), sub: "GSTR-1 taxable value", rgb: GREEN, bg: [0.93, 0.99, 0.96] }
  ];
  const gap = 8, tw = (CW - gap * 3) / 4, th = 46;
  tiles.forEach((t, i) => {
    const x = M + i * (tw + gap);
    doc.setFill(...t.bg); doc.roundRect(x, y - th, tw, th, 5, "F");
    doc.setFill(...t.rgb); doc.rect(x, y - th, tw, 2.6, "F");
    doc.text(t.label, x + 8, y - 13, 6.2, { bold: true, color: t.rgb, spacing: 0.35 });
    doc.text(t.value, x + 8, y - 28, t.value.length > 16 ? 9 : 11, { bold: true, color: t.rgb });
    doc.text(t.sub, x + 8, y - 39, 6.2, { color: MUTED });
  });
  y -= th + 12;

  // Deduction strip
  doc.setFill(1, 1, 1); doc.roundRect(M, y - 28, CW, 26, 5, "F");
  doc.setStroke(...LINE); doc.setLineWidth(0.6); doc.roundRect(M, y - 28, CW, 26, 5, "S");
  const cells = [
    ["REFUNDS", "Rs. " + money(totals.refund), ROSE],
    ["TCS 0.5% (NET)", "Rs. " + money(totals.tcs), MUTED],
    ["TDS 0.1% (NET)", "Rs. " + money(totals.tds), MUTED],
    ["HSN CODE", "5703", NAVY]
  ];
  const cw4 = CW / 4;
  cells.forEach((c, i) => {
    const x = M + i * cw4;
    if (i) { doc.setStroke(...LINE); doc.setLineWidth(0.5); doc.line(x, y - 26, x, y - 6); }
    doc.text(c[0], x + 10, y - 11, 6.4, { bold: true, color: MUTED, spacing: 0.3 });
    doc.text(c[1], x + 10, y - 22, 8.8, { bold: true, color: c[2] });
  });
  y -= 44;

  /* ---- table ---- */
  const cols = [
    { key: "#", w: 22, right: false, title: "#" },
    { key: "date", w: 60, right: false, title: opts.dateTitle || "DATE" },
    { key: "orderNo", w: 92, right: false, title: opts.orderNoTitle || "ORDER NO." },
    { key: "gross", w: 76, right: true, title: "GROSS" },
    { key: "refund", w: 62, right: true, title: "REFUND" },
    { key: "buyerTax", w: 70, right: true, title: "BUYER TAX" },
    { key: "tcs", w: 60, right: true, title: "TCS" },
    { key: "tds", w: 58, right: true, title: "TDS" },
    { key: "taxable", w: 78, right: true, title: "NET TAXABLE" }
  ];
  const scaleW = CW / cols.reduce((a, c) => a + c.w, 0);
  cols.forEach(c => c.w *= scaleW);

  doc.text((opts.orderNoTitle ? "INVOICE-WISE DETAILS" : "ORDER-WISE DETAILS"), M, y, 8.4, { bold: true, color: NAVY, spacing: 0.4 });
  doc.text("Amounts in Rs.", M + CW, y, 6.8, { align: "right", color: MUTED });
  y -= 8;

  function tableHead(yy) {
    doc.setFill(...NAVY); doc.rect(M, yy - 18, CW, 18, "F");
    let x = M;
    cols.forEach(c => {
      doc.text(c.title, c.right ? x + c.w - 6 : x + 6, yy - 12.6, 6.7,
        { bold: true, color: [1, 1, 1], align: c.right ? "right" : "left", spacing: 0.3 });
      x += c.w;
    });
    return yy - 18;
  }
  y = tableHead(y);

  const rowH = 15.5;
  const BOTTOM = 60;
  let shade = false;

  function nextPageWithTable() {
    doc.newPage();
    let yy = header();
    yy -= 12;
    doc.text((opts.orderNoTitle ? "INVOICE-WISE DETAILS (CONTINUED)" : "ORDER-WISE DETAILS (CONTINUED)"), M, yy, 8.4, { bold: true, color: NAVY, spacing: 0.4 });
    doc.text("Amounts in Rs.", M + CW, yy, 6.8, { align: "right", color: MUTED });
    yy -= 8;
    return tableHead(yy);
  }

  orders.forEach((o, idx) => {
    if (y - rowH < BOTTOM) y = nextPageWithTable();
    const vals = {
      "#": String(idx + 1), date: o.date || "-", orderNo: String(o.orderNo || "-"),
      gross: money(o.gross), refund: money(o.refund), buyerTax: money(o.buyerTax),
      tcs: money(o.tcs), tds: money(o.tds), taxable: money(taxableOf(o))
    };
    if (shade) { doc.setFill(...SOFT2); doc.rect(M, y - rowH, CW, rowH, "F"); }
    let x = M;
    cols.forEach((c, ci) => {
      const colr = c.key === "taxable" ? GREEN : c.key === "refund" ? ROSE : c.key === "orderNo" ? BLUE : INK;
      doc.text(vals[c.key], c.right ? x + c.w - 6 : x + 6, y - 10.9, c.key === "orderNo" ? 7.1 : 7.5,
        { align: c.right ? "right" : "left", color: colr, bold: c.key === "taxable" || c.key === "gross" });
      x += c.w;
      if (ci < cols.length - 1) { doc.setStroke(0.93, 0.95, 0.97); doc.setLineWidth(0.4); doc.line(x, y - rowH + 2, x, y - 2); }
    });
    doc.setStroke(...LINE); doc.setLineWidth(0.4); doc.line(M, y - rowH, M + CW, y - rowH);
    y -= rowH;
    shade = !shade;
  });

  if (y - 20 < BOTTOM) y = nextPageWithTable();
  doc.setFill(0.89, 0.93, 0.985); doc.rect(M, y - 20, CW, 20, "F");
  doc.setStroke(...NAVY); doc.setLineWidth(0.9); doc.line(M, y, M + CW, y);
  let gx = M;
  cols.forEach(c => {
    let v = "";
    if (c.key === "#") v = "GRAND TOTAL";
    else if (c.key === "gross") v = money(totals.gross);
    else if (c.key === "refund") v = money(totals.refund);
    else if (c.key === "buyerTax") v = money(totals.buyerTax);
    else if (c.key === "tcs") v = money(totals.tcs);
    else if (c.key === "tds") v = money(totals.tds);
    else if (c.key === "taxable") v = money(totals.taxable);
    if (v) doc.text(v, c.right ? gx + c.w - 6 : gx + 6, y - 13.6, 7.8, { bold: true, color: NAVY, align: c.right ? "right" : "left" });
    gx += c.w;
  });
  y -= 44;

  /* ---- RCM block ---- */
  const feeRows = [
    ["Etsy Ads / Marketing Fees", fees.ads],
    ["Transaction Fees", fees.transaction],
    ["Payment Processing Fees", fees.processing],
    ["Regulatory Operating Fees", fees.regulatory],
    ["Listing Fees", fees.listing],
    ["Other Etsy Fees", fees.other]
  ].filter(r => r[1] && ((r[1].charged || 0) !== 0 || (r[1].credits || 0) !== 0));

  const needH = 62 + (feeRows.length ? 20 + feeRows.length * 12.5 : 0) + 92;
  if (y - needH < BOTTOM) {
    doc.newPage();
    y = header() - 8;
  }

  doc.text("ETSY FEES & REVERSE CHARGE (RCM) SUMMARY", M, y, 9.6, { bold: true, color: NAVY, spacing: 0.3 });
  y -= 12;
  doc.setFill(1.0, 0.975, 0.935); doc.roundRect(M, y - 38, CW, 36, 5, "F");
  doc.setStroke(0.94, 0.82, 0.64); doc.setLineWidth(0.6); doc.roundRect(M, y - 38, CW, 36, 5, "S");
  doc.setFill(...AMBER); doc.rect(M, y - 38, 3, 36, "F");
  doc.text("ETSY FEES — RCM BASE (GST charged to you by Etsy)", M + 12, y - 12, 6.8, { bold: true, color: AMBER, spacing: 0.3 });
  doc.text("Rs. " + money(opts.rcmBase || 0), M + 12, y - 29, 12, { bold: true, color: INK });
  doc.text("18% IGST PAYABLE UNDER RCM", M + CW - 12, y - 12, 6.8, { align: "right", bold: true, color: ROSE, spacing: 0.3 });
  doc.text("Rs. " + money(opts.rcm18 || 0), M + CW - 12, y - 29, 12, { align: "right", bold: true, color: ROSE });
  y -= 48;

  const note = "GSTR-3B: Table 3.1(d) me import of service ke roop me Rs. " + money(opts.rcm18 || 0) +
    " IGST pay karein aur wahi raqam Table 4A(2) me ITC claim karein. GSTR-1: is statement ka Net Taxable Turnover Rs. " +
    money(totals.taxable) + " B2CS / Table 12 me declare hota hai (HSN 5703).";
  const noteLines = doc.wrap(note, CW - 12, 7.2);
  doc.textLines(noteLines, M + 6, y, 7.2, { color: MUTED, lineHeight: 9.4 });
  y -= noteLines.length * 9.4 + 8;

  if (feeRows.length) {
    doc.setFill(...SOFT); doc.rect(M, y - 14, CW, 14, "F");
    doc.text("FEE HEAD", M + 8, y - 9.6, 6.6, { bold: true, color: NAVY, spacing: 0.3 });
    doc.text("CHARGED (Rs.)", M + CW * 0.60, y - 9.6, 6.6, { bold: true, color: NAVY, align: "right", spacing: 0.3 });
    doc.text("CREDITED (Rs.)", M + CW - 8, y - 9.6, 6.6, { bold: true, color: NAVY, align: "right", spacing: 0.3 });
    y -= 14;
    feeRows.forEach((r, i) => {
      if (i % 2 === 0) { doc.setFill(...SOFT2); doc.rect(M, y - 12.5, CW, 12.5, "F"); }
      doc.text(r[0], M + 8, y - 8.8, 7.3, { color: INK });
      doc.text(money(r[1].charged || 0), M + CW * 0.60, y - 8.8, 7.3, { align: "right", color: INK });
      doc.text(money(r[1].credits || 0), M + CW - 8, y - 8.8, 7.3, { align: "right", color: MUTED });
      doc.setStroke(...LINE); doc.setLineWidth(0.4); doc.line(M, y - 12.5, M + CW, y - 12.5);
      y -= 12.5;
    });
    y -= 10;
  }

  /* ---- signature ---- */
  if (y - 78 < BOTTOM) { doc.newPage(); y = header() - 10; }
  doc.setStroke(...LINE); doc.setLineWidth(0.6); doc.line(M, y - 4, M + CW, y - 4);
  doc.text("PREPARED BY", M, y - 18, 6.8, { color: MUTED, spacing: 0.4 });
  doc.text(JNA_BRAND.name, M, y - 32, 9.4, { bold: true, color: NAVY });
  doc.text(JNA_BRAND.tag, M, y - 43, 7.4, { color: MUTED });
  doc.text(JNA_BRAND.shortAddr, M, y - 53, 7.4, { color: MUTED });
  doc.text("Mob: " + JNA_BRAND.mobile, M, y - 63, 7.4, { color: MUTED });

  doc.text("FOR " + JNA_BRAND.name, W - M, y - 18, 7.6, { align: "right", bold: true, color: NAVY });
  doc.setStroke(...NAVY); doc.setLineWidth(0.7); doc.line(W - M - 135, y - 50, W - M, y - 50);
  doc.text("Authorised Signatory", W - M, y - 62, 7.4, { align: "right", color: MUTED });
  doc.text("(Tax & GST Consultant)", W - M, y - 72, 7, { align: "right", color: MUTED });

  /* ---- stamp footers with exact page counts ---- */
  doc.finish();
  const total = doc.pages.length;
  doc.pages.forEach((p, i) => doc.drawOnPage(i, () => footer(i + 1, total)));

  const bytes = doc.build({ title: "Etsy Order-Wise Sales & GST Statement — " + (opts.client || "") });
  return new Blob([bytes], { type: "application/pdf" });
}

