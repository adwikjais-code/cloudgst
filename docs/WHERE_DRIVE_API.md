# "Services → Drive API" kahan se add karein? (aur zaroori bhi nahi ab)

## Chhota jawab
**Ab aapko karna hi nahi hai.** v5_8_6 se OCR ke liye Drive API on karna **optional** hai —
Apps Script khud OAuth token se Drive ka OCR use kar leta hai. Bas naya code paste + Deploy.

## Agar phir bhi on karna ho (30 second)
1. Sheet → **Extensions → Apps Script**
2. Left side me **Editor** ke neeche **`+` Services** (ya "Services" panel) dikhega — us par click
3. List me **Drive API** dhundein → click
4. **Version: v2** chunein · **Identifier: `Drive`** (yahi rehne dein) → **Add**
5. **Save** → phir **Deploy → Manage deployments → ✏️ → New version → Deploy**

> `+`/Services left sidebar me neeche hota hai (Files ke bilkul neeche). Kabhi kabhi window chhoti hone par
> sidebar collapse hota hai — top-left ☰ dabane se wapas aa jata hai.

## Dono raste kaam karte hain
| Rasta | Setup | Kab use hota hai |
|---|---|---|
| Drive API service on | 30 sec, ek baar | pehle try hota hai (agar on hai) |
| OAuth REST (default) | kuch nahi | service off ho to khud ye chalta hai |

Agar dono fail ho (bahut kam), to file **naam me GSTIN** rakh dein — `09FNZPM7904J1ZY_ADARSH.pdf` — tab OCR ki zaroorat hi nahi.

## Naya zip (isi ke saath)
**`GST_etsy_anyfile_fix_v5_8_6.zip`** · 248,290 B · MD5 `87620cc742bf7ac1ee8a2b85eb300f21`
Andar ka AppSync.gs code bhi refresh (2,539 line) — ⚙️ Setup → 📋 Copy Code se bilkul same code milega.
