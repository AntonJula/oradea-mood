const groupCode = location.pathname.match(/^\/l\/g\/([A-Z0-9]+)\/?$/)?.[1];
const roomId = groupCode ?? (location.pathname === '/' ? 'oradea-demo' : 'oradea');
const api = '/api/lobbies/' + roomId;
const form = document.querySelector('#join-form');
const field = document.querySelector('#mood-text');
const counter = document.querySelector('#draft-count');
const submit = document.querySelector('#submit-button');
const withdraw = document.querySelector('#withdraw-button');
const feedback = document.querySelector('#feedback');
const storageKey = roomId === 'oradea' ? 'oradea-mood-browser' : 'oradea-mood-browser:' + roomId;
const draftKey = storageKey + ':draft';
let participantId;
let hasContribution = false;
let requestInFlight = false;
let retry;
let latestSubmission;
let resultStatus;
let submittedText;
const result = document.querySelector('#submission-result');
const byResultId = (id) => document.getElementById(id);
const resultMapUrl = byResultId('result-places')?.getAttribute('href');

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
  latestSubmission = stored?.latestSubmission;
  storeIdentity();
  return participantId;
}

function storeIdentity() {
  try { localStorage.setItem(storageKey, JSON.stringify({ participantId, hasContribution, latestSubmission })); }
  catch { /* The current page can still participate when browser storage is disabled. */ }
}

function showFeedback(message, error = false) {
  feedback.textContent = message;
  feedback.toggleAttribute('data-error', error);
}

function draft() {
  return field.value.trim().replace(/\s+/gu, ' ');
}

function rememberDraft() {
  try {
    if (field.value) sessionStorage.setItem(draftKey, field.value);
    else sessionStorage.removeItem(draftKey);
  } catch { /* The form still works when session storage is unavailable. */ }
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
    submittedText = result ? text : undefined;
    latestSubmission = result ? retry.submissionId : undefined;
    retry = undefined;
    hasContribution = true;
    storeIdentity();
    field.value = '';
    rememberDraft();
    if (result) showResult('pending');
    else showFeedback('Starea ta a fost primită pentru analiză.');
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
    latestSubmission = undefined;
    if (result) showForm();
    retry = undefined;
    storeIdentity();
    showFeedback('Contribuția ta a fost retrasă.');
  } catch {
    if (result && !result.hidden) setResultText('result-message', 'Retragerea nu a putut fi confirmată. Încearcă din nou.');
    else showFeedback('Retragerea nu a putut fi confirmată. Încearcă din nou.', true);
  } finally {
    requestInFlight = false;
    update();
  }
});

field.addEventListener('input', () => {
  rememberDraft();
  update();
});
try { field.value = sessionStorage.getItem(draftKey) ?? field.value; }
catch { /* Keep the current field value. */ }
identity();
update();

function setResultText(id, message) {
  const element = byResultId(id);
  if (element.textContent !== message) element.textContent = message;
}

function showResult(status, mood) {
  const changed = status !== resultStatus;
  resultStatus = status;
  const added = status === 'added';
  const waiting = status === 'pending' || status === 'retrying';
  const labels = {
    pending: ['Analizăm starea ta…', 'Textul a fost trimis. Rezultatul apare aici automat.'],
    retrying: ['Analiza durează mai mult', 'Reîncercăm automat. Rezultatul apare aici.'],
    failed: ['Analiza nu a reușit', 'Poți încerca din nou cu o altă trimitere.'],
    ineligible: ['Nu am putut extrage o stare', 'Încearcă o propoziție care spune direct cum te simți.'],
    replaced: ['Starea a fost înlocuită', 'Poți trimite din nou cum te simți acum.'],
    withdrawn: ['Contribuția a fost retrasă', 'Poți trimite o stare nouă oricând.'],
    expired: ['Această trimitere nu mai este activă', 'Poți trimite o stare nouă ca să actualizezi portretul.'],
  };
  const [title, message] = added
    ? ['Starea ta este „' + mood + '”', roomId !== 'oradea-demo'
      ? 'Contribuția ta a fost adăugată în acest lobby. Distribuția grupului apare de la trei contribuții active.'
      : 'Contribuția ta a intrat în distribuția portretului Oradei. Poți vedea portretul actualizat sau locuri potrivite pentru starea ta.']
    : labels[status];
  result.dataset.status = status;
  result.hidden = false;
  form.hidden = true;
  byResultId('form-back').hidden = true;
  setResultText('result-title', title);
  setResultText('result-message', message);
  byResultId('result-actions').hidden = waiting;
  byResultId('result-portrait').hidden = !added;
  const places = byResultId('result-places');
  places.hidden = !added;
  if (added) {
    const map = new URL(resultMapUrl, location.origin);
    map.searchParams.set('stare', mood);
    map.hash = 'personal';
    places.href = map.href;
  }
  if (added && changed) dispatchEvent(new Event('mood:published'));
}

function showForm() {
  result.hidden = true;
  resultStatus = undefined;
  form.hidden = false;
  byResultId('form-back').hidden = false;
  showFeedback('');
}

async function refreshSubmission() {
  const submissionId = latestSubmission;
  if (submissionId && !requestInFlight && !result.hidden) {
    try {
      const response = await fetch(api + '/contributions/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, submissionId }),
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        const { status, active, mood } = await response.json();
        if (latestSubmission !== submissionId || requestInFlight || result.hidden) return;
        hasContribution = active || status === 'pending' || status === 'retrying';
        storeIdentity();
        showResult(status, mood);
        update();
      }
    } catch {
      if (latestSubmission === submissionId && ['pending', 'retrying'].includes(resultStatus)) {
        setResultText('result-message', 'Verificăm din nou când revine conexiunea.');
      }
    } finally {
      setTimeout(refreshSubmission, 1800);
    }
  } else {
    setTimeout(refreshSubmission, 1800);
  }
}

if (result) {
  if (latestSubmission && !field.value) showResult('pending');
  byResultId('result-edit').addEventListener('click', () => {
    if (['failed', 'ineligible'].includes(resultStatus) && submittedText) field.value = submittedText;
    showForm();
    rememberDraft();
    update();
    field.focus();
  });
  void refreshSubmission();
}

fetch('/api/health', { signal: AbortSignal.timeout(3000) })
  .then((response) => response.json())
  .then(({ mode }) => {
    const demo = mode === 'demo';
    document.querySelector('#demo-note').hidden = !demo;
    const rehearsalLink = document.querySelector('#rehearsal-link');
    if (rehearsalLink) rehearsalLink.hidden = !demo;
    if (demo) document.querySelector('#privacy').textContent = 'Demo-ul analizează textul local. Evită numele și alte date personale.';
  })
  .catch(() => {});

if (document.querySelector('.join-art .face') && window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.from('.join-art .face', { scale: .88, duration: .55, ease: 'back.out(1.4)', clearProps: 'transform' });
}
