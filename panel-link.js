// panel-link.js · se inyecta en el panel: carga los servidores reales del bot y sus datos.
(function () {
  fetch('/api/guilds').then(r => r.json()).then(list => {
    if (!list.length || typeof SERVERS === 'undefined') return;
    SERVERS.length = 0;
    list.forEach(g => SERVERS.push({
      id: g.id, n: g.n, m: g.m, bg: 'linear-gradient(160deg,#0f4c52,#06181b)', av: '#0f4c52',
      t: (g.n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'SV').toUpperCase(), src: g.icon || null,
    }));
    renderGrid();
  }).catch(() => {});

  const abrir = openServer; // conserva el comportamiento original y añade los datos reales
  openServer = function (i) {
    abrir(i);
    const s = SERVERS[i];
    if (!s || !s.id) return;
    fetch('/api/guild/' + s.id + '/summary').then(r => r.json()).then(d => {
      const h = document.querySelectorAll('.stat h3');
      if (h[2]) h[2].textContent = Number(d.members).toLocaleString('es');
    }).catch(() => {});
  };
})();
