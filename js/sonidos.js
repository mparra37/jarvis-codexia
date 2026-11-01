/* JARVIS · efectos de sonido con Web Audio (no hay archivos de audio) */

let ctx = null;
function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Llamar en el primer toque del usuario (iPhone no deja sonar nada antes). */
export function desbloquearAudio() { audio(); }

function tono(frec, inicio, dur, { tipo = 'sine', vol = 0.18, hasta = null, ataque = 0.01 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + inicio;
  const osc = a.createOscillator();
  const gan = a.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frec, t0);
  if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
  gan.gain.setValueAtTime(0.0001, t0);
  gan.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gan).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function ruido(inicio, dur, vol = 0.12, filtro = 1200) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + inicio;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / datos.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filtro;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

const SONIDOS = {
  clic: () => tono(900, 0, 0.05, { tipo: 'square', vol: 0.05 }),
  instalar: () => { [523, 659, 784, 1047].forEach((f, i) => tono(f, i * 0.07, 0.25, { tipo: 'triangle', vol: 0.14 })); },
  error: () => { tono(220, 0, 0.18, { tipo: 'sawtooth', vol: 0.08 }); tono(160, 0.16, 0.25, { tipo: 'sawtooth', vol: 0.08 }); },
  escaneo: () => tono(1400, 0, 0.08, { tipo: 'square', vol: 0.06 }),
  arranque: () => { tono(80, 0, 1.6, { tipo: 'sawtooth', vol: 0.12, hasta: 640, ataque: 0.3 }); tono(160, 0.2, 1.4, { tipo: 'sine', vol: 0.1, hasta: 1280, ataque: 0.3 }); },
  enLinea: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tono(f, i * 0.09, 0.5, { tipo: 'triangle', vol: 0.13 })); },
  ultron: () => { tono(70, 0, 1.4, { tipo: 'sawtooth', vol: 0.2, hasta: 45 }); tono(73, 0, 1.4, { tipo: 'square', vol: 0.08, hasta: 40 }); ruido(0, 1.2, 0.18, 600); },
  anuncio: () => { tono(880, 0, 0.35, { vol: 0.15 }); tono(1320, 0.18, 0.5, { vol: 0.12 }); },
  foto: () => ruido(0, 0.12, 0.25, 4000),
  // sonidos de activación de cada voz
  campana: () => { tono(1568, 0, 0.9, { vol: 0.12 }); tono(2093, 0.05, 0.8, { vol: 0.06 }); },
  bip: () => { tono(1200, 0, 0.08, { tipo: 'square', vol: 0.07 }); tono(800, 0.1, 0.08, { tipo: 'square', vol: 0.07 }); tono(1600, 0.2, 0.1, { tipo: 'square', vol: 0.07 }); },
  radio: () => { ruido(0, 0.25, 0.1, 2500); tono(1000, 0.25, 0.12, { vol: 0.08 }); },
  burbuja: () => { tono(400, 0, 0.12, { vol: 0.12, hasta: 1600 }); tono(600, 0.12, 0.12, { vol: 0.1, hasta: 2000 }); },
  tambor: () => { tono(110, 0, 0.4, { vol: 0.3, hasta: 50 }); ruido(0, 0.15, 0.1, 300); },
  sonar: () => { tono(1046, 0, 0.9, { vol: 0.1 }); tono(1046, 0.5, 0.7, { vol: 0.04 }); },
};

export function sonido(nombre) {
  try { if (SONIDOS[nombre]) SONIDOS[nombre](); } catch (e) { /* sin audio */ }
}

/** Música de fiesta: un ritmo sencillo durante "segundos". */
export function fiesta(segundos = 10) {
  const a = audio();
  if (!a) return;
  const bpm = 124;
  const paso = 60 / bpm / 2;
  const bajo = [55, 55, 82.4, 55, 73.4, 55, 82.4, 98];
  const pasos = Math.floor(segundos / paso);
  for (let i = 0; i < pasos; i++) {
    const t = i * paso;
    if (i % 2 === 0) tono(140, t, 0.18, { vol: 0.32, hasta: 45 });
    if (i % 4 === 2) ruido(t, 0.08, 0.12, 6000);
    tono(bajo[i % 8] * 2, t, paso * 0.9, { tipo: 'sawtooth', vol: 0.05 });
    if (i % 8 === 4) tono(659, t, 0.15, { tipo: 'square', vol: 0.04 });
  }
}
