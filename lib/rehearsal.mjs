import { createLobby } from './lobby.mjs';

export function createRehearsal(joinUrl) {
  const start = Date.UTC(2026, 0, 1, 17);
  let clock = start;
  const lobby = createLobby({ now: () => clock });
  const moments = [];
  let lastProjection;
  let offline = false;

  function record(caption) {
    if (!offline) lastProjection = lobby.dashboard();
    moments.push({ caption, offline, data: { ...lastProjection, joinUrl, demo: true } });
    clock += 30_000;
  }

  function contribute(participantId, mood, themes, caption) {
    const submittedAt = clock;
    const { status, body } = lobby.submit({
      participantId, submissionId: String(moments.length), ipKey: participantId, text: 'Text de repetiție.',
    });
    if (status !== 202) throw new Error('O trimitere de repetiție a fost respinsă.');
    lobby.takeBatch();
    lobby.finish([{ id: body.seq, eligible: true, mood, themes }]);
    clock += 5000;
    record(caption);
    return submittedAt;
  }

  function withdraw(participantId, caption) {
    lobby.withdraw(participantId);
    record(caption);
  }

  record('Se deschide seara. Ecranul așteaptă primele trei contribuții.');
  contribute('ana', 'relaxat', ['liniște'], 'Ana trimite prima stare. Portretul rămâne în așteptare.');
  contribute('vlad', 'energic', ['muzică'], 'Vlad se alătură. Sunt două contribuții active.');
  contribute('mara', 'obosit', ['pauză'], 'Mara trimite a treia stare. Apare primul portret.');
  contribute('radu', 'relaxat', ['socializare'], 'Radu aduce o a doua stare relaxată.');
  contribute('ioana', 'energic', ['muzică'], 'Ioana completează grupul. Cinci participanți, două stări la egalitate.');
  contribute('ana', 'energic', ['muzică'], 'Ana își actualizează starea. Numărul participanților rămâne cinci.');
  contribute('vlad', 'obosit', ['pauză'], 'Vlad simte că are nevoie de o pauză.');
  contribute('ioana', 'obosit', ['liniște'], 'Și Ioana obosește. Oboseala devine starea dominantă.');
  contribute('ana', 'tensionat', ['muncă'], 'Ana trimite din nou. Portretul rămâne dominat de oboseală.');
  contribute('vlad', 'tensionat', ['trafic'], 'Vlad și-a schimbat starea. Două categorii sunt din nou la egalitate.');
  contribute('mara', 'tensionat', ['muncă'], 'Mara își schimbă starea. Tensiunea devine dominantă.');
  offline = true;
  record('Conexiunea se întrerupe. TV-ul păstrează ultimul portret și ora publicării.');
  const raduAt = contribute('radu', 'neutru', ['oraș'], 'Radu trimite o stare nouă cât timp TV-ul este deconectat.');
  offline = false;
  record('Conexiunea revine. TV-ul preia cele mai recente agregate.');
  contribute('ana', 'neutru', ['socializare'], 'Ana își schimbă starea. Tensiunea și starea neutră sunt la egalitate.');
  contribute('vlad', 'neutru', ['oraș'], 'Vlad își schimbă starea. Starea neutră devine dominantă.');
  withdraw('mara', 'Mara își retrage contribuția. Grupul rămâne la patru.');
  withdraw('ioana', 'Ioana se retrage. Portretul rămâne vizibil la exact trei contribuții.');
  clock = raduAt + 30 * 60_000;
  record('Starea lui Radu expiră după 30 de minute. La două contribuții, portretul se ascunde.');
  clock += 2 * 60_000;
  record('Expiră și ultimele contribuții. Ecranul așteaptă alte stări.');

  return moments;
}
