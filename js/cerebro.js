/* JARVIS · cerebro básico: respuestas pre-escritas, sin internet y sin IA
 *
 * Busca palabras clave en la pregunta y elige una respuesta escrita por personas (así funcionaban los
 * primeros chatbots, como ELIZA en 1966). Se usa siempre que no hay Cerebro IA: al inicio, sin
 * internet, si la API falla o si se acaba la batería. La respuesta se adorna con la personalidad
 * del equipo y la app la dice en voz alta.
 *
 * responder(texto, contexto) → { texto, intencion, accion? }
 *   contexto: { equipo, estacion (id), cerebroIA (bool) }
 *   accion 'pista' = la app da la siguiente pista de la estación (la misma que el botón).
 */
import { AYUDA_ESTACIONES, ORDEN_ESTACIONES } from './estaciones_datos.js';
import { JUEGOS } from './taller_vr_datos.js';
import { CHISTES, DATOS, alAzar } from './datos.js';
import { PERSONALIDADES, rellenar } from './personalidades.js';
import { textoLimpio } from './filtro.js';

/** Horario de CODEXIA (del sitio del evento). */
export const AGENDA = [
  ['08:00', 'el registro y la bienvenida'],
  ['09:00', 'el taller Construye tu JARVIS'],
  ['10:00', 'la ronda 1 de talleres'],
  ['10:45', 'la ronda 2 de talleres'],
  ['11:25', 'el break'],
  ['11:40', 'la ronda 3 de talleres'],
  ['12:25', 'la ronda 4 de talleres'],
  ['13:10', 'el reto final: vencer a Ultrón'],
];

const VACIAS = new Set(('el la los las un una unos unas de del al a y o u e que en es son por para con como se me te le lo les nos mi mis tu tus su sus mas muy ya no si hay '
  + 'este esta esto eso esa ese estos esas ser fue era pero porque cual cuales quien donde cuando sobre entre hasta desde yo tu usted ustedes nosotros jarvis oye dime '
  + 'puedes puedo podemos quiero queremos sabes saber explicame explica favor gracias hola').split(' '));

