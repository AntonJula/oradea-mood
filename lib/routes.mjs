export const PUBLIC_LOBBY_PATH = '/l/oradea';

const lobbyList = '/#lobby-uri';

export function roomRoutes(roomId) {
  if (roomId === 'oradea') {
    return {
      portrait: PUBLIC_LOBBY_PATH + '/live',
      contribute: PUBLIC_LOBBY_PATH,
      map: '/harta',
      places: '/api/places',
      lobbies: lobbyList,
    };
  }

  const sample = roomId === 'oradea-demo';
  const base = sample ? '/' : '/l/g/' + roomId;
  return {
    portrait: base + '#portret',
    contribute: base + '#adauga-starea',
    map: sample ? '/harta?portret=demo' : base + '/harta',
    places: sample ? '/api/places?portret=demo' : '/api/places?lobby=' + roomId,
    lobbies: lobbyList,
  };
}

export function renderNavigation(routes, active, inlineViews = {}) {
  const items = [
    ['portrait', 'Portret'],
    ['contribute', 'Starea mea'],
    ['map', 'Hartă'],
    ['lobbies', 'Lobby-uri'],
  ];
  const links = items.map(([key, label]) => {
    const href = inlineViews[key] ? '#' + inlineViews[key] : routes[key];
    const view = inlineViews[key] ? ' data-view="' + inlineViews[key] + '"' : '';
    const current = key === active ? ' aria-current="location"' : '';
    return '<a href="' + href + '"' + view + current + '>' + label + '</a>';
  }).join('');

  return `<header class="site-bar app-bar">
    <a class="brand" href="/" aria-label="Pagina principală Oradea Mood"><span class="mark" aria-hidden="true"></span>oradea<span class="brand-mood">mood</span></a>
    <nav class="app-nav" aria-label="Navigare principală">${links}</nav>
  </header>`;
}
