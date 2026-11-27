# Railway par server — sab hata kar naya (fresh) deploy

Ye guide bilkul **shuru se** hai: purana service delete → naya deploy → env → verify → app me URL.
Repo me ab `railway.json` + `Dockerfile` dono hain, isliye Railway ko kuch set karne ki zaroorat nahi — sab automatic.

---

## 0) Pehle: naya URL aayega
Purana service delete karne par **`cloudgst-production.up.railway.app` wala URL khatam ho jayega**.
Naya domain milega (jaise `cloudgst-bridge-production-a1b2.up.railway.app`) — usko app me Settings me daalna hoga.
👉 Chahte hain ki URL kabhi na badle? Railway → **Settings → Networking → Custom Domain** se apna domain laga lein (baad me bhi kar sakte hain).

---

## 1) Purana sab hata do
1. railway.app → apna **project** kholein
2. Service **cloudgst-production** → **Settings** (neeche tak) → **Delete Service** (ya poora project delete kar dein)
3. Confirm karein — **Dashboard → Usage** me check kar lein ki koi service nahi bachi

---

## 2) Naya project + GitHub se deploy
1. Railway Dashboard → **+ New Project** → **Deploy from GitHub repo**
2. Repo: **`adwikjais-code/cloudgst`** → branch: **`main`**
   (agar `main` na dikhe to `Configure GitHub App` → us repo ko access dein)
3. Railway `railway.json` khud padhega:
 - Builder: **Dockerfile** (`Dockerfile` = Playwright + Chromium, ready hai)
 - Healthcheck: **`/health`**
 - Restart policy: **ON_FAILURE (10 retries)** — crash hone par khud wapas aayega
4. Build **5–12 minute** lega (Chromium image bada hai). **Deployments → View Logs** me dekhein.

> Build fail ho to 90% wajah: memory limit ya build timeout. Railway → Service → **Settings → Resources** me **memory 2 GB** kar dein aur phir **Redeploy**.

---

## 3) Variables (Variables tab)
| Key | Value |
|---|---|
| `API_SECRET` | `<your-strong-secret-here>` *(ek strong random token daalein, app Settings me bhi wahi dalein — public me kabhi share na karein)* |
| `ALLOWED_ORIGIN` | `https://still-flower-aeed.taxandgstconsultancy.workers.dev,https://rough-sunset-e174.adwikjais.workers.dev,https://adwikjais-code.github.io,https://appassets.androidplatform.net` |
| `NODE_ENV` | `production` |
| `MEM_LIMIT_MB` | `1200` *(RAM isse badhi to server khud sessions+Chromium band karega, girayega nahi)* |
| `MAX_SESSIONS` | `6` |
| `PLAYWRIGHT_BROWSERS_PATH` | `/ms-playwright` |

`PORT` **na** daalein — Railway khud deta hai, code usi ko use karta hai.

---

## 4) Domain banao
Service → **Settings → Networking → Generate Domain** → URL copy karein.

---

## 5) Check (browser me)
`https://<naya-url>/health` → aisa JSON aana chahiye:
```json
{
  "ok": true, "service": "gst-cloud-bridge", "version": "1.29.1",
  "secretConfigured": true,
  "uptimeSec": 42, "memMB": 210, "heapMB": 40,
  "chromiumUp": false, "lastBrowserCrashAt": null,
  "activeSessions": 0, "timestamp": "…"
}
```
- `version: 1.29.1` = naya code chal raha hai ✅
- `secretConfigured: true` = API_SECRET mila ✅
- `uptimeSec` badhta rahe = server gir nahi raha ✅
- `chromiumUp` pehle `false` — ye normal hai, pehle fetch par Chromium khulega.

---

## 6) App me naya URL daalein
Web app → **GST Portal → ⚙️ Settings** → **Bridge Server URL** = naya URL → **Save & Test** → **🩺 Bridge test**
- `✅ v1.29.1 · xx ms · uptime …` = sab theek
- phir client par **Re-Fetch** (GSTR-2B + E-Com dono tick)

---

## 7) Kuch galat ho to (troubleshoot)
| Symptom | Wajah | Fix |
|---|---|---|
| Build fail "no space / killed" | memory/disk | Resources → 2 GB, redeploy |
| Deploy "Crashed" turant | `PLAYWRIGHT_BROWSERS_PATH` galat ya Dockerfile miss | repo me `Dockerfile` root me hona chahiye |
| `/health` 502 | service listen nahi kar raha | Logs me `running on port` dikhna chahiye |
| App me `Load failed` | URL purana/galat | Settings me naya URL, Save & Test |
| App me `HTTP 401` | secret mismatch | `API_SECRET` = app ka secret |
| App me CORS error (origin) | naya origin | `ALLOWED_ORIGIN` me origin jodein (workers.dev/pages.dev khud allowed hain) |
| Baar-baar crash | RAM | `MEM_LIMIT_MB` kam karein (800) + memory 2 GB |

---

## 8) Backup (agar Railway par plan/limit ka masla ho)
`render.yaml` repo me hai → render.com → **New → Blueprint** → repo chunein → Apply → `API_SECRET` daalein.
Render free plan sota hai, isliye `starter` rakha gaya hai. Dono me se jo chale, app me wahi URL rakh lein.
