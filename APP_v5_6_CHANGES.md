# App v5_6 — P1 fixes (Adhoora filter, error history, b2b JSON, ecomNet, vault, live progress)

**Bundle:** `GST_etsy_anyfile_fix_v5_6.zip` (Drive id `1211fHVZtsRkqlIKn38J163XT6LLuP48T`, 1,407,564 B)
**Base:** v5_5 (v5_6 me v5_5 ke saare P0 fix bhi shamil hain)
**Bridge:** `v1.20.0` live (`/health` 18:59Z) — naya `GET /api/gst/fetch-status`
**Verify:** 6 files × identical patch, saare inline `<script>` blocks `node --check` clean, bridge tests **98/98**.

---

## 1. "⚠️ Adhoora" filter tab
Tab bar me naya button: **⚠️ Adhoora (N)** — sirf wo clients jinme:
- `st.phase === "error"` (abhi fail hua), ya
- saved data `partialNote` / `missing.gstr2b` / `missing.tcs` wala hai.

Roz ka kaam: 88 clients me se sirf fail wale dhoondhne ke liye scroll nahi karna padega. Count bhi live update hota hai.

## 2. Error history (page refresh ke baad bhi)
- `localStorage` key `gst_gp_errlog_v1` — per client max **3** entries (time + message).
- Error strip me: `❌ <wajah> • is client par total 3 baar fail (pichhla: 25 Nov, 11:58 pm)`.
- Fetch safal hote hi history clear + cooldown reset.
- Client theek ho gaya ho par pehle fail hua tha → halki grey line: `ℹ️ Pichhli koshish fail hui thi: … — ab theek hai`.

## 3. `b2bSellersJson` — ab chup-chaap suppliers nahi girte
**Pehle:** `while (j.length > 48000) arr.pop()` → zyada suppliers par suppliers **chup-chaap gayab**.
**Ab `gpPackB2bJson()`:**
1. JSON 48k se kam → jaisa hai waisa.
2. Zyada → pehle **sirf invoice-level detail** hatao (`invoices: []`, `invoiceDetailOmitted: true`) — saare sellers + totals bache rehte hain.
3. Phir bhi zyada → sabse **kam taxable** wale suppliers hatao aur note do: `B2B JSON me sirf 42/57 suppliers bheje (sheet cell limit)`.
Note row par amber strip me dikhta hai (silent loss nahi).

## 4. `ECom_Net` ab 0 nahi
`ecomNet: Number(ec.totalNetValue || (grossTaxable - totalReturned))` — sheet payload me bhi `localPortalObj.ecomNet` jata hai (pehle dono jagah hardcoded 0 tha).

## 5. Vault secret: hardcoded default hata diya
**Pehle:** `(gpGetBridgeSec() || "AdwikGst2026")` → secret khaali ho to bhi purane `enc:sa:` passwords ek known default password se decrypt ho jate the.
**Ab:** secret set nahi → `return null` (fail-closed). UI wahi purana message dikhata hai: "✏️ se plain password save karein".

## 6. Live fetch progress (bridge v1.20.0 ke saath)
- App har **5s** par `GET /api/gst/fetch-status?sessionId=…` poochhta hai.
- Row me: `⏳ Fetching… / 2B JSON generate ho rahi hai… 42s` (truncate + hover par poora).
- Endpoint na mile (purana bridge) → chup-chaap ignore, kuch nahi tootta.
- Fayda: user ko dikhta hai kaam ho raha hai → beech me Re-Fetch nahi dabata → WAF block kam.

---

## Kaise lagein
1. Purane 6 HTML files ko v5_6 bundle se replace karein (structure same).
2. **Ctrl+Shift+R** (cache clear zaroori).
3. Check: tab bar me **⚠️ Adhoora** dikhna chahiye; kisi client par Fetch dabane par "⏳ Fetching…" ke niche step badalta dikhega.
4. Bridge pehle se v1.20.0 hai (health check kar liya), isliye progress turant chalega.

## Ab bhi baaki (P2 — structural)
- **6 duplicate HTML files → 1** (abhi bhi 5.4 MB, har fix 6 jagah).
- 88 rows ka poora re-render (search debounce + lazy drawer).
- Sheet-side `GSTR2B_B2B_JSON` ko chhote chunks me todna (48k cell limit ka permanent hal).
