# CloudGST (`gst-cloud-bridge`)

End-to-end GST workflow suite combining:
1. **Cloud Bridge (`server.js` `v1.29.1`)** — Playwright + Express automation server for GST Portal login/OTP, GSTR-2B summary & B2B sellers extraction, E-Commerce TCS gross taxable extraction, Notices scraping, and GSTR-1 JSON upload.
2. **Web & Android App (`web/` -> `android/app/src/main/assets/app/`)** — Offline-capable single-page UI (Tailwind CSS + PDF.js bundled locally, modular `web/js/*.js`) paired with a native Android WebView shell (`com.cloudgst.app`, `v5.9.14`) offering biometric lock, native in-app GST portal login/fetch (`PhoneLogin`/`PhoneFetch`), and Drive/Sheets cloud sync.
3. **Google Sheets & Drive Backend (`APPS_SCRIPT_AppSync.gs`)** — Google Apps Script backend for client registry, GSTR-2B/E-Com/Notices rows, Etsy statement storage, GSTR-1 JSON Drive archive, revision-checked Fee Management sync, and device OTP verification.

---

## Project Layout

```
server.js                     Playwright + Express GST Cloud Bridge
APPS_SCRIPT_AppSync.gs        Google Apps Script backend (Sheets + Drive)
web/                          Modular UI source (index.html, css/, js/*.js, redirect stubs)
scripts/build-web.js          Bundles web/ + vendor assets + APPS_SCRIPT_AppSync.gs -> android assets
android/                      Android Gradle project (com.cloudgst.app)
test/                         Node native test suite (helpers, api, portal, web, apps_script)
docs/                         Historical release notes & troubleshooting guides
```

---

## Quick Start

```bash
npm install
npm run build:web
npm test
```

Start the Cloud Bridge locally (copy `.env.example` to `.env` and set `API_SECRET`):

```bash
API_SECRET=your-strong-secret ALLOWED_ORIGIN=http://localhost:8080 npm start
```

---

## Security & Operations Highlights

- **Strict CORS Allowlist**: `server.js` only allows origins listed in `ALLOWED_ORIGIN` (comma-separated) alongside local WebView origins (`http://localhost`, `http://127.0.0.1`, `file://`, `capacitor://`). No wildcard `*.workers.dev` or `*.pages.dev` matching.
- **No Hardcoded Runtime Secrets**: The app UI (`web/`) ships without embedded default PINs or bridge API secrets (`#gpBridgeSecInp` is a masked password field; Apps Script sync supports optional `SYNC_SECRET` stored in Script Properties and client `localStorage`).
- **Offline Assets**: `scripts/build-web.js` compiles Tailwind CSS (`tailwindcss@3.4.17`) and copies `pdfjs-dist@3.11.174` into `android/app/src/main/assets/app/vendor/` so the Android app works without external CDNs.
- **Native Phone-Mode Fixes**: `web/js/gstr2b-parser.js` extracts GST Portal keys (`iamt`, `camt`, `samt`, `csamt`) as well as bridge keys (`igst`, `cgst`, `sgst`, `cess`), fixing zero-tax parsing in Phone-mode GSTR-2B fetches.
- **Fee Sync Optimistic Locking**: `APPS_SCRIPT_AppSync.gs` and `web/js/tracker-and-sync.js` track `FEE_REVISION` and deleted receipt tombstones so concurrent multi-device fee updates merge cleanly without silently overwriting or resurrecting deleted receipts.
