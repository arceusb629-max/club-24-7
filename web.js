// web.js · panel web PRIVADO: solo entra quien tenga la clave PANEL_TOKEN del .env (mínimo 16 caracteres).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express');

const WRITABLE = { lvlon: 'boolean', xprate: 'number', cur: 'string', color: 'string' }; // ajustes que el panel puede cambiar
const COOKIE = 'panel_session';
const WEEK = 7 * 24 * 3600 * 1000;

const LOGIN_PAGE = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Club 24/7 · Acceso</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05080a;color:#eef7f8;font-family:system-ui,sans-serif}
form{width:min(340px,90vw);background:rgba(10,14,17,.9);border:1px solid rgba(120,220,230,.14);border-radius:18px;padding:26px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 6px}p{color:#7d8c93;font-size:14px;margin:0 0 16px}
input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid rgba(120,220,230,.14);background:rgba(255,255,255,.04);color:#eef7f8;font:inherit}
button{margin-top:12px;width:100%;padding:11px;border:0;border-radius:12px;background:#f7b731;color:#1a1200;font:inherit;font-weight:600;cursor:pointer}
#err{color:#ff6b6b;font-size:13px;min-height:18px;margin-top:10px}
</style></head><body>
<form id="f"><h1>Club 24/7</h1><p>Panel privado. Escribe tu clave.</p>
<input id="t" type="password" autocomplete="current-password" placeholder="Clave del panel" required>
<button>Entrar</button><div id="err"></div></form>
<script>
document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const r = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: document.getElementById('t').value }) });
  if (r.ok) location.reload();
  else { const d = await r.json().catch(() => ({})); document.getElementById('err').textContent = d.error || 'Error al entrar'; }
};
</script></body></html>`;

module.exports = function startWeb({ client, DB, save, C, PORT }) {
  const KEY = process.env.PANEL_TOKEN || '';
  const enabled = KEY.length >= 16;
  if (!enabled) console.warn('⚠️ PANEL_TOKEN falta o tiene menos de 16 caracteres. El panel quedará cerrado hasta que lo configures.');

  const app = express();
  app.set('trust proxy', 1); // detrás de Cloudflare o un hosting: usa X-Forwarded-Proto para saber si es https
  app.use(express.json({ limit: '50kb' }));

  const sign = () => crypto.createHmac('sha256', KEY).update('panel-session').digest('hex');
  const safeEq = (a, b) => {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const readCookie = (req, name) => {
    const hit = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
  };
  const isOwner = req => enabled && safeEq(readCookie(req, COOKIE), sign());

  // Entrar con la clave. Tras 5 fallos seguidos se bloquea 1 minuto.
  let fails = 0, lockUntil = 0;
  app.post('/login', (req, res) => {
    if (!enabled) return res.status(503).json({ error: 'PANEL_TOKEN no está configurado en el .env' });
    if (Date.now() < lockUntil) return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
    if (!safeEq(req.body?.token ?? '', KEY)) {
      if (++fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
      return res.status(401).json({ error: 'Clave incorrecta' });
    }
    fails = 0;
    res.cookie(COOKIE, sign(), { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: WEEK, path: '/' });
    res.json({ ok: true });
  });
  app.post('/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

  // Todo lo demás exige sesión
  app.use((req, res, next) => {
    if (isOwner(req)) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'no autorizado' });
    res.status(401).type('html').send(LOGIN_PAGE);
  });

  const page = fs.readFileSync(path.join(__dirname, 'panel-bot.html'), 'utf8');
  const link = fs.readFileSync(path.join(__dirname, 'panel-link.js'), 'utf8');
  app.get('/', (req, res) => res.type('html').send(page.replace('</body>', `<script>${link}</script></body>`)));

  app.get('/api/guilds', (req, res) => res.json([...client.guilds.cache.values()].map(g => ({
    id: g.id, n: g.name, m: g.memberCount, icon: g.iconURL({ size: 128 }),
  }))));

  app.get('/api/guild/:id/summary', (req, res) => {
    const g = client.guilds.cache.get(req.params.id);
    if (!g) return res.status(404).json({ error: 'servidor no encontrado' });
    const d = DB[g.id] || {}, c = C(g.id);
    res.json({
      members: g.memberCount,
      cumples: Object.keys(d.birthdays || {}).length,
      starboard: !!d.star,
      respuestas: Object.keys(d.autoresp || {}).length,
      settings: { lvlon: c.lvlon, xprate: c.xprate, cur: c.cur, color: c.color },
    });
  });

  app.patch('/api/guild/:id/settings', (req, res) => {
    const g = client.guilds.cache.get(req.params.id);
    if (!g) return res.status(404).json({ error: 'servidor no encontrado' });
    const { key, value } = req.body || {};
    if (!WRITABLE[key] || typeof value !== WRITABLE[key]) return res.status(400).json({ error: 'ajuste no permitido' });
    if (key === 'xprate' && (value < 0 || value > 1000)) return res.status(400).json({ error: 'xprate fuera de rango' });
    C(g.id)[key] = value; save();
    res.json({ ok: true });
  });

  app.listen(PORT, () => console.log(`🔒 Panel privado en http://localhost:${PORT}`));
};
