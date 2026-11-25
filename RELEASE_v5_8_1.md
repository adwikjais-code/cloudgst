# Final: v5_8 behaviour — web + Android APK

Aapne kaha **"v5_8 hi theek tha"** — to v5_9 ke extra buttons (📥 Download, 📄 Files) **hata diye**. UI bilkul v5_8 jaisa, plus mobile-only naya feature.

## APK (link kabhi nahi badlega)
# 📱 https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk

`594 KB` · versionName **5.8.1** · sha256 `bf17738fcde4a3cce24b593b6b85706eaa2d0bf7e5806710eb9b97359975c3ec`
Release: https://github.com/adwikjais-code/cloudgst/releases/tag/android-v5.8.1

## Web bundle (PC/desktop)
`GST_etsy_anyfile_fix_v5_8_1.zip` — Drive id `1KKeYNHJsJRRsSDa_-8gL_gsxD7LpKIbK` (240 KB, 6 files)

## UI ab exactly v5_8 jaisa
| Page | Kya hai |
|---|---|
| GSTR-1 JSON | `☁️ Drive me Save (json folder)` + `📋 Copy JSON` — **koi Download button nahi** |
| GST Portal | `☁️ json folder (N) — file chunein` + `🔄` + `☁️ Load All` — **koi file chooser nahi** |
| Client row (sirf APK me) | `🌐 Portal Login` — app ke andar portal, ID/password prefilled, sirf captcha |

APK verify (build ke baad auto-check):
```
index.html bytes: 1101849
native portal hook count: 2
json save/select count: 5
download button (0 = v5_8 jaisa): 0
file picker (0 = v5_8 jaisa): 0
dex openPortal: 1 | dex CloudGSTNative: 1 | dex user_pass: 1 | manifest ok: yes
```

## v5_8 se difference (sirf 3 lines)
v5_8 zip se line-by-line diff:
```
removed: build marker comment | ek JS comment | action-cell line (native button add hua)
added:   28 lines = gpNativePortalBtn + gpNativeOpenPortal + listener + row me lagana
```
Yaani **web par dikhne/wala behaviour bilkul same**; native code sirf APK ke andar `window.CloudGSTNative` hone par chalta hai.

## Yaad rakhein
- Apps Script update (📋 Copy Code → paste → Deploy New version) ab **bhi zaroori** hai — JSON Save/Select ke liye. Purane actions waise hi hain, web par asar nahi (0 lines removed).
- APK me apps script update na karo to Save/Select error degi (v5_8 jaisa hi behaviour, kyunki fallback buttons aapne hatwa diye).
