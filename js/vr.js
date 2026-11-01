/* JARVIS · Taller VR Ghost Network: el JARVIS ya armado de la estación de Redes
 *
 * Pone los videos de los minijuegos, explica cada uno en voz alta, lleva el tiempo, sigue el guion
 * de 40 minutos, contesta dudas (IA si hay API key; si no, las dudas frecuentes) y guarda los
 * resultados de cada equipo (en el Worker si hay servidor; si no, en esta tablet).
 */
import { MISION_VR, JUEGOS, GUION_VR } from './taller_vr_datos.js';
import { VOCES, icono } from './datos.js';
import { llamar, hayServidor } from './api.js';
import { CONFIG } from './config.js';
import { $, $$, esc, modal, confirmar, aviso, hora, mantenerPantalla } from './ui.js';
import { Nucleo } from './nucleo.js';
import { Ambiente } from './ambiente.js';
import { hablar, callar, alHablar, desbloquearVoz, escuchar, detenerEscucha, puedeEscuchar, vocesEspanol } from './voz.js';
import { sonido, desbloquearAudio } from './sonidos.js';
import { leerCodigoVR } from './codigo_vr.js';
import { textoLimpio } from './filtro.js';

const CLAVE_AJUSTES = 'jarvis-vr-ajustes';
const CLAVE_LOCAL = 'jarvis-vr-resultados';
const fondo = new Ambiente($('#fondo'));
fondo.poner('laboratorio', '#3fd0ff');
const nucleo = new Nucleo($('#nucleo'), { forma: 'reactor', color: '#3fd0ff' });
alHablar((v) => nucleo.hablando(v));
document.addEventListener('pointerdown', () => { desbloquearVoz(); desbloquearAudio(); mantenerPantalla(); }, { once: true });

let ajustes = { voz: 'V1', tono: null, velocidad: null, vozNombre: '', pin: '' };
try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || '{}') }; } catch (e) { /* nada */ }
const guardarAjustes = () => { try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* nada */ } };

let tab = 'juegos';
let juegoActual = null;
let pasoActual = 0;
let historial = [];
let esperando = false;
let servidor = { ia: false, energia: null, chatActivo: true, conectado: false };
let resultados = [];
const clave = () => CONFIG.CLAVE_VR;

function voz() {
  const v = VOCES[ajustes.voz] || VOCES.V1;
  return { tono: ajustes.tono ?? v.tono, velocidad: ajustes.velocidad ?? v.velocidad, voz: v.voz, vozNombre: ajustes.vozNombre };
}
function subtitulo(t) { $('#subtitulo').textContent = t || ''; }
async function decir(texto) { subtitulo(texto); await hablar(texto, voz()); }
const juego = (id) => JUEGOS.find((j) => j.id === id);

// ---------- estado del servidor ----------
async function revisarServidor() {
  if (!hayServidor()) { servidor.conectado = false; pintarEstado(); return; }
  try {
    const r = await llamar('GET', '/api/vr/estado');
    servidor = { ...r, conectado: true };
  } catch (e) { servidor.conectado = false; }
  pintarEstado();
}
function pintarEstado() {
  const punto = $('#punto');
  const texto = $('#estado-texto');
  if (!hayServidor()) { punto.className = 'punto-conexion'; texto.textContent = 'Sin servidor'; }
  else if (!servidor.conectado) { punto.className = 'punto-conexion mal'; texto.textContent = 'Sin conexión'; }
  else { punto.className = 'punto-conexion ok'; texto.textContent = servidor.ia ? (servidor.chatActivo ? 'IA lista' : 'IA en pausa') : 'Sin API key'; }
  const bat = $('#bateria');
  bat.hidden = !(servidor.conectado && servidor.ia);
  bat.innerHTML = `${icono('bateria')} ${servidor.energia ?? ''}`;
}

