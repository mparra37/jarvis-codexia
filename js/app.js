/* JARVIS · la app de cada equipo
 *
 * Vistas: inicio (crear su JARVIS) → taller (escanear tarjetas e instalar módulos) → JARVIS encendido
 * (hablar, bitácora, puntos, cámara, módulos, ficha). Cada tablet tiene su propio JARVIS (estado.js).
 * Dos cerebros: el básico (respuestas pre-escritas, cerebro.js) siempre funciona; el Cerebro IA
 * (tarjeta H4) pregunta al Worker y, si falla, contesta el básico.
 */
import {
  MODULOS, MODULO, VOCES, NUCLEOS, AMBIENTES, COLORES, HABILIDADES, HABILIDAD_POR_ID, TARJETAS, PERSONALIDADES,
  SUGERENCIAS, ESTACIONES, ESTACIONES_PUNTOS, CHISTES, DATOS, icono, leerQR, alAzar, colorTarjeta,
} from './datos.js';
import { REGLAS_FIJAS, rellenar } from './personalidades.js';
import { estado, dispositivo } from './estado.js';
import { responder } from './cerebro.js';
import { MISIONES, misionesVisibles, cumplida, siguiente } from './misiones.js';
import { verGuia, menuGuias } from './guias.js';
import { llamar, hayServidor } from './api.js';
import { CONFIG } from './config.js';
import { $, $$, esc, modal, confirmar, aviso, hora, qrSVG, mantenerPantalla, botonPantallaCompleta } from './ui.js';
import { Nucleo } from './nucleo.js';
import { Ambiente } from './ambiente.js';
import { hablar, callar, alHablar, desbloquearVoz, vocesEspanol, escuchar, detenerEscucha, puedeEscuchar, listasVoces, vozElegida } from './voz.js';
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
let restantesIA = null; // preguntas de IA que le quedan hoy a esta tablet (lo dice el Worker)
let iaFallaHasta = 0;    // si la IA falló, se usa el cerebro básico un rato sin volver a intentar
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

// ---------- cerebros ----------
/** ¿Este JARVIS tiene el Cerebro IA (tarjeta H4) y hay servidor configurado? */
function cerebroIA() { return tieneHabilidad('chat') && CONFIG.IA !== 'basico' && hayServidor(); }
function usarIA() { return cerebroIA() && Date.now() > iaFallaHasta && restantesIA !== 0; }

/** Lo que el Worker necesita para armar el prompt (se manda con cada pregunta: no hay registro). */
function datosParaIA() {
  const e = eq();
  return {
    nombre: e.nombre,
    jarvis: e.jarvis,
    personalidad: instalado('personalidad') ? e.personalidad : {},
    memoria: instalado('memoria') ? e.memoria : {},
    escudo: e.escudo || {},
    bitacora: e.bitacora || {},
  };
}

// ---------- barra superior ----------
function pintarBarra() {
  const e = eq();
  $('#chip-equipo').hidden = !e;
  if (!e) { $('#bateria').hidden = true; return; }
  $('#chip-nombre').textContent = e.nombre;
  const ia = cerebroIA();
  $('#chip-codigo').textContent = ia ? 'IA' : '';
  const punto = $('#punto');
  punto.className = `punto-conexion ${ia ? (Date.now() > iaFallaHasta ? 'ok' : 'mal') : ''}`;
  punto.title = ia ? 'Cerebro IA (con el básico de respaldo)' : 'Cerebro básico';
  const bat = $('#bateria');
  const mostrar = ia && typeof restantesIA === 'number';
  bat.hidden = !mostrar;
  if (mostrar) bat.innerHTML = `${icono('bateria')} ${restantesIA}`;
}
$('#chip-equipo').addEventListener('click', () => abrirEquipo());
$('#btn-ayuda').addEventListener('click', () => menuGuias({ decir }));
botonPantallaCompleta($('#btn-pantalla'));
function guia(id) { callar(); verGuia(id, { decir }); }

// ---------- vistas ----------
function render(forzar = false) {
  revisarMisiones();
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
  if (vista === 'taller') pintarTaller();
  if (vista === 'jarvis') {
    pintarPestanas();
    pintarRecordatorio();
    const cont = $('#pestana');
    if (cont && !cont.contains(document.activeElement) && pestana !== 'camara' && pestana !== 'hablar') pintarPestana();
    if (pestana === 'hablar') pintarCerebro();
  }
}

// ---------- misiones ----------
const conIA = () => CONFIG.IA !== 'basico' && hayServidor();
let misionesHechas = null;

/** Celebra cada misión que se acaba de cumplir. */
function revisarMisiones() {
  if (!eq()) { misionesHechas = null; return; }
  const ahora = new Set(misionesVisibles(conIA(), puedeEscuchar).filter((m) => cumplida(m, eq())).map((m) => m.id));
  if (misionesHechas) {
    const nuevas = [...ahora].filter((id) => !misionesHechas.has(id) && id !== 'encender');
    nuevas.forEach((id, i) => {
      const m = MISIONES.find((x) => x.id === id);
      setTimeout(() => aviso(`⭐ Misión cumplida: ${m.titulo}`, { ms: 3200 }), 900 + i * 1200);
    });
    if (nuevas.length) setTimeout(() => sonido('enLinea'), 700);
  }
  misionesHechas = ahora;
}

