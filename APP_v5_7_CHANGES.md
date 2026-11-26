# App v5_7 — ek file + chhote redirect stubs (5.4 MB → 1.1 MB)

**Bundle:** `GST_etsy_anyfile_fix_v5_7.zip` (Drive id `1z_WXdsxtKBFYrJwrzsSVm_zPaBUqT7av`, 238,013 B)
**Base:** v5_6 (v5_5 + v5_6 ke saare fix isi `index.html` me shamil hain)
**Verify:** `index.html` ke paanchon `<script>` block `node --check` clean; routing logic ka 7/7 unit test; stubs ke scripts bhi clean.

---

## Kya badla

**Pehle:** 6 HTML files, har ek ~1.09 MB. Code bilkul same, sirf ek line ka farq:
```js
let currentAppPage = window.DEFAULT_START_PAGE || "tracker";   // fees / json / master / portal
```
Matlab: har fix 6 jagah, har update 6.5 MB.

**Ab:**

| File | Size | Kya hai |
|---|---|---|
| `app/index.html` | 1,092,305 B | **Poora app** (tracker default) |
| `app/gst_client_tracker.html` | 794 B | `→ index.html#tracker` |
| `app/gst_portal.html` | 782 B | `→ index.html#portal` |
| `app/fee_management.html` | 782 B | `→ index.html#fees` |
| `app/gst_json_generator.html` | 796 B | `→ index.html#json` |
| `app/master_etsy_editor.html` | 784 B | `→ index.html#master` |
| **Total** | **1,096,243 B** | **~6x chhota** |

Purane URL/bookmarks wahi rahenge — `gst_portal.html` kholne par redirect `index.html#portal` par le jayega.

## index.html me do chhote badlav

1. **Default page** ab `window.DEFAULT_START_PAGE` → `?page=` → `#hash` → `tracker` ke order me chunta hai:
```js
const valid = ["tracker", "fees", "json", "master", "portal"];
const qp = new URLSearchParams(location.search).get("page");
const hp = location.hash.replace(/^#\/?/, "");
const pick = valid.includes(qp) ? qp : (valid.includes(hp) ? hp : "");
return pick || "tracker";
```
2. **Tab switch par URL update**: `history.replaceState(…, "#" + pageName)` — refresh ya link share karne par wahi tab khulta hai.

## Test kiye gaye cases (7/7 pass)
`""`→tracker • `?page=fees`→fees • `#portal`→portal • `#/json`→json • `?page=kuchbhi` + `#master`→master • invalid→tracker • `DEFAULT_START_PAGE="portal"`→portal

## Kaise lagein
1. Purane 6 HTML files ki jagah is bundle ki 6 files rakhein (naam same hain, structure same `app/`).
2. **Ctrl+Shift+R** — browser purani 1 MB file cache kar raha hoga.
3. Check: `gst_portal.html` kholne par URL `index.html#portal` ho jaye aur Portal tab khule; tab switch karne par URL ka hash badle.

## Aage kya asaan ho gaya
- Har naya fix ab **sirf `index.html`** me — 1 file, 1 MB.
- Bundle 238 KB ka hai, isliye Drive/WhatsApp se bhejna bhi aasan.

## Ab bhi baaki (chhote)
- 88 rows ka poora re-render (search debounce + lazy drawer).
- Sheet me `GSTR2B_B2B_JSON` ke chhote chunks (48k cell limit ka permanent hal).
