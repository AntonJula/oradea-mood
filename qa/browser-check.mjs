import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

const qaRequire = createRequire(join(process.env.ORADEA_QA_TOOLS, 'package.json'));
const { chromium } = qaRequire('playwright-core');
const decodeQr = qaRequire('jsqr');
const { PNG } = createRequire(import.meta.resolve('qrcode'))('pngjs');
const output = process.env.ORADEA_QA_OUTPUT;
await mkdir(output, { recursive: true });
let clock = Date.now();
const app = await createApp({ demo: true, ipLimit: 30, now: () => clock, publicBase: 'https://mood.example' });
app.server.listen(0, '127.0.0.1');
await once(app.server, 'listening');
const base = 'http://127.0.0.1:' + app.server.address().port;
const browser = await chromium.launch({ executablePath: process.env.ORADEA_QA_EDGE, args: ['--disable-gpu'] });
const errors = [];

async function page(viewport, options = {}) {
  const context = await browser.newContext({ viewport, ...options });
  const tab = await context.newPage();
  tab.on('pageerror', (error) => errors.push(error.message));
  return tab;
}

async function submit(tab, text) {
  await tab.locator('#mood-text').fill(text);
  await tab.getByRole('button', { name: 'Trimite starea mea' }).click();
  await tab.waitForFunction(() => document.querySelector('#feedback').textContent.includes('a fost primită'));
  assert.equal(await tab.locator('#mood-text').inputValue(), '');
}