// ---------- chat ----------
$('#enviar').innerHTML = icono('enviar');
if (puedeEscuchar) {
  const mic = $('#mic');
  mic.hidden = false;
  mic.innerHTML = icono('mic');
  mic.addEventListener('click', async () => {
    if (mic.classList.contains('escuchando')) { detenerEscucha(); return; }
    callar();
    mic.classList.add('escuchando');
    subtitulo('Escuchando…');
    const t = await escuchar({ alParcial: (p) => subtitulo(`“${p}”`) });
    mic.classList.remove('escuchando');
    if (t) preguntar(t); else subtitulo('No te escuché bien. Intenta otra vez o escríbelo.');
  });
}
$('#f-chat').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const q = $('#pregunta').value.trim();
  if (!q) return;
  $('#pregunta').value = '';
  preguntar(q);
});

function pintarDudas() {
  const j = juego(juegoActual);
  const lista = j ? j.dudas.map((d) => ({ texto: d.p, respuesta: d.r })) : [
    { texto: '¿Cómo funciona el taller?', respuesta: `${MISION_VR.historia} ${MISION_VR.formato}` },
    { texto: '¿Qué hace el Operador?', respuesta: 'El Operador lleva el visor: ve el juego, pero no tiene el manual. Le describe al equipo lo que ve y hace lo que el equipo le dice.' },
    { texto: '¿Cuándo se ganan las pistas?', respuesta: 'Solo en las rondas, no en la práctica. Cada juego tiene un mínimo: si lo alcanzan, el visor les da su pieza de la IP o del GPS.' },
  ];
  $('#dudas').innerHTML = lista.map((d, i) => `<button class="chip" data-i="${i}">${esc(d.texto)}</button>`).join('');
  $('#dudas').onclick = (ev) => {
    const b = ev.target.closest('[data-i]');
    if (!b) return;
    const d = lista[Number(b.dataset.i)];
    historial.push({ role: 'user', content: d.texto }, { role: 'assistant', content: d.respuesta });
    pintarHistorial();
    decir(d.respuesta);
  };
}

function pintarHistorial() {
  $('#historial').innerHTML = historial.slice(-8).reverse().map((m) => `<div class="burbuja ${m.role === 'user' ? 'yo' : 'jarvis'}">${esc(m.content)}</div>`).join('');
}

function normalizar(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' '); }

/** Sin IA: busca la duda frecuente que más se parece a la pregunta. */
function respuestaLocal(pregunta) {
  const palabras = new Set(normalizar(pregunta).split(/\s+/).filter((w) => w.length > 3));
  let mejor = null;
  let puntos = 0;
  JUEGOS.forEach((j) => {
    j.dudas.forEach((d) => {
      const texto = new Set(normalizar(`${d.p} ${d.r} ${j.nombre}`).split(/\s+/));
      let p = 0;
      palabras.forEach((w) => { if (texto.has(w)) p += 1; });
      if (j.id === juegoActual) p += 0.5;
      if (p > puntos) { puntos = p; mejor = d.r; }
    });
  });
  if (puntos >= 1.5) return mejor;
  const j = JUEGOS.find((x) => normalizar(pregunta).includes(normalizar(x.nombre.split(' ')[0])));
  if (j) return j.explicacion;
  return 'No tengo conexión con mi núcleo de inteligencia artificial. Revisen los pasos del juego o pregúntenle al facilitador.';
}

async function preguntar(texto) {
  if (esperando) return;
  if (!textoLimpio(texto)) { decir('Mejor hablemos de la misión.'); return; }
  historial.push({ role: 'user', content: texto });
  pintarHistorial();
  const conIA = hayServidor() && servidor.conectado && servidor.ia && servidor.chatActivo;
  if (!conIA) {
    const r = respuestaLocal(texto);
    historial.push({ role: 'assistant', content: r });
    pintarHistorial();
    decir(r);
    return;
  }
  esperando = true;
  subtitulo('Pensando…');
  nucleo.hablando(true);
  try {
    const r = await llamar('POST', '/api/vr/chat', { mensajes: historial.slice(-10), juego: juegoActual }, { timeout: 35000 });
    servidor.energia = r.energia;
    pintarEstado();
    historial.push({ role: 'assistant', content: r.texto });
    pintarHistorial();
    nucleo.hablando(false);
    decir(r.texto);
  } catch (e) {
    nucleo.hablando(false);
    const r = respuestaLocal(texto);
    historial.push({ role: 'assistant', content: r });
    pintarHistorial();
    aviso(e.status === 0 ? 'Sin conexión: contesté con las dudas frecuentes.' : e.message, { mal: true, ms: 4000 });
    decir(r);
  } finally {
    esperando = false;
  }
}

