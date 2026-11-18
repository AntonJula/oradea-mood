import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { MOODS, THEMES } from './lobby.mjs';

const MOOD_LABELS = { relaxat: 'Relaxat', energic: 'Energic', obosit: 'Obosit', tensionat: 'Tensionat', neutru: 'Neutru' };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cartiere (
  id TEXT PRIMARY KEY,
  nume TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS locuri (
  id TEXT PRIMARY KEY,
  nume TEXT NOT NULL,
  tip TEXT NOT NULL,
  cartier_id TEXT NOT NULL REFERENCES cartiere(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  descriere TEXT NOT NULL DEFAULT '',
  sursa TEXT NOT NULL DEFAULT 'catalog inițial',
  verificat_la TEXT
);
CREATE TABLE IF NOT EXISTS locuri_stari (
  loc_id TEXT NOT NULL REFERENCES locuri(id) ON DELETE CASCADE,
  stare TEXT NOT NULL CHECK (stare IN ('relaxat','energic','obosit','tensionat','neutru')),
  potrivire REAL NOT NULL CHECK (potrivire BETWEEN 0 AND 1),
  PRIMARY KEY (loc_id, stare)
);
CREATE TABLE IF NOT EXISTS locuri_teme (
  loc_id TEXT NOT NULL REFERENCES locuri(id) ON DELETE CASCADE,
  tema TEXT NOT NULL,
  PRIMARY KEY (loc_id, tema)
);
CREATE TABLE IF NOT EXISTS instantanee (
  lobby_id TEXT NOT NULL,
  la TEXT NOT NULL,
  contributii INTEGER NOT NULL,
  dominanta TEXT,
  distributie TEXT,
  PRIMARY KEY (lobby_id, la)
);
`;

const MOOD_ADJ = { relaxat: 'relaxată', energic: 'energică', obosit: 'obosită', tensionat: 'tensionată', neutru: 'neutră' };

export function validateSeed(seed) {
  const errors = [];
  const ids = new Set();
  for (const c of seed.cartiere ?? []) {
    if (!/^[a-z]{3,32}$/.test(c.id)) errors.push(`cartier ${c.id}: id invalid (doar litere mici)`);
    if (ids.has(c.id)) errors.push(`cartier ${c.id}: duplicat`);
    ids.add(c.id);
  }
  const placeIds = new Set();
  for (const l of seed.locuri ?? []) {
    if (!ids.has(l.cartier)) errors.push(`${l.id}: cartier necunoscut ${l.cartier}`);
    if (placeIds.has(l.id)) errors.push(`${l.id}: duplicat`);
    placeIds.add(l.id);
    for (const m of MOODS) {
      const v = l.stari?.[m];
      if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`${l.id}: potrivire invalidă pentru ${m}`);
    }
    for (const t of l.teme ?? []) if (!THEMES.includes(t)) errors.push(`${l.id}: temă necunoscută ${t}`);
  }
  return errors;
}

export function openPlaces({ file = ':memory:', seedFile, seed } = {}) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const data = seed ?? (seedFile ? JSON.parse(readFileSync(seedFile, 'utf8')) : null);
  if (data) {
    const errors = validateSeed(data);
    if (errors.length) throw new Error(`Catalog invalid:\n${errors.join('\n')}`);
    const insC = db.prepare('INSERT INTO cartiere (id, nume, lat, lng) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nume=excluded.nume, lat=excluded.lat, lng=excluded.lng');
    const insL = db.prepare(`INSERT INTO locuri (id, nume, tip, cartier_id, lat, lng, descriere, sursa, verificat_la) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nume=excluded.nume, tip=excluded.tip, cartier_id=excluded.cartier_id, lat=excluded.lat, lng=excluded.lng, descriere=excluded.descriere, sursa=excluded.sursa, verificat_la=excluded.verificat_la`);
    const delS = db.prepare('DELETE FROM locuri_stari WHERE loc_id = ?');
    const delT = db.prepare('DELETE FROM locuri_teme WHERE loc_id = ?');
    const insS = db.prepare('INSERT INTO locuri_stari (loc_id, stare, potrivire) VALUES (?, ?, ?)');
    const insT = db.prepare('INSERT INTO locuri_teme (loc_id, tema) VALUES (?, ?)');
    db.exec('BEGIN');
    try {
      for (const c of data.cartiere) insC.run(c.id, c.nume, c.lat, c.lng);
      for (const l of data.locuri) {
        insL.run(l.id, l.nume, l.tip, l.cartier, l.lat, l.lng, l.descriere ?? '', l.sursa ?? 'catalog inițial', l.verificatLa ?? null);
        delS.run(l.id);
        delT.run(l.id);
        for (const m of MOODS) insS.run(l.id, m, l.stari[m]);
        for (const t of l.teme ?? []) insT.run(l.id, t);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const qCartiere = db.prepare('SELECT id, nume, lat, lng FROM cartiere ORDER BY nume');
  const qLocuri = db.prepare('SELECT id, nume, tip, cartier_id AS cartier, lat, lng, descriere, sursa, verificat_la AS verificatLa FROM locuri ORDER BY nume');
  const qStari = db.prepare('SELECT loc_id AS id, stare, potrivire FROM locuri_stari');
  const qTeme = db.prepare('SELECT loc_id AS id, tema FROM locuri_teme');
  const insSnap = db.prepare('INSERT OR REPLACE INTO instantanee (lobby_id, la, contributii, dominanta, distributie) VALUES (?, ?, ?, ?, ?)');
  const qSnap = db.prepare('SELECT la, contributii, dominanta, distributie FROM instantanee WHERE lobby_id = ? AND la >= ? ORDER BY la');

  function cartiere() {
    return qCartiere.all().map((r) => ({ ...r }));
  }

  function locuri() {
    const byId = new Map(qLocuri.all().map((r) => [r.id, { ...r, stari: {}, teme: [] }]));
    for (const s of qStari.all()) byId.get(s.id).stari[s.stare] = s.potrivire;
    for (const t of qTeme.all()) byId.get(t.id).teme.push(t.tema);
    return [...byId.values()];
  }

  function recommend({ distribution, themes = [], cartier = null, limit = 3 }) {
    if (!distribution) return [];
    const top = MOODS.reduce((best, m) => (distribution[m] > distribution[best] ? m : best), MOODS[0]);
    return locuri()
      .map((l) => {
        const moodFit = MOODS.reduce((sum, m) => sum + ((distribution[m] ?? 0) / 100) * (l.stari[m] ?? 0), 0);
        const shared = l.teme.filter((t) => themes.includes(t));
        const score = moodFit + 0.12 * shared.length + (cartier && l.cartier === cartier ? 0.1 : 0);
        const tops = MOODS.filter((m) => distribution[m] === distribution[top]);
        const reasonParts = [tops.length > 1 ? `potrivit pentru o stare mixtă (${tops.map((m) => MOOD_LABELS[m].toLowerCase()).join(', ')})` : `potrivit pentru o stare ${MOOD_ADJ[top]}`];
        if (shared.length) reasonParts.push(shared.join(', '));
        if (cartier && l.cartier === cartier) reasonParts.push('în cartier');
        return { id: l.id, nume: l.nume, tip: l.tip, cartier: l.cartier, score: Math.round(score * 1000) / 1000, motiv: reasonParts.join(' · '), verificat: Boolean(l.verificatLa) };
      })
      .sort((a, b) => b.score - a.score || a.nume.localeCompare(b.nume, 'ro'))
      .slice(0, limit);
  }

  function byMood(stare, limit = 20) {
    if (!MOODS.includes(stare)) return [];
    return locuri()
      .sort((a, b) => b.stari[stare] - a.stari[stare] || a.nume.localeCompare(b.nume, 'ro'))
      .slice(0, limit)
      .map((l) => ({ ...l, potrivire: l.stari[stare], stareEticheta: MOOD_LABELS[stare] }));
  }

  function snapshot(lobbyId, at, dash) {
    const p = dash.portrait;
    insSnap.run(lobbyId, at, dash.activeCount, p ? (p.mixed ? 'mixt' : p.dominant) : null, p ? JSON.stringify(Object.fromEntries(p.moods.map((m) => [m.key, m.percent]))) : null);
  }

  function history(lobbyId, sinceIso) {
    return qSnap.all(lobbyId, sinceIso).map((r) => ({ ...r, distributie: r.distributie ? JSON.parse(r.distributie) : null }));
  }

  return { cartiere, locuri, recommend, byMood, snapshot, history, close: () => db.close() };
}
