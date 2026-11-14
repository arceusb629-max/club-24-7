/* =====================================================================
   BOT DISCORD ALL-IN-ONE · 175 comandos · discord.js v14 · Node 18+
   Instalar:  npm i discord.js
   Ejecutar:  TOKEN=tu_token node index.js
   Intents a activar en el Developer Portal: Server Members, Message Content, Presence no necesario.
   Los 150 comandos van como subcomandos (Discord limita a 100 comandos raíz):
   /verif /seg /mod /log /nivel /eco /logro /anuncio /autorole /ticket /invite /util /bienvenida
   ===================================================================== */
// Carga el archivo .env de esta carpeta (sin instalar nada extra). Las variables del sistema tienen prioridad.
try {
  for (const l of require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const fs = require('fs');
const {
  Client, GatewayIntentBits: GI, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, PermissionFlagsBits: P,
  ChannelType, AttachmentBuilder, AuditLogEvent, UserSelectMenuBuilder, StringSelectMenuBuilder,
  ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, TextDisplayBuilder, SeparatorSpacingSize,
  SectionBuilder, ThumbnailBuilder, LabelBuilder, FileUploadBuilder, CheckboxBuilder,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || 'PON_TU_TOKEN_AQUI';
if (TOKEN === 'PON_TU_TOKEN_AQUI') console.error('⚠️ No encontré el token. Revisa DISCORD_TOKEN en el archivo .env');
const client = new Client({
  intents: [GI.Guilds, GI.GuildMembers, GI.GuildMessages, GI.MessageContent, GI.GuildModeration,
    GI.GuildInvites, GI.GuildVoiceStates, GI.GuildMessageReactions, GI.DirectMessages, GI.GuildEmojisAndStickers, GI.GuildWebhooks, GI.GuildIntegrations, GI.GuildScheduledEvents, ...[GI.GuildMessagePolls].filter(Boolean)],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const START = Date.now();

/* ============================ BASE DE DATOS ============================ */
const DBF = process.env.DB_PATH || './db.json'; // en hosting se pone DB_PATH=/data/db.json (volumen persistente)
// Primera vez en hosting: si la base de datos está en el proyecto y aún no existe en el volumen, se copia
if (DBF !== './db.json' && !fs.existsSync(DBF) && fs.existsSync('./db.json')) { try { fs.mkdirSync(require('path').dirname(DBF), { recursive: true }); fs.copyFileSync('./db.json', DBF); console.log('[db] base de datos copiada al volumen'); } catch (err) { console.error('[db] no pude copiar la base:', err.message); } }
let DB = {};
if (fs.existsSync(DBF)) {
  try { DB = JSON.parse(fs.readFileSync(DBF, 'utf8')); }
  catch (err) { // db.json dañado: se guarda una copia y se intenta con la copia de seguridad antes de empezar en blanco
    console.error(`[db] db.json está dañado (${err.message}). Copia guardada como db.corrupto.json`);
    try { fs.copyFileSync(DBF, 'db.corrupto.json'); } catch {}
    try { DB = JSON.parse(fs.readFileSync(`${DBF}.bak`, 'utf8')); console.warn('[db] Recuperado desde db.json.bak'); } catch { DB = {}; }
  }
}
let dirty = false;
function flushDB() { // escribe en un archivo temporal y lo renombra: si se corta la luz a mitad, db.json no queda a medias
  try { if (fs.existsSync(DBF)) fs.copyFileSync(DBF, `${DBF}.bak`); fs.writeFileSync(`${DBF}.tmp`, JSON.stringify(DB)); fs.renameSync(`${DBF}.tmp`, DBF); }
  catch (err) { console.error('[db] No pude guardar:', err.message); }
}
setInterval(() => { if (dirty) { flushDB(); dirty = false; } }, 5000);
process.on('exit', flushDB);
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit()); // hostings (Docker, Railway, etc.) paran el bot con SIGTERM
process.on('unhandledRejection', e => console.error(e));
process.on('uncaughtException', e => console.error('[error no controlado]', e)); // un fallo suelto ya no tumba todo el bot
const save = () => (dirty = true);
/* ---- Catálogo de logros: rareza, categoría, puntos, forma e icono de la tarjeta ---- */
const RAR = { comun: { n: 'Común', c: '#7c8cff', p: 5 }, poco: { n: 'Poco común', c: '#8b3dff', p: 10 }, raro: { n: 'Raro', c: '#8b3dff', p: 20 },
  epico: { n: 'Épico', c: '#d946ef', p: 40 }, legendario: { n: 'Legendario', c: '#ffb703', p: 75 } };
const ACAT = { chat: ['💬', 'Chat', 'circle', 'chat'], nivel: ['⭐', 'Nivel', 'shield', 'star'], eco: ['💰', 'Economía', 'circle', 'coin'], inv: ['📨', 'Invitaciones', 'hex', 'mail'],
  voz: ['🎙️', 'Voice', 'shield', 'mic'], cam: ['📷', 'Cámara', 'circle', 'camera'], stream: ['🖥️', 'Stream', 'hex', 'screen'], leal: ['🏅', 'Lealtad', 'shield', 'calendar'] };
const TYPE_CAT = { msgs: 'chat', lvl: 'nivel', coins: 'eco', invites: 'inv', vmin: 'voz', mic: 'voz', micon: 'voz', cam: 'cam', camon: 'cam', strm: 'stream', stron: 'stream', days: 'leal', acct: 'leal' };
const achMeta = a => {
  const cat = ACAT[a.cat] ? a.cat : TYPE_CAT[a.type] || 'chat', c = ACAT[cat], rar = RAR[a.rar] ? a.rar : 'comun';
  return { cat, ce: c[0], cl: c[1], shape: a.shape || c[2], icon: a.icon || c[3], rar, rn: RAR[rar].n, color: RAR[rar].c, pts: a.pts ?? RAR[rar].p };
};
const defAch = () => [
  // Chat
  { id: 'a1', name: 'Primer paso', desc: 'Envía tu primer mensaje', emoji: '👶', type: 'msgs', value: 1, rar: 'comun' },
  { id: 'a2', name: 'Charlatán', desc: 'Envía 500 mensajes', emoji: '💬', type: 'msgs', value: 500, rar: 'poco' },
  { id: 'msg3', name: 'Leyenda del chat', desc: 'Envía 5,000 mensajes', emoji: '🗣️', type: 'msgs', value: 5000, rar: 'epico' },
  // Nivel / economía / invitaciones
  { id: 'a3', name: 'Veterano', desc: 'Llega al nivel 10', emoji: '⭐', type: 'lvl', value: 10, rar: 'poco' },
  { id: 'lvl2', name: 'Élite', desc: 'Llega al nivel 25', emoji: '🌟', type: 'lvl', value: 25, rar: 'raro' },
  { id: 'lvl3', name: 'Inmortal', desc: 'Llega al nivel 50', emoji: '👑', type: 'lvl', value: 50, rar: 'legendario' },
  { id: 'a4', name: 'Millonario', desc: 'Acumula 10,000 monedas', emoji: '💰', type: 'coins', value: 10000, rar: 'poco' },
  { id: 'eco2', name: 'Magnate', desc: 'Acumula 100,000 monedas', emoji: '💎', type: 'coins', value: 100000, rar: 'epico' },
  { id: 'a5', name: 'Reclutador', desc: 'Invita a 5 personas', emoji: '📨', type: 'invites', value: 5, rar: 'poco' },
  { id: 'inv2', name: 'Embajador', desc: 'Invita a 25 personas', emoji: '🤝', type: 'invites', value: 25, rar: 'raro' },
  // Voice: tiempo conectado
  { id: 'vz1', name: 'Primera llamada', desc: 'Pasa 10 minutos en un canal de voz', emoji: '🎧', type: 'vmin', value: 10, rar: 'comun' },
  { id: 'vz2', name: 'Conversador', desc: 'Pasa 60 minutos en canales de voz', emoji: '🗨️', type: 'vmin', value: 60, rar: 'poco' },
  { id: 'vz3', name: 'Habitual de voz', desc: 'Pasa 600 minutos en canales de voz', emoji: '🔊', type: 'vmin', value: 600, rar: 'raro' },
  { id: 'vz4', name: 'Residente de voz', desc: 'Pasa 3,000 minutos en canales de voz', emoji: '🏠', type: 'vmin', value: 3000, rar: 'epico' },
  { id: 'vz5', name: 'Alma del servidor', desc: 'Pasa 12,000 minutos en canales de voz', emoji: '🔥', type: 'vmin', value: 12000, rar: 'legendario' },
  // Micrófono
  { id: 'mc1', name: 'Se escucha', desc: 'Enciende tu micrófono por primera vez', emoji: '🎤', type: 'micon', value: 1, rar: 'comun' },
  { id: 'mc2', name: 'Voz de oro', desc: 'Pasa 300 minutos con el micrófono encendido', emoji: '🥇', type: 'mic', value: 300, rar: 'raro' },
  // Cámara
  { id: 'cm1', name: 'Cara a cara', desc: 'Enciende tu cámara por primera vez', emoji: '📷', type: 'camon', value: 1, rar: 'poco' },
  { id: 'cm2', name: 'Frente a la cámara', desc: 'Pasa 60 minutos con la cámara encendida', emoji: '🎬', type: 'cam', value: 60, rar: 'raro' },
  { id: 'cm3', name: 'Estrella de cámara', desc: 'Pasa 600 minutos con la cámara encendida', emoji: '🌟', type: 'cam', value: 600, rar: 'epico' },
  // Transmisión
  { id: 'st1', name: 'Primer directo', desc: 'Transmite tu pantalla por primera vez', emoji: '📡', type: 'stron', value: 1, rar: 'comun' },
  { id: 'st2', name: 'Streamer', desc: 'Transmite 600 minutos en voz', emoji: '🎥', type: 'strm', value: 600, rar: 'poco', icon: 'camera', shape: 'hex' },
  { id: 'st3', name: 'Streamer pro', desc: 'Transmite 3,000 minutos en voz', emoji: '🏆', type: 'strm', value: 3000, rar: 'epico', icon: 'trophy', shape: 'hex' },
  // Lealtad: días en el servidor y antigüedad de la cuenta
  { id: 'lt1', name: 'Nuevo vecino', desc: 'Cumple 7 días en el servidor', emoji: '🏡', type: 'days', value: 7, rar: 'comun' },
  { id: 'lt2', name: 'Miembro del mes', desc: 'Cumple 30 días en el servidor', emoji: '📅', type: 'days', value: 30, rar: 'poco' },
  { id: 'lt3', name: 'Fiel al servidor', desc: 'Cumple 90 días en el servidor', emoji: '💜', type: 'days', value: 90, rar: 'raro' },
  { id: 'lt4', name: 'Un año juntos', desc: 'Cumple 365 días en el servidor', emoji: '🎂', type: 'days', value: 365, rar: 'epico' },
  { id: 'lt5', name: 'Dos años juntos', desc: 'Cumple 730 días en el servidor', emoji: '🏛️', type: 'days', value: 730, rar: 'legendario' },
  { id: 'dv', name: 'Discord Veteran', desc: 'Ten una cuenta de Discord de 1,825 días', emoji: '⏰', type: 'acct', value: 1825, rar: 'raro', icon: 'clock', shape: 'shield' },
];
function migAch(g) { // servidores ya existentes: conserva lo que había y añade el catálogo nuevo
  const base = defAch(), old = new Map(base.map(a => [a.id, a])), have = new Set((g.ach || []).map(a => a.id));
  g.ach = [...(g.ach || []).map(a => (old.has(a.id) ? { ...old.get(a.id), ...a } : a)), ...base.filter(a => !have.has(a.id))]; g.achv2 = true;
}
const G = id => {
  if (!DB[id]) DB[id] = { cfg: {}, users: {}, warns: {}, items: [], ach: defAch(), achv2: true, achfill: false, autoroles: [], levelroles: {},
    invrew: {}, wl: [], badwords: [], tickets: {}, invby: {} };
  const g = DB[id]; if (!g.achv2) migAch(g);
  return g;
};
const LVL_MSG = '{user} Has subido a **nivel {level}** ¡sigue activo en el servidor! ✨';
const LVL_OLD = '🎉 {user} subió al **nivel {level}**!';
const C = id => {
  const g = G(id);
  g.cfg = { color: '#5865F2', cur: '🪙', xprate: 15, lvlon: true, lvlmsg: LVL_MSG,
    warnlimit: 3, raidn: 5, raidsec: 10, sec: {}, logch: {}, logoff: [], tk: { max: 1, n: 0, emb: {} },
    v: {}, vemb: {}, inv: {}, wb: {}, bye: {}, ...g.cfg };
  if (g.cfg.lvlmsg === LVL_OLD) g.cfg.lvlmsg = LVL_MSG; // migra el mensaje antiguo al nuevo
  return g.cfg;
};
const U = (gid, uid) => (G(gid).users[uid] ??= { xp: 0, lvl: 0, coins: 0, bank: 0, msgs: 0, inv: 0, left: 0, fake: 0,
  bonus: 0, ach: [], items: {}, cd: {} });

/* ============================== HELPERS ============================== */
const R = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fn = n => Number(n).toLocaleString('es');
const need = l => 40 + 20 * l; // MÁS FÁCIL: nivel 1 = 40 XP, nivel 2 = 60 XP, nivel 10 = 240 XP...
const bar = (p, l = 14) => '█'.repeat(Math.round(p * l)) + '░'.repeat(l - Math.round(p * l));
const hex = s => (s && /^#?[0-9a-f]{6}$/i.test(s) ? parseInt(s.replace('#', ''), 16) : null);
const url = s => (s && /^https?:\/\//i.test(s) ? s : null);
const nl = s => s?.replace(/\\n/g, '\n');
const cd = (u, k, ms) => { const r = (u.cd[k] || 0) + ms - Date.now(); if (r > 0) return r; u.cd[k] = Date.now(); return 0; };
const when = ms => `<t:${Math.floor((Date.now() + ms) / 1000)}:R>`;
const fmt = (s, v) => s.replace(/{(\w+)}/g, (_, k) => v[k] ?? `{${k}}`);
const M = (i, u) => i.guild.members.fetch(u.id).catch(() => null);
const dm = (u, e) => u.send({ embeds: [e] }).catch(() => {});
const E = (gid, t, d, img) => {
  const e = new EmbedBuilder().setColor(C(gid).color).setTimestamp();
  if (t) e.setTitle(t); if (d) e.setDescription(d); if (url(img)) e.setImage(img); return e;
};
const say = (i, t, d, eph) => i.reply({ embeds: [E(i.guildId, t, d)], flags: eph ? 64 : undefined });
const ok = (i, d) => say(i, '✅ Listo', d);
const no = (i, d) => say(i, '❌ Error', d, true);
const hasRole = (m, id) => m.roles.cache.has(id);
const canTarget = (i, m) => m && (i.guild.ownerId === i.user.id || m.roles.highest.position < i.member.roles.highest.position);
const LOGT = ['general', 'mod', 'seguridad', 'verif', 'tickets', 'logros', 'sugerencias', 'reportes', 'invitaciones',
  'voz_mover', 'voz_desconexion', 'voz_mute', 'voz_sordo']; // los 4 últimos: un canal aparte para cada acción de voz
const LOGE = ['mensajes', 'miembros', 'roles', 'canales', 'voz', 'bans', 'voz_mover', 'voz_desconexion', 'voz_mute', 'voz_sordo'];
// Cada tipo de evento va a su propio canal (creados con /log servidor). Si ese canal no existe, se usa el de siempre.
const LOG_EVT = { miembros: 'entradas', mensajes: 'mensajes', bans: 'baneos', roles: 'roles', canales: 'canales', voz: 'voz', voz_mover: 'voz_mover', voz_desconexion: 'voz_desconexion', voz_mute: 'voz_mute', voz_sordo: 'voz_sordo' };
const LOG_TYPE = { seguridad: 'automod', mod: 'moderacion_general', verif: 'verificacion_miembros', tickets: 'tickets', invitaciones: 'invitaciones' };
function lg(gid, type, e, evt, key) {
  const cf = C(gid); if (evt && cf.logoff.includes(evt)) return;
  const k = key || (evt && LOG_EVT[evt]) || LOG_TYPE[type]; const id = (k && cf.logch[k]) || cf.logch[type] || cf.logch.general; if (!id) return;
  client.guilds.cache.get(gid)?.channels.cache.get(id)?.send({ embeds: [e] }).catch(err => console.warn(`[logs:${type}] no pude escribir en ${id}: ${err.message}`));
}
async function gif(t) {
  try { const r = await fetch(`https://nekos.best/api/v2/${t}`); return (await r.json()).results[0].url; } catch { return null; }
}

/* ===================== REGISTRO DE COMANDOS (150) ===================== */
const CATS = {};
function def(cat, name, desc, spec, perm, run) {
  (CATS[cat] ??= {})[name] = { desc, perm, run,
    spec: spec ? spec.split(',').map(x => { const m = x.match(/^(\w+):(\w)(!?)$/); return { n: m[1], t: m[2], r: !!m[3] }; }) : [] };
}
const OT = { s: 'addStringOption', i: 'addIntegerOption', u: 'addUserOption', c: 'addChannelOption', r: 'addRoleOption', b: 'addBooleanOption' };
const GET = { s: 'getString', i: 'getInteger', u: 'getUser', c: 'getChannel', r: 'getRole', b: 'getBoolean' };
const CHO = { // opciones con lista cerrada, por 'módulo.opción'
  'logro.tipo': [['Mensajes enviados', 'msgs'], ['Nivel', 'lvl'], ['Monedas', 'coins'], ['Invitaciones', 'invites'], ['Minutos en voz', 'vmin'], ['Minutos con micrófono encendido', 'mic'],
    ['Veces que enciende el micrófono', 'micon'], ['Minutos con cámara', 'cam'], ['Veces que enciende la cámara', 'camon'], ['Minutos transmitiendo', 'strm'],
    ['Veces que transmite', 'stron'], ['Días en el servidor', 'days'], ['Antigüedad de la cuenta (días)', 'acct']],
  'logro.rareza': [['Común', 'comun'], ['Poco común', 'poco'], ['Raro', 'raro'], ['Épico', 'epico'], ['Legendario', 'legendario']],
  'logro.icono': [['Reloj', 'clock'], ['Cámara', 'camera'], ['Micrófono', 'mic'], ['Pantalla', 'screen'], ['Calendario', 'calendar'], ['Chat', 'chat'], ['Estrella', 'star'], ['Moneda', 'coin'], ['Sobre', 'mail'], ['Trofeo', 'trophy']],
  'logro.forma': [['Escudo', 'shield'], ['Hexágono', 'hex'], ['Círculo', 'circle']],
  'bienvenida.evento': [['Bienvenida', 'bienvenida'], ['Despedida', 'despedida']],
  'limpiar.filtro': [['Todos los mensajes', 'todos'], ['Solo de bots', 'bots'], ['Solo de personas', 'humanos'], ['Con enlaces', 'enlaces'], ['Con archivos', 'archivos'], ['Con embeds', 'embeds']],
  'limpiar.modo': [['Borrar mensajes recientes (conserva el canal)', 'mensajes'], ['Reiniciar el canal (borra TODO)', 'canal']],
  'invite.suceso': [['Entrada de miembro', 'entrada'], ['Salida de miembro', 'salida'], ['Invitación creada', 'creada'], ['Invitación eliminada/agotada', 'borrada'], ['Recompensa de rol', 'recompensa'], ['Ajuste de admin', 'admin']],
  'verif.modo': [['Botón (instantáneo)', 'boton'], ['Código (modal)', 'codigo'], ['Captcha (operación matemática)', 'captcha']],
};
require('./extras')({ client, DB, def, G, save });
const ROOT = new Set(['work', 'daily', 'truco-trato']); // comandos sin subcomando: /work, /daily y /truco-trato
const build = () => Object.entries(CATS).map(([cat, subs]) => {
  if (ROOT.has(cat)) { const rb = new SlashCommandBuilder().setName(cat).setDescription(subs.run.desc.slice(0, 100));
    [...(subs.run.spec || [])].sort((a, b) => b.r - a.r).forEach(o => rb[OT[o.t]](x => { x.setName(o.n).setDescription(o.n).setRequired(o.r); if (o.t === 'c') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement); return x; }));
    return rb.toJSON(); }
  const b = new SlashCommandBuilder().setName(cat).setDescription(`Módulo ${cat}`);
  for (const [n, c] of Object.entries(subs)) b.addSubcommand(s => {
    s.setName(n).setDescription(c.desc.slice(0, 100));
    [...c.spec].sort((a, b) => b.r - a.r).forEach(o => s[OT[o.t]](x => {
      x.setName(o.n).setDescription(o.n).setRequired(o.r);
      if (cat === 'ticket' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'verif' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement); // solo canales de texto
      if (cat === 'limpiar' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'stats' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildVoice);
      if (cat === 'stats' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'estado' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'estado' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
      if (cat === 'estado' && o.n === 'texto') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'voz' && o.n === 'disparador') x.addChannelTypes?.(ChannelType.GuildVoice);
      if (cat === 'voz' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'voz' && o.n === 'panel') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'application' && ['canal', 'canal_logs'].includes(o.n)) x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      const ch = CHO[`${cat}.${o.n}`]; if (ch) x.addChoices(...ch.map(([name, value]) => ({ name, value })));
      return x;
    }));
    return s;
  });
  return b.toJSON();
});

/* =========================== 1. VERIFICACIÓN (8) =========================== */
// Comprueba que el bot pueda publicar el panel en un canal (texto + permisos necesarios)
const chIssue = (guild, ch) => {
  if (!ch) return 'el canal ya no existe';
  if (!ch.isTextBased?.() || ch.isThread?.() || ch.isVoiceBased?.()) return 'no es un canal de texto';
  const need = [P.ViewChannel, P.SendMessages, P.EmbedLinks], miss = need.filter(p => !ch.permissionsFor(guild.members.me)?.has(p));
  const names = { [P.ViewChannel]: 'Ver canal', [P.SendMessages]: 'Enviar mensajes', [P.EmbedLinks]: 'Insertar enlaces' };
  return miss.length ? `al bot le falta en ese canal: **${miss.map(p => names[p]).join(', ')}**` : null;
};
def('verif', 'setup', 'Configura canal, rol y modo (boton|codigo|captcha)', 'canal:c!,rol:r!,modo:s', 'Administrator', (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`);
  const ri = roleIssue(i.guild, o.rol); if (ri) return no(i, `No puedo dar ${o.rol}: ${ri}.`);
  cf.v = { ch: o.canal.id, role: o.rol.id, mode: ['codigo', 'captcha'].includes(o.modo) ? o.modo : 'boton' }; save();
  ok(i, `Canal: ${o.canal}\nRol: ${o.rol}\nModo: **${cf.v.mode}**\n\nAhora usa \`/verif panel\`.`);
});
def('verif', 'embed', 'Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie, botón', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s', 'Administrator', (i, o, g, cf) => {
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  cf.vemb = { ...cf.vemb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie, btn: o.boton }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete cf.vemb[key];
  save(); ok(i, 'Embed de verificación actualizado. Usa `/verif panel` para publicarlo (los paneles ya publicados no cambian).');
});
// Botón de verificación personalizable: texto, color (Discord solo tiene 4: gris, verde, rojo, azul) e icono (emoji).
// Un botón no puede llevar una imagen suelta; el icono es un emoji. Con `foto` el bot crea un emoji del servidor a partir de la imagen.
CHO['verif.estilo'] = [['Gris (transparente)', 'gris'], ['Verde', 'verde'], ['Rojo', 'rojo'], ['Azul', 'azul']];
const VSTY = { gris: ButtonStyle.Secondary, verde: ButtonStyle.Success, rojo: ButtonStyle.Danger, azul: ButtonStyle.Primary };
const vBtn = v => {
  const b = new ButtonBuilder().setCustomId('verif').setStyle(VSTY[v.style] ?? ButtonStyle.Success);
  if (v.emoji) b.setEmoji(tkEmoji(v.emoji));
  if (v.btn !== '' || !v.emoji) b.setLabel(String(v.btn || 'Verificarme').slice(0, 80));
  return b;
};
def('verif', 'boton', 'Personaliza el botón: texto, color (gris/verde/rojo/azul) e icono (emoji o foto)', 'texto:s,estilo:s,emoji:s,foto:s,nombrefoto:s', 'Administrator', async (i, o, g, cf) => {
  const v = (cf.vemb ??= {}), NO = /^(ninguno|ninguna|quitar)$/i;
  if (o.emoji && !NO.test(o.emoji) && !tkEmojiOk(o.emoji)) return no(i, '`emoji` debe ser **un solo emoji** (o uno personalizado del servidor, como `<:nombre:123>`). Para usar una imagen tuya usa `foto`.');
  if (o.foto && !url(o.foto)) return no(i, '`foto` debe ser un enlace `http(s)` directo a una imagen (PNG, JPG o GIF de menos de 256 KB).');
  if (o.texto && NO.test(o.texto) && !o.emoji && !o.foto && !v.emoji) return no(i, 'Para dejar el botón sin texto necesita un icono: indica `emoji` o `foto`.');
  const dropOwn = async () => { if (v.own) { await i.guild.emojis.cache.get(v.own)?.delete('Icono del botón de verificación reemplazado').catch(() => {}); delete v.own; } };
  await i.deferReply({ flags: 64 });
  if (o.estilo) v.style = o.estilo;
  if (o.texto) v.btn = NO.test(o.texto) ? '' : o.texto.slice(0, 80);
  if (o.emoji) { await dropOwn(); if (NO.test(o.emoji)) delete v.emoji; else v.emoji = o.emoji.trim(); }
  if (o.foto) {
    if (!i.guild.members.me.permissions.has(P.ManageGuildExpressions ?? P.ManageEmojisAndStickers)) { save(); return i.editReply({ embeds: [E(i.guildId, '❌ Error', 'Para crear el icono el bot necesita el permiso **Gestionar emojis y stickers**. Dáselo, o sube tú la imagen como emoji del servidor y pásala en `emoji`.')] }); }
    const name = (o.nombrefoto || 'verificar').replace(/\W/g, '').slice(0, 32).padEnd(2, '_');
    try {
      const em = await i.guild.emojis.create({ attachment: o.foto, name, reason: `Icono del botón de verificación (${i.user.tag})` });
      await dropOwn(); v.emoji = `<${em.animated ? 'a' : ''}:${em.name}:${em.id}>`; v.own = em.id;
    } catch (err) { save(); return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear el emoji con esa imagen: ${err.message}\nDebe ser PNG, JPG o GIF de menos de 256 KB y el servidor debe tener espacio para emojis.`)] }); }
  }
  save();
  let prev; try { prev = [new ActionRowBuilder().addComponents(vBtn(v).setDisabled(true))]; } catch { prev = []; }
  i.editReply({ embeds: [E(i.guildId, '✅ Botón actualizado', `🎨 Color: **${v.style || 'verde'}**\n🔤 Texto: **${v.btn === '' ? '(solo icono)' : v.btn || 'Verificarme'}**\n🖼️ Icono: ${v.emoji || '—'}\n\nAsí se verá ↓ Publícalo con \`/verif panel\` (los paneles ya enviados no cambian).`)], components: prev });
});
def('verif', 'panel', 'Envía el panel de verificación', '', 'Administrator', async (i, o, g, cf) => {
  if (!cf.v?.ch || !cf.v?.role) return no(i, 'Primero configura la verificación con `/verif setup`.');
  const ch = i.guild.channels.cache.get(cf.v.ch) ?? await i.guild.channels.fetch(cf.v.ch).catch(() => null);
  const ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo enviar el panel: ${ci}.\nUsa \`/verif setup\` con un canal válido.`);
  const ri = roleIssue(i.guild, i.guild.roles.cache.get(cf.v.role)); if (ri) return no(i, `El rol de verificación no es válido: ${ri}.\nUsa \`/verif setup\` de nuevo.`);
  await i.deferReply({ flags: 64 });
  try {
    const v = cf.vemb || {};
    const e = E(i.guildId, v.title || '✅ Verificación', v.desc || 'Pulsa el botón para verificarte y acceder al servidor.', v.img);
    if (Number.isInteger(v.color)) e.setColor(v.color); if (url(v.thumb)) e.setThumbnail(v.thumb); if (v.footer) e.setFooter({ text: String(v.footer).slice(0, 2048) });
    const embeds = [e]; if (url(v.banner)) embeds.unshift(new EmbedBuilder().setColor(Number.isInteger(v.color) ? v.color : cf.color).setImage(v.banner)); // banner de arriba, aparte
    const btn = vBtn(v);
    await ch.send({ embeds, components: [new ActionRowBuilder().addComponents(btn)] });
  } catch (err) {
    console.error('verif panel:', err);
    return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude enviar el panel en ${ch}:\n\`${err.message}\``)] });
  }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Panel enviado en ${ch}`)] });
});
// Puntaje de riesgo: solo señales públicas (antigüedad de cuenta, avatar por defecto, intentos fallidos,
// velocidad de respuesta). Nunca incluye IP ni ubicación: Discord no entrega esos datos a los bots, y aunque
// los entregara, registrar la IP de alguien sin su conocimiento real es doxxing y no se implementa aquí.
function riskScore(user, extra = {}) {
  const ageDays = (Date.now() - user.createdTimestamp) / 864e5;
  let score = 0; const reasons = [];
  if (ageDays < 1) { score += 40; reasons.push('🕒 Cuenta creada hace menos de 1 día'); }
  else if (ageDays < 7) { score += 25; reasons.push('🕒 Cuenta creada hace menos de 7 días'); }
  else if (ageDays < 30) { score += 10; reasons.push('🕒 Cuenta creada hace menos de 30 días'); }
  if (!user.avatar) { score += 15; reasons.push('🖼️ Usa el avatar por defecto'); }
  if (extra.fails) { score += Math.min(30, extra.fails * 15); reasons.push(`❌ ${extra.fails} intento(s) fallido(s)`); }
  if (extra.ms != null && extra.ms < 2000) { score += 20; reasons.push('⚡ Respondió en menos de 2s (posible bot)'); }
  return { score: Math.min(100, score), reasons };
}
// Log de verificación: quién, cómo, cuándo, antigüedad de la cuenta y puntaje de riesgo (sin datos privados
// como IP o ubicación, que Discord no entrega a los bots)
async function vlog(guild, user, title, method, extra, risk) {
  const cf = C(guild.id), id = cf.logch.verif || cf.logch.general;
  if (!id) return console.warn('[logs:verif] no hay canal de logs configurado (usa /log servidor)');
  const ch = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null), ci = chIssue(guild, ch);
  if (ci) return console.warn(`[logs:verif] canal ${id} inválido: ${ci}`);
  const mem = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
  const e = E(guild.id, title).setThumbnail(user.displayAvatarURL()).addFields(
    { name: '👤 Usuario', value: `${user} (\`${user.tag}\`)`, inline: true },
    { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
    { name: '🔐 Método', value: method, inline: true },
    { name: '📅 Cuenta creada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    { name: '📥 Entró al servidor', value: mem?.joinedTimestamp ? `<t:${Math.floor(mem.joinedTimestamp / 1000)}:R>` : '—', inline: true },
    { name: '🕒 Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });
  if (extra) e.addFields({ name: 'ℹ️ Detalle', value: String(extra).slice(0, 1024) });
  if (risk) {
    e.addFields({ name: '⚠️ Riesgo', value: `**${risk.score}/100**\n${risk.reasons.join('\n') || 'Sin señales de riesgo'}` });
    if (risk.score >= 50) e.setColor('#ED4245'); else if (risk.score >= 25) e.setColor('#FEE75C');
  }
  await ch.send({ embeds: [e] }).catch(err => console.warn(`[logs:verif] error al enviar: ${err.message}`));
}
def('verif', 'estado', 'Ver configuración de verificación', '', 'Administrator', (i, o, g, cf) => {
  const v = cf.v; say(i, '📋 Verificación', v.ch ? `Canal: <#${v.ch}>\nRol: <@&${v.role}>\nModo: **${v.mode}**\nLogs: ${cf.logch.verif ? `<#${cf.logch.verif}>` : 'no configurado'}` : 'No configurada.');
});
def('verif', 'manual', 'Verifica manualmente a un usuario', 'usuario:u!', 'ManageRoles', async (i, o, g, cf) => {
  const m = await M(i, o.usuario); if (!m || !cf.v.role) return no(i, 'Usuario o rol no válido.');
  await m.roles.add(cf.v.role); await vlog(i.guild, o.usuario, '✅ Verificación manual', 'Manual', `Por ${i.user}`); ok(i, `${m} verificado.`);
});
def('verif', 'quitar', 'Quita la verificación a un usuario', 'usuario:u!', 'ManageRoles', async (i, o, g, cf) => {
  const m = await M(i, o.usuario); if (!m || !cf.v.role) return no(i, 'Usuario o rol no válido.');
  await m.roles.remove(cf.v.role); await vlog(i.guild, o.usuario, '🚫 Verificación quitada', 'Manual', `Por ${i.user}`); ok(i, `Verificación quitada a ${m}.`);
});
def('verif', 'desactivar', 'Desactiva el sistema de verificación', '', 'Administrator', (i, o, g, cf) => { cf.v = {}; save(); ok(i, 'Verificación desactivada.'); });

const VC = new Map(); // uid -> { code, attempts, start }  (modo código)
const CC = new Map(); // uid -> { ans, attempts, start }   (modo captcha)
async function verifButton(i) {
  const cf = C(i.guildId), v = cf.v; if (!v.role) return no(i, 'Verificación no configurada.');
  if (hasRole(i.member, v.role)) return no(i, 'Ya estás verificado.');
  const ri = roleIssue(i.guild, i.guild.roles.cache.get(v.role));
  if (ri) { await vlog(i.guild, i.user, '⚠️ Verificación con problemas', 'Botón', `No puedo dar <@&${v.role}>: ${ri}`); return no(i, 'La verificación está mal configurada. Avisa a un administrador.'); }
  if (v.mode === 'codigo') {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase(); VC.set(i.user.id, { code, attempts: 0, start: Date.now() });
    return i.reply({ flags: 64, embeds: [E(i.guildId, '🔐 Código de verificación', `Tu código es:\n\`\`\`${code}\`\`\`\nTienes **3 intentos** y **5 minutos**.`)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verif_enter').setLabel('Introducir código').setStyle(ButtonStyle.Primary))] });
  }
  if (v.mode === 'captcha') {
    const a = rnd(1, 9), b = rnd(1, 9), op = R(['+', '-']), ans = op === '+' ? a + b : a - b;
    CC.set(i.user.id, { ans, attempts: 0, start: Date.now() });
    return i.reply({ flags: 64, embeds: [E(i.guildId, '🧮 Verificación', `Resuelve la operación y pulsa el botón para responder:\n\n**${a} ${op} ${b} = ?**\n\nTienes **3 intentos** y **2 minutos**.`)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verif_captcha_enter').setLabel('Responder').setStyle(ButtonStyle.Primary))] });
  }
  await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Botón', null, riskScore(i.user));
  i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
}

/* ============================ 2. SEGURIDAD (18) ============================ */
const SEC = [['antilink', 'link', 'Bloquea enlaces'], ['antiinvite', 'invite', 'Bloquea invitaciones de Discord'],
  ['antispam', 'spam', 'Anti-spam de mensajes'], ['anticaps', 'caps', 'Bloquea exceso de mayúsculas'],
  ['antimencion', 'mention', 'Bloquea menciones masivas'], ['antibadwords', 'badwords', 'Filtro de palabras prohibidas'],
  ['antibots', 'bots', 'Expulsa bots no permitidos'], ['antiraid', 'raid', 'Protección anti-raid'], ['antinuke', 'nuke', 'Protección anti-nuke']];
for (const [name, key, desc] of SEC) def('seg', name, desc, 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.sec[key] = o.estado; save(); ok(i, `**${name}** ${o.estado ? 'activado ✅' : 'desactivado ❌'}`); });
def('seg', 'estado', 'Estado de toda la seguridad', '', 'Administrator', (i, o, g, cf) => {
  const s = cf.sec; say(i, '🛡️ Seguridad del servidor', SEC.map(([n, k]) => `${s[k] ? '🟢' : '🔴'} ${n}`).join('\n') +
    `\n\n🕒 Edad mínima de cuenta: **${cf.minage || 0}** días\n⚡ Raid: **${cf.raidn}** entradas en **${cf.raidsec}s**\n📃 Palabras prohibidas: **${g.badwords.length}**\n✅ Whitelist: **${g.wl.length}**`);
});
def('seg', 'badwordadd', 'Añade palabra prohibida', 'palabra:s!', 'Administrator', (i, o, g) => { g.badwords.push(o.palabra.toLowerCase()); save(); ok(i, 'Palabra añadida.'); });
def('seg', 'badwordremove', 'Quita palabra prohibida', 'palabra:s!', 'Administrator', (i, o, g) => { g.badwords = g.badwords.filter(w => w !== o.palabra.toLowerCase()); save(); ok(i, 'Palabra eliminada.'); });
def('seg', 'minage', 'Edad mínima de cuenta en días (0=off)', 'dias:i!', 'Administrator', (i, o, g, cf) => { cf.minage = o.dias; save(); ok(i, `Edad mínima: **${o.dias}** días.`); });
def('seg', 'wladd', 'Añade usuario o rol a la whitelist', 'usuario:u,rol:r', 'Administrator', (i, o, g) => { const id = o.usuario?.id || o.rol?.id; if (!id) return no(i, 'Indica usuario o rol.'); if (!g.wl.includes(id)) g.wl.push(id); save(); ok(i, 'Añadido a la whitelist.'); });
def('seg', 'wlremove', 'Quita usuario o rol de la whitelist', 'usuario:u,rol:r', 'Administrator', (i, o, g) => { const id = o.usuario?.id || o.rol?.id; g.wl = g.wl.filter(x => x !== id); save(); ok(i, 'Quitado de la whitelist.'); });
def('seg', 'raidconfig', 'Configura umbral anti-raid', 'entradas:i!,segundos:i!', 'Administrator', (i, o, g, cf) => { cf.raidn = o.entradas; cf.raidsec = o.segundos; save(); ok(i, `Raid si entran **${o.entradas}** en **${o.segundos}s**.`); });
async function lockAll(guild, state) {
  for (const ch of guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values())
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: state ? false : null }, { reason: 'Lockdown' }).catch(() => {});
}
def('seg', 'lockdown', 'Bloquea todos los canales del servidor', '', 'Administrator', async (i) => {
  await i.deferReply(); await lockAll(i.guild, true); lg(i.guildId, 'seguridad', E(i.guildId, '🔒 LOCKDOWN', `Activado por ${i.user}`));
  i.editReply({ embeds: [E(i.guildId, '🔒 Servidor en lockdown', 'Todos los canales de texto bloqueados.')] });
});
def('seg', 'unlockdown', 'Desbloquea todos los canales', '', 'Administrator', async (i) => {
  await i.deferReply(); await lockAll(i.guild, false); lg(i.guildId, 'seguridad', E(i.guildId, '🔓 Lockdown desactivado', `Por ${i.user}`));
  i.editReply({ embeds: [E(i.guildId, '🔓 Lockdown desactivado', 'Canales restaurados.')] });
});

const SP = new Map(), JN = new Map(), NK = new Map();
async function automod(m, cf, g) {
  const s = cf.sec, t = m.content;
  if (m.member.permissions.has(P.ManageMessages) || g.wl.includes(m.author.id) || m.member.roles.cache.some(r => g.wl.includes(r.id))) return false;
  let why = null;
  if (s.spam) {
    const k = m.guildId + m.author.id, a = (SP.get(k) || []).filter(x => Date.now() - x < 5000); a.push(Date.now()); SP.set(k, a);
    if (a.length >= 6) { why = 'Spam'; m.member.timeout(5 * 60000, 'AntiSpam').catch(() => {}); SP.delete(k); }
  }
  if (!why && s.invite && /(discord\.gg|discord(app)?\.com\/invite)\/\S+/i.test(t)) why = 'Invitaciones no permitidas';
  if (!why && s.link && /https?:\/\/\S+/i.test(t)) why = 'Enlaces no permitidos';
  if (!why && s.badwords && g.badwords.some(w => t.toLowerCase().includes(w))) why = 'Lenguaje prohibido';
  if (!why && s.caps) { const l = t.replace(/[^A-Za-z]/g, '').length; if (t.length >= 10 && l && t.replace(/[^A-Z]/g, '').length / l > 0.7) why = 'Exceso de mayúsculas'; }
  if (!why && s.mention && m.mentions.users.size + m.mentions.roles.size >= 5) why = 'Menciones masivas';
  if (!why) return false;
  m.delete().catch(() => {});
  m.channel.send({ embeds: [E(m.guildId, '🛡️ AutoMod', `${m.author}, tu mensaje fue eliminado: **${why}**`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 5000)).catch(() => {});
  lg(m.guildId, 'seguridad', E(m.guildId, '🛡️ AutoMod', `**Usuario:** ${m.author} (${m.author.id})\n**Canal:** ${m.channel}\n**Motivo:** ${why}\n**Mensaje:** ${t.slice(0, 500)}`));
  return true;
}
async function nuke(guild, type) {
  if (!C(guild.id).sec.nuke) return;
  const log = (await guild.fetchAuditLogs({ type, limit: 1 }).catch(() => null))?.entries.first();
  if (!log || Date.now() - log.createdTimestamp > 5000) return;
  const ex = log.executor; if (!ex || ex.id === client.user.id || ex.id === guild.ownerId || G(guild.id).wl.includes(ex.id)) return;
  const k = guild.id + ex.id, a = (NK.get(k) || []).filter(t => Date.now() - t < 10000); a.push(Date.now()); NK.set(k, a);
  if (a.length >= 3) {
    const m = await guild.members.fetch(ex.id).catch(() => null);
    if (m?.bannable) { await m.ban({ reason: 'AntiNuke: acciones destructivas masivas' }); lg(guild.id, 'seguridad', E(guild.id, '☢️ ANTI-NUKE', `**${ex.tag}** baneado por acciones destructivas masivas.`), null, 'defensa'); }
  }
}

/* ============================ 3. MODERACIÓN (21) ============================ */
function modlog(i, type, u, reason) {
  const _e = E(i.guildId, `🔨 ${type}`).addFields({ name: 'Usuario', value: `${u} (${u.id})`, inline: true }, { name: 'Moderador', value: `${i.user}`, inline: true }, { name: 'Razón', value: reason || 'Sin razón' });
  if (type === 'Warn') lg(i.guildId, 'mod', _e, null, 'advertencias');
  lg(i.guildId, 'mod', E(i.guildId, `🔨 ${type}`).addFields({ name: 'Usuario', value: `${u} (${u.id})`, inline: true },
    { name: 'Moderador', value: `${i.user}`, inline: true }, { name: 'Razón', value: reason || 'Sin razón' }));
}
def('mod', 'ban', 'Banea a un usuario', 'usuario:u!,razon:s,dias:i', 'BanMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (m && (!canTarget(i, m) || !m.bannable)) return no(i, 'No puedo o no puedes banear a ese usuario.');
  await dm(o.usuario, E(i.guildId, '🔨 Has sido baneado', `Servidor: **${i.guild.name}**\nRazón: ${o.razon || 'Sin razón'}`));
  await i.guild.members.ban(o.usuario, { reason: o.razon, deleteMessageSeconds: Math.min(o.dias || 0, 7) * 86400 });
  modlog(i, 'Ban', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** baneado.`);
});
def('mod', 'unban', 'Desbanea por ID', 'id:s!,razon:s', 'BanMembers', async (i, o) => {
  const u = await i.guild.members.unban(o.id, o.razon).catch(() => null); if (!u) return no(i, 'ID no baneada.');
  modlog(i, 'Unban', u, o.razon); ok(i, `**${u.tag}** desbaneado.`);
});
def('mod', 'kick', 'Expulsa a un usuario', 'usuario:u!,razon:s', 'KickMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.kickable) return no(i, 'No se puede expulsar a ese usuario.');
  await dm(o.usuario, E(i.guildId, '👢 Expulsado', `Servidor: **${i.guild.name}**\nRazón: ${o.razon || 'Sin razón'}`));
  await m.kick(o.razon); modlog(i, 'Kick', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** expulsado.`);
});
def('mod', 'softban', 'Ban + unban para borrar mensajes', 'usuario:u!,razon:s', 'BanMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.bannable) return no(i, 'No se puede.');
  await i.guild.members.ban(o.usuario, { reason: 'Softban: ' + (o.razon || ''), deleteMessageSeconds: 86400 }); await i.guild.members.unban(o.usuario.id);
  modlog(i, 'Softban', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** softbaneado.`);
});
def('mod', 'timeout', 'Aísla temporalmente a un usuario', 'usuario:u!,minutos:i!,razon:s', 'ModerateMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.moderatable) return no(i, 'No se puede aislar a ese usuario.');
  await m.timeout(Math.min(o.minutos, 40320) * 60000, o.razon); modlog(i, `Timeout ${o.minutos}m`, o.usuario, o.razon); ok(i, `${o.usuario} aislado **${o.minutos}** min.`);
});
def('mod', 'untimeout', 'Quita el aislamiento', 'usuario:u!', 'ModerateMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m) return no(i, 'Usuario no encontrado.'); await m.timeout(null); modlog(i, 'Untimeout', o.usuario); ok(i, `${o.usuario} ya puede hablar.`);
});
def('mod', 'warn', 'Advierte a un usuario', 'usuario:u!,razon:s!', 'ModerateMembers', async (i, o, g, cf) => {
  const w = (g.warns[o.usuario.id] ??= []); w.push({ mod: i.user.id, reason: o.razon, date: Date.now() }); save();
  await dm(o.usuario, E(i.guildId, '⚠️ Advertencia', `Servidor: **${i.guild.name}**\nRazón: ${o.razon}\nAdvertencias: **${w.length}/${cf.warnlimit}**`));
  modlog(i, 'Warn', o.usuario, o.razon);
  if (w.length >= cf.warnlimit) { const m = await M(i, o.usuario); m?.timeout(86400000, 'Límite de warns').catch(() => {}); }
  ok(i, `${o.usuario} advertido (**${w.length}/${cf.warnlimit}**).`);
});
def('mod', 'warns', 'Ver advertencias de un usuario', 'usuario:u!', 'ModerateMembers', (i, o, g) => {
  const w = g.warns[o.usuario.id] || []; say(i, `⚠️ Warns de ${o.usuario.tag}`, w.length ? w.map((x, n) => `**${n + 1}.** ${x.reason} — <@${x.mod}> <t:${Math.floor(x.date / 1000)}:d>`).join('\n') : 'Sin advertencias.');
});
def('mod', 'delwarn', 'Elimina una advertencia', 'usuario:u!,numero:i!', 'ModerateMembers', (i, o, g) => {
  const w = g.warns[o.usuario.id] || []; if (!w[o.numero - 1]) return no(i, 'Número inválido.'); w.splice(o.numero - 1, 1); save(); ok(i, 'Advertencia eliminada.');
});
def('mod', 'clearwarns', 'Borra todas las advertencias', 'usuario:u!', 'ModerateMembers', (i, o, g) => { delete g.warns[o.usuario.id]; save(); ok(i, 'Advertencias borradas.'); });
def('mod', 'purge', 'Borra mensajes (máx 100)', 'cantidad:i!,usuario:u', 'ManageMessages', async (i, o) => {
  await i.deferReply({ flags: 64 }); let ms = await i.channel.messages.fetch({ limit: 100 });
  if (o.usuario) ms = ms.filter(m => m.author.id === o.usuario.id); const d = await i.channel.bulkDelete([...ms.values()].slice(0, Math.min(o.cantidad, 100)), true);
  lg(i.guildId, 'mod', E(i.guildId, '🧹 Purge', `${i.user} borró **${d.size}** mensajes en ${i.channel}`)); i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${d.size}** mensajes borrados.`)] });
});
def('mod', 'lock', 'Bloquea un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { SendMessages: false }); ok(i, `🔒 ${c} bloqueado.`); });
def('mod', 'unlock', 'Desbloquea un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { SendMessages: null }); ok(i, `🔓 ${c} desbloqueado.`); });
def('mod', 'slowmode', 'Modo lento (segundos)', 'segundos:i!,canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.setRateLimitPerUser(Math.min(o.segundos, 21600)); ok(i, `Modo lento de ${c}: **${o.segundos}s**`); });
def('mod', 'nick', 'Cambia el apodo de un usuario', 'usuario:u!,apodo:s', 'ManageNicknames', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !m.manageable) return no(i, 'No puedo cambiar ese apodo.'); await m.setNickname(o.apodo || null); ok(i, `Apodo de ${m} actualizado.`);
});
def('mod', 'addrole', 'Da un rol a un usuario', 'usuario:u!,rol:r!', 'ManageRoles', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || o.rol.position >= i.member.roles.highest.position && i.guild.ownerId !== i.user.id) return no(i, 'Jerarquía insuficiente.'); await m.roles.add(o.rol); ok(i, `${o.rol} añadido a ${m}.`);
});
def('mod', 'removerole', 'Quita un rol a un usuario', 'usuario:u!,rol:r!', 'ManageRoles', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || o.rol.position >= i.member.roles.highest.position && i.guild.ownerId !== i.user.id) return no(i, 'Jerarquía insuficiente.'); await m.roles.remove(o.rol); ok(i, `${o.rol} quitado a ${m}.`);
});
def('mod', 'hide', 'Oculta un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { ViewChannel: false }); ok(i, `${c.name} oculto.`); });
def('mod', 'unhide', 'Muestra un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { ViewChannel: null }); ok(i, `${c} visible.`); });
def('mod', 'banlist', 'Lista de baneados', '', 'BanMembers', async (i) => {
  const b = await i.guild.bans.fetch(); say(i, `🔨 Baneados (${b.size})`, b.size ? b.first(25).map(x => `**${x.user.tag}** \`${x.user.id}\` — ${x.reason || 'Sin razón'}`).join('\n') : 'Nadie baneado.');
});
def('mod', 'warnlimit', 'Límite de warns antes de timeout', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.warnlimit = Math.max(1, o.cantidad); save(); ok(i, `Límite: **${cf.warnlimit}** warns (timeout de 24h).`); });

/* ============================== 4. LOG (1) · /log servidor ============================== */
// Un solo comando: crea TODOS los canales de log (uno por evento) y los configura solos.
// [categoría, [nombre, clave, descripción, publico?]]
const LOG_CANALES = [
  ['📜 LOGS', [
    ['Bienvenida', 'bienvenida', 'Bienvenidas enviadas a los nuevos miembros'],
    ['Entradas', 'entradas', 'Miembros que entran al servidor'], ['Salidas', 'salidas', 'Miembros que salen del servidor'],
    ['Perfil Acceso', 'perfil_acceso', 'Cambios de perfil y acceso de miembros'], ['Apodos', 'apodos', 'Cambios de apodo'],
    ['Roles', 'roles', 'Roles creados, eliminados o asignados'], ['Mensajes', 'mensajes', 'Mensajes borrados y editados'],
    ['Reacciones', 'reacciones', 'Reacciones a mensajes'], ['Encuestas', 'encuestas', 'Encuestas del servidor'],
    ['Hilos', 'hilos', 'Hilos creados y eliminados'], ['Voz', 'voz', 'Entradas y salidas de canales de voz'],
    ['Streams', 'streams', 'Transmisiones y cámara'], ['Eventos', 'eventos', 'Eventos programados'],
    ['Invitaciones', 'invitaciones', 'Invitaciones creadas y usadas'], ['Canales', 'canales', 'Canales creados y eliminados'],
    ['Permisos', 'permisos', 'Cambios de permisos'], ['Servidor', 'servidor', 'Cambios de configuración del servidor'],
    ['Webhooks', 'webhooks', 'Webhooks'], ['Integraciones', 'integraciones', 'Integraciones del servidor'],
    ['Emojis Y Stickers', 'emojis', 'Emojis y stickers'], ['Automod De Discord', 'automod', 'AutoMod y filtro de palabras'],
    ['Timeout', 'timeout', 'Timeouts de miembros'], ['Expulsiones', 'expulsiones', 'Expulsiones'],
    ['Baneos', 'baneos', 'Baneos y desbaneos'], ['Advertencias', 'advertencias', 'Advertencias de moderación'],
    ['Moderación General', 'moderacion_general', 'Acciones de moderación'], ['Defensa Mundial', 'defensa', 'Anti-raid y bloqueos de emergencia'],
    ['Tickets', 'tickets', 'Tickets abiertos y cerrados'], ['Solicitudes', 'solicitudes', 'Solicitudes y postulaciones'],
    ['Sentinel Config', 'sentinel', 'Cambios de configuración de seguridad'],
  ]],
  ['🛡️ SEGURIDAD', [
    ['Blacklist', 'blacklist', 'Usuarios en lista negra'], ['Blacklist Compartida', 'blacklist_compartida', 'Listas compartidas'],
    ['Anti Alt Señales', 'anti_alt', 'Cuentas nuevas o sospechosas'], ['Evasión', 'evasion', 'Intentos de evadir sanciones'],
    ['Alertas De Incorporate', 'alertas_incorporate', 'Alertas al entrar miembros'], ['Verificación De Miembros', 'verificacion_miembros', 'Verificación de nuevos miembros'],
    ['Captcha', 'captcha', 'Captchas de verificación'], ['Cuarentena', 'cuarentena', 'Miembros en cuarentena'],
    ['Apelaciones', 'apelaciones', 'Apelaciones de sanciones'],
  ]],
  ['🎙️ LOGS DE VOZ', [
    ['Mover De Canal', 'voz_mover', 'Staff que mueve a alguien de canal de voz'], ['Desconexiones', 'voz_desconexion', 'Staff que desconecta a alguien'],
    ['Mutes', 'voz_mute', 'Staff que mutea a alguien'], ['Ensordecidos', 'voz_sordo', 'Staff que ensordece a alguien'],
  ]],
  ['📌 EXTRA', [
    ['Logros', 'logros', 'Logros desbloqueados'], ['Reportes', 'reportes', 'Reportes de usuarios'],
    ['Sugerencias', 'sugerencias', 'Sugerencias del servidor', true],
  ]],
];
// Tipos "de siempre" que usa el bot internamente -> canal propio de cada uno (así todo queda enlazado solo)
const LOG_ALIAS = { general: 'servidor', mod: 'moderacion_general', seguridad: 'automod', verif: 'verificacion_miembros', tickets: 'tickets', invitaciones: 'invitaciones', logros: 'logros', reportes: 'reportes', sugerencias: 'sugerencias' };
def('log', 'servidor', 'Crea todos los canales de log (uno por evento) y los configura solos', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const guild = i.guild, hechos = [], ya = [], fallos = [];
  for (const [catNombre, canales] of LOG_CANALES) {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === catNombre);
    if (!cat) cat = await guild.channels.create({ name: catNombre, type: ChannelType.GuildCategory, permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageChannels] }] }).catch(e => { fallos.push(`${catNombre} (${e.message})`); return null; });
    if (!cat) continue;
    for (const [nombre, key, desc, publico] of canales) {
      const viejo = cf.logch[key] && guild.channels.cache.get(cf.logch[key]);
      if (viejo) { ya.push(nombre); continue; }
      const ch = await guild.channels.create({ name: `・${nombre}`, type: ChannelType.GuildText, parent: cat.id, topic: desc,
        ...(publico ? { permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [P.ViewChannel], deny: [P.SendMessages] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }] } : {}) })
        .catch(e => { fallos.push(`${nombre} (${e.message})`); return null; });
      if (ch) { cf.logch[key] = ch.id; hechos.push(nombre); }
    }
  }
  for (const [tipo, key] of Object.entries(LOG_ALIAS)) if (cf.logch[key]) cf.logch[tipo] = cf.logch[key];
  save();
  const aviso = guild.members.me.permissions.has(P.ViewAuditLog) ? '' : '\n⚠️ Al bot le falta **Ver registro de auditoría**: sin él no puede saber quién hizo cada acción de staff.';
  await i.editReply({ content: (`📜 **Logs configurados automáticamente**\n✅ Creados: **${hechos.length}**\n↪️ Ya existían: **${ya.length}**${fallos.length ? `\n⚠️ Fallos: ${fallos.join(', ')}` : ''}\n\nCada evento ya escribe en su propio canal. Solo los administradores ven estos canales.${aviso}`).slice(0, 1900) });
});

/* ============================== 5. NIVELES (13) ============================== */
/* Tarjeta estilo "MC NIVEL": imagen arriba · línea · título · línea · texto · barra lateral de color */
function card(gid, title, text, img) {
  if (!ContainerBuilder) return { embeds: [E(gid, title, text, img)] }; // discord.js viejo: cae a embed normal
  const c = new ContainerBuilder().setAccentColor(0x9B30FF);
  const line = () => c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (url(img)) { c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img))); line(); }
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`)); line();
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [c], flags: 1 << 15 }; // IsComponentsV2
}
async function addXp(mem, amt, ch) {
  const gid = mem.guild.id, u = U(gid, mem.id), cf = C(gid), g = G(gid); u.xp += amt; let up = false;
  while (u.xp >= need(u.lvl)) { u.xp -= need(u.lvl); u.lvl++; up = true; }
  while (u.xp < 0 && u.lvl > 0) { u.lvl--; u.xp += need(u.lvl); } if (u.xp < 0) u.xp = 0;
  if (up && amt > 0) {
    for (const [lv, rid] of Object.entries(g.levelroles)) if (u.lvl >= +lv) mem.roles.add(rid).catch(() => {});
    const c = (cf.lvlch && mem.guild.channels.cache.get(cf.lvlch)) || ch;
    const img = await nivelArchivo(gid, mem.user, u, true);
    c?.send(anuncioNivel(mem, u, cf, img)).catch(() => {});
  }
  save(); await checkAch(mem, ch);
}
/* XP por CUALQUIER actividad: mensajes, comandos, reacciones y voz */
const xpAmt = cf => rnd(Math.max(1, cf.xprate - 5), cf.xprate + 5);
async function actXp(mem, ch, key, ms) {
  if (!mem || mem.user?.bot) return;
  const cf = C(mem.guild.id); if (!cf.lvlon) return;
  const u = U(mem.guild.id, mem.id); if (cd(u, key, ms)) return;
  await addXp(mem, xpAmt(cf), ch);
}
const ranking = gid => Object.entries(G(gid).users).sort((a, b) => b[1].lvl - a[1].lvl || b[1].xp - a[1].xp);
// ---- Tarjeta de nivel (imagen). Se edita con /nivel fondo, /nivel marca y /nivel color ----
const NIV_FONDOS = new Map();
async function nivelFondo(src) { // imagen o GIF (se usa el primer cuadro del GIF)
  if (!src || !CV) return null;
  if (NIV_FONDOS.has(src)) return NIV_FONDOS.get(src);
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8e6) return null;
    const img = await CV.loadImage(buf);
    if (NIV_FONDOS.size > 30) NIV_FONDOS.delete(NIV_FONDOS.keys().next().value);
    NIV_FONDOS.set(src, img); return img;
  } catch (e) { console.warn('[nivel] no pude cargar el fondo:', e.message); return null; }
}
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const hexPath = (ctx, cx, cy, r) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2, px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
const starPath = (ctx, cx, cy, R, r) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? r : R, a = Math.PI / 5 * k - Math.PI / 2, px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
function dibujarNivel(ctx, d) {
  const W = 1000, H = 320, col = d.color, F = 'Bahnschrift, Arial, sans-serif';
  ctx.save(); roundRect(ctx, 2, 2, W - 4, H - 4, 26); ctx.clip();
  if (d.fondo) { const s = Math.max(W / d.fondo.width, H / d.fondo.height), w = d.fondo.width * s, h = d.fondo.height * s; ctx.drawImage(d.fondo, (W - w) / 2, (H - h) / 2, w, h); }
  else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0c0716'); g.addColorStop(1, '#2d0f55'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(6,3,14,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  roundRect(ctx, 2, 2, W - 4, H - 4, 26); ctx.strokeStyle = 'rgba(200,180,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  const soft = 'rgba(225,215,255,0.75)';
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`;
  ctx.fillText(`${d.marca}  /  TU RECORRIDO`, 40, 52);
  ctx.textAlign = 'right'; ctx.fillText(`${d.marca} • GG`, W - 40, 52);
  hexPath(ctx, 135, 160, 82); ctx.fillStyle = 'rgba(20,18,40,0.9)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  hexPath(ctx, 135, 160, 66); ctx.strokeStyle = 'rgba(230,225,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  starPath(ctx, 135, 160, 40, 17); ctx.fillStyle = '#f4f1ff'; ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = `600 40px ${F}`;
  const nombre = String(d.nombre).slice(0, 22); ctx.fillText(nombre, 250, 118);
  ctx.fillStyle = col; ctx.font = `500 22px ${F}`; ctx.fillText(`#${d.puesto || '—'}`, 250 + ctx.measureText(nombre).width + 14, 112);
  ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText('CADA CONVERSACIÓN CUENTA', 250, 146);
  ctx.fillStyle = '#ffffff'; ctx.font = `500 28px ${F}`; ctx.fillText(`${fn(d.xpActual)} / ${fn(d.xpNecesario)} XP`, 250, 210);
  const bx = 250, by = 226, bw = 700, bh = 10, p = Math.max(0, Math.min(1, d.xpActual / d.xpNecesario)), fw = Math.max(bh, bw * p);
  roundRect(ctx, bx, by, bw, bh, 5); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  roundRect(ctx, bx, by, fw, bh, 5); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(bx + fw, by + bh / 2, 9, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (d.nuevo) { // "NUEVO NIVEL" con degradado y brillo
    ctx.textAlign = 'center'; ctx.font = `italic 700 66px ${F}`;
    const g = ctx.createLinearGradient(440, 0, 960, 0); g.addColorStop(0, '#e9e9ee'); g.addColorStop(0.5, col); g.addColorStop(1, '#ffd166');
    ctx.fillStyle = g; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillText('NUEVO NIVEL', 700, 205); ctx.shadowBlur = 0;
  }
  ctx.textAlign = 'right'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText('NIVEL', W - 50, 92);
  ctx.fillStyle = '#ffffff'; ctx.font = `600 70px ${F}`; ctx.fillText(String(d.nivel).padStart(2, '0'), W - 50, 150);
  ctx.textAlign = 'left'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText(`${fn(d.total)} XP TOTALES`, 250, 292);
  ctx.textAlign = 'right'; ctx.fillText(`PUESTO ${d.puesto || '—'}`, W - 50, 292);
}
async function nivelArchivo(gid, user, u, nuevo = false) { // devuelve la imagen lista para Discord, o null si no se puede dibujar
  if (!CV) return null;
  try {
    const t = C(gid).tarjeta || {}, puesto = ranking(gid).findIndex(x => x[0] === user.id) + 1;
    const fondo = t.fondo ? await nivelFondo(t.fondo) : null;
    const total = u.xp + 40 * u.lvl + 10 * u.lvl * (u.lvl - 1); // XP acumulado desde el nivel 0
    const cv = CV.createCanvas(1000, 320);
    dibujarNivel(cv.getContext('2d'), { fondo, marca: t.marca || 'Club 24/7', color: t.color || '#a855f7', nombre: user.displayName || user.username, puesto: puesto || null, nivel: u.lvl, xpActual: u.xp, xpNecesario: need(u.lvl), total, nuevo });
    return new AttachmentBuilder(await cv.encode('png'), { name: 'nivel.png' });
  } catch (e) { console.warn('[nivel] no pude dibujar la tarjeta:', e.message); return null; }
}
// Anuncio de subida de nivel: encabezado, texto, tarjeta con NUEVO NIVEL, avatar a la derecha y pie con el nombre de la marca
function anuncioNivel(mem, u, cf, img) {
  const t = cf.tarjeta || {}, marca = t.marca || 'Club 24/7', col = /^#[0-9a-f]{6}$/i.test(t.color || '') ? parseInt(t.color.slice(1), 16) : 0xA855F7;
  const custom = cf.lvlmsg && cf.lvlmsg !== LVL_MSG && cf.lvlmsg !== LVL_OLD;
  const texto = custom ? fmt(cf.lvlmsg, { user: `${mem}`, level: u.lvl, server: mem.guild.name })
    : `✨ ${mem} ha alcanzado el nivel **${u.lvl}** dentro de nuestra comunidad. Agradecemos tu participación, actividad y el tiempo que compartes con nosotros. ✨!`;
  const e = new EmbedBuilder().setColor(col).setAuthor({ name: `${marca} • GG` })
    .setTitle(cf.lvltitle || '✨ Cada conversación deja huella').setDescription(texto)
    .setThumbnail(mem.user.displayAvatarURL({ size: 256 })).setFooter({ text: `${marca} · Tu comunidad, a tu ritmo` }).setTimestamp();
  if (img) e.setImage('attachment://nivel.png');
  return { embeds: [e], files: img ? [img] : [] };
}
def('nivel', 'rank', 'Ver tu tarjeta de nivel', 'usuario:u', null, async (i, o, g, cf) => {
  const t = o.usuario || i.user, u = U(i.guildId, t.id);
  if (!CV) { const pos = ranking(i.guildId).findIndex(x => x[0] === t.id) + 1; return i.reply(card(i.guildId, `📊 Rango de ${t.username}`, `**Nivel:** ${u.lvl}\n**XP:** ${fn(u.xp)}/${fn(need(u.lvl))}\n\`${bar(u.xp / need(u.lvl))}\`\n**Puesto:** #${pos || '—'}\n**Mensajes:** ${fn(u.msgs)}`, cf.rankimg)); }
  await i.deferReply();
  const f = await nivelArchivo(i.guildId, t, u);
  await i.editReply(f ? { files: [f] } : '⚠️ No pude dibujar la tarjeta. Revisa que esté instalado @napi-rs/canvas.');
});
def('nivel', 'vista', 'Vista previa de tu tarjeta, con el texto NUEVO NIVEL', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const f = await nivelArchivo(i.guildId, i.user, U(i.guildId, i.user.id), true);
  await i.editReply(anuncioNivel(i.member, U(i.guildId, i.user.id), cf, f));
});
def('nivel', 'fondo', 'Imagen o GIF de fondo de la tarjeta (link https). Escribe "quitar" para quitarlo', 'url:s!', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 }); cf.tarjeta ??= {};
  if (o.url.trim().toLowerCase() === 'quitar') { delete cf.tarjeta.fondo; save(); return i.editReply('🖼️ Listo: la tarjeta vuelve al degradado morado.'); }
  if (!url(o.url.trim())) return i.editReply('⚠️ El link tiene que empezar con https://');
  if (!CV) return i.editReply('⚠️ Falta instalar @napi-rs/canvas (npm install).');
  if (!(await nivelFondo(o.url.trim()))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo a un .png, .jpg o .gif de menos de 8 MB.');
  cf.tarjeta.fondo = o.url.trim(); save();
  i.editReply('🖼️ Fondo guardado. Usa `/nivel vista` para verlo. (Si es GIF, la tarjeta muestra el primer cuadro.)');
});
def('nivel', 'marca', 'Texto de la tarjeta (ej. Club 24/7)', 'texto:s!', 'Administrator', (i, o, g, cf) => {
  cf.tarjeta ??= {}; cf.tarjeta.marca = o.texto.trim().slice(0, 30) || 'Club 24/7'; save(); ok(i, `✅ La tarjeta dirá **${cf.tarjeta.marca}**.`);
});
def('nivel', 'color', 'Color de la barra y del acento (ej. #a855f7)', 'color:s!', 'Administrator', (i, o, g, cf) => {
  if (!/^#[0-9a-f]{6}$/i.test(o.color.trim())) return no(i, 'Usa el formato #rrggbb, por ejemplo #a855f7.');
  cf.tarjeta ??= {}; cf.tarjeta.color = o.color.trim(); save(); ok(i, `✅ Color guardado: ${cf.tarjeta.color}`);
});
def('nivel', 'top', 'Top de niveles', '', null, (i) => {
  const r = ranking(i.guildId).slice(0, 10); say(i, '🏆 Top niveles', r.length ? r.map((x, n) => `**${n + 1}.** <@${x[0]}> — Nivel **${x[1].lvl}** (${fn(x[1].xp)} XP)`).join('\n') : 'Sin datos aún.');
});
def('nivel', 'set', 'Establece el nivel de un usuario', 'usuario:u!,nivel:i!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.lvl = Math.max(0, o.nivel); u.xp = 0; save(); ok(i, `${o.usuario} ahora es nivel **${u.lvl}**.`); });
def('nivel', 'xpadd', 'Da XP a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', async (i, o) => { const m = await M(i, o.usuario); await addXp(m, o.cantidad, i.channel); ok(i, `+${fn(o.cantidad)} XP a ${m}.`); });
def('nivel', 'xpremove', 'Quita XP a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', async (i, o) => { const m = await M(i, o.usuario); await addXp(m, -o.cantidad, i.channel); ok(i, `-${fn(o.cantidad)} XP a ${m}.`); });
def('nivel', 'rate', 'XP medio por mensaje (1-100)', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.xprate = Math.min(100, Math.max(1, o.cantidad)); save(); ok(i, `XP por mensaje ≈ **${cf.xprate}**.`); });
def('nivel', 'canal', 'Canal de avisos de nivel', 'canal:c', 'Administrator', (i, o, g, cf) => { cf.lvlch = o.canal?.id || null; save(); ok(i, o.canal ? `Avisos en ${o.canal}` : 'Avisos en el canal del mensaje.'); });
def('nivel', 'roladd', 'Rol de recompensa por nivel', 'nivel:i!,rol:r!', 'Administrator', (i, o, g) => { g.levelroles[o.nivel] = o.rol.id; save(); ok(i, `Nivel **${o.nivel}** → ${o.rol}`); });
def('nivel', 'rolremove', 'Quita rol de recompensa', 'nivel:i!', 'Administrator', (i, o, g) => { delete g.levelroles[o.nivel]; save(); ok(i, 'Recompensa eliminada.'); });
def('nivel', 'roles', 'Ver roles de recompensa', '', null, (i, o, g) => { const r = Object.entries(g.levelroles); say(i, '🎁 Recompensas', r.length ? r.map(([l, id]) => `Nivel **${l}** → <@&${id}>`).join('\n') : 'Ninguna.'); });
def('nivel', 'mensaje', 'Mensaje/imagen de subida. {user} {level} {server}', 'texto:s,imagen:s,titulo:s', 'Administrator', (i, o, g, cf) => { if (o.texto) cf.lvlmsg = nl(o.texto); if (o.titulo) cf.lvltitle = o.titulo; if (url(o.imagen)) cf.lvlimg = o.imagen; save(); ok(i, 'Personalización guardada.'); });
def('nivel', 'reset', 'Reinicia niveles de un usuario', 'usuario:u!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.xp = 0; u.lvl = 0; save(); ok(i, `Niveles de ${o.usuario} reiniciados.`); });
def('nivel', 'toggle', 'Activa/desactiva el sistema de niveles', 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.lvlon = o.estado; save(); ok(i, `Niveles ${o.estado ? 'activados' : 'desactivados'}.`); });

/* ============================== 6. ECONOMÍA (25) ============================== */
const bal = (u, o2) => `💵 Cartera: **${fn(u.coins)}**\n🏦 Banco: **${fn(u.bank)}**\n📊 Total: **${fn(u.coins + u.bank)}**`;
const balFull = (u, cur) => `💵 **Cartera:** ${fn(u.coins)} ${cur}\n🏦 **Banco:** ${fn(u.bank)} ${cur}\n━━━━━━━━━━━━━━\n💰 **Total:** ${fn(u.coins + u.bank)} ${cur}`;
/* ---- Tarjetas de economía: las publica el BOT en el canal (sin "usó /comando"), mismo estilo del ejemplo ---- */
const bx = n => `\`${fn(n)}\``;
const ecoMult = u => 1 + Math.min(Math.floor((u.lvl || 0) / 10) * 0.1, 2); // +0.1x cada 10 niveles (máx. 3x)
const mx = m => `\`${+m.toFixed(1)}x\``;
function ecoStreak(u, key, win) { const s = ((u.streak ??= {})[key] ??= { n: 0, last: 0 }), now = Date.now(); s.n = s.last && now - s.last <= win ? s.n + 1 : 1; s.last = now; return s.n; }
async function ecoDone(i, u, { head, intro, amt = 0, xp = 0, body, foot = [], lvlfoot = false }) {
  const cf = C(i.guildId), mon = n => `${bx(n)} ${cf.cur} Monedas`;
  u.coins = Math.max(0, u.coins + amt); save();
  if (xp > 0) await addXp(i.member, xp, i.channel).catch(() => {});
  const lines = []; if (intro) lines.push(intro, '');
  lines.push(...body({ mon, lvl: u.lvl, xp }), '', `💵 **Nuevo saldo:** ${mon(u.coins)}`);
  const fl = [...foot]; if (lvlfoot && xp > 0) fl.push(`Lo siguiente: Llega al nivel ${u.lvl + 1} — ${fn(u.xp)}/${fn(need(u.lvl))} XP · \`/nivel rank\``);
  const small = fl.map(x => `-# ${x}`).join('\n'); let p;
  if (ContainerBuilder) {
    const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${head}`), new TextDisplayBuilder().setContent(lines.join('\n')));
    if (fl.length) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(small));
    p = { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
  } else p = { embeds: [E(i.guildId, head, `${lines.join('\n')}${small ? `\n\n${small}` : ''}`)], allowedMentions: { parse: [] } };
  await i.reply(p); // respuesta normal: aparece "usó /comando" arriba, como en el ejemplo
  checkAch(i.member, i.channel);
}
// Juegos y crimen: mismo estilo (sin XP ni multiplicador)
const reward = (i, u, amt, text) => ecoDone(i, u, { head: text, amt, body: c => [amt >= 0 ? `💰 **Monedas ganadas:** ${c.mon(amt)}` : `💸 **Monedas perdidas:** ${c.mon(-amt)}`] });
def('eco', 'balance', 'Ver tu dinero: cartera, banco y total', 'usuario:u', null, (i, o, g, cf) => { const t = o.usuario || i.user, u = U(i.guildId, t.id); i.reply(card(i.guildId, `${cf.cur} Balance de ${t.username}`, balFull(u, cf.cur), cf.ecoimg)); });
def('daily', 'run', 'Recibe tu recompensa diaria', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'daily', 864e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const n = ecoStreak(u, 'daily', 1728e5), m = ecoMult(u), amt = Math.round(rnd(500, 800) * m) + Math.min(n - 1, 30) * 25;
  return ecoDone(i, u, { head: '💎 ¡Recompensa diaria recibida!', amt, xp: rnd(40, 70), foot: [`Mañana: +${fn(Math.min(n, 30) * 25)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Monedas recibidas:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha:** ${bx(n)} Días`, `📈 **Bonificación por nivel:** ${mx(m)}`] });
});
def('eco', 'weekly', 'Recompensa semanal', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'weekly', 6048e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const n = ecoStreak(u, 'weekly', 12096e5), m = ecoMult(u), amt = Math.round(rnd(3000, 5000) * m) + Math.min(n - 1, 20) * 100;
  return ecoDone(i, u, { head: '🎁 ¡Recompensa semanal recibida!', amt, xp: rnd(150, 250), foot: [`Próxima semana: +${fn(Math.min(n, 20) * 100)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Monedas recibidas:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha:** ${bx(n)} Semanas`, `📈 **Bonificación por nivel:** ${mx(m)}`] });
});
def('work', 'run', 'Trabaja y gana monedas (1h)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'work', 36e5); if (r) return no(i, `Descansa, vuelve ${when(r)}`);
  const [job, em] = R([['Fotógrafo', '📸'], ['Programador', '💻'], ['Barista', '☕'], ['Repartidor de pizzas', '🍕'], ['Diseñador gráfico', '🎨'], ['Streamer', '🎥'], ['Mecánico', '🔧']]);
  const n = ecoStreak(u, 'work', 108e5), m = ecoMult(u), amt = Math.round(rnd(100, 400) * m) + Math.min(n - 1, 20) * 5;
  return ecoDone(i, u, { head: `${em} ¡Trabajo completado!`, intro: `Trabajaste como **${job}**`, amt, xp: rnd(25, 50), lvlfoot: true, foot: [`Próximo trabajo: +${fn(Math.min(n, 20) * 5)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Ganancias:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha de trabajo:** ${bx(n)} Jobs`, '🚀 **Multiplicadores:**', `📈 Level: ${mx(m)}`] });
});
def('eco', 'crime', 'Comete un crimen (2h)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'crime', 72e5); if (r) return no(i, `Vuelve ${when(r)}`);
  if (Math.random() < 0.5) reward(i, u, rnd(300, 800), '🦹 ¡Crimen exitoso!'); else reward(i, u, -Math.min(u.coins, rnd(100, 300)), '🚔 Te atraparon');
});
def('eco', 'rob', 'Roba a un usuario (3h)', 'usuario:u!', null, (i, o) => {
  if (o.usuario.id === i.user.id || o.usuario.bot) return no(i, 'Objetivo inválido.');
  const u = U(i.guildId, i.user.id), t = U(i.guildId, o.usuario.id), r = cd(u, 'rob', 108e5); if (r) return no(i, `Vuelve ${when(r)}`);
  if (t.coins < 100) return no(i, 'Ese usuario no tiene suficiente en cartera.');
  if (Math.random() < 0.4) { const a = rnd(1, Math.floor(t.coins * 0.3)); t.coins -= a; reward(i, u, a, `🥷 Robaste a ${o.usuario.username}`); }
  else { const f = Math.min(u.coins, 200); t.coins += f; reward(i, u, -f, '🚔 Te pillaron robando'); }
});
def('eco', 'deposit', 'Deposita en el banco', 'cantidad:i', null, (i, o) => { const u = U(i.guildId, i.user.id), a = o.cantidad ?? u.coins; if (a <= 0 || a > u.coins) return no(i, 'Cantidad inválida.'); u.coins -= a; u.bank += a; save(); ok(i, `Depositaste **${fn(a)}**.\n${bal(u)}`); });
def('eco', 'withdraw', 'Retira del banco', 'cantidad:i', null, (i, o) => { const u = U(i.guildId, i.user.id), a = o.cantidad ?? u.bank; if (a <= 0 || a > u.bank) return no(i, 'Cantidad inválida.'); u.bank -= a; u.coins += a; save(); ok(i, `Retiraste **${fn(a)}**.\n${bal(u)}`); });
def('eco', 'pay', 'Paga a otro usuario', 'usuario:u!,cantidad:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.usuario.bot || o.usuario.id === i.user.id || o.cantidad <= 0 || o.cantidad > u.coins) return no(i, 'Pago inválido.');
  u.coins -= o.cantidad; U(i.guildId, o.usuario.id).coins += o.cantidad; save(); ok(i, `Pagaste **${fn(o.cantidad)}** a ${o.usuario}.`);
});
def('eco', 'shop', 'Ver la tienda', '', null, (i, o, g, cf) => say(i, '🛒 Tienda', g.items.length ? g.items.map(x => `**${x.name}** — ${fn(x.price)} ${cf.cur}\n${x.desc || ''}${x.role ? ` (da <@&${x.role}>)` : ''}`).join('\n\n') : 'La tienda está vacía.'));
def('eco', 'buy', 'Compra un item', 'item:s!,cantidad:i', null, async (i, o, g, cf) => {
  const it = g.items.find(x => x.name.toLowerCase() === o.item.toLowerCase()); if (!it) return no(i, 'Ese item no existe.');
  const q = Math.max(1, o.cantidad || 1), u = U(i.guildId, i.user.id), tot = it.price * q; if (u.coins < tot) return no(i, `Necesitas **${fn(tot)}** en cartera.`);
  u.coins -= tot; u.items[it.name] = (u.items[it.name] || 0) + q; if (it.role) await i.member.roles.add(it.role).catch(() => {}); save(); ok(i, `Compraste **${q}x ${it.name}** por ${fn(tot)} ${cf.cur}.`);
});
def('eco', 'inventory', 'Ver tu inventario', 'usuario:u', null, (i, o) => { const t = o.usuario || i.user, it = Object.entries(U(i.guildId, t.id).items); say(i, `🎒 Inventario de ${t.username}`, it.length ? it.map(([n, q]) => `**${n}** x${q}`).join('\n') : 'Vacío.'); });
def('eco', 'itemadd', 'Añade un item a la tienda', 'nombre:s!,precio:i!,descripcion:s,rol:r', 'Administrator', (i, o, g) => { g.items.push({ name: o.nombre, price: o.precio, desc: o.descripcion, role: o.rol?.id }); save(); ok(i, `Item **${o.nombre}** añadido.`); });
def('eco', 'itemremove', 'Quita un item de la tienda', 'nombre:s!', 'Administrator', (i, o, g) => { g.items = g.items.filter(x => x.name.toLowerCase() !== o.nombre.toLowerCase()); save(); ok(i, 'Item eliminado.'); });
def('eco', 'top', 'Top de más ricos', '', null, (i, o, g) => { const r = Object.entries(g.users).sort((a, b) => b[1].coins + b[1].bank - a[1].coins - a[1].bank).slice(0, 10); say(i, '💰 Top ricos', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — ${fn(x[1].coins + x[1].bank)}`).join('\n') || 'Sin datos.'); });
def('eco', 'coinflip', 'Apuesta cara o cruz', 'apuesta:i!,lado:s!', null, (i, o) => {
  const u = U(i.guildId, i.user.id), l = o.lado.toLowerCase(); if (!['cara', 'cruz'].includes(l) || o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta o lado inválido (cara/cruz).');
  const res = R(['cara', 'cruz']); reward(i, u, res === l ? o.apuesta : -o.apuesta, `🪙 Salió **${res}** — ${res === l ? '¡Ganaste!' : 'Perdiste'}`);
});
def('eco', 'slots', 'Tragaperras', 'apuesta:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta inválida.');
  const s = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'], r = [R(s), R(s), R(s)], n = new Set(r).size;
  const mult = n === 1 ? (r[0] === '7️⃣' ? 10 : 5) : n === 2 ? 1.5 : 0; reward(i, u, mult ? Math.floor(o.apuesta * mult) - o.apuesta + (mult === 1.5 ? 0 : 0) : -o.apuesta, `🎰 ${r.join(' ')}`);
});
def('eco', 'dados', 'Dados contra el bot', 'apuesta:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta inválida.');
  const a = rnd(2, 12), b = rnd(2, 12); reward(i, u, a > b ? o.apuesta : a < b ? -o.apuesta : 0, `🎲 Tú: **${a}** · Bot: **${b}**`);
});
for (const [n, em, head, place, pe, coinL, finds, fe, lo, hi] of [
  ['mine', '⛏️', '¡Sesión de Minería Completa!', ['Mina Profunda', 'Cueva de Cristal', 'Montaña Rocosa', 'Veta Dorada'], '🏔️', 'Monedas Minadas', ['Hierro', 'Oro', 'Diamante', 'Esmeralda'], '💎', 80, 350],
  ['hunt', '🏹', '¡Cacería Completa!', ['Bosque Oscuro', 'Valle Verde', 'Colinas del Norte', 'Pantano Sombrío'], '🌲', 'Monedas Cazadas', ['Conejo', 'Ciervo', 'Jabalí', 'Faisán'], '🦌', 60, 300]])
  def('eco', n, `${n} (30 min)`, '', null, (i) => {
    const u = U(i.guildId, i.user.id), r = cd(u, n, 18e5); if (r) return no(i, `Vuelve ${when(r)}`);
    const m = ecoMult(u), amt = Math.round(rnd(lo, hi) * m), find = Math.random() < 0.3 ? R(finds) : null; if (find) u.items[find] = (u.items[find] || 0) + 1; // los hallazgos van al inventario
    return ecoDone(i, u, { head: `${em} ${head}`, intro: `${n === 'fish' ? 'Pescaste' : n === 'mine' ? 'Minaste' : 'Cazaste'} en ${pe} **${R(place)}**`, amt, xp: rnd(15, 35),
      body: c => [`💰 **${coinL}:** ${c.mon(amt)}`, `⭐ **XP Recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `📈 **Bonificación de Nivel:** ${mx(m)} Multiplicador`, ...(find ? ['', '🎁 **¡Hallazgos Especiales!:**', `${fe} ${find}`] : [])] });
  });
def('fishing', 'collect', 'Pesca y recoge tus ganancias (30 min)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'fish', 18e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const m = ecoMult(u), amt = Math.round(rnd(50, 250) * m), find = Math.random() < 0.3 ? R(['Rainbow Trout', 'Salmón Dorado', 'Pez Espada', 'Carpa Koi']) : null;
  if (find) u.items[find] = (u.items[find] || 0) + 1; // los hallazgos van al inventario
  return ecoDone(i, u, { head: '🎣 ¡Sesión de Pesca Completa!', intro: `Pescaste en 🌊 **${R(['Forest River', 'Lago Cristal', 'Bahía Dorada', 'Río Esmeralda'])}**`, amt, xp: rnd(15, 35),
    body: c => [`💰 **Monedas Pescadas:** ${c.mon(amt)}`, `⭐ **XP Recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `📈 **Bonificación de Nivel:** ${mx(m)} Multiplicador`, ...(find ? ['', '🎁 **¡Hallazgos Especiales!:**', `🐟 ${find}`] : [])] });
});
/* ---- Evento Halloween: /truco-trato ---- */
const TT_COINS = 15; // monedas fijas que da cada trato (cámbialo aquí)
const TT_CD = 36e5;            // cooldown: 1 hora (cámbialo aquí)
const TT_TRATO = 0.7;          // probabilidad de "trato" (70%); el resto es "truco"
const TT_TRUCOS = ['👻 **¡Un fantasma apareció y te robó tus dulces!**', '🕷️ **¡Una araña gigante se llevó tus dulces!**', '🧙 **¡Una bruja convirtió tus dulces en piedras!**', '🧟 **¡Un zombi se comió todos tus dulces!**'];
def('truco-trato', 'run', 'Halloween: ¡toca la puerta y gana monedas de dulce o llévate un susto!', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'trucotrato', TT_CD); if (r) return no(i, `Los vecinos no tienen más dulces por ahora, vuelve ${when(r)}`);
  const foot = `Evento Halloween • ${i.guild.name}`;
  if (Math.random() < TT_TRATO) {
    const amt = TT_COINS; hwAdd(u, amt); save();
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('🍬 ¡TRATO ENCONTRADO!')
      .setDescription(`¡La suerte de Halloween está de tu lado, ${i.user}!\nHas recibido **${fn(amt)} monedas** de dulce recompensa.\nCanjéalas en la tienda de Halloween (tienes **${fn(hwGet(u))}**).`).setFooter({ text: foot })], allowedMentions: { parse: [] } });
  }
  return i.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('🎃 ¡TE TOCÓ UN TRUCO!')
    .setDescription(`${R(TT_TRUCOS)} No ganaste monedas esta vez.`).setFooter({ text: foot })], allowedMentions: { parse: [] } });
});
/* ---- Tienda de Halloween: /truco-trato da monedas de dulce y se canjean aquí por recompensas (todo editable con /halloween) ---- */
// Las monedas de dulce son un saldo aparte (no tocan /work ni /daily). Pon HW_USE_ECO = true para usar las monedas normales de la economía.
const HW_USE_ECO = false;
const hwGet = u => (HW_USE_ECO ? u.coins : (u.hw || 0));
const hwAdd = (u, n) => { if (HW_USE_ECO) u.coins = Math.max(0, u.coins + n); else u.hw = Math.max(0, (u.hw || 0) + n); };
const HWC = cf => (cf.hw ??= { ch: null, color: '#E67E22', seq: 0, items: [], panels: [],
  title: '🛒 TIENDA OFICIAL DE HALLOWEEN',
  intro: '¡Bienvenido a la Tienda de Recompensas del Evento de Halloween!\nCanjea tus monedas de dulce ganadas en `/truco-trato` por recompensas exclusivas.',
  footer: 'Evento Halloween • {server}', placeholder: '🎃 Selecciona una recompensa para reclamar...' });
const hwEmoji = s => (s && (/^<a?:\w+:\d+>$/.test(s.trim()) || /^\p{Extended_Pictographic}/u.test(s.trim())) ? s.trim() : null);
const hwCut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
function hwPanel(guild) { // embed del catálogo + menú desplegable, igual que la tienda de la captura
  const cf = C(guild.id), h = HWC(cf);
  const lines = h.items.map(it => {
    const left = it.stock == null ? '' : it.stock > 0 ? ` (⚠️ LIMITADO: Solo ${it.stock} disponible${it.stock === 1 ? '' : 's'})` : ' (❌ AGOTADO)';
    return `◦ **${it.name}**${it.role ? ` <@&${it.role}>` : ''} — \`${fn(it.price)} Monedas\`${left}\n• *${it.desc}*`;
  });
  let body = lines.join('\n\n'); if (body.length > 3300) body = hwCut(body, 3300);
  const e = new EmbedBuilder().setColor(hex(h.color) ?? 0xE67E22)
    .setDescription(`# ${h.title}\n${h.intro}\n\n## 🎁 CATÁLOGO DE RECOMPENSAS\n\n${body || '*Aún no hay recompensas. Un admin puede añadirlas con `/halloween agregar`.*'}\n\n──────────────────\n🛒 **Selecciona la recompensa que quieras en el menú desplegable de abajo para canjear tus monedas.**`)
    .setFooter({ text: fmt(h.footer, { server: guild.name }) });
  const p = { embeds: [e], components: [], allowedMentions: { parse: [] } };
  if (h.items.length) p.components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('hw_buy').setPlaceholder(hwCut(h.placeholder, 150))
    .addOptions(h.items.slice(0, 25).map(it => { const o = { label: hwCut(it.name, 100), value: it.id, description: hwCut(`Coste: ${fn(it.price)} Monedas • ${it.short || (it.stock === 0 ? 'Agotado' : it.desc)}`, 100) }; if (it.emoji) o.emoji = it.emoji; return o; }))));
  return p;
}
async function hwRefresh(guild) { // actualiza stock y catálogo en todos los paneles publicados
  const h = HWC(C(guild.id)), keep = [];
  for (const p of h.panels) {
    const m = await guild.channels.cache.get(p.ch)?.messages.fetch(p.msg).catch(() => null);
    if (!m) continue; keep.push(p); await m.edit(hwPanel(guild)).catch(() => {});
  }
  h.panels = keep; save();
}
const hwFind = (h, n) => h.items[n - 1];
const hwFields = (o, it) => { // aplica las opciones opcionales de /halloween agregar|editar sobre un artículo
  if (o.nombre) it.name = hwCut(o.nombre, 60);
  if (o.precio != null) it.price = Math.max(1, o.precio);
  if (o.descripcion) it.desc = hwCut(nl(o.descripcion), 300);
  if (o.resumen != null) it.short = o.resumen ? hwCut(o.resumen, 50) : null;
  if (o.emoji != null) it.emoji = hwEmoji(o.emoji) || undefined;
  if (o.stock != null) it.stock = o.stock < 0 ? null : o.stock;
  if (o.limite != null) it.limit = o.limite <= 0 ? undefined : o.limite;
  if (o.rol) it.role = o.rol.id;
};
const HWSPEC = 'nombre:s,precio:i,descripcion:s,resumen:s,emoji:s,stock:i,limite:i,rol:r';
def('halloween', 'setup', 'Personaliza la tienda: canal de pedidos, color, título, texto y pie', 'pedidos:c,color:s,titulo:s,texto:s,pie:s,menu:s', 'ManageGuild', async (i, o, g, cf) => {
  const h = HWC(cf);
  if (o.pedidos) { const ci = chIssue(i.guild, o.pedidos); if (ci) return no(i, `No puedo usar ${o.pedidos}: ${ci}.`); h.ch = o.pedidos.id; }
  if (o.color) { if (!hex(o.color)) return no(i, 'Color inválido. Usa formato hex, por ejemplo `#E67E22`.'); h.color = o.color; }
  if (o.titulo) h.title = hwCut(o.titulo, 200);
  if (o.texto) h.intro = hwCut(nl(o.texto), 800);
  if (o.pie) h.footer = hwCut(o.pie, 200);
  if (o.menu) h.placeholder = o.menu;
  save(); await hwRefresh(i.guild);
  ok(i, `Tienda actualizada. Si aún no la has publicado usa \`/halloween panel\`.\nCanal de pedidos: ${h.ch ? `<#${h.ch}>` : '—'}\nArtículos: **${h.items.length}**`);
});
def('halloween', 'agregar', 'Añade una recompensa a la tienda', `nombre:s!,precio:i!,descripcion:s!,${HWSPEC.split(',').slice(3).join(',')}`, 'ManageGuild', async (i, o, g, cf) => {
  const h = HWC(cf); if (h.items.length >= 25) return no(i, 'La tienda admite máximo 25 recompensas.');
  if (o.precio < 1) return no(i, 'El precio debe ser de al menos 1 moneda.');
  const it = { id: `h${++h.seq}`, name: '', price: 1, desc: '' }; hwFields(o, it); h.items.push(it); save(); await hwRefresh(i.guild);
  ok(i, `Añadido **#${h.items.length} ${it.name}** por ${fn(it.price)} monedas${it.stock != null ? ` · stock ${it.stock}` : ''}${it.role ? ` · da el rol <@&${it.role}>` : ' · entrega manual por el staff'}.`);
});
def('halloween', 'editar', 'Edita una recompensa (stock -1 = ilimitado, límite 0 = sin límite)', `numero:i!,${HWSPEC}`, 'ManageGuild', async (i, o, g, cf) => {
  const h = HWC(cf), it = hwFind(h, o.numero); if (!it) return no(i, 'No existe esa recompensa. Mira los números con `/halloween lista`.');
  if (o.precio != null && o.precio < 1) return no(i, 'El precio debe ser de al menos 1 moneda.');
  hwFields(o, it); save(); await hwRefresh(i.guild); ok(i, `Recompensa **#${o.numero} ${it.name}** actualizada.`);
});
def('halloween', 'quitar', 'Quita una recompensa de la tienda', 'numero:i!', 'ManageGuild', async (i, o, g, cf) => {
  const h = HWC(cf), it = hwFind(h, o.numero); if (!it) return no(i, 'No existe esa recompensa.');
  h.items.splice(o.numero - 1, 1); save(); await hwRefresh(i.guild); ok(i, `Quitada **${it.name}**.`);
});
def('halloween', 'lista', 'Lista las recompensas con su número', '', 'ManageGuild', (i, o, g, cf) => {
  const h = HWC(cf);
  say(i, '🎃 Recompensas de la tienda', h.items.map((it, k) => `**${k + 1}.** ${it.emoji || ''} ${it.name} — ${fn(it.price)} monedas · stock ${it.stock ?? '∞'}${it.limit ? ` · límite ${it.limit}/persona` : ''}${it.role ? ` · rol <@&${it.role}>` : ' · manual'}`).join('\n') || 'Aún no hay recompensas.', true);
});
def('halloween', 'panel', 'Publica la tienda con su menú desplegable', 'canal:c', 'ManageGuild', async (i, o, g, cf) => {
  const h = HWC(cf), ch = o.canal ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar ahí: ${ci}.`);
  const m = await ch.send(hwPanel(i.guild)); h.panels.push({ ch: ch.id, msg: m.id }); save(); ok(i, `Tienda publicada en ${ch}.`);
});
def('halloween', 'saldo', 'Mira tus monedas de dulce', '', null, (i) => say(i, '🍬 Tus monedas de dulce', `Tienes **${fn(hwGet(U(i.guildId, i.user.id)))}** monedas${HW_USE_ECO ? '' : ' de dulce'}. Consíguelas con \`/truco-trato\` y canjéalas en la tienda.`, true));
def('halloween', 'dar', 'Da (o quita con número negativo) monedas de dulce', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); hwAdd(u, o.cantidad); save(); ok(i, `${o.cantidad >= 0 ? '+' : ''}${fn(o.cantidad)} a ${o.usuario}. Ahora tiene **${fn(hwGet(u))}**.`); });
async function hwInteractions(i) {
  if (i.isButton() && i.customId === 'hw_done') { // el staff marca un pedido manual como entregado
    if (!i.member.permissions.has(P.ManageMessages)) { await no(i, 'Necesitas el permiso **Gestionar mensajes**.'); return true; }
    await i.update({ embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(0x2ECC71).addFields({ name: 'Estado', value: `✅ Entregado por ${i.user}` })], components: [] }); return true;
  }
  if (!(i.isStringSelectMenu() && i.customId === 'hw_buy')) return false;
  const gid = i.guildId, cf = C(gid), h = HWC(cf), it = h.items.find(x => x.id === i.values[0]), u = U(gid, i.user.id);
  await i.deferReply({ flags: 64 });
  const fail = async m => { await i.editReply({ embeds: [E(gid, '❌ No se pudo canjear', m)] }); return true; };
  if (!it) { await fail('Esa recompensa ya no existe.'); hwRefresh(i.guild); return true; }
  if (it.stock != null && it.stock <= 0) return fail('Esa recompensa está **agotada**.');
  if (it.limit && (u.hwbuy?.[it.id] || 0) >= it.limit) return fail(`Ya alcanzaste el límite de **${it.limit}** canje(s) de esta recompensa.`);
  if (hwGet(u) < it.price) return fail(`Te faltan **${fn(it.price - hwGet(u))}** monedas. Tienes ${fn(hwGet(u))} y cuesta ${fn(it.price)}. Consigue más con \`/truco-trato\`.`);
  const lc = h.ch && i.guild.channels.cache.get(h.ch);
  if (!it.role && !lc) return fail('La tienda aún no tiene canal de pedidos configurado. Avisa a un administrador (`/halloween setup`).');
  if (it.role && i.member.roles.cache.has(it.role)) return fail('Ya tienes ese rol.');
  hwAdd(u, -it.price); if (it.stock != null) it.stock--; (u.hwbuy ??= {})[it.id] = (u.hwbuy[it.id] || 0) + 1; save(); // se reserva antes de esperar a Discord para evitar canjes dobles
  if (it.role) {
    try { await i.member.roles.add(it.role); }
    catch (err) { hwAdd(u, it.price); if (it.stock != null) it.stock++; u.hwbuy[it.id]--; save(); return fail('No pude darte el rol (mi rol debe estar por encima de ese rol y tener **Gestionar roles**). No se te cobró nada.'); }
  }
  await i.editReply({ embeds: [E(gid, '✅ ¡Canje exitoso!', `Canjeaste **${it.name}** por **${fn(it.price)}** monedas.\n${it.role ? `Ya tienes el rol <@&${it.role}>.` : 'El staff recibió tu pedido y te la entregará pronto.'}\n💰 Te quedan **${fn(hwGet(u))}** monedas.`)] });
  if (lc) lc.send({ allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(it.role ? 0x2ECC71 : 0xE67E22).setTitle('🎁 Canje de recompensa')
    .setDescription(`${i.user} (\`${i.user.id}\`) canjeó **${it.name}** por ${fn(it.price)} monedas.`).addFields({ name: 'Estado', value: it.role ? '✅ Rol entregado automáticamente' : '⏳ Pendiente de entrega' }).setTimestamp()],
    components: it.role ? [] : [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hw_done').setLabel('Marcar como entregado').setStyle(ButtonStyle.Success))] }).catch(() => {});
  hwRefresh(i.guild); return true;
}
def('eco', 'add', 'Da monedas a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => { U(i.guildId, o.usuario.id).coins += o.cantidad; save(); ok(i, `+${fn(o.cantidad)} a ${o.usuario}.`); });
def('eco', 'remove', 'Quita monedas a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.coins = Math.max(0, u.coins - o.cantidad); save(); ok(i, `-${fn(o.cantidad)} a ${o.usuario}.`); });
def('eco', 'reset', 'Reinicia la economía de un usuario', 'usuario:u!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.coins = 0; u.bank = 0; u.items = {}; save(); ok(i, `Economía de ${o.usuario} reiniciada.`); });
def('eco', 'moneda', 'Cambia el símbolo de la moneda', 'simbolo:s!', 'Administrator', (i, o, g, cf) => { cf.cur = o.simbolo; save(); ok(i, `Moneda: ${o.simbolo}`); });
/* ============================== 7. LOGROS (tarjeta con imagen · voz · cámara · micro · stream · días) ============================== */
/* Para dibujar la tarjeta:  npm i @napi-rs/canvas   (si no está instalado, el logro sale igual pero sin la imagen grande)
   Si en tu hosting el texto sale como cuadritos, crea una carpeta ./fonts y mete ahí un .ttf (por ejemplo Inter o DejaVuSans). */
let CV = null; try { CV = require('@napi-rs/canvas'); } catch { console.warn('[logros] Falta @napi-rs/canvas -> ejecuta: npm i @napi-rs/canvas  (sin él no se dibuja la tarjeta)'); }
if (CV) { // registra las fuentes de ./fonts (ruta absoluta) para que el texto de la tarjeta SIEMPRE se vea
  try {
    const _fp = require('path'), _dir = _fp.join(__dirname, 'fonts');
    if (fs.existsSync(_dir)) for (const f of fs.readdirSync(_dir)) if (/\.(ttf|otf|woff2?)$/i.test(f)) CV.GlobalFonts.registerFromPath(_fp.join(_dir, f));
    const _fam = (CV.GlobalFonts.families || []).map(x => x.family);
    console.log('[logros] fuentes disponibles:', _fam.length ? _fam.slice(0, 6).join(', ') : 'NINGUNA -> pon un .ttf en ./fonts');
  } catch (e) { console.warn('[logros] error cargando fuentes:', e.message); }
}

/* Dibuja la tarjeta "¡LOGRO DESBLOQUEADO!" en un ctx 2D (compatible con @napi-rs/canvas y con el canvas del navegador) */
function drawAchCard(ctx, W, H, A) {
  const FONT = '"Poppins","Inter","Segoe UI","DejaVu Sans","Noto Sans","Liberation Sans",Arial,sans-serif';
  const PUR = '#8b3dff', PUR2 = '#5b21b6', DARK = '#1a1033';
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const spacing = v => { try { ctx.letterSpacing = v; } catch {} };

  // fondo
  ctx.clearRect(0, 0, W, H);
  rr(8, 8, W - 16, H - 16, 44);
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0a10'); bg.addColorStop(1, '#171024');
  ctx.fillStyle = bg; ctx.fill();
  // resplandor detrás de la insignia
  const gl = ctx.createRadialGradient(200, H / 2, 10, 200, H / 2, 260); gl.addColorStop(0, 'rgba(139,61,255,.28)'); gl.addColorStop(1, 'rgba(139,61,255,0)');
  ctx.save(); rr(8, 8, W - 16, H - 16, 44); ctx.clip(); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  // destellos
  let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 26; n++) { const x = 40 + rand() * 340, y = 30 + rand() * (H - 60), r = 1.5 + rand() * 3.5; ctx.globalAlpha = .25 + rand() * .6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
  // borde morado
  rr(8, 8, W - 16, H - 16, 44); const bd = ctx.createLinearGradient(0, 0, W, H); bd.addColorStop(0, '#a35bff'); bd.addColorStop(1, '#6d28d9');
  ctx.lineWidth = 7; ctx.strokeStyle = bd; ctx.stroke();

  // ---------- insignia ----------
  const cx = 200, cy = H / 2, R = 118;
  const shape = () => {
    ctx.beginPath();
    if (A.shape === 'hex') { for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3 - Math.PI / 2 + Math.PI / 6; const px = cx + Math.cos(an) * R, py = cy + Math.sin(an) * R; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
    else if (A.shape === 'circle') ctx.arc(cx, cy, R * .98, 0, Math.PI * 2);
    else { // escudo
      const w = R * 1.62, t = cy - R, b = cy + R * 1.05;
      ctx.moveTo(cx - w / 2, t + 6); ctx.quadraticCurveTo(cx - w / 2, t, cx - w / 2 + 14, t); ctx.lineTo(cx + w / 2 - 14, t); ctx.quadraticCurveTo(cx + w / 2, t, cx + w / 2, t + 6);
      ctx.lineTo(cx + w / 2, cy + R * .18); ctx.quadraticCurveTo(cx + w / 2, cy + R * .72, cx, b); ctx.quadraticCurveTo(cx - w / 2, cy + R * .72, cx - w / 2, cy + R * .18); ctx.closePath();
    }
  };
  ctx.save(); ctx.shadowColor = 'rgba(139,61,255,.65)'; ctx.shadowBlur = 38; shape();
  const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, '#a45cff'); g.addColorStop(.55, PUR); g.addColorStop(1, PUR2);
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  shape(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
  // brillo
  ctx.save(); shape(); ctx.clip(); const sh = ctx.createLinearGradient(cx, cy - R, cx, cy); sh.addColorStop(0, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R); ctx.restore();

  // ---------- icono (oscuro sobre morado) ----------
  ctx.save(); ctx.translate(cx, cy + (A.shape === 'shield' ? -4 : 0)); ctx.fillStyle = DARK; ctx.strokeStyle = DARK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ic = A.icon || 'star';
  if (ic === 'clock') { ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill(); ctx.strokeStyle = '#b98bff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 0); ctx.lineTo(24, 14); ctx.stroke(); }
  else if (ic === 'camera') { rr(-56, -34, 76, 68, 14); ctx.fill(); ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(62, -30); ctx.lineTo(62, 30); ctx.lineTo(30, 10); ctx.closePath(); ctx.fill(); }
  else if (ic === 'mic') { rr(-17, -56, 34, 62, 17); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, -4, 34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 54); ctx.moveTo(-20, 54); ctx.lineTo(20, 54); ctx.stroke(); }
  else if (ic === 'screen') { rr(-58, -42, 116, 76, 12); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-22, 52); ctx.lineTo(22, 52); ctx.moveTo(0, 34); ctx.lineTo(0, 52); ctx.stroke(); ctx.fillStyle = '#b98bff'; ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(18, -4); ctx.lineTo(-12, 14); ctx.closePath(); ctx.fill(); }
  else if (ic === 'calendar') { rr(-52, -46, 104, 98, 14); ctx.fill(); ctx.fillStyle = '#b98bff'; rr(-52, -46, 104, 28, 14); ctx.fill(); ctx.fillRect(-52, -30, 104, 12); ctx.fillStyle = '#b98bff'; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rr(-36 + c * 30, -2 + r * 28, 20, 18, 5), ctx.fill(); ctx.fillStyle = DARK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-26, -58); ctx.lineTo(-26, -36); ctx.moveTo(26, -58); ctx.lineTo(26, -36); ctx.stroke(); }
  else if (ic === 'chat') { rr(-58, -44, 116, 76, 22); ctx.fill(); ctx.beginPath(); ctx.moveTo(-26, 26); ctx.lineTo(-30, 56); ctx.lineTo(4, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b98bff'; for (const x of [-26, 0, 26]) { ctx.beginPath(); ctx.arc(x, -6, 8, 0, 7); ctx.fill(); } }
  else if (ic === 'coin') { ctx.beginPath(); ctx.arc(0, 0, 56, 0, 7); ctx.fill(); ctx.strokeStyle = '#b98bff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.stroke(); ctx.fillStyle = '#b98bff'; rr(-8, -24, 16, 48, 6); ctx.fill(); }
  else if (ic === 'mail') { rr(-58, -40, 116, 80, 12); ctx.fill(); ctx.strokeStyle = '#b98bff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-50, -30); ctx.lineTo(0, 8); ctx.lineTo(50, -30); ctx.stroke(); }
  else if (ic === 'trophy') { ctx.beginPath(); ctx.moveTo(-34, -52); ctx.lineTo(34, -52); ctx.lineTo(30, -6); ctx.quadraticCurveTo(0, 30, -30, -6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-38, -30, 18, Math.PI * .5, Math.PI * 1.5); ctx.moveTo(38, -48); ctx.arc(38, -30, 18, Math.PI * 1.5, Math.PI * .5); ctx.stroke(); ctx.fillRect(-6, 20, 12, 22); rr(-28, 40, 56, 14, 5); ctx.fill(); }
  else { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? 26 : 58, an = -Math.PI / 2 + k * Math.PI / 5; k ? ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad) : ctx.moveTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); }
  ctx.restore();

  // ---------- textos ----------
  const X = 400, MAXW = W - X - 70; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = PUR; ctx.font = `700 34px ${FONT}`; spacing('3px'); ctx.fillText('¡LOGRO DESBLOQUEADO!', X, 112); spacing('0px');
  let fs = 96; ctx.font = `800 ${fs}px ${FONT}`; while (ctx.measureText(A.name).width > MAXW && fs > 40) { fs -= 4; ctx.font = `800 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff'; ctx.fillText(A.name, X, 112 + 14 + fs * .9);
  let ds = 38; ctx.font = `400 ${ds}px ${FONT}`; while (ctx.measureText(A.desc).width > MAXW && ds > 22) { ds -= 2; ctx.font = `400 ${ds}px ${FONT}`; }
  ctx.fillStyle = '#9a9aa8'; ctx.fillText(A.desc, X, 112 + 14 + fs * .9 + 22 + ds);
  // rareza + puntos (abajo a la derecha)
  const right = W - 64, by = H - 52; ctx.textAlign = 'right'; ctx.font = `800 32px ${FONT}`; spacing('1px');
  const pts = `+${A.pts} PTS`, ptsW = ctx.measureText(pts).width; ctx.fillStyle = '#ffd23f'; ctx.fillText(pts, right, by);
  ctx.fillStyle = A.color || PUR; ctx.fillText(A.rarity.toUpperCase(), right - ptsW - 16, by); spacing('0px');
}

const ACARD = new Map();
async function achImage(a) {
  if (!CV) return null; const m = achMeta(a), k = [a.name, a.desc, m.shape, m.icon, m.rar, m.pts].join('|');
  if (ACARD.has(k)) return ACARD.get(k);
  try {
    const cv = CV.createCanvas(1200, 380);
    drawAchCard(cv.getContext('2d'), 1200, 380, { name: a.name, desc: a.desc, rarity: m.rn, pts: m.pts, shape: m.shape, icon: m.icon, color: m.color });
    const buf = await cv.encode('png'); if (ACARD.size > 150) ACARD.delete(ACARD.keys().next().value); ACARD.set(k, buf); return buf;
  } catch (e) { console.warn('[logros] no pude dibujar la tarjeta:', e.message); return null; }
}
const achPts = (g, u) => g.ach.filter(a => u.ach.includes(a.id)).reduce((s, a) => s + achMeta(a).pts, 0);
const achPct = (g, gu, a) => {
  const n = Object.values(g.users).filter(u => u.ach?.includes(a.id)).length; if (!n) return '0';
  const p = n / Math.max(1, gu.memberCount, Object.keys(g.users).length) * 100; return p >= 10 ? String(Math.round(p)) : String(Math.max(0.1, Math.round(p * 10) / 10));
};
const achStats = (user, mem, u) => ({
  msgs: u.msgs, lvl: u.lvl, coins: u.coins + u.bank, invites: u.inv + u.bonus - u.left,
  vmin: u.vmin || 0, mic: u.mic || 0, micon: u.micon || 0, cam: u.cam || 0, camon: u.camon || 0, strm: u.strm || 0, stron: u.stron || 0,
  days: mem?.joinedTimestamp ? Math.floor((Date.now() - mem.joinedTimestamp) / 864e5) : 0, acct: Math.floor((Date.now() - user.createdTimestamp) / 864e5),
});

/* Mensaje del logro: mismo formato que la captura (contenedor morado, avatar, imagen grande y 2 botones) */
async function achPayload(gid, mem, a) {
  const g = G(gid), cf = C(gid), m = achMeta(a), pct = achPct(g, mem.guild, a);
  const head = `🎉 ¡${mem} ha desbloqueado **${a.name}**! (+${m.pts} puntos)`, sub = `-# ${m.ce} ${m.cl} · ${m.rn} · +${m.pts} · ${pct}% lo tienen`;
  const buf = url(a.img) ? null : await achImage(a), files = buf ? [new AttachmentBuilder(buf, { name: 'logro.png' })] : [];
  const img = url(a.img) || (buf ? 'attachment://logro.png' : url(cf.achimg));
  if (!ContainerBuilder || !SectionBuilder || !ThumbnailBuilder) { // discord.js antiguo: embed normal
    return { embeds: [E(gid, `${a.emoji || '🏆'} ¡Logro desbloqueado!`, `${head}\n${a.desc}\n${sub}`, img).setThumbnail(mem.displayAvatarURL())], files };
  }
  const c = new ContainerBuilder().setAccentColor(0x8B3DFF);
  c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(head),
    new TextDisplayBuilder().setContent(`**${a.emoji || '🏆'} ${a.name}**\n${a.desc}`),
    new TextDisplayBuilder().setContent(sub),
  ).setThumbnailAccessory(new ThumbnailBuilder().setURL(mem.displayAvatarURL({ extension: 'png', size: 256 }))));
  if (img) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img)));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ach_me').setLabel('Mis logros').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ach_all').setLabel('Logros del servidor').setEmoji('📜').setStyle(ButtonStyle.Secondary),
  ));
  return { components: [c], files, flags: 1 << 15, allowedMentions: { parse: [] } };
}
const achDest = (mem, ch, cf) => [cf.achch && mem.guild.channels.cache.get(cf.achch), ch, mem.voice?.channel, mem.guild.systemChannel]
  .find(x => x && x.isTextBased?.() && x.permissionsFor?.(mem.guild.members.me)?.has(['ViewChannel', 'SendMessages']));
async function sendAch(mem, a, ch) {
  const gid = mem.guild.id, cf = C(gid), dest = achDest(mem, ch, cf);
  if (dest) { try { await dest.send(await achPayload(gid, mem, a)); } catch (e) { console.warn(`[logros] no pude enviar en ${dest.id}: ${e.message}`); } }
  lg(gid, 'logros', E(gid, `${a.emoji || '🏆'} Logro desbloqueado`, `${mem} → **${a.name}** (+${achMeta(a).pts} pts)`).setThumbnail(mem.displayAvatarURL()));
}
async function checkAch(mem, ch) {
  if (!mem || mem.user?.bot) return;
  const gid = mem.guild.id, g = G(gid), cf = C(gid), u = U(gid, mem.id); if (cf.achoff) return;
  const st = achStats(mem.user, mem, u), won = [];
  for (const a of g.ach) { if (u.ach.includes(a.id) || !(a.type in st) || st[a.type] < a.value) continue; u.ach.push(a.id); won.push(a); }
  if (!won.length) return; save();
  for (const a of won) { await sendAch(mem, a, ch); if (won.length > 1) await new Promise(r => setTimeout(r, 1500)); } // si ganó varios, salen uno a uno
}

/* ---- Seguimiento: minutos en voz / micro / cámara / stream (cada 60 s) ---- */
function achVoiceTick() {
  client.guilds.cache.forEach(gu => {
    if (C(gu.id).achoff) return;
    gu.voiceStates.cache.forEach(vs => {
      const m = vs.member; if (!m || m.user.bot || !vs.channelId || vs.channelId === gu.afkChannelId) return;
      const u = U(gu.id, m.id);
      if (!(vs.selfDeaf || vs.serverDeaf)) u.vmin = (u.vmin || 0) + 1;
      if (vs.selfVideo) u.cam = (u.cam || 0) + 1;
      if (vs.streaming) u.strm = (u.strm || 0) + 1;
      if (!vs.selfMute && !vs.serverMute) u.mic = (u.mic || 0) + 1;
      save(); checkAch(m, null).catch(console.error);
    });
  });
}
/* ---- Seguimiento instantáneo: la primera vez que enciende micro / cámara / transmisión ---- */
function achVoiceEvt(a, b) {
  const m = b.member || a.member; if (!m || m.user.bot || !b.channelId) return;
  const u = U(m.guild.id, m.id), was = !!a.channelId; let hit = false;
  if (!b.selfMute && !b.serverMute && (!was || a.selfMute || a.serverMute)) { u.micon = (u.micon || 0) + 1; hit = true; }
  if (b.selfVideo && (!was || !a.selfVideo)) { u.camon = (u.camon || 0) + 1; hit = true; }
  if (b.streaming && (!was || !a.streaming)) { u.stron = (u.stron || 0) + 1; hit = true; }
  if (hit) { save(); checkAch(m, null).catch(console.error); }
}
/* ---- Cada 10 min: días en el servidor / antigüedad. La primera vez reparte en silencio lo que ya merecían (sin spam) ---- */
async function achSweep() {
  for (const gu of client.guilds.cache.values()) {
    const g = G(gu.id); if (C(gu.id).achoff) continue;
    if (!g.achfill) {
      await gu.members.fetch().catch(() => {});
      for (const m of gu.members.cache.values()) {
        const u = g.users[m.id]; if (m.user.bot || !u) continue; const st = achStats(m.user, m, u);
        for (const a of g.ach) if (!u.ach.includes(a.id) && a.type in st && st[a.type] >= a.value) u.ach.push(a.id);
      }
      g.achfill = true; save(); continue;
    }
    for (const uid of Object.keys(g.users)) { const m = gu.members.cache.get(uid); if (m && !m.user.bot) await checkAch(m, null); }
  }
}

/* ---- Listas (botones y comandos) ---- */
function achBoard(gu, user, mem, u, g) {
  const st = achStats(user, mem, u), by = {}; for (const a of g.ach) (by[achMeta(a).cat] ??= []).push(a);
  const done = g.ach.filter(a => u.ach.includes(a.id)).length;
  const e = E(gu.id, `🏆 Logros de ${user.username} (${done}/${g.ach.length})`, `✨ **${fn(achPts(g, u))}** puntos`).setThumbnail(user.displayAvatarURL());
  for (const [k, list] of Object.entries(by)) {
    const lines = list.map(a => { const m = achMeta(a); return u.ach.includes(a.id) ? `✅ ${a.emoji || '🏆'} **${a.name}** · ${m.rn} · +${m.pts}` : `🔒 ${a.emoji || '🏆'} ${a.name} — ${a.desc} \`${fn(Math.min(st[a.type] ?? 0, a.value))}/${fn(a.value)}\``; });
    let chunk = '', n = 0; const put = () => { if (e.length < 5400) e.addFields({ name: n++ ? '\u200b' : `${ACAT[k][0]} ${ACAT[k][1]}`, value: chunk }); chunk = ''; };
    for (const l of lines) { if ((chunk + l).length > 950) put(); chunk += l + '\n'; } if (chunk) put();
  }
  return e;
}
function achServer(gu, g) {
  const by = {}; for (const a of g.ach) (by[achMeta(a).cat] ??= []).push(a);
  const e = E(gu.id, `📜 Logros de ${gu.name}`, `**${g.ach.length}** logros disponibles`);
  for (const [k, list] of Object.entries(by)) {
    let chunk = '', n = 0; const put = () => { if (e.length < 5400) e.addFields({ name: n++ ? '\u200b' : `${ACAT[k][0]} ${ACAT[k][1]}`, value: chunk }); chunk = ''; };
    for (const a of list) { const m = achMeta(a), l = `${a.emoji || '🏆'} **${a.name}** · ${m.rn} · +${m.pts} · ${achPct(g, gu, a)}%\n-# ${a.desc} · ID \`${a.id}\`\n`; if ((chunk + l).length > 950) put(); chunk += l; } if (chunk) put();
  }
  return e;
}
async function achButton(i) {
  const g = G(i.guildId);
  if (i.customId === 'ach_me') return i.reply({ flags: 64, embeds: [achBoard(i.guild, i.user, i.member, U(i.guildId, i.user.id), g)] });
  if (i.customId === 'ach_all') return i.reply({ flags: 64, embeds: [achServer(i.guild, g)] });
}

/* ---- Comandos /logro ---- */
def('logro', 'logros', 'Ver tus logros con progreso y puntos', 'usuario:u', null, async (i, o, g) => {
  const t = o.usuario || i.user, mem = await M(i, t); i.reply({ embeds: [achBoard(i.guild, t, mem, U(i.guildId, t.id), g)] });
});
def('logro', 'servidor', 'Lista de todos los logros del servidor y qué % los tiene', '', null, (i, o, g) => i.reply({ embeds: [achServer(i.guild, g)] }));
def('logro', 'top', 'Ranking de puntos de logros', '', null, (i, o, g) => {
  const r = Object.entries(g.users).map(([id, u]) => [id, achPts(g, u), u.ach.length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  say(i, '🏆 Top de logros', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — **${fn(x[1])}** pts · ${x[2]} logros`).join('\n') || 'Nadie tiene logros todavía.');
});
def('logro', 'crear', 'Crea un logro (el tipo incluye voz, cámara, micro, stream y días)', 'nombre:s!,descripcion:s!,tipo:s!,valor:i!,emoji:s,rareza:s,puntos:i,icono:s,forma:s,imagen:s', 'Administrator', (i, o, g) => {
  if (!Object.keys(TYPE_CAT).includes(o.tipo)) return no(i, `Tipo inválido. Usa uno de: ${Object.keys(TYPE_CAT).join(', ')}.`);
  const a = { id: 'a' + Date.now().toString(36), name: o.nombre, desc: o.descripcion, type: o.tipo, value: Math.max(1, o.valor), emoji: o.emoji, rar: RAR[o.rareza] ? o.rareza : 'comun',
    pts: o.puntos != null ? Math.max(0, o.puntos) : undefined, icon: o.icono, shape: o.forma, img: url(o.imagen) };
  g.ach.push(a); save(); ok(i, `Logro **${a.name}** creado (\`${a.id}\`) · ${achMeta(a).rn} · +${achMeta(a).pts} pts.`);
});
def('logro', 'eliminar', 'Elimina un logro por ID', 'id:s!', 'Administrator', (i, o, g) => { g.ach = g.ach.filter(a => a.id !== o.id); save(); ok(i, 'Logro eliminado.'); });
def('logro', 'dar', 'Da un logro a un usuario (se anuncia con la tarjeta)', 'usuario:u!,id:s!', 'Administrator', async (i, o, g) => {
  const a = g.ach.find(x => x.id === o.id); if (!a) return no(i, 'ID inválida. Los IDs aparecen en `/logro servidor`.'); const u = U(i.guildId, o.usuario.id); if (!u.ach.includes(a.id)) u.ach.push(a.id); save();
  const mem = await M(i, o.usuario); if (!mem) return ok(i, `${o.usuario} recibió **${a.name}**.`);
  i.reply(await achPayload(i.guildId, mem, a));
});
def('logro', 'probar', 'Vista previa de la tarjeta de un logro (no lo da a nadie)', 'id:s!', 'Administrator', async (i, o, g) => {
  const a = g.ach.find(x => x.id === o.id); if (!a) return no(i, 'ID inválida.'); i.reply(await achPayload(i.guildId, i.member, a));
});
def('logro', 'quitar', 'Quita un logro a un usuario', 'usuario:u!,id:s!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.ach = u.ach.filter(x => x !== o.id); save(); ok(i, 'Logro quitado.'); });
def('logro', 'canal', 'Canal de anuncios de logros', 'canal:c', 'Administrator', (i, o, g, cf) => { cf.achch = o.canal?.id || null; save(); ok(i, o.canal ? `Logros en ${o.canal}` : 'Logros en el canal donde ocurra (o el chat del canal de voz).'); });
def('logro', 'imagen', 'Imagen de respaldo si no se puede dibujar la tarjeta', 'url:s!', 'Administrator', (i, o, g, cf) => { if (!url(o.url)) return no(i, 'URL inválida.'); cf.achimg = o.url; save(); ok(i, 'Imagen de respaldo guardada.'); });
def('logro', 'toggle', 'Activa/desactiva logros', 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.achoff = !o.estado; save(); ok(i, `Logros ${o.estado ? 'activados' : 'desactivados'}.`); });

/* ============================== 8. ANUNCIOS (6) ============================== */
const mkEmbed = (i, o) => {
  const e = E(i.guildId, o.titulo, nl(o.descripcion), o.imagen); if (hex(o.color)) e.setColor(hex(o.color));
  if (url(o.miniatura)) e.setThumbnail(o.miniatura); if (o.autor) e.setAuthor({ name: o.autor, iconURL: i.guild.iconURL() || undefined }); if (o.pie) e.setFooter({ text: o.pie }); return e;
};
def('anuncio', 'anunciar', 'Envía un anuncio con embed', 'canal:c!,titulo:s!,descripcion:s!,color:s,imagen:s,miniatura:s,mencion:r,everyone:b', 'ManageGuild', async (i, o) => {
  await o.canal.send({ content: o.everyone ? '@everyone' : o.mencion ? `${o.mencion}` : undefined, embeds: [mkEmbed(i, o)], allowedMentions: { parse: ['everyone', 'roles'] } }); ok(i, `Anuncio enviado en ${o.canal}`);
});
def('anuncio', 'embed', 'Envía un embed personalizado', 'descripcion:s!,canal:c,titulo:s,color:s,imagen:s,miniatura:s,autor:s,pie:s', 'ManageMessages', async (i, o) => { await (o.canal || i.channel).send({ embeds: [mkEmbed(i, o)] }); ok(i, 'Embed enviado.'); });
def('anuncio', 'say', 'El bot dice un mensaje', 'texto:s!,canal:c', 'ManageMessages', async (i, o) => { await (o.canal || i.channel).send({ content: nl(o.texto), allowedMentions: { parse: [] } }); ok(i, 'Enviado.'); });
def('anuncio', 'encuesta', 'Crea una encuesta (hasta 4 opciones)', 'pregunta:s!,op1:s!,op2:s!,op3:s,op4:s', 'ManageMessages', async (i, o) => {
  const ops = [o.op1, o.op2, o.op3, o.op4].filter(Boolean), em = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  const m = await i.reply({ embeds: [E(i.guildId, `📊 ${o.pregunta}`, ops.map((x, n) => `${em[n]} ${x}`).join('\n\n'))], withResponse: true }); const msg = m.resource.message; for (let n = 0; n < ops.length; n++) await msg.react(em[n]);
});
def('anuncio', 'sorteo', 'Crea un sorteo', 'premio:s!,minutos:i!,ganadores:i', 'ManageGuild', async (i, o) => {
  const ms = Math.min(o.minutos, 10080) * 60000, n = Math.max(1, o.ganadores || 1);
  const m = await i.reply({ embeds: [E(i.guildId, '🎉 SORTEO', `Premio: **${o.premio}**\nGanadores: **${n}**\nTermina ${when(ms)}\n\nReacciona con 🎉 para participar.`)], withResponse: true }); const msg = m.resource.message; await msg.react('🎉');
  setTimeout(async () => {
    const r = (await msg.fetch().catch(() => null))?.reactions.cache.get('🎉'); if (!r) return; const us = [...(await r.users.fetch()).filter(x => !x.bot).values()], w = [];
    while (w.length < n && us.length) w.push(us.splice(rnd(0, us.length - 1), 1)[0]);
    msg.reply({ embeds: [E(i.guildId, '🎉 Sorteo finalizado', w.length ? `Ganador(es) de **${o.premio}**: ${w.join(', ')}` : 'Nadie participó.')] });
  }, ms);
});
def('anuncio', 'recordatorio', 'Te recuerda algo (minutos)', 'minutos:i!,texto:s!', null, (i, o) => {
  const ms = Math.min(o.minutos, 1440) * 60000; ok(i, `Te recordaré ${when(ms)}`);
  setTimeout(() => i.channel.send({ content: `${i.user}`, embeds: [E(i.guildId, '⏰ Recordatorio', o.texto)] }).catch(() => {}), ms);
});

/* ============================== 9. AUTOROLES (7) ============================== */
// Por qué fallaban: el rol estaba por encima del rol del bot / el bot no tenía "Gestionar roles" / era un rol de bot,
// y el error se tragaba en silencio. Ahora se valida al configurar, se reintenta y se avisa en los logs.
const roleIssue = (guild, r) => {
  if (!r) return 'ya no existe';
  if (r.id === guild.id) return 'es @everyone';
  if (r.managed) return 'es un rol de bot/integración (Discord no permite asignarlo)';
  const me = guild.members.me;
  if (!me?.permissions.has(P.ManageRoles)) return 'el bot no tiene el permiso **Gestionar roles**';
  if (r.comparePositionTo(me.roles.highest) >= 0) return 'está por encima del rol del bot (arrastra el rol del bot más arriba en Ajustes → Roles)';
  return null;
};
async function giveRoles(m, ids, why = 'Autorol') {
  const g = G(m.guild.id), good = [], bad = [];
  for (const id of ids) {
    const r = m.guild.roles.cache.get(id), p = roleIssue(m.guild, r);
    if (!r) g.autoroles = g.autoroles.filter(x => x !== id);
    p ? bad.push(`${r ?? `\`${id}\``} — ${p}`) : good.push(id);
  }
  if (good.length) {
    try { await m.roles.add(good, why); } catch (e1) {
      if (e1.code === 10007) return; // el miembro ya se fue
      await new Promise(res => setTimeout(res, 2000));
      try { await m.roles.add(good, why); } catch (e2) { if (e2.code !== 10007) bad.push(`error de Discord: ${e2.message}`); }
    }
  }
  if (bad.length) lg(m.guild.id, 'general', E(m.guild.id, '⚠️ Autorol con problemas', `${m} (${m.user.tag})\n${bad.join('\n')}\n\nRevisa con \`/autorole revisar\`.`));
  save();
}
def('autorole', 'add', 'Rol(es) automático(s) al entrar (hasta 2 a la vez)', 'rol1:r!,rol2:r', 'Administrator', (i, o, g) => {
  const roles = [o.rol1, o.rol2].filter(Boolean), bad = roles.map(r => [r, roleIssue(i.guild, r)]).filter(([, p]) => p);
  if (bad.length) return no(i, bad.map(([r, p]) => `No puedo dar ${r}: ${p}.`).join('\n'));
  for (const r of roles) if (!g.autoroles.includes(r.id)) g.autoroles.push(r.id);
  save(); ok(i, `${roles.join(' y ')} se dará(n) al entrar.`);
});
def('autorole', 'remove', 'Quita un autorol', 'rol:r!', 'Administrator', (i, o, g) => { g.autoroles = g.autoroles.filter(x => x !== o.rol.id); save(); ok(i, 'Autorol eliminado.'); });
def('autorole', 'list', 'Lista de autoroles y su estado', '', null, (i, o, g, cf) => {
  const st = id => { const r = i.guild.roles.cache.get(id), p = roleIssue(i.guild, r); return `${p ? '⚠️' : '✅'} ${r ?? `\`${id}\``}${p ? ` — ${p}` : ''}`; };
  say(i, '🎭 Autoroles', (g.autoroles.map(st).join('\n') || 'Ninguno') + `\n\n🤖 Rol para bots: ${cf.botrole ? st(cf.botrole) : '—'}`);
});
def('autorole', 'bot', 'Rol automático para bots', 'rol:r', 'Administrator', (i, o, g, cf) => {
  if (o.rol) { const p = roleIssue(i.guild, o.rol); if (p) return no(i, `No puedo dar ${o.rol}: ${p}.`); }
  cf.botrole = o.rol?.id || null; save(); ok(i, o.rol ? `Bots recibirán ${o.rol}` : 'Rol de bots desactivado.');
});
def('autorole', 'revisar', 'Diagnostica por qué un autorol podría no funcionar', '', 'Administrator', (i, o, g, cf) => {
  const me = i.guild.members.me, L = [];
  L.push(me.permissions.has(P.ManageRoles) ? '✅ El bot tiene **Gestionar roles**' : '❌ Al bot le falta **Gestionar roles**');
  L.push(`📍 Rol más alto del bot: ${me.roles.highest} (los autoroles deben estar **debajo**)`);
  const ids = [...g.autoroles, ...(cf.botrole ? [cf.botrole] : [])];
  if (!ids.length) L.push('⚠️ No hay autoroles configurados. Usa `/autorole add`.');
  for (const id of ids) { const r = i.guild.roles.cache.get(id), p = roleIssue(i.guild, r); L.push(`${p ? '❌' : '✅'} ${r ?? `\`${id}\``}${p ? ` — ${p}` : ''}`); }
  L.push('\nSi todo está en ✅ y aun así no se asigna, activa **Server Members Intent** en el Developer Portal.');
  say(i, '🔎 Diagnóstico de autoroles', L.join('\n'), true);
});
def('autorole', 'aplicar', 'Da los autoroles a los miembros actuales que no los tengan', '', 'Administrator', async (i, o, g) => {
  if (!g.autoroles.length) return no(i, 'No hay autoroles configurados.');
  await i.deferReply({ flags: 64 });
  const good = g.autoroles.filter(id => !roleIssue(i.guild, i.guild.roles.cache.get(id)));
  if (!good.length) return i.editReply({ embeds: [E(i.guildId, '❌ Error', 'Ningún autorol es válido. Usa `/autorole revisar`.')] });
  const ms = await i.guild.members.fetch(); let n = 0;
  for (const m of ms.values()) {
    if (m.user.bot) continue; const miss = good.filter(id => !m.roles.cache.has(id)); if (!miss.length) continue;
    await m.roles.add(miss, 'Autorol (aplicar)').then(() => n++).catch(() => {}); await new Promise(res => setTimeout(res, 400));
  }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Autoroles aplicados a **${n}** miembros.`)] });
});
def('autorole', 'panel', 'Panel de roles con botones (hasta 5)', 'canal:c!,titulo:s!,descripcion:s!,rol1:r!,rol2:r,rol3:r,rol4:r,rol5:r,imagen:s,color:s', 'Administrator', async (i, o) => {
  const rs = [o.rol1, o.rol2, o.rol3, o.rol4, o.rol5].filter(Boolean), bad = rs.map(r => [r, roleIssue(i.guild, r)]).filter(x => x[1]);
  if (bad.length) return no(i, bad.map(([r, p]) => `${r}: ${p}`).join('\n'));
  const e = E(i.guildId, o.titulo, nl(o.descripcion) + '\n\n' + rs.map(r => `• ${r}`).join('\n'), o.imagen); if (hex(o.color)) e.setColor(hex(o.color));
  try { await o.canal.send({ embeds: [e], components: [new ActionRowBuilder().addComponents(rs.map(r => new ButtonBuilder().setCustomId('rr_' + r.id).setLabel(r.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)))] }); }
  catch (err) { return no(i, `No pude enviar el panel en ${o.canal}: ${err.message}`); }
  ok(i, `Panel enviado en ${o.canal}`);
});

/* ============================== 10. TICKETS (13) ============================== */
async function transcript(ch) {
  let all = [], last; for (let k = 0; k < 3; k++) { const b = await ch.messages.fetch({ limit: 100, before: last }); if (!b.size) break; all.push(...b.values()); last = b.last().id; }
  const t = all.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString('es')}] ${m.author.tag}: ${m.content}${m.attachments.size ? ' ' + m.attachments.map(a => a.url).join(' ') : ''}`).join('\n');
  return new AttachmentBuilder(Buffer.from(t || 'Sin mensajes'), { name: `${ch.name}.txt` });
}
// ---- Tipos de ticket (apelación, VIP, compras...) -------------------------------------------------------------
// Cada tipo tiene su propia categoría, rol de soporte y mensaje de bienvenida. Si hay tipos, el panel muestra un MENÚ
// desplegable; si no, el botón clásico. SOLO un administrador o el rol de soporte (global o del tipo) puede cerrar,
// reclamar y gestionar un ticket: el miembro que lo abrió NO puede cerrarlo.
CHO['ticket.modo'] = [['Menú desplegable', 'menu'], ['Botón', 'boton']];
const TKT = cf => (cf.tk.types ??= {});
const tkSlug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
const tkEmojiOk = s => { const t = String(s).trim(); return /^<a?:\w+:\d+>$/.test(t) || ([...new Intl.Segmenter().segment(t)].length === 1 && /\p{Extended_Pictographic}/u.test(t)); };
const tkEmoji = s => { if (!s) return undefined; const m = String(s).trim().match(/^<(a?):(\w+):(\d+)>$/); return m ? { id: m[3], name: m[2], animated: !!m[1] } : String(s).trim(); };
const tkStaff = (member, gid, t) => {
  if (member.permissions.has(P.Administrator)) return true;
  const tk = C(gid).tk, ids = [tk.role, t?.type && TKT(C(gid))[t.type]?.role].filter(Boolean);
  return ids.some(id => member.roles.cache.has(id));
};
const tkDeny = i => no(i, 'Solo un **administrador** o el **equipo de soporte** puede hacer esto. Los miembros no pueden cerrar ni gestionar tickets.');
// Devuelve los datos del ticket si el canal es un ticket (y, con staff=true, si quien ejecuta es admin/soporte); si no, responde el error y devuelve null
const tkCtx = (i, g, staff = true) => {
  const t = g.tickets[i.channelId];
  if (!t) { no(i, 'Esto no es un ticket.'); return null; }
  if (staff && !tkStaff(i.member, i.guildId, t)) { tkDeny(i); return null; }
  return t;
};
async function closeTicket(ch, by) {
  const g = G(ch.guild.id), t = g.tickets[ch.id]; if (!t) return false; const cf = C(ch.guild.id), f = await transcript(ch), ty = t.type && TKT(cf)[t.type];
  const e = E(ch.guild.id, '🎫 Ticket cerrado', `**Ticket:** ${ch.name}${ty ? `\n**Tipo:** ${ty.emoji || ''} ${ty.name}` : ''}\n**Dueño:** <@${t.owner}>\n**Cerrado por:** ${by}\n**Reclamado por:** ${t.claimed ? `<@${t.claimed}>` : '—'}`);
  const lc = ch.guild.channels.cache.get(cf.tk.log || cf.logch.tickets); lc?.send({ embeds: [e], files: [f] }).catch(() => {});
  const ow = await client.users.fetch(t.owner).catch(() => null); ow?.send({ embeds: [e], files: [f] }).catch(() => {});
  delete g.tickets[ch.id]; save(); setTimeout(() => ch.delete().catch(() => {}), 5000); return true;
}
// La imagen "de arriba" (banner) va como un embed aparte encima del principal, igual que en la interfaz de voz
const tkBanner = (gid, cf) => (url(cf.tk.emb?.banner) ? [new EmbedBuilder().setColor(Number.isInteger(cf.tk.emb.color) ? cf.tk.emb.color : C(gid).color).setImage(cf.tk.emb.banner)] : []);
const tkPanelEmbeds = (gid, cf) => [...tkBanner(gid, cf), tkPanelEmbed(gid, cf)];
function tkPanelEmbed(gid, cf) {
  const v = cf.tk.emb || {}, e = E(gid, v.title || '🎫 Soporte', v.desc || 'Abre un ticket para ponerte en contacto con el equipo de staff.', v.img);
  if (Number.isInteger(v.color)) e.setColor(v.color); if (url(v.thumb)) e.setThumbnail(v.thumb);
  if (v.footer) e.setFooter({ text: v.footer.slice(0, 2048) });
  return e;
}
const tkRows = (cf, mode) => {
  const v = cf.tk.emb || {}, types = Object.entries(TKT(cf));
  if (mode === 'menu' && types.length) return [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tk_menu')
    .setPlaceholder((v.menu || 'Selecciona el tipo de ticket').slice(0, 150))
    .addOptions(types.slice(0, 25).map(([k, x]) => ({ label: x.name.slice(0, 100), value: k, ...(x.desc ? { description: x.desc.slice(0, 100) } : {}), ...(x.emoji ? { emoji: tkEmoji(x.emoji) } : {}) }))))];
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_open').setLabel((v.btn || 'Abrir ticket').slice(0, 80)).setEmoji('🎫').setStyle(ButtonStyle.Primary))];
};
def('ticket', 'setup', 'Categoría por defecto, rol de soporte (cierra/gestiona tickets) y canal de logs', 'categoria:c,rol:r,logs:c', 'Administrator', (i, o, g, cf) => {
  if (o.categoria && o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} no es una **categoría** (la carpeta que agrupa canales). Elige una categoría.`);
  if (o.logs && !o.logs.isTextBased()) return no(i, 'El canal de logs debe ser un canal de texto.');
  if (o.categoria) cf.tk.cat = o.categoria.id; if (o.rol) cf.tk.role = o.rol.id; if (o.logs) cf.tk.log = o.logs.id; save();
  ok(i, `📁 Categoría por defecto: ${cf.tk.cat ? `<#${cf.tk.cat}>` : '—'}\n🛡️ Rol de soporte: ${cf.tk.role ? `<@&${cf.tk.role}>` : '—'} _(puede ver, reclamar y cerrar tickets; los administradores siempre pueden)_\n📜 Logs: ${cf.tk.log ? `<#${cf.tk.log}>` : '—'}\n\nCrea tipos con \`/ticket tipo\` y publica el panel con \`/ticket panel\`.`);
});
def('ticket', 'embed', 'Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s,menu:s,bienvenida:s', 'Administrator', (i, o, g, cf) => {
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  cf.tk.emb = { ...cf.tk.emb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie, btn: o.boton, menu: o.menu, welcome: nl(o.bienvenida) }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete cf.tk.emb[key];
  save(); ok(i, 'Panel de tickets actualizado. Usa `/ticket panel` para publicarlo (los paneles ya publicados no cambian).');
});
def('ticket', 'tipo', 'Crea o edita un tipo de ticket (con su categoría, rol de soporte y bienvenida)', 'nombre:s!,categoria:c,rol:r,emoji:s,descripcion:s,bienvenida:s', 'Administrator', (i, o, g, cf) => {
  const key = tkSlug(o.nombre), tp = TKT(cf);
  if (!key) return no(i, 'El nombre debe tener letras o números.');
  if (!tp[key] && Object.keys(tp).length >= 25) return no(i, 'Máximo 25 tipos de ticket.');
  if (o.categoria && o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} no es una **categoría**.`);
  if (o.emoji && !tkEmojiOk(o.emoji)) return no(i, '`emoji` debe ser **un solo emoji** (o un emoji personalizado del servidor).');
  const x = (tp[key] ??= { name: o.nombre.trim().slice(0, 100) });
  x.name = o.nombre.trim().slice(0, 100);
  if (o.categoria) x.cat = o.categoria.id; if (o.rol) x.role = o.rol.id; if (o.emoji) x.emoji = o.emoji.trim();
  if (o.descripcion) x.desc = o.descripcion.slice(0, 100); if (o.bienvenida) x.welcome = nl(o.bienvenida); save();
  ok(i, `${x.emoji || '🎫'} **${x.name}** guardado.\n📁 Categoría: ${x.cat ? `<#${x.cat}>` : 'la por defecto'}\n🛡️ Soporte: ${x.role ? `<@&${x.role}>` : 'el rol global'}\n\nRepublica el panel con \`/ticket panel\` para que aparezca en el menú.`);
});
def('ticket', 'tipoquitar', 'Elimina un tipo de ticket', 'nombre:s!', 'Administrator', (i, o, g, cf) => {
  const key = tkSlug(o.nombre); if (!TKT(cf)[key]) return no(i, 'Ese tipo no existe. Mira `/ticket tipos`.');
  delete TKT(cf)[key]; save(); ok(i, 'Tipo eliminado. Los tickets ya abiertos de ese tipo siguen funcionando.');
});
def('ticket', 'tipos', 'Lista los tipos de ticket', '', 'Administrator', (i, o, g, cf) => {
  const L = Object.values(TKT(cf)).map(x => `${x.emoji || '🎫'} **${x.name}** → ${x.cat ? `<#${x.cat}>` : 'categoría por defecto'} · ${x.role ? `<@&${x.role}>` : 'soporte global'}${x.desc ? `\n-# ${x.desc}` : ''}`);
  say(i, '🎫 Tipos de ticket', L.join('\n') || 'Ninguno. Crea uno con `/ticket tipo`.', true);
});
def('ticket', 'panel', 'Publica el panel (menú desplegable si hay tipos; si no, botón)', 'canal:c,modo:s', 'Administrator', async (i, o, g, cf) => {
  const dest = o.canal ?? i.channel, ci = chIssue(i.guild, dest); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`);
  const n = Object.keys(TKT(cf)).length, mode = o.modo || (n ? 'menu' : 'boton');
  if (mode === 'menu' && !n) return no(i, 'Para usar el menú crea antes al menos un tipo con `/ticket tipo`.');
  try { await dest.send({ embeds: tkPanelEmbeds(i.guildId, cf), components: tkRows(cf, mode) }); }
  catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  ok(i, `Panel (${mode === 'menu' ? 'menú desplegable' : 'botón'}) enviado a ${dest}.`);
});
def('ticket', 'add', 'Añade un usuario al ticket (solo staff)', 'usuario:u!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.permissionOverwrites.edit(o.usuario.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); ok(i, `${o.usuario} añadido.`); });
def('ticket', 'remove', 'Quita un usuario del ticket (solo staff)', 'usuario:u!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.permissionOverwrites.delete(o.usuario.id); ok(i, `${o.usuario} quitado.`); });
def('ticket', 'close', 'Cierra el ticket (solo administradores o soporte)', '', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await ok(i, 'Cerrando ticket en 5 segundos...'); closeTicket(i.channel, i.user); });
def('ticket', 'rename', 'Renombra el ticket (solo staff)', 'nombre:s!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.setName(o.nombre.slice(0, 90)); ok(i, 'Ticket renombrado.'); });
def('ticket', 'claim', 'Reclama el ticket (solo staff)', '', null, (i, o, g) => { const t = tkCtx(i, g); if (!t) return; t.claimed = i.user.id; save(); i.reply({ embeds: [E(i.guildId, '🙋 Ticket reclamado', `${i.user} atenderá este ticket.`)] }); });
def('ticket', 'transcript', 'Genera la transcripción (solo staff)', '', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.deferReply(); i.editReply({ files: [await transcript(i.channel)] }); });
def('ticket', 'limite', 'Máximo de tickets por usuario', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.tk.max = Math.max(1, o.cantidad); save(); ok(i, `Límite: **${cf.tk.max}** ticket(s) por usuario.`); });
async function openTicket(i, key) {
  const g = G(i.guildId), cf = C(i.guildId), t = cf.tk, ty = key ? TKT(cf)[key] : null;
  if (key && !ty) return no(i, 'Ese tipo de ticket ya no existe.');
  const mine = Object.entries(g.tickets).filter(([id, x]) => x.owner === i.user.id && i.guild.channels.cache.has(id));
  if (mine.length >= t.max) return no(i, `Ya tienes un ticket abierto: <#${mine[0][0]}>`);
  // categoría del tipo (o la por defecto); debe existir y ser de tipo categoría; si no, el ticket se crea sin ella
  const wantCat = ty?.cat || t.cat, cat = wantCat && i.guild.channels.cache.get(wantCat), parent = cat?.type === ChannelType.GuildCategory ? cat.id : null;
  if (wantCat && !parent) lg(i.guildId, 'tickets', E(i.guildId, '⚠️ Categoría de tickets inválida', `La categoría de ${ty ? `**${ty.name}**` : 'tickets'} ya no existe o no es una categoría, así que el ticket se creó sin categoría. Usa \`/ticket ${ty ? 'tipo' : 'setup'}\` y elige una **categoría**.`));
  const roles = [...new Set([t.role, ty?.role].filter(r => r && i.guild.roles.cache.has(r)))];
  t.n++; const allow = [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory];
  let ch;
  try {
    ch = await i.guild.channels.create({ name: `${(ty && tkSlug(ty.name)) || 'ticket'}-${String(t.n).padStart(4, '0')}`, type: ChannelType.GuildText, parent,
      topic: `Ticket de ${i.user.tag}${ty ? ` · ${ty.name}` : ''}`,
      permissionOverwrites: [{ id: i.guild.id, deny: [P.ViewChannel] }, { id: i.user.id, allow }, { id: client.user.id, allow: [...allow, P.ManageChannels] }, ...roles.map(r => ({ id: r, allow }))] });
  } catch (err) { t.n--; return no(i, `No pude crear el ticket: ${err.message}\nAvisa a un administrador (¿categoría llena o falta el permiso Gestionar canales?).`); }
  g.tickets[ch.id] = { owner: i.user.id, created: Date.now(), ...(key ? { type: key } : {}) }; save();
  const e = E(i.guildId, `${ty?.emoji || '🎫'} ${ty ? ty.name : 'Ticket'} #${t.n}`, fmt(ty?.welcome || t.emb.welcome || 'Hola {user}, el staff te atenderá pronto. Describe tu problema.', { user: `${i.user}`, server: i.guild.name, tipo: ty?.name || 'General' }), t.emb.img);
  if (Number.isInteger(t.emb.color)) e.setColor(t.emb.color);
  await ch.send({ content: `${i.user}${roles.length ? ' ' + roles.map(r => `<@&${r}>`).join(' ') : ''}`, embeds: [...tkBanner(i.guildId, cf), e], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk_close').setLabel('Cerrar (staff)').setEmoji('🔒').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('tk_claim').setLabel('Reclamar').setEmoji('🙋').setStyle(ButtonStyle.Success))] });
  lg(i.guildId, 'tickets', E(i.guildId, '🎫 Ticket abierto', `${i.user} abrió ${ch}${ty ? ` · tipo **${ty.name}**` : ''}`)); i.reply({ flags: 64, embeds: [E(i.guildId, '🎫 Ticket creado', `${ch}`)] });
}
const tkOpen = (i, key) => openTicket(i, key).catch(err => { console.error('Ticket:', err.message); const p = { flags: 64, embeds: [E(i.guildId, '❌ Error', `No pude abrir el ticket: ${err.message}`)] }; return (i.replied || i.deferred ? i.followUp(p) : i.reply(p)).catch(() => {}); });

/* ============================== 11. INVITACIONES (19) ============================== */
// Detección: se compara el caché de invitaciones con las actuales en cada entrada (en cola por servidor para evitar
// carreras). Cubre invitaciones de último uso (se borran al agotarse) y URL personalizada. Requiere "Gestionar servidor".
const IC = new Map(), VU = new Map(), IQ = new Map();
const invSnap = inv => new Map(inv.map(x => [x.code, { uses: x.uses ?? 0, by: x.inviter?.id ?? null, max: x.maxUses || 0, exp: x.expiresTimestamp || 0 }]));
const loadInv = async g => {
  try { IC.set(g.id, invSnap(await g.invites.fetch())); } catch {}
  if (g.features.includes('VANITY_URL')) { try { VU.set(g.id, (await g.fetchVanityData()).uses); } catch {} }
};
const invQ = (gid, fn) => { const run = (IQ.get(gid) || Promise.resolve()).then(fn); IQ.set(gid, run.catch(() => {})); return run; };
const invTotal = u => u.inv + u.bonus - u.left;
const IO = cf => ({ fd: cf.inv.fd ?? 3, rejoin: cf.inv.rj ?? true, revoke: cf.inv.rv ?? false });
const INVT = { normal: 'invitación', fake: 'cuenta nueva (posible falsa)', rejoin: 'reingreso', vanity: 'URL personalizada', unknown: 'desconocido' };
const INVC = { normal: '#57F287', fake: '#FEE75C', rejoin: '#5865F2', vanity: '#EB459E', unknown: '#99AAB5' };
const durTxt = ms => { const m = Math.floor(ms / 6e4); if (m < 1) return 'menos de 1 minuto'; if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h} h`; const d = Math.floor(h / 24); return `${d} día${d > 1 ? 's' : ''}`; };
const INV_EV = {
  entrada: { title: '📥 Nueva entrada', color: '#57F287', desc: '{user} entró al servidor.\n👤 Invitado por: {inviter}\n🔗 Código: `{code}` · Tipo: **{type}**\n📊 Invitaciones de {inviter}: **{count}**\n🕒 Cuenta creada {created}' },
  salida: { title: '📤 Salida de miembro', color: '#ED4245', desc: '**{tag}** salió tras **{stay}**.\n👤 Lo había invitado: {inviter}\n📊 Invitaciones de {inviter}: **{count}**' },
  creada: { title: '🔗 Invitación creada', color: '#5865F2', desc: '{inviter} creó el código `{code}`.\n📍 Canal: {channel}\n🔢 Usos máximos: **{max}** · ⏳ Expira: {expires}' },
  borrada: { title: '🗑️ Invitación eliminada', color: '#99AAB5', desc: 'El código `{code}` de {inviter} fue eliminado o se agotó. (Usos: {uses})' },
  recompensa: { title: '🎁 Recompensa de invitaciones', color: '#F1C40F', desc: '{inviter} {action} {role} ({count} invitaciones).{note}' },
  admin: { title: '🛠️ Ajuste de invitaciones', color: '#E67E22', desc: '{admin} {action} a {user}. Total ahora: **{count}**' },
};
function invEmbed(gid, ev, vars, col) {
  const c = C(gid).inv.lm?.[ev] || {}, D = INV_EV[ev];
  const e = new EmbedBuilder().setColor(c.color ?? col ?? D.color).setTimestamp()
    .setTitle(fmt(c.title ?? D.title, vars).slice(0, 256) || null).setDescription(fmt(c.desc ?? D.desc, vars).slice(0, 4096) || null);
  if (vars._thumb) e.setThumbnail(vars._thumb);
  return e;
}
function invLog(gid, ev, vars, col) {
  if ((C(gid).inv.lo || []).includes(ev)) return;
  lg(gid, 'invitaciones', invEmbed(gid, ev, vars, col));
}
const invVars = (m, info, jr) => ({
  user: `${m}`, tag: m.user.tag, id: m.id, inviter: jr.inviter ? `<@${jr.inviter}>` : 'desconocido', code: info.code ?? '—', uses: info.uses || '—',
  count: jr.count, server: m.guild.name, members: m.guild.memberCount, created: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
  type: INVT[jr.type] + (info.ambiguous ? ' (ambigua)' : ''), _thumb: m.displayAvatarURL(),
});
const trackInvite = m => invQ(m.guild.id, async () => {
  const guild = m.guild, gid = guild.id, old = IC.get(gid), res = { by: null, code: null, type: 'unknown', ambiguous: false, uses: 0 };
  let fresh = null; try { fresh = await guild.invites.fetch(); } catch {}
  if (!fresh) return res;
  const snap = invSnap(fresh); IC.set(gid, snap);
  if (!old) return res; // sin caché previa no hay con qué comparar
  const cand = [];
  for (const [code, x] of snap) if (x.uses > (old.get(code)?.uses ?? 0)) cand.push({ code, by: x.by, uses: x.uses });
  if (!cand.length) for (const [code, o] of old) if (!snap.has(code) && o.max && o.uses + 1 >= o.max && !(o.exp && o.exp < Date.now())) cand.push({ code, by: o.by, uses: o.max }); // último uso: la invitación desaparece
  if (cand.length) return Object.assign(res, cand[0], { type: 'invite', ambiguous: cand.length > 1 });
  if (guild.features.includes('VANITY_URL')) {
    try { const v = await guild.fetchVanityData(), pu = VU.get(gid); VU.set(gid, v.uses); if (pu !== undefined && v.uses > pu) return Object.assign(res, { type: 'vanity', code: v.code }); } catch {}
  }
  return res;
});
function recordJoin(m, info) {
  const gid = m.guild.id, g = G(gid), o = IO(C(gid)), prev = g.invby[m.id], res = { type: info.type === 'vanity' ? 'vanity' : 'unknown', count: 0, inviter: null };
  if (info.type === 'invite' && info.by && info.by !== m.id) {
    const iu = U(gid, info.by), fake = Date.now() - m.user.createdTimestamp < o.fd * 864e5; res.inviter = info.by;
    if (prev?.left && o.rejoin && prev.by === info.by && !prev.fake) { iu.left = Math.max(0, iu.left - 1); g.invby[m.id] = { ...prev, left: false, code: info.code, at: Date.now() }; res.type = 'rejoin'; }
    else { fake ? iu.fake++ : iu.inv++; g.invby[m.id] = { by: info.by, fake, left: false, code: info.code, at: Date.now() }; res.type = fake ? 'fake' : 'normal'; }
    res.count = invTotal(iu);
  }
  save(); return res;
}
async function syncRewards(guild, uid) {
  const g = G(guild.id), ents = Object.entries(g.invrew); if (!ents.length) return;
  const mem = await guild.members.fetch(uid).catch(() => null); if (!mem) return;
  const tot = invTotal(U(guild.id, uid)), o = IO(C(guild.id));
  for (const [n, rid] of ents) {
    const has = mem.roles.cache.has(rid), r = guild.roles.cache.get(rid), v = { inviter: `${mem}`, count: tot, role: r ? `${r}` : `\`${rid}\``, note: '', _thumb: mem.displayAvatarURL() };
    if (tot >= +n && !has) {
      const p = roleIssue(guild, r);
      if (p) { invLog(guild.id, 'recompensa', { ...v, action: 'debía recibir el rol', note: `\n⚠️ No se pudo: ${p}` }, '#ED4245'); continue; }
      try { await mem.roles.add(rid, `Recompensa: ${n} invitaciones`); invLog(guild.id, 'recompensa', { ...v, action: 'recibió el rol' }); }
      catch (e) { invLog(guild.id, 'recompensa', { ...v, action: 'debía recibir el rol', note: `\n⚠️ Error: ${e.message}` }, '#ED4245'); }
    } else if (tot < +n && has && o.revoke && r && !roleIssue(guild, r)) {
      try { await mem.roles.remove(rid, `Bajó de ${n} invitaciones`); invLog(guild.id, 'recompensa', { ...v, action: 'perdió el rol', note: `\n(bajó de ${n})` }, '#E67E22'); } catch {}
    }
  }
}

def('invite', 'invites', 'Ver invitaciones', 'usuario:u', null, (i, o, g, cf) => {
  const t = o.usuario || i.user, u = U(i.guildId, t.id), by = g.invby[t.id];
  const rank = Object.entries(g.users).filter(([, x]) => invTotal(x) > 0).sort((a, b) => invTotal(b[1]) - invTotal(a[1])).findIndex(([id]) => id === t.id) + 1;
  i.reply({ embeds: [E(i.guildId, `📨 Invitaciones de ${t.username}`, `✅ Reales: **${u.inv}**\n🚪 Salieron: **${u.left}**\n🕵️ Falsas: **${u.fake}**\n🎁 Bonus: **${u.bonus}**\n\n📊 **Total: ${invTotal(u)}**${rank ? ` · 🏆 Puesto #${rank}` : ''}${by ? `\n👤 Lo invitó: <@${by.by}>` : ''}`, cf.inv.img).setThumbnail(t.displayAvatarURL())] });
});
def('invite', 'top', 'Top de invitadores', '', null, (i, o, g) => { const r = Object.entries(g.users).filter(([, u]) => invTotal(u) > 0).sort((a, b) => invTotal(b[1]) - invTotal(a[1])).slice(0, 10); say(i, '🏆 Top invitaciones', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — ${invTotal(x[1])}`).join('\n') || 'Sin datos.'); });
def('invite', 'quien', 'Quién invitó a un usuario', 'usuario:u!', null, (i, o, g) => {
  const r = g.invby[o.usuario.id];
  say(i, `👤 ${o.usuario.username}`, r ? `Invitado por <@${r.by}>${r.code ? ` con el código \`${r.code}\`` : ''}${r.at ? `\n📅 Entró <t:${Math.floor(r.at / 1000)}:R>` : ''}${r.fake ? '\n🕵️ Marcado como cuenta nueva (falsa)' : ''}${r.left ? '\n🚪 Ya no está en el servidor' : ''}` : 'Sin registro (entró antes que el bot, por URL personalizada o no se pudo detectar).');
});
def('invite', 'invitados', 'Lista de personas que invitó un usuario', 'usuario:u', null, (i, o, g) => {
  const t = o.usuario || i.user, L = Object.entries(g.invby).filter(([, r]) => r.by === t.id).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const rows = L.slice(0, 20).map(([id, r]) => `${r.fake ? '🕵️' : r.left ? '🚪' : '✅'} <@${id}>${r.at ? ` · <t:${Math.floor(r.at / 1000)}:R>` : ''}`);
  say(i, `📨 Invitados por ${t.username} (${L.length})`, (rows.join('\n') || 'Nadie todavía.') + (L.length > 20 ? `\n… y ${L.length - 20} más` : ''));
});
def('invite', 'config', 'Bienvenida simple antigua (recomendado: /bienvenida)', 'canal:c,mensaje:s,salida:s', 'Administrator', (i, o, g, cf) => {
  if (o.canal) cf.inv.ch = o.canal.id; if (o.mensaje) cf.inv.msg = nl(o.mensaje); if (o.salida) cf.inv.leave = nl(o.salida); save(); ok(i, 'Configuración guardada.');
});
def('invite', 'embed', 'Embed de la bienvenida simple antigua', 'titulo:s,color:s,imagen:s', 'Administrator', (i, o, g, cf) => { if (o.titulo) cf.inv.title = o.titulo; if (hex(o.color)) cf.inv.color = hex(o.color); if (url(o.imagen)) cf.inv.img = o.imagen; save(); ok(i, 'Embed actualizado.'); });
def('invite', 'ajustes', 'Días para cuentas falsas, reingresos y quitar roles al bajar', 'fakedias:i,reingreso:b,quitar:b', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv;
  if (o.fakedias != null) { if (o.fakedias < 0 || o.fakedias > 365) return no(i, '`fakedias` debe estar entre 0 y 365.'); ic.fd = o.fakedias; }
  if (o.reingreso != null) ic.rj = o.reingreso; if (o.quitar != null) ic.rv = o.quitar; save();
  const x = IO(cf); ok(i, `🕵️ Cuenta falsa si tiene menos de **${x.fd}** días (0 = nunca)\n🔁 Los reingresos no cuentan doble: **${x.rejoin ? 'sí' : 'no'}**\n➖ Quitar rol de recompensa al bajar del mínimo: **${x.revoke ? 'sí' : 'no'}**`);
});
def('invite', 'logevento', 'Activa/desactiva un tipo de log de invitaciones', 'suceso:s!,estado:b!', 'Administrator', (i, o, g, cf) => {
  const lo = new Set(cf.inv.lo || []); o.estado ? lo.delete(o.suceso) : lo.add(o.suceso); cf.inv.lo = [...lo]; save(); ok(i, `**${o.suceso}** ${o.estado ? '🟢 activado' : '🔴 desactivado'}.`);
});
def('invite', 'logmsg', 'Personaliza el embed de un log. Ver /invite variables', 'suceso:s!,titulo:s,descripcion:s,color:s,restaurar:b', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv; ic.lm ??= {};
  if (o.restaurar) { delete ic.lm[o.suceso]; save(); return ok(i, `Log **${o.suceso}** restaurado al diseño por defecto.`); }
  const c = { ...(ic.lm[o.suceso] || {}) };
  if (o.color) { if (hex(o.color) === null) return no(i, 'Color inválido. Usa `#RRGGBB`.'); c.color = hex(o.color); }
  if (o.titulo) c.title = o.titulo; if (o.descripcion) c.desc = nl(o.descripcion);
  ic.lm[o.suceso] = c; save(); ok(i, 'Log personalizado. Pruébalo con `/invite vista`.');
});
def('invite', 'vista', 'Previsualiza un log de invitaciones', 'suceso:s!', 'Administrator', (i, o) => {
  const v = { user: `${i.user}`, tag: i.user.tag, id: i.user.id, inviter: `${i.user}`, code: 'abc123', uses: 3, count: 5, server: i.guild.name, members: i.guild.memberCount,
    created: `<t:${Math.floor(i.user.createdTimestamp / 1000)}:R>`, type: INVT.normal, stay: '2 días', channel: `${i.channel}`, max: 10, expires: 'en 7 días',
    role: '@Rol', action: 'recibió el rol', note: '', admin: `${i.user}`, _thumb: i.user.displayAvatarURL() };
  i.reply({ embeds: [invEmbed(i.guildId, o.suceso, v)], flags: 64 });
});
def('invite', 'variables', 'Variables para personalizar los logs', '', null, (i) => say(i, '🧩 Variables de logs',
  '**Entrada:** `{user}` `{tag}` `{id}` `{inviter}` `{code}` `{uses}` `{count}` `{type}` `{created}` `{server}` `{members}`\n**Salida:** `{user}` `{tag}` `{id}` `{inviter}` `{count}` `{stay}` `{server}` `{members}`\n**Creada:** `{inviter}` `{code}` `{channel}` `{max}` `{expires}`\n**Eliminada:** `{inviter}` `{code}` `{uses}`\n**Recompensa:** `{inviter}` `{action}` `{role}` `{count}` `{note}`\n**Ajuste:** `{admin}` `{action}` `{user}` `{count}`', true));
def('invite', 'ver', 'Ver la configuración de invitaciones', '', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv, x = IO(cf), lc = cf.logch.invitaciones || cf.logch.general;
  const rw = Object.entries(g.invrew).sort((a, b) => a[0] - b[0]).map(([n, r]) => `**${n}** → <@&${r}>`).join('\n') || 'Ninguna';
  i.reply({ flags: 64, embeds: [E(i.guildId, '📨 Configuración de invitaciones').addFields(
    { name: '📜 Canal de logs', value: lc ? `<#${lc}>${cf.logch.invitaciones ? '' : ' (log general)'}` : '⚠️ Sin canal. Usa `/invite logs`' },
    { name: '🔔 Logs activos', value: Object.keys(INV_EV).map(k => `${(ic.lo || []).includes(k) ? '🔴' : '🟢'} ${k}`).join(' · ') },
    { name: '⚙️ Reglas', value: `🕵️ Falsa si cuenta < **${x.fd}** días\n🔁 Reingresos sin doble conteo: **${x.rejoin ? 'sí' : 'no'}**\n➖ Quitar rol al bajar: **${x.revoke ? 'sí' : 'no'}**` },
    { name: '🎁 Recompensas', value: rw.slice(0, 1024) })] });
});
def('invite', 'revisar', 'Diagnóstico del sistema de invitaciones', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const me = i.guild.members.me, L = [];
  L.push(me.permissions.has(P.ManageGuild) ? '✅ El bot tiene **Gestionar servidor**' : '❌ Falta **Gestionar servidor**: sin él no se puede saber quién invitó');
  let n = null, err = null; try { n = (await i.guild.invites.fetch()).size; } catch (e) { err = e.message; }
  L.push(n != null ? `✅ Puedo leer las invitaciones (${n} activas, ${IC.get(i.guildId)?.size ?? 0} en caché)` : `❌ No puedo leer invitaciones: ${err}`);
  if (n != null && !IC.has(i.guildId)) { await loadInv(i.guild); L.push('🔄 Caché cargada ahora mismo'); }
  L.push(i.guild.features.includes('VANITY_URL') ? '✅ URL personalizada: también se detecta' : 'ℹ️ Sin URL personalizada');
  const lc = cf.logch.invitaciones || cf.logch.general, ch = lc && i.guild.channels.cache.get(lc);
  L.push(!ch ? '⚠️ Sin canal de logs: usa `/log servidor`' : ch.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]) ? `✅ Logs en ${ch}` : `❌ No puedo escribir en ${ch}`);
  for (const [k, rid] of Object.entries(g.invrew)) { const p = roleIssue(i.guild, i.guild.roles.cache.get(rid)); L.push(`${p ? '❌' : '✅'} Recompensa ${k}: <@&${rid}>${p ? ` — ${p}` : ''}`); }
  i.editReply({ embeds: [E(i.guildId, '🔎 Diagnóstico de invitaciones', L.join('\n'))] });
});
def('invite', 'reset', 'Reinicia invitaciones de un usuario', 'usuario:u!', 'Administrator', (i, o) => {
  Object.assign(U(i.guildId, o.usuario.id), { inv: 0, left: 0, fake: 0, bonus: 0 }); save();
  invLog(i.guildId, 'admin', { admin: `${i.user}`, action: 'reinició las invitaciones', user: `${o.usuario}`, count: 0 }); syncRewards(i.guild, o.usuario.id).catch(console.error);
  ok(i, `Invitaciones de ${o.usuario} reiniciadas.`);
});
def('invite', 'bonus', 'Da invitaciones bonus (negativo para quitar)', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => {
  const u = U(i.guildId, o.usuario.id); u.bonus += o.cantidad; save();
  invLog(i.guildId, 'admin', { admin: `${i.user}`, action: `${o.cantidad >= 0 ? 'dio' : 'quitó'} ${Math.abs(o.cantidad)} bonus`, user: `${o.usuario}`, count: invTotal(u) }); syncRewards(i.guild, o.usuario.id).catch(console.error);
  ok(i, `Bonus de ${o.cantidad} a ${o.usuario}. Total: **${invTotal(u)}**`);
});
def('invite', 'rewardadd', 'Rol al alcanzar N invitaciones', 'invitaciones:i!,rol:r!', 'Administrator', (i, o, g) => {
  const p = roleIssue(i.guild, o.rol); if (p) return no(i, `No puedo dar ${o.rol}: ${p}.`);
  g.invrew[o.invitaciones] = o.rol.id; save(); ok(i, `**${o.invitaciones}** invitaciones → ${o.rol}\nUsa \`/invite rewardaplicar\` para dárselo ya a quienes lo cumplan.`);
});
def('invite', 'rewardremove', 'Quita recompensa de invitaciones', 'invitaciones:i!', 'Administrator', (i, o, g) => { delete g.invrew[o.invitaciones]; save(); ok(i, 'Recompensa eliminada.'); });
def('invite', 'rewardaplicar', 'Aplica las recompensas a quienes ya cumplen el mínimo', '', 'Administrator', async (i, o, g) => {
  if (!Object.keys(g.invrew).length) return no(i, 'No hay recompensas. Usa `/invite rewardadd`.');
  await i.deferReply({ flags: 64 });
  const ids = Object.entries(g.users).filter(([, u]) => invTotal(u) > 0).map(x => x[0]);
  for (const id of ids) { await syncRewards(i.guild, id).catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Recompensas revisadas para **${ids.length}** miembros.`)] });
});

/* ============================== 12. UTILIDAD (25) ============================== */
const info = (i, t, d) => i.reply({ embeds: [E(i.guildId, t, d)] });
def('util', 'ping', 'Latencia del bot', '', null, (i) => info(i, '🏓 Pong', `API: **${client.ws.ping}ms**`));
def('util', 'avatar', 'Avatar de un usuario', 'usuario:u', null, (i, o) => { const t = o.usuario || i.user; i.reply({ embeds: [E(i.guildId, `🖼️ Avatar de ${t.username}`).setImage(t.displayAvatarURL({ size: 1024 }))] }); });
def('util', 'banner', 'Banner de un usuario', 'usuario:u', null, async (i, o) => { const t = await client.users.fetch((o.usuario || i.user).id, { force: true }), b = t.bannerURL({ size: 1024 }); if (!b) return no(i, 'No tiene banner.'); i.reply({ embeds: [E(i.guildId, `🎨 Banner de ${t.username}`).setImage(b)] }); });
def('util', 'userinfo', 'Info de un usuario', 'usuario:u', null, async (i, o) => {
  const t = o.usuario || i.user, m = await M(i, t);
  i.reply({ embeds: [E(i.guildId, `👤 ${t.tag}`, `**ID:** ${t.id}\n**Cuenta creada:** <t:${Math.floor(t.createdTimestamp / 1000)}:R>\n**Se unió:** ${m ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : '—'}\n**Roles:** ${m ? m.roles.cache.filter(r => r.id !== i.guild.id).map(r => r).join(' ') || 'Ninguno' : '—'}`).setThumbnail(t.displayAvatarURL())] });
});
def('util', 'serverinfo', 'Info del servidor', '', null, (i) => { const g = i.guild; i.reply({ embeds: [E(i.guildId, `🏠 ${g.name}`, `**ID:** ${g.id}\n**Dueño:** <@${g.ownerId}>\n**Miembros:** ${g.memberCount}\n**Canales:** ${g.channels.cache.size}\n**Roles:** ${g.roles.cache.size}\n**Boosts:** ${g.premiumSubscriptionCount}\n**Creado:** <t:${Math.floor(g.createdTimestamp / 1000)}:R>`).setThumbnail(g.iconURL())] }); });
def('util', 'roleinfo', 'Info de un rol', 'rol:r!', null, (i, o) => info(i, `🎭 ${o.rol.name}`, `**ID:** ${o.rol.id}\n**Color:** ${o.rol.hexColor}\n**Miembros:** ${o.rol.members.size}\n**Mencionable:** ${o.rol.mentionable}\n**Posición:** ${o.rol.position}`));
def('util', 'channelinfo', 'Info de un canal', 'canal:c', null, (i, o) => { const c = o.canal || i.channel; info(i, `#️⃣ ${c.name}`, `**ID:** ${c.id}\n**Tipo:** ${ChannelType[c.type]}\n**Creado:** <t:${Math.floor(c.createdTimestamp / 1000)}:R>`); });
def('util', 'botinfo', 'Info del bot', '', null, (i) => info(i, '🤖 Bot', `**Servidores:** ${client.guilds.cache.size}\n**Usuarios:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}\n**Comandos:** ${Object.values(CATS).reduce((a, c) => a + Object.keys(c).length, 0)}\n**Node:** ${process.version}\n**RAM:** ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB`));
def('util', 'uptime', 'Tiempo encendido', '', null, (i) => info(i, '⏱️ Uptime', `Encendido desde <t:${Math.floor(START / 1000)}:R>`));
/* Ayuda con menús: un embed no admite más de 25 campos ni 6000 caracteres, y ya hay más de 25 módulos.
   Se ve la lista de módulos y, al elegir uno en el menú, sus comandos con su descripción. */
function helpPayload(gid, mod) {
  const mods = Object.keys(CATS), total = mods.reduce((a, c) => a + Object.keys(CATS[c]).length, 0), PER = 25; // un menú admite 25 opciones
  const num = c => Object.keys(CATS[c]).length;
  let e;
  if (mod && CATS[mod]) {
    const subs = Object.entries(CATS[mod]);
    const lines = ROOT.has(mod) ? [`\`/${mod}\` — ${subs[0][1].desc}`] : subs.map(([n, c]) => `\`/${mod} ${n}\` — ${c.desc}`);
    e = E(gid, `📚 /${mod} · ${subs.length} comando${subs.length === 1 ? '' : 's'}`, lines.join('\n').slice(0, 4000));
  } else e = E(gid, `📚 Ayuda · ${total} comandos`, `Elige un módulo en el menú de abajo para ver sus comandos.\n\n${mods.map(c => `**/${c}** · ${num(c)}`).join('\n')}`.slice(0, 4000));
  const rows = [], pages = Math.ceil(mods.length / PER);
  for (let k = 0; k < mods.length; k += PER) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`uh_sel_${k / PER}`)
    .setPlaceholder(pages > 1 ? `Módulos (${k / PER + 1}/${pages})` : 'Elige un módulo')
    .addOptions(mods.slice(k, k + PER).map(c => ({ label: `/${c}`, value: c, description: `${num(c)} comando${num(c) === 1 ? '' : 's'}`, default: c === mod })))));
  if (mod) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('uh_home').setLabel('Inicio').setEmoji('🏠').setStyle(ButtonStyle.Secondary)));
  return { embeds: [e], components: rows };
}
def('util', 'help', 'Lista de módulos y comandos', '', null, (i) => i.reply(helpPayload(i.guildId)));
def('util', 'membercount', 'Cantidad de miembros', '', null, async (i) => { const m = await i.guild.members.fetch(); info(i, '👥 Miembros', `Total: **${i.guild.memberCount}**\nHumanos: **${m.filter(x => !x.user.bot).size}**\nBots: **${m.filter(x => x.user.bot).size}**`); });
def('util', 'emojis', 'Emojis del servidor', '', null, (i) => info(i, '😀 Emojis', i.guild.emojis.cache.map(e => `${e}`).join(' ').slice(0, 4000) || 'Sin emojis.'));
def('util', '8ball', 'Bola 8 mágica', 'pregunta:s!', null, (i, o) => info(i, '🎱 Bola 8', `**${o.pregunta}**\n${R(['Sí', 'No', 'Quizás', 'Definitivamente', 'Ni lo sueñes', 'Pregunta más tarde', 'Todo apunta a que sí', 'Mis fuentes dicen que no'])}`));
def('util', 'moneda', 'Lanza una moneda', '', null, (i) => info(i, '🪙 Moneda', `Salió **${R(['cara', 'cruz'])}**`));
def('util', 'dado', 'Lanza un dado', 'caras:i', null, (i, o) => info(i, '🎲 Dado', `Salió **${rnd(1, Math.max(2, o.caras || 6))}**`));
def('util', 'elegir', 'Elige entre opciones separadas por coma', 'opciones:s!', null, (i, o) => { const a = o.opciones.split(',').map(x => x.trim()).filter(Boolean); if (a.length < 2) return no(i, 'Da al menos 2 opciones.'); info(i, '🤔 Elijo...', `**${R(a)}**`); });
def('util', 'invertir', 'Invierte un texto', 'texto:s!', null, (i, o) => info(i, '🔄 Invertido', [...o.texto].reverse().join('')));
for (const [n, api, txt] of [['abrazar', 'hug', 'abrazó a'], ['golpear', 'punch', 'golpeó a'], ['besar', 'kiss', 'besó a']])
  def('util', n, `${n} a alguien`, 'usuario:u!', null, async (i, o) => { const e = E(i.guildId, null, `**${i.user.username}** ${txt} **${o.usuario.username}**`); const g = await gif(api); if (g) e.setImage(g); i.reply({ embeds: [e] }); });
def('util', 'chiste', 'Cuenta un chiste', '', null, (i) => info(i, '😂 Chiste', R(['¿Qué hace una abeja en el gimnasio? ¡Zum-ba!', '¿Cómo se despiden los químicos? Ácido un placer.', '¿Qué le dice un 0 a un 8? Bonito cinturón.', 'Un programador se va de casa... "¡Te dije que no usaras tabs!"'])));
def('util', 'ship', 'Compatibilidad entre usuarios', 'usuario:u!,usuario2:u', null, (i, o) => {
  const a = o.usuario, b = o.usuario2 || i.user, p = (Number(BigInt(a.id) + BigInt(b.id)) % 101); info(i, '💘 Ship', `${a} + ${b}\n**${p}%** \`${bar(p / 100)}\``);
});
def('util', 'calcular', 'Calculadora', 'expresion:s!', null, (i, o) => {
  if (!/^[\d+\-*/().%\s^]+$/.test(o.expresion)) return no(i, 'Solo números y + - * / ( ) % ^');
  try { info(i, '🧮 Resultado', `\`${o.expresion}\` = **${Function(`"use strict";return (${o.expresion.replace(/\^/g, '**')})`)()}**`); } catch { no(i, 'Expresión inválida.'); }
});
def('util', 'sugerencia', 'Envía una sugerencia', 'texto:s!', null, async (i, o, g, cf) => {
  const c = i.guild.channels.cache.get(cf.logch.sugerencias); if (!c) return no(i, 'No hay canal de sugerencias (`/log servidor`).');
  const m = await c.send({ embeds: [E(i.guildId, '💡 Sugerencia', o.texto).setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() })] }); await m.react('👍'); await m.react('👎'); ok(i, 'Sugerencia enviada.');
});
def('util', 'reportar', 'Reporta a un usuario al staff', 'usuario:u!,razon:s!', null, (i, o, g, cf) => {
  if (!cf.logch.reportes && !cf.logch.general) return no(i, 'No hay canal de reportes configurado.'); lg(i.guildId, 'reportes', E(i.guildId, '🚨 Reporte', `**Reportado:** ${o.usuario}\n**Por:** ${i.user}\n**Razón:** ${o.razon}\n**Canal:** ${i.channel}`)); ok(i, 'Reporte enviado al staff.');
});

/* ===================== 13. BIENVENIDA Y DESPEDIDA (12) ===================== */
// Funciona sin configurar: si no hay canal fijo, el bot busca solo #bienvenida / canal del sistema / #general.
// Variables: {user} {tag} {name} {id} {server} {members} {created} {inviter} {count}
const WK = t => (t === 'despedida' ? 'bye' : 'wb');
const WBc = (cf, t) => (cf[WK(t)] ??= {});
const WBD = {
  bienvenida: { title: '👋 ¡Bienvenido/a!', desc: '¡Hola {user}! 🎉 Te damos la bienvenida a **{server}**.\nAhora somos **{members}** miembros.\n🕒 Cuenta creada {created}', content: '{user}', footer: 'Miembro n.º {members}' },
  despedida: { title: '🚪 Hasta pronto', desc: '**{tag}** salió de **{server}**.\nAhora somos **{members}** miembros.', content: '', footer: '' },
};
const NONE = /^(ninguno|ninguna|none|quitar)$/i;
const IMGK = /^(avatar|servidor|ningun[oa]|none|quitar)$/i;
const okSpec = s => s.split('|').map(x => x.trim()).filter(Boolean).every(x => IMGK.test(x) || url(x));
// Sistema antiguo (/invite config) solo si el servidor ya lo usaba y no ha tocado /bienvenida
const wbLegacy = (cf, t) => !WBc(cf, t).ch && !WBc(cf, t).dm && !!cf.inv.ch && (t === 'bienvenida' || !!cf.inv.leave);
const wbVars = (m, extra) => ({
  user: `${m}`, tag: m.user.tag, name: m.displayName ?? m.user.username, id: m.id, server: m.guild.name,
  members: m.guild.memberCount, created: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
  inviter: 'desconocido', count: 0, ...extra,
});
function wbChannel(guild, w, t) {
  const me = guild.members.me;
  const usable = c => !!c && c.isTextBased?.() && !c.isThread?.() && !!c.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]);
  const pick = re => guild.channels.cache.filter(x => x.type === ChannelType.GuildText && re.test(x.name) && usable(x)).sort((a, b) => a.rawPosition - b.rawPosition).first();
  const fixed = guild.channels.cache.get(w.ch); if (usable(fixed)) return fixed;
  return pick(t === 'despedida' ? /despedid|salida|bye|goodbye|leave/i : /bienvenid|welcome|llegada|entrada/i)
    || (t === 'despedida' && pick(/bienvenid|welcome/i)) || (usable(guild.systemChannel) ? guild.systemChannel : null)
    || pick(/general|chat|principal|lobby/i) || null;
}
// spec: 'avatar' | 'servidor' | URL | URL1|URL2|... (elige una al azar) | 'ninguna'
function wbImg(m, spec, kind) {
  const opts = String(spec ?? '').split('|').map(s => s.trim()).filter(Boolean); if (!opts.length) return null;
  const x = R(opts), k = x.toLowerCase(); if (NONE.test(x)) return null;
  if (k === 'avatar') return m.displayAvatarURL?.({ size: 512 }) || m.user.displayAvatarURL({ size: 512 });
  if (k === 'servidor') return kind === 'thumb' ? m.guild.iconURL({ size: 256 }) : (m.guild.bannerURL({ size: 1024 }) || m.guild.splashURL({ size: 1024 }) || null);
  return url(x);
}
function wbEmbed(m, t, extra) {
  const cf = C(m.guild.id), w = WBc(cf, t), D = WBD[t], v = wbVars(m, extra);
  const av = m.displayAvatarURL?.({ size: 256 }) || m.user.displayAvatarURL({ size: 256 });
  const e = new EmbedBuilder().setColor(w.color ?? cf.color).setTimestamp()
    .setTitle(fmt(w.title ?? D.title, v).slice(0, 256) || null)
    .setDescription(fmt(w.desc ?? D.desc, v).slice(0, 4096) || null);
  const th = wbImg(m, w.thumb ?? 'avatar', 'thumb'), im = wbImg(m, w.img ?? 'servidor', 'img'), ft = fmt(w.footer ?? D.footer, v);
  if (th) e.setThumbnail(th); if (im) e.setImage(im);
  if (w.author) e.setAuthor({ name: fmt(w.author, v).slice(0, 256), iconURL: av });
  if (ft) e.setFooter({ text: ft.slice(0, 2048), iconURL: m.guild.iconURL() || undefined });
  return { e, v };
}
async function sendWB(m, t, extra = {}) {
  const gid = m.guild.id, cf = C(gid), w = WBc(cf, t); if (w.on === false) return;
  const { e, v } = wbEmbed(m, t, extra);
  if (t === 'bienvenida' && w.dm) dm(m.user, E(gid, `👋 ${m.guild.name}`, fmt(w.dm, v).slice(0, 4096), wbImg(m, w.img ?? 'servidor', 'img')).setThumbnail(m.guild.iconURL()));
  const ch = wbChannel(m.guild, w, t);
  if (!ch) return lg(gid, 'general', E(gid, '⚠️ Sin canal de ' + t, 'No encontré un canal donde enviar el mensaje. Usa `/bienvenida autocanal` o `/bienvenida canal`.'));
  const txt = fmt(w.content ?? WBD[t].content, v).slice(0, 2000);
  await ch.send({ content: txt || undefined, embeds: [e], allowedMentions: { users: [m.id] } })
    .catch(err => lg(gid, 'general', E(gid, '⚠️ No pude enviar la ' + t, `${ch}: ${err.message}`)));
}

def('bienvenida', 'autocanal', 'Crea los canales #bienvenida y #despedidas y los configura solo', '', 'Administrator', async (i, o, g, cf) => {
  const me = i.guild.members.me; if (!me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  await i.deferReply({ flags: 64 });
  const mk = (name, topic) => i.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name) ?? i.guild.channels.create({
    name, type: ChannelType.GuildText, topic, reason: 'Autocanal de bienvenida',
    permissionOverwrites: [
      { id: i.guild.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] },
      { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles] },
    ],
  });
  try {
    const a = await mk('👋-bienvenida', 'Aquí damos la bienvenida a los nuevos miembros'), b = await mk('🚪-despedidas', 'Quienes se fueron del servidor');
    Object.assign(WBc(cf, 'bienvenida'), { ch: a.id, on: true }); Object.assign(WBc(cf, 'despedida'), { ch: b.id, on: true }); save();
    i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Bienvenida → ${a}\nDespedida → ${b}\n\nPruébalo con \`/bienvenida vista\`.`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear los canales: ${err.message}`)] }); }
});
def('bienvenida', 'canal', 'Fija el canal (si no, se elige uno automático)', 'evento:s!,canal:c!', 'Administrator', (i, o, g, cf) => {
  if (!o.canal.isTextBased()) return no(i, 'Elige un canal de texto.');
  WBc(cf, o.evento).ch = o.canal.id; save(); ok(i, `**${o.evento}** → ${o.canal}`);
});
def('bienvenida', 'mensaje', 'Texto del embed. Usa \\n para saltos de línea. Ver /bienvenida variables', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).desc = nl(o.texto); save(); ok(i, 'Mensaje actualizado. Pruébalo con `/bienvenida vista`.');
});
def('bienvenida', 'titulo', 'Título del embed (ninguno = sin título)', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).title = NONE.test(o.texto) ? '' : o.texto; save(); ok(i, 'Título actualizado.');
});
def('bienvenida', 'embed', 'Color, imágenes y pie. imagen/miniatura: enlace(s) con |, avatar o servidor', 'evento:s!,color:s,imagen:s,miniatura:s,pie:s,autor:s', 'Administrator', (i, o, g, cf) => {
  const w = { ...WBc(cf, o.evento) };
  if (o.color) { if (hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.'); w.color = hex(o.color); }
  for (const [opt, key] of [['imagen', 'img'], ['miniatura', 'thumb']]) {
    const val = o[opt]; if (!val) continue;
    if (!okSpec(val)) return no(i, `**${opt}**: usa un enlace \`http(s)\`, varios separados por \`|\` (se elige uno al azar), \`avatar\`, \`servidor\` o \`ninguna\`.`);
    w[key] = NONE.test(val.trim()) ? 'ninguna' : val.trim();
  }
  if (o.pie) w.footer = NONE.test(o.pie) ? '' : nl(o.pie);
  if (o.autor) NONE.test(o.autor) ? delete w.author : (w.author = nl(o.autor));
  cf[WK(o.evento)] = w; save(); ok(i, 'Embed actualizado. Pruébalo con `/bienvenida vista`.');
});
def('bienvenida', 'texto', 'Texto sobre el embed (ej. {user} para mencionar). ninguno = vacío', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).content = NONE.test(o.texto) ? '' : nl(o.texto); save(); ok(i, 'Texto superior actualizado.');
});
def('bienvenida', 'activar', 'Activa o desactiva bienvenida/despedida', 'evento:s!,estado:b!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).on = o.estado; save(); ok(i, `**${o.evento}** ${o.estado ? '🟢 activada' : '🔴 desactivada'}.`);
});
def('bienvenida', 'dm', 'Mensaje privado al nuevo miembro (ninguno = quitar)', 'mensaje:s!', 'Administrator', (i, o, g, cf) => {
  const w = WBc(cf, 'bienvenida'); NONE.test(o.mensaje) ? delete w.dm : (w.dm = nl(o.mensaje)); save(); ok(i, w.dm ? 'DM de bienvenida guardado.' : 'DM de bienvenida eliminado.');
});
def('bienvenida', 'vista', 'Previsualiza el mensaje con tu usuario', 'evento:s!', 'Administrator', async (i, o, g, cf) => {
  const m = await M(i, i.user); if (!m) return no(i, 'No pude cargar tu perfil de miembro.');
  const { e, v } = wbEmbed(m, o.evento, { inviter: `${i.user}`, count: 5 }), w = WBc(cf, o.evento), ch = wbChannel(i.guild, w, o.evento);
  const txt = fmt(w.content ?? WBD[o.evento].content, v).slice(0, 1800);
  i.reply({ content: `${txt ? txt + '\n' : ''}-# 📍 Se enviaría en: ${ch ?? 'ningún canal (usa /bienvenida autocanal)'}`, embeds: [e], flags: 64 });
});
def('bienvenida', 'ver', 'Ver la configuración actual', '', 'Administrator', (i, o, g, cf) => {
  const e = E(i.guildId, '👋 Bienvenida y despedida');
  for (const t of ['bienvenida', 'despedida']) {
    const w = WBc(cf, t), D = WBD[t], ch = wbChannel(i.guild, w, t), st = w.on === false ? '🔴 off' : ch ? '🟢 on' : '⚪ sin canal';
    e.addFields({ name: `${t === 'bienvenida' ? '👋' : '🚪'} ${t} · ${st}`, value: [
      `Canal: ${ch ?? '—'}${w.ch ? '' : ' (automático)'}`, `Título: ${w.title ?? D.title}`, `Imagen: ${w.img ?? 'banner del servidor (si tiene)'}`, `Miniatura: ${w.thumb ?? 'avatar'}`,
      `Color: ${w.color != null ? '#' + Number(w.color).toString(16).padStart(6, '0') : 'por defecto'}`,
      ...(t === 'bienvenida' ? [`DM: ${w.dm ? 'sí' : 'no'}`] : []),
    ].join('\n').slice(0, 1024) });
  }
  i.reply({ embeds: [e], flags: 64 });
});
def('bienvenida', 'variables', 'Lista de variables disponibles', '', null, (i) => say(i, '🧩 Variables',
  '`{user}` mención · `{tag}` usuario#tag · `{name}` nombre visible · `{id}` ID\n`{server}` nombre del servidor · `{members}` miembros totales\n`{created}` antigüedad de la cuenta · `{inviter}` quién invitó · `{count}` invitaciones del invitador\n\n`{count}` solo tiene datos reales al entrar. Imágenes: `avatar`, `servidor`, un enlace, o varios con `|` (uno al azar).', true));
def('bienvenida', 'reset', 'Restaura bienvenida o despedida a los valores por defecto', 'evento:s!', 'Administrator', (i, o, g, cf) => {
  cf[WK(o.evento)] = {}; save(); ok(i, `**${o.evento}** restaurada (canal automático y diseño por defecto).`);
});

/* ===================== 14. LIMPIEZA DE MENSAJES (6) ===================== */
// /limpiar mensajes  → borra N mensajes recientes (con filtros: usuario, bots, enlaces, archivos, texto)
// /limpiar desde     → borra todo lo posterior a un mensaje
// /limpiar canal     → reinicia el canal (lo recrea vacío; borra TODO, también lo de más de 14 días), con confirmación
// /limpiar auto      → limpieza automática cada X horas (mensajes recientes o reinicio completo)
// Discord solo permite borrar en bloque mensajes de menos de 14 días; los fijados se conservan siempre.
const CLEAN_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const cleanIssue = (guild, ch, wipe) => {
  if (!ch) return 'el canal no existe';
  if (!CLEAN_TYPES.includes(ch.type)) return 'solo funciona en canales de texto o de anuncios';
  const p = ch.permissionsFor(guild.members.me), names = { [P.ViewChannel]: 'Ver canal', [P.ReadMessageHistory]: 'Leer historial', [P.ManageMessages]: 'Gestionar mensajes', [P.ManageChannels]: 'Gestionar canales' };
  const miss = [P.ViewChannel, P.ReadMessageHistory, wipe ? P.ManageChannels : P.ManageMessages].filter(x => !p?.has(x));
  return miss.length ? `al bot le falta en ${ch}: **${miss.map(x => names[x]).join(', ')}**` : null;
};
const cleanTest = o => m => {
  if (o.usuario && m.author.id !== o.usuario.id) return false;
  if (o.filtro === 'bots' && !m.author.bot) return false;
  if (o.filtro === 'humanos' && m.author.bot) return false;
  if (o.filtro === 'enlaces' && !/https?:\/\/\S+/i.test(m.content)) return false;
  if (o.filtro === 'archivos' && !m.attachments.size) return false;
  if (o.filtro === 'embeds' && !m.embeds.length) return false;
  if (o.contiene && !m.content.toLowerCase().includes(o.contiene.toLowerCase())) return false;
  return true;
};
async function cleanMessages(ch, { limit = 100, test = () => true, after = null, keepPinned = true } = {}) {
  const lim14 = Date.now() - 14 * 864e5 + 120000; let deleted = 0, old = 0, scanned = 0, before;
  while (deleted < limit && scanned < 5000) {
    const batch = await ch.messages.fetch({ limit: 100, ...(before ? { before } : {}) }); if (!batch.size) break;
    scanned += batch.size; before = batch.last().id;
    let list = [...batch.values()]; if (after) list = list.filter(m => BigInt(m.id) > BigInt(after));
    const match = list.filter(m => (!keepPinned || !m.pinned) && test(m));
    old += match.filter(m => m.createdTimestamp < lim14).length;
    const sel = match.filter(m => m.createdTimestamp >= lim14).slice(0, limit - deleted);
    if (sel.length === 1) { if (await sel[0].delete().then(() => true).catch(() => false)) deleted++; }
    else if (sel.length) deleted += (await ch.bulkDelete(sel, true).catch(() => null))?.size ?? 0;
    if (batch.size < 100 || batch.last().createdTimestamp < lim14 || (after && BigInt(batch.last().id) <= BigInt(after))) break;
    await new Promise(r => setTimeout(r, 600));
  }
  return { deleted, old };
}
// cambia el ID de un canal en toda la configuración (para que bienvenida, logs, etc. sigan apuntando al canal nuevo)
function swapId(gid, a, b) {
  const walk = o => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (k === a) { o[b] = o[k]; delete o[k]; walk(o[b]); } else if (o[k] === a) o[k] = b; else walk(o[k]); } };
  walk(G(gid).cfg); save();
}
async function nukeChannel(ch, by) {
  const nc = await ch.clone({ reason: `Reinicio de canal por ${by.tag ?? by.username}` });
  await nc.setPosition(ch.position).catch(() => {});
  swapId(ch.guild.id, ch.id, nc.id);
  await ch.delete(`Reinicio de canal por ${by.tag ?? by.username}`);
  nc.send({ embeds: [E(ch.guild.id, '🧹 Canal reiniciado', `Reiniciado por ${by}.`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 10000)).catch(() => {});
  return nc;
}
const cleanLog = (i, title, ch, extra) => lg(i.guildId, 'mod', E(i.guildId, title, `**Moderador:** ${i.user}\n**Canal:** ${ch}\n${extra}`));
def('limpiar', 'mensajes', 'Borra mensajes recientes del canal (hasta 1000)', 'cantidad:i!,usuario:u,filtro:s,contiene:s,canal:c', 'ManageMessages', async (i, o) => {
  const ch = o.canal ?? i.channel, bad = cleanIssue(i.guild, ch); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  if (o.cantidad < 1) return no(i, 'La cantidad debe ser al menos 1.');
  await i.deferReply({ flags: 64 });
  const r = await cleanMessages(ch, { limit: Math.min(o.cantidad, 1000), test: cleanTest(o) });
  cleanLog(i, '🧹 Limpieza de mensajes', ch, `**Borrados:** ${r.deleted}${o.usuario ? `\n**Usuario:** ${o.usuario}` : ''}${o.filtro && o.filtro !== 'todos' ? `\n**Filtro:** ${o.filtro}` : ''}${o.contiene ? `\n**Contiene:** ${o.contiene}` : ''}`);
  i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${r.deleted}** mensajes borrados en ${ch}.${r.old ? `\n⚠️ Hay **${r.old}+** mensajes con más de 14 días que Discord no permite borrar en bloque. Usa \`/limpiar canal\` para reiniciar el canal.` : ''}${!r.deleted && !r.old ? '\nNo encontré mensajes que coincidan.' : ''}`)] });
});
def('limpiar', 'desde', 'Borra todo lo posterior a un mensaje (ID o enlace del mensaje)', 'mensaje:s!,canal:c', 'ManageMessages', async (i, o) => {
  const ids = o.mensaje.match(/\d{17,20}/g); if (!ids) return no(i, 'Pega el **ID** o el **enlace** del mensaje.');
  let ch = o.canal ?? i.channel; if (ids.length >= 3) ch = i.guild.channels.cache.get(ids[ids.length - 2]) ?? ch;
  const bad = cleanIssue(i.guild, ch); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  await i.deferReply({ flags: 64 });
  const r = await cleanMessages(ch, { limit: 5000, after: (BigInt(ids[ids.length - 1]) - 1n).toString() });
  cleanLog(i, '🧹 Limpieza desde un mensaje', ch, `**Borrados:** ${r.deleted}`);
  i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${r.deleted}** mensajes borrados en ${ch}, desde el mensaje indicado hasta ahora.${r.old ? `\n⚠️ **${r.old}+** eran de más de 14 días y no se pueden borrar en bloque.` : ''}`)] });
});
def('limpiar', 'canal', 'Reinicia el canal: lo recrea vacío (borra TODO, pide confirmación)', 'canal:c', 'ManageChannels', (i, o, g) => {
  const ch = o.canal ?? i.channel, bad = cleanIssue(i.guild, ch, true); if (bad) return no(i, `No puedo reiniciar: ${bad}.`);
  if (g.tickets[ch.id]) return no(i, 'Eso es un ticket. Ciérralo con `/ticket close`.');
  i.reply({ flags: 64, embeds: [E(i.guildId, '⚠️ ¿Reiniciar el canal?', `Se borrará **todo** el contenido de ${ch} (mensajes, fijados y adjuntos). El canal se recreará igual, con los mismos permisos y configuración.\n\nEsta acción **no se puede deshacer**.`)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cl_ok_${ch.id}_${i.user.id}`).setLabel('Sí, reiniciar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cl_no_${ch.id}_${i.user.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary))] });
});
async function cleanButton(i) {
  const [, act, chId, uid] = i.customId.split('_');
  if (i.user.id !== uid) return no(i, 'Este botón no es tuyo.');
  if (act === 'no') return i.update({ embeds: [E(i.guildId, '❎ Cancelado', 'No se borró nada.')], components: [] });
  if (!i.member.permissions.has(P.ManageChannels)) return no(i, 'Necesitas el permiso **ManageChannels**.');
  const ch = i.guild.channels.cache.get(chId), bad = cleanIssue(i.guild, ch, true);
  if (bad) return i.update({ embeds: [E(i.guildId, '❌ Error', `No puedo reiniciar: ${bad}.`)], components: [] });
  await i.update({ embeds: [E(i.guildId, '⏳ Reiniciando canal...', 'Un momento.')], components: [] });
  try {
    const nc = await nukeChannel(ch, i.user);
    lg(i.guildId, 'mod', E(i.guildId, '🧹 Canal reiniciado', `**Moderador:** ${i.user}\n**Canal:** #${ch.name} → ${nc}`));
    await i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Canal reiniciado: ${nc}`)] }).catch(() => {});
  } catch (err) { await i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude reiniciar el canal: ${err.message}`)] }).catch(() => {}); }
}
def('limpiar', 'auto', 'Limpieza automática de un canal cada X horas', 'canal:c!,horas:i!,modo:s', 'ManageGuild', (i, o, g, cf) => {
  const mode = o.modo === 'canal' ? 'canal' : 'mensajes', bad = cleanIssue(i.guild, o.canal, mode === 'canal'); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  if (o.horas < 1 || o.horas > 720) return no(i, '`horas` debe estar entre 1 y 720.');
  if (g.tickets[o.canal.id]) return no(i, 'Eso es un ticket.');
  (cf.clean ??= {})[o.canal.id] = { hours: o.horas, mode, last: Date.now() }; save();
  ok(i, `${o.canal} se limpiará cada **${o.horas} h** (${mode === 'canal' ? 'reinicio completo del canal' : 'borrando mensajes recientes; los fijados se conservan'}).\nPróxima limpieza ${when(o.horas * 36e5)}.`);
});
def('limpiar', 'autoquitar', 'Quita la limpieza automática de un canal', 'canal:c!', 'ManageGuild', (i, o, g, cf) => {
  if (!cf.clean?.[o.canal.id]) return no(i, 'Ese canal no tiene limpieza automática.');
  delete cf.clean[o.canal.id]; save(); ok(i, `Limpieza automática de ${o.canal} desactivada.`);
});
def('limpiar', 'autolista', 'Lista las limpiezas automáticas', '', 'ManageGuild', (i, o, g, cf) => {
  const L = Object.entries(cf.clean || {}).map(([id, c]) => `<#${id}> — cada **${c.hours} h** · ${c.mode === 'canal' ? 'reinicio completo' : 'mensajes recientes'} · próxima ${when(Math.max(0, c.last + c.hours * 36e5 - Date.now()))}`);
  say(i, '🧹 Limpiezas automáticas', L.join('\n') || 'Ninguna. Usa `/limpiar auto`.', true);
});
let cleanBusy = false;
async function cleanTick() {
  if (cleanBusy) return; cleanBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), cl = g.cfg?.clean; if (!guild || !cl) continue;
      for (const [cid, c] of Object.entries(cl)) {
        if (Date.now() - c.last < c.hours * 36e5) continue;
        const ch = guild.channels.cache.get(cid); if (!ch) { delete cl[cid]; save(); continue; }
        c.last = Date.now(); save();
        const bad = cleanIssue(guild, ch, c.mode === 'canal');
        if (bad) { lg(gid, 'mod', E(gid, '⚠️ Limpieza automática fallida', bad)); continue; }
        try {
          if (c.mode === 'canal') { await nukeChannel(ch, client.user); lg(gid, 'mod', E(gid, '🧹 Limpieza automática', `Canal #${ch.name} reiniciado.`)); }
          else {
            const r = await cleanMessages(ch, { limit: 5000 }); lg(gid, 'mod', E(gid, '🧹 Limpieza automática', `${ch}: **${r.deleted}** mensajes borrados.`));
            if (r.deleted) ch.send({ embeds: [E(gid, '🧹 Limpieza automática', `**${r.deleted}** mensajes borrados.`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 8000)).catch(() => {});
          }
        } catch (err) { lg(gid, 'mod', E(gid, '⚠️ Limpieza automática fallida', `${ch}: ${err.message}`)); }
      }
    }
  } finally { cleanBusy = false; }
}

/* ============ 15. ESTADO DEL SERVIDOR · MIEMBROS EN VOZ (7) ============ */
// Un canal de voz bloqueado que se renombra solo ("🔊 En VC: 7"), un panel en vivo y /estado ver.
// Discord limita el renombrado de canales a 2 veces cada 10 min, así que el nombre se refresca como máximo cada ~5 min;
// el panel (mensaje) se edita en cuanto cambia algo (revisión cada 20 s).
// Variables del formato: {n} en voz · {humanos} · {bots} · {canales} canales con gente · {total} miembros del servidor
const VC_FMT = '🔊 En VC: {n}';
const vcStats = (guild, withBots) => {
  const per = new Map(); let humans = 0, bots = 0;
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId) continue;
    const isBot = vs.member?.user.bot ?? false; isBot ? bots++ : humans++;
    if (isBot && !withBots) continue;
    per.set(vs.channelId, (per.get(vs.channelId) || 0) + 1);
  }
  return { n: withBots ? humans + bots : humans, humans, bots, per };
};
const vcVars = (guild, st) => ({ n: st.n, humanos: st.humans, bots: st.bots, canales: st.per.size, total: guild.memberCount });
function vcEmbed(guild, s) {
  const st = vcStats(guild, !!s.bots);
  const rows = [...st.per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, c]) => `<#${id}> — **${c}**`);
  const e = E(guild.id, '📊 Estado del servidor').addFields(
    { name: '🔊 En voz ahora', value: `**${st.n}**`, inline: true }, { name: '🤖 Bots en voz', value: `${st.bots}`, inline: true },
    { name: '📡 Canales con gente', value: `${st.per.size}`, inline: true }, { name: '👥 Miembros', value: `${guild.memberCount}`, inline: true },
    { name: 'Quién está dónde', value: (rows.join('\n') || 'Nadie en canales de voz.').slice(0, 1024) }).setFooter({ text: 'Se actualiza automáticamente' });
  if (guild.iconURL()) e.setThumbnail(guild.iconURL());
  return e;
}
const vcSig = new Map();
async function vcUpdate(guild, force = false) {
  const s = C(guild.id).vcs; if (!s) return;
  const st = vcStats(guild, !!s.bots), now = Date.now();
  if (s.ch) {
    const ch = guild.channels.cache.get(s.ch);
    if (!ch) { s.ch = null; save(); }
    else {
      const name = fmt(s.fmt || VC_FMT, vcVars(guild, st)).slice(0, 100) || '🔊 En VC';
      if (name !== ch.name && (force || now - (s.lastRename || 0) > 310000)) {
        s.lastRename = now; save(); // se marca antes de pedir el cambio: si falla, no se insiste cada 20 s
        await ch.setName(name, 'Estado del servidor: miembros en voz').catch(err => console.warn(`[estado] no pude renombrar ${ch.id}: ${err.message}`));
      }
    }
  }
  if (s.panelCh && s.panelMsg) {
    const sig = `${st.n}|${st.bots}|${[...st.per].join(',')}|${guild.memberCount}`;
    if (force || vcSig.get(guild.id) !== sig) {
      vcSig.set(guild.id, sig);
      const pc = guild.channels.cache.get(s.panelCh), msg = pc ? await pc.messages.fetch(s.panelMsg).catch(() => null) : null;
      if (!msg) { s.panelCh = null; s.panelMsg = null; save(); }
      else await msg.edit({ embeds: [vcEmbed(guild, s)] }).catch(err => console.warn(`[estado] no pude editar el panel: ${err.message}`));
    }
  }
}
let vcBusy = false;
async function vcTick() {
  if (vcBusy) return; vcBusy = true;
  try { for (const guild of client.guilds.cache.values()) if (DB[guild.id]?.cfg?.vcs) await vcUpdate(guild).catch(err => console.warn('[estado]', err.message)); }
  finally { vcBusy = false; }
}
def('estado', 'setup', 'Crea el canal de voz contador de miembros en VC (se actualiza solo)', 'categoria:c,formato:s', 'ManageGuild', async (i, o, g, cf) => {
  const me = i.guild.members.me, s = (cf.vcs ??= {});
  if (s.ch && i.guild.channels.cache.has(s.ch)) return no(i, `Ya hay un contador: <#${s.ch}>. Quítalo antes con \`/estado quitar\`.`);
  if (!me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  if (o.formato) s.fmt = nl(o.formato).slice(0, 100);
  await i.deferReply({ flags: 64 });
  try {
    const name = fmt(s.fmt || VC_FMT, vcVars(i.guild, vcStats(i.guild, !!s.bots))).slice(0, 100);
    const ch = await i.guild.channels.create({ name, type: ChannelType.GuildVoice, parent: o.categoria?.id ?? null, reason: 'Contador de miembros en voz',
      permissionOverwrites: [{ id: i.guild.id, allow: [P.ViewChannel], deny: [P.Connect] }, { id: me.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] }] });
    if (!o.categoria) await ch.setPosition(0).catch(() => {});
    s.ch = ch.id; s.lastRename = Date.now(); save();
    i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Contador creado: ${ch}\nNadie puede entrar a ese canal; solo muestra cuánta gente hay en VC.\nSe actualiza solo (cada ~5 min por el límite de Discord). Para un panel en vivo usa \`/estado panel\`.`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear el canal: ${err.message}`)] }); }
});
def('estado', 'canal', 'Usa un canal de voz que ya existe como contador', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  if (!o.canal.permissionsFor(i.guild.members.me)?.has(P.ManageChannels)) return no(i, `Al bot le falta **Gestionar canales** en ${o.canal}.`);
  const s = (cf.vcs ??= {}); s.ch = o.canal.id; s.lastRename = 0; save();
  await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `${o.canal} ahora muestra los miembros en VC.`)] });
});
def('estado', 'formato', 'Nombre del contador. Variables: {n} {humanos} {bots} {canales} {total}', 'formato:s!', 'ManageGuild', async (i, o, g, cf) => {
  const s = (cf.vcs ??= {}); s.fmt = nl(o.formato).slice(0, 100); save();
  const prev = fmt(s.fmt, vcVars(i.guild, vcStats(i.guild, !!s.bots)));
  await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Formato guardado. Se verá así: **${prev}**${s.ch ? '' : '\nAún no hay canal contador: usa `/estado setup`.'}`)] });
});
def('estado', 'contar', 'Incluir o no a los bots en el conteo de VC', 'bots:b!', 'ManageGuild', async (i, o, g, cf) => {
  const s = (cf.vcs ??= {}); s.bots = o.bots; save(); await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Los bots **${o.bots ? 'sí' : 'no'}** cuentan en el total de VC.`)] });
});
def('estado', 'panel', 'Publica un panel de estado que se actualiza solo', 'texto:c', 'ManageGuild', async (i, o, g, cf) => {
  const ch = o.texto ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar ahí: ${ci}.`);
  const s = (cf.vcs ??= {}); await i.deferReply({ flags: 64 });
  if (s.panelCh && s.panelMsg) await i.guild.channels.cache.get(s.panelCh)?.messages.delete(s.panelMsg).catch(() => {}); // solo un panel por servidor
  try { const m = await ch.send({ embeds: [vcEmbed(i.guild, s)] }); s.panelCh = ch.id; s.panelMsg = m.id; save(); }
  catch (err) { return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude enviar el panel: ${err.message}`)] }); }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Panel publicado en ${ch}. Se edita solo cuando alguien entra o sale de un VC.`)] });
});
def('estado', 'ver', 'Cuánta gente hay en canales de voz ahora mismo', '', null, (i, o, g, cf) => i.reply({ embeds: [vcEmbed(i.guild, cf.vcs || {})] }));
def('estado', 'quitar', 'Desactiva el estado de voz (borrar:true elimina también el canal y el panel)', 'borrar:b', 'ManageGuild', async (i, o, g, cf) => {
  const s = cf.vcs; if (!s) return no(i, 'No hay estado de voz configurado.');
  if (o.borrar) {
    if (s.ch) await i.guild.channels.cache.get(s.ch)?.delete('Estado de voz desactivado').catch(() => {});
    if (s.panelCh && s.panelMsg) await i.guild.channels.cache.get(s.panelCh)?.messages.delete(s.panelMsg).catch(() => {});
  }
  delete cf.vcs; vcSig.delete(i.guildId); save(); ok(i, `Estado de voz desactivado${o.borrar ? ' y canal/panel eliminados' : ' (el canal y el panel se quedan como están)'}.`);
});

/* ========================= 15. SERVERSTATS (7) ========================= */
// Canales de voz bloqueados cuyo nombre se actualiza solo: "👥 Miembros: 1234".
// Discord limita el renombrado de canales (2 cambios / 10 min por canal), por eso el intervalo mínimo es 5 min.
// Formato personalizable con variables: {count} {goal} {pct} {left} {server}
const STATS = { // clave: [nombre, formato por defecto, función que da el número]
  miembros: ['Miembros', '👥 Miembros: {count}', g => g.memberCount],
  humanos: ['Personas (sin bots)', '🙋 Personas: {count}', g => g.members.cache.filter(m => !m.user.bot).size],
  bots: ['Bots', '🤖 Bots: {count}', g => g.members.cache.filter(m => m.user.bot).size],
  envoz: ['Conectados en voz', '🔊 En voz: {count}', g => g.voiceStates.cache.filter(v => v.channelId).size],
  canales: ['Canales (total)', '📁 Canales: {count}', g => g.channels.cache.filter(c => c.type !== ChannelType.GuildCategory && !c.isThread?.()).size],
  texto: ['Canales de texto', '💬 Texto: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size],
  voz: ['Canales de voz', '🎙️ Voz: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size],
  categorias: ['Categorías', '🗂️ Categorías: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size],
  roles: ['Roles', '🎭 Roles: {count}', g => Math.max(0, g.roles.cache.size - 1)],
  emojis: ['Emojis', '😀 Emojis: {count}', g => g.emojis.cache.size],
  stickers: ['Stickers', '🏷️ Stickers: {count}', g => g.stickers.cache.size],
  boosts: ['Boosts', '🚀 Boosts: {count}', g => g.premiumSubscriptionCount || 0],
  nivel: ['Nivel de boost', '💎 Nivel: {count}', g => Number(g.premiumTier) || 0],
  tickets: ['Tickets abiertos', '🎫 Tickets: {count}', g => Object.keys(G(g.id).tickets).length],
  meta: ['Meta (objetivo)', '🎯 Meta: {count}/{goal}', null],
};
CHO['stats.tipo'] = [...Object.entries(STATS).map(([k, v]) => [v[0], k]), ['Todos (paquete básico)', 'todos']];
const STATS_PACK = ['miembros', 'bots', 'canales', 'roles', 'emojis', 'boosts'];
const SC = cf => (cf.stats ??= { items: {}, every: 10, abbr: false });
const statNum = (g, key) => STATS[key][2](g);
const shortNum = (n, ab) => {
  if (!ab) return String(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
};
const okFmt = f => /\{(count|goal|pct|left)\}/.test(f);
function statName(guild, key, it, cf) {
  const st = SC(cf); let v;
  if (key === 'meta') {
    const gl = st.goal, c = gl ? statNum(guild, gl.of) : 0, t = gl?.target || 0;
    v = { count: shortNum(c, st.abbr), goal: shortNum(t, st.abbr), pct: t ? Math.min(100, Math.round(c / t * 100)) : 0, left: shortNum(Math.max(0, t - c), st.abbr) };
  } else v = { count: shortNum(statNum(guild, key), st.abbr) };
  return fmt(it.fmt ?? STATS[key][1], { ...v, server: guild.name }).slice(0, 100);
}
async function updateStats(guild) {
  const cf = C(guild.id), st = SC(cf), out = { renamed: 0, fail: [] }, me = guild.members.me;
  const needM = Object.keys(st.items).some(k => k === 'humanos' || k === 'bots' || (k === 'meta' && ['humanos', 'bots'].includes(st.goal?.of)));
  if (needM && guild.members.cache.size < guild.memberCount) await guild.members.fetch().catch(() => {});
  for (const [key, it] of Object.entries(st.items)) {
    const ch = guild.channels.cache.get(it.ch);
    if (!ch) { delete st.items[key]; save(); continue; } // el canal se borró a mano
    const name = statName(guild, key, it, cf); if (ch.name === name) continue;
    if (!ch.permissionsFor(me)?.has(P.ManageChannels)) { out.fail.push(`${ch}: falta **Gestionar canales**`); continue; }
    try { await Promise.race([ch.setName(name, 'ServerStats'), new Promise(r => setTimeout(r, 20000))]); out.renamed++; }
    catch (err) { out.fail.push(`${ch}: ${err.message}`); }
  }
  st.last = Date.now();
  if (out.fail.length && !st.warned) { st.warned = true; lg(guild.id, 'general', E(guild.id, '⚠️ ServerStats con problemas', out.fail.join('\n'))); }
  if (!out.fail.length) st.warned = false;
  save(); return out;
}
async function mkStatChannel(guild, st) {
  const me = guild.members.me, ow = [{ id: guild.id, allow: [P.ViewChannel], deny: [P.Connect] }, { id: me.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] }];
  let cat = st.cat && guild.channels.cache.get(st.cat);
  if (cat?.type !== ChannelType.GuildCategory) {
    cat = await guild.channels.create({ name: '📊 ESTADÍSTICAS', type: ChannelType.GuildCategory, position: 0, permissionOverwrites: ow, reason: 'ServerStats' });
    st.cat = cat.id;
  }
  return guild.channels.create({ name: '📊 cargando...', type: ChannelType.GuildVoice, parent: cat.id, permissionOverwrites: ow, reason: 'ServerStats' });
}
const statsErr = (i, d) => i.editReply({ embeds: [E(i.guildId, '❌ Error', d)] });
def('stats', 'crear', 'Crea un canal de estadística (o el paquete básico con "todos")', 'tipo:s!,canal:c,formato:s', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf);
  if (!i.guild.members.me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  if (o.formato && !okFmt(o.formato)) return no(i, 'El formato debe incluir `{count}` (en la meta también `{goal}`, `{pct}` o `{left}`).');
  if (o.tipo === 'meta' && !st.goal) return no(i, 'Primero define la meta con `/stats meta`.');
  if (o.canal && (!o.canal.permissionsFor(i.guild.members.me)?.has(P.ManageChannels) || Object.values(st.items).some(x => x.ch === o.canal.id))) return no(i, `No puedo usar ${o.canal}: el bot necesita **Gestionar canales** en él y no puede estar ya en uso.`);
  const types = o.tipo === 'todos' ? STATS_PACK.filter(k => !st.items[k]) : [o.tipo];
  if (types.length === 1 && st.items[types[0]] && i.guild.channels.cache.has(st.items[types[0]].ch)) return no(i, `Ya existe: <#${st.items[types[0]].ch}>. Usa \`/stats formato\` para cambiarlo o \`/stats quitar\`.`);
  if (!types.length) return no(i, 'El paquete básico ya está instalado.');
  await i.deferReply({ flags: 64 }); const made = [];
  for (const k of types) {
    if (st.items[k] && i.guild.channels.cache.has(st.items[k].ch)) continue;
    try {
      const ch = o.canal && types.length === 1 ? o.canal : await mkStatChannel(i.guild, st);
      st.items[k] = { ch: ch.id, ...(o.formato && types.length === 1 ? { fmt: o.formato } : {}) }; made.push(`${ch}`);
    } catch (err) { save(); return statsErr(i, `No pude crear el canal: ${err.message}`); }
  }
  save(); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Creado: ${made.join(' ')}\nSe actualizan solos cada **${st.every} min**. Personaliza el texto con \`/stats formato\`.${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}`)] });
});
def('stats', 'formato', 'Personaliza el texto. Variables: {count} {goal} {pct} {left} {server}. "restaurar" = por defecto', 'tipo:s!,formato:s!', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf), it = st.items[o.tipo];
  if (o.tipo === 'todos') return no(i, 'Elige una estadística concreta.');
  if (!it) return no(i, 'Esa estadística no está creada. Usa `/stats crear`.');
  if (/^restaurar$/i.test(o.formato.trim())) delete it.fmt;
  else { if (!okFmt(o.formato)) return no(i, 'El formato debe incluir `{count}` (en la meta también `{goal}`, `{pct}` o `{left}`).'); it.fmt = o.formato; }
  save(); await i.deferReply({ flags: 64 }); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '✅ Formato actualizado', `Quedará así: **${statName(i.guild, o.tipo, it, cf)}**${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}`)] });
});
def('stats', 'meta', 'Define la meta del canal de meta (qué contar y el objetivo)', 'objetivo:i!,tipo:s', 'ManageGuild', async (i, o, g, cf) => {
  const st = SC(cf), of = o.tipo || 'miembros';
  if (!STATS[of] || of === 'meta' || of === 'todos') return no(i, 'Elige una estadística concreta para medir (por ejemplo Miembros o Boosts).');
  if (o.objetivo < 1) return no(i, 'El objetivo debe ser mayor que 0.');
  st.goal = { target: o.objetivo, of }; save(); await i.deferReply({ flags: 64 });
  if (st.items.meta) await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '🎯 Meta guardada', `Objetivo: **${o.objetivo}** (${STATS[of][0]}). Actual: **${statNum(i.guild, of)}**.${st.items.meta ? '' : '\nCrea el canal con `/stats crear tipo:Meta`.'}`)] });
});
def('stats', 'quitar', 'Quita una estadística (o todas). borrar:true también elimina el canal', 'tipo:s!,borrar:b', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf), ks = o.tipo === 'todos' ? Object.keys(st.items) : [o.tipo];
  if (!ks.some(k => st.items[k])) return no(i, 'No hay nada que quitar.');
  await i.deferReply({ flags: 64 }); let n = 0;
  for (const k of ks) {
    const it = st.items[k]; if (!it) continue;
    if (o.borrar) await i.guild.channels.cache.get(it.ch)?.delete('ServerStats: quitar').catch(() => {});
    delete st.items[k]; n++;
  }
  const cat = st.cat && i.guild.channels.cache.get(st.cat);
  if (o.borrar && cat && !Object.keys(st.items).length && !i.guild.channels.cache.some(c => c.parentId === cat.id)) { await cat.delete('ServerStats: sin canales').catch(() => {}); st.cat = null; }
  save(); i.editReply({ embeds: [E(i.guildId, '✅ Listo', `**${n}** estadística(s) quitada(s)${o.borrar ? ' y canal(es) eliminado(s)' : ' (los canales se conservan; bórralos a mano o usa `borrar:true`)'}.`)] });
});
def('stats', 'lista', 'Ver las estadísticas configuradas', '', 'ManageChannels', (i, o, g, cf) => {
  const st = SC(cf), L = Object.entries(st.items).map(([k, it]) => `<#${it.ch}> · **${STATS[k][0]}** → ${statName(i.guild, k, it, cf)}${it.fmt ? ' ✏️' : ''}`);
  const gl = st.goal ? `\n\n🎯 Meta: **${st.goal.target}** de ${STATS[st.goal.of][0]}` : '';
  say(i, '📊 ServerStats', (L.join('\n') || 'Ninguna. Usa `/stats crear`.') + gl + `\n\n⏱️ Actualiza cada **${st.every} min** · Abreviar números: **${st.abbr ? 'sí' : 'no'}**`, true);
});
def('stats', 'actualizar', 'Actualiza ahora todos los canales de estadísticas', '', 'ManageChannels', async (i) => {
  await i.deferReply({ flags: 64 }); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '🔄 Actualizado', `**${r.renamed}** canal(es) renombrado(s).${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}\n-# Discord permite renombrar cada canal 2 veces cada 10 min.`)] });
});
def('stats', 'ajustes', 'Intervalo (5-120 min), abreviar números (1.2k) y categoría donde crear', 'intervalo:i,abreviar:b,categoria:c', 'ManageGuild', (i, o, g, cf) => {
  const st = SC(cf);
  if (o.intervalo != null) { if (o.intervalo < 5 || o.intervalo > 120) return no(i, '`intervalo` debe estar entre 5 y 120 minutos.'); st.every = o.intervalo; }
  if (o.abreviar != null) st.abbr = o.abreviar;
  if (o.categoria) st.cat = o.categoria.id;
  save(); updateStats(i.guild).catch(console.error);
  ok(i, `⏱️ Intervalo: **${st.every} min**\n🔢 Abreviar números: **${st.abbr ? 'sí' : 'no'}**\n🗂️ Categoría para nuevos canales: ${st.cat ? `<#${st.cat}>` : 'se crea automáticamente'}`);
});
let statsBusy = false;
async function statsTick() {
  if (statsBusy) return; statsBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), st = g.cfg?.stats;
      if (!guild || !st?.items || !Object.keys(st.items).length || Date.now() - (st.last || 0) < (st.every || 10) * 60000) continue;
      await updateStats(guild).catch(console.error);
    }
  } finally { statsBusy = false; }
}

/* ===================== 16. CREA TU VC · ESTILO TEMPVOICE (6) ===================== */
// Un canal de voz "disparador": al entrar ahí, el bot crea un canal de voz privado para esa persona
// (dentro de la categoría indicada) y la mueve adentro. En vez de un panel por canal, se publica UNA
// interfaz fija (embed personalizable: título, descripción, imagen y color) en el canal de texto que
// elijas; sus botones siempre actúan sobre el canal de voz temporal al que esté conectado quien los pulse.
// Incluye privacidad (público/privado/oculto), sala de espera con aprobación, chat del canal, confiar/
// bloquear usuarios, invitar, región de voz, reclamar, transferir dueño y eliminar.
const VCC = cf => (cf.vcc ??= {});
const VCR = g => (g.vcrooms ??= {});
const VCC_REGIONS = [['🌍 Automático', 'auto'], ['🇧🇷 Brasil', 'brazil'], ['🇭🇰 Hong Kong', 'hongkong'], ['🇮🇳 India', 'india'],
  ['🇯🇵 Japón', 'japan'], ['🇳🇱 Países Bajos', 'rotterdam'], ['🇷🇺 Rusia', 'russia'], ['🇸🇬 Singapur', 'singapore'],
  ['🇿🇦 Sudáfrica', 'southafrica'], ['🇦🇺 Sídney', 'sydney'], ['🇺🇸 EE.UU. Centro', 'us-central'],
  ['🇺🇸 EE.UU. Este', 'us-east'], ['🇺🇸 EE.UU. Sur', 'us-south'], ['🇺🇸 EE.UU. Oeste', 'us-west']];
// [nombre interno, emoji, etiqueta]. Mismo diseño que el panel de referencia (botones con texto).
const VCC_BTNS = [['name', '✏️', 'Nombre'], ['limit', '👥', 'Límite'], ['privacy', '🔒', 'Acceso'], ['hide', '👁️', 'Ocultar'], ['invite', '✉️', 'Invitar'],
  ['block', '🚫', 'Bloquear'], ['kick', '↗️', 'Retirar'], ['transfer', '🔄', 'Ceder'], ['claim', '👑', 'Reclamar'], ['banner', '🖼️', 'Banner']];
const VCC_LAYOUT = [3, 3, 2, 2];
const VCC_FONT = '"Poppins","Inter","Segoe UI","DejaVu Sans","Noto Sans","Liberation Sans",Arial,sans-serif';
// Banner del panel (imagen dibujada): fondo editable, textos editables y la imagen del servidor en el cuadro de la derecha.
// Se edita con /voz banner (titulo, lema, subtitulo, fondo).
async function vccBanner(guild, cf, room) {
  if (!CV) return null;
  try {
    const c = VCC(cf), b = { ...(c.bn || {}), ...(room?.bn || {}) }, W = 1000, H = 300, F = VCC_FONT;
    const cv = CV.createCanvas(W, H), ctx = cv.getContext('2d');
    ctx.save(); roundRect(ctx, 0, 0, W, H, 28); ctx.clip();
    const fondo = b.fondo ? await nivelFondo(b.fondo) : null;
    if (fondo) { const k = Math.max(W / fondo.width, H / fondo.height), w = fondo.width * k, h = fondo.height * k; ctx.drawImage(fondo, (W - w) / 2, (H - h) / 2, w, h); ctx.fillStyle = 'rgba(6,6,10,0.55)'; ctx.fillRect(0, 0, W, H); }
    else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#08090d'); g.addColorStop(1, '#12141c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    roundRect(ctx, 1, 1, W - 2, H - 2, 28); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `400 17px ${F}`;
    ctx.fillText(String(b.lema || 'TU COMUNIDAD, TU MUNDO').toUpperCase().slice(0, 40), 60, 80);
    ctx.fillStyle = '#f5f6fa'; let fs = 56; const titulo = String(b.titulo || `${c.brand || 'Club 24/7'} VOICE`).toUpperCase().slice(0, 28);
    ctx.font = `300 ${fs}px ${F}`; while (ctx.measureText(titulo).width > 560 && fs > 26) { fs -= 2; ctx.font = `300 ${fs}px ${F}`; }
    ctx.fillText(titulo, 60, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `300 22px ${F}`; ctx.fillText(String(b.subtitulo || 'Tu voz. Tu espacio.').slice(0, 40), 60, 215);
    const bx = 690, by = 40, bs = 220;
    roundRect(ctx, bx, by, bs, bs, 40); ctx.fillStyle = 'rgba(18,20,28,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.stroke();
    let ic = null; const iu = guild.iconURL({ extension: 'png', size: 512 });
    if (iu) { try { const r = await fetch(iu, { signal: AbortSignal.timeout(8000) }); if (r.ok) ic = await CV.loadImage(Buffer.from(await r.arrayBuffer())); } catch {} }
    if (ic) { ctx.save(); roundRect(ctx, bx + 14, by + 14, bs - 28, bs - 28, 28); ctx.clip(); ctx.drawImage(ic, bx + 14, by + 14, bs - 28, bs - 28); ctx.restore(); }
    else { ctx.textAlign = 'center'; ctx.fillStyle = '#f5f6fa'; ctx.font = `300 78px ${F}`; ctx.fillText(guild.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(), bx + bs / 2, by + bs / 2 + 26); }
    return new AttachmentBuilder(cv.toBuffer('image/png'), { name: 'voz_banner.png' });
  } catch (e) { console.warn('[voz] no pude dibujar el banner:', e.message); return null; }
}
// Interfaz completa. Con `member` y `ch` es la del canal temporal; sin ellos es el panel fijo.
async function vccUi(guild, cf, member, ch, room) {
  const c = VCC(cf), v = c.emb || {}, brand = c.brand || 'Club 24/7', col = Number.isInteger(v.color) ? v.color : 0x2b2d31;
  const trig = c.trig ? `<#${c.trig}>` : 'el canal disparador';
  const intro = fmt(v.desc || (member ? `Sala de ${member}. Gestiona tu canal con los botones de abajo.` : `Entra en ${trig} para abrir una sala nueva.`), { user: member ? `${member}` : 'tú', canal: ch ? `${ch}` : 'tu canal' });
  const foot = v.footer || `Ceder: transferir la sala · Reclamar: si falta su dueño.\n${brand} VOICE · Se elimina al quedar vacía.`;
  const title = v.title || 'Tu voz. Tu espacio.';
  const att = url(v.banner) ? null : await vccBanner(guild, cf, room), img = url(v.banner) || (att ? 'attachment://voz_banner.png' : null);
  const rows = []; let k = 0;
  for (const n of VCC_LAYOUT) { rows.push(new ActionRowBuilder().addComponents(VCC_BTNS.slice(k, k + n).map(([id, emoji, label]) => new ButtonBuilder().setCustomId(`vcc_${id}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary)))); k += n; }
  const files = att ? [att] : [];
  if (!ContainerBuilder) { // discord.js viejo: embed normal
    const e = new EmbedBuilder().setColor(col).setTitle(title).setDescription(`${intro}\n\n-# ${foot.replace(/\n/g, ' ')}`); if (img) e.setImage(img);
    return { embeds: [e], components: rows, files };
  }
  const cont = new ContainerBuilder().setAccentColor(col);
  if (img) cont.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img)));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**\n${intro}`));
  cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  for (const r of rows) cont.addActionRowComponents(r);
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(foot.split('\n').map(l => `-# ${l}`).join('\n')));
  return { components: [cont], flags: 1 << 15, files };
}
def('voz', 'setup', 'Canal disparador (voz) y categoría donde se crean los canales', 'disparador:c!,categoria:c!,nombre:s', 'ManageGuild', (i, o, g, cf) => {
  if (o.disparador.type !== ChannelType.GuildVoice) return no(i, `${o.disparador} debe ser un canal de **voz**.`);
  if (o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} debe ser una **categoría**.`);
  if (!i.guild.members.me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  const c = VCC(cf); c.trig = o.disparador.id; c.cat = o.categoria.id; if (o.nombre) c.name = nl(o.nombre).slice(0, 90);
  save(); ok(i, `🔊 Disparador: ${o.disparador}\n📁 Categoría: ${o.categoria}\n📛 Nombre: **${c.name || '🔊 Canal de {user}'}**\n\nPersonaliza la interfaz con \`/voz embed\` y publícala con \`/voz panel\`.`);
});
def('voz', 'embed', 'Personaliza la interfaz: título, descripción, color (barra), banner (arriba), imagen (abajo), miniatura, pie', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s', 'ManageGuild', (i, o, g, cf) => {
  const c = VCC(cf);
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  c.emb = { ...c.emb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete c.emb[key];
  save(); ok(i, 'Interfaz actualizada. Se usará en cada canal nuevo; usa `/voz panel` para republicar el panel fijo.');
});
def('voz', 'banner', 'Edita el banner del panel: textos y fondo (link de imagen). Escribe "quitar" en fondo para quitarlo', 'titulo:s,lema:s,subtitulo:s,fondo:s,nombre:s', 'ManageGuild', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 }); const c = VCC(cf); c.bn ??= {};
  if (o.nombre) c.brand = o.nombre.trim().slice(0, 30);
  if (o.titulo) c.bn.titulo = o.titulo.trim().slice(0, 28);
  if (o.lema) c.bn.lema = o.lema.trim().slice(0, 40);
  if (o.subtitulo) c.bn.subtitulo = o.subtitulo.trim().slice(0, 40);
  if (o.fondo) {
    if (/^(quitar|ninguna)$/i.test(o.fondo.trim())) delete c.bn.fondo;
    else { if (!url(o.fondo.trim())) return i.editReply('⚠️ El fondo debe ser un link que empiece con https://'); if (!CV) return i.editReply('⚠️ Falta instalar @napi-rs/canvas (npm install).');
      if (!(await nivelFondo(o.fondo.trim()))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo a .png, .jpg o .gif de menos de 8 MB.'); c.bn.fondo = o.fondo.trim(); }
  }
  save(); const p = await vccUi(i.guild, cf);
  await i.editReply({ ...p }).then(() => i.followUp({ flags: 64, content: '🖼️ Banner guardado. Arriba ves cómo queda; usa `/voz panel` para republicar el panel.' })).catch(() => i.editReply('🖼️ Banner guardado. Usa `/voz panel` para republicar el panel.').catch(() => {}));
});
def('voz', 'interfaz', 'Activa/desactiva enviar la interfaz de control al chat de cada canal nuevo', 'estado:b!', 'ManageGuild', (i, o, g, cf) => {
  VCC(cf).ui = o.estado; save(); ok(i, `Interfaz automática en cada canal: **${o.estado ? '🟢 activada' : '🔴 desactivada'}**.`);
});
def('voz', 'panel', 'Publica (o republica) la interfaz fija en un canal de texto', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  if (!VCC(cf).trig) return no(i, 'Primero configura el disparador con `/voz setup`.');
  try { await o.canal.send(await vccUi(i.guild, cf)); }
  catch (err) { return no(i, `No pude publicar la interfaz: ${err.message}`); }
  ok(i, `Interfaz publicada en ${o.canal}.`);
});
def('voz', 'estado', 'Ver configuración de "Crea tu VC"', '', 'ManageGuild', (i, o, g, cf) => {
  const c = VCC(cf); if (!c.trig) return say(i, '🎚️ Crea tu VC', 'No configurado. Usa `/voz setup`.');
  say(i, '🎚️ Crea tu VC', `🔊 Disparador: <#${c.trig}>\n📁 Categoría: <#${c.cat}>\n📛 Nombre: **${c.name || '🔊 Canal de {user}'}**\n🔢 Canales activos: **${Object.keys(VCR(g)).length}**`);
});
def('voz', 'desactivar', 'Desactiva "Crea tu VC" (borrar:true también elimina los canales activos)', 'borrar:b', 'ManageGuild', async (i, o, g, cf) => {
  if (o.borrar) for (const id of Object.keys(VCR(g))) await i.guild.channels.cache.get(id)?.delete('Crea tu VC desactivado').catch(() => {});
  delete cf.vcc; g.vcrooms = {}; save(); ok(i, `Sistema desactivado${o.borrar ? ' y canales eliminados' : ' (los canales activos se quedan hasta vaciarse)'}.`);
});
// Recalcula TODOS los permisos del canal a partir del estado guardado (modo, confianza, bloqueados, chat).
async function vccApplyPerms(ch, room) {
  // Permisos según el modo del canal (público / privado / oculto) y el chat
  const base = { allow: [], deny: [] };
  if (room.mode === 'hidden') base.deny.push(P.ViewChannel, P.Connect);
  else if (room.mode === 'private') { base.allow.push(P.ViewChannel); room.waiting ? base.allow.push(P.Connect) : base.deny.push(P.Connect); } // con sala de espera deben poder conectarse para pasar por aprobación
  else base.allow.push(P.ViewChannel, P.Connect);
  room.chatOpen === false ? base.deny.push(P.SendMessages) : base.allow.push(P.SendMessages);
  // Si hay rol de verificación configurado (/verif setup), @everyone NO ve ningún VC creado: solo lo ven los verificados.
  const vr = C(ch.guild.id).v?.role, vRole = vr && vr !== ch.guild.id ? ch.guild.roles.cache.get(vr) : null;
  const gate = vRole
    ? [{ id: ch.guild.id, allow: [], deny: [P.ViewChannel, P.Connect, P.SendMessages] }, { id: vRole.id, ...base }]
    : [{ id: ch.guild.id, ...base }]; // sin verificación configurada: se comporta como antes
  const me = ch.guild.members.me.id;
  const ows = [...gate,
    { id: room.owner, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ManageChannels, P.MoveMembers] },
    { id: me, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ManageChannels, P.MoveMembers, P.EmbedLinks] },
    ...room.trust.filter(x => x !== room.owner).map(uid => ({ id: uid, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages] })),
    ...room.block.map(uid => ({ id: uid, deny: [P.ViewChannel, P.Connect] }))];
  await ch.permissionOverwrites.set(ows, 'Crea tu VC: actualización de permisos').catch(() => {});
}
// Reaplica los permisos a los VC ya creados (para que los que estaban abiertos también queden ocultos para no verificados)
async function vccResync() {
  for (const gu of client.guilds.cache.values()) {
    const g = G(gu.id);
    for (const [id, room] of Object.entries(VCR(g))) {
      const ch = gu.channels.cache.get(id); if (ch) await vccApplyPerms(ch, room);
    }
  }
}
async function vccWaitChannel(guild, cf) {
  const c = VCC(cf), cat = guild.channels.cache.get(c.cat);
  let ch = c.wait && guild.channels.cache.get(c.wait);
  if (ch) return ch;
  try {
    ch = await guild.channels.create({ name: '🕐 Sala de espera', type: ChannelType.GuildVoice, parent: cat?.id ?? null, reason: 'Crea tu VC: sala de espera',
      permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] }, { id: guild.members.me.id, allow: [P.ViewChannel, P.Connect, P.MoveMembers, P.SendMessages] }] });
  } catch { return null; }
  c.wait = ch.id; save(); return ch;
}
async function vcCreateHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, cf = C(guild.id), c = cf.vcc; if (!c?.trig || state.channelId !== c.trig) return;
  const g = G(guild.id), me = guild.members.me; if (!me.permissions.has(P.ManageChannels)) return;
  const cat = guild.channels.cache.get(c.cat); if (cat?.type !== ChannelType.GuildCategory) return;
  const member = state.member; if (!member || member.user.bot) return;
  const name = fmt(c.name || '🔊 Canal de {user}', { user: member.displayName ?? member.user.username }).slice(0, 90);
  let ch; try { ch = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: cat.id, reason: 'Crea tu VC' }); }
  catch (err) { return console.warn('[crea-tu-vc] no pude crear el canal:', err.message); }
  // Primero se registra y se aplican permisos; después se mueve a la persona (así el canal nunca queda "huérfano")
  const room = { owner: member.id, mode: 'public', chatOpen: true, waiting: false, trust: [], block: [] };
  VCR(g)[ch.id] = room; save(); await vccApplyPerms(ch, room);
  const moved = await member.voice.setChannel(ch).then(() => true).catch(() => false);
  if (!moved) { await ch.delete('Crea tu VC: no se pudo mover al dueño').catch(() => {}); delete VCR(g)[ch.id]; save(); return; }
  if (c.ui !== false) {
    await ch.send({ ...(await vccUi(guild, cf, member, ch, room)), allowedMentions: { users: [member.id] } })
      .catch(err => console.warn(`[crea-tu-vc] no pude enviar la interfaz en ${ch.id}: ${err.message} (el bot necesita Ver canal, Enviar mensajes e Insertar enlaces)`));
  }
}
async function vcCleanupHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, g = G(guild.id), room = VCR(g)[state.channelId]; if (!room) return;
  const ch = guild.channels.cache.get(state.channelId); if (!ch) { delete VCR(g)[state.channelId]; save(); return; }
  if (ch.members.size > 0) return;
  await ch.delete('Crea tu VC: canal vacío').catch(() => {});
  delete VCR(g)[state.channelId]; save();
}
// Si "Sala de espera" está activa en el canal al que alguien se conecta, lo redirige a la sala de espera
// compartida y manda una solicitud (con botones Aceptar/Rechazar) al chat del canal del dueño.
async function vcGateHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, g = G(guild.id), room = VCR(g)[state.channelId]; if (!room || !room.waiting) return;
  const member = state.member; if (!member || member.id === room.owner || room.trust.includes(member.id) || member.permissions.has(P.ManageChannels)) return;
  const ch = guild.channels.cache.get(state.channelId); if (!ch) return;
  const cf = C(guild.id), wait = await vccWaitChannel(guild, cf); if (!wait) return;
  await member.voice.setChannel(wait).catch(() => {});
  try {
    await ch.send({ content: `<@${room.owner}>`, embeds: [E(guild.id, '🕐 Solicitud de entrada', `${member} quiere entrar a tu canal de voz.`)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vcc_wok_${ch.id}_${member.id}`).setLabel('Aceptar').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`vcc_wno_${ch.id}_${member.id}`).setLabel('Rechazar').setEmoji('❌').setStyle(ButtonStyle.Danger))] });
  } catch {}
}
function vccRoom(i) {
  const g = G(i.guildId), chid = i.member.voice.channelId, room = chid && VCR(g)[chid];
  return room ? { ch: i.guild.channels.cache.get(chid), room } : {};
}
async function vccButton(i) {
  if (!i.customId.startsWith('vcc_')) return false;
  const wm = i.customId.match(/^vcc_(wok|wno)_(\d+)_(\d+)$/);
  if (wm) {
    const [, act, chid, uid] = wm, g = G(i.guildId), room = VCR(g)[chid], ch = i.guild.channels.cache.get(chid);
    if (!room || !ch) { await no(i, 'Ese canal ya no existe.'); return true; }
    if (i.user.id !== room.owner && !i.member.permissions.has(P.ManageChannels)) { await no(i, 'Solo el dueño puede responder esta solicitud.'); return true; }
    const wait = guildWaitCh(i.guild, C(i.guildId)); const tm = wait && wait.members.get(uid);
    if (!tm) { await i.update({ embeds: [E(i.guildId, '⌛ Caducado', 'Ese usuario ya no está esperando.')], components: [] }).catch(() => {}); return true; }
    if (act === 'wok') { await tm.voice.setChannel(ch).catch(() => {}); if (!room.trust.includes(uid)) room.trust.push(uid); save(); await vccApplyPerms(ch, room); await i.update({ embeds: [E(i.guildId, '✅ Aceptado', `${tm} entró al canal.`)], components: [] }).catch(() => {}); }
    else { await tm.voice.disconnect('Entrada rechazada').catch(() => {}); await i.update({ embeds: [E(i.guildId, '❌ Rechazado', `${tm} fue rechazado.`)], components: [] }).catch(() => {}); }
    return true;
  }
  const act = i.customId.slice(4);
  if (!['name', 'limit', 'privacy', 'hide', 'banner', 'wait', 'chat', 'trust', 'untrust', 'invite', 'kick', 'region', 'block', 'unblock', 'claim', 'transfer', 'delete', 'bitrate', 'info', 'reset'].includes(act)) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await no(i, 'Debes estar conectado a un canal de voz **temporal** creado por este sistema.'); return true; }
  const isOwner = room.owner === i.user.id || i.member.permissions.has(P.ManageChannels);
  if (act === 'claim') {
    if (ch.members.has(room.owner)) { await no(i, `El dueño (<@${room.owner}>) sigue conectado.`); return true; }
    room.owner = i.user.id; save(); await vccApplyPerms(ch, room);
    await i.reply({ flags: 64, embeds: [E(i.guildId, '👑 Canal reclamado', 'Ahora eres el dueño de este canal.')] }); return true;
  }
  if (act === 'info') {
    const rg = ch.rtcRegion || 'automático', md = { public: '🌐 Público', private: '🔒 Privado', hidden: '👁️ Oculto' }[room.mode];
    await i.reply({ flags: 64, embeds: [E(i.guildId, `ℹ️ ${ch.name}`, `👑 Dueño: <@${room.owner}>\n🔒 Privacidad: **${md}**\n👥 Límite: **${ch.userLimit || 'sin límite'}**\n🕐 Sala de espera: **${room.waiting ? 'sí' : 'no'}**\n💬 Chat: **${room.chatOpen === false ? 'cerrado' : 'abierto'}**\n🔊 Audio: **${Math.round(ch.bitrate / 1000)} kbps**\n🌐 Región: **${rg}**\n🤝 De confianza: **${room.trust.length}** · ⛔ Bloqueados: **${room.block.length}**`)] });
    return true;
  }
  if (!isOwner) { await no(i, 'Solo el dueño de este canal puede usar ese botón.'); return true; }
  if (act === 'hide') { room.mode = room.mode === 'hidden' ? 'public' : 'hidden'; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '👁️ Visibilidad', room.mode === 'hidden' ? 'Tu canal ahora está **oculto**.' : 'Tu canal vuelve a ser **visible**.')] }); return true; }
  if (act === 'banner') { await i.showModal(new ModalBuilder().setCustomId('vcc_banner_modal').setTitle('Banner de tu sala').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Texto del banner (vacío = por defecto)').setStyle(TextInputStyle.Short).setMaxLength(28).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f').setLabel('Fondo: link de imagen (vacío = por defecto)').setStyle(TextInputStyle.Short).setRequired(false)))); return true; }
  if (act === 'bitrate') {
    const max = Math.floor((i.guild.maximumBitrate || 96000) / 1000), opts = [8, 16, 32, 64, 96, 128, 256, 384].filter(k => k <= max);
    await i.reply({ flags: 64, content: 'Elige la calidad de audio:', components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('vcc_bitrate_sel').setPlaceholder('Calidad de audio').addOptions(opts.map(k => ({ label: `${k} kbps`, value: String(k) }))))] });
    return true;
  }
  if (act === 'reset') {
    Object.assign(room, { mode: 'public', chatOpen: true, waiting: false, trust: [], block: [] }); save(); await vccApplyPerms(ch, room);
    await ch.setUserLimit(0).catch(() => {}); await ch.setRTCRegion(null).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '⚙️ Restablecido', 'Tu canal volvió a ser público, sin límite, sin sala de espera y sin listas de confianza/bloqueo.')] });
    return true;
  }
  if (act === 'name') { await i.showModal(new ModalBuilder().setCustomId('vcc_name_modal').setTitle('Renombrar canal').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('Nuevo nombre').setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true)))); return true; }
  if (act === 'limit') { await i.showModal(new ModalBuilder().setCustomId('vcc_limit_modal').setTitle('Límite de usuarios').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('Límite (0 = sin límite, máx. 99)').setStyle(TextInputStyle.Short).setRequired(true)))); return true; }
  if (act === 'privacy') {
    await i.reply({ flags: 64, content: 'Elige la privacidad del canal:', components: [new ActionRowBuilder().addComponents(
      new (require('discord.js').StringSelectMenuBuilder)().setCustomId('vcc_privacy_sel').setPlaceholder('Privacidad').addOptions(
        { label: 'Público', value: 'public', emoji: '🌐', description: 'Cualquiera puede ver y entrar' },
        { label: 'Privado', value: 'private', emoji: '🔒', description: 'Se ve, pero no se puede entrar sin permiso' },
        { label: 'Oculto', value: 'hidden', emoji: '👁️', description: 'No aparece en la lista de canales' }))] });
    return true;
  }
  if (act === 'wait') { room.waiting = !room.waiting; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '🕐 Sala de espera', room.waiting ? 'Activada: quien no sea de confianza pasará por aprobación.' : 'Desactivada.')] }); return true; }
  if (act === 'chat') { room.chatOpen = room.chatOpen === false ? true : false; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '💬 Chat del canal', room.chatOpen ? 'Abierto para todos.' : 'Cerrado: solo el dueño y los de confianza pueden escribir.')] }); return true; }
  if (act === 'region') {
    await i.reply({ flags: 64, content: 'Elige la región de voz:', components: [new ActionRowBuilder().addComponents(
      new (require('discord.js').StringSelectMenuBuilder)().setCustomId('vcc_region_sel').setPlaceholder('Región').addOptions(VCC_REGIONS.map(([label, value]) => ({ label, value }))))] });
    return true;
  }
  if (act === 'delete') { await i.reply({ flags: 64, embeds: [E(i.guildId, '🗑️ Eliminando', 'Tu canal se eliminará en unos segundos.')] }); await ch.delete('Crea tu VC: eliminado por el dueño').catch(() => {}); delete VCR(G(i.guildId))[ch.id]; save(); return true; }
  const SEL = { trust: ['vcc_trust_sel', 'A quién confiar'], untrust: ['vcc_untrust_sel', 'A quién quitar la confianza'], invite: ['vcc_invite_sel', 'A quién invitar'],
    kick: ['vcc_kick_sel', 'A quién expulsar'], block: ['vcc_block_sel', 'A quién bloquear'], unblock: ['vcc_unblock_sel', 'A quién desbloquear'], transfer: ['vcc_transfer_sel', 'Nuevo dueño'] };
  if (SEL[act]) {
    const [cid, ph] = SEL[act];
    await i.reply({ flags: 64, content: ph + ':', components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(cid).setPlaceholder(ph).setMinValues(1).setMaxValues(1))] });
    return true;
  }
  return true;
}
async function vccSelectUser(i) {
  const act = { vcc_trust_sel: 'trust', vcc_untrust_sel: 'untrust', vcc_invite_sel: 'invite', vcc_kick_sel: 'kick', vcc_block_sel: 'block', vcc_unblock_sel: 'unblock', vcc_transfer_sel: 'transfer' }[i.customId];
  if (!act) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
  if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
  const target = i.users.first(); if (!target) { await i.update({ content: 'No elegiste a nadie.', components: [] }).catch(() => {}); return true; }
  if (target.id === room.owner && act !== 'transfer') { await i.update({ content: 'Ese es el dueño del canal.', components: [] }).catch(() => {}); return true; }
  if (act === 'trust') { if (!room.trust.includes(target.id)) room.trust.push(target.id); room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `🤝 ${target} ahora es de confianza.`, components: [] }); }
  else if (act === 'untrust') { room.trust = room.trust.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `🚫 Se quitó la confianza a ${target}.`, components: [] }); }
  else if (act === 'invite') {
    if (!room.trust.includes(target.id)) room.trust.push(target.id); save(); await vccApplyPerms(ch, room);
    target.send({ embeds: [E(i.guildId, '✉️ Te invitaron a un canal de voz', `${i.user} te invitó a su canal: ${ch}`)] }).catch(() => {});
    await i.update({ content: `✉️ Invitación enviada a ${target} (ahora tiene acceso).`, components: [] });
  } else if (act === 'kick') { const tm = ch.members.get(target.id); if (!tm) { await i.update({ content: 'Ese usuario no está en tu canal.', components: [] }); } else { await tm.voice.disconnect('Expulsado del VC por el dueño').catch(() => {}); await i.update({ content: `👢 ${target} fue expulsado.`, components: [] }); } }
  else if (act === 'block' && room.block.includes(target.id)) { room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `♻️ ${target} fue desbloqueado.`, components: [] }); }
  else if (act === 'block') { if (!room.block.includes(target.id)) room.block.push(target.id); room.trust = room.trust.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); const tm = ch.members.get(target.id); if (tm) await tm.voice.disconnect('Bloqueado del VC').catch(() => {}); await i.update({ content: `⛔ ${target} fue bloqueado.`, components: [] }); }
  else if (act === 'unblock') { room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `♻️ ${target} fue desbloqueado.`, components: [] }); }
  else if (act === 'transfer') { const tm = ch.members.get(target.id); if (!tm) { await i.update({ content: 'Ese usuario debe estar conectado al canal para recibirlo.', components: [] }); } else { room.owner = target.id; save(); await vccApplyPerms(ch, room); await i.update({ content: `🔁 ${target} ahora es el dueño del canal.`, components: [] }); } }
  return true;
}
async function vccSelectString(i) {
  const { ch, room } = vccRoom(i);
  if (i.customId === 'vcc_privacy_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    room.mode = i.values[0]; save(); await vccApplyPerms(ch, room);
    const txt = { public: '🌐 Público', private: '🔒 Privado', hidden: '👁️ Oculto' }[room.mode];
    await i.update({ content: `Privacidad actualizada: **${txt}**`, components: [] }); return true;
  }
  if (i.customId === 'vcc_bitrate_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    const ok2 = await ch.setBitrate(+i.values[0] * 1000).then(() => true).catch(() => false);
    await i.update({ content: ok2 ? `🔊 Audio: **${i.values[0]} kbps**` : 'No pude cambiar la calidad de audio.', components: [] }); return true;
  }
  if (i.customId === 'vcc_region_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    await ch.setRTCRegion(i.values[0] === 'auto' ? null : i.values[0]).catch(() => {});
    await i.update({ content: `🌐 Región actualizada.`, components: [] }); return true;
  }
  return false;
}
async function vccModal(i) {
  if (!['vcc_name_modal', 'vcc_limit_modal', 'vcc_banner_modal'].includes(i.customId)) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await no(i, 'Ya no estás en un canal de voz temporal.'); return true; }
  if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await no(i, 'Solo el dueño puede hacer esto.'); return true; }
  if (i.customId === 'vcc_banner_modal') {
    await i.deferReply({ flags: 64 }); const t = i.fields.getTextInputValue('t').trim(), f = i.fields.getTextInputValue('f').trim();
    if (f && (!url(f) || !(await nivelFondo(f)))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo (https) a .png, .jpg o .gif.');
    room.bn = { ...(t ? { titulo: t } : {}), ...(f ? { fondo: f } : {}) }; save();
    const cf = C(i.guildId), p = await vccUi(i.guild, cf, i.member, ch, room);
    await ch.send({ ...p, allowedMentions: { parse: [] } }).catch(() => {});
    return i.editReply('🖼️ Banner actualizado en el chat de tu sala.');
  }
  if (i.customId === 'vcc_name_modal') {
    const name = i.fields.getTextInputValue('v').trim().slice(0, 90) || ch.name; await ch.setName(name).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '📛 Renombrado', `Nuevo nombre: **${name}**`)] });
  } else {
    const n = Math.max(0, Math.min(99, parseInt(i.fields.getTextInputValue('v'), 10) || 0)); await ch.setUserLimit(n).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '👥 Límite actualizado', n ? `Máximo **${n}** usuarios.` : 'Sin límite.')] });
  }
  return true;
}
function guildWaitCh(guild, cf) { return VCC(cf).wait && guild.channels.cache.get(VCC(cf).wait); }

/* ================================ EVENTOS ================================ */
let LISTO = false;
const alListo = async () => {
  if (LISTO) return; LISTO = true; // solo una vez
  console.log(`✅ ${client.user.tag} | ${Object.values(CATS).reduce((a, c) => a + Object.keys(c).length, 0)} comandos`);
  // limpia del registro de Discord los comandos eliminados (/cerrar-servidor, /abrir-servidor y /limpiar servidor) aunque hayan quedado registrados de versiones antiguas
  try {
    for (const c of (await client.application.commands.fetch()).values()) if (['cerrar-servidor', 'abrir-servidor'].includes(c.name)) await c.delete().catch(() => {});
    for (const gu of client.guilds.cache.values()) await gu.commands.set([]).catch(() => {}); // este bot solo registra comandos globales
  } catch (err) { console.warn('[comandos] no pude limpiar comandos antiguos:', err.message); }
  console.log('🧹 Versión sin /cerrar-servidor, /abrir-servidor ni /limpiar servidor');
  try { await client.application.commands.set(build()); console.log('✅ Comandos registrados en Discord'); }
  catch (err) { console.error('[comandos] Discord rechazó el registro:', err.message, JSON.stringify(err.rawError?.errors || {}).slice(0, 1200)); }
  client.guilds.cache.forEach(loadInv);
  vccResync().catch(err => console.warn('[crea-tu-vc] resync:', err.message)); // oculta a no verificados los VC que ya estaban creados
  setInterval(() => vcTick().catch(console.error), 20000); setTimeout(() => vcTick().catch(console.error), 10000); // estado de voz
  setInterval(() => cleanTick().catch(console.error), 60000); setTimeout(() => cleanTick().catch(console.error), 20000); // limpieza automática
  setInterval(() => statsTick().catch(console.error), 60000); setTimeout(() => statsTick().catch(console.error), 30000); // ServerStats
  setInterval(() => client.guilds.cache.forEach(gu => gu.voiceStates.cache.forEach(vs => { // estar en voz da XP cada minuto
    if (vs.member && !vs.member.user.bot && vs.channelId && !vs.selfDeaf && !vs.serverDeaf) { actXp(vs.member, null, 'xpvc', 55000).catch(() => {}); }
  })), 60000);
  setInterval(() => bumpTick().catch(console.error), 30000); setTimeout(() => bumpTick().catch(console.error), 8000); // aviso "es hora de realzar"
  setInterval(() => achVoiceTick(), 60000); // minutos en voz / micro / cámara / stream
  setTimeout(() => achSweep().catch(console.error), 15000); setInterval(() => achSweep().catch(console.error), 600000); // días en el servidor
  client.user.setActivity('/util help');
};
// discord.js 14.22+ usa 'clientReady'; las versiones anteriores solo emiten 'ready' (con 'clientReady' el bot nunca registraba los comandos)
const [vMa, vMi] = String(require('discord.js').version || '14.0').split('.').map(Number);
client.once(vMa > 14 || vMi >= 22 ? 'clientReady' : 'ready', alListo);
client.on('guildCreate', loadInv);
client.on('inviteCreate', i => {
  const gid = i.guild.id; IC.get(gid)?.set(i.code, { uses: i.uses ?? 0, by: i.inviter?.id ?? null, max: i.maxUses || 0, exp: i.expiresTimestamp || 0 });
  invLog(gid, 'creada', { inviter: i.inviter ? `<@${i.inviter.id}>` : 'desconocido', code: i.code, channel: i.channelId ? `<#${i.channelId}>` : '—', max: i.maxUses || '∞',
    expires: i.expiresTimestamp ? `<t:${Math.floor(i.expiresTimestamp / 1000)}:R>` : 'nunca', _thumb: i.inviter?.displayAvatarURL() });
});
client.on('inviteDelete', i => {
  const gid = i.guild.id, c = IC.get(gid)?.get(i.code);
  invLog(gid, 'borrada', { inviter: c?.by ? `<@${c.by}>` : 'desconocido', code: i.code, uses: c?.uses ?? '—' });
  setTimeout(() => IC.get(gid)?.delete(i.code), 15000); // se conserva unos segundos: si fue el último uso, sirve para detectar quién entró
});

client.on('interactionCreate', async i => {
  try {
    if (!i.guild) return;
    if (!i.isChatInputCommand() && await extraInteractions(i)) return; // confesiones, pinterest e IA (botones y modales)
    if (i.isChatInputCommand()) {
      const c = CATS[i.commandName]?.[i.options.getSubcommand(false) ?? 'run']; if (!c) return;
      actXp(i.member, i.channel, 'xpcmd', 10000).catch(() => {}); // usar comandos también da XP
      if (c.perm && !i.member.permissions.has(P[c.perm])) return no(i, `Necesitas el permiso **${c.perm}**.`);
      const o = {}; for (const x of c.spec) o[x.n] = i.options[GET[x.t]](x.n);
      if (i.commandName === 'seg') lg(i.guildId, 'general', E(i.guildId, '🛰️ Configuración de seguridad', `${i.user} usó \`/seg ${i.options.getSubcommand(false) ?? ''}\``), null, 'sentinel');
      return await c.run(i, o, G(i.guildId), C(i.guildId));
    }
    if (i.isButton()) {
      const id = i.customId;
      if (id === 'verif') return await verifButton(i);
      if (id.startsWith('ach_')) return await achButton(i);
      if (id.startsWith('cl_')) return await cleanButton(i);
      if (id === 'verif_enter') return i.showModal(new ModalBuilder().setCustomId('verif_modal').setTitle('Verificación').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('Código').setStyle(TextInputStyle.Short).setRequired(true))));
      if (id === 'verif_captcha_enter') {
        if (!CC.get(i.user.id)) return no(i, 'No tienes una verificación pendiente o se acabó el tiempo. Pulsa el botón del panel de nuevo.');
        return i.showModal(new ModalBuilder().setCustomId('verif_captcha_modal').setTitle('Verificación').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('answer').setLabel('Resultado').setStyle(TextInputStyle.Short).setRequired(true))));
      }
      if (id === 'tk_open') return tkOpen(i);
      if (id === 'tk_close') { const t = G(i.guildId).tickets[i.channelId]; if (!t) return; if (!tkStaff(i.member, i.guildId, t)) return tkDeny(i); await i.reply({ embeds: [E(i.guildId, '🔒 Cerrando ticket', 'Se cerrará en 5 segundos...')] }); return closeTicket(i.channel, i.user); }
      if (id === 'tk_claim') { const t = G(i.guildId).tickets[i.channelId]; if (!t) return; if (!tkStaff(i.member, i.guildId, t)) return tkDeny(i); t.claimed = i.user.id; save(); return i.reply({ embeds: [E(i.guildId, '🙋 Ticket reclamado', `${i.user} atenderá este ticket.`)] }); }
      if (id.startsWith('rr_')) {
        const rid = id.slice(3), rl = i.guild.roles.cache.get(rid), has = hasRole(i.member, rid), pr = roleIssue(i.guild, rl);
        if (pr) return no(i, `No puedo gestionar ${rl ?? 'ese rol'}: ${pr}.`);
        try { await (has ? i.member.roles.remove(rid) : i.member.roles.add(rid)); } catch (err) { return no(i, `No pude cambiar tu rol: ${err.message}`); }
        return i.reply({ flags: 64, embeds: [E(i.guildId, has ? '➖ Rol quitado' : '➕ Rol añadido', `<@&${rid}>`)] });
      }
      if (id.startsWith('vcc_')) return await vccButton(i);
    }
    if (i.isStringSelectMenu() && i.customId === 'tk_menu') { i.message.edit({ components: tkRows(C(i.guildId), 'menu') }).catch(() => {}); return await tkOpen(i, i.values[0]); } // se reinicia el menú para poder elegir la misma opción otra vez
    if (i.isUserSelectMenu() && i.customId.startsWith('vcc_')) { if (await vccSelectUser(i)) return; }
    if (i.isStringSelectMenu() && i.customId.startsWith('vcc_')) { if (await vccSelectString(i)) return; }
    if (i.isModalSubmit() && i.customId.startsWith('vcc_')) { if (await vccModal(i)) return; }
    if (i.isModalSubmit() && i.customId === 'verif_modal') {
      const v = C(i.guildId).v, c = VC.get(i.user.id);
      if (!c) return no(i, 'No tienes una verificación pendiente. Pulsa el botón del panel de nuevo.');
      const elapsed = Date.now() - c.start;
      if (elapsed > 300000) { VC.delete(i.user.id); return no(i, 'Se acabó el tiempo. Pulsa el botón del panel de nuevo.'); }
      if (i.fields.getTextInputValue('code').trim().toUpperCase() !== c.code) {
        c.attempts++;
        if (c.attempts >= 3) {
          VC.delete(i.user.id);
          await vlog(i.guild, i.user, '❌ Verificación fallida (código)', 'Código', 'Demasiados intentos fallidos', riskScore(i.user, { fails: c.attempts, ms: elapsed }));
          return no(i, 'Demasiados intentos fallidos. Pulsa el botón del panel de nuevo para reintentar.');
        }
        return no(i, `Código incorrecto. Te quedan **${3 - c.attempts}** intento(s).`);
      }
      VC.delete(i.user.id);
      if (!v.role || roleIssue(i.guild, i.guild.roles.cache.get(v.role))) return no(i, 'La verificación está mal configurada. Avisa a un administrador.');
      await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Código', null, riskScore(i.user, { fails: c.attempts, ms: elapsed }));
      return i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
    }
    if (i.isModalSubmit() && i.customId === 'verif_captcha_modal') {
      const v = C(i.guildId).v, c = CC.get(i.user.id);
      if (!c) return no(i, 'No tienes una verificación pendiente. Pulsa el botón del panel de nuevo.');
      const elapsed = Date.now() - c.start;
      if (elapsed > 120000) { CC.delete(i.user.id); return no(i, 'Se acabó el tiempo. Pulsa el botón del panel de nuevo.'); }
      if (Number(i.fields.getTextInputValue('answer').trim()) !== c.ans) {
        c.attempts++;
        if (c.attempts >= 3) {
          CC.delete(i.user.id);
          await vlog(i.guild, i.user, '❌ Verificación fallida (captcha)', 'Captcha', 'Demasiados intentos fallidos', riskScore(i.user, { fails: c.attempts, ms: elapsed }));
          return no(i, 'Demasiados intentos fallidos. Pulsa el botón del panel de nuevo para reintentar.');
        }
        return no(i, `Respuesta incorrecta. Te quedan **${3 - c.attempts}** intento(s).`);
      }
      CC.delete(i.user.id);
      if (!v.role || roleIssue(i.guild, i.guild.roles.cache.get(v.role))) return no(i, 'La verificación está mal configurada. Avisa a un administrador.');
      await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Captcha', null, riskScore(i.user, { fails: c.attempts, ms: elapsed }));
      return i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
    }
  } catch (err) {
    console.error(err); const p = { flags: 64, embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Ocurrió un error ejecutando el comando.')] };
    (i.deferred || i.replied ? i.followUp(p) : i.reply(p)).catch(() => {});
  }
});

client.on('messageCreate', async m => {
  if (m.guild && m.author.id === DISBOARD_ID) { disboardBump(m).catch(console.error); return; } // /bump de Disboard
  if (!m.guild || m.author.bot || !m.member) return;
  const cf = C(m.guildId), g = G(m.guildId);
  if (await automod(m, cf, g)) return;
  const u = U(m.guildId, m.author.id); u.msgs++;
  if (cf.lvlon && !cd(u, 'xp', 8000)) await addXp(m.member, xpAmt(cf) + (m.attachments.size ? 5 : 0), m.channel); else save();
});

client.on('messageReactionAdd', async (r, user) => { // reaccionar también da XP
  try {
    if (user.bot) return; if (r.partial) await r.fetch(); const gu = r.message.guild; if (!gu) return;
    actXp(await gu.members.fetch(user.id), r.message.channel, 'xprx', 10000).catch(() => {});
  } catch {}
});

client.on('guildMemberAdd', async m => {
  const gid = m.guild.id, g = G(gid), cf = C(gid), s = cf.sec;
  const tr = trackInvite(m); // se lanza ya: así el caché se actualiza aunque el miembro sea expulsado después
  if (m.user.bot && s.bots && !g.wl.includes(m.id)) { await m.kick('AntiBots').catch(() => {}); return lg(gid, 'seguridad', E(gid, '🤖 AntiBots', `Bot expulsado: **${m.user.tag}**`)); }
  if (cf.minage && Date.now() - m.user.createdTimestamp < cf.minage * 864e5) {
    await dm(m.user, E(gid, '🕒 Cuenta demasiado nueva', `Tu cuenta debe tener al menos ${cf.minage} días para entrar a **${m.guild.name}**.`)); await m.kick('Edad mínima de cuenta').catch(() => {});
    return lg(gid, 'seguridad', E(gid, '🕒 Cuenta nueva expulsada', `${m.user.tag} (${m.user.id})`));
  }
  if (s.raid) {
    const a = (JN.get(gid) || []).filter(t => Date.now() - t < cf.raidsec * 1000); a.push(Date.now()); JN.set(gid, a);
    if (a.length >= cf.raidn) { await m.kick('AntiRaid').catch(() => {}); return lg(gid, 'seguridad', E(gid, '🚨 ANTI-RAID', `**${m.user.tag}** expulsado (${a.length} entradas en ${cf.raidsec}s).`), null, 'defensa'); }
  }
  const ids = m.user.bot ? [cf.botrole].filter(Boolean) : g.autoroles; if (ids.length) giveRoles(m, ids).catch(console.error);
  // invitaciones (la detección ya está en marcha; aquí se espera el resultado y se registra)
  const info = await tr, jr = recordJoin(m, info), by = jr.inviter, count = jr.count;
  if (by) { syncRewards(m.guild, by).catch(console.error); const im = await m.guild.members.fetch(by).catch(() => null); if (im) checkAch(im, null); }
  invLog(gid, 'entrada', invVars(m, info, jr), INVC[jr.type]);
  const legacy = wbLegacy(cf, 'bienvenida');
  if (!legacy) await sendWB(m, 'bienvenida', { inviter: by ? `<@${by}>` : 'desconocido', count });
  const ic = cf.inv; const ch = legacy ? m.guild.channels.cache.get(ic.ch) : null; // sistema antiguo solo si no hay /bienvenida configurado
  if (ch) {
    const e = E(gid, ic.title || '👋 ¡Bienvenido!', fmt(ic.msg || '{user} se unió, invitado por {inviter} ({count} invitaciones). Ya somos **{members}**.', { user: `${m}`, inviter: by ? `<@${by}>` : 'desconocido', count, server: m.guild.name, members: m.guild.memberCount }), ic.img).setThumbnail(m.displayAvatarURL());
    if (ic.color) e.setColor(ic.color); ch.send({ content: `${m}`, embeds: [e] }).catch(() => {});
  }
  lg(gid, 'general', E(gid, '📥 Miembro entró', `${m.user.tag} (${m.id})\nCuenta: <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>\nInvitado por: ${by ? `<@${by}>` : '—'}`).setThumbnail(m.displayAvatarURL()), 'miembros', 'entradas');
});
client.on('guildMemberRemove', async m => {
  const gid = m.guild.id, g = G(gid), cf = C(gid), r = g.invby[m.id];
  if (r && !r.left) { r.left = true; if (!r.fake) { U(gid, r.by).left++; syncRewards(m.guild, r.by).catch(console.error); } save(); }
  if (r) invLog(gid, 'salida', { user: `<@${m.id}>`, tag: m.user.tag, id: m.id, inviter: `<@${r.by}>`, count: invTotal(U(gid, r.by)),
    stay: durTxt(Date.now() - (m.joinedTimestamp ?? r.at ?? Date.now())), server: m.guild.name, members: m.guild.memberCount, _thumb: m.user.displayAvatarURL() });
  const legacy = wbLegacy(cf, 'despedida');
  if (!legacy) sendWB(m, 'despedida', { inviter: r ? `<@${r.by}>` : 'desconocido' });
  const ic = cf.inv, ch = legacy ? m.guild.channels.cache.get(ic.ch) : null;
  if (ch && ic.leave) ch.send({ embeds: [E(gid, '🚪 Adiós', fmt(ic.leave, { user: m.user.tag, inviter: r ? `<@${r.by}>` : 'desconocido', server: m.guild.name, members: m.guild.memberCount }), ic.img).setThumbnail(m.displayAvatarURL())] }).catch(() => {});
  lg(gid, 'general', E(gid, '📤 Miembro salió', `${m.user.tag} (${m.id})`), 'miembros', 'salidas');
});
client.on('messageDelete', m => { if (!m.guild || m.author?.bot) return; lg(m.guildId, 'general', E(m.guildId, '🗑️ Mensaje borrado', `**Autor:** ${m.author || '?'}\n**Canal:** ${m.channel}\n**Contenido:** ${(m.content || '—').slice(0, 1000)}`), 'mensajes'); });
client.on('messageUpdate', (a, b) => {
  if (b.guild && (b.author?.id === DISBOARD_ID || a.author?.id === DISBOARD_ID)) { (b.partial ? b.fetch() : Promise.resolve(b)).then(disboardBump).catch(() => {}); return; }
  if (!a.guild || a.author?.bot || a.content === b.content) return; lg(a.guildId, 'general', E(a.guildId, '✏️ Mensaje editado', `**Autor:** ${a.author}\n**Canal:** ${a.channel} [Ir](${b.url})\n**Antes:** ${(a.content || '—').slice(0, 500)}\n**Después:** ${(b.content || '—').slice(0, 500)}`), 'mensajes'); });
client.on('guildBanAdd', b => { lg(b.guild.id, 'general', E(b.guild.id, '🔨 Usuario baneado', `${b.user.tag} (${b.user.id})\n${b.reason || 'Sin razón'}`), 'bans'); nuke(b.guild, AuditLogEvent.MemberBanAdd); });
client.on('guildBanRemove', b => lg(b.guild.id, 'general', E(b.guild.id, '♻️ Usuario desbaneado', `${b.user.tag} (${b.user.id})`), 'bans'));
client.on('roleCreate', r => lg(r.guild.id, 'general', E(r.guild.id, '🎭 Rol creado', `${r.name}`), 'roles'));
client.on('roleDelete', r => { lg(r.guild.id, 'general', E(r.guild.id, '🎭 Rol eliminado', `${r.name}`), 'roles'); nuke(r.guild, AuditLogEvent.RoleDelete); });
client.on('channelCreate', c => c.guild && lg(c.guild.id, 'general', E(c.guild.id, '📁 Canal creado', `${c} (${c.name})`), 'canales'));
client.on('channelDelete', c => { if (!c.guild) return; lg(c.guild.id, 'general', E(c.guild.id, '📁 Canal eliminado', `#${c.name}`), 'canales'); nuke(c.guild, AuditLogEvent.ChannelDelete); });
client.on('guildMemberUpdate', (a, b) => {
  const add = b.roles.cache.filter(r => !a.roles.cache.has(r.id)), rem = a.roles.cache.filter(r => !b.roles.cache.has(r.id));
  if (add.size || rem.size) lg(b.guild.id, 'general', E(b.guild.id, '🎭 Roles de miembro', `${b}\n${add.size ? `➕ ${add.map(r => r).join(' ')}\n` : ''}${rem.size ? `➖ ${rem.map(r => r).join(' ')}` : ''}`), 'roles');
  if (a.nickname !== b.nickname) lg(b.guild.id, 'general', E(b.guild.id, '📝 Apodo cambiado', `${b}\n**Antes:** ${a.nickname || '—'}\n**Después:** ${b.nickname || '—'}`), 'miembros', 'apodos');
});
/* ---- LOGS DE VOZ: cada acción se manda a su propio canal ----
   voz_mover (cambió de canal) · voz_desconexion (salió de voz) · voz_mute (micrófono) · voz_sordo (audio)
   Si un tipo no tiene canal, cae al canal "general". SOLO se registran las acciones hechas por un staff/moderador
   (persona con rol y el permiso de esa acción): mover, desconectar, mutear y ensordecer a otro usuario.
   Lo que el usuario se hace a sí mismo (autodesconexión, automute, autosordo) ya NO se loguea.
   Para saber quién fue, el bot necesita el permiso "Ver registro de auditoría". */
const VAUD = new Map(); // por servidor+tipo: última entrada de auditoría vista (mover/desconectar no dicen a quién, se detecta por contador)
const espera = ms => new Promise(r => setTimeout(r, ms));
const vozActivo = (gid, tipo) => { const cf = C(gid); return !cf.logoff.includes(tipo) && !!(cf.logch[tipo] || cf.logch.general); };
// ¿el autor de la acción es un staff/moderador de verdad? Persona (no bot), distinta del afectado, con algún rol
// (o dueño) y con el permiso que exige la acción (Administrador siempre vale).
async function vozStaff(guild, user, permiso, afectadoId) {
  if (!user || user.bot || user.id === afectadoId) return null;
  const mem = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
  if (!mem) return null;
  const esDueno = guild.ownerId === mem.id;
  if (!esDueno && mem.roles.cache.size <= 1) return null; // solo @everyone = sin roles
  return esDueno || mem.permissions.has(P.Administrator) || mem.permissions.has(permiso) ? mem : null;
}
const vozRol = mem => mem.guild.ownerId === mem.id ? '👑 dueño' : `🛡️ ${mem.roles.highest.name}`;
async function vozModerador(guild, tipo, afectadoId) { // mover/desconectar: ¿lo hizo un staff?
  try {
    if (!guild.members.me?.permissions.has(P.ViewAuditLog)) return null;
    await espera(1200); // Discord tarda un instante en escribir la auditoría
    const e = (await guild.fetchAuditLogs({ type: tipo, limit: 1 })).entries.first(); if (!e) return null;
    const k = `${guild.id}:${tipo}`, now = Date.now(), n = Number(e.extra?.count) || 1;
    const s = VAUD.get(k) || { id: null, n: 0, credito: 0, ts: 0 };
    if (now - s.ts > 15000) s.credito = 0; // los créditos viejos caducan
    const nuevo = s.id === null ? (now - e.createdTimestamp < 10000 ? n : 0) : e.id !== s.id ? n : Math.max(0, n - s.n);
    s.id = e.id; s.n = n; s.credito += nuevo; s.ts = now;
    const por = s.credito > 0 ? e.executor : null; if (por) s.credito--; // un crédito por usuario afectado (sirve para mover a varios a la vez)
    VAUD.set(k, s); return await vozStaff(guild, por, P.MoveMembers, afectadoId);
  } catch { return null; }
}
async function vozModeradorEstado(guild, userId, clave, permiso) { // mute/sordo del servidor: la auditoría sí trae al afectado
  try {
    if (!guild.members.me?.permissions.has(P.ViewAuditLog)) return null;
    await espera(1200);
    const lg = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 10 });
    const por = lg.entries.find(x => x.target?.id === userId && Date.now() - x.createdTimestamp < 10000 && x.changes?.some(c => c.key === clave))?.executor || null;
    return await vozStaff(guild, por, permiso, userId);
  } catch { return null; }
}
function vozLog(m, tipo, titulo, color, lineas) {
  const e = E(m.guild.id, titulo, lineas.filter(Boolean).join('\n')).setColor(color)
    .setThumbnail(m.displayAvatarURL({ size: 128 })).setFooter({ text: `${m.user.tag} · ID ${m.id}` });
  lg(m.guild.id, tipo, e, tipo);
}
async function vozLogs(a, b) {
  const m = b.member || a.member; if (!m) return; const g = m.guild, u = `**Usuario:** ${m} (\`${m.user.tag}\`)`;
  if (a.channelId !== b.channelId) {
    if (!a.channelId) return lg(g.id, 'general', E(g.id, '🔊 Voz', `${m} entró a **${b.channel.name}**`), 'voz'); // entrar sigue yendo al canal general
    if (!b.channelId) { // 🔌 desconexión
      if (!vozActivo(g.id, 'voz_desconexion')) return;
      const por = await vozModerador(g, AuditLogEvent.MemberDisconnect, m.id);
      if (!por) return; // se salió él solo / se cayó / lo hizo un bot o alguien sin permisos → no se loguea
      return vozLog(m, 'voz_desconexion', '🔌 Usuario desconectado', 0xED4245, [u, `**Canal:** ${a.channel}`,
        `**Desconectado por:** ${por} (${vozRol(por)})`]);
    }
    if (!vozActivo(g.id, 'voz_mover')) return; // 🔀 mover de canal
    const por = await vozModerador(g, AuditLogEvent.MemberMove, m.id);
    if (!por) return; // se cambió él mismo → no se loguea
    return vozLog(m, 'voz_mover', '🔀 Cambio de canal de voz', 0x5865F2, [u, `**Desde:** ${a.channel}`, `**Hacia:** ${b.channel}`,
      `**Movido por:** ${por} (${vozRol(por)})`]);
  }
  if (!b.channelId) return; // mute y sordo solo cuentan si sigue dentro del mismo canal
  const ch = `**Canal:** ${b.channel}`;
  if (a.serverMute !== b.serverMute && vozActivo(g.id, 'voz_mute')) { // 🔇 mute del servidor
    const por = await vozModeradorEstado(g, m.id, 'mute', P.MuteMembers);
    if (por) vozLog(m, 'voz_mute', b.serverMute ? '🔇 Silenciado por el staff' : '🔈 Silencio quitado por el staff', b.serverMute ? 0xED4245 : 0x57F287,
      [u, ch, `**Por:** ${por} (${vozRol(por)})`]);
  }
  if (a.serverDeaf !== b.serverDeaf && vozActivo(g.id, 'voz_sordo')) { // 🙉 sordo del servidor
    const por = await vozModeradorEstado(g, m.id, 'deaf', P.DeafenMembers);
    if (por) vozLog(m, 'voz_sordo', b.serverDeaf ? '🙉 Ensordecido por el staff' : '🔊 Sordera quitada por el staff', b.serverDeaf ? 0xED4245 : 0x57F287,
      [u, ch, `**Por:** ${por} (${vozRol(por)})`]);
  }
}
client.on('voiceStateUpdate', async (a, b) => {
  try { achVoiceEvt(a, b); } catch (e) { console.warn('[logros]', e.message); } // micro / cámara / stream encendidos
  vozLogs(a, b).catch(err => console.warn('[logs-voz]', err.message)); // sin await: espera a la auditoría y no debe retrasar lo de abajo
  if (a.channelId === b.channelId) return;
  await vcCreateHandler(b).catch(err => console.warn('[crea-tu-vc]', err.message));
  await vcCleanupHandler(a).catch(err => console.warn('[crea-tu-vc]', err.message));
  await vcGateHandler(b).catch(err => console.warn('[crea-tu-vc]', err.message));
});

require('./web')({ client, DB, save, C, PORT: process.env.PORT || 3000 });

/* ---- LOGS NUEVOS: cada evento a su propio canal (se crean con /log servidor) ---- */
const lk = (guild, key, e) => guild && lg(guild.id, 'general', e, null, key);
client.on('messageReactionAdd', (r, u) => { if (!r.message.guildId || u.bot) return; lk(r.message.guild, 'reacciones', E(r.message.guildId, '😀 Reacción añadida', `${u} reaccionó con ${r.emoji} en ${r.message.channel ?? ''}\n[Ir al mensaje](${r.message.url})`)); });
client.on('messageReactionRemove', (r, u) => { if (!r.message.guildId || u.bot) return; lk(r.message.guild, 'reacciones', E(r.message.guildId, '😶 Reacción quitada', `${u} quitó ${r.emoji} en ${r.message.channel ?? ''}\n[Ir al mensaje](${r.message.url})`)); });
client.on('threadCreate', (t, nuevo) => nuevo && lk(t.guild, 'hilos', E(t.guild.id, '🧵 Hilo creado', `${t} en <#${t.parentId}>`)));
client.on('threadDelete', t => lk(t.guild, 'hilos', E(t.guild.id, '🧵 Hilo eliminado', `**${t.name}**`)));
client.on('messageCreate', m => { if (m.guild && m.poll) lk(m.guild, 'encuestas', E(m.guildId, '📊 Encuesta creada', `**${m.author}** en ${m.channel}\n**${m.poll.question?.text ?? ''}**\n[Ir al mensaje](${m.url})`)); });
client.on('voiceStateUpdate', (a, b) => {
  const m = b.member || a.member; if (!m || m.user.bot) return;
  if (a.streaming !== b.streaming) lk(m.guild, 'streams', E(m.guild.id, b.streaming ? '🖥️ Stream iniciado' : '🖥️ Stream terminado', `${m} en **${(b.channel || a.channel)?.name ?? '—'}**`));
  if (a.selfVideo !== b.selfVideo) lk(m.guild, 'streams', E(m.guild.id, b.selfVideo ? '📷 Cámara encendida' : '📷 Cámara apagada', `${m} en **${(b.channel || a.channel)?.name ?? '—'}**`));
});
client.on('guildScheduledEventCreate', ev => lk(ev.guild, 'eventos', E(ev.guildId, '📅 Evento creado', `**${ev.name}**\nInicia <t:${Math.floor((ev.scheduledStartTimestamp ?? Date.now()) / 1000)}:F>`)));
client.on('guildScheduledEventDelete', ev => lk(ev.guild, 'eventos', E(ev.guildId, '📅 Evento eliminado', `**${ev.name}**`)));
client.on('guildScheduledEventUpdate', (a, b) => a && b && a.status !== b.status && lk(b.guild, 'eventos', E(b.guildId, '📅 Evento actualizado', `**${b.name}** cambió de estado (${a.status} → ${b.status})`)));
client.on('roleUpdate', (a, b) => { if (a.permissions.bitfield !== b.permissions.bitfield) lk(b.guild, 'permisos', E(b.guild.id, '🔐 Permisos de rol cambiados', `${b} (${b.name})`)); });
const _ow = c => c.permissionOverwrites?.cache.map(o => `${o.id}:${o.allow.bitfield}:${o.deny.bitfield}`).sort().join('|');
client.on('channelUpdate', (a, b) => { if (b.guild && _ow(a) !== _ow(b)) lk(b.guild, 'permisos', E(b.guild.id, '🔐 Permisos de canal cambiados', `${b}`)); });
client.on('guildUpdate', (a, b) => {
  const ch = []; if (a.name !== b.name) ch.push(`**Nombre:** ${a.name} → ${b.name}`); if (a.icon !== b.icon) ch.push('**Icono** cambiado'); if (a.banner !== b.banner) ch.push('**Banner** cambiado');
  if (a.verificationLevel !== b.verificationLevel) ch.push('**Nivel de verificación** cambiado'); if (a.systemChannelId !== b.systemChannelId) ch.push('**Canal del sistema** cambiado');
  if (ch.length) lk(b, 'servidor', E(b.id, '⚙️ Servidor actualizado', ch.join('\n')));
});
client.on('webhooksUpdate', c => c.guild && lk(c.guild, 'webhooks', E(c.guild.id, '🪝 Webhooks actualizados', `En ${c}`)));
client.on('guildIntegrationsUpdate', gu => lk(gu, 'integraciones', E(gu.id, '🔌 Integraciones actualizadas', 'Se añadió, quitó o cambió una integración.')));
client.on('emojiCreate', e => lk(e.guild, 'emojis', E(e.guild.id, '😄 Emoji creado', `${e} \`:${e.name}:\``)));
client.on('emojiDelete', e => lk(e.guild, 'emojis', E(e.guild.id, '😄 Emoji eliminado', `\`:${e.name}:\``)));
client.on('emojiUpdate', (a, b) => a.name !== b.name && lk(b.guild, 'emojis', E(b.guild.id, '😄 Emoji renombrado', `\`:${a.name}:\` → ${b} \`:${b.name}:\``)));
client.on('stickerCreate', s => s.guild && lk(s.guild, 'emojis', E(s.guild.id, '🏷️ Sticker creado', `**${s.name}**`)));
client.on('stickerDelete', s => s.guild && lk(s.guild, 'emojis', E(s.guild.id, '🏷️ Sticker eliminado', `**${s.name}**`)));
client.on('guildMemberUpdate', (a, b) => {
  if (b.user.bot) return;
  if (a.communicationDisabledUntilTimestamp !== b.communicationDisabledUntilTimestamp) {
    const hasta = b.communicationDisabledUntilTimestamp; lk(b.guild, 'timeout', E(b.guild.id, hasta && hasta > Date.now() ? '⏳ Timeout aplicado' : '✅ Timeout quitado', `${b}${hasta && hasta > Date.now() ? `\nHasta <t:${Math.floor(hasta / 1000)}:F>` : ''}`).setThumbnail(b.displayAvatarURL()));
  }
  const pf = []; if (a.avatar !== b.avatar) pf.push('Avatar del servidor cambiado'); if (a.pending && !b.pending) pf.push('Completó la pantalla de acceso (reglas)');
  if (pf.length) lk(b.guild, 'perfil_acceso', E(b.guild.id, '👤 Perfil / acceso', `${b}\n${pf.join('\n')}`).setThumbnail(b.displayAvatarURL()));
});
client.on('guildMemberRemove', async m => {
  const lgs = await m.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }).catch(() => null);
  const e = lgs?.entries.find(x => x.target?.id === m.id && Date.now() - x.createdTimestamp < 8000);
  if (e) lk(m.guild, 'expulsiones', E(m.guild.id, '👢 Miembro expulsado', `**${m.user.tag}** (${m.id})\n**Por:** ${e.executor}\n**Razón:** ${e.reason || 'Sin razón'}`).setThumbnail(m.user.displayAvatarURL()));
});
client.on('guildMemberAdd', m => {
  const dias = Math.floor((Date.now() - m.user.createdTimestamp) / 864e5);
  lk(m.guild, 'bienvenida', E(m.guild.id, '👋 Bienvenida enviada', `${m} (${m.user.tag})\nMiembro número **${m.guild.memberCount}**`).setThumbnail(m.displayAvatarURL()));
  lk(m.guild, 'alertas_incorporate', E(m.guild.id, '🚪 Nuevo miembro', `${m} (${m.user.tag})\n**Cuenta creada:** <t:${Math.floor(m.user.createdTimestamp / 1000)}:R> (${dias} días)${m.user.bot ? '\n🤖 Es un bot' : ''}`));
  if (dias < 7 && !m.user.bot) lk(m.guild, 'anti_alt', E(m.guild.id, '🕵️ Cuenta nueva', `${m} (${m.user.tag})\nCuenta de solo **${dias}** día(s). Posible alt.`).setColor('#FEE75C'));
});

client.login(TOKEN);
/* ======================================================================
   PEGAR ESTE BLOQUE justo ANTES del comentario que dice «EVENTOS» (cerca del final del archivo).
   Añade: 16. BUMP · 17. CONFESIONES · 18. PINTEREST / IMÁGENES · 19. IA
   Opcional (variables de entorno):
     PEXELS_KEY      → imágenes de cualquier tema con Pexels (gratis en pexels.com/api). Sin ella usa Openverse.
     OPENAI_API_KEY  → imágenes IA con OpenAI. Sin ella usa Pollinations (gratis, sin clave).
     IA_MODEL        → modelo de OpenAI (por defecto gpt-image-1; también vale dall-e-3).
   ====================================================================== */

/* ---------- utilidades compartidas ---------- */
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' };
const keep = (map, k, v) => { map.set(k, v); if (map.size > 300) map.delete(map.keys().next().value); };
async function getText(u, opt = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u, { redirect: 'follow', ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
const getJson = async (u, opt) => JSON.parse(await getText(u, opt));
const canSendElsewhere = (i, ch) => !ch || ch.id === i.channelId || i.member.permissions.has(P.ManageMessages);

/* ============================== 16. BUMP (5) ============================== */
// Bump interno: publica el anuncio del servidor en el canal de bump (borrando el anterior), da recompensa,
// lleva ranking y avisa con un ping cuando toca el siguiente. Además detecta el /bump de DISBOARD y
// reinicia el contador solo (un bot no puede hacer bump en Disboard por ti; eso lo hace una persona).
const DISBOARD_ID = '302050872383242240';
const BC = cf => (cf.bump ??= { every: 120, reward: 50, dis: true });
// ---- Tarjetas del bump (mismo estilo que el ejemplo: título grande, cita, recompensas, pie) ----
const tx = t => new TextDisplayBuilder().setContent(t);
const bsep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const bumpFoot = () => `-# <:1452312428262981753:1560539478991437854> Desarrollado por ${client.user?.username || 'este bot'}`;
const bumpRw = b => ({ coins: b.reward ?? 0, gems: b.gems ?? 0, xp: b.xp ?? 5 });
function bumpDonePayload(guild, user, b, cf, rw) {
  const rewards = [rw.coins > 0 && `+${fn(rw.coins)} Monedas ${cf.cur}`, rw.gems > 0 && `+${fn(rw.gems)} Gemas 💎`, rw.xp > 0 && `+${fn(rw.xp)} XP ✨`].filter(Boolean).join(', ');
  const quote = `> ¡El servidor fue realzado con éxito!\n> Vuelve ${when(b.every * 60000)} para realzar el servidor de nuevo. ¡Gracias por tu apoyo ${user}!`;
  const foot = `-# Realzado por ${user} · <t:${Math.floor(Date.now() / 1000)}:R>`;
  if (!ContainerBuilder || !SectionBuilder || !ThumbnailBuilder) return { embeds: [E(guild.id, '# <:1452312428262981753:1560539478991437854> | ¡Realce Exitoso!', `${quote.replace(/^> /gm, '')}${rewards ? `\n\n🎁 **Recompensas Recibidas**\n${rewards}` : ''}\n\n${foot}`)], allowedMentions: { parse: [] } };
  const c = new ContainerBuilder().addSectionComponents(new SectionBuilder().addTextDisplayComponents(tx('# <:1452312428262981753:1560539478991437854> | ¡Realce Exitoso!'), tx(quote))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ extension: 'png', size: 256 }))));
  if (rewards) c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(`🎁 **Recompensas Recibidas**\n**${rewards}**`));
  c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(foot)).addSeparatorComponents(bsep()).addTextDisplayComponents(tx(bumpFoot()));
  return { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
}
// ---- Campana animada: el bot sube solo el emoji "campana_nueva" (GIF) la primera vez y lo reutiliza ----
const BELL_GIF = 'R0lGODlhgACAAPf/AAAAAA0JAiQZBjsrC1A7Fl9WJnlwWXpNHIRvHYh/bI6BSpNlM5aLc5d+HZmNYZqQUJyRKaB2QaB3GaaLKqaadKmIT6mcUKmhNKtTJqyHKayaYbBuG7GogbabM7eAI7iWULqmbL2qP76lW8GVMsS1hMq1ccyjQs+1ZdCxUtG0Pdq5W96wQeC6Q+C/auSuUue9U+i2Qui8PejIdOnJQe2vQe/FXPGvN/G6QfHBSPKzP/S0Pfe4QfmvPPmzO/ywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPPywPAD/ACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJBAA/ACwiAB4AQgBOAIUAAAANCQIkGQY7KwtQOxZfViZ5cFl6TRyEbx2If2yOgUqTZTOWi3OXfh2ZjWGakFCckSmgdkGgdxmmiyqmmnSpiE+pnFCpoTSrUyashymsmmGw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';
let BELL_CACHE = null;
async function bellEmoji(guild) {
  if (BELL_CACHE) return BELL_CACHE;
  const fmt = e => `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`, buf = () => Buffer.from(BELL_GIF, 'base64');
  try { // emoji de la aplicación (discord.js >= 14.17): funciona en todos los servidores sin ocupar slots
    const app = client.application?.emojis;
    if (app?.create) { const all = await app.fetch(); const e = all.find(x => x.name === 'campana_nueva') || await app.create({ attachment: buf(), name: 'campana_nueva' }); return (BELL_CACHE = fmt(e)); }
  } catch (err) { console.warn(`[bump] emoji de aplicación: ${err.message}`); }
  try { // respaldo: emoji del servidor (necesita permiso Gestionar emojis y stickers)
    const e = guild.emojis.cache.find(x => x.name === 'campana_nueva') || await guild.emojis.create({ attachment: buf(), name: 'campana_nueva' });
    return fmt(e);
  } catch (err) { console.warn(`[bump] no pude crear la campana animada: ${err.message}`); return '🔔'; }
}
function bumpDuePayload(guild, b, bell = '🔔') {
  const quote = `> ¡El servidor está listo para el próximo realce!\n> ${b.rt || `Usa /bump ahora${b.dis ? ' (o el /bump de Disboard)' : ''} para apoyar el servidor.`}`, icon = guild.iconURL?.({ extension: 'png', size: 256 });
  if (!ContainerBuilder) return { content: b.role ? `<@&${b.role}>` : undefined, allowedMentions: { roles: b.role ? [b.role] : [] }, embeds: [E(guild.id, '🔔 | ¡Es hora de realzar!', quote.replace(/^> /gm, ''))] };
  const c = new ContainerBuilder();
  if (icon && SectionBuilder && ThumbnailBuilder) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(tx(`## ${bell} | ¡Es hora de realzar!`), tx(quote)).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)));
  else c.addTextDisplayComponents(tx(`## ${bell} | ¡Es hora de realzar!`), tx(quote));
  c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(bumpFoot()));
  return { components: b.role ? [tx(`<@&${b.role}>`), c] : [c], flags: 1 << 15, allowedMentions: { roles: b.role ? [b.role] : [] } };
}
const bumpGive = (gid, user, b, rw) => { const u = U(gid, user.id); u.bumps = (u.bumps || 0) + 1; u.coins += rw.coins; u.gems = (u.gems || 0) + rw.gems; b.total = (b.total || 0) + 1; save(); };
async function bumpXp(guild, user, xp, ch) {
  if (!(xp > 0)) return; const mem = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null); if (mem) await addXp(mem, xp, ch).catch(() => {});
}
def('bump', 'ahora', 'Haz bump: apoya al servidor y recibe recompensas', '', null, async (i, o, g, cf) => {
  const b = BC(cf); if (!b.ch) return no(i, 'Un admin debe configurar el canal con `/bump config`.');
  const left = (b.next || 0) - Date.now(); if (left > 0) return no(i, `Todavía no se puede hacer bump. Disponible ${when(left)}.`);
  const ch = i.guild.channels.cache.get(b.ch), ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar el bump: ${ci}.`);
  const prev = { last: b.last, next: b.next, notified: b.notified }; b.last = Date.now(); b.next = b.last + b.every * 60000; b.notified = false; // se fija ya para que dos bumps a la vez no cuenten doble
  const rw = bumpRw(b), p = bumpDonePayload(i.guild, i.user, b, cf, rw);
  try {
    await ch.send(p); // lo publica el BOT como mensaje normal (no como respuesta al comando del usuario)
    await i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Bump hecho', `Publicado en ${ch}.`)] }); // confirmación privada, solo la ve quien usó /bump
  } catch (err) { Object.assign(b, prev); return no(i, `No pude publicar: ${err.message}`); }
  bumpGive(i.guildId, i.user, b, rw); bumpXp(i.guild, i.user, rw.xp, i.channel).catch(() => {}); // los mensajes del bump se quedan (no se borra ninguno)
});
def('bump', 'config', 'Canal, rol a avisar, intervalo, premio y detección de Disboard', 'canal:c,rol:r,minutos:i,premio:i,gemas:i,xp:i,disboard:b,recordatorio:s', 'ManageGuild', (i, o, g, cf) => {
  const b = BC(cf);
  if (o.canal) { const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`); b.ch = o.canal.id; }
  if (!b.ch) return no(i, 'Indica un `canal` la primera vez.');
  let warn = '';
  if (o.rol) { b.role = o.rol.id; if (!o.rol.mentionable && !i.guild.members.me.permissions.has(P.MentionEveryone)) warn = `\n⚠️ ${o.rol} no es mencionable: hazlo mencionable o dale al bot el permiso **Mencionar @everyone**.`; }
  if (o.minutos != null) { if (o.minutos < 10 || o.minutos > 1440) return no(i, '`minutos` debe estar entre 10 y 1440 (Disboard usa 120).'); b.every = o.minutos; }
  if (o.premio != null) b.reward = Math.max(0, o.premio);
  if (o.gemas != null) b.gems = Math.max(0, o.gemas);
  if (o.xp != null) b.xp = Math.max(0, o.xp);
  if (o.disboard != null) b.dis = o.disboard;
  if (o.recordatorio) b.rt = nl(o.recordatorio);
  save();
  ok(i, `📍 Canal: <#${b.ch}>\n🔔 Rol: ${b.role ? `<@&${b.role}>` : '—'}\n⏱️ Intervalo: **${b.every} min**\n🎁 Premio: **${b.reward}** ${cf.cur} · **${b.gems ?? 0}** gemas · **${b.xp ?? 5}** XP\n💜 Detectar /bump de Disboard: **${b.dis ? 'sí' : 'no'}**${warn}`);
});
def('bump', 'estado', 'Cuándo toca el próximo bump', '', null, (i, o, g, cf) => {
  const b = BC(cf); if (!b.ch) return say(i, '📈 Bump', 'No configurado. Un admin debe usar `/bump config`.', true);
  say(i, '📈 Bump', `Canal: <#${b.ch}>\nBumps totales: **${b.total || 0}**\n${(b.next || 0) > Date.now() ? `⏳ Próximo bump ${when(b.next - Date.now())}` : '✅ **¡Ya se puede hacer bump!** Usa `/bump ahora`'}`);
});
def('bump', 'top', 'Ranking de bumpers', '', null, (i, o, g) => {
  const r = Object.entries(g.users).filter(([, u]) => u.bumps > 0).sort((a, b) => b[1].bumps - a[1].bumps).slice(0, 10);
  say(i, '🏆 Top bumpers', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — **${x[1].bumps}** bumps`).join('\n') || 'Nadie ha hecho bump todavía.');
});
def('bump', 'desactivar', 'Apaga el sistema de bump', '', 'ManageGuild', (i, o, g, cf) => { delete cf.bump; save(); ok(i, 'Sistema de bump desactivado.'); });

const DBH = new Set();
async function disboardBump(m) {
  const cf = C(m.guildId), b = BC(cf); if (b.dis === false) return;
  const t = m.embeds.map(e => `${e.title || ''} ${e.description || ''}`).join(' ') + ' ' + (m.content || '');
  const done = /bump\s+(done|hecho|realizad|efectuad|effectu|r[ée]ussi)/i.test(t) || (/disboard/i.test(t) && /👍|:thumbsup:/.test(t));
  if (!done || DBH.has(m.id)) return; DBH.add(m.id); if (DBH.size > 50) DBH.delete(DBH.values().next().value);
  const who = m.interactionMetadata?.user ?? m.interaction?.user;
  b.last = Date.now(); b.next = b.last + b.every * 60000; b.notified = false; b.ch ||= m.channelId;
  const rw = bumpRw(b); if (who) bumpGive(m.guildId, who, b, rw); else { b.total = (b.total || 0) + 1; save(); }
  const user = who || { toString: () => 'un miembro', displayAvatarURL: () => m.guild.iconURL({ extension: 'png', size: 256 }) || client.user.displayAvatarURL({ extension: 'png', size: 256 }) };
  await m.channel.send(bumpDonePayload(m.guild, user, b, cf, who ? rw : { coins: 0, gems: 0, xp: 0 })).catch(err => console.warn(`[bump] no pude publicar: ${err.message}`));
  if (who) bumpXp(m.guild, who, rw.xp, m.channel).catch(() => {});
}
let bumpBusy = false;
async function bumpTick() {
  if (bumpBusy) return; bumpBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const b = g.cfg?.bump; if (!b?.ch || !b.next || b.notified || Date.now() < b.next) continue;
      const guild = client.guilds.cache.get(gid), ch = guild?.channels.cache.get(b.ch); if (!ch) continue;
      b.notified = true; save();
      await ch.send(bumpDuePayload(guild, b, await bellEmoji(guild))).catch(err => console.warn(`[bump] no pude avisar en ${b.ch}: ${err.message}`));
    }
  } finally { bumpBusy = false; }
}

/* ========================== 17. CONFESIONES (9) ========================== */
// Estilo Secretly: el BOT publica la confesión al instante en el canal (nadie ve quién la envía) y NADIE del staff la revisa.
// Panel con botón "Enviar" (se puede usar las veces que se quiera) · imagen opcional · color · permitir respuestas.
// El bot guarda el autor SOLO para moderar abusos (/confesion autor, solo admins y queda en logs). `/confesion guardar estado:false` = 100% anónimo.
const CFC = cf => (cf.conf ??= { store: true });
const CFD = g => (g.conf ??= { n: 0, items: {}, ban: [] });
const CF_COLORS = { rosa: 0xEB459E, rojo: 0xED4245, naranja: 0xE67E22, amarillo: 0xFEE75C, verde: 0x57F287, azul: 0x3498DB, morado: 0x9B59B6, blanco: 0xFFFFFF };
const CF_NAMES = { random: 'Random', rosa: 'Rosa', rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', azul: 'Azul', morado: 'Morado', blanco: 'Blanco' };
const cfColor = k => CF_COLORS[k] ?? 0x4f545c; // sin color elegido = gris, como en el diseño
// Botones: panel = [Dejar Confesión] · cada confesión = [Dejar Confesión] [Responder]
const cfRow = (n, likes = 0, noreply = false) => {
  const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cf_open').setLabel('· Dejar Confesión').setEmoji('🤔').setStyle(ButtonStyle.Secondary));
  if (n && !noreply) r.addComponents(new ButtonBuilder().setCustomId(`cf_re_${n}`).setLabel('· Responder').setEmoji('😒').setStyle(ButtonStyle.Secondary));
  return r;
};
const cfBrand = gid => CFC(C(gid)).brand || 'Club 24/7';
// Confesión: autor "Club 24/7 · Anónimo", título, texto, "Respuesta anónima" (si responde), imagen y pie
function cfPayload(gid, n, text, likes = 0, re = null, color = 0x4f545c, imgName = null, noreply = false) {
  const e = new EmbedBuilder().setColor(color).setAuthor({ name: `${cfBrand(gid)} · Anónimo` }).setTitle(`Anónimo #${n}`).setDescription(text)
    .setFooter({ text: 'Pulsa Enviar para compartir sin mostrar tu nombre.' });
  if (re) e.addFields({ name: 'Respuesta anónima', value: `\`\`\`ansi\n\u001b[2;31mA la publicación #${re}\u001b[0m\n\`\`\`` });
  if (imgName) e.setImage(`attachment://${imgName}`);
  return { embeds: [e], components: [cfRow(n, likes, noreply)], allowedMentions: { parse: [] } };
}
async function publishConfession(guild, n, text, img) {
  const c = CFC(C(guild.id)), d = CFD(G(guild.id)), ch = guild.channels.cache.get(c.ch), ci = chIssue(guild, ch); if (ci) throw new Error(ci);
  const it = d.items[n], ref = it.re && d.items[it.re]?.msg;
  const m = await ch.send({ ...cfPayload(guild.id, n, text, 0, it.re, it.color, img?.name, it.noreply),
    ...(img ? { files: [new AttachmentBuilder(img.buf, { name: img.name })] } : {}),
    ...(ref ? { reply: { messageReference: ref, failIfNotExists: false } } : {}) });
  Object.assign(it, { msg: m.id, status: 'ok' }); delete it.text; save(); return m;
}
// Formulario "Enviar secretamente": mensaje, imagen (opcional), color y permitir respuestas. Si tu discord.js es antiguo, cae a un formulario solo de texto.
function cfModal(basic) {
  const m = new ModalBuilder().setCustomId('cf_modal').setTitle('Enviar secretamente');
  const txt = new TextInputBuilder().setCustomId('text').setPlaceholder('¿Qué quieres compartir?').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true);
  const simple = () => m.addComponents(new ActionRowBuilder().addComponents(txt.setLabel('¿Qué quieres confesar?')));
  if (basic || !LabelBuilder || !FileUploadBuilder) return simple();
  try {
    const col = new StringSelectMenuBuilder().setCustomId('color').addOptions(Object.entries(CF_NAMES).map(([value, label]) => ({ label, value, default: value === 'random' })));
    const lb = [
      new LabelBuilder().setLabel('Escribe tu mensaje secreto').setTextInputComponent(txt),
      new LabelBuilder().setLabel('Imagen (opcional)').setFileUploadComponent(new FileUploadBuilder().setCustomId('image').setRequired(false).setMinValues(0).setMaxValues(1)),
      new LabelBuilder().setLabel('Color').setStringSelectMenuComponent(col),
    ];
    if (CheckboxBuilder && LabelBuilder.prototype.setCheckboxComponent) lb.push(new LabelBuilder().setLabel('Permitir respuestas').setCheckboxComponent(new CheckboxBuilder().setCustomId('replies').setDefault(true)));
    else lb.push(new LabelBuilder().setLabel('Permitir respuestas').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('replies').addOptions({ label: 'Sí', value: 'si', default: true }, { label: 'No', value: 'no' })));
    return m.addLabelComponents(...lb);
  } catch { return simple(); }
}
const cfShowModal = async i => { try { await i.showModal(cfModal()); } catch (err) { console.warn('[confesiones] formulario avanzado no disponible:', err.message); await i.showModal(cfModal(true)); } };
function cfOpts(i) { // lee color, respuestas e imagen del formulario (todo opcional)
  const o = {}, f = k => { try { return i.fields.fields.get(k); } catch { return null; } };
  o.color = f('color')?.values?.[0];
  const r = f('replies'); if (r) o.noreply = typeof r.value === 'boolean' ? !r.value : r.values?.[0] === 'no';
  try { o.att = i.fields.getUploadedFiles('image', false)?.first() || null; } catch { o.att = null; }
  return o;
}
async function submitConfession(i, raw, re, o = {}) {
  const g = G(i.guildId), cf = C(i.guildId), c = CFC(cf), d = CFD(g);
  const fail = m => (i.deferred || i.replied) ? i.editReply({ embeds: [E(i.guildId, '❌ Error', m)] }) : no(i, m);
  if (!c.ch) return fail('Las confesiones no están configuradas. Un admin debe usar `/confesion setup`.');
  if (d.ban.includes(i.user.id)) return fail('No puedes enviar confesiones en este servidor.');
  const text = String(raw || '').replace(/@(everyone|here)/gi, '@\u200b$1').trim();
  if (text.length < 5 || text.length > 1800) return fail('La confesión debe tener entre 5 y 1800 caracteres.');
  if (/https?:\/\/|discord\.gg\/|www\./i.test(text)) return fail('Las confesiones no pueden incluir enlaces.');
  if (g.badwords.some(w => text.toLowerCase().includes(w))) return fail('Tu confesión contiene palabras no permitidas.');
  const ch = i.guild.channels.cache.get(c.ch), ci = chIssue(i.guild, ch);
  if (ci) { lg(i.guildId, 'general', E(i.guildId, '⚠️ Confesiones con problemas', `Canal de confesiones: ${ci}`)); return fail('No se puede publicar ahora mismo. Avisa a un administrador.'); }
  if (re && !d.items[re]?.msg) return fail('Esa confesión ya no existe, no puedes responderla.');
  if (re && d.items[re]?.noreply) return fail('Esa confesión no permite respuestas.');
  const u = U(i.guildId, i.user.id), r = cd(u, 'conf', 10000); if (r) return fail(`Espera un momento antes de enviar otra: ${when(r)}`);
  let img = null;
  if (o.att) { // el bot descarga la imagen y la vuelve a subir él mismo, así nadie ve quién la mandó
    const a = o.att;
    if (!String(a.contentType || '').startsWith('image/')) { u.cd.conf = 0; return fail('El archivo debe ser una imagen (png, jpg, gif, webp).'); }
    if (a.size > 8 * 1024 * 1024) { u.cd.conf = 0; return fail('La imagen pesa demasiado (máximo 8 MB).'); }
    await i.deferReply({ flags: 64 });
    try { const res = await fetch(a.url); if (!res.ok) throw new Error(`HTTP ${res.status}`); img = { buf: Buffer.from(await res.arrayBuffer()), name: `confesion.${(a.name?.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png'}` }; }
    catch (err) { u.cd.conf = 0; return fail(`No pude descargar la imagen: ${err.message}`); }
  }
  const n = ++d.n; d.items[n] = { uid: c.store === false ? null : i.user.id, status: 'ok', re: re || undefined, color: cfColor(o.color), noreply: o.noreply || undefined };
  const note = c.store === false ? '' : '\n-# Los administradores pueden consultar el autor solo en caso de abuso.';
  let pm; try { pm = await publishConfession(i.guild, n, text, img); } catch (err) { d.n--; delete d.items[n]; save(); u.cd.conf = 0; return fail(`No pude publicar: ${err.message}`); }
  const e = E(i.guildId, '🤫 Enviado', `Tu mensaje se publicó de forma anónima como **Anónimo #${n}**: ${pm.url}${note}`);
  return i.deferred ? i.editReply({ embeds: [e] }) : i.reply({ embeds: [e], flags: 64 });
}
const cfPanel = (gid, c) => {
  const e = new EmbedBuilder().setColor(0x4f545c).setAuthor({ name: `${cfBrand(gid)} · Anónimo` }).setTitle('Confesiones')
    .setDescription('Para mandar una confesión solo tienes que pulsar el botón que dice **Dejar Confesión**.')
    .setFooter({ text: 'Pulsa Enviar para compartir sin mostrar tu nombre.' });
  if (url(c.img)) e.setImage(c.img);
  return { embeds: [e], components: [cfRow()] };
};
ROOT.add('confesiones');
def('confesiones', 'run', 'Publica el panel de confesiones anónimas y lo configura solo', 'canal:c,imagen:s,nombre:s,reportes:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ch = o.canal ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar en ${ch}: ${ci}.`);
  if (o.reportes) { const ri = chIssue(i.guild, o.reportes); if (ri) return no(i, `No puedo usar ${o.reportes}: ${ri}.`); c.review = o.reportes.id; }
  if (o.nombre) c.brand = o.nombre.trim().slice(0, 30);
  if (o.imagen) { if (/^(quitar|ninguna)$/i.test(o.imagen.trim())) delete c.img; else if (url(o.imagen.trim())) c.img = o.imagen.trim(); else return no(i, 'La imagen debe ser un link que empiece con https://'); }
  c.ch = ch.id; save();
  try { await ch.send(cfPanel(i.guildId, c)); } catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  say(i, '✅ Listo', `Panel publicado en ${ch}. Las confesiones saldrán debajo, ya configuradas.\nNombre: **${cfBrand(i.guildId)} · Anónimo**${c.img ? '\nImagen del panel: guardada' : ''}`, true);
});
def('confesion', 'setup', 'Configura el canal de confesiones y publica el panel automáticamente', 'canal:c!,reportes:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`);
  if (o.reportes) { const ri = chIssue(i.guild, o.reportes); if (ri) return no(i, `No puedo usar ${o.reportes}: ${ri}.`); c.review = o.reportes.id; }
  c.ch = o.canal.id; save();
  try { await o.canal.send(cfPanel(i.guildId, c)); } catch (err) { return no(i, `Guardé el canal pero no pude publicar el panel: ${err.message}`); }
  ok(i, `Confesiones → ${o.canal} (panel publicado)\nPublicación: **instantánea, sin revisión del staff**\nReportes de usuarios: ${c.review ? `<#${c.review}>` : 'solo en los logs'}\nGuardar autor para moderar: **${c.store === false ? 'no (100% anónimo)' : 'sí'}**`);
});
def('confesion', 'panel', 'Vuelve a publicar el panel con el botón de confesar', 'canal:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ch = o.canal ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar ahí: ${ci}.`);
  await ch.send(cfPanel(i.guildId, c));
  ok(i, 'Panel enviado.');
});
def('confesion', 'enviar', 'Envía una confesión anónima', 'texto:s!', null, (i, o) => submitConfession(i, o.texto));
def('confesion', 'guardar', 'Guardar o no el autor (para moderar abusos)', 'estado:b!', 'Administrator', (i, o, g, cf) => {
  CFC(cf).store = o.estado; save(); ok(i, o.estado ? 'Se guarda el autor de las confesiones nuevas (solo consultable por admins con `/confesion autor`).' : 'Las confesiones nuevas **no** guardan autor: 100% anónimas, pero no podrás identificar abusos.');
});
def('confesion', 'autor', 'Revela el autor de una confesión (solo admins, queda en logs)', 'numero:i!', 'Administrator', (i, o, g) => {
  const it = CFD(g).items[o.numero]; if (!it) return no(i, 'No existe esa confesión.');
  if (!it.uid) return no(i, 'No se guardó el autor de esa confesión.');
  lg(i.guildId, 'mod', E(i.guildId, '🕵️ Autor de confesión consultado', `${i.user} consultó el autor de la confesión **#${o.numero}**.`));
  say(i, `🕵️ Confesión #${o.numero}`, `Autor: <@${it.uid}> (\`${it.uid}\`)\n-# Esta consulta quedó registrada en los logs de moderación.`, true);
});
def('confesion', 'borrar', 'Borra una confesión publicada', 'numero:i!', 'ManageMessages', async (i, o, g, cf) => {
  const it = CFD(g).items[o.numero]; if (!it || !it.msg) return no(i, 'No existe esa confesión publicada.');
  await i.guild.channels.cache.get(CFC(cf).ch)?.messages.delete(it.msg).catch(() => {}); it.status = 'deleted'; save(); ok(i, `Confesión #${o.numero} borrada.`);
});
def('confesion', 'bloquear', 'Impide que un usuario envíe confesiones', 'usuario:u!', 'ManageMessages', (i, o, g) => { const d = CFD(g); if (!d.ban.includes(o.usuario.id)) d.ban.push(o.usuario.id); save(); ok(i, `${o.usuario} ya no puede enviar confesiones.`); });
def('confesion', 'desbloquear', 'Permite de nuevo confesar a un usuario', 'usuario:u!', 'ManageMessages', (i, o, g) => { const d = CFD(g); d.ban = d.ban.filter(x => x !== o.usuario.id); save(); ok(i, `${o.usuario} puede confesar otra vez.`); });
def('confesion', 'estado', 'Ver la configuración de confesiones', '', 'ManageGuild', (i, o, g, cf) => {
  const c = CFC(cf), d = CFD(g);
  say(i, '🤫 Confesiones', `Canal: ${c.ch ? `<#${c.ch}>` : '—'}\nReportes: ${c.review ? `<#${c.review}>` : 'solo logs'} · Publicación: instantánea\nGuardar autor: **${c.store === false ? 'no' : 'sí'}**\nPublicadas: **${Object.values(d.items).filter(x => x.status === 'ok').length}**\nBloqueados: **${d.ban.length}**`, true);
});

/* ================== 18. PINTEREST E IMÁGENES DE TODO (8) ================== */
// - tablero/auto: lee tableros PÚBLICOS de Pinterest por su feed RSS oficial (Pinterest no tiene búsqueda pública gratuita).
// - pin: muestra la imagen de un pin concreto (enlace pinterest.com/pin/... o pin.it/...).
// - buscar: imágenes de CUALQUIER tema con Pexels (si defines PEXELS_KEY) u Openverse (sin clave).
const PN = cf => (cf.pin ??= { boards: {}, auto: {} });
const PSM = new Map(), PC = new Map();
function pinRss(s) {
  try {
    const u = new URL(String(s).trim()); if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
    const p = u.pathname.replace(/\.rss$/i, '').split('/').filter(Boolean);
    if (!p.length || ['pin', 'search', 'ideas', 'today', 'business', 'settings'].includes(p[0])) return null;
    return p.length === 1 ? `https://www.pinterest.com/${p[0]}/feed.rss` : `https://www.pinterest.com/${p[0]}/${p[1]}.rss`;
  } catch { return null; }
}
async function pinItems(rss) {
  const c = PC.get(rss); if (c && Date.now() - c.t < 6e5) return c.items;
  const x = await getText(rss), items = [];
  for (const raw of x.split('<item>').slice(1)) {
    const it = raw.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const img = (it.match(/src=["'](https:\/\/i\.pinimg\.com\/[^"']+)["']/i) || [])[1]; if (!img) continue;
    items.push({ img: img.replace(/\/\d+x\d*\//, '/736x/'), link: (it.match(/<link>\s*([^<\s]+)\s*<\/link>/) || [])[1],
      title: ((it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '').trim() });
  }
  if (!items.length) throw new Error('el tablero está vacío, es privado, o Pinterest bloqueó la lectura');
  PC.set(rss, { t: Date.now(), items }); return items;
}
async function pinPage(u) {
  let h; try { h = new URL(u).hostname; } catch { throw new Error('enlace no válido'); }
  if (!/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i.test(h)) throw new Error('el enlace no es de Pinterest');
  const html = await getText(u), meta = p => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i')) || [])[1];
  const img = meta('og:image'); if (!img) throw new Error('no pude leer la imagen de ese pin (¿es privado?)');
  return { img: img.replace(/&amp;/g, '&'), link: u, title: (meta('og:title') || '').replace(/&amp;/g, '&').slice(0, 200), src: 'Pinterest' };
}
async function stockImages(q) {
  if (process.env.PEXELS_KEY) {
    try {
      const r = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=40`, { headers: { Authorization: process.env.PEXELS_KEY } });
      const l = (r.photos || []).map(p => ({ img: p.src.large2x || p.src.large, link: p.url, title: p.alt, by: p.photographer, src: 'Pexels' }));
      if (l.length) return l;
    } catch (err) { console.warn('[pexels]', err.message); }
  }
  const r = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=40&mature=false`);
  return (r.results || []).filter(x => url(x.url)).map(x => ({ img: x.url, link: x.foreign_landing_url, title: x.title, by: x.creator, src: 'Openverse' }));
}
const pinResolve = (cf, s) => PN(cf).boards[String(s).trim().toLowerCase()] ?? String(s).trim();
const pinKind = s => (pinRss(s) ? 'board' : 'topic');
async function pinFetch(kind, src) {
  if (kind === 'board') return (await pinItems(pinRss(src))).map(x => ({ ...x, src: 'Pinterest' }));
  if (kind === 'pin') return [await pinPage(src)];
  const l = await stockImages(src); if (!l.length) throw new Error('no encontré imágenes para ese tema'); return l;
}
function pinPayload(gid, items, more) {
  const es = items.map(it => {
    const e = new EmbedBuilder().setColor(it.src === 'Pinterest' ? '#E60023' : C(gid).color).setImage(it.img).setFooter({ text: [it.src, it.by].filter(Boolean).join(' · ').slice(0, 2048) });
    if (it.title) e.setTitle(String(it.title).slice(0, 250)); return e;
  });
  const row = new ActionRowBuilder();
  if (more) row.addComponents(new ButtonBuilder().setCustomId('pin_more').setLabel('Otra imagen').setEmoji('🔄').setStyle(ButtonStyle.Secondary));
  if (items.length === 1 && url(items[0].link)) row.addComponents(new ButtonBuilder().setLabel('Ver original').setStyle(ButtonStyle.Link).setURL(items[0].link));
  return { embeds: es, components: row.components.length ? [row] : [] };
}
async function pinSend(i, o, kind, src) {
  const dest = o.canal ?? i.channel;
  if (!canSendElsewhere(i, o.canal)) return no(i, 'Para enviar a otro canal necesitas **Gestionar mensajes**.');
  const ci = chIssue(i.guild, dest); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`);
  const here = dest.id === i.channelId; await i.deferReply({ flags: here ? undefined : 64 });
  let items; try { items = await pinFetch(kind, src); } catch (err) { return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude obtener imágenes: ${err.message}`)] }); }
  const n = kind === 'pin' ? 1 : Math.min(6, Math.max(1, o.cantidad || 1)), pick = [...items].sort(() => Math.random() - 0.5).slice(0, n), more = kind !== 'pin' && n === 1;
  const p = pinPayload(i.guildId, pick, more);
  try {
    const m = here ? await i.editReply(p) : await dest.send(p); if (more) keep(PSM, m.id, { kind, src });
    if (!here) i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Imagen enviada a ${dest}`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude publicar la imagen: ${err.message}`)] }).catch(() => {}); }
}
def('pinterest', 'buscar', 'Imagen de CUALQUIER tema (gatos, coches, anime, paisajes...)', 'tema:s!,cantidad:i,canal:c', null, (i, o) => pinSend(i, o, 'topic', o.tema));
def('pinterest', 'tablero', 'Imagen aleatoria de un tablero público de Pinterest (enlace o nombre guardado)', 'tablero:s!,cantidad:i,canal:c', null, (i, o, g, cf) => {
  const src = pinResolve(cf, o.tablero); if (!pinRss(src)) return no(i, 'Pega el enlace de un tablero **público** (pinterest.com/usuario/tablero) o un nombre guardado con `/pinterest guardar`.');
  return pinSend(i, o, 'board', src);
});
def('pinterest', 'pin', 'Muestra la imagen de un pin (enlace pinterest.com/pin/... o pin.it/...)', 'enlace:s!,canal:c', null, (i, o) => pinSend(i, o, 'pin', o.enlace.trim()));
def('pinterest', 'guardar', 'Guarda un tablero con un nombre corto', 'nombre:s!,enlace:s!', 'ManageGuild', (i, o, g, cf) => {
  if (!pinRss(o.enlace)) return no(i, 'Eso no parece un tablero público de Pinterest.');
  if (!/^[\w-]{1,30}$/.test(o.nombre)) return no(i, 'El nombre solo puede tener letras, números, `_` y `-` (máx. 30).');
  PN(cf).boards[o.nombre.toLowerCase()] = o.enlace.trim(); save(); ok(i, `Tablero guardado como **${o.nombre.toLowerCase()}**. Úsalo con \`/pinterest tablero tablero:${o.nombre.toLowerCase()}\`.`);
});
def('pinterest', 'quitar', 'Quita un tablero guardado', 'nombre:s!', 'ManageGuild', (i, o, g, cf) => { delete PN(cf).boards[o.nombre.toLowerCase()]; save(); ok(i, 'Tablero eliminado.'); });
def('pinterest', 'lista', 'Tableros guardados y publicaciones automáticas', '', null, (i, o, g, cf) => {
  const p = PN(cf), b = Object.entries(p.boards).map(([n, u]) => `**${n}** → ${u}`), a = Object.entries(p.auto).map(([id, x]) => `<#${id}> · cada **${x.hours} h** · ${x.kind === 'board' ? 'tablero' : 'tema'}: \`${String(x.src).slice(0, 60)}\``);
  say(i, '📌 Pinterest', `**Tableros guardados**\n${b.join('\n') || 'Ninguno'}\n\n**Automático**\n${a.join('\n') || 'Ninguno'}`, true);
});
def('pinterest', 'auto', 'Publica una imagen cada X horas (tablero, nombre guardado o tema)', 'canal:c!,fuente:s!,horas:i!', 'ManageGuild', (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  if (o.horas < 1 || o.horas > 168) return no(i, '`horas` debe estar entre 1 y 168.');
  const src = pinResolve(cf, o.fuente), kind = pinKind(src); PN(cf).auto[o.canal.id] = { src, kind, hours: o.horas, last: 0 }; save();
  ok(i, `${o.canal} recibirá una imagen cada **${o.horas} h** (${kind === 'board' ? 'del tablero' : 'del tema'} \`${src.slice(0, 80)}\`).\nLa primera llega en menos de 1 minuto.`);
});
def('pinterest', 'autoquitar', 'Quita la publicación automática de un canal', 'canal:c!', 'ManageGuild', (i, o, g, cf) => {
  if (!PN(cf).auto[o.canal.id]) return no(i, 'Ese canal no tiene publicación automática.'); delete PN(cf).auto[o.canal.id]; save(); ok(i, `Automático desactivado en ${o.canal}.`);
});
let pinBusy = false;
async function pinTick() {
  if (pinBusy) return; pinBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), au = g.cfg?.pin?.auto; if (!guild || !au) continue;
      for (const [cid, a] of Object.entries(au)) {
        if (Date.now() - a.last < a.hours * 36e5) continue;
        const ch = guild.channels.cache.get(cid); if (!ch) { delete au[cid]; save(); continue; }
        a.last = Date.now(); save();
        const ci = chIssue(guild, ch); if (ci) { lg(gid, 'general', E(gid, '⚠️ Pinterest automático fallido', `${ch}: ${ci}`)); continue; }
        try { const m = await ch.send(pinPayload(gid, [R(await pinFetch(a.kind, a.src))], true)); keep(PSM, m.id, { kind: a.kind, src: a.src }); }
        catch (err) { lg(gid, 'general', E(gid, '⚠️ Pinterest automático fallido', `${ch}: ${err.message}`)); }
      }
    }
  } finally { pinBusy = false; }
}

/* ============================ 19. IMÁGENES CON IA (2) ============================ */
// Por defecto usa Pollinations (gratis, sin clave). Con OPENAI_API_KEY usa OpenAI (IA_MODEL, por defecto gpt-image-1).
const IA_RATIO = { cuadrado: [1024, 1024], horizontal: [1280, 720], vertical: [720, 1280] };
const IA_STYLE = { ninguno: '', anime: 'anime style, vibrant colors, detailed', realista: 'photorealistic, ultra detailed, natural lighting', pixel: 'pixel art, 16-bit', pintura: 'oil painting, textured brush strokes',
  '3d': '3D render, soft lighting, stylized', cyberpunk: 'cyberpunk, neon lights, futuristic city', fantasia: 'fantasy art, epic, magical, highly detailed', minimalista: 'minimalist flat illustration, clean shapes' };
CHO['ia.estilo'] = [['Sin estilo', 'ninguno'], ['Anime', 'anime'], ['Realista', 'realista'], ['Pixel art', 'pixel'], ['Pintura al óleo', 'pintura'], ['3D', '3d'], ['Cyberpunk', 'cyberpunk'], ['Fantasía', 'fantasia'], ['Minimalista', 'minimalista']];
CHO['ia.formato'] = [['Cuadrado', 'cuadrado'], ['Horizontal', 'horizontal'], ['Vertical', 'vertical']];
const IAC = cf => (cf.ia ??= { on: true, cool: 30 });
const IAP = new Map();
async function genImage({ prompt, style, ratio, seed }) {
  const full = [prompt, IA_STYLE[style]].filter(Boolean).join(', '), [w, h] = IA_RATIO[ratio] || IA_RATIO.cuadrado;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 90000);
  try {
    if (process.env.OPENAI_API_KEY) {
      const model = process.env.IA_MODEL || 'gpt-image-1', d3 = model === 'dall-e-3';
      const size = ratio === 'horizontal' ? (d3 ? '1792x1024' : '1536x1024') : ratio === 'vertical' ? (d3 ? '1024x1792' : '1024x1536') : '1024x1024';
      const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, prompt: full.slice(0, d3 ? 4000 : 32000), size, n: 1, ...(d3 ? { response_format: 'b64_json' } : {}) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
      const x = d.data?.[0]; if (!x) throw new Error('respuesta vacía');
      return { buf: x.b64_json ? Buffer.from(x.b64_json, 'base64') : Buffer.from(await (await fetch(x.url, { signal: ctl.signal })).arrayBuffer()), ext: 'png' };
    }
    const q = new URLSearchParams({ width: w, height: h, nologo: 'true', safe: 'true', seed: String(seed ?? rnd(1, 999999)) });
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(full.slice(0, 1500))}?${q}`, { signal: ctl.signal, headers: UA });
    if (!r.ok) throw new Error(`el servicio de imágenes respondió ${r.status}`);
    const ct = r.headers.get('content-type') || ''; if (!ct.startsWith('image/')) throw new Error('el servicio no devolvió una imagen');
    return { buf: Buffer.from(await r.arrayBuffer()), ext: ct.includes('png') ? 'png' : 'jpg' };
  } finally { clearTimeout(t); }
}
// `i` debe estar ya con deferReply. dest = canal distinto donde publicar (o null para responder aquí)
async function iaSend(i, s, dest) {
  const { buf, ext } = await genImage(s), name = `ia-${Date.now()}.${ext}`;
  const e = new EmbedBuilder().setColor(C(i.guildId).color).setTitle('🎨 Imagen con IA').setDescription(`**${s.prompt.slice(0, 500)}**`)
    .setImage(`attachment://${name}`).setFooter({ text: `Pedida por ${i.user.tag} · ${s.style} · ${s.ratio}` }).setTimestamp();
  const p = { embeds: [e], files: [new AttachmentBuilder(buf, { name })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ia_re').setLabel('Otra variación').setEmoji('🔄').setStyle(ButtonStyle.Secondary))] };
  const m = dest && dest.id !== i.channelId ? await dest.send(p) : await i.editReply(p);
  keep(IAP, m.id, { prompt: s.prompt, style: s.style, ratio: s.ratio, uid: i.user.id }); return m;
}
def('ia', 'imagen', 'Genera una imagen con IA a partir de un texto', 'prompt:s!,estilo:s,formato:s,semilla:i,canal:c', null, async (i, o, g, cf) => {
  const ia = IAC(cf); if (ia.on === false) return no(i, 'La generación de imágenes con IA está desactivada.');
  const mod = i.member.permissions.has(P.ManageMessages);
  if (ia.ch && i.channelId !== ia.ch && !mod) return no(i, `Las imágenes con IA solo se piden en <#${ia.ch}>.`);
  if (!canSendElsewhere(i, o.canal)) return no(i, 'Para enviar a otro canal necesitas **Gestionar mensajes**.');
  const prompt = o.prompt.trim(); if (prompt.length < 3 || prompt.length > 1000) return no(i, 'El texto debe tener entre 3 y 1000 caracteres.');
  if (g.badwords.some(w => prompt.toLowerCase().includes(w))) return no(i, 'Tu texto contiene palabras no permitidas.');
  const dest = o.canal ?? null; if (dest) { const ci = chIssue(i.guild, dest); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`); }
  const u = U(i.guildId, i.user.id), r = cd(u, 'ia', ia.cool * 1000); if (r) return no(i, `Espera ${when(r)} para pedir otra imagen.`);
  await i.deferReply({ flags: dest && dest.id !== i.channelId ? 64 : undefined });
  try {
    await iaSend(i, { prompt, style: o.estilo || 'ninguno', ratio: o.formato || 'cuadrado', seed: o.semilla ?? undefined }, dest);
    if (dest && dest.id !== i.channelId) i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Imagen enviada a ${dest}`)] });
  } catch (err) { u.cd.ia = 0; i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude generar la imagen: ${err.message}`)] }); }
});
def('ia', 'config', 'Activa/desactiva la IA, cooldown y canal único (sin canal = cualquiera)', 'estado:b,cooldown:i,canal:c', 'ManageGuild', (i, o, g, cf) => {
  const ia = IAC(cf);
  if (o.estado != null) ia.on = o.estado;
  if (o.cooldown != null) { if (o.cooldown < 0 || o.cooldown > 3600) return no(i, '`cooldown` debe estar entre 0 y 3600 segundos.'); ia.cool = o.cooldown; }
  if (o.canal) ia.ch = o.canal.id;
  save(); ok(i, `🎨 IA: **${ia.on === false ? 'desactivada' : 'activada'}**\n⏱️ Cooldown: **${ia.cool}s**\n📍 Canal: ${ia.ch ? `<#${ia.ch}>` : 'cualquiera'}\n🧠 Motor: **${process.env.OPENAI_API_KEY ? `OpenAI (${process.env.IA_MODEL || 'gpt-image-1'})` : 'Pollinations (gratis)'}**`);
});

/* ============== BOTONES Y MODALES NUEVOS (se llama desde interactionCreate) ============== */
/* ========================== 20. POSTULACIONES ========================== */
// Panel público (como el ejemplo) → el usuario elige puesto y rellena un formulario → llega al canal de logs del staff
// con botones Aceptar / Rechazar → el bot avisa al usuario por DM, da el rol del puesto y descuenta el cupo.
const APQ = ['¿Edad y zona horaria?', '¿Por qué quieres ser staff?', '¿Qué experiencia tienes moderando?', '¿Cómo manejarías un conflicto?', '¿Cuánto tiempo puedes dedicar?'];
const AP = cf => (cf.app ??= { pos: [], q: [...APQ], cool: 24 });
const APD = g => (g.postu ??= { n: 0, items: {} });
const apSlug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'puesto';
const apIsStaff = (m, a) => m.permissions.has(P.ManageGuild) || (a.staff && m.roles.cache.has(a.staff));
const apOpen = a => a.pos.filter(p => p.open !== false && p.slots > 0);
const apSlots = a => apOpen(a).reduce((s, p) => s + p.slots, 0);
const apFind = (a, name) => a.pos.find(p => p.id === apSlug(name) || p.name.toLowerCase() === name.toLowerCase());
const AP_DESC = 'Para postularte, debes llenar el siguiente formulario con tus datos y respuestas a las preguntas de manera honesta y detallada. Queremos conocer tus habilidades, tu experiencia y cómo manejarías diferentes situaciones dentro del servidor.';
const AP_ST = { pending: ['🕓 Pendiente', 0xFEE75C], accepted: ['✅ Aceptada', 0x57F287], rejected: ['❌ Rechazada', 0xED4245], withdrawn: ['↩️ Retirada', 0x95A5A6] };

function apRow(a, n) {
  const webOnly = url(a.web) && a.solo_web !== false; // con web configurada → solo el botón de la web (como el ejemplo)
  const r = new ActionRowBuilder();
  if (!webOnly) r.addComponents(new ButtonBuilder().setCustomId('ap_open').setLabel('Postularme').setEmoji('📝').setStyle(ButtonStyle.Primary).setDisabled(n <= 0));
  if (url(a.web)) r.addComponents(new ButtonBuilder().setLabel('Postúlate en la web').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(a.web));
  return r;
}
function apPanelPayload(guild, cf) {
  const a = AP(cf), n = apSlots(a), title = a.title || '📋 Postulaciones', desc = a.desc || AP_DESC, ts = Math.floor(Date.now() / 1000);
  const foot = `💼 ${n > 0 ? `${n} puesto(s) disponible(s)` : 'Postulaciones cerradas'} • ${guild.name}`;
  const clean = String(desc).replace(/^[\s・·•]*¿\s*c[oó]mo postularse\s*\?\s*/i, '').replace(/^[\s・·•]+/, '');
  const how = `**¿ Cómo postularse ?**\n\n・ ${clean}`;
  const help = '📄 **¿Retirar solicitud?**\nUsa `/application withdraw` para eliminar tu solicitud actual.\n\nℹ️ **¿Verificar estado?**\nUsa `/application status` para ver todas tus solicitudes.';
  const web = '🌐 **Postúlate en nuestra web**\n¿Prefieres el navegador? El formulario completo está en nuestra web. Solo tarda unos minutos y puedes tomarte tu tiempo con cada respuesta.';
  if (!ContainerBuilder) return { embeds: [E(guild.id, title, `${how}\n\n${help}${url(a.web) ? `\n\n${web}` : ''}\n\n${foot}`, url(a.img))], components: [apRow(a, n)] };
  const c = new ContainerBuilder(), sep = () => c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)), t = s => c.addTextDisplayComponents(new TextDisplayBuilder().setContent(s));
  if (url(a.img)) { c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(a.img))); sep(); }
  t(`## ${title}`); sep(); t(how); sep(); t(help);
  if (url(a.web)) { sep(); t(web); }
  c.addActionRowComponents(apRow(a, n)); sep(); t(`${foot}\n-# <t:${ts}:F>`);
  return { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
}
async function apRefreshPanel(guild) {
  const a = AP(C(guild.id)); if (!a.panel) return;
  const m = await guild.channels.cache.get(a.panel.ch)?.messages.fetch(a.panel.id).catch(() => null);
  m?.edit(apPanelPayload(guild, C(guild.id))).catch(() => {});
}
function apStaffPayload(guild, e) {
  const [lab, color] = AP_ST[e.status];
  const emb = new EmbedBuilder().setColor(color).setTitle(`📋 Postulación #${e.id} — ${e.posName}`).setTimestamp(e.at)
    .setDescription([`👤 <@${e.user}> (\`${e.tag}\`)`, `📅 Cuenta creada: <t:${Math.floor(e.created / 1000)}:R>`, e.joined ? `📥 Entró al servidor: <t:${Math.floor(e.joined / 1000)}:R>` : null,
      `**Estado:** ${lab}${e.by ? ` por <@${e.by}>` : ''}`, e.reason ? `**Motivo:** ${e.reason}` : null, e.note].filter(Boolean).join('\n'))
    .addFields(e.answers.map(x => ({ name: x.q.slice(0, 256), value: (x.a || '—').slice(0, 1024) })));
  if (e.avatar) emb.setThumbnail(e.avatar);
  const components = e.status === 'pending' ? [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_ok_${e.id}`).setLabel('Aceptar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap_no_${e.id}`).setLabel('Rechazar').setEmoji('❌').setStyle(ButtonStyle.Danger))] : [];
  return { embeds: [emb], components };
}
async function apEditStaff(guild, e) {
  const m = await guild.channels.cache.get(e.msg?.ch)?.messages.fetch(e.msg?.id).catch(() => null);
  await m?.edit({ ...apStaffPayload(guild, e), content: null }).catch(() => {});
}
function apBlock(g, a, uid) {
  const items = Object.values(APD(g).items).filter(x => x.user === uid), pend = items.find(x => x.status === 'pending');
  if (pend) return `Ya tienes la postulación **#${pend.id}** pendiente. Espera la respuesta o retírala con \`/application withdraw\`.`;
  const rej = items.filter(x => x.status === 'rejected').sort((x, y) => y.done - x.done)[0];
  if (rej && a.cool > 0 && Date.now() < rej.done + a.cool * 36e5) return `Tu última postulación fue rechazada. Podrás volver a postularte ${when(rej.done + a.cool * 36e5 - Date.now())}.`;
  return null;
}
const apModal = (a, pos) => new ModalBuilder().setCustomId(`ap_modal_${pos.id}`).setTitle(`Postulación: ${pos.name}`.slice(0, 45)).addComponents(
  ...a.q.slice(0, 5).map((q, k) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`q${k}`).setLabel(q.slice(0, 45)).setStyle(TextInputStyle.Paragraph).setMaxLength(800).setRequired(true))));

// ---- Botones, menú y formularios ----
async function appInteractions(i) {
  const id = i.customId; if (!id?.startsWith('ap_')) return false;
  const gid = i.guildId, g = G(gid), cf = C(gid), a = AP(cf), d = APD(g);
  const ready = () => (!a.logch || !i.guild.channels.cache.get(a.logch)) ? 'Las postulaciones no están configuradas todavía (falta el canal de logs del staff).' : null;
  if (i.isButton() && id === 'ap_open') {
    const bad = ready() || (!apOpen(a).length && 'No hay puestos disponibles ahora mismo.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    const op = apOpen(a);
    if (op.length === 1) { await i.showModal(apModal(a, op[0])); return true; }
    await i.reply({ flags: 64, content: '📝 Elige el puesto al que quieres postularte:', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ap_pick').setPlaceholder('Selecciona un puesto')
      .addOptions(op.slice(0, 25).map(p => ({ label: p.name.slice(0, 100), value: p.id, description: `${p.slots} cupo(s) disponible(s)` }))))] });
    return true;
  }
  if (i.isStringSelectMenu() && id === 'ap_pick') {
    const pos = apOpen(a).find(p => p.id === i.values[0]), bad = ready() || (!pos && 'Ese puesto ya no está disponible.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    await i.showModal(apModal(a, pos)); return true;
  }
  if (i.isModalSubmit() && id.startsWith('ap_modal_')) {
    const pos = apOpen(a).find(p => p.id === id.slice(9)), bad = ready() || (!pos && 'Ese puesto ya no está disponible.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    await i.deferReply({ flags: 64 });
    const n = ++d.n, mem = i.member;
    const e = d.items[n] = { id: n, user: i.user.id, tag: i.user.username, avatar: i.user.displayAvatarURL({ extension: 'png', size: 256 }), created: i.user.createdTimestamp, joined: mem?.joinedTimestamp || 0,
      pos: pos.id, posName: pos.name, at: Date.now(), status: 'pending',
      answers: [...i.fields.fields.values()].map((f, k) => ({ q: a.q[k] ?? `Pregunta ${k + 1}`, a: (f.value || '').trim() })) };
    try {
      const m = await i.guild.channels.cache.get(a.logch).send({ ...apStaffPayload(i.guild, e), content: a.staff ? `<@&${a.staff}> nueva postulación` : undefined, allowedMentions: { roles: a.staff ? [a.staff] : [] } });
      e.msg = { ch: m.channelId, id: m.id };
    } catch (err) { delete d.items[n]; d.n--; await i.editReply({ embeds: [E(gid, '❌ Error', `No pude enviar tu postulación al staff: ${err.message}`)] }); return true; }
    save();
    await i.editReply({ embeds: [E(gid, '✅ Postulación enviada', `Tu postulación **#${n}** para **${pos.name}** llegó al staff. Te avisaré por mensaje privado cuando la revisen.\nPuedes ver su estado con \`/application status\`.`)] });
    return true;
  }
  const bt = id.match(/^ap_(ok|no)_(\d+)$/);
  if (i.isButton() && bt) {
    if (!apIsStaff(i.member, a)) { await no(i, 'Solo el staff puede revisar postulaciones.'); return true; }
    const e = d.items[+bt[2]]; if (!e) { await no(i, 'No encuentro esa postulación.'); return true; }
    if (e.status !== 'pending') { await i.update({ ...apStaffPayload(i.guild, e), content: null }); return true; } // ya la resolvió otra persona
    if (bt[1] === 'no') { await i.showModal(new ModalBuilder().setCustomId(`ap_rej_${e.id}`).setTitle(`Rechazar postulación #${e.id}`).addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Motivo (se le enviará al usuario)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false)))); return true; }
    e.status = 'accepted'; e.by = i.user.id; e.done = Date.now();
    const pos = a.pos.find(p => p.id === e.pos); if (pos) { pos.slots = Math.max(0, pos.slots - 1); if (pos.slots <= 0) pos.open = false; }
    if (pos?.role) {
      const mem = await i.guild.members.fetch(e.user).catch(() => null);
      if (!mem) e.note = '⚠️ El usuario ya no está en el servidor.';
      else await mem.roles.add(pos.role, `Postulación #${e.id} aceptada por ${i.user.username}`).then(() => { e.note = `🎖️ Rol asignado: <@&${pos.role}>`; }).catch(err => { e.note = `⚠️ No pude dar el rol <@&${pos.role}>: ${err.message}`; });
    }
    save(); await i.update({ ...apStaffPayload(i.guild, e), content: null });
    const u = await client.users.fetch(e.user).catch(() => null);
    if (u) dm(u, E(gid, '🎉 ¡Postulación aceptada!', `Tu postulación **#${e.id}** para **${e.posName}** en **${i.guild.name}** fue **aceptada**.${pos?.role ? `\nSe te asignó el rol **${i.guild.roles.cache.get(pos.role)?.name || 'del puesto'}**.` : ''}\n¡Bienvenido al equipo!`));
    apRefreshPanel(i.guild); return true;
  }
  const rj = id.match(/^ap_rej_(\d+)$/);
  if (i.isModalSubmit() && rj) {
    if (!apIsStaff(i.member, a)) { await no(i, 'Solo el staff puede revisar postulaciones.'); return true; }
    const e = d.items[+rj[1]]; if (!e) { await no(i, 'No encuentro esa postulación.'); return true; }
    if (e.status !== 'pending') { await no(i, 'Esa postulación ya fue resuelta.'); return true; }
    e.status = 'rejected'; e.by = i.user.id; e.done = Date.now(); e.reason = i.fields.getTextInputValue('reason').trim() || null; save();
    const p = { ...apStaffPayload(i.guild, e), content: null };
    if (i.isFromMessage()) await i.update(p); else { await apEditStaff(i.guild, e); await i.reply({ flags: 64, content: 'Postulación rechazada.' }); }
    const u = await client.users.fetch(e.user).catch(() => null);
    if (u) dm(u, E(gid, '❌ Postulación rechazada', `Tu postulación **#${e.id}** para **${e.posName}** en **${i.guild.name}** fue **rechazada**.${e.reason ? `\n\n**Motivo:** ${e.reason}` : ''}${a.cool > 0 ? `\n\nPodrás volver a postularte en ${a.cool} hora(s).` : ''}`));
    return true;
  }
  return false;
}

// ---- Comandos ----
def('application', 'status', 'Mira el estado de todas tus postulaciones', '', null, (i, o, g) => {
  const l = Object.values(APD(g).items).filter(x => x.user === i.user.id).sort((x, y) => y.id - x.id).slice(0, 10);
  if (!l.length) return say(i, '📋 Tus postulaciones', 'Todavía no has enviado ninguna postulación.', true);
  say(i, '📋 Tus postulaciones', l.map(x => `**#${x.id}** · ${x.posName} · ${AP_ST[x.status][0]} · <t:${Math.floor(x.at / 1000)}:R>${x.reason ? `\n> **Motivo:** ${x.reason}` : ''}`).join('\n'), true);
});
def('application', 'withdraw', 'Retira tu postulación pendiente', '', null, async (i, o, g) => {
  const e = Object.values(APD(g).items).filter(x => x.user === i.user.id && x.status === 'pending').sort((x, y) => y.id - x.id)[0];
  if (!e) return no(i, 'No tienes ninguna postulación pendiente.');
  e.status = 'withdrawn'; e.done = Date.now(); save(); await apEditStaff(i.guild, e);
  say(i, '↩️ Postulación retirada', `Tu postulación **#${e.id}** para **${e.posName}** fue retirada.`, true);
});
def('application', 'config', 'Canal de logs del staff, rol revisor, espera, textos e imagen del panel', 'canal_logs:c,rol_staff:r,espera:i,titulo:s,descripcion:s,imagen:s,web:s,solo_web:b', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf);
  if (o.canal_logs) { const ci = chIssue(i.guild, o.canal_logs); if (ci) return no(i, `No puedo usar ${o.canal_logs}: ${ci}.`); a.logch = o.canal_logs.id; }
  if (o.rol_staff) a.staff = o.rol_staff.id;
  if (o.espera != null) a.cool = Math.min(720, Math.max(0, o.espera));
  if (o.titulo) a.title = o.titulo.slice(0, 200);
  if (o.descripcion) a.desc = nl(o.descripcion).slice(0, 1500);
  if (o.imagen) { if (o.imagen === '-') delete a.img; else if (url(o.imagen)) a.img = o.imagen; else return no(i, 'La imagen debe ser un enlace http(s) (o `-` para quitarla).'); }
  if (o.solo_web != null) a.solo_web = o.solo_web;
  if (o.web) { if (o.web === '-') delete a.web; else if (url(o.web)) a.web = o.web; else return no(i, 'La web debe ser un enlace http(s) (o `-` para quitarla).'); }
  save(); apRefreshPanel(i.guild);
  ok(i, `📍 Logs del staff: ${a.logch ? `<#${a.logch}>` : '—'}\n🛡️ Rol revisor: ${a.staff ? `<@&${a.staff}>` : 'solo quienes tengan **Gestionar servidor**'}\n⏳ Espera tras rechazo: **${a.cool} h**\n🖼️ Imagen: ${a.img ? 'sí' : '—'} · 🌐 Web: ${a.web || '—'}\n❓ Preguntas: **${a.q.length}**`);
});
def('application', 'preguntas', 'Define las preguntas del formulario (máx. 5) separadas por |', 'texto:s!', 'ManageGuild', (i, o, g, cf) => {
  const q = o.texto.split('|').map(x => x.trim()).filter(Boolean);
  if (!q.length || q.length > 5) return no(i, 'Pon entre 1 y 5 preguntas separadas por `|`.');
  const long = q.find(x => x.length > 45); if (long) return no(i, `Discord limita cada pregunta a 45 caracteres: "${long.slice(0, 50)}…" (${long.length}).`);
  AP(cf).q = q; save(); ok(i, `Preguntas guardadas:\n${q.map((x, n) => `**${n + 1}.** ${x}`).join('\n')}`);
});
def('application', 'puesto_add', 'Añade un puesto abierto a las postulaciones', 'nombre:s!,cupos:i,rol:r', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), id = apSlug(o.nombre); if (a.pos.some(p => p.id === id)) return no(i, 'Ya existe un puesto con ese nombre.'); if (a.pos.length >= 25) return no(i, 'Máximo 25 puestos.');
  a.pos.push({ id, name: o.nombre.slice(0, 80), slots: Math.max(1, o.cupos ?? 1), open: true, role: o.rol?.id }); save(); apRefreshPanel(i.guild);
  ok(i, `Puesto **${o.nombre}** añadido (${Math.max(1, o.cupos ?? 1)} cupo(s))${o.rol ? ` · rol al aceptar: ${o.rol}` : ''}.`);
});
def('application', 'puesto_edit', 'Cambia cupos, rol o abre/cierra un puesto', 'nombre:s!,cupos:i,rol:r,abierto:b', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), p = apFind(a, o.nombre); if (!p) return no(i, 'No encuentro ese puesto. Mira `/application puestos`.');
  if (o.cupos != null) { p.slots = Math.max(0, o.cupos); if (p.slots > 0 && o.abierto == null) p.open = true; }
  if (o.rol) p.role = o.rol.id; if (o.abierto != null) p.open = o.abierto; save(); apRefreshPanel(i.guild);
  ok(i, `**${p.name}** · ${p.slots} cupo(s) · ${p.open !== false && p.slots > 0 ? '🟢 abierto' : '🔴 cerrado'}${p.role ? ` · rol: <@&${p.role}>` : ''}`);
});
def('application', 'puesto_del', 'Elimina un puesto', 'nombre:s!', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), p = apFind(a, o.nombre); if (!p) return no(i, 'No encuentro ese puesto.');
  a.pos = a.pos.filter(x => x !== p); save(); apRefreshPanel(i.guild); ok(i, `Puesto **${p.name}** eliminado.`);
});
def('application', 'puestos', 'Lista los puestos y sus cupos', '', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf); say(i, '💼 Puestos', a.pos.map(p => `${p.open !== false && p.slots > 0 ? '🟢' : '🔴'} **${p.name}** — ${p.slots} cupo(s)${p.role ? ` · <@&${p.role}>` : ''}`).join('\n') || 'No hay puestos. Usa `/application puesto_add`.', true);
});
def('application', 'pendientes', 'Lista las postulaciones pendientes de revisar', '', null, (i, o, g, cf) => {
  const a = AP(cf); if (!apIsStaff(i.member, a)) return no(i, 'Solo el staff puede ver esto.');
  const l = Object.values(APD(g).items).filter(x => x.status === 'pending');
  say(i, '🕓 Postulaciones pendientes', l.map(x => `**#${x.id}** · <@${x.user}> · ${x.posName}${x.msg ? ` · [ver](https://discord.com/channels/${i.guildId}/${x.msg.ch}/${x.msg.id})` : ''}`).join('\n') || 'No hay ninguna pendiente. 🎉', true);
});
def('application', 'panel', 'Publica el panel de postulaciones en un canal', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  const a = AP(cf);
  if (!a.logch) return no(i, 'Primero configura el canal de logs del staff: `/application config canal_logs:#canal`.');
  if (!a.pos.length) return no(i, 'Añade al menos un puesto con `/application puesto_add`.');
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  const old = a.panel && await i.guild.channels.cache.get(a.panel.ch)?.messages.fetch(a.panel.id).catch(() => null);
  let m; try { m = await o.canal.send(apPanelPayload(i.guild, cf)); } catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  a.panel = { ch: o.canal.id, id: m.id }; save(); old?.delete().catch(() => {}); ok(i, `Panel publicado en ${o.canal}.`);
});
def('application', 'desactivar', 'Borra la configuración de postulaciones (conserva el historial)', '', 'ManageGuild', (i, o, g, cf) => { delete cf.app; save(); ok(i, 'Configuración de postulaciones eliminada.'); });

async function extraInteractions(i) {
  const gid = i.guildId;
  if ((i.isStringSelectMenu() && i.customId.startsWith('uh_sel_')) || (i.isButton() && i.customId === 'uh_home')) { // menú de /util help
    await i.update(helpPayload(gid, i.isButton() ? null : i.values[0])); return true;
  }
  if (await appInteractions(i)) return true; // postulaciones (botones, menú y formularios)
  if (await hwInteractions(i)) return true; // tienda de Halloween
  if (i.isButton()) {
    const id = i.customId;
    if (id === 'cf_open') {
      if (!CFC(C(gid)).ch) { await no(i, 'Las confesiones no están configuradas.'); return true; }
      await cfShowModal(i); return true;
    }
    const lk = id.match(/^cf_(like|re|rep)_(\d+)$/);
    if (lk) {
      const n = +lk[2], it = CFD(G(gid)).items[n];
      if (!it) { await no(i, 'Ya no tengo registro de esa confesión.'); return true; }
      if (lk[1] === 'like') { // ❤ alterna tu "me gusta" y actualiza el contador del botón
        it.likes ??= []; const k = it.likes.indexOf(i.user.id); if (k < 0) it.likes.push(i.user.id); else it.likes.splice(k, 1); save();
        const old = i.message.components?.[0];
        if (ContainerBuilder && old?.toJSON) await i.update({ components: [old.toJSON(), cfRow(n, it.likes.length, it.noreply)], flags: 1 << 15 });
        else await i.update({ components: [cfRow(n, it.likes.length, it.noreply)] });
        return true;
      }
      if (lk[1] === 're') {
        if (it.noreply) { await no(i, 'Esa confesión no permite respuestas.'); return true; }
        if (!CFC(C(gid)).ch) { await no(i, 'Las confesiones no están configuradas.'); return true; }
        await i.showModal(new ModalBuilder().setCustomId(`cf_rmodal_${n}`).setTitle(`Responder a Anónimo #${n}`).addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('text').setLabel('Tu respuesta (anónima)').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true))));
        return true;
      }
      it.rep ??= []; if (it.rep.includes(i.user.id)) { await no(i, 'Ya reportaste esta confesión.'); return true; } it.rep.push(i.user.id); save();
      const e = E(gid, '🚩 Confesión reportada', `**Anónimo #${n}** · [Ir al mensaje](https://discord.com/channels/${gid}/${i.channelId}/${i.message.id})\nReportes: **${it.rep.length}**`);
      lg(gid, 'reportes', e); const rc = CFC(C(gid)), rv = rc.review && i.guild.channels.cache.get(rc.review); rv?.send({ embeds: [e] }).catch(() => {});
      await say(i, '🚩 Reporte enviado', 'El staff revisará esta confesión. El reporte no se muestra al autor.', true); return true;
    }
    if (id === 'pin_more') {
      const s = PSM.get(i.message.id); if (!s) { await no(i, 'Ya no recuerdo de dónde salió esta imagen. Usa el comando otra vez.'); return true; }
      await i.deferUpdate();
      try { await i.editReply(pinPayload(gid, [R(await pinFetch(s.kind, s.src))], true)); }
      catch (err) { await i.followUp({ flags: 64, embeds: [E(gid, '❌ Error', `No pude cargar otra imagen: ${err.message}`)] }).catch(() => {}); }
      return true;
    }
    if (id === 'ia_re') {
      const s = IAP.get(i.message.id); if (!s) { await no(i, 'Ya no recuerdo ese texto. Usa `/ia imagen` otra vez.'); return true; }
      if (i.user.id !== s.uid) { await no(i, 'Solo quien pidió la imagen puede pedir otra variación.'); return true; }
      const ia = IAC(C(gid)), u = U(gid, i.user.id), r = cd(u, 'ia', ia.cool * 1000); if (r) { await no(i, `Espera ${when(r)}.`); return true; }
      await i.deferReply();
      try { await iaSend(i, { ...s, seed: undefined }, null); }
      catch (err) { u.cd.ia = 0; await i.editReply({ embeds: [E(gid, '❌ Error', `No pude generar la imagen: ${err.message}`)] }).catch(() => {}); }
      return true;
    }
  }
  if (i.isModalSubmit() && i.customId === 'cf_modal') { await submitConfession(i, i.fields.getTextInputValue('text'), null, cfOpts(i)); return true; }
  const rm = i.isModalSubmit() && i.customId.match(/^cf_rmodal_(\d+)$/);
  if (rm) { await submitConfession(i, i.fields.getTextInputValue('text'), +rm[1]); return true; }
  return false;
}