// ---------- reloj ----------
let reloj = null;
function iniciarReloj(j) {
  pararReloj(false);
  juegoActual = j.id;
  reloj = { juego: j, restante: j.minutos * 60, pausado: false, aviso30: false };
  $('#reloj').hidden = false;
  $('#reloj-juego').textContent = `${j.nombre} · ronda`;
  pintarReloj();
  sonido('anuncio');
  decir(`Tiempo para ${j.nombre}: ${j.minutos} minutos. ¡Empiecen!`);
  reloj.intervalo = setInterval(() => {
    if (reloj.pausado) return;
    reloj.restante -= 1;
    pintarReloj();
    if (reloj.restante === 30 && !reloj.aviso30) { reloj.aviso30 = true; sonido('bip'); decir('¡Últimos treinta segundos!'); }
    if (reloj.restante <= 0) {
      const jj = reloj.juego;
      pararReloj(false);
      sonido('enLinea');
      decir('¡Tiempo! Anoten su puntaje y el código que les dio el visor.');
      const m = modal(`<h2>¡Tiempo!</h2><p>${esc(jj.nombre)} terminó. Registren el puntaje y el código que aparece en el visor.</p>
        <button class="btn btn-primario btn-grande" style="width:100%">Registrar resultado</button>`);
      m.el.querySelector('.btn-primario').addEventListener('click', () => { m.cerrar(); tab = 'resultados'; pintar(); $('#r-juego').value = jj.nombre; });
    }
  }, 1000);
  pintar();
}
function pintarReloj() {
  if (!reloj) return;
  const m = Math.floor(reloj.restante / 60);
  const s = String(reloj.restante % 60).padStart(2, '0');
  $('#reloj-t').textContent = `${m}:${s}`;
  $('#reloj').classList.toggle('urgente', reloj.restante <= 30);
  $('#reloj-pausa').textContent = reloj.pausado ? 'Seguir' : 'Pausa';
}
function pararReloj(ocultar = true) {
  if (reloj) clearInterval(reloj.intervalo);
  reloj = null;
  if (ocultar !== false) $('#reloj').hidden = true;
  else $('#reloj').hidden = true;
}
$('#reloj-pausa').addEventListener('click', () => { if (reloj) { reloj.pausado = !reloj.pausado; pintarReloj(); } });
$('#reloj-parar').addEventListener('click', () => pararReloj());

// ---------- video ----------
function verVideo(j) {
  juegoActual = j.id;
  callar();
  const m = modal(`<h2>${esc(j.nombre)}</h2>
    <video class="reel" src="${esc(j.video)}" controls autoplay playsinline></video>
    <div class="fila-botones" style="margin-top:12px"><button class="btn btn-primario" data-explicar>${icono('altavoz')} Explicar con JARVIS</button><button class="btn" data-otra>Ver otra vez</button></div>`,
  { alCerrar: () => { const v = m.el.querySelector('video'); if (v) v.pause(); } });
  const video = m.el.querySelector('video');
  video.addEventListener('ended', () => { m.el.querySelector('[data-explicar]').classList.add('glitch'); });
  video.addEventListener('error', () => { video.replaceWith(Object.assign(document.createElement('p'), { textContent: 'No se pudo cargar el video. Revisen el internet.', className: 'panel' })); });
  m.el.querySelector('[data-explicar]').addEventListener('click', () => { video.pause(); explicar(j); });
  m.el.querySelector('[data-otra]').addEventListener('click', () => { video.currentTime = 0; video.play(); });
  pintar();
}

function explicar(j) {
  juegoActual = j.id;
  pintarDudas();
  decir(j.explicacion);
  if (tab === 'juegos') pintar();
}

// ---------- pestañas ----------
$('#tabs').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  pintar();
});

