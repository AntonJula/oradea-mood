const MOODS = [
  ['relaxat', 'Relaxat'],
  ['energic', 'Energic'],
  ['obosit', 'Obosit'],
  ['tensionat', 'Tensionat'],
  ['neutru', 'Neutru'],
];
const LABEL = Object.fromEntries(MOODS);
const ADJ = { relaxat: 'relaxată', energic: 'energică', obosit: 'obosită', tensionat: 'tensionată', neutru: 'neutră' };
const $ = (id) => document.getElementById(id);
const plural = (n, one, many) => {
  if (n === 1) return '1 ' + one;
  const r = n % 100;
  return n >= 20 && (r === 0 || r >= 20) ? n + ' de ' + many : n + ' ' + many;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const satellite = L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  maxNativeZoom: 19,
  attribution: 'Imagini &copy; Esri, Maxar, Earthstar Geographics',
});
const roads = L.tileLayer(esri + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.9 });
const labels = L.tileLayer(esri + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
const hybrid = L.layerGroup([satellite, roads, labels]);
const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});

const map = L.map('map', { layers: [hybrid], zoomControl: true }).setView([47.0555, 21.933], 15);
L.control.layers({ Satelit: hybrid, Hartă: street }, null, { position: 'topright', collapsed: false }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const markers = new Map();
let data = null;
let finderMood = null;
let fitted = false;

const bestMood = (l) => MOODS.map(([k]) => k).reduce((b, k) => (l.stari[k] > l.stari[b] ? k : b), 'relaxat');

function icon(l) {
  const dim = finderMood && l.stari[finderMood] < 0.7;
  const cls = 'pin' + (l.recomandat ? ' rec' : '') + (dim ? ' dim' : '');
  const size = l.recomandat ? 38 : 28;
  return L.divIcon({
    className: 'pin-wrap',
    html: '<span class="' + cls + '" style="--c: var(--' + bestMood(l) + ')"><b>' + (l.recomandat ?? '') + '</b></span>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size * 1.3],
    popupAnchor: [0, -size * 1.2],
  });
}

function bars(rows) {
  const ul = el('ul', { class: 'dist' });
  for (const [k, value] of rows) {
    const li = el('li');
    const track = el('span', { class: 'mbar-track', 'aria-hidden': 'true' });
    const fill = el('span', { class: 'mbar-fill' });
    fill.style.width = value + '%';
    fill.style.background = 'var(--' + k + ')';
    track.append(fill);
    li.append(el('span', {}, LABEL[k]), track, el('span', { class: 'pct' }, value + '%'));
    ul.append(li);
  }
  return ul;
}

function popup(l) {
  const box = el('div', { class: 'pop' });
  box.append(el('h3', {}, l.nume), el('p', { class: 'kind' }, l.tip + ' · ' + l.zona));
  if (l.recomandat) box.append(el('p', { class: 'rec-note' }, 'Recomandarea nr. ' + l.recomandat + ' pentru starea de acum'));
  if (l.descriere) box.append(el('p', {}, l.descriere));
  box.append(el('span', { class: 'eyebrow' }, 'Se potrivește cu starea'));
  box.append(bars(MOODS.map(([k]) => [k, Math.round(l.stari[k] * 100)]).sort((a, b) => b[1] - a[1])));
  if (l.teme.length) box.append(el('p', { class: 'src' }, 'Teme: ' + l.teme.join(', ')));
  box.append(el('p', { class: 'src' }, l.verificat ? 'Loc verificat' : 'Catalog inițial, de verificat'));
  return box;
}

function drawPins() {
  for (const l of data.locuri) {
    let m = markers.get(l.id);
    if (!m) {
      m = L.marker([l.lat, l.lng], { title: l.nume, alt: l.nume, riseOnHover: true }).addTo(map);
      markers.set(l.id, m);
    }
    m.setIcon(icon(l));
    m.setZIndexOffset(l.recomandat ? 1000 - l.recomandat : 0);
    m.bindPopup(() => popup(l));
  }
  if (!fitted && data.locuri.length) {
    fitted = true;
    const bounds = L.latLngBounds(data.locuri.map((l) => [l.lat, l.lng])).pad(0.1);
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { maxZoom: 16, padding: [24, 24] });
    });
  }
}

