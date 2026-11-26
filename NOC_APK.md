# NOC Maker — Android APK (v1.1)

**Download (phone me seedha):**
👉 https://github.com/adwikjais-code/cloudgst/releases/download/noc-apk-v1/NOC_Maker.apk

- Size: **227,117 bytes (~222 KB)** · signed release APK (v1+v2+v3 signature) · v1.1, `minSdk 24` (Android 7+), `targetSdk 34`
- Package: **`com.cloudgst.noc`** ("NOC Maker") — aapke CloudGST app (`com.cloudgst.app`) se **alag** hai, dono saath-saath install rehte hain.
- **Internet ki zarurat nahi** — INTERNET permission hi nahi maangi gayi. Poora tool APK ke andar hai.

## Install kaise karein (phone)
1. Phone me link kholiye → **Download**.
2. File `NOC_Maker.apk` khulne par **"Install"** → agar "unknown apps" ki permission maange to **Settings → Allow from this source** → wapas **Install**.
3. Play Protect "unrecognised app" bole to **"Install anyway"** (ye hamara hi signed APK hai, ads/tracking kuch nahi).
4. Home screen par **NOC Maker** icon.

## App me kya-kya hai
| Cheez | Detail |
|---|---|
| Tabs | **BR NOC (शपथ पत्र)** aur **NBR NOC (अनापत्ति प्रमाण पत्र)** |
| संबंध flexible | BR me "पुत्र" fix nahi — **पुत्र / पुत्री / पत्नी / पति / नाती / नातिन / पौत्र / पौत्री / दामाद / बहू / भाई / भतीजा / भांजा / पिता / माता** + **अन्य (खुद लिखें)**. Grammar khud badalti hai: के/की, मेरे/मेरी, करेंगें/करेंगी. शपथकर्ता ka apna sambandh bhi alag se chuna jaata hai (मै, नाम **पुत्री/पत्नी** पिता…) |
| Live preview | type karte hi A4 paper par format turant banta hai (aapke doc ki exact wording/line-breaks) |
| 🖨️ Print / PDF | Android ka print dialog → **"Save as PDF"** → A4 PDF (email/WhatsApp par bhej sakte hain) |
| 📋 Copy | poora text clipboard me → WhatsApp/Docs me paste |
| ⬇️ .txt | Downloads folder me file (Android 10+); purane Android par app folder me |
| नमूना भरें | aapke dono docs ka hi sample data |
| Draft auto-save | app band karne par bhi data bacha rehta hai (localStorage) |
| Back | ek baar BACK = "बाहर निकलने के लिए BACK फिर दबाइए", doosri baar = exit |

## CI verification (har build par automatic — GitHub Actions `NOC Maker APK`)
`Verify APK` step fail hone par release hi nahi banti. Ye check hote hain:
1. APK ke andar `assets/noc_generator.html` **repo ke file se byte-equal** (>20 KB).
2. `classes*.dex` me `NOCBridge` maujood (native print/copy/save bridge).
3. HTML me bhi bridge hook maujood.
4. `apksigner verify --print-certs` → **signature valid**.
5. `aapt2 dump badging` → package `com.cloudgst.noc`, label `NOC Maker`, minSdk 24 / targetSdk 34.

## Source / rebuild
- Project: `noc_android/` (Gradle 8.7 + AGP 8.5.2, koi third-party library nahi)
- `MainActivity.java` — WebView + `NOCBridge` (`printPage`, `copyText`, `saveText`)
- HTML: `noc_generator.html` → build ke waqt `noc_android/app/src/main/assets/` me copy hota hai
- Workflow: `.github/workflows/noc-apk.yml` (push par build → GitHub Release `noc-apk-v1`)
- Local rebuild: `gradle -p noc_android assembleRelease`

## Note
Ye NOC ek legal affidavit/undertaking ka format hai — notary, stamp aur final submission aap khud karenge.