function pintar() {
  $$('#tabs [data-tab]').forEach((b) => b.classList.toggle('btn-primario', b.dataset.tab === tab));
  const cont = $('#contenido');
  ({ juegos: pintarJuegos, guion: pintarGuion, resultados: pintarResultados, ajustes: pintarAjustes })[tab](cont);
  pintarDudas();
}

function pintarJuegos(cont) {
  cont.innerHTML = `<div class="panel" style="margin-bottom:12px">
      <h2 style="margin-bottom:4px">${esc(MISION_VR.titulo)}</h2>
      <p style="margin:0">${esc(MISION_VR.historia)}</p>
      <p class="tenue" style="margin:8px 0 0">${esc(MISION_VR.formato)}</p>
      <div class="fila-botones" style="margin-top:10px"><button class="btn btn-chico" data-mision>${icono('altavoz')} Contar la misión</button></div>
    </div>
    <div class="lista">${JUEGOS.map((j) => `<div class="item juego ${j.id === juegoActual ? 'actual' : ''}">
      <div class="cabeza"><b><span class="num">${j.numero}</span>${esc(j.nombre)}</b><span class="etiqueta">${esc(j.area)} · ${j.minutos} min</span></div>
      <span class="tenue">🔑 ${esc(j.pista)}</span>
      <div class="fila-botones">
        <button class="btn btn-chico" data-video="${j.id}">${icono('video')} Video</button>
        <button class="btn btn-chico" data-explicar="${j.id}">${icono('altavoz')} Explicar</button>
        <button class="btn btn-chico" data-reloj="${j.id}">⏱ ${j.minutos}:00</button>
        <button class="btn btn-chico" data-elegir="${j.id}">${j.id === juegoActual ? '✓ Jugando' : 'Estamos jugando este'}</button>
      </div>
      <details ${j.id === juegoActual ? 'open' : ''}><summary>Pasos, reglas y dudas</summary>
        <ol>${j.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <p class="tenue" style="margin:0 0 8px">${esc(j.reglas)}</p>
        <div class="chips">${j.dudas.map((d, i) => `<button class="chip" data-duda="${j.id}:${i}">${esc(d.p)}</button>`).join('')}</div>
      </details>
    </div>`).join('')}</div>`;
  cont.querySelector('[data-mision]').addEventListener('click', () => decir(`${MISION_VR.historia} ${MISION_VR.formato}`));
  cont.querySelectorAll('[data-video]').forEach((b) => b.addEventListener('click', () => verVideo(juego(b.dataset.video))));
  cont.querySelectorAll('[data-explicar]').forEach((b) => b.addEventListener('click', () => explicar(juego(b.dataset.explicar))));
  cont.querySelectorAll('[data-reloj]').forEach((b) => b.addEventListener('click', () => iniciarReloj(juego(b.dataset.reloj))));
  cont.querySelectorAll('[data-elegir]').forEach((b) => b.addEventListener('click', () => { juegoActual = b.dataset.elegir; pintar(); }));
  cont.querySelectorAll('[data-duda]').forEach((b) => b.addEventListener('click', () => {
    const [id, i] = b.dataset.duda.split(':');
    decir(juego(id).dudas[Number(i)].r);
  }));
}

function pintarGuion(cont) {
  cont.innerHTML = `<p class="tenue" style="margin-top:0">El guion de 40 minutos. Toquen <b>Decir</b> y JARVIS lo anuncia al grupo.</p>
    <div class="lista">${GUION_VR.map((p, i) => {
    const j = p.juego && juego(p.juego);
    return `<div class="item paso ${i === pasoActual ? 'actual' : ''}">
      <div class="cabeza"><b><span class="min">${String(p.min).padStart(2, '0')}:00</span> · ${esc(p.titulo)}</b>${j ? `<span class="etiqueta">${j.minutos} min</span>` : ''}</div>
      <span>${esc(p.di)}</span>
      ${p.accion ? `<span class="tenue">→ ${esc(p.accion)}</span>` : ''}
      <div class="fila-botones">
        <button class="btn btn-chico ${i === pasoActual ? 'btn-primario' : ''}" data-decir="${i}">${icono('altavoz')} Decir</button>
        ${j ? `<button class="btn btn-chico" data-video="${j.id}">${icono('video')} Video</button><button class="btn btn-chico" data-explicar="${j.id}">Explicar</button><button class="btn btn-chico" data-reloj="${j.id}">⏱ ${j.minutos}:00</button>` : ''}
      </div></div>`;
  }).join('')}</div>`;
  cont.querySelectorAll('[data-decir]').forEach((b) => b.addEventListener('click', () => {
    pasoActual = Number(b.dataset.decir);
    const p = GUION_VR[pasoActual];
    if (p.juego) juegoActual = p.juego;
    decir(p.di);
    pasoActual = Math.min(GUION_VR.length - 1, pasoActual + 1);
    pintar();
  }));
  cont.querySelectorAll('[data-video]').forEach((b) => b.addEventListener('click', () => verVideo(juego(b.dataset.video))));
  cont.querySelectorAll('[data-explicar]').forEach((b) => b.addEventListener('click', () => explicar(juego(b.dataset.explicar))));
  cont.querySelectorAll('[data-reloj]').forEach((b) => b.addEventListener('click', () => iniciarReloj(juego(b.dataset.reloj))));
}

// ---------- resultados ----------
function locales() { try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '[]'); } catch (e) { return []; } }
function guardarLocales(l) { try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(l.slice(-500))); } catch (e) { /* nada */ } }

