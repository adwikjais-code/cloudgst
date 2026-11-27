# Re-Fetch par app band ho jata tha — fix (APK v5.9.7)

Aapne bheja: **"Re-Fetch karte hi close ho ja raha hai — CloudGST keeps stopping"**. Karan mil gaya aur fix ho gaya.

---

## Karan (exact, code me)

Aapne jo APK lagaya tha (v5.9.6) usme naya **📱 Phone mode** tha aur woh **default ON** tha. Re-Fetch dabane par:

1. App ka JS **bridge thread** se native `phoneFetch2b()` bulati hai.
2. Us code ne **usi (non-UI) thread** se hi `new WebView(...)` bana kar screen me add kar diya.
3. Android ka rule: **View/WebView sirf UI thread par ban sakta hai** — warna process turant band (`Only the original thread that created a view hierarchy can touch its views`).
   ⇒ Isi liye Re-Fetch dabate hi app band ho jata tha aur "CloudGST keeps stopping" aata tha.

Bilkul waise hi jaise bhookh lagne par khana garam karne ke bajaye gas hi band kar dena 😅 — kaam shuru hote hi crash.

## Fix (v5.9.7)

1. **Poora phone-mode ab UI thread par** — WebView banana, load karna, sab `runOnUiThread` ke andar.
2. **Crash-proof guards** — poora phone-mode start `try/catch (Throwable)` me; kuch bhi galat ho to app band nahi hoti, seedha saaf message aata hai:
   *"Phone mode start nahi ho paya — ☁️ Cloud mode try karein"*
3. Result app ko dene wala code (`deliverPhonePayload`) aur chunk reader — dono crash-proof.
4. **Login ki zaroorat** ho to 90-second cooldown bhi nahi lagta — seedha message:
   *"Is client ka GST portal login phone par nahi hai — ek baar 🌐 Portal Login se login karein (captcha aap dalenge), uske baad phone mode background me chalega."*

⚠️ **Purana (crash karne wala) APK zaroor uninstall/update karein** — v5.9.7 lagaye bina phone mode use na karein.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.7** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.7/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_17** (Drive) | https://drive.google.com/file/d/1PBaQlKtFyKh_g9uPfj_E5pbCKfs6CGRR/view |

**APK v5.9.7:** size **3,163,202 B**, SHA-256 `e6246505b0ae52b652789c3a751c6259788b1077772f23261792ee4d9394306`, MD5 `bf6cf85f7285600c6495e57d72d90279` — purane APK ke upar seedha update (data safe).
**Zip v5_8_17:** 254,280 B, md5 `df767df2aaeb0170de6e00f64c8ceb8a`, andar `app/index.html` = 1,160,229 bytes (= APK ke andar ki hi file).

---

## Proof

**Naya "thread/crash" test — 15/15 PASS** (source par static check):

| Test | Result |
|---|---|
| Bridge method khud WebView nahi chhoota (sirf `startPhoneFetch`) | ✅ |
| `startPhoneFetch` UI thread par (`runOnUiThread`) | ✅ |
| WebView banana UI thread ke andar hi | ✅ |
| `try/catch (Throwable)` — fail par crash nahi | ✅ |
| Fail par app ko saaf error payload | ✅ `start_failed` |
| Result dene wala code crash-proof | ✅ |
| Result UI thread se JS ko jata hai | ✅ |
| Chunk reader crash-proof | ✅ |
| Andar ka handler main looper par | ✅ |
| Page finish → main handler tick | ✅ |
| Download wala background thread sirf HTTP (WebView touch nahi) | ✅ |
| Cookie/UA UI thread par | ✅ |
| Cleanup (destroy) crash-proof | ✅ |
| Version 5.9.7 | ✅ |

**Regression (kuch nahi toota):** phone/cloud switch **17/17**, 2B JSON + totals **8/8**, mobile hooks **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, fingerprint ke baad popup fix **7/7**, GSTR-1/3B **10/10**, FY/month **8/8**.

**APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,160,229**, `dex phone fetch: 1`, **`dex ui-thread start: 2`**, `js source switch: 2`.

---

## Ab kya karein
1. **v5.9.7 APK install karein** (update).
2. Switch **☁️ Cloud** par rakhein → Re-Fetch turant chalega (cloud, pehle jaisa).
3. **📱 Phone** par rakhna ho to: pahle us client ka **🌐 Portal Login** ek baar karein (captcha), phir Re-Fetch — phone mode background me chalega, screen par kuch nahi khulega.
4. Agar kabhi phir se band ho jaye — mujhe **kaun sa button** aur **kis client par** bata dein (screenshot ke saath), main usi hissa ko theek karunga. Ab crash ki jagah message aayega, isliye wajah turant pata chal jayegi.

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
