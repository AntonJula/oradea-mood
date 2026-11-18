export const MOODS = ['relaxat', 'energic', 'obosit', 'tensionat', 'trist', 'neutru'];
export const THEMES = ['socializare', 'muncă', 'învățare', 'mâncare', 'muzică', 'trafic', 'liniște', 'pauză', 'oraș', 'altele'];
export const NUANCES = {
  relaxat: ['calm', 'mulțumit', 'recunoscător'],
  energic: ['entuziasmat', 'bucuros', 'curios', 'motivat'],
  obosit: ['obosit', 'epuizat', 'plictisit'],
  tensionat: ['stresat', 'anxios', 'frustrat', 'iritat'],
  trist: ['trist', 'singur', 'nostalgic', 'dezamăgit'],
  neutru: ['neutru', 'pensiv'],
};
export const EMOTIONS = Object.values(NUANCES).flat();
export const INTENSITIES = [1, 2, 3];

const VALENCE = { relaxat: 0.7, energic: 0.8, obosit: -0.2, tensionat: -0.7, trist: -0.8, neutru: 0 };
const AROUSAL = { relaxat: -0.4, energic: 0.9, obosit: -0.9, tensionat: 0.6, trist: -0.5, neutru: 0 };
const WEIGHT = { 1: 0.6, 2: 0.85, 3: 1 };

function climate(entries) {
  const weigh = (entry, axis) => axis[entry.mood] * WEIGHT[entry.intensity ?? 2];
  const valence = Math.round(100 * entries.reduce((s, e) => s + weigh(e, VALENCE), 0) / entries.length);
  const energy = Math.round(100 * entries.reduce((s, e) => s + weigh(e, AROUSAL), 0) / entries.length);
  const tone = valence >= 20 ? 'pozitiv' : valence <= -20 ? 'apăsat' : 'echilibrat';
  const energyLabel = energy >= 20 ? 'ridicată' : energy <= -20 ? 'scăzută' : 'medie';
  return { valence, energy, tone, energyLabel };
}

function intensityOf(entries) {
  const rated = entries.filter((entry) => INTENSITIES.includes(entry.intensity));
  if (!rated.length) return null;
  const average = Math.round(10 * rated.reduce((s, e) => s + e.intensity, 0) / rated.length) / 10;
  return { average, label: average >= 2.4 ? 'puternică' : average <= 1.6 ? 'ușoară' : 'moderată' };
}

function nuancesOf(entries, dominant) {
  const named = entries.filter((entry) => EMOTIONS.includes(entry.emotion));
  if (!named.length) return [];
  const counts = new Map();
  for (const entry of named) counts.set(entry.emotion, (counts.get(entry.emotion) ?? 0) + 1);
  const own = (emotion) => (NUANCES[dominant]?.includes(emotion) ? 0 : 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || own(a[0]) - own(b[0]) || EMOTIONS.indexOf(a[0]) - EMOTIONS.indexOf(b[0]))
    .slice(0, 3)
    .map(([emotion, count]) => ({ emotion, mood: MOODS.find((m) => NUANCES[m].includes(emotion)), percent: Math.round(count * 100 / named.length) }));
}

const WINDOW = 30 * 60_000;
const MINUTE = 60_000;
const COOLDOWN = 15_000;

const suggestions = {
  relaxat: ['Păstrați ritmul cu o conversație fără grabă.', 'Luați un moment să vă bucurați de seară.'],
  energic: ['Puneți o piesă care să țină ritmul.', 'Invitați pe cineva la o conversație nouă.'],
  obosit: ['Faceți o pauză scurtă, cu un pahar cu apă.', 'Alegeți un loc mai liniștit pentru câteva minute.'],
  tensionat: ['Luați câteva respirații lente, în ritmul vostru.', 'Propuneți o pauză înainte să continuați seara.'],
  trist: ['Căutați o conversație liniștită cu cineva apropiat.', 'O plimbare scurtă în aer liber poate schimba puțin seara.'],
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
  const nuances = nuancesOf(entries, dominant);
  const intensity = intensityOf(entries);
  const mood = climate(entries);
  const clearTop = nuances.length && (nuances.length === 1 || nuances[0].percent > nuances[1].percent);
  const detail = (clearTop ? ' Nuanța cea mai des numită este „' + nuances[0].emotion + '”.' : nuances.length ? ' Nuanțele sunt variate.' : '')
    + (intensity ? ' Intensitatea este ' + intensity.label + ', cu un ton ' + mood.tone + ' și energie ' + mood.energyLabel + '.' : '');

  return {
    mood: dominant,
    distribution: rows.map(({ mood: key, percent }) => ({ mood: key, percent })),
    headline: mixed ? 'Stare mixtă' : dominant[0].toUpperCase() + dominant.slice(1),
    themes,
    nuances,
    intensity,
    climate: mood,
    summary: summary + (themes.length ? ' Tema cea mai prezentă este „' + themes[0] + '”.' : '') + detail,
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
        entry.receipt.status = entry.eligible ? 'added' : 'ineligible';
        if (entry.eligible) entry.receipt.mood = entry.mood;
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

    const body = { seq: ++seq, receivedAt: new Date(time).toISOString() };
    const receipt = { at: time, body, status: 'pending' };
    const entry = { seq: body.seq, at: time, participantId, text: cleaned, attempts: 0, readyAt: time, running: false, receipt };
    jobs.set(entry.seq, entry);
    browserRates.set(participantId, time);
    ipRates.set(ipKey, [...ipTimes, time]);
    receipts.set(key, receipt);
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
      if (previous && previous.seq >= entry.seq) {
        entry.receipt.status = 'replaced';
        continue;
      }
      const earlier = staged.get(entry.participantId);
      if (earlier) earlier.receipt.status = 'replaced';
      const classified = { ...result, seq: entry.seq, at: entry.at, receipt: entry.receipt };
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
      if (job.attempts >= 2 || now() + retryDelay >= job.at + WINDOW) {
        job.receipt.status = 'failed';
        jobs.delete(id);
      }
      else {
        job.receipt.status = 'retrying';
        job.running = false;
        job.readyAt = now() + retryDelay;
      }
    }
  }

  function withdraw(participantId) {
    maintain();
    for (const [id, job] of jobs) {
      if (job.participantId !== participantId) continue;
      job.receipt.status = 'withdrawn';
      jobs.delete(id);
    }
    latest.delete(participantId);
    const stagedEntry = staged.get(participantId);
    if (stagedEntry) stagedEntry.receipt.status = 'withdrawn';
    staged.delete(participantId);
    const publishedEntry = published.get(participantId);
    if (publishedEntry) {
      publishedEntry.receipt.status = 'withdrawn';
      published.delete(participantId);
      updatedAt = now();
    }
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

  function submissionStatus(participantId, submissionId) {
    maintain();
    const receipt = receipts.get(participantId + ':' + submissionId);
    const activeEntry = published.get(participantId);
    if (!receipt) return { status: 'expired', active: Boolean(activeEntry) };
    const status = receipt.status === 'added' && activeEntry?.seq !== receipt.body.seq
      ? 'replaced' : receipt.status;
    return { status, active: Boolean(activeEntry), mood: status === 'added' ? receipt.mood : null };
  }

  return { submit, takeBatch, finish, fail, withdraw, dashboard, ownMood, submissionStatus };
}
