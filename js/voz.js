/* JARVIS · voz: hablar (speechSynthesis) y escuchar (SpeechRecognition)
 *
 * Las voces dependen del aparato: Android, iPhone y Windows traen voces distintas. Por eso cada
 * "voz" de JARVIS es un tono, una velocidad y cuál de las voces en español usar.
 */

const sintesis = window.speechSynthesis || null;
let voces = [];
const oyentes = new Set();
let hablandoAhora = false;

const PREFERENCIA = ['es-MX', 'es-US', 'es-419', 'es-ES', 'es'];

function cargarVoces() {
  if (!sintesis) return;
  const todas = sintesis.getVoices();
  voces = todas
    .filter((v) => /^es([-_]|$)/i.test(v.lang))
    .sort((a, b) => rango(a) - rango(b) || a.name.localeCompare(b.name));
}
function rango(v) {
  const lang = v.lang.replace('_', '-');
  const i = PREFERENCIA.findIndex((p) => lang.toLowerCase().startsWith(p.toLowerCase()));
  // primero las voces del aparato: las "de red" fallan sin internet y el navegador usa la de siempre
  return (v.localService ? 0 : 100) + (i < 0 ? 9 : i) * 10;
}
if (sintesis) {
  cargarVoces();
  sintesis.addEventListener?.('voiceschanged', cargarVoces);
}

/**
 * Android carga la lista de voces un momento después de abrir la página. Si JARVIS habla antes
 * (por ejemplo, justo después de escanear una tarjeta con la cámara del celular), la lista está
 * vacía y el navegador usa la voz que trae el celular. Por eso esperamos a que la lista exista.
 */
let promesaVoces = null;
function listasVoces() {
  if (!sintesis) return Promise.resolve();
  cargarVoces();
  if (voces.length || sintesis.getVoices().length) return Promise.resolve();
  if (!promesaVoces) {
    promesaVoces = new Promise((resolver) => {
      const inicio = Date.now();
      const revisar = () => {
        cargarVoces();
        if (sintesis.getVoices().length || Date.now() - inicio > 2500) { promesaVoces = null; resolver(); return; }
        setTimeout(revisar, 100);
      };
      revisar();
    });
  }
  return promesaVoces;
}

/** La voz del aparato que usará JARVIS con estos ajustes (o null = la del aparato). */
export function vozElegida(ajustes = {}) {
  cargarVoces();
  let voz = null;
  if (ajustes.vozNombre) voz = voces.find((v) => v.name === ajustes.vozNombre) || null;
  if (!voz && voces.length) {
    // cada tarjeta de voz usa una voz distinta del aparato, pero solo entre las locales (las "de red"
    // fallan sin internet y el navegador vuelve a la voz de siempre)
    const locales = voces.filter((v) => v.localService);
    const opciones = locales.length ? locales : voces;
    voz = opciones[(ajustes.voz || 0) % opciones.length];
  }
  return voz;
}

export function vocesEspanol() { cargarVoces(); return voces.slice(); }
export { listasVoces };
export const puedeHablar = Boolean(sintesis);

function avisar(valor) {
  hablandoAhora = valor;
  oyentes.forEach((fn) => fn(valor));
}
/** fn(true|false) cada vez que JARVIS empieza o termina de hablar. */
export function alHablar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function estaHablando() { return hablandoAhora; }

/** Primer toque del usuario: algunos navegadores no dejan hablar antes. */
let desbloqueado = false;
export function desbloquearVoz() {
  if (desbloqueado || !sintesis) return;
  desbloqueado = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    sintesis.speak(u);
  } catch (e) { /* nada */ }
}

/** Parte el texto en frases (Chrome corta los textos largos a los 15 s). */
function frases(texto) {
  const limpio = String(texto).replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();
  const partes = limpio.match(/[^.!?¡¿;:]+[.!?;:]*|[¡¿][^.!?]+[.!?]*/g) || [limpio];
  const salida = [];
  let actual = '';
  for (const p of partes) {
    if ((actual + p).length > 180 && actual) { salida.push(actual.trim()); actual = ''; }
    actual += `${p} `;
  }
  if (actual.trim()) salida.push(actual.trim());
  return salida;
}

