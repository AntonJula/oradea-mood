# Oradea Mood · Fișă de predare QA

Verificare în 18 noiembrie 2026, în jurul orei 18:58 (Europe/Bucharest). Versiunea de lucru locală 1.0.0 pornește de la commitul de planificare `842b722`. Au fost citite toate documentele din directorul [Plan](../Plan), inclusiv U6 și T8. Repo-ul verificat are o singură ramură publicată, `main`, și niciun tag. Specificația extinsă indicată ca fiind în dosarul părinte lipsește din repo.

Comanda de probă este `npm.cmd run demo`. Formularul local este `http://localhost:3000/l/oradea`, TV-ul este `http://localhost:3000/l/oradea/live`, iar `/api/health` a răspuns cu modul `demo`. Probele au folosit Node 24.14, Edge headless cu trei profiluri mobile independente și un ecran simulat la 1280 × 720. Clasificarea a folosit texte fictive și date separate de orice eveniment live.

| Probă | Verdict | Observație |
|---|---|---|
| T1 · Acces live | Blocată | Health local a trecut. Destinația HTTPS a QR-ului a fost decodată cu o adresă de test. Pentru verificarea publică sunt necesare tunelul HTTPS și `OPENROUTER_API_KEY` introdusă local. Testul cu răspuns OpenRouter simulat a trecut. |
| T2 · Prima probă fizică | Trecută local, proba fizică rămâne deschisă | Trei profiluri au primit confirmarea. La trei contribuții s-au afișat cele cinci procente. Într-un proces Node separat, workerul temporizat normal a publicat la 15,1 s de la începerea seriei de trei trimiteri. Decodarea software a QR-ului a trecut. Scanarea cu telefoane de la distanța publicului rămâne de probat. |
| T3 · Înlocuire și retry | Trecută local | Același browser a schimbat starea dominantă în „Obosit”, cu trei contribuții active. Retry-ul a returnat același `seq`. Rezultatul vechi nu a suprascris starea recentă. |
| T4 · Matematică și prag | Trecută local | Cazurile 1/1/1 și 3/1/1 au produs 34/33/33 și 60/20/20. Retragerea și expirarea au coborât numărul sub prag. Rezumatul, temele, barele și sugestiile au dispărut. |
| T5 · Date și erori | Trecută cu erori simulate | O întrerupere la trimitere a păstrat ciorna. Eroarea furnizorului a produs starea de întârziere. La întreruperea pollingului, TV-ul a păstrat ora datelor și și-a revenit după reconectare. Dashboardul nu conține text brut, identificatori sau IP. `/.env` răspunde 404. |
| T6 · Limite | Trecută local | Au trecut verificările 3–280 caractere, 4 KB, 30 trimiteri/min/IP, 15 s/browser, 60 de mesaje brute și maximum 20 de mesaje pe lot. |
| T7 · Repetiție și predare | Predare locală, proba în sală rămâne deschisă | Ecranul TV încape în 720p. Formularul a fost verificat și la 320 px cu înălțime redusă. Mai rămân tastatura unui telefon real, lizibilitatea de la distanță și repetiția live. |
| T8 · Extensie | Neexecutată | Planul condiționează extensia de repetiția live și de timpul suplimentar. Versiunea păstrează rezumatul automat din date agregate. |

Scriptul `npm.cmd test` a trecut toate cele șase teste. Pașii de pornire, configurare și repetare a probei Edge sunt în [README](../README.md).

## Reverificare după noul design

Toate cele șapte teste automate au trecut. În Edge au fost verificate formularul la 320–430 px, tableta la 820 × 1180, desktopul la 1440 × 900 și conținutul TV la 1280 × 720. Fluxul cu trei profiluri independente a trecut din nou.

Repetiția a parcurs 21 de momente cu toate cele șapte expresii. S-au verificat pragul de trei contribuții, distribuția 34/33/33, revenirea după întrerupere, expirarea, navigarea cu tastatura și comenzile rămase la vedere pe telefon. Testele au confirmat că portretul rămâne lizibil cu mișcare redusă și că repetiția este disponibilă exclusiv în modul demo.
