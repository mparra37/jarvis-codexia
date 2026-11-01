/* JARVIS · Worker de Cloudflare
 *
 * Guarda los equipos en D1, guarda la API key de Claude (secreto ANTHROPIC_API_KEY) y le pregunta a
 * la IA. La app (GitHub Pages) nunca ve la llave. Ver ../LEEME.md para desplegarlo.
 *
 * Variables (wrangler.toml): ORIGENES, MODELO, ESFUERZO, MAX_EQUIPOS, LIMITE_DIARIO, CLAVE_VR
 * Secretos: ANTHROPIC_API_KEY, STAFF_PIN
 */
import Anthropic from '@anthropic-ai/sdk';
import { primerTextoSucio } from '../../js/filtro.js';
import { leerCodigoVR } from '../../js/codigo_vr.js';
import { promptEquipo, pedidoPresentacion, promptTallerVR } from './prompts.js';
import { PERSONALIDADES, rellenar } from '../../js/personalidades.js';
import { AYUDA_ESTACIONES } from '../../js/estaciones_datos.js';

const CODIGO = /^[A-Z0-9]{4}$/;
const ESTADO_INICIAL = { chatActivo: true, energiaInicial: 15, anuncio: null };
const ESTACIONES = ['movil', 'algoritmos', 'ciber', 'redes', 'final', 'otro'];
const PROHIBIDOS_PARCHE = ['codigo', 'puntos', 'creado'];

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

class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}
const ok = (cuerpo, status = 200) => ({ cuerpo, status });

