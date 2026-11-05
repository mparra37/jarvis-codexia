/* JARVIS · catálogo: módulos, tarjetas QR, voces, núcleos, ambientes y textos
 *
 * Cada tarjeta impresa tiene un código corto (V3, P1, H2…). El QR guarda la dirección de la app con
 * ?t=CODIGO, así funciona con el escáner de la app o con la cámara normal del celular.
 */
import { PERSONALIDADES } from './personalidades.js';

export { PERSONALIDADES };

// ---------- íconos (trazos de 24 × 24) ----------
export const ICONOS = {
  identidad: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 2-3 3.5-3s2.7 1 3.5 3M14 10h5M14 14h4"/>',
  voz: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  nucleo: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="10"/>',
  ambiente: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>',
  personalidad: '<path d="M4 6c3-2 13-2 16 0v5c0 5-4 9-8 9s-8-4-8-9z"/><path d="M8 11h2M14 11h2M9 15c2 1.5 4 1.5 6 0"/>',
  memoria: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  habilidades: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  bitacora: '<path d="M6 3h11a2 2 0 012 2v16H8a2 2 0 01-2-2z"/><path d="M6 19a2 2 0 012-2h11M10 7h6M10 11h6"/>',
  camara: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  puntos: '<path d="M7 4h10v4a5 5 0 01-10 0z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  accion: '<path d="M12 2l2.6 6.3L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.7z"/>',
  ultron: '<path d="M12 2l3 7h6l-5 4 2 8-6-4-6 4 2-8-5-4h6z"/>',
  ficha: '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/>',
  taller: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  enviar: '<path d="M4 12l16-8-6 16-3-6z"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
  bateria: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  altavoz: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
};

export function icono(nombre, clase = '') {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
}

// ---------- módulos ----------
export const MODULOS = [
  {
    id: 'identidad', nombre: 'Identidad', color: '#38bdf8', necesario: true,
    resumen: 'Nombre, lema y palabra de activación',
    sabias: 'Asistentes como Alexa o Siri esperan una sola "palabra de activación". La detectan dentro del propio aparato y solo entonces empiezan a escuchar de verdad.',
  },
  {
    id: 'voz', nombre: 'Voz', color: '#a78bfa', necesario: true,
    resumen: 'Tono, velocidad y estilo de voz',
    sabias: 'Tu JARVIS habla con síntesis de voz (TTS, texto a voz): la computadora convierte letras en sonidos. Cambiar el tono y la velocidad es cambiar números en el programa.',
  },
  {
    id: 'nucleo', nombre: 'Núcleo visual', color: '#34d399', necesario: true,
    resumen: 'La forma y el color de tu JARVIS',
    sabias: 'Todo lo que ves en una app lo diseñó alguien: colores, formas y animaciones. A eso se le llama diseño de interfaces (UI/UX).',
  },
  {
    id: 'ambiente', nombre: 'Ambiente', color: '#fbbf24', necesario: false,
    resumen: 'El escenario de fondo',
    sabias: 'Este fondo no es una foto: se dibuja con código 30 veces por segundo. Así se hacen las animaciones de los videojuegos.',
  },
  {
    id: 'personalidad', nombre: 'Personalidad', color: '#f472b6', necesario: true,
    resumen: 'Cómo habla y piensa: su directiva principal',
    sabias: 'La directiva principal se llama "prompt de sistema": es el texto que le dice a una IA quién es y cómo debe hablar. ¡Acaban de programar con palabras!',
  },
  {
    id: 'memoria', nombre: 'Memoria', color: '#fb923c', necesario: false,
    resumen: 'Lo que JARVIS sabe de su equipo',
    sabias: 'Una IA no recuerda nada por sí sola: solo sabe lo que se le manda en cada mensaje. A eso se le llama contexto.',
  },
  {
    id: 'escudo', nombre: 'Escudo', color: '#94a3b8', necesario: false,
    resumen: 'Reglas de seguridad de la IA',
    sabias: 'Las IA tienen capas de reglas. Las del staff van primero y nadie las puede cambiar, ni siquiera su directiva. Así se evita que alguien engañe a la IA (a eso se le llama prompt injection).',
  },
  {
    id: 'habilidades', nombre: 'Habilidades', color: '#2dd4bf', necesario: false,
    resumen: 'Bitácora, cámara, puntos y chat',
    sabias: 'Una app se arma con funciones independientes. Así, varios programadores pueden trabajar al mismo tiempo en partes distintas.',
  },
];

