# Testing — GST Cloud Bridge (`server.js`)

```bash
npm install     # pehli baar (express, cors, playwright)
npm test        # 60 tests, ~8 second, browser ki zaroorat nahi
```

`npm test` do files chalata hai:

| File | Kya check hota hai |
|------|--------------------|
| `test/helpers.test.js` | Saare pure helpers — period math, amount parsing, table/header parsing, 2B summary + B2B sellers, ZIP JSON reader, file-name safety, regex |
| `test/api.test.js` | Server ko asli process ki tarah chala kar HTTP layer — `/health`, secret auth (401/503), CORS, session checks, input validation, 404/error JSON, 25MB body limit |

**Kya test NAHI hota (kyunki sandbox me GST portal nahi hai):** asli login (captcha/OTP), portal ke buttons
(`DOWNLOAD`, `GENERATE JSON`, `PREPARE ONLINE`), aur live tables ki reading. Wo hissa sirf real portal par verify hoga —
isliye har step apna status (`ok / empty / uncertain / failed`) aur `/debug` trace deta hai.

---

## Is round me pakde gaye bugs (aur fix)

1. **GSTR-2B "B2B Sellers" ke saare amount 0 aate the** *(sabse bada)*
   2B JSON me invoice items `inv.itms[].itm_det{txval, iamt, camt, samt}` me hote hain, par code
   `inv.items[].igst/cgst/sgst` padh raha tha (wo GSTR-1 style hai, 2B me nahi hota). Supplier ka naam
   aur invoice count sahi aata tha, taxable/IGST/CGST/SGST sab 0. → `buildB2bSellers` ab `itms/itm_det`
   padhta hai (purane `items`/`igst` bhi fallback ke liye rakhe hain).

2. **Galat month par chupchaap "October" ka data**
   `getMonthName("13")` → `"October"` (fallback `|| "October"`), `getQuarterForMonth(13)` → `"Quarter 4"`,
   `periodFor(fy, "13")` → `"132026"`. Matlab: client galti se month `13` (ya non-numeric) bhej de to bridge
   **October ka data** laa kar sheet me daal deta. Ab invalid month par khaali string + `fetch-all`/`upload-gstr1`
   par **400** with clear message, aur dropdown select khaali text par match nahi karta.

3. **Notices me junk rows**
   Notices page ke alawa kisi bhi 4+ cell wali table (late fee, footer, totals) ki har row "notice" ban jati thi.
   Ab row me **date** (`31/10/2026`, `31-Oct-2026`) ya **reference number** jaisa kuch hona zaroori hai.
   Saath hi `31-Oct-2026` jaisi date par pehle layout shift ho jata tha (issueDate me "View" aa jata tha) — fix.

4. **Chhote gaps:** unknown route / galat JSON body par Express ka HTML error jata tha → ab JSON;
   `submit-otp` par busy-guard nahi tha (do request overlap ho sakti thi) → add.

## Jo verify hua ki sahi hai (bina badle)

- `periodFor` ka FY-crossing math (Jan–Mar me next year), `parseAmt` ke sab portal formats (`₹`, `1,25,000.00`,
  `(250.50)`, `-10`), GSTIN ko number na samajhna.
- `buildColumnLabels` rowspan/colspan wale grouped header (E-Com TCS ka 3-line header) sahi phailta hai.
- `mapTcsColumns` — `Return Period` ko returned value nahi samajhta, header na mile to fallback + warning.
- `summarizeGstr2B` — itcavl/itcunavl ke saare groups (RCM, ISD, import, other) jodta hai, string numbers bhi.
- ZIP/JOIN 2B reading (ZIP, plain JSON, BOM), `safeFileName` path traversal, secret auth fail-closed,
  CORS (GitHub Pages + workers.dev), session expiry/TTL, `REJECT/ACCEPT` kabhi click nahi hota.

## Ab bhi khula (real portal par dekhna padega)

- 2B download ka `page.on("download")` — agar portal download **naye tab** me kholta hai to event miss ho sakta hai
  (`status.gstr2b = failed` milega, `/debug` me `gstr2bAfterGenerate` dekh lein).
- `buildB2bSellers` sirf `docdata.b2b` leta hai — amended invoices (`b2ba`) aur credit/debit notes (`cdnr`) include
  nahi hote. Amendment wale case me supplier ka total 2B ke total se thoda alag aa sakta hai.
- `options.notices` default **off** hai — client agar `options.notices` bhejna bhool jaye to notices fetch hi nahi honge
  (response me `status.notices.state = "skipped"` dikhega).
- 2B multi-file: ZIP na ho aur portal "File 1"/"File 2" de to sirf File 1 padhta hai (status `uncertain` + warning).
