import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, createLobby } from '../lib/lobby.mjs';
import { classifyDemo, openRouter, validateResults } from '../lib/classification.mjs';

const result = (id, mood, themes = []) => ({ id, eligible: true, mood, themes });
const moods = (entries) => aggregate(entries).distribution.map(({ percent }) => percent);

test('aggregates only from three, resolves ties from counts and assigns largest remainders', () => {
  const fixtures = [result(1, 'relaxat', ['muzică']), result(2, 'energic', ['socializare']), result(3, 'obosit', ['muzică'])];
  assert.equal(aggregate(fixtures.slice(0, 2)), null);
  assert.deepEqual(moods(fixtures), [34, 33, 33, 0, 0, 0]);
  assert.equal(aggregate(fixtures).headline, 'Stare mixtă');
  assert.deepEqual(aggregate(fixtures).themes, ['muzică', 'socializare']);
  assert.equal(aggregate(fixtures).suggestions.length, 2);
  assert.deepEqual(moods([...fixtures, result(4, 'relaxat'), result(5, 'relaxat')]), [60, 20, 20, 0, 0, 0]);
});

test('publishes after five seconds, replaces, rejects stale results, withdraws and expires', () => {
  let time = 1_000_000;
  const lobby = createLobby({ now: () => time });
  const submit = (participantId, submissionId) => lobby.submit({ participantId, submissionId, text: 'Text fictiv', ipKey: participantId });
  for (const id of ['a', 'b', 'c']) assert.equal(submit(id, 'one').status, 202);
  lobby.takeBatch();
  lobby.finish([result(1, 'relaxat'), result(2, 'energic'), result(3, 'obosit')]);
  time += 4999;
  assert.equal(lobby.dashboard().activeCount, 0);
  time++;
  assert.equal(lobby.dashboard().activeCount, 3);

  time += 10_000;
  assert.equal(submit('a', 'two').body.seq, 4);
  lobby.takeBatch();
  time += 15_000;
  assert.equal(submit('a', 'three').body.seq, 5);
  lobby.takeBatch();
  lobby.finish([result(5, 'obosit')]);
  lobby.finish([result(4, 'tensionat')]);
  assert.equal(lobby.dashboard().portrait.headline, 'Stare mixtă');
  time += 5000;
  assert.equal(lobby.dashboard().portrait.headline, 'Obosit');
  assert.equal(lobby.dashboard().activeCount, 3);

  time += 10_000;
  assert.equal(submit('b', 'two').body.seq, 6);
  lobby.takeBatch();
  lobby.withdraw('b');
  lobby.finish([result(6, 'tensionat')]);
  assert.equal(lobby.dashboard().activeCount, 2);
  assert.equal(lobby.dashboard().portrait, null);
  time += 5000;
  assert.equal(lobby.dashboard().activeCount, 2);

  time = 1_000_000 + 30 * 60_000;
  assert.equal(lobby.dashboard().activeCount, 1);
  time += 30_000;
  assert.equal(lobby.dashboard().activeCount, 0);
});

test('ineligible removes a previous contribution, retry delay is respected and raw jobs expire', () => {
  let time = 1_000_000;
  const lobby = createLobby({ now: () => time });
  const submit = (submissionId) => lobby.submit({ participantId: 'browser', submissionId, text: 'Test fictiv', ipKey: 'ip' });
  submit('a');
  lobby.takeBatch();
  lobby.finish([result(1, 'relaxat')]);
  time += 15000;
  assert.equal(lobby.dashboard().activeCount, 1);
  submit('b');
  lobby.fail(lobby.takeBatch(), 20_000);
  assert.equal(lobby.dashboard().analysis, 'delayed');
  time += 19_999;
  assert.deepEqual(lobby.takeBatch(), []);
  time++;
  assert.deepEqual(lobby.takeBatch().map(({ id }) => id), [2]);
  lobby.finish([{ id: 2, eligible: false, mood: null, themes: [] }]);
  time += 5000;
  assert.equal(lobby.dashboard().activeCount, 0);
  assert.equal(lobby.dashboard().analysis, 'ready');

  submit('c');
  lobby.fail(lobby.takeBatch());
  lobby.fail(lobby.takeBatch());
  assert.deepEqual(lobby.takeBatch(), []);
  assert.equal(lobby.dashboard().analysis, 'delayed');

  time += 15_000;
  submit('d');
  time += 30 * 60_000;
  assert.deepEqual(lobby.takeBatch(), []);
});

