# "Abhi kya hua?" — 12:16 wale fetch ka sach (bridge 1.28.0)

## Screen par kya dikha
Client 8 · ADARSH MAURYA
- TCS **₹1,37,192** · TCS ₹687 · ✓ Received · **✓ Synced 12:16** ← **TCS wapas aa gaya** (wahi purana data)
- 2B column **₹0**
- amber line: `Adhoora fetch — GSTR-2B: Portal par period select nahi ho paya (FY:false, Month:false). Page: … | Access Denied — https://services.gst.gov.in/services/error/accessdenied. Dropdowns mile → koi select`

## 3 baatein
**1. TCS fix kaam kar gaya ✅** — jo ₹1,37,192 / ₹687 pehle aata tha, wahi wapas. (v1.21 wale waits restore karne se.)

**2. Fetch fail nahi hua ✅** — row ✓ Synced hai, Sheet me save hua. 2B ki dikkat sirf amber note me hai (red Error nahi).

**3. 2B Access Denied ❌ — ye mera hi banaya hua problem tha**
`services.gst.gov.in/services/error/accessdenied` = **portal ka WAF block**. Ye tab lagta hai jab koi **seedha URL** kholta hai
(`/returns/auth/dashboard`) bina menu se jaye. Pichhle version (1.25) me maine "force returns dashboard" ke liye **direct URL goto**
lagaya tha — usi se WAF ne Access Denied de diya. `FY:false, Month:false … koi select` = us page par **ek bhi dropdown nahi** hota.

## Ab kya badla (1.28.0) — insaan jaisa rasta
1. **RETURN DASHBOARD** button/link click (jaisa aap karte hain)
2. Na mile to **Services ▾ → Returns → Returns Dashboard** menu link click (aapke screenshot wala rasta)
3. Pehle se Access Denied page par hain to **5s cool-down → services dashboard → phir menu click**
4. **Direct URL sabse aakhir me** (aur agar WAF phir bhi roke to saaf message: "Returns Dashboard nahi khul paya (access_denied)…",
   pehle jaisa confusing "period select nahi ho paya" nahi)

Isse 2B ka rasta wapas menu-click wala ho gaya — wahi jo manually chalta hai.

## Verify
- Bridge **1.28.0** `/health` ✅ · tests **116/116** (`node --check` clean)
- App me koi change nahi — **v5_8_3** hi (ya v5_8_2) chalega; bridge automatic

## Ab kya karein
1. Client 8 par **Re-Fetch** → 2B ya to download hoga, ya `not generated this month` (agar portal par bani hi nahi), ya phir se Access Denied.
2. Agar **Access Denied dobara** aaye to 2 minute ruk kar Re-Fetch karein (portal ka WAF thodi der block karta hai) —
   ya browser me ek baar manually login karke Returns Dashboard khol lein, phir Re-Fetch.
3. Client 9 par captcha dikh raha hai — wo normal login step hai (Fetch dabate hi captcha aata hai, Code daal kar Go).