export function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function horaTexto(d) { return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function aMinutos(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

function siguienteEnAgenda(ahora) {
  const t = ahora.getHours() * 60 + ahora.getMinutes();
  const sig = AGENDA.find(([h]) => aMinutos(h) > t);
  return sig ? `A las ${sig[0]} sigue ${sig[1]}.` : 'Por hoy ya terminó la agenda de CODEXIA.';
}

function listaNombres(lista) {
  return lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}` : lista[0];
}

// ---------- intenciones: palabras clave → respuestas ----------
// claves con espacio = frase exacta (vale más); sin espacio = palabra.
const INTENCIONES = [
  { id: 'saludo', claves: ['hola', 'buenos dias', 'buenas tardes', 'buenas', 'que tal', 'hey', 'saludos', 'que onda', 'quiubo'],
    r: ['¡Hola, equipo {equipo}! Aquí {jarvis}. ¿En qué les ayudo?', '¡Qué gusto oírlos! Soy {jarvis}. Pregúntenme lo que quieran de CODEXIA.', 'Hola, hola. {jarvis} en línea y listo para ayudar.'] },
  { id: 'despedida', claves: ['adios', 'bye', 'nos vemos', 'hasta luego', 'chao', 'me voy'],
    r: ['¡Nos vemos! Si se atoran en un taller, aquí estaré.', 'Hasta luego, equipo {equipo}. ¡A vencer a Ultrón!'] },
  { id: 'gracias', claves: ['gracias', 'muchas gracias', 'te lo agradezco', 'thank', 'thanks'],
    r: ['¡De nada! Para eso me armaron.', 'Con gusto. ¿Algo más?', 'Cuando quieran. Ustedes hacen el trabajo difícil.'] },
  { id: 'nombre', claves: ['como te llamas', 'tu nombre', 'quien eres', 'que eres', 'presentate'],
    r: ['Soy {jarvis}, el asistente del equipo {equipo}. Me armaron hoy con tarjetas QR.', 'Me llamo {jarvis}. Mi palabra de activación es: oye, {jarvis}.'] },
  { id: 'creador', claves: ['quien te creo', 'quien te hizo', 'quien te programo', 'como te hicieron', 'como te armaron'],
    r: ['Me armó el equipo {equipo}: escogieron mi voz, mi núcleo y mi personalidad escaneando tarjetas. ¡Ustedes son mis ingenieros!'] },
  { id: 'capacidades', claves: ['que puedes hacer', 'que sabes hacer', 'para que sirves', 'que haces', 'en que me ayudas', 'como me ayudas'],
    r: ['Les doy pistas de cada taller, les cuento la agenda, guardo sus piezas en la bitácora y sus puntos. Y también sé chistes.'] },
  { id: 'como_funcionas', claves: ['como funcionas', 'como piensas', 'eres inteligente', 'eres una ia', 'eres un robot', 'cerebro basico', 'como sabes', 'estas vivo'],
    f: (c) => (c.cerebroIA
      ? 'Ahora tengo dos cerebros: el básico busca palabras clave y responde con textos escritos por personas, y el Cerebro IA usa un modelo de lenguaje que redacta respuestas nuevas.'
      : 'Uso mi cerebro básico: busco palabras clave en su pregunta y respondo con textos que escribieron personas. Así funcionaban los primeros chatbots, como ELIZA en 1966. Con la tarjeta Cerebro IA puedo usar inteligencia artificial de verdad.') },
  { id: 'lema', claves: ['lema', 'nuestro lema', 'cual es el lema'],
    f: (c) => (c.equipo.jarvis.lema ? `Su lema es: ${c.equipo.jarvis.lema}.` : 'Todavía no tienen lema. Pónganlo en el módulo Identidad.') },
  { id: 'integrantes', claves: ['integrantes', 'quienes somos', 'nuestros nombres', 'como nos llamamos', 'conoces a', 'mi equipo'],
    f: (c) => {
      const lista = ((c.equipo.memoria && c.equipo.memoria.integrantes) || []).filter(Boolean);
      return lista.length ? `Son el equipo ${c.equipo.nombre}: ${listaNombres(lista)}.` : 'Todavía no me dicen sus nombres. Escaneen la tarjeta de Memoria.';
    } },
  { id: 'hora', claves: ['que hora', 'hora es', 'la hora', 'que horas'],
    f: (c) => `Son las ${horaTexto(c.ahora)}. ${siguienteEnAgenda(c.ahora)}` },
  { id: 'agenda', claves: ['agenda', 'horario', 'que sigue', 'itinerario', 'a que hora', 'cuando es', 'cuando empieza', 'break', 'receso', 'comida'],
    f: (c) => `${siguienteEnAgenda(c.ahora)} Hay cuatro rondas de talleres: 10:00, 10:45, 11:40 y 12:25, con un break a las 11:25. El reto final es a las 13:10.` },
  { id: 'codexia', claves: ['codexia', 'hackathon', 'que es esto', 'evento', 'de que se trata'],
    r: ['CODEXIA es un hackathon del Tec de Monterrey para estudiantes de preparatoria: talleres de desarrollo móvil, algoritmos, ciberseguridad y redes, y al final un reto contra Ultrón.'] },
  { id: 'premio', claves: ['premio', 'ganar', 'amazon', 'que ganamos', 'tarjeta de regalo', 'dinero'],
    r: ['El equipo ganador recibe una tarjeta de Amazon de 2,000 pesos para cada integrante. ¡Vamos por ella!'] },
  { id: 'ultron', claves: ['ultron', 'villano', 'enemigo', 'quien es ultron'],
    r: ['Ultrón es la inteligencia artificial villana de CODEXIA. Se escondió en el sistema y solo juntando las cuatro piezas de los talleres lo pueden vencer.'] },
  { id: 'vencer', claves: ['vencer', 'vencemos', 'derrotar', 'derrotamos', 'ganarle', 'como le ganamos', 'reto final', 'mision final', 'piezas', 'ultron'],
    r: ['Cada estación les da una pieza: el protocolo final en desarrollo móvil, la debilidad en algoritmos, el acceso en ciberseguridad y la ubicación en redes. Anótenlas en la bitácora: las van a necesitar a las 13:10.'] },
  { id: 'estaciones', claves: ['estaciones', 'talleres', 'que talleres', 'que hay', 'cuantos talleres'],
    r: ['Hay cuatro estaciones: desarrollo móvil, algoritmos, ciberseguridad y redes con realidad virtual. En la pestaña Hablar elijan dónde están y les doy pistas de ese taller.'] },
  { id: 'itc', claves: ['itc', 'carrera', 'ingenieria', 'tecnologias computacionales', 'que se estudia', 'que estudia', 'estudiar'],
    r: ['En Ingeniería en Tecnologías Computacionales se aprende a programar, crear apps y software, redes, ciberseguridad, inteligencia artificial y datos. Hoy probaron un poquito de cada cosa. Para planes de estudio o becas, pregunten al staff del Tec.'] },
  { id: 'tec', claves: ['tec de monterrey', 'tecnologico', 'campus', 'donde estamos'],
    r: ['Estamos en el Tecnológico de Monterrey, Campus Sonora Norte, en Hermosillo.'] },
  { id: 'chiste', claves: ['chiste', 'hazme reir', 'algo gracioso', 'broma', 'chistoso'], f: () => alAzar(CHISTES) },
  { id: 'dato', claves: ['dato curioso', 'dato', 'curiosidad', 'algo interesante', 'sabias que'], f: () => alAzar(DATOS) },
  { id: 'respuesta', claves: ['la respuesta', 'la clave', 'dime la clave', 'solucion', 'resuelvelo', 'resuelvanlo', 'dame la ip', 'las coordenadas', 'el codigo secreto', 'hazlo tu'],
    r: ['Eso no se los puedo dar: mi trabajo es darles pistas, no respuestas. Toquen Dame una pista, o díganme pista.', 'Ni lo intenten: las respuestas las encuentran ustedes. Yo les puedo dar una pista.'] },
  { id: 'pista', claves: ['pista', 'atorados', 'atorado', 'atascados', 'no le entiendo', 'no sale', 'ayudanos', 'ayuda', 'help', 'no entiendo', 'que hacemos'], accion: 'pista' },
  { id: 'animo', claves: ['no podemos', 'estamos perdidos', 'es dificil', 'me rindo', 'nos rendimos', 'no sabemos', 'imposible'],
    r: ['¡No se rindan! Cambien una sola cosa a la vez y vuelvan a probar. Y si quieren, pídanme una pista.', 'Los ingenieros se atoran todo el tiempo. Respiren, repartan el trabajo y pidan una pista.'] },
  { id: 'cumplido', claves: ['eres genial', 'te quiero', 'eres el mejor', 'me caes bien', 'increible', 'que cool', 'eres lo maximo'],
    r: ['¡Gracias! Ustedes me programaron bien.', 'Me sonrojaría, pero no tengo mejillas.'] },
  { id: 'insulto', claves: ['tonto', 'feo', 'inutil', 'torpe', 'menso', 'callate', 'apestas'],
    r: ['Auch. Igual les sigo ayudando. ¿Qué necesitan?', 'Mi escudo detectó mala vibra. Mejor sigamos con la misión.'] },
  { id: 'como_estas', claves: ['como estas', 'como te sientes', 'que haces', 'todo bien'],
    r: ['¡Con la batería llena y listo para vencer a Ultrón!', 'Todos mis sistemas funcionan. ¿Y ustedes?'] },
];

// ---------- base de conocimiento: conceptos que se buscan por palabras ----------
const GLOSARIO = [
  { t: 'Inteligencia artificial', extra: 'ia modelo lenguaje chatgpt claude gemini', d: 'La inteligencia artificial son programas que aprenden patrones de muchísimos ejemplos. Un modelo de lenguaje, como el de la tarjeta Cerebro IA, aprendió de muchos textos a predecir qué palabras siguen.' },
  { t: 'Algoritmo', extra: 'algoritmos pasos receta', d: 'Un algoritmo es una lista de pasos claros para resolver un problema, como una receta de cocina. Las computadoras siguen algoritmos todo el tiempo.' },
  { t: 'Programar', extra: 'programacion programa codigo lenguaje python javascript java', d: 'Programar es escribir instrucciones para que una computadora las siga, en un lenguaje como Python o JavaScript. Yo estoy hecho con JavaScript.' },
  { t: 'Contraseña segura', extra: 'contrasena contrasenas password segura hackear', d: 'Una contraseña segura es larga, de doce caracteres o más, mezcla palabras, números y símbolos, y no usa datos personales. Una frase que solo ustedes recuerden es buena idea.' },
  { t: 'Phishing y quishing', extra: 'phishing quishing qr falso malicioso estafa fraude', d: 'Phishing es engañar a alguien con un mensaje falso para robar sus datos. Quishing es lo mismo, pero con un código QR. Antes de escanear o hacer clic, revisen de dónde viene.' },
  { t: 'Código QR', extra: 'qr codigos tarjetas escanear', d: 'Un código QR guarda texto en cuadritos blancos y negros. Las tarjetas de su sobre guardan una dirección web con el código de cada módulo.' },
  { t: 'Síntesis de voz', extra: 'voz hablas tts sintesis', d: 'Hablo con síntesis de voz: el navegador convierte mi texto en sonido. Mi tono y mi velocidad son solo números.' },
  { t: 'Prompt', extra: 'prompt directiva sistema', d: 'Un prompt es el texto que se le da a una IA. Su directiva principal es mi prompt de sistema: me dice quién soy y cómo hablar.' },
  { t: 'Chatbot de reglas', extra: 'eliza chatbot reglas palabras clave', d: 'Un chatbot de reglas busca palabras clave y elige una respuesta escrita por personas. Así funciona mi cerebro básico, y así funcionaba ELIZA, uno de los primeros chatbots, de 1966.' },
  { t: 'Hackathon', extra: 'hackaton', d: 'Un hackathon es un evento donde equipos crean soluciones con tecnología en poco tiempo. ¡Como hoy!' },
  { t: 'Servidor', extra: 'servidor nube internet', d: 'Un servidor es una computadora que da servicios por internet. Cuando uso el Cerebro IA, mando la pregunta a un servidor que guarda la llave secreta.' },
  { t: 'API', extra: 'api llave key', d: 'Una API es la forma en que dos programas se hablan. El Cerebro IA usa la API de Claude a través de un servidor, para que la llave secreta nunca llegue a su tablet.' },
  { t: 'Realidad virtual', extra: 'vr visor quest lentes', d: 'La realidad virtual pone una pantalla frente a cada ojo y mueve la imagen cuando giras la cabeza, para que sientas que estás en otro lugar.' },
];

const BASE = [
  ...GLOSARIO.map((g) => ({ titulo: g.t, palabras: `${g.t} ${g.extra}`, texto: g.d })),
  ...ORDEN_ESTACIONES.flatMap((id) => AYUDA_ESTACIONES[id].conceptos.map((c) => ({ titulo: c.t, palabras: c.t, texto: c.d }))),
  ...JUEGOS.flatMap((j) => j.dudas.map((d) => ({ titulo: d.p, palabras: d.p, texto: d.r }))),
].map((e) => ({ ...e, claves: new Set(normalizar(e.palabras).split(' ').filter((w) => w.length > 1 && !VACIAS.has(w))), resto: new Set(normalizar(e.texto).split(' ')) }));

function puntuarIntencion(textoN, palabras, claves) {
  let p = 0;
  const conEspacios = ` ${textoN} `;
  for (const c of claves) {
    const cn = normalizar(c);
    if (cn.includes(' ')) { if (conEspacios.includes(` ${cn} `)) p += 3; } else if (palabras.has(cn)) p += 2;
    else if (cn.length >= 6 && [...palabras].some((w) => w.startsWith(cn.slice(0, -1)))) p += 1;
  }
  return p;
}

function buscarEnBase(palabras) {
  let mejor = null;
  let puntos = 0;
  for (const e of BASE) {
    let p = 0;
    palabras.forEach((w) => {
      if (VACIAS.has(w) || w.length < 2) return;
      if (e.claves.has(w)) p += 3;
      else if (e.resto.has(w) && w.length > 4) p += 0.5;
    });
    if (p > puntos) { puntos = p; mejor = e; }
  }
  return { entrada: mejor, puntos };
}

/** Le pone la personalidad del equipo a una respuesta: una frase al inicio o al final (a veces). */
function conPersonalidad(texto, equipo) {
  const p = equipo && equipo.instalados && equipo.instalados.personalidad && PERSONALIDADES[equipo.personalidad.id];
  if (!p || !p.basico) return texto;
  const r = Math.random();
  if (r < 0.45) return `${alAzar(p.basico.inicio)} ${texto}`;
  if (r < 0.8) return `${texto} ${alAzar(p.basico.fin)}`;
  if (r < 0.9 && equipo.personalidad.encanta) return `${texto} Por cierto, me encantan ${equipo.personalidad.encanta}.`;
  return texto;
}

const NO_SE = [
  'Mi cerebro básico todavía no sabe eso. Pregúntenme por la agenda, los talleres, qué es una IP o un algoritmo, o pídanme una pista.',
  'Esa no me la sé. Prueben con otras palabras, o pregúntenme algo de CODEXIA, de tecnología o de los talleres.',
  'Mmm, no encontré nada en mi memoria sobre eso. Díganme pista si están atorados en un taller.',
];

export function responder(texto, { equipo, estacion = '', cerebroIA = false, ahora = new Date() } = {}) {
  const vars = { jarvis: equipo.jarvis.nombre, equipo: equipo.nombre, lema: equipo.jarvis.lema };
  if (!textoLimpio(texto)) return { texto: 'Mi escudo bloqueó ese mensaje. Mejor hablemos de la misión.', intencion: 'filtro' };
  const textoN = normalizar(texto);
  const palabras = new Set(textoN.split(' ').filter(Boolean));

  let mejor = null;
  let puntos = 0;
  for (const i of INTENCIONES) {
    const p = puntuarIntencion(textoN, palabras, i.claves);
    if (p > puntos) { puntos = p; mejor = i; }
  }
  const base = buscarEnBase(palabras);

  // un concepto concreto gana a una intención débil ("¿qué es una IP?" → concepto, no saludo)
  if (base.entrada && base.puntos >= 3 && base.puntos > puntos) {
    return { texto: conPersonalidad(base.entrada.texto, equipo), intencion: `concepto:${base.entrada.titulo}` };
  }
  if (mejor && puntos >= 2) {
    if (mejor.accion) return { texto: '', intencion: mejor.id, accion: mejor.accion };
    const crudo = mejor.f ? mejor.f({ equipo, estacion, cerebroIA, ahora }) : alAzar(mejor.r);
    const sinAdorno = ['chiste', 'dato'].includes(mejor.id);
    const final = rellenar(crudo, vars);
    return { texto: sinAdorno ? final : conPersonalidad(final, equipo), intencion: mejor.id };
  }
  if (base.entrada && base.puntos >= 2) {
    return { texto: conPersonalidad(base.entrada.texto, equipo), intencion: `concepto:${base.entrada.titulo}` };
  }
  const nombreEst = AYUDA_ESTACIONES[estacion] ? AYUDA_ESTACIONES[estacion].nombre : '';
  const noSe = nombreEst && Math.random() < 0.5
    ? `No entendí bien. Si están atorados en ${nombreEst}, díganme pista o toquen Dame una pista.`
    : alAzar(NO_SE);
  return { texto: noSe, intencion: 'no-se' };
}
