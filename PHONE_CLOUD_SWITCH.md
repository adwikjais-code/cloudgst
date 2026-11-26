# 📱 Phone / ☁️ Cloud switch — phone mode background me (APK v5.9.6)

Aapka sawaal: *"upar switch kar sake phone aur cloud — jab phone se karna ho to phone se, jab cloud se karna ho to cloud se, aur phone mode me login back me ho, screen par na dikhe."* — **ban gaya.**

---

## 1) Switch kidhar hai
APK me upar **toolbar** me: `📱 Phone | ☁️ Cloud` (🔒 Lock aur 👆 Fingerprint ke bilkul paas).
Ek tap se mode badalta hai aur yaad rehta hai (app band karne ke baad bhi). Default = **📱 Phone**.
Browser/zip me yeh switch **nahi dikhta** (wahan cloud hi chalta hai — browser me GST portal ka session app ko nahi milta, yeh browser ka security rule hai).

## 2) Phone mode kya karta hai
- Data **seedha phone se** aata hai — Railway cloud ko call hi nahi jata.
- Portal **chhupe hue (invisible) WebView** me chalta hai: **screen par koi portal page nahi khulta**.
  App apni list me hi status dikhati hai: *"📱 Phone se 2B la rahe hain…"*.
- Jo GST portal login **pehle se phone par hai** (🌐 Portal Login se jo aapne kiya), wahi session use hota hai.
- 2B file phone par download hoti hai, app hi ZIP khol kar JSON padhti hai, aur **GST Details Sheet / B2B list** me wahi data bharta hai (cloud jaisa hi).

## 3) ☁️ Cloud mode
Bilkul **pehle jaisa** — Railway bridge (Playwright). Isme phone band kar sakte hain, TCS bhi aata hai, aur ye laptop/phone dono par chalta hai.

---

## Imaandaar baatein (pehle se saaf)
1. **Pehli baar login (har client ke liye) khud karna padega** — GST portal login me **captcha** aata hai, aur captcha solve karna na app karta hai na main karunga (policy). Ek baar 🌐 Portal Login se login kar lijiye (30 second), uske baad **usi client ka phone-mode fetch background me, bina screen** chalta hai. Session khatam ho to app saaf bolegi *"ek baar login karein"*.
2. **Phone mode v1 me sirf GSTR-2B** (B2B + invoice detail + totals) aata hai. **TCS** abhi cloud mode me hi aayega — uski row phone mode me "cloud mode me aata hai" likh kar skip hoti hai (jhooth nahi bolta).
3. **Maine GST portal par khud login karke test nahi kiya** (aapke credentials mere paas nahi). Code + 25 tests pass hain, lekin asli portal par pehla test aapke phone par hoga. Kuch bhi unexpected ho to app **saaf error + "☁️ Cloud mode try karein"** deti hai — chup-chaap fail nahi hoti.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.6** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.6/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_16** (Drive) | https://drive.google.com/file/d/1ioF-Xwf2z1MCXxTjQ0pJjqs-sijUR3yi/view |

**APK v5.9.6:** size **3,162,679 B**, SHA-256 `3239166601e1b04e40ef7b169e3f6e0c947c58a6854e8ba3e819b465eafcf421`, MD5 `c98597b31dbe6ce94d3ef16e89a9fd8b` — purane APK ke upar seedha update (data safe).
**Zip v5_8_16:** 254,234 B, md5 `ffff822340a33112ebd2542fc6b9755c`, andar `app/index.html` = 1,160,057 bytes (= APK ke andar ki hi file).

---

## Proof (sandbox tests)

**Naya — switch + phone mode: 17/17 PASS**

| Test | Result |
|---|---|
| APK me header switch bana | ✅ |
| Switch visible (chhupta nahi) | ✅ |
| Default mode = 📱 Phone | ✅ |
| Phone chip active dikhta hai | ✅ |
| 👆 Fingerprint button bhi maujood (purana feature intact) | ✅ |
| ☁️ Cloud chip click → mode cloud + save | ✅ |
| Paint sahi badalta hai (active/inactive) | ✅ |
| Wapas 📱 Phone → mode phone | ✅ |
| Phone fetch resolve (2B JSON + fileName) | ✅ |
| Native ko FY + month bheja | ✅ `2026-27` / `October (2026-27)` |
| 700 KB bada payload chunk-wise poora aaya | ✅ |
| Session nahi (`login_required`) → saaf error | ✅ |
| Browser: switch hidden | ✅ |
| Browser: mode cloud | ✅ |
| Browser: phone mode off | ✅ |
| Browser: password popup pehle jaisa | ✅ |

**Naya — 2B JSON parse + totals: 8/8 PASS** (asli 2B JSON jaisa sample: 2 sellers, 3 invoices — invoices ki date/no, IGST 2160, CGST/SGST 450/450, taxable 17000, **₹0 nahi**).

**Regression (kuch nahi toota):** mobile hooks **17/17**, dropdown+PDF **18/18**, fingerprint button **14/14**, fingerprint ke baad password popup fix **7/7**, GSTR-1/3B **10/10**, month/FY **8/8**, PDF share **PASS**.

**APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,160,057**, `js source switch: 2`, `js phone fetch: 3`, **`dex phone fetch: 1`**, `dex bioStatus: 2`.

---

## Kaise use karein
1. Naya APK install karein.
2. Upar switch **📱 Phone** par rakhein (default).
3. Jis client ka data chahiye, uska **🌐 Portal Login** ek baar dabayein → captcha dal kar Login (portal screen yahan dikhega — sirf pehli baar).
4. Wapas app me aakar us client ka **🔄 Fetch** dabayein → **screen par kuch nahi khulega**, bas app me progress dikhega, phir data Sheet me save.
5. Jab cloud se karna ho (ya TCS bhi chahiye) → switch **☁️ Cloud**.

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