export const MODULO = Object.fromEntries(MODULOS.map((m) => [m.id, m]));

// ---------- voces ----------
// tono y velocidad van a speechSynthesis (tono 0–2, velocidad 0.1–10). voz = cuál de las voces en
// español del aparato usar (se toma la n-ésima, así cambia aunque el aparato tenga pocas).
export const VOCES = {
  V1: { nombre: 'Mayordomo', desc: 'Grave, pausada y elegante.', tono: 0.8, velocidad: 0.92, voz: 0, sonido: 'campana' },
  V2: { nombre: 'Robot clásico', desc: 'Metálica, como de película vieja.', tono: 0.3, velocidad: 0.85, voz: 1, sonido: 'bip' },
  V3: { nombre: 'Locutor de radio', desc: 'Clara, rápida y con energía.', tono: 1.0, velocidad: 1.12, voz: 2, sonido: 'radio' },
  V4: { nombre: 'Ardilla turbo', desc: 'Aguda y acelerada.', tono: 1.9, velocidad: 1.35, voz: 0, sonido: 'burbuja' },
  V5: { nombre: 'Gigante de piedra', desc: 'Muy grave y lenta.', tono: 0.1, velocidad: 0.72, voz: 1, sonido: 'tambor' },
  V6: { nombre: 'Agente secreto', desc: 'Baja y misteriosa.', tono: 0.65, velocidad: 0.98, voz: 2, sonido: 'sonar' },
};

// ---------- núcleos ----------
export const NUCLEOS = {
  N1: { nombre: 'Reactor', desc: 'Anillos de energía que giran.', forma: 'reactor' },
  N2: { nombre: 'Ojo', desc: 'Un ojo que mira y parpadea.', forma: 'ojo' },
  N3: { nombre: 'Onda', desc: 'Barras que bailan con la voz.', forma: 'onda' },
  N4: { nombre: 'Átomo', desc: 'Electrones en órbita.', forma: 'atomo' },
  N5: { nombre: 'Panal', desc: 'Hexágonos que se encienden.', forma: 'hexagono' },
  N6: { nombre: 'Cara pixel', desc: 'Una cara de videojuego clásico.', forma: 'pixel' },
};

export const COLORES = [
  { nombre: 'Cian', valor: '#3fd0ff' },
  { nombre: 'Azul', valor: '#4d7cff' },
  { nombre: 'Violeta', valor: '#a26bff' },
  { nombre: 'Rosa', valor: '#ff5ccf' },
  { nombre: 'Verde', valor: '#3dff9a' },
  { nombre: 'Amarillo', valor: '#ffd23f' },
  { nombre: 'Naranja', valor: '#ff9640' },
  { nombre: 'Blanco', valor: '#e8f4ff' },
];

// ---------- ambientes ----------
export const AMBIENTES = {
  A1: { nombre: 'Laboratorio', desc: 'Cuadrícula de luz y partículas.', tipo: 'laboratorio' },
  A2: { nombre: 'Galaxia', desc: 'Estrellas y nebulosas.', tipo: 'galaxia' },
  A3: { nombre: 'Ciudad nocturna', desc: 'Edificios con luces encendidas.', tipo: 'ciudad' },
  A4: { nombre: 'Lluvia de código', desc: 'Ceros y unos que caen.', tipo: 'codigo' },
  A5: { nombre: 'Desierto de Sonora', desc: 'Atardecer con saguaros.', tipo: 'desierto' },
  A6: { nombre: 'Tormenta eléctrica', desc: 'Nubes, lluvia y rayos.', tipo: 'tormenta' },
};

// ---------- habilidades ----------
export const HABILIDADES = {
  H1: { id: 'bitacora', nombre: 'Bitácora', desc: 'Guarda las pistas de cada estación.', sabias: 'Sus pistas se guardan en una base de datos en la nube: por eso aparecen en todos los dispositivos del equipo.' },
  H2: { id: 'camara', nombre: 'Cámara', desc: 'Fotos del equipo con marco de JARVIS.', sabias: 'Una foto es una cuadrícula de millones de puntos (pixeles). Cada pixel son 3 números: rojo, verde y azul.' },
  H3: { id: 'puntos', nombre: 'Puntos', desc: 'Registra los puntajes de cada taller.', sabias: 'Los códigos de los juegos VR traen una "suma de verificación": si cambian una sola letra, JARVIS se da cuenta de que el código es falso.' },
  H4: { id: 'chat', nombre: 'Cerebro IA', desc: 'Conecta a JARVIS con una inteligencia artificial de verdad.', sabias: 'Sin esta tarjeta, JARVIS usa su cerebro básico: busca palabras clave y contesta con textos escritos por personas. Con el Cerebro IA, la pregunta viaja a un servidor que guarda una llave secreta (API key) y un modelo de lenguaje redacta la respuesta. La llave nunca llega a su tablet. Si la IA falla, vuelve el cerebro básico.' },
};
export const HABILIDAD_POR_ID = Object.fromEntries(Object.entries(HABILIDADES).map(([k, h]) => [h.id, { ...h, codigo: k }]));

