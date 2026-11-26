# Fix — fingerprint ke baad bhi password popup aata tha (APK v5.9.5)

Aapne bataya: *"fingerprint se on hone ke baad bhi password ka popup aata hai, back karne par hat jata hai"* — fix ho gaya.

---

## Karan (exact)

App me **do alag locks** the:
1. **Native Android lock** (aapka naya 👆 fingerprint) — app khulte hi fingerprint/PIN maangta hai. ✅
2. **App ka apna password lock** (`pinLockOverlay` — "Protected Client Portal") — strong password wala purana lock. Woh **fingerprint ke baad bhi** apne aap khul jata tha, isliye dobara password popup aata tha.

Native unlock app ke JS ko batata hi nahi tha, isliye app ko pata hi nahi chalta tha ki fingerprint verify ho chuka hai.

## Fix

1. Native fingerprint verify hone par ab app ko signal jata hai — naya hook **`cloudGstNativeUnlocked()`** →
   app ka password popup **khud hat jata hai** (toast: *"👆 Fingerprint verified — app unlock ho gaya!"*).
2. Fingerprint lock **ON** hai to app ke start par woh purana password screen **dikhta hi nahi** (`gpNativeBioOn()` check).
3. **Client ka GST portal password** (jo `enc:v1:` me encrypted hai) decrypt karne ke liye app password zaroori hai — us waqt pehle jaise "decrypt nahi hua, ✏️ se plain save karein" jaisa confusing message nahi aata, balki seedha password box khulta hai saaf wajah ke saath:
   *"👆 Fingerprint se app khula hai — is client ka portal password decrypt karne ke liye app ka password dalein."*
4. Fingerprint **OFF** karne par sab purana jaisa (password lock wapas).

Matlab: roz ke use me **sirf fingerprint** — password sirf tab jab aap kisi client ka saved portal password istemal karna chahein.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.5** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.5/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_15** (Drive) | https://drive.google.com/file/d/12_pYliM7NnWO44G_XkbbPQQZ6zo9j6hJ/view |

**APK v5.9.5:** size **3,155,081 B**, SHA-256 `f2aeb49c733ed4d4bf2a874cff0331ba76c4f17d107984d594884a4cc9c26123`, MD5 `992e164054c4d7d922843370e331b3c5` — purane APK ke upar seedha update (data safe).
**Zip v5_8_15:** 252,387 B, md5 `48955f3fc54634928c5893008f03f7b2`, andar `app/index.html` = 1,152,530 bytes (= APK ke andar ki hi file).

---

## Proof (sandbox test)

**Naya test — 7/7 PASS:**

| Test | Result |
|---|---|
| Fingerprint ON → app ka password popup **hidden** | ✅ |
| Native unlock hook (`cloudGstNativeUnlocked()`) popup hidden rakhta hai | ✅ |
| `gpAskAppPassword()` popup dikhata hai (jab vault password chahiye) | ✅ |
| Us popup me saaf wajah (subtitle) set hoti hai | ✅ |
| Unlock ke baad popup phir hidden | ✅ |
| Fingerprint **OFF** → password popup pehle jaisa aata hai | ✅ |
| Browser (bridge nahi) → purana behaviour waisa hi | ✅ |

**Regression (sab pehle jaisa):** mobile hooks **17/17**, dropdown + PDF share **18/18**, fingerprint header button **14/14**, GSTR-1/3B click-chain **10/10**, month/FY **8/8**, PDF native share **PASS**.

**APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,152,530**, `js native unlock hook: 1`, `dex native unlock hook: 1`, `dex bioStatus: 2`.

---

## Kaise use karein

1. Naya APK install karein (update).
2. **👆 Fingerprint: OFF** → dabayein → ON.
3. App band karke dobara kholein → **sirf fingerprint** maangega → verify hote hi seedha app khul jayega, **password popup nahi**.
4. Sirf jab kisi client ka saved portal password use karna ho, tab app password pucha jayega (saaf message ke saath).

> Apps Script / bridge me **koi change nahi** (bridge 1.28.0).
