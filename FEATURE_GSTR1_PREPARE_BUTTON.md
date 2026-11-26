# Feature — 📄 GSTR-1 + 📄 GSTR-3B "Prepare Online" shortcuts (APK v5.9.3)

Aapka sawaal: *"captcha dal ke login karne ke baad upar ek button click karte hi seedha Prepare Online wala page khul jaye us month ka"* — GSTR-1 ke saath **ab GSTR-3B ka bhi button** ban gaya (APK **v5.9.3**).

---

## Kaise kaam karta hai (3 step)

1. Portal tab me client ke aage **🌐 Portal Login** → GST portal app ke andar khulta hai, **ID/password pehle se bhare**.
2. **Captcha aap dalte hain** + **Login** dabate hain (yahi hissa app kabhi khud nahi karta).
3. Login ke baad upar **do hara/nila button**: **📄 GSTR-1** aur **📄 GSTR-3B** — jise dabayein, app khud portal ke apne buttons dabakari
   `dashboard → GSTR-1 / GSTR-3B → PREPARE ONLINE` → aur wahan **aapke chune hue month** ka period select kar deti hai.

Message aata hai: **"✅ GSTR-3B Prepare Online khul gaya — month October (2026-27) check karein"**.
Kuch na khule to: **"⚠️ Portal ne GSTR-3B page khud nahi khola — dashboard par Returns → GSTR-3B dabayein"** (dead-end nahi).

**Month kahan se?** Portal tab ke **FY + Month** selector se — wahi `102026` (MMYYYY) aur "October (2026-27)" native ko jata hai. Month select karte waqt app **dono format** match karti hai — `October` bhi aur `Oct 2026` bhi (jo portal dropdown me hota hai).

## Kya NAHI karta (jaan-boojh kar)

- **Captcha auto-solve/fill nahi** — captcha ka kaam hi automation rokna hai; bypass karna portal security/TOS todta hai aur aapke/client ke login par **account lock** ka risk daalta hai.
- **Koi submit / FILE / ACCEPT / REJECT nahi** — sirf page kholna + month dropdown set karna. Final filing button aap hi dabate hain.
- GSTR-1 button 3B page ko 3B nahi samajhta aur 3B button GSTR-1 page ko GSTR-1 nahi samajhta (test kiya hua).

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.3** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.3/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_13** (Drive) | https://drive.google.com/file/d/1zBBHcvcB90haIMIQ4-GxggaV2KnEp2Yg/view |

**APK v5.9.3:** size **3,153,659 B**, SHA-256 `6ffef249bf165d19aa39fd9643b1f765b0d97eb56d9141ad50bcf0dcf2487cd9`, MD5 `8b30129d42d468d5baa2c21e4d8c03f7` — purane APK ke upar seedha update (data safe).

**Zip v5_8_13** me koi change nahi (app ka HTML wahi hai — 1,147,459 bytes; month/FY pass karne wala code usme already hai). Sirf APK me naye buttons jude hain.

---

## Proof (sandbox test)

**1) Portal click-chain — dono buttons, asli Java code se nikala gaya JS, jsdom me 10/10 PASS:**

| Test | Result |
|---|---|
| GSTR-1 button → dashboard me **GSTR-1** tile click (3B nahi) | ✅ `clicks=["GSTR-1"]` |
| GSTR-1 button → **PREPARE ONLINE** click | ✅ `clicks=["PREPARE ONLINE"]` |
| GSTR-1 button → prepare page DONE + month select | ✅ `October` |
| 3B button → dashboard me **GSTR-3B** tile click (GSTR-1 nahi) | ✅ `clicks=["GSTR-3B"]` |
| 3B button → **PREPARE ONLINE** click | ✅ |
| 3B button → 3B prepare page DONE + month select | ✅ `October` |
| 3B page URL na badle, "3.1 Tax on outward" dikhe → DONE | ✅ |
| 3B button GSTR-1 page par confuse na ho | ✅ NONE |
| GSTR-1 button 3B page par confuse na ho | ✅ |
| Month short format **"Oct 2026"** bhi select ho | ✅ |

**2) Month/FY test (8/8 PASS):** Oct+FY26-27 → `102026`, Feb → `022027`, Apr → `042026`, Mar+FY27-28 → `032028`; `openPortal(...)` 5 args (ID, password, GSTIN, fp, month label).

**3) Regression:** mobile hooks **17/17**, dropdown + PDF share **18/18**, PDF native share **PASS**.

**4) APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,147,459**, js native portal 2, dex BiometricPrompt 6.

---

## Note

- Portal slow ho to app **12 baar tak (har 1.6s)** khud retry karti hai, phir message dikha deti hai — aap manually Returns → GSTR-1/3B dabа sakte hain.
- GST portal apna layout badle to sirf yeh shortcut kaam karna band karega (baaki app par koi asar nahi; crash nahi hogi).
- Apps Script / bridge me **koi change nahi** (bridge 1.28.0).
