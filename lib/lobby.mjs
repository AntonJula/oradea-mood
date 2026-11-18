export const MOODS = ['relaxat', 'energic', 'obosit', 'tensionat', 'neutru'];
export const THEMES = ['socializare', 'muncă', 'învățare', 'mâncare', 'muzică', 'trafic', 'liniște', 'pauză', 'oraș', 'altele'];

const WINDOW = 30 * 60_000;
const MINUTE = 60_000;
const COOLDOWN = 15_000;

const suggestions = {
  relaxat: ['Păstrați ritmul cu o conversație fără grabă.', 'Luați un moment să vă bucurați de seară.'],
  energic: ['Puneți o piesă care să țină ritmul.', 'Invitați pe cineva la o conversație nouă.'],
  obosit: ['Faceți o pauză scurtă, cu un pahar cu apă.', 'Alegeți un loc mai liniștit pentru câteva minute.'],
  tensionat: ['Luați câteva respirații lente, în ritmul vostru.', 'Propuneți o pauză înainte să continuați seara.'],
  neutru: ['Întrebați pe cineva ce i-a făcut seara mai bună.', 'Încercați o schimbare mică de ritm.'],
  mixed: ['Lăsați loc atât pentru conversație, cât și pentru liniște.', 'Alegeți împreună următorul lucru pe care vreți să-l faceți.'],
};

export function aggregate(entries) {
  if (entries.length < 3) return null;

  const rows = MOODS.map((mood) => {
    const count = entries.filter((entry) => entry.mood === mood).length;
    return { mood, count, percent: Math.floor(count * 100 / entries.length) };
  });
  const remaining = 100 - rows.reduce((sum, row) => sum + row.percent, 0);
  const remainder = (row) => (row.count * 100) % entries.length;
  for (const row of [...rows].sort((a, b) => remainder(b) - remainder(a)).slice(0, remaining)) {
    row.percent++;
  }

  const max = Math.max(...rows.map((row) => row.count));
  const leaders = rows.filter((row) => row.count === max);
  const themes = THEMES.map((theme) => ({
    theme,
    count: entries.filter((entry) => entry.themes.includes(theme)).length,
  })).filter((row) => row.count).sort((a, b) => b.count - a.count).slice(0, 4).map((row) => row.theme);
  const mixed = leaders.length > 1;
  const dominant = mixed ? 'mixed' : leaders[0].mood;
  const summary = mixed
    ? 'Stările dominante au primit același număr de contribuții.'
    : 'Cea mai des întâlnită stare este „' + dominant + '”.';

  return {
    mood: dominant,
    distribution: rows.map(({ mood, percent }) => ({ mood, percent })),
    headline: mixed ? 'Stare mixtă' : dominant[0].toUpperCase() + dominant.slice(1),
    themes,
    summary: summary + (themes.length ? ' Tema cea mai prezentă este „' + themes[0] + '”.' : ''),
    suggestions: suggestions[dominant],
  };
}

