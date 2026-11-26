# ☁️ Drive folder se naye clients (one click) — v5_8_4 + Apps Script naya version

Aapka sawaal: *"Drive ke ek folder me GST certificates daalu, aur client page par ek option aaye jo ek click me saare naye GSTIN add kar de — jo pehle se hain wo add na ho."*
**Ban gaya.** Aur aapke kehne ke mutabik teeno add options ek hi saaf dropdown me hain.

---

## 1) Client page par ab kya dikhega
Header me pehle ke 2 buttons (➕ Add Client, 📄 GST Paper Auto-Add) ki jagah **ek button**:

```
➕ Client ▾
 ├─ ✍️  Manually add karein            (purana form — jaisa tha)
 ├─ 📄  GST paper se (ek file)          (purana file wala — jaisa tha)
 └─ ☁️  Drive folder se naye clients    ← NAYA
```

## 2) Naya option kaise kaam karta hai
1. My Drive me folder banaiye: **`GST Certificates`** (naam bilkul yahi).
2. Usme GST certificate PDF/photo daal dijiye (jo client abhi list me nahi hai).
3. App me **➕ Client → ☁️ Drive folder se naye clients** dabaiye.
4. App scan karke **preview** dikhayegi:
   ```
   Folder GST Certificates · 18 file · 5 naye · 13 skip (pehle se hain)
   ☑ ADARSH MAURYA · SHAKUSHIV ENTERPRISES · 09FNZPM7904J1ZY
     Uttar Pradesh · 01-Jul-2023 · SHOP NO 12, KUNDA…
   ```
5. **➕ Add selected** → clients list me add + Sheet me sync + row me `✓`.
   (Kisi ko nahi add karna? checkbox hata dein — default sab tick hain.)

## 3) Duplicate kaise nahi honge
- Pehle **Sheet** ke dono tabs (`PAID CLINTS` + `Apne`) ke **GSTIN** se tulna hoti hai → jo GSTIN pehle se hai wo **skip** (preview me "13 skip" likha aata hai).
- App me bhi **dobara check** hota hai (local list se) — double safety.
- Same naam par naya GSTIN mile to row par ⚠️ nishan aata hai, aap decide karein.

## 4) GSTIN kahin se aata hai (aapka chuna hua: dono)
1. **File name se** — `09FNZPM7904J1ZY ADARSH MAURYA.pdf` → turant, 100% sahi.
   (naam ka koi bhi style chalega: `GST_Certificate_09EMJPB3234G1Z8_Busara_Bano.pdf` bhi)
2. Na mile to **OCR** — certificate ke andar se GSTIN + Legal Name + Trade Name + address + registration date.
   OCR ke liye Apps Script me **Drive advanced service** on karna hoga (ek baar, neeche step 5).
3. GSTIN ka **check digit** bhi verify hota hai — galat padha gaya GSTIN ⚠️ ke saath dikhta hai.

## 5) Ab aapko kya karna hai (ek baar)
1. **Apps Script** → poora naya code paste karein (`APPS_SCRIPT_AppSync.gs`, 2,4xx lines) → **Save**
2. OCR chahiye to: left side **Services** → **Drive API** add karein (naam: `Drive`, identifier `Drive`)
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (New deployment ❌)
4. App me naya zip daalein: **`GST_etsy_anyfile_fix_v5_8_4.zip`**
5. Drive me folder banaiye: **`GST Certificates`**

> Folder ka koi aur naam chahiye? Apps Script me **Project Settings → Script properties** me
> `GST_CERT_FOLDER_ID` = folder ki ID daal dein — bas.

## 6) Bharne wali details (aapka chuna hua)
Name · Firm · **GSTIN** · State · Registration date (+ address bhi address column me chala jata hai).
Category default **PAID CLINTS**, status **Active**, clientType RUGS/CARPET naam se auto, `ptDate` mahine ke end.

## 7) Sach (limits)
- Folder me **sirf GST certificates** rakhein — koi aur PDF daala to OCR galat client bana sakta hai (preview me pakad lenge).
- Pehli scan OCR ke saath **1–2 min** le sakti hai (per file 2–5 s). Filename me GSTIN ho to seconds.
- Ek baar me max **300 file** scan hoti hain.
- Certificate "photo tirchha/dhundhla" ho to GSTIN galat aa sakta hai — ⚠️ wale rows verify kar lijiye.
- **Sheet save hota hai** add karte hi (`pushClientToSheet`), offline hone par queue me jaata hai.

## Verify
- App `index.html` md5 `2bbe7d45d746f31fc376eab721b8c6a5` · zip `4ebb40617c0eb2e20dafd74a90a340dd` · integrity OK
- Apps Script parse OK, GSTIN checksum/parse tests pass (ADARSH/BUSARA ke asli GSTIN par check kiya)
- Bridge me koi change nahi — **1.28.0** hi rahega
