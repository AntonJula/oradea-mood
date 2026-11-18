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
const app = await createApp({ demo: true, ipLimit: 30, now: () => clock, publicBase: 'https://mood.example', placesFile: ':memory:' });
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
  if (!(await tab.locator('#join-form').isVisible())) {
    await tab.getByRole('button', { name: 'Trimite o altă stare' }).click();
  }
  await tab.locator('#mood-text').fill(text);
  await tab.getByRole('button', { name: 'Trimite starea mea' }).click();
  await tab.getByRole('heading', { name: 'Analizăm starea ta…' }).waitFor();
  assert.equal(await tab.locator('#mood-text').inputValue(), '');
}

async function checkNavigation(tab, active) {
  const nav = tab.getByRole('navigation', { name: 'Navigare principală' });
  assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Portret', 'Starea mea', 'Hartă', 'Lobby-uri']);
  await nav.getByRole('link', { name: active, exact: true }).and(nav.locator('[aria-current]')).waitFor();
  assert.equal(await nav.locator('[aria-current]').textContent(), active);
  return nav;
}

try {
  const tv = await page({ width: 1280, height: 720 });
  const tvUrl = base + '/l/oradea/live';
  await tv.goto(tvUrl);
  const tvNav = await checkNavigation(tv, 'Portret');
  assert.equal(await tvNav.getByRole('link', { name: 'Hartă' }).getAttribute('href'), '/harta');
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
    assert.equal(await tab.locator('#contribution-destination').textContent(), 'Oradea · Lobby public');
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
  await first.getByRole('heading', { name: 'Starea ta este „obosit”' }).waitFor();
  assert.match(await first.locator('#result-message').textContent(), /Oradea · Lobby public/);
  assert.equal(await first.locator('#result-portrait').getAttribute('href'), '/l/oradea/live');
  assert.match(await first.locator('#result-places').getAttribute('href'), /\/harta\?stare=obosit#personal$/);

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
  const rehearsalNav = await checkNavigation(rehearsal, 'Portret');
  assert.equal(await rehearsalNav.getByRole('link', { name: 'Portret' }).getAttribute('href'), '/l/oradea/live');
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

  const journey = await page({ width: 742, height: 883 });
  await journey.goto(base);
  let nav = await checkNavigation(journey, 'Portret');
  const recommendedPlace = journey.locator('#home-recommendations a').first();
  await recommendedPlace.waitFor();
  const placeName = await recommendedPlace.textContent();
  await recommendedPlace.click();
  nav = await checkNavigation(journey, 'Hartă');
  await journey.locator('.leaflet-popup').getByRole('heading', { name: placeName, exact: true }).waitFor();
  await nav.getByRole('link', { name: 'Portret' }).click();
  nav = await checkNavigation(journey, 'Portret');
  await nav.getByRole('link', { name: 'Starea mea' }).click();
  nav = await checkNavigation(journey, 'Starea mea');
  assert.equal(await journey.locator('#contribution-destination').textContent(), 'Oradea · Portret demonstrativ');
  await journey.getByRole('textbox', { name: 'Starea ta', exact: true }).fill('Sunt obosit azi.');
  await nav.getByRole('link', { name: 'Hartă' }).click();
  nav = await checkNavigation(journey, 'Hartă');
  await journey.locator('#state').filter({ hasText: 'Portret demonstrativ' }).waitFor();
  await journey.screenshot({ path: join(output, 'oradea-mood-meniu-harta.png'), fullPage: false });
  await nav.getByRole('link', { name: 'Starea mea' }).click();
  assert.equal(await journey.locator('#mood-text').inputValue(), 'Sunt obosit azi.');
  await submit(journey, 'Sunt obosit azi.');
  await app.tick();
  clock += 5000;
  await journey.getByRole('link', { name: 'Locuri pentru starea mea' }).click();
  nav = await checkNavigation(journey, 'Hartă');
  await journey.locator('#finder li').first().waitFor();
  assert.equal(await journey.getByRole('button', { name: 'Obosit', exact: true }).getAttribute('aria-pressed'), 'true');
  await nav.getByRole('link', { name: 'Portret' }).click();
  await journey.locator('#room-count').filter({ hasText: '1 contribuție adăugată' }).waitFor();
  nav = await checkNavigation(journey, 'Portret');
  await nav.getByRole('link', { name: 'Lobby-uri' }).click();
  await checkNavigation(journey, 'Lobby-uri');
  await journey.getByRole('textbox', { name: 'Intră cu un cod' }).fill('GRESIT');
  await journey.getByRole('button', { name: 'Intră', exact: true }).click();
  await journey.getByText('Codul nu corespunde unui lobby activ.').waitFor();
  await journey.getByRole('textbox', { name: 'Intră cu un cod' }).fill('LIGHTNING2');
  await journey.getByRole('button', { name: 'Intră', exact: true }).click();
  await journey.getByRole('heading', { name: 'Lightning Hackathon #2' }).waitFor();
  nav = await checkNavigation(journey, 'Portret');
  await nav.getByRole('link', { name: 'Hartă' }).click();
  nav = await checkNavigation(journey, 'Hartă');
  assert.match(journey.url(), /\/l\/g\/LIGHTNING2\/harta$/);
  await journey.locator('#state').filter({ hasText: 'Lightning Hackathon #2' }).waitFor();
  await nav.getByRole('link', { name: 'Starea mea' }).click();
  assert.match(journey.url(), /\/l\/g\/LIGHTNING2#adauga-starea$/);
  nav = await checkNavigation(journey, 'Starea mea');
  assert.equal(await journey.locator('#contribution-destination').textContent(), 'Lightning Hackathon #2');
  await journey.getByRole('link', { name: 'Schimbă lobby-ul' }).click();
  await checkNavigation(journey, 'Lobby-uri');
  await journey.getByRole('textbox', { name: 'Creează un lobby' }).fill('Echipa din Oradea');
  await journey.getByRole('button', { name: 'Creează' }).click();
  await journey.getByRole('heading', { name: 'Echipa din Oradea' }).waitFor();
  nav = await checkNavigation(journey, 'Portret');
  assert.match(await nav.getByRole('link', { name: 'Hartă' }).getAttribute('href'), /\/l\/g\/[0-9A-F]{12}\/harta$/);
  await nav.getByRole('link', { name: 'Lobby-uri' }).click();
  await journey.getByRole('link', { name: 'Deschide portretul public' }).click();
  nav = await checkNavigation(journey, 'Portret');
  await nav.getByRole('link', { name: 'Hartă' }).click();
  nav = await checkNavigation(journey, 'Hartă');
  await journey.locator('#state').filter({ hasText: 'Oradea · Public' }).waitFor();
  await nav.getByRole('link', { name: 'Starea mea' }).click();
  await checkNavigation(journey, 'Starea mea');
  assert.match(journey.url(), /\/l\/oradea$/);
  const unavailable = await journey.goto(base + '/l/g/EXPIRAT/harta');
  assert.equal(unavailable.status(), 404);
  await journey.getByRole('link', { name: 'Intră cu alt cod sau creează un lobby' }).click();
  await checkNavigation(journey, 'Lobby-uri');

  assert.deepEqual(errors, []);
  console.log('Pass: QR decode, participant viewports, submission/retry, TV threshold, rehearsal, offline recovery, keyboard controls and navigation across demo, group and public routes.');
} finally {
  await browser.close();
  await new Promise((resolve) => app.server.close(resolve));
}
