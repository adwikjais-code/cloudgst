# Phone mode — imaandaar status + debug (APK v5.9.13)

Aapne kaha: **"abhi bhi nahi chal paya"**. Main ab bina wajah ke aur version nahi banata — pehle **aapka kaam rukna band**, phir **ek exact report** lekar pakka fix.

---

## 1) Aapka kaam ab rukega nahi
- **Default mode wapas ☁️ Cloud** kar diya (jo pehle din se chal raha tha). App update karte hi ek baar apne aap cloud par aa jayegi.
- 📱 Phone mode ab **beta (🧪)** hai — switch se on hota hai, par jab tak theek na ho aapka roz ka kaam cloud se chalta rahega.

## 2) Phone mode ka debug report (ek tap)
Maine phone-mode ke andar **logging** daal di hai (login start, captcha, overlay, 2B fetch, har error — sab likha jata hai).

**Kaise bhejein:**
1. APK kholein → **GST Portal** tab → ⚙️ **Settings** (drawer) → naya button **📋 Phone mode debug copy**.
2. Dabaane par report **share sheet** me aa jayegi (WhatsApp/Email) — mujhe woh bhej dijiye.

Report me ye hota hai (example):
```
CloudGST phone-mode debug
app android-5.9.13 | source: phone | phone api: yes | login api: yes
stage: login:poll:WAIT
---
18:42:10 • login start: BUSARA BANO (09EMJPB3234G1ZB)
18:42:14 • login reply: {"t":"WAIT","u":"https://services.gst.gov.in/services/login","inputs":0,...}
18:42:52 • manual-wait -> overlay
...
```
Isse mujhe **bilkul exact** pata chal jayega ki portal ne kya dikhaya (login form hai ya nahi, WAF/Access-Denied hai ya slow), aur main **guess nahi — seedha fix** kar dunga.

## 3) Maine kya-kya theek kiya (aaj tak, phone mode me)
| Kab | Kya |
|---|---|
| v5.9.6 | phone/cloud switch, chhupa WebView |
| v5.9.7 | Re-Fetch crash (UI thread) fix |
| v5.9.8 | render fix (1dp invisible → poora size), page diagnostics |
| v5.9.9 | cloud jaisa login (captcha app me, OTP), network preflight, serial multi-client |
| v5.9.10 | jawab ka **polling** (push miss fix) |
| v5.9.11 | login page ki flexible pehchan |
| v5.9.12 | login **app ke andar** (portal par redirect nahi) |
| v5.9.13 | **cloud default** + **debug report** |

Sab static/jsdom tests pass hain, par GST portal ki **asli page** main login karke test nahi kar sakta (aapke credentials nahi) — isliye aapka ek debug report hi asli "eyes" hai.

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.13** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.13/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_23** (Drive) | https://drive.google.com/file/d/1JL2xU6hAx_8OjKeSRFDsciALxQGV9rIO/view |

**APK v5.9.13:** size **3,176,973 B**, SHA-256 `977b32dc61f5e776533c4a76384df886abb2e774b829187ae6c660af8d019b18`, MD5 `11749e4a4e166dfc8c2cfcc40ecc404b`.
**Zip v5_8_23:** 256,745 B, md5 `41c5c7695e7fd4915b74804a4a09f431`.

---

## Proof
**Naya test 7/7 PASS:** default = cloud ✅, phone chip 🧪 beta ✅, settings me 📋 debug button ✅, debug text me version + stage ✅, copy share-sheet se jata hai ✅.
**Regression:** switch **18/18**, in-app login **16/16**, login scripts **13/13**, polling **8/8**, login-first **19/19**, serial/network **13/13**, 2B JSON **8/8**, thread/crash **15/15**, mobile **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, GSTR-1/3B **10/10**, FY/month **8/8**.
**APK verify:** `manifest ok`, **index.html 1,171,250 bytes**, `dex inapp login overlay: 2`.

---

## Aapse ek cheez chahiye
APK update → **📱 Phone** switch → Re-Fetch (jahan atka tha wahi karein) → phir ⚙️ Settings → **📋 Phone mode debug copy** → report mujhe bhej dein.
Us ek report ke baad main phone mode ko **wahi ka wahi** theek kar dunga — bina anumaan.
Tab tak aapka kaam **☁️ Cloud** se chalta rahega (default wahi hai).
