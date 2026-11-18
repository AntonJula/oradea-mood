# Oradea Mood · Plan pentru hackathon

**Ținta la minutul 60:** trei oameni scanează QR-ul afișat pe televizor, trimit stări în lobby-ul public Oradea și văd distribuția. Un participant trimite o stare nouă din același browser. Distribuția se schimbă, iar numărul contribuțiilor active rămâne trei.

Acesta este planul de lucru pentru jurizare. Faceți prima probă pe dispozitive la minutul 30. Minutele 60–75 sunt disponibile numai dacă organizatorii acordă timpul suplimentar. Echipa poate prezenta versiunea de la 60 independent de această extensie.

| Etapă | Document de predare | Ce preia următorul specialist |
|---|---|---|
| Business | [Cerințe](requirements.md) | Comportamentele asumate pentru demo și ce poate fi amânat. |
| Proiectare | [Design](design.md) | Cele două pagini, contractele minime și regulile vizuale. |
| Planificare | [Plan pe minute](implementation-plan.md) | Cine lucrează, ce se verifică, ce se întâmplă dacă un reper întârzie. |
| Implementare | [Mandatul inginerului](engineering-handoff.md) | Ordinea de construcție și fișa de predare a versiunii rulabile. |
| Testare | [Plan QA](test-plan.md) | Probe pe versiunea reală și repetiția pentru juriu. |

### Ce se punctează în acest plan

Flux mobil → server → clasificare → televizor, corectitudinea numărării, afișarea agregată în română și dovada pe dispozitive reale. Rezumatul și sugestiile se pot produce local din agregate. Principalul risc în primele minute este accesul prin tunel sau la model. Inginerul și persoana care pregătește sala lucrează în paralel.

Grupurile private, invitațiile, rolurile, administrarea, istoricul și persistența trec în lista pentru după hackathon. Specificația extinsă din dosarul părinte rămâne referință de produs. Pentru sprint, agenții folosesc documentele din acest dosar.
