# CloudGST Android APK — v5.8

**Download (phone me seedha kholein):**
👉 https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST-v5.8.apk

Release page: https://github.com/adwikjais-code/cloudgst/releases/tag/android-v5.8
SHA256: `a84df8f3481d6fc48747f577fbe4f7082884bae56c44a587958dcec399800906`
Size: **594 KB** · Android **8.0+** (minSdk 26) · signed (fixed key — aage ke updates purane ke upar install ho jayenge)

---

## Install (2 minute)
1. Phone par upar wala link kholein → **CloudGST-v5.8.apk** download karein.
2. Notification/Files se APK kholein → **"Settings" → "Allow from this source"** → **Install anyway**
   (Play Protect "unknown app" warning normal hai — ye app Play Store par nahi hai).
3. Home screen par **CloudGST** icon.
4. Pehli baar: ⚙️ Settings → **Apps Script URL** paste karein (aur vault password, agar set hai) — baaki sab pehle jaisa.

## Andar kya-kya chalta hai (v5_8 ka poora app)
| Feature | Chalega? |
|---|---|
| Client tracker, sheet sync, 88 clients ka data | ✅ |
| GSTR-1 JSON generate → **☁️ Drive me Save (json folder)** | ✅ |
| Portal page → **json folder dropdown + Load All** (koi file chooser nahi) | ✅ |
| **🌐 Portal Login** — app ke andar GST portal, **ID/password pehle se bhare hue** | ✅ naya |
| Captcha wala background upload/fetch (bridge v1.20.0) | ✅ |
| PDF / CSV / Etsy CSV upload (Android file picker se) | ✅ |
| WhatsApp / Drive ke links | ✅ system browser me khulte hain |

## 🌐 Portal Login kaise kaam karta hai
1. GST Portal tab → client ki row me **🌐 Portal Login** (blue button).
2. App vault se ID+password nikaal kar **apne andar** portal kholta hai
   (`services.gst.gov.in/services/login`), dono fields bhar deta hai.
3. Aap **sirf captcha** dal kar **Login** dabate hain.
4. Cookie app ke andar save rehti hai → **agli baar portal seedha dashboard** khulega.

> **Auto-submit jaan-boojh kar nahi hai.** Login aap khud dabate hain — isse GST portal ke
> "automated login / account lock" ka risk nahi badhta. Password app ke andar hi decrypt hota hai,
> kahin bheja nahi jata.

## Zaroori baat — Apps Script update
Drive me JSON **Save/Select** ke liye Apps Script me naya code paste karna zaroori hai:
Settings → **📋 Copy Code** (naya code) → Sheet → Extensions → Apps Script → replace → **Deploy → New version**.
Jab tak purana hai, app saaf error degi ("naya Apps Script paste karein").

## App update kaise karega (aage)
`android/app/src/main/assets/app/index.html` = app ka asli UI. Usko badal kar push karein →
GitHub Actions khud naya APK bana kar isi Release me daal deta hai (`android.yml` workflow).
Phone par naya APK install karein — data (localStorage) bacha rehta hai, kyunki signing key ek hi hai.

## Android project (repo me)
```
android/
  app/src/main/assets/app/*.html      ← v5_8 app (1,101,896 B index.html)
  app/src/main/java/com/cloudgst/app/
      MainActivity.java               ← WebView + https://appassets.androidplatform.net + file chooser
      PortalLoginActivity.java        ← portal + ID/password auto-fill (captcha ke liye rukta hai)
  keystore.p12                        ← fixed signing key (password build.gradle me)
.github/workflows/android.yml         ← APK build + Release + verify report
```

## Verify (build ke baad, release notes me bhi hai)
```
manifest ok: yes
index.html bytes: 1101896
native portal hook count: 2
dex files: 1
dex openPortal: 1
dex CloudGSTNative: 1
dex appassets: 2
dex user_pass: 1
```

## Limits (sach)
- Ye app **Play Store par nahi** — apk sidha install (Play Protect warning aayega).
- Portal app ke WebView me chalta hai; **first-time OTP / e-KYC / new registration** jaise steps aapko khud karne padenge.
- Bridge URL `https://` hona chahiye (app me cleartext HTTP band hai) — default Railway URL theek hai.
- iPad/iPhone ke liye alag rasta chahiye (Apple Developer $99/saal) — abhi sirf Android.
