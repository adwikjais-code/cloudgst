# Phone mode — "bina captcha process, phir NONE error" ka fix (APK v5.9.8)

Aapne bataya: **"bina captcha ke process ho raha hai aur kuch hue bina ye dikha raha hai: Phone mode: portal ne 2B card/DOWNLOAD nahi diya (aakhri: NONE)"**. Do asli karan mile — dono fix.

---

## Karan 1 — chhupa WebView asli page render hi nahi kar raha tha
v5.9.6/5.9.7 me phone-mode ka WebView **1dp × 1dp aur invisible** tha. Android aise WebView ka layout/paint nahi karta, isliye page ke saare button/link "gayab" (invisible) gine jate the → code ko 2B card/DOWNLOAD kabhi mila hi nahi → `NONE` error.
**Fix:** ab woh WebView **poora full-size** hai aur app ke apne WebView ke **peechhe** rakha hai — user ko kabhi dikhta nahi, lekin page asli tarah render hota hai.

## Karan 2 — login ka rasta hi nahi tha (isliye captcha/OTP nahi maanga)
Phone mode phone ki purani portal session par chalta hai. Jab woh session nahi hota, code **chup-chaap 60 baar page check karta rehta tha** (koi captcha/OTP nahi) aur 2.5 minute baad `NONE` error deta tha — bilkul wahi jo aapne dekha.
**Fix:** ab login ka **pehle** check hota hai —
- Phone par us client ka login nahi → app turant bolegi aur **login screen khud khulegi** (wahi purana Portal Login, jisme captcha + OTP **aap** dalenge).
- Login hone ke baad fetch **poora background me** (chhupa WebView) chalega — screen par portal nahi dikhega.
- Agar session beech me khatam ho jaye → wahi login screen khud khul jayegi, koi 2.5 minute ka intezar nahi.

> Captcha/OTP ko app khud solve nahi karti aur nahi karegi — woh **aap** dalenge (ek baar per client). Uske baad sab background.

## Karan 3 (bonus) — error me ab asli wajah dikhegi
Pehle sirf `NONE` aata tha. Ab har error me portal ka **page URL + title + page ka text** ka chhota hissa aata hai, jaise:
`… (aakhri: NONE | page: https://returns.gst.gov.in/… | Access Denied …)`
Isse turant pata chal jayega ki portal ne kya dikhaya (login maanga? access denied? slow?).
Aur agar page ke andar script error ho to `ERR:…` token aayega — chhup-chaap `NONE` nahi.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.8** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.8/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_18** (Drive) | https://drive.google.com/file/d/1cvpWyWKXjoIl5PZTAq3jXLv9G6b4W2m-/view |

**APK v5.9.8:** size **3,164,251 B**, SHA-256 `b82a68c156507ec3ba8292ee58b94c161a616e0645b40a4061fc728819f2c1c5`, MD5 `dc3f7a9b44f481dd3b2b389ce552e2d8` — purane APK ke upar seedha update.
**Zip v5_8_18:** 254,556 B, md5 `a1af7ee2a6fe4cda7ee510f3059e267d`, andar `app/index.html` = 1,161,152 bytes (= APK ke andar ki hi file).

---

## Proof (naye tests)

**1) Portal page ke asli HTML par phone-mode script — 11/11 PASS** (jsdom me asli page banaye):
| Test | Result |
|---|---|
| Login page → `LOGIN` (login maanga jayega) | ✅ |
| Dashboard ke 2 selects → `SETTING` (FY+month set) | ✅ |
| 2B card + DOWNLOAD → `CLICKED` | ✅ |
| Portal "not generated" → `NOTGEN` | ✅ |
| `RETURN DASHBOARD` link → `OPENING` | ✅ |
| Anjaan page (Access Denied) → `NONE` + **page ka text** | ✅ |
| Page ke andar error → `ERR:boom` (chhup-chaap NONE nahi) | ✅ |

**2) Login-pehle + render fix — 14/14 PASS:** login check fetch se **pehle**, login nahi to **login screen khud khulti hai**, login se pehle fetch start nahi hota, login message me captcha+OTP likha, chhupa WebView **MATCH_PARENT** + app ke **peechhe (index 0)**, purana 1dp/invisible hack hata, page diagnostics collect+error me, `ERR` token handle.

**3) Regression (kuch nahi toota):** switch **17/17**, 2B JSON+totals **8/8**, thread/crash **15/15**, mobile hooks **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, popup fix **7/7**, GSTR-1/3B **10/10**, FY/month **8/8**, PDF share **PASS**.

**APK build verify:** `manifest ok`, **index.html 1,161,152 bytes**, `dex phone fetch: 1`, `dex ui-thread start: 2`.

---

## Ab kaise chalega
1. **v5.9.8 install karein.**
2. Switch **📱 Phone**, phir kisi client ka **Re-Fetch** dabayein:
   - pehli baar → **login screen khud khulegi** (captcha + OTP aap dalenge) → Login.
   - wapas aakar **Re-Fetch** → **background me** 2B aa jayega (portal screen nahi khulega).
3. Kuch galat ho to ab error me **page ka URL/text** dikhega — woh mujhe bhej dijiye, main usi hisaab se theek kar dunga.
4. TCS ya jaldi kaam ke liye switch **☁️ Cloud** — wahan sab pehle jaisa hai.

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
