# v5_9 — Web + Mobile dono saath (Apps Script change web ko chhuta nahi)

**Aapka sawaal:** "Apps Script me Android app ke liye change kar denge to web app par asar padega?"

**Jawab: nahi. Zero asar.** Neeche proof hai — aur ek extra safety bhi daal di hai.

---

## 1. Proof — Apps Script me sirf **naya code juda** hai, purana hata nahi

v5_7 (aapka chal raha web app) ka Apps Script vs naya (v5_9) — **line-by-line diff**:

```
old lines: 2149    new lines: 2199
removed lines: 0        <-- ek bhi purani line nahi hui delete ya badli
added lines: 50         <-- sirf 50 nayi lines judi
```

Kya juda:
- 47 lines: `saveGstr1Json` / `listGstr1Json` / `readGstr1Json` + `getGstr1JsonFolder` / `gstr1JsonSafeName` helper
- 3 lines: `doPost` router me naye action — **purane actions ke baad**, `handleSyncAction` se pehle

Iska matlab:
| Cheez | Status |
|---|---|
| Deployment URL /exec | **wahi** |
| Purane actions (`etsyStatement`, `getAllRov`, `savePortalClientData`, `saveFeeData`, `handleSyncAction`, …) | **jaise the waise** |
| Web app (v5_7 / v5_8) naye Apps Script ke saath | **bilkul pehle jaisa chalega** |
| Android APK purane Apps Script ke saath | app chalega, par Save/Select error degi (fallback se kaam chalta rahega) |

Yaani Apps Script update karna **additive** hai — kuch rename/remove nahi hua.

## 2. Web ko extra safe bana diya (v5_9)
Aapne kaha "purana jaisa chalta rahe" — isliye v5_9 me **dono tareeke** hain, ek hi file me:

**GSTR-1 JSON page**
- `☁️ Drive me Save (json folder)` ← naya (mobile + web dono par chalega)
- `📥 Download` ← **purana tareeka, wapas** (browser me file download)

**GST Portal page**
- `☁️ json folder (N) — file chunein` + `🔄` + `☁️ Load All` ← naya
- `📄 Files` ← **purana file chooser, wapas** (PC/web par bhi kaam karega)

Aur: Drive list fail ho (purana Apps Script / net issue) to ab **sirf ek baar** halka warning aata hai — baar-baar toast nahi; `📄 Files` se seedha kaam chalta rahega. **Kuch bhi block nahi hota.**

## 3. Mobile APK v5.9
👉 **https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk**
(link ab kabhi nahi badlega — har naye build par isi naam se APK aata rahega)

Verify (build ke baad auto-check): `index.html 1,103,859 B` · portal hook 2 · save/select 5 · **download fallback 2** · **file picker fallback 2** · dex `openPortal` 1 · `CloudGSTNative` 1 · `user_pass` 1 · manifest ok · sha256 `9fdf9f82…b30d` · 594 KB.

APK ke andar bhi wahi dual-mode app hai — web wala tarika mobile par bhi chalta hai, aur mobile ka naya tarika (🌐 Portal Login, Drive select) bhi.

## 4. Web bundle (PC/desktop ke liye)
`GST_etsy_anyfile_fix_v5_9.zip` — Drive id `1Xg8S9I0YAFUWpRtrqki6mZlYe0La9h6B` (240 KB, 6 files)

## 5. Ek-line summary
- **Apps Script update** → sirf naya feature judta hai; **web app par bilkul asar nahi**.
- **Web app** (naya ya purana) → chalega hi; Drive list na bhi mile to `📥 Download` + `📄 Files` se kaam hota rahega.
- **Android APK** → web jaisa poora app + `🌐 Portal Login` (ID/password prefilled, sirf captcha).
