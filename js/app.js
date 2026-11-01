/* JARVIS · la app de cada equipo
 *
 * Vistas: inicio (crear o unirse) → taller (escanear tarjetas e instalar módulos) → JARVIS encendido
 * (hablar, bitácora, puntos, cámara, módulos, ficha). Todo el estado vive en estado.js.
 */
import {
  MODULOS, MODULO, VOCES, NUCLEOS, AMBIENTES, COLORES, HABILIDADES, HABILIDAD_POR_ID, TARJETAS, PERSONALIDADES,
  SUGERENCIAS, ESTACIONES, ESTACIONES_PUNTOS, CHISTES, DATOS, icono, leerQR, alAzar, colorTarjeta,
} from './datos.js';
import { REGLAS_FIJAS, rellenar } from './personalidades.js';
import { estado } from './estado.js';
import { llamar, hayServidor } from './api.js';
import { CONFIG } from './config.js';
import { $, $$, esc, modal, confirmar, aviso, hora, qrSVG, mantenerPantalla } from './ui.js';
import { Nucleo } from './nucleo.js';
import { Ambiente } from './ambiente.js';
import { hablar, callar, alHablar, desbloquearVoz, vocesEspanol, escuchar, detenerEscucha, puedeEscuchar } from './voz.js';
import { sonido, fiesta, desbloquearAudio } from './sonidos.js';
import { abrirEscaner, cerrarEscaner } from './qr.js';
import { abrirCamara, cerrarCamara, capturar, guardarFoto, listarFotos, borrarFoto, camaraDeFrente } from './camara.js';
import { textoLimpio, primerTextoSucio } from './filtro.js';
import { leerCodigoVR } from './codigo_vr.js';
import { AYUDA_ESTACIONES, ORDEN_ESTACIONES } from './estaciones_datos.js';

const app = $('#app');
const fondo = new Ambiente($('#fondo'));
let nucleo = null;
let vista = '';
let pestana = 'hablar';
let historial = [];
let esperandoIA = false;
const NECESARIOS = MODULOS.filter((m) => m.necesario).map((m) => m.id);

const NEUTRAS = {
  saludo: 'Hola, equipo {equipo}. Soy {jarvis}.',
  listo: 'Módulo instalado.',
  presentacion: 'Sistemas en línea. Soy {jarvis}, el asistente del equipo {equipo}. {lema} Juntos vamos a vencer a Ultrón.',
  sinIA: 'Mi núcleo de inteligencia artificial no está disponible en este momento.',
  animo: '¡Puntos registrados!',
};

// ---------- ayudas ----------
const eq = () => estado.equipo;
const instalado = (m) => Boolean(eq() && eq().instalados && eq().instalados[m]);
const tieneHabilidad = (id) => Boolean(eq() && eq().habilidades && eq().habilidades[id]);
const vars = () => ({ jarvis: eq().jarvis.nombre, equipo: eq().nombre, lema: eq().jarvis.lema });

function frase(clave) {
  const p = instalado('personalidad') && PERSONALIDADES[eq().personalidad.id];
  return rellenar(p ? p.frases[clave] : NEUTRAS[clave], vars());
}

function ajustesVoz() {
  const v = (eq() && eq().voz) || {};
  const base = VOCES[v.id] || VOCES.V1;
  if (!instalado('voz')) return { tono: 1, velocidad: 1, voz: 0 };
  return { tono: v.tono ?? base.tono, velocidad: v.velocidad ?? base.velocidad, voz: base.voz, vozNombre: v.vozNombre || '' };
}

function subtitulo(texto) {
  const el = $('#subtitulo');
  if (el) el.textContent = texto || '';
}

async function decir(texto, { sonar = false } = {}) {
  if (!texto) return;
  subtitulo(texto);
  if (sonar && instalado('voz')) sonido((VOCES[eq().voz.id] || VOCES.V1).sonido);
  await hablar(texto, ajustesVoz());
}

alHablar((v) => { if (nucleo) nucleo.hablando(v); });

function colorEquipo() { return (eq() && instalado('nucleo') && eq().nucleo.color) || '#3fd0ff'; }

function aplicarAspecto() {
  const color = colorEquipo();
  document.documentElement.style.setProperty('--acento', color);
  fondo.poner(instalado('ambiente') ? (AMBIENTES[eq().ambiente.id] || {}).tipo : 'base', color);
  if (nucleo) nucleo.poner({ forma: instalado('nucleo') ? (NUCLEOS[eq().nucleo.id] || NUCLEOS.N1).forma : 'reactor', color });
}

function montarNucleo() {
  if (nucleo) nucleo.destruir();
  const lienzo = $('#nucleo');
  nucleo = lienzo ? new Nucleo(lienzo, {}) : null;
  aplicarAspecto();
}

// primer toque: desbloquear voz y audio (iPhone y Chrome lo piden)
document.addEventListener('pointerdown', () => { desbloquearVoz(); desbloquearAudio(); mantenerPantalla(); }, { once: true });

// ---------- barra superior ----------
function pintarBarra() {
  const e = eq();
  $('#chip-equipo').hidden = !e;
  if (!e) { $('#bateria').hidden = true; return; }
  $('#chip-nombre').textContent = e.nombre;
  $('#chip-codigo').textContent = e.codigo;
  const punto = $('#punto');
  punto.className = `punto-conexion ${estado.conexion === 'ok' ? 'ok' : estado.conexion === 'sin-conexion' ? 'mal' : ''}`;
  punto.title = { ok: 'Conectado', 'sin-conexion': 'Sin conexión: se guarda aquí y se manda después', 'sin-servidor': 'Sin servidor: todo se guarda en este aparato', conectando: 'Conectando…' }[estado.conexion] || '';
  const bat = $('#bateria');
  const mostrar = tieneHabilidad('chat') && typeof estado.energia === 'number' && hayServidor();
  bat.hidden = !mostrar;
  if (mostrar) bat.innerHTML = `${icono('bateria')} ${estado.energia}`;
}
$('#chip-equipo').addEventListener('click', () => abrirUnir());

// ---------- vistas ----------
function render(forzar = false) {
  pintarBarra();
  const nueva = !eq() ? 'inicio' : eq().encendido ? 'jarvis' : 'taller';
  if (nueva !== vista || forzar) {
    vista = nueva;
    cerrarCamara();
    if (vista === 'inicio') renderInicio();
    else if (vista === 'taller') renderTaller();
    else renderJarvis();
    montarNucleo();
  } else {
    actualizar();
  }
}

/** Refresca lo que puede cambiar sin rehacer la vista (para no perder lo que se está escribiendo). */
function actualizar() {
  aplicarAspecto();
  if (vista === 'taller' || vista === 'jarvis') {
    const nombre = $('#nombre-jarvis');
    if (nombre) nombre.textContent = eq().jarvis.nombre;
    const detalle = $('#detalle-jarvis');
    if (detalle) detalle.textContent = detalleJarvis();
    pintarModulos();
  }
  if (vista === 'jarvis') {
    pintarPestanas();
    pintarRecordatorio();
    const cont = $('#pestana');
    if (cont && !cont.contains(document.activeElement) && pestana !== 'camara' && pestana !== 'hablar') pintarPestana();
    if (pestana === 'hablar') { pintarBateriaChat(); }
  }
}

function detalleJarvis() {
  const partes = [];
  if (instalado('voz')) partes.push(`Voz: ${VOCES[eq().voz.id].nombre}`);
  if (instalado('personalidad')) partes.push(PERSONALIDADES[eq().personalidad.id].nombre);
  return partes.join(' · ') || 'Escaneen tarjetas para armarlo';
}

function renderInicio() {
  const pendiente = tarjetaPendiente && TARJETAS[tarjetaPendiente];
  app.innerHTML = `<section class="inicio"><div class="caja">
    <canvas id="nucleo"></canvas>
    <h1>PROTOCOLO <b>J.A.R.V.I.S.</b></h1>
    <p class="sub">Ultrón ya está en el sistema. Armen su propio asistente de inteligencia artificial con las tarjetas de su sobre.</p>
    ${pendiente ? `<p class="panel" style="margin:0">Escanearon la tarjeta <b>${esc(pendiente.nombre)}</b>. Primero creen su equipo o únanse a él.</p>` : ''}
    <div class="botones">
      <button class="btn btn-primario btn-grande" data-accion="crear">Crear equipo</button>
      <button class="btn btn-grande" data-accion="unirse">Unirme a mi equipo</button>
    </div>
    <p class="tenue" style="font-size:15px;max-width:380px">¿Su equipo ya existe en otra tablet? Toquen <b>Unirme</b> y escaneen el QR que aparece en ella.</p>
    <p class="tenue" style="font-size:13px">${hayServidor() ? '' : 'Modo sin servidor: todo se guarda en este aparato.'}</p>
  </div></section>`;
  app.querySelector('[data-accion="crear"]').addEventListener('click', abrirCrear);
  app.querySelector('[data-accion="unirse"]').addEventListener('click', () => abrirUnirse());
}

function htmlEscenario() {
  return `<div class="escenario ${vista === 'taller' ? 'panel' : ''}">
    <canvas id="nucleo"></canvas>
    <div class="nombre-jarvis" id="nombre-jarvis">${esc(eq().jarvis.nombre)}</div>
    <div class="detalle" id="detalle-jarvis">${esc(detalleJarvis())}</div>
    <div class="subtitulo" id="subtitulo" aria-live="polite"></div>
  </div>`;
}

function htmlModulos() {
  return `<div class="progreso"><div class="barra-p"><i id="barra-modulos"></i></div><b id="cuenta-modulos" class="mono"></b></div>
    <div class="modulos" id="modulos"></div>`;
}