async function cargarResultados() {
  const pendientes = locales().filter((r) => r.pendiente);
  if (hayServidor()) {
    // primero mandamos lo que quedó pendiente
    for (const r of pendientes) {
      try {
        await llamar('POST', '/api/vr/resultados', r);
        guardarLocales(locales().map((x) => (x.id === r.id ? { ...x, pendiente: false } : x)));
      } catch (e) { break; }
    }
    try {
      const r = await llamar('GET', '/api/vr/resultados');
      const ids = new Set(r.resultados.map((x) => x.id));
      resultados = [...r.resultados, ...locales().filter((x) => x.pendiente && !ids.has(x.id))];
      return;
    } catch (e) { /* sin conexión: lo local */ }
  }
  resultados = locales().map((x) => ({ ...x, codigo_equipo: x.codigoEquipo }));
}

function resumenPorEquipo() {
  const equipos = new Map();
  resultados.forEach((r) => {
    const k = r.equipo.trim().toLowerCase();
    if (!equipos.has(k)) equipos.set(k, { nombre: r.equipo, juegos: {} });
    const e = equipos.get(k);
    const j = JUEGOS.find((x) => x.nombre === r.juego || x.nombre.startsWith(r.juego) || r.juego.startsWith(x.nombre.split(' · ')[0]));
    const id = j ? j.id : r.juego;
    e.juegos[id] = Math.max(e.juegos[id] ?? 0, r.puntaje);
  });
  return [...equipos.values()];
}

