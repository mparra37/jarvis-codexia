// Presentación del taller "Construye tu JARVIS" (CODEXIA). node construir.js <salida.pptx>
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const { applyTheme } = require('C:/Users/L03575539/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin/9c2e1430-f825-40ea-98f3-9963252308e8/309a0e2f-e716-4f88-bf09-8ff1328d6ba3/skills/pptx/scripts/apply_theme.js');
const qrcode = require('C:/dev/claude/jarvis-codexia/vendor/qrcode.js');

const SALIDA = process.argv[2] || 'JARVIS_taller_CODEXIA.pptx';
const URL_APP = 'https://mparra37.github.io/jarvis-codexia/';
const URL_CORTA = 'mparra37.github.io/jarvis-codexia';

const THEME = {
  name: 'JARVIS CODEXIA',
  headFontFace: 'Bahnschrift',
  bodyFontFace: 'Segoe UI',
  colors: {
    dk1: '05080F', lt1: 'FFFFFF', dk2: '0E1A2C', lt2: '9AB0C8',
    accent1: '3FD0FF', accent2: 'FF1638', accent3: '3DFF9A', accent4: 'FFD23F', accent5: 'A78BFA', accent6: 'F472B6',
    hlink: '3FD0FF', folHlink: 'A78BFA',
  },
};
const FONDO = '05080F';
const FONDO_ULTRON = '140006';

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 × 5.625
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Construye tu JARVIS · CODEXIA';
pres.author = 'CODEXIA · Tecnológico de Monterrey';
const C = pres.SchemeColor;
const BLANCO = C.background1;
const TENUE = C.background2;
const PANEL = C.text2;
const CIAN = C.accent1;
const ROJO = C.accent2;
const VERDE = C.accent3;
const AMARILLO = C.accent4;

// ---------- layouts ----------
const pie = (color) => [
  { text: { text: 'CODEXIA · J.A.R.V.I.S.', options: { x: 0.5, y: 5.2, w: 4, h: 0.25, fontSize: 9, color, charSpacing: 2, margin: 0 } } },
];
pres.defineSlideMaster({
  title: 'PORTADA',
  background: { color: FONDO },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.5, y: 1.55, w: 5.4, h: 1.7, fontSize: 44, bold: true, color: BLANCO, valign: 'top', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', align: 'left', x: 0.5, y: 3.35, w: 5.2, h: 0.9, fontSize: 18, color: TENUE, valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'SECCION',
  background: { color: FONDO },
  objects: [
    ...pie(TENUE),
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.5, y: 1.1, w: 5.6, h: 1.6, fontSize: 40, bold: true, color: CIAN, valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', align: 'left', x: 0.5, y: 2.9, w: 5.4, h: 1.7, fontSize: 18, color: BLANCO, valign: 'top', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.25, fontSize: 9, color: TENUE, align: 'right' },
});
pres.defineSlideMaster({
  title: 'ULTRON',
  background: { color: FONDO_ULTRON },
  objects: [
    ...pie(ROJO),
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.5, y: 1.1, w: 5.6, h: 1.6, fontSize: 40, bold: true, color: ROJO, valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', align: 'left', x: 0.5, y: 2.9, w: 5.4, h: 1.7, fontSize: 18, color: BLANCO, valign: 'top', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.25, fontSize: 9, color: ROJO, align: 'right' },
});
pres.defineSlideMaster({
  title: 'CONTENIDO',
  background: { color: FONDO },
  objects: [
    ...pie(TENUE),
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.5, y: 0.35, w: 9, h: 0.75, fontSize: 32, bold: true, color: BLANCO, valign: 'middle', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.25, fontSize: 9, color: TENUE, align: 'right' },
});

// ---------- motivo: el núcleo tipo reactor ----------
function reactor(slide, x, y, d, color = CIAN, nombre = 'reactor') {
  const cx = x + d / 2;
  const cy = y + d / 2;
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { type: 'none' }, line: { color, width: Math.max(1, d * 0.6), transparency: 60 }, objectName: `${nombre}-aro` });
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    const ini = i * (360 / seg) + 8;
    slide.addShape(pres.shapes.BLOCK_ARC, {
      x: x + d * 0.08, y: y + d * 0.08, w: d * 0.84, h: d * 0.84,
      fill: { color }, line: { type: 'none' }, angleRange: [ini, ini + 22], arcThicknessRatio: 0.12, objectName: `${nombre}-seg${i}`,
    });
  }
  slide.addShape(pres.shapes.OVAL, { x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6, fill: { type: 'none' }, line: { color, width: 1.5, dashType: 'dash' }, objectName: `${nombre}-punteado` });
  slide.addShape(pres.shapes.OVAL, { x: cx - d * 0.15, y: cy - d * 0.15, w: d * 0.3, h: d * 0.3, fill: { color }, line: { type: 'none' }, objectName: `${nombre}-nucleo` });
  slide.addShape(pres.shapes.OVAL, { x: cx - d * 0.07, y: cy - d * 0.07, w: d * 0.14, h: d * 0.14, fill: { color: BLANCO }, line: { type: 'none' }, objectName: `${nombre}-brillo` });
}