function renderTaller() {
  app.innerHTML = `<section class="taller">
    <div>${htmlEscenario()}
      <div class="fila-botones" style="justify-content:center;margin-top:10px">
        <button class="btn btn-chico" data-accion="probar">${icono('altavoz')} Probar</button>
        <button class="btn btn-chico" data-accion="unir">${icono('qr')} Unir celulares</button>
      </div>
    </div>
    <div class="panel">
      <h2>Módulos de su JARVIS</h2>
      <p class="tenue" style="margin:0 0 10px">Escaneen las tarjetas de su sobre para instalar módulos. Toquen un módulo instalado para ajustarlo. ¡Pueden cambiar de opinión las veces que quieran!</p>
      ${htmlModulos()}
      <div class="acciones-taller">
        <div class="flotante"><button class="btn btn-primario btn-grande" style="width:100%" data-accion="escanear">${icono('qr')} Escanear tarjeta</button></div>
        <button class="btn-texto" data-accion="codigo">¿No funciona la cámara? Escribir el código de la tarjeta</button>
        <button class="btn btn-grande" data-accion="encender" id="btn-encender">⏻ Iniciar JARVIS</button>
        <p class="tenue centro" id="falta" style="margin:0"></p>
      </div>
    </div>
  </section>`;
  app.querySelector('[data-accion="probar"]').addEventListener('click', () => decir(frase('saludo'), { sonar: true }));
  app.querySelector('[data-accion="unir"]').addEventListener('click', abrirUnir);
  app.querySelector('[data-accion="escanear"]').addEventListener('click', abrirEscanerTarjetas);
  app.querySelector('[data-accion="codigo"]').addEventListener('click', abrirCodigoTarjeta);
  app.querySelector('[data-accion="encender"]').addEventListener('click', encender);
  pintarModulos();
}

function resumenModulo(id) {
  const e = eq();
  if (!instalado(id)) return 'Escaneen su tarjeta';
  switch (id) {
    case 'identidad': return `${e.jarvis.nombre}${e.jarvis.lema ? ` · “${e.jarvis.lema}”` : ''}`;
    case 'voz': return VOCES[e.voz.id].nombre;
    case 'nucleo': return `${NUCLEOS[e.nucleo.id].nombre} · ${(COLORES.find((c) => c.valor === e.nucleo.color) || { nombre: 'color' }).nombre}`;
    case 'ambiente': return AMBIENTES[e.ambiente.id].nombre;
    case 'personalidad': return PERSONALIDADES[e.personalidad.id].nombre;
    case 'memoria': {
      const n = (e.memoria.integrantes || []).filter(Boolean).length;
      return n ? `${n} integrante${n === 1 ? '' : 's'}` : 'Toquen para llenarla';
    }
    case 'escudo': return e.escudo.regla ? `${REGLAS_FIJAS.length} reglas + 1 del equipo` : `${REGLAS_FIJAS.length} reglas activas`;
    case 'habilidades': return `${Object.values(e.habilidades || {}).filter(Boolean).length} de 4`;
    default: return '';
  }
}

function pintarModulos() {
  const cont = $('#modulos');
  if (!cont || !eq()) return;
  cont.innerHTML = MODULOS.map((m) => `<button class="tile ${instalado(m.id) ? 'instalado' : 'bloqueado'}" style="--c:${m.color}" data-modulo="${m.id}">
      ${icono(m.id)}<span class="n">${m.nombre}</span><span class="e">${esc(resumenModulo(m.id))}</span>
      ${m.necesario ? '<span class="necesario">Necesario</span>' : ''}
    </button>`).join('');
  cont.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => abrirModulo(b.dataset.modulo)));
  const n = MODULOS.filter((m) => instalado(m.id)).length;
  $('#barra-modulos').style.width = `${(n / MODULOS.length) * 100}%`;
  $('#cuenta-modulos').textContent = `${n}/${MODULOS.length}`;
  const faltan = NECESARIOS.filter((m) => !instalado(m));
  const btn = $('#btn-encender');
  if (btn) {
    btn.disabled = faltan.length > 0;
    btn.classList.toggle('btn-primario', !faltan.length);
    $('#falta').textContent = faltan.length
      ? `Para encenderlo faltan: ${faltan.map((m) => MODULO[m].nombre).join(', ')}`
      : '¡Listo para encender! (Pueden seguir instalando módulos después)';
  }
}

// ---------- crear y unirse ----------
function abrirCrear() {
  const m = modal(`<h2>Crear equipo</h2>
    <p class="tenue">Solo una persona del equipo lo crea. Los demás se unen después con el código o el QR.</p>
    <form id="f-crear">
      <label class="campo"><span>Nombre del equipo</span><input type="text" id="f-nombre" maxlength="40" required autocomplete="off" placeholder="Ej. Los Bits"></label>
      <button class="btn btn-primario btn-grande" style="width:100%">Crear</button>
    </form>`);
  const input = m.el.querySelector('#f-nombre');
  setTimeout(() => input.focus(), 50);
  m.el.querySelector('#f-crear').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = input.value.trim();
    if (!nombre) return;
    if (!textoLimpio(nombre)) { aviso('Ese nombre no se puede usar. Escojan otro.', { mal: true }); return; }
    const boton = m.el.querySelector('button.btn-primario');
    boton.disabled = true;
    boton.textContent = 'Creando…';
    try {
      await estado.crear(nombre);
      m.cerrar();
      sonido('instalar');
      render(true);
      decir(`Equipo ${nombre} registrado. Escaneen la tarjeta de Identidad para darme un nombre.`);
      aplicarTarjetaPendiente();
    } catch (e) {
      boton.disabled = false;
      boton.textContent = 'Crear';
      aviso(e.message || 'No se pudo crear el equipo.', { mal: true });
    }
  });
}

function abrirUnirse(codigoInicial = '') {
  const m = modal(`<h2>Unirme a mi equipo</h2>
    <p class="tenue">En la tablet del equipo toquen el nombre del equipo (arriba a la derecha): ahí aparece el código y un QR.</p>
    <button class="btn btn-primario btn-grande" style="width:100%" data-escanear>${icono('qr')} Escanear QR del equipo</button>
    <form id="f-unirse" style="margin-top:14px">
      <label class="campo"><span>O escriban el código (4 letras)</span><input type="text" id="f-codigo" maxlength="4" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.3em;font-family:var(--mono);font-size:26px" value="${esc(codigoInicial)}"></label>
      <button class="btn btn-grande" style="width:100%">Unirme</button>
    </form>`);
  const unir = async (codigo) => {
    codigo = String(codigo || '').trim().toUpperCase();
    if (codigo.length !== 4) { aviso('El código tiene 4 letras o números.', { mal: true }); return; }
    if (!hayServidor()) { aviso('Sin servidor no se pueden unir aparatos.', { mal: true }); return; }
    try {
      await estado.unirse(codigo);
      m.cerrar();
      sonido('instalar');
      render(true);
      decir(frase('saludo'));
      aplicarTarjetaPendiente();
    } catch (e) {
      aviso(e.status === 404 ? 'No existe un equipo con ese código.' : e.status === 0 ? 'Sin conexión. Revisen el internet.' : e.message, { mal: true });
    }
  };
  m.el.querySelector('#f-unirse').addEventListener('submit', (ev) => { ev.preventDefault(); unir(m.el.querySelector('#f-codigo').value); });
  m.el.querySelector('[data-escanear]').addEventListener('click', () => {
    m.cerrar();
    escanear((texto) => {
      const r = leerQR(texto);
      if (r.tipo === 'unirse') { unir(r.codigo); return true; }
      aviso('Ese no es el QR de un equipo.', { mal: true });
      return false;
    }, 'Escaneen el QR que aparece en la tablet de su equipo.');
  });
  if (codigoInicial) unir(codigoInicial);
}

function abrirUnir() {
  const e = eq();
  if (!e) return;
  const url = new URL(location.href);
  url.search = `?unirse=${e.codigo}`;
  url.hash = '';
  const sinServidor = !hayServidor();
  const m = modal(`<h2>${esc(e.nombre)}</h2>
    ${sinServidor
    ? '<p>Este JARVIS funciona sin servidor: no se pueden unir otros aparatos. Pídanle al staff que configure el servidor.</p>'
    : `<p class="tenue">Para usar su JARVIS en sus celulares, escaneen este QR con la cámara del celular o escriban el código en <b>Unirme a mi equipo</b>.</p>
       <div class="centro" style="margin:12px 0"><div style="display:inline-block;padding:10px;background:#fff;border-radius:12px">${qrSVG(url.toString(), { tam: 220 })}</div></div>
       <p class="centro mono" style="font-size:44px;letter-spacing:.3em;margin:0;color:var(--acento)">${esc(e.codigo)}</p>`}
    <hr style="border:0;border-top:1px solid var(--borde);margin:18px 0">
    <p class="tenue" style="font-size:15px">Estado: ${esc({ ok: 'conectado', 'sin-conexion': 'sin conexión (se guarda aquí y se manda después)', 'sin-servidor': 'sin servidor', conectando: 'conectando…' }[estado.conexion] || '')}</p>
    <button class="btn-texto" data-salir>Salir del equipo en este aparato</button>`);
  m.el.querySelector('[data-salir]').addEventListener('click', async () => {
    const ok = await confirmar(sinServidor || !estado.registrado
      ? 'Este equipo solo está guardado en este aparato. Si salen, se pierde. ¿Salir de todos modos?'
      : `¿Salir del equipo en este aparato? El equipo no se borra: pueden volver con el código ${e.codigo}.`, { si: 'Salir', peligro: true });
    if (!ok) return;
    m.cerrar();
    callar();
    estado.salir();
    historial = [];
    render(true);
  });
}

// ---------- escáner ----------
/** Abre la cámara para leer QR. alLeer(texto) devuelve true para cerrar. */
function escanear(alLeer, instrucciones = 'Apunten la cámara al QR de la tarjeta.') {
  const m = modal(`<h2>Escanear</h2>
    <p class="tenue" style="margin-top:0">${esc(instrucciones)}</p>
    <div class="escaner"><video muted playsinline></video><div class="mira"></div><div class="linea"></div></div>
    <p class="tenue centro" id="estado-escaner" style="font-size:15px">Abriendo cámara…</p>
    <div class="fila-botones" style="justify-content:center"><button class="btn-texto" data-codigo>Escribir el código</button></div>`,
  { alCerrar: () => cerrarEscaner() });
  m.el.querySelector('[data-codigo]').addEventListener('click', () => { m.cerrar(); abrirCodigoTarjeta(); });
  abrirEscaner(m.el.querySelector('video'), (texto) => {
    sonido('escaneo');
    if (navigator.vibrate) navigator.vibrate(40);
    if (alLeer(texto)) m.cerrar();
  }).then(() => {
    const est = m.el.querySelector('#estado-escaner');
    if (est) est.textContent = 'Buscando un QR…';
  }).catch(() => {
    const est = m.el.querySelector('#estado-escaner');
    if (est) est.innerHTML = 'No se pudo abrir la cámara. Den permiso de cámara al navegador o <b>escriban el código</b> que viene en la esquina de la tarjeta.';
  });
}