async function pintarResultados(cont) {
  const nombres = [...new Set(resultados.map((r) => r.equipo))];
  cont.innerHTML = `<form class="panel" id="f-res">
      <h2>Registrar resultado</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label class="campo" style="margin:0"><span>Equipo</span><input type="text" id="r-equipo" list="equipos-lista" maxlength="40" required autocomplete="off"></label>
        <label class="campo" style="margin:0"><span>Código JARVIS (opcional)</span><input type="text" id="r-cod-eq" maxlength="4" placeholder="AB23" autocomplete="off" style="text-transform:uppercase;font-family:var(--mono)"></label>
      </div>
      <datalist id="equipos-lista">${nombres.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <label class="campo"><span>Código del visor (opcional, llena juego y puntaje)</span><input type="text" id="r-codigo" maxlength="9" placeholder="7KQ2-9XMB" autocomplete="off" style="text-transform:uppercase;font-family:var(--mono)"></label>
      <p id="r-info" class="tenue" style="margin:0 0 6px;font-size:15px"></p>
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:8px">
        <label class="campo" style="margin:0"><span>Juego</span><select id="r-juego">${JUEGOS.map((j) => `<option ${j.id === juegoActual ? 'selected' : ''}>${esc(j.nombre)}</option>`).join('')}</select></label>
        <label class="campo" style="margin:0"><span>Puntaje</span><input type="number" id="r-puntaje" min="0" max="10000" inputmode="numeric" required></label>
      </div>
      <label class="campo"><span>Nota (opcional)</span><input type="text" id="r-nota" maxlength="120" autocomplete="off"></label>
      <button class="btn btn-primario btn-grande" style="width:100%">Guardar resultado</button>
      <p class="tenue" style="font-size:14px;margin:8px 0 0">${hayServidor() ? 'Se guarda en el servidor (y en los puntos del equipo si dan su código JARVIS).' : 'Sin servidor: se guarda en esta tablet. Pueden exportarlo a CSV.'}</p>
    </form>
    <section class="panel" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h2 style="margin:0">Por equipo</h2><div class="fila-botones"><button class="btn btn-chico" id="r-csv">Exportar CSV</button><button class="btn btn-chico" id="r-actualizar">Actualizar</button></div></div>
      <div class="tabla-scroll" id="r-resumen"><p class="tenue">Cargando…</p></div>
      <h3 style="margin-top:16px">Últimos registros</h3>
      <div class="tabla-scroll" id="r-lista"></div>
    </section>`;
  const codigo = cont.querySelector('#r-codigo');
  codigo.addEventListener('input', () => {
    const r = codigo.value.trim() ? leerCodigoVR(codigo.value, clave()) : null;
    const info = cont.querySelector('#r-info');
    if (!r) { info.textContent = codigo.value.trim() ? 'El código tiene 8 letras o números.' : ''; return; }
    if (!r.valido) { info.innerHTML = '<span class="mal">✗ Código no válido. Revisen cada letra.</span>'; return; }
    const j = JUEGOS.find((x) => x.nombre.includes(r.nombreJuego) || r.nombreJuego.includes(x.nombre.split(' · ').pop()));
    info.innerHTML = `<span class="ok">✓ ${esc(r.nombreJuego)} · ${r.puntaje} puntos · ${r.hora}${r.equipo ? ` · visor del equipo ${r.equipo}` : ''}</span>`;
    if (j) cont.querySelector('#r-juego').value = j.nombre;
    cont.querySelector('#r-puntaje').value = r.puntaje;
  });
  cont.querySelector('#f-res').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const equipo = cont.querySelector('#r-equipo').value.trim();
    const nota = cont.querySelector('#r-nota').value.trim();
    if (!textoLimpio(equipo) || !textoLimpio(nota)) { aviso('Hay un texto que no se puede usar.', { mal: true }); return; }
    const nombreJuego = cont.querySelector('#r-juego').value;
    const j = JUEGOS.find((x) => x.nombre === nombreJuego);
    const lectura = codigo.value.trim() ? leerCodigoVR(codigo.value, clave()) : null;
    const registro = {
      id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      t: Date.now(),
      equipo,
      codigoEquipo: cont.querySelector('#r-cod-eq').value.trim().toUpperCase(),
      juego: nombreJuego,
      puntaje: Math.max(0, Math.round(Number(cont.querySelector('#r-puntaje').value) || 0)),
      codigo: lectura ? lectura.codigo : codigo.value.trim().toUpperCase(),
      nota,
    };
    registro.valido = Boolean(lectura && lectura.valido && lectura.puntaje === registro.puntaje);
    let enviado = false;
    let enEquipo = false;
    if (hayServidor()) {
      try {
        const r = await llamar('POST', '/api/vr/resultados', registro);
        enviado = true;
        enEquipo = r.enEquipo;
      } catch (e) {
        if (e.status && e.status !== 0) { aviso(e.message, { mal: true }); return; }
      }
    }
    guardarLocales([...locales(), { ...registro, pendiente: hayServidor() && !enviado }]);
    sonido('instalar');
    const gano = j && registro.puntaje >= j.minimo;
    decir(`Registrado: ${equipo}, ${registro.puntaje} en ${j ? j.nombre.split(' · ').pop() : nombreJuego}. ${gano ? '¡Con eso ganaron su pista!' : `Para la pista necesitan ${j ? j.minimo : 'más'} ${j ? j.unidad : 'puntos'}.`}`);
    aviso(enviado ? (enEquipo ? 'Guardado (también en el JARVIS del equipo)' : 'Guardado en el servidor') : (hayServidor() ? 'Sin conexión: guardado en la tablet, se manda después' : 'Guardado en la tablet'));
    cont.querySelector('#r-puntaje').value = '';
    codigo.value = '';
    cont.querySelector('#r-nota').value = '';
    cont.querySelector('#r-info').textContent = '';
    await cargarResultados();
    pintarTablas(cont);
  });
  cont.querySelector('#r-csv').addEventListener('click', exportarCSV);
  cont.querySelector('#r-actualizar').addEventListener('click', async () => { await cargarResultados(); pintarTablas(cont); });
  await cargarResultados();
  pintarTablas(cont);
}

