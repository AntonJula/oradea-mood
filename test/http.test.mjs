import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.mjs';

test('HTTP routes, QR, proxy limits, duplicate retry and no leakage to dashboard', async (t) => {
  let now = 900_000;
  const app = await createApp({
    now: () => now, ipLimit: 30, demo: true, publicBase: 'https://mood.example',
    trustedProxy: '127.0.0.1',
  });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve())));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const api = '/api/lobbies/oradea';
  const request = (path, options) => fetch(base + path, options);
  const json = (path, payload, { ip = '192.0.2.1', method = 'POST' } = {}) => request(api + path, {
    method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(payload),
  });
  const dashboard = async () => (await request(api + '/dashboard')).json();
  const submit = (text, participantId = randomUUID(), submissionId = randomUUID()) => ({ text, participantId, submissionId });

  assert.deepEqual(await (await request('/api/health')).json(), { status: 'ok', mode: 'demo' });
  for (const path of ['/', '/l/oradea', '/l/oradea/live', '/assets/style.css', '/assets/gsap.js']) {
    assert.equal((await request(path)).status, 200);
  }
  assert.equal((await request('/.env')).status, 404);
  const qr = await request(api + '/qr');
  assert.equal(qr.headers.get('Content-Type'), 'image/png');
  assert.ok((await qr.arrayBuffer()).byteLength > 0);
  assert.equal((await dashboard()).joinUrl, 'https://mood.example/l/oradea');
  assert.equal((await request('/l/oradea/repetitie')).status, 200);
  const moments = await (await request(api + '/rehearsal')).json();
  assert.equal(moments.length, 21);
  assert.equal((await dashboard()).activeCount, 0);
  assert.deepEqual(new Set(moments.map(({ data }) => data.portrait?.mood ?? 'waiting')), new Set([
    'waiting', 'relaxat', 'energic', 'obosit', 'tensionat', 'neutru', 'mixed',
  ]));
  assert.equal(moments[3].data.activeCount, 3);
  assert.deepEqual(moments[3].data.portrait.distribution.map(({ percent }) => percent), [34, 33, 33, 0, 0]);
  assert.equal(moments[12].offline, true);
  assert.deepEqual(moments[13].data, moments[11].data);
  assert.equal(moments[14].offline, false);
  assert.notEqual(moments[14].data.publishedAt, moments[11].data.publishedAt);
  assert.equal(moments[18].data.activeCount, 3);
  assert.equal(moments[19].data.activeCount, 2);
  assert.equal(moments[19].data.portrait, null);
  assert.equal(moments[20].data.activeCount, 0);
  assert.equal((await json('/messages', submit('ab'))).status, 400);
  assert.equal((await json('/messages', submit('x'.repeat(281)))).status, 400);
  assert.equal((await json('/messages', submit('x'.repeat(4100)))).status, 413);

  const messages = [
    submit('Sunt relaxat, text fictiv privat.'),
    submit('Sunt energic și ascult muzică.'),
    submit('Sunt obosit și vreau o pauză.'),
  ];
  for (const message of messages) assert.equal((await json('/messages', message)).status, 202);
  const duplicate = await json('/messages', messages[0]);
  assert.equal(duplicate.status, 202);
  assert.equal((await duplicate.json()).seq, 1);
  assert.equal((await json('/messages', submit('abc', messages[0].participantId))).status, 429);
  assert.equal((await dashboard()).portrait, null);

  await app.tick();
  now += 5000;
  const state = await dashboard();
  assert.equal(state.activeCount, 3);
  assert.equal(state.portrait.headline, 'Stare mixtă');
  const publicText = JSON.stringify(state);
  for (const { participantId, submissionId, text } of messages) {
    for (const secret of [participantId, submissionId, text, '192.0.2.1']) assert.ok(!publicText.includes(secret));
  }

  now += 10_000;
  assert.equal((await json('/messages', submit('Sunt obosit.', messages[0].participantId))).status, 202);
  await app.tick();
  now += 5000;
  assert.equal((await dashboard()).portrait.headline, 'Obosit');
  assert.equal((await dashboard()).activeCount, 3);
  assert.equal((await json('/contributions/me', messages[0], { method: 'DELETE' })).status, 204);
  assert.equal((await dashboard()).portrait, null);
  assert.equal((await dashboard()).activeCount, 2);

  for (let i = 0; i < 26; i++) assert.equal((await json('/messages', submit(i === 0 ? 'x'.repeat(280) : 'abc'))).status, 202);
  assert.equal((await json('/messages', submit('abc'))).status, 429);
  assert.equal((await json('/messages', submit('abc'), { ip: '192.0.2.2' })).status, 202);
  now += 60_000;
  assert.equal((await json('/messages', submit('abc'))).status, 202);
});

test('live mode does not serve the rehearsal or fictional contributions', async (t) => {
  const { server } = await createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/l/oradea/repetitie')).status, 404);
  assert.equal((await fetch(base + '/api/lobbies/oradea/rehearsal')).status, 404);
  const dashboard = await (await fetch(base + '/api/lobbies/oradea/dashboard')).json();
  assert.equal(dashboard.demo, false);
  assert.equal(dashboard.activeCount, 0);
});

test('homepage sample accepts a contribution and invitation codes open isolated lobbies', async (t) => {
  let now = 900_000;
  const app = await createApp({ now: () => now, demo: true });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise((resolve) => app.server.close(resolve)));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const api = base + '/api/lobbies';
  const post = (path, payload) => fetch(api + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const dashboard = async (room) => (await fetch(api + '/' + room + '/dashboard')).json();
  const participantId = randomUUID();

  assert.match(await (await fetch(base)).text(), /Cum se simte/);
  assert.equal((await dashboard('oradea-demo')).sampleCount, 8);
  assert.equal((await dashboard('oradea-demo')).portrait.mood, 'energic');
  assert.equal((await dashboard('oradea')).portrait, null);
  assert.equal((await post('/join', { code: 'INVALID' })).status, 404);
  const eventPath = (await (await post('/join', { code: ' lightning2 ' })).json()).path;
  assert.equal((await fetch(base + eventPath)).status, 200);
  assert.equal((await dashboard('LIGHTNING2')).name, 'Lightning Hackathon #2');
  assert.equal((await dashboard('LIGHTNING2')).sampleCount, 0);

  const created = await post('', { name: 'Echipa Oradea' });
  assert.equal(created.status, 201);
  const { code, path } = await created.json();
  assert.equal((await (await post('/join', { code })).json()).path, path);
  assert.equal((await dashboard(code)).name, 'Echipa Oradea');
  for (const room of ['oradea-demo', 'LIGHTNING2', code]) {
    assert.equal((await post('/' + room + '/messages', {
      participantId, submissionId: randomUUID(), text: 'Sunt obosit.',
    })).status, 202);
    await app.tick();
    now += 5000;
    assert.equal((await (await post('/' + room + '/contributions/me', { participantId })).json()).mood, 'obosit');
  }
  assert.equal((await dashboard('oradea-demo')).activeCount, 1);
  assert.equal((await dashboard('oradea')).activeCount, 0);
  assert.equal((await dashboard(code)).activeCount, 1);
  assert.equal((await dashboard('LIGHTNING2')).portrait, null);
});
