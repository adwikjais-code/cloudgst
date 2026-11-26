# CloudGST Android APK — v5.9.0 (Touch ID lock + swipe-back + PDF logo)

**Download (phone me khol kar):**
👉 https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.0/CloudGST.apk

(Hamesha latest: https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk)

| Cheez | Value |
|---|---|
| File | `CloudGST.apk` |
| Size | 3,150,524 bytes (~3.0 MB) |
| SHA-256 | `cc969444238d214e1d64ccbc2b064f8e6de82fd1e406c749a30c40dca040e256` |
| MD5 | `888d658a3ea7fa27e694d53a0e31bf98` |
| Version | `5.9.0` (versionCode 63) |
| Support | Android 7.0 (API 24) se naye phones tak |
| Signing | Wahi purani key (`keystore.p12`) — purane APK ke **upar seedha update** ho jayega, data safe |

---

## Install kaise karein (2 minute)

1. Phone me upar wala link kholein → **CloudGST.apk** download karein.
2. Download notification / Files app se APK kholein.
3. "Unknown sources / Install anyway" allow karein (Chrome ko "Install unknown apps" permission).
4. **Update** dabayein — purana CloudGST (v5.8.x) already hai to settings, clients, JSON sab wahi rahenge.
5. Icon kholein: navy background par **gold ring wala "J&A"** (PDF letterhead ka hi logo).

> "App not installed" aaye to: purana CloudGST uninstall karein, phir naya install karein
> (same signing key hai, isliye normal case me update ho jata hai).

---

## Is APK me kya hai

| Feature | Kaise |
|---|---|
| **🔒 Touch ID / Fingerprint lock** | App → ⚙️ Settings → **🔒 App lock (fingerprint): OFF** dabayein → ON. Ab app khulte hi fingerprint lagega. Fingerprint na ho to phone ka **PIN/pattern** bhi chalega (Android 7 se hi, pehle sirf Android 11+ par chalta tha). |
| **Swipe se back** | Screen ke left/right edge se swipe (ya back button): pehle khula **popup/modal band**, phir **pichhla tab**, phir **app se bahar**. Android 13+ par naya predictive back bhi. |
| **PDF wala logo** | Launcher icon, app khulte waqt ka **splash screen**, aur lock screen — teeno par navy + gold **J&A** monogram (bilkul PDF letterhead jaisa). |
| **Downloads** | App jo JSON / PDF / CSV banata hai wo seedha phone ke **Downloads** folder me save hota hai (pehle WebView me kuch nahi hota tha). Drive se aane wali file par notification me progress dikhta hai. |
| **Share** | Native share sheet — file/PDF WhatsApp, Gmail, Telegram me seedha bhejein. |
| **🌐 Portal Login** | Portal tab me har client ke saamne button → app ke andar GST portal khulta hai, **ID/password pehle se bhare**, aap sirf captcha dalte hain aur login khud dabate hain (auto-submit nahi). |
| **File upload** | Phone ke Files/storage se PDF/CSV/JSON/photo choose karna pehle jaisa hi. |
| **UI** | Bilkul **v5_8 jaisa** — koi naya button/dialog/flow nahi. Sirf Settings me ek "App lock" line aayi hai (wo bhi sirf app me). |

Baaki sab pehle jaisa: JSON ka Drive "json" folder se Save/Select, `GST Certificates` folder se naye
clients one-click add, 2B / TCS / GSTR-1 upload flows, client edit, fee receipt PDF, Etsy master editor.

---

## Test proof (sandbox me jo chala)

APK ke andar jo HTML hai wahi file test ki gayi (bytes match: 1,144,686 = APK ke andar ka
`assets/app/index.html`), jsdom 31.0.1 browser-simulation me **17/17 PASS**:

| # | Test | Result |
|---|---|---|
| 1 | `cloudGstHandleBack` JS bridge maujood | ✅ |
| 2 | Back → khula modal (client edit) band hua | ✅ |
| 3 | Back → PDF action sheet band hua | ✅ |
| 4 | Back → pichhla tab (portal → fees) | ✅ |
| 5 | Back → tracker tab | ✅ |
| 6 | Tracker par back → `false` (app band ho sakta hai) | ✅ |
| 7 | Settings me App lock row bridge ke saath visible | ✅ |
| 8 | Toggle OFF dikha raha hai | ✅ |
| 9 | Click par native `setBioLock(true)` call gaya | ✅ |
| 10 | Click ke baad **ON** dikha raha hai | ✅ |
| 11 | Portal tab me 🌐 Portal Login button render hota hai | ✅ |
| 12 | Browser (bridge ke bina) me App lock row chhupi rehti hai | ✅ |
| 13 | Browser me back handler safe (false) — web behaviour na toota | ✅ |
| 14 | JS errors: **koi nahi** | ✅ |
| 15 | Native bridge `appVersion()` = `android-5.9.0` | ✅ |
| 16 | `__gpPageStack` page history banti hai | ✅ |
| 17 | Embedded Apps Script code block intact | ✅ |

APK build verify (GitHub Actions ne build ke baad khud check kiya):

```
sha256  cc969444238d214e1d64ccbc2b064f8e6de82fd1e406c749a30c40dca040e256
md5     888d658a3ea7fa27e694d53a0e31bf98
manifest ok: yes
signature files: 3
index.html bytes: 1,144,686      (v5_8_11 + mobile hooks)
js back handler: 1
js bio toggle: 2
js native portal: 2
dex openPortal: 2                (app ke andar portal login)
dex CloudGSTNative: 2            (JS ↔ Android bridge)
dex BiometricPrompt: 6           (androidx fingerprint, Android 7+)
dex saveBase64: 3                (Downloads me file save)
dex FileProvider: 3              (share sheet)
```

---

## APK dobara kaise banayein (agar aage app badle)

1. Naya `index.html` (aur baaki 5 html) `android/app/src/main/assets/app/` me copy karein.
2. `android/app/build.gradle` me `versionCode` +1 aur `versionName` badal dein.
3. Commit + push → GitHub Actions khud APK bana kar release me daal deta hai
   (`.github/workflows/android.yml`, release tag `android-v5.9.0` — naya version ke liye tag badalna hai).
4. Icons/splash dobara banane ho to: `python3 android/tools/make_icons.py`.

---

## Notes

- Web app (browser) me koi change nahi: wahi **v5_8_11** zip (`GST_etsy_anyfile_fix_v5_8_11.zip`) chalta rahega.
  APK ke andar ka HTML = v5_8_11 **+ mobile hooks** (bridge na hone par ye hooks chup-chaap skip ho jate hain).
- Apps Script (`APPS_SCRIPT_AppSync.gs`) me iss version me **koi change nahi** — dobara deploy karne ki zaroorat nahi.
- Bridge (Railway) bhi wahi **1.28.0**.