function pintarTablas(cont) {
  const resumen = resumenPorEquipo();
  const r = cont.querySelector('#r-resumen');
  if (!r) return;
  r.innerHTML = resumen.length ? `<table><thead><tr><th>Equipo</th>${JUEGOS.map((j) => `<th>${esc(j.nombre.split(' · ').pop())}</th>`).join('')}<th>Pistas</th></tr></thead><tbody>
    ${resumen.map((e) => {
    let pistas = 0;
    const celdas = JUEGOS.map((j) => {
      const p = e.juegos[j.id];
      const gano = p !== undefined && p >= j.minimo;
      if (gano) pistas += j.id === 'robot' ? Math.min(2, p) : 1;
      return `<td class="mono ${gano ? 'ok' : ''}">${p ?? '—'}${gano ? ' ✓' : ''}</td>`;
    }).join('');
    return `<tr><td><b>${esc(e.nombre)}</b></td>${celdas}<td class="mono">${pistas}/5</td></tr>`;
  }).join('')}</tbody></table>` : '<p class="tenue">Todavía no hay resultados.</p>';
  const lista = cont.querySelector('#r-lista');
  const recientes = [...resultados].sort((a, b) => b.t - a.t).slice(0, 30);
  lista.innerHTML = recientes.length ? `<table><thead><tr><th>Hora</th><th>Equipo</th><th>Juego</th><th>Puntaje</th><th>Código</th><th></th></tr></thead><tbody>
    ${recientes.map((x) => `<tr><td>${hora(x.t)}</td><td>${esc(x.equipo)}</td><td>${esc(x.juego.split(' · ').pop())}</td><td class="mono">${x.puntaje}</td>
      <td>${x.codigo ? `<span class="${x.valido ? 'ok' : 'mal'}">${x.valido ? '✓' : '✗'}</span> <span class="mono">${esc(x.codigo)}</span>` : '—'}${x.pendiente ? ' <span class="etiqueta">sin enviar</span>' : ''}</td>
      <td><button class="btn-texto" data-borrar="${esc(x.id)}" style="min-height:30px">Borrar</button></td></tr>`).join('')}</tbody></table>` : '';
  lista.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar este resultado?', { si: 'Borrar', peligro: true }))) return;
    const id = b.dataset.borrar;
    if (hayServidor()) {
      try { await llamar('DELETE', `/api/vr/resultados/${id}`, undefined, { pin: ajustes.pin }); } catch (e) {
        if (e.status !== 0) { aviso(e.message, { mal: true }); return; }
      }
    }
    guardarLocales(locales().filter((x) => x.id !== id));
    await cargarResultados();
    pintarTablas(cont);
  }));
}

