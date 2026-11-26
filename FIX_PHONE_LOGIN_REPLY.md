# "Phone login: time par jawab nahi aaya" — fix (APK v5.9.10)

Screenshot me yeh aaya: **"❌ Phone login: time par jawab nahi aaya."**

## Matlab kya tha
App native engine ka jawab **sirf ek hi tarike se** leti thi — native apni taraf se `gpPhoneFetchReady()` "push" karta tha. Woh push kabhi na pahunche (ya JS side par ruk jaye) to app **170 sec tak intezaar** karke bas "time par jawab nahi aaya" dikha deti thi — kaam ka pata hi nahi chalta tha.

## Fix
1. **Ab app khud native se POOCHHTI hai (polling, har 1.2s)** — `phonePayloadFor(id)` + `phoneStage()`.
   Push ho jaye to turant, na ho to bhi **1.2 sec me jawab mil jata hai**. Yeh poori class ka bug khatam.
2. **Har error me ab step likha aata hai**, jaise:
   `Phone login: … (step: login:load:login)` ya `(step: login:captcha-image)` —
   yaani pata chal jata hai ki rukna kis kadam par hua (page load / captcha / submit).
3. **Phone login ka timeout 150s (native)**, app 160s tak dekhti hai — ab native ka **asli message** dikhta hai, app ka generic timeout nahi.
4. Captcha/OTP/2B fetch — teeno ab isi polling par hain (hya cloud-jaisa flow: captcha app me, login back me).

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.10** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.10/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_20** (Drive) | https://drive.google.com/file/d/1ljmNGWzEIlfpH6LhYQKC0QRSriWYsj4V/view |

**APK v5.9.10:** size **3,173,480 B**, SHA-256 `d73868ad81ecbf717dbcaed89467582d039394ace4065b2a31327060b71d8454`, MD5 `2dfc55501a51c490ee1a84aa00c1bfab`.
**Zip v5_8_20:** 255,476 B, md5 `a7dffc807a8c010c7d151431eae85337`, andar `app/index.html` = 1,166,593 bytes (= APK ke andar ki hi file).

---

## Proof

**"Push band" test — 8/8 PASS** (jaisa aapke phone par hua):
| Test | Result |
|---|---|
| Push **kabhi na aaye** → poll se captcha mila | ✅ |
| portalId + password native tak | ✅ |
| captcha submit → poll se loggedIn | ✅ |
| OTP → poll se loggedIn | ✅ |
| 2B fetch → poll se data | ✅ |
| error payload → code ke saath reject | ✅ `network` |

**Baaki sab:** login page scripts **9/9**, login-first flow **17/17**, serial/network **13/13**, switch **17/17**, 2B JSON **8/8**, portal page script **11/11**, thread/crash **15/15**, mobile hooks **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, GSTR-1/3B **10/10**, FY/month **8/8**.

**APK verify:** `manifest ok`, **index.html 1,166,593 bytes**, `dex phone login: 2`, **`dex phone poll: 1`**, **`js phone poll: 5`**.

---

## Ab try karein
1. **v5.9.10 install karein** → switch **📱 Phone** → Re-Fetch.
2. Captcha app me aayega (portal screen nahi) → daalein → OTP maange to daalein → 2B background me.
3. Kuch phir bhi atke to ab message me **(step: …)** hoga — woh screenshot bhej dijiye, main usi step par seedha fix kar dunga. (Jaise `load:login` = page load; `captcha-image` = captcha laane me dikkat.)
4. Turant kaam chahiye → **☁️ Cloud** (waisa hi hai).

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
