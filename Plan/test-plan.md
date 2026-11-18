# Oradea Mood · Acceptarea MVP-ului

**Toate probele sunt neexecutate la redactare.** QA pregătește trei telefoane sau browsere independente, televizorul, un lobby public gol și o fișă pentru rezultate. Proba pe dispozitive și apelul OpenRouter se înregistrează separat de probele cu ceas și furnizor controlat.

| Probă | Când / cerință | Pași și rezultat așteptat |
|---|---|---|
| T1 · Acces live | U1, min. 5 · M1, M3, M7 | Deschide health pe telefon prin HTTPS. Confirmă separat că serverul clasifică un mesaj fictiv prin OpenRouter. Modelul este anthropic/claude-haiku-5.5; cheia există numai pe server. |
| T2 · Prima probă fizică | U3, min. 30 · M1–M5 | Scanează QR-ul de pe TV de la distanța publicului. Trei browsere distincte trimit texte. Fiecare primește confirmare. La 0–2 nu apar procente. După a treia analiză și publicare, pe TV apar numărul 3 și cinci bare. Notează latența. |
| T3 · Înlocuire și retry | U4, min. 45 · M2, M4 | Din primul browser, după 15 s, trimite o stare diferită. Verifică numărul 3 și schimbarea distribuției când clasificarea diferă. Repetarea aceleiași chei primește 202 fără al doilea job. Un rezultat cu seq vechi este ignorat. |
| T4 · Matematică și prag | U4–U5 · M4, M5 | Cu clasificări controlate, 1/1/1 dă 34/33/33 și „Stare mixtă”; 3/1/1 dă 60/20/20. Retrage una din exact trei: la două dispar distribuția, temele, sugestiile și rezumatul. Avansează ceasul la expirarea ferestrei de 30 min și verifică același efect. |
| T5 · Date și erori | U4–U5 · M2, M3, M6, M7 | La salvare eșuată ciorna rămâne. La timeout AI verifică întârzierea și ora ultimului rezultat. Textul individual și cheia lipsesc din dashboard, resurse publice și loguri. Rezumatul automat și cele două sugestii corespund agregatelor curente. |
| T6 · Limite | U2–U5 · M2, M7 | În test izolat validează 3 și 280 caractere, respinge 2 și 281. Pe un IP comun, 31 de browsere distincte trimit în același minut: primele 30 sunt acceptate, a 31-a primește 429. Verifică separat intervalul de 15 s/browser și recuperarea după expirarea ferestrei. |
| T7 · Repetiție și predare | U5, înainte de min. 60 · M1–M7 | Prezintă în două minute scanarea, contribuția, distribuția și actualizarea din același browser. Verifică lizibilitatea pe TV și formularul cu tastatura deschisă. Notează versiunea, dispozitivele, blocajele și probele omise. |
| T8 · Extensie | U6, numai dacă se acordă minutele 60–75 · M6 | După o corecție repetă T2 și cazul afectat. Dacă s-a adăugat rezumat AI, confirmă intrarea exclusiv agregată și revenirea la „Rezumat automat” la răspuns invalid sau întârziat. |

**Ordinea pentru jurizare:** T1 și T2 cât mai devreme, apoi înlocuirea, pragul, confidențialitatea și T7 înainte de 60. Dacă timpul expiră, o probă neexecutată rămâne marcată astfel. Pentru fiecare probă înregistrează versiunea, ora, mediul, observația și verdictul: trecut, eșuat, blocat sau neexecutat. [Planul de implementare](implementation-plan.md) stabilește decizia la fiecare reper.
