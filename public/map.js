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
const street = L.tileLayer(esri + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Hartă &copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
});

const map = L.map('map', { layers: [street], zoomControl: true }).setView([47.0555, 21.933], 15);
L.control.layers({ Hartă: street, Satelit: hybrid }, null, { position: 'topright', collapsed: false }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const markers = new Map();
let data = null;
let finderMood = null;
let fitted = false;

const bestMood = (l) => MOODS.map(([k]) => k).reduce((b, k) => (l.stari[k] > l.stari[b] ? k : b), 'relaxat');

const GLYPHS = {
  tree: 'M8 1a4 4 0 0 0-3.9 4.9A3.5 3.5 0 0 0 5 13h2v2h2v-2h2a3.5 3.5 0 0 0 .9-7.1A4 4 0 0 0 8 1z',
  columns: 'M8 1 1 4.5V6h14V4.5zM2.5 7h2v5h-2zm4.5 0h2v5H7zm4.5 0h2v5h-2zM1 13h14v2H1z',
  music: 'M12.5 1 6 2.6v8A2.5 2.5 0 1 0 7.5 13V5.8l3.5-.9v3.7A2.5 2.5 0 1 0 12.5 11z',
  star: 'm8 1 2.1 4.5 4.9.6-3.6 3.4.9 4.9L8 12l-4.3 2.4.9-4.9L1 6.1l4.9-.6z',
  waves: 'M1 5.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 2-1v2c-.5 0-.5 1-2 1s-1.5-1-3-1-1.5 1-3 1-1.5-1-3-1-1.5 1-3 1zm0 4.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 2-1v2c-.5 0-.5 1-2 1s-1.5-1-3-1-1.5 1-3 1-1.5-1-3-1-1.5 1-3 1z',
  bag: 'M5 5V4a3 3 0 0 1 6 0v1h3l-1 10H3L2 5zm1.5 0h3V4a1.5 1.5 0 0 0-3 0z',
  paw: 'M4 6.5a1.5 2 0 1 0 0-.01zm3-3a1.5 2 0 1 0 0-.01zm3 0a1.5 2 0 1 0 0-.01zm3 3a1.5 2 0 1 0 0-.01zM8.5 8c2.5 0 4.5 3 4 5s-2.5 1-4 1-3.5 1-4-1 1.5-5 4-5z',
};
const TYPE_GLYPH = {
  parc: 'tree', promenadă: 'waves', 'grădină zoologică': 'paw', muzeu: 'columns', patrimoniu: 'columns', arhitectură: 'columns',
  teatru: 'music', concerte: 'music', piață: 'star', 'stradă pietonală': 'star', 'centru comercial': 'bag',
};

function icon(l) {
  const dim = finderMood && l.stari[finderMood] < 0.7;
  const rec = l.recomandat;
  const size = rec ? 34 : 26;
  const glyph = GLYPHS[TYPE_GLYPH[l.tip] ?? 'star'];
  const wrap = el('span', { class: 'gpin' + (rec ? ' rec' : '') + (dim ? ' dim' : ''), style: '--c: var(--pin-' + bestMood(l) + ')' });
  const dot = el('span', { class: 'gpin-dot' });
  dot.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + glyph + '"/></svg>';
  if (rec) dot.append(el('b', { class: 'gpin-num' }, String(rec)));
  wrap.append(dot, el('span', { class: 'gpin-label' }, l.nume));
  return L.divIcon({
    className: 'pin-wrap',
    html: wrap.outerHTML,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
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
  requestAnimationFrame(declutter);
  if (!fitted && data.locuri.length) {
    fitted = true;
    const bounds = L.latLngBounds(data.locuri.map((l) => [l.lat, l.lng])).pad(0.1);
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { maxZoom: 16, padding: [24, 24] });
    });
  }
}

function declutter() {
  if (!data) return;
  const order = [...data.locuri].sort((a, b) => (a.recomandat ?? 99) - (b.recomandat ?? 99) || a.nume.localeCompare(b.nume, 'ro'));
  const placed = [];
  const overlaps = (a, b) => a.left < b.right + 2 && a.right + 2 > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const l of order) {
    const node = markers.get(l.id)?.getElement();
    if (!node) continue;
    const dot = node.querySelector('.gpin-dot');
    if (dot) placed.push(dot.getBoundingClientRect());
  }
  const shown = [];
  for (const l of order) {
    const label = markers.get(l.id)?.getElement()?.querySelector('.gpin-label');
    if (!label) continue;
    label.style.visibility = 'visible';
    const box = label.getBoundingClientRect();
    const clash = shown.some((r) => overlaps(box, r)) || placed.some((r) => overlaps(box, r));
    if (clash && !l.recomandat) label.style.visibility = 'hidden';
    else shown.push(box);
  }
}
map.on('zoomend moveend', () => requestAnimationFrame(declutter));

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
