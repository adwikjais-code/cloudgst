# v5_8_3 + bridge 1.27.0 — "2B not generated" error nahi, TCS purana wala

## 1) 2B generate nahi hui = **error nahi** (aapki baat)

Pehle bridge `not generated` ko **failure** ginta tha, isliye screen par ye aa jata tha:

> ❌ Data fetch nahi hua (Sheet me save nahi kiya) → GSTR-2B: … | E-Com TCS: …

Ab 2B "not generated" ek **normal state** hai (`not_generated`, failure nahi):
- fetch **✓ ho jata hai**, Sheet me **save hota hai**
- row me red Error badge **nahi** aata
- 2B wale column me `₹0` ki jagah — **`not generated this month`** (grey italic)
- TCS alag se chalta hai; uske numbers normal aate hain

Sheet me `GSTR2B_Status` = `NOT_GENERATED` (jaisa pehle se tha).

## 2) TCS — purana proven rasta wapas

TCS ne v1.21 tak kaam kiya tha. v1.22 me "jaldi aage badho" wale waits lagaye the, wahi regression bane:

| Jagah | Problem | Ab |
|---|---|---|
| SEARCH ke baad | `waitForBodyMatch(/number of records/)` page par **pehle se** match ho jata tha → PREPARE ONLINE render hone se pehle check | **3.5s** fixed (v1.21) |
| PREPARE ONLINE ke baad | wahi jaldi wali wait | **4.5s** fixed (v1.21) |
| Card click ke baad | "number of records" cards page par bhi hota hai → summary khulne se pehle snapshot → *"TCS summary page khul nahi payi"* | **4s** fixed + early-empty break hataya (v1.21) |

Isliye ab TCS waisa hi chalega jaisa pehle chalta tha — 2B fail ho ya na ho.

## 3) App update (sirf 1 text)

**`GST_etsy_anyfile_fix_v5_8_3.zip`** — sirf itna change:
- 2B cell: `₹0` / `2B not generated` ki jagah **`not generated this month`**

Baaki sab v5_8_2 jaisa (UI, Drive Save, JSON folder, TCS display — kuch nahi badla).

**Drive link:** https://drive.google.com/file/d/1DnJJ2JtQGf8_L8jXcKU-NIatA2k6FLjc/view

> Zip upload karke app kholein → cache clear/refresh (ya naya tab). Bridge automatic live hai.

## Verify
- Bridge **1.27.0** `/health` ✅
- `npm test` **114/114** (naya: 2B `not_generated` ko failure nahi ginta)
- `node --check server.js` ✅
- app `index.html` md5 `2d72a3f6b65a00b815139483a19ab641`

## Test kaise karein
1. Client 8 (ADARSH MAURYA) par **Re-Fetch** → 2B cell me `not generated this month`, koi red error nahi, Sheet save.
2. Jo client TCS deta tha (jaise NAHID SULTANA — ₹412) → TCS wapas ₹412 dikhna chahiye.
