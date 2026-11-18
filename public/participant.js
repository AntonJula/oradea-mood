const api = '/api/lobbies/oradea';
const form = document.querySelector('#join-form');
const field = document.querySelector('#mood-text');
const counter = document.querySelector('#draft-count');
const submit = document.querySelector('#submit-button');
const withdraw = document.querySelector('#withdraw-button');
const feedback = document.querySelector('#feedback');
const storageKey = 'oradea-mood-browser';
let participantId;
let hasContribution = false;
let requestInFlight = false;
let retry;

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function readIdentity() {
  try { return JSON.parse(localStorage.getItem(storageKey)); }
  catch { return null; }
}

function identity() {
  if (participantId) return participantId;
  const stored = readIdentity();
  participantId = stored?.participantId ?? uuid();
  hasContribution = Boolean(stored?.hasContribution);
  storeIdentity();
  return participantId;
}

function storeIdentity() {
  try { localStorage.setItem(storageKey, JSON.stringify({ participantId, hasContribution })); }
  catch { /* The current page can still participate when browser storage is disabled. */ }
}

function showFeedback(message, error = false) {
  feedback.textContent = message;
  feedback.toggleAttribute('data-error', error);
}

function draft() {
  return field.value.trim().replace(/\s+/gu, ' ');
}

function update() {
  const size = [...draft()].length;
  counter.value = size + ' / 280';
  counter.toggleAttribute('data-invalid', size > 280);
  field.setAttribute('aria-invalid', String(size > 280));
  submit.disabled = requestInFlight || size < 3 || size > 280;
  submit.firstElementChild.textContent = requestInFlight && field.readOnly ? 'Se trimite…' : 'Trimite starea mea';
  withdraw.hidden = !hasContribution;
  withdraw.disabled = requestInFlight;
}

async function send(path, method, payload) {
  const response = await fetch(api + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Cererea nu a reușit. Încearcă din nou.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const text = draft();
  identity();
  if (retry?.text !== text) retry = { text, submissionId: uuid() };
  requestInFlight = true;
  field.readOnly = true;
  update();
  showFeedback('');

  try {
    await send('/messages', 'POST', { ...retry, participantId });
    retry = undefined;
    hasContribution = true;
    storeIdentity();
    field.value = '';
    showFeedback('Starea ta a fost primită pentru analiză.');
  } catch (error) {
    if (error instanceof TypeError || error.name === 'TimeoutError') {
      hasContribution = true;
      storeIdentity();
      showFeedback('Conexiunea s-a întrerupt. Poți încerca din nou cu același text.', true);
    } else {
      showFeedback(error.message, true);
    }
  } finally {
    field.readOnly = false;
    requestInFlight = false;
    update();
  }
});

withdraw.addEventListener('click', async () => {
  if (requestInFlight) return;
  requestInFlight = true;
  update();
  try {
    await send('/contributions/me', 'DELETE', { participantId: identity() });
    hasContribution = false;
    retry = undefined;
    storeIdentity();
    showFeedback('Contribuția ta a fost retrasă.');
  } catch {
    showFeedback('Retragerea nu a putut fi confirmată. Încearcă din nou.', true);
  } finally {
    requestInFlight = false;
    update();
  }
});

field.addEventListener('input', update);
identity();
update();

fetch('/api/health', { signal: AbortSignal.timeout(3000) })
  .then((response) => response.json())
  .then(({ mode }) => {
    const demo = mode === 'demo';
    document.querySelector('#demo-note').hidden = !demo;
    document.querySelector('#rehearsal-link').hidden = !demo;
    if (demo) document.querySelector('#privacy').textContent = 'Demo-ul analizează textul local. Evită numele și alte date personale.';
  })
  .catch(() => {});

if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.from('.join-art .face', { scale: .88, duration: .55, ease: 'back.out(1.4)', clearProps: 'transform' });
}
