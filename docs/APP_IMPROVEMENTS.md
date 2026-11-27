# App review — `GST_etsy_anyfile_fix_v5_4.zip` (GST Client & Filing Tracker)

**Review basis:** Drive se download kiya hua v5_4 bundle (6 HTML files, har ek ~1.08 MB) + aapke bheje screenshots (IMG_0443 → IMG_0447) + bridge ke saath aaj ke live errors.
**Bridge side:** ab `v1.19.0` live hai, isliye niche sirf **app-side** cheezein hain.

---

> **Status:** P0 ke 5 fix **v5_5** me ho gaye (`APP_v5_5_CHANGES.md` dekhein). Niche P1/P2 baaki hain.

## TL;DR — 3 sabse zaroori

1. **"✓ Synced" ka matlab galat aa raha hai.** Badge sirf is baat par lagta hai ki `portalData` maujood hai — chahe GSTR-2B fetch fail hua ho. Isliye `₹0` wali row bhi "Synced" dikhti hai (aaj ki poori confusion ki jad yahi hai).
2. **Re-Fetch ka koi cooldown nahi.** Fail hote hi user turant dobara dabata hai → naya login → portal ka WAF block (`accessdenied`, phir `#username` timeout). Aaj raat ke teeno error isi chain ke hain.
3. **App ke paas network stall ke liye timeout nahi hai.** `fetch()` bina `AbortController` chalta hai, isliye "Working..." hamesha ke liye atak sakta hai aur user dobara click kar deta hai (point 2 ko aur badhata hai).

---

## P0 — aaj hi theek karne layak (chhote patch)

### 1. Status me "Adhoora" ko alag dikhao
**Kahan:** `gst_client_tracker.html` ~line 19706 (badge logic), 19738–19740 (partial strip)

Abhi:
```js
else if (pd) statusBadge = `<span …>✓ Synced</span>` + updatedAt
```
Isse `pd.partialNote` wali row bhi green "Synced" dikhti hai.

Sujhav:
```js
else if (pd && pd.partialNote) statusBadge = `
  <span class="… bg-amber-50 text-amber-800 border-amber-200" title="${gpEsc(pd.partialNote)}">⚠️ Adhoora</span>`;
else if (pd) statusBadge = `… ✓ Synced …`;
```
Aur row par period bhi likho: `✓ Synced • 2026-27/10 • 25-Nov 23:58` — user ko pata rahe ki ye number **kaun se mahine ka** hai.

### 2. Missing section ko `₹0` na dikhao, `—` dikhao
**Kahan:** ~line 19352 (`localPortalObj`), ~19736 (2B/E-com cells)

Jab 2B fetch fail ho aur purana same-period data bhi na ho, abhi `igst/cgst/sgst = 0` save hote hain — screen par `₹0` aata hai jo "asli 0" lagta hai.
Sujhav: `localPortalObj.missing = { gstr2b: !!_pt.gstr2b, tcs: !!_pt.tcs }` save karo, aur cell me:
```js
${pd.missing?.gstr2b ? '<span class="text-amber-600 font-semibold">—</span>' : gpFmtInr(itcSum)}
```
Isse `₹0` aur "data nahi mila" screen par alag dikhenge.

### 3. `gpCallBridge` ko JSON ke alawa text bhi handle karna chahiye
**Kahan:** ~line 19219 `const data = await resp.json();`

Agar Railway/bridge 502/504 HTML de de (aaj raat portal down tha), `resp.json()` phatta hai aur UI me `Unexpected token '<'` aata hai — user ko samajh hi nahi aata.
Sujhav:
```js
const raw = await resp.text();
let data = null;
try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
if (!data) throw new Error(`Bridge ne JSON ke bajaye ${resp.status} page bheja (${raw.slice(0,120).replace(/<[^>]*>/g,'')}…). Thodi der baad try karein.`);
```

### 4. Fetch me timeout + Cancel
**Kahan:** `gpTriggerFetchInBackground` (~20117–20153)

Sujhav: `AbortController` se 10 min ka timeout, aur row ke "Working…" par ek **Cancel** button. Cancel par bhi `/api/gst/logout` call karein, warna bridge par session pada rehta hai.

### 5. Fail ke baad cooldown (WAF se bachne ke liye)
**Kahan:** `gpBuildActionCellHtml` (Fetch / Re-Fetch button)