// ---------- todas las tarjetas ----------
// tipo: modulo (instala o cambia un módulo), accion (hace algo divertido), especial
export const TARJETAS = {
  ID: { tipo: 'modulo', modulo: 'identidad', nombre: 'Identidad', desc: 'Pónganle nombre y lema a su JARVIS.' },
  ...Object.fromEntries(Object.entries(VOCES).map(([k, v]) => [k, { tipo: 'modulo', modulo: 'voz', valor: k, nombre: v.nombre, desc: v.desc }])),
  ...Object.fromEntries(Object.entries(NUCLEOS).map(([k, v]) => [k, { tipo: 'modulo', modulo: 'nucleo', valor: k, nombre: v.nombre, desc: v.desc }])),
  ...Object.fromEntries(Object.entries(AMBIENTES).map(([k, v]) => [k, { tipo: 'modulo', modulo: 'ambiente', valor: k, nombre: v.nombre, desc: v.desc }])),
  ...Object.fromEntries(Object.entries(PERSONALIDADES).map(([k, v]) => [k, { tipo: 'modulo', modulo: 'personalidad', valor: k, nombre: v.nombre, desc: v.descripcion }])),
  MEM: { tipo: 'modulo', modulo: 'memoria', nombre: 'Memoria', desc: 'Enséñenle a JARVIS quiénes son.' },
  ESC: { tipo: 'modulo', modulo: 'escudo', nombre: 'Escudo', desc: 'Las reglas que protegen a su IA.' },
  ...Object.fromEntries(Object.entries(HABILIDADES).map(([k, v]) => [k, { tipo: 'modulo', modulo: 'habilidades', valor: k, nombre: v.nombre, desc: v.desc }])),
  X1: { tipo: 'accion', accion: 'chiste', nombre: '¡Cuéntame un chiste!', desc: 'Escanéenla las veces que quieran.' },
  X2: { tipo: 'accion', accion: 'dato', nombre: 'Dato curioso', desc: 'Un dato de tecnología cada vez.' },
  X3: { tipo: 'accion', accion: 'fiesta', nombre: 'Modo fiesta', desc: 'Su JARVIS baila 10 segundos.' },
  ULT: { tipo: 'especial', accion: 'ultron', nombre: 'Módulo legendario', desc: 'Poder ilimitado. ¡Instálenlo ya!' },
};

/** Orden de las tarjetas en el sobre impreso (4 hojas de 9). */
export const ORDEN_SOBRE = [
  'ID', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'MEM', 'ESC',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'X1', 'X2', 'X3',
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'H1', 'H2', 'H3',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'H4', 'ULT', 'INFO',
];

export function colorTarjeta(codigo) {
  const t = TARJETAS[codigo];
  if (!t) return '#3fd0ff';
  if (t.tipo === 'modulo') return MODULO[t.modulo].color;
  if (t.tipo === 'accion') return '#e879f9';
  return '#ff1638';
}

/** Lee el código de tarjeta (o de equipo) de lo que trae un QR o de lo que escribe el usuario. */
export function leerQR(texto) {
  const limpio = String(texto || '').trim();
  let t = '';
  let unirse = '';
  try {
    const url = new URL(limpio);
    t = url.searchParams.get('t') || '';
    unirse = url.searchParams.get('unirse') || '';
  } catch (e) {
    const m = limpio.match(/^(?:JARVIS:)?([A-Za-z0-9]{1,4})$/i);
    if (m) t = m[1];
  }
  t = t.toUpperCase();
  if (unirse) return { tipo: 'unirse', codigo: unirse.toUpperCase() };
  if (TARJETAS[t]) return { tipo: 'tarjeta', codigo: t };
  return { tipo: 'nada' };
}