test('bounds queued raw messages and returns idempotent receipts even at capacity', () => {
  const lobby = createLobby({ ipLimit: 100 });
  const submit = (i) => lobby.submit({ participantId: 'browser' + i, submissionId: 'send', text: 'Test fictiv', ipKey: 'ip' });
  for (let i = 0; i < 60; i++) assert.equal(submit(i).status, 202);
  assert.equal(submit(60).status, 503);
  assert.equal(submit(0).body.seq, 1);
  const batch = lobby.takeBatch();
  assert.equal(batch.length, 20);
  lobby.finish(batch.map(({ id }) => result(id, 'neutru')));
  assert.equal(submit(60).status, 202);
});

test('OpenRouter separates user data, validates labels and honors Retry-After', async () => {
  const batch = [{ id: 1, text: 'Text fictiv despre liniște.' }];
  const classifier = openRouter({
    key: 'fake-key',
    request: async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/messages');
      assert.equal(options.headers.Authorization, 'Bearer fake-key');
      const parsed = JSON.parse(options.body);
      assert.equal(parsed.model, 'anthropic/claude-haiku-5.5');
      assert.equal(parsed.system.includes(batch[0].text), false);
      assert.deepEqual(JSON.parse(parsed.messages[0].content), batch);
      return Response.json({ content: [{ type: 'text', text: JSON.stringify([result(1, 'relaxat', ['liniște'])]) }] });
    },
  });
  assert.deepEqual(await classifier(batch), [{ ...result(1, 'relaxat', ['liniște']), emotion: null, intensity: 2 }]);
  assert.throws(() => validateResults([result(1, 'other')], batch));
  assert.throws(() => validateResults([result(1, 'neutru', ['oraș', 'oraș'])], batch));
  assert.throws(() => validateResults([result(2, 'neutru')], batch));
  await assert.rejects(openRouter({
    key: 'fake-key',
    request: async () => new Response('', { status: 429, headers: { 'Retry-After': 12 } }),
  })(batch), { delay: 12_000 });
  assert.equal((await classifyDemo(batch))[0].mood, 'relaxat');
});

test('richer analysis: sadness, nuances, intensity and emotional climate', async () => {
  const entry = (id, mood, emotion, intensity, themes = []) => ({ id, eligible: true, mood, emotion, intensity, themes });
  const portrait = aggregate([
    entry(1, 'trist', 'singur', 3), entry(2, 'trist', 'nostalgic', 2), entry(3, 'relaxat', 'calm', 1), entry(4, 'trist', 'singur', 3),
  ]);
  assert.equal(portrait.mood, 'trist');
  assert.deepEqual(portrait.distribution.map(({ mood }) => mood), ['relaxat', 'energic', 'obosit', 'tensionat', 'trist', 'neutru']);
  assert.deepEqual(portrait.nuances[0], { emotion: 'singur', mood: 'trist', percent: 50 });
  assert.equal(portrait.intensity.average, 2.3);
  assert.equal(portrait.intensity.label, 'moderată');
  assert.equal(portrait.climate.tone, 'apăsat');
  assert.match(portrait.summary, /singur/);
  assert.equal(portrait.suggestions.length, 2);

  const batch = [{ id: 1, text: 'x' }];
  assert.deepEqual(validateResults([{ id: 1, eligible: true, mood: 'trist', emotion: 'calm', intensity: 9, themes: [] }], batch),
    [{ id: 1, eligible: true, mood: 'trist', emotion: null, intensity: 2, themes: [] }]);
  const [demo] = await classifyDemo([{ id: 1, text: 'Mă simt foarte singur în seara asta.' }]);
  assert.deepEqual([demo.mood, demo.emotion, demo.intensity], ['trist', 'singur', 3]);
  const [calm] = await classifyDemo([{ id: 2, text: 'Puțin obosit după muncă.' }]);
  assert.deepEqual([calm.mood, calm.emotion, calm.intensity], ['obosit', 'obosit', 1]);
});