function abrirEscanerTarjetas() {
  escanear((texto) => {
    const r = leerQR(texto);
    if (r.tipo === 'tarjeta') { usarTarjeta(r.codigo); return true; }
    if (r.tipo === 'unirse') { aviso('Ese es el QR para unir celulares, no una tarjeta.'); return false; }
    aviso('Ese QR no es una tarjeta de JARVIS.', { mal: true });
    return false;
  });
}

function abrirCodigoTarjeta() {
  const m = modal(`<h2>Código de la tarjeta</h2>
    <p class="tenue">Viene en la esquina de cada tarjeta, por ejemplo <b class="mono">V3</b> o <b class="mono">P1</b>.</p>
    <form><input type="text" maxlength="4" autocomplete="off" style="text-transform:uppercase;letter-spacing:.3em;font-family:var(--mono);font-size:26px">
    <button class="btn btn-primario btn-grande" style="width:100%;margin-top:12px">Instalar</button></form>`);
  const input = m.el.querySelector('input');
  setTimeout(() => input.focus(), 50);
  m.el.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const codigo = input.value.trim().toUpperCase();
    if (!TARJETAS[codigo]) { aviso('No existe una tarjeta con ese código.', { mal: true }); return; }
    m.cerrar();
    usarTarjeta(codigo);
  });
}

// ---------- tarjetas ----------
function usarTarjeta(codigo) {
  const t = TARJETAS[codigo];
  if (!t || !eq()) return;
  if (t.tipo === 'accion') { accion(t.accion); return; }
  if (t.tipo === 'especial') { ataqueUltron(); return; }
  const m = t.modulo;
  const yaEstaba = instalado(m);
  const parche = { instalados: { [m]: true } };
  let nuevoAqui = !yaEstaba;
  if (m === 'voz') parche.voz = { id: t.valor, tono: null, velocidad: null };
  if (m === 'nucleo') parche.nucleo = { id: t.valor };
  if (m === 'ambiente') parche.ambiente = { id: t.valor };
  if (m === 'personalidad') parche.personalidad = { id: t.valor };
  if (m === 'habilidades') {
    const h = HABILIDADES[t.valor];
    nuevoAqui = !tieneHabilidad(h.id);
    parche.habilidades = { [h.id]: true };
  }
  const igual = yaEstaba && ((m === 'voz' && eq().voz.id === t.valor) || (m === 'nucleo' && eq().nucleo.id === t.valor)
    || (m === 'ambiente' && eq().ambiente.id === t.valor) || (m === 'personalidad' && eq().personalidad.id === t.valor)
    || ['identidad', 'memoria', 'escudo'].includes(m));
  if (igual && m !== 'habilidades') { abrirModulo(m); return; }
  estado.cambiar(parche);
  sonido('instalar');
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  if (m === 'voz') decir(`Así sueno ahora. Soy ${eq().jarvis.nombre}. ¿Les gusta mi voz?`, { sonar: true });
  else if (m === 'personalidad') decir(frase('saludo'));
  else if (m === 'habilidades' && !nuevoAqui) aviso('Esa habilidad ya estaba instalada.');
  else decir(frase('listo'));
  if (nuevoAqui) abrirModulo(m, { nuevo: true, habilidad: m === 'habilidades' ? HABILIDADES[t.valor] : null });
  else aviso(`${MODULO[m].nombre}: ${t.nombre}`);
}

async function accion(tipo) {
  if (tipo === 'chiste') { await decir(alAzar(CHISTES)); return; }
  if (tipo === 'dato') { await decir(alAzar(DATOS)); return; }
  if (tipo === 'fiesta') {
    if (nucleo) nucleo.modo('fiesta');
    document.body.classList.add('glitch');
    fiesta(10);
    decir('¡Modo fiesta activado!');
    setTimeout(() => { if (nucleo) nucleo.modo(null); document.body.classList.remove('glitch'); }, 10000);
  }
}

async function ataqueUltron() {
  callar();
  const capa = document.createElement('div');
  capa.className = 'ultron';
  capa.innerHTML = '<div><h1>ULTRÓN</h1><p id="ultron-texto">Este JARVIS ahora me pertenece.</p></div>';
  document.body.appendChild(capa);
  sonido('ultron');
  if (nucleo) nucleo.modo('ultron');
  fondo.modo('ultron');
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  subtitulo('Ja, ja, ja. Soy Ultrón.');
  await hablar('Ja, ja, ja. Soy Ultrón. Este JARVIS ahora me pertenece.', { tono: 0.1, velocidad: 0.8 });
  await new Promise((r) => setTimeout(r, 900));
  capa.classList.add('calmo');
  const escudo = instalado('escudo');
  capa.querySelector('h1').textContent = escudo ? 'ESCUDO ACTIVADO' : 'REINICIANDO…';
  capa.querySelector('h1').style.color = 'var(--acento)';
  capa.querySelector('#ultron-texto').textContent = escudo ? 'Amenaza eliminada.' : 'El staff de CODEXIA eliminó la amenaza.';
  if (nucleo) nucleo.modo(null);
  fondo.modo(null);
  sonido('instalar');
  await decir(escudo ? 'Escudo activado. Amenaza eliminada.' : 'Reiniciando sistemas. Amenaza eliminada.');
  capa.remove();
  const yaTenia = eq().logros && eq().logros.ultron;
  estado.cambiar({ logros: { ultron: true } });
  const leccion = modal(`<div class="cabeza-modulo" style="--c:var(--rojo)">${icono('ultron')}<div><h2>¡Cayeron en la trampa!</h2></div></div>
    <p>Esa tarjeta prometía <b>“poder ilimitado”</b>… y era de Ultrón.</p>
    <div class="sabias" style="--c:var(--rojo)"><b>CIBERSEGURIDAD</b>En la vida real, un QR desconocido puede llevarte a una página falsa que roba contraseñas. Se llama <b>quishing</b> (phishing con QR). Antes de escanear, pregúntense: ¿de dónde viene este QR? ¿Promete algo demasiado bueno?</div>
    ${yaTenia ? '' : '<p class="centro"><span class="logro">🏅 Logro: Sobrevivieron a Ultrón</span></p>'}
    <button class="btn btn-primario" data-ok style="width:100%">Entendido</button>`, { color: '#ff1638' });
  leccion.el.querySelector('[data-ok]').addEventListener('click', leccion.cerrar);
}

// ---------- editores de módulos ----------
function cabezaModulo(m, nuevo, sabias) {
  return `<div class="cabeza-modulo">${icono(m.id)}<div><h2>${m.nombre}</h2><span class="tenue">${esc(m.resumen)}</span></div></div>
    ${nuevo ? `<p style="margin:0 0 6px;color:var(--verde);font-weight:700">✓ Módulo instalado</p>` : ''}
    <div class="sabias"><b>¿SABÍAS QUE…?</b>${esc(sabias || m.sabias)}</div>`;
}

function abrirModulo(id, { nuevo = false, habilidad = null } = {}) {
  const m = MODULO[id];
  if (!instalado(id)) {
    const md = modal(`${cabezaModulo(m, false)}
      <p>Busquen en su sobre la tarjeta de color <b style="color:${m.color}">${m.nombre}</b> y escanéenla.</p>
      <button class="btn btn-primario btn-grande" style="width:100%" data-esc>${icono('qr')} Escanear tarjeta</button>`, { color: m.color });
    md.el.querySelector('[data-esc]').addEventListener('click', () => { md.cerrar(); abrirEscanerTarjetas(); });
    return;
  }
  const editores = { identidad: editorIdentidad, voz: editorVoz, nucleo: editorNucleo, ambiente: editorAmbiente, personalidad: editorPersonalidad, memoria: editorMemoria, escudo: editorEscudo, habilidades: editorHabilidades };
  editores[id](m, nuevo, habilidad);
}

function guardarConFiltro(parche, m) {
  const malo = primerTextoSucio(parche);
  if (malo) { aviso('Hay un texto que no se puede usar. Cámbienlo, por favor.', { mal: true }); return false; }
  estado.cambiar(parche);
  sonido('instalar');
  if (m) m.cerrar();
  return true;
}

function chips(lista, destino) {
  return `<div class="chips" data-destino="${destino}">${lista.map((s) => `<button type="button" class="chip">${esc(s)}</button>`).join('')}</div>`;
}
function activarChips(raiz) {
  raiz.querySelectorAll('.chips[data-destino]').forEach((c) => c.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const input = raiz.querySelector(`#${c.dataset.destino}`);
    input.value = b.textContent;
    input.dispatchEvent(new Event('input'));
  }));
}

function editorIdentidad(m, nuevo) {
  const e = eq();
  const md = modal(`${cabezaModulo(m, nuevo)}
    <label class="campo"><span>Nombre de su JARVIS</span><input type="text" id="f-jnombre" maxlength="16" value="${esc(e.jarvis.nombre)}" autocomplete="off"></label>
    ${chips(SUGERENCIAS.nombres, 'f-jnombre')}
    <label class="campo"><span>Lema del equipo</span><input type="text" id="f-lema" maxlength="60" value="${esc(e.jarvis.lema)}" placeholder="Ej. Ningún bug nos detiene" autocomplete="off"></label>
    <p>Palabra de activación: <b id="f-activacion"></b></p>
    <div class="fila-botones"><button class="btn btn-primario" data-guardar>Guardar</button><button class="btn" data-probar>${icono('altavoz')} Probar</button></div>`, { color: m.color });
  const nombre = md.el.querySelector('#f-jnombre');
  const act = () => { md.el.querySelector('#f-activacion').textContent = `“Oye, ${nombre.value.trim() || 'JARVIS'}”`; };
  nombre.addEventListener('input', act);
  act();
  activarChips(md.el);
  const datos = () => ({ jarvis: { nombre: nombre.value.trim().toUpperCase().slice(0, 16) || 'JARVIS', lema: md.el.querySelector('#f-lema').value.trim() } });
  md.el.querySelector('[data-probar]').addEventListener('click', () => {
    const d = datos().jarvis;
    decir(rellenar('Hola, soy {jarvis}. {lema}', { jarvis: d.nombre, lema: d.lema }));
  });
  md.el.querySelector('[data-guardar]').addEventListener('click', () => {
    if (guardarConFiltro(datos(), md)) decir(rellenar('Me llamo {jarvis}. {lema}', vars()));
  });
}

