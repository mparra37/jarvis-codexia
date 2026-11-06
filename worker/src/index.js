/* JARVIS · Worker de Cloudflare: el Cerebro IA
 *
 * Cada tablet tiene su propio JARVIS (guardado en la tablet). El Worker no guarda equipos: con cada
 * pregunta la tablet manda los datos de su JARVIS (nombre, personalidad, memoria…), el Worker arma el
 * prompt y le pregunta a Claude. La API key (secreto ANTHROPIC_API_KEY) nunca sale de aquí.
 * Si algo falla, la app contesta con su cerebro básico (respuestas pre-escritas).
 *
 * La base de datos D1 (DB) es OPCIONAL. Con ella se guardan: cuántas preguntas lleva cada tablet hoy
 * (la "batería"), los ajustes del staff y los resultados del taller VR. Sin ella, los límites se
 * llevan en la memoria del Worker (se reinician solos de vez en cuando) y los resultados VR se
 * quedan en la tablet.
 *
 * Variables: ORIGENES, MODELO, ESFUERZO, CUOTA_TABLETA, LIMITE_DIARIO, CLAVE_VR (todas opcionales)
 * Secretos: ANTHROPIC_API_KEY (necesario), STAFF_PIN (para el panel del staff)
 */
import { llamarClaude } from './ia.js';
import { ErrorHttp } from './errores.js';
import { primerTextoSucio } from '../../js/filtro.js';
import { leerCodigoVR } from '../../js/codigo_vr.js';
import { promptEquipo, pedidoPresentacion, pedidoDibujo, promptTallerVR } from './prompts.js';
import { PERSONALIDADES, rellenar } from '../../js/personalidades.js';
import { AYUDA_ESTACIONES } from '../../js/estaciones_datos.js';

const DISPOSITIVO = /^[a-f0-9]{8,40}$/;
const PRESENTACIONES_POR_TABLETA = 3;

let esquemaListo = false;

export default {
  async fetch(request, env) {
    const cors = encabezadosCors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) return json({ ok: true, servicio: 'JARVIS · CODEXIA' }, 200, cors);
      await asegurarEsquema(env.DB);
      const r = await rutear(request, env, url);
      return json(r.cuerpo, r.status || 200, cors);
    } catch (e) {
      if (e instanceof ErrorHttp) return json({ error: e.message, ...e.extra }, e.status, cors);
      console.error(e);
      return json({ error: 'Error interno del servidor.' }, 500, cors);
    }
  },
};

const ok = (cuerpo, status = 200) => ({ cuerpo, status });

