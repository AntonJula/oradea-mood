# Oradea Mood

Oradea Mood strânge stările participanților dintr-un singur lobby public. Telefonul trimite o stare, serverul o clasifică, iar ecranul de sală afișează distribuția când există cel puțin trei contribuții active. Contribuțiile expiră la 30 de minute de la trimitere.

## Demonstrație locală

Cu Node.js 24.2 sau mai nou, din rădăcina repo-ului:

```powershell
npm.cmd ci
npm.cmd run demo
```

- Pagina principală, cu portret fictiv, trimitere de stare și lobby-uri: <http://localhost:3000/>
- Formularul pentru lobby-ul public proiectat pe TV: <http://localhost:3000/l/oradea>
- Ecran TV: <http://localhost:3000/l/oradea/live>
- Repetiție cu participanți fictivi: <http://localhost:3000/l/oradea/repetitie>
- Verificarea serverului: <http://localhost:3000/api/health>

Pe pagina principală poți încerca analiza unui text direct pe portretul demonstrativ din Oradea. Aplicația arată starea extrasă după publicare. Contribuțiile adăugate aici intră doar în portretul demonstrativ.

Lobby-ul **Lightning Hackathon #2** folosește codul **LIGHTNING2**. Din secțiunea Lobby-uri poți intra cu un cod sau crea un lobby nou. Pagina grupului afișează codul pe care îl poți da altor participanți. Lobby-urile nou create și contribuțiile se păstrează în memoria serverului până la oprirea lui. Lobby-ul Lightning Hackathon #2 este disponibil la fiecare pornire.

Deschide formularul în trei profiluri de browser diferite. Trimite „Sunt relaxat și mă bucur de liniște.”, „Sunt energic și ascult muzică.” și „Sunt obosit și vreau o pauză.”. Ecranul poate avea nevoie de până la 18 secunde ca să publice toate contribuțiile în demo. După 15 secunde de la prima trimitere, trimite „Sunt obosit și vreau o pauză.” din primul profil. Totalul rămâne trei, iar starea dominantă devine „Obosit”. Retragerea din același profil coboară totalul la două și ascunde portretul.

Comanda demo pornește clasificatorul local pe cuvinte-cheie, ocolește fișierul `.env` și afișează „Demo local” pe ambele ecrane. Datele există în memoria acelui proces.

În **Repetiție**, butonul „Redă” parcurge 21 de momente cu cinci participanți fictivi. Poți pune pauză, merge pas cu pas sau alege un moment cu cursorul. Scenariul trece prin cele șapte expresii, întreruperea și revenirea conexiunii, retrageri și expirare. Ruta este disponibilă în modul demo și ține datele fictive separate de contribuțiile primite prin formular.

## Eveniment cu telefoane și televizor

1. Copiază `.env.example` în `.env`. Organizatorul introduce cheia `OPENROUTER_API_KEY` local. Setează `DEMO_MODE=false` și `LIMITA_IP_MESAJE_PE_MINUT=30`.
2. Pornește tunelul HTTPS către `http://127.0.0.1:3000`. Pune originea HTTPS în `PUBLIC_BASE_URL`, fără calea formularului. Pentru un tunel Cloudflare care rulează local cu această destinație, setează `TRUST_PROXY_ADDRESS=127.0.0.1` și `TRUST_PROXY_HEADER=cf-connecting-ip`. Adresa trebuie să fie a proxy-ului care transmite și suprascrie antetul cu IP-ul real al clientului.
3. Rulează `npm.cmd run check:ai` pentru o probă cu text fictiv. Pornește serverul cu `npm.cmd start` și verifică `/api/health` prin tunel.
4. Deschide pagina TV locală în modul ecran complet. Cu trei telefoane, scanează QR-ul de la distanța publicului, trimite câte o stare și repetă înlocuirea de mai sus. Verifică formularul cu tastatura telefonului deschisă și notează ora și latența conform planului QA.

Serverul afișează în consolă rutele configurate. Cheia este citită doar de procesul Node. Repo-ul exclude `.env`, iar aplicația servește resursele publice dintr-o listă explicită. Oprirea procesului golește lobby-ul.

## Verificare

Rulează `npm.cmd test`. Probele HTTP folosesc un port local temporar. Într-un mediu izolat, testele au nevoie de acces la loopback. [Fișa de predare](qa/RESULTS.md) detaliază starea T1–T8.

Pentru a repeta proba headless din Edge, configurează trei căi locale și rulează verificarea:

```powershell
$env:ORADEA_QA_TOOLS = Join-Path $env:TEMP 'oradea-mood-browser-qa'
npm.cmd install --prefix $env:ORADEA_QA_TOOLS playwright-core jsqr
$env:ORADEA_QA_EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:ORADEA_QA_OUTPUT = Join-Path $env:TEMP 'oradea-mood-capturi'
node qa/browser-check.mjs
```