function exportarCSV() {
  const filas = [['Hora', 'Equipo', 'Código JARVIS', 'Juego', 'Puntaje', 'Código VR', 'Válido', 'Nota']];
  [...resultados].sort((a, b) => a.t - b.t).forEach((x) => filas.push([new Date(x.t).toLocaleString('es-MX'), x.equipo, x.codigo_equipo || x.codigoEquipo || '', x.juego, x.puntaje, x.codigo, x.valido ? 'sí' : 'no', x.nota || '']));
  const texto = filas.map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
  a.download = `ghost-network-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------- ajustes ----------
function pintarAjustes(cont) {
  const base = VOCES[ajustes.voz] || VOCES.V1;
  const voces = vocesEspanol();
  cont.innerHTML = `<section class="panel">
    <h2>Voz de JARVIS</h2>
    <label class="campo"><span>Estilo</span><select id="a-voz">${Object.entries(VOCES).map(([k, v]) => `<option value="${k}" ${k === ajustes.voz ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('')}</select></label>
    <label class="campo"><span>Tono: <b id="a-tono-n"></b></span><input type="range" id="a-tono" min="0" max="2" step="0.05" value="${ajustes.tono ?? base.tono}"></label>
    <label class="campo"><span>Velocidad: <b id="a-vel-n"></b></span><input type="range" id="a-vel" min="0.5" max="1.8" step="0.05" value="${ajustes.velocidad ?? base.velocidad}"></label>
    ${voces.length > 1 ? `<label class="campo"><span>Voz del aparato</span><select id="a-vnombre"><option value="">Automática</option>${voces.map((v) => `<option ${v.name === ajustes.vozNombre ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : ''}
    <div class="fila-botones"><button class="btn btn-primario" id="a-guardar">Guardar</button><button class="btn" id="a-probar">${icono('altavoz')} Probar</button></div>
  </section>
  <section class="panel" style="margin-top:12px">
    <h2>Estación</h2>
    <p class="tenue" style="margin-top:0">${hayServidor() ? `Servidor: ${servidor.conectado ? 'conectado' : 'sin conexión'} · IA: ${servidor.ia ? 'configurada' : 'sin API key (contesta con las dudas frecuentes)'} · Batería: ${servidor.energia ?? '—'}` : 'Sin servidor: los resultados se guardan solo en esta tablet y JARVIS contesta con las dudas frecuentes.'}</p>
    <label class="campo"><span>PIN del staff (para borrar resultados de hace más de 15 min)</span><input type="password" id="a-pin" value="${esc(ajustes.pin)}" autocomplete="off"></label>
    <div class="fila-botones"><button class="btn" id="a-pin-g">Guardar PIN</button><a class="btn" href="staff.html" target="_blank">Panel del staff ↗</a><a class="btn" href="guia.html#taller-vr" target="_blank">Guía ↗</a><a class="btn" href="${esc(CONFIG.JUEGOS_VR)}" target="_blank">Juegos VR ↗</a></div>
  </section>`;
  const tono = cont.querySelector('#a-tono');
  const vel = cont.querySelector('#a-vel');
  const p = () => { cont.querySelector('#a-tono-n').textContent = Number(tono.value).toFixed(2); cont.querySelector('#a-vel-n').textContent = `${Number(vel.value).toFixed(2)}×`; };
  tono.addEventListener('input', p); vel.addEventListener('input', p); p();
  cont.querySelector('#a-voz').addEventListener('change', (ev) => { const v = VOCES[ev.target.value]; tono.value = v.tono; vel.value = v.velocidad; p(); sonido(v.sonido); });
  const leer = () => ({ voz: cont.querySelector('#a-voz').value, tono: Number(tono.value), velocidad: Number(vel.value), vozNombre: cont.querySelector('#a-vnombre')?.value || '' });
  cont.querySelector('#a-probar').addEventListener('click', () => { const a = leer(); subtitulo('Bienvenidos a Ghost Network.'); hablar('Bienvenidos a Ghost Network. Soy JARVIS.', { ...a, voz: VOCES[a.voz].voz }); });
  cont.querySelector('#a-guardar').addEventListener('click', () => { ajustes = { ...ajustes, ...leer() }; guardarAjustes(); aviso('Voz guardada'); decir('Voz guardada.'); });
  cont.querySelector('#a-pin-g').addEventListener('click', () => { ajustes.pin = cont.querySelector('#a-pin').value.trim(); guardarAjustes(); aviso('PIN guardado en esta tablet'); });
}

// ---------- arranque ----------
pintar();
revisarServidor();
setInterval(revisarServidor, 20000);
subtitulo('Hola, soy JARVIS. Toquen un juego para ver su video o para que se los explique.');
