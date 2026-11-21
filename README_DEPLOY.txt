GST Cloud Bridge v1.9.0 - deploy notes (zaroor padhein)

1) Render > Environment me ye daalein:
   API_SECRET      = koi lamba random password (yahi app ki "Cloud Server Settings > API Secret" me bhi daalna hai)
   ALLOWED_ORIGIN  = https://adwikjais-code.github.io      (agar aap alag site se chalate hain to wo)
   Bina API_SECRET ke server ab jaan-boojh kar 503 dega (pehle bina password khula rehta tha).

2) Naya server.js + package.json Render/GitHub par daal kar redeploy karein (Dockerfile same hai).

3) App me: Cloud Server Settings > URL + API Secret > "Save & Test".
   Galat secret ho to ab Test fail dikhayega (pehle hamesha "connected" dikhata tha).

4) Pehli baar Fetch chalane ke baad 🐞 button dabakar debug dekhein, aur screen ke numbers portal se ek baar match karein.

Note: ek hi time par ek hi portal login chalta hai (naya login purana session band kar deta hai).