Fail hone par us client ka button **90 second disable** + countdown (`⏳ 84s`) dikhao. Saath hi global rule: ek waqt me ek hi **login attempt** (aaj `gpActiveFetches` sirf fetch count karta hai, login nahi).
Isse aaj jaisi "ek hi GSTIN par 5 logins" wali situation dobara nahi banegi.

---

## P1 — next release me

### 6. Error history save karo
Abhi `st.note` sirf memory me hai — page refresh par error gayab, aur "kitni baar fail hua" ka record nahi.
Sujhav: `pd.errorHistory = [{at, msg, kind}]` (max 5) localStorage me; row par `Error (3×)` + hover par wajah.

### 7. Purane mahine ka data dikhao, chhupao nahi
Period selector badalne par `gpGetActivePortalData()` null ho jata hai → row "Pending" lagti hai, jabki doosre mahine ka data maujood hai.
Sujhav: `Pending` ki jagah `Pending • Oct me data hai` (chhota hint + click par purana period dikhe).

### 8. `b2bSellersJson` ka silent truncation
**Kahan:** ~line 19384 — `while (j.length > 48000) arr.pop()`.

Zyada suppliers hone par **sellers chup-chaap gir jate hain** (sheet me kam B2B dikhega, user ko pata nahi chalega).
Sujhav: (a) limit badhakar 200k, ya (b) chhote field names (`n,g,s,t,i,c,s2`), ya (c) `GSTR2B_B2B_JSON_2` column me baaki chunk + `truncated:true` flag jo UI par warning dikhaye.

### 9. `ecomNet` hardcoded 0
**Kahan:** ~line 19352 `ecomNet: 0`.

Sheet ka `ECom_Net` column hamesha 0 rahega. Ya bridge se `ecomNet` lo, ya `gross - returned` calculate karke save karo.

### 10. Default vault secret hatao
**Kahan:** ~line 19180 — `(gpGetBridgeSec() || "<legacy-default-redacted>")`.

Bridge secret khaali ho to password vault ek **hardcoded known password** se decrypt hota hai. Sujhav: secret na ho to decrypt **mana** karo + Settings me laal warning, aur secret ko `text` ki jagah `password` input rakho.

---

## P2 — structure / long term

### 11. 6 duplicate HTML files → 1
`md5sum` se dekha: `index.html` aur `gst_client_tracker.html` **bilkul same** hain, baaki 4 bhi ~identical (sirf default tab ka farq). Har file 1.08 MB → ek update = 5.4 MB, aur ek hi fix 6 jagah karna padta hai (drift ka khatra: `gst_portal.html` abhi bhi thoda alag hai).
Sujhav: ek `app.html` (ya `app/` + shared `app.js`) rakho, baaki 5 files ko 10-line redirect stubs bana do (`location.replace('app.html#portal')`). Isse update 1.08 MB ka rahega aur bug fix ek jagah hoga.

### 12. 88 rows ka render
Har render me poora `<tbody>` string se ban raha hai (detail drawer HTML bhi). 80+ clients par search/typing slow ho jata hai.
Sujhav: search input par `debounce(200ms)`, sirf changed row ko re-render, aur detail HTML lazy (expand par banao — abhi bhi ban raha hai har render me).

### 13. Filters jo roz kaam aayenge
- `Sirf fail wale` / `Sirf adhoore` filter (aaj 33% par atke clients dhoondhna aasan).
- `Re-Fetch all failed` (ek-ek client ke beech 20s gap, Auto-Next jaisa queue).
- Header me chhota summary: `88 clients • 29 synced • 4 adhoore • 1 error`.

### 14. Bridge progress dikhao
`fetch-all` 2–5 min le sakta hai (2B generate 90s + TCS + downloads). Abhi sirf "Working..." dikhta hai.
Sujhav: bridge me halka `GET /api/gst/fetch-status?sessionId=` (current step + elapsed) add karke app har 5s poll kare — user ko "2B download ho raha hai (1:20)" dikhega, aur wo beech me refresh/Re-Fetch nahi karega. (Bridge side ka kaam main kar sakta hoon.)

---

## Kya ho gaya
**v5_5 ready hai** — badge "Adhoora", `—` vs `₹0`, JSON-safe bridge call, timeout + Cancel, 90s cooldown. Detail: `APP_v5_5_CHANGES.md`. Baaki (P1/P2) ke liye bolein to next bundle bana dunga.
