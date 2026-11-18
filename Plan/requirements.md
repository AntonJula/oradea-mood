# Oradea Mood · Cerințe pentru MVP

**Business → proiectare.** Utilizatorul scanează QR-ul de pe televizor, spune în română cum îi merge seara și vede efectul contribuției în portretul colectiv al lobby-ului public Oradea. La minutul 30 trebuie să putem proba traseul real. La 60 trebuie să îl putem prezenta.

| ID | Angajament până la minutul 60 | Criteriu de acceptare |
|---|---|---|
| M1 | Intrare directă de pe telefon | QR-ul duce prin HTTPS la formularul public. Se văd numele Oradea, întrebarea, contorul și informarea despre trimiterea textului la furnizorul AI. |
| M2 | Salvare fără cont | Serverul acceptă 3–280 de caractere după curățarea spațiilor. La confirmarea 202 câmpul se golește. La eroare textul rămâne. Aceeași trimitere repetată contează o dată. |
| M3 | Clasificare live | Claude Haiku 5.5 prin OpenRouter clasifică fiecare mesaj eligibil într-una din cele cinci stări și extrage până la două teme. O eroare AI este vizibilă ca întârziere. |
| M4 | Numărare corectă | Fiecare browser are cel mult o contribuție activă în ultimele 30 min. Ultima stare eligibilă analizată o înlocuiește pe cea veche. Retragerea, expirarea și rezultatele întârziate păstrează numărătoarea corectă. |
| M5 | Televizor lizibil | La 0–2 contribuții se vede numărul și invitația de participare. De la 3 apar cinci bare și procente însumând 100. Egalitatea la maxim afișează „Stare mixtă”. QR-ul rămâne vizibil. |
| M6 | Interpretare colectivă | Până la patru teme, un rezumat scurt în română și două sugestii. Pentru sprint ajunge un rezumat calculat local, etichetat „Rezumat automat”, și sugestii determinate din agregate. |
| M7 | Acces de la eveniment și confidențialitate | La demo, 30 de mesaje noi/minut/IP public și o trimitere la 15 s/browser. Televizorul afișează doar agregate. Cheia rămâne pe server, iar textul brut se șterge după clasificare sau la expirare. |

**După minutul 60, opțional:** rezumat redactat prin OpenRouter din aceleași agregate, numai după o repetiție live reușită. **După hackathon:** grupuri private, invitații, tokenuri de ecran, organizatori, administrare, ștergerea completă a datelor locale și stocare persistentă. În MVP există retragerea propriei contribuții.

Arhitectul leagă M1–M7 de componente în [design.md](design.md). QA consemnează separat probele fizice, probele controlate și dependențele indisponibile.
