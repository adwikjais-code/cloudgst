# Login ab app ke andar — portal par redirect nahi (APK v5.9.12)

Aapne bataya: **"ispar click karne par portal par redirect kar de raha hai"** — v5.9.11 me jab page auto-pehchan nahi hota tha to maine alag portal screen (PortalLoginActivity) khol di thi. Woh hata diya.

## Ab kya hota hai
1. **Koi alag screen/redirect nahi** — login page **app ke andar hi** (app ke upar ek patli header ke saath) khulta hai:
   `🔐 GST Portal login — captcha/OTP daalein, login hote hi apne aap aage chala jayega`
   Upar **✕** se band bhi kar sakte hain — tab kuch nahi tootta, app wapas apni list par.
2. Jab page ka form auto-pehchan me aa jata hai to **captcha image seedha row me** aati hai (jaise cloud me) — tab overlay bhi nahi khulta.
3. **Login hote hi overlay khud band** ho jata hai aur **2B fetch khud shuru** — dobara Re-Fetch dabane ki zaroorat nahi.
4. Login ka intezaar ab **320 sec** tak — jaldi timeout nahi hota.
5. `⚡ Auto-Next` phone mode me ON rehta hai → ek client ke baad **agla client khud**.

> Captcha/OTP app khud solve nahi karta — woh aap dalenge (ek baar per client). Iske baad us client ka 2B background me aata hai.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.12** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.12/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_22** (Drive) | https://drive.google.com/file/d/1YpqcCjAMQ2TMb_xqk___QHMTrwYwH-iR/view |

**APK v5.9.12:** size **3,176,080 B**, SHA-256 `06ef9e833903c63409ffd578bb78f2bf2949712629d2575b5dc639cab6766ebe`, MD5 `8494c8b3e93f0a098f5e379bfc577ba2`.
**Zip v5_8_22:** 255,834 B, md5 `c9c92bfc31b647bb49ed61499064f078`, andar `app/index.html` = 1,167,972 bytes (= APK ke andar ki hi file).

---

## Proof

**Naya test — app ke andar login: 16/16 PASS**
| Test | Result |
|---|---|
| Manual-login par **portal screen nahi khulti** (redirect nahi) | ✅ |
| Uski jagah app ke andar **overlay** khulta hai | ✅ |
| Message saaf: "App ke andar login — captcha/OTP daalein" | ✅ |
| `manual-wait` stage par overlay **apne aap** (poll se) | ✅ |
| Login ke baad overlay **chhup jata hai** | ✅ |
| Login ka waqt 320s (jaldi timeout nahi) | ✅ |
| Overlay: header + ✕ close, WebView andar move + clickable | ✅ |
| Band karne par WebView wapas chhupa (index 0) | ✅ |
| Bridge UI thread par, fail par crash nahi | ✅ |
| Manual mode me polling band nahi hoti (220 tries) | ✅ |

**Regression:** login page detection **13/13**, polling **8/8**, login-first **19/19**, serial/network **13/13**, switch **17/17**, 2B JSON **8/8**, thread/crash **15/15**, mobile **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, GSTR-1/3B **10/10**, FY/month **8/8**.

**APK verify:** `manifest ok`, **index.html 1,167,972 bytes**, `dex phone login: 2`, `dex phone poll: 1`, **`dex inapp login overlay: 2`**.

---

## Ab
1. **v5.9.12 install** → 📱 Phone → Re-Fetch.
2. Captcha row me aaye to daal dein; na aaye to login page **app ke andar** khul jayega → captcha/OTP → Login.
3. Login hote hi overlay band, **2B khud** aa jayega, aur `⚡ Auto-Next` se agla client.
4. Kuch atke to error me **page ka URL/inputs/text** hoga — woh bhej dijiye.

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
