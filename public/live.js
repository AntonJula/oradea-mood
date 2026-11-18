const api = '/api/lobbies/oradea';
const byId = (id) => document.getElementById(id);
const results = byId('results');
const distribution = byId('distribution');
const time = byId('published-at');
const face = byId('collective-face');
const faceCard = byId('face-card');
const dashboard = document.querySelector('.dashboard');
const rehearsalMode = /^\/l\/oradea\/repetitie\/?$/.test(location.pathname);
const motionOff = matchMedia('(prefers-reduced-motion: reduce)');
const formatter = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const panels = [results, byId('interpretation'), byId('suggestions-panel')];
let lastPortrait;
let lastPublished;
let rows = [];

function list(element, values) {
  element.replaceChildren(...values.map((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    return item;
  }));
}

function statusText(id, text) {
  if (byId(id).textContent !== text) byId(id).textContent = text;
}

function connection(status, stale = false) {
  statusText('connection', status);
  document.querySelector('.screen-status').toggleAttribute('data-stale', stale);
}

function disconnected() {
  const suffix = lastPublished ? ' · date de la ' + formatter.format(new Date(lastPublished)) : '';
  connection('Conexiune întreruptă' + suffix, true);
}

function makeRow(mood) {
  const row = document.createElement('li');
  row.className = 'mood-row';
  const name = document.createElement('span');
  name.className = 'mood-name';
  name.textContent = mood;
  const track = document.createElement('span');
  track.className = 'track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  fill.className = 'fill';
  track.append(fill);
  const percent = document.createElement('span');
  percent.className = 'mood-percent';
  row.append(name, track, percent);
  distribution.append(row);
  return { fill, percent };
}

function showFace(mood, animate) {
  if (face.dataset.mood === mood) return;
  face.dataset.mood = mood;
  faceCard.dataset.mood = mood;
  if (!animate) return;
  gsap.killTweensOf(face);
  gsap.timeline()
    .to(face, { scale: .93, duration: .11, ease: 'power2.out' })
    .to(face, { scale: 1, duration: .46, ease: 'back.out(1.4)', clearProps: 'transform' });
}

function renderPortrait(portrait) {
  const hasPortrait = portrait !== null;
  const appeared = results.hidden && hasPortrait;
  dashboard.toggleAttribute('data-waiting', !hasPortrait);
  byId('holding').hidden = hasPortrait;
  for (const panel of panels) panel.hidden = !hasPortrait;
  const serialized = JSON.stringify(portrait);
  if (serialized === lastPortrait) return;
  lastPortrait = serialized;

  const animate = window.gsap && !motionOff.matches;
  showFace(portrait?.mood ?? 'waiting', animate);
  if (!hasPortrait) {
    if (window.gsap) gsap.killTweensOf(rows.map(({ fill }) => fill));
    distribution.replaceChildren();
    rows = [];
    return;
  }

  statusText('headline', portrait.headline);
  statusText('summary', portrait.summary);
  list(byId('themes'), portrait.themes);
  const nuanceText = [
    portrait.nuances?.length ? 'Nuanțe: ' + portrait.nuances.map(({ emotion, percent }) => emotion + ' ' + percent + '%').join(', ') : '',
    portrait.intensity ? 'intensitate ' + portrait.intensity.label : '',
    portrait.climate ? 'ton ' + portrait.climate.tone + ', energie ' + portrait.climate.energyLabel : '',
  ].filter(Boolean).join(' · ');
  byId('nuances').textContent = nuanceText;
  byId('nuances').hidden = !nuanceText;
  list(byId('suggestions'), portrait.suggestions);

  if (!rows.length) rows = portrait.distribution.map(({ mood }) => makeRow(mood));
  portrait.distribution.forEach(({ percent }, index) => {
    const row = rows[index];
    if (row.percent.textContent === percent + '%') return;
    row.percent.textContent = percent + '%';
    if (animate) {
      gsap.to(row.fill, {
        scaleX: percent / 100, duration: .53, delay: appeared ? index * .055 : 0,
        ease: 'power3.out', overwrite: true,
      });
    } else {
      row.fill.style.transform = 'scaleX(' + percent / 100 + ')';
    }
  });

  if (appeared && animate) {
    gsap.fromTo(panels, { opacity: .67, y: 10 }, {
      opacity: 1, y: 0, duration: .42, stagger: .055, ease: 'power2.out',
      overwrite: true, clearProps: 'opacity,transform',
    });
  }
}

