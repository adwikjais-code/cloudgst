# APK "unsupported" aa raha hai — kya karein

## Naya build (Android 7 se support)
# https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk

`605 KB` · **5.8.3** · sha256 `bf6504ade6f69c442d742b49a479f9c8fc8d56ef80b62d933ed50c72c710954c`

Kya badla is build me:
| Cheez | Pehle | Ab |
|---|---|---|
| Android version | 8.0+ (minSdk 26) | **7.0+ (minSdk 24)** |
| Signature schemes | v2/v3 | **v1 + v2 + v3** (verify: `signature files: 3`) |

---

## 3 sabse aam wajah — ek-ek karke check karein

### 1) Purana APK pehle se installed hai (signature alag tha) — **sabse zyada chance**
Jo sabse pehla APK maine diya tha (v5.8, 745 KB) wo **debug key** se signed tha.
Naye APK doosri key se signed hain → phone bolta hai "App not installed / unsupported".

**Fix:** Settings → Apps → **CloudGST** → **Uninstall** → phir naya APK install karein.
(Isse app ka sirf local data jayega — Sheet/Drive ka data waisa hi rahega. Apps Script URL dobara daalna padega.)

### 2) "Blocked by Play Protect" / "unsupported app"
**Fix:** Play Store → profile → **Play Protect** → ⚙️ → *"Scan apps with Play Protect"* thodi der ke liye OFF
(ya install dialog me **More details → Install anyway**).

### 3) Download hi block ho gaya ("unsupported file type")
Kuch in-app browsers (WhatsApp/Instagram/Drive preview) APK download block karte hain.
**Fix:** Link **Chrome** me kholein → download → notification se install.
Agar file ka naam `CloudGST.apk.bin` ya `.zip` ho gaya → rename karke `.apk` kar dein.

---

## Agar message **app ke andar** aaya
| Kahan | Message | Matlab / fix |
|---|---|---|
| Client row → 🌐 Portal Login | "Portal Login sirf Android app me chalta hai" | Aap **browser/web version** chala rahe hain. Wahan ye button kaam nahi karta — APK me kholiye. |
| Settings → 🔒 App lock | "Is device me fingerprint/PIN set nahi hai" | Phone me Settings → Security → Fingerprint/PIN set karein (ya button nahi dikhega Android 11 se neeche). |
| Koi aur | screenshot/jo line likhi hai wahi bhej dijiye | main usi hisaab se fix kar dunga. |

---

## Install ke baad pehla setup
1. App kholein → **Portal tab → ⚙️ Settings** → **Bridge URL** (`https://cloudgst-production.up.railway.app`) + **API Secret** → **Save & Test**.
2. ⚙️ Setup (header) → **📋 Copy Code** → Apps Script me paste → Deploy → New version.
3. Test: JSON page → `☁️ Drive me Save` → Portal tab → dropdown me file dikhni chahiye.
