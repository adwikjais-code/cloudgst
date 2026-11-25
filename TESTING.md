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

---

# App-contract audit — Drive ka web app v5.4 (`gst_client_tracker.html`)

Source: Drive → `cloud` folder → `GST_etsy_anyfile_fix_v5_4.zip` → `app/gst_client_tracker.html`
(= `index.html`, 1 MB single-file app). Bridge side ka reference: `cloudgst_all_3_files_v11.zip` (v1.9.2).

App ke calls (jo app actually bhejta hai):

| Endpoint | Payload | App kya expect karta hai |
|---|---|---|
| `GET /api/gst/ping` | — | `ok:true` (Save & Test) |
| `POST /api/gst/init-login` | `{username, keepOthers:true}` | `sessionId`, `captchaBase64` |
| `POST /api/gst/submit-login` | `{sessionId, username, password, captcha}` | `status:"otp_required"` / `"logged_in"`; fail par `captchaBase64` (naya captcha) |
| `POST /api/gst/submit-otp` | `{sessionId, otp}` | `ok:true` |
| `POST /api/gst/fetch-all` | `{sessionId, fy, month, autoClose:true, options:{gstr2b,tcs,notices:false}}` | `gstr2b.summary{igst,cgst,sgst,cess,ineligibleTotal,b2bSuppliersCount}`, `gstr2b.b2bSellers[]`, `gstr2b.fileName`, `gstr2b.jsonBase64`, `ecommerceTcs.rows[{ecoName,ecoGstin,grossTaxableAmount,tcsIgst,tcsCgst,tcsSgst}]`, `ecommerceTcs.totalGrossTaxable/totalTcs`, `fy`, `month`, `partial` |
| `POST /api/gst/upload-gstr1` | `{sessionId, fy, month, jsonContent(obj), fileName}` | `message` |
| `POST /api/gst/logout` | `{sessionId}` | `ok:true` |

**Match tha:** endpoints, headers (`x-api-secret`), FY values (`2026-27/2025-26/2027-28`), month values (`04`..`03`),
`autoClose`, `options.notices:false`, 2B summary ke saare keys, E-Com TCS rows ke saare keys, upload ka
object-form `jsonContent` + `fp` check, `submit-login` ka `status`/`captchaBase64` contract.

**Match nahi tha (v1.13.0 me fix):**

1. **`b2bSellers` me `invoices[]` nahi thi.** App tabhi server ki list use karta hai jab `some(s => s.invoices.length)`
   ho; warna wo `jsonBase64` ko khud parse karta hai — aur us parser me `d.igst/cgst/sgst/cess` padha jata hai
   (asli 2B me `iamt/camt/samt/csamt`) → **B2B modal + sheet me tax 0**. ZIP 2B par wo seedha server list leta hai
   (bina invoices) → modal me "purana data, Re-Fetch karein" banner, invoice rows nahi.
   Ab bridge `invoices[]` (num/dt/val/txval/igst/cgst/sgst/cess/rate/itcavl/rev) + `supfildt` + `cess` bhejta hai
   → app ka primary path chalta hai, plain JSON aur ZIP dono me invoice-level detail aati hai.

2. **`partial` contract missing tha.** App `data.partial{gstr2b,tcs,text}` ke hisaab se sirf fail hue section ka
   purana data rakhta hai aur baaki save kar deta hai. Bridge har section-fail par `ok:false` deta tha → app
   kuch bhi save nahi karta tha (2B mil gaya ho tab bhi loss). Ab: kuch fail + kuch ok → `ok:true + partial`;
   saare maange gaye section fail → `ok:false` (pehle jaisa safe).

**App side me bacha hua (bridge se fix nahi hota):**

- App ka apna fallback parser abhi bhi `itm_det.igst/cgst/sgst` padhta hai (iamt/camt/samt nahi) — ab ye path
  trigger nahi hota kyunki bridge `invoices[]` bhejta hai, par purane saved data par 0 dikh sakta hai.
- Sheet me `b2bSellersJson` 48 KB par truncate hota hai (app end se sellers pop karta hai) — bahut bade client
  (~400+ invoices) me sheet wali copy adhoori ho sakti hai; live modal theek rahega.
- App ka `ecoPlat`/`ecomNet` app me hi 0 hardcoded hai (bridge se `ecommerceTcs.totalNetValue` aata hai, use nahi karta).

**Chhote notes:** app ka default cloud URL `https://cloudgst-production.up.railway.app` hai (Railway), jabki
server.js ke messages "Render" kehte hain — sirf text hai, function par asar nahi. App har client ke liye
`keepOthers:true` bhejta hai (bridge max 2 bina-login sessions rakhta hai) — 3+ captcha ek saath khule to sabse
purana band ho sakta hai ("Session expired").

---

# Troubleshooting: "Data fetch nahi hua (Sheet me save nahi kiya)"

## `GSTR-2B: page.waitForSelector: Timeout 25000ms exceeded` + `E-Com TCS: Menu me 'TDS and TCS credit received' link nahi mila`

**Dono ek hi baat hai: us client ka Returns Dashboard khul hi nahi paya.**
`openReturnsDashboardAndSearch()` me FY/Quarter/Month ke dropdowns ka wait hota hai; wo na mile to GSTR-2B
step wahin ruk jata hai. Usi page par TCS ke liye menu link dhunda jata hai — page dashboard hi nahi tha,
isliye wo bhi nahi mila. 2B aur TCS dono maange gaye the → v1.13 ka `partial` rule bhi `ok:false` deta hai
(dono fail) → app "Data fetch nahi hua" dikhata hai, sheet me kuch save nahi hota.

Kabhi kabhi 88 me se 1-2 client par aata hai (baaki sync ho jate hain) — matlab bridge-wide bug nahi,
us ek login ka page tha. Sabse aam wajah:

