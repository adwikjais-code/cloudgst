# NOC Maker — Android APK (v1.5)

**Download (phone me seedha):**
👉 https://github.com/adwikjais-code/cloudgst/releases/download/noc-apk-v1/NOC_Maker.apk

- Size: **227,117 bytes (~222 KB)** · signed release APK (v1+v2+v3 signature) · v1.5, `minSdk 24` (Android 7+), `targetSdk 34`
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
| ✍️ हस्ताक्षर (auto) | Default: **शपथकर्ता ka naam hi handwriting font (Kalam, embedded) me signature** ban kar "शपथकर्ता" ke upar chhapta hai — apne aap. Naam badla to signature bhi badal jata hai. Toolbar se: **नाम से (अपने आप)** / **खुद बनाएँ (उँगली से)** / **कोई हस्ताक्षर नहीं** |
| हाथ से साइन की जगह | Form me checkbox — 2 extra khaali line, taaki print ke baad pen se sign kar sakein |
| किनारे बराबर (justify) | Page ka **right edge seedha** — words tay hadd tak jaate hain, aage wala word apne aap agli line me chala jata hai (page odd nahi lagta). Toolbar me switch: **किनारे बराबर (justify)** [default] / **जैसा लिखा है** |
| दिनांक/हस्ताक्षर की जगह | Naya dropdown: **0 (एकदम ऊपर) / 1 (कम — डिफ़ॉल्ट) / 2 / 3-4 (पुराना ज़्यादा नीचे)** — default ab **1**, isliye दिनांक + शपथकर्ता pehle se **3 line upar** |
| 1-क्लिक पता | **"⤵️ 1 क्लिक — निवासी वाला ही पता"** button: निवासी + राज्य + पिन कोड se **मकान/संपत्ति का पूरा पता** turant bhar jata hai (BR me `पता, राज्य-पिन`, NBR me `पता, जिला पिन, राज्य, भारत`) |
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
