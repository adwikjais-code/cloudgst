# Bug check — v5_8_11 (asli test kiya, sirf claim nahi)

## Kaise check kiya
1. **Static checks** (poora app HTML): duplicate ids, `getElementById` se maange gaye ids HTML me hain ya nahi,
   naye functions defined hain, hataye gaye purane naam ka koi reference bacha hai kya, embedded AppSync.gs == repo file
2. **Functional test (jsdom — browser jaisa, real DOM + real app scripts)** — 21 checks:
   edit-save, save ka har fail case, dropdown, Drive scan ke 3 raste (preview / folder-missing / folder-created), dedupe, add
3. **Bridge tests**: `npm test` **116/116**
4. **Apps Script unit checks**: GSTIN checksum, filename parse, certificate text parse, folder-link → ID

## 🔴 2 asli bug mile — dono fix ho gaye
### Bug 1: `type="number"` inputs values kha jaate the
`ROV` me `2,500` paste karne par (ya comma wali value) browser input ko **khaali** kar deta tha, aur `Due Months` par
`max=36` hone se 40 jaisi value par **submit hi nahi hota tha**. Test me: `ROV "2,500"` → **save 0**, `DueMon 40` → clamp nahi.
**Fix:** dono inputs ab `type="text" inputmode="decimal|numeric"` + code me sanitize/clamp (`2,500` → 2500, 40 → 36).
Test: **PASS** (ROV 2500, DueMon 36)

### Bug 2: (pichhle round ka) save ka silent fail — ab confirm bhi ho gaya
`sr` string vs number, `required/pattern` wali hidden validation, double click — teeno ka fix test se verify:
- edit save (sr number) ✅
- edit save (sr string) ✅
- record na mile → saaf message ✅
- firm khaali → save nahi + message ✅
- Save button dobara enable ✅

## ✅ Baaki sab pass
| Test | Result |
|---|---|
| ➕ Client dropdown (3 option) | PASS |
| Drive scan preview | PASS |
| Duplicate GSTIN filter (3 me se 2 naye) | PASS |
| Add selected → 2 client jude (78 → 80) | PASS |
| State + date + address bhare | PASS (`Uttar Pradesh · KUNDA 230201`, `01-Jul-2023`) |
| Duplicate GSTIN dobara add nahi hua | PASS |
| Dobara scan → "Koi naya GSTIN nahi mila" | PASS |
| Folder-na-mila modal + link Set → scan dobara | PASS |
| Folder khud ban jaye modal | PASS |
| Naya client manual add (khaali ROV/DueMon) | PASS |
| JS errors | **none** |

## Ek baat saaf
Test me app ki **apni 78-client default list** load hui, isliye ADARSH/BUSARA/GULNAZ jaise GSTIN "pehle se hain"
kar ke skip hue — **yahi expected behaviour hai** (duplicate add nahi hote). Naye GSTIN par hi add hota hai (verify kiya).

## Naya zip
**`GST_etsy_anyfile_fix_v5_8_11.zip`** · 251,142 B · MD5 `653debde27fac5479e3b9fe11082f28c`
Bridge 1.28.0 aur Apps Script same (naya paste karne ki zaroorat nahi).
