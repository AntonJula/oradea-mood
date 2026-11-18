# Oradea Mood · Mandatul inginerului

Preia [planul pe minute](implementation-plan.md), [cerințele](requirements.md) și [designul](design.md). Începe implementarea când echipa pornește sprintul. Starea acestei predări este **planificat**.

| Reper | Ce predai concret către QA |
|---|---|
| Minutul 5 · U1 / D1 | Portul local, adresa publică a formularului, adresa paginii TV, rezultatul health și rezultatul apelului cu mesaj fictiv. Organizatorul completează OPENROUTER_API_KEY în .env. În fișa de predare apare doar numele variabilei. |
| Minutul 30 · U2–U3 / D1–D4 | Versiunea cu QR, formular, clasificare și distribuție. Cere colegilor proba pe televizor și trei telefoane. Comunică primul pas care a eșuat, dacă există. |
| Minutul 45 · U4 / D2–D4 | Versiunea cu înlocuire, retragere, expirare, teme și interpretare locală. Predă comenzile sau pașii care reproduc regulile de numărare. |
| Minutul 60 · U5 | Versiunea exactă pentru juriu, comanda de pornire, cum se deschid cele două pagini, lista probelor și defectele rămase. |
| Opțional la 75 · U6 | Versiunea îmbunătățită doar dacă QA a repetat fluxul. Menține disponibilă versiunea demonstrată la 60. |

Pentru demo setează limita de 30 mesaje/minut/IP public și 15 s/browser. Protejează accesul la cheia serverului, publică doar agregate și ține datele de test separate de live. Grupurile private, administrarea și invitațiile sunt în afara acestui sprint.

**Fișa de completat în timpul sprintului:** versiune și oră, comandă de pornire, mod live/test, dispozitive folosite, rezultat observat la fiecare reper, defecte și pași de reproducere. QA continuă cu [test-plan.md](test-plan.md).
