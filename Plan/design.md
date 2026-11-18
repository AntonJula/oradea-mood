# Oradea Mood · Design pentru fluxul public

**Proiectare → planificare și implementare.** Contractele de mai jos acoperă [M1–M7](requirements.md).

### D1 · Pornire și acces (M1, M3, M7)

Un singur proces Node persistent pe laptop servește paginile, API-ul și workerul. Datele sunt în memorie. Laptopul afișează pe televizor pagina /l/oradea/live, prin HDMI. QR-ul este generat local din PUBLIC_BASE_URL și trimite la /l/oradea prin tunelul HTTPS. Ruta / poate deschide același formular. GET /api/health confirmă pornirea.

Organizatorul completează personal OPENROUTER_API_KEY în .env local, exclus din Git și din fișierele publice. Serverul citește AI_MODEL=anthropic/claude-haiku-5.5 și apelează POST https://openrouter.ai/api/v1/messages cu autentificare Bearer. DEMO_MODE=false pentru live. LIMITA_IP_MESAJE_PE_MINUT=30 la eveniment, implicit 5 în utilizarea obișnuită. Pentru limitare se folosește IP-ul transmis de proxy-ul de încredere, păstrat ca hash cu sare.

### D2 · Formular și ingestie (M1, M2, M4, M7)

Formularul afișează „Oradea · Public”, apoi „Cum merge seara ta, în câteva cuvinte?”, contorul, informarea și butonul „Trimite starea mea”. Informarea precizează că textul poate ajunge la furnizorul AI și cere evitarea datelor personale. Butonul rămâne dezactivat până la răspuns. Confirmarea vine înaintea analizei.

POST /api/lobbies/oradea/messages primește participantId aleatoriu local, submissionId și text. Verifică idempotența înainte de limitarea debitului. Pentru o trimitere nouă, validează lungimea și limitele, apoi alocă seq și ora UTC pe server. Returnează 202. Un retry reutilizează submissionId. Limitează corpul la 4 KB și păstrează cel mult 60 de mesaje în lobby. Nu înregistra text, chei sau IP în clar în loguri.

### D3 · Analiză și publicare (M3–M6)

Un singur worker ia până la 20 de mesaje la fiecare 10 s. Separă instrucțiunile de textele trimise ca date. Validează ID-ul, eligibilitatea, dispoziția și maximum două teme distincte din lista socializare, muncă, învățare, mâncare, muzică, trafic, liniște, pauză, oraș, altele. Timeout 10 s, o singură reîncercare, cu respectarea Retry-After. Un rezultat neeligibil retrage contribuția dacă este mai nou. Șterge textul la clasificare sau cel târziu după 30 min de la primire.

Păstrează pentru fiecare browser cea mai recentă secvență aplicată. O analiză în curs păstrează rezultatul anterior. DELETE /api/lobbies/oradea/contributions/me retrage contribuția browserului și invalidează rezultatele proprii deja în curs. Publică rezultatele noi la 5 s de la prima finalizare din lotul de publicare. Retragerile și expirările invalidează imediat datele vechi.

GET /api/lobbies/oradea/dashboard oferă numărul activ, ora publicării, starea analizei și agregatele permise de prag. La minimum trei contribuții calculează procente prin cel mai mare rest, cu ordinea relaxat, energic, obosit, tensionat, neutru. Egalitatea se stabilește din numerele brute. Sortează temele după frecvență, apoi după ordinea listei. Compune local rezumatul și două sugestii potrivite agregatelor actuale. Ascunde portretul sub prag. Interfața face polling la 3 s. La întrerupere afișează ora ultimului rezultat și reia polling-ul. O captură reală, datată, poate susține prezentarea dacă dispare conexiunea.

### D4 · Telefon și televizor (M1, M5, M6)

Telefonul folosește o coloană, fundal #F3EEE2, text #15191A și buton #1F5C4A. Televizorul folosește fundal #0F1412, text #F3EEE2 și accent #E8A93A. Fontul propus este Outfit 400/600, cu font local de rezervă. Barele pe fundal închis folosesc, în ordinea dispozițiilor, #5FB7A0, #E8A93A, #8FA6D6, #E06C56 și #BDB6A6. Fiecare bară are etichetă și procent.

Pe televizor: titlu „Oradea · Starea acum”, subtitlu „Starea participanților în ultimele 30 de minute.”, număr activ și oră Europe/Bucharest. În stânga se văd rezultatele, în dreapta QR-ul cu adresă lizibilă și sugestiile. Include „Grupurile mici nu sunt anonime.” Verifică de la distanța publicului și cu tastatura telefonului deschisă. Afișează datele dinamice ca text.
