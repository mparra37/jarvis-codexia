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
    .sort((a, b) => rango(a) - rango(b));
}
function rango(v) {
  const lang = v.lang.replace('_', '-');
  const i = PREFERENCIA.findIndex((p) => lang.toLowerCase().startsWith(p.toLowerCase()));
  return (i < 0 ? 9 : i) * 10 + (v.localService ? 0 : 1);
}
if (sintesis) {
  cargarVoces();
  sintesis.addEventListener?.('voiceschanged', cargarVoces);
}

export function vocesEspanol() { cargarVoces(); return voces.slice(); }
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

  cargarVoces();
  let voz = null;
  if (ajustes.vozNombre) voz = voces.find((v) => v.name === ajustes.vozNombre) || null;
  if (!voz && voces.length) voz = voces[(ajustes.voz || 0) % voces.length];

  return new Promise((resolver) => {
    let terminado = false;
    const fin = () => {
      if (terminado) return;
      terminado = true;
      if (mio === turno) avisar(false);
      resolver();
    };
    const respaldo = setTimeout(fin, estimado + 2500);
    lista.forEach((frase, i) => {
      const u = new SpeechSynthesisUtterance(frase);
      u.lang = voz ? voz.lang : 'es-MX';
      if (voz) u.voice = voz;
      u.pitch = Math.max(0, Math.min(2, ajustes.tono ?? 1));
      u.rate = velocidad;
      u.volume = 1;
      if (i === 0) u.onstart = () => { if (mio === turno) avisar(true); };
      if (i === lista.length - 1) {
        u.onend = () => { clearTimeout(respaldo); fin(); };
      }
      u.onerror = () => { if (i === lista.length - 1) { clearTimeout(respaldo); fin(); } };
      sintesis.speak(u);
    });
    // si el navegador no lanza onstart (pasa en algunos Android), igual animamos el núcleo
    setTimeout(() => { if (!terminado && mio === turno && !hablandoAhora) avisar(true); }, 600);
  });
}

export function callar(avisarFin = true) {
  if (sintesis) { try { sintesis.cancel(); } catch (e) { /* nada */ } }
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