motionOff.addEventListener('change', () => {
  if (!motionOff.matches || !window.gsap) return;
  gsap.killTweensOf([face, ...panels, ...rows.map(({ fill }) => fill)]);
  gsap.set([face, ...panels], { clearProps: 'opacity,transform' });
  for (const row of rows) row.fill.style.transform = 'scaleX(' + parseFloat(row.percent.textContent) / 100 + ')';
});

function render(data) {
  statusText('active-count', String(data.activeCount));
  const link = byId('join-address');
  if (link.textContent !== data.joinUrl) {
    byId('qr-link').href = data.joinUrl;
    link.href = data.joinUrl;
    link.textContent = data.joinUrl;
  }
  byId('demo-note').hidden = !data.demo;
  if (data.demo && !rehearsalMode) byId('rehearsal-link').hidden = false;
  if (data.publishedAt !== lastPublished) {
    lastPublished = data.publishedAt;
    time.textContent = lastPublished ? formatter.format(new Date(lastPublished)) : '–';
    if (lastPublished) time.dateTime = new Date(lastPublished).toISOString();
    else time.removeAttribute('datetime');
  }
  const status = { ready: 'Actualizat', pending: 'Se analizează', delayed: 'Analiză întârziată' };
  connection(status[data.analysis], data.analysis === 'delayed');
  renderPortrait(data.portrait);
}

async function read(path) {
  const response = await fetch(api + path, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error();
  return response.json();
}

async function poll() {
  try {
    render(await read('/dashboard'));
  } catch {
    disconnected();
  }
  setTimeout(poll, 3000);
}

async function rehearse() {
  byId('rehearsal').hidden = false;
  byId('live-link').hidden = false;
  statusText('demo-note', 'Date fictive');
  byId('tv-description').textContent = 'Repetiție cu participanți fictivi pentru ecranul TV.';
  byId('qr-description').textContent = 'Scanează pentru a participa la portretul public Oradea.';
  let moments;
  try {
    moments = await read('/rehearsal');
  } catch {
    disconnected();
    statusText('scene-caption', 'Repetiția nu s-a încărcat. Reîncarcă pagina.');
    return;
  }

  const prev = byId('scene-prev');
  const next = byId('scene-next');
  const play = byId('scene-play');
  const slider = byId('scene-slider');
  let index = 0;
  let timer;
  slider.max = moments.length;

  function pause() {
    clearInterval(timer);
    timer = undefined;
    play.textContent = 'Redă';
  }

  function show(target) {
    index = target;
    const { caption, offline, data } = moments[index];
    render(data);
    if (offline) disconnected();
    statusText('scene-counter', 'Momentul ' + (index + 1) + ' din ' + moments.length);
    statusText('scene-caption', caption);
    slider.value = index + 1;
    slider.setAttribute('aria-valuetext', byId('scene-counter').textContent);
    prev.disabled = index === 0;
    next.disabled = index === moments.length - 1;
    if (next.disabled && timer !== undefined) pause();
  }

  prev.addEventListener('click', () => { pause(); show(index - 1); });
  next.addEventListener('click', () => { pause(); show(index + 1); });
  slider.addEventListener('input', () => { pause(); show(Number(slider.value) - 1); });
  play.addEventListener('click', () => {
    if (timer !== undefined) return pause();
    show(index === moments.length - 1 ? 0 : index + 1);
    if (index === moments.length - 1) return;
    play.textContent = 'Pauză';
    timer = setInterval(() => show(index + 1), 2700);
  });

  byId('rehearsal-controls').hidden = false;
  show(0);
}

if (rehearsalMode) void rehearse();
else void poll();
