# "Drive me 'GST Certificates' folder nahi mila" — kyun, aur ab kya (v5_8_7)

## Kyun likha
App ne Drive me **`GST Certificates`** naam ka folder dhoondha — **nahi mila**. Us waqt sirf yahi message tha,
aur aage kuch nahi hota tha. (Folder abhi bana hi nahi tha, ya naam thoda alag tha, ya folder Shared Drive me tha.)

## Ab kya hota hai (v5_8_7)
1. Folder dhoondhne ke **4 raste**:
   - saved folder ID (Script Property `GST_CERT_FOLDER_ID`)
   - **exact naam**: `GST Certificates`
   - **milta-julta naam**: `GST Certificate`, `GST Certs`, `GST Papers`, `GST Registration`…
   - **Clients folder ke andar** wala aisa folder
2. Kuch na mile to **khud folder bana deta hai** → app me saaf modal: **"📁 Folder bana diya"** + **📂 Folder kholein** button
3. Ban jane ke baad bas certificates daalein aur **➕ Client → ☁️ Drive folder se naye clients** dobara dabaiye

Folder ka ID yaad bhi rakh liya jata hai (Script Property me), taaki agli baar seedha wahi khule.

## Ab kya karein
1. Naya zip app me daalein → ⚙️ Setup → **📋 Copy Code** → Apps Script me paste → **Save** → **Deploy → Manage deployments → ✏️ → New version → Deploy**
2. **➕ Client → ☁️ Drive folder se naye clients** dabaiye
3. Ab ya to preview aayega (agar folder mil gaya) ya **"📁 Folder bana diya"** modal — usme **📂 Folder kholein** → certificates daalein → dobara scan
4. Dhyan: certificates **My Drive** me rakhein (Shared Drive ho to folder ka link/ID mujhe bhej dein, us case ke liye alag raasta lagega)

**Zip:** `GST_etsy_anyfile_fix_v5_8_7.zip` · 249,351 B · MD5 `38af6441c7448736f4b244b2cbeb4e5d`
