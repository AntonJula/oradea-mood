import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openPlaces, validateSeed } from '../lib/places.mjs';

const SEED = fileURLToPath(new URL('../data/locuri.json', import.meta.url));
const seed = JSON.parse(readFileSync(SEED, 'utf8'));

test('the bundled catalog is valid', () => {
  assert.deepEqual(validateSeed(seed), []);
  const db = openPlaces({ seed });
  assert.equal(db.cartiere().length, seed.cartiere.length);
  assert.equal(db.locuri().length, seed.locuri.length);
  db.close();
});

test('invalid catalog entries are rejected', () => {
  const bad = { cartiere: [{ id: 'Centru!', nume: 'x', lat: 0, lng: 0 }], locuri: [{ id: 'a', cartier: 'nicaieri', stari: { relaxat: 2 }, teme: ['plaja'] }] };
  const errors = validateSeed(bad);
  assert.ok(errors.length >= 4);
  assert.throws(() => openPlaces({ seed: bad }));
});

test('a tense group gets calming places, an energetic one gets lively places', () => {
  const db = openPlaces({ seed });
  const calm = db.recommend({ distribution: { relaxat: 0, energic: 0, obosit: 0, tensionat: 100, neutru: 0 }, themes: [] });
  assert.equal(calm.length, 3);
  for (const r of calm) assert.ok(seed.locuri.find((l) => l.id === r.id).stari.tensionat >= 0.8);
  const lively = db.recommend({ distribution: { relaxat: 0, energic: 100, obosit: 0, tensionat: 0, neutru: 0 }, themes: ['socializare'] });
  assert.equal(lively[0].id, 'strada-republicii');
  assert.match(lively[0].motiv, /energică/);
  db.close();
});

test('recommendations prefer the same neighbourhood and need a distribution', () => {
  const db = openPlaces({ seed });
  const dist = { relaxat: 40, energic: 20, obosit: 20, tensionat: 0, neutru: 20 };
  const inSub = db.recommend({ distribution: dist, themes: ['învățare'], cartier: 'cetate' });
  assert.equal(inSub[0].cartier, 'cetate');
  assert.deepEqual(db.recommend({ distribution: null }), []);
  db.close();
});

test('places by mood are sorted by fit', () => {
  const db = openPlaces({ seed });
  const list = db.byMood('relaxat', 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].potrivire >= list[i].potrivire);
  assert.deepEqual(db.byMood('fericit'), []);
  db.close();
});

test('snapshots store only aggregates', () => {
  const db = openPlaces({ seed });
  db.snapshot('centru', '2026-11-18T17:00:00.000Z', { activeCount: 4, portrait: { mixed: false, dominant: 'relaxat', moods: [{ key: 'relaxat', percent: 100 }] } });
  const h = db.history('centru', '2026-11-18T00:00:00.000Z');
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].distributie, { relaxat: 100 });
  assert.equal(h[0].dominanta, 'relaxat');
  db.close();
});