/** Círculo con texto adentro (números de pasos, códigos de tarjeta). */
function insignia(slide, x, y, d, texto, color, nombre, { relleno = false, tam = 18 } = {}) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: relleno ? { color } : { color, transparency: 82 }, line: { color, width: 2 }, objectName: `${nombre}-circulo` });
  slide.addText(texto, { x, y, w: d, h: d, align: 'center', valign: 'middle', fontSize: tam, bold: true, color: relleno ? C.text1 : color, fontFace: THEME.headFontFace, margin: 0, isTextBox: true, objectName: `${nombre}-texto` });
}

function tarjeta(slide, x, y, w, h, nombre, color = PANEL) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color }, line: { type: 'none' }, objectName: nombre });
}

async function qrPng(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const m = 2;
  let d = '';
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) d += `M${c + m} ${f + m}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" width="800" height="800" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#05080F"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${buf.toString('base64')}`;
}

function cuerpo(slide, texto, opciones) {
  slide.addText(texto, { isTextBox: true, margin: 0, color: BLANCO, fontSize: 16, valign: 'top', ...opciones });
}


/** Barra de tiempo: PowerPoint la llena sola (animación que agrega animar.ps1 a 'barra-tiempo-<segundos>'). */
function cronometro(s, minutos, color, y = 4.62) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 0.24, rectRadius: 0.12, fill: { color: PANEL }, line: { type: 'none' }, objectName: 'barra-fondo' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 0.24, rectRadius: 0.12, fill: { color }, line: { type: 'none' }, objectName: `barra-tiempo-${minutos * 60}` });
}

function video(s, nombre, x, y, w) {
  const h = w / 1.6;
  const portada = fs.readFileSync(path.join(__dirname, 'img', `portada_${nombre}.png`)).toString('base64');
  s.addMedia({ type: 'video', path: `C:/dev/claude/jarvis-codexia/videos/${nombre}.mp4`, x, y, w, h, cover: `image/png;base64,${portada}`, objectName: `video-${nombre}` });
}

