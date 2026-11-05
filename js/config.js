/* JARVIS · configuración
 *
 * API_URL: la dirección del Worker de Cloudflare (ver LEEME.md, paso 2), por ejemplo
 *   'https://jarvis-codexia.tu-cuenta.workers.dev'
 * Si se deja vacía, JARVIS funciona igual con su cerebro básico (respuestas pre-escritas). Cada tablet
 * guarda su propio JARVIS; el servidor solo se usa para el Cerebro IA.
 * En localhost se usa el servidor de prueba (dev/servidor.mjs) automáticamente.
 */
export const CONFIG = {
  API_URL: '',
  // Cerebro IA (tarjeta H4): 'auto' = usa la IA si hay API_URL y si falla contesta el cerebro básico;
  // 'basico' = nunca llama a la IA (todo con respuestas pre-escritas).
  IA: 'auto',
  // Clave de los códigos de verificación de los juegos VR (la de ITC-VR-Games/js/config.js).
  CLAVE_VR: 'enlace-vr-2026',
  // Los juegos VR de la estación de Redes (de ahí se toman los videos).
  JUEGOS_VR: 'https://mparra37.github.io/ITC-VR-Games/codexia/',
  // Horario de los talleres. Al empezar cada ronda JARVIS pregunta en qué estación están (para darles
  // las pistas de ese taller) y en los últimos minutos recuerda anotar la pieza y los puntos.
  FECHA_EVENTO: '2026-11-07',
  RONDAS: [
    { id: 'r1', nombre: 'Ronda 1', inicio: '10:00', fin: '10:45' },
    { id: 'r2', nombre: 'Ronda 2', inicio: '10:45', fin: '11:25' },
    { id: 'r3', nombre: 'Ronda 3', inicio: '11:40', fin: '12:25' },
    { id: 'r4', nombre: 'Ronda 4', inicio: '12:25', fin: '13:10' },
  ],
  // 'evento' = solo el día del evento · 'siempre' = cualquier día (pruebas piloto) · 'nunca'
  RECORDATORIOS: 'evento',
};

export function urlApi() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const forzar = new URLSearchParams(location.search).get('api');
  if (forzar) return forzar.replace(/\/$/, '');
  if (CONFIG.API_URL) return CONFIG.API_URL.replace(/\/$/, '');
  return local ? location.origin : '';
}