function misionesPendientes() {
  return misionesVisibles(conIA(), puedeEscuchar).filter((m) => m.fase === 2 && !m.opcional && !cumplida(m, eq())).length;
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
    ${pendiente ? `<p class="panel" style="margin:0">Escanearon la tarjeta <b>${esc(pendiente.nombre)}</b>. Primero creen su JARVIS.</p>` : ''}
    <div class="botones">
      <button class="btn btn-primario btn-grande" data-accion="crear">Crear nuestro JARVIS</button>
    </div>
    <p class="tenue" style="font-size:15px;max-width:380px">Su JARVIS se guarda en esta tablet. Cada tablet arma el suyo.</p>
  </div></section>`;
  app.querySelector('[data-accion="crear"]').addEventListener('click', abrirCrear);
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

// ---------- taller: los pasos del armado, uno a la vez ----------
// pasoVisto: el paso que se está viendo (se puede regresar a uno hecho). null = el primero que falta.
let pasoVisto = null;
const pasosArmado = () => misionesVisibles(conIA(), puedeEscuchar).filter((m) => m.fase === 1);
const enArmado = () => Boolean(eq()) && !eq().encendido;

/** El paso que está en pantalla: el que eligieron (si ya se puede ver) o el primero que falta. */
function pasoActual() {
  const pasos = pasosArmado();
  const falta = siguiente(eq(), 1, conIA()) || pasos[pasos.length - 1];
  const i = pasos.findIndex((m) => m.id === pasoVisto);
  return i >= 0 && i <= pasos.indexOf(falta) ? pasos[i] : falta;
}
function irAPaso(id) {
  pasoVisto = id;
  sonido('clic');
  pintarTaller();
}
/** Pasa al paso que sigue del que está en pantalla (si este ya está hecho). */
function siguientePaso() {
  const pasos = pasosArmado();
  const actual = pasoActual();
  if (!cumplida(actual, eq())) return;
  pasoVisto = pasos[Math.min(pasos.indexOf(actual) + 1, pasos.length - 1)].id;
  pintarTaller();
}
const nombreTarjeta = (paso) => `${MODULO[paso.id].nombre.toUpperCase()}${paso.colorNombre ? ` (${paso.colorNombre})` : ''}`;

function renderTaller() {
  app.innerHTML = `<section class="taller taller-mision">
    <div>${htmlEscenario()}</div>
    <div class="panel mision-panel" id="mision"></div>
  </section>`;
  pintarTaller();
}

function pintarTaller() {
  const cont = $('#mision');
  if (!cont || !eq()) return;
  const pasos = pasosArmado();
  const falta = siguiente(eq(), 1, conIA()) || pasos[pasos.length - 1];
  const paso = pasoActual();
  const i = pasos.indexOf(paso);
  const hecho = paso.id !== 'encender' && cumplida(paso, eq());
  const siguienteP = pasos[i + 1];
  const resumen = { identidad: () => eq().jarvis.nombre, voz: () => VOCES[eq().voz.id].nombre, nucleo: () => NUCLEOS[eq().nucleo.id].nombre, personalidad: () => PERSONALIDADES[eq().personalidad.id].nombre };
  const chip = (m, k) => {
    const listo = m.id !== 'encender' && cumplida(m, eq());
    const abierto = k <= pasos.indexOf(falta);
    return `<button class="paso-chip ${listo ? 'hecho' : ''} ${m === paso ? 'actual' : ''}" style="--c:${m.color}" data-paso="${m.id}" ${abierto ? '' : 'disabled'} aria-label="Paso ${k + 1}: ${esc(m.etiqueta)}">
      <span class="bolita">${listo ? '✓' : m.id === 'encender' ? '⏻' : k + 1}</span><small>${esc(m.etiqueta)}</small></button>`;
  };
  let cuerpo;
  if (paso.id === 'encender') {
    cuerpo = `<span class="mision-num">¡TODO LISTO!</span>
      <h2>${esc(paso.titulo)}</h2>
      <p>${esc(paso.como)}</p>
      <button class="btn btn-primario btn-grande boton-iniciar" data-accion="encender">⏻ INICIAR ${esc(eq().jarvis.nombre)}</button>
      <p class="tenue" style="font-size:15px">¿Quieren cambiar algo antes? Toquen un paso de arriba o “← Anterior”.</p>`;
  } else if (hecho) {
    cuerpo = `<span class="mision-num">PASO ${i + 1} DE 4 · ¡LISTO!</span>
      <h2>${esc(paso.titulo)}</h2>
      <div class="paso-hecho"><span>✓ ${esc(MODULO[paso.id].nombre)}: <b>${esc(resumen[paso.id]())}</b></span><button class="btn btn-chico" data-accion="ajustar">Ajustar</button></div>
      <button class="btn btn-primario btn-grande boton-siguiente" data-accion="siguiente">Siguiente →<small>${esc(siguienteP.id === 'encender' ? '¡Encenderlo!' : `Paso ${i + 2}: ${siguienteP.titulo}`)}</small></button>
      <button class="btn btn-chico" data-accion="escanear" style="justify-self:start">${icono('qr')} Escanear otra tarjeta de ${esc(MODULO[paso.id].nombre.toUpperCase())}</button>`;
  } else {
    cuerpo = `<span class="mision-num">PASO ${i + 1} DE 4</span>
      <h2>${esc(paso.titulo)}</h2>
      <p>${esc(paso.como)}</p>
      <div class="tarjeta-muestra">${icono(paso.icono)}<span>${esc(MODULO[paso.id].nombre.toUpperCase())}</span>${icono('qr')}</div>
      <button class="btn btn-primario btn-grande" style="width:100%" data-accion="escanear">${icono('qr')} Escanear tarjeta</button>`;
  }
  cont.innerHTML = `
    <div class="mision-pasos">${pasos.map(chip).join('<span class="paso-linea"></span>')}</div>
    <div class="mision-actual" style="--c:${paso.color}">${cuerpo}</div>
    <div class="fila-botones mision-extra">
      ${i > 0 ? '<button class="btn-texto" data-accion="anterior">← Anterior</button>' : ''}
      <button class="btn-texto" data-accion="guia">📺 Ver cómo</button>
      ${paso.id !== 'encender' ? '<button class="btn-texto" data-accion="codigo">¿Sin cámara? Escribir código</button>' : ''}
    </div>`;
  cont.querySelectorAll('[data-accion="escanear"]').forEach((b) => b.addEventListener('click', abrirEscanerTarjetas));
  cont.querySelector('[data-accion="encender"]')?.addEventListener('click', encender);
  cont.querySelector('[data-accion="codigo"]')?.addEventListener('click', abrirCodigoTarjeta);
  cont.querySelector('[data-accion="ajustar"]')?.addEventListener('click', () => abrirModulo(paso.id));
  cont.querySelector('[data-accion="siguiente"]')?.addEventListener('click', () => { sonido('clic'); siguientePaso(); });
  cont.querySelector('[data-accion="anterior"]')?.addEventListener('click', () => irAPaso(pasos[i - 1].id));
  cont.querySelector('[data-accion="guia"]').addEventListener('click', () => guia(paso.guia || 'escanear'));
  cont.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => irAPaso(b.dataset.paso)));
}

function verModulos() {
  modal(`<h2>Módulos de ${esc(eq().jarvis.nombre)}</h2>
    <p class="tenue" style="margin-top:0">Toquen uno instalado para ajustarlo. Para cambiar una pieza, escaneen otra tarjeta del mismo color.</p>
    ${htmlModulos()}`);
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
    case 'habilidades': return `${Object.values(e.habilidades || {}).filter(Boolean).length} de ${conIA() ? 4 : 3}`;
    default: return '';
  }
}

function pintarModulos() {
  const cont = $('#modulos');
  if (!cont || !eq()) return;
  cont.innerHTML = MODULOS.map((m) => `<button class="tile ${instalado(m.id) ? 'instalado' : 'bloqueado'}" style="--c:${m.color}" data-modulo="${m.id}">
      ${icono(m.id)}<span class="n">${m.nombre}</span><span class="e">${esc(resumenModulo(m.id))}</span>
    </button>`).join('');
  cont.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => abrirModulo(b.dataset.modulo)));
  const n = MODULOS.filter((m) => instalado(m.id)).length;
  const barra = $('#barra-modulos');
  if (barra) barra.style.width = `${(n / MODULOS.length) * 100}%`;
  const cuenta = $('#cuenta-modulos');
  if (cuenta) cuenta.textContent = `${n}/${MODULOS.length}`;
}

// ---------- crear ----------
function abrirCrear() {
  const m = modal(`<h2>Crear su JARVIS</h2>
    <p class="tenue">Escriban el nombre de su equipo. Su JARVIS se guarda en esta tablet.</p>
    <form id="f-crear">
      <label class="campo"><span>Nombre del equipo</span><input type="text" id="f-nombre" maxlength="40" required autocomplete="off" placeholder="Ej. Los Bits"></label>
      <button class="btn btn-primario btn-grande" style="width:100%">Crear</button>
    </form>`);
  const input = m.el.querySelector('#f-nombre');
  setTimeout(() => input.focus(), 50);
  m.el.querySelector('#f-crear').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nombre = input.value.trim();
    if (!nombre) return;
    if (!textoLimpio(nombre)) { aviso('Ese nombre no se puede usar. Escojan otro.', { mal: true }); return; }
    estado.crear(nombre);
    historial = [];
    m.cerrar();
    sonido('instalar');
    render(true);
    decir(`Equipo ${nombre}, bienvenidos. Sigan las misiones para armarme.`);
    if (tarjetaPendiente) aplicarTarjetaPendiente();
    else setTimeout(() => guia('bienvenida'), 600);
  });
}

/** Datos del equipo: cambiar el nombre o borrar el JARVIS de esta tablet. */
function abrirEquipo() {
  const e = eq();
  if (!e) return;
  const m = modal(`<h2>${esc(e.nombre)}</h2>
    <p class="tenue">Este JARVIS vive en esta tablet. Si se va el internet o cierran la página, no se pierde.</p>
    <label class="campo"><span>Nombre del equipo</span><input type="text" id="e-nombre" maxlength="40" value="${esc(e.nombre)}" autocomplete="off"></label>
    <div class="fila-botones"><button class="btn btn-primario" data-guardar>Guardar</button></div>
    <hr style="border:0;border-top:1px solid var(--borde);margin:18px 0">
    <p class="tenue" style="font-size:15px">Cerebro: ${cerebroIA() ? '✨ IA, con el 🧠 básico de respaldo' : '🧠 básico (respuestas escritas por personas)'}.</p>
    <button class="btn-texto" data-salir>Borrar este JARVIS y empezar de nuevo</button>`);
  m.el.querySelector('[data-guardar]').addEventListener('click', () => {
    const nombre = m.el.querySelector('#e-nombre').value.trim();
    if (!nombre) return;
    if (!textoLimpio(nombre)) { aviso('Ese nombre no se puede usar.', { mal: true }); return; }
    estado.cambiar({ nombre });
    m.cerrar();
    aviso('Guardado');
  });
  m.el.querySelector('[data-salir]').addEventListener('click', async () => {
    const ok = await confirmar('Se borra el JARVIS de esta tablet: módulos, bitácora y puntos (las fotos se quedan). ¿Borrar?', { si: 'Borrar', peligro: true });
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
    if (est && est.textContent === 'Abriendo cámara…') est.textContent = 'Buscando un QR…';
  }).catch(() => {
    const est = m.el.querySelector('#estado-escaner');
    if (est) est.innerHTML = 'No se pudo abrir la cámara. Den permiso de cámara al navegador o <b>escriban el código</b> que viene en la esquina de la tarjeta.';
  });
}

function abrirEscanerTarjetas() {
  const paso = enArmado() ? pasoActual() : null;
  const texto = paso && paso.id !== 'encender' ? `Busquen la tarjeta ${nombreTarjeta(paso)} y apunten la cámara a su QR.` : undefined;
  escanear((leido) => {
    const r = leerQR(leido);
    if (r.tipo === 'tarjeta') return usarTarjeta(r.codigo);
    aviso('Ese QR no es una tarjeta de JARVIS.', { mal: true });
    return false;
  }, texto);
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
// mientras arman a JARVIS, cada paso acepta solo su tarjeta
let ultimoRechazo = { codigo: '', t: 0 };
function tarjetaEquivocada(codigo, t) {
  const paso = pasoActual();
  const deQue = t.tipo === 'modulo' ? `Esa tarjeta es de ${MODULO[t.modulo].nombre.toUpperCase()}` : 'Esa tarjeta es para después';
  const texto = paso.id === 'encender'
    ? `${deQue}. Ya armaron todo: toquen INICIAR. Para cambiar algo, regresen a ese paso.`
    : `${deQue}. Ahora estamos con ${MODULO[paso.id].nombre}: busquen la tarjeta ${nombreTarjeta(paso)}.`;
  aviso(texto, { mal: true, ms: 4000 });
  const est = document.querySelector('#estado-escaner');
  if (est) est.innerHTML = `<b style="color:var(--rojo)">${esc(texto)}</b>`;
  // la cámara lee la misma tarjeta varias veces: hablar solo una vez
  const ahora = Date.now();
  if (ultimoRechazo.codigo !== codigo || ahora - ultimoRechazo.t > 6000) {
    sonido('error');
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    decir(paso.id === 'encender' ? 'Ya armaron todo. Toquen iniciar.' : `Ahora estamos con ${MODULO[paso.id].nombre}.`);
  }
  ultimoRechazo = { codigo, t: ahora };
}

/** Instala o activa una tarjeta. Devuelve true si la tomó (false si no era la del paso). */
function usarTarjeta(codigo) {
  const t = TARJETAS[codigo];
  if (!t || !eq()) return false;
  if (enArmado()) {
    const paso = pasoActual();
    if (t.tipo !== 'modulo' || t.modulo !== paso.id) { tarjetaEquivocada(codigo, t); return false; }
    pasoVisto = paso.id; // quedarse en este paso hasta que toquen Siguiente
  }
  if (t.tipo === 'accion') { estado.cambiar({ logros: { acciones: { [codigo]: true } } }); accion(t.accion); return true; }
  if (t.tipo === 'especial') { ataqueUltron(); return true; }
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
  if (igual && m !== 'habilidades') { abrirModulo(m); return true; }
  estado.cambiar(parche);
  sonido('instalar');
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  if (m === 'voz') decir(`Así sueno ahora. Soy ${eq().jarvis.nombre}. ¿Les gusta mi voz?`, { sonar: true });
  else if (m === 'personalidad') decir(frase('saludo'));
  else if (m === 'habilidades' && !nuevoAqui) aviso('Esa habilidad ya estaba instalada.');
  else decir(frase('listo'));
  // en el armado siempre se abre la hoja (para ajustar y tocar Siguiente)
  if (nuevoAqui || enArmado()) abrirModulo(m, { nuevo: nuevoAqui, habilidad: m === 'habilidades' ? HABILIDADES[t.valor] : null });
  else aviso(`${MODULO[m].nombre}: ${t.nombre}`);
  return true;
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

// ---------- hojas de módulo: lo básico a la vista, lo demás en "Más opciones" ----------
function cabezaModulo(m, nuevo, sabias) {
  return `<div class="cabeza-modulo">${icono(m.id)}<div><h2>${nuevo ? `¡Módulo listo: ${esc(m.nombre)}!` : esc(m.nombre)}</h2></div></div>
    <p class="sabias-corto">💡 ${esc(sabias || m.corto || m.sabias)}</p>`;
}

// antes de encenderlo, el botón lleva a la siguiente misión; después, solo guarda
const listoBtn = () => `<button class="btn btn-primario btn-grande" data-listo style="flex:1">${eq() && !eq().encendido ? 'Siguiente →' : 'Listo'}</button>`;
const ESCUCHAR = `<button class="btn btn-grande" data-probar>${icono('altavoz')} Escuchar</button>`;

function abrirModulo(id, { nuevo = false, habilidad = null } = {}) {
  const m = MODULO[id];
  if (!instalado(id)) {
    const md = modal(`<div class="cabeza-modulo">${icono(m.id)}<div><h2>${esc(m.nombre)}</h2></div></div>
      <p>Busquen en su sobre una tarjeta <b style="color:${m.color}">${esc(m.nombre.toUpperCase())}</b> y escanéenla.</p>
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
  // en el armado, al guardar se va al primer paso que falta (o a Encender si ya está todo)
  if (enArmado()) { pasoVisto = null; pintarTaller(); }
  return true;
}

