# 2B generate band — mile to download, na mile to "not generated" (bridge v1.24.0)

Aapne sahi pakda: app **khud `GENERATE JSON` dabata tha** aur 90 second usi ka intezaar karta tha
(screenshot: *"2B JSON generate ho rahi hai… 24s"*). Wo poora step **hata diya**.

## Ab 2B ka flow
1. 2B card ka **DOWNLOAD** dabta hai (jaise pehle).
2. Page par **pehle se bani 2B ka download link/file** hai?
   - **Haan** → file download → parse → `✓ Synced` (wahi purana result)
   - **Nahi** → page ka text dekha jata hai: error / "no records to generate" → **`not generated`**
   - kuch bhi saaf na ho → **8s + 4s** ke andar answer, phir **`not generated`** likh kar **turant TCS section** par aage
3. **`GENERATE JSON` kabhi nahi dabta. 90s ka koi wait nahi.** (`90000` code me hi nahi hai)

## Timing
| Case | Pehle | Ab |
|---|---|---|
| 2B bani hui hai | download (fast) | download (fast) |
| 2B bani hi nahi (error page) | 90s + **generate click** | **~2–4s**, `not generated` |
| Page par kuch samajh na aaye | 90s | **~12s max**, `not generated` |
| Portal session expired | 90s | **turant** saaf message |

## Verify
- `npm test` → **110/110 pass** — naya regression guard: source me `genJsonBtn`, `gstr2b_generate`, `90000` **na hon** (dobara galti se generate na jude)
- `node --check server.js` ✅
- Bridge **1.24.0** (`/health`)
- **App/web bundle me koi change nahi** — `GST_etsy_anyfile_fix_v5_8_2.zip` hi chalega

## Progress text jo ab dikhega
`GSTR-2B ka DOWNLOAD dabaya ja raha hai…` → `GSTR-2B file download ho rahi hai…` → (section done)
"2B JSON generate ho rahi hai…" wali line **ab kabhi nahi** aayegi.
