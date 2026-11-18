import { createServer } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { createLobby } from './lib/lobby.mjs';
import { createRehearsal } from './lib/rehearsal.mjs';
import { openRouter, classifyDemo } from './lib/classification.mjs';

const root = '/l/oradea';
const api = '/api/lobbies/oradea';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const pages = [
  ['/assets/style.css', 'public/style.css', 'text/css; charset=utf-8'],
  ['/assets/participant.js', 'public/participant.js', 'text/javascript; charset=utf-8'],
  ['/assets/live.js', 'public/live.js', 'text/javascript; charset=utf-8'],
  ['/assets/gsap.js', 'node_modules/gsap/dist/gsap.min.js', 'text/javascript; charset=utf-8'],
  ['/assets/geist-latin.woff2', 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'font/woff2'],
  ['/assets/geist-latin-ext.woff2', 'node_modules/@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2', 'font/woff2'],
];
const limit = 4096;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    req.resume();
    throw new HttpError(415, 'Se acceptă doar date JSON.');
  }
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw new HttpError(413, 'Mesajul este prea mare.');
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
      else reject(new HttpError(413, 'Mesajul este prea mare.'));
    });
    req.on('error', reject);
    req.on('end', () => {
      if (size > limit) return;
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
        resolve(payload);
      } catch {
        reject(new HttpError(400, 'Cerere JSON invalidă.'));
      }
    });
  });
}

export async function createApp({
  now = Date.now,
  ipLimit = 5,
  demo = false,
  publicBase = 'http://localhost:3000',
  trustedProxy = '',
  proxyHeader = 'cf-connecting-ip',
  classify = demo ? classifyDemo : openRouter({ key: process.env.OPENROUTER_API_KEY, model: process.env.AI_MODEL }),
} = {}) {
  const lobby = createLobby({ now, ipLimit });
  const base = new URL(publicBase);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
    || base.pathname !== '/' || base.search || base.hash) throw new Error('PUBLIC_BASE_URL trebuie să fie o origine HTTP(S).');
  if (trustedProxy && !isIP(trustedProxy)) throw new Error('TRUST_PROXY_ADDRESS trebuie să fie o adresă IP.');
  if (!['cf-connecting-ip', 'x-forwarded-for'].includes(proxyHeader)) throw new Error('TRUST_PROXY_HEADER este invalid.');
  const joinUrl = new URL(root, base).href;
  const rehearsal = demo ? createRehearsal(joinUrl) : null;
  const salt = randomBytes(32);
  const assets = new Map(await Promise.all(pages.map(async ([route, file, type]) => [
    route, { bytes: await readFile(new URL(file, import.meta.url)), type },
  ])));
  const formPage = await readFile(new URL('public/participant.html', import.meta.url));
  const livePage = await readFile(new URL('public/live.html', import.meta.url));
  const qr = await QRCode.toBuffer(joinUrl, { type: 'png', width: 520, margin: 4, errorCorrectionLevel: 'M' });
  let busy = false;

  function ipKey(req) {
    const peer = req.socket.remoteAddress?.replace(/^::ffff:/, '') ?? '';
    const header = peer === trustedProxy ? req.headers[proxyHeader] : undefined;
    const forwarded = typeof header === 'string' ? header.split(',').at(-1).trim() : '';
    return createHmac('sha256', salt).update(isIP(forwarded) ? forwarded : peer).digest('base64url');
  }

  async function tick() {
    if (busy) return;
    const batch = lobby.takeBatch();
    if (!batch.length) return;
    busy = true;
    try {
      lobby.finish(await classify(batch));
    } catch (error) {
      lobby.fail(batch, error?.delay);
    } finally {
      busy = false;
    }
  }

  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (status, bytes, type) => res.writeHead(status, { 'Content-Type': type }).end(bytes);
    const json = (status, body) => send(status, JSON.stringify(body), 'application/json; charset=utf-8');

    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET') {
        const asset = assets.get(path);
        if (asset) return send(200, asset.bytes, asset.type);
        if (path === '/' || path === root || path === root + '/') return send(200, formPage, 'text/html; charset=utf-8');
        if (path === root + '/live' || path === root + '/live/') return send(200, livePage, 'text/html; charset=utf-8');
        if (rehearsal && (path === root + '/repetitie' || path === root + '/repetitie/')) {
          return send(200, livePage, 'text/html; charset=utf-8');
        }
        if (path === '/api/health') return json(200, { status: 'ok', mode: demo ? 'demo' : 'live' });
        if (path === api + '/dashboard') return json(200, { ...lobby.dashboard(), demo, joinUrl });
        if (rehearsal && path === api + '/rehearsal') return json(200, rehearsal);
        if (path === api + '/qr') return send(200, qr, 'image/png');
      }

      if (req.method === 'POST' && path === api + '/messages') {
        const { participantId, submissionId, text } = await readJson(req);
        if (typeof participantId !== 'string' || !uuid.test(participantId) || typeof submissionId !== 'string' || !uuid.test(submissionId)) {
          throw new HttpError(400, 'Identificator de trimitere invalid.');
        }
        const result = lobby.submit({ participantId: participantId.toLowerCase(), submissionId: submissionId.toLowerCase(), text, ipKey: ipKey(req) });
        if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
        return json(result.status, result.body);
      }

      if (req.method === 'DELETE' && path === api + '/contributions/me') {
        const { participantId } = await readJson(req);
        if (typeof participantId !== 'string' || !uuid.test(participantId)) throw new HttpError(400, 'Identificator de participant invalid.');
        lobby.withdraw(participantId.toLowerCase());
        return res.writeHead(204).end();
      }

      return json(404, { error: 'Pagina nu există.' });
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.message });
      return json(500, { error: 'Cererea nu a putut fi procesată.' });
    }
  });
  return { server, tick, joinUrl };
}

if (import.meta.main) {
  const demo = process.argv.includes('--demo') || process.env.DEMO_MODE === 'true';
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  const ipLimit = Number(process.env.LIMITA_IP_MESAJE_PE_MINUT ?? (demo ? 30 : 5));
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isSafeInteger(ipLimit) || ipLimit < 1) {
    throw new Error('PORT sau LIMITA_IP_MESAJE_PE_MINUT invalidă.');
  }

  const { server, tick, joinUrl } = await createApp({
    demo,
    ipLimit,
    publicBase: process.env.PUBLIC_BASE_URL ?? 'http://localhost:' + port,
    trustedProxy: process.env.TRUST_PROXY_ADDRESS,
    proxyHeader: process.env.TRUST_PROXY_HEADER,
  });
  server.listen(port, host, () => {
    console.log('Oradea Mood · ' + (demo ? 'demo local' : 'live') + ' · port ' + port);
    console.log('Formular / QR: ' + joinUrl);
    console.log('TV local: http://localhost:' + port + root + '/live');
    if (demo) console.log('Repetiție: http://localhost:' + port + root + '/repetitie');
    if (!demo && !process.env.OPENROUTER_API_KEY) console.log('OPENROUTER_API_KEY lipsește. Analiza live va fi indisponibilă.');
  });
  const worker = setInterval(tick, 10_000);
  server.on('close', () => clearInterval(worker));
}
