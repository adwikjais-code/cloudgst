# App v5_8 — GSTR-1 JSON: download ki jagah Drive "json" folder me Save, aur portal me dropdown se select

**Bundle:** `GST_etsy_anyfile_fix_v5_8.zip` (Drive id `1HdB79g-BmOH17sGJuF3yKMPAxTd8aoY7`, 240,070 B)
**Apps Script code:** `APPS_SCRIPT_gstr1_json_v5_8.txt` (Drive id `1J6J5lAgpcYmKnYaBttTFprcTR37uGb1S`) — **ye paste karna zaroori hai**
**Base:** v5_7 (single-file app + stubs)

---

## 1. JSON page: "📥 Download" hata, "☁️ Drive me Save" laga

**Pehle:** `Download GSTR-1 .JSON File` → browser ke Downloads me file jati thi, phir portal page par file chooser se uthani padti thi.

**Ab:** `☁️ Drive me Save (json folder)` → JSON seedha Google Drive ke **`json`** naam ke folder me chala jata hai
(folder na ho to Apps Script khud bana deta hai). File ka naam wahi pattern: `GSTR1_<GSTIN>_<MMYYYY>.json`.
Save hote hi toast: `☁️ GSTR1_… .json Drive ke 'json' folder me save ho gaya!`

- Same naam ki file dobara save karein to purana version trash hota hai (folder me duplicate nahi bante).
- `📋 Copy JSON` button waise hi hai.

## 2. Portal page: file chooser khatam, Drive se dropdown

**Pehle:** `📂 GSTR-1 Folder` + `📄 JSON Files` (dono file chooser).

**Ab:** ek hi dropdown (toolbar me):
```
☁️ json folder (57) — file chunein      🔄      ☁️ Load All
```
- Dropdown me folder ki saari JSON (naam + last updated) — select karte hi wo file Drive se padhi jati hai, GSTIN se client match hoti hai aur row par `📤 Upload` aa jata hai (wahi purana flow).
- `🔄` = list refresh.
- `☁️ Load All` = folder ki saari JSON ek saath load + match (88 clients ke liye ek click) — banner me kitni ready/done dikhta hai.
- Month mismatch ho to pehle jaisa `⚠️ Wrong Month` warning.

## 3. Apps Script (naya code paste karna zaroori)

Teen naye actions add hue hain — `saveGstr1Json`, `listGstr1Json`, `readGstr1Json` — aur folder helper:

```js
var GSTR1_JSON_FOLDER_NAME = 'json';

function getGstr1JsonFolder() {
  var it = DriveApp.getFoldersByName(GSTR1_JSON_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(GSTR1_JSON_FOLDER_NAME);
}

function saveGstr1Json(data) {       // same naam -> purana version trash, naya file create
  var folder = getGstr1JsonFolder();
  var fname = gstr1JsonSafeName(data.fileName);
  var same = folder.getFilesByName(fname);
  while (same.hasNext()) same.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(String(data.jsonText), 'application/json', fname));
  return { status: 'ok', id: file.getId(), name: file.getName(), url: file.getUrl(), folder: folder.getName() };
}

function listGstr1Json() { /* folder ke files: id, name, size, updated (max 300) */ }
function readGstr1Json(data) { /* DriveApp.getFileById(data.id).getBlob().getDataAsString() */ }
```

**Kaise lagayein (ek hi baar):**
1. App kholein → Settings (⚙️) → **📋 Copy Code** (ab isme naya code hai) — ya Drive se `APPS_SCRIPT_gstr1_json_v5_8.txt` kholein.
2. Google Sheet → Extensions → **Apps Script** → poora purana code hata kar ye paste karein.
3. **Deploy → Manage deployments → Edit → Version: New version → Deploy** (URL wahi rahega).
4. App me wapas aakar **Portal tab** kholein → dropdown me `☁️ json folder (N)` dikhna chahiye.

> Jahan tak Apps Script update nahi hoga, wahan app saaf error degi: "Settings → 📋 Copy Code se naya Apps Script paste karein" — kuch chup-chaap fail nahi hoga.

## Verification
- `index.html` ke paanchon `<script>` block + poora embedded Apps Script code (2,199 lines) `node --check` clean.
- Purane file-input references (`gpGstr1FolderInp` / `gpGstr1FilesInp`) **0** — file chooser bilkul hat gaya.
- JSON download (`a.download` wala JSON handler) hata diya — sirf copy + Drive save bacha.

## Flow ab aisa hai
1. **GSTR-1 JSON tab** → client chunein → JSON banayein → **☁️ Drive me Save**.
2. **GST Portal tab** → dropdown se wahi file chunein (ya **Load All**) → row par **📤 Upload** → captcha → GSTR-1 portal par chadh jayegi.
