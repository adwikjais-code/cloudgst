# APK v5.8.2 — swipe-back gesture + fingerprint lock

## 📱 Download
# https://github.com/adwikjais-code/cloudgst/releases/latest/download/CloudGST.apk

`597 KB` · versionName **5.8.2** · sha256 `5bec7b4608d6608867410e306a4539bfe8e96d34d38fbc8fe0c9f4cf4b3a0eee`
Naya APK purane ke **upar** seedha install ho jayega (signing key same) — data safe.

---

## 1. Back / swipe-back ab poora kaam karta hai
Pehle: system back dabane par app seedha band ho jata tha (kyunki tab switching URL history nahi banati).

Ab back / edge-swipe gesture is order me chalta hai:
1. **Koi modal/popup khula** (client edit, fee payment, sync setup, WhatsApp, PDF…) → wo band
2. **Pichhla tab** (jaise Portal → JSON → Tracker)
3. **Tracker** par pahunch kar → app band

Teknik: Android 13+ ka **predictive back** (`enableOnBackInvokedCallback` + `OnBackInvokedDispatcher`) aur purane Android ke liye `onBackPressed` — dono ek hi `handleBack()` par jate hain, jo JS se poochta hai `window.cloudGstHandleBack()` (page stack `__gpPageStack`).

## 2. Fingerprint lock (app kholne par)
- Pehli baar: **Portal tab → ⚙️ Settings** → neeche **`🔒 App lock (fingerprint): OFF`** button → dabaiye → ON.
- Agli baar app khulte hi **fingerprint** maangega; **device PIN/pattern** bhi chalta hai (fingerprint na lage to bhi phansenge nahi).
- Band karna ho: wahi button dobara → OFF.
- Android 11 (API 30) se upar wale phones par available; purane phone par button hi nahi dikhega (crash nahi karega).
- Locked screen par "👆 Unlock" aur "App band karein" — back dabane par app band ho jata hai.

## 3. UI pehle jaisa
JSON page: `☁️ Drive me Save` + `📋 Copy JSON` (koi download button nahi) · Portal page: `☁️ json folder (N)` + `🔄` + `☁️ Load All` (koi file chooser nahi) · Client row: `🌐 Portal Login`.

## Verify (build ke baad auto-check)
```
manifest ok: yes
index.html bytes: 1104883
native portal hook count: 2
json save/select count: 5
download button (0 = v5_8 jaisa): 0
file picker (0 = v5_8 jaisa): 0
dex openPortal: 2 | dex CloudGSTNative: 1 | dex BiometricPrompt: 1 | dex setBioLock: 2
js back handler: 1 | js bio toggle: 2 | dex user_pass: 1
```

## Files
- APK: `CloudGST.apk` (release `android-v5.8.2`)
- Code: `android/app/src/main/java/com/cloudgst/app/MainActivity.java` (back + biometric), `PortalLoginActivity.java` (portal prefill)
- Web bundle (browser ke liye, v5_8 jaisa): `GST_etsy_anyfile_fix_v5_8_1.zip` — Drive id `1KKeYNHJsJRRsSDa_-8gL_gsxD7LpKIbK`
