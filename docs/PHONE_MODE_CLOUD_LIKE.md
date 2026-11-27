# Phone mode ab cloud jaisa — captcha app me, login back me, kai client ek ke baad ek (APK v5.9.9)

Aapne bataya + screenshot bheja: **`ERR_NAME_NOT_RESOLVED` — page load hi nahi hua**, aur chaaha: *"cloud par jaise login ho raha tha, waise hi phone par back me process chale; aur ek saath kai client ka fetch ho."*

---

## 1) Asli wajah (screenshot se)
```
page: chrome-error://chromewebdata/ | Web page not available
net::ERR_NAME_NOT_RESOLVED  (returns.gst.gov.in)
```
Yaani hidden WebView ko **portal ka server hi nahi mila** — DNS/network fail. Isliye koi login/captcha hi nahi aaya, aur baad me `NONE` error aaya.

**Fix:**
- Har phone-mode shuruaat me **internet/DNS check** (preflight) — network kharab ho to saaf message: *"Internet/DNS problem: portal ka server hi nahi mila… Wi-Fi/mobile data check karein"*.
- Page load fail ho to **ek baar apne aap retry**, phir bhi fail → saaf network message (60 baar chup-chaap intezaar nahi).

## 2) Ab phone mode **cloud jaisa** hai
Pehle phone mode purani session par depend karta tha. **Ab wahi flow jo cloud me tha, par phone par:**
1. Phone mode me Re-Fetch → login page **chhupe (invisible) WebView** me khulta hai — **screen par portal nahi dikhta**.
2. **Captcha ki image app me aati hai** (row me, cloud jaisi hi) → aap captcha dalte hain → **Login**.
3. Portal OTP maange to **OTP box** aata hai → aap OTP dalte hain.
4. Login hote hi **2B fetch background me** chalta hai, data Sheet + B2B list me.
5. Session zinda hai to agli baar captcha bhi nahi — seedha fetch.

## 3) Kai client ek saath (serial)
Phone par ek hi portal session hota hai, isliye **ek waqt me ek client** — lekin **apne aap chain** chalta hai:
`⚡ Auto-Next Serial Captcha` phone mode me khud ON hota hai → ek client ka captcha/login/fetch khatam → **agla client ka captcha khud** aa jata hai, aapko bar-bar Re-Fetch nahi dabana padta. (Parallel 2+ clients phone par possible nahi — portal ek hi session/cookie deta hai; cloud mode me 2 parallel chalta hai.)

---

## Download

| Cheez | Link |
|---|---|
| **APK v5.9.9** | https://github.com/adwikjais-code/cloudgst/releases/download/android-v5.9.9/CloudGST.apk |
| APK (latest) | https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk |
| **App zip v5_8_19** (Drive) | https://drive.google.com/file/d/1twnDsu0WjqMFsmfMPPqge_fOpXiWJvei/view |

**APK v5.9.9:** size **3,172,716 B**, SHA-256 `9d670fbd52a5056c2ebed8eb230ad3cb5e15f9b2ac5773da8dc4a1dbfa7e0ae5`, MD5 `744736c53b1b062097d04a99a3e5d253`.
**Zip v5_8_19:** 255,212 B, md5 `5cc004de7adf1d43047b1d17c256e6e1`, andar `app/index.html` = 1,166,025 bytes (= APK ke andar ki hi file).

---

## Proof (sandbox tests)

**Login page ke asli HTML par — 9/9 PASS**
| Test | Result |
|---|---|
| Login page se **captcha image** milti hai (`CAPTCHA` + src) | ✅ |
| Pehle se logged in → `IN` (seedha fetch, captcha nahi) | ✅ |
| Khaali page → `WAIT` (crash nahi) | ✅ |
| OTP page → `OTPREQ` | ✅ |
| Galat captcha → `WRONGCAP` (naya captcha aayega) | ✅ |
| Galat password → `ERRMSG` (portal ka message) | ✅ |
| Login success → `IN` | ✅ |

**Phone-login app flow — 6/6 PASS:** captcha base64 app tak, portalId+password native tak, captcha submit → logged in, OTP → logged in.

**Phone mode + network + serial — 13/13 PASS:** maxPar=1 (ek ke baad ek), auto-next khud ON, DNS par saaf message + auto retry, preflight, chhupa WebView MATCH_PARENT + index 0, bridge methods UI thread par.

**Regression (kuch nahi toota):** switch **17/17**, 2B JSON **8/8**, portal page script **11/11**, login-first **17/17**, thread/crash **15/15**, mobile **17/17**, dropdown+PDF **18/18**, fingerprint **14/14**, popup fix **7/7**, GSTR-1/3B **10/10**, FY/month **8/8**.

**APK build verify:** `manifest ok`, **index.html 1,166,025 bytes**, **`dex phone login: 2`**, `dex phone fetch: 1`, `dex ui-thread start: 2`.

---

## Ab kaise chalega
1. **v5.9.9 install karein.** Switch **📱 Phone**.
2. Kisi client ka **Re-Fetch** → **captcha app me aayega** (portal screen nahi) → captcha daalein → Login → OTP maange to OTP → **2B background me** aa jayega.
3. `⚡ Auto-Next` khud ON hai → **agla client khud** aayega; aap sirf captcha/OTP dalte rahiye, fetch apne aap hota rahega.
4. Network/DNS dikkat ho to ab **saaf message** aayega (page load fail ho to app khud ek baar retry karti hai).
5. Jaldi chahiye ya 2 clients parallel → **☁️ Cloud**.

> Bridge (`server.js` 1.28.0) aur Apps Script me **koi change nahi**.