function chips(lista, destino, actual = '') {
  return `<div class="chips" data-destino="${destino}">${lista.map((s) => `<button type="button" class="chip ${s === actual ? 'activo' : ''}">${esc(s)}</button>`).join('')}</div>`;
}
function activarChips(raiz) {
  raiz.querySelectorAll('.chips[data-destino]').forEach((c) => c.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    const input = raiz.querySelector(`#${c.dataset.destino}`);
    input.value = b.textContent;
    c.querySelectorAll('.chip').forEach((x) => x.classList.toggle('activo', x === b));
    sonido('clic');
    input.dispatchEvent(new Event('input'));
  }));
}

function editorIdentidad(m, nuevo) {
  const e = eq();
  const md = modal(`${cabezaModulo(m, nuevo)}
    <label class="campo"><span>¿Cómo se llama su JARVIS?</span><input type="text" id="f-jnombre" maxlength="16" value="${esc(e.jarvis.nombre === 'JARVIS' ? '' : e.jarvis.nombre)}" placeholder="Escriban un nombre o toquen uno" autocomplete="off"></label>
    ${chips(SUGERENCIAS.nombres.slice(0, 6), 'f-jnombre', e.jarvis.nombre)}
    <details class="mas"><summary>Más opciones: lema del equipo</summary>
      <label class="campo"><span>Lema</span><input type="text" id="f-lema" maxlength="60" value="${esc(e.jarvis.lema)}" placeholder="Ej. Ningún bug nos detiene" autocomplete="off"></label>
      <p class="tenue">Palabra de activación: <b id="f-activacion"></b></p>
    </details>
    <div class="fila-botones acciones-hoja">${ESCUCHAR}${listoBtn()}</div>`, { color: m.color });
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
  md.el.querySelector('[data-listo]').addEventListener('click', () => {
    if (guardarConFiltro(datos(), md)) decir(rellenar('Me llamo {jarvis}. {lema}', vars()));
  });
}

function editorVoz(m, nuevo) {
  const e = eq();
  const base = VOCES[e.voz.id];
  const md = modal(`${cabezaModulo(m, nuevo)}
    <div class="voz-actual">${icono('altavoz')}<div><b>${esc(base.nombre)}</b><span>${esc(base.desc)}</span></div></div>
    <p class="tenue" style="margin:8px 0 0">¿Quieren comparar? Escaneen otra tarjeta de <b style="color:var(--c)">VOZ</b> y escuchen la diferencia.</p>
    <button class="btn btn-chico" data-otra style="margin-top:8px">${icono('qr')} Escanear otra tarjeta de voz</button>
    <div class="afinar">
      <label class="campo"><span><b>Tono</b> <span class="tenue">grave ↔ agudo</span> · <b id="v-tono-n" class="mono"></b></span><input type="range" id="v-tono" min="0" max="2" step="0.05" value="${e.voz.tono ?? base.tono}"></label>
      <label class="campo"><span><b>Velocidad</b> <span class="tenue">lenta ↔ rápida</span> · <b id="v-vel-n" class="mono"></b></span><input type="range" id="v-vel" min="0.5" max="1.8" step="0.05" value="${e.voz.velocidad ?? base.velocidad}"></label>
    </div>
    <details class="mas"><summary>Más opciones: otra voz del aparato</summary>
      <label class="campo"><span>Voz del aparato</span><select id="v-voz"><option value="">Automática</option></select></label>
      <p class="tenue" style="font-size:14px;margin:0">Usando: <span id="v-usando">…</span></p>
      <p class="mono tenue" style="font-size:13px">voz.tono = <span id="v-codigo-t"></span>; voz.velocidad = <span id="v-codigo-v"></span>;</p>
      <button class="btn-texto" data-reset>Volver a como venía</button>
    </details>
    <div class="fila-botones acciones-hoja">${ESCUCHAR}${listoBtn()}</div>`, { color: m.color });
  const tono = md.el.querySelector('#v-tono');
  const vel = md.el.querySelector('#v-vel');
  const select = md.el.querySelector('#v-voz');
  const ajustes = () => ({ tono: Number(tono.value), velocidad: Number(vel.value), voz: base.voz, vozNombre: select.value || '' });
  const pintar = () => {
    md.el.querySelector('#v-tono-n').textContent = Number(tono.value).toFixed(2);
    md.el.querySelector('#v-vel-n').textContent = `${Number(vel.value).toFixed(2)}×`;
    md.el.querySelector('#v-codigo-t').textContent = Number(tono.value).toFixed(2);
    md.el.querySelector('#v-codigo-v').textContent = Number(vel.value).toFixed(2);
    const v = vozElegida(ajustes());
    md.el.querySelector('#v-usando').textContent = v ? `${v.name} (${v.lang})` : 'la voz del aparato';
  };
  const probar = () => {
    const frase = `¿Qué tal sueno así? Soy ${eq().jarvis.nombre}.`;
    subtitulo(frase);
    hablar(frase, ajustes());
  };
  // la lista de voces del aparato puede tardar en cargar: se llena cuando esté
  listasVoces().then(() => {
    vocesEspanol().forEach((v) => {
      const op = document.createElement('option');
      op.textContent = `${v.name}${v.localService ? '' : ' (internet)'}`;
      op.value = v.name;
      if (v.name === e.voz.vozNombre) op.selected = true;
      select.appendChild(op);
    });
    pintar();
  });
  [tono, vel].forEach((x) => {
    x.addEventListener('input', pintar);
    x.addEventListener('change', probar); // al soltar el control, se escucha cómo quedó
  });
  select.addEventListener('change', () => { pintar(); probar(); });
  pintar();
  md.el.querySelector('[data-probar]').addEventListener('click', probar);
  md.el.querySelector('[data-otra]').addEventListener('click', () => { md.cerrar(); abrirEscanerTarjetas(); });
  md.el.querySelector('[data-reset]').addEventListener('click', () => { tono.value = base.tono; vel.value = base.velocidad; select.value = ''; pintar(); probar(); });
  md.el.querySelector('[data-listo]').addEventListener('click', () => {
    const a = ajustes();
    if (guardarConFiltro({ voz: { tono: a.tono, velocidad: a.velocidad, vozNombre: a.vozNombre } }, md)) decir('¡Me encanta mi voz!');
  });
}