(async () => {
  const qr = await qrPng(URL_APP);

  // 1 · Portada
  pres.addSection({ title: 'Inicio' });
  let s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Inicio' });
  s.addText('CODEXIA · TALLER DE INICIO', { x: 0.5, y: 1.05, w: 5, h: 0.35, fontSize: 13, bold: true, color: ROJO, charSpacing: 4, margin: 0, isTextBox: true });
  s.addText([{ text: 'PROTOCOLO', options: { breakLine: true } }, { text: 'J.A.R.V.I.S.', options: { color: CIAN } }], { placeholder: 'title' });
  s.addText('Construyan su propio asistente de inteligencia artificial', { placeholder: 'body' });
  s.addText('7 de noviembre · 9:00 · Salón de Congresos', { x: 0.5, y: 4.75, w: 5, h: 0.3, fontSize: 12, color: TENUE, margin: 0, isTextBox: true });
  reactor(s, 6.1, 0.95, 3.7);
  s.addNotes('8:55 · Mientras entran: que se sienten por equipos de 5 (los que vienen formados, juntos; a los demás el staff los acomoda). En cada mesa: una tablet con JARVIS abierto y un sobre con tarjetas. NO abran el sobre todavía.');

  // 2 · Ultrón
  s = pres.addSlide({ masterName: 'ULTRON', sectionTitle: 'Inicio' });
  s.addText('Ultrón ya está en el sistema', { placeholder: 'title' });
  s.addText('Para vencerlo, cada equipo necesita su propio asistente de IA. Hoy no vamos a usar ChatGPT ni ninguna otra IA: vamos a construir la nuestra.', { placeholder: 'body' });
  reactor(s, 6.5, 1.05, 3.0, ROJO, 'ultron');
  s.addNotes('9:00 · Díganlo con drama: "Ultrón ya está en el sistema. Para vencerlo, cada equipo va a necesitar su propio asistente. Hoy no vamos a usar ChatGPT ni ninguna otra IA: vamos a construir la nuestra."');

  // 3 · Así va a funcionar (las 3 fases)
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Inicio' });
  s.addText('Así va a funcionar', { placeholder: 'title' });
  const fases = [
    ['1', 'Armar', '15 min', 'Sigan las misiones de la tablet: nombre, voz, forma y personalidad.', CIAN],
    ['2', 'Encender', '5 min', 'Todos al mismo tiempo. Su JARVIS se presenta.', VERDE],
    ['3', 'Descubrir', '15 min', 'Misiones extra: preguntas, foto, tarjetas secretas…', AMARILLO],
  ];
  fases.forEach(([n, t, min, d, color], i) => {
    const x = 0.5 + i * 3.05;
    tarjeta(s, x, 1.35, 2.85, 3.15, `fase${n}`);
    insignia(s, x + 0.25, 1.6, 0.7, n, color, `fase-ins${n}`, { tam: 24 });
    s.addText(min, { x: x + 1.1, y: 1.6, w: 1.6, h: 0.7, fontSize: 24, bold: true, color, fontFace: THEME.headFontFace, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.25, y: 2.5, w: 2.4, h: 0.5, fontSize: 24, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    cuerpo(s, d, { x: x + 0.25, y: 3.05, w: 2.4, h: 1.3, fontSize: 15, color: TENUE });
  });
  s.addNotes('9:02 · Las 3 fases. La tablet siempre les dice qué hacer: una misión a la vez. Ustedes llevan el tiempo con estas diapositivas.');

  // 4 · Reglas de la mesa
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Inicio' });
  s.addText('Reglas de la mesa', { placeholder: 'title' });
  const reglas = [
    ['1', 'Todos escanean', 'Una tarjeta cada quien, por turnos. La tablet va pasando de mano en mano.', CIAN],
    ['2', 'Sigan la misión', 'La tablet dice qué tarjeta buscar. ¿No saben cómo? Toquen 📺 Ver cómo.', VERDE],
    ['3', 'Cuando vean PAUSA', 'Manos arriba, tablet en la mesa, ojos al frente.', AMARILLO],
    ['4', '¿Atorados?', 'Levanten la mano: alguien del staff va a su mesa.', ROJO],
  ];
  reglas.forEach(([n, t, d, color], i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = 0.5 + col * 4.6;
    const y = 1.45 + fila * 1.6;
    insignia(s, x, y, 0.75, n, color, `regla${n}`, { tam: 22 });
    s.addText(t, { x: x + 0.95, y, w: 3.4, h: 0.4, fontSize: 19, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    cuerpo(s, d, { x: x + 0.95, y: y + 0.42, w: 3.4, h: 0.9, fontSize: 14, color: TENUE });
  });
  s.addNotes('Practiquen la PAUSA una vez ahora: "¡Pausa!", y esperen a que todos levanten la mano. Así funciona durante todo el taller (siguiente diapositiva de pausa: la pueden mostrar cuando quieran).');

  // 5 · En su mesa
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Inicio' });
  s.addText('En su mesa', { placeholder: 'title' });
  insignia(s, 0.5, 1.45, 0.75, '▭', CIAN, 'tablet', { tam: 22 });
  s.addText('Una tablet', { x: 1.45, y: 1.45, w: 4, h: 0.4, fontSize: 20, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
  cuerpo(s, 'Con JARVIS abierto. Si no, escaneen el QR de la derecha y toquen Crear nuestro JARVIS.', { x: 1.45, y: 1.85, w: 4.2, h: 0.7, fontSize: 15, color: TENUE });
  insignia(s, 0.5, 2.85, 0.75, '36', AMARILLO, 'sobre', { tam: 18 });
  s.addText('Un sobre con 36 tarjetas', { x: 1.45, y: 2.85, w: 4.2, h: 0.4, fontSize: 20, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
  cuerpo(s, 'Cada tarjeta es una pieza de JARVIS. Si la cámara falla, escriban el código de la esquina (V3, P1…).', { x: 1.45, y: 3.25, w: 4.2, h: 0.8, fontSize: 15, color: TENUE });
  s.addImage({ data: qr, x: 6.4, y: 1.3, w: 2.7, h: 2.7, altText: `QR para abrir JARVIS: ${URL_APP}` });
  s.addText(URL_CORTA, { x: 6.0, y: 4.1, w: 3.5, h: 0.35, fontSize: 14, bold: true, color: CIAN, align: 'center', margin: 0, isTextBox: true });
  s.addNotes('Ahora sí: abran el sobre. Que una persona toque Crear nuestro JARVIS y escriba el nombre del equipo.');

  // 6 · Video
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Inicio' });
  s.addText('Así se arma un JARVIS', { placeholder: 'title' });
  video(s, 'bienvenida', 0.5, 1.3, 5.6);
  ['Creen su JARVIS con el nombre del equipo', 'Escaneen la tarjeta que pide la misión', 'Toquen Listo y vayan a la siguiente'].forEach((t, i) => {
    insignia(s, 6.45, 1.4 + i * 1.05, 0.5, String(i + 1), CIAN, `video-paso${i}`, { tam: 15 });
    cuerpo(s, t, { x: 7.1, y: 1.4 + i * 1.05, w: 2.4, h: 0.85, fontSize: 15 });
  });
  s.addNotes('Den clic al video (30 s, sin sonido). Lo pueden repetir: en la tablet también está, en el botón ? de arriba.');

  // 7 · La directiva principal
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Inicio' });
  s.addText('La directiva principal', { placeholder: 'title' });
  cuerpo(s, [
    { text: 'Así se programa una IA… con palabras.', options: { bold: true, color: CIAN, fontSize: 20, breakLine: true } },
    { text: 'En la misión 4 (Personalidad) eligen cómo habla su JARVIS, qué le encanta y qué nunca hace.', options: { breakLine: true } },
    { text: ' ', options: { breakLine: true, fontSize: 8 } },
    { text: 'A eso se le llama prompt de sistema: es lo primero que lee una IA antes de contestar.', options: { color: TENUE } },
  ], { x: 0.5, y: 1.4, w: 3.9, h: 3.2 });
  tarjeta(s, 4.75, 1.35, 4.75, 3.25, 'prompt-fondo', PANEL);
  s.addText([
    { text: '// directiva principal', options: { color: TENUE, breakLine: true } },
    { text: 'Eres ', options: { color: BLANCO } }, { text: 'NOVA', options: { color: CIAN, breakLine: true } },
    { text: 'asistente del equipo ', options: { color: BLANCO } }, { text: '"Los Bits"', options: { color: VERDE, breakLine: true } },
    { text: ' ', options: { breakLine: true } },
    { text: 'Hablas como ', options: { color: BLANCO } }, { text: 'un narrador de fútbol', options: { color: AMARILLO, breakLine: true } },
    { text: 'Te encanta ', options: { color: BLANCO } }, { text: 'los tacos', options: { color: AMARILLO, breakLine: true } },
    { text: 'Nunca ', options: { color: BLANCO } }, { text: 'te rindes', options: { color: AMARILLO } },
  ], { x: 5.0, y: 1.55, w: 4.3, h: 2.9, fontFace: 'Consolas', fontSize: 15, valign: 'top', margin: 0, isTextBox: true, paraSpaceBefore: 0.01 });
  s.addNotes('9:04 · Expliquen la idea en 30 segundos. Durante la Fase 1 caminen por las mesas y ayuden en esta misión: es la más importante.');

  // 8 · FASE 1
  pres.addSection({ title: 'Fase 1 · Armar' });
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Fase 1 · Armar' });
  s.addText('Fase 1 · Armen a su JARVIS', { placeholder: 'title' });
  s.addText('15:00', { x: 0.5, y: 1.35, w: 4.2, h: 1.5, fontSize: 92, bold: true, color: CIAN, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
  s.addText('Sigan las misiones de la tablet', { x: 0.5, y: 2.9, w: 4.2, h: 0.4, fontSize: 18, color: TENUE, margin: 0, isTextBox: true });
  const misiones1 = [['1', 'Nombre', 'tarjeta IDENTIDAD', '38BDF8'], ['2', 'Voz', 'tarjetas VOZ', 'A78BFA'], ['3', 'Forma', 'tarjetas NÚCLEO', '34D399'], ['4', 'Personalidad', 'tarjetas PERSONALIDAD', 'F472B6']];
  misiones1.forEach(([n, t, d, color], i) => {
    insignia(s, 5.2, 1.3 + i * 0.68, 0.52, n, color, `m1-${n}`, { tam: 16 });
    s.addText(t, { x: 5.95, y: 1.3 + i * 0.68, w: 3.5, h: 0.3, fontSize: 17, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText(d, { x: 5.95, y: 1.58 + i * 0.68, w: 3.5, h: 0.25, fontSize: 12, color: TENUE, margin: 0, isTextBox: true });
  });
  s.addText('Cuando terminen: esperen la señal para encender todos juntos.', { x: 0.5, y: 4.15, w: 9, h: 0.35, fontSize: 14, bold: true, color: AMARILLO, margin: 0, isTextBox: true });
  cronometro(s, 15, CIAN);
  s.addNotes('9:05–9:20 · Fase 1. La barra de abajo se llena sola en 15 minutos. Cortes cada 5 minutos en voz alta: "¿Quién ya tiene voz?", "¿Quién ya va en personalidad?". Los equipos que terminen antes pueden seguir probando voces y formas. NO enciendan todavía: lo hacen todos juntos.');

  // 9 · PAUSA
  s = pres.addSlide({ masterName: 'SECCION', sectionTitle: 'Fase 1 · Armar' });
  s.addText('PAUSA', { placeholder: 'title' });
  s.addText('Manos arriba · Tablets en la mesa · Ojos al frente', { placeholder: 'body' });
  insignia(s, 6.7, 1.3, 2.6, '✋', AMARILLO, 'pausa', { tam: 80 });
  s.addNotes('Diapositiva de control: úsenla cuando necesiten silencio (pueden volver a ella cuando quieran). Aquí la usan para pasar a la Fase 2.');

  // 10 · FASE 2
  pres.addSection({ title: 'Fase 2 · Encender' });
  s = pres.addSlide({ masterName: 'SECCION', sectionTitle: 'Fase 2 · Encender' });
  s.addText('Fase 2 · ¡Enciéndanlo!', { placeholder: 'title' });
  s.addText([
    { text: 'Suban el volumen.', options: { breakLine: true } },
    { text: 'A la cuenta de 3, todos tocan INICIAR al mismo tiempo.', options: { breakLine: true } },
    { text: '3 · 2 · 1…', options: { bold: true, color: VERDE, fontSize: 30 } },
  ], { placeholder: 'body' });
  reactor(s, 6.5, 1.05, 3.0, VERDE, 'encendido');
  s.addNotes('9:20 · Cuenta regresiva en voz alta: "3, 2, 1… ¡INICIAR!". Es el momento de más ruido: déjenlo. Cada JARVIS se presenta con su voz y su personalidad.');

  // 11 · Pregunta para todos
  s = pres.addSlide({ masterName: 'SECCION', sectionTitle: 'Fase 2 · Encender' });
  s.addText('Pregunta para todos', { placeholder: 'title' });
  s.addText([
    { text: '“¿Cómo vencemos a Ultrón?”', options: { fontSize: 28, bold: true, color: BLANCO, breakLine: true } },
    { text: 'Escríbanla en Hablar. Cada JARVIS contesta con su propia personalidad: eso hace la directiva principal.', options: { fontSize: 16, color: TENUE } },
  ], { placeholder: 'body' });
  insignia(s, 7.1, 1.6, 1.8, '?', CIAN, 'pregunta', { tam: 60 });
  s.addNotes('9:23 · Elijan 3 o 4 equipos al azar para que lean en voz alta lo que contestó su JARVIS. Misma pregunta, respuestas distintas.');

  // 12 · FASE 3
  pres.addSection({ title: 'Fase 3 · Descubrir' });
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Fase 3 · Descubrir' });
  s.addText('Fase 3 · Misiones extra', { placeholder: 'title' });
  s.addText('15:00', { x: 0.5, y: 1.35, w: 4.2, h: 1.5, fontSize: 92, bold: true, color: AMARILLO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
  s.addText('En la pestaña Misiones. Se desbloquean de 3 en 3.', { x: 0.5, y: 2.9, w: 4.2, h: 0.7, fontSize: 16, color: TENUE, margin: 0, isTextBox: true });
  const extras = ['3 preguntas', 'Escenario', 'Memoria', 'Herramientas', 'Foto del equipo', 'Escudo', '3 tarjetas secretas', 'Pedir una pista'];
  extras.forEach((t, i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = 5.0 + col * 2.3;
    const y = 1.4 + fila * 0.65;
    insignia(s, x, y, 0.42, '★', AMARILLO, `extra${i}`, { tam: 12 });
    s.addText(t, { x: x + 0.52, y, w: 1.75, h: 0.42, fontSize: 14, color: BLANCO, valign: 'middle', margin: 0, isTextBox: true });
  });
  s.addText('¿Qué equipo completa las 8 primero?', { x: 0.5, y: 4.15, w: 9, h: 0.35, fontSize: 14, bold: true, color: AMARILLO, margin: 0, isTextBox: true });
  cronometro(s, 15, AMARILLO);
  s.addNotes('9:25–9:40 · Fase 3. Vayan anunciando en voz alta qué equipos llevan más misiones (lo ven arriba en la pestaña Misiones: 5/8, 6/8…). El primero en completar las 8 se lleva un aplauso.');

  // 13 · Dos cerebros
  pres.addSection({ title: 'Cierre' });
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Cierre' });
  s.addText('Dos cerebros', { placeholder: 'title' });
  const cerebros = [
    ['B', 'Cerebro básico', CIAN, 'El que usaron hoy. Funciona sin internet.', 'Busca palabras clave y responde con textos escritos por personas, como ELIZA, uno de los primeros chatbots (1966).'],
    ['IA', 'Súper inteligencia', VERDE, 'Un modelo de lenguaje, como ChatGPT o Claude.', 'Redacta respuestas nuevas para cualquier pregunta. La llave secreta vive en un servidor, nunca en la tablet.'],
  ];
  cerebros.forEach(([cod, titulo, color, linea1, linea2], i) => {
    const x = 0.5 + i * 4.6;
    tarjeta(s, x, 1.35, 4.4, 3.3, `cerebro-${cod}`);
    insignia(s, x + 0.3, 1.6, 0.8, cod, color, `cerebro-ins-${cod}`, { tam: 20 });
    s.addText(titulo, { x: x + 1.3, y: 1.7, w: 2.9, h: 0.6, fontSize: 22, bold: true, color, fontFace: THEME.headFontFace, margin: 0, valign: 'middle', isTextBox: true });
    cuerpo(s, [
      { text: linea1, options: { bold: true, breakLine: true } },
      { text: linea2, options: { color: TENUE } },
    ], { x: x + 0.3, y: 2.65, w: 3.8, h: 1.85, fontSize: 15, paraSpaceAfter: 6 });
  });
  s.addNotes('9:40 · Pregunta al grupo: ¿cuál es más inteligente? ¿cuál es más confiable? El básico nunca inventa, pero solo sabe lo que le escribimos. Un modelo de lenguaje redacta, pero puede equivocarse.');

  // 14 · Módulo legendario
  s = pres.addSlide({ masterName: 'ULTRON', sectionTitle: 'Cierre' });
  s.addText('¿Alguien instaló el Módulo legendario?', { placeholder: 'title' });
  s.addText('Era una trampa de Ultrón. Un QR desconocido puede llevarte a una página falsa que roba tus datos: eso se llama quishing. Antes de escanear, pregúntate: ¿de dónde viene este QR?', { placeholder: 'body' });
  insignia(s, 6.9, 1.4, 2.2, '★', ROJO, 'legendario', { tam: 70 });
  s.addNotes('Pregunten quién lo escaneó (siempre hay alguien). Lo que promete algo demasiado bueno ("poder ilimitado") es sospechoso: eso es ciberseguridad real.');

  // 15 · Lo que programaron
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Cierre' });
  s.addText('Lo que programaron hoy', { placeholder: 'title' });
  const aprendizajes = [
    ['V', 'Voz', 'Síntesis de voz: texto convertido en sonido', 'A78BFA'],
    ['N', 'Núcleo', 'Diseño de interfaces (UI/UX)', '34D399'],
    ['P', 'Directiva', 'Prompt de sistema: programar una IA con palabras', 'F472B6'],
    ['M', 'Memoria', 'Contexto: la IA solo sabe lo que le mandan', 'FB923C'],
    ['B', 'Dos cerebros', 'Chatbot de reglas contra modelo de lenguaje', '3FD0FF'],
    ['★', 'Legendario', 'Ciberseguridad: no escanear QR desconocidos', 'FF1638'],
  ];
  aprendizajes.forEach(([cod, t, d, color], i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = 0.5 + col * 4.6;
    const y = 1.35 + fila * 1.0;
    insignia(s, x, y, 0.6, cod, color, `aprende${i}`, { tam: 15 });
    s.addText(t, { x: x + 0.8, y, w: 3.6, h: 0.3, fontSize: 15, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.8, y: y + 0.3, w: 3.6, h: 0.35, fontSize: 12, color: TENUE, margin: 0, isTextBox: true });
  });
  s.addText('Todo esto se estudia en ITC: Ingeniería en Tecnologías Computacionales.', { x: 0.5, y: 4.55, w: 9, h: 0.4, fontSize: 15, bold: true, color: CIAN, margin: 0, isTextBox: true });
  s.addNotes('9:45 · Conecten cada módulo con algo de la carrera.');

  // 16 · JARVIS en los talleres
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Cierre' });
  s.addText('JARVIS en los talleres', { placeholder: 'title' });
  const usos = [
    ['📍', '¿Dónde están?', 'En Hablar toquen 📍 y elijan el taller.'],
    ['💡', 'Pidan una pista', 'JARVIS da pistas, nunca la respuesta.'],
    ['B', 'Bitácora y Puntos', 'Anoten la pieza y el puntaje de cada taller.'],
    ['QR', '¿Atorados?', 'Cada mesa tiene un cartel con QR de pistas.'],
  ];
  usos.forEach(([ic, t, d], i) => {
    insignia(s, 0.5, 1.35 + i * 0.82, 0.5, ic, CIAN, `uso${i}`, { tam: 13 });
    s.addText(t, { x: 1.15, y: 1.3 + i * 0.82, w: 3.3, h: 0.3, fontSize: 15, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText(d, { x: 1.15, y: 1.6 + i * 0.82, w: 3.3, h: 0.35, fontSize: 12, color: TENUE, margin: 0, isTextBox: true });
  });
  video(s, 'pista', 4.7, 1.35, 4.8);
  s.addNotes('9:50 · Pongan el video (clic, 20 s). Nada depende de JARVIS: si se les olvida usarlo, el taller sigue igual. Pero les ayuda cuando se atoran.');

  // 17 · La misión de hoy
  s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Cierre' });
  s.addText('La misión de hoy', { placeholder: 'title' });
  const agenda = [['10:00', 'Ronda 1'], ['10:45', 'Ronda 2'], ['11:25', 'Break'], ['11:40', 'Ronda 3'], ['12:25', 'Ronda 4'], ['13:10', 'Reto final']];
  s.addShape(pres.shapes.LINE, { x: 0.8, y: 1.85, w: 8.4, h: 0, line: { color: TENUE, width: 1.5, dashType: 'dash' }, objectName: 'linea-tiempo' });
  agenda.forEach(([h, t], i) => {
    const x = 0.5 + i * 1.66;
    const color = i === agenda.length - 1 ? ROJO : CIAN;
    s.addShape(pres.shapes.OVAL, { x: x + 0.17, y: 1.72, w: 0.26, h: 0.26, fill: { color }, line: { type: 'none' }, objectName: `hito${i}` });
    s.addText(h, { x: x - 0.2, y: 2.1, w: 1.0, h: 0.35, fontSize: 16, bold: true, color, align: 'center', fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText(t, { x: x - 0.2, y: 2.45, w: 1.0, h: 0.3, fontSize: 12, color: BLANCO, align: 'center', margin: 0, isTextBox: true });
  });
  const piezas = [['Desarrollo móvil', 'Protocolo final'], ['Algoritmos', 'Debilidad'], ['Ciberseguridad', 'Acceso'], ['Redes', 'Ubicación']];
  piezas.forEach(([est, pieza], i) => {
    const x = 0.5 + i * 2.3;
    tarjeta(s, x, 3.15, 2.1, 1.35, `pieza${i}`);
    s.addText(est, { x: x + 0.15, y: 3.3, w: 1.85, h: 0.35, fontSize: 14, bold: true, color: BLANCO, fontFace: THEME.headFontFace, margin: 0, isTextBox: true });
    s.addText('les da la pieza', { x: x + 0.15, y: 3.65, w: 1.85, h: 0.25, fontSize: 11, color: TENUE, margin: 0, isTextBox: true });
    s.addText(pieza, { x: x + 0.15, y: 3.92, w: 1.85, h: 0.4, fontSize: 16, bold: true, color: AMARILLO, margin: 0, isTextBox: true });
  });
  s.addNotes('Las cuatro piezas se juntan en el reto final a las 13:10. Que las anoten en la Bitácora de JARVIS (o en papel).');

  // 18 · Cierre
  s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Cierre' });
  s.addText([{ text: '¡A vencer a', options: { breakLine: true } }, { text: 'Ultrón!', options: { color: ROJO } }], { placeholder: 'title' });
  s.addText('Lleven su tablet con JARVIS a los talleres', { placeholder: 'body' });
  reactor(s, 6.1, 0.95, 3.7);
  s.addNotes('9:55 · Foto del equipo con su JARVIS (pestaña Cámara) y salida a la Ronda 1.');

  await pres.writeFile({ fileName: SALIDA });
  await applyTheme(SALIDA, THEME);
  console.log('listo:', SALIDA);
})().catch((e) => { console.error(e); process.exit(1); });