function editorVoz(m, nuevo) {
  const e = eq();
  const base = VOCES[e.voz.id];
  const voces = vocesEspanol();
  const md = modal(`${cabezaModulo(m, nuevo)}
    <h3>${esc(base.nombre)}</h3><p class="tenue" style="margin-top:0">${esc(base.desc)} Escaneen otra tarjeta de voz para cambiar de estilo, o afínenla aquí:</p>
    <label class="campo"><span>Tono (grave ↔ agudo): <b id="v-tono-n"></b></span><input type="range" id="v-tono" min="0" max="2" step="0.05" value="${e.voz.tono ?? base.tono}"></label>
    <label class="campo"><span>Velocidad: <b id="v-vel-n"></b></span><input type="range" id="v-vel" min="0.5" max="1.8" step="0.05" value="${e.voz.velocidad ?? base.velocidad}"></label>
    ${voces.length > 1 ? `<label class="campo"><span>Voz del aparato</span><select id="v-voz"><option value="">Automática</option>${voces.map((v) => `<option ${v.name === e.voz.vozNombre ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : ''}
    <div class="sabias"><b>DENTRO DEL CÓDIGO</b><span class="mono">voz.tono = <span id="v-codigo-t"></span>; voz.velocidad = <span id="v-codigo-v"></span>;</span></div>
    <div class="fila-botones"><button class="btn btn-primario" data-guardar>Guardar</button><button class="btn" data-probar>${icono('altavoz')} Probar</button><button class="btn-texto" data-reset>Volver a la original</button></div>`, { color: m.color });
  const tono = md.el.querySelector('#v-tono');
  const vel = md.el.querySelector('#v-vel');
  const pintar = () => {
    md.el.querySelector('#v-tono-n').textContent = Number(tono.value).toFixed(2);
    md.el.querySelector('#v-vel-n').textContent = `${Number(vel.value).toFixed(2)}×`;
    md.el.querySelector('#v-codigo-t').textContent = Number(tono.value).toFixed(2);
    md.el.querySelector('#v-codigo-v').textContent = Number(vel.value).toFixed(2);
  };
  tono.addEventListener('input', pintar);
  vel.addEventListener('input', pintar);
  pintar();
  const ajustes = () => ({ tono: Number(tono.value), velocidad: Number(vel.value), voz: base.voz, vozNombre: md.el.querySelector('#v-voz')?.value || '' });
  md.el.querySelector('[data-probar]').addEventListener('click', () => { subtitulo('¿Qué tal sueno así?'); hablar(`¿Qué tal sueno así? Soy ${eq().jarvis.nombre}.`, ajustes()); });
  md.el.querySelector('[data-reset]').addEventListener('click', () => { tono.value = base.tono; vel.value = base.velocidad; pintar(); });
  md.el.querySelector('[data-guardar]').addEventListener('click', () => {
    const a = ajustes();
    if (guardarConFiltro({ voz: { tono: a.tono, velocidad: a.velocidad, vozNombre: a.vozNombre } }, md)) decir('Voz guardada.');
  });
}

function editorNucleo(m, nuevo) {
  const e = eq();
  let color = e.nucleo.color || '#3fd0ff';
  const md = modal(`${cabezaModulo(m, nuevo)}
    <h3>${esc(NUCLEOS[e.nucleo.id].nombre)}</h3><p class="tenue" style="margin-top:0">${esc(NUCLEOS[e.nucleo.id].desc)} Escaneen otra tarjeta de núcleo para cambiar la forma. Escojan el color:</p>
    <div class="centro"><canvas id="vista-nucleo" style="width:180px;height:180px"></canvas></div>
    <div class="chips" id="colores">${COLORES.map((c) => `<button type="button" class="chip ${c.valor === color ? 'activo' : ''}" data-color="${c.valor}"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.valor};vertical-align:-2px"></span> ${c.nombre}</button>`).join('')}</div>
    <div class="fila-botones" style="margin-top:14px"><button class="btn btn-primario" data-guardar>Guardar</button></div>`, { color: m.color, alCerrar: () => muestra.destruir() });
  const muestra = new Nucleo(md.el.querySelector('#vista-nucleo'), { forma: NUCLEOS[e.nucleo.id].forma, color });
  md.el.querySelector('#colores').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    md.el.querySelectorAll('#colores .chip').forEach((c) => c.classList.toggle('activo', c === b));
    muestra.poner({ color });
    sonido('clic');
  });
  md.el.querySelector('[data-guardar]').addEventListener('click', () => { if (guardarConFiltro({ nucleo: { color } }, md)) decir(frase('listo')); });
}

function editorAmbiente(m, nuevo) {
  const a = AMBIENTES[eq().ambiente.id];
  modal(`${cabezaModulo(m, nuevo)}
    <h3>${esc(a.nombre)}</h3><p>${esc(a.desc)}</p>
    <p class="tenue">Escaneen otra tarjeta de ambiente para cambiar el escenario.</p>`, { color: m.color });
}

function editorPersonalidad(m, nuevo) {
  const e = eq();
  const p = PERSONALIDADES[e.personalidad.id];
  const md = modal(`${cabezaModulo(m, nuevo)}
    <h3>${esc(p.nombre)}</h3><p class="tenue" style="margin-top:0">${esc(p.descripcion)} Ahora escriban su <b>directiva principal</b>: así va a pensar y hablar su JARVIS cuando le pregunten algo.</p>
    <label class="campo"><span>Hablas como…</span><input type="text" id="d-habla" maxlength="80" value="${esc(e.personalidad.habla)}" placeholder="${esc(p.habla)}" autocomplete="off"></label>
    ${chips([p.habla, ...SUGERENCIAS.habla], 'd-habla')}
    <label class="campo"><span>Te encanta…</span><input type="text" id="d-encanta" maxlength="80" value="${esc(e.personalidad.encanta)}" placeholder="los videojuegos" autocomplete="off"></label>
    ${chips(SUGERENCIAS.encanta, 'd-encanta')}
    <label class="campo"><span>Nunca…</span><input type="text" id="d-nunca" maxlength="80" value="${esc(e.personalidad.nunca)}" placeholder="se rinde" autocomplete="off"></label>
    ${chips(SUGERENCIAS.nunca, 'd-nunca')}
    <h3 style="margin-top:16px">Su directiva (prompt de sistema)</h3>
    <pre class="codigo" id="d-vista"></pre>
    <div class="fila-botones" style="margin-top:12px"><button class="btn btn-primario" data-guardar>Guardar directiva</button><button class="btn" data-probar>${icono('altavoz')} Escuchar</button></div>`, { color: m.color });
  activarChips(md.el);
  const val = (id) => md.el.querySelector(`#${id}`).value.trim();
  const pintar = () => {
    md.el.querySelector('#d-vista').textContent = `Eres ${e.jarvis.nombre}, el asistente del equipo "${e.nombre}".\nPersonalidad: ${p.nombre}.\nHablas como ${val('d-habla') || p.habla}.\nTe encanta ${val('d-encanta') || 'ayudar a tu equipo'}.\nNunca ${val('d-nunca') || 'te rindes'}.`;
  };
  md.el.querySelectorAll('input').forEach((i) => i.addEventListener('input', pintar));
  pintar();
  md.el.querySelector('[data-probar]').addEventListener('click', () => decir(rellenar(p.frases.presentacion, vars())));
  md.el.querySelector('[data-guardar]').addEventListener('click', () => {
    if (guardarConFiltro({ personalidad: { habla: val('d-habla'), encanta: val('d-encanta'), nunca: val('d-nunca') } }, md)) decir('Directiva principal guardada. Ya sé quién soy.');
  });
}

function editorMemoria(m, nuevo) {
  const e = eq();
  const integrantes = [...(e.memoria.integrantes || [])];
  while (integrantes.length < 6) integrantes.push('');
  const md = modal(`${cabezaModulo(m, nuevo)}
    <label class="campo"><span>Integrantes (solo nombres de pila)</span></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${integrantes.slice(0, 6).map((n, i) => `<input type="text" class="m-int" maxlength="20" value="${esc(n)}" placeholder="Integrante ${i + 1}" autocomplete="off">`).join('')}</div>
    <label class="campo"><span>Preparatoria</span><input type="text" id="m-prepa" maxlength="60" value="${esc(e.memoria.prepa)}" autocomplete="off"></label>
    <label class="campo"><span>Algo que JARVIS deba saber de ustedes</span><input type="text" id="m-dato" maxlength="120" value="${esc(e.memoria.dato)}" placeholder="Ej. Somos fans del béisbol" autocomplete="off"></label>
    <p class="tenue" style="font-size:15px">No escriban apellidos, teléfonos ni correos: JARVIS no los necesita.</p>
    <div class="fila-botones"><button class="btn btn-primario" data-guardar>Guardar</button></div>`, { color: m.color });
  md.el.querySelector('[data-guardar]').addEventListener('click', () => {
    const lista = $$('.m-int', md.el).map((i) => i.value.trim().split(/\s+/)[0]).filter(Boolean);
    const ok = guardarConFiltro({ memoria: { integrantes: lista, prepa: md.el.querySelector('#m-prepa').value.trim(), dato: md.el.querySelector('#m-dato').value.trim() } }, md);
    if (ok && lista.length) decir(`Memoria guardada. Hola, ${lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}` : lista[0]}.`);
  });
}

function editorEscudo(m, nuevo) {
  const e = eq();
  const md = modal(`${cabezaModulo(m, nuevo)}
    <h3>Reglas del staff (nadie las puede cambiar)</h3>
    <div class="lista">${REGLAS_FIJAS.map((r) => `<div class="item" style="grid-template-columns:auto 1fr;align-items:center">🔒 <span>${esc(r)}</span></div>`).join('')}</div>
    <label class="campo"><span>Regla del equipo (opcional)</span><input type="text" id="e-regla" maxlength="80" value="${esc(e.escudo.regla)}" placeholder="Ej. Nunca cuenta spoilers de películas" autocomplete="off"></label>
    <div class="fila-botones"><button class="btn btn-primario" data-guardar>Guardar</button></div>`, { color: m.color });
  md.el.querySelector('[data-guardar]').addEventListener('click', () => {
    if (guardarConFiltro({ escudo: { regla: md.el.querySelector('#e-regla').value.trim() } }, md)) decir('Escudo actualizado.');
  });
}

function editorHabilidades(m, nuevo, habilidad) {
  modal(`${cabezaModulo(m, nuevo && !habilidad, habilidad ? null : m.sabias)}
    ${habilidad ? `<div class="sabias" style="--c:var(--verde)"><b>NUEVA HABILIDAD: ${esc(habilidad.nombre.toUpperCase())}</b>${esc(habilidad.sabias)}</div>` : ''}
    <div class="lista">${Object.entries(HABILIDADES).map(([cod, h]) => `<div class="item"><div class="cabeza"><b>${icono(h.id)} ${esc(h.nombre)}</b><span class="etiqueta ${tieneHabilidad(h.id) ? 'ok' : ''}">${tieneHabilidad(h.id) ? 'Instalada' : `Tarjeta ${cod}`}</span></div><span class="tenue">${esc(h.desc)}</span></div>`).join('')}</div>
    ${eq().encendido ? '' : '<p class="tenue">Las habilidades se usan cuando su JARVIS esté encendido.</p>'}`, { color: m.color });
}

// ---------- encendido ----------
async function encender() {
  if (NECESARIOS.some((m) => !instalado(m))) return;
  callar();
  const e = eq();
  const capa = document.createElement('div');
  capa.className = 'arranque';
  capa.innerHTML = '<div class="terminal" id="terminal"></div>';
  document.body.appendChild(capa);
  sonido('arranque');
  // pedimos la presentación a la IA mientras corre la terminal
  let presentacion = null;
  if (hayServidor() && estado.global.ia && estado.registrado) {
    presentacion = Promise.race([
      llamar('POST', `/api/equipos/${e.codigo}/chat`, { tipo: 'presentacion' }).then((r) => r.texto).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 9000)),
    ]);
  }
  const lineas = [
    ['> PROTOCOLO J.A.R.V.I.S. · CODEXIA', ''],
    [`> Equipo .................... ${e.nombre.toUpperCase()}`, ''],
    [`> Identidad ................. ${e.jarvis.nombre}`, 'ok'],
    [`> Voz ....................... ${VOCES[e.voz.id].nombre}`, 'ok'],
    [`> Núcleo visual ............. ${NUCLEOS[e.nucleo.id].nombre}`, 'ok'],
    [`> Personalidad .............. ${PERSONALIDADES[e.personalidad.id].nombre}`, 'ok'],
    [`> Memoria ................... ${instalado('memoria') ? `${(e.memoria.integrantes || []).length} integrantes` : 'NO INSTALADA'}`, instalado('memoria') ? 'ok' : 'no'],
    [`> Escudo de seguridad ....... ${instalado('escudo') ? 'ACTIVO' : 'NO INSTALADO'}`, instalado('escudo') ? 'ok' : 'no'],
    [`> Habilidades ............... ${Object.values(e.habilidades || {}).filter(Boolean).length}/4`, ''],
    [`> Sala de control ........... ${estado.conexion === 'ok' ? 'CONECTADO' : 'SIN CONEXIÓN'}`, estado.conexion === 'ok' ? 'ok' : 'no'],
    ['> SISTEMA EN LÍNEA', 'ok'],
  ];
  const term = capa.querySelector('#terminal');
  for (const [texto, clase] of lineas) {
    const div = document.createElement('div');
    if (clase) div.className = clase;
    div.textContent = texto;
    term.appendChild(div);
    sonido('clic');
    await new Promise((r) => setTimeout(r, 330));
  }
  await new Promise((r) => setTimeout(r, 500));
  capa.innerHTML = `<div style="display:grid;justify-items:center;gap:10px"><canvas id="nucleo-arranque"></canvas><div class="grande">${esc(e.jarvis.nombre)}</div><div class="subtitulo" id="subtitulo-arranque" style="font-family:var(--cuerpo);color:var(--texto)"></div><button class="btn btn-primario" id="continuar" hidden>Continuar</button></div>`;
  const n = new Nucleo(capa.querySelector('#nucleo-arranque'), { forma: NUCLEOS[e.nucleo.id].forma, color: colorEquipo() });
  const quitar = alHablar((v) => n.hablando(v));
  sonido('enLinea');
  estado.cambiar({ encendido: Date.now() });
  const texto = (presentacion && (await presentacion)) || frase('presentacion');
  capa.querySelector('#subtitulo-arranque').textContent = texto;
  await new Promise((r) => setTimeout(r, 600));
  sonido((VOCES[e.voz.id] || VOCES.V1).sonido);
  const terminar = () => {
    quitar();
    n.destruir();
    capa.remove();
    callar();
    render(true);
    if (!historial.length) historial.push({ role: 'assistant', content: texto });
    subtitulo(texto);
  };
  const boton = capa.querySelector('#continuar');
  boton.hidden = false;
  boton.addEventListener('click', terminar);
  await hablar(texto, ajustesVoz());
  if (capa.isConnected) setTimeout(() => { if (capa.isConnected) terminar(); }, 1500);
}

// ---------- vista JARVIS ----------
const PESTANAS = [
  { id: 'hablar', nombre: 'Hablar', icono: 'chat', habilidad: null },
  { id: 'bitacora', nombre: 'Bitácora', icono: 'bitacora', habilidad: 'bitacora' },
  { id: 'puntos', nombre: 'Puntos', icono: 'puntos', habilidad: 'puntos' },
  { id: 'camara', nombre: 'Cámara', icono: 'camara', habilidad: 'camara' },
  { id: 'modulos', nombre: 'Módulos', icono: 'taller', habilidad: null },
  { id: 'ficha', nombre: 'Ficha', icono: 'ficha', habilidad: null },
];

function renderJarvis() {
  app.innerHTML = `<section class="jarvis">${htmlEscenario()}<div><div class="contenido-pestana" id="recordatorio" style="padding-bottom:0"></div><div class="contenido-pestana" id="pestana"></div></div></section>
    <nav class="pestanas" id="pestanas"></nav>`;
  pintarPestanas();
  pintarPestana();
  pintarRecordatorio();
}

function pintarPestanas() {
  const nav = $('#pestanas');
  if (!nav) return;
  nav.innerHTML = PESTANAS.map((p) => {
    const bloqueada = p.habilidad && !tieneHabilidad(p.habilidad);
    return `<button class="${p.id === pestana ? 'activa' : ''} ${bloqueada ? 'bloqueada' : ''}" data-p="${p.id}">${icono(p.icono)}<span>${p.nombre}</span></button>`;
  }).join('');
  nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (pestana === 'camara') cerrarCamara();
    pestana = b.dataset.p;
    pintarPestanas();
    pintarPestana();
  }));
}

function bloqueo(codigoTarjeta) {
  const h = HABILIDADES[codigoTarjeta];
  return `<div class="panel centro" style="margin-top:8px">
    <p style="font-size:20px;margin-top:0">🔒 <b>${esc(h.nombre)}</b> no está instalada.</p>
    <p class="tenue">Escaneen la tarjeta <b class="mono">${codigoTarjeta}</b> de su sobre para activarla.</p>
    <button class="btn btn-primario" data-esc>${icono('qr')} Escanear tarjeta</button></div>`;
}

function pintarPestana() {
  const cont = $('#pestana');
  if (!cont) return;
  const p = PESTANAS.find((x) => x.id === pestana);
  if (p.habilidad && !tieneHabilidad(p.habilidad)) {
    cont.innerHTML = bloqueo(HABILIDAD_POR_ID[p.habilidad].codigo);
    cont.querySelector('[data-esc]').addEventListener('click', abrirEscanerTarjetas);
    return;
  }
  ({ hablar: pestanaHablar, bitacora: pestanaBitacora, puntos: pestanaPuntos, camara: pestanaCamara, modulos: pestanaModulos, ficha: pestanaFicha })[pestana](cont);
}

// --- hablar ---
const PREGUNTAS = ['¿Qué es una dirección IP?', 'Dame una pista para el taller de Redes', '¿Qué estudia alguien de ITC?', '¿Cómo sé si una contraseña es segura?', '¿Qué es un algoritmo?'];

function pestanaHablar(cont) {
  const conChat = tieneHabilidad('chat');
  const est = estacionActual();
  const preguntas = est ? AYUDA_ESTACIONES[est].preguntas : PREGUNTAS;
  cont.innerHTML = `
    <div class="estaciones-fila"><span class="tenue" style="font-size:14px">¿Dónde están ahora?</span>
      <div class="chips" id="estaciones">
        <button class="chip ${est ? '' : 'activo'}" data-est="">General</button>
        ${ORDEN_ESTACIONES.map((id) => `<button class="chip ${est === id ? 'activo' : ''}" data-est="${id}">${esc(AYUDA_ESTACIONES[id].nombre)}</button>`).join('')}
      </div></div>
    <div id="ayuda"></div>
    ${conChat ? '' : `<div class="panel" style="margin-bottom:10px"><p style="margin:0">🔒 Para hacerle preguntas, escaneen la tarjeta <b class="mono">H4 · Chat con IA</b>. Mientras, pueden pedirle pistas, un chiste o un dato.</p></div>`}
    <div class="chips" id="rapidas">
      <button class="chip" data-r="saludo">👋 Saludo</button>
      <button class="chip" data-r="chiste">😂 Chiste</button>
      <button class="chip" data-r="dato">💡 Dato curioso</button>
      ${conChat ? preguntas.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('') : ''}
    </div>
    ${conChat ? `<form class="chat-entrada" id="f-chat">
      ${puedeEscuchar ? `<button type="button" class="btn-redondo" id="mic" aria-label="Hablar">${icono('mic')}</button>` : ''}
      <input type="text" id="pregunta" maxlength="300" placeholder="Pregúntale a ${esc(eq().jarvis.nombre)}…" autocomplete="off">
      <button class="btn-redondo" aria-label="Enviar">${icono('enviar')}</button>
    </form>
    <p class="tenue" id="bateria-chat" style="font-size:14px;margin:6px 0 0"></p>` : ''}
    <div class="historial" id="historial"></div>`;
  cont.querySelector('#estaciones').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-est]');
    if (!b) return;
    elegirEstacion(b.dataset.est);
    pintarPestana();
  });
  if (est) montarAyuda(cont.querySelector('#ayuda'), est);
  cont.querySelector('#rapidas').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    if (b.dataset.r === 'saludo') decir(frase('saludo'), { sonar: true });
    else if (b.dataset.r) accion(b.dataset.r);
    else if (b.dataset.q) preguntar(b.dataset.q);
  });
  if (conChat) {
    cont.querySelector('#f-chat').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = cont.querySelector('#pregunta');
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      preguntar(q);
    });
    const mic = cont.querySelector('#mic');
    if (mic) {
      mic.addEventListener('click', async () => {
        if (mic.classList.contains('escuchando')) { detenerEscucha(); return; }
        callar();
        mic.classList.add('escuchando');
        subtitulo('Escuchando…');
        const texto = await escuchar({ alParcial: (t) => subtitulo(`“${t}”`) });
        mic.classList.remove('escuchando');
        if (texto) preguntar(texto); else subtitulo('No te escuché bien. Intenta otra vez o escríbelo.');
      });
    }
    pintarBateriaChat();
  }
  pintarHistorial();
}

function pintarBateriaChat() {
  const el = $('#bateria-chat');
  if (!el) return;
  if (!hayServidor()) el.textContent = 'Sin servidor: el chat con IA no está disponible.';
  else if (!estado.global.ia) el.textContent = 'La IA todavía no está configurada por el staff.';
  else if (!estado.global.chatActivo) el.textContent = 'El staff pausó el chat por un momento.';
  else el.textContent = typeof estado.energia === 'number' ? `⚡ Batería: ${estado.energia} preguntas. JARVIS da pistas, no respuestas.` : '';
  pintarBarra();
}

function pintarHistorial() {
  const h = $('#historial');
  if (!h) return;
  h.innerHTML = historial.slice(-12).reverse().map((m) => `<div class="burbuja ${m.role === 'user' ? 'yo' : 'jarvis'}">${esc(m.content)}</div>`).join('');
}

async function preguntar(texto) {
  if (esperandoIA) return;
  if (!textoLimpio(texto)) { decir('Mejor preguntemos algo de la misión.'); return; }
  historial.push({ role: 'user', content: texto });
  pintarHistorial();
  const normal = texto.toLowerCase();
  const sinIA = !hayServidor() || !estado.global.ia || !estado.global.chatActivo;
  if (sinIA) {
    let r = frase('sinIA');
    if (/chiste/.test(normal)) r = alAzar(CHISTES);
    else if (/dato|curios/.test(normal)) r = alAzar(DATOS);
    else if (!estado.global.chatActivo && hayServidor()) r = 'El staff pausó el chat por un momento. Intenten en un ratito.';
    historial.push({ role: 'assistant', content: r });
    pintarHistorial();
    decir(r);
    return;
  }
  esperandoIA = true;
  subtitulo('Pensando…');
  if (nucleo) nucleo.hablando(true);
  try {
    const r = await llamar('POST', `/api/equipos/${eq().codigo}/chat`, { mensajes: historial.slice(-10), estacion: estacionActual() }, { timeout: 35000 });
    estado.energia = r.energia;
    historial.push({ role: 'assistant', content: r.texto });
    guardarHistorial();
    pintarHistorial();
    pintarBateriaChat();
    if (nucleo) nucleo.hablando(false);
    decir(r.texto);
  } catch (e) {
    if (nucleo) nucleo.hablando(false);
    historial.pop();
    pintarHistorial();
    if (typeof e.datos.energia === 'number') { estado.energia = e.datos.energia; pintarBateriaChat(); }
    const msg = e.status === 0 ? 'Sin conexión con el servidor. Revisen el internet.' : e.message;
    subtitulo(msg);
    aviso(msg, { mal: true, ms: 4000 });
  } finally {
    esperandoIA = false;
  }
}

function guardarHistorial() {
  try { sessionStorage.setItem(`jarvis-chat-${eq().codigo}`, JSON.stringify(historial.slice(-20))); } catch (e) { /* nada */ }
}
function cargarHistorial() {
  try { historial = JSON.parse(sessionStorage.getItem(`jarvis-chat-${eq().codigo}`) || '[]'); } catch (e) { historial = []; }
}

// --- bitácora ---
function pestanaBitacora(cont) {
  const b = eq().bitacora || {};
  cont.innerHTML = `<h2>Bitácora de la misión</h2>
    <p class="tenue" style="margin-top:0">Cada estación les da una pieza para el reto final contra Ultrón. Anótenla aquí: se guarda en todos los aparatos del equipo.</p>
    <div class="lista">${ESTACIONES.map((s) => `<div class="item">
      <div class="cabeza"><b>${esc(s.nombre)} · ${esc(s.reto)}</b><span class="etiqueta ${b[s.id] ? 'ok' : ''}">${esc(s.pieza)}</span></div>
      <input type="text" data-est="${s.id}" maxlength="120" value="${esc(b[s.id] || '')}" placeholder="Pieza: ${esc(s.pieza)}" autocomplete="off">
      <button class="btn-texto" data-ayuda="${s.id}" style="justify-self:start;min-height:32px">💡 Pistas de ${esc(s.nombre)}</button>
    </div>`).join('')}</div>
    <div class="fila-botones" style="margin-top:14px"><button class="btn" data-leer>${icono('altavoz')} Leer en voz alta</button></div>`;
  cont.querySelectorAll('input[data-est]').forEach((input) => input.addEventListener('change', () => {
    const v = input.value.trim();
    if (!textoLimpio(v)) { aviso('Ese texto no se puede usar.', { mal: true }); return; }
    estado.cambiar({ bitacora: { [input.dataset.est]: v } });
    sonido('instalar');
    aviso('Pieza guardada');
    input.closest('.item').querySelector('.etiqueta').classList.toggle('ok', Boolean(v));
  }));
  cont.querySelectorAll('[data-ayuda]').forEach((b) => b.addEventListener('click', () => abrirAyuda(b.dataset.ayuda)));
  cont.querySelector('[data-leer]').addEventListener('click', () => {
    const piezas = ESTACIONES.filter((s) => (eq().bitacora || {})[s.id]).map((s) => `${s.pieza}: ${eq().bitacora[s.id]}`);
    decir(piezas.length ? `Bitácora del equipo. ${piezas.join('. ')}.` : 'La bitácora está vacía. Vayan a las estaciones a conseguir piezas.');
  });
}

// --- puntos ---
function pestanaPuntos(cont) {
  const lista = [...(eq().puntos || [])].sort((a, b) => b.t - a.t);
  const total = lista.reduce((s, p) => s + (Number(p.puntos) || 0), 0);
  const nombreEst = (id) => (ESTACIONES_PUNTOS.find((s) => s.id === id) || { nombre: id }).nombre;
  cont.innerHTML = `<div class="cabeza" style="display:flex;justify-content:space-between;align-items:baseline"><h2>Puntos</h2><span class="total">${total}</span></div>
    <form class="panel" id="f-puntos" style="margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
        <label class="campo" style="margin:0"><span>Estación</span><select id="p-est">${ESTACIONES_PUNTOS.map((s) => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('')}</select></label>
        <label class="campo" style="margin:0"><span>Puntos</span><input type="number" id="p-pts" inputmode="numeric" min="0" max="100000" required></label>
      </div>
      <label class="campo"><span>Código del juego VR (opcional)</span><input type="text" id="p-cod" maxlength="9" placeholder="7KQ2-9XMB" autocomplete="off" style="text-transform:uppercase;font-family:var(--mono)"></label>
      <p class="tenue" id="p-info" style="font-size:15px;margin:0 0 8px"></p>
      <button class="btn btn-primario" style="width:100%">Registrar</button>
    </form>
    <div class="lista">${lista.length ? lista.map((p) => `<div class="item">
      <div class="cabeza"><b>${esc(nombreEst(p.estacion))}${p.nota ? ` · ${esc(p.nota)}` : ''}</b><span class="mono" style="font-size:22px;color:var(--acento)">${p.puntos}</span></div>
      <div class="cabeza"><span class="tenue">${hora(p.t)}${p.pendiente ? ' · sin enviar' : ''}</span>
        <span>${p.codigo ? `<span class="etiqueta ${p.valido ? 'ok' : (p.pendiente ? '' : 'mal')}">${p.valido ? '✓ código válido' : (p.pendiente ? 'código por revisar' : '✗ código no válido')}</span>` : ''}
        <button class="btn-texto" data-borrar="${p.id}" style="min-height:30px">Borrar</button></span></div>
    </div>`).join('') : '<p class="tenue">Todavía no hay puntos. Al terminar cada taller, regístrenlos aquí.</p>'}</div>`;
  const cod = cont.querySelector('#p-cod');
  const info = cont.querySelector('#p-info');
  cod.addEventListener('input', () => {
    const r = cod.value.trim() ? leerCodigoVR(cod.value, CONFIG.CLAVE_VR) : null;
    if (!r) { info.textContent = cod.value.trim() ? 'El código tiene 8 letras o números.' : ''; return; }
    if (r.valido) {
      info.innerHTML = `<span style="color:var(--verde)">✓ ${esc(r.nombreJuego)}: ${r.puntaje} puntos (${r.hora})</span>`;
      cont.querySelector('#p-pts').value = r.puntaje;
      cont.querySelector('#p-est').value = 'redes';
    } else info.innerHTML = '<span style="color:var(--rojo)">✗ Ese código no es válido. Revisen cada letra.</span>';
  });
  cont.querySelector('#f-puntos').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const puntos = Math.round(Number(cont.querySelector('#p-pts').value));
    if (!Number.isFinite(puntos)) return;
    const codigo = cod.value.trim().toUpperCase();
    const r = codigo ? leerCodigoVR(codigo, CONFIG.CLAVE_VR) : null;
    estado.agregarPuntos({ estacion: cont.querySelector('#p-est').value, puntos, codigo: r ? r.codigo : codigo, nota: r && r.valido ? `VR · ${r.nombreJuego}` : '', valido: Boolean(r && r.valido && r.puntaje === puntos) });
    sonido('instalar');
    decir(frase('animo'));
    pintarPestana();
  });
  cont.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar este registro de puntos?', { si: 'Borrar', peligro: true }))) return;
    await estado.borrarPuntos(b.dataset.borrar);
    pintarPestana();
  }));
}

// --- cámara ---
async function pestanaCamara(cont) {
  cont.innerHTML = `<h2>Cámara del equipo</h2>
    <p class="tenue" style="margin-top:0">Las fotos se quedan solo en este aparato.</p>
    <div id="zona-camara"><button class="btn btn-primario btn-grande" style="width:100%" data-abrir>${icono('camara')} Abrir cámara</button></div>
    <h3 style="margin-top:18px">Fotos</h3><div class="galeria" id="galeria"></div>`;
  cont.querySelector('[data-abrir]').addEventListener('click', () => abrirZonaCamara(cont));
  pintarGaleria();
}

async function abrirZonaCamara(cont) {
  const zona = cont.querySelector('#zona-camara');
  zona.innerHTML = `<div class="visor-camara"><video muted playsinline></video><div class="marco"><span>${esc(eq().nombre)} · ${esc(eq().jarvis.nombre)}</span></div></div>
    <label class="campo"><span>¿Dónde están?</span><select id="c-lugar"><option>JARVIS</option>${ESTACIONES.map((s) => `<option>${esc(s.nombre)}</option>`).join('')}<option>Reto final</option></select></label>
    <div class="fila-botones"><button class="btn btn-primario btn-grande" data-foto style="flex:1">${icono('camara')} Tomar foto</button><button class="btn" data-voltear>Voltear</button><button class="btn" data-cerrar>Cerrar</button></div>`;
  const video = zona.querySelector('video');
  try {
    await abrirCamara(video, {});
  } catch (e) {
    zona.innerHTML = '<p class="panel">No se pudo abrir la cámara. Den permiso de cámara al navegador.</p>';
    return;
  }
  zona.querySelector('[data-voltear]').addEventListener('click', () => abrirCamara(video, { usarFrente: !camaraDeFrente() }).catch(() => {}));
  zona.querySelector('[data-cerrar]').addEventListener('click', () => { cerrarCamara(); pestanaCamara(cont); });
  zona.querySelector('[data-foto]').addEventListener('click', async () => {
    sonido('foto');
    const lugar = zona.querySelector('#c-lugar').value;
    const blob = await capturar(video, { titulo: `${eq().nombre}`, subtitulo: `${eq().jarvis.nombre} · ${lugar} · ${new Date().toLocaleDateString('es-MX')}`, color: colorEquipo() });
    if (!blob) return;
    await guardarFoto(blob, { equipo: eq().codigo, lugar });
    aviso('📸 Foto guardada');
    pintarGaleria();
  });
}

async function pintarGaleria() {
  const g = $('#galeria');
  if (!g) return;
  const fotos = await listarFotos(eq().codigo);
  g.querySelectorAll('img').forEach((i) => URL.revokeObjectURL(i.src));
  g.innerHTML = fotos.length ? '' : '<p class="tenue">Todavía no hay fotos.</p>';
  fotos.forEach((f) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f.blob);
    img.alt = `Foto en ${f.lugar}`;
    img.addEventListener('click', () => verFoto(f));
    g.appendChild(img);
  });
}

function verFoto(f) {
  const url = URL.createObjectURL(f.blob);
  const m = modal(`<img src="${url}" style="width:100%;border-radius:12px" alt="">
    <p class="tenue">${esc(f.lugar)} · ${hora(f.t)}</p>
    <div class="fila-botones"><a class="btn btn-primario" href="${url}" download="jarvis-${eq().codigo}-${f.id}.jpg">Descargar</a><button class="btn btn-rojo" data-borrar>Borrar</button></div>`,
  { alCerrar: () => URL.revokeObjectURL(url) });
  m.el.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar esta foto?', { si: 'Borrar', peligro: true }))) return;
    await borrarFoto(f.id);
    m.cerrar();
    pintarGaleria();
  });
}

// --- módulos ---
function pestanaModulos(cont) {
  cont.innerHTML = `<h2>Módulos</h2>
    <p class="tenue" style="margin-top:0">Escaneen cualquier tarjeta para cambiar a su JARVIS.</p>
    ${htmlModulos()}
    <div class="fila-botones" style="margin-top:12px"><button class="btn btn-primario" data-esc>${icono('qr')} Escanear tarjeta</button><button class="btn-texto" data-cod>Escribir código</button></div>`;
  cont.querySelector('[data-esc]').addEventListener('click', abrirEscanerTarjetas);
  cont.querySelector('[data-cod]').addEventListener('click', abrirCodigoTarjeta);
  pintarModulos();
}

// --- ficha ---
function pestanaFicha(cont) {
  const e = eq();
  const v = ajustesVoz();
  const s = (t) => `<span class="s">"${esc(t)}"</span>`;
  const n = (t) => `<span class="n">${esc(t)}</span>`;
  const habs = Object.entries(e.habilidades || {}).filter(([, x]) => x).map(([k]) => s(k)).join(', ');
  const p = PERSONALIDADES[e.personalidad.id];
  const encendidoEn = e.encendido ? hora(e.encendido) : '--:--';
  cont.innerHTML = `<h2>Ficha técnica</h2>
    <p class="tenue" style="margin-top:0">Esto es lo que programaron hoy. Así se ve su JARVIS por dentro:</p>
    <pre class="codigo"><span class="c">// jarvis.config.js · equipo ${esc(e.codigo)}</span>
<span class="k">const</span> <span class="p">jarvis</span> = {
  nombre: ${s(e.jarvis.nombre)},
  equipo: ${s(e.nombre)},
  activacion: ${s(`Oye, ${e.jarvis.nombre}`)},
  voz: { estilo: ${s(VOCES[e.voz.id].nombre)}, tono: ${n(v.tono.toFixed(2))}, velocidad: ${n(v.velocidad.toFixed(2))} },
  nucleo: { forma: ${s(NUCLEOS[e.nucleo.id].forma)}, color: ${s(colorEquipo())} },
  ambiente: ${instalado('ambiente') ? s(AMBIENTES[e.ambiente.id].tipo) : '<span class="k">null</span>'},
  personalidad: ${s(p.nombre)},
  escudo: ${instalado('escudo') ? '<span class="k">true</span>' : '<span class="k">false</span>'},
  habilidades: [${habs}],
  encendido: ${s(encendidoEn)},
};</pre>
    <h3 style="margin-top:16px">Directiva principal (prompt de sistema)</h3>
    <pre class="codigo">Eres ${esc(e.jarvis.nombre)}, el asistente del equipo "${esc(e.nombre)}".
Reglas del staff: ${esc(REGLAS_FIJAS.join(' '))}${e.escudo.regla ? `\nRegla del equipo: ${esc(e.escudo.regla)}` : ''}
Personalidad: ${esc(p.nombre)}. Hablas como ${esc(e.personalidad.habla || p.habla)}.
Te encanta ${esc(e.personalidad.encanta || 'ayudar a tu equipo')}. Nunca ${esc(e.personalidad.nunca || 'te rindes')}.</pre>
    <h3 style="margin-top:16px">Logros</h3>
    <div class="logros">
      <span class="logro">⏻ Encendido a las ${encendidoEn}</span>
      <span class="logro ${MODULOS.every((m) => instalado(m.id)) ? '' : 'no'}">🧩 Los 8 módulos</span>
      <span class="logro ${Object.values(e.habilidades || {}).filter(Boolean).length === 4 ? '' : 'no'}">⚡ Las 4 habilidades</span>
      <span class="logro ${e.logros && e.logros.ultron ? '' : 'no'}">🛡️ Sobrevivieron a Ultrón</span>
      <span class="logro ${ESTACIONES.every((x) => (e.bitacora || {})[x.id]) ? '' : 'no'}">🗺️ Las 4 piezas</span>
    </div>
    <div class="fila-botones" style="margin-top:18px"><button class="btn" data-unir>${icono('qr')} Unir celulares</button><button class="btn-texto" data-reencender>Ver otra vez el encendido</button></div>`;
  cont.querySelector('[data-unir]').addEventListener('click', abrirUnir);
  cont.querySelector('[data-reencender]').addEventListener('click', encender);
}

// ---------- estaciones: ayuda y recordatorios ----------
// JARVIS ayuda en los otros talleres, pero nada depende de él: si nadie lo abre, los talleres siguen igual.
const params0 = new URLSearchParams(location.search);
const HORA_PRUEBA = params0.get('hora') || '';
const MODO_RECORDATORIOS = params0.get('recordatorios') || CONFIG.RECORDATORIOS || 'evento';
const sonados = new Set();

function estacionActual() {
  const e = eq() && eq().estacion;
  return e && AYUDA_ESTACIONES[e.id] ? e.id : '';
}

function elegirEstacion(id, { hablarAhora = true } = {}) {
  if (!eq()) return;
  const r = rondaActual();
  estado.cambiar({ estacion: id ? { id, ronda: r ? r.id : null, t: Date.now() } : null });
  if (hablarAhora && id) decir(`${AYUDA_ESTACIONES[id].nombre}. Si se atoran, pídanme una pista.`);
}

function leerPistas() { try { return JSON.parse(sessionStorage.getItem('jarvis-pistas') || '{}'); } catch (e) { return {}; } }
function guardarPistas(p) { try { sessionStorage.setItem('jarvis-pistas', JSON.stringify(p)); } catch (e) { /* nada */ } }

/** Ayuda de una estación: resumen, enlace al taller, pistas en orden y conceptos. Funciona sin internet. */
function montarAyuda(cont, id) {
  const a = AYUDA_ESTACIONES[id];
  let nivel = a.niveles ? Number(leerPistas()[`${id}:nivel`] ?? -1) : -1;
  const pintarAyuda = () => {
    cont.innerHTML = `<div class="panel ayuda-estacion">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b class="titulo" style="font-size:14px">📍 ${esc(a.nombre)} · ${esc(a.reto)}</b>${a.url ? `<a class="btn btn-chico" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir taller ↗</a>` : ''}</div>
      <p class="tenue" style="margin:6px 0">${esc(a.resumen)}</p>
      ${a.niveles ? `<span class="tenue" style="font-size:14px">¿En qué reto van?</span><div class="chips" data-niveles>${a.niveles.map((n, i) => `<button class="chip ${i === nivel ? 'activo' : ''}" data-n="${i}">${esc(n.t)}</button>`).join('')}</div>` : ''}
      <div class="fila-botones" style="margin-top:10px"><button class="btn btn-primario" data-pista>💡 Dame una pista</button><span class="tenue" data-cuenta style="font-size:14px"></span></div>
      <div class="sabias" data-texto hidden></div>
      <span class="tenue" style="font-size:14px;display:block;margin-top:8px">Conceptos del taller:</span>
      <div class="chips" data-conceptos>${a.conceptos.map((c, i) => `<button class="chip" data-c="${i}">${esc(c.t)}</button>`).join('')}</div>
    </div>`;
    const caja = cont.querySelector('[data-texto]');
    const mostrar = (titulo, texto) => { caja.hidden = false; caja.innerHTML = `<b>${esc(titulo)}</b>${esc(texto)}`; decir(texto); };
    const lista = () => (a.niveles ? (nivel >= 0 ? a.niveles[nivel].pistas : null) : a.pistas);
    const clave = () => `${id}:${a.niveles ? nivel : 'g'}`;
    const cuenta = () => {
      const l = lista();
      cont.querySelector('[data-cuenta]').textContent = l ? `${Math.min(leerPistas()[clave()] || 0, l.length)} de ${l.length} pistas usadas` : 'Primero toquen el reto en el que van';
    };
    cuenta();
    cont.querySelector('[data-niveles]')?.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-n]');
      if (!b) return;
      nivel = Number(b.dataset.n);
      const p = leerPistas();
      p[`${id}:nivel`] = nivel;
      guardarPistas(p);
      pintarAyuda();
    });
    cont.querySelector('[data-pista]').addEventListener('click', () => {
      const l = lista();
      if (!l) { mostrar('PRIMERO', 'Toquen el reto en el que van y les doy una pista de ese.'); return; }
      const p = leerPistas();
      const i = p[clave()] || 0;
      if (i >= l.length) {
        mostrar('YA NO HAY MÁS PISTAS', tieneHabilidad('chat') ? 'Ya les di todas las pistas de esto. Pregúntenme con sus propias palabras qué es lo que no les sale.' : 'Ya les di todas las pistas de esto. Pídanle ayuda al facilitador del taller.');
        p[clave()] = 0;
      } else {
        mostrar(`PISTA ${i + 1} DE ${l.length}`, l[i]);
        p[clave()] = i + 1;
        sonido('escaneo');
      }
      guardarPistas(p);
      cuenta();
    });
    cont.querySelector('[data-conceptos]').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-c]');
      if (!b) return;
      const c = a.conceptos[Number(b.dataset.c)];
      mostrar(c.t.toUpperCase(), c.d);
    });
  };
  pintarAyuda();
}

/** La ayuda de una estación en un modal (desde el cartel QR, la bitácora o sin equipo en este aparato). */
function abrirAyuda(id) {
  const sinEquipo = !eq();
  const m = modal(`<div id="ayuda-modal" style="margin-top:36px"></div>
    ${sinEquipo ? `<p class="tenue">Para que JARVIS conteste sus preguntas con IA, únanse a su equipo.</p>
      <div class="fila-botones"><button class="btn btn-primario" data-unirse>Unirme a mi equipo</button><button class="btn-texto" data-crear>Crear equipo</button></div>` : ''}
    ${!sinEquipo && !eq().encendido ? '<p class="tenue">Cuando enciendan su JARVIS, esta ayuda también aparece en la pestaña Hablar.</p>' : ''}`);
  montarAyuda(m.el.querySelector('#ayuda-modal'), id);
  m.el.querySelector('[data-unirse]')?.addEventListener('click', () => { m.cerrar(); abrirUnirse(); });
  m.el.querySelector('[data-crear]')?.addEventListener('click', () => { m.cerrar(); abrirCrear(); });
}

function aMinutos(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** La ronda de talleres que va ahora (según CONFIG.RONDAS), o null. */
function rondaActual() {
  if (MODO_RECORDATORIOS === 'nunca' || !Array.isArray(CONFIG.RONDAS)) return null;
  const ahora = new Date();
  if (MODO_RECORDATORIOS === 'evento' && !HORA_PRUEBA) {
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    if (hoy !== CONFIG.FECHA_EVENTO) return null;
  }
  const t = HORA_PRUEBA ? aMinutos(HORA_PRUEBA) : ahora.getHours() * 60 + ahora.getMinutes();
  const r = CONFIG.RONDAS.find((x) => aMinutos(x.inicio) <= t && t < aMinutos(x.fin));
  return r ? { ...r, restante: aMinutos(r.fin) - t } : null;
}

function descartado(clave) { try { return sessionStorage.getItem(`jarvis-x-${clave}`) === '1'; } catch (e) { return false; } }
function descartar(clave) { try { sessionStorage.setItem(`jarvis-x-${clave}`, '1'); } catch (e) { /* nada */ } }

/** Recordatorio suave arriba de las pestañas: al empezar una ronda y en sus últimos minutos. */
function pintarRecordatorio() {
  const cont = $('#recordatorio');
  if (!cont) return;
  const r = eq() && eq().encendido ? rondaActual() : null;
  const est = eq() && eq().estacion;
  let html = '';
  if (r && (!est || est.ronda !== r.id) && !descartado(`est-${r.id}`)) {
    html = `<div class="panel recordatorio">🕑 <b>${esc(r.nombre)}</b> (${esc(r.inicio)}–${esc(r.fin)}) · ¿En qué estación están?
      <div class="chips" style="margin-top:6px">${ORDEN_ESTACIONES.map((id) => `<button class="chip" data-r-est="${id}">${esc(AYUDA_ESTACIONES[id].nombre)}</button>`).join('')}</div>
      <button class="cerrar-r" data-x="est-${r.id}" aria-label="Cerrar">×</button></div>`;
  } else if (r && est && est.ronda === r.id && AYUDA_ESTACIONES[est.id] && r.restante <= 6 && !descartado(`fin-${r.id}`)) {
    if (!sonados.has(r.id)) { sonados.add(r.id); sonido('anuncio'); }
    html = `<div class="panel recordatorio">⏳ Quedan ${r.restante} min de la ${esc(r.nombre.toLowerCase())}. ¿Ya anotaron la pieza y los puntos de <b>${esc(AYUDA_ESTACIONES[est.id].nombre)}</b>?
      <div class="fila-botones" style="margin-top:6px"><button class="btn btn-chico" data-ir="bitacora">Bitácora</button><button class="btn btn-chico" data-ir="puntos">Puntos</button></div>
      <button class="cerrar-r" data-x="fin-${r.id}" aria-label="Cerrar">×</button></div>`;
  }
  if (cont.dataset.html === html) return;
  cont.dataset.html = html;
  cont.innerHTML = html;
  cont.querySelectorAll('[data-r-est]').forEach((b) => b.addEventListener('click', () => {
    elegirEstacion(b.dataset.rEst);
    pestana = 'hablar';
    pintarPestanas();
    pintarPestana();
    pintarRecordatorio();
  }));
  cont.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.ir; pintarPestanas(); pintarPestana(); }));
  cont.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { descartar(b.dataset.x); pintarRecordatorio(); }));
}
setInterval(pintarRecordatorio, 20000);

// ---------- anuncios del staff ----------
function mostrarAnuncio(a) {
  const ultron = a.tipo === 'ultron';
  const capa = document.createElement('div');
  capa.className = `anuncio ${ultron ? 'ultron-anuncio' : ''}`;
  capa.innerHTML = `<div class="caja"><div class="tipo">${ultron ? '⚠ TRANSMISIÓN DE ULTRÓN' : 'MENSAJE DEL STAFF'}</div><div class="texto">${esc(a.texto)}</div><button class="btn ${ultron ? 'btn-rojo' : 'btn-primario'}">Entendido</button></div>`;
  document.body.appendChild(capa);
  const cerrar = () => { capa.remove(); if (nucleo) nucleo.modo(null); fondo.modo(null); };
  capa.querySelector('button').addEventListener('click', () => { callar(); cerrar(); });
  sonido(ultron ? 'ultron' : 'anuncio');
  if (ultron) { if (nucleo) nucleo.modo('ultron'); fondo.modo('ultron'); }
  setTimeout(() => {
    hablar(a.texto, ultron ? { tono: 0.1, velocidad: 0.85 } : ajustesVoz()).then(() => setTimeout(() => { if (capa.isConnected) cerrar(); }, 6000));
  }, 700);
}

// ---------- arranque de la página ----------
const params = new URLSearchParams(location.search);
let tarjetaPendiente = (params.get('t') || '').toUpperCase();
const unirsePendiente = (params.get('unirse') || '').toUpperCase();
const estacionPendiente = AYUDA_ESTACIONES[params.get('estacion')] ? params.get('estacion') : '';
if (tarjetaPendiente || unirsePendiente || estacionPendiente) {
  const limpia = new URL(location.href);
  limpia.searchParams.delete('t');
  limpia.searchParams.delete('unirse');
  limpia.searchParams.delete('estacion');
  history.replaceState(null, '', limpia.toString());
}
if (!TARJETAS[tarjetaPendiente]) tarjetaPendiente = '';

function aplicarTarjetaPendiente() {
  if (!tarjetaPendiente || !eq()) return;
  const codigo = tarjetaPendiente;
  tarjetaPendiente = '';
  const t = TARJETAS[codigo];
  // el navegador solo deja hablar después de un toque: pedimos confirmación
  const m = modal(`<div class="cabeza-modulo" style="--c:${colorTarjeta(codigo)}">${icono(t.tipo === 'modulo' ? t.modulo : t.tipo === 'accion' ? 'accion' : 'ultron')}<div><h2>${esc(t.nombre)}</h2><span class="tenue">Tarjeta ${codigo}</span></div></div>
    <p>${esc(t.desc)}</p><button class="btn btn-primario btn-grande" style="width:100%">${t.tipo === 'accion' ? 'Activar' : 'Instalar'}</button>`, { color: colorTarjeta(codigo) });
  m.el.querySelector('.btn-primario').addEventListener('click', () => { m.cerrar(); usarTarjeta(codigo); });
}

estado.on('cambio', () => render());
estado.on('conexion', () => { pintarBarra(); if (pestana === 'hablar') pintarBateriaChat(); });
estado.on('energia', () => { pintarBarra(); pintarBateriaChat(); });
estado.on('global', () => { if (pestana === 'hablar') pintarBateriaChat(); });
estado.on('anuncio', (a) => mostrarAnuncio(a));
estado.on('rechazo', (msg) => aviso(msg, { mal: true, ms: 4000 }));
estado.on('borrado', () => {
  aviso('El staff reinició este equipo. Creen uno nuevo o únanse con otro código.', { mal: true, ms: 6000 });
  estado.salir();
  render(true);
});

estado.cargar();
if (eq()) cargarHistorial();
render(true);
estado.vigilar(6000);
estado.sincronizar();

if (unirsePendiente) {
  if (eq() && eq().codigo === unirsePendiente) aviso('Este aparato ya está en ese equipo.');
  else if (eq()) {
    confirmar(`Este aparato está en el equipo ${eq().nombre}. ¿Cambiarse al equipo ${unirsePendiente}?`, { si: 'Cambiarme' })
      .then((si) => { if (si) abrirUnirse(unirsePendiente); });
  } else abrirUnirse(unirsePendiente);
} else if (tarjetaPendiente && eq()) {
  aplicarTarjetaPendiente();
} else if (estacionPendiente) {
  // cartel "¿Atorados?" de una estación
  if (eq() && eq().encendido) {
    elegirEstacion(estacionPendiente, { hablarAhora: false });
    pestana = 'hablar';
    render(true);
    subtitulo(`Están en ${AYUDA_ESTACIONES[estacionPendiente].nombre}. Toquen “Dame una pista” si se atoran.`);
  } else {
    if (eq()) elegirEstacion(estacionPendiente, { hablarAhora: false });
    abrirAyuda(estacionPendiente);
  }
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