function editorNucleo(m, nuevo) {
  const e = eq();
  let color = e.nucleo.color || '#3fd0ff';
  const md = modal(`${cabezaModulo(m, nuevo)}
    <p style="margin:0 0 4px"><b>${esc(NUCLEOS[e.nucleo.id].nombre)}</b> · <span class="tenue">${esc(NUCLEOS[e.nucleo.id].desc)}</span></p>
    <div class="centro"><canvas id="vista-nucleo" style="width:160px;height:160px"></canvas></div>
    <p style="margin:0 0 6px"><b>Escojan un color:</b></p>
    <div class="chips" id="colores">${COLORES.map((c) => `<button type="button" class="chip ${c.valor === color ? 'activo' : ''}" data-color="${c.valor}"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.valor};vertical-align:-2px"></span> ${c.nombre}</button>`).join('')}</div>
    <div class="fila-botones acciones-hoja">${listoBtn()}</div>`, { color: m.color, alCerrar: () => muestra.destruir() });
  const muestra = new Nucleo(md.el.querySelector('#vista-nucleo'), { forma: NUCLEOS[e.nucleo.id].forma, color });
  md.el.querySelector('#colores').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    md.el.querySelectorAll('#colores .chip').forEach((c) => c.classList.toggle('activo', c === b));
    muestra.poner({ color });
    sonido('clic');
  });
  md.el.querySelector('[data-listo]').addEventListener('click', () => { if (guardarConFiltro({ nucleo: { color } }, md)) decir(frase('listo')); });
}

function editorAmbiente(m, nuevo) {
  const a = AMBIENTES[eq().ambiente.id];
  const md = modal(`${cabezaModulo(m, nuevo)}
    <p style="margin:0"><b>${esc(a.nombre)}</b> · <span class="tenue">${esc(a.desc)}</span></p>
    <p class="tenue">¿Otro escenario? Escaneen otra tarjeta de ambiente.</p>
    <div class="fila-botones acciones-hoja">${listoBtn()}</div>`, { color: m.color });
  md.el.querySelector('[data-listo]').addEventListener('click', md.cerrar);
}

function editorPersonalidad(m, nuevo) {
  const e = eq();
  const p = PERSONALIDADES[e.personalidad.id];
  const fila = (id, etiqueta, opciones, valor, ejemplo) => `<div class="fila-dir">
      <span class="etq">${etiqueta}</span>
      ${chips(opciones, id, valor)}
      <input type="text" id="${id}" maxlength="80" value="${esc(valor)}" placeholder="o escriban la suya: ${esc(ejemplo)}" autocomplete="off">
    </div>`;
  const md = modal(`${cabezaModulo(m, nuevo)}
    <p style="margin:0 0 10px"><b>${esc(p.nombre)}</b> · <span class="tenue">${esc(p.descripcion)}</span></p>
    <p style="margin:0 0 10px">Armen su <b>directiva principal</b>: toquen una idea en cada fila.</p>
    ${fila('d-habla', 'Habla como…', [p.habla, ...SUGERENCIAS.habla.slice(0, 3)], e.personalidad.habla, 'un pirata')}
    ${fila('d-encanta', 'Le encanta…', SUGERENCIAS.encanta.slice(0, 4), e.personalidad.encanta, 'el fútbol')}
    ${fila('d-nunca', 'Nunca…', SUGERENCIAS.nunca.slice(0, 4), e.personalidad.nunca, 'se rinde')}
    <details class="mas"><summary>Ver su directiva completa (el prompt)</summary><pre class="codigo" id="d-vista"></pre></details>
    <div class="fila-botones acciones-hoja">${ESCUCHAR}${listoBtn()}</div>`, { color: m.color });
  activarChips(md.el);
  const val = (id) => md.el.querySelector(`#${id}`).value.trim();
  const pintar = () => {
    md.el.querySelector('#d-vista').textContent = `Eres ${e.jarvis.nombre}, el asistente del equipo "${e.nombre}".\nPersonalidad: ${p.nombre}.\nHablas como ${val('d-habla') || p.habla}.\nTe encanta ${val('d-encanta') || 'ayudar a tu equipo'}.\nNunca ${val('d-nunca') || 'te rindes'}.`;
  };
  md.el.querySelectorAll('input').forEach((i) => i.addEventListener('input', pintar));
  pintar();
  md.el.querySelector('[data-probar]').addEventListener('click', () => {
    const encanta = val('d-encanta');
    decir(`${rellenar(p.frases.saludo, vars())}${encanta ? ` Me encantan ${encanta}.` : ''}`);
  });
  md.el.querySelector('[data-listo]').addEventListener('click', () => {
    if (guardarConFiltro({ personalidad: { habla: val('d-habla'), encanta: val('d-encanta'), nunca: val('d-nunca') } }, md)) decir('Directiva guardada. Ya sé quién soy.');
  });
}

