{
  const byId = (id) => document.getElementById(id);
  const group = location.pathname.split('/')[3];
  const viewLinks = Array.from(document.querySelectorAll('[data-view]'));
  const views = ['portret', 'adauga-starea', 'lobby-uri'];
  const faceCard = byId('face-card');
  const face = byId('collective-face');
  const recommendationList = byId('home-recommendations');
  let recommendationPortrait;
  byId('portrait-qr').src = api + '/qr';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const cycle = 470;
  let animation;
  let settle;

  if (group) {
    document.body.classList.add('group-room');
    byId('room-title').textContent = 'Lobby';
    byId('room-description').textContent = 'Portretul grupului din ultimele 30 de minute.';
    byId('group-code-value').textContent = group;
    byId('group-code').hidden = false;
    byId('home-places-description').textContent = 'Alege o stare pe hartă. Recomandările grupului apar de la trei contribuții active.';
  }

  function openView(focus = false) {
    const target = location.hash.slice(1);
    const view = views.includes(target) && !(group && target === 'lobby-uri') ? target : 'portret';
    for (const id of views) byId(id).hidden = id !== view;
    for (const link of viewLinks) {
      if (link.dataset.view === view) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    document.querySelector('.home-actions').hidden = view === 'portret';
    document.querySelector('.screen-heading').hidden = !group && view !== 'portret';
    document.querySelector('.screen-status').hidden = view !== 'portret';
    byId('room-description').hidden = view !== 'portret';
    if (focus) {
      const heading = view === 'portret' ? byId('room-title') : byId(view).querySelector('h2');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  openView();
  addEventListener('hashchange', () => openView(true));

  function animateFace() {
    if (!animation || ['finished', 'idle'].includes(animation.playState)) {
      const frames = motionPreference.matches
        ? [{ opacity: 1 }, { opacity: .85 }, { opacity: 1 }]
        : [
          { transform: 'none' },
          { transform: 'translateY(-9%) rotate(13deg) scale(.97, 1.08)' },
          { transform: 'translateY(0) rotate(-10deg) scale(1.07, .94)' },
          { transform: 'none' },
        ];
      animation = face.animate(frames, { duration: cycle, easing: 'ease-in-out', iterations: Infinity });
    } else {
      animation.effect.updateTiming({ iterations: Infinity });
    }
    clearTimeout(settle);
    settle = setTimeout(() => {
      animation.effect.updateTiming({ iterations: Math.max(1, Math.ceil((animation.currentTime ?? 0) / cycle)) });
    }, 420);
  }

  faceCard.addEventListener('click', animateFace);
  byId('portret').addEventListener('click', (event) => {
    if (!event.target.closest('a, button') && !getSelection()?.toString()) animateFace();
  });
  motionPreference.addEventListener('change', () => {
    clearTimeout(settle);
    animation?.cancel();
  });

  const distribution = byId('room-distribution');
  let lastDistribution;
  let dashboardTimer;
  let dashboardLoading = false;

  function renderDistribution(rows) {
    const serialized = JSON.stringify(rows);
    if (serialized === lastDistribution) return;
    lastDistribution = serialized;
    distribution.replaceChildren(...rows.map(({ mood, percent }) => {
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
      fill.style.transform = 'scaleX(' + percent / 100 + ')';
      track.append(fill);
      const value = document.createElement('span');
      value.className = 'mood-percent';
      value.textContent = percent + '%';
      row.append(name, track, value);
      return row;
    }));
  }

  function setText(id, value) {
    const element = byId(id);
    if (element.textContent !== value) element.textContent = value;
  }

  async function refreshRecommendations(portrait) {
    const signature = JSON.stringify(portrait);
    if (signature === recommendationPortrait) return;
    try {
      const response = await fetch(document.body.dataset.placesEndpoint, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return;
      const { recomandari } = await response.json();
      recommendationList.replaceChildren(...recomandari.map(({ nume }) => {
        const item = document.createElement('li');
        item.textContent = nume;
        return item;
      }));
      recommendationPortrait = signature;
      if (group) setText('home-places-description', portrait
        ? 'Locuri din Oradea potrivite cu starea grupului.'
        : 'Alege o stare pe hartă. Recomandările grupului apar de la trei contribuții active.');
    } catch { /* The map link remains available while recommendations are loading. */ }
  }

  async function refresh() {
    if (dashboardLoading) return;
    dashboardLoading = true;
    clearTimeout(dashboardTimer);
    try {
      const response = await fetch(api + '/dashboard', { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error();
      const { portrait, activeCount, sampleCount, name, analysis, joinUrl } = await response.json();
      if (group) {
        setText('room-title', name);
        document.title = name + ' · Oradea Mood';
      }
      setText('room-mood', portrait?.headline ?? 'Așteptăm primele trei stări');
      setText('room-count', sampleCount
        ? sampleCount + ' stări fictive · ' + activeCount + (activeCount === 1 ? ' contribuție adăugată' : ' contribuții adăugate')
        : activeCount + (activeCount === 1 ? ' contribuție activă' : ' contribuții active'));
      const mood = portrait?.mood ?? 'waiting';
      byId('collective-face').dataset.mood = mood;
      byId('face-card').dataset.mood = mood;
      setText('room-status', { ready: 'Actualizat', pending: 'Se analizează', delayed: 'Analiză întârziată' }[analysis]);
      renderDistribution(portrait?.distribution ?? []);
      const qrUrl = new URL(joinUrl);
      const onLaptop = ['localhost', '127.0.0.1', '[::1]'].includes(qrUrl.hostname);
      const qrNote = onLaptop ? 'Cod de probă pentru acest laptop.' : 'Conectează telefonul la aceeași rețea Wi-Fi.';
      setText('qr-network', qrNote);
      byId('qr-network').hidden = qrUrl.protocol === 'https:';
      await refreshRecommendations(portrait);
    } catch {
      setText('room-status', 'Conexiune întreruptă');
    } finally {
      dashboardLoading = false;
      dashboardTimer = setTimeout(refresh, 3000);
    }
  }

  for (const [formId, path] of [['enter-room', '/api/lobbies/join'], ['create-room', '/api/lobbies']]) {
    const roomForm = byId(formId);
    roomForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = roomForm.querySelector('button');
      const feedback = roomForm.querySelector('.feedback');
      button.disabled = true;
      feedback.textContent = '';
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(roomForm))),
          signal: AbortSignal.timeout(5000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        location.assign(result.path);
      } catch (error) {
        feedback.textContent = error instanceof TypeError || error.name === 'TimeoutError'
          ? 'Serverul nu a răspuns. Încearcă din nou.'
          : error.message;
        feedback.setAttribute('data-error', '');
        button.disabled = false;
      }
    });
  }
  addEventListener('mood:published', () => void refresh());
  void refresh();
}