let turno = 0;
let ultimoCancel = 0;
const vivas = new Set(); // Chrome a veces "olvida" las frases (y no avisa al terminar) si nadie las guarda

/**
 * Dice un texto. ajustes: { tono, velocidad, voz (índice), vozNombre }.
 * Resuelve cuando termina (o al tiempo estimado, por si el navegador no avisa).
 */
export function hablar(texto, ajustes = {}) {
  const mio = ++turno;
  callar(false);
  if (!texto) return Promise.resolve();
  const lista = frases(texto);
  const velocidad = Math.max(0.5, Math.min(2, ajustes.velocidad ?? 1));
  const estimado = (String(texto).length * 75) / velocidad + 1500;

  if (!sintesis) {
    avisar(true);
    return new Promise((r) => setTimeout(() => { if (mio === turno) avisar(false); r(); }, Math.min(estimado, 12000)));
  }

  return new Promise((resolver) => {
    let terminado = false;
    const fin = () => {
      if (terminado) return;
      terminado = true;
      if (mio === turno) avisar(false);
      resolver();
    };
    let respaldo = null;
    const decirYa = () => {
      if (mio !== turno) { fin(); return; }
      const voz = vozElegida(ajustes);
      respaldo = setTimeout(fin, estimado + 2500);
      lista.forEach((frase, i) => {
        const u = new SpeechSynthesisUtterance(frase);
        u.lang = voz ? voz.lang.replace('_', '-') : 'es-MX';
        if (voz) u.voice = voz;
        u.pitch = Math.max(0, Math.min(2, ajustes.tono ?? 1));
        u.rate = velocidad;
        u.volume = 1;
        vivas.add(u);
        const soltar = () => vivas.delete(u);
        if (i === 0) u.onstart = () => { if (mio === turno) avisar(true); };
        u.onend = () => { soltar(); if (i === lista.length - 1) { clearTimeout(respaldo); fin(); } };
        u.onerror = () => { soltar(); if (i === lista.length - 1) { clearTimeout(respaldo); fin(); } };
        sintesis.speak(u);
      });
      // si el navegador no lanza onstart (pasa en algunos Android), igual animamos el núcleo
      setTimeout(() => { if (!terminado && mio === turno && !hablandoAhora) avisar(true); }, 600);
    };
    // esperar las voces y, si acabamos de cancelar otra frase, un instante (Android pierde la voz si no)
    listasVoces().then(() => {
      const espera = Math.max(0, 120 - (Date.now() - ultimoCancel));
      setTimeout(decirYa, espera);
    });
  });
}

export function callar(avisarFin = true) {
  if (sintesis && (sintesis.speaking || sintesis.pending)) {
    try { sintesis.cancel(); } catch (e) { /* nada */ }
    ultimoCancel = Date.now();
  }
  if (avisarFin) { turno++; avisar(false); }
}

// ---------- escuchar ----------
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition || null;
export const puedeEscuchar = Boolean(Reconocimiento);
let rec = null;

/** Escucha una frase. Resuelve con el texto ('' si no entendió). */
export function escuchar({ alParcial } = {}) {
  if (!Reconocimiento) return Promise.resolve('');
  detenerEscucha();
  return new Promise((resolver) => {
    let final = '';
    let parcial = '';
    rec = new Reconocimiento();
    rec.lang = 'es-MX';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else parcial += t;
      }
      if (alParcial) alParcial((final + parcial).trim());
    };
    rec.onerror = () => {};
    rec.onend = () => { rec = null; resolver((final || parcial).trim()); };
    try { rec.start(); } catch (e) { rec = null; resolver(''); }
  });
}

export function detenerEscucha() {
  if (rec) { try { rec.stop(); } catch (e) { /* nada */ } }
}