function editorMemoria(m, nuevo) {
  const e = eq();
  const integrantes = [...(e.memoria.integrantes || [])];
  while (integrantes.length < 6) integrantes.push('');
  const md = modal(`${cabezaModulo(m, nuevo)}
    <p style="margin:0 0 8px"><b>¿Quiénes son?</b> <span class="tenue">Solo nombres de pila.</span></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${integrantes.slice(0, 6).map((n, i) => `<input type="text" class="m-int" maxlength="20" value="${esc(n)}" placeholder="Nombre ${i + 1}" autocomplete="off">`).join('')}</div>
    <details class="mas"><summary>Más opciones: prepa y algo de ustedes</summary>
      <label class="campo"><span>Preparatoria</span><input type="text" id="m-prepa" maxlength="60" value="${esc(e.memoria.prepa)}" autocomplete="off"></label>
      <label class="campo"><span>Algo que JARVIS deba saber de ustedes</span><input type="text" id="m-dato" maxlength="120" value="${esc(e.memoria.dato)}" placeholder="Ej. Somos fans del béisbol" autocomplete="off"></label>
    </details>
    <div class="fila-botones acciones-hoja">${listoBtn()}</div>`, { color: m.color });
  md.el.querySelector('[data-listo]').addEventListener('click', () => {
    const lista = $$('.m-int', md.el).map((i) => i.value.trim().split(/\s+/)[0]).filter(Boolean);
    const ok = guardarConFiltro({ memoria: { integrantes: lista, prepa: md.el.querySelector('#m-prepa').value.trim(), dato: md.el.querySelector('#m-dato').value.trim() } }, md);
    if (ok && lista.length) decir(`Memoria guardada. Hola, ${lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}` : lista[0]}.`);
  });
}

function editorEscudo(m, nuevo) {
  const e = eq();
  const md = modal(`${cabezaModulo(m, nuevo)}
    <p style="margin:0 0 6px"><b>Reglas que nadie puede romper:</b></p>
    <ul class="reglas">${REGLAS_FIJAS.map((r) => `<li>🔒 ${esc(r)}</li>`).join('')}</ul>
    <details class="mas"><summary>Más opciones: agregar una regla del equipo</summary>
      <label class="campo"><span>Regla del equipo</span><input type="text" id="e-regla" maxlength="80" value="${esc(e.escudo.regla)}" placeholder="Ej. Nunca cuenta spoilers de películas" autocomplete="off"></label>
    </details>
    <div class="fila-botones acciones-hoja">${listoBtn()}</div>`, { color: m.color });
  md.el.querySelector('[data-listo]').addEventListener('click', () => {
    if (guardarConFiltro({ escudo: { regla: md.el.querySelector('#e-regla').value.trim() } }, md)) decir('Escudo activado.');
  });
}

function editorHabilidades(m, nuevo, habilidad) {
  let cuerpo;
  if (habilidad) {
    const donde = habilidad.id === 'chat'
      ? (conIA() ? 'Desde ahora pueden preguntarle lo que sea en Hablar.' : 'Esta tablet no tiene la súper inteligencia conectada: JARVIS sigue con su cerebro básico.')
      : (eq().encendido ? `Búsquenla abajo: apareció la pestaña ${habilidad.nombre}.` : `Aparecerá como pestaña cuando enciendan a ${eq().jarvis.nombre}.`);
    cuerpo = `<div class="cabeza-modulo">${icono(habilidad.id)}<div><h2>¡${esc(habilidad.nombre)} instalada!</h2></div></div>
      <p class="sabias-corto">💡 ${esc(habilidad.sabias)}</p><p><b>${esc(donde)}</b></p>`;
  } else {
    cuerpo = `${cabezaModulo(m, false)}
      <div class="lista">${Object.entries(HABILIDADES).filter(([, h]) => h.id !== 'chat' || conIA()).map(([cod, h]) => `<div class="item"><div class="cabeza"><b>${icono(h.id)} ${esc(h.nombre)}</b><span class="etiqueta ${tieneHabilidad(h.id) ? 'ok' : ''}">${tieneHabilidad(h.id) ? 'Instalada' : `Tarjeta ${cod}`}</span></div><span class="tenue">${esc(h.desc)}</span></div>`).join('')}</div>`;
  }
  const probarIA = habilidad && habilidad.id === 'chat' && conIA() && eq().encendido;
  const md = modal(`${cuerpo}<div class="fila-botones acciones-hoja">${probarIA ? '<button class="btn btn-primario btn-grande" data-probar-ia style="flex:1">✨ Probarla: pregúntenle lo que sea</button>' : listoBtn()}</div>`, { color: m.color });
  md.el.querySelector('[data-listo]')?.addEventListener('click', md.cerrar);
  md.el.querySelector('[data-probar-ia]')?.addEventListener('click', () => {
    md.cerrar();
    pestana = 'hablar';
    pintarPestanas();
    pintarPestana();
    const input = $('#pregunta');
    if (input) { input.placeholder = 'Ej. ¿Por qué el cielo es azul?'; input.focus(); }
    decir('Súper inteligencia en línea. Pregúntenme lo que sea.');
  });
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
  if (usarIA()) {
    presentacion = Promise.race([
      llamar('POST', '/api/chat', { tipo: 'presentacion', dispositivo: dispositivo(), jarvis: datosParaIA() }, { timeout: 9000 })
        .then((r) => { if (typeof r.restantes === 'number') restantesIA = r.restantes; return r.texto; }).catch(() => null),
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
    [`> Cerebro ................... ${cerebroIA() ? 'IA + BÁSICO' : 'BÁSICO'}`, 'ok'],
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
    pestana = 'misiones';
    render(true);
    if (!historial.length) historial.push({ role: 'assistant', content: texto, cerebro: 'basico' });
    subtitulo('¡Tengo misiones nuevas para ustedes!');
    setTimeout(() => decir('¡Tengo misiones nuevas para ustedes!'), 300);
  };
  const boton = capa.querySelector('#continuar');
  boton.hidden = false;
  boton.addEventListener('click', terminar);
  await hablar(texto, ajustesVoz());
  if (capa.isConnected) setTimeout(() => { if (capa.isConnected) terminar(); }, 1500);
}

// ---------- vista JARVIS ----------
// Las pestañas aparecen poco a poco: Hablar y Misiones al encender; Bitácora, Puntos y Cámara al
// escanear su tarjeta.
const PESTANAS = [
  { id: 'hablar', nombre: 'Hablar', icono: 'chat', habilidad: null },
  { id: 'misiones', nombre: 'Misiones', icono: 'accion', habilidad: null },
  { id: 'bitacora', nombre: 'Bitácora', icono: 'bitacora', habilidad: 'bitacora' },
  { id: 'puntos', nombre: 'Puntos', icono: 'puntos', habilidad: 'puntos' },
  { id: 'camara', nombre: 'Cámara', icono: 'camara', habilidad: 'camara' },
];
const pestanasVisibles = () => PESTANAS.filter((p) => !p.habilidad || tieneHabilidad(p.habilidad));

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
  const visibles = pestanasVisibles();
  if (!visibles.some((p) => p.id === pestana)) pestana = 'hablar';
  const pendientes = misionesPendientes();
  const html = visibles.map((p) => `<button class="${p.id === pestana ? 'activa' : ''}" data-p="${p.id}">${icono(p.icono)}<span>${p.nombre}${p.id === 'misiones' && pendientes ? ` <i class="globo">${pendientes}</i>` : ''}</span></button>`).join('');
  if (nav.dataset.html === html) return;
  nav.dataset.html = html;
  nav.innerHTML = html;
  nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (pestana === 'camara') cerrarCamara();
    pestana = b.dataset.p;
    pintarPestanas();
    pintarPestana();
  }));
}

function pintarPestana() {
  const cont = $('#pestana');
  if (!cont) return;
  ({ hablar: pestanaHablar, misiones: pestanaMisiones, bitacora: pestanaBitacora, puntos: pestanaPuntos, camara: pestanaCamara })[pestana](cont);
}

// --- hablar ---
// con la súper inteligencia: preguntas abiertas que el cerebro básico no podría contestar
const PREGUNTAS_IA = ['¿Por qué el cielo es azul?', 'Escribe un rap de 4 líneas sobre nuestro equipo', 'Inventa un plan para vencer a Ultrón', '¿Cómo funciona un hoyo negro?', 'Explícame la inteligencia artificial como si tuviera 10 años', '¿Qué carrera me recomiendas si me gustan los videojuegos?', 'Cuéntanos un dato curioso de México'];
const PREGUNTAS = ['¿Qué es una dirección IP?', '¿Qué estudia alguien de ITC?', '¿Cómo sé si una contraseña es segura?', '¿Qué es un algoritmo?', '¿Qué sigue en la agenda?', '¿Cómo vencemos a Ultrón?', '¿Cómo funcionas?'];

function pestanaHablar(cont) {
  const est = estacionActual();
  const a = est ? AYUDA_ESTACIONES[est] : null;
  const sugeridas = [...(est ? a.preguntas : cerebroIA() ? PREGUNTAS_IA : PREGUNTAS)].sort(() => Math.random() - 0.5).slice(0, 2);
  cont.innerHTML = `
    <form class="chat-entrada" id="f-chat">
      ${puedeEscuchar ? `<button type="button" class="btn-redondo" id="mic" aria-label="Hablar">${icono('mic')}</button>` : ''}
      <input type="text" id="pregunta" maxlength="300" placeholder="Pregúntale a ${esc(eq().jarvis.nombre)}…" autocomplete="off">
      <button class="btn-redondo" aria-label="Enviar">${icono('enviar')}</button>
    </form>
    <div class="chips" id="rapidas" style="margin-top:10px">
      <button class="chip" data-r="chiste">😂 Chiste</button>
      <button class="chip" data-r="dato">💡 Dato curioso</button>
      ${sugeridas.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>
    <div class="taller-ayuda">
      <button class="btn btn-chico" id="b-estacion">📍 ${est ? esc(a.nombre) : '¿En qué taller están?'}</button>
      ${est ? '<button class="btn btn-chico btn-primario" id="b-pista">💡 Pista</button>' : ''}
      <button class="btn-texto" id="b-guia-pista" style="min-height:36px">📺 Ver cómo</button>
    </div>
    <div id="pista-caja"></div>
    ${est ? `<details class="mas" id="mas-ayuda"><summary>Más ayuda de ${esc(a.nombre)}</summary><div id="ayuda"></div></details>` : ''}
    <p class="tenue" id="cerebro-info" style="font-size:13px;margin:8px 0 0"></p>
    <div class="historial" id="historial"></div>`;
  cont.querySelector('#b-estacion').addEventListener('click', elegirEstacionVentana);
  cont.querySelector('#b-guia-pista').addEventListener('click', () => guia('pista'));
  cont.querySelector('#b-pista')?.addEventListener('click', () => {
    const r = siguientePista(est);
    if (r.titulo === 'PRIMERO') {
      const mas = $('#mas-ayuda');
      if (mas) { mas.open = true; mas.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    $('#pista-caja').innerHTML = `<div class="sabias" style="--c:var(--amarillo)"><b>${esc(r.titulo)}</b>${esc(r.texto)}</div>`;
    if (r.nueva) { sonido('escaneo'); estado.cambiar({ logros: { pista: 1 } }); }
    decir(r.texto);
    const ayuda = $('#ayuda');
    if (ayuda) montarAyuda(ayuda, est);
  });
  if (est) montarAyuda(cont.querySelector('#ayuda'), est);
  cont.querySelector('#rapidas').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    if (b.dataset.r) accion(b.dataset.r);
    else if (b.dataset.q) preguntar(b.dataset.q);
  });
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
  cont.querySelector('#historial').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-prompt]');
    if (b) verPrompt(Number(b.dataset.prompt));
  });
  pintarCerebro();
  pintarHistorial();
}

/** "Así le preguntó JARVIS a la IA": el prompt de sistema, la pregunta y la respuesta. */
function verPrompt(i) {
  const m = historial[i];
  if (!m) return;
  const pregunta = [...historial.slice(0, i)].reverse().find((x) => x.role === 'user');
  const md = modal(`<h2>Así le preguntó ${esc(eq().jarvis.nombre)} a la IA</h2>
    <p class="tenue" style="margin-top:0">Con cada pregunta, JARVIS le manda a la IA sus <b>instrucciones</b> (el prompt de sistema, armado con lo que ustedes programaron) y la <b>conversación</b>. La IA contesta siguiendo esas instrucciones.</p>
    <h3 class="paso-prompt">1 · Instrucciones (prompt de sistema)</h3><pre class="codigo prompt-sistema">${esc(m.prompt)}</pre>
    <h3 class="paso-prompt">2 · La pregunta</h3><pre class="codigo">${esc(pregunta ? pregunta.content : '')}</pre>
    <h3 class="paso-prompt">3 · Lo que contestó la IA</h3><p style="font-size:18px;margin:0">${esc(m.content)}</p>
    <div class="fila-botones acciones-hoja"><button class="btn btn-primario btn-grande" data-listo style="flex:1">Entendido</button></div>`, { clase: 'modal-ancho' });
  md.el.querySelector('[data-listo]').addEventListener('click', md.cerrar);
}

/** Ventana para elegir el taller donde están (para darles pistas de ese taller). */
function elegirEstacionVentana() {
  const est = estacionActual();
  const m = modal(`<h2>¿En qué taller están?</h2>
    <p class="tenue" style="margin-top:0">JARVIS les dará pistas de ese taller (nunca las respuestas).</p>
    <div class="lista">${ORDEN_ESTACIONES.map((id) => `<button class="item estacion-op ${id === est ? 'activa' : ''}" data-est="${id}"><b>📍 ${esc(AYUDA_ESTACIONES[id].nombre)}</b><span class="tenue">${esc(AYUDA_ESTACIONES[id].reto)}</span></button>`).join('')}
      <button class="item estacion-op ${est ? '' : 'activa'}" data-est=""><b>Ninguno por ahora</b></button></div>`);
  m.el.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', () => {
    m.cerrar();
    elegirEstacion(b.dataset.est);
    pestana = 'hablar';
    pintarPestanas();
    pintarPestana();
  }));
}

/** Qué cerebro está usando JARVIS (debajo del chat). */
function pintarCerebro() {
  pintarBarra();
  const el = $('#cerebro-info');
  if (!el) return;
  el.classList.toggle('aviso-ia', cerebroIA() && Date.now() >= iaFallaHasta && restantesIA !== 0);
  if (cerebroIA()) {
    el.innerHTML = Date.now() < iaFallaHasta
      ? '✨ La súper inteligencia no responde por ahora: contesto con mi 🧠 cerebro básico.'
      : restantesIA === 0
        ? '✨ Se acabaron las preguntas de súper inteligencia de hoy: sigo con mi 🧠 cerebro básico.'
        : `✨ <b>Súper inteligencia activa:</b> pregúntenme lo que sea.${typeof restantesIA === 'number' ? ` · ⚡ ${restantesIA} preguntas por hoy` : ''}`;
  } else {
    el.innerHTML = '🧠 Cerebro básico: contesto con textos escritos por personas. Pregúntenme de CODEXIA, de los talleres o de tecnología.';
  }
}

function pintarHistorial() {
  const h = $('#historial');
  if (!h) return;
  const desde = Math.max(0, historial.length - 12);
  h.innerHTML = historial.slice(desde).map((m, k) => ({ m, i: desde + k })).reverse().map(({ m, i }) => `<div class="burbuja ${m.role === 'user' ? 'yo' : 'jarvis'}">${esc(m.content)}${m.role !== 'user' && m.cerebro
    ? `<span class="cerebro-tag">${m.cerebro === 'ia' ? '✨ súper inteligencia' : '🧠 cerebro básico'}${m.cerebro === 'ia' && m.prompt ? ` · <button class="btn-texto ver-prompt" data-prompt="${i}">Ver el prompt</button>` : ''}</span>` : ''}</div>`).join('');
}

/** Pregunta: primero el Cerebro IA (si lo tienen y funciona); si no, o si falla, el cerebro básico. */
async function preguntar(texto) {
  if (esperandoIA) return;
  historial.push({ role: 'user', content: texto });
  pintarHistorial();
  let respuesta = null;
  let cerebro = 'basico';
  let prompt = '';
  if (usarIA() && textoLimpio(texto)) {
    esperandoIA = true;
    subtitulo('Pensando…');
    if (nucleo) nucleo.hablando(true);
    try {
      const mensajes = historial.slice(-10).map(({ role, content }) => ({ role, content }));
      const r = await llamar('POST', '/api/chat', { dispositivo: dispositivo(), jarvis: datosParaIA(), mensajes, estacion: estacionActual() }, { timeout: 20000 });
      respuesta = r.texto;
      cerebro = 'ia';
      prompt = r.prompt || '';
      if (typeof r.restantes === 'number') restantesIA = r.restantes;
    } catch (e) {
      if (typeof e.datos.restantes === 'number') restantesIA = e.datos.restantes;
      if (e.status === 0 || e.status >= 500 || e.status === 429) iaFallaHasta = Date.now() + 60000;
      const motivo = { 402: 'Se acabaron las preguntas de IA de hoy.', 403: 'El staff pausó la IA un momento.' }[e.status] || 'La IA no respondió.';
      if (e.status !== 422) aviso(`${motivo} Contesto con mi cerebro básico.`, { ms: 3500 });
    } finally {
      esperandoIA = false;
      if (nucleo) nucleo.hablando(false);
    }
  }
  if (respuesta === null) {
    const r = responder(texto, { equipo: eq(), estacion: estacionActual(), cerebroIA: cerebroIA() });
    respuesta = r.accion === 'pista' ? pistaDeChat() : r.texto;
  }
  historial.push({ role: 'assistant', content: respuesta, cerebro, ...(prompt ? { prompt } : {}) });
  estado.cambiar({ logros: { preguntas: ((eq().logros && eq().logros.preguntas) || 0) + 1 } });
  guardarHistorial();
  pintarHistorial();
  pintarCerebro();
  decir(respuesta);
}

/** "Pista" dicha en el chat: la siguiente pista de la estación donde están. */
function pistaDeChat() {
  const id = estacionActual();
  if (!id) return '¿En qué estación están? Elíjanla arriba, en ¿Dónde están ahora?, y les doy una pista de ese taller.';
  const r = siguientePista(id);
  const ayuda = $('#ayuda');
  if (ayuda) montarAyuda(ayuda, id);
  return r.texto;
}

function guardarHistorial() {
  try { sessionStorage.setItem(`jarvis-chat-${eq().creado}`, JSON.stringify(historial.slice(-20))); } catch (e) { /* nada */ }
}
function cargarHistorial() {
  try { historial = JSON.parse(sessionStorage.getItem(`jarvis-chat-${eq().creado}`) || '[]'); } catch (e) { historial = []; }
}

// --- bitácora ---
function pestanaBitacora(cont) {
  const b = eq().bitacora || {};
  cont.innerHTML = `<h2>Bitácora de la misión</h2>
    <p class="tenue" style="margin-top:0">Cada estación les da una pieza para el reto final contra Ultrón. Anótenla aquí: se guarda en esta tablet.</p>
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
    await guardarFoto(blob, { equipo: eq().creado, lugar });
    if (!(eq().logros && eq().logros.foto)) estado.cambiar({ logros: { foto: 1 } });
    aviso('📸 Foto guardada');
    pintarGaleria();
  });
}

async function pintarGaleria() {
  const g = $('#galeria');
  if (!g) return;
  const fotos = await listarFotos(eq().creado);
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
    <div class="fila-botones"><a class="btn btn-primario" href="${url}" download="jarvis-${eq().creado}-${f.id}.jpg">Descargar</a><button class="btn btn-rojo" data-borrar>Borrar</button></div>`,
  { alCerrar: () => URL.revokeObjectURL(url) });
  m.el.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar esta foto?', { si: 'Borrar', peligro: true }))) return;
    await borrarFoto(f.id);
    m.cerrar();
    pintarGaleria();
  });
}

// --- misiones ---
function pestanaMisiones(cont) {
  const lista = misionesVisibles(conIA(), puedeEscuchar).filter((m) => m.fase === 2);
  const obligatorias = lista.filter((m) => !m.opcional);
  const pendientes = obligatorias.filter((m) => !cumplida(m, eq()));
  const extras = lista.filter((m) => m.opcional);
  const hechas = obligatorias.filter((m) => cumplida(m, eq()));
  const total = obligatorias.length;
  const textoComo = (m) => m.como.replace(/\{jarvis\}/g, eq().jarvis.nombre);
  const tarjetaMision = (m, destacada) => {
    const hecha = cumplida(m, eq());
    const prog = m.progreso ? m.progreso(eq()) : null;
    const boton = m.accion ? (hecha ? 'Otra vez' : '¡Jugar!') : m.ir ? 'Ir' : 'Escanear';
    return `<div class="mision-item ${destacada ? 'destacada' : ''} ${hecha ? 'hecha' : ''}" style="--c:${m.color}">
      <span class="mision-icono">${hecha ? '✓' : icono(m.icono)}</span>
      <div><b>${esc(m.titulo)}${prog && !hecha ? ` <span class="mision-estado">${prog[0]}/${prog[1]}</span>` : ''}</b>
        ${hecha && !m.accion ? '' : `<span class="tenue">${esc(textoComo(m))}</span>`}</div>
      ${hecha && !m.accion ? '' : `<button class="btn btn-chico ${destacada ? 'btn-primario' : ''}" data-hacer="${m.id}">${boton}</button>`}
    </div>`;
  };
  cont.innerHTML = `<div class="cabeza-misiones"><h2 style="margin:0">Misiones</h2><span class="mono">${hechas.length}/${total}</span></div>
    <div class="progreso" style="margin:8px 0 12px"><div class="barra-p"><i style="width:${(hechas.length / Math.max(1, total)) * 100}%"></i></div></div>
    ${pendientes.length ? '' : `<div class="panel centro" style="margin-bottom:12px">🏆 <b>¡Completaron todas las misiones!</b><br><span class="tenue">Prueben los extras de abajo o sigan platicando con ${esc(eq().jarvis.nombre)}.</span></div>`}
    <div class="lista">${pendientes.slice(0, 3).map((m, i) => tarjetaMision(m, i === 0)).join('')}
      ${pendientes.length > 3 ? `<div class="mision-item bloqueada"><span class="mision-icono">🔒</span><div><b>${pendientes.length - 3} misiones más</b><span class="tenue">Se desbloquean al cumplir estas.</span></div></div>` : ''}</div>
    ${extras.length ? `<h3 class="titulo-extras">⭐ Extra para divertirse <span class="tenue">(opcionales)</span></h3><div class="lista">${extras.map((m) => tarjetaMision(m)).join('')}</div>` : ''}
    ${hechas.length ? `<details class="mas"><summary>Completadas (${hechas.length})</summary><div class="lista">${hechas.map((m) => tarjetaMision(m)).join('')}</div></details>` : ''}
    <div class="fila-botones" style="margin-top:14px">
      <button class="btn btn-chico" data-accion="escanear">${icono('qr')} Escanear tarjeta</button>
      <button class="btn-texto" data-accion="modulos">Ver módulos</button>
      <button class="btn-texto" data-accion="ficha">Ver a ${esc(eq().jarvis.nombre)} por dentro</button>
      <button class="btn-texto" data-accion="reencender">Repetir el encendido</button>
    </div>`;
  cont.querySelectorAll('[data-hacer]').forEach((b) => b.addEventListener('click', () => {
    const m = MISIONES.find((x) => x.id === b.dataset.hacer);
    if (m.accion) { ({ dibujo: misionDibujo, despertar: misionDespertar, trabalenguas: misionTrabalenguas })[m.accion](); return; }
    if (m.ir === 'camara' && !tieneHabilidad('camara')) { aviso('Primero escaneen la tarjeta CÁMARA.'); abrirEscanerTarjetas(); return; }
    if (m.ir) { pestana = m.ir; pintarPestanas(); pintarPestana(); return; }
    abrirEscanerTarjetas();
  }));
  cont.querySelector('[data-accion="escanear"]').addEventListener('click', abrirEscanerTarjetas);
  cont.querySelector('[data-accion="modulos"]').addEventListener('click', verModulos);
  cont.querySelector('[data-accion="ficha"]').addEventListener('click', abrirFicha);
  cont.querySelector('[data-accion="reencender"]').addEventListener('click', encender);
}

// ---------- misiones extra (opcionales, para divertirse) ----------
const quitarAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Retrato de Ultrón: dibujan a Ultrón en papel, le toman foto y JARVIS lo "escanea". */
function misionDibujo() {
  const md = modal(`<div class="cabeza-modulo" style="--c:#ff1638">${icono('ultron')}<div><h2>Retrato de Ultrón</h2></div></div>
    <p class="sabias-corto">✏️ En una hoja, dibujen a mano cómo se imaginan a Ultrón. Cuando esté listo, apunten la cámara al dibujo.</p>
    <div class="visor-dibujo" id="vd"><video muted playsinline></video></div>
    <p class="tenue centro" id="vd-estado" style="font-size:15px;margin:6px 0 0">Abriendo cámara…</p>
    <div id="vd-resultado"></div>
    <div class="fila-botones acciones-hoja" id="vd-botones"><button class="btn btn-primario btn-grande" data-foto style="flex:1">📸 Escanear el dibujo</button></div>`,
  { color: '#ff1638', alCerrar: () => cerrarCamara() });
  const video = md.el.querySelector('video');
  const estadoTxt = md.el.querySelector('#vd-estado');
  abrirCamara(video, { usarFrente: false })
    .then(() => { estadoTxt.textContent = 'Que se vea toda la hoja, con buena luz.'; })
    .catch(() => { estadoTxt.textContent = 'No se pudo abrir la cámara. Den permiso de cámara al navegador.'; });
  md.el.querySelector('[data-foto]').addEventListener('click', async (ev) => {
    if (!video.videoWidth) { aviso('La cámara todavía no está lista.', { mal: true }); return; }
    ev.currentTarget.disabled = true;
    // la foto chica (para analizarla) y la de la galería (con marco)
    const escala = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(video.videoWidth * escala);
    lienzo.height = Math.round(video.videoHeight * escala);
    const g = lienzo.getContext('2d', { willReadFrequently: true });
    g.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    const imagen = lienzo.toDataURL('image/jpeg', 0.78);
    const paraGaleria = await capturar(video, { titulo: 'Retrato de Ultrón', subtitulo: `${eq().nombre} · ${eq().jarvis.nombre}`, color: '#ff1638' }).catch(() => null);
    cerrarCamara();
    const visor = md.el.querySelector('#vd');
    visor.innerHTML = `<img src="${imagen}" alt="Dibujo de Ultrón"><div class="linea-escaneo"></div>`;
    visor.classList.add('analizando');
    estadoTxt.textContent = 'Analizando amenaza…';
    subtitulo('Analizando amenaza…');
    sonido('escaneo');
    if (nucleo) nucleo.hablando(true);
    const minimo = new Promise((r) => setTimeout(r, 2600));
    let texto = null;
    let cerebro = 'basico';
    if (usarIA()) {
      try {
        const r = await llamar('POST', '/api/chat', { tipo: 'dibujo', dispositivo: dispositivo(), jarvis: datosParaIA(), imagen }, { timeout: 30000 });
        texto = r.texto;
        cerebro = 'ia';
        if (typeof r.restantes === 'number') restantesIA = r.restantes;
      } catch (e) {
        if (e.datos && typeof e.datos.restantes === 'number') restantesIA = e.datos.restantes;
      }
    }
    if (!texto) texto = analisisBasico(g, lienzo.width, lienzo.height);
    await minimo;
    if (nucleo) nucleo.hablando(false);
    visor.classList.remove('analizando');
    visor.classList.add('identificado');
    sonido('ultron');
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    estadoTxt.textContent = '';
    md.el.querySelector('#vd-resultado').innerHTML = `<div class="amenaza"><b>⚠ AMENAZA IDENTIFICADA</b><p>${esc(texto)}</p>
      <span class="cerebro-tag">${cerebro === 'ia' ? '✨ Analizado por la súper inteligencia' : '🧠 Análisis del cerebro básico'}${paraGaleria ? ' · Guardado en la galería' : ''}</span></div>`;
    md.el.querySelector('#vd-botones').innerHTML = '<button class="btn btn-grande" data-otro>📸 Otro dibujo</button><button class="btn btn-primario btn-grande" data-listo style="flex:1">Listo</button>';
    md.el.querySelector('[data-otro]').addEventListener('click', () => { md.cerrar(); misionDibujo(); });
    md.el.querySelector('[data-listo]').addEventListener('click', md.cerrar);
    if (paraGaleria) guardarFoto(paraGaleria, { equipo: eq().creado, lugar: 'Retrato de Ultrón' }).catch(() => {});
    estado.cambiar({ logros: { dibujo: 1 } });
    decir(texto);
  });
}

/** Sin IA: un "escaneo" con lo que se puede medir de la foto (tinta, rojo, colores). */
function analisisBasico(g, w, h) {
  const datos = g.getImageData(0, 0, w, h).data;
  let tinta = 0; let rojo = 0; let color = 0; let n = 0;
  for (let i = 0; i < datos.length; i += 16) {
    const r = datos[i]; const v = datos[i + 1]; const a = datos[i + 2];
    const lum = 0.3 * r + 0.59 * v + 0.11 * a;
    const sat = Math.max(r, v, a) - Math.min(r, v, a);
    if (lum < 95) tinta++;
    if (r > 130 && r > v * 1.45 && r > a * 1.45) rojo++;
    if (sat > 70) color++;
    n++;
  }
  tinta /= n; rojo /= n; color /= n;
  const alAzarDe = (l) => l[Math.floor(Math.random() * l.length)];
  const rasgo = rojo > 0.004 ? 'Detecto rojo: ojos láser activados.'
    : color > 0.12 ? 'Veo muchos colores: es un Ultrón con mucho estilo.'
      : 'Puro trazo de lápiz: es un Ultrón en modo sigiloso.';
  const detalle = tinta > 0.16 ? 'Tiene muchísimos detalles: se nota que lo dibujaron con ganas.' : 'Trazos limpios y precisos: un Ultrón minimalista.';
  const nivel = Math.min(99, 62 + Math.round(tinta * 90 + rojo * 300 + color * 40 + Math.random() * 8));
  const debil = alAzarDe(['los chistes malos', 'las cosquillas en los tornillos', 'el wifi lento', 'los gatitos', 'las matemáticas bien explicadas', 'los abrazos de equipo', 'la música de banda a todo volumen']);
  return `Amenaza identificada: Ultrón. ${rasgo} ${detalle} Nivel de amenaza: ${nivel}%. Punto débil: ${debil}. ¡Excelente retrato, equipo ${eq().nombre}!`;
}

/** Despiértenlo con la voz: dicen "Oye, NOMBRE" al micrófono. */
function misionDespertar() {
  const nombre = eq().jarvis.nombre;
  const md = modal(`<div class="cabeza-modulo" style="--c:#3fd0ff">${icono('mic')}<div><h2>Despiértenlo con la voz</h2></div></div>
    <p class="sabias-corto">💡 Así funcionan Alexa y Siri: escuchan una <b>palabra de activación</b> y entonces despiertan.</p>
    <p class="centro" style="font-size:22px;margin:10px 0">Digan todos juntos, fuerte:<br><b style="font-size:30px;color:var(--acento)">“¡Oye, ${esc(nombre)}!”</b></p>
    <div class="centro"><button class="btn-mic-grande" data-mic aria-label="Escuchar">${icono('mic')}</button></div>
    <p class="centro tenue" id="dz-estado" style="min-height:48px;font-size:17px">Toquen el micrófono y hablen.</p>
    <div class="fila-botones acciones-hoja"><button class="btn btn-primario btn-grande" data-listo style="flex:1">Listo</button></div>`, { color: '#3fd0ff', alCerrar: () => detenerEscucha() });
  const est = md.el.querySelector('#dz-estado');
  const mic = md.el.querySelector('[data-mic]');
  md.el.querySelector('[data-listo]').addEventListener('click', md.cerrar);
  mic.addEventListener('click', async () => {
    if (mic.classList.contains('escuchando')) { detenerEscucha(); return; }
    callar();
    mic.classList.add('escuchando');
    est.textContent = 'Escuchando…';
    const texto = await escuchar({ alParcial: (t) => { est.textContent = `“${t}”`; } });
    mic.classList.remove('escuchando');
    const oido = quitarAcentos(texto);
    const ok = oido && (oido.includes(quitarAcentos(nombre)) || /\b(oye|oie|olle|hey|ey)\b/.test(oido));
    if (ok) {
      est.innerHTML = `<b style="color:var(--verde)">✓ ¡Lo despertaron!</b> Escuché: “${esc(texto)}”`;
      sonido('enLinea');
      if (nucleo) nucleo.modo('fiesta');
      setTimeout(() => { if (nucleo) nucleo.modo(null); }, 2500);
      estado.cambiar({ logros: { despertar: 1 } });
      decir(`¡Aquí estoy! Me despertaron con su voz. ¿En qué les ayudo, equipo ${eq().nombre}?`);
    } else if (texto) {
      est.innerHTML = `Escuché: “${esc(texto)}”. Intenten otra vez, más fuerte: <b>¡Oye, ${esc(nombre)}!</b>`;
      sonido('error');
    } else {
      est.textContent = 'No escuché nada. Acérquense a la tablet y hablen fuerte.';
    }
  });
}

const TRABALENGUAS = [
  'Tres tristes tigres tragaban trigo en un trigal',
  'Pablito clavó un clavito. ¿Qué clavito clavó Pablito?',
  'Como poco coco como, poco coco compro',
  'Pepe Pecas pica papas con un pico',
  'El cielo está enladrillado. ¿Quién lo desenladrillará?',
  'Erre con erre cigarro, erre con erre barril, rápido ruedan los carros cargados de azúcar del ferrocarril',
  'Compadre, cómprame un coco. Compadre, coco no compro',
  'Si la sierva que te sirve no te sirve como sierva, ¿de qué sirve que te sirvas de una sierva que no sirve?',
];

/** Qué tanto del trabalenguas dijeron (palabras que coinciden, en %). */
function puntajeTrabalenguas(objetivo, dicho) {
  const quiero = quitarAcentos(objetivo).split(' ').filter(Boolean);
  const tengo = quitarAcentos(dicho).split(' ').filter(Boolean);
  const bolsa = new Map();
  tengo.forEach((p) => bolsa.set(p, (bolsa.get(p) || 0) + 1));
  let bien = 0;
  quiero.forEach((p) => { if (bolsa.get(p)) { bien++; bolsa.set(p, bolsa.get(p) - 1); } });
  return Math.round((bien / Math.max(1, quiero.length)) * 100);
}

/** Duelo de trabalenguas: JARVIS lo dice, el equipo lo repite y sale un porcentaje. */
function misionTrabalenguas(indice = Math.floor(Math.random() * TRABALENGUAS.length)) {
  const frase = TRABALENGUAS[indice % TRABALENGUAS.length];
  const mejor = (eq().logros && eq().logros.trabalenguas) || 0;
  const md = modal(`<div class="cabeza-modulo" style="--c:#a78bfa">${icono('voz')}<div><h2>Duelo de trabalenguas</h2></div></div>
    <p class="tenue" style="margin:0">Escuchen a ${esc(eq().jarvis.nombre)} y luego repítanlo al micrófono, rápido y sin trabarse.</p>
    <p class="trabalenguas">“${esc(frase)}”</p>
    <div class="centro"><button class="btn-mic-grande" data-mic aria-label="Repetir al micrófono">${icono('mic')}</button></div>
    <p class="centro tenue" id="tb-estado" style="min-height:48px;font-size:17px">Cuando terminen de escucharlo, toquen el micrófono.</p>
    <div id="tb-puntaje"></div>
    <p class="centro tenue" style="font-size:14px;margin:0">Mejor puntaje del equipo: <b id="tb-mejor">${mejor}%</b></p>
    <div class="fila-botones acciones-hoja">${ESCUCHAR}<button class="btn btn-grande" data-otro>🔀 Otro</button><button class="btn btn-primario btn-grande" data-listo style="flex:1">Listo</button></div>`, { color: '#a78bfa', alCerrar: () => detenerEscucha() });
  const est = md.el.querySelector('#tb-estado');
  const mic = md.el.querySelector('[data-mic]');
  md.el.querySelector('[data-probar]').addEventListener('click', () => decir(frase));
  md.el.querySelector('[data-otro]').addEventListener('click', () => { md.cerrar(); misionTrabalenguas(indice + 1); });
  md.el.querySelector('[data-listo]').addEventListener('click', md.cerrar);
  mic.addEventListener('click', async () => {
    if (mic.classList.contains('escuchando')) { detenerEscucha(); return; }
    callar();
    mic.classList.add('escuchando');
    est.textContent = 'Escuchando… ¡ahora!';
    const texto = await escuchar({ alParcial: (t) => { est.textContent = `“${t}”`; } });
    mic.classList.remove('escuchando');
    if (!texto) { est.textContent = 'No escuché nada. Acérquense y hablen fuerte.'; return; }
    const pts = puntajeTrabalenguas(frase, texto);
    est.innerHTML = `Escuché: “${esc(texto)}”`;
    const comentario = pts >= 90 ? '¡Perfecto! Ni un robot lo dice mejor.' : pts >= 60 ? '¡Muy bien! Casi perfecto.' : '¡Casi! Inténtenlo otra vez, un poco más despacio.';
    md.el.querySelector('#tb-puntaje').innerHTML = `<div class="puntaje-tb"><b>${pts}%</b><div class="barra-p"><i style="width:${pts}%"></i></div><span>${esc(comentario)}</span></div>`;
    sonido(pts >= 60 ? 'enLinea' : 'error');
    const antes = (eq().logros && eq().logros.trabalenguas) || 0;
    if (pts > antes) { estado.cambiar({ logros: { trabalenguas: pts } }); md.el.querySelector('#tb-mejor').textContent = `${pts}%`; }
    decir(`${pts} por ciento. ${comentario}`);
  });
  setTimeout(() => decir(frase), 400);
}

// --- ficha: el JARVIS por dentro ---
function abrirFicha() {
  const e = eq();
  const v = ajustesVoz();
  const s = (t) => `<span class="s">"${esc(t)}"</span>`;
  const n = (t) => `<span class="n">${esc(t)}</span>`;
  const habs = Object.entries(e.habilidades || {}).filter(([, x]) => x).map(([k]) => s(k)).join(', ');
  const p = PERSONALIDADES[e.personalidad.id];
  const encendidoEn = e.encendido ? hora(e.encendido) : '--:--';
  modal(`<h2>${esc(e.jarvis.nombre)} por dentro</h2>
    <p class="tenue" style="margin-top:0">Esto es lo que programaron hoy:</p>
    <pre class="codigo"><span class="c">// jarvis.config.js</span>
<span class="k">const</span> <span class="p">jarvis</span> = {
  nombre: ${s(e.jarvis.nombre)},
  equipo: ${s(e.nombre)},
  activacion: ${s(`Oye, ${e.jarvis.nombre}`)},
  voz: { estilo: ${s(VOCES[e.voz.id].nombre)}, tono: ${n(v.tono.toFixed(2))}, velocidad: ${n(v.velocidad.toFixed(2))} },
  nucleo: { forma: ${s(NUCLEOS[e.nucleo.id].forma)}, color: ${s(colorEquipo())} },
  ambiente: ${instalado('ambiente') ? s(AMBIENTES[e.ambiente.id].tipo) : '<span class="k">null</span>'},
  personalidad: ${s(p.nombre)},
  escudo: ${instalado('escudo') ? '<span class="k">true</span>' : '<span class="k">false</span>'},
  cerebro: ${s(cerebroIA() ? 'super inteligencia + basico' : 'basico')},
  habilidades: [${habs}],
  encendido: ${s(encendidoEn)},
};</pre>
    <h3 style="margin-top:16px">Directiva principal (prompt de sistema)</h3>
    <pre class="codigo">Eres ${esc(e.jarvis.nombre)}, el asistente del equipo "${esc(e.nombre)}".
Reglas del staff: ${esc(REGLAS_FIJAS.join(' '))}${e.escudo.regla ? `\nRegla del equipo: ${esc(e.escudo.regla)}` : ''}
Personalidad: ${esc(p.nombre)}. Hablas como ${esc(e.personalidad.habla || p.habla)}.
Te encanta ${esc(e.personalidad.encanta || 'ayudar a tu equipo')}. Nunca ${esc(e.personalidad.nunca || 'te rindes')}.</pre>`);
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

/** La siguiente pista de una estación (en el reto que eligieron). La usan el botón y el chat. */
function siguientePista(id) {
  const a = AYUDA_ESTACIONES[id];
  const p = leerPistas();
  const nivel = a.niveles ? Number(p[`${id}:nivel`] ?? -1) : -1;
  const lista = a.niveles ? (nivel >= 0 ? a.niveles[nivel].pistas : null) : a.pistas;
  if (!lista) return { titulo: 'PRIMERO', texto: 'Díganme en qué reto van: tóquenlo en la ayuda de la estación y les doy una pista de ese.', nueva: false };
  const clave = `${id}:${a.niveles ? nivel : 'g'}`;
  const i = p[clave] || 0;
  let r;
  if (i >= lista.length) {
    r = { titulo: 'YA NO HAY MÁS PISTAS', texto: 'Ya les di todas las pistas de esto. Pregúntenme por un concepto o pídanle ayuda al facilitador del taller.', nueva: false };
    p[clave] = 0;
  } else {
    r = { titulo: `PISTA ${i + 1} DE ${lista.length}`, texto: lista[i], nueva: true };
    p[clave] = i + 1;
  }
  guardarPistas(p);
  return r;
}

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
      const r = siguientePista(id);
      mostrar(r.titulo, r.texto);
      if (r.nueva) sonido('escaneo');
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
    ${sinEquipo ? `<p class="tenue">¿Todavía no tienen JARVIS en esta tablet? Créenlo para hacerle preguntas.</p>
      <div class="fila-botones"><button class="btn btn-primario" data-crear>Crear nuestro JARVIS</button></div>` : ''}
    ${!sinEquipo && !eq().encendido ? '<p class="tenue">Cuando enciendan su JARVIS, esta ayuda también aparece en la pestaña Hablar.</p>' : ''}`);
  montarAyuda(m.el.querySelector('#ayuda-modal'), id);
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

// ---------- arranque de la página ----------
const params = new URLSearchParams(location.search);
let tarjetaPendiente = (params.get('t') || '').toUpperCase();
const estacionPendiente = AYUDA_ESTACIONES[params.get('estacion')] ? params.get('estacion') : '';
if (tarjetaPendiente || params.get('unirse') || estacionPendiente) {
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
  // en el armado, si no es la tarjeta del paso, se avisa de una vez (sin botón de "Instalar")
  if (enArmado() && (t.tipo !== 'modulo' || t.modulo !== pasoActual().id)) { tarjetaEquivocada(codigo, t); return; }
  // el navegador solo deja hablar después de un toque: pedimos confirmación
  const m = modal(`<div class="cabeza-modulo" style="--c:${colorTarjeta(codigo)}">${icono(t.tipo === 'modulo' ? t.modulo : t.tipo === 'accion' ? 'accion' : 'ultron')}<div><h2>${esc(t.nombre)}</h2><span class="tenue">Tarjeta ${codigo}</span></div></div>
    <p>${esc(t.desc)}</p><button class="btn btn-primario btn-grande" style="width:100%">${t.tipo === 'accion' ? 'Activar' : 'Instalar'}</button>`, { color: colorTarjeta(codigo) });
  m.el.querySelector('.btn-primario').addEventListener('click', () => { m.cerrar(); usarTarjeta(codigo); });
}

estado.on('cambio', () => render());

estado.cargar();
if (eq()) cargarHistorial();
render(true);

if (tarjetaPendiente && eq()) {
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
