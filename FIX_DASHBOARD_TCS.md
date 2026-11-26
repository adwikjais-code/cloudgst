# "TCS aata tha, ab nahi aa raha" — bridge v1.25.0

Screenshot ka error:
```
Data fetch nahi hua (Sheet me save nahi kiya) →
GSTR-2B: Portal par period select nahi ho paya (FY:true, Month:false).
         Page: … | User Dashboard — https://services.gst.gov.in/services/auth/dashboard
         Dropdowns mile -> select0: 2019-2…
E-Com TCS: 'TDS and TCS credit received' page par PREPARE ONLINE (ya VIEW) button nahi mila.
```

## 3 asli wajah (teeno theek)
### 1) Portal ne "User Dashboard" par phenk diya (Month dropdown hi nahi)
RETURN DASHBOARD dabane ke baad portal kabhi-kabhi wapas **User Dashboard** par bhej deta hai.
Wahan sirf FY wala dropdown hota hai (`select0: 2019-20…`) → FY true, Month false → wahi error.

**Fix:** period select se pehle check — agar month dropdown hi nahi hai to **seedha Returns Dashboard URL** khol kar
dobara try. Attempt fail ho to **page reload** karke teesri koshish (pehle sirf wait karta tha, page fresh nahi hota tha).

### 2) TCS section galat page se shuru ho raha tha
Pehle TCS dashboard **sirf tab** kholta tha jab 2B band ho. 2B fail hone par page 2B ke page par atka reh jata tha
→ TDS/TCS menu hi nahi milta → PREPARE ONLINE nahi milta.

**Fix:** TCS se pehle — agar hum returns dashboard par **nahi** hain, to khud dashboard kholta hai.

### 3) (v1.22 ka regression) PREPARE ONLINE ka wait jaldi chhoot raha tha
v1.22 me SEARCH ke baad ka fixed wait hata kar "jaldi aage badho" lagaya tha; page par transient "no data" text
milte hi aage badh jata tha, jabki **PREPARE ONLINE** button render hona baaki tha → jhoota "button nahi mila".

**Fix:** ab SEARCH ke baad **button ka** intezaar hota hai (1s steps, max 12s) — button jaldi aaye to jaldi,
warna poora time. "no data/records" ab early-exit signal nahi (wo snapshot se asli state dekh kar decide hota hai).

## Timing (jaldi wala behaviour bacha hua hai)
| Step | Wait |
|---|---|
| PREPARE ONLINE / VIEW button | milte hi aage, max **12s** |
| PREPARE ONLINE ke baad summary | "number of records" aate hi, max 6s |
| Card click ke baad summary | max 4s (3 attempts) |
| 2B not-generated | **turant** (v1.24 ka fast path waisa hi) |

## Verify
- `npm test` → **111/111 pass** (naya test: `isReturnsDashboardUrl` — returns vs user dashboard)
- `node --check server.js` ✅
- Bridge **1.25.0** — `/health`
- **App/web bundle me koi change nahi** — `GST_etsy_anyfile_fix_v5_8_2.zip` hi chalega

## Agar phir bhi TCS na aaye
Us client par ek baar **Re-Fetch** chalaiye aur error line bhej dijiye — message me ab `tcs_*` debug keys hote hain
(`tcs_tcsPageExcerpt`, `tcs_cardsPage`, `tcs_tdsAndTcsPage`), jisse pata chal jayega portal ne kaunsa page diya.