try {
  const tv = await page({ width: 1280, height: 720 });
  const tvUrl = base + '/l/oradea/live';
  await tv.goto(tvUrl);
  await tv.waitForFunction(() => document.querySelector('#active-count').textContent === '0');
  assert.equal(await tv.locator('#distribution').isVisible(), false);
  assert.equal(await tv.locator('#demo-note').isVisible(), true);
  const image = PNG.sync.read(Buffer.from(await (await fetch(base + '/api/lobbies/oradea/qr')).arrayBuffer()));
  assert.equal(decodeQr(Uint8ClampedArray.from(image.data), image.width, image.height).data, 'https://mood.example/l/oradea');
  await tv.screenshot({ path: join(output, 'oradea-mood-tv-asteptare.png'), fullPage: true });

  const phoneSizes = [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 430, height: 932 }];
  const [first, second, third] = await Promise.all(phoneSizes.map(async (viewport) => {
    const tab = await page(viewport);
    await tab.goto(base + '/l/oradea');
    await tab.evaluate(() => document.fonts.ready);
    assert.equal(await tab.evaluate(() => document.fonts.check('16px Geist')), true);
    const pageFits = await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.ok(pageFits);
    return tab;
  }));
  await first.waitForFunction(() => getComputedStyle(document.querySelector('.join-content')).opacity === '1');
  await first.screenshot({ path: join(output, 'oradea-mood-telefon.png'), fullPage: true });
  await first.setViewportSize({ width: 320, height: 460 });
  await first.locator('#mood-text').focus();
  assert.ok(await first.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await first.setViewportSize(phoneSizes[0]);

  const messages = ['Sunt relaxat și mă bucur de liniște.', 'Sunt energic și ascult muzică.', 'Sunt obosit și vreau o pauză.'];
  await first.route('**/messages', (route) => route.abort());
  await first.locator('#mood-text').fill(messages[0]);
  await first.getByRole('button', { name: 'Trimite starea mea' }).click();
  await first.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Conexiunea s-a întrerupt'));
  assert.equal(await first.locator('#mood-text').inputValue(), messages[0]);
  await first.unroute('**/messages');
  await Promise.all([first, second, third].map((tab, index) => submit(tab, messages[index])));
  await app.tick();
  clock += 5000;
  await tv.waitForFunction(() => document.querySelector('#active-count').textContent === '3');
  assert.equal(await tv.locator('#headline').textContent(), 'Stare mixtă');
  assert.deepEqual(await tv.locator('.mood-percent').allTextContents(), ['34%', '33%', '33%', '0%', '0%']);
  assert.equal(await tv.locator('#suggestions li').count(), 2);
  const layout = await tv.evaluate(() => Object.fromEntries(['.site-bar', '.screen-heading', '.dashboard', '.portrait', '.interpretation', '.screen-footer'].map((selector) => {
    const bounds = document.querySelector(selector).getBoundingClientRect();
    return [selector, [bounds.top, bounds.height, bounds.bottom]];
  })));
  await tv.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.fill')).transform).a - .34) < .0001);
  await tv.screenshot({ path: join(output, 'oradea-mood-tv.png'), fullPage: true });

  assert.ok(layout['.screen-footer'][2] <= 720, JSON.stringify(layout));

  await tv.route('**/dashboard', (route) => route.abort());
  await tv.waitForFunction(() => document.querySelector('#connection').textContent.includes('Conexiune întreruptă · date de la'));
  assert.equal(await tv.locator('#active-count').textContent(), '3');
  await tv.unroute('**/dashboard');

  clock += 10_000;
  await first.reload();
  await submit(first, 'Sunt obosit și vreau o pauză.');
  await app.tick();
  clock += 5000;
  await tv.waitForFunction(() => document.querySelector('#headline').textContent === 'Obosit');
  assert.equal(await tv.locator('#active-count').textContent(), '3');

  await first.getByRole('button', { name: 'Retrage contribuția mea' }).click();
  await tv.waitForFunction(() => document.querySelector('#active-count').textContent === '2');
  assert.equal(await tv.locator('#distribution').isVisible(), false);
  assert.equal(await tv.locator('#summary').isVisible(), false);
  assert.equal(await tv.locator('#suggestions').isVisible(), false);
  assert.equal(await tv.locator('.qr').isVisible(), true);

  for (const [name, viewport] of [
    ['tableta', { width: 820, height: 1180 }],
    ['desktop', { width: 1440, height: 900 }],
  ]) {
    const preview = await page(viewport, { reducedMotion: 'reduce' });
    await preview.goto(base + '/l/oradea');
    await preview.evaluate(() => document.fonts.ready);
    assert.ok(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await preview.getByRole('textbox', { name: 'Starea ta' }).isVisible(), true);
    await preview.screenshot({ path: join(output, 'oradea-mood-' + name + '.png'), fullPage: true });
    await preview.context().close();
  }

  const rehearsal = await page({ width: 1280, height: 720 }, { reducedMotion: 'reduce' });
  await rehearsal.goto(base + '/l/oradea/repetitie');
  const next = rehearsal.getByRole('button', { name: 'Momentul următor' });
  assert.equal(await rehearsal.locator('#demo-note').textContent(), 'Date fictive');
  assert.equal(await rehearsal.locator('#collective-face').getAttribute('data-mood'), 'waiting');
  const expressions = new Set(['waiting']);
  for (let i = 1; i <= 20; i++) {
    await next.click();
    expressions.add(await rehearsal.locator('#collective-face').getAttribute('data-mood'));
    if (i === 3) {
      assert.equal(await rehearsal.locator('#active-count').textContent(), '3');
      assert.deepEqual(await rehearsal.locator('.mood-percent').allTextContents(), ['34%', '33%', '33%', '0%', '0%']);
      await rehearsal.screenshot({ path: join(output, 'oradea-mood-repetitie.png'), fullPage: true });
    }
    if (i === 12) assert.match(await rehearsal.locator('#connection').textContent(), /Conexiune întreruptă · date de la/);
    if (i === 14) assert.equal(await rehearsal.locator('#connection').textContent(), 'Actualizat');
    if (i === 19) {
      assert.equal(await rehearsal.locator('#active-count').textContent(), '2');
      assert.equal(await rehearsal.locator('#distribution').isVisible(), false);
    }
  }
  assert.equal(expressions.size, 7);
  assert.equal(await next.isDisabled(), true);
  assert.equal(await tv.locator('#active-count').textContent(), '2');
  const slider = rehearsal.getByRole('slider', { name: 'Moment din repetiție' });
  await slider.focus();
  await slider.press('Home');
  assert.equal(await rehearsal.locator('#scene-counter').textContent(), 'Momentul 1 din 21');
  await rehearsal.getByRole('button', { name: 'Redă' }).click();
  await rehearsal.waitForFunction(() => document.querySelector('#scene-counter').textContent === 'Momentul 3 din 21');
  await rehearsal.getByRole('button', { name: 'Pauză' }).click();
  assert.equal(await rehearsal.getByRole('button', { name: 'Redă' }).isVisible(), true);
  await rehearsal.setViewportSize({ width: 360, height: 800 });
  await rehearsal.evaluate(() => window.scrollTo(0, 440));
  assert.ok(await rehearsal.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await rehearsal.evaluate(() => document.querySelector('#rehearsal').getBoundingClientRect().top < 16));
  assert.deepEqual(errors, []);
  console.log('Pass: QR decode, participant viewports, submission/retry, TV threshold, all seven rehearsal expressions, expiration, offline recovery and keyboard controls.');
} finally {
  await browser.close();
  await new Promise((resolve) => app.server.close(resolve));
}