function json(cuerpo, status, headers) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function encabezadosCors(request, env) {
  const origen = request.headers.get('Origin') || '';
  const permitidos = String(env.ORIGENES || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen);
  const permitido = permitidos.includes('*') || permitidos.includes(origen) || local;
  return {
    'Access-Control-Allow-Origin': permitido ? (origen || '*') : permitidos[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Staff-Pin',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function asegurarEsquema(db) {
  if (esquemaListo) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS equipos (
      codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, data TEXT NOT NULL,
      energia INTEGER NOT NULL DEFAULT 15, gratis INTEGER NOT NULL DEFAULT 3,
      encendido INTEGER, ultimo_chat INTEGER NOT NULL DEFAULT 0,
      creado INTEGER NOT NULL, actualizado INTEGER NOT NULL)`),
    db.prepare('CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)'),
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

async function leerAjuste(env, clave, porDefecto) {
  const fila = await env.DB.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind(clave).first();
  if (!fila) return porDefecto;
  try { return JSON.parse(fila.valor); } catch (e) { return porDefecto; }
}
async function guardarAjuste(env, clave, valor) {
  await env.DB.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .bind(clave, JSON.stringify(valor)).run();
}

async function estadoGlobal(env) {
  const e = { ...ESTADO_INICIAL, ...(await leerAjuste(env, 'estado', {})) };
  return e;
}
function estadoPublico(env, e) {
  return { chatActivo: e.chatActivo, ia: hayIA(env), anuncio: e.anuncio };
}
const hayIA = (env) => Boolean(env.ANTHROPIC_API_KEY) || env.MODO_PRUEBA === '1';

function revisarTextos(valor) {
  const malo = primerTextoSucio(valor);
  if (malo) throw new ErrorHttp(422, 'Ese texto no se puede usar. Escriban algo distinto, por favor.', { campo: malo.slice(0, 40) });
}

async function filaEquipo(env, codigo) {
  if (!CODIGO.test(codigo)) throw new ErrorHttp(400, 'Código de equipo inválido.');
  const fila = await env.DB.prepare('SELECT * FROM equipos WHERE codigo = ?').bind(codigo).first();
  if (!fila) throw new ErrorHttp(404, 'No existe un equipo con ese código.');
  return fila;
}

async function respuestaEquipo(env, fila) {
  const equipo = JSON.parse(fila.data);
  equipo.codigo = fila.codigo;
  equipo.encendido = fila.encendido || null;
  return { equipo, energia: fila.energia, estado: estadoPublico(env, await estadoGlobal(env)) };
}

function esStaff(request, env) {
  const pin = request.headers.get('X-Staff-Pin') || '';
  return Boolean(env.STAFF_PIN) && pin.length > 0 && pin === String(env.STAFF_PIN);
}
function exigirStaff(request, env) {
  if (!env.STAFF_PIN) throw new ErrorHttp(403, 'El panel del staff no está configurado (falta el secreto STAFF_PIN).');
  if (!esStaff(request, env)) throw new ErrorHttp(401, 'PIN incorrecto.');
}

/** Cuenta una llamada a la IA del día y avisa si ya se llegó al límite. */
async function contarUsoIA(env) {
  const limite = Number(env.LIMITE_DIARIO || 3000);
  const dia = new Date().toISOString().slice(0, 10);
  const fila = await env.DB.prepare(`INSERT INTO ajustes (clave, valor) VALUES (?, '1')
    ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) RETURNING valor`).bind(`uso:${dia}`).first();
  if (Number(fila.valor) > limite) throw new ErrorHttp(429, 'Se acabó la energía de la IA por hoy. Avísenle al staff.');
}

function limpiarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) throw new ErrorHttp(400, 'Faltan los mensajes.');
  let lista = mensajes
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 600) }))
    .slice(-10);
  // los roles deben alternar y empezar por el usuario
  const alternados = [];
  for (const m of lista) {
    if (alternados.length && alternados[alternados.length - 1].role === m.role) alternados[alternados.length - 1] = m;
    else alternados.push(m);
  }
  while (alternados.length && alternados[0].role !== 'user') alternados.shift();
  lista = alternados;
  if (!lista.length || lista[lista.length - 1].role !== 'user') throw new ErrorHttp(400, 'El último mensaje debe ser del usuario.');
  return lista;
}

/** Le pregunta a Claude. En MODO_PRUEBA sin llave, contesta un texto de prueba. */
async function preguntarIA(env, system, mensajes, { prueba } = {}) {
  if (!env.ANTHROPIC_API_KEY) {
    if (env.MODO_PRUEBA === '1') return prueba || '(Modo de prueba) Aquí contestará la IA cuando se configure la API key.';
    throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25000 });
  const modelo = env.MODELO || 'claude-opus-5-5';
  const parametros = {
    model: modelo,
    max_tokens: 2000,
    system,
    messages: mensajes,
    output_config: { effort: env.ESFUERZO || 'low' },
  };
  let respuesta;
  try {
    // los modelos con clasificadores de seguridad pueden rechazar; "fallbacks" reintenta en otro modelo
    if (/^claude-(opus|fable)/.test(modelo) || modelo === 'claude-sonnet-5-5') {
      respuesta = await client.beta.messages.create({ ...parametros, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } else {
      respuesta = await client.messages.create(parametros);
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorHttp(503, 'La API key de la IA no es válida.');
    if (e instanceof Anthropic.RateLimitError) throw new ErrorHttp(429, 'La IA está muy ocupada. Intenten en unos segundos.');
    if (e instanceof Anthropic.BadRequestError) { console.error('IA 400', e.message); throw new ErrorHttp(502, 'La IA no pudo contestar esa pregunta.'); }
    if (e instanceof Anthropic.APIError) { console.error('IA', e.status, e.message); throw new ErrorHttp(502, 'La IA no está disponible en este momento.'); }
    throw new ErrorHttp(502, 'No se pudo conectar con la IA.');
  }
  if (respuesta.stop_reason === 'refusal') return 'Mejor hablemos de la misión. ¿En qué taller les ayudo?';
  const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
  return texto || 'Mmm, no tengo una respuesta para eso. ¿Me lo preguntan de otra forma?';
}

// ---------- rutas ----------
async function rutear(request, env, url) {
  const partes = url.pathname.split('/').filter(Boolean).slice(1); // sin "api"
  const metodo = request.method;
  const [recurso, id, sub, subId] = partes;

  if (recurso === 'salud') return ok({ ok: true, ia: hayIA(env), modelo: env.MODELO || 'claude-opus-5-5', prueba: !env.ANTHROPIC_API_KEY && env.MODO_PRUEBA === '1' });

  if (recurso === 'equipos' && id) {
    const codigo = id.toUpperCase();
    if (!sub) {
      if (metodo === 'GET') return ok(await respuestaEquipo(env, await filaEquipo(env, codigo)));
      if (metodo === 'PUT') return crearEquipo(request, env, codigo);
      if (metodo === 'PATCH') return cambiarEquipo(request, env, codigo);
    }
    if (sub === 'puntos' && metodo === 'POST') return agregarPuntos(request, env, codigo);
    if (sub === 'puntos' && metodo === 'DELETE' && subId) return borrarPuntos(env, codigo, subId);
    if (sub === 'chat' && metodo === 'POST') return chatEquipo(request, env, codigo);
  }

  if (recurso === 'sala' && metodo === 'GET') return sala(env);

  if (recurso === 'vr') {
    if (id === 'estado' && metodo === 'GET') return estadoVR(env);
    if (id === 'chat' && metodo === 'POST') return chatVR(request, env);
    if (id === 'resultados' && metodo === 'GET') return listarResultadosVR(env);
    if (id === 'resultados' && metodo === 'POST') return guardarResultadoVR(request, env);
    if (id === 'resultados' && metodo === 'DELETE' && sub) return borrarResultadoVR(request, env, sub);
  }

  if (recurso === 'staff') {
    exigirStaff(request, env);
    if (id === 'equipos' && !sub && metodo === 'GET') return staffEquipos(env);
    if (id === 'equipos' && sub && metodo === 'DELETE') {
      await env.DB.prepare('DELETE FROM equipos WHERE codigo = ?').bind(sub.toUpperCase()).run();
      return ok({ ok: true });
    }
    if (id === 'equipos' && sub && subId === 'energia' && metodo === 'POST') {
      const { delta } = await leerJson(request);
      const d = Math.max(-100, Math.min(100, Math.round(Number(delta) || 0)));
      await env.DB.prepare('UPDATE equipos SET energia = MAX(0, energia + ?) WHERE codigo = ?').bind(d, sub.toUpperCase()).run();
      return ok({ ok: true });
    }
    if (id === 'equipos' && sub && subId === 'apagar' && metodo === 'POST') {
      await env.DB.prepare("UPDATE equipos SET encendido = NULL, data = json_set(data, '$.encendido', json('null')) WHERE codigo = ?").bind(sub.toUpperCase()).run();
      return ok({ ok: true });
    }
    if (id === 'energia' && metodo === 'POST') {
      const { delta } = await leerJson(request);
      const d = Math.max(-100, Math.min(100, Math.round(Number(delta) || 0)));
      await env.DB.prepare('UPDATE equipos SET energia = MAX(0, energia + ?)').bind(d).run();
      return ok({ ok: true });
    }
    if (id === 'estado' && metodo === 'GET') {
      return ok({ estado: await estadoGlobal(env), energiaVR: await leerAjuste(env, 'energiaVR', 300), salud: { ia: hayIA(env), modelo: env.MODELO || 'claude-opus-5-5' } });
    }
    if (id === 'estado' && metodo === 'POST') return staffEstado(request, env);
  }

  throw new ErrorHttp(404, 'Ruta no encontrada.');
}

// ---------- equipos ----------
function validarEquipo(equipo) {
  if (!equipo || typeof equipo !== 'object' || Array.isArray(equipo)) throw new ErrorHttp(400, 'Faltan los datos del equipo.');
  const nombre = String(equipo.nombre || '').trim();
  if (!nombre || nombre.length > 40) throw new ErrorHttp(400, 'El nombre del equipo debe tener de 1 a 40 letras.');
  revisarTextos(equipo);
  return nombre;
}

async function crearEquipo(request, env, codigo) {
  if (!CODIGO.test(codigo)) throw new ErrorHttp(400, 'Código de equipo inválido.');
  const { equipo } = await leerJson(request);
  const nombre = validarEquipo(equipo);
  const max = Number(env.MAX_EQUIPOS || 60);
  const cuenta = await env.DB.prepare('SELECT COUNT(*) AS n FROM equipos').first();
  if (cuenta.n >= max) throw new ErrorHttp(403, 'Ya se registraron todos los equipos permitidos. Avísenle al staff.');
  const estado = await estadoGlobal(env);
  const ahora = Date.now();
  const datos = { ...equipo, codigo, puntos: [] };
  const encendido = equipo.encendido ? ahora : null;
  delete datos.encendido;
  const r = await env.DB.prepare(`INSERT INTO equipos (codigo, nombre, data, energia, encendido, creado, actualizado)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(codigo) DO NOTHING`)
    .bind(codigo, nombre, JSON.stringify(datos), estado.energiaInicial, encendido, ahora, ahora).run();
  if (!r.meta || !r.meta.changes) throw new ErrorHttp(409, 'Ese código ya existe.', { motivo: 'existe' });
  return ok(await respuestaEquipo(env, await filaEquipo(env, codigo)), 201);
}

async function cambiarEquipo(request, env, codigo) {
  const { cambios } = await leerJson(request, 20000);
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) throw new ErrorHttp(400, 'Faltan los cambios.');
  PROHIBIDOS_PARCHE.forEach((k) => delete cambios[k]);
  revisarTextos(cambios);
  if (cambios.nombre !== undefined) {
    const n = String(cambios.nombre || '').trim();
    if (!n || n.length > 40) throw new ErrorHttp(400, 'El nombre del equipo debe tener de 1 a 40 letras.');
  }
  const prender = Boolean(cambios.encendido);
  delete cambios.encendido;
  const ahora = Date.now();
  const fila = await filaEquipo(env, codigo);
  const r = await env.DB.prepare(`UPDATE equipos SET data = json_patch(data, ?), actualizado = ?,
      nombre = COALESCE(json_extract(json_patch(data, ?), '$.nombre'), nombre),
      encendido = CASE WHEN ? THEN COALESCE(encendido, ?) ELSE encendido END
    WHERE codigo = ?`)
    .bind(JSON.stringify(cambios), ahora, JSON.stringify(cambios), prender ? 1 : 0, ahora, codigo).run();
  if (!r.meta || !r.meta.changes) throw new ErrorHttp(404, 'No existe un equipo con ese código.');
  const nueva = await env.DB.prepare('SELECT * FROM equipos WHERE codigo = ?').bind(codigo).first();
  if (nueva.data.length > 60000) {
    await env.DB.prepare('UPDATE equipos SET data = ? WHERE codigo = ?').bind(fila.data, codigo).run();
    throw new ErrorHttp(413, 'Los datos del equipo son demasiado grandes.');
  }
  return ok(await respuestaEquipo(env, nueva));
}

async function agregarPuntos(request, env, codigo) {
  const p = await leerJson(request, 4000);
  const registro = {
    id: String(p.id || '').slice(0, 24) || `p${Date.now().toString(36)}`,
    t: Number(p.t) || Date.now(),
    estacion: ESTACIONES.includes(p.estacion) ? p.estacion : 'otro',
    puntos: Math.max(-10000, Math.min(100000, Math.round(Number(p.puntos) || 0))),
    codigo: String(p.codigo || '').slice(0, 12),
    nota: String(p.nota || '').slice(0, 80),
  };
  if (registro.codigo) {
    const lectura = leerCodigoVR(registro.codigo, env.CLAVE_VR || 'enlace-vr-2026');
    registro.valido = Boolean(lectura && lectura.valido && lectura.puntaje === registro.puntos);
  }
  revisarTextos(registro.nota);
  await filaEquipo(env, codigo);
  await env.DB.prepare(`UPDATE equipos SET data = json_insert(data, '$.puntos[#]', json(?)), actualizado = ?
    WHERE codigo = ? AND json_array_length(data, '$.puntos') < 100
      AND NOT EXISTS (SELECT 1 FROM json_each(equipos.data, '$.puntos') WHERE json_extract(value, '$.id') = ?)`)
    .bind(JSON.stringify(registro), Date.now(), codigo, registro.id).run();
  return ok(await respuestaEquipo(env, await filaEquipo(env, codigo)));
}

async function borrarPuntos(env, codigo, idPuntos) {
  const fila = await filaEquipo(env, codigo);
  const datos = JSON.parse(fila.data);
  datos.puntos = (datos.puntos || []).filter((p) => p.id !== idPuntos);
  await env.DB.prepare('UPDATE equipos SET data = ?, actualizado = ? WHERE codigo = ?').bind(JSON.stringify(datos), Date.now(), codigo).run();
  return ok(await respuestaEquipo(env, await filaEquipo(env, codigo)));
}

async function chatEquipo(request, env, codigo) {
  const { mensajes, tipo, estacion } = await leerJson(request, 20000);
  const estado = await estadoGlobal(env);
  if (!estado.chatActivo) throw new ErrorHttp(403, 'El staff pausó el chat con IA por un momento.');
  if (!hayIA(env)) throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  const fila = await filaEquipo(env, codigo);
  const equipo = JSON.parse(fila.data);
  const ahora = Date.now();
  const presentacion = tipo === 'presentacion';
  let lista;
  if (presentacion) {
    const r = await env.DB.prepare('UPDATE equipos SET gratis = gratis - 1 WHERE codigo = ? AND gratis > 0 RETURNING gratis').bind(codigo).first();
    if (!r) throw new ErrorHttp(402, 'Ya se usaron las presentaciones.');
    lista = [{ role: 'user', content: pedidoPresentacion(equipo) }];
  } else {
    if (!(equipo.habilidades && equipo.habilidades.chat)) throw new ErrorHttp(403, 'Primero escaneen la tarjeta de la habilidad Chat con IA.');
    lista = limpiarMensajes(mensajes);
    revisarTextos(lista[lista.length - 1].content);
    if (ahora - (fila.ultimo_chat || 0) < 2500) throw new ErrorHttp(429, 'Un momento: JARVIS sigue pensando.');
    const r = await env.DB.prepare('UPDATE equipos SET energia = energia - 1, ultimo_chat = ? WHERE codigo = ? AND energia > 0 RETURNING energia')
      .bind(ahora, codigo).first();
    if (!r) throw new ErrorHttp(402, 'Su JARVIS se quedó sin batería. Pídanle al staff que lo recargue.', { energia: 0 });
  }
  let texto;
  try {
    await contarUsoIA(env);
    const p = PERSONALIDADES[equipo.personalidad && equipo.personalidad.id];
    const vars = { jarvis: equipo.jarvis && equipo.jarvis.nombre, equipo: equipo.nombre, lema: equipo.jarvis && equipo.jarvis.lema };
    const prueba = presentacion
      ? `${rellenar((p || PERSONALIDADES.P1).frases.presentacion, vars)} (Modo de prueba)`
      : `(Modo de prueba) Soy ${vars.jarvis || 'JARVIS'} y recibí tu pregunta: "${lista[lista.length - 1].content.slice(0, 80)}". Cuando se configure la API key, aquí contestará la IA.`;
    const enEstacion = AYUDA_ESTACIONES[estacion] ? estacion : (equipo.estacion && equipo.estacion.id);
    texto = await preguntarIA(env, promptEquipo(equipo, presentacion ? null : enEstacion), lista, { prueba });
  } catch (e) {
    // devolvemos la batería si la IA falló
    if (presentacion) await env.DB.prepare('UPDATE equipos SET gratis = gratis + 1 WHERE codigo = ?').bind(codigo).run();
    else await env.DB.prepare('UPDATE equipos SET energia = energia + 1, ultimo_chat = 0 WHERE codigo = ?').bind(codigo).run();
    throw e;
  }
  const despues = await env.DB.prepare('SELECT energia FROM equipos WHERE codigo = ?').bind(codigo).first();
  return ok({ texto, energia: despues ? despues.energia : 0 });
}

async function sala(env) {
  const { results } = await env.DB.prepare('SELECT nombre, data, encendido, creado FROM equipos ORDER BY creado').all();
  const equipos = results.map((f) => {
    const d = JSON.parse(f.data);
    const instalados = Object.values(d.instalados || {}).filter(Boolean).length;
    const total = (d.puntos || []).reduce((s, p) => s + (Number(p.puntos) || 0), 0);
    const piezas = Object.values(d.bitacora || {}).filter((v) => String(v || '').trim()).length;
    return {
      nombre: f.nombre,
      jarvis: (d.jarvis && d.jarvis.nombre) || 'JARVIS',
      forma: d.nucleo && d.nucleo.id,
      color: d.nucleo && d.nucleo.color,
      instalados,
      encendido: f.encendido || null,
      puntos: total,
      piezas,
      ultron: Boolean(d.logros && d.logros.ultron),
      estacion: (d.estacion && d.estacion.id) || null,
      creado: f.creado,
    };
  });
  return ok({ equipos, estado: estadoPublico(env, await estadoGlobal(env)) });
}

// ---------- staff ----------
async function staffEquipos(env) {
  const { results } = await env.DB.prepare('SELECT codigo, nombre, data, energia, gratis, encendido, creado, actualizado FROM equipos ORDER BY creado').all();
  return ok({
    equipos: results.map((f) => {
      const d = JSON.parse(f.data);
      return {
        codigo: f.codigo, nombre: f.nombre, energia: f.energia, gratis: f.gratis, encendido: f.encendido,
        creado: f.creado, actualizado: f.actualizado,
        jarvis: (d.jarvis && d.jarvis.nombre) || 'JARVIS',
        instalados: Object.values(d.instalados || {}).filter(Boolean).length,
        integrantes: (d.memoria && d.memoria.integrantes) || [],
        prepa: (d.memoria && d.memoria.prepa) || '',
        puntos: d.puntos || [],
        bitacora: d.bitacora || {},
        directiva: d.personalidad || {},
        estacion: (d.estacion && d.estacion.id) || null,
      };
    }),
  });
}

async function staffEstado(request, env) {
  const cambios = await leerJson(request, 4000);
  const estado = await estadoGlobal(env);
  if (typeof cambios.chatActivo === 'boolean') estado.chatActivo = cambios.chatActivo;
  if (cambios.energiaInicial !== undefined) estado.energiaInicial = Math.max(0, Math.min(200, Math.round(Number(cambios.energiaInicial) || 0)));
  if (cambios.anuncio === null) estado.anuncio = null;
  else if (cambios.anuncio && typeof cambios.anuncio.texto === 'string') {
    const texto = cambios.anuncio.texto.trim().slice(0, 200);
    if (texto) estado.anuncio = { id: `a${Date.now().toString(36)}`, t: Date.now(), texto, tipo: cambios.anuncio.tipo === 'ultron' ? 'ultron' : 'jarvis' };
  }
  await guardarAjuste(env, 'estado', estado);
  if (cambios.energiaVR !== undefined) await guardarAjuste(env, 'energiaVR', Math.max(0, Math.min(5000, Math.round(Number(cambios.energiaVR) || 0))));
  return ok({ estado, energiaVR: await leerAjuste(env, 'energiaVR', 300) });
}

// ---------- taller VR (JARVIS ya armado de la estación de Redes) ----------
async function estadoVR(env) {
  const estado = await estadoGlobal(env);
  return ok({ ia: hayIA(env), chatActivo: estado.chatActivo, energia: await leerAjuste(env, 'energiaVR', 300), anuncio: estado.anuncio });
}

async function chatVR(request, env) {
  const { mensajes, juego } = await leerJson(request, 20000);
  const estado = await estadoGlobal(env);
  if (!estado.chatActivo) throw new ErrorHttp(403, 'El staff pausó el chat con IA por un momento.');
  if (!hayIA(env)) throw new ErrorHttp(503, 'La IA todavía no está configurada.');
  const lista = limpiarMensajes(mensajes);
  revisarTextos(lista[lista.length - 1].content);
  const r = await env.DB.prepare(`INSERT INTO ajustes (clave, valor) VALUES ('energiaVR', '299')
    ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) - 1 AS TEXT) WHERE CAST(valor AS INTEGER) > 0 RETURNING valor`).first();
  if (!r) throw new ErrorHttp(402, 'Se acabó la batería del JARVIS de la estación. Recárguenla desde el panel del staff.', { energia: 0 });
  let texto;
  try {
    await contarUsoIA(env);
    texto = await preguntarIA(env, promptTallerVR(juego), lista, {
      prueba: `(Modo de prueba) Recibí tu pregunta: "${lista[lista.length - 1].content.slice(0, 80)}". Con la API key configurada, aquí contestará la IA sabiendo las reglas de los 4 juegos.`,
    });
  } catch (e) {
    await env.DB.prepare("UPDATE ajustes SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'energiaVR'").run();
    throw e;
  }
  return ok({ texto, energia: Number(await leerAjuste(env, 'energiaVR', 0)) });
}

async function listarResultadosVR(env) {
  const { results } = await env.DB.prepare('SELECT * FROM resultados_vr ORDER BY t DESC LIMIT 500').all();
  return ok({ resultados: results.map((r) => ({ ...r, valido: Boolean(r.valido) })) });
}

async function guardarResultadoVR(request, env) {
  const p = await leerJson(request, 4000);
  const equipo = String(p.equipo || '').trim().slice(0, 40);
  if (!equipo) throw new ErrorHttp(400, 'Escriban el nombre del equipo.');
  const juego = String(p.juego || '').slice(0, 40);
  if (!juego) throw new ErrorHttp(400, 'Falta el juego.');
  const registro = {
    id: String(p.id || '').slice(0, 24) || `r${Date.now().toString(36)}`,
    t: Date.now(),
    equipo,
    codigo_equipo: CODIGO.test(String(p.codigoEquipo || '').toUpperCase()) ? String(p.codigoEquipo).toUpperCase() : null,
    juego,
    puntaje: Math.max(0, Math.min(10000, Math.round(Number(p.puntaje) || 0))),
    codigo: String(p.codigo || '').slice(0, 12),
    nota: String(p.nota || '').slice(0, 120),
  };
  revisarTextos([registro.equipo, registro.nota]);
  const lectura = registro.codigo ? leerCodigoVR(registro.codigo, env.CLAVE_VR || 'enlace-vr-2026') : null;
  registro.valido = lectura && lectura.valido && lectura.puntaje === registro.puntaje ? 1 : 0;
  await env.DB.prepare(`INSERT INTO resultados_vr (id, t, equipo, codigo_equipo, juego, puntaje, codigo, valido, nota)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
    .bind(registro.id, registro.t, registro.equipo, registro.codigo_equipo, registro.juego, registro.puntaje, registro.codigo, registro.valido, registro.nota).run();
  // si el equipo dio su código de JARVIS, también se anota en sus puntos
  let enEquipo = false;
  if (registro.codigo_equipo) {
    const existe = await env.DB.prepare('SELECT codigo FROM equipos WHERE codigo = ?').bind(registro.codigo_equipo).first();
    if (existe) {
      const punto = { id: registro.id, t: registro.t, estacion: 'redes', puntos: registro.puntaje, codigo: registro.codigo, nota: `VR · ${registro.juego}`, valido: Boolean(registro.valido) };
      await env.DB.prepare(`UPDATE equipos SET data = json_insert(data, '$.puntos[#]', json(?)), actualizado = ?
        WHERE codigo = ? AND NOT EXISTS (SELECT 1 FROM json_each(equipos.data, '$.puntos') WHERE json_extract(value, '$.id') = ?)`)
        .bind(JSON.stringify(punto), Date.now(), registro.codigo_equipo, registro.id).run();
      enEquipo = true;
    }
  }
  return ok({ resultado: { ...registro, valido: Boolean(registro.valido) }, enEquipo }, 201);
}

async function borrarResultadoVR(request, env, id) {
  const fila = await env.DB.prepare('SELECT t FROM resultados_vr WHERE id = ?').bind(id).first();
  if (!fila) return ok({ ok: true });
  if (Date.now() - fila.t > 15 * 60 * 1000 && !esStaff(request, env)) {
    throw new ErrorHttp(401, 'Pasaron más de 15 minutos: para borrarlo se necesita el PIN del staff.');
  }
  await env.DB.prepare('DELETE FROM resultados_vr WHERE id = ?').bind(id).run();
  return ok({ ok: true });
}