1. **Portal slow / WAF** — 25s wait kam pad jata hai, ya `return.gst.gov.in` direct load par blank page deta hai.
2. **Popup naya tab** — RETURNS DASHBOARD click se dashboard naye tab me khulta hai; hum purane tab par ruke rehte the.
3. **Blocking modal** — "Remind me later", "OK", "Proceed" jaisa popup / pending-return ya Aadhaar alert.
4. **Client-specific portal state** — GSTIN cancelled/suspended, "already logged in from another device", ya previous
   period ka return pending — aise case me dashboard dropdowns ke bina koi message page dikhata hai.

**v1.14.0 me kya fix hua:**
- Dropdown wait 25s → **40s**, aur modals zyada tarah se dismiss (Proceed/Continue/I Agree + Esc).
- Fail hone par **ek retry**: seedha `return.gst.gov.in/returns/auth/dashboard` kholta hai.
- Click se **naya tab** khule to wo page adopt kar leta hai (aage 2B/TCS usi page par).
- Fail hone par error message me **asli page ka URL + title + visible buttons** aate hain, aur `/debug` me
  `<step>_selectTimeoutAt` aur `<step>_stuck` (page ka 500-char text, selects, buttons) save hote hain.
- TCS menu link na mile to `/debug` me `tcsLinks` — page par TDS/TCS/returns se jude saare links (text + href).

**Aage kya karein (agar phir aaye):**
1. Us client ko dobara Fetch karein — retry/popup fix se aksar pehli hi baar me ho jata hai.
2. Phir bhi error aaye to error line me diya gaya URL/title dekhein:
   - `Session Expired` / "already logged in" → portal par purana session band karein (ya 5 min wait), phir login.
   - `services.gst.gov.in/...` hi rahe (dashboard par jata hi nahi) → WAF/slow; thodi der baad dobara.
   - "cancelled/suspended" jaisa message → client ka GSTIN status portal par check karein.
3. `tcsLinks` me agar link ka naam alag hai (jaise "TDS/TCS credit received") to us naam ka regex `clickTcsMenu()` me add karna hai.

---

## `Returns Dashboard access nahi mila ... https://services.gst.gov.in/services/error/accessdenied`

Portal ne us login ko **Access Denied** page de diya — matlab login hua, par returns section kholne par portal ne mana kar diya.
Ye bridge ka bug nahi hota; portal (ya us GSTIN ke session) ka state hota hai. v1.15.0 se bridge ye page pehchanta hai
(`access_denied`) aur:

1. 8 second "cool down" deta hai,
2. **Auth Dashboard** (`services.gst.gov.in/services/auth/dashboard`) se dobara RETURN DASHBOARD click karta hai
   (direct URL goto se portal ka WAF naraz hota hai, isliye click wala rasta use hota hai),
3. phir bhi na chale to error me wajah + kya karein likhta hai.

Sabse aam wajah (order me):
1. **Wahi GSTIN kisi doosre device/browser par pehle se login hai** → portal par purana session logout karein, ya 10 min ruk jayein.
2. **Bahut jaldi-jaldi logins** (ek hi IP se 80+ clients) → portal ka WAF rate-limit; 5-10 min baad dobara.
3. **GSTIN cancelled/suspended** → portal par status check karein.
4. **Multi-GSTIN login me GSTIN select nahi hua** → portal par login karke GSTIN select karna padega.

Bridge `/debug` me is case me: `<step>_stuck.kind = "access_denied"`, us page ka URL/text/buttons, aur
`<step>_stuck2` (retry ke baad ka page). TCS ka error usi wajah ka doosra lakshan hota hai.

---

## `Portal par period select nahi ho paya (FY:true, Month:false)`

Matlab: Returns Dashboard khul gaya, par bridge FY/Quarter/Month dropdown theek se set nahi kar paya —
aur bina period set kiye jo data aata hai wo **galat month ka** hota hai (isliye bridge aage badhne se rok deta hai;
pehle aisa hone par GSTR-2B ₹0 save ho jata tha aur app us row ko "Synced" dikha deta tha).

v1.16.0 me bridge:
1. Page ke saare `<select>` padhta hai aur naam/options dekh kar pehchanta hai kaun sa FY, kaun sa Quarter, kaun sa Month hai
   (portal ke labels badal jate hain — kabhi `fy`, kabhi kuch aur; quarter kabhi "Quarter 3", kabhi "Q3", kabhi "Oct - Dec").
2. Har dropdown me 600ms ke gap par polling karta hai (options AJAX se der se aate hain) — FY 9s, month 9s, quarter 6s.
3. Poora period ek baar na ho to 2.5s ruk kar **dobara** karta hai (password change/redirect ke baad dashboard der se bharta hai).
4. Quarter dropdown na ho to bhi chalta hai (month hi period ka authority hai); FY + Month match hona zaroori hai.

Aam wajah:
1. **Password change ke turant baad** portal dashboard aadha bhara deta hai → ab bridge khud retry karta hai, phir bhi
   2 min ruk kar ek hi baar Fetch karein.
2. Client ka GSTIN portal par **kisi doosre device par login** hai → purana session logout karayein.
3. Portal bahut slow / WAF rate-limit (ek hi IP se 80+ clients) → 10 min baad.

Bridge `/debug` me is case me: `<step>_selects` (kaun se dropdown, kya options), `<step>_periodSelectFail`
(FY/quarter/month ka result + poora dropdown dump), aur fail hone par `<step>_dashboard` nahi milega.

**Zaroori:** v1.16.0 deploy ke pehle jo client fail hua tha, uska purana ₹0 data app me "Synced" dikh sakta hai —
us client ko **Re-Fetch** karein, tab hi naye number par bharosa karein.
