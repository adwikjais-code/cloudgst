# "Jaldi mile to theek, na mile to fatak se result" — bridge v1.22.0

Pehle: 2B na milne par bhi **90 second** tak wait hota tha, phir result. Ab portal khud bol de ki 2B nahi bani to
**~4–7 second** me result aa jata hai. **Koi app change nahi** — sirf bridge update (Railway par auto deploy).

## Kya badla
| Step | Pehle | Ab |
|---|---|---|
| 2B DOWNLOAD ke baad first check | 4.5s fixed wait | **1.5s** wait, phir har 3s check |
| 2B page par "could not be generated / no records to generate" | 90s poora wait, phir detect | **pehle hi poll me detect → turant break** |
| Portal session expire | 90s wait, phir generic error | **turant** "session expire ho gaya — dobara fetch karein" |
| TCS: SEARCH ke baad | 3.5s fixed | PREPARE ONLINE / "no records" dikhte hi aage |
| TCS: PREPARE ONLINE ke baad | 4.5s fixed | "number of records" / "TCS credit received" dikhte hi |
| TCS: card click ke baad (3 attempts × 4s) | 12s tak | summary **ya "no records"** dikhte hi ruk jata hai |
| TCS khaali hai | 3 attempts ke baad pata chalta | `tcsEmptyFast` — pehle attempt me hi |

Naya helper: `waitForBodyMatch(page, regex, maxMs, stepMs)` — text jitni jaldi aa jaye utni jaldi wapas;
`isTcsEmpty()` aur `isGstr2bNotGeneratedFast()` (sirf pakki lines, normal page ke disclaimer se false-positive nahi).

## Fayda (khaas kar jo client 2B nahi banti)
Aapke screenshot wale client par: **~90s → ~5s**.
`not generated` label usi turant result ke saath row me aa jata hai.

## Verify
- `npm test` → **105/105 pass** (4 naye: fast match, timeout, TCS empty, strict regex)
- `node --check server.js` ✅
- Version **1.22.0** — deploy ke baad `/health` par dikhega
- App/web bundle: **koi change nahi** (`GST_etsy_anyfile_fix_v5_8_2.zip` hi chalega)

## Note
2B **ban rahi ho** to jaan-boojh kar 90s tak dekhte rehte hain (portal ko 30–90s lagte hain) — wahan
jaldi chhodne se adhoora data aata. Isliye "jaldi chhodo" sirf un cases me hai jahan portal saaf bolta hai
ki 2B nahi banegi / session gaya / records hi nahi.