function json(cuerpo, status, headers) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function encabezadosCors(request, env) {
  const origen = request.headers.get('Origin') || '';
  const permitidos = String(env.ORIGENES || 'https://mparra37.github.io').split(',').map((s) => s.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen);
  const permitido = permitidos.includes('*') || permitidos.includes(origen) || local;
  return {
    'Access-Control-Allow-Origin': permitido ? (origen || '*') : permitidos[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Staff-Pin',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function asegurarEsquema(db) {
  if (esquemaListo || !db) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS uso (
      dispositivo TEXT NOT NULL, dia TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
      presentaciones INTEGER NOT NULL DEFAULT 0, ultimo INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (dispositivo, dia))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS resultados_vr (
      id TEXT PRIMARY KEY, t INTEGER NOT NULL, equipo TEXT NOT NULL, codigo_equipo TEXT,
      juego TEXT NOT NULL, puntaje INTEGER NOT NULL, codigo TEXT, valido INTEGER NOT NULL DEFAULT 0, nota TEXT)`),
  ]);
  esquemaListo = true;
}

// ---------- utilidades ----------
async function leerJson(request, max = 40000) {
  const texto = await request.text();
  if (texto.length > max) throw new ErrorHttp(413, 'Los datos son demasiado grandes.');
  try { return texto ? JSON.parse(texto) : {}; } catch (e) { throw new ErrorHttp(400, 'JSON inválido.'); }
}

// Sin base de datos, todo esto vive en la memoria del Worker (se pierde cuando Cloudflare lo reinicia).
const memoria = { ajustes: new Map(), uso: new Map() };
const hayBD = (env) => Boolean(env.DB);
const SIN_BD = 'Para esto hay que conectar la base de datos (paso opcional del LEEME).';

async function leerAjuste(env, clave, porDefecto) {
  if (!hayBD(env)) return memoria.ajustes.has(clave) ? memoria.ajustes.get(clave) : porDefecto;
  const fila = await env.DB.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind(clave).first();
  if (!fila) return porDefecto;
  try { return JSON.parse(fila.valor); } catch (e) { return porDefecto; }
}
async function guardarAjuste(env, clave, valor) {
  if (!hayBD(env)) { memoria.ajustes.set(clave, valor); return; }
  await env.DB.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .bind(clave, JSON.stringify(valor)).run();
}

async function estadoGlobal(env) {
  return { chatActivo: true, cuota: Number(env.CUOTA_TABLETA || 30), ...(await leerAjuste(env, 'estado', {})) };
}
const hayIA = (env) => Boolean(env.ANTHROPIC_API_KEY) || env.MODO_PRUEBA === '1';
const hoy = () => new Date().toISOString().slice(0, 10);

function revisarTextos(valor) {
  const malo = primerTextoSucio(valor);
  if (malo) throw new ErrorHttp(422, 'Ese texto no se puede usar. Escriban algo distinto, por favor.');
}

function esStaff(request, env) {
  const pin = request.headers.get('X-Staff-Pin') || '';
  return Boolean(env.STAFF_PIN) && pin.length > 0 && pin === String(env.STAFF_PIN);
}
function exigirStaff(request, env) {
  if (!env.STAFF_PIN) throw new ErrorHttp(403, 'El panel del staff no está configurado (falta el secreto STAFF_PIN).');
  if (!esStaff(request, env)) throw new ErrorHttp(401, 'PIN incorrecto.');
}

/** Cuenta una llamada a la IA del día y corta si ya se llegó al límite total (protege la API key). */
async function contarUsoIA(env) {
  const limite = Number(env.LIMITE_DIARIO || 3000);
  if (!hayBD(env)) {
    const clave = `uso:${hoy()}`;
    const n = (memoria.ajustes.get(clave) || 0) + 1;
    memoria.ajustes.set(clave, n);
    if (n > limite) throw new ErrorHttp(429, 'Se acabó la energía de la IA por hoy.');
    return;
  }
  const fila = await env.DB.prepare(`INSERT INTO ajustes (clave, valor) VALUES (?, '1')
    ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) RETURNING valor`).bind(`uso:${hoy()}`).first();
  if (Number(fila.valor) > limite) throw new ErrorHttp(429, 'Se acabó la energía de la IA por hoy.');
}

function limpiarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) throw new ErrorHttp(400, 'Faltan los mensajes.');
  const alternados = [];
  mensajes
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 600) }))
    .slice(-10)
    .forEach((m) => {
      // los roles deben alternar y empezar por el usuario
      if (alternados.length && alternados[alternados.length - 1].role === m.role) alternados[alternados.length - 1] = m;
      else alternados.push(m);
    });
  while (alternados.length && alternados[0].role !== 'user') alternados.shift();
  if (!alternados.length || alternados[alternados.length - 1].role !== 'user') throw new ErrorHttp(400, 'El último mensaje debe ser del usuario.');
  return alternados;
}

/** Los datos del JARVIS que manda la tablet, revisados y recortados. */
function leerJarvis(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new ErrorHttp(400, 'Faltan los datos del JARVIS.');
  const texto = (v, max) => String(v || '').slice(0, max);
  const jarvis = {
    nombre: texto(j.nombre, 40) || 'su equipo',
    jarvis: { nombre: texto(j.jarvis && j.jarvis.nombre, 24) || 'JARVIS', lema: texto(j.jarvis && j.jarvis.lema, 80) },
    personalidad: {
      id: PERSONALIDADES[j.personalidad && j.personalidad.id] ? j.personalidad.id : '',
      habla: texto(j.personalidad && j.personalidad.habla, 100),
      encanta: texto(j.personalidad && j.personalidad.encanta, 100),
      nunca: texto(j.personalidad && j.personalidad.nunca, 100),
    },
    memoria: {
      integrantes: (Array.isArray(j.memoria && j.memoria.integrantes) ? j.memoria.integrantes : []).slice(0, 8).map((n) => texto(n, 24)),
      prepa: texto(j.memoria && j.memoria.prepa, 60),
      dato: texto(j.memoria && j.memoria.dato, 140),
    },
    escudo: { regla: texto(j.escudo && j.escudo.regla, 100) },
    bitacora: Object.fromEntries(Object.entries((j.bitacora && typeof j.bitacora === 'object') ? j.bitacora : {}).slice(0, 6).map(([k, v]) => [texto(k, 20), texto(v, 120)])),
  };
  revisarTextos(jarvis);
  return jarvis;
}

/** Le pregunta a Claude. En MODO_PRUEBA sin llave, contesta un texto de prueba. */
async function preguntarIA(env, system, mensajes, { prueba } = {}) {
  if (!env.ANTHROPIC_API_KEY) {
    if (env.MODO_PRUEBA === '1') return prueba || '(Modo de prueba) Aquí contestará la IA cuando se configure la API key.';
    throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  }
  const respuesta = await llamarClaude(env, { system, mensajes });
  if (respuesta.stop_reason === 'refusal') return 'Mejor hablemos de la misión. ¿En qué taller les ayudo?';
  const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
  return texto || 'Mmm, no tengo una respuesta para eso. ¿Me lo preguntan de otra forma?';
}

// ---------- rutas ----------
async function rutear(request, env, url) {
  const [recurso, id, sub] = url.pathname.split('/').filter(Boolean).slice(1); // sin "api"
  const metodo = request.method;

  if (recurso === 'salud') return ok({ ok: true, ia: hayIA(env), modelo: env.MODELO || 'claude-opus-5-5', prueba: !env.ANTHROPIC_API_KEY && env.MODO_PRUEBA === '1' });
  if (recurso === 'chat' && metodo === 'POST') return chat(request, env);

  if (recurso === 'vr') {
    if (id === 'estado' && metodo === 'GET') return estadoVR(env);
    if (id === 'chat' && metodo === 'POST') return chatVR(request, env);
    if (id === 'resultados' && metodo === 'GET') return listarResultadosVR(env);
    if (id === 'resultados' && metodo === 'POST') return guardarResultadoVR(request, env);
    if (id === 'resultados' && metodo === 'DELETE' && sub) return borrarResultadoVR(request, env, sub);
  }

  if (recurso === 'staff') {
    exigirStaff(request, env);
    if (id === 'estado' && metodo === 'GET') return staffEstado(env);
    if (id === 'estado' && metodo === 'POST') return staffCambiar(request, env);
    if (id === 'recargar' && metodo === 'POST') {
      // todas las tablets vuelven a tener su batería completa hoy
      if (hayBD(env)) await env.DB.prepare('UPDATE uso SET n = 0 WHERE dia = ?').bind(hoy()).run();
      else memoria.uso.forEach((u) => { u.n = 0; });
      return staffEstado(env);
    }
  }

  throw new ErrorHttp(404, 'Ruta no encontrada.');
}

// ---------- Cerebro IA de una tablet ----------
async function chat(request, env) {
  const cuerpo = await leerJson(request, 1500000); // la foto de un dibujo puede pesar hasta ~1 MB
  const estado = await estadoGlobal(env);
  if (!estado.chatActivo) throw new ErrorHttp(403, 'El staff pausó la IA por un momento.');
  if (!hayIA(env)) throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  const dispositivo = String(cuerpo.dispositivo || '');
  if (!DISPOSITIVO.test(dispositivo)) throw new ErrorHttp(400, 'Falta el identificador de la tablet.');
  const jarvis = leerJarvis(cuerpo.jarvis);
  const presentacion = cuerpo.tipo === 'presentacion';
  const dibujo = cuerpo.tipo === 'dibujo';
  const estacion = !dibujo && AYUDA_ESTACIONES[cuerpo.estacion] ? cuerpo.estacion : null;
  const dia = hoy();
  const ahora = Date.now();
  const cuota = Math.max(0, Number(estado.cuota) || 0);

  let lista;
  if (presentacion) lista = [{ role: 'user', content: pedidoPresentacion(jarvis) }];
  else if (dibujo) {
    // misión "Retrato de Ultrón": una foto JPEG del dibujo y el pedido de analizarlo
    const m = String(cuerpo.imagen || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m || m[1].length > 1400000) throw new ErrorHttp(400, 'La foto del dibujo no es válida.');
    lista = [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: m[1] } },
      { type: 'text', text: pedidoDibujo() },
    ] }];
  } else {
    lista = limpiarMensajes(cuerpo.mensajes);
    revisarTextos(lista[lista.length - 1].content);
  }
  const fila = await tomarTurno(env, { dispositivo, dia, presentacion, cuota, ahora });

  let texto;
  let system = '';
  try {
    await contarUsoIA(env);
    const p = PERSONALIDADES[jarvis.personalidad.id];
    const vars = { jarvis: jarvis.jarvis.nombre, equipo: jarvis.nombre, lema: jarvis.jarvis.lema };
    const prueba = presentacion
      ? `${rellenar((p || PERSONALIDADES.P1).frases.presentacion, vars)} (Modo de prueba)`
      : dibujo
        ? `(Modo de prueba) Soy ${vars.jarvis} y recibí la foto de su dibujo de Ultrón. Cuando se configure la API key, aquí la IA describirá el dibujo.`
        : `(Modo de prueba) Soy ${vars.jarvis} y recibí tu pregunta: "${lista[lista.length - 1].content.slice(0, 80)}". Cuando se configure la API key, aquí contestará la IA.`;
    system = promptEquipo(jarvis, presentacion ? null : estacion);
    texto = await preguntarIA(env, system, lista, { prueba });
  } catch (e) {
    // si la IA falló, se devuelve la pregunta a la batería
    await devolverTurno(env, { dispositivo, dia, presentacion });
    throw e;
  }
  // el prompt de sistema va de regreso para que el equipo vea "cómo le preguntó JARVIS a la IA"
  return ok({ texto, prompt: system, restantes: Math.max(0, cuota - Number(fila.n || 0)) });
}

/** Cuenta una pregunta (o presentación) de una tablet hoy. Lanza 402 sin batería y 429 si va muy rápido. */
async function tomarTurno(env, { dispositivo, dia, presentacion, cuota, ahora }) {
  if (!hayBD(env)) {
    const k = `${dispositivo}|${dia}`;
    const u = memoria.uso.get(k) || { n: 0, presentaciones: 0, ultimo: 0 };
    if (presentacion) {
      if (u.presentaciones >= PRESENTACIONES_POR_TABLETA) throw new ErrorHttp(402, 'Ya se usaron las presentaciones de hoy.');
      u.presentaciones += 1;
    } else {
      if (ahora - u.ultimo < 2500) throw new ErrorHttp(429, 'Un momento: JARVIS sigue pensando.');
      if (u.n >= cuota) throw new ErrorHttp(402, 'Se acabaron las preguntas de IA de hoy en esta tablet.', { restantes: 0 });
      u.n += 1;
      u.ultimo = ahora;
    }
    memoria.uso.set(k, u);
    return { n: u.n };
  }
  if (presentacion) {
    const fila = await env.DB.prepare(`INSERT INTO uso (dispositivo, dia, n, presentaciones, ultimo) VALUES (?, ?, 0, 1, 0)
      ON CONFLICT(dispositivo, dia) DO UPDATE SET presentaciones = presentaciones + 1 WHERE uso.presentaciones < ?
      RETURNING n`).bind(dispositivo, dia, PRESENTACIONES_POR_TABLETA).first();
    if (!fila) throw new ErrorHttp(402, 'Ya se usaron las presentaciones de hoy.');
    return fila;
  }
  const previa = await env.DB.prepare('SELECT ultimo FROM uso WHERE dispositivo = ? AND dia = ?').bind(dispositivo, dia).first();
  if (previa && ahora - previa.ultimo < 2500) throw new ErrorHttp(429, 'Un momento: JARVIS sigue pensando.');
  const fila = await env.DB.prepare(`INSERT INTO uso (dispositivo, dia, n, presentaciones, ultimo) VALUES (?, ?, 1, 0, ?)
    ON CONFLICT(dispositivo, dia) DO UPDATE SET n = n + 1, ultimo = excluded.ultimo WHERE uso.n < ?
    RETURNING n`).bind(dispositivo, dia, ahora, cuota).first();
  if (!fila || fila.n > cuota) {
    if (fila) await env.DB.prepare('UPDATE uso SET n = n - 1 WHERE dispositivo = ? AND dia = ?').bind(dispositivo, dia).run();
    throw new ErrorHttp(402, 'Se acabaron las preguntas de IA de hoy en esta tablet.', { restantes: 0 });
  }
  return fila;
}

async function devolverTurno(env, { dispositivo, dia, presentacion }) {
  const campo = presentacion ? 'presentaciones' : 'n';
  if (!hayBD(env)) {
    const u = memoria.uso.get(`${dispositivo}|${dia}`);
    if (u) { u[campo] = Math.max(0, u[campo] - 1); u.ultimo = 0; }
    return;
  }
  await env.DB.prepare(`UPDATE uso SET ${campo} = MAX(0, ${campo} - 1), ultimo = 0 WHERE dispositivo = ? AND dia = ?`).bind(dispositivo, dia).run();
}

// ---------- staff ----------
async function staffEstado(env) {
  const estado = await estadoGlobal(env);
  const dia = hoy();
  let uso;
  if (hayBD(env)) {
    uso = await env.DB.prepare('SELECT COUNT(*) AS tabletas, COALESCE(SUM(n), 0) AS preguntas, COALESCE(SUM(presentaciones), 0) AS presentaciones FROM uso WHERE dia = ?').bind(dia).first();
  } else {
    const hoyUso = [...memoria.uso.entries()].filter(([k]) => k.endsWith(`|${dia}`)).map(([, u]) => u);
    uso = { tabletas: hoyUso.length, preguntas: hoyUso.reduce((t, u) => t + u.n, 0), presentaciones: hoyUso.reduce((t, u) => t + u.presentaciones, 0) };
  }
  return ok({
    estado,
    energiaVR: await leerAjuste(env, 'energiaVR', 300),
    hoy: { ...uso, totalIA: Number(await leerAjuste(env, `uso:${dia}`, 0)), limite: Number(env.LIMITE_DIARIO || 3000) },
    salud: { ia: hayIA(env), prueba: !env.ANTHROPIC_API_KEY, modelo: env.MODELO || 'claude-opus-5-5', baseDeDatos: hayBD(env) },
  });
}

async function staffCambiar(request, env) {
  const cambios = await leerJson(request, 4000);
  const estado = await estadoGlobal(env);
  if (typeof cambios.chatActivo === 'boolean') estado.chatActivo = cambios.chatActivo;
  if (cambios.cuota !== undefined) estado.cuota = Math.max(0, Math.min(500, Math.round(Number(cambios.cuota) || 0)));
  await guardarAjuste(env, 'estado', { chatActivo: estado.chatActivo, cuota: estado.cuota });
  if (cambios.energiaVR !== undefined) await guardarAjuste(env, 'energiaVR', Math.max(0, Math.min(5000, Math.round(Number(cambios.energiaVR) || 0))));
  return staffEstado(env);
}

// ---------- taller VR (JARVIS ya armado de la estación de Redes) ----------
async function estadoVR(env) {
  const estado = await estadoGlobal(env);
  return ok({ ia: hayIA(env), chatActivo: estado.chatActivo, energia: await leerAjuste(env, 'energiaVR', 300) });
}

async function chatVR(request, env) {
  const { mensajes, juego } = await leerJson(request, 20000);
  const estado = await estadoGlobal(env);
  if (!estado.chatActivo) throw new ErrorHttp(403, 'El staff pausó la IA por un momento.');
  if (!hayIA(env)) throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  const lista = limpiarMensajes(mensajes);
  revisarTextos(lista[lista.length - 1].content);
  let r;
  if (hayBD(env)) {
    r = await env.DB.prepare(`INSERT INTO ajustes (clave, valor) VALUES ('energiaVR', '299')
      ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) - 1 AS TEXT) WHERE CAST(valor AS INTEGER) > 0 RETURNING valor`).first();
  } else {
    const quedan = Number(memoria.ajustes.has('energiaVR') ? memoria.ajustes.get('energiaVR') : 300);
    if (quedan > 0) { memoria.ajustes.set('energiaVR', quedan - 1); r = { valor: quedan - 1 }; }
  }
  if (!r) throw new ErrorHttp(402, 'Se acabó la batería del JARVIS de la estación. Recárguenla desde el panel del staff.', { energia: 0 });
  let texto;
  try {
    await contarUsoIA(env);
    texto = await preguntarIA(env, promptTallerVR(juego), lista, {
      prueba: `(Modo de prueba) Recibí tu pregunta: "${lista[lista.length - 1].content.slice(0, 80)}". Con la API key configurada, aquí contestará la IA sabiendo las reglas de los 4 juegos.`,
    });
  } catch (e) {
    if (hayBD(env)) await env.DB.prepare("UPDATE ajustes SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'energiaVR'").run();
    else memoria.ajustes.set('energiaVR', Number(memoria.ajustes.get('energiaVR') || 0) + 1);
    throw e;
  }
  return ok({ texto, energia: Number(await leerAjuste(env, 'energiaVR', 0)) });
}

async function listarResultadosVR(env) {
  if (!hayBD(env)) throw new ErrorHttp(503, SIN_BD);
  const { results } = await env.DB.prepare('SELECT * FROM resultados_vr ORDER BY t DESC LIMIT 500').all();
  return ok({ resultados: results.map((r) => ({ ...r, valido: Boolean(r.valido) })) });
}

async function guardarResultadoVR(request, env) {
  if (!hayBD(env)) throw new ErrorHttp(503, SIN_BD);
  const p = await leerJson(request, 4000);
  const equipo = String(p.equipo || '').trim().slice(0, 40);
  if (!equipo) throw new ErrorHttp(400, 'Escriban el nombre del equipo.');
  const juego = String(p.juego || '').slice(0, 40);
  if (!juego) throw new ErrorHttp(400, 'Falta el juego.');
  const registro = {
    id: String(p.id || '').slice(0, 24) || `r${Date.now().toString(36)}`,
    t: Date.now(),
    equipo,
    juego,
    puntaje: Math.max(0, Math.min(10000, Math.round(Number(p.puntaje) || 0))),
    codigo: String(p.codigo || '').slice(0, 12),
    nota: String(p.nota || '').slice(0, 120),
  };
  revisarTextos([registro.equipo, registro.nota]);
  const lectura = registro.codigo ? leerCodigoVR(registro.codigo, env.CLAVE_VR || 'enlace-vr-2026') : null;
  registro.valido = lectura && lectura.valido && lectura.puntaje === registro.puntaje ? 1 : 0;
  await env.DB.prepare(`INSERT INTO resultados_vr (id, t, equipo, codigo_equipo, juego, puntaje, codigo, valido, nota)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
    .bind(registro.id, registro.t, registro.equipo, registro.juego, registro.puntaje, registro.codigo, registro.valido, registro.nota).run();
  return ok({ resultado: { ...registro, valido: Boolean(registro.valido) } }, 201);
}

async function borrarResultadoVR(request, env, id) {
  if (!hayBD(env)) throw new ErrorHttp(503, SIN_BD);
  const fila = await env.DB.prepare('SELECT t FROM resultados_vr WHERE id = ?').bind(id).first();
  if (!fila) return ok({ ok: true });
  if (Date.now() - fila.t > 15 * 60 * 1000 && !esStaff(request, env)) {
    throw new ErrorHttp(401, 'Pasaron más de 15 minutos: para borrarlo se necesita el PIN del staff.');
  }
  await env.DB.prepare('DELETE FROM resultados_vr WHERE id = ?').bind(id).run();
  return ok({ ok: true });
}
