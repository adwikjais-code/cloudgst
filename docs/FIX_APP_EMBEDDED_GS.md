# Fix: app ke andar "AppSync.gs Code" purana dikh raha tha — v5_8_5

## Kya hua tha
App ke ⚙️ Setup me jo **"AppSync.gs Code"** box hai (📋 Copy Code wala), usme **2,204 line ka purana code** embedded tha.
Kyunki aap wahin se copy karte hain, isliye naya `scanGstCerts` wala code wahan dikh hi nahi raha tha — app ka zip alag tha,
uske andar ka code alag purana.

## Ab kya kiya
- App ke andar embedded AppSync.gs **poora replace** — ab wahi **2,500 line** wala naya code hai jo repo me hai
  (`scanGstCerts`, `GST Certificates` folder scan, OCR, GSTIN checksum — sab andar hai)
- Title ke paas ek badge: **`NEW · Drive client scan`** — ek nazar me pata chal jayega naya hai
- Verify: app ke andar ka code **byte-to-byte naya `APPS_SCRIPT_AppSync.gs` ke barabar** (script se check kiya)
- Agar Apps Script purani deploy hui ho to ab saaf message aata hai:
  *"⚠️ Apps Script purani hai — 📋 Copy Code dabayein, paste karke Deploy (Manage deployments → ✏️ → New version) karein"*
  (pehle sirf `Unknown action: scanGstCerts` dikhta)

## Naya zip
**`GST_etsy_anyfile_fix_v5_8_5.zip`** · 247,687 bytes · MD5 `2cc44a219a1f851472c8a51f3700895d`
https://drive.google.com/file/d/1GvJA5uFrxDx6EBKTj7PFw2k1YvbcXeNV/view

## Steps (isi order me)
1. Naya zip app me daalein
2. ⚙️ Setup → **AppSync.gs Code** (badge `NEW · Drive client scan` dikhe) → **📋 Copy Code**
3. Sheet → Extensions → Apps Script → purana code **select all → delete → paste** → **Save**
4. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**
5. Drive me folder: **`GST Certificates`** → certificates daalein
6. App: **➕ Client → ☁️ Drive folder se naye clients**
