/* JARVIS · misiones: el camino guiado del taller
 *
 * La app siempre muestra UNA misión: la primera que falta. Fase 1 (armar) lleva a encenderlo;
 * fase 2 (descubrir) son misiones extra para el resto del tiempo. Una misión se cumple sola cuando
 * pasa lo que pide (escanear la tarjeta, preguntar, tomar la foto…), en cualquier orden.
 */

const inst = (e, m) => Boolean(e.instalados && e.instalados[m]);
const hab = (e, h) => Boolean(e.habilidades && e.habilidades[h]);
const logro = (e, k) => (e.logros && e.logros[k]) || 0;

export const MISIONES = [
  // ---------- fase 1: armar ----------
  { id: 'identidad', fase: 1, icono: 'identidad', color: '#38bdf8', guia: 'escanear',
    titulo: 'Denle un nombre', como: 'Busquen la tarjeta IDENTIDAD (azul) y escanéenla.',
    hecho: (e) => inst(e, 'identidad') },
  { id: 'voz', fase: 1, icono: 'voz', color: '#a78bfa', guia: 'escanear',
    titulo: 'Denle una voz', como: 'Escaneen una tarjeta de VOZ (morada). ¡Prueben varias y quédense con su favorita!',
    hecho: (e) => inst(e, 'voz') },
  { id: 'nucleo', fase: 1, icono: 'nucleo', color: '#34d399', guia: 'escanear',
    titulo: 'Elijan su forma', como: 'Escaneen una tarjeta de NÚCLEO VISUAL (verde) y escojan un color.',
    hecho: (e) => inst(e, 'nucleo') },
  { id: 'personalidad', fase: 1, icono: 'personalidad', color: '#f472b6', guia: 'directiva',
    titulo: 'Denle personalidad', como: 'Escaneen una tarjeta de PERSONALIDAD (rosa) y armen su directiva principal.',
    hecho: (e) => inst(e, 'personalidad') },
  { id: 'encender', fase: 1, icono: 'nucleo', color: '#3dff9a', guia: 'encender',
    titulo: '¡Enciéndanlo!', como: 'Toquen INICIAR: su JARVIS arranca y se presenta.',
    hecho: (e) => Boolean(e.encendido) },

  // ---------- fase 2: descubrir ----------
  { id: 'preguntas', fase: 2, icono: 'chat', color: '#3fd0ff', ir: 'hablar',
    titulo: 'Háganle 3 preguntas', como: 'En Hablar, escríbanle o toquen el micrófono. Pregúntenle de CODEXIA, de tecnología o de su equipo.',
    progreso: (e) => [Math.min(3, logro(e, 'preguntas')), 3] },
  { id: 'ambiente', fase: 2, icono: 'ambiente', color: '#fbbf24', guia: 'escanear',
    titulo: 'Pónganle un escenario', como: 'Escaneen una tarjeta de AMBIENTE (amarilla).',
    hecho: (e) => inst(e, 'ambiente') },
  { id: 'memoria', fase: 2, icono: 'memoria', color: '#fb923c', guia: 'escanear',
    titulo: 'Enséñenle quiénes son', como: 'Escaneen MEMORIA (naranja) y escriban sus nombres. Luego pregúntenle: ¿quiénes somos?',
    hecho: (e) => inst(e, 'memoria') && ((e.memoria && e.memoria.integrantes) || []).length > 0 },
  { id: 'herramientas', fase: 2, icono: 'habilidades', color: '#2dd4bf', guia: 'escanear',
    titulo: 'Instálenle herramientas', como: 'Escaneen BITÁCORA, PUNTOS y CÁMARA (verde agua). Aparecen abajo como pestañas.',
    progreso: (e) => [['bitacora', 'puntos', 'camara'].filter((h) => hab(e, h)).length, 3] },
  { id: 'foto', fase: 2, icono: 'camara', color: '#2dd4bf', ir: 'camara',
    titulo: 'Foto del equipo', como: 'Con la cámara de JARVIS, tómense una foto todos juntos.',
    hecho: (e) => Boolean(logro(e, 'foto')) },
  { id: 'escudo', fase: 2, icono: 'escudo', color: '#94a3b8', guia: 'escanear',
    titulo: 'Protéjanlo', como: 'Escaneen ESCUDO (gris) y lean las reglas que nadie puede romper.',
    hecho: (e) => inst(e, 'escudo') },
  { id: 'acciones', fase: 2, icono: 'accion', color: '#e879f9', guia: 'escanear',
    titulo: 'Las 3 tarjetas secretas', como: 'En el sobre hay 3 tarjetas de ACCIÓN (lila). Escanéenlas: ¿qué hace cada una?',
    progreso: (e) => [Object.keys((e.logros && e.logros.acciones) || {}).length, 3] },
  { id: 'pista', fase: 2, icono: 'bitacora', color: '#ffd23f', ir: 'hablar', guia: 'pista',
    titulo: 'Pídanle una pista', como: 'En Hablar toquen el botón del taller (📍), elijan uno y pidan una pista. Así les ayuda en los talleres.',
    hecho: (e) => Boolean(logro(e, 'pista')) },
  { id: 'super', fase: 2, icono: 'chat', color: '#3dff9a', guia: 'escanear', opcional: true, soloConIA: true,
    titulo: 'Súper inteligencia', como: 'Escaneen la tarjeta H4: JARVIS se conecta a una IA y le pueden preguntar lo que sea.',
    hecho: (e) => hab(e, 'chat') },
];

/** ¿Está cumplida? (las de progreso, cuando llegan al total) */
export function cumplida(m, e) {
  if (m.progreso) { const [a, b] = m.progreso(e); return a >= b; }
  return m.hecho(e);
}

/** Las misiones que se muestran (la de Súper inteligencia solo si hay IA). */
export function misionesVisibles(conIA) {
  return MISIONES.filter((m) => !m.soloConIA || conIA);
}

export function siguiente(e, fase, conIA) {
  return misionesVisibles(conIA).find((m) => m.fase === fase && !cumplida(m, e)) || null;
}
