# Feature — 📄 GSTR-1 "Prepare Online" shortcut (APK v5.9.2 / app v5_8_13)

Aapka sawaal: *"captcha dal ke login karne ke baad upar ek button click karte hi seedha Prepare Online wala page khul jaye us month ka"* — **haan, ban gaya.**

---

## Kaise kaam karta hai (3 step)

1. Portal tab me client ke aage **🌐 Portal Login** dabayein → GST portal app ke andar khulta hai, **ID/password pehle se bhare** hote hain.
2. **Captcha aap dalte hain** aur **Login** dabate hain (yahi hissa app kabhi khud nahi karta — neeche "kya nahi karta" dekhein).
3. Login hone ke baad upar **📄 GSTR-1** (hara button) dabayein → app khud portal ke apne buttons dabakari:
   `dashboard → GSTR-1 → PREPARE ONLINE` → aur wahan **aapke chune hue month** ka period select kar deti hai.

Screen ke upar message aata hai: **"✅ GSTR-1 Prepare Online khul gaya — month October (2026-27) check karein"**. Agar portal slow/WAF ke karan page na khule to saaf message: **"⚠️ Portal ne GSTR-1 page khud nahi khola — dashboard par Returns → GSTR-1 dabayein"** (dead-end nahi).

Month kahan se aata hai? Portal tab ke **FY + Month** selector se — wahi `102026` (MMYYYY) aur "October (2026-27)" app native ko bhejti hai, isliye sahi month ka page khulta hai.

## Kya NAHI karta (jaan-boojh kar)

- **Captcha auto-solve/fill nahi** — captcha ka kaam hi automation rokna hai; usko bypass karna portal TOS + security control todta hai aur aapke/client ke login par **account lock** ka risk daalta hai. Isliye captcha hamesha aap daloge.
- **Kuch submit/ACCEPT/REJECT nahi** hota — sirf navigation (page kholna) aur month dropdown set karna. GSTR-1 file upload/preview ka final button aap hi dabate hain.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.2** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.2/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_13** (Drive) | https://drive.google.com/file/d/1zBBHcvcB90haIMIQ4-GxggaV2KnEp2Yg/view |

**APK v5.9.2:** size **3,153,040 B**, SHA-256 `891866a076709bd22258d09fc47d698cf777f2cb2c0af8f55f0b526f5f23a390`, MD5 `7d3188f8938b87e7c00a935eac1cbe96` — purane APK ke upar seedha update (data safe).
**Zip v5_8_13:** 251,314 B, md5 `9b732050565b51186b44077ba63ba793`, integrity OK, andar `app/index.html` = 1,147,459 bytes (= APK ke andar ki hi file).

---

## Proof (sandbox test)

**1) Portal click-chain test (asli Java code se nikala gaya JS, jsdom me 7/7 PASS):**

| Fake portal page | Result |
|---|---|
| Dashboard (GSTR-1 tile) | **CLICKED:GSTR1** — `GSTR-1` tile par click ✅ |
| Returns page ("PREPARE ONLINE" button) | **CLICKED:PREPARE** — thik wahi button click ✅ |
| Prepare page (URL `…/gstr1/prepare` + period dropdown) | **DONE** + month `October` select ho gaya ✅ |
| URL na badle, page par "SAVE GSTR-1" dikhe | **DONE** (content se pehchana) ✅ |
| Anjaan page (Notices) | **NONE** — kuch galat click nahi, message ✅ |
| Login page | **NONE** (pehle hi rok deta hai) ✅ |

**2) Month/FY test (8/8 PASS):** Oct + FY26-27 → `102026`, Feb → `022027`, Apr → `042026`, Mar + FY27-28 → `032028`; label `October (2026-27)`; `openPortal(...)` ab **5 arguments** (ID, password, GSTIN, fp, month-label) ke saath call hota hai.

**3) Regression (purana sab kuch waisa):** mobile hooks **17/17 PASS**, dropdown + PDF share **18/18 PASS**, PDF native share test **PASS**.

**4) APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,147,459** (= test file), js back handler 1, js bio toggle 2, js native portal 2, dex BiometricPrompt 6, dex saveBase64 3.

---

## Note

- Pehli baar click par portal thoda slow ho to app **12 baar tak (har 1.6s)** khud retry karti hai, phir bhi na khule to message dikha deti hai — aap manually Returns → GSTR-1 dabа sakte hain.
- GST portal apna layout badal de to sirf yeh shortcut kaam karna band karega (baaki app par koi asar nahi) — tab message aayega, app crash nahi hogi.
- Apps Script / bridge me **koi change nahi** (bridge 1.28.0, `APPS_SCRIPT_AppSync.gs` wahi).
