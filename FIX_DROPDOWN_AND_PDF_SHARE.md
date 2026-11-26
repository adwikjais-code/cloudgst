# Fix — Mobile dropdown + PDF WhatsApp attach (v5_8_12 / APK v5.9.1)

Aapki photo + message ke 2 problem: **(1)** ➕ Client ka dropdown mobile par screen se bahar/blank dikh raha tha, **(2)** PDF "WhatsApp par send" dabane par PDF **attach nahi** ho rahi thi. Dono ka asli karan mil gaya aur dono fix ho gaye.

---

## 1) Mobile dropdown — screen ke bahar chala jata tha

**Karan (exact):** dropdown `absolute right-0 w-72` tha. Phone par ➕ Client button screen ke **left** me hota hai, to menu ka right edge button ke right edge par chipak jata hai aur 288px chauda menu **screen ke bahar left** nikal jata hai — isliye sirf ek khaali safed box dikhta tha (content off-screen).

**Fix:** 768px se chhoti screen par menu ab **fixed panel** banta hai —
`left: 10px` + `right: 10px` + `width: auto` + `top = button ke neeche 8px` + `z-index: 80` + screen ke hisaab se `max-height` (zyada lamba ho to andar scroll).
Scroll karne par menu khud band ho jata hai, rotate karne par dobara sahi jagah lagta hai. **Desktop par purana behaviour bilkul waisa hi** hai (koi change nahi).

## 2) PDF WhatsApp par attach nahi hoti thi

**Karan (exact):** app `navigator.share({files})` try karti thi. Android WebView is file-share ko support **nahi** karta, to code fallback par chala jata tha: PDF download + `wa.me` link **sirf text** ke saath khulta tha — isliye PDF attach nahi hoti thi. (Aur pehle wale APK me to download hi nahi hota tha.)

**Fix:** Android app me ab **native share sheet** use hota hai — PDF file ban kar OS ke share sheet me jati hai; WhatsApp chunne par **PDF attach hokar** jati hai, saath me aapka Hindi/English message bhi. Browser (web) me pehle jaisa hi: `navigator.share` → warna download + `wa.me` text.

---

## Ab kaise kaam karega

**APK (phone):** naya APK **v5.9.1** install karein → PDF ke ✕ शेयर/WhatsApp button par share sheet khulega → WhatsApp → chat chunein → PDF attach dikhegi → send.

**Web app (Chrome/browser):** naya zip **v5_8_12** use karein → dropdown mobile par bhi poora screen ke andar khulega (PDF share wahan pehle jaisa hi chalega, kyunki browser me native share hota hai).

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.1** (dropdown + PDF attach fix) | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.1/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_12** (Drive) | https://drive.google.com/file/d/1Zp0GFQagy3xioLvzKFQWN7AB5bnNmIiF/view |

**APK v5.9.1:** size **3,151,351 B**, SHA-256 `08328ef54eded949e4544033cf8d595a38429ba7f1f4501d01c5cbd42e344981`, MD5 `66c7a8ba4c28d20cf6e9a424f4590d84` — purane APK ke upar seedha update (data safe).

**Zip v5_8_12:** 251,230 B, md5 `731b8acfa7c0ec428801ef3a33feb3b7`, integrity OK, andar `app/index.html` = 1,147,114 bytes (bilkul wahi file jo APK ke andar hai).

---

## Proof (sandbox test, dono fix + purana sab kuch)

**Naya test (18/18 PASS)** — 390px chaudi screen simulate karke:

| Test | Result |
|---|---|
| dropdown khulta hai | ✅ |
| mobile: `position: fixed` | ✅ |
| mobile: `left: 10px` / `right: 10px` (screen ke andar) | ✅ |
| mobile: `width: auto` (poori chaudai) | ✅ |
| mobile: `top = 104px` (button ke thik neeche) | ✅ |
| mobile: `z-index: 80` (sabke upar) | ✅ |
| mobile: `max-height` screen ke andar (660px) | ✅ |
| dropdown me **3 options** aur unka text dikhta hai | ✅ |
| `blobToBase64` / `shareFileNative` helper | ✅ |
| PDF blob → base64 chala | ✅ |
| `shareFileNative` ne native bridge bulaya | ✅ |
| native `shareBase64` ko **file name + data + message** mila | ✅ |
| browser (bridge ke bina) me bhi dropdown fixed | ✅ |
| browser me native share na ho to purana fallback | ✅ |
| JS errors: **koi nahi** | ✅ |

**`sendPdfViaWhatsApp` end-to-end test:** PDF (Etsy_Ram_2026-03.pdf) → native share call **1 baar**, `wa.me` link **nahi** khula — matlab ab PDF hi attach hoti hai, sirf text nahi.

**Purana suite dobara chalaya (regression check):** 17/17 PASS — back gesture, App-lock toggle, Portal Login button, browser me sab inert, JS error none.

**APK build verify (GitHub Actions):** `manifest ok: yes`, signature 3 files, **index.html bytes = 1,147,114** (= local test file, yaani test wali hi file APK me hai), js back handler 1, js bio toggle 2, dex BiometricPrompt 6.

---

## Kya nahi badla

- Apps Script (`APPS_SCRIPT_AppSync.gs`) — **koi change nahi**, dobara deploy ki zaroorat nahi. Bridge bhi wahi **1.28.0**.
- Desktop web UI, JSON Drive save/select, 2B/TCS flows, client edit, fee receipt — sab waisa hi.
- Settings me App lock line, swipe-back, logo, Downloads — sab pehle jaise chal rahe hain.
