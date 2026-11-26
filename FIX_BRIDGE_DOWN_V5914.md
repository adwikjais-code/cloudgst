# Bridge down / "Load failed" — kya theek kiya (v5.9.14 · bridge 1.29.0)

**Aapki shikayat:** "Bridge se connect nahi ho paya (Load failed)" achanak aane laga, retry par 2B + E-Com dono **deselect** mil rahe the.

**Sach:** server (Railway) ne jawab dena band kar diya tha — app ka bug nahi. Proof: 21:55 aur 21:57 IST par `/health` theek tha, 22:05 ke baad `/health` aur `/` dono fail (usi tool se `example.com` khulta raha). Saath hi `activeSessions: 0` — app ka request server tak pahuncha hi nahi.

Ab app is situation ko **samajhta** hai, 60 second khud intezaar karta hai, aur saaf batata hai — laal error ka spam nahi.

---

## 1) App me kya badla (v5.9.14)

| # | Change | Pehle | Ab |
|---|---|---|---|
| 1 | **Error me asli URL + origin** | `Bridge se connect nahi ho paya (Load failed). Internet / Bridge URL check karein.` | `… (Load failed) — URL: https://cloudgst-production.up.railway.app · origin: https://…workers.dev. Internet / Bridge URL / CORS check karein.` |
| 2 | **Auto-retry (sirf network error par)** | ek hi koshish | ping / health / fetch-status / init-login par **3 koshish** (0s → 1.8s → 4.5s). HTTP 401/500 par **retry nahi** (spam nahi) |
| 3 | **Fetch se pehle bridge gate** | seedha fetch-all | pehle `/health` — down ho to **60s tak khud try**, phir saaf message: "Bridge server down hai … kuchh save nahi hua" (koi khaali data save nahi hota) |
| 4 | **Upar banner** | har row par laal error | ek banner: "☁️ Bridge server se connection nahi hai" + asli URL + **🔄 Abhi check karein** button |
| 5 | **🩺 Bridge test button** (Settings) | nahi tha | `/health` se **version + latency + uptime** dikhata hai (secret nahi bhejta) |
| 6 | **2B / E-Com yaad** | reload par reset / restore | `localStorage` me save + `pageshow` par dobara lagta hai (Safari restore fix) |
| 7 | **Dono OFF par guard** | chup-chaap khaali fetch | ruk jata hai: "GSTR-2B aur E-Com dono OFF hain — kam se kam ek tick karein", **kuchh save nahi** |
| 8 | **Bridge URL default** | khaali hone par dead-end | khaali ho to Cloud (Railway) par hi jata hai |
| 9 | **fetch-all par `retry:false`** | — | double fetch (do baar portal hit) kabhi nahi |

## 2) Bridge me kya badla (1.29.0)

- `/health` ab deta hai: `uptimeSec`, `memMB`, `heapMB`, `chromiumUp`, `lastBrowserCrashAt`, `activeSessions` — **restart hua ya Chromium gira**, turant pata chal jayega.
- `uncaughtException` / `unhandledRejection` ka asli reason `/debug` me record hota hai.
- CORS: `*.workers.dev` ke saath **`*.pages.dev`** bhi allowed.
- `render.yaml` — **backup bridge** Render par 3 click me (Railway down ho to).

---

## 3) Aapko abhi kya karna hai (Railway)

1. Railway → **Deployments / Logs** dekhein: `Crashed` / `Restarting` / `out of memory` / `Chromium band/crash hua`.
2. Railway → **Variables** me:
 - `API_SECRET` = jo app me hai (wahi)
 - `ALLOWED_ORIGIN` = `https://still-flower-aeed.taxandgstconsultancy.workers.dev,https://rough-sunset-e174.adwikjais.workers.dev,https://adwikjais-code.github.io`
3. Restart/redeploy ke baad check: `https://cloudgst-production.up.railway.app/health` → `"ok":true` + `uptimeSec` + `chromiumUp`.
4. App (web) me naya `index.html` daalein → ⚙️ **🩺 Bridge test** → "✅ v1.29.0 …". Phir Re-Fetch.

**Agar Railway baar-baar gire:** `render.yaml` se Render par backup bridge deploy karein → app me Settings → Bridge URL me Render ka URL. (Free plan sota hai, isliye `starter` rakha hai.)

---

## 4) Proof (sandbox, jsdom — 38 tests)

**Naye tests 21/21 PASS**
- error me URL + origin + "Load failed" ✅
- network error par **3 koshish**, phir success ✅
- 401 par **sirf 1 call** (spam nahi) ✅
- 🩺 button `/health` hit + `v1.29.0` + `uptime 123s` + **secret nahi bhejta** ✅
- health fail → banner dikhta hai; retry ke baad chhupta hai; banner me asli URL ✅
- 2B off → `localStorage=0`; reload ke baad **yaad** ✅
- dono-off guard fetch se **pehle**; `retry:false`; gate 60s ✅

**Regression 17/17 PASS** — default cloud, phone/cloud switch, in-app login (`phoneLoginVisible`), poll (`gpNativePoll`), phone debug copy, Settings (URL/secret/Save&Test), fingerprint row, 2B+E-Com toggles, FY/month, `not generated this month` wording, TCS path, 90s cooldown, GSTR-1 upload, Drive/Sheet save, WhatsApp/pdf buttons. **JS syntax: 5 blocks, 0 error.**