export function createLobby({ now = Date.now, ipLimit = 5, samples = [] } = {}) {
  const jobs = new Map();
  const receipts = new Map();
  const browserRates = new Map();
  const ipRates = new Map();
  const latest = new Map();
  const published = new Map();
  const staged = new Map();
  let seq = 0;
  let publishAt = null;
  let updatedAt = null;
  let delayed = false;

  function maintain() {
    const time = now();
    for (const [key, receipt] of receipts) if (receipt.at + WINDOW <= time) receipts.delete(key);
    for (const [key, at] of browserRates) if (at + COOLDOWN <= time) browserRates.delete(key);
    for (const [key, times] of ipRates) if (times.at(-1) + MINUTE <= time) ipRates.delete(key);
    for (const [key, entry] of jobs) if (entry.at + WINDOW <= time) jobs.delete(key);
    for (const [key, entry] of latest) if (entry.at + WINDOW <= time) latest.delete(key);
    for (const [key, entry] of staged) if (entry.at + WINDOW <= time) staged.delete(key);
    for (const [key, entry] of published) {
      if (entry.at + WINDOW > time) continue;
      published.delete(key);
      updatedAt = time;
    }
    if (publishAt !== null && time >= publishAt) {
      for (const [key, entry] of staged) {
        if (entry.eligible) published.set(key, entry);
        else published.delete(key);
        updatedAt = Math.max(updatedAt ?? publishAt, publishAt);
      }
      staged.clear();
      publishAt = null;
    }
  }

  function submit({ participantId, submissionId, text, ipKey }) {
    maintain();
    const key = participantId + ':' + submissionId;
    if (receipts.has(key)) return { status: 202, body: receipts.get(key).body };

    const cleaned = typeof text === 'string' ? text.trim().replace(/\s+/gu, ' ') : '';
    const size = [...cleaned].length;
    if (size < 3 || size > 280) return { status: 400, body: { error: 'Scrie între 3 și 280 de caractere.' } };

    const time = now();
    const ipTimes = (ipRates.get(ipKey) ?? []).filter((at) => at + MINUTE > time);
    const browserAt = browserRates.get(participantId);
    const ipWait = ipTimes.length >= ipLimit ? ipTimes[0] + MINUTE - time : 0;
    const browserWait = browserAt === undefined ? 0 : browserAt + COOLDOWN - time;
    const wait = Math.max(ipWait, browserWait);
    if (wait > 0) {
      return { status: 429, retryAfter: Math.ceil(wait / 1000), body: { error: 'Mai așteaptă câteva secunde înainte de a trimite din nou.' } };
    }

    if (jobs.size >= 60) {
      return { status: 503, retryAfter: 10, body: { error: 'Analiza este ocupată. Încearcă din nou în câteva secunde.' } };
    }

    const entry = { seq: ++seq, at: time, participantId, text: cleaned, attempts: 0, readyAt: time, running: false };
    jobs.set(entry.seq, entry);
    browserRates.set(participantId, time);
    ipRates.set(ipKey, [...ipTimes, time]);
    const body = { seq: entry.seq, receivedAt: new Date(time).toISOString() };
    receipts.set(key, { at: time, body });
    return { status: 202, body };
  }

  function takeBatch() {
    maintain();
    const batch = [...jobs.values()].filter((job) => !job.running && job.readyAt <= now()).slice(0, 20);
    for (const job of batch) {
      job.running = true;
      job.attempts++;
    }
    return batch.map(({ seq: id, text }) => ({ id, text }));
  }

  function finish(results) {
    maintain();
    delayed = [...jobs.values()].some((job) => !job.running && job.attempts > 0);
    for (const result of results) {
      const entry = jobs.get(result.id);
      if (!entry?.running) continue;
      jobs.delete(result.id);
      const previous = latest.get(entry.participantId);
      if (previous && previous.seq >= entry.seq) continue;
      const classified = { ...result, seq: entry.seq, at: entry.at };
      latest.set(entry.participantId, { seq: entry.seq, at: entry.at });
      staged.set(entry.participantId, classified);
      publishAt ??= now() + 5000;
    }
  }

  function fail(batch, retryDelay = 0) {
    maintain();
    for (const { id } of batch) {
      const job = jobs.get(id);
      if (!job?.running) continue;
      delayed = true;
      if (job.attempts >= 2 || now() + retryDelay >= job.at + WINDOW) jobs.delete(id);
      else {
        job.running = false;
        job.readyAt = now() + retryDelay;
      }
    }
  }

  function withdraw(participantId) {
    maintain();
    for (const [id, job] of jobs) if (job.participantId === participantId) jobs.delete(id);
    latest.delete(participantId);
    staged.delete(participantId);
    if (published.delete(participantId)) updatedAt = now();
  }

  function dashboard() {
    maintain();
    const contributions = [...published.values()];
    return {
      activeCount: contributions.length,
      publishedAt: updatedAt === null ? null : new Date(updatedAt).toISOString(),
      analysis: delayed ? 'delayed' : (jobs.size || staged.size ? 'pending' : 'ready'),
      portrait: aggregate([...samples, ...contributions]),
    };
  }

  function ownMood(participantId) {
    maintain();
    return published.get(participantId)?.mood ?? null;
  }

  return { submit, takeBatch, finish, fail, withdraw, dashboard, ownMood };
}
