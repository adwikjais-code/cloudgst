# Sirf EK folder — kisi doosre folder me jhaankna band (v5_8_8)

## Aapki baat
> "drive me khud se ik folder bana ho aur usi se har bar search kare, kisi bhi folder me jhak kar na dekhe"

## Pehle kya galat tha
v5_8_7 me maine **poora Drive scan** (`DriveApp.getFolders()`) laga diya tha — har folder ke naam par nazar,
aur folder na mile to naya bana bhi deta tha. Wahi "idhar-udhar jhaankna" tha.

## Ab (v5_8_8) — sirf ek fixed folder
Order bilkul chhota:
1. **Saved folder ID** (ek baar set ho gaya to hamesha wahi — naam badle to bhi chalega)
2. Warna My Drive me **exact naam `GST Certificates`** — mil jaye to ID yaad rakh li jati hai
3. **Kuch na mile** → sirf ek saaf modal:
   - **Rasta 1:** My Drive me folder banaiye, naam bilkul `GST Certificates`
   - **Rasta 2:** folder ka **link paste** karke **Set** — bas ek baar. Uske baad hamesha wahi folder.
   - `🔄 Dobara scan` button

Ab **koi fuzzy search nahi, koi doosra folder nahi, koi auto-create nahi** (verify kiya: code me `DriveApp.getFolders()` = 0).

> Shared Drive ka folder ho? Koi dikkat nahi — **Rasta 2** (link paste) use kariye, wo Shared Drive par bhi chalta hai.

## Steps
1. Naya zip daalein → ⚙️ Setup → **📋 Copy Code** → Apps Script me paste → **Save** →
   **Deploy → Manage deployments → ✏️ → New version → Deploy**
2. My Drive me folder banaiye: `GST Certificates` (ya apne folder ka link copy kariye)
3. **➕ Client → ☁️ Drive folder se naye clients** → preview aayega
4. Folder ka naam alag hai to modal me link paste → **Set** → apne aap scan chal jayega

**Zip:** `GST_etsy_anyfile_fix_v5_8_8.zip` · 249,892 B · MD5 `aa8e262f49f86dc9e4a38e5684838771`
