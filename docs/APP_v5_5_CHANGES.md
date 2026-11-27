# App v5_5 — P0 fixes (badge, `—` vs `₹0`, timeout+Cancel, cooldown, JSON-safe call)

**Bundle:** `GST_etsy_anyfile_fix_v5_5.zip` (Drive id `1m7irxwdNNo0nY1yy-URpwa2STEZVKTcN`, 1,398,946 B)
**Base:** v5_4 (`GST_etsy_anyfile_fix_v5_4.zip`)
**Changed:** wahi 6 HTML files, har file me 117 lines badle (sab me identical patch), `node --check` se paanchon inline `<script>` blocks clean.

---

## 1. "✓ Synced" → "⚠️ Adhoora" jab kuch section fail hua ho

**Pehle:** badge sirf `pd` (portalData) hone par lagta tha, isliye 2B fail hone par bhi green "Synced" dikhta tha —
`₹0` row ka matlab samajh nahi aata tha.

**Ab:**
```js
else if (pd && (pd.partialNote || (pd.missing && (pd.missing.gstr2b || pd.missing.tcs))))
  statusBadge = `… bg-amber-50 …>⚠️ Adhoora</span>`    // hover par poora reason
else if (pd) statusBadge = `… ✓ Synced …`               // ab period + time dono dikhte hain
```
Dono badges ke niche: `2026-27 / 10 • 25-Nov-2026 11:58 pm` — yaani **kaun se mahine ka data** hai, ye saaf.

## 2. Missing section par `—`, `₹0` nahi

**Pehle:** fail hone par `igst/cgst/sgst = 0` save hote the → screen par `₹0` (asli zero jaisa).

**Ab:** save karte waqt flag aata hai:
```js
missing: {
  gstr2b: !!(data.partial && data.partial.gstr2b) && !(_pt.gstr2b && _prevPd),   // purana same-period data ho to missing nahi
  tcs:    !!(data.partial && data.partial.tcs)    && !(_pt.tcs    && _prevPd)
}
```
Row me: `—` + chhota label **"2B nahi mila"** / **"TCS nahi mila"**. Purana data maujood ho to purane number hi dikhte hain (badge Adhoora).

## 3. `gpCallBridge` ab text→JSON safe + timeout + cancel

**Pehle:** `const data = await resp.json();`
→ bridge 502/504 HTML bhejta (jaise aaj raat portal down tha) to `Unexpected token '<'` dikhta tha.

**Ab:**
```js
let raw = await resp.text(); let data = null;
try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
if (!data) throw new Error(`Bridge ne JSON ke bajaye HTTP ${resp.status} bheja (…) — thodi der baad try karein.`);
```
Saath me `AbortController` + default **2 min** timeout (har call), network fail par saaf message.

## 4. Fetch me 15 min timeout + **Cancel** button

- `gpTriggerFetchInBackground` ab controller banata hai: `st.abort = ctrl`, aur `fetch-all` `{ signal, timeoutMs: 900000 }` ke saath jata hai.
- Row me "⏳ Fetching…" ke saath **✕ Cancel** — cancel par abort + `/api/gst/logout` (bridge par session bhi free).
- Cancel karne par row "Error" nahi dikhati, seedha idle + toast `⏹ fetch cancel ho gaya`.

## 5. Fail par **90 second cool-down** (WAF se bachne ke liye)

- Fetch ya captcha-load fail → `st.cooldownUntil = now + 90000`, row me `⏳ 84s` countdown (button disabled, 1s ticker).
- `gpLoadCaptchaForClient` ke shuru me bhi guard — cooldown me click karne par toast: "⏳ 76s rukein — bar-bar retry portal ko block karta hai."
- Fail hone par session turant logout hota hai (pehle sirf success path me hota tha).

---

## Kaise lagein
1. Drive/host par purane 6 HTML files ko is v5_5 bundle se replace karein (structure same: `app/*.html`).
2. Browser me **Ctrl+Shift+R** (ya app band karke dobara kholein) — 1 MB inline HTML hai, cache clear zaroori.
3. Test: KAHKSHAN (jo aaj fail hua tha) par Re-Fetch → fail hone par row par **⚠️ Adhoora** + `—` + `2B nahi mila` dikhna chahiye, aur button 90s ke liye `⏳` ho jana chahiye.

## v5_5 me kya nahi kiya (P1/P2 — `APP_IMPROVEMENTS.md` me hai)
- Error history persist (page refresh par error gayab hota hai).
- `b2bSellersJson` 48k truncation, `ecomNet` hardcoded 0, vault ka default secret.
- 6 duplicate HTML files → 1 file + redirects.
- "Sirf adhoore/fail wale" filter, bridge se live progress (`fetch-status`).