// ---------- directiva: sugerencias ----------
export const SUGERENCIAS = {
  habla: ['un pirata', 'un abuelito sabio', 'un youtuber', 'un astronauta', 'un caballero medieval', 'un superhéroe'],
  encanta: ['los videojuegos', 'los tacos', 'la música', 'las matemáticas', 'el espacio', 'los robots'],
  nunca: ['se rinde', 'dice groserías', 'da la respuesta directa', 'cuenta spoilers', 'se olvida del lema', 'habla aburrido'],
  nombres: ['VIERNES', 'NOVA', 'ATLAS', 'ECO', 'KAI', 'LUNA', 'ORIÓN', 'TITÁN', 'BYTE', 'ZAFIRO'],
};

// ---------- estaciones de CODEXIA (bitácora y puntos) ----------
export const ESTACIONES = [
  { id: 'movil', nombre: 'Desarrollo móvil', reto: 'Field Scanner', pieza: 'Protocolo final' },
  { id: 'algoritmos', nombre: 'Algoritmos', reto: 'Project Icarus', pieza: 'Debilidad' },
  { id: 'ciber', nombre: 'Ciberseguridad', reto: 'Zero Trust', pieza: 'Acceso' },
  { id: 'redes', nombre: 'Redes', reto: 'Ghost Network', pieza: 'Ubicación' },
];
export const ESTACIONES_PUNTOS = [...ESTACIONES.map((e) => ({ id: e.id, nombre: e.nombre })), { id: 'final', nombre: 'Reto final' }, { id: 'otro', nombre: 'Otro' }];

// ---------- chistes y datos (funcionan sin internet) ----------
export const CHISTES = [
  'Hay 10 tipos de personas: las que entienden binario y las que no.',
  '¿Por qué los programadores confunden Halloween con Navidad? Porque 31 en octal es igual a 25 en decimal.',
  'Te contaría un chiste de UDP, pero no sé si te llegaría.',
  '¿Qué le dijo el Wi-Fi a la computadora? Siento una conexión entre nosotros.',
  'Mi contraseña es "incorrecta". Así, cuando la olvido, la computadora me la recuerda: tu contraseña es incorrecta.',
  '¿Por qué la computadora fue al doctor? Porque tenía un virus.',
  '¿Por qué el robot cruzó la calle? Porque estaba programado para hacerlo.',
  '¿Por qué el libro de matemáticas estaba triste? Porque tenía demasiados problemas.',
  '¿Sabes por qué Ultrón va a perder? Porque se le olvidó guardar su progreso.',
  '¿Qué le dijo un bit a otro bit? Nos vemos en el bus.',
  '¿Cuál es el animal favorito de un programador? El ratón. Aunque también le cae bien el Python.',
];

export const DATOS = [
  'En 1947, el equipo de Grace Hopper encontró una polilla atrapada en la computadora Harvard Mark II y la pegó en su bitácora. Fue el primer "bug" real de la historia.',
  'El primer mensaje de ARPANET, el abuelo de Internet, se mandó en 1969. Querían escribir LOGIN, pero el sistema se cayó después de LO.',
  'Una dirección IPv4 tiene 4 números del 0 al 255. Eso da unos 4,300 millones de direcciones, y ya no alcanzan: por eso se creó IPv6.',
  'Con 8 bits, es decir, un byte, se pueden formar 256 combinaciones. Alcanzan para todas las letras, números y signos básicos.',
  'Ada Lovelace escribió en 1843 un algoritmo para una máquina que ni siquiera se había construido. Se le considera la primera programadora de la historia.',
  'La palabra robot viene del checo "robota", que significa trabajo forzado. Apareció en una obra de teatro de 1920.',
  'La fibra óptica manda información con pulsos de luz. Hay cables bajo el mar que conectan continentes enteros.',
  'Un código QR se puede leer aunque esté dañado hasta en un 30 por ciento, gracias a la corrección de errores.',
  'La contraseña 123456 ha sido por años una de las más usadas del mundo. Un programa la adivina en menos de un segundo.',
  'El primer dominio punto com fue symbolics.com, registrado en 1985.',
  'ENIAC, una de las primeras computadoras electrónicas, terminada en 1945, pesaba unas 27 toneladas.',
  'La palabra spam para el correo basura viene de un sketch de comedia del grupo Monty Python.',
];

export function alAzar(lista) { return lista[Math.floor(Math.random() * lista.length)]; }
