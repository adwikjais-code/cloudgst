# 🧯 Emergency Bundle — GitHub/Railway kuchh bhi delete ho jaye

Ek hi zip me **poora system** — upload karke sab dobara chalu:

**`google_drive/CloudGST_Complete_BACKUP_2026-11-26.zip`** (947,326 B · md5 `d652be186e0941f9161a840b8819d0e6` · 94 files)

Andar (saara code **wahi** hai jo aaj chal raha hai — kuchh badla nahi):

| Folder | Kya |
|---|---|
| `web/` | `index.html` (pura app, 1,181,489 B) + 5 pages — static host par upload karo, bas |
| `bridge/` | `server.js` (1.29.1) + `Dockerfile` + `railway.json` + `render.yaml` + `.env.example` + `run-local.sh` |
| `android/` | poora Android source + **`keystore.p12`** (APK signing key — sambhal ke rakhein) |
| `.github/workflows/android.yml` | CI — push karo, APK khud ban jayega |
| `apps-script/` | `APPS_SCRIPT_AppSync.gs`, `APPS_SCRIPT_gstr1_json_v5_8.gs` |
| `docs/` | deploy + fix notes |
| `START_HERE.md` | **step-by-step**: Render / Railway / Docker / PC — jahan chaho chalao |
| `checksums.txt` | 64 files ke SHA-256 (verify: `sha256sum -c checksums.txt`) |

## Verify (jo maine kiya)
- `unzip -t` → **No errors**
- `sha256sum -c checksums.txt` → **64/64 OK**
- `web/index.html` repo ke index.html se **byte-equal** (md5 `36991ce0…3986`)
- `bridge/server.js` → `node --check` **OK**, `package.json` = 1.29.1, `railway.json` valid

⚠️ Ye zip **private** rakhein (keystore + secrets ke placeholders isme hain).