function focus(id) {
  const m = markers.get(id);
  if (!m) return;
  map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 17), { duration: reduced ? 0 : 0.7 });
  m.openPopup();
}

function placeButton(l, { num, meta, fit }) {
  const li = el('li');
  const b = el('button', { type: 'button' });
  const body = el('span');
  body.append(el('strong', {}, l.nume), el('small', {}, meta));
  b.append(num ? el('span', { class: 'num' }, String(num)) : el('span'), body, el('span', { class: 'fit' }, fit ?? ''));
  b.addEventListener('click', () => focus(l.id));
  li.append(b);
  return li;
}

function renderState() {
  const box = $('state');
  box.replaceChildren(el('span', { class: 'eyebrow' }, 'Starea în Oradea acum'));
  const s = data.stare;
  if (!s.distribution) {
    box.append(el('span', { class: 'state-big' }, s.activeCount ? 'Primele semnale' : 'Seara începe cu tine'));
    box.append(el('p', { class: 'state-sub' }, plural(s.activeCount, 'contribuție activă', 'contribuții active') + '. Recomandările apar de la 3 contribuții.'));
    return;
  }
  box.append(el('span', { class: 'state-big' }, s.headline));
  box.append(el('p', { class: 'state-sub' }, plural(s.activeCount, 'contribuție activă', 'contribuții active') + ' în ultimele 30 de minute'));
  box.append(bars(s.distribution.map(({ mood, percent }) => [mood, percent])));
}

function renderRecs() {
  const box = $('recs');
  box.hidden = !data.recomandari.length;
  box.replaceChildren(el('h2', {}, 'Locuri potrivite acum'));
  const ol = el('ol', { class: 'place-list' });
  data.recomandari.forEach((r, i) => ol.append(placeButton(r, { num: i + 1, meta: r.tip + ' · ' + r.zona + ' · ' + r.motiv })));
  box.append(ol);
}

function renderFinder() {
  for (const b of $('mood-chips').children) b.setAttribute('aria-pressed', String(b.dataset.mood === finderMood));
  const list = $('finder');
  list.replaceChildren();
  if (!finderMood || !data) return;
  [...data.locuri]
    .sort((a, b) => b.stari[finderMood] - a.stari[finderMood] || a.nume.localeCompare(b.nume, 'ro'))
    .slice(0, 5)
    .forEach((l) => list.append(placeButton(l, { meta: l.tip + ' · ' + l.zona, fit: Math.round(l.stari[finderMood] * 100) + '%' })));
  list.setAttribute('aria-label', 'Locuri potrivite pentru o stare ' + ADJ[finderMood]);
}

for (const [k, lab] of MOODS) {
  const b = el('button', { type: 'button', 'aria-pressed': 'false', 'data-mood': k });
  const i = el('i');
  i.style.background = 'var(--' + k + ')';
  b.append(i, document.createTextNode(lab));
  b.addEventListener('click', () => {
    finderMood = finderMood === k ? null : k;
    renderFinder();
    drawPins();
  });
  $('mood-chips').append(b);
}

async function poll() {
  try {
    const res = await fetch('/api/places', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    data = await res.json();
    $('demo-note').hidden = !data.demo;
    drawPins();
    renderState();
    renderRecs();
    renderFinder();
  } catch {
    if (!data) $('state').replaceChildren(el('span', { class: 'eyebrow' }, 'Starea în Oradea acum'), el('p', { class: 'state-sub' }, 'Conexiune pierdută. Reîncercăm…'));
  }
}

poll();
setInterval(poll, 5000);

new ResizeObserver(() => map.invalidateSize()).observe(document.getElementById('map'));
