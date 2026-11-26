# Fix — APK me fingerprint ka option nahi aa raha tha (v5.9.4)

Aapne bataya: *"isme fingerprint ka option nahi aa raha"*. Maine code check kiya — **do asli karan** mile, dono fix ho gaye.

---

## Karan 1 — WebAuthn wala fingerprint Android WebView me chalta hi nahi
Web app (browser) me app khud ek fingerprint offer dikhati hai (`bioOfferBar` → `enrollBiometric()` → WebAuthn). **Android WebView me WebAuthn support nahi hota**, isliye APK ke andar woh option kabhi dikha hi nahi — chup-chaap skip ho jata tha.

## Karan 2 — native fingerprint option "chhupa hua" tha
APK ka asli fingerprint lock (Android `BiometricPrompt`) pehle **sirf Portal tab → ⚙️ Setup drawer** ke andar tha… aur agar phone me fingerprint/PIN set na ho to wo **poori row hi chhup jati thi** (`hidden`). Isliye dhoondhne par kuch nahi mila.

---

## Fix (v5.9.4)

1. **Header me seedha button** — APK me upar toolbar me **👆 Fingerprint: OFF / ON** (🔒 Lock ke bagal me). Ek tap = ON/OFF.
   - ON hone ke baad **agli baar app kholte hi fingerprint/PIN maangega** (lock screen par logo + Unlock).
   - Lock screen par bhi "Fingerprint ya device PIN se kholein" aata hai.
2. **Settings row ab kabhi chhupti nahi** — Portal → ⚙️ Setup me 🔒 App lock row hamesha dikhegi (browser me nahi, sirf app me).
3. **Agar phone me lock set nahi hai** to button amber ho kar **"👆 Fingerprint: set nahi"** dikhata hai, aur tap par saaf message:
   *"Phone Settings → Security → Fingerprint / Screen lock (PIN) set karein, phir yeh dabayein"* — koi chhupa hua option nahi.
4. Native me `bioStatus()` add kiya — app ko exact wajah milti hai: `fingerprint` / `device_pin` / `none`. Fingerprint na ho par phone me PIN/pattern ho to woh bhi chalta hai.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.4** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.4/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_14** (Drive) | https://drive.google.com/file/d/1PpT48yq1A1QQU2rIk3HIj-yvi8cUgoKG/view |

**APK v5.9.4:** size **3,154,581 B**, SHA-256 `5c11b96bbf785659012743136e937f88464375506dc0defce56e32bd0b903ef9`, MD5 `fcd46c3a437fcd4334c1c9e765a747d7` — purane APK ke upar seedha update (data safe).
**Zip v5_8_14:** 251,953 B, md5 `e0bcf1621051e79de33895ba0bb23f54`, andar `app/index.html` = 1,150,441 bytes (= APK ke andar ki hi file).

---

## Proof (sandbox test — 14/14 PASS)

| Test | Result |
|---|---|
| Header me 👆 Fingerprint button bana (bridge ke saath) | ✅ |
| Button OFF dikha raha hai | ✅ `👆 Fingerprint: OFF` |
| Portal settings row bhi visible | ✅ |
| Tap par native `setBioLock(true)` call gaya | ✅ |
| Tap ke baad button **ON** | ✅ `👆 Fingerprint: ON` |
| Settings row bhi ON (dono sync) | ✅ |
| Phone me lock set nahi → button "set nahi" | ✅ |
| Us case me `setBioLock` **call nahi** hota | ✅ |
| Saaf message (Settings me set karein) | ✅ |
| Settings row phir bhi dikhti hai (chhupti nahi) | ✅ amber |
| Browser me header button nahi banta | ✅ |
| Browser me settings row hidden | ✅ |

**Regression (sab pehle jaisa):** mobile hooks **17/17**, dropdown + PDF share **18/18**, GSTR-1/3B click-chain **10/10**, month/FY **8/8**, PDF native share **PASS**.

**APK build verify:** `manifest ok`, signature 3 files, **index.html bytes = 1,150,441**, `js header fingerprint btn: 2`, `dex bioStatus: 2`, `dex BiometricPrompt: 6`.

---

## Kaise use karein (2 tap)

1. APK kholein → upar **👆 Fingerprint: OFF** dabayein → ON ho jayega (toast bhi aayega).
2. App band karke dobara kholein → **fingerprint/PIN maangega** (aapka `J&A` logo wala lock screen).
   OFF karna ho to wahi button dobara dabayein.

> Note: WebView (browser wala) fingerprint support nahi karta, isliye browser/zip me yeh option nahi milega — wahan app ka apna strong-password/PIN chalega. APK me native fingerprint hi asli option hai.
> Apps Script / bridge me **koi change nahi** (bridge 1.28.0).
