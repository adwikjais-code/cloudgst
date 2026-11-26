# "Edit karke Save dabata hoon, kabhi save hota hai kabhi nahi" — 3 wajah + fix (v5_8_10)

## Wajah 1 — Browser chup-chaap submit rok deta tha (sabse bada reason)
Form me `required` (Client, Firm) aur `number` fields par `min/max/step` lage the:
- `Due Months` = `min 0 max 36` → **36 se zyada** ya khaali → browser submit hi nahi karta
- `ROV` = `number step=0.01` → **"1,200"** ya **"-5"** jaisa kuch → submit nahi hota
- Client/Firm khaali chhod diya → submit nahi hota

Aur Safari me wo validation bubble **scroll ke peeche chhup jata tha** — screen par kuch dikhta hi nahi tha.
Isliye "kabhi kabhi save nahi hota" lagta tha.

**Fix:** form par `novalidate` + apni validation —
- naam/firm khaali → saaf toast + us field par laal ring
- numbers khud saaf hote hain (`"1,200"` → `1200`, dueMon 0–36 me clamp)
- `invalid` event par bhi toast (koi field chhoot jaye to pata chal jaye)

## Wajah 2 — `sr` type mismatch = bilkul silent no-op
Save handler `clients.find(c => c.sr === parseInt(srVal, 10))` se record dhoondhta tha.
Sheet/sync ke baad `sr` kabhi **string** ("12") hota hai → `=== 12` fail → target nahi mila →
function chup-chaap modal band kar deta tha (**na save, na message**).

**Fix:** `Number(c.sr) === Number(srVal)`; phir bhi na mile to saaf message:
*"⚠️ Ye client record nahi mila (list refresh ho gayi hogi) — modal band karke dobara Edit dabayein"*

## Wajah 3 — double click / error chhup jana
- Save dabate hi button ab **"Saving…"** ho kar disable hota hai (doosra click duplicate save nahi karega)
- Poora save `try/catch/finally` me — error aaye to toast me dikhega, aur button wapas enable hoga
- Har case me confirmation: `✅ Saved` ya `⚠️ Sheet Sync FAIL` (chup-chaap kuch na hona khatam)

## Test kaise karein
1. Kisi client par **View/Edit** → Firm khaali karke Save → ab **saaf toast** aayega (pehle kuch nahi hota tha)
2. ROV me `2,500` likh kar Save → save ho jayega (pehle block hota tha)
3. Due Months 40 karke Save → 36 ho jayega aur save hoga
4. Do baar jaldi-jaldi Save → sirf ek save jayega

**Zip:** `GST_etsy_anyfile_fix_v5_8_10.zip` · 251,119 B · MD5 `0330ff0de67c8ade842e0e4a4c774551`
(Bridge me koi change nahi — 1.28.0 hi; Apps Script bhi wahi v5_8_9 wala, dobara paste karne ki zaroorat nahi)
