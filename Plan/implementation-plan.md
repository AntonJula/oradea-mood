# Oradea Mood · Planul sprintului de 60–75 de minute

**Decizia PM:** implementăm un singur lobby public. Prima demonstrație tehnică este la minutul 30. La 45 înghețăm funcțiile, la 60 predăm versiunea jurizabilă. Minutele suplimentare au valoare numai după această predare.

| Unitate | Timp | Ce construiește inginerul | Ce verifică echipa |
|---|---|---|---|
| U1 | 00–05 | Pornește Node și health. Citește .env local, OPENROUTER_API_KEY introdusă de organizator, AI_MODEL=anthropic/claude-haiku-5.5 și limita demo 30/min/IP. Rulează o clasificare prin OpenRouter. | În paralel, un coleg conectează televizorul, pornește tunelul, deschide health pe telefon și notează separat rezultatul apelului AI. |
| U2 | 05–20 | Leagă formularul public, salvarea 202, workerul, pragul, calculul procentelor și pagina TV cu polling și QR. Livrează întâi traseul integral cu prezentare vizuală minimă. | QA pregătește trei browsere distincte și citește primele rezultate. Colegul din sală verifică linkul HTTPS din QR. |
| U3 | 20–30 | Integrează și remediază întreruperile din traseu. | Trei persoane scanează QR-ul de pe televizor, trimit câte o stare, primesc confirmarea și urmăresc numărul și distribuția. Se notează ora și latența. |
| U4 | 30–45 | Finalizează ordinea și deduplicarea, retragerea, expirarea, temele, rezumatul automat, sugestiile și tratarea întârzierilor. Aplică paleta și verifică lizibilitatea. | Cu exact trei browsere, actualizează o stare după 15 s. Totalul rămâne trei. Retrage una și verifică dispariția portretului la două. |
| U5 | 45–60 | Îngheață funcțiile. Corectează numai defectele care împiedică fluxul, afectează numărătoarea sau expun date. | QA rulează probele critice, verifică linkul, pragul și procentele; echipa repetă demo-ul de două minute și identifică versiunea predată. |
| U6 | 60–75, dacă există timp | Păstrează versiunea de la 60. Prioritate pentru defecte, verificări restante și încă o repetiție. Dacă toate probele critice trec, se poate încerca rezumatul AI pe agregate, păstrând rezerva locală. | Repetă fluxul după orice schimbare. Folosește versiunea de la 60 dacă extensia nu trece verificarea. |

### Decizii când timpul se scurtează

- **La 5:** dacă tunelul sau OpenRouter întârzie, un coleg rezolvă accesul, iar inginerul continuă local. O clasificare controlată verifică integrarea internă. Proba reală rămâne deschisă.
- **La 30:** dacă traseul fizic nu trece, U4 începe cu remedierea primului pas defect. Amână finisajele și păstrează rezumatul local. Nicio funcție privată nu intră în sprint.
- **La 45:** dacă un criteriu rămâne incomplet, consemnează-l. Concentrează-te pe scanare, confirmare, clasare reală, prag, procente și actualizarea unei contribuții. Nu folosi date fabricate într-o prezentare live.
- **La 60:** prezintă versiunea verificată și ce a rămas deschis. Dacă accesul live este blocat, etichetează explicit proba locală, captura cu oră ori datele simulate folosite. Timpul de 75 de minute este o extensie, nu o condiție de livrare.

Predarea către inginer se face prin [mandat](engineering-handoff.md), cu [designul](design.md) și [cerințele](requirements.md). QA urmărește [probele de acceptare](test-plan.md) din primul minut.
