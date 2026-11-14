// extras.js · funciones que faltaban en el bot: cumpleaños, starboard y respuestas automáticas.
// Se carga desde index.js antes de construir los comandos (usa def, G, DB y save de index.js).
const { EmbedBuilder } = require('discord.js');

module.exports = function installExtras({ client, DB, def, G, save }) {
  const ok = (i, content) => i.reply({ content, flags: 64 }).catch(() => {}); // 64 = solo lo ve quien usa el comando

  /* ---------------- Enlaces: invitar al bot y dashboard ---------------- */
  // Requiere en .env: CLIENT_ID (ID de la aplicación) y DASHBOARD_URL (el enlace público del panel)
  def('links', 'ver', 'Muestra el enlace para invitar al bot y el dashboard', '', null, (i) => {
    const cid = process.env.CLIENT_ID;
    const invite = cid
      ? `https://discord.com/oauth2/authorize?client_id=${cid}&permissions=8&scope=bot%20applications.commands`
      : 'Falta CLIENT_ID en el .env';
    const dash = process.env.DASHBOARD_URL || 'Falta DASHBOARD_URL en el .env';
    const e = new EmbedBuilder().setColor(0x43E3EA).setTitle('🔗 Club 24/7')
      .setDescription(`**✦ Invitar:** ${invite}\n**✦ Dashboard:** ${dash}`);
    i.reply({ embeds: [e] }).catch(() => {});
  });

  /* ---------------- Cumpleaños ---------------- */
  def('cumple', 'set', 'Guarda tu cumpleaños', 'dia:i!,mes:i!', null, (i, o, g) => {
    if (o.dia < 1 || o.dia > 31 || o.mes < 1 || o.mes > 12) return ok(i, 'Esa fecha no es válida.');
    (g.birthdays ??= {})[i.user.id] = { dia: o.dia, mes: o.mes }; save();
    ok(i, `🎂 Tu cumpleaños quedó guardado: **${o.dia}/${o.mes}**.`);
  });
  def('cumple', 'ver', 'Muestra el cumpleaños de alguien', 'usuario:u', null, (i, o, g) => {
    const u = o.usuario ?? i.user, b = g.birthdays?.[u.id];
    ok(i, b ? `🎂 ${u}: **${b.dia}/${b.mes}**` : `${u} no ha guardado su cumpleaños.`);
  });
  def('cumple', 'lista', 'Lista los próximos cumpleaños', '', null, (i, o, g) => {
    const hoy = new Date(), t = (hoy.getMonth() + 1) * 31 + hoy.getDate();
    const key = b => ((b.mes * 31 + b.dia) - t + 372) % 372; // orden desde hoy, dando la vuelta al año
    const rows = Object.entries(g.birthdays || {}).map(([id, b]) => ({ id, ...b })).sort((a, b) => key(a) - key(b)).slice(0, 10);
    ok(i, rows.map(r => `<@${r.id}> · ${r.dia}/${r.mes}`).join('\n') || 'Nadie ha guardado su cumpleaños todavía.');
  });
  def('cumple', 'canal', 'Elige el canal donde se felicita', 'canal:c!', 'ManageGuild', (i, o, g) => {
    g.cumplech = o.canal.id; save(); ok(i, `🎉 Los cumpleaños se anunciarán en ${o.canal}.`);
  });
  setInterval(() => { // revisa cada 30 min; felicita una vez al día después de las 9:00
    const now = new Date(), hoy = now.toDateString();
    if (now.getHours() < 9) return;
    for (const g of Object.values(DB)) {
      if (!g?.birthdays || !g.cumplech || g.cumpleHoy === hoy) continue;
      g.cumpleHoy = hoy; save();
      const ids = Object.entries(g.birthdays).filter(([, b]) => b.dia === now.getDate() && b.mes === now.getMonth() + 1).map(([id]) => `<@${id}>`);
      if (ids.length) client.channels.cache.get(g.cumplech)?.send(`🎂 ¡Feliz cumpleaños ${ids.join(', ')}! 🎉`).catch(() => {});
    }
  }, 30 * 60 * 1000);

  /* ---------------- Starboard (⭐) ---------------- */
  def('starboard', 'config', 'Activa el starboard en un canal', 'canal:c!,minimo:i', 'ManageGuild', (i, o, g) => {
    g.star = { canal: o.canal.id, min: Math.max(1, o.minimo ?? 3), posts: g.star?.posts ?? {} }; save();
    ok(i, `⭐ Starboard activo en ${o.canal} con **${g.star.min}** reacciones.`);
  });
  def('starboard', 'apagar', 'Desactiva el starboard', '', 'ManageGuild', (i, o, g) => {
    delete g.star; save(); ok(i, 'Starboard desactivado.');
  });
  client.on('messageReactionAdd', async r => {
    try {
      if (r.emoji.name !== '⭐') return;
      const m = r.message.partial ? await r.message.fetch() : r.message;
      const g = DB[m.guildId];
      if (!g?.star || m.channelId === g.star.canal || g.star.posts[m.id] || (r.count ?? 0) < g.star.min) return;
      g.star.posts[m.id] = 1; save();
      const e = new EmbedBuilder().setColor(0xFEE75C)
        .setAuthor({ name: m.author?.tag ?? 'Usuario', iconURL: m.author?.displayAvatarURL() })
        .setDescription(m.content || '*(sin texto)*')
        .addFields({ name: 'Fuente', value: `[Ir al mensaje](${m.url})` })
        .setFooter({ text: `⭐ ${r.count}` });
      client.channels.cache.get(g.star.canal)?.send({ embeds: [e] }).catch(() => {});
    } catch (err) { console.error('[starboard]', err.message); }
  });

  /* ---------------- Respuestas automáticas ---------------- */
  def('respondedor', 'add', 'Responde cuando alguien escriba una palabra', 'palabra:s!,respuesta:s!', 'ManageMessages', (i, o, g) => {
    (g.autoresp ??= {})[o.palabra.toLowerCase()] = o.respuesta.slice(0, 1500); save();
    ok(i, `✅ Respuesta guardada para **${o.palabra}**.`);
  });
  def('respondedor', 'quitar', 'Quita una respuesta automática', 'palabra:s!', 'ManageMessages', (i, o, g) => {
    const k = o.palabra.toLowerCase();
    if (!g.autoresp?.[k]) return ok(i, 'Esa palabra no tiene respuesta.');
    delete g.autoresp[k]; save(); ok(i, `🗑️ Respuesta de **${o.palabra}** eliminada.`);
  });
  def('respondedor', 'lista', 'Lista las respuestas automáticas', '', 'ManageMessages', (i, o, g) => {
    const l = Object.keys(g.autoresp || {});
    ok(i, l.length ? l.map(k => `• **${k}**`).join('\n') : 'No hay respuestas automáticas.');
  });
  client.on('messageCreate', m => {
    if (!m.guild || m.author.bot) return;
    const map = DB[m.guild.id]?.autoresp; if (!map) return;
    const txt = m.content.toLowerCase(), k = Object.keys(map).find(k => txt.includes(k));
    if (k) m.reply({ content: map[k], allowedMentions: { repliedUser: false } }).catch(() => {});
  });
};